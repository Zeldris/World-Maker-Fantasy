import { describe, it, expect } from 'vitest'
import { aQuienSeDirige } from './destinatario'

describe('P141 — aQuienSeDirige', () => {
  it('un NPC sin descubrir, con artículo y en minúscula', () => {
    expect(aQuienSeDirige('Orco desconocido')).toBe('al orco desconocido')
    expect(aQuienSeDirige('Orca desconocida')).toBe('a la orca desconocida')
    expect(aQuienSeDirige('Alguien')).toBe('a alguien')
  })
  it('un nombre propio, tal cual', () => {
    expect(aQuienSeDirige('Gistera Koh')).toBe('a Gistera Koh')
  })
})
