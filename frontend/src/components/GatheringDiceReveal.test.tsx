import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, act } from '@testing-library/react'
import { GatheringDiceReveal } from './GatheringDiceReveal'
import type { GatheringRollInfo } from '../types'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const roll: GatheringRollInfo = { attribute: 'destreza', value: 10, bonusOficio: 0, rolls: [19], usedRoll: 19, result: 24, advantage: false, dificultad: 15, grado: 'claro' }

describe('GatheringDiceReveal (P158)', () => {
  it('la tirada en vivo, ya aterrizada, dice contra qué tiró y qué sacó', async () => {
    vi.useFakeTimers()
    render(<GatheringDiceReveal roll={roll} oficioLabel="Recolección" />)
    expect(screen.queryByTestId('tirada-vs')).toBeNull()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(screen.getByTestId('tirada-vs').textContent).toBe('vs 15 · Éxito')
  })

  it('sin dificultad no pone nada', async () => {
    vi.useFakeTimers()
    render(<GatheringDiceReveal roll={{ ...roll, dificultad: undefined, grado: undefined }} oficioLabel="Recolección" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(screen.queryByTestId('tirada-vs')).toBeNull()
  })
})
