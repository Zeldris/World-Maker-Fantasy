import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CombatPanel } from './CombatPanel'
import type { CombatNpcDisplay } from './CombatComposer'
import type { SavedActionInfo } from '../types'

const ataqueBasico = {
  id: 'a1', name: 'Ataque Básico', promptText: 'Ataco', icon: '⚔️', description: 'Golpe sencillo', isStarting: true,
  isDynamic: false, category: 'combate', preferredAttribute: 'fuerza', energyCost: 0, energyRegen: 0, isGeneric: true, rol: 'ataque', effects: [],
} as unknown as SavedActionInfo

function orco(targetedForKill: boolean): CombatNpcDisplay {
  return { slug: 'orco', name: 'Orco enfurecido', condicion: 'CONVALECIENTE', yaSaqueado: false, lootedItemNames: [], analizado: false, activeEffects: [], targetedForKill }
}

function panel(npcs: CombatNpcDisplay[]) {
  const noop = vi.fn()
  return (
    <CombatPanel
      playerCondicion="HERIDO" playerActiveEffects={[]} playerAttributes={{ fuerza: 10, destreza: 6, constitucion: 7, inteligencia: 7, voluntad: 8, carisma: 6, magia: 2 } as never}
      energia={70} npcs={npcs} selectedNpcSlug={null} onSelectNpc={noop} combatAbilities={[ataqueBasico]} selectedAbilityId={null}
      onSelectAbility={noop} combatItems={[]} selectedItemId={null} onSelectItem={noop} busy={false} ended={false} playerJustDied={false}
      awaitingDefense={false} lastInitiativeRoll={null} onActuar={noop} onRegistrar={noop} onHuir={noop} onContinue={noop}
      onSaquearSeleccion={noop} onAbilityDetail={noop} onItemDetail={noop} enciclopedia={null}
    />
  )
}

describe('CombatPanel: rematar (P65, QA-27)', () => {
  it('al marcar «Matar», lleva a la vista la lista de ataques', () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    Element.prototype.scrollTo = vi.fn()
    const { rerender } = render(panel([orco(false)]))
    expect(scroll).not.toHaveBeenCalled()
    rerender(panel([orco(true)]))
    expect(screen.getByTestId('combate-usables')).toBeTruthy()
    expect(scroll).toHaveBeenCalledTimes(1)
  })
})
