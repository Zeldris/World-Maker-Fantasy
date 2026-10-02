import { describe, it, expect } from 'vitest'
import { agruparAlmacen, proporcionTope } from './almacen'

/// REI-40/REI-41 (hito 0.1) — Almacén agrupado por recurso y barra de tope.
const item = (id: string, name: string, catalogSlug: string | null) => ({ id, name, description: '', catalogSlug })

describe('agruparAlmacen', () => {
  it('agrupa por catalogSlug (o por nombre sin él) y ordena por cantidad', () => {
    const grupos = agruparAlmacen([
      item('1', 'Madera', 'madera'),
      item('2', 'Cuerda vieja', null),
      item('3', 'Madera', 'madera'),
      item('4', 'Madera', 'madera'),
      item('5', 'Cuerda vieja', null),
      item('6', 'Ración de carne', 'racion-carne'),
    ])
    expect(grupos.map((g) => [g.nombre, g.unidades.length])).toEqual([
      ['Madera', 3],
      ['Cuerda vieja', 2],
      ['Ración de carne', 1],
    ])
    expect(grupos[1].catalogSlug).toBeNull()
  })
})

describe('proporcionTope', () => {
  it('sin tope no hay barra; con tope se acota a 1', () => {
    expect(proporcionTope(5, null)).toBeNull()
    expect(proporcionTope(5, 10)).toBe(0.5)
    expect(proporcionTope(30, 10)).toBe(1)
  })
})
