import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { DynamicModeModal } from './DynamicModeModal'
import type { DynamicModeTurno } from '../lib/api'

/// MOD-1 (hito 0.2) — el modo dinámico sobre ModalShell.
describe('MOD-1 — DynamicModeModal', () => {
  afterEach(() => {
    cleanup()
  })

  const turno = (extra: Partial<DynamicModeTurno> = {}) =>
    ({ vuelta: 1, timeLabel: 'Día 1, tarde', narration: 'Brenn te mira.', opciones: ['Saludar', 'Irte'], cierra: false, ...extra }) as DynamicModeTurno

  it('vuelta abierta: opciones en el pie y «Salir» (o Escape) abandona la escena', () => {
    const onElegir = vi.fn()
    const onSalir = vi.fn()
    const { getByRole, getByText } = render(<DynamicModeModal turno={turno()} onElegir={onElegir} onCerrar={vi.fn()} onSalir={onSalir} />)
    expect(getByRole('dialog', { name: 'Vuelta 1 — Día 1, tarde' })).toBeTruthy()
    fireEvent.click(getByText('Saludar'))
    expect(onElegir).toHaveBeenCalledWith('Saludar')
    fireEvent.keyDown(getByRole('dialog'), { key: 'Escape' })
    fireEvent.click(getByRole('button', { name: 'Salir' }))
    expect(onSalir).toHaveBeenCalledTimes(2)
  })

  it('vuelta que cierra: solo «Continuar», sin Salir ni Escape', () => {
    const onCerrar = vi.fn()
    const onSalir = vi.fn()
    const { getByRole, queryByRole } = render(<DynamicModeModal turno={turno({ cierra: true })} onElegir={vi.fn()} onCerrar={onCerrar} onSalir={onSalir} />)
    expect(queryByRole('button', { name: 'Salir' })).toBeNull()
    fireEvent.keyDown(getByRole('dialog'), { key: 'Escape' })
    expect(onSalir).not.toHaveBeenCalled()
    fireEvent.click(getByRole('button', { name: 'Continuar' }))
    expect(onCerrar).toHaveBeenCalled()
  })
})
