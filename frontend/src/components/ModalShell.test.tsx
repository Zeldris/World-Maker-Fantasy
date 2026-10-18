import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { ModalShell } from './ModalShell'

/// MOD-1 (hito 0.2) — cáscara única de modal.
describe('MOD-1 — ModalShell', () => {
  afterEach(() => {
    cleanup()
  })

  it('título enlazado por aria-labelledby, subtítulo, ✕ que cierra y pie fuera de la zona con scroll', () => {
    const onClose = vi.fn()
    const { getByRole, getByText } = render(
      <ModalShell title="Fundar reino" subtitle="Elige nombre" icon="👑" tamano="lg" onClose={onClose} footer={<button type="button">Confirmar</button>}>
        <p>cuerpo</p>
      </ModalShell>,
    )
    const dialog = getByRole('dialog')
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent).toBe('Fundar reino')
    expect(dialog.className).toContain('max-w-2xl')
    expect(getByText('Elige nombre')).toBeTruthy()
    expect(getByText('cuerpo').parentElement!.className).toContain('overflow-y-auto')
    expect(getByText('Confirmar').parentElement!.className).not.toContain('overflow-y-auto')
    fireEvent.click(getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // P202 (QA-27): con el foco fuera (p. ej. en `body`, al desaparecer el botón que lo abrió), Escape cierra
  // el modal de encima, y solo ese.
  it('Escape con el foco fuera cierra solo el modal de encima', () => {
    const abajo = vi.fn()
    const encima = vi.fn()
    render(
      <>
        <ModalShell title="Mapa" onClose={abajo}><p>mapa</p></ModalShell>
        <ModalShell title="¿Tienes trabajo?" onClose={encima}><p>aviso</p></ModalShell>
      </>,
    )
    ;(document.activeElement as HTMLElement | null)?.blur()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(encima).toHaveBeenCalledTimes(1)
    expect(abajo).not.toHaveBeenCalled()
  })

  it('con closeDisabled no cierra ni con Escape ni con la ✕', () => {
    const onClose = vi.fn()
    const { getByRole } = render(
      <ModalShell title="x" onClose={onClose} closeDisabled>
        <p>cuerpo</p>
      </ModalShell>,
    )
    fireEvent.keyDown(getByRole('dialog'), { key: 'Escape' })
    fireEvent.click(getByRole('button', { name: 'Cerrar' }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('al cerrar devuelve el foco al botón que lo abrió', () => {
    function Abridor() {
      const [abierto, setAbierto] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setAbierto(true)}>
            Abrir
          </button>
          {abierto && (
            <ModalShell title="x" onClose={() => setAbierto(false)}>
              <p>cuerpo</p>
            </ModalShell>
          )}
        </>
      )
    }
    const { getByText, getByRole } = render(<Abridor />)
    const abrir = getByText('Abrir')
    abrir.focus()
    fireEvent.click(abrir)
    expect(document.activeElement).toBe(getByRole('dialog'))
    fireEvent.keyDown(getByRole('dialog'), { key: 'Escape' })
    expect(document.activeElement).toBe(abrir)
  })
})
