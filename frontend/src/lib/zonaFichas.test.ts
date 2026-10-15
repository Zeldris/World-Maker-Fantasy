import { describe, it, expect } from 'vitest'
import { disposicionDe } from './zonaFichas'

/// P176 (QA-27): un edificio del Clan Serhu salía solo con «Neutro».
describe('disposicionDe', () => {
  it('con bando dueño, lo pone delante', () => {
    expect(disposicionDe({ color: 'NEUTRO', faccion: 'Clan Serhu' })).toBe('Clan Serhu · Neutro')
  })
  it('sin bando, solo la disposición', () => {
    expect(disposicionDe({ color: 'INERTE' })).toBe('Salvaje')
  })
})
