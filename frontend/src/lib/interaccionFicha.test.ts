import { describe, it, expect } from 'vitest'
import { npcToDetailTarget } from './enciclopediaTargets'

/// P36 (QA-27): la ficha de un NPC dice qué se puede hacer con él como se diría en el mundo.
describe('P36 — interacción en la ficha de un NPC', () => {
  it('sin jerga de reglas', () => {
    const t = npcToDetailTarget({
      slug: 'hagar-kiugh', name: 'Hagar Kiugh', role: 'Herrero', faction: 'Clan Helsig', bio: 'x', aliases: [],
      interaccion: { comerciablePct: 0, reclutablePct: 20, domesticablePct: 0, capturablePct: 0, cortejablePct: 20, atributoResistencia: 'carisma' },
    } as never)
    expect(t.kind === 'info' && t.extra).toBe('Se puede reclutar (20 %) o cortejar (20 %); se resiste con su Carisma.')
  })
})
