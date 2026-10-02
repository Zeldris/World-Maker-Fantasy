import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePresence } from './usePresence'

/// BAS-7 (hito 0.2) — mantener montado durante la animación de salida.
describe('BAS-7 — usePresence', () => {
  afterEach(() => {
    vi.useRealTimers()
    delete document.documentElement.dataset.motion
  })

  it('al cerrarse sigue mostrando el último valor con saliendo=true durante ms', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ v }) => usePresence<string>(v, 200), { initialProps: { v: 'inventario' as string | null } })
    expect(result.current).toEqual({ mostrado: 'inventario', saliendo: false })
    rerender({ v: null })
    expect(result.current).toEqual({ mostrado: 'inventario', saliendo: true })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toEqual({ mostrado: null, saliendo: false })
  })

  it('reabrir durante la salida la cancela; con «ninguna» cierra en seco', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ v }) => usePresence<string>(v, 200), { initialProps: { v: 'mapa' as string | null } })
    rerender({ v: null })
    rerender({ v: 'diario' })
    expect(result.current).toEqual({ mostrado: 'diario', saliendo: false })
    document.documentElement.dataset.motion = 'ninguna'
    rerender({ v: null })
    expect(result.current.mostrado).toBeNull()
  })
})
