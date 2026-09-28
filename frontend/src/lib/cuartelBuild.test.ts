import { describe, it, expect } from 'vitest'
import { cuartelBuildDisabledReason } from './cuartelBuild'
import type { RecipeStatusInfo } from '../types'

const status = (over: Partial<RecipeStatusInfo> = {}): RecipeStatusInfo => ({
  recipeKey: 'cuartel-avanzado',
  recipeCategory: 'construccion',
  met: true,
  ingredients: [],
  missingRequisitos: [],
  locationOk: true,
  requiredLocationName: null,
  blockedReason: null,
  ...over,
})

describe('cuartelBuildDisabledReason', () => {
  it('habilitado cuando la receta está lista', () => {
    expect(cuartelBuildDisabledReason(status(), false, false, false)).toBeNull()
  })
  it('las mejoras exigen un Cuartel en pie', () => {
    expect(cuartelBuildDisabledReason(status(), false, true, false)).toMatch(/Cuartel avanzado/)
    expect(cuartelBuildDisabledReason(status(), true, true, false)).toBeNull()
  })
  it('ya construido bloquea', () => {
    expect(cuartelBuildDisabledReason(status(), true, false, true)).toBe('Ya construido.')
  })
  it('explica materiales y motivo de bloqueo', () => {
    const r = cuartelBuildDisabledReason(
      status({ met: false, ingredients: [{ label: 'piedra', tienes: 2, necesitas: 10, met: false } as never], blockedReason: 'ya hay un cuartel en esta región' }),
      false,
      false,
      false,
    )
    expect(r).toContain('piedra 2/10')
    expect(r).toContain('Ya hay un cuartel')
  })
})
