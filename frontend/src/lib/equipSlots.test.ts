import { describe, it, expect } from 'vitest'
import { equipSlotFamily, isCompatibleWithSlot, isConsumibleSlot } from './equipSlots'

// Cobertura nueva (auditoría de deuda técnica, 2026-08-21) — `isCompatibleWithSlot` decide qué
// candidatos ofrece DetailModal.tsx al equipar (bug real ya corregido una vez, 2026-07-30: dejaba
// equipar una Cataplasma en la Camisa por ser demasiado permisivo con objetos sin `equipSlot`).
// Sin test hasta ahora pese a ser lógica de coincidencia no trivial.
describe('equipSlotFamily', () => {
  it('las dos armas comparten familia entre sí', () => {
    expect(equipSlotFamily('ARMA_PRINCIPAL')).toEqual(['ARMA_PRINCIPAL', 'ARMA_SECUNDARIA'])
    expect(equipSlotFamily('ARMA_SECUNDARIA')).toEqual(['ARMA_PRINCIPAL', 'ARMA_SECUNDARIA'])
  })

  it('los dos anillos comparten familia entre sí', () => {
    expect(equipSlotFamily('ANILLO_1')).toEqual(['ANILLO_1', 'ANILLO_2'])
    expect(equipSlotFamily('ANILLO_2')).toEqual(['ANILLO_1', 'ANILLO_2'])
  })

  it('las 6 ranuras de consumible comparten familia entre sí', () => {
    const family = equipSlotFamily('CONSUMIBLE_3')
    expect(family).toHaveLength(6)
    expect(family).toContain('CONSUMIBLE_1')
    expect(family).toContain('CONSUMIBLE_6')
  })

  it('el resto de ranuras son 1:1, sin familia compartida', () => {
    expect(equipSlotFamily('CASCO')).toEqual(['CASCO'])
    expect(equipSlotFamily('BOTAS')).toEqual(['BOTAS'])
  })
})

describe('isCompatibleWithSlot', () => {
  it('un objeto sin catalogSlug (narrativo suelto) vale en cualquier ranura', () => {
    expect(isCompatibleWithSlot({ catalogSlug: null, equipSlot: null }, 'CASCO')).toBe(true)
    expect(isCompatibleWithSlot({ catalogSlug: null, equipSlot: null }, 'BOTAS')).toBe(true)
  })

  it('un objeto de catálogo sin equipSlot no es compatible con ninguna ranura (bug real 2026-07-30)', () => {
    expect(isCompatibleWithSlot({ catalogSlug: 'cataplasma', equipSlot: null }, 'CAMISA')).toBe(false)
  })

  it('un objeto de catálogo con equipSlot exacto es compatible consigo mismo', () => {
    expect(isCompatibleWithSlot({ catalogSlug: 'espada-orca', equipSlot: 'ARMA_PRINCIPAL' }, 'ARMA_PRINCIPAL')).toBe(true)
  })

  it('un arma es compatible con la ranura hermana de la familia (principal <-> secundaria)', () => {
    expect(isCompatibleWithSlot({ catalogSlug: 'espada-orca', equipSlot: 'ARMA_PRINCIPAL' }, 'ARMA_SECUNDARIA')).toBe(true)
  })

  it('un objeto de catálogo con equipSlot fijo no es compatible con una ranura fuera de su familia', () => {
    expect(isCompatibleWithSlot({ catalogSlug: 'casco-orco', equipSlot: 'CASCO' }, 'BOTAS')).toBe(false)
  })
})

describe('isConsumibleSlot', () => {
  it('reconoce las 6 ranuras de consumible', () => {
    expect(isConsumibleSlot('CONSUMIBLE_1')).toBe(true)
    expect(isConsumibleSlot('CONSUMIBLE_6')).toBe(true)
  })

  it('rechaza ranuras que no son de consumible, null y undefined', () => {
    expect(isConsumibleSlot('CASCO')).toBe(false)
    expect(isConsumibleSlot(null)).toBe(false)
    expect(isConsumibleSlot(undefined)).toBe(false)
  })
})
