import { registrarSuceso, type NuevoSuceso } from './cronista/sucesos.js';
import type { Prisma, PrismaClient } from '@prisma/client';
import { appendSessionFacts, loadSessionFacts } from './worldFacts.js';
import { stageForPresion, typeForPresion } from './factionRelations.js';

/// Canal WORLD (Grupo 3 § Mundo determinista, docs/rpgtarkor/lore-mundo/mundo-determinista.md, 2026-08-25):
/// hasta ahora `STAGE_FACTS` solo alimentaba `sessionFacts` (contexto invisible del Narrador) — el
/// panel "El mundo" que la jugadora sí ve (`entorno.ts`, canal `LogEntry.WORLD`) nunca se enteraba
/// de que la agenda había avanzado, pese a depletar población real. Ya es texto determinista escrito
/// a mano (`STAGE_FACTS`), cero coste añadido de LLM — solo hacía falta el cable.

/// `WorldState.agenda` (Grupo 3, docs/producto/21-roadmap.md) — hitos de mundo que avanzan solos con el
/// tiempo de ficción si nadie interviene, más allá de la ambientación pasiva de `entorno.ts`.
/// Diseño cerrado con la usuaria (2026-08-24): un solo hito de partida, el conflicto entre el Clan
/// Serhu (aliado en la sombra con la Concordia de Hierro) contra los clanes Helsig y Goshg, que
/// resisten. "No hay guerra abierta todavía, solo pequeños conflictos" es la etapa 0 — cada etapa
/// que se cruza sin que la jugadora intervenga agrava el conflicto y deplete de verdad la
/// población de Helsig/Goshg (`WorldPopulation`, ya trackeada por clan — `population.ts`).
///
/// Simplificación conocida: `WorldPopulation` es del `World`, no de una `Save` — con una sola
/// partida jugable real hoy (Gorhorn) esto no importa, pero si algún día hay varias partidas en el
/// mismo mundo, la agenda de una partida depleciona población compartida por todas. Igual que el
/// resto de `population.ts`, no se resuelve aquí a propósito.

export interface AgendaEntry {
  id: string;
  title: string;
  stage: number;
  maxStage: number;
  /// `WorldState.fictionalMinutes` a partir del cual la próxima etapa puede cruzarse.
  nextStageAtMinutes: number;
}

/// 7 días de ficción por etapa — cifra de partida (petición explícita: "cada varios días de
/// juego"), a afinar jugando como el resto de números pendientes del proyecto.
const STAGE_INTERVAL_MINUTES = 7 * 24 * 60;

/// Bajas por etapa en cada uno de los dos clanes que resisten — cifra de partida, sin verificar en
/// juego real todavía. Helsig (400 población) y Goshg (600) son lo bastante grandes para que esto
/// se note sin ser catastrófico en una sola etapa.
const POBLACION_PERDIDA_POR_ETAPA = 20;

const HELSIG_TARGET_SLUG = 'orcos-cristal-helado';
const GOSHG_TARGET_SLUG = 'orcos-cienaga';

const CONFLICTO_ID = 'conflicto-serhu-concordia-vs-helsig-goshg';

/// Narración de cada etapa cruzada (índice = etapa nueva, la 0 nunca se narra — es el estado de
/// partida, silencioso). El Narrador la recibe como hecho de mundo (`appendSessionFacts`), no como
/// prosa ya escrita en el log — mismo criterio que el resto de hechos deterministas del proyecto.
const STAGE_FACTS: readonly string[] = [
  '',
  'Los guerreros del Clan Serhu, animados en secreto por la Concordia de Hierro, intensifican sus incursiones contra los asentamientos del Clan Helsig y el Clan Goshg — ya no son escaramuzas sueltas, hay un patrón real detrás.',
  'Pequeñas partidas Goirntes empiezan a acompañar a los guerreros Serhu en sus asaltos contra Helsig y Goshg — la Concordia deja de ocultar del todo su mano en el conflicto.',
  'Helsig y Goshg pierden terreno de verdad frente a la presión conjunta de Serhu y la Concordia — corren rumores de aldeas enteras abandonadas.',
  'El conflicto entre Serhu-Concordia y Helsig-Goshg se ha convertido en guerra abierta, con bajas reales en ambos bandos cada semana que pasa.',
];

export function initialAgenda(fictionalMinutes: number): AgendaEntry[] {
  return [
    {
      id: CONFLICTO_ID,
      title: 'El Clan Serhu, alineado con la Concordia, presiona a Helsig y Goshg',
      stage: 0,
      maxStage: STAGE_FACTS.length - 1,
      nextStageAtMinutes: fictionalMinutes + STAGE_INTERVAL_MINUTES,
    },
  ];
}

export function parseAgenda(raw: Prisma.JsonValue | null | undefined): AgendaEntry[] {
  return (raw as AgendaEntry[] | null) ?? [];
}

export type RegionControlEstado = 'NEUTRAL_O_DUENO_ORIGINAL' | 'EN_DISPUTA' | 'CONQUISTADA';

export interface RegionControlState {
  estado: RegionControlEstado;
  /// Dueño de la región HOY según este cálculo — el original (`REGION_OWNING_FACTIONS`,
  /// reputation.ts) en `NEUTRAL_O_DUENO_ORIGINAL`/`EN_DISPUTA`, el agresor en `CONQUISTADA`.
  duenoActual: string;
  /// Solo presente en `EN_DISPUTA` — quién presiona.
  agresor?: string;
}

const AGRESOR = 'Clan Serhu-Concordia de Hierro';

/// Región propia del agresor (Las Llanuras del Viento Rojo, dueño de lore "Clan Serhu") — nunca
/// entra en disputa consigo misma aunque el conflicto avance, decisión cerrada con la usuaria
/// explícitamente para esta excepción.
const REGION_DEL_AGRESOR = 'Las Llanuras del Viento Rojo';

/// Las 3 regiones con conflicto sembrado hoy (docs/rpgtarkor/lore-mundo/areas.md) — su dueño ORIGINAL de
/// `REGION_OWNING_FACTIONS` (reputation.ts) es el defensor cuando `stage` entra en disputa.
const REGION_DEFENSOR: Record<string, string> = {
  'Cristal Helado': 'Clan Helsig',
  'Ciénaga Troncal': 'Clan Goshg',
};

/// Puro — control determinista por región, derivado de la etapa real de `CONFLICTO_ID`
/// (Serhu-Concordia vs. Helsig/Goshg) donde exista conflicto sembrado. El resto de regiones (sin
/// entrada en `REGION_DEFENSOR`, ej. Meseta del Orden) se quedan FIJAS con su dueño de
/// `REGION_OWNING_FACTIONS` — nunca se inventa una disputa que el diseño no tiene. `stage` 0-1 =
/// dueño original, 2-3 = en disputa, 4 (`maxStage`) = conquistada por el agresor. Las Llanuras del
/// Viento Rojo (del propio Clan Serhu) son la única excepción: siempre dueño original, pase lo que
/// pase con la etapa.
export function regionControlFor(region: string, agenda: AgendaEntry[], duenoOriginal: string): RegionControlState {
  const conflicto = agenda.find((entry) => entry.id === CONFLICTO_ID);
  return regionControlDesdeStage(region, conflicto?.stage ?? 0, duenoOriginal);
}

/// Puro — misma regla de `regionControlFor`, a partir de una etapa ya conocida (0-4).
export function regionControlDesdeStage(region: string, stage: number, duenoOriginal: string): RegionControlState {
  if (region === REGION_DEL_AGRESOR) return { estado: 'NEUTRAL_O_DUENO_ORIGINAL', duenoActual: duenoOriginal };
  if (!REGION_DEFENSOR[region]) return { estado: 'NEUTRAL_O_DUENO_ORIGINAL', duenoActual: duenoOriginal };
  const maxStage = STAGE_FACTS.length - 1;
  if (stage >= maxStage) return { estado: 'CONQUISTADA', duenoActual: AGRESOR };
  if (stage >= 2) return { estado: 'EN_DISPUTA', duenoActual: duenoOriginal, agresor: AGRESOR };
  return { estado: 'NEUTRAL_O_DUENO_ORIGINAL', duenoActual: duenoOriginal };
}

// ─────────── Fase D del hito 0.1: el conflicto se lee de las relaciones reales ───────────
//
// `FactionRelation` (sembradas el 2026-09-29, `factionRelationsIniciales`) ya tiene Serhu→Helsig y
// Serhu→Goshg con su `presion`/`stage` reales, que además se mueven solas (asaltos de expediciones,
// `factionExpeditions.ts`). El control de cada región en disputa sale ahora de SU relación: Cristal
// Helado de Serhu→Helsig, Ciénaga Troncal de Serhu→Goshg. El temporizador de la agenda sigue (sin él
// nada haría avanzar el conflicto en 0.1), pero en vez de ser la fuente de verdad empuja esas
// relaciones: cada etapa cruzada sube su presión hasta el mínimo de esa etapa (`presionMinimaDeEtapa`,
// nunca la baja). Con la presión sembrada (70 = etapa 1) el control queda igual que antes (etapas 0-1 =
// dueño original), así que la jugadora no ve ningún cambio; una partida que ya iba más avanzada
// sincroniza su relación al primer tick (`sincronizarRelacionesConflicto`). Sin relación en BD (mundo
// sin sembrar) se usa la agenda, como antes.

const AGRESOR_FACCION = 'Clan Serhu';

/// Presión mínima para que `stageForPresion` dé `stage` (etapa 0 → 60, 1 → 70… 4 → 100).
export function presionMinimaDeEtapa(stage: number): number {
  return Math.min(100, 60 + 10 * Math.max(0, stage));
}

type RelacionesClient = Pick<PrismaClient, 'factionRelation' | 'faction'>;

/// Etapa del conflicto por región desde las relaciones reales; región ausente = sin relación en BD.
export async function stagesConflictoPorRegion(db: RelacionesClient, worldId: string): Promise<Map<string, number>> {
  const relaciones = await db.factionRelation.findMany({
    where: { worldId, sourceFaction: { name: AGRESOR_FACCION, saveId: null }, targetFaction: { name: { in: Object.values(REGION_DEFENSOR) }, saveId: null } },
    select: { presion: true, targetFaction: { select: { name: true } } },
  });
  const porRegion = new Map<string, number>();
  for (const [region, defensor] of Object.entries(REGION_DEFENSOR)) {
    const rel = relaciones.find((r) => r.targetFaction.name === defensor);
    if (rel) porRegion.set(region, stageForPresion(rel.presion));
  }
  return porRegion;
}

/// Control actual de una región: de su relación real si existe; si no, de la agenda (como antes).
export async function regionControlActual(db: RelacionesClient, worldId: string, region: string, agenda: AgendaEntry[], duenoOriginal: string): Promise<RegionControlState> {
  if (!REGION_DEFENSOR[region]) return regionControlFor(region, agenda, duenoOriginal);
  const stage = (await stagesConflictoPorRegion(db, worldId)).get(region);
  return stage === undefined ? regionControlFor(region, agenda, duenoOriginal) : regionControlDesdeStage(region, stage, duenoOriginal);
}

/// Sube (nunca baja) la presión de Serhu→Helsig y Serhu→Goshg hasta el mínimo de `stage`.
export async function sincronizarRelacionesConflicto(db: RelacionesClient, worldId: string, stage: number): Promise<void> {
  const minima = presionMinimaDeEtapa(stage);
  const relaciones = await db.factionRelation.findMany({
    where: { worldId, presion: { lt: minima }, sourceFaction: { name: AGRESOR_FACCION, saveId: null }, targetFaction: { name: { in: Object.values(REGION_DEFENSOR) }, saveId: null } },
    select: { id: true },
  });
  for (const r of relaciones) {
    await db.factionRelation.update({ where: { id: r.id }, data: { presion: minima, type: typeForPresion(minima), stage: stageForPresion(minima) } });
  }
}

/// Puro: cuántas etapas cruza una entrada dado el tiempo de ficción actual, y su estado
/// resultante. Puede cruzar más de una etapa a la vez (un salto grande de tiempo de ficción, ej.
/// un viaje largo) — nunca se queda "atrasada" esperando varios ticks para ponerse al día.
export function advanceEntry(entry: AgendaEntry, fictionalMinutes: number): { entry: AgendaEntry; stagesCrossed: number } {
  let current = entry;
  let stagesCrossed = 0;
  while (current.stage < current.maxStage && fictionalMinutes >= current.nextStageAtMinutes) {
    current = {
      ...current,
      stage: current.stage + 1,
      nextStageAtMinutes: current.nextStageAtMinutes + STAGE_INTERVAL_MINUTES,
    };
    stagesCrossed += 1;
  }
  return { entry: current, stagesCrossed };
}

type TxClient = Pick<PrismaClient, 'worldPopulation'>;

/// Resta `amount` sin bajar de 0 — mismo criterio atómico que `decrementPopulationOnDeath`
/// (population.ts), en dos pasos porque aquí la cantidad no es fija (puede superar lo que queda si
/// se cruzan varias etapas de golpe con población ya mermada).
async function depleteClanPopulation(tx: TxClient, worldId: string, targetSlug: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  const result = await tx.worldPopulation.updateMany({
    where: { worldId, targetType: 'RAZA', targetSlug, poblacion: { gte: amount } },
    data: { poblacion: { decrement: amount } },
  });
  if (result.count === 0) {
    await tx.worldPopulation.updateMany({
      where: { worldId, targetType: 'RAZA', targetSlug, poblacion: { gt: 0 } },
      data: { poblacion: 0 },
    });
  }
}

/// Llamado desde el tick periódico de fondo (worldTick.ts), igual que `growAllPopulations`. Solo
/// toca la partida jugable real de hoy (`characterName === 'Gorhorn'`, mismo criterio que
/// `classAbilityUnlocksFor`) — siembra la agenda inicial si está vacía (partidas ya en curso antes
/// de que esto existiera) y avanza cualquier etapa ya vencida.
type SucesoDeEtapa = Omit<NuevoSuceso, 'saveId' | 'fictionalMinutes' | 'origen'>;
const faccion = (slug: string, papel: 'AUTOR' | 'VICTIMA' | 'AFECTADO') => ({ entidadTipo: 'FACCION' as const, entidadId: slug, papel });

/// Qué apunta el Libro al cruzar cada etapa del conflicto Serhu (mismas etapas que `STAGE_FACTS`):
/// 1 la relación empeora, 2 la Concordia se alía abiertamente con Serhu, 3 Helsig y Goshg pierden
/// terreno, 4 guerra abierta.
export function sucesosDeEtapaConflicto(etapa: number): SucesoDeEtapa[] {
  switch (etapa) {
    case 1:
      return [{ tipo: 'CAMBIO_RELACION', actores: [faccion('clan-serhu', 'AUTOR'), faccion('clan-helsig', 'AFECTADO'), faccion('clan-goshg', 'AFECTADO')], datos: { faccionA: 'el Clan Serhu', faccionB: 'los clanes Helsig y Goshg', antes: 'escaramuzas sueltas', despues: 'incursiones organizadas' } }];
    case 2:
      return [{ tipo: 'ALIANZA', actores: [faccion('clan-serhu', 'AUTOR'), faccion('concordia-de-hierro', 'AUTOR')], datos: { faccionA: 'El Clan Serhu', faccionB: 'la Concordia de Hierro' } }];
    case 3:
      return [
        { tipo: 'TERRITORIO_PERDIDO', actores: [faccion('clan-helsig', 'VICTIMA'), faccion('clan-serhu', 'AUTOR')], datos: { faccion: 'El Clan Helsig', territorio: 'parte de sus asentamientos' } },
        { tipo: 'TERRITORIO_PERDIDO', actores: [faccion('clan-goshg', 'VICTIMA'), faccion('clan-serhu', 'AUTOR')], datos: { faccion: 'El Clan Goshg', territorio: 'parte de sus asentamientos' } },
      ];
    case 4:
      return [{ tipo: 'GUERRA_DECLARADA', actores: [faccion('clan-serhu', 'AUTOR'), faccion('concordia-de-hierro', 'AUTOR'), faccion('clan-helsig', 'VICTIMA'), faccion('clan-goshg', 'VICTIMA')], datos: { atacante: 'El Clan Serhu, con la Concordia de Hierro,', atacada: 'los clanes Helsig y Goshg' } }];
    default:
      return [];
  }
}

export async function advanceWorldAgenda(prisma: PrismaClient): Promise<{ statesAdvanced: number; stagesCrossed: number }> {
  const states = await prisma.worldState.findMany({
    where: { save: { characterName: 'Gorhorn', endedAt: null } },
    select: { id: true, saveId: true, agenda: true, fictionalMinutes: true, fictionalDateLabel: true, save: { select: { worldId: true } } },
  });

  let statesAdvanced = 0;
  let totalStagesCrossed = 0;

  for (const state of states) {
    let agenda = parseAgenda(state.agenda);
    let needsWrite = false;
    if (agenda.length === 0) {
      agenda = initialAgenda(state.fictionalMinutes);
      needsWrite = true;
    }

    const facts: string[] = [];
    let helsigLoss = 0;
    let goshgLoss = 0;
    const nextAgenda = agenda.map((entry) => {
      const { entry: advanced, stagesCrossed } = advanceEntry(entry, state.fictionalMinutes);
      if (stagesCrossed === 0) return advanced;
      needsWrite = true;
      totalStagesCrossed += stagesCrossed;
      if (entry.id === CONFLICTO_ID) {
        helsigLoss += POBLACION_PERDIDA_POR_ETAPA * stagesCrossed;
        goshgLoss += POBLACION_PERDIDA_POR_ETAPA * stagesCrossed;
        for (let s = entry.stage + 1; s <= advanced.stage; s++) {
          if (STAGE_FACTS[s]) facts.push(STAGE_FACTS[s]);
        }
      }
      return advanced;
    });

    // Fase D (hito 0.1) — la etapa de la agenda empuja las relaciones reales (y sincroniza partidas
    // que ya iban más avanzadas que la relación sembrada); idempotente, solo sube presión.
    const conflicto = nextAgenda.find((entry) => entry.id === CONFLICTO_ID);
    if (conflicto) await sincronizarRelacionesConflicto(prisma, state.save.worldId, conflicto.stage);

    if (!needsWrite) continue;

    await prisma.$transaction(async (tx) => {
      await tx.worldState.update({ where: { id: state.id }, data: { agenda: nextAgenda as unknown as Prisma.InputJsonValue } });
      await depleteClanPopulation(tx, state.save.worldId, HELSIG_TARGET_SLUG, helsigLoss);
      await depleteClanPopulation(tx, state.save.worldId, GOSHG_TARGET_SLUG, goshgLoss);
      // Canal WORLD (ver comentario de cabecera) — una fila por etapa cruzada, mismo texto ya
      // escrito a mano que recibe sessionFacts, para que el panel "El mundo" cuente lo mismo que ya
      // sabe el Narrador.
      for (const fact of facts) {
        await tx.logEntry.create({
          data: { saveId: state.saveId, channel: 'WORLD', text: fact, timeLabel: state.fictionalDateLabel, fictionalMinutes: state.fictionalMinutes },
        });
      }
      // Libro de Sucesos (CR-3, hito 0.2): cada etapa cruzada del conflicto, en orden.
      const previa = agenda.find((entry) => entry.id === CONFLICTO_ID)?.stage ?? 0;
      for (let etapa = previa + 1; etapa <= (conflicto?.stage ?? previa); etapa++) {
        for (const suceso of sucesosDeEtapaConflicto(etapa)) {
          await registrarSuceso(tx, { ...suceso, saveId: state.saveId, fictionalMinutes: state.fictionalMinutes, origen: 'MUNDO' });
        }
      }
    });

    if (facts.length > 0) {
      const existing = await loadSessionFacts(state.saveId);
      await appendSessionFacts(state.saveId, existing, facts);
    }
    statesAdvanced += 1;
  }

  return { statesAdvanced, stagesCrossed: totalStagesCrossed };
}
