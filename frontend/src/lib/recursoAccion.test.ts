import { describe, it, expect } from 'vitest'
import { etiquetaAccionRecurso } from './recursoAccion'
import type { MetodoObtencion } from '../types'

describe('etiquetaAccionRecurso', () => {
  it.each<[MetodoObtencion, string]>([
    ['TALA', 'Talar'],
    ['MINERIA', 'Minar'],
    ['EXTRACCION', 'Recolectar'],
    ['PESCA', 'Pescar'],
    ['BUSQUEDA', 'Buscar'],
    ['PASIVO', 'Recoger'],
    ['CAZA', 'Desollar'],
  ])('%s -> %s', (metodo, etiqueta) => {
    expect(etiquetaAccionRecurso(metodo)).toBe(etiqueta)
  })

  it('null, undefined o un valor desconocido -> "Recolectar"', () => {
    expect(etiquetaAccionRecurso(null)).toBe('Recolectar')
    expect(etiquetaAccionRecurso(undefined)).toBe('Recolectar')
    expect(etiquetaAccionRecurso('NUEVO_METODO' as MetodoObtencion)).toBe('Recolectar')
  })
})
