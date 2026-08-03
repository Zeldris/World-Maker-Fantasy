/// Atributos secundarios de PJ (sesión de diseño 2026-07-23) — ya existían como columnas
/// narrativas en docs/rpgtarkor/personajes.md § "Atributos jugables" ("el motor de juego sigue
/// sin usarlos"), ahora se activan mecánicamente. Deliberadamente en un archivo aparte de
/// dice.ts: estos NUNCA se pasan a rollCheck (eso rompería el clasificador, que ya tiene que
/// acertar cuál de los 7 atributos "jugables" usar) — solo alimentan comprobaciones de UMBRAL
/// (requisitos de objetos/construcciones/oficios), nunca una tirada nueva.
///
/// `sigilo` (no `inteligencia`) — bug real encontrado en auditoría (2026-08-03, "análisis completo
/// backend/frontend"): el rediseño de atributos a 7 (2026-07-29, ver `dice.ts`/`attributeWheel.ts`/
/// `npcScene.ts` § tabulatedAttackAttribute) promocionó Inteligencia a atributo JUGABLE y bajó
/// Sigilo a secundario — el propio `frontend/src/types.ts` ya reflejaba el cambio (`SecondaryAttribute`
/// con 'sigilo', sin 'inteligencia'), pero este archivo del backend se quedó con la lista vieja,
/// nunca actualizado en aquella sesión. Confirmado explícitamente por la usuaria: "inteligencia es
/// un atributo primario".
export type SecondaryAttribute =
  | 'sigilo'
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
  'sigilo',
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
  sigilo: 0,
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
/// Partidas creadas ANTES del fix de 2026-08-03 pueden tener un `inteligencia` residual en su JSON
/// guardado (del bug de arriba) — `raw` se tipa contra el `SecondaryAttributeBlock` correcto, así
/// que esa clave vieja simplemente se ignora (nunca se lee), y `sigilo` cae a 0 hasta que se
/// resiembre la partida.
export function normalizeSecondaryAttributes(value: unknown): SecondaryAttributeBlock {
  const raw = (value ?? {}) as Partial<SecondaryAttributeBlock>;
  return {
    sigilo: raw.sigilo ?? 0,
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
