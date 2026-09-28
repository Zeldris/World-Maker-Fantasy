import type { FactionRelationType, Prisma, PrismaClient } from '@prisma/client';

/// Motor de disputas genérico estilo X4 (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.3, 2026-09-21) —
/// generaliza el único conflicto hardcodeado de `worldAgenda.ts` a "cualquier par de facciones
/// puede tener una postura real". Diseño cerrado con la autora (2026-09-21): híbrido X4 +
/// reputación estilo WoW — `presion` (0-100, 50 = neutro) sube por EVENTOS DISCRETOS con peso
/// propio (nunca un tick ambiental evaluando "¿comparten región ahora mismo?"), decae -1 por
/// semana de ficción sin eventos nuevos hacia el neutro, y BANDAS con nombre deciden `type`/`stage`
/// — mismo espíritu que `reputation.ts` (0-5000, bandas de 1000, deltas asimétricos), aplicado
/// aquí entre dos facciones NPC en vez de jugador↔facción.
///
/// Sustituye el avance por tiempo puro de `CONFLICTO_ID`/`STAGE_FACTS` (`worldAgenda.ts`, decisión
/// explícita 2026-09-21): la etapa ya no sube sola con `WorldState.fictionalMinutes`, sube cuando
/// pasa algo real — ver `applyFactionEvent`/`FACTION_EVENT_WEIGHTS` abajo.

export const PRESION_MIN = 0;
export const PRESION_MAX = 100;
export const PRESION_NEUTRAL = 50;

/// Bandas de `presion` → `type` (mismo criterio de banda que `effectiveTemperamento`,
/// reputation.ts) — 5 bandas de 20, centradas en el neutro real (50).
const BANDAS: readonly { hasta: number; type: FactionRelationType }[] = [
  { hasta: 19, type: 'ALIANZA' },
  { hasta: 39, type: 'TRATADO_COMERCIAL' },
  { hasta: 59, type: 'NEUTRAL' },
  { hasta: 79, type: 'TENSION' },
  { hasta: PRESION_MAX, type: 'GUERRA' },
];

export function typeForPresion(presion: number): FactionRelationType {
  return BANDAS.find((banda) => presion <= banda.hasta)?.type ?? 'GUERRA';
}

/// `stage` narrativo dentro de la banda TENSION/GUERRA (mismo concepto que el viejo
/// `AgendaEntry.stage`, aquí derivado de la propia `presion` en vez de contarse aparte) — 0-4,
/// solo tiene sentido decorativo/narrativo cuando `type` ya es TENSION o GUERRA.
export function stageForPresion(presion: number): number {
  if (presion <= 59) return 0;
  return Math.min(4, Math.floor((presion - 60) / 10));
}

/// Eventos discretos reales que mueven `presion` — deliberadamente pocos y con peso alto (estilo
/// X4: sucesos puntuales, no ambiente). `direction` decide el signo: 'presiona' sube presion
/// (source hacia GUERRA/TENSION con target), 'distiende' la baja (hacia ALIANZA/TRATADO).
export type FactionEventType =
  /// Source funda un Territory en una región donde target ya tenía Territory/dueño de lore
  /// (REGION_OWNING_FACTIONS) — expansión agresiva real, punto de partida más fiel a X4 de todos
  /// ("tomar un sector ya reclamado" es SIEMPRE un evento, nunca ambiente).
  | 'EXPANSION_TERRITORIAL_AGRESIVA'
  /// Un Npc de target muere (MUERTO real, no CONVALECIENTE) por acción atribuible a source — hoy
  /// solo se dispara cuando el jugador remata dentro del territorio/facción rival (el jugador
  /// actuando "en nombre" de su reino no es la pieza genérica todavía, ver § 5 punto 7 del
  /// documento — motor de eventos de mundo unificado, pendiente).
  | 'BAJA_DE_GUERRA'
  /// Cruce de tratado comercial resuelto en paz — evento simétrico, distiende ambas direcciones.
  | 'TRATADO_CUMPLIDO'
  /// Diplomacia del jugador (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.4/§ 5-bis punto 6, 2026-09-21) —
  /// acción PUNTUAL de un `Companion`/`Subject` propio con nivel de oficio `'diplomatico'`
  /// suficiente, estilo Agente de X4 (Negociación/Interferencia): actúa CONTRA cualquier `Faction`
  /// real ya sembrada, sin exigir nada de la facción destino (nunca `Npc`/presencia sostenida, ver
  /// discusión completa del punto 6). 'diplomatico' es siempre `source`, la facción objetivo
  /// siempre `target` — nunca al revés, la facción destino no "actúa" en este evento.
  | 'NEGOCIACION_TREGUA'
  | 'SABOTAJE_DIPLOMATICO';

const FACTION_EVENT_WEIGHTS: Record<FactionEventType, number> = {
  EXPANSION_TERRITORIAL_AGRESIVA: 15,
  BAJA_DE_GUERRA: 8,
  TRATADO_CUMPLIDO: -10,
  // Pesos más moderados que los eventos "de mundo" de arriba (15/8) — una sola acción de un
  // trabajador no debería mover tanto como una expansión territorial real o una baja de guerra.
  NEGOCIACION_TREGUA: -12,
  SABOTAJE_DIPLOMATICO: 10,
};

/// Puro — aplica un evento a la `presion` actual, acotado a [PRESION_MIN, PRESION_MAX].
export function applyFactionEvent(presionActual: number, event: FactionEventType): number {
  return Math.max(PRESION_MIN, Math.min(PRESION_MAX, presionActual + FACTION_EVENT_WEIGHTS[event]));
}

/// Puro — decaimiento pasivo hacia el neutro (mismo criterio que `tickKingdom`/`growAllPopulations`:
/// nunca decide nada, solo acerca el número 1 paso por semana de ficción cruzada sin eventos
/// nuevos). `semanasCruzadas` puede ser > 1 si el jugador viaja largo de golpe.
export function decayPresion(presionActual: number, semanasCruzadas: number): number {
  if (semanasCruzadas <= 0 || presionActual === PRESION_NEUTRAL) return presionActual;
  const paso = presionActual > PRESION_NEUTRAL ? -1 : 1;
  const maxPasos = Math.abs(presionActual - PRESION_NEUTRAL);
  const pasos = Math.min(semanasCruzadas, maxPasos);
  return presionActual + paso * pasos;
}

/// Narración determinista de cada banda cruzada (mismo criterio que `STAGE_FACTS`: texto ya escrito
/// a mano, cero coste de LLM, el Narrador lo recibe como hecho de mundo). Genérico por PLANTILLA
/// (nombres de ambas facciones interpolados) en vez de 5 líneas fijas por conflicto — ver § 4.3
/// del documento ("generado por plantilla en vez de 5 líneas fijas por conflicto").
export function stageFactFor(sourceName: string, targetName: string, type: FactionRelationType): string | null {
  switch (type) {
    case 'GUERRA':
      return `${sourceName} y ${targetName} están en guerra abierta — hay bajas reales en ambos bandos cada semana que pasa.`;
    case 'TENSION':
      return `La tensión entre ${sourceName} y ${targetName} se ha vuelto innegable — pequeños choques que ya no se pueden llamar casualidad.`;
    case 'ALIANZA':
      return `${sourceName} y ${targetName} han sellado una alianza real.`;
    case 'TRATADO_COMERCIAL':
      return `${sourceName} y ${targetName} mantienen un tratado comercial estable.`;
    case 'NEUTRAL':
      return null;
    default:
      return null;
  }
}

type TxClient = Pick<PrismaClient, 'factionRelation' | 'faction'>;

/// Crea (si no existe) o lee la relación dirigida source→target — `upsert` con la `presion`
/// neutral de partida, mismo patrón que `KingdomStats` ("el vacío es un estado válido").
export async function ensureFactionRelation(
  tx: TxClient,
  worldId: string,
  sourceFactionId: string,
  targetFactionId: string,
): Promise<{ id: string; presion: number; type: FactionRelationType }> {
  return tx.factionRelation.upsert({
    where: { sourceFactionId_targetFactionId: { sourceFactionId, targetFactionId } },
    update: {},
    create: { worldId, sourceFactionId, targetFactionId, presion: PRESION_NEUTRAL, type: 'NEUTRAL' },
    select: { id: true, presion: true, type: true },
  });
}

/// Aplica un evento real y persiste — recalcula `type`/`stage` a partir de la nueva `presion` en
/// la MISMA escritura (nunca quedan desincronizados). Devuelve el hecho de mundo a narrar si la
/// banda cambió, `null` si el evento no cruzó ninguna banda (queda solo como número interno).
export async function recordFactionEvent(
  tx: Prisma.TransactionClient,
  worldId: string,
  sourceFactionId: string,
  targetFactionId: string,
  event: FactionEventType,
): Promise<string | null> {
  const relation = await ensureFactionRelation(tx, worldId, sourceFactionId, targetFactionId);
  const nextPresion = applyFactionEvent(relation.presion, event);
  const nextType = typeForPresion(nextPresion);
  const nextStage = stageForPresion(nextPresion);
  await tx.factionRelation.update({
    where: { id: relation.id },
    data: { presion: nextPresion, type: nextType, stage: nextStage },
  });
  if (nextType === relation.type) return null;
  const [source, target] = await Promise.all([
    tx.faction.findUniqueOrThrow({ where: { id: sourceFactionId }, select: { name: true } }),
    tx.faction.findUniqueOrThrow({ where: { id: targetFactionId }, select: { name: true } }),
  ]);
  return stageFactFor(source.name, target.name, nextType);
}

// ═══════════════════════════════════════════════════════════════════════════
// § 4.4/§ 5-bis punto 6 — Diplomacia del jugador (acción puntual, estilo Agente de X4)
// ═══════════════════════════════════════════════════════════════════════════

/// Puro — nivel de oficio 'diplomatico' mínimo exigido para intentar una acción, según lo lejos
/// que ya esté `presionActual` del punto neutro (50): cuanto más extrema la relación (guerra
/// abierta o alianza ya sellada), más difícil moverla más — mismo espíritu de "cuesta más romper
/// algo ya asentado" que el resto del proyecto (alivioForLevel resta al mínimo, nunca al revés).
/// Rango 1-9 (misma escala que `MAX_PROFESSION_LEVEL`, professionProgress.ts).
export function nivelDiplomaticoRequerido(presionActual: number): number {
  const distanciaAlNeutro = Math.abs(presionActual - PRESION_NEUTRAL);
  // 0-19 de distancia → nivel 1 (relación aún manejable); cada 10 puntos más de distancia sube 1
  // nivel de dificultad, tope en 9.
  return Math.min(9, 1 + Math.floor(distanciaAlNeutro / 10));
}

/// Espionaje (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.4, 2026-09-21) — a diferencia de
/// Negociación/Sabotaje, NUNCA mueve `presion` (decisión explícita: "sin efecto en presion" —
/// acción de solo-información, mismo criterio que "Intel" en X4). Devuelve el estado real de
/// `FactionRelation` para que el jugador lo vea, sin alterar nada — primera vía real por la que
/// el jugador puede consultar esta información (antes solo vivía en `worldAgenda.ts`/eventos de
/// fondo, nunca expuesta).
export async function espiarFactionRelation(
  tx: TxClient,
  worldId: string,
  sourceFactionId: string,
  targetFactionId: string,
): Promise<{ presion: number; type: FactionRelationType; stage: number }> {
  const relation = await ensureFactionRelation(tx, worldId, sourceFactionId, targetFactionId);
  return { presion: relation.presion, type: relation.type, stage: stageForPresion(relation.presion) };
}
