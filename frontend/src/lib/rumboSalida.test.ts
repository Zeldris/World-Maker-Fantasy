import { describe, it, expect } from 'vitest'
import { anguloSalida, rumboSalida } from './rumboSalida'

describe('rumboSalida', () => {
  it('deduce el rumbo por octante desde el centro del lienzo', () => {
    expect(rumboSalida({ x: 780, y: 300 })).toBe('este')
    expect(rumboSalida({ x: 400, y: 20 })).toBe('norte')
    expect(rumboSalida({ x: 20, y: 580 })).toBe('suroeste')
    expect(rumboSalida({ x: 750, y: 30 })).toBe('noreste')
  })
  it('el ángulo apunta hacia fuera (0 = este, -90 = norte en SVG)', () => {
    expect(anguloSalida({ x: 780, y: 300 })).toBeCloseTo(0)
    expect(anguloSalida({ x: 400, y: 20 })).toBeCloseTo(-90)
  })
})
