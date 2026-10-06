import { describe, it, expect } from 'vitest'
import { etiquetaDeAprobacion } from './aprobacion'

describe('etiquetaDeAprobacion (CR-15)', () => {
  it('mismos cortes que el backend', () => {
    expect([0, 19, 20, 39, 40, 59, 60, 79, 80, 100].map(etiquetaDeAprobacion)).toEqual([
      'Hostil', 'Hostil', 'Distante', 'Distante', 'Neutral', 'Neutral', 'Afín', 'Afín', 'Leal', 'Leal',
    ])
  })
})
