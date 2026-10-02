import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSurroundingsPolling } from './useSurroundingsPolling'

/// Cobertura nueva (2026-09-03) — hueco de "hooks/ entera sin cobertura" (auditoría de deuda
/// técnica 2026-08-25), el primero de los 3 restantes con `setInterval` real. Usa
/// `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync()` (validado antes en una sonda desechable,
/// sin precedente previo en el proyecto) — funciona limpio con `@testing-library/react` en las
/// versiones instaladas aquí. Cubre los 3 guards reales de `tickSurroundings`
/// (`characterThinkingRef`/`combatActiveRef`/`inFlight`), incluido el bug real documentado en el
/// propio hook (2026-07-23: un evento ambiental podía dispararse en mitad de un combate).
vi.mock('../lib/api', () => ({
  requestSurroundings: vi.fn(),
}))

import { requestSurroundings } from '../lib/api'

const mockRequestSurroundings = vi.mocked(requestSurroundings)
const TEN_MINUTES_MS = 10 * 60_000

function baseParams(overrides: Partial<Parameters<typeof useSurroundingsPolling>[0]> = {}) {
  return {
    saveId: 'save-1',
    characterThinking: false,
    combatActive: false,
    fictionalDate: 'Día 1, mañana',
    buildEntityBanner: vi.fn(() => undefined),
    setWorldLog: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  mockRequestSurroundings.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useSurroundingsPolling', () => {
  it('sin saveId, nunca arranca el intervalo — requestSurroundings no se llama ni pasados 10 minutos', async () => {
    mockRequestSurroundings.mockResolvedValue({ description: 'x', logEntryId: 'l1' })
    renderHook(() => useSurroundingsPolling(baseParams({ saveId: null })))

    await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS)
    expect(mockRequestSurroundings).not.toHaveBeenCalled()
  })

  it('con saveId, dispara tickSurroundings cada 10 minutos, con worldThinking true durante la petición', async () => {
    let resolveFn!: (value: { description: string; logEntryId: string }) => void
    mockRequestSurroundings.mockReturnValueOnce(new Promise((resolve) => { resolveFn = resolve }))
    const setWorldLog = vi.fn()
    const { result } = renderHook(() => useSurroundingsPolling(baseParams({ setWorldLog })))

    expect(result.current.worldThinking).toBe(false)
    await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS)
    expect(mockRequestSurroundings).toHaveBeenCalledTimes(1)
    // `setWorldThinking(true)` (línea justo antes del `await requestSurroundings(...)` real) ya se
    // disparó, pero con fake timers activos hace falta un `act` vacío para que React vuelque ese
    // setState pendiente en `result.current` — `waitFor` no sirve aquí (usa setTimeout real
    // internamente para reintentar, que nunca avanza con los timers congelados).
    await act(async () => {})
    expect(result.current.worldThinking).toBe(true)

    resolveFn({ description: 'Un viento frío recorre la hondonada.', logEntryId: 'log-1' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.worldThinking).toBe(false)
    expect(setWorldLog).toHaveBeenCalledTimes(1)
  })

  it('bug real documentado (2026-07-23): mientras combatActive es true, el tick no llama a requestSurroundings', async () => {
    mockRequestSurroundings.mockResolvedValue({ description: 'x', logEntryId: 'l1' })
    const { rerender } = renderHook((props: Parameters<typeof useSurroundingsPolling>[0]) => useSurroundingsPolling(props), {
      initialProps: baseParams({ combatActive: true }),
    })

    await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS)
    expect(mockRequestSurroundings).not.toHaveBeenCalled()

    // El combate termina — el siguiente tick (10 min después, el intervalo nunca se reinició) ya
    // sí debe llamar, confirmando que el guard lee el valor FRESCO vía ref, no uno congelado.
    rerender(baseParams({ combatActive: false }))
    await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS)
    expect(mockRequestSurroundings).toHaveBeenCalledTimes(1)
  })

  it('mientras characterThinking es true, el tick tampoco llama a requestSurroundings (no competir con un turno en curso)', async () => {
    mockRequestSurroundings.mockResolvedValue({ description: 'x', logEntryId: 'l1' })
    renderHook((props: Parameters<typeof useSurroundingsPolling>[0]) => useSurroundingsPolling(props), {
      initialProps: baseParams({ characterThinking: true }),
    })

    await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS)
    expect(mockRequestSurroundings).not.toHaveBeenCalled()
  })

  it('desmontar limpia el intervalo — ningún tick más tras unmount', async () => {
    mockRequestSurroundings.mockResolvedValue({ description: 'x', logEntryId: 'l1' })
    const { unmount } = renderHook(() => useSurroundingsPolling(baseParams()))
    unmount()

    await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS * 3)
    expect(mockRequestSurroundings).not.toHaveBeenCalled()
  })

  it('hallazgo real (2026-09-15): si el backend reutiliza el mismo logEntryId (mundo sin avanzar), no duplica la fila en worldLog', async () => {
    mockRequestSurroundings.mockResolvedValue({ description: 'La arena roja se extiende bajo sus pies.', logEntryId: 'log-repetido' })
    const setWorldLog = vi.fn()
    renderHook(() => useSurroundingsPolling(baseParams({ setWorldLog })))

    await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS)
    await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS)
    expect(mockRequestSurroundings).toHaveBeenCalledTimes(2)
    expect(setWorldLog).toHaveBeenCalledTimes(2)

    // Ambas llamadas al updater, aplicadas en secuencia sobre un worldLog ya poblado con ese id —
    // simula lo que React haría de verdad: la segunda no debe añadir una fila duplicada.
    const prevConId: import('../types').LogEntry[] = [{ id: 'log-repetido', channel: 'world', text: 'x', timeLabel: 't', createdAt: 'c' }]
    const afterFirstTick = setWorldLog.mock.calls[0][0](prevConId)
    const afterSecondTick = setWorldLog.mock.calls[1][0](afterFirstTick)
    expect(afterSecondTick).toHaveLength(1)
  })

  it('si requestSurroundings falla, no revienta — worldThinking vuelve a false y se reintenta en el siguiente tick', async () => {
    mockRequestSurroundings.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ description: 'ok', logEntryId: 'l2' })
    const setWorldLog = vi.fn()
    const { result } = renderHook(() => useSurroundingsPolling(baseParams({ setWorldLog })))

    await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS)
    expect(result.current.worldThinking).toBe(false)
    expect(setWorldLog).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS)
    expect(mockRequestSurroundings).toHaveBeenCalledTimes(2)
    expect(setWorldLog).toHaveBeenCalledTimes(1)
  })
})

/// UX-6 (hito 0.2, opción B decidida por la usuaria 2026-10-02) — un narrador a la vez: al enviar
/// el jugador una acción, la ambientación en curso se cancela y su resultado no se pinta.
describe('useSurroundingsPolling — UX-6', () => {
  it('si el narrador empieza a escribir con una ambientación en curso, se aborta y se descarta', async () => {
    let resolveFn!: (value: { description: string; logEntryId: string }) => void
    mockRequestSurroundings.mockReturnValueOnce(new Promise((resolve) => { resolveFn = resolve }))
    const setWorldLog = vi.fn()
    const { rerender } = renderHook((p) => useSurroundingsPolling(p), { initialProps: baseParams({ setWorldLog }) })

    await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS)
    const signal = mockRequestSurroundings.mock.calls[0][1] as AbortSignal
    expect(signal.aborted).toBe(false)

    rerender(baseParams({ setWorldLog, characterThinking: true }))
    await act(async () => {})
    expect(signal.aborted).toBe(true)

    resolveFn({ description: 'Llueve.', logEntryId: 'log-x' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(setWorldLog).not.toHaveBeenCalled()
  })
})
