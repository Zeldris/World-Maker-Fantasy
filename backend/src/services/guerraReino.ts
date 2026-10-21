// CR-37 (hito 0.3, Fase E): guerra de una facción contra el Reino de la jugadora. Decisiones Q1-Q7 de
// la ronda de detalle (`docs/producto/plan-roadmap-0.3.md`; X4 marca el camino):
//
// - Hay guerra cuando la relación de la facción con el Reino está en la banda GUERRA (la misma presión
//   que entre facciones, X4: la reputación cruza un umbral).
// - CR-67 (principio 10, X4): sin temporizador. Cada día, si le sobra comida (7 días, la prudencia de
//   `CR-63`) y no tiene ya un ejército en marcha, sopesa sus soldados, la presión de la guerra y la
//   defensa que estima en cada asentamiento del Reino al que llega; si le salen las cuentas, manda lo
//   que cree necesitar (con colchón, hasta 16, dejando un tercio en casa; Fácil: la mitad) como viajero
//   `ASALTO` contra el más débil. Los que salen dejan de contar en sus soldados hasta que vuelven (los
//   que mueren no vuelven). Se resuelve con la defensa de `CR-65` al llegar (`asaltos.ts`).
import type { Prisma, PrismaClient } from '@prisma/client';
import { ajustesAsaltos, asentamientosDelReino, contextoDefensa, defensaVista, TIPO_ASALTO } from './defensaReino.js';
import { decidirAtaque, motivoGuerra } from './cronista/decisionAsalto.js';
import { DIAS_RESERVA_PARA_CAZAR, diasDeReservaFaccion } from './partidasFacciones.js';
import { avisoDeViajero, crearViajero, enlacesDelMundo, rutaMasCorta, TRABAJOS } from './viajeros.js';
import { recordFactionEvent } from './factionRelations.js';
import { ownerKeyFor } from './reinoOwner.js';
import { elegirGenteDeAtaque } from './ataquesCampamento.js';
import { aplicarBajas, cazadoresDe } from './partidasCaza.js';
import { coberturaDeFaccion, reforzarDefensaFaccion } from './defensaFacciones.js';
import { baseDePueblo, soldadoGenerico } from './cronista/combatientesFaccion.js';
import { simularCombateDeFondo } from './combateDeFondo.js';
import { botinDe, type Botin } from './asaltos.js';

type Tx = Prisma.TransactionClient;

/// Tope de un ejército (lo que cabe en un combate de fondo de dos grupos).
export const MAX_EJERCITO = 16;

/// Puro: soldados que nunca salen de casa (un tercio).
export function soldadosEnCasa(soldados: number): number {
  return Math.ceil(soldados / 3);
}

/// La facción del Reino de la partida (la que no tiene origen en el catálogo).
export async function faccionDelReino(prisma: Pick<PrismaClient, 'faction'>, saveId: string) {
  return prisma.faction.findFirst({ where: { saveId, origenSlug: null, disueltaEn: null }, select: { id: true, name: true } });
}

/// P298: la lista de la pestaña Guerra en un orden estable (más presión primero; a igualdad, por
/// nombre e id): sin desempate, el orden cambiaba entre cargas y «Tributo» pagaba a otra facción.
export function ordenarEnemigas<T extends { id: string; nombre: string; presion: number }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => b.presion - a.presion || a.nombre.localeCompare(b.nombre, 'es') || a.id.localeCompare(b.id));
}

/// Las facciones en guerra con el Reino.
export async function enGuerraConElReino(prisma: Pick<PrismaClient, 'faction' | 'factionRelation'>, saveId: string): Promise<string[]> {
  const reino = await faccionDelReino(prisma, saveId);
  if (!reino) return [];
  const rel = await prisma.factionRelation.findMany({ where: { type: 'GUERRA', OR: [{ sourceFactionId: reino.id }, { targetFactionId: reino.id }] }, select: { sourceFactionId: true, targetFactionId: true } });
  return [...new Set(rel.map((r) => (r.sourceFactionId === reino.id ? r.targetFactionId : r.sourceFactionId)))];
}

/// Un día: cada facción en guerra con el Reino que pueda manda su ejército. Devuelve cuántos salen.
export async function lanzarEjercitosContraElReino(prisma: PrismaClient, saveId: string, dia: number): Promise<number> {
  const enemigas = await enGuerraConElReino(prisma, saveId);
  if (enemigas.length === 0) return 0;
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true } });
  if (!save) return 0;
  const enlaces = await enlacesDelMundo(prisma, save.worldId);
  let salen = 0;
  for (const factionId of enemigas) {
    await prisma.$transaction(async (tx) => {
      const f = await tx.faction.findFirst({
        where: { id: factionId, disueltaEn: null },
        select: { id: true, name: true, kingdomStats: true, buildings: { where: { locationId: { not: null } }, select: { locationId: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1 } },
      });
      const casa = f?.buildings[0]?.locationId;
      if (!f || !casa || !f.kingdomStats || diasDeReservaFaccion(f.kingdomStats) < DIAS_RESERVA_PARA_CAZAR) return;
      // Un ejército en marcha a la vez (sin temporizador: tras una derrota, le faltan soldados).
      if (await tx.viajero.findFirst({ where: { saveId, factionId: f.id, tipo: TIPO_ASALTO, estado: { not: 'TERMINADO' } }, select: { id: true } })) return;
      // El asentamiento del Reino al que llega que menos defensa parece tener (a igualdad, el más cercano).
      const ahora = dia * 1440;
      const ctx = await contextoDefensa(tx, saveId, ahora);
      let objetivo: { locationId: string; nombre: string; pasos: number; defensa: number } | null = null;
      for (const a of await asentamientosDelReino(tx, saveId)) {
        const ruta = rutaMasCorta(enlaces, casa, a.locationId);
        if (!ruta) continue;
        const defensa = await defensaVista(tx, saveId, a, ahora, ctx);
        if (!objetivo || defensa < objetivo.defensa || (defensa === objetivo.defensa && ruta.length < objetivo.pasos)) objetivo = { locationId: a.locationId, nombre: a.nombre, pasos: ruta.length, defensa };
      }
      if (!objetivo) return;
      const reino = await faccionDelReino(tx, saveId);
      const presion = reino ? Math.max(0, ...(await tx.factionRelation.findMany({ where: { OR: [{ sourceFactionId: f.id, targetFactionId: reino.id }, { sourceFactionId: reino.id, targetFactionId: f.id }] }, select: { presion: true } })).map((r) => r.presion)) : 0;
      const { intensidad, tamano } = await ajustesAsaltos(tx, saveId);
      const soldados = f.kingdomStats.soldados;
      const d = decidirAtaque({ fuerza: soldados, enCasa: soldadosEnCasa(soldados), defensa: objetivo.defensa, motivo: motivoGuerra(presion), intensidad, tamano, maximo: MAX_EJERCITO });
      if (!d.ataca) return;
      const van = d.manda;
      const motivo = `${f.name} ha reunido ${soldados} soldados y la guerra está ${presion >= 95 ? 'en su peor momento' : 'encendida'}.`;
      const r = await crearViajero(tx, { saveId, factionId: f.id, tipo: TIPO_ASALTO, origenLocationId: casa, destinoLocationId: objetivo.locationId, dia, carga: { motivo }, miembros: [{ genericos: van, rol: 'soldado' }] });
      if (!r.ok) return;
      // Los que salen no están en casa (si atacas su asentamiento mientras, defienden menos).
      await tx.kingdomStats.update({ where: { id: f.kingdomStats.id }, data: { soldados: { decrement: van } } });
      await avisoDeViajero(tx, { saveId, factionId: null }, `${f.name} manda ${van} soldados contra ${objetivo.nombre}: estamos en guerra.`);
      salen++;
    });
  }
  return salen;
}

// ─────────────────────────── 37b: tributo y contraataque ───────────────────────────

/// Q4: cada 100 Goirnos de tributo bajan la presión una vez (`TRIBUTO`, −10); como mucho 5 de golpe.
export const GOIRNOS_POR_TRIBUTO = 100;
export const MAX_TRIBUTOS = 5;

/// Q4 «Ofrecer tributo»: el Reino paga Goirnos a una facción en guerra o tensión con él y baja la
/// presión de su relación (las dos direcciones que haya). Devuelve la banda en que queda.
export async function ofrecerTributo(tx: Tx, saveId: string, factionId: string, goirnos: number): Promise<{ ok: true; pagado: number; relacion: string } | { ok: false; motivo: string }> {
  const reino = await faccionDelReino(tx, saveId);
  const f = await tx.faction.findFirst({ where: { id: factionId, saveId, disueltaEn: null }, select: { id: true, worldId: true, name: true } });
  if (!reino || !f || f.id === reino.id) return { ok: false, motivo: 'No hay a quién pagar.' };
  const relaciones = await tx.factionRelation.findMany({ where: { OR: [{ sourceFactionId: f.id, targetFactionId: reino.id }, { sourceFactionId: reino.id, targetFactionId: f.id }] }, select: { sourceFactionId: true, targetFactionId: true, type: true } });
  if (!relaciones.some((r) => r.type === 'GUERRA' || r.type === 'TENSION')) return { ok: false, motivo: `No hay tensión con ${f.name} que calmar.` };
  const veces = Math.min(MAX_TRIBUTOS, Math.floor(goirnos / GOIRNOS_POR_TRIBUTO));
  if (veces <= 0) return { ok: false, motivo: `El tributo va de ${GOIRNOS_POR_TRIBUTO} en ${GOIRNOS_POR_TRIBUTO} Goirnos.` };
  const pagado = veces * GOIRNOS_POR_TRIBUTO;
  const { count } = await tx.kingdomStats.updateMany({ where: { ownerKey: ownerKeyFor({ saveId }), riqueza: { gte: pagado } }, data: { riqueza: { decrement: pagado } } });
  if (count === 0) return { ok: false, motivo: `No te llega: ${pagado} Goirnos.` };
  await tx.kingdomStats.updateMany({ where: { factionId: f.id }, data: { riqueza: { increment: pagado } } });
  for (const r of relaciones) for (let i = 0; i < veces; i++) await recordFactionEvent(tx, f.worldId, r.sourceFactionId, r.targetFactionId, 'TRIBUTO', saveId);
  const tras = await tx.factionRelation.findMany({ where: { OR: [{ sourceFactionId: f.id, targetFactionId: reino.id }, { sourceFactionId: reino.id, targetFactionId: f.id }] }, select: { type: true } });
  const peor = tras.some((r) => r.type === 'GUERRA') ? 'GUERRA' : tras.some((r) => r.type === 'TENSION') ? 'TENSION' : (tras[0]?.type ?? 'NEUTRAL');
  await avisoDeViajero(tx, { saveId, factionId: null }, `Pagas ${pagado} Goirnos de tributo a ${f.name}: ${peor === 'GUERRA' ? 'siguen en guerra, pero menos' : peor === 'TENSION' ? 'la guerra se enfría a tensión' : 'se calman las cosas'}.`);
  return { ok: true, pagado, relacion: peor };
}

export const TIPO_ATAQUE_ASENTAMIENTO = 'ATAQUE_ASENTAMIENTO';

/// Q5: el Reino manda una partida contra la casa de una facción con la que está en guerra.
export async function lanzarAtaqueAAsentamiento(tx: Tx, saveId: string, p: { factionId: string; companionIds?: string[]; subjectIds?: string[] }, ahora: number): Promise<{ ok: true; id: string } | { ok: false; motivo: string }> {
  if (!(await enGuerraConElReino(tx, saveId)).includes(p.factionId)) return { ok: false, motivo: 'Solo se ataca a quien está en guerra contigo.' };
  const casa = (await tx.building.findFirst({ where: { factionId: p.factionId, locationId: { not: null } }, select: { locationId: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }))?.locationId;
  if (!casa) return { ok: false, motivo: 'No se sabe dónde está su casa.' };
  const g = await elegirGenteDeAtaque(tx, saveId, p, ahora);
  if (!g.ok) return g;
  return crearViajero(tx, {
    saveId, tipo: TIPO_ATAQUE_ASENTAMIENTO, objetivo: p.factionId, origenLocationId: g.origenId, destinoLocationId: casa, dia: Math.floor(ahora / 1440),
    miembros: [...g.companionIds.map((id) => ({ companionId: id, rol: 'guerrero' })), ...g.subjectIds.map((id) => ({ subjectId: id, rol: 'guerrero' }))],
  });
}

/// Al llegar: pelea de fondo contra sus soldados (hasta 16) con la cobertura de su Empalizada. Si
/// gana el Reino, saquea lo que cargan los que quedan en pie (como un asalto), la facción refuerza su
/// Empalizada y la guerra se enciende; al volver, el botín entra en el Reino.
TRABAJOS[TIPO_ATAQUE_ASENTAMIENTO] = {
  alLlegar: async (tx, v, dia, random) => {
    const f = v.objetivo ? await tx.faction.findFirst({ where: { id: v.objetivo, disueltaEn: null }, select: { id: true, name: true, raza: true, worldId: true, kingdomStats: { select: { id: true, soldados: true, comida: true, riqueza: true } } } }) : null;
    if (!f?.kingdomStats) return;
    const nuestros = await cazadoresDe(tx, v, f.worldId);
    const cobertura = await coberturaDeFaccion(tx, f.id);
    const base = await baseDePueblo(tx, f.worldId, f.raza);
    const n = Math.min(MAX_EJERCITO, f.kingdomStats.soldados);
    const suyos = Array.from({ length: n }, (_, i) => ({ ...soldadoGenerico(`defensa-${f.id}-${i}`, 'Soldado', 'B', base, true), bonoDefensa: cobertura }));
    const r = simularCombateDeFondo([...nuestros.map((h) => h.c), ...suyos], random);
    const estado = new Map(r.estados.map((e) => [e.id, e]));
    await aplicarBajas(tx, v.saveId, nuestros, new Map(r.estados.map((e) => [e.id, e.condicion])), new Set(r.estados.filter((e) => e.muerto).map((e) => e.id)), dia, 'guerra', null);
    const muertos = suyos.filter((s) => estado.get(s.id)?.muerto).length;
    if (muertos > 0) await tx.kingdomStats.update({ where: { id: f.kingdomStats.id }, data: { soldados: Math.max(0, f.kingdomStats.soldados - muertos) } });
    const reino = await faccionDelReino(tx, v.saveId);
    if (reino) await recordFactionEvent(tx, f.worldId, f.id, reino.id, 'BAJA_DE_GUERRA', v.saveId);
    if (r.ganador !== 'A') {
      await avisoDeViajero(tx, v, `La partida no puede con la casa de ${f.name}${muertos > 0 ? ` (caen ${muertos} de los suyos)` : ''} y vuelve.`);
      return;
    }
    const enPie = nuestros.filter((h) => { const e = estado.get(h.c.id); return e && !e.muerto && e.condicion !== 'CONVALECIENTE'; }).length;
    const botin = botinDe(enPie, { comida: f.kingdomStats.comida, goirnos: f.kingdomStats.riqueza, objetos: 0 });
    await tx.kingdomStats.update({ where: { id: f.kingdomStats.id }, data: { comida: { decrement: botin.comida }, riqueza: { decrement: botin.goirnos } } });
    await tx.viajero.update({ where: { id: v.id }, data: { carga: { botin } as unknown as Prisma.InputJsonValue } });
    await reforzarDefensaFaccion(tx, f.id);
    await avisoDeViajero(tx, v, `La partida asalta la casa de ${f.name} y se lleva ${botin.comida} de comida y ${botin.goirnos} Goirnos.`);
  },
  alVolver: async (tx, v) => {
    const botin = (v.carga as { botin?: Botin } | null)?.botin;
    if (botin) await tx.kingdomStats.updateMany({ where: { ownerKey: ownerKeyFor({ saveId: v.saveId }) }, data: { comida: { increment: botin.comida }, riqueza: { increment: botin.goirnos } } });
  },
};
