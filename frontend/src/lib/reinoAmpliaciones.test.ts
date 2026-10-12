import { describe, it, expect } from 'vitest'
import { reinoAbilityDisponible } from '../data/reinoRecipes'

/// P19 (QA-27): no se ofrece ampliar un ayuntamiento que no existe.
describe('P19 — ampliaciones del ayuntamiento', () => {
  it('solo con el nivel anterior construido', () => {
    expect(reinoAbilityDisponible('Ampliar ayuntamiento a mediano', [])).toBe(false)
    expect(reinoAbilityDisponible('Ampliar ayuntamiento a mediano', ['ayuntamiento'])).toBe(true)
    expect(reinoAbilityDisponible('Ampliar ayuntamiento a grande', ['ayuntamiento'])).toBe(false)
    expect(reinoAbilityDisponible('Ampliar ayuntamiento a grande', ['ayuntamiento-mediano'])).toBe(true)
  })

  it('lo que no es ampliación sigue siempre', () => {
    expect(reinoAbilityDisponible('Fundar ayuntamiento', [])).toBe(true)
    expect(reinoAbilityDisponible('Construir campamento', [])).toBe(true)
  })
})
