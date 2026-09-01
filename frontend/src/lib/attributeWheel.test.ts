import { describe, it, expect } from 'vitest'
import { recommendedAttributeAgainst } from './attributeWheel'
import type { Attribute } from '../types'

// Cobertura nueva (auditoría de deuda técnica, 2026-08-21) — puerto a mano de
// backend/src/services/attributeWheel.ts (ver comentario de cabecera del propio archivo), usado
// por "Analizar rival" en combate. Sin test hasta ahora pese a ser lógica de combate real, y con
// antecedente de bug real de dirección de flecha en el mismo anillo (ver AttributeAdvantageDiagram
// en EnciclopediaPanel.tsx, 2026-08-20) — un fallo de dirección aquí recomendaría justo el
// atributo contrario al correcto sin que nada lo avisara.
const flat: Record<Attribute, number> = {
  fuerza: 10,
  destreza: 10,
  constitucion: 10,
  inteligencia: 10,
  voluntad: 10,
  carisma: 10,
  magia: 10,
}

function enemyWith(strongest: Attribute): Record<Attribute, number> {
  return { ...flat, [strongest]: 99 }
}

// Mismo anillo que ATTRIBUTE_RING (privado) — ['fuerza','destreza','inteligencia','magia',
// 'constitucion','voluntad','carisma']. El "sucesor" de cada atributo en el anillo es el que gana
// la ventaja directa (×1.5) contra él — confirmado contra el comentario del backend
// (`typeMultiplierFor('destreza', 'fuerza', 'ataque') === 1.5`).
describe('recommendedAttributeAgainst', () => {
  it('recomienda destreza contra un rival fuerte en fuerza (sucesor directo en el anillo)', () => {
    expect(recommendedAttributeAgainst(flat, enemyWith('fuerza'))).toBe('destreza')
  })

  it('recomienda inteligencia contra un rival fuerte en destreza', () => {
    expect(recommendedAttributeAgainst(flat, enemyWith('destreza'))).toBe('inteligencia')
  })

  it('recomienda fuerza contra un rival fuerte en carisma (el anillo cierra sobre sí mismo)', () => {
    expect(recommendedAttributeAgainst(flat, enemyWith('carisma'))).toBe('fuerza')
  })

  it('el valor propio del jugador no cambia la recomendación, solo el del rival', () => {
    const playerWeakInDestreza = { ...flat, destreza: 1 }
    expect(recommendedAttributeAgainst(playerWeakInDestreza, enemyWith('fuerza'))).toBe('destreza')
  })
})
