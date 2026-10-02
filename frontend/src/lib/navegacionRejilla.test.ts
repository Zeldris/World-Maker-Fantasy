import { describe, it, expect } from 'vitest'
import { siguienteCelda, type Caja } from './navegacionRejilla'

// Rejilla 3×2 de celdas 10×10 con 5 de separación, más una sexta celda suelta abajo a la derecha.
const c = (col: number, fila: number): Caja => ({ x: col * 15, y: fila * 15, w: 10, h: 10 })
const rejilla = [c(0, 0), c(1, 0), c(2, 0), c(0, 1), c(1, 1), c(2, 2)]

/// BAS-3 (hito 0.2) — navegación espacial con flechas.
describe('BAS-3 — siguienteCelda', () => {
  it('izquierda/derecha en la fila, sin dar la vuelta', () => {
    expect(siguienteCelda(1, rejilla, 'ArrowLeft')).toBe(0)
    expect(siguienteCelda(0, rejilla, 'ArrowLeft')).toBe(0)
    expect(siguienteCelda(1, rejilla, 'ArrowRight')).toBe(2)
    expect(siguienteCelda(2, rejilla, 'ArrowRight')).toBe(2)
  })

  it('arriba/abajo prefiere la de debajo a una en diagonal', () => {
    expect(siguienteCelda(0, rejilla, 'ArrowDown')).toBe(3)
    expect(siguienteCelda(4, rejilla, 'ArrowUp')).toBe(1)
    expect(siguienteCelda(2, rejilla, 'ArrowDown')).toBe(5)
    expect(siguienteCelda(5, rejilla, 'ArrowDown')).toBe(5)
  })

  it('Inicio y Fin', () => {
    expect(siguienteCelda(4, rejilla, 'Home')).toBe(0)
    expect(siguienteCelda(0, rejilla, 'End')).toBe(5)
  })
})
