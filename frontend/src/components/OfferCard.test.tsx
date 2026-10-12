import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OfferCard } from './OfferCard'

describe('OfferCard (P78, QA-27)', () => {
  it('una acción desactivada enseña su motivo', () => {
    render(
      <OfferCard
        tone="danger"
        icon="⚠️"
        title="Guchapo está convaleciente"
        actions={[
          { label: 'Matar', tone: 'danger', onClick: vi.fn() },
          { label: 'Capturar', tone: 'accent', disabled: true, motivo: 'Necesitas cuerdas en el inventario para atarlo.', onClick: vi.fn() },
        ]}
      />,
    )
    const capturar = screen.getByRole('button', { name: 'Capturar' }) as HTMLButtonElement
    expect(capturar.disabled).toBe(true)
    expect(capturar.title).toBe('Necesitas cuerdas en el inventario para atarlo.')
    expect((screen.getByRole('button', { name: 'Matar' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
