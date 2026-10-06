import { describe, it, expect } from 'vitest'
import { avisosDeEconomia } from './economiaReino'

const base = { aguaDia: 12, bocas: 5, topeComida: 60, topeBebida: 60, topeMateriales: 60, materiales: 0, sueldosSemana: 10, tesoro: 20, bolsa: 0, diasSinCobrar: 0, diasSed: 0, diasHambre: 0 }

describe('avisos de la economía del Reino (CR-53)', () => {
  it('sin problemas, sin avisos', () => {
    expect(avisosDeEconomia(base)).toEqual([])
  })
  it('sed, hambre, sueldos sin pagar y poca agua', () => {
    expect(avisosDeEconomia({ ...base, aguaDia: 0, diasSed: 1, diasHambre: 2, diasSinCobrar: 3 })).toEqual([
      'Un día sin agua: a los 2 la sed empieza a matar.',
      '2 días sin comida: a los 3 el hambre empieza a matar.',
      '3 días sin pagar los sueldos: a los 7 empiezan a desertar.',
      'Entra menos agua de la que se bebe: construye un Pozo.',
    ])
  })
})
