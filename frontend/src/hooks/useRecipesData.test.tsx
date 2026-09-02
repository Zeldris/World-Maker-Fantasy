import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useRecipesData } from './useRecipesData'
import type { AttributeBlock, CurrentLocationInfo, InventoryItemInfo } from '../types'

/// Cobertura nueva (2026-09-03) — sin cobertura desde su extracción de GameView.tsx (2026-08-21).
/// El propio comentario de cabecera del hook documenta un bug real ya arreglado (2026-08-13):
/// `recipesStatus` dependía solo de `[saveId, inventory]`, así que subir un atributo o viajar a la
/// ubicación que pedía una receta no refrescaba las tarjetas — el segundo test fija ese
/// comportamiento como regresión.
vi.mock('../lib/api', () => ({
  getProfessionRecipes: vi.fn(),
  getRecipesStatus: vi.fn(),
}))

import { getProfessionRecipes, getRecipesStatus } from '../lib/api'

const mockGetProfessionRecipes = vi.mocked(getProfessionRecipes)
const mockGetRecipesStatus = vi.mocked(getRecipesStatus)

const ATTRS: AttributeBlock = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }
const LOCATION: CurrentLocationInfo = { slug: 'hondonada-del-eco', name: 'La Hondonada del Eco', region: 'Las Llanuras del Viento Rojo' } as CurrentLocationInfo

beforeEach(() => {
  mockGetProfessionRecipes.mockReset()
  mockGetRecipesStatus.mockReset()
})

describe('useRecipesData', () => {
  it('carga professionRecipes al montar (una sola vez, independiente de saveId) y recipesStatus cuando hay saveId', async () => {
    mockGetProfessionRecipes.mockResolvedValue([{ recipeId: 'r1' } as never])
    mockGetRecipesStatus.mockResolvedValue({ recipes: [{ recipeId: 'r1', disponible: true } as never] })

    const { result } = renderHook(() => useRecipesData('save-1', [], ATTRS, LOCATION))

    await waitFor(() => expect(result.current.professionRecipes).toHaveLength(1))
    await waitFor(() => expect(result.current.recipesStatus).toHaveLength(1))
    expect(mockGetProfessionRecipes).toHaveBeenCalledTimes(1)
    expect(mockGetRecipesStatus).toHaveBeenCalledWith('save-1')
  })

  it('sin saveId, nunca llama a getRecipesStatus (professionRecipes sí se carga igual)', async () => {
    mockGetProfessionRecipes.mockResolvedValue([])

    renderHook(() => useRecipesData(null, [], ATTRS, LOCATION))

    await waitFor(() => expect(mockGetProfessionRecipes).toHaveBeenCalledTimes(1))
    expect(mockGetRecipesStatus).not.toHaveBeenCalled()
  })

  it('bug real ya arreglado (2026-08-13): cambiar characterAttributes o currentLocation SÍ vuelve a pedir recipesStatus', async () => {
    mockGetProfessionRecipes.mockResolvedValue([])
    mockGetRecipesStatus.mockResolvedValue({ recipes: [] })

    // `inventory` estable entre renders a propósito (misma referencia, no `[]` recreado en cada
    // invocación) — de lo contrario el efecto se dispara también por eso, contaminando el conteo
    // de llamadas que este test necesita atribuir solo a attrs/location.
    const inventoryEstable: InventoryItemInfo[] = []
    const { rerender } = renderHook(
      ({ attrs, location }: { attrs: AttributeBlock; location: CurrentLocationInfo }) =>
        useRecipesData('save-1', inventoryEstable, attrs, location),
      { initialProps: { attrs: ATTRS, location: LOCATION } },
    )
    await waitFor(() => expect(mockGetRecipesStatus).toHaveBeenCalledTimes(1))

    // Sube un atributo (mismo escenario citado en el comentario del hook: "subir un punto de
    // atributo... no refrescaba nada" antes del fix de dependencias).
    const attrsSubidos = { ...ATTRS, fuerza: 11 }
    rerender({ attrs: attrsSubidos, location: LOCATION })
    await waitFor(() => expect(mockGetRecipesStatus).toHaveBeenCalledTimes(2))

    // Viaja a otra ubicación (el otro escenario citado: "viajar a la ubicación que pedía una
    // receta... no refrescaba nada").
    const otraUbicacion: CurrentLocationInfo = { ...LOCATION, slug: 'campamento-serhu' }
    rerender({ attrs: attrsSubidos, location: otraUbicacion })
    await waitFor(() => expect(mockGetRecipesStatus).toHaveBeenCalledTimes(3))
  })

  it('si getProfessionRecipes/getRecipesStatus fallan, no revientan — se quedan con la lista vacía inicial', async () => {
    mockGetProfessionRecipes.mockRejectedValue(new Error('network'))
    mockGetRecipesStatus.mockRejectedValue(new Error('network'))

    const { result } = renderHook(() => useRecipesData('save-1', [] as InventoryItemInfo[], ATTRS, LOCATION))

    await waitFor(() => expect(mockGetRecipesStatus).toHaveBeenCalled())
    expect(result.current.professionRecipes).toEqual([])
    expect(result.current.recipesStatus).toEqual([])
  })
})
