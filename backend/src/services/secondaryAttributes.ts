/// Atributos secundarios de PJ (sesión de diseño 2026-07-23) — ya existían como columnas
/// narrativas en docs/rpgtarkor/personajes.md § "Atributos jugables" ("el motor de juego sigue
/// sin usarlos"), ahora se activan mecánicamente. Deliberadamente en un archivo aparte de
/// dice.ts: estos NUNCA se pasan a rollCheck (eso rompería el clasificador, que ya tiene que
/// acertar cuál de los 6 atributos "jugables" usar) — solo alimentan comprobaciones de UMBRAL
/// (requisitos de objetos/construcciones/oficios), nunca una tirada nueva.
export type SecondaryAttribute =
  | 'inteligencia'
  | 'magia'
  | 'poderSemilla'
  | 'moral'
  | 'resistenciaFisica'
  | 'resistenciaMagica'
  | 'resistenciaSemilla'
  | 'resistenciaFrio'
  | 'resistenciaCalor';

export type SecondaryAttributeBlock = Record<SecondaryAttribute, number>;

export const SECONDARY_ATTRIBUTES: SecondaryAttribute[] = [
  'inteligencia',
  'magia',
  'poderSemilla',
  'moral',
  'resistenciaFisica',
  'resistenciaMagica',
  'resistenciaSemilla',
  'resistenciaFrio',
  'resistenciaCalor',
];

const EMPTY_SECONDARY_ATTRIBUTES: SecondaryAttributeBlock = {
  inteligencia: 0,
  magia: 0,
  poderSemilla: 0,
  moral: 0,
  resistenciaFisica: 0,
  resistenciaMagica: 0,
  resistenciaSemilla: 0,
  resistenciaFrio: 0,
  resistenciaCalor: 0,
};

/// Partidas anteriores a esta migración tienen `secondaryAttributes: {}` (default de columna) —
/// se leen como todo-cero en vez de reventar con `undefined` en cualquier comprobación de umbral.
export function normalizeSecondaryAttributes(value: unknown): SecondaryAttributeBlock {
  const raw = (value ?? {}) as Partial<SecondaryAttributeBlock>;
  return {
    inteligencia: raw.inteligencia ?? 0,
    magia: raw.magia ?? 0,
    poderSemilla: raw.poderSemilla ?? 0,
    moral: raw.moral ?? 0,
    resistenciaFisica: raw.resistenciaFisica ?? 0,
    resistenciaMagica: raw.resistenciaMagica ?? 0,
    resistenciaSemilla: raw.resistenciaSemilla ?? 0,
    resistenciaFrio: raw.resistenciaFrio ?? 0,
    resistenciaCalor: raw.resistenciaCalor ?? 0,
  };
}

export { EMPTY_SECONDARY_ATTRIBUTES };
