import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RollBadge } from './RollBadge'

describe('RollBadge', () => {
  it('P364: con heridas usa el valor rebajado para el bono (coincide con el resultado guardado)', () => {
    render(<RollBadge roll={{ attribute: 'destreza', value: 18, roll: 11, difficulty: 12, result: 19, success: true, malus: 2, valorEfectivo: 16 }} />)
    expect(screen.getByText(/🎲11 \+ 8 = 19 vs 12/)).toBeTruthy()
  })
})
