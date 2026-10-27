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

  it('P255: un edificio único por región ya levantado no se ofrece; el repetible (Pozo) sí', () => {
    const buildings = [{ id: 'b1', recipeKey: 'mercado', name: 'un mercado', status: 'ACTIVO' }, { id: 'b2', recipeKey: 'pozo', name: 'un pozo', status: 'ACTIVO' }] as unknown as BuildingInfo[]
    const estado = [receta('mercado', 'un mercado', { unicaYaLevantada: true }), receta('pozo', 'un pozo', { unicaYaLevantada: false })]
    const { queryByRole } = render(<EdificiosParcelasSection buildings={buildings} recipesStatus={estado} onBuild={() => {}} />)
    expect(queryByRole('button', { name: /Mercado/ })).toBeNull()
    expect(queryByRole('button', { name: /Pozo/ })).toBeTruthy()
  })

  it('P255: el Mercado aún sin levantar sí se ofrece', () => {
    const { getByRole } = render(<EdificiosParcelasSection buildings={[]} recipesStatus={[receta('mercado', 'un mercado', { unicaYaLevantada: false })]} onBuild={() => {}} />)
    expect(getByRole('button', { name: /Mercado/ })).toBeTruthy()
  })

  it('P212: el edificio de la capital se llama «Pequeño ayuntamiento», sin el artículo de la narración', () => {
    const buildings = [{ id: 'b1', recipeKey: 'ayuntamiento', name: 'un pequeño ayuntamiento', status: 'ACTIVO', tier: 1 }] as unknown as BuildingInfo[]
    const { getByText, queryByText } = render(<EdificiosParcelasSection buildings={buildings} recipesStatus={[]} onBuild={() => {}} />)
    expect(getByText('Pequeño ayuntamiento')).toBeTruthy()
    expect(queryByText(/un pequeño ayuntamiento/)).toBeNull()
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

describe('P346 — la tarjeta de la Jaula enseña a quien tiene atado', () => {
  afterEach(cleanup)

  it('con ocupante dice quién y su Felicidad; sin él no dice nada', () => {
    const buildings = [
      { id: 'j1', recipeKey: 'jaula-grande', name: 'Jaula grande', kind: 'jaula-grande', status: 'ACTIVO', description: 'x', ocupante: { npcSlug: 'corretolvas', name: 'Corretolvas', tipo: 'FAUNA', felicidad: 15 } },
      { id: 'j2', recipeKey: 'jaula-pequena', name: 'Jaula pequeña', kind: 'jaula-pequena', status: 'ACTIVO', description: 'x', ocupante: null },
    ] as unknown as BuildingInfo[]
    const { getAllByText, getByText } = render(<EdificiosParcelasSection buildings={buildings} recipesStatus={[]} onBuild={() => {}} />)
    expect(getByText(/Atado: Corretolvas/)).toBeTruthy()
    expect(getAllByText(/Atado:/)).toHaveLength(1)
  })
})

describe('P350 — el edificio dañado dice por qué y cuándo', () => {
  afterEach(cleanup)
  const ed = (id: string, name: string, over: Partial<BuildingInfo>): BuildingInfo => ({ id, recipeKey: 'pozo', name, kind: 'pozo', status: 'DANADO', description: 'x', ...over })

  it('con causa y día: «Dañado por una tormenta el día 1522.»; sin causa, solo el día; sin suceso, «Dañado.»', () => {
    const buildings = [
      ed('1', 'Pozo A', { danio: { causa: 'una tormenta', dia: 1522 } }),
      ed('2', 'Granero B', { recipeKey: 'granero', kind: 'granero', danio: { causa: null, dia: 1531 } }),
      ed('3', 'Cisterna C', { recipeKey: 'cisterna', kind: 'cisterna', danio: null }),
    ]
    const { getByText } = render(<EdificiosParcelasSection buildings={buildings} recipesStatus={[]} onBuild={() => {}} />)
    expect(getByText('Dañado por una tormenta el día 1522.')).toBeTruthy()
    expect(getByText('Dañado el día 1531.')).toBeTruthy()
    expect(getByText('Dañado.')).toBeTruthy()
  })

  it('un edificio en pie no lleva esa línea', () => {
    const { queryByText } = render(<EdificiosParcelasSection buildings={[ed('1', 'Pozo A', { status: 'ACTIVO' })]} recipesStatus={[]} onBuild={() => {}} />)
    expect(queryByText('Dañado.')).toBeNull()
    expect(queryByText(/Dañado .*el día/)).toBeNull()
  })
})
