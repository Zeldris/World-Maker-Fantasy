import { describe, expect, it } from 'vitest'
import { nombreDeEdificio, nombreDeSlug } from './edificios'

describe('nombreDeEdificio (P212)', () => {
  it('quita el artículo de la narración y pone mayúscula', () => {
    expect(nombreDeEdificio('un pequeño ayuntamiento')).toBe('Pequeño ayuntamiento')
    expect(nombreDeEdificio('una herrería orca de las Llanuras')).toBe('Herrería orca de las Llanuras')
    expect(nombreDeEdificio('unos corrales del Ganadero')).toBe('Corrales del Ganadero')
  })
  it('deja como están los nombres que ya van limpios', () => {
    expect(nombreDeEdificio('Tótem del Clan Maktor')).toBe('Tótem del Clan Maktor')
    expect(nombreDeEdificio('Un Pozo')).toBe('Pozo')
  })
})

describe('nombreDeSlug (P213)', () => {
  it('convierte el slug en texto legible', () => {
    expect(nombreDeSlug('totem-clan-maktor')).toBe('Totem clan maktor')
  })
})
