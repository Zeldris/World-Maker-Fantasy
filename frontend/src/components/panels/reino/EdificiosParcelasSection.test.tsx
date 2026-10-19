import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { EdificiosParcelasSection } from './EdificiosParcelasSection'
import type { BuildingInfo, RecipeStatusInfo } from '../../../types'

// P218 — Reino › Edificios › Construir ofrecía solo el Cuartel avanzado (lista fija); Pozo, Granero,
// Cisterna y Leñera solo salían escribiendo en texto libre.
const receta = (recipeKey: string, name: string, over: Partial<RecipeStatusInfo> = {}): RecipeStatusInfo => ({
  recipeKey,
  recipeCategory: 'construccion',
  met: true,
  ingredients: [
    { label: 'leña', tienes: 6, necesitas: 6, met: true },
    { label: 'piedra', tienes: 2, necesitas: 6, met: false },
  ],
  missingRequisitos: [],
  locationOk: true,
  requiredLocationName: null,
  blockedReason: null,
  name,
  requiresAyuntamiento: true,
  upgradesRecipeKey: null,
  ...over,
})

describe('P218 — Construir ofrece todo lo que cuelga del Ayuntamiento', () => {
  afterEach(cleanup)

  const recipesStatus = [
    receta('pozo', 'un pozo'),
    receta('granero', 'un granero'),
    receta('cisterna', 'una cisterna'),
    receta('lenera', 'una leñera'),
    receta('cuartel-avanzado', 'un cuartel avanzado'),
    receta('herreria-obrador', 'un obrador de herrería', { requiresAyuntamiento: false, upgradesRecipeKey: 'herreria' }),
    receta('choza', 'una choza', { requiresAyuntamiento: false }),
  ]

  it('un botón por edificio, con su coste, que manda el mismo texto que el texto libre', () => {
    const onBuild = vi.fn()
    const { getByRole, getAllByText, queryByRole } = render(<EdificiosParcelasSection buildings={[]} recipesStatus={recipesStatus} onBuild={onBuild} />)
    for (const n of [/Pozo/, /Granero/, /Cisterna/, /Leñera/, /Cuartel avanzado/]) expect(getByRole('button', { name: n })).toBeTruthy()
    expect(getAllByText('Coste: leña 6/6 · piedra 2/6').length).toBeGreaterThan(0)
    // La choza no cuelga del Ayuntamiento; la mejora necesita su base en pie.
    expect(queryByRole('button', { name: /Choza/ })).toBeNull()
    expect(queryByRole('button', { name: /obrador/i })).toBeNull()
    fireEvent.click(getByRole('button', { name: /Pozo/ }))
    expect(onBuild).toHaveBeenCalledWith('Me pongo a construir un pozo')
  })

  it('la mejora de un edificio en pie aparece', () => {
    const buildings = [{ id: 'b1', recipeKey: 'herreria', name: 'Herrería', status: 'ACTIVO' }] as unknown as BuildingInfo[]
    const { getByRole } = render(<EdificiosParcelasSection buildings={buildings} recipesStatus={recipesStatus} onBuild={() => {}} />)
    expect(getByRole('button', { name: /Mejorar a Obrador de herrería/ })).toBeTruthy()
  })
})
