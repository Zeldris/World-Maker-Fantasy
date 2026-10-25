import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { HabilidadesPanel } from './HabilidadesPanel'

/// P207: las pestañas del cajón de Habilidades tienen que decir cuál está activa a un lector de pantalla.
describe('HabilidadesPanel — pestañas accesibles (P207)', () => {
  function pintar() {
    return render(
      <HabilidadesPanel
        savedActions={[]}
        combatSlots={3}
        activeCombatAbilityNames={[]}
        onChangeActiveCombatAbilityNames={vi.fn()}
        professionProgress={[]}
        professionRecipes={[]}
        recipesStatus={[]}
        onUse={vi.fn()}
        onCreate={vi.fn()}
        onDetail={vi.fn()}
      />,
    )
  }

  it('las cuatro pestañas son role="tab" y solo la activa lleva aria-selected="true"', () => {
    const { getByRole, getAllByRole } = pintar()
    expect(getByRole('tablist', { name: 'Tipo de habilidad' })).toBeTruthy()
    const pestanas = getAllByRole('tab')
    expect(pestanas.map((p) => p.textContent)).toEqual(['Generales', 'Combate', 'Profesiones', 'Reino'])
    expect(pestanas.map((p) => p.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false'])
    fireEvent.click(getByRole('tab', { name: 'Combate' }))
    expect(getAllByRole('tab').map((p) => p.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false', 'false'])
  })
})
