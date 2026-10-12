import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HealSelectionModal } from './HealSelectionModal'
import type { InventoryItemInfo } from '../types'

const vendaje = { id: 'v1', name: 'Vendaje improvisado', description: 'x', slot: null, curaHasta: 'GRAVE', curaUnPaso: false } as unknown as InventoryItemInfo
const cataplasma = { id: 'c1', name: 'Cataplasma', description: 'x', slot: null, curaHasta: 'HERIDO', curaUnPaso: false } as unknown as InventoryItemInfo

describe('HealSelectionModal (P118, QA-27)', () => {
  it('estando Grave, lo que «cura hasta grave» no se puede marcar y dice por qué', () => {
    render(<HealSelectionModal inventory={[vendaje, cataplasma]} condicionFisica="GRAVE" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const masVendaje = screen.getByRole('button', { name: 'Más: Vendaje improvisado' }) as HTMLButtonElement
    expect(masVendaje.disabled).toBe(true)
    expect(masVendaje.title).toBe('Estando grave, esto ya no te cura más')
    expect((screen.getByRole('button', { name: 'Más: Cataplasma' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
