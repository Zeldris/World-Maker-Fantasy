import { describe, it, expect } from 'vitest'
import { professionSpan, MAX_PROFESSION_LEVEL, PROFESSION_LEVEL_THRESHOLDS } from './professionLevels'

// Cobertura nueva (auditoría de deuda técnica, 2026-08-21) — mismo criterio que progression.test.ts:
// esta tabla es el espejo visual de backend/src/services/professionProgress.ts, usada para pintar
// la barra de nivel de oficio en HabilidadesPanel.tsx. Un error aquí no rompe el nivel real (el
// backend sigue siendo la fuente de verdad), pero sí pinta una barra mentirosa sin que ningún test
// lo detectara hasta ahora.
describe('professionSpan', () => {
  it('nivel 1 arranca en 0 del tramo (base implícita 0)', () => {
    const { current, span } = professionSpan(1, 20)
    expect(current).toBe(20) // 20 - PROFESSION_LEVEL_THRESHOLDS[0]=0
    expect(span).toBe(PROFESSION_LEVEL_THRESHOLDS[1] - PROFESSION_LEVEL_THRESHOLDS[0])
  })

  it('un nivel intermedio da el progreso dentro de su propio tramo', () => {
    const { current, span } = professionSpan(2, 100)
    expect(current).toBe(100 - PROFESSION_LEVEL_THRESHOLDS[1])
    expect(span).toBe(PROFESSION_LEVEL_THRESHOLDS[2] - PROFESSION_LEVEL_THRESHOLDS[1])
  })

  it('en el nivel máximo, span cae a la XP total en vez de un tramo (evita división por 0 al pintar)', () => {
    const { current, span } = professionSpan(MAX_PROFESSION_LEVEL, 900)
    expect(current).toBe(900)
    expect(span).toBe(900)
  })

  it('en el nivel máximo con 0 XP, span usa 1 en vez de 0 (mismo motivo, evita división por 0)', () => {
    const { current, span } = professionSpan(MAX_PROFESSION_LEVEL, 0)
    expect(current).toBe(0)
    expect(span).toBe(1)
  })
})
