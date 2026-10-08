// CR-65 (hito 0.3, Fase E, paso 65d): un asalto a un asentamiento del Reino, resuelto de fondo con
// el motor de `CR-62` (ADR 0002: en vivo si estás, de fondo si no). Decisiones Q3-Q7 de la ronda
// de detalle (`docs/producto/plan-roadmap-0.3.md`):
//
// - Defienden la guarnición del asentamiento (con +2 desde la Torre si es vigía, BG3) y la milicia
//   (soldados genéricos con −2 de nivel); todos con la cobertura de la Empalizada (D&D) y la moral
//   del Barracón.
// - Si pierde quien defiende: los asaltantes que quedan se llevan comida, Goirnos y cosas del
//   Almacén (lo que cargan, cifras provisionales abajo) y la Empalizada encaja un golpe (aguante
//   del módulo, X4).
// - Los súbditos que mueren, mueren de verdad; los asaltantes caídos se descuentan de su partida.
//
// En `CR-65` el asalto solo lo lanzan los tests; los de verdad llegan con `CR-50` (bandidos) y
// `CR-37` (guerra), que crean el viajero `ASALTO` y lo traen hasta aquí.
import type { Prisma } from '@prisma/client';
import { simularCombateDeFondo, type CombatienteFondo } from './combateDeFondo.js';
import { baseDePueblo, soldadoGenerico } from './cronista/combatientesFaccion.js';
import { golpeAEmpalizada, NIVEL_MENOS_MILICIA } from './cronista/defensa.js';
import { morir } from './cronista/salidas.js';
import { esAdultoSubdito, recalcularPoblacion, rolDeSubdito } from './cronista/subditos.js';
import { NIVEL_SOLDADO_GENERICO } from './cronista/combatientesFaccion.js';
import { asentamientosDelReino, licenciarMilicia } from './defensaReino.js';
import { volverAlCampamento } from './campamentos.js';
import { ocupanteDe } from './cronista/campamentosBandidos.js';
import { esGuardia } from './cronista/usosFauna.js';
import { etapaDe, etapasDe } from './cronista/ganaderia.js';
import { combatienteDeNpc } from './factionExpeditions.js';
import { peor } from './partidasCaza.js';
import type { AttributeBlock } from './dice.js';
import { ownerKeyFor } from './reinoOwner.js';
import { avisoDeViajero, TRABAJOS, type ViajeroFila } from './viajeros.js';
import { CONSTRUCTION_RECIPES } from './construction.js';
import { gastarMateriales } from './cronista/facturaEquipo.js';

type Tx = Prisma.TransactionClient;

/// Lo que carga cada asaltante que queda en pie (provisional, a revisar en la fase de pruebas).
export const BOTIN_POR_ASALTANTE = { comida: 10, goirnos: 5, objetos: 2 } as const;
/// Nunca se llevan más de esta parte de lo que hay.
export const BOTIN_TOPE = 0.25;

export interface Botin {
  comida: number;
  goirnos: number;
  objetos: number;
}

/// Puro: lo que se llevan `asaltantes` de lo que hay.
export function botinDe(asaltantes: number, hay: { comida: number; goirnos: number; objetos: number }): Botin {
  const tope = (n: number) => Math.floor(n * BOTIN_TOPE);
  return {
    comida: Math.min(asaltantes * BOTIN_POR_ASALTANTE.comida, tope(hay.comida)),
    goirnos: Math.min(asaltantes * BOTIN_POR_ASALTANTE.goirnos, tope(hay.goirnos)),
    objetos: Math.min(asaltantes * BOTIN_POR_ASALTANTE.objetos, tope(hay.objetos)),
  };
}

export interface ResultadoAsalto {
  defendido: boolean;
  defensores: number;
  milicianos: number;
  caidosReino: string[];
  caidosAsaltantes: number;
  botin: Botin | null;
  empalizadaCaida: boolean;
}

/// Resuelve de fondo el asalto `v` contra el asentamiento `asentamientoId`.
export async function resolverAsaltoDeFondo(tx: Tx, saveId: string, v: ViajeroFila, asentamientoId: string, dia: number, random: () => number): Promise<ResultadoAsalto | null> {
  const asentamiento = (await asentamientosDelReino(tx, saveId)).find((a) => a.id === asentamientoId);
  if (!asentamiento) return null;
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const ahora = dia * 1440;
  const { cobertura, bonoAltura, bonoMoral } = asentamiento.efecto;

  // Quien defiende: la guarnición y la milicia (Q6, Q7).
  const guarnicionIds = asentamiento.guarnicion.map((g) => g.id);
  const gente = await tx.subject.findMany({
    where: { saveId, estado: 'ACTIVO', OR: [{ id: { in: guarnicionIds } }, { enMilicia: true }] },
    select: { id: true, name: true, role: true, pueblo: true, nacidoEn: true, enMilicia: true },
  });
  const defensores: CombatienteFondo[] = [];
  let milicianos = 0;
  for (const s of gente) {
    const base = await baseDePueblo(tx, worldId, s.pueblo ?? 'orcos');
    const enGuarnicion = guarnicionIds.includes(s.id);
    if (!enGuarnicion && !(s.enMilicia && esAdultoSubdito(s, ahora))) continue;
    if (!enGuarnicion) milicianos++;
    const c = soldadoGenerico(s.id, s.name, 'A', base, true, enGuarnicion ? NIVEL_SOLDADO_GENERICO : NIVEL_SOLDADO_GENERICO - NIVEL_MENOS_MILICIA);
    defensores.push({ ...c, conNombre: false, bonoDefensa: cobertura, bonoAtaque: enGuarnicion && rolDeSubdito(s.role) === 'vigia' ? bonoAltura : 0, bonoMoral });
  }

  // CR-37 (Q3): los guardias de fauna crecidos (adultos o viejos) de los corrales de su región (`CR-56`).
  const guardias = (await tx.ganado.findMany({ where: { saveId, building: { location: { region: asentamiento.region } } }, select: { id: true, especie: true, nacidoEn: true } }))
    .filter((g) => esGuardia(g.especie));
  const npcsGuardia = await tx.npc.findMany({ where: { worldId, saveId: null, slug: { in: [...new Set(guardias.map((g) => g.especie))] } } });
  for (const g of guardias) {
    const npc = npcsGuardia.find((n) => n.slug === g.especie);
    if (!npc || etapaDe(etapasDe(g.especie, npc.faunaCategoria), Math.floor((ahora - g.nacidoEn) / 1440)).match(/CRIA|JOVEN/)) continue;
    const c = combatienteDeNpc(npc);
    defensores.push({ id: `guardia-${g.id}`, nombre: npc.name, bando: 'A', attributes: c.attributes, attribute: c.attribute, attributeBonus: c.attributeBonus ?? 0, nivel: c.nivel ?? NIVEL_SOLDADO_GENERICO, conMoral: false, bonoDefensa: cobertura });
  }
  // CR-37 (Q6): si el personaje está allí, pelea dentro del combate de fondo con su grupo 1 (no
  // muere de fondo; queda como acabe).
  const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { currentLocationId: true, characterName: true, attributes: true, level: true, condicionFisica: true } });
  const presente = save.currentLocationId === asentamiento.locationId && save.condicionFisica !== 'CONVALECIENTE' && save.condicionFisica !== 'MUERTO';
  const grupo1 = presente ? await tx.companion.findMany({ where: { saveId, combatGroupSlotIndex: 0, condicionFisica: { notIn: ['MUERTO', 'CONVALECIENTE'] } } }) : [];
  if (presente) {
    const a = save.attributes as unknown as AttributeBlock;
    defensores.push({ id: `personaje-${saveId}`, nombre: save.characterName, bando: 'A', attributes: a, attribute: (a.destreza ?? 0) > (a.fuerza ?? 0) ? 'destreza' : 'fuerza', attributeBonus: 1, nivel: save.level, conMoral: true, conNombre: true, lider: true, bonoDefensa: cobertura });
    for (const comp of grupo1) {
      const ca = (comp.attributes ?? {}) as unknown as AttributeBlock;
      defensores.push({ id: comp.id, nombre: comp.name, bando: 'A', attributes: ca, attribute: (ca.destreza ?? 0) > (ca.fuerza ?? 0) ? 'destreza' : 'fuerza', attributeBonus: 1, nivel: NIVEL_SOLDADO_GENERICO, conMoral: true, conNombre: true, bonoDefensa: cobertura });
    }
  }

  // Quien asalta: los genéricos de la partida, del pueblo de su facción.
  // CR-50: los de un campamento, del pueblo y nivel de sus ocupantes.
  const campamentoId = (v.carga as { campamentoId?: string } | null)?.campamentoId;
  const campamento = campamentoId ? await tx.campamento.findUnique({ where: { id: campamentoId }, select: { ocupante: true } }) : null;
  const ocupante = campamento ? ocupanteDe(campamento.ocupante) : undefined;
  const raza = v.factionId ? (await tx.faction.findUnique({ where: { id: v.factionId }, select: { raza: true } }))?.raza ?? null : ocupante?.pueblo ?? null;
  const baseAsalto = await baseDePueblo(tx, worldId, raza);
  const asaltantes: { miembroId: string; c: CombatienteFondo }[] = [];
  for (const m of v.miembros) for (let i = 0; i < m.genericos; i++) asaltantes.push({ miembroId: m.id, c: soldadoGenerico(`${m.id}-${i}`, 'Asaltante', 'B', baseAsalto, true, ocupante?.nivel ?? NIVEL_SOLDADO_GENERICO) });

  const r = simularCombateDeFondo([...defensores, ...asaltantes.map((a) => a.c)], random);
  const estado = new Map(r.estados.map((e) => [e.id, e]));
  // Gana quien defiende si se queda con el campo (o si no había nadie que asaltara).
  const defendido = asaltantes.length === 0 || r.ganador === 'A';

  // Bajas del Reino: los súbditos que mueren, mueren de verdad.
  const caidosReino: string[] = [];
  for (const s of gente) {
    if (!estado.get(s.id)?.muerto) continue;
    await morir(tx, saveId, s, 'asalto', ahora);
    caidosReino.push(s.name);
  }
  // Bajas de los asaltantes.
  const caidosPorMiembro = new Map<string, number>();
  for (const a of asaltantes) if (estado.get(a.c.id)?.muerto) caidosPorMiembro.set(a.miembroId, (caidosPorMiembro.get(a.miembroId) ?? 0) + 1);
  for (const [id, n] of caidosPorMiembro) await tx.viajeroMiembro.update({ where: { id }, data: { genericos: { decrement: n } } });
  const caidosAsaltantes = [...caidosPorMiembro.values()].reduce((s, n) => s + n, 0);
  // CR-37: los muertos de un ejército de facción salen de sus soldados.
  if (v.factionId && caidosAsaltantes > 0) {
    const k = await tx.kingdomStats.findFirst({ where: { factionId: v.factionId }, select: { id: true, soldados: true } });
    if (k) await tx.kingdomStats.update({ where: { id: k.id }, data: { soldados: Math.max(0, k.soldados - caidosAsaltantes) } });
  }
  // Los guardias de fauna que mueren; el personaje y su grupo quedan como acaben (una pelea no cura).
  for (const g of guardias) if (estado.get(`guardia-${g.id}`)?.muerto) await tx.ganado.delete({ where: { id: g.id } });
  if (presente) {
    const suya = estado.get(`personaje-${saveId}`)?.condicion;
    if (suya) await tx.save.update({ where: { id: saveId }, data: { condicionFisica: peor(save.condicionFisica, suya) } });
    for (const comp of grupo1) {
      const e = estado.get(comp.id);
      if (e) await tx.companion.update({ where: { id: comp.id }, data: { condicionFisica: peor(comp.condicionFisica, e.condicion) } });
    }
  }

  let botin: Botin | null = null;
  let empalizadaCaida = false;
  if (!defendido) {
    // Saqueo (Q3): lo que cargan los que quedan en pie.
    const enPie = asaltantes.filter((a) => { const e = estado.get(a.c.id); return e && !e.muerto && e.condicion !== 'CONVALECIENTE'; }).length;
    const ownerKey = ownerKeyFor({ saveId });
    const k = await tx.kingdomStats.findUnique({ where: { ownerKey }, select: { comida: true, riqueza: true } });
    const objetos = await tx.almacenItem.findMany({ where: { saveId }, orderBy: { createdAt: 'desc' }, select: { id: true } });
    botin = botinDe(enPie, { comida: k?.comida ?? 0, goirnos: k?.riqueza ?? 0, objetos: objetos.length });
    if (k) await tx.kingdomStats.update({ where: { ownerKey }, data: { comida: { decrement: botin.comida }, riqueza: { decrement: botin.goirnos } } });
    if (botin.objetos > 0) await tx.almacenItem.deleteMany({ where: { id: { in: objetos.slice(0, botin.objetos).map((o) => o.id) } } });
    // La Empalizada encaja el golpe (Q4).
    const empalizada = asentamiento.modulos.find((m) => m.modulo === 'empalizada' && !m.caida);
    if (empalizada) {
      const g = golpeAEmpalizada(empalizada.escalon, empalizada.golpes);
      await tx.building.update({ where: { id: empalizada.id }, data: { golpesDefensa: g.golpes, caida: g.caida } });
      empalizadaCaida = g.caida;
    }
    const carga = { ...((v.carga as Record<string, unknown> | null) ?? {}), botin } as unknown as Prisma.InputJsonValue;
    await tx.viajero.update({ where: { id: v.id }, data: { carga } });
  }
  if (caidosReino.length > 0) await recalcularPoblacion(tx, saveId, ahora);
  await licenciarMilicia(tx, saveId, ahora);

  const quien = v.factionId ? `La partida de ${(await tx.faction.findUnique({ where: { id: v.factionId }, select: { name: true } }))?.name ?? 'otra facción'}` : `Los ${(ocupante?.grupo ?? 'bandidos').toLowerCase()}`;
  const bajas = caidosReino.length > 0 ? ` Caen ${caidosReino.join(', ')}.` : '';
  const texto = defendido
    ? `${asentamiento.nombre} aguanta el asalto: ${quien.toLowerCase()} se retira${caidosAsaltantes > 0 ? ` dejando ${caidosAsaltantes} muertos` : ''}.${bajas}`
    : `${quien} toma ${asentamiento.nombre} y se lleva ${botin!.comida} de comida, ${botin!.goirnos} Goirnos y ${botin!.objetos} cosas del Almacén.${empalizadaCaida ? ' La Empalizada ha caído: hay que repararla.' : ''}${bajas}`;
  await avisoDeViajero(tx, { saveId, factionId: null }, texto);
  return { defendido, defensores: defensores.length - milicianos, milicianos, caidosReino, caidosAsaltantes, botin, empalizadaCaida };
}

/// Un asalto que llega a su destino: si allí hay un asentamiento del Reino, se resuelve de fondo
/// (el combate en vivo, con el personaje allí, llega con `CR-50`); luego vuelve con lo que lleve.
TRABAJOS.ASALTO = {
  alLlegar: async (tx, v, dia, random) => {
    const asentamiento = (await asentamientosDelReino(tx, v.saveId)).find((a) => a.locationId === v.destinoLocationId);
    if (asentamiento) await resolverAsaltoDeFondo(tx, v.saveId, v, asentamiento.id, dia, random);
  },
  // CR-50: los que quedan vuelven a su campamento con lo que traen; CR-37: un ejército de facción, a
  // su casa, y el botín va a su comida y su riqueza.
  alVolver: async (tx, v) => {
    if (!v.factionId) return volverAlCampamento(tx, v);
    const botin = (v.carga as { botin?: Botin } | null)?.botin;
    if (botin) await tx.kingdomStats.updateMany({ where: { factionId: v.factionId }, data: { comida: { increment: botin.comida }, riqueza: { increment: botin.goirnos } } });
  },
};

/// Q4: repara una Empalizada caída por la mitad de su coste (en materiales del Almacén).
export async function repararEmpalizada(tx: Tx, saveId: string, buildingId: string): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const b = await tx.building.findFirst({ where: { id: buildingId, saveId, recipeKey: 'empalizada', status: 'ACTIVO' }, select: { tier: true, caida: true } });
  if (!b) return { ok: false, motivo: 'No tienes esa Empalizada.' };
  if (!b.caida) return { ok: false, motivo: 'La Empalizada está en pie.' };
  const receta = CONSTRUCTION_RECIPES.find((r) => r.edificioTipo === 'defensa' && (r.key === 'empalizada' ? 1 : r.upgradesRecipeKey === 'empalizada' ? r.edificioOficioNivel : 0) === (b.tier ?? 1));
  const coste = Math.ceil((receta?.requirements.reduce((s, q) => s + q.cantidad, 0) ?? 0) / 2);
  if (!(await gastarMateriales(tx, saveId, coste))) return { ok: false, motivo: `Hacen falta ${coste} materiales en el Almacén.` };
  await tx.building.update({ where: { id: buildingId }, data: { caida: false, golpesDefensa: 0 } });
  return { ok: true };
}
