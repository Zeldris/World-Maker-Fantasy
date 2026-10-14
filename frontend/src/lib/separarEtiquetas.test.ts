import { describe, it, expect } from 'vitest'
import { separarEtiquetas } from './separarEtiquetas'

describe('separarEtiquetas (P92)', () => {
  it('no mueve las que no se tocan', () => {
    const dy = separarEtiquetas(
      [
        { clave: 'a', x: 0, y: 0, ancho: 50, alto: 18 },
        { clave: 'b', x: 200, y: 0, ancho: 50, alto: 18 },
      ],
      600,
    )
    expect(dy.size).toBe(0)
  })

  it('tres etiquetas en la misma esquina acaban apiladas sin pisarse; la primera no se mueve', () => {
    const cajas = [
      { clave: 'salida-1', x: 30, y: 30, ancho: 80, alto: 18 },
      { clave: 'salida-2', x: 40, y: 36, ancho: 120, alto: 18 },
      { clave: 'ficha', x: 20, y: 40, ancho: 60, alto: 18 },
    ]
    const dy = separarEtiquetas(cajas, 600)
    expect(dy.has('salida-1')).toBe(false)
    const ys = cajas.map((c) => c.y + (dy.get(c.clave) ?? 0)).sort((a, b) => a - b)
    expect(ys[1]! - ys[0]!).toBeGreaterThanOrEqual(18)
    expect(ys[2]! - ys[1]!).toBeGreaterThanOrEqual(18)
  })

  it('junto al borde de abajo sube en vez de salirse del lienzo', () => {
    const dy = separarEtiquetas(
      [
        { clave: 'a', x: 0, y: 580, ancho: 50, alto: 18 },
        { clave: 'b', x: 10, y: 582, ancho: 50, alto: 18 },
      ],
      600,
    )
    expect(dy.get('b')!).toBeLessThan(0)
  })

  // P123 (QA-27): la etiqueta de una salida caía encima de una ficha de fauna y de su «×5».
  it('una ficha es un obstáculo fijo: la etiqueta que la tapa se aparta, la ficha no se mueve', () => {
    const dy = separarEtiquetas(
      [
        { clave: 'f:p:1', x: 100, y: 100, ancho: 54, alto: 34, fija: true },
        { clave: 's:salida', x: 90, y: 110, ancho: 120, alto: 18 },
      ],
      600,
    )
    expect(dy.has('f:p:1')).toBe(false)
    expect(110 + (dy.get('s:salida') ?? 0)).toBeGreaterThanOrEqual(134)
  })

  it('la etiqueta de una ficha no se aparta de su propia ficha', () => {
    const dy = separarEtiquetas(
      [
        { clave: 'f:p:1', x: 100, y: 100, ancho: 54, alto: 34, fija: true },
        { clave: 'p:1', x: 100, y: 120, ancho: 60, alto: 18 },
      ],
      600,
    )
    expect(dy.has('p:1')).toBe(false)
  })
})
