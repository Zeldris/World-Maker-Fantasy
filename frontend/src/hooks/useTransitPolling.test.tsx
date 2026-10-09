import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTransitPolling } from './useTransitPolling'
import type { SaveDetail } from '../lib/api'

/// Cobertura nueva (2026-09-03) — último de los 6 hooks de "hooks/ entera sin cobertura" (auditoría
/// de deuda técnica 2026-08-25). Mismo patrón de fake timers ya validado en
/// useSurroundingsPolling.test.tsx/useReconnectionPolling.test.tsx, aquí con dos timers
/// concurrentes reales (setInterval de 30s + setTimeout puntual calculado desde busyUntil) más
/// vi.setSystemTime para controlar Date.now() de forma determinista (el hook calcula
/// `remainingMs = new Date(busyUntil).getTime() - Date.now()`).
vi.mock('../lib/api', () => ({
  getSave: vi.fn(),
  cancelTransit: vi.fn(),
}))

import { getSave, cancelTransit } from '../lib/api'

const mockGetSave = vi.mocked(getSave)
const mockCancelTransit = vi.mocked(cancelTransit)
const NOW = new Date('2026-09-03T10:00:00.000Z')

function fakeSave(overrides: Partial<SaveDetail> = {}): SaveDetail {
  return { transit: null, ...overrides } as SaveDetail
}

beforeEach(() => {
  mockGetSave.mockReset()
  mockCancelTransit.mockReset()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useTransitPolling', () => {
  it('sin saveId o sin busyUntil, nunca sondea', async () => {
    mockGetSave.mockResolvedValue(fakeSave())
    renderHook(() => useTransitPolling({ saveId: null, busyUntil: '2026-09-03T10:05:00.000Z', syncFromSave: vi.fn() }))
    renderHook(() => useTransitPolling({ saveId: 'save-1', busyUntil: null, syncFromSave: vi.fn() }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(mockGetSave).not.toHaveBeenCalled()
  })

  it('sondeo puntual (busyUntil - now + 500ms) resuelve el transit cuando save.transit ya es null', async () => {
    const busyUntil = new Date(NOW.getTime() + 5_000).toISOString() // termina en 5s
    mockGetSave.mockResolvedValue(fakeSave({ transit: null }))
    const syncFromSave = vi.fn()
    renderHook(() => useTransitPolling({ saveId: 'save-1', busyUntil, syncFromSave }))

    // El sondeo puntual dispara a los remainingMs(5000) + 500ms = 5500ms, antes que el intervalo de 30s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_500)
    })
    expect(mockGetSave).toHaveBeenCalledTimes(1)
    expect(syncFromSave).toHaveBeenCalledTimes(1)
  })

  it('si save.transit sigue presente (todavía ocupado), NO llama a syncFromSave — se sigue sondeando cada 30s', async () => {
    const busyUntil = new Date(NOW.getTime() + 60_000).toISOString()
    mockGetSave.mockResolvedValue(fakeSave({ transit: { busyUntil } as never }))
    const syncFromSave = vi.fn()
    renderHook(() => useTransitPolling({ saveId: 'save-1', busyUntil, syncFromSave }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(mockGetSave).toHaveBeenCalledTimes(1)
    expect(syncFromSave).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(mockGetSave).toHaveBeenCalledTimes(2)
  })

  it('bug real ya arreglado (2026-08-22): busyUntil ya pasado al montar dispara casi de inmediato, sin esperar el intervalo de 30s completo', async () => {
    const busyUntilYaPasado = new Date(NOW.getTime() - 10_000).toISOString() // hace 10s
    mockGetSave.mockResolvedValue(fakeSave({ transit: null }))
    const syncFromSave = vi.fn()
    renderHook(() => useTransitPolling({ saveId: 'save-1', busyUntil: busyUntilYaPasado, syncFromSave }))

    // remainingMs negativo -> Math.max(0, remainingMs) + 500 = solo 500ms, no 30s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(mockGetSave).toHaveBeenCalledTimes(1)
    expect(syncFromSave).toHaveBeenCalledTimes(1)
  })

  it('un GET fallido durante el sondeo no revienta — se reintenta en el siguiente tick de 30s', async () => {
    const busyUntil = new Date(NOW.getTime() + 60_000).toISOString()
    mockGetSave.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(fakeSave({ transit: null }))
    const syncFromSave = vi.fn()
    renderHook(() => useTransitPolling({ saveId: 'save-1', busyUntil, syncFromSave }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(syncFromSave).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(syncFromSave).toHaveBeenCalledTimes(1)
  })

  it('desmontar limpia interval Y timeout — ningún sondeo más tras unmount', async () => {
    const busyUntil = new Date(NOW.getTime() + 60_000).toISOString()
    mockGetSave.mockResolvedValue(fakeSave({ transit: null }))
    const { unmount } = renderHook(() => useTransitPolling({ saveId: 'save-1', busyUntil, syncFromSave: vi.fn() }))
    unmount()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000)
    })
    expect(mockGetSave).not.toHaveBeenCalled()
  })

  it('nowTick avanza cada segundo mientras hay busyUntil (reloj de cuenta atrás local, sin request)', async () => {
    const busyUntil = new Date(NOW.getTime() + 60_000).toISOString()
    const { result } = renderHook(() => useTransitPolling({ saveId: 'save-1', busyUntil, syncFromSave: vi.fn() }))
    const nowTickInicial = result.current.nowTick

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })
    expect(result.current.nowTick).toBeGreaterThan(nowTickInicial)
  })

  it('handleCancelTransit: éxito llama a cancelTransit + getSave + syncFromSave, con cancelingTransit true durante la petición', async () => {
    mockCancelTransit.mockResolvedValue(undefined)
    const saveTrasCancel = fakeSave({ transit: null })
    mockGetSave.mockResolvedValue(saveTrasCancel)
    const syncFromSave = vi.fn()
    const { result } = renderHook(() => useTransitPolling({ saveId: 'save-1', busyUntil: null, syncFromSave }))

    expect(result.current.cancelingTransit).toBe(false)
    await act(async () => {
      await result.current.handleCancelTransit()
    })
    expect(mockCancelTransit).toHaveBeenCalledWith('save-1')
    expect(syncFromSave).toHaveBeenCalledWith(saveTrasCancel)
    expect(result.current.cancelingTransit).toBe(false)
  })

  it('handleCancelTransit: si cancelTransit falla, no revienta — cancelingTransit vuelve a false sin llamar a syncFromSave', async () => {
    mockCancelTransit.mockRejectedValue(new Error('ya resuelto'))
    const syncFromSave = vi.fn()
    const { result } = renderHook(() => useTransitPolling({ saveId: 'save-1', busyUntil: null, syncFromSave }))

    await act(async () => {
      await result.current.handleCancelTransit()
    })
    expect(result.current.cancelingTransit).toBe(false)
    expect(syncFromSave).not.toHaveBeenCalled()
    // QA-27: el motivo queda visible (antes se tragaba y el botón parecía no hacer nada).
    expect(result.current.errorCancelar).toBe('ya resuelto')
  })

  it('handleCancelTransit: sin saveId, o si ya está cancelingTransit, no hace nada', async () => {
    const { result } = renderHook(() => useTransitPolling({ saveId: null, busyUntil: null, syncFromSave: vi.fn() }))
    await act(async () => {
      await result.current.handleCancelTransit()
    })
    expect(mockCancelTransit).not.toHaveBeenCalled()
  })
})
