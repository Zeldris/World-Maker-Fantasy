import { contraataqueDifficultyFor } from './npcScene.js';
import { effectiveAttributes, effectiveDefense, type EquippedStatBonus } from './equipment.js';
import { rollCheck, type AttributeBlock, type RollResult } from './dice.js';

/// La tirada de huir de un rival (destreza contra la fórmula del contraataque: cuanto más nivel tiene el rival, más
/// difícil escapar; la defensa equipada ayuda). Un solo sitio para las dos huidas de `routes/saves/session.ts`
/// (`/combat/flee`, `/combat/huir-en-curso`) y el Huir de una emboscada en el modo dinámico (P27, `/responder`).
export function tiradaDeHuida(
  personaje: { attributes: unknown; level: number },
  equipados: EquippedStatBonus[],
  nivelRival: number,
): RollResult {
  const attributes = effectiveAttributes(personaje.attributes as AttributeBlock, equipados);
  const dificultad = contraataqueDifficultyFor(nivelRival, personaje.level, effectiveDefense(equipados));
  return rollCheck(attributes, 'destreza', dificultad);
}
