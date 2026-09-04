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

describe('applySequentialThirst (vista previa del modal "Comer/Beber")', () => {
  it('sin "Beber agua", se queda igual', () => {
    expect(applySequentialThirst(30, false)).toBe(30)
  })

  it('con "Beber agua", repone al 100% de un tirón', () => {
    expect(applySequentialThirst(30, true)).toBe(100)
  })
})
