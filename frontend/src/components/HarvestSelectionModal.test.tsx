import { describe, expect, it } from 'vitest'
import { seleccionInicialAlMaximo } from './HarvestSelectionModal'

const y = (itemSlug: string, cantidadMaxima: number, disponible: number) => ({ sourceSlug: 'jabali', itemSlug, itemName: itemSlug, cantidadMaxima, disponible })

describe('seleccionInicialAlMaximo (P15)', () => {
  it('cada fila sale al máximo que queda', () => {
    const sel = seleccionInicialAlMaximo([{ sourceCategoryName: 'Fauna', yields: [y('piel', 2, 5), y('carne', 3, 1)] }], 20)
    expect(sel).toEqual({ 'jabali:piel': 2, 'jabali:carne': 1 })
  })

  it('no pasa del hueco libre del inventario, repartido en el orden de la lista', () => {
    const sel = seleccionInicialAlMaximo([{ sourceCategoryName: 'Fauna', yields: [y('piel', 2, 5), y('carne', 3, 3), y('hueso', 2, 2)] }], 4)
    expect(sel).toEqual({ 'jabali:piel': 2, 'jabali:carne': 2 })
  })

  it('sin hueco no selecciona nada', () => {
    expect(seleccionInicialAlMaximo([{ sourceCategoryName: 'Fauna', yields: [y('piel', 2, 5)] }], 0)).toEqual({})
  })
})
