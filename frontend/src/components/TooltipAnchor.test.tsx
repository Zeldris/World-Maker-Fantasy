import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TooltipAnchor } from './TooltipAnchor'

describe('TooltipAnchor (P72, QA-27)', () => {
  it('solo hay un aviso abierto: el del hueco con foco se cierra al pasar el ratón por otro', () => {
    render(
      <>
        <TooltipAnchor text="Maza orca"><button type="button">maza</button></TooltipAnchor>
        <TooltipAnchor text="Guantes — vacío"><button type="button">guantes</button></TooltipAnchor>
      </>,
    )
    fireEvent.focus(screen.getByText('maza'))
    expect(screen.getByText('Maza orca')).toBeTruthy()
    fireEvent.mouseEnter(screen.getByText('guantes').parentElement!)
    expect(screen.getByText('Guantes — vacío')).toBeTruthy()
    expect(screen.queryByText('Maza orca')).toBeNull()
  })
})
