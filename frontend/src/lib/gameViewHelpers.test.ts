import { describe, it, expect } from 'vitest'
import { formatFictionalDuration, formatCountdown } from './gameViewHelpers'

describe('formatCountdown (crafteo con espera real, 2026-08-20)', () => {
  const now = Date.parse('2026-08-20T12:00:00.000Z')

  it('resolviendo... cuando ya pasó busyUntil', () => {
    expect(formatCountdown(new Date(now - 1000).toISOString(), now)).toBe('resolviendo...')
  })

  it('segundos: por debajo de un minuto, redondeado hacia arriba', () => {
    expect(formatCountdown(new Date(now + 5_000).toISOString(), now)).toBe('~5s')
    expect(formatCountdown(new Date(now + 4_500).toISOString(), now)).toBe('~5s')
    expect(formatCountdown(new Date(now + 59_000).toISOString(), now)).toBe('~59s')
  })

  it('minutos: 60s en adelante sigue el formato de siempre', () => {
    expect(formatCountdown(new Date(now + 60_000).toISOString(), now)).toBe('~1 min')
    expect(formatCountdown(new Date(now + 5 * 60_000).toISOString(), now)).toBe('~5 min')
  })

  it('horas: sin cambios frente al formato ya existente', () => {
    expect(formatCountdown(new Date(now + 90 * 60_000).toISOString(), now)).toBe('~1h 30min')
  })
})

describe('formatFictionalDuration', () => {
  it('minutos: valores por debajo de una hora', () => {
    expect(formatFictionalDuration(45)).toBe('45 min')
  })

  it('horas: valores de 1h hasta 23h59', () => {
    expect(formatFictionalDuration(120)).toBe('2 h')
    expect(formatFictionalDuration(90)).toBe('1.5 h')
  })

  it('días: 1440+ minutos, como el ejemplo de la usuaria ("2 dias en Helek")', () => {
    expect(formatFictionalDuration(2880)).toBe('2 días')
    expect(formatFictionalDuration(4320)).toBe('3 días')
  })
})
