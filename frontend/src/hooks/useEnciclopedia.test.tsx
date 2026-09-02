import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useEnciclopedia } from './useEnciclopedia'
import type { EnciclopediaResponse } from '../lib/api'

/// Cobertura nueva (2026-09-03) — otro hueco de "hooks/ entera sin cobertura" (auditoría de deuda
/// técnica 2026-08-25). Dos comportamientos reales documentados en el propio hook merecen fijarse
/// como regresión: `refetch` dispara un nuevo fetch SIN que cambien worldSlug/saveId (bug real
/// 2026-08-14: la Enciclopedia se pedía una sola vez al montar y nunca más), y solo la carga
/// inicial pone loading:true — un refetch en segundo plano no debe hacer parpadear un panel ya
/// abierto con datos.
vi.mock('../lib/api', () => ({
  getEnciclopedia: vi.fn(),
}))

import { getEnciclopedia } from '../lib/api'

const mockGetEnciclopedia = vi.mocked(getEnciclopedia)

function fakeResponse(overrides: Partial<EnciclopediaResponse> = {}): EnciclopediaResponse {
  return {
    npcs: [],
    items: [],
    faunaFlora: [],
    locations: [],
    razas: [],
    personajes: [],
    classes: [],
    constructionRecipes: [],
    craftingRecipes: [],
    factions: [],
    historia: [],
    combate: [],
    ...overrides,
  }
}

beforeEach(() => {
  mockGetEnciclopedia.mockReset()
})

describe('useEnciclopedia', () => {
  it('sin worldSlug, nunca llama a getEnciclopedia y se queda con el índice vacío', () => {
    const { result } = renderHook(() => useEnciclopedia(null, 'save-1'))
    expect(mockGetEnciclopedia).not.toHaveBeenCalled()
    expect(result.current.raw).toBeNull()
    expect(result.current.index.entries.size).toBe(0)
  })

  it('con worldSlug, carga al montar pasando saveId, y loading pasa a false al resolver', async () => {
    mockGetEnciclopedia.mockResolvedValue(fakeResponse())
    const { result } = renderHook(() => useEnciclopedia('helek-sirik', 'save-1'))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockGetEnciclopedia).toHaveBeenCalledWith('helek-sirik', 'save-1')
    expect(result.current.raw).not.toBeNull()
  })

  it('refetch() dispara un nuevo fetch sin que cambien worldSlug/saveId (bug real 2026-08-14)', async () => {
    mockGetEnciclopedia.mockResolvedValue(fakeResponse())
    const { result } = renderHook(() => useEnciclopedia('helek-sirik', 'save-1'))
    await waitFor(() => expect(mockGetEnciclopedia).toHaveBeenCalledTimes(1))

    act(() => {
      result.current.refetch()
    })
    await waitFor(() => expect(mockGetEnciclopedia).toHaveBeenCalledTimes(2))
  })

  it('un refetch en segundo plano NO vuelve a poner loading:true (solo la carga inicial lo hace)', async () => {
    mockGetEnciclopedia.mockResolvedValue(fakeResponse())
    const { result } = renderHook(() => useEnciclopedia('helek-sirik', 'save-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Deja la segunda llamada pendiente a propósito para poder observar loading DURANTE el
    // refetch, no solo antes/después.
    let resolveSegunda!: (value: EnciclopediaResponse) => void
    mockGetEnciclopedia.mockReturnValueOnce(new Promise((resolve) => { resolveSegunda = resolve }))

    act(() => {
      result.current.refetch()
    })
    expect(result.current.loading).toBe(false) // sigue false MIENTRAS el refetch está en vuelo

    act(() => {
      resolveSegunda(fakeResponse())
    })
    await waitFor(() => expect(mockGetEnciclopedia).toHaveBeenCalledTimes(2))
    expect(result.current.loading).toBe(false)
  })

  it('si getEnciclopedia falla, no revienta — loading pasa a false, raw se queda null', async () => {
    mockGetEnciclopedia.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useEnciclopedia('helek-sirik', 'save-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.raw).toBeNull()
  })
})
