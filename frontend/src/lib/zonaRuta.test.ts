import { describe, it, expect } from 'vitest'
import { calcularCamino, celdaDePixel, horaDeLlegada, pixelDeCelda, rutaPrevista, textoCoste } from './zonaRuta'

/// ZON-31/32/86 (hito 0.2) — ruta prevista en el cliente, espejo del motor: mismos casos que
/// `backend/src/services/zonaPosicion.test.ts` (calcularCamino).
describe('zonaRuta', () => {
  it('camino horizontal, vertical y diagonal: un paso por celda, sin saltos', () => {
    expect(calcularCamino({ col: 0, row: 0 }, { col: 3, row: 0 })).toEqual([{ col: 1, row: 0 }, { col: 2, row: 0 }, { col: 3, row: 0 }])
    expect(calcularCamino({ col: 0, row: 0 }, { col: 0, row: 3 })).toEqual([{ col: 0, row: 1 }, { col: 0, row: 2 }, { col: 0, row: 3 }])
    expect(calcularCamino({ col: 0, row: 0 }, { col: 3, row: 3 })).toEqual([{ col: 1, row: 1 }, { col: 2, row: 2 }, { col: 3, row: 3 }])
    expect(calcularCamino({ col: 5, row: 5 }, { col: 5, row: 5 })).toEqual([])
  })

  it('ningún paso avanza más de 1 celda por eje (invariante Bresenham)', () => {
    const origen = { col: 2, row: 1 }
    const destino = { col: 14, row: 9 }
    const camino = calcularCamino(origen, destino)
    let anterior = origen
    for (const paso of camino) {
      expect(Math.abs(paso.col - anterior.col)).toBeLessThanOrEqual(1)
      expect(Math.abs(paso.row - anterior.row)).toBeLessThanOrEqual(1)
      anterior = paso
    }
    expect(camino[camino.length - 1]).toEqual(destino)
  })

  it('celdas y píxeles: centro de celda y límites del lienzo', () => {
    expect(celdaDePixel({ x: 799, y: 0 })).toEqual({ col: 15, row: 0 })
    expect(celdaDePixel({ x: 900, y: -5 })).toEqual({ col: 15, row: 0 })
    expect(pixelDeCelda({ col: 2, row: 3 })).toEqual({ x: 125, y: 175 })
  })

  it('coste: pasos, minutos, hora de llegada y energía recuperada', () => {
    const r = rutaPrevista({ x: 25, y: 25 }, { x: 425, y: 25 }, 7 * 60 + 55)
    expect(r.pasos).toBe(8)
    expect(textoCoste(r)).toBe('8 pasos · 8 min · llegas a las 08:03 · +1 energía')
    expect(horaDeLlegada(1439, 1441)).toBe('Día 2, 00:01')
    expect(textoCoste(rutaPrevista({ x: 25, y: 25 }, { x: 75, y: 25 }))).toBe('1 paso · 1 min')
  })
})
