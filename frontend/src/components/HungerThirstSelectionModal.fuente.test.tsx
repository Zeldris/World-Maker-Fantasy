import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { HungerThirstSelectionModal } from './HungerThirstSelectionModal'
import { ACCION_BEBER_DE_LA_FUENTE, esPuntoDeAgua } from '../lib/puntosDeAgua'

/// QA-27 P39: en un punto de agua real se puede beber sin odre desde el pop-up de Comer/Beber.
describe('HungerThirstSelectionModal: beber de la fuente (QA-27 P39)', () => {
  afterEach(() => cleanup())

  it('en una fuente ofrece beber sin odre y manda la acción sin objetos', () => {
    const onConfirm = vi.fn()
    const { getByRole, queryByText } = render(
      <HungerThirstSelectionModal inventory={[]} hambre={50} sed={20} enFuente onConfirm={onConfirm} onCancel={() => {}} />,
    )
    expect(queryByText(/necesitas un odre lleno/)).toBeNull()
    fireEvent.click(getByRole('button', { name: /Beber de la fuente/ }))
    expect(onConfirm).toHaveBeenCalledWith(ACCION_BEBER_DE_LA_FUENTE, [])
  })

  it('fuera de una fuente no aparece la opción', () => {
    const { queryByRole, getByText } = render(
      <HungerThirstSelectionModal inventory={[]} hambre={50} sed={20} onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(queryByRole('button', { name: /Beber de la fuente/ })).toBeNull()
    expect(getByText(/necesitas un odre lleno/)).toBeTruthy()
  })

  it('reconoce los puntos de agua reales', () => {
    expect(esPuntoDeAgua('manaderos')).toBe(true)
    expect(esPuntoDeAgua('hondonada-del-eco')).toBe(false)
    expect(esPuntoDeAgua(undefined)).toBe(false)
  })
})
