import type { AttributeBlock, Attribute } from './dice.js';
import type { EquipSlot } from '@prisma/client';
import { SECONDARY_ATTRIBUTES, type SecondaryAttribute, type SecondaryAttributeBlock } from './secondaryAttributes.js';

const ATTRIBUTES: Attribute[] = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'voluntad', 'carisma', 'magia'];

function isAttribute(value: string): value is Attribute {
  return (ATTRIBUTES as string[]).includes(value);
}

function isSecondaryAttribute(value: string): value is SecondaryAttribute {
  return (SECONDARY_ATTRIBUTES as string[]).includes(value);
}

/// Mapa de bonificadores de UN objeto (2026-08-03, sustituye al par statBonusAttribute/
/// statBonusAmount — un solo par no dejaba a un objeto sumar, p.ej., fuerza Y defensa a la vez).
/// Mismo patrón que `Requisitos` (requisitos.ts): mapa parcial, `'defensa'` incluido junto a los
/// 6 atributos jugables (ver comentario de `effectiveDefense` más abajo).
export type StatBonusMap = Partial<Record<string, number>>;

export interface EquippedStatBonus {
  /// `unknown` a propósito: llega tal cual del campo `Json?` de Prisma (ItemCatalog/InventoryItem
  /// .statBonuses) en cada caller, sin que cada uno tenga que castear — se normaliza aquí mismo,
  /// un único sitio de confianza para esta forma de dato en vez de repetir `as StatBonusMap` en
  /// cada ruta/servicio que llama a estas dos funciones.
  statBonuses: unknown;
}

function asStatBonusMap(value: unknown): StatBonusMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as StatBonusMap;
}

/// Estadísticas de objetos (instrucción explícita de la usuaria, 2026-07-19, reabriendo la
/// decisión de mecánicas 6; extendido 2026-08-03 a múltiples bonus por objeto): un objeto
/// EQUIPADO puede sumar bonificadores reales a varios de los 6 atributos jugables a la vez —
/// puro y determinista, mismo espíritu que progression.ts/death.ts. Solo cuenta lo que está en un
/// hueco de equipo (`slot` no null); la mochila nunca da bonificadores.
export function effectiveAttributes(base: AttributeBlock, equippedItems: EquippedStatBonus[]): AttributeBlock {
  const result = { ...base };
  for (const item of equippedItems) {
    for (const [attribute, amount] of Object.entries(asStatBonusMap(item.statBonuses))) {
      if (!amount || !isAttribute(attribute)) continue;
      result[attribute] += amount;
    }
  }
  return result;
}

/// Solo el bonus de equipo, SIN sumar la base (2026-08-14, petición explícita: "la barra debería
/// verse en color claro la parte de los attr base y en más oscuro lo que aumentan lo que llevas
/// equipado") — mismo bucle que `effectiveAttributes` pero partiendo de cero, para que el
/// frontend pueda pintar los dos tramos por separado en vez de solo el total ya sumado. Mismo
/// criterio de "solo lo equipado cuenta" que el resto de funciones de este archivo.
export function attributeBonusesFromEquipment(equippedItems: EquippedStatBonus[]): Partial<AttributeBlock> {
  const result: Partial<AttributeBlock> = {};
  for (const item of equippedItems) {
    for (const [attribute, amount] of Object.entries(asStatBonusMap(item.statBonuses))) {
      if (!amount || !isAttribute(attribute)) continue;
      result[attribute] = (result[attribute] ?? 0) + amount;
    }
  }
  return result;
}

/// Simétrico a `effectiveAttributes`, pero para los 9 atributos secundarios (2026-08-03, hueco
/// real encontrado tras construir el mapa de bonus múltiple: la petición explícita de la usuaria
/// —"cosméticos... bonus especiales de attrs secundarios"— nunca llegó a tener ningún sitio que la
/// aplicara de verdad; `normalizeSecondaryAttributes` se llamaba a pelo en cada ruta, sin pasar
/// nunca por el equipo puesto). Mismo criterio: solo cuenta lo equipado, la mochila nunca suma.
export function effectiveSecondaryAttributes(base: SecondaryAttributeBlock, equippedItems: EquippedStatBonus[]): SecondaryAttributeBlock {
  const result = { ...base };
  for (const item of equippedItems) {
    for (const [attribute, amount] of Object.entries(asStatBonusMap(item.statBonuses))) {
      if (!amount || !isSecondaryAttribute(attribute)) continue;
      result[attribute] += amount;
    }
  }
  return result;
}

/// Slot de defensa (roadmap 2026-07-19, prioridad 1: cerrar el combate ya calibrado): mismo
/// patrón que effectiveAttributes, pero para armadura/escudo equipado — la clave `'defensa'` del
/// mapa vale para esto en vez de uno de los 6 atributos jugables (isAttribute la ignora arriba,
/// así que ambas funciones pueden convivir sobre el mismo InventoryItem sin pisarse, incluso el
/// mismo objeto dando fuerza Y defensa a la vez). Se resta a la dificultad de contraataque del
/// NPC (npcScene.ts) — llevar armadura real hace más fácil esquivar/bloquear, no solo decorativo.
export function effectiveDefense(equippedItems: EquippedStatBonus[]): number {
  return equippedItems.reduce((sum, item) => sum + (asStatBonusMap(item.statBonuses).defensa ?? 0), 0);
}

/// Bonus de slots de inventario (rediseño de profesiones, 2026-08-07: "cosméticos que podrán
/// tener bonus del tipo +5 slots en el inventario") — mismo patrón exacto que `effectiveDefense`,
/// clave `'inventorySlots'` del mismo StatBonusMap en vez de `'defensa'`. Ver `inventoryCapacityFor`
/// (inventoryCapacity.ts) para cómo se combina con el aporte de Fuerza/Constitución.
export function effectiveInventorySlotsBonus(equippedItems: EquippedStatBonus[]): number {
  return equippedItems.reduce((sum, item) => sum + (asStatBonusMap(item.statBonuses).inventorySlots ?? 0), 0);
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
