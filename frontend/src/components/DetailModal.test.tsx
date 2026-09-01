import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { DetailModal } from './DetailModal'
import type { SavedActionInfo } from '../types'

/// Bug real (2026-09-01, checklist "Bonus de atributo por habilidad"): este modal —el camino más
/// visible al pulsar el botón ⓘ de una habilidad, verificado jugando en vivo— mostraba
/// `ability.description` a secas, sin el sufijo "(+N de bono fijo al usarla)" que sí llevan los
/// `title` nativos de AbilityGrid/CombatAbilityBelt (abilityBonusSuffix.ts). El bono en sí SIEMPRE
/// se aplicó en combate; solo faltaba mostrarse aquí.
describe('DetailModal — kind: ability, bono de atributo', () => {
  function ability(overrides: Partial<SavedActionInfo> = {}): SavedActionInfo {
    return {
      id: 'a1',
      name: 'Tajo Horizontal',
      promptText: 'Lanzo un tajo amplio...',
      icon: '🪓',
      description: 'Un tajo amplio, en horizontal, buscando cortar con todo el filo del hacha a la vez.',
      isStarting: true,
      isDynamic: true,
      category: 'combate',
      preferredAttribute: 'fuerza',
      energyCost: 5,
      energyRegen: 0,
      isGeneric: false,
      dualWield: false,
      rol: 'ataque',
      ...overrides,
    }
  }

  it('muestra el sufijo "(+N de bono fijo al usarla)" cuando la habilidad tiene attributeBonus', () => {
    const { container } = render(<DetailModal target={{ kind: 'ability', ability: ability({ attributeBonus: 2 }) }} onClose={() => {}} />)
    expect(container.textContent).toMatch(/\+2 de bono fijo al usarla/)
  })

  it('no añade ningún sufijo cuando attributeBonus es 0/null/undefined', () => {
    const { container } = render(<DetailModal target={{ kind: 'ability', ability: ability({ attributeBonus: 0 }) }} onClose={() => {}} />)
    expect(container.textContent).not.toMatch(/bono fijo/)
  })
})
