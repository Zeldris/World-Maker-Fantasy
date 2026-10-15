import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RollBreakdown } from './RollBreakdown'

/// P155 (QA-27): «(6 −2 heridas = 4 ×1.5≈6/2)» sin decir qué era el ×1.5.
describe('RollBreakdown', () => {
  it('el multiplicador va con su nombre y su explicación', () => {
    const { container } = render(<RollBreakdown side={{ value: 6, malus: 2, multiplicador: 1.5 }} valorCrudo={4} valorEfectivo={6} />)
    expect(container.textContent).toContain('×1.5 tipo')
    expect(container.querySelector('[title^="Ventaja de tipo"]')).not.toBeNull()
  })
  it('por debajo de ×1 la explicación dice desventaja', () => {
    const { container } = render(<RollBreakdown side={{ value: 6, multiplicador: 0.5 }} valorCrudo={6} valorEfectivo={3} />)
    expect(container.querySelector('[title^="Desventaja de tipo"]')).not.toBeNull()
  })
})
