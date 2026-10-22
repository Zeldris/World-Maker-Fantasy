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

  it('una mejora ya hecha no se vuelve a ofrecer (mejorar sube tier, no cambia recipeKey)', () => {
    const buildings = [{ id: 'b1', recipeKey: 'herreria', tier: 2, name: 'un obrador de herrería', status: 'ACTIVO' }] as unknown as BuildingInfo[]
    const conNiveles = [
      receta('herreria-obrador', 'un obrador de herrería', { requiresAyuntamiento: false, upgradesRecipeKey: 'herreria', nivel: 2 }),
      receta('herreria-gran-obrador', 'un gran obrador de herrería', { requiresAyuntamiento: false, upgradesRecipeKey: 'herreria', nivel: 3 }),
    ]
    const { queryByRole } = render(<EdificiosParcelasSection buildings={buildings} recipesStatus={conNiveles} onBuild={() => {}} />)
    expect(queryByRole('button', { name: /Mejorar a Obrador de herrería/ })).toBeNull()
    expect(queryByRole('button', { name: /Mejorar a Gran obrador/ })).toBeTruthy()
  })

  it('un edificio del catálogo que ya está en pie se puede repetir si el backend no lo bloquea (Leñera)', () => {
    const buildings = [{ id: 'b1', recipeKey: 'lenera', name: 'una leñera', status: 'ACTIVO' }] as unknown as BuildingInfo[]
    const { getByRole } = render(<EdificiosParcelasSection buildings={buildings} recipesStatus={[receta('lenera', 'una leñera')]} onBuild={() => {}} />)
    expect((getByRole('button', { name: /Leñera/ }) as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('P278 — la lista distingue cada edificio y cuántos hay', () => {
  afterEach(cleanup)
  const ed = (id: string, recipeKey: string, name: string, status: BuildingInfo['status'] = 'ACTIVO'): BuildingInfo => ({ id, recipeKey, name, kind: recipeKey, status, description: `Descripción de ${name}` })

  it('numera dos Pozos, resume cuántos hay y cuántos están dañados, y deja la Choza aparte', () => {
    const { getByText, getAllByText, queryByText } = render(
      <EdificiosParcelasSection buildings={[ed('1', 'choza', 'Choza Básica Orco de las Llanuras', 'DANADO'), ed('2', 'pozo', 'un pozo', 'DANADO'), ed('3', 'pozo', 'un pozo')]} />,
    )
    expect(getByText('Repetidos: 2 × Pozo (1 dañado)')).toBeTruthy()
    expect(getByText('n.º 1')).toBeTruthy()
    expect(getByText('n.º 2')).toBeTruthy()
    expect(getByText('Descripción de Choza Básica Orco de las Llanuras')).toBeTruthy()
    expect(getAllByText('Descripción de un pozo')).toHaveLength(2)
    expect(queryByText('n.º 3')).toBeNull()
  })

  it('un edificio único no lleva número ni resumen', () => {
    const { queryByText } = render(<EdificiosParcelasSection buildings={[ed('1', 'pozo', 'un pozo')]} />)
    expect(queryByText(/Repetidos/)).toBeNull()
    expect(queryByText(/n\.º/)).toBeNull()
  })
})
