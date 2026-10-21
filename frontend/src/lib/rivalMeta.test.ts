import { describe, expect, it } from 'vitest'
import { metaDeRival } from './rivalMeta'

describe('metaDeRival (P303)', () => {
  it('no repite la facción que el cargo ya nombra', () => {
    expect(metaDeRival({ role: "Terk'ikar del Clan Serhu", faction: 'Clan Serhu', level: 24 })).toBe("Terk'ikar del Clan Serhu · nivel 24")
  })
  it('añade la facción si el cargo no la nombra', () => {
    expect(metaDeRival({ role: 'Herrero', faction: 'Clan Serhu', level: 3 })).toBe('Herrero — Clan Serhu · nivel 3')
    expect(metaDeRival({ role: 'Cazador', level: 2 })).toBe('Cazador · nivel 2')
  })
})
