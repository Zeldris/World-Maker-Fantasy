import { describe, it, expect } from 'vitest'
import { xpForLevel, xpProgress, MAX_LEVEL } from './progression'

// Cobertura nueva (deuda técnica 2026-07-30, "el frontend no tenía ningún test runner"): esta
// tabla es el espejo visual de backend/src/services/progression.ts — un error aquí no rompe la
// progresión real (el backend sigue siendo la fuente de verdad), pero sí pinta una barra de XP
// mentirosa sin que ningún test lo detectara hasta ahora.
describe('xpForLevel', () => {
  it('nivel 1 siempre empieza en 0 XP', () => {
    expect(xpForLevel(1)).toBe(0)
  })

  it('crece con el nivel', () => {
    expect(xpForLevel(2)).toBeGreaterThan(xpForLevel(1))
    expect(xpForLevel(MAX_LEVEL)).toBeGreaterThan(xpForLevel(MAX_LEVEL - 1))
  })

  it('nunca se sale de la tabla, aunque se pida un nivel por encima del máximo', () => {
    expect(xpForLevel(MAX_LEVEL + 5)).toBe(xpForLevel(MAX_LEVEL))
  })
})

describe('xpProgress', () => {
  it('un nivel intermedio da el progreso dentro de su propio tramo', () => {
    const { current, span, next } = xpProgress(1, 150)
    expect(current).toBe(150) // 150 - xpForLevel(1)=0
    expect(span).toBe(xpForLevel(2) - xpForLevel(1))
    expect(next).toBe(xpForLevel(2))
  })

  it('en el nivel máximo, span y next reflejan que no hay siguiente tramo', () => {
    const { span, next } = xpProgress(MAX_LEVEL, xpForLevel(MAX_LEVEL) + 500)
    expect(span).toBe(0)
    expect(next).toBeNull()
  })
})
