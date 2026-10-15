import { describe, it, expect } from 'vitest'
import { anchoInsignia, cajaFicha, cajaMarca } from './FichaZona'

/// P123 (QA-27) y /code-review del 2026-10-14: la caja de una ficha cubre todo lo que se dibuja.
describe('cajaFicha', () => {
  it('una ficha sola cubre la placa (rombos de radio 15)', () => {
    expect(cajaFicha('f', 100, 100, 1)).toMatchObject({ x: 85, y: 85, ancho: 30, alto: 30, fija: true })
  })

  it('con anillo (compañero o desconocida) cubre el anillo de radio 17.5', () => {
    const c = cajaFicha('f', 0, 0, 1, { anillo: true })
    expect(c.x).toBeLessThanOrEqual(-17.5)
    expect(c.y + c.alto).toBeGreaterThanOrEqual(17.5)
  })

  it('la insignia «×N» entra entera, también la de tres cifras', () => {
    const c = cajaFicha('f', 0, 0, 1, { cantidad: 120 })
    expect(c.x + c.ancho).toBeGreaterThanOrEqual(9 + anchoInsignia(120))
    expect(c.y).toBeLessThanOrEqual(-21)
  })

  it('el candado de nivel entra entero', () => {
    const c = cajaFicha('f', 0, 0, 1, { candado: true })
    expect(c.x + c.ancho).toBeGreaterThanOrEqual(22)
    expect(c.y).toBeLessThanOrEqual(-18)
  })

  it('escala con la ficha', () => {
    expect(cajaFicha('f', 0, 0, 2).ancho).toBe(60)
  })

  it('cajaMarca: un círculo de radio r', () => {
    expect(cajaMarca('m', 50, 50, 1, 12)).toMatchObject({ x: 38, y: 38, ancho: 24, alto: 24, fija: true })
  })
})
