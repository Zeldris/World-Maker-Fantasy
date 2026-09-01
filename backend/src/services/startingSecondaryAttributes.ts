import type { SecondaryAttributeBlock } from './secondaryAttributes.js';

/// Valores iniciales de atributos secundarios (sesión de diseño 2026-07-23, remodelados
/// 2026-08-22 — ver secondaryAttributes.ts) — mismo patrón que startingAbilitiesFor/
/// startingInventoryFor: se siembran al crear partida y al reiniciarla, nunca se inventan en
/// tiempo de ejecución.
///
/// Tras el remodelado: `sigilo`/`resistenciaFisica`/`resistenciaMagica`/`resistenciaSemilla` ya
/// no existen aquí (ver secondaryAttributes.ts para el porqué). `suerte`/`honor` son nuevos —
/// Gorhorn no ha tenido una vida especialmente afortunada (esclavitud, clan aniquilado), suerte
/// baja; el honor es central en su arco (la deuda con Kekta, la redención), alto.
const GORHORN_SECONDARY_ATTRIBUTES: SecondaryAttributeBlock = {
  moral: 12,
  resistenciaFrio: 6,
  resistenciaCalor: 18,
  suerte: 5,
  honor: 15,
};

export function startingSecondaryAttributesFor(characterName: string): SecondaryAttributeBlock | null {
  if (characterName === 'Gorhorn') return GORHORN_SECONDARY_ATTRIBUTES;
  return null;
}
