import { describe, it, expect } from 'vitest'
import { apilarObjetos, itemIcon } from './enciclopediaTargets'

/// P18 (QA-27): iconos que dicen qué es el objeto y pilas con su número.
describe('P18 — iconos del inventario', () => {
  it('el nombre manda sobre la categoría cuando lo dice claro', () => {
    expect(itemIcon('cosmetico', 'Tótem Maktor')).toBe('🗿')
    expect(itemIcon('ropa', 'Pantalones de cuero')).toBe('👖')
    expect(itemIcon('medicinal', 'Cataplasma de raíz')).toBe('🩹')
    expect(itemIcon('arma', 'Hacha de sílice')).toBe('🪓')
    expect(itemIcon('arma', 'Cuchillo de hueso')).toBe('🔪')
  })

  it('sin nombre reconocible, la categoría de siempre', () => {
    expect(itemIcon('ropa', 'Arnés de cuero')).toBe('👕')
    expect(itemIcon('categoria-rara')).toBe('📦')
  })
})

describe('P18 — pilas del inventario', () => {
  const obj = (id: string, name: string, slot: string | null = null) => ({ id, name, category: 'consumible', tipo: 'CONSUMIBLE', slot })

  it('apila las iguales no equipadas y deja aparte las equipadas', () => {
    const pilas = apilarObjetos([obj('1', 'Ración'), obj('2', 'Hacha', 'manoDerecha'), obj('3', 'Ración'), obj('4', 'Hacha'), obj('5', 'Ración')])
    expect(pilas.map((p) => [p.item.id, p.cantidad])).toEqual([
      ['1', 3],
      ['2', 1],
      ['4', 1],
    ])
  })
})
