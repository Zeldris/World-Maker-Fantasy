import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSupervivenciaSync } from './useSupervivenciaSync'

vi.mock('../lib/api', () => ({
  getSupervivencia: vi.fn(async () => ({ condicionFisica: 'CONVALECIENTE', hambre: 0, sed: 0 })),
}))

describe('useSupervivenciaSync (P219 c)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('actualiza condición, hambre y sed con lo que hay en BD', async () => {
    const setC = vi.fn()
    const setH = vi.fn()
    const setS = vi.fn()
    renderHook(() => useSupervivenciaSync({ saveId: 's1', characterThinking: false, combatActive: false, setCondicionFisica: setC, setHambre: setH, setSed: setS }))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(setC).toHaveBeenCalledWith('CONVALECIENTE')
    expect(setH).toHaveBeenCalledWith(0)
    expect(setS).toHaveBeenCalledWith(0)
  })

  it('no toca nada con un turno en curso', async () => {
    const setC = vi.fn()
    renderHook(() => useSupervivenciaSync({ saveId: 's1', characterThinking: true, combatActive: false, setCondicionFisica: setC, setHambre: vi.fn(), setSed: vi.fn() }))
    await vi.advanceTimersByTimeAsync(120_000)
    expect(setC).not.toHaveBeenCalled()
  })
})
