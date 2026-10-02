import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import { ClaseModal } from './ClaseModal'
import { MS_MANTENER } from './BotonMantener'

vi.mock('./ImagePromptDisplay', () => ({ MediaSlot: () => null, ImagePromptSlot: () => null }))

/// MOD-4 (hito 0.2) — elegir clase es una ceremonia: aviso de irreversible y mantener pulsado.
describe('MOD-4 — ClaseModal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('lista → detalle con aviso → mantener pulsado confirma la clase', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const { getByText, getByRole } = render(
      <ClaseModal clases={[{ clase: 'GUERRERO' as never, resumenMecanico: 'Pega fuerte.', iconoUrl: null }]} worldSlug="tarkor" onConfirm={onConfirm} />,
    )
    expect(getByRole('dialog').className).toContain('max-w-3xl')
    fireEvent.click(getByText('Pega fuerte.'))
    expect(getByText('No podrás cambiar de clase más adelante.')).toBeTruthy()
    const mantener = getByText(/Mantén para elegir/).closest('button')!
    fireEvent.pointerDown(mantener)
    await act(async () => {
      vi.advanceTimersByTime(MS_MANTENER)
    })
    expect(onConfirm).toHaveBeenCalledWith('GUERRERO')
  })
})
