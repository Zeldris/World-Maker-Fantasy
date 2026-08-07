import type { AttributeBlock, InventoryItemInfo } from '../types'

// Duplicado a propósito del backend (inventoryCapacity.ts) — mismo criterio que professionLevels.ts:
// fórmula fija y barata, no vale la pena pedirla al backend solo para pintar un contador.
export function inventoryCapacityFor(attributes: AttributeBlock, equippedItems: InventoryItemInfo[]): number {
  const cosmeticBonus = equippedItems.reduce((sum, item) => sum + (item.statBonuses?.inventorySlots ?? 0), 0)
  return 20 + attributes.fuerza + attributes.constitucion + cosmeticBonus
}
