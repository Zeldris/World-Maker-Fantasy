import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HungerThirstSelectionModal } from './HungerThirstSelectionModal'
import type { InventoryItemInfo } from '../types'

const item = (id: string, name: string, extra: Partial<InventoryItemInfo>): InventoryItemInfo =>
  ({ id, name, description: '', slot: null, statBonuses: null, ...extra }) as InventoryItemInfo

/// P121 (QA-27): saciado, lo que da energía se puede comer igual (antes solo desde Curar).
describe('HungerThirstSelectionModal — saciado', () => {
  const inventario = [item('r', 'Ración de viaje (2)', { curaHambre: 30, curaEnergia: 20 }), item('b', 'Bayas', { curaHambre: 10 })]

  it('con hambre al 100% ofrece la ración que da energía y no la que no', () => {
    render(<HungerThirstSelectionModal inventory={inventario} hambre={100} sed={100} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Ya estás saciado: solo comerías por la energía.')).toBeTruthy()
    expect(screen.getByText('Ración de viaje')).toBeTruthy()
    expect(screen.getByText(/\+20 energía/)).toBeTruthy()
    expect(screen.queryByText('Bayas')).toBeNull()
  })

  it('sin nada que dé energía sigue diciendo que no hace falta comer', () => {
    render(<HungerThirstSelectionModal inventory={[inventario[1]]} hambre={100} sed={100} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Ya estás saciado — no hace falta comer más.')).toBeTruthy()
  })
})
