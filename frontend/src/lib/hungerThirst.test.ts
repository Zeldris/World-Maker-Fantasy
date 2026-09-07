import { describe, it, expect } from 'vitest'
import { applySequentialHunger, applySequentialThirst } from './hungerThirst'

describe('applySequentialHunger (vista previa del modal "Comer/Beber")', () => {
  it('sin ganancia, se queda igual', () => {
    expect(applySequentialHunger(40, 0)).toBe(40)
  })

  it('suma la ganancia sin pasar de 100', () => {
    expect(applySequentialHunger(40, 30)).toBe(70)
    expect(applySequentialHunger(90, 30)).toBe(100)
  })

  it('ganancia negativa se ignora, nunca empeora', () => {
    expect(applySequentialHunger(40, -20)).toBe(40)
  })
})

// Hallazgo 13 (revisar-partida-hallazgos.md 2026-09-06) — Sed ya no es un booleano fijo "Beber
// agua", sube por ganancia acumulada de ítems reales (curaAgua), mismo criterio que Hambre.
describe('applySequentialThirst (vista previa del modal "Comer/Beber")', () => {
  it('sin ganancia, se queda igual', () => {
    expect(applySequentialThirst(30, 0)).toBe(30)
  })

  it('suma la ganancia sin pasar de 100 — el odre lleno (curaAgua: 100) repone de un tirón', () => {
    expect(applySequentialThirst(30, 20)).toBe(50)
    expect(applySequentialThirst(30, 100)).toBe(100)
  })

  it('ganancia negativa se ignora, nunca empeora', () => {
    expect(applySequentialThirst(30, -20)).toBe(30)
  })
})
