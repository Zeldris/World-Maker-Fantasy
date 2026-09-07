import { describe, it, expect } from 'vitest'
import { forcedGradosFor } from './DiceRoll'

// Bug real jugando en vivo (2026-09-07, "las dos tiradas de combate deberían ser mi tirada vs la
// suya, no contra una dificultad"): en un check OPUESTO (iniciativa, y cualquier intercambio de
// combate ya resuelto como check opuesto — `esCheckOpuesto`), cada lado siempre calcula su propio
// `success`/`gradoExito` contra `difficulty: 0` de relleno (backend, `rollInitiative`/
// `resolveExchange`), así que `result >= 0` es SIEMPRE verdadero — el color/desenlace visual de
// CADA lado por separado salía siempre "claro"/verde, ganara o no la comparación real contra el
// rival. `forcedGradosFor` decide el color por comparación directa entre ambos resultados.
describe('forcedGradosFor', () => {
  it('con showDifficulty=true (tirada normal contra dificultad real): no fuerza nada', () => {
    expect(forcedGradosFor(18, 5, true)).toEqual({ leftGrado: undefined, rightGrado: undefined })
  })

  it('con showDifficulty=false: el lado con mayor result gana (claro), el otro pierde (fallo)', () => {
    expect(forcedGradosFor(18, 5, false)).toEqual({ leftGrado: 'claro', rightGrado: 'fallo' })
    expect(forcedGradosFor(5, 18, false)).toEqual({ leftGrado: 'fallo', rightGrado: 'claro' })
  })

  it('empate exacto: gana el lado derecho (mismo criterio que "el golpe no logra superar la defensa")', () => {
    expect(forcedGradosFor(12, 12, false)).toEqual({ leftGrado: 'fallo', rightGrado: 'claro' })
  })

  it('reproduce el bug real: con difficulty=0 de relleno, ambos lados serían "claro" sin esto — aquí solo uno lo es', () => {
    // Caso real observado jugando: iniciativa 8 vs 6 — con el bug viejo (gradoOf contra
    // difficulty:0) ambos saldrían 'claro'. Con el fix, solo el ganador real.
    const { leftGrado, rightGrado } = forcedGradosFor(8, 6, false)
    expect(leftGrado).toBe('claro')
    expect(rightGrado).toBe('fallo')
    expect([leftGrado, rightGrado]).not.toEqual(['claro', 'claro'])
  })
})
