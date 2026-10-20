// CR-50 (hito 0.3, Fase E, paso 50c): acabar con un campamento de bandidos. Decisiones Q5, Q6 y Q8
// de la ronda de detalle (`docs/producto/plan-roadmap-0.3.md`):
//
// - En vivo: el personaje pelea con la banda en su lugar (combate de varios de `CR-49`); al acabar,
//   `bajasDeCampamentoEnVivo` descuenta a los caídos.
// - Con una partida «Atacar campamento» del Reino (viajero `ATAQUE`), de fondo al llegar.
// - Las patrullas de las facciones dueñas de la región, cada semana y de fondo (X4: la policía de cada
//   facción caza piratas en su territorio).
// - Si cae el cabecilla (o no queda nadie), el campamento se disuelve (BG3, D&D): botín de lo saqueado
//   más un cofre de Goirnos (Manor Lords), reputación con las facciones de la región (Bellwright) y
//   suceso en el Libro.
import type { Prisma, PrismaClient } from '@prisma/client';
import { slugify } from '../lib/slugify.js';
import { simularCombateDeFondo, type CombatienteFondo } from './combateDeFondo.js';
import { baseDePueblo, soldadoGenerico } from './cronista/combatientesFaccion.js';
import { NIVEL_MAS_CABECILLA, ocupanteDe } from './cronista/campamentosBandidos.js';
import { registrarSuceso } from './cronista/sucesos.js';
import { sincronizarPunto } from './campamentos.js';
import { aplicarBajas, cazadoresDe } from './partidasCaza.js';
import { MAX_MIEMBROS_PARTIDA, ocupados, opcionesDePartida } from './partidasReino.js';
import { applyFactionRepDelta, parseFactionsStatus, REGION_OWNING_FACTIONS } from './reputation.js';
import { ownerKeyFor } from './reinoOwner.js';
import { esAdultoSubdito, rolDeSubdito } from './cronista/subditos.js';
import { avisoDeViajero, crearViajero, TRABAJOS } from './viajeros.js';

type Tx = Prisma.TransactionClient;
type CampamentoFila = Prisma.CampamentoGetPayload<object>;

/// Q5: el cofre de Goirnos que guarda todo campamento (provisional).
export const COFRE_CAMPAMENTO = 50;
/// Q6: reputación con cada facción dueña de la región al acabar con un campamento (provisional).
export const REP_POR_CAMPAMENTO = 60;
/// Q8: soldados que manda una facción de patrulla contra un campamento, y la que necesita tener.
export const PATRULLA_CONTRA_CAMPAMENTO = 8;
export const TIPO_ATAQUE = 'ATAQUE';

/// Q5-Q6: el campamento cae. Si lo tumba el Reino (en vivo o con su partida), el botín y la
/// reputación son suyos.
export async function disolverCampamento(tx: Tx, c: CampamentoFila, dia: number, por: { reino: boolean; quien: string }): Promise<void> {
  const fresco = await tx.campamento.updateMany({ where: { id: c.id, estado: 'ACTIVO' }, data: { estado: 'DESTRUIDO', caidoDia: dia, gente: 0 } });
  if (fresco.count === 0) return;
  await sincronizarPunto(tx, { zonePointId: c.zonePointId, gente: 0, estado: 'DESTRUIDO' });
  const grupo = ocupanteDe(c.ocupante)?.grupo ?? 'bandidos';
  const lugar = (await tx.location.findUnique({ where: { id: c.locationId }, select: { name: true } }))?.name ?? 'un paso';
  if (por.reino) {
    const goirnos = c.botinGoirnos + COFRE_CAMPAMENTO;
    await tx.kingdomStats.updateMany({ where: { ownerKey: ownerKeyFor({ saveId: c.saveId }) }, data: { riqueza: { increment: goirnos }, comida: { increment: c.botinComida } } });
    const ws = await tx.worldState.findUnique({ where: { saveId: c.saveId }, select: { factionsStatus: true } });
    if (ws) {
      let estado = parseFactionsStatus(ws.factionsStatus);
      for (const f of REGION_OWNING_FACTIONS[c.region] ?? []) estado = applyFactionRepDelta(estado, f, REP_POR_CAMPAMENTO);
      await tx.worldState.update({ where: { saveId: c.saveId }, data: { factionsStatus: estado } });
    }
    await avisoDeViajero(tx, { saveId: c.saveId, factionId: null }, `Cae el campamento de ${grupo.toLowerCase()} en ${lugar}: el Reino se queda con ${goirnos} Goirnos${c.botinComida > 0 ? ` y ${c.botinComida} de comida` : ''}, y los de la región te lo agradecen.`);
  }
  await registrarSuceso(tx, {
    saveId: c.saveId, tipo: 'CAMPAMENTO_DESTRUIDO', fictionalMinutes: dia * 1440, regionSlug: slugify(c.region), locationId: c.locationId, origen: por.reino ? 'JUGADOR' : 'MUNDO',
    actores: [{ entidadTipo: 'LOCATION', entidadId: c.locationId, papel: 'LUGAR' }, ...(por.reino ? [{ entidadTipo: 'PERSONAJE' as const, entidadId: c.saveId, papel: 'AUTOR' as const }] : [])],
    datos: { campamento: grupo.toLowerCase(), lugar, por: por.quien },
  });
}

/// En vivo (Q5): tras un combate del personaje contra la banda de un campamento en su lugar, caen
/// `caidos` (el cabecilla, el último). Devuelve si el campamento ha caído.
export async function bajasDeCampamentoEnVivo(tx: Tx, saveId: string, locationId: string, npcSlug: string, caidos: number, dia: number, personaje: string): Promise<boolean> {
  const c = (await tx.campamento.findMany({ where: { saveId, locationId, estado: 'ACTIVO' } })).find((x) => ocupanteDe(x.ocupante)?.npcSlug === npcSlug);
  if (!c || caidos <= 0) return false;
  if (caidos >= c.gente + 1) {
    await disolverCampamento(tx, c, dia, { reino: true, quien: personaje });
    return true;
  }
  const gente = c.gente - caidos;
  await tx.campamento.update({ where: { id: c.id }, data: { gente } });
  await sincronizarPunto(tx, { ...c, gente });
  return false;
}

/// La banda de un campamento para una pelea de fondo: sus genéricos y el cabecilla (líder, con nombre).
async function bandaDe(tx: Tx, c: CampamentoFila, worldId: string): Promise<CombatienteFondo[]> {
  const o = ocupanteDe(c.ocupante);
  const base = await baseDePueblo(tx, worldId, o?.pueblo ?? null);
  const nivel = o?.nivel ?? 3;
  const banda = Array.from({ length: c.gente }, (_, i) => soldadoGenerico(`bandido-${c.id}-${i}`, o?.grupo ?? 'Bandido', 'B', base, true, nivel));
  banda.push({ ...soldadoGenerico(`cabecilla-${c.id}`, c.cabecilla, 'B', base, true, nivel + NIVEL_MAS_CABECILLA), lider: true, conNombre: true });
  return banda;
}

/// Pelea de fondo contra la banda; aplica las bajas del campamento. Devuelve si ha caído y el
/// resultado del combate.
async function pelearContraCampamento(tx: Tx, c: CampamentoFila, atacantes: CombatienteFondo[], worldId: string, dia: number, por: { reino: boolean; quien: string }, random: () => number) {
  const banda = await bandaDe(tx, c, worldId);
  const r = simularCombateDeFondo([...atacantes, ...banda], random);
  const estado = new Map(r.estados.map((e) => [e.id, e]));
  const fuera = (id: string) => { const e = estado.get(id); return !!e && (e.muerto || e.condicion === 'CONVALECIENTE'); };
  const caenBandidos = banda.filter((b) => !b.lider && fuera(b.id)).length;
  const caeCabecilla = fuera(`cabecilla-${c.id}`);
  const gente = c.gente - caenBandidos;
  if (caeCabecilla || gente <= 0) {
    await disolverCampamento(tx, c, dia, por);
    return { cae: true, r, caenBandidos };
  }
  await tx.campamento.update({ where: { id: c.id }, data: { gente } });
  await sincronizarPunto(tx, { ...c, gente });
  return { cae: false, r, caenBandidos };
}

/// Q5: súbditos que pueden ir a por un campamento (soldados, vigías y cazadores adultos que no estén
/// fuera).
export async function guerrerosLibres(tx: Tx, saveId: string, ahora: number): Promise<{ id: string; name: string; rol: string }[]> {
  const fuera = (await ocupados(tx, saveId)).subjects;
  const subditos = await tx.subject.findMany({ where: { saveId, estado: 'ACTIVO' }, select: { id: true, name: true, role: true, pueblo: true, nacidoEn: true }, orderBy: { createdAt: 'asc' } });
  return subditos
    .filter((s) => ['soldado', 'cazador', 'vigia'].includes(rolDeSubdito(s.role)) && esAdultoSubdito(s, ahora) && !fuera.has(s.id))
    .map((s) => ({ id: s.id, name: s.name, rol: rolDeSubdito(s.role) }));
}

export interface PeticionAtaque {
  campamentoId: string;
  companionIds?: string[];
  subjectIds?: string[];
}

/// Q5: el Reino manda una partida a por un campamento que conoce: tus grupos 2+, tus cazadores y
/// tus soldados.
/// Quién va en una partida de ataque (campamento o asentamiento enemigo): grupos 2+ y soldados,
/// vigías y cazadores libres; nadie que no pueda salir, sin repetidos y con el tope de una partida.
export async function elegirGenteDeAtaque(tx: Tx, saveId: string, p: { companionIds?: string[]; subjectIds?: string[] }, ahora: number): Promise<{ ok: true; origenId: string; companionIds: string[]; subjectIds: string[] } | { ok: false; motivo: string }> {
  const op = await opcionesDePartida(tx, saveId, ahora);
  if (!op.origen) return { ok: false, motivo: 'Tu Reino no tiene ningún edificio desde el que salir.' };
  const libresComp = new Set(op.grupos.flatMap((g) => g.companeros.map((x) => x.id)));
  const libresSub = new Set((await guerrerosLibres(tx, saveId, ahora)).map((g) => g.id));
  const subjectIds = [...new Set(p.subjectIds ?? [])];
  const companionIds = [...new Set(p.companionIds ?? [])];
  if (companionIds.length + subjectIds.length === 0) return { ok: false, motivo: 'Elige quién va.' };
  if (companionIds.some((id) => !libresComp.has(id)) || subjectIds.some((id) => !libresSub.has(id))) return { ok: false, motivo: 'Alguno de los que eliges no puede salir ahora.' };
  if (companionIds.length + subjectIds.length > MAX_MIEMBROS_PARTIDA) return { ok: false, motivo: `Una partida lleva como mucho ${MAX_MIEMBROS_PARTIDA}.` };
  return { ok: true, origenId: op.origen.id, companionIds, subjectIds };
}

export async function lanzarAtaqueACampamento(tx: Tx, saveId: string, p: PeticionAtaque, ahora: number): Promise<{ ok: true; id: string } | { ok: false; motivo: string }> {
  const c = await tx.campamento.findFirst({ where: { id: p.campamentoId, saveId, estado: 'ACTIVO', conocido: true } });
  if (!c) return { ok: false, motivo: 'No conoces ningún campamento así.' };
  const g = await elegirGenteDeAtaque(tx, saveId, p, ahora);
  if (!g.ok) return g;
  const { companionIds, subjectIds } = g;
  const op = { origen: { id: g.origenId } };
  return crearViajero(tx, {
    saveId, tipo: TIPO_ATAQUE, objetivo: c.id, origenLocationId: op.origen.id, destinoLocationId: c.locationId, dia: Math.floor(ahora / 1440),
    miembros: [...companionIds.map((id) => ({ companionId: id, rol: 'guerrero' })), ...subjectIds.map((id) => ({ subjectId: id, rol: 'guerrero' }))],
  });
}

/// La partida llega al campamento y pelea de fondo; después vuelve a casa.
TRABAJOS[TIPO_ATAQUE] = {
  alLlegar: async (tx, v, dia, random) => {
    const c = v.objetivo ? await tx.campamento.findFirst({ where: { id: v.objetivo, estado: 'ACTIVO' } }) : null;
    if (!c) {
      await avisoDeViajero(tx, v, 'La partida llega al campamento, pero ya no queda nadie: vuelve a casa.');
      return;
    }
    const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: v.saveId }, select: { worldId: true } });
    const nuestros = await cazadoresDe(tx, v, worldId);
    const { cae, r, caenBandidos } = await pelearContraCampamento(tx, c, nuestros.map((h) => h.c), worldId, dia, { reino: true, quien: 'Una partida del Reino' }, random);
    const condicion = new Map(r.estados.map((e) => [e.id, e.condicion]));
    const muertos = new Set(r.estados.filter((e) => e.muerto).map((e) => e.id));
    await aplicarBajas(tx, v.saveId, nuestros, condicion, muertos, dia, 'combate', v.factionId);
    if (!cae) await avisoDeViajero(tx, v, `La partida no puede con el campamento: ${caenBandidos > 0 ? `caen ${caenBandidos} de los suyos, pero ` : ''}el cabecilla aguanta y vuelven a casa.`);
  },
};

/// Q8: cada semana, las facciones dueñas de la región mandan una patrulla de fondo contra cada
/// campamento de su región, si tienen soldados. Devuelve cuántos campamentos caen.
export async function patrullasContraCampamentos(prisma: PrismaClient, saveId: string, dia: number, random: () => number): Promise<number> {
  if (dia % 7 !== 0) return 0;
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true } });
  if (!save) return 0;
  const campamentos = await prisma.campamento.findMany({ where: { saveId, estado: 'ACTIVO' }, orderBy: { createdAt: 'asc' } });
  let caen = 0;
  for (const c0 of campamentos) {
    const duenas = REGION_OWNING_FACTIONS[c0.region] ?? [];
    if (duenas.length === 0) continue;
    const facciones = await prisma.faction.findMany({ where: { saveId, disueltaEn: null, name: { in: duenas } }, select: { id: true, name: true, raza: true, kingdomStats: { select: { soldados: true } } }, orderBy: { id: 'asc' } });
    const f = facciones.find((x) => (x.kingdomStats?.soldados ?? 0) >= PATRULLA_CONTRA_CAMPAMENTO);
    if (!f) continue;
    await prisma.$transaction(async (tx) => {
      const c = await tx.campamento.findFirst({ where: { id: c0.id, estado: 'ACTIVO' } });
      if (!c) return;
      const base = await baseDePueblo(tx, save.worldId, f.raza);
      const patrulla = Array.from({ length: PATRULLA_CONTRA_CAMPAMENTO }, (_, i) => soldadoGenerico(`patrulla-${f.id}-${i}`, 'Patrulla', 'A', base, true));
      const { cae, r } = await pelearContraCampamento(tx, c, patrulla, save.worldId, dia, { reino: false, quien: `Una patrulla de ${f.name}` }, random);
      const bajas = r.estados.filter((e) => e.id.startsWith('patrulla-') && e.muerto).length;
      if (bajas > 0) await tx.kingdomStats.updateMany({ where: { factionId: f.id }, data: { soldados: { decrement: bajas } } });
      if (cae) caen++;
    });
  }
  return caen;
}
