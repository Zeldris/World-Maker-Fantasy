import type { AttributeBlock, Attribute } from './dice.js';

const ATTRIBUTES: Attribute[] = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'voluntad', 'carisma', 'arcano'];

function isAttribute(value: string): value is Attribute {
  return (ATTRIBUTES as string[]).includes(value);
}

export interface EquippedStatBonus {
  statBonusAttribute: string | null;
  statBonusAmount: number | null;
}

/// Estadísticas de objetos (instrucción explícita de la usuaria, 2026-07-19, reabriendo la
/// decisión de mecánicas 6): un objeto EQUIPADO puede sumar un bonificador real a uno de los 6
/// atributos jugables — puro y determinista, mismo espíritu que progression.ts/death.ts. Solo
/// cuenta lo que está en un hueco de equipo (`slot` no null); la mochila nunca da bonificadores.
export function effectiveAttributes(base: AttributeBlock, equippedItems: EquippedStatBonus[]): AttributeBlock {
  const result = { ...base };
  for (const item of equippedItems) {
    if (!item.statBonusAttribute || !item.statBonusAmount) continue;
    if (!isAttribute(item.statBonusAttribute)) continue;
    result[item.statBonusAttribute] += item.statBonusAmount;
  }
  return result;
}

/// Slot de defensa (roadmap 2026-07-19, prioridad 1: cerrar el combate ya calibrado): mismo
/// patrón que effectiveAttributes, pero para armadura/escudo equipado — `statBonusAttribute`
/// vale 'defensa' en vez de uno de los 6 atributos jugables (isAttribute lo ignora arriba, así
/// que ambas funciones pueden convivir sobre el mismo InventoryItem sin pisarse). Se resta a la
/// dificultad de contraataque del NPC (npcScene.ts) — llevar armadura real hace más fácil
/// esquivar/bloquear, no solo decorativo.
export function effectiveDefense(equippedItems: EquippedStatBonus[]): number {
  return equippedItems.reduce((sum, item) => {
    if (item.statBonusAttribute === 'defensa' && item.statBonusAmount) return sum + item.statBonusAmount;
    return sum;
  }, 0);
}

export interface EquippedWeaponInfo {
  name: string;
  slot: string | null;
}

/// Nombres de las armas equipadas ahora mismo (ARMA_PRINCIPAL/ARMA_SECUNDARIA) — roadmap
/// 2026-07-20, mitigación de calidad narrativa (hallazgo real jugando): el modelo puso el arma de
/// un NPC enemigo ("la maza orca") en manos del propio jugador. Decírselo de forma determinista en
/// el prompt de combate corta el error de raíz, mismo patrón que missingItemBlockFor.
export function equippedWeaponNames(equippedItems: EquippedWeaponInfo[]): string[] {
  return equippedItems.filter((i) => i.slot === 'ARMA_PRINCIPAL' || i.slot === 'ARMA_SECUNDARIA').map((i) => i.name);
}
