import { describe, expect, it } from 'vitest'
import { conPuntoFinal } from './conPuntoFinal'

describe('conPuntoFinal (P68, QA-27)', () => {
  it('cierra con punto una frase que no lo lleva', () => {
    expect(conPuntoFinal('Se dice que es de los pocos sitios de la región donde el agua nunca falta')).toBe(
      'Se dice que es de los pocos sitios de la región donde el agua nunca falta.',
    )
  })

  it('tras unas comillas de cierre, el punto va fuera', () => {
    expect(conPuntoFinal('Los pastores lo llaman «el pozo que canta»')).toBe('Los pastores lo llaman «el pozo que canta».')
  })

  it('deja como está una frase ya cerrada', () => {
    expect(conPuntoFinal('Ya has estado aquí.')).toBe('Ya has estado aquí.')
    expect(conPuntoFinal('¿Quién sabe?')).toBe('¿Quién sabe?')
    expect(conPuntoFinal('dicen «¿nunca?»')).toBe('dicen «¿nunca?»')
  })
})
