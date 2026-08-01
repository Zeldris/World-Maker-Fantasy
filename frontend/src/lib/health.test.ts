import { describe, it, expect } from 'vitest'
import { saludForCondicion, CONDICION_LABEL } from './health'

// Cobertura nueva (deuda técnica 2026-07-30): espejo exacto de `saludForCondicion` en
// backend/src/services/death.ts — si alguno de los dos se edita sin el otro, la barra de vida
// del frontend mentiría sobre la condición real del personaje.
describe('saludForCondicion', () => {
  it('mapea cada condición a su salud visible (100/75/50/25/0)', () => {
    expect(saludForCondicion('ILESO')).toBe(100)
    expect(saludForCondicion('HERIDO')).toBe(75)
    expect(saludForCondicion('GRAVE')).toBe(50)
    expect(saludForCondicion('INCAPACITADO')).toBe(25)
    expect(saludForCondicion('MUERTO')).toBe(0)
  })

  it('empeora estrictamente en el mismo orden que CONDICION_LABEL declara', () => {
    const orden: (keyof typeof CONDICION_LABEL)[] = ['ILESO', 'HERIDO', 'GRAVE', 'INCAPACITADO', 'MUERTO']
    const saludes = orden.map(saludForCondicion)
    for (let i = 1; i < saludes.length; i++) {
      expect(saludes[i]).toBeLessThan(saludes[i - 1])
    }
  })
})
