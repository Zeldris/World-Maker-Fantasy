import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { HungerThirstSelectionModal } from './HungerThirstSelectionModal'
import type { InventoryItemInfo } from '../types'

const item = (id: string, name: string, extra: Partial<InventoryItemInfo>): InventoryItemInfo =>
  ({ id, name, description: '', slot: null, statBonuses: null, ...extra }) as InventoryItemInfo

/// P121 (QA-27): saciado, lo que da energía se puede comer igual (antes solo desde Curar).
describe('HungerThirstSelectionModal — saciado', () => {
  afterEach(cleanup)
  const inventario = [item('r', 'Ración de viaje (2)', { curaHambre: 30, curaEnergia: 20 }), item('b', 'Bayas', { curaHambre: 10 })]

  it('con hambre al 100% ofrece la ración que da energía y no la que no', () => {
    render(<HungerThirstSelectionModal inventory={inventario} hambre={100} sed={100} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Ya estás saciado: solo comerías por la energía.')).toBeTruthy()
    expect(screen.getByText('Ración de viaje')).toBeTruthy()
    expect(screen.getByText(/\+20 energía/)).toBeTruthy()
    expect(screen.queryByText('Bayas')).toBeNull()
  })

  it('con la energía también llena no ofrece nada', () => {
    render(<HungerThirstSelectionModal inventory={inventario} hambre={100} sed={100} energia={100} energiaMax={100} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Ya estás saciado — no hace falta comer más.')).toBeTruthy()
    expect(screen.queryByText('Ración de viaje')).toBeNull()
  })

  it('saciado, solo deja marcar las raciones que caben en la energía que falta', () => {
    render(<HungerThirstSelectionModal inventory={[item('r', 'Ración de viaje (10)', { curaHambre: 30, curaEnergia: 20 })]} hambre={100} sed={100} energia={70} energiaMax={100} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const mas = screen.getByRole('button', { name: 'Más: Ración de viaje (10)' })
    fireEvent.click(mas)
    fireEvent.click(mas)
    fireEvent.click(mas)
    // 70 + 20 + 20 ya llena: la tercera no se marca.
    expect((screen.getByLabelText('Ración de viaje (10)') as HTMLInputElement).value).toBe('2')
    expect((mas as HTMLButtonElement).disabled).toBe(true)
  })

  it('sin nada que dé energía sigue diciendo que no hace falta comer', () => {
    render(<HungerThirstSelectionModal inventory={[inventario[1]]} hambre={100} sed={100} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Ya estás saciado — no hace falta comer más.')).toBeTruthy()
  })
})

/// P228: la bebida lleva el icono de bebida, no el de comida.
describe('HungerThirstSelectionModal — icono de bebida (P228)', () => {
  afterEach(cleanup)
  it('el odre de agua sale con 🥤 y no con 🍖 en su fila', () => {
    const { container } = render(
      <HungerThirstSelectionModal inventory={[item('o', 'Odre de agua lleno', { curaAgua: 30 })]} hambre={50} sed={50} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(container.textContent).toContain('🥤')
    const fila = screen.getByText('Odre de agua lleno').closest('div')!
    expect(fila.textContent).not.toContain('🍖')
  })
})
