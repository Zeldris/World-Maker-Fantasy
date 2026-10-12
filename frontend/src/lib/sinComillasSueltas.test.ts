import { describe, it, expect } from 'vitest'
import { sinComillasSueltas } from './sinComillasSueltas'

/// P14 (QA-27) y G27: sin comillas sueltas alrededor de los nombres en las acciones del diario.
describe('P14 — sinComillasSueltas', () => {
  it('quita las comillas que envuelven un nombre o una acción entera', () => {
    expect(sinComillasSueltas("Salgo a cazar y ataco a 'Guchapo'.")).toBe('Salgo a cazar y ataco a Guchapo.')
    expect(sinComillasSueltas("Ataque Básico, contra 'Guchapo #1'.")).toBe('Ataque Básico, contra Guchapo #1.')
    expect(sinComillasSueltas("Salgo a cazar y ataco a 'Zense', 'Guchapo'.")).toBe('Salgo a cazar y ataco a Zense, Guchapo.')
    expect(sinComillasSueltas("'Trenzo un par de cuerdas con la fibra que llevo encima.'")).toBe('Trenzo un par de cuerdas con la fibra que llevo encima.')
  })

  it('deja los apóstrofos de los nombres', () => {
    expect(sinComillasSueltas("Comparto el Vash'grath con la manada.")).toBe("Comparto el Vash'grath con la manada.")
    expect(sinComillasSueltas("La Terk'ikar habla.")).toBe("La Terk'ikar habla.")
  })
})
