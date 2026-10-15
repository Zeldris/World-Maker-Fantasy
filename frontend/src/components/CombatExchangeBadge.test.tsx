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

/// P153 (QA-27): la ventaja de golpear a quien ya pelea con otro salía como «▲ racial».
describe('CombatExchangeBadge — chip de la ventaja', () => {
  const lado = (extra: object) => ({ roll: 15, rolls: [15, 4], rollMode: 'ventaja', value: 10, valorEfectivo: 10, multiplicador: 1, malus: 0, result: 20, difficulty: 10, success: true, gradoExito: 'claro', attribute: 'destreza', ...extra })
  const exchange = (extra: object) => ({ atacanteEsJugador: false, atacante: lado(extra), defensor: { ...lado({}), rollMode: 'normal', rolls: [8] }, resultado: 'golpe_normal', margen: 3 }) as unknown as CombatExchangeInfo

  it('con ventajaPor, el chip lo dice', () => {
    render(<CombatExchangeBadge exchange={exchange({ racialAdvantageReason: 'Ataca mientras peleas con otro rival: ventaja', ventajaPor: 'flanqueo' })} playerName="Gorhorn" enemyName="Guchapo" />)
    expect(screen.getByText(/▲ flanqueo/)).toBeTruthy()
    expect(screen.queryByText(/▲ racial/)).toBeNull()
  })
})
