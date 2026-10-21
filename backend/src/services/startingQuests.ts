import type { QuestRewardCompanion } from './questResolution.js';

/// P240: la misión de vida de Gorhorn. Sin cierre determinista, así que el narrador no puede cerrarla.
export const HONOR_MAKTOR_QUEST_SLUG = 'HONOR_MAKTOR';

const QUEST_SLUGS_SIN_CIERRE_DEL_NARRADOR: ReadonlySet<string> = new Set([HONOR_MAKTOR_QUEST_SLUG]);

/// Si el narrador puede cerrar esta misión por `questProgress`: solo las suyas antiguas (CR-40, Q9),
/// nunca las del motor (`tipoMision`) ni la misión de vida (P240).
export function narradorPuedeCerrar(q: { tipoMision: string | null; questSlug: string | null }): boolean {
  return !q.tipoMision && !(q.questSlug && QUEST_SLUGS_SIN_CIERRE_DEL_NARRADOR.has(q.questSlug));
}

export interface StartingQuest {
  /// Ver Quest.questSlug en schema.prisma.
  questSlug?: string;
  title: string;
  description: string;
  /// slug de Npc de catálogo (mismo mundo) cuya derrota cierra esta misión sola — se resuelve al
  /// id real en routes/saves.ts al crear/reiniciar la partida (mismo mecanismo que narrador.ts usa
  /// para misiones propuestas en juego, ver Quest.targetNpcId en schema.prisma).
  targetNpcSlug?: string;
  /// Frase corta y accionable para el panel de Misiones (ver Quest.objetivo en schema.prisma) —
  /// distinta de `description` (trasfondo narrativo largo).
  objetivo: string;
  /// Recompensa estática (petición explícita, 2026-07-25) — nunca decidida por el modelo.
  rewardXp?: number;
  rewardItems?: string[];
  /// Recompensa no-objeto (2026-08-17) — ver Quest.rewardRecipeKeys/rewardCompanion en
  /// schema.prisma y grantQuestRewardRecipesAndCompanion (questResolution.ts). Pasivas temporales
  /// (ej. "+5 fuerza durante 24h") quedan fuera a propósito — necesitan un sistema de duración que
  /// todavía no existe en ningún sitio del motor.
  rewardRecipeKeys?: string[];
  rewardCompanion?: QuestRewardCompanion;
}

/// Misiones "de serie" de Gorhorn (petición explícita, 2026-07-23) — se siembran al crear partida
/// y al reiniciarla, mismo patrón que startingAbilitiesFor/startingInventoryFor.
///
/// Solo la de Maktor se siembra aquí (2026-07-23, segunda vuelta de diseño): la del Orco
/// Enfurecido dejó de pre-sembrarse en silencio — ahora nace del encuentro guionizado con Gistera
/// Koh en el primer turno de la partida (ver turnResolution.ts, `primerTurnoHookFor`) y se crea
/// sola vía el mecanismo `newQuest` normal en cuanto el jugador acepta ayudarla, exactamente igual
/// que cualquier otra misión propuesta en juego — no hace falta sembrarla a mano.
const GORHORN_STARTING_QUESTS: StartingQuest[] = [
  {
    questSlug: HONOR_MAKTOR_QUEST_SLUG,
    title: 'Recuperar el honor de los Maktor',
    description:
      'El Clan Maktor fue aniquilado y Gorhorn es, que él sepa, el último. No hay un solo golpe que arregle esto — es la misión de toda una vida: sobrevivir, hacerse fuerte, y devolverle al nombre Maktor un lugar entre los clanes de las Llanuras. Con el tiempo, quizás algo más que un lugar.',
    objetivo: 'Devolverle al nombre Maktor un lugar entre los clanes de las Llanuras.',
    // "De momento" (petición explícita, 2026-07-25) — sin gancho de cierre todavía (es la misión
    // de toda una vida del personaje, no algo que se resuelva con un solo evento concreto), así
    // que por ahora es solo el número mostrado en el panel, sin trigger de concesión automática.
    rewardXp: 1000,
  },
];

export function startingQuestsFor(characterName: string): StartingQuest[] {
  if (characterName === 'Gorhorn') return GORHORN_STARTING_QUESTS;
  return [];
}
