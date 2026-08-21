import { describe, it, expect } from 'vitest'
import { inventoryCapacityFor, totalInventoryUnits } from './inventoryCapacity'
import type { AttributeBlock, InventoryItemInfo } from '../types'

// Cobertura nueva (deuda técnica 2026-08-21) — ninguna de las dos tenía test, pese a ser fórmulas
// duplicadas A PROPÓSITO del backend (ver comentarios de cabecera de inventoryCapacity.ts): un
// desajuste aquí desincronizaría lo que el frontend muestra de lo que el backend de verdad aplica.
const BASE_ATTRIBUTES: AttributeBlock = {
  fuerza: 5,
  destreza: 1,
  constitucion: 5,
  inteligencia: 1,
  voluntad: 1,
  carisma: 1,
  arcano: 1,
}

function makeItem(overrides: Partial<InventoryItemInfo> & Pick<InventoryItemInfo, 'id' | 'name'>): InventoryItemInfo {
  return { description: '', slot: null, statBonuses: null, ...overrides }
}

describe('inventoryCapacityFor', () => {
  it('base 20 + fuerza + constitución, sin objetos equipados', () => {
    expect(inventoryCapacityFor(BASE_ATTRIBUTES, [])).toBe(20 + 5 + 5)
  })

  it('suma el bonus cosmético de inventorySlots de cada objeto equipado', () => {
    const equipped = [
      makeItem({ id: '1', name: 'Mochila grande', statBonuses: { inventorySlots: 5 } }),
      makeItem({ id: '2', name: 'Cinturón de bolsas', statBonuses: { inventorySlots: 2 } }),
    ]
    expect(inventoryCapacityFor(BASE_ATTRIBUTES, equipped)).toBe(20 + 5 + 5 + 5 + 2)
  })

  it('objetos equipados sin bonus de inventorySlots no suman nada', () => {
    const equipped = [makeItem({ id: '1', name: 'Espada', statBonuses: { fuerza: 2 } })]
    expect(inventoryCapacityFor(BASE_ATTRIBUTES, equipped)).toBe(20 + 5 + 5)
  })
})

describe('totalInventoryUnits (bug real 2026-08-08: pilas no pueden pesar 1 slot igual que un objeto suelto)', () => {
  it('cuenta cada fila suelta como 1 unidad', () => {
    expect(totalInventoryUnits([{ name: 'Hacha rota' }, { name: 'Escudo' }])).toBe(2)
  })

  it('una pila apilada ("Piedra (9)") pesa sus 9 unidades, no 1', () => {
    expect(totalInventoryUnits([{ name: 'Piedra (9)' }])).toBe(9)
  })

  it('mezcla de sueltos y pilas', () => {
    expect(totalInventoryUnits([{ name: 'Piedra (9)' }, { name: 'Hacha rota' }, { name: 'Leña (3)' }])).toBe(9 + 1 + 3)
  })

  it('inventario vacío: 0', () => {
    expect(totalInventoryUnits([])).toBe(0)
  })
})
