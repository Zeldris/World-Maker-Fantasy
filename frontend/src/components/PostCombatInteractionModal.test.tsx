import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PostCombatInteractionModal } from './PostCombatInteractionModal'

describe('PostCombatInteractionModal (P97, QA-27)', () => {
  it('un cadáver de fauna se desuella, no se saquea', () => {
    const onSaquear = vi.fn()
    const onDesollar = vi.fn()
    render(
      <PostCombatInteractionModal
        target={{ slug: 'guchapo', name: 'Guchapo', condicionFisica: 'MUERTO', saqueado: false, esFauna: true }}
        onSalir={vi.fn()}
        onSaquear={onSaquear}
        onDesollar={onDesollar}
      />,
    )
    expect(screen.getByText('Un cadáver, todavía sin despiezar.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Desollar' }))
    expect(onDesollar).toHaveBeenCalledTimes(1)
    expect(onSaquear).not.toHaveBeenCalled()
  })

  it('el de una persona se sigue saqueando', () => {
    const onSaquear = vi.fn()
    render(
      <PostCombatInteractionModal
        target={{ slug: 'orco', name: 'Orco enfurecido', condicionFisica: 'MUERTO', saqueado: false, esFauna: false }}
        onSalir={vi.fn()}
        onSaquear={onSaquear}
        onDesollar={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Saquear' }))
    expect(onSaquear).toHaveBeenCalledTimes(1)
  })
})
