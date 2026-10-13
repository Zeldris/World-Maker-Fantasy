import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CombatExchangeBadge } from './CombatExchangeBadge'
import type { CombatExchangeInfo } from '../types'

/// P96 (QA-27): el golpe de gracia a un convaleciente se cuenta, sin comparar tiradas.
describe('CombatExchangeBadge — golpe de gracia', () => {
  it('dice que acierta sin tirada', () => {
    const exchange = { atacanteEsJugador: true, atacante: {}, defensor: {}, resultado: 'golpe_pleno', margen: 10, golpeDeGracia: true } as unknown as CombatExchangeInfo
    render(<CombatExchangeBadge exchange={exchange} playerName="Gorhorn" enemyName="Guchapo" />)
    expect(screen.getByText(/Guchapo está convaleciente y no puede defenderse: el golpe de Gorhorn acierta sin tirada/)).toBeTruthy()
  })
})
