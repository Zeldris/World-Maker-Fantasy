import { describe, it, expect } from 'vitest'
import { anguloSalida, rumboSalida, etiquetaSalida } from './rumboSalida'

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

describe('etiquetaSalida (QA-27, P7)', () => {
  it('las puertas de un interior dicen entrar o salir; el resto, nombre o rumbo', () => {
    expect(etiquetaSalida({ x: 400, y: 400, nombre: "Hogar Ketg - Ketg'lukar", visitada: false, puerta: 'ENTRAR' })).toBe("Entrar en Hogar Ketg - Ketg'lukar")
    expect(etiquetaSalida({ x: 400, y: 550, nombre: 'Colmillo Ceniza', visitada: true, puerta: 'SALIR' })).toBe('Salir a Colmillo Ceniza')
    expect(etiquetaSalida({ x: 760, y: 300, nombre: 'El Pozo', visitada: true })).toBe('El Pozo')
    expect(etiquetaSalida({ x: 760, y: 300, nombre: 'El Pozo', visitada: false })).toBe('Camino hacia el este')
  })
})
