import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { SelectionModalShell } from './SelectionModalShell'

/// Accesibilidad básica de modal (auditoría de frontend 2026-09-07, decisión confirmada con la
/// usuaria: empezar por este cascarón — cubre 11 de los ~18 modales del proyecto). Antes de este
/// fix: sin role="dialog"/aria-modal, sin cierre con Escape, y Tab podía "escapar" del panel hacia
/// elementos de la página de detrás.
describe('SelectionModalShell — accesibilidad', () => {
  // Sin setupFiles global que llame a cleanup() entre tests (confirmado: DetailModal.test.tsx evita
  // el problema usando `container` en vez de queries globales) — aquí sí hace falta uno real, porque
  // getByRole/getByText buscan en todo document.body y varios tests renderizan el mismo role/texto.
  afterEach(() => {
    cleanup()
  })

  it('el panel lleva role="dialog"/aria-modal="true" con el título como aria-label', () => {
    const { getByRole } = render(
      <SelectionModalShell title="Elige un objetivo" onCancel={() => {}}>
        <p>contenido</p>
      </SelectionModalShell>,
    )
    const dialog = getByRole('dialog', { name: 'Elige un objetivo' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('Escape llama a onCancel', () => {
    const onCancel = vi.fn()
    const { getByRole } = render(
      <SelectionModalShell title="x" onCancel={onCancel}>
        <p>contenido</p>
      </SelectionModalShell>,
    )
    fireEvent.keyDown(getByRole('dialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Escape NO llama a onCancel si cancelDisabled (mismo criterio que el propio botón Cancelar)', () => {
    const onCancel = vi.fn()
    const { getByRole } = render(
      <SelectionModalShell title="x" onCancel={onCancel} cancelDisabled>
        <p>contenido</p>
      </SelectionModalShell>,
    )
    fireEvent.keyDown(getByRole('dialog'), { key: 'Escape' })
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('Tab en el último elemento enfocable (Cancelar, sin footer) envuelve al primero del panel', () => {
    const { getByRole, getByText } = render(
      <SelectionModalShell title="x" onCancel={() => {}}>
        <button type="button">Primera opción</button>
      </SelectionModalShell>,
    )
    const dialog = getByRole('dialog')
    const primera = getByText('Primera opción')
    const cancelar = getByRole('button', { name: 'Cancelar' })
    cancelar.focus()
    expect(document.activeElement).toBe(cancelar)
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(primera)
  })

  it('Shift+Tab en el primer elemento enfocable envuelve al último (Cancelar, sin footer)', () => {
    const { getByRole, getByText } = render(
      <SelectionModalShell title="x" onCancel={() => {}}>
        <button type="button">Primera opción</button>
      </SelectionModalShell>,
    )
    const dialog = getByRole('dialog')
    const primera = getByText('Primera opción')
    const cancelar = getByRole('button', { name: 'Cancelar' })
    primera.focus()
    expect(document.activeElement).toBe(primera)
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(cancelar)
  })
})
