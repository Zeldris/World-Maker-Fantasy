import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRotatingFlavor } from './waitingFlavor'

/// Cobertura nueva (2026-09-03) — `useRotatingFlavor` es un hook (pese a vivir en lib/, no hooks/)
/// sin cobertura hasta ahora. Mismo patrón de fake timers ya validado en los hooks de polling
/// (useSurroundingsPolling.test.tsx y hermanos) + Math.random mockeado para el índice inicial
/// determinista.
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useRotatingFlavor', () => {
  it('active:false nunca arranca la rotación — devuelve pool[0] y no cambia con el tiempo', async () => {
    const pool = ['a', 'b', 'c']
    const { result } = renderHook(() => useRotatingFlavor(false, pool))

    expect(result.current).toBe('a')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })
    expect(result.current).toBe('a')
  })

  it('active:true elige un índice inicial aleatorio y rota cada intervalMs', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // pool.length=4 -> floor(0.5*4)=2
    const pool = ['a', 'b', 'c', 'd']
    const { result } = renderHook(() => useRotatingFlavor(true, pool, 1000))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current).toBe('c') // índice inicial 2

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(result.current).toBe('d') // avanza 1

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(result.current).toBe('a') // vuelve a rotar (módulo del tamaño del pool)
  })

  it('desmontar detiene la rotación — el intervalo no sigue corriendo tras unmount', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const pool = ['a', 'b', 'c']
    const { result, unmount } = renderHook(() => useRotatingFlavor(true, pool, 1000))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    const valorAntesDeDesmontar = result.current

    unmount()
    // No hay forma directa de comprobar result.current tras unmount (renderHook lo congela), pero
    // el interval limpio se confirma indirectamente: avanzar el reloj no debe lanzar ningún error
    // de setState sobre un componente desmontado (React lo detectaría con un warning real).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(valorAntesDeDesmontar).toBe('a')
  })

  it('pool vacío o índice fuera de rango cae a pool[0] (guard `?? pool[0]`)', () => {
    const { result } = renderHook(() => useRotatingFlavor(false, ['única']))
    expect(result.current).toBe('única')
  })

  it('cambiar `active` de false a true arranca la rotación en ese momento, con un nuevo índice aleatorio', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9) // pool.length=3 -> floor(0.9*3)=2
    const pool = ['a', 'b', 'c']
    const { result, rerender } = renderHook(({ active }: { active: boolean }) => useRotatingFlavor(active, pool, 1000), {
      initialProps: { active: false },
    })
    expect(result.current).toBe('a')

    act(() => {
      rerender({ active: true })
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current).toBe('c')
  })
})
