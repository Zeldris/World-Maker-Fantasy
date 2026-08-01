import { describe, it, expect } from 'vitest'
import { combatDifficultyFor } from './combatDifficulty'

// Cobertura nueva (deuda técnica 2026-07-30): los 3 tramos centrales son un espejo EXACTO de
// `difficultyHintFor` (backend/src/services/npcScene.ts) — mismo criterio de diferencia de nivel
// que decide la dificultad real de la tirada. Un desajuste aquí mentiría sobre lo duro que va a
// ser el combate real, sin que nada lo detectara hasta ahora.
describe('combatDifficultyFor', () => {
  it('límites exactos de cada tramo (mismos cortes que difficultyHintFor en el backend: -2, 1, 4)', () => {
    expect(combatDifficultyFor(-6)).toEqual({ label: 'Trivial', colorClass: 'text-wood-500' })
    expect(combatDifficultyFor(-5)).toEqual({ label: 'Trivial', colorClass: 'text-wood-500' })
    expect(combatDifficultyFor(-4)).toEqual({ label: 'Fácil', colorClass: 'text-emerald-400' })
    expect(combatDifficultyFor(-2)).toEqual({ label: 'Fácil', colorClass: 'text-emerald-400' })
    expect(combatDifficultyFor(-1)).toEqual({ label: 'Media', colorClass: 'text-yellow-400' })
    expect(combatDifficultyFor(1)).toEqual({ label: 'Media', colorClass: 'text-yellow-400' })
    expect(combatDifficultyFor(2)).toEqual({ label: 'Difícil', colorClass: 'text-orange-400' })
    expect(combatDifficultyFor(4)).toEqual({ label: 'Difícil', colorClass: 'text-orange-400' })
    expect(combatDifficultyFor(5)).toEqual({ label: 'Muy difícil', colorClass: 'text-red-400' })
  })
})
