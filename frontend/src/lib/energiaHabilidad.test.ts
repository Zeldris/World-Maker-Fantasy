import { describe, expect, it } from 'vitest'
import { textoEnergiaHabilidad } from './energiaHabilidad'

describe('textoEnergiaHabilidad (P101, QA-27)', () => {
  it('dice lo que cuesta y lo que recupera', () => {
    expect(textoEnergiaHabilidad(10, 0)).toBe('⚡ Cuesta 10 de energía.')
    expect(textoEnergiaHabilidad(0, 5)).toBe('⚡ No cuesta energía y recupera 5.')
    expect(textoEnergiaHabilidad(5, 2)).toBe('⚡ Cuesta 5 de energía y recupera 2.')
  })
})
