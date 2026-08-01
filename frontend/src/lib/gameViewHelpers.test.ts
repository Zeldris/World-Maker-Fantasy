import { describe, it, expect } from 'vitest'
import { formatFictionalDuration } from './gameViewHelpers'

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
