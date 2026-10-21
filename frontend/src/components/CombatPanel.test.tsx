import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { setFactorDados } from '../lib/duracionTirada'
import { CombatPanel } from './CombatPanel'
import type { CombatNpcDisplay } from './CombatComposer'
import type { InitiativeRollInfo, SavedActionInfo } from '../types'

const ataqueBasico = {
  id: 'a1', name: 'Ataque Básico', promptText: 'Ataco', icon: '⚔️', description: 'Golpe sencillo', isStarting: true,
  isDynamic: false, category: 'combate', preferredAttribute: 'fuerza', energyCost: 0, energyRegen: 0, isGeneric: true, rol: 'ataque', effects: [],
} as unknown as SavedActionInfo

function orco(targetedForKill: boolean): CombatNpcDisplay {
  return { slug: 'orco', name: 'Orco enfurecido', condicion: 'CONVALECIENTE', yaSaqueado: false, lootedItemNames: [], analizado: false, activeEffects: [], targetedForKill }
}

function panel(npcs: CombatNpcDisplay[], lastInitiativeRoll: InitiativeRollInfo | null = null, awaitingDefense = false) {
  const noop = vi.fn()
  return (
    <CombatPanel
      playerCondicion="HERIDO" playerActiveEffects={[]} playerAttributes={{ fuerza: 10, destreza: 6, constitucion: 7, inteligencia: 7, voluntad: 8, carisma: 6, magia: 2 } as never}
      energia={70} npcs={npcs} selectedNpcSlug={null} onSelectNpc={noop} combatAbilities={[ataqueBasico]} selectedAbilityId={null}
      onSelectAbility={noop} combatItems={[]} selectedItemId={null} onSelectItem={noop} busy={false} ended={false} playerJustDied={false}
      awaitingDefense={awaitingDefense} lastInitiativeRoll={lastInitiativeRoll} onActuar={noop} onRegistrar={noop} onHuir={noop} onContinue={noop}
      onSaquearSeleccion={noop} onAbilityDetail={noop} onItemDetail={noop} enciclopedia={null}
    />
  )
}

describe('CombatPanel: rematar (P65, QA-27)', () => {
  it('al marcar «Matar», lleva a la vista la lista de ataques', () => {
    // jsdom no tiene estos métodos: se ponen solo durante este test y se quitan al acabar.
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    Element.prototype.scrollTo = vi.fn()
    onTestFinished(() => {
      delete (Element.prototype as Partial<Element>).scrollIntoView
      delete (Element.prototype as Partial<Element>).scrollTo
    })
    const { rerender } = render(panel([orco(false)]))
    expect(scroll).not.toHaveBeenCalled()
    rerender(panel([orco(true)]))
    expect(screen.getByTestId('combate-usables')).toBeTruthy()
    expect(scroll).toHaveBeenCalledTimes(1)
  })
})

// P288: dos iniciativas seguidas con las mismas tiradas (9 vs 16 y otra vez 9 vs 16) no remontaban los
// dados (la `key` era solo los números): su `onAllLanded` no volvía a dispararse y el panel se quedaba
// para siempre en «Tirando iniciativa...», sin el fondo de defensa.
describe('CombatPanel: iniciativa repetida con las mismas tiradas (P288)', () => {
  const tirada = (): InitiativeRollInfo => {
    const lado = (roll: number) => ({ attribute: 'destreza', value: 0, roll, difficulty: 0, result: roll, success: true, valorEfectivo: roll }) as never
    return { ganador: 'npc', jugador: lado(9), npc: lado(16) }
  }
  it('vuelve a revelar la iniciativa aunque los números sean los mismos', () => {
    vi.useFakeTimers()
    setFactorDados(0.01)
    Element.prototype.scrollIntoView = vi.fn()
    Element.prototype.scrollTo = vi.fn()
    onTestFinished(() => {
      vi.useRealTimers()
      setFactorDados(1)
      delete (Element.prototype as Partial<Element>).scrollIntoView
      delete (Element.prototype as Partial<Element>).scrollTo
    })
    const sano = { ...orco(false), condicion: 'ILESO' } as CombatNpcDisplay
    const { rerender } = render(panel([sano], tirada(), true))
    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.queryByText(/Tirando iniciativa/)).toBeNull()
    rerender(panel([sano], tirada(), true))
    expect(screen.getByText(/Tirando iniciativa/)).toBeTruthy()
    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.queryByText(/Tirando iniciativa/)).toBeNull()
  })
})
