import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { LogPanel } from './LogPanel'
import type { CombatExchangeInfo } from '../types'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const lado = (roll: number, attribute: string) => ({ roll, rolls: [roll], value: 8, result: roll + 4, success: roll > 10, attribute, difficulty: 15, gradoExito: roll > 10 ? 'claro' : 'fallo', valorEfectivo: 8, multiplicador: 1, malus: 0, attributeBonus: 0, rollMode: 'normal' })
const intercambio = (jugador: number, rival: number) =>
  ({ atacanteEsJugador: false, atacante: lado(rival, 'fuerza'), defensor: lado(jugador, 'constitucion'), resultado: 'golpe_normal', margen: 0, rivalNombre: 'Guchapo' }) as unknown as CombatExchangeInfo

/// P11 (QA-27): la animación enseñaba el dado del rival del intercambio anterior. La tarjeta de los
/// dados seguía montada y los dados solo arrancan al montarse.
describe('P11 — cada intercambio anima sus propios dados', () => {
  it('un intercambio nuevo con la tarjeta ya montada enseña sus números, no los del anterior', () => {
    vi.useFakeTimers()
    Element.prototype.scrollTo = vi.fn()
    Element.prototype.scrollIntoView = vi.fn()
    const props = { title: 'Tu personaje', subtitle: 'x', accent: 'accent' as const, emptyHint: 'vacío', entries: [], isThinking: true }
    const { rerender, container } = render(<LogPanel {...props} diceReveal={{ exchange: intercambio(17, 14), npcName: 'Guchapo' }} />)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    rerender(<LogPanel {...props} diceReveal={{ exchange: intercambio(3, 6), npcName: 'Guchapo' }} />)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    const dados = [...container.querySelectorAll('.font-mono.text-2xl')].map((d) => d.textContent)
    expect(dados).toEqual(['3', '6'])
  })
})
