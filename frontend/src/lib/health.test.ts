import { describe, it, expect } from 'vitest'
import { saludForCondicion, CONDICION_LABEL, applySequentialHeals, healCeilingFor } from './health'

// Cobertura nueva (deuda técnica 2026-07-30): espejo exacto de `saludForCondicion` en
// backend/src/services/death.ts — si alguno de los dos se edita sin el otro, la barra de vida
// del frontend mentiría sobre la condición real del personaje.
describe('saludForCondicion', () => {
  it('mapea cada condición a su salud visible (100/75/50/25/0)', () => {
    expect(saludForCondicion('ILESO')).toBe(100)
    expect(saludForCondicion('HERIDO')).toBe(75)
    expect(saludForCondicion('GRAVE')).toBe(50)
    expect(saludForCondicion('CONVALECIENTE')).toBe(25)
    expect(saludForCondicion('MUERTO')).toBe(0)
  })

  it('empeora estrictamente en el mismo orden que CONDICION_LABEL declara', () => {
    const orden: (keyof typeof CONDICION_LABEL)[] = ['ILESO', 'HERIDO', 'GRAVE', 'CONVALECIENTE', 'MUERTO']
    const saludes = orden.map(saludForCondicion)
    for (let i = 1; i < saludes.length; i++) {
      expect(saludes[i]).toBeLessThan(saludes[i - 1])
    }
  })
})

// Panel "Curar" con varios objetos/usos a la vez (petición explícita, 2026-08-18) — mismo caso de
// orden exacto que death.test.ts (backend), para que la vista previa del frontend nunca se
// desincronice de lo que el motor real hace al confirmar.
describe('applySequentialHeals (espejo del backend)', () => {
  it('sin usos, se queda igual', () => {
    expect(applySequentialHeals('CONVALECIENTE', [])).toBe('CONVALECIENTE')
  })

  it('un único uso da el mismo resultado que llamar a healCeilingFor directamente', () => {
    expect(applySequentialHeals('CONVALECIENTE', [{ curaHasta: 'ILESO', curaUnPaso: true }])).toBe(
      healCeilingFor('CONVALECIENTE', false, false, 'ILESO', true),
    )
  })

  it('dos usos del mismo objeto curaUnPaso encadenan un escalón cada uno: CONVALECIENTE → GRAVE → HERIDO', () => {
    const uso = { curaHasta: 'ILESO' as const, curaUnPaso: true }
    expect(applySequentialHeals('CONVALECIENTE', [uso, uso])).toBe('HERIDO')
  })

  it('EL ORDEN IMPORTA: objeto débil (tope GRAVE) primero y fuerte (tope ILESO) después llega más lejos que al revés', () => {
    const debil = { curaHasta: 'GRAVE' as const, curaUnPaso: true }
    const fuerte = { curaHasta: 'ILESO' as const, curaUnPaso: true }
    expect(applySequentialHeals('CONVALECIENTE', [debil, fuerte])).toBe('HERIDO')
    expect(applySequentialHeals('CONVALECIENTE', [fuerte, debil])).toBe('GRAVE')
  })

  it('una vez en ILESO, más usos no hacen nada', () => {
    const uso = { curaHasta: 'ILESO' as const, curaUnPaso: true }
    expect(applySequentialHeals('ILESO', [uso, uso])).toBe('ILESO')
  })
})
