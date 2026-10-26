import { describe, it, expect } from 'vitest'
import { ayudaIntensidadAsaltos } from './asaltos'

describe('P257 — ayuda de la intensidad de los asaltos', () => {
  it('cada nivel explica lo que hace, no un texto común a los tres', () => {
    const textos = (['CONTENIDA', 'NORMAL', 'DURA'] as const).map(ayudaIntensidadAsaltos)
    expect(new Set(textos).size).toBe(3)
    expect(textos[0]).toMatch(/^Contenida: .*cada 4 días/)
    expect(textos[1]).toMatch(/^Normal: .*cada 3 días/)
    expect(textos[2]).toMatch(/^Dura: .*cada 2 días/)
    for (const t of textos) expect(t).toMatch(/Nunca dejan de atacar/)
  })
  it('sin valor cargado explica Normal', () => {
    expect(ayudaIntensidadAsaltos(undefined)).toMatch(/^Normal: /)
  })
})
