import { describe, it, expect } from 'vitest'
import { anguloSalida, rumboSalida, etiquetaSalida, duracionDeCamino } from './rumboSalida'

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

describe('duracionDeCamino (P115)', () => {
  it('dice el tiempo en palabras', () => {
    expect(duracionDeCamino(40)).toBe('unos 40 minutos de camino')
    expect(duracionDeCamino(60)).toBe('una hora de camino')
    expect(duracionDeCamino(90)).toBe('una hora y media de camino')
    expect(duracionDeCamino(150)).toBe('unas 2 horas y media de camino')
    expect(duracionDeCamino(1440)).toBe('un día de camino')
    expect(duracionDeCamino(4320)).toBe('unos 3 días de camino')
  })

  // P170 (QA-27): 1 h 40 y 1 h 20 salían las dos como «una hora y media».
  it('redondea a los 10 minutos', () => {
    expect(duracionDeCamino(100)).toBe('una hora y 40 minutos de camino')
    expect(duracionDeCamino(80)).toBe('una hora y 20 minutos de camino')
    expect(duracionDeCamino(124)).toBe('unas 2 horas de camino')
    // code-review: el redondeo no puede dejar «60 minutos» ni «24 horas».
    expect(duracionDeCamino(58)).toBe('una hora de camino')
    expect(duracionDeCamino(1436)).toBe('un día de camino')
  })
})
