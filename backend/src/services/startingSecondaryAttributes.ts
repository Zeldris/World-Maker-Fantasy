import type { SecondaryAttributeBlock } from './secondaryAttributes.js';

/// Valores iniciales de atributos secundarios (sesión de diseño 2026-07-23) — copiados tal cual
/// de la tabla ya calculada en docs/rpgtarkor/personajes.md § "Atributos jugables" (fila Gorhorn),
/// mismo patrón que startingAbilitiesFor/startingInventoryFor: se siembran al crear partida y al
/// reiniciarla, nunca se inventan en tiempo de ejecución.
const GORHORN_SECONDARY_ATTRIBUTES: SecondaryAttributeBlock = {
  inteligencia: 10,
  magia: 3,
  poderSemilla: 11,
  moral: 15,
  resistenciaFisica: 16,
  resistenciaMagica: 7,
  resistenciaSemilla: 4,
  resistenciaFrio: 6,
  resistenciaCalor: 14,
};

export function startingSecondaryAttributesFor(characterName: string): SecondaryAttributeBlock | null {
  if (characterName === 'Gorhorn') return GORHORN_SECONDARY_ATTRIBUTES;
  return null;
}
