import type { SecondaryAttributeBlock } from './secondaryAttributes.js';

/// Valores iniciales de atributos secundarios (sesión de diseño 2026-07-23) — copiados tal cual
/// de la tabla ya calculada en docs/rpgtarkor/personajes.md § "Atributos jugables" (fila Gorhorn),
/// mismo patrón que startingAbilitiesFor/startingInventoryFor: se siembran al crear partida y al
/// reiniciarla, nunca se inventan en tiempo de ejecución.
///
/// `sigilo: 5` (no `inteligencia: 10`) — fix 2026-08-03: la tabla de personajes.md da Sigilo=5 e
/// Inteligencia=10 para Gorhorn, pero desde el rediseño de atributos a 7 (2026-07-29) Inteligencia
/// es jugable (`Save.attributes`, no aquí) y Sigilo es el que quedó secundario — este archivo
/// seguía sembrando el valor equivocado bajo la clave equivocada. Ver secondaryAttributes.ts.
const GORHORN_SECONDARY_ATTRIBUTES: SecondaryAttributeBlock = {
  sigilo: 5,
  magia: 3,
  poderSemilla: 4,
  moral: 12,
  resistenciaFisica: 10,
  resistenciaMagica: 7,
  resistenciaSemilla: 4,
  resistenciaFrio: 6,
  resistenciaCalor: 14,
};

export function startingSecondaryAttributesFor(characterName: string): SecondaryAttributeBlock | null {
  if (characterName === 'Gorhorn') return GORHORN_SECONDARY_ATTRIBUTES;
  return null;
}
