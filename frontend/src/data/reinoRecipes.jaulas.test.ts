import { describe, expect, it } from 'vitest'
import { REINO_ABILITY_RECIPE_KEY } from './reinoRecipes'

describe('REINO_ABILITY_RECIPE_KEY (P81, QA-27)', () => {
  it('las jaulas tienen receta, así que su aviso dice qué necesitan y salen desactivadas si falta algo', () => {
    expect(REINO_ABILITY_RECIPE_KEY['Construir jaula pequeña']).toBe('jaula-pequena')
    expect(REINO_ABILITY_RECIPE_KEY['Construir jaula mediana']).toBe('jaula-mediana')
    expect(REINO_ABILITY_RECIPE_KEY['Construir jaula grande']).toBe('jaula-grande')
  })
})
