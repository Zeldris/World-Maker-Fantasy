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

  // /code-review del 2026-10-14: junto al borde de abajo, al subir por encima de otra ficha caía
  // encima de la suya propia (la de su ficha solo se perdona en su sitio).
  it('apartada, la etiqueta de una ficha no cae sobre su propia ficha', () => {
    const propia = { clave: 'f:p:1', x: 100, y: 540, ancho: 30, alto: 30, fija: true }
    const vecina = { clave: 'f:p:2', x: 100, y: 572, ancho: 30, alto: 28, fija: true }
    const etiqueta = { clave: 'p:1', x: 95, y: 572, ancho: 40, alto: 18 }
    const dy = separarEtiquetas([propia, vecina, etiqueta], 600)
    const y = etiqueta.y + (dy.get('p:1') ?? 0)
    const pisa = (c: { y: number; alto: number }) => y < c.y + c.alto && c.y < y + etiqueta.alto
    expect(dy.has('p:1')).toBe(true)
    expect(pisa(propia)).toBe(false)
    expect(pisa(vecina)).toBe(false)
  })

  // P151 (QA-27): la etiqueta de una salida bajaba ficha tras ficha hasta ~100 px de su flecha.
  it('no se aparta más de tres alturas de etiqueta; si no cabe, se queda en su sitio', () => {
    const columna = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ clave: `f:p:${i}`, x: 0, y: 100 + i * 20, ancho: 100, alto: 20, fija: true }))
    const dy = separarEtiquetas([...columna, { clave: 's:lejos', x: 10, y: 170, ancho: 50, alto: 18 }], 600)
    expect(dy.has('s:lejos')).toBe(false)
  })

  it('con hueco cerca, se aparta lo justo', () => {
    const dy = separarEtiquetas(
      [
        { clave: 'f:p:1', x: 0, y: 100, ancho: 100, alto: 20, fija: true },
        { clave: 's:cerca', x: 10, y: 105, ancho: 50, alto: 18 },
      ],
      600,
    )
    expect(dy.get('s:cerca')).toBe(17)
  })
})
