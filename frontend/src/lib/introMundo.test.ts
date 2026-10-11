import { describe, it, expect } from 'vitest'
import { pregeneratedCharacters } from '../data/mock'

/// P53 (QA-27): la intro decía que las Llanuras están al este de Berig; en el canon están al oeste
/// (tres franjas: Llanuras al oeste y Ciénaga al este).
describe('P53 — la intro sitúa bien las Llanuras', () => {
  it('ninguna intro pone las Llanuras al este de Berig', () => {
    for (const c of pregeneratedCharacters) {
      expect(c.introWorldText ?? '').not.toMatch(/Llanuras del Viento Rojo, al este/)
    }
    expect(pregeneratedCharacters.find((c) => c.name === 'Gorhorn')?.introWorldText).toContain('al oeste del continente de Berig')
  })
})
