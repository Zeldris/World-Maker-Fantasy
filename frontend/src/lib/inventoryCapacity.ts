import type { AttributeBlock, InventoryItemInfo } from '../types'

// Duplicado a propósito del backend (inventoryCapacity.ts) — mismo criterio que professionLevels.ts:
// fórmula fija y barata, no vale la pena pedirla al backend solo para pintar un contador.
export function inventoryCapacityFor(attributes: AttributeBlock, equippedItems: InventoryItemInfo[]): number {
  const cosmeticBonus = equippedItems.reduce((sum, item) => sum + (item.statBonuses?.inventorySlots ?? 0), 0)
  return 20 + attributes.fuerza + attributes.constitucion + cosmeticBonus
}

// Cantidad-en-el-nombre ("Piedra (9)") — duplicado a propósito de `quantityOf` (backend,
// ingredients.ts), mismo criterio que el resto de este archivo.
const QUANTITY_SUFFIX_REGEX = /\((\d+)\)\s*$/

// Bug real jugando en vivo (2026-08-08, "a ver si un slot pero lo que se acumule en el cuenta como
// slot... sino es que podemos tener inventario infinito"): contar filas (`items.length`) deja una
// pila acumulada ("Piedra (9)") pesando 1 slot igual que un objeto suelto — inventario
// efectivamente ilimitado para cualquier recurso ya poseído. La capacidad se mide en UNIDADES
// totales, no en filas.
export function totalInventoryUnits(items: { name: string }[]): number {
  return items.reduce((sum, item) => {
    const match = item.name.match(QUANTITY_SUFFIX_REGEX)
    return sum + (match ? Number(match[1]) : 1)
  }, 0)
}
