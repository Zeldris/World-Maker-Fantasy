import { describe, it, expect } from 'vitest'
import { notaDeHito, ACCIONES_POR_CAPITULO } from './hitos'

describe('notaDeHito', () => {
  it('el cierre de capítulo explica que llega cada 15 acciones', () => {
    expect(ACCIONES_POR_CAPITULO).toBe(15)
    expect(notaDeHito('Capítulo completado')).toContain('Cada 15 acciones')
  })
  it('otros hitos no llevan nota', () => {
    expect(notaDeHito('Descubrimiento')).toBeNull()
    expect(notaDeHito(null)).toBeNull()
    expect(notaDeHito(undefined)).toBeNull()
  })
})
