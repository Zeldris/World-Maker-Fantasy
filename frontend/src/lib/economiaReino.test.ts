import { describe, it, expect } from 'vitest'
import { avisosDeEconomia, textoAlmacen, textoComidaDia } from './economiaReino'

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
  it('equipo roto (CR-58)', () => {
    expect(avisosDeEconomia({ ...base, sinHerramienta: 1, sinArma: 3 })).toEqual([
      '1 trabajador sin herramienta: producen la mitad.',
      '3 soldados, vigías o cazadores sin arma (marcados en Súbditos): en la defensa cuentan la mitad y un cazador sin arma no sale de caza.',
    ])
  })
})

describe('P275/P279 — Almacén con los tres topes y comida al día', () => {
  it('el Almacén enseña el tope de comida y de agua, no solo el de materiales', () => {
    expect(textoAlmacen({ ...base, topeComida: 180, topeBebida: 60, materiales: 30, topeMateriales: 60, comida: 100, bebida: 20 })).toBe('comida 100/180 · agua 20/60 · materiales 30/60')
    expect(textoAlmacen({ ...base, topeComida: 180 })).toBe('comida 180 · agua 60 · materiales 0/60')
    // P210: con el almacén de comida vacío sigue saliendo el tope (0/180), no «0»
    expect(textoAlmacen({ ...base, topeComida: 180, comida: 0 })).toBe('comida 0/180 · agua 60 · materiales 0/60')
  })
  it('comida al día como agua al día; sin datos del servidor, nada', () => {
    expect(textoComidaDia({ ...base, comidaProduccionDia: 4, comidaConsumoDia: 2 })).toBe('+4 / −2')
    expect(textoComidaDia(base)).toBeNull()
  })
})
