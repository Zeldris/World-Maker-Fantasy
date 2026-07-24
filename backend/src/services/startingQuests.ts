export interface StartingQuest {
  title: string;
  description: string;
  /// slug de Npc de catálogo (mismo mundo) cuya derrota cierra esta misión sola — se resuelve al
  /// id real en routes/saves.ts al crear/reiniciar la partida (mismo mecanismo que narrador.ts usa
  /// para misiones propuestas en juego, ver Quest.targetNpcId en schema.prisma).
  targetNpcSlug?: string;
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
    title: 'Recuperar el honor de los Maktor',
    description:
      'El Clan Maktor fue aniquilado y Gorhorn es, que él sepa, el último. No hay un solo golpe que arregle esto — es la misión de toda una vida: sobrevivir, hacerse fuerte, y devolverle al nombre Maktor un lugar entre los clanes de las Llanuras. Con el tiempo, quizás algo más que un lugar.',
  },
];

export function startingQuestsFor(characterName: string): StartingQuest[] {
  if (characterName === 'Gorhorn') return GORHORN_STARTING_QUESTS;
  return [];
}
