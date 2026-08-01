import type { AttributeBlock, Attribute } from './dice.js';
import type { EquipSlot } from '@prisma/client';

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

export interface EquippedItemDetail {
  name: string;
  slot: string | null;
  description: string;
}

/// TODO el equipo puesto (no solo armas) + su descripción real (2026-07-30, auditoría "revisar
/// partida" — "doble descripción": characterSummaryFor nunca mencionaba ningún objeto, y
/// `equippedWeaponNames` de arriba solo daba nombres de armas, nunca su `description` real ni el
/// resto de huecos de equipo — el Narrador nunca supo que el Tótem Maktor estaba puesto, o que el
/// Cuchillo de hielo sílice tiene una hoja concreta). Solo huecos EQUIPADOS (`slot` no null),
/// mismo criterio que `effectiveAttributes`/`effectiveDefense` — la mochila nunca cuenta.
export function equippedItemsSummary(equippedItems: EquippedItemDetail[]): { name: string; description: string }[] {
  return equippedItems.filter((i) => i.slot !== null).map((i) => ({ name: i.name, description: i.description }));
}

/// Familia de ranuras compatibles con la `equipSlot` canónica de un objeto (2026-07-30, petición
/// explícita: "categorizarlos por ranura para que no pueda poner un casco en los pies o una
/// chaqueta en una mano"). Familia, no ranura exacta a rajatabla: cualquier arma vale en
/// ARMA_PRINCIPAL o ARMA_SECUNDARIA (da igual qué mano), cualquier anillo vale en ANILLO_1 o
/// ANILLO_2 (da igual qué dedo) — el resto de ranuras son 1:1 exactas, sin familia.
const CONSUMIBLE_SLOTS: EquipSlot[] = ['CONSUMIBLE_1', 'CONSUMIBLE_2', 'CONSUMIBLE_3', 'CONSUMIBLE_4', 'CONSUMIBLE_5', 'CONSUMIBLE_6'];

export function equipSlotFamily(canonical: EquipSlot): EquipSlot[] {
  if (canonical === 'ARMA_PRINCIPAL' || canonical === 'ARMA_SECUNDARIA') return ['ARMA_PRINCIPAL', 'ARMA_SECUNDARIA'];
  if (canonical === 'ANILLO_1' || canonical === 'ANILLO_2') return ['ANILLO_1', 'ANILLO_2'];
  if (CONSUMIBLE_SLOTS.includes(canonical)) return CONSUMIBLE_SLOTS;
  return [canonical];
}

/// Ranuras equipadas que alimentan "Tus objetos" en combate (2026-07-30, petición explícita:
/// "raciones y cataplasma catalogalo como Consumible que tendrá 6 slots en equipo donde podrás
/// añadir los consumibles que quieres usar en el combate") — ya no vale CUALQUIER objeto sin
/// ranura (mochila entera), solo lo que el jugador equipó a propósito aquí.
export function isConsumibleSlot(slot: EquipSlot | null | undefined): boolean {
  return !!slot && (CONSUMIBLE_SLOTS as string[]).includes(slot);
}
