import { describe, it, expect } from 'vitest'
import { retrasoConsecuencias, retrasoEnVivo } from './presentacionTurno'
import { ROLL_DURATION_MS } from '../components/DiceRoll'
import type { LogEntry } from '../types'

/// UX-11 (hito 0.2) — las consecuencias de un turno entran después de su tirada.
describe('UX-11 — presentación en orden del turno', () => {
  const roll = { total: 12 } as unknown as LogEntry['roll']
  const exchange = {} as unknown as LogEntry['combatExchange']

  it('sin tirada, pausa corta; con tirada, lo que tarda en aterrizar; en combate, el doble', () => {
    expect(retrasoConsecuencias({})).toBe(300)
    expect(retrasoConsecuencias({ roll })).toBe(ROLL_DURATION_MS + 300)
    expect(retrasoConsecuencias({ roll, combatExchange: exchange })).toBe(2 * ROLL_DURATION_MS + 300)
  })

  it('solo escalona entradas en vivo y recién llegadas', () => {
    const ahora = Date.parse('2026-10-02T12:00:00Z')
    const reciente = { roll, createdAt: new Date(ahora - 1000).toISOString() }
    const vieja = { roll, createdAt: new Date(ahora - 60_000).toISOString() }
    expect(retrasoEnVivo(reciente, true, ahora)).toBe(ROLL_DURATION_MS + 300)
    expect(retrasoEnVivo(reciente, false, ahora)).toBeNull()
    expect(retrasoEnVivo(vieja, true, ahora)).toBeNull()
  })
})
