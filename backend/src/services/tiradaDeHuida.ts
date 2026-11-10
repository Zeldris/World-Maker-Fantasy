import { contraataqueDifficultyFor } from './npcScene.js';
import { effectiveAttributes, effectiveDefense, type EquippedStatBonus } from './equipment.js';
import { gradoExitoFor, type AttributeBlock, type RollResult } from './dice.js';
import { condicionMalus } from './death.js';
import type { CondicionFisica } from '@prisma/client';

/// La tirada de huir de un rival (destreza contra la fórmula del contraataque: cuanto más nivel tiene el rival, más
/// difícil escapar; la defensa equipada ayuda). Un solo sitio para las dos huidas de `routes/saves/session.ts`
/// (`/combat/flee`, `/combat/huir-en-curso`) y el Huir de una emboscada en el modo dinámico (P27, `/responder`).
export function tiradaDeHuida(
  personaje: { attributes: unknown; level: number; condicionFisica?: CondicionFisica },
  equipados: EquippedStatBonus[],
  nivelRival: number,
): RollResult {
  const attributes = effectiveAttributes(personaje.attributes as AttributeBlock, equipados);
  const dificultad = contraataqueDifficultyFor(nivelRival, personaje.level, effectiveDefense(equipados));
  // P364: las heridas restan Destreza también al huir, como en la defensa y la iniciativa (`condicionMalus`).
  const malus = condicionMalus(personaje.condicionFisica ?? 'ILESO');
  const value = attributes.destreza;
  const valorEfectivo = Math.max(1, value - malus);
  const roll = Math.floor(Math.random() * 20) + 1;
  const result = roll + Math.floor(valorEfectivo / 2);
  const gradoExito = gradoExitoFor(result, dificultad);
  return { attribute: 'destreza', value, roll, result, difficulty: dificultad, success: gradoExito !== 'fallo', gradoExito, ...(malus ? { malus, valorEfectivo } : {}) };
}
