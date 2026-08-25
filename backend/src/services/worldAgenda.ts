import type { Prisma, PrismaClient } from '@prisma/client';
import { appendSessionFacts, loadSessionFacts } from './worldFacts.js';

/// Canal WORLD (Grupo 3 § Mundo determinista, docs/rpgtarkor/mundo-determinista.md, 2026-08-25):
/// hasta ahora `STAGE_FACTS` solo alimentaba `sessionFacts` (contexto invisible del Narrador) — el
/// panel "El mundo" que la jugadora sí ve (`entorno.ts`, canal `LogEntry.WORLD`) nunca se enteraba
/// de que la agenda había avanzado, pese a depletar población real. Ya es texto determinista escrito
/// a mano (`STAGE_FACTS`), cero coste añadido de LLM — solo hacía falta el cable.

/// `WorldState.agenda` (Grupo 3, docs/21-roadmap.md) — hitos de mundo que avanzan solos con el
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
    });

    if (facts.length > 0) {
      const existing = await loadSessionFacts(state.saveId);
      await appendSessionFacts(state.saveId, existing, facts);
    }
    statesAdvanced += 1;
  }

  return { statesAdvanced, stagesCrossed: totalStagesCrossed };
}
