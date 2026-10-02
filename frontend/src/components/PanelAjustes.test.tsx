import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { AjustesProvider } from '../context/AjustesProvider'
import { BotonAjustes } from './BotonAjustes'
import { CLAVE_AJUSTES } from '../lib/ajustes'

/// CFG-1/CFG-4 (hito 0.2) — botón ⚙️ y panel de configuración con vista previa.
describe('CFG-4 — panel de configuración', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-contrast')
  })
  afterEach(() => {
    cleanup()
  })

  const montar = () =>
    render(
      <AjustesProvider>
        <BotonAjustes />
      </AjustesProvider>,
    )

  it('vista previa en vivo; cancelar con cambios pide confirmación y descartar los deshace', () => {
    const { getByRole, getByText, queryByRole } = montar()
    fireEvent.click(getByRole('button', { name: 'Configuración' }))
    fireEvent.click(getByText('Accesibilidad'))
    fireEvent.click(getByRole('checkbox', { name: /Alto contraste/ }))
    expect(document.documentElement.dataset.contrast).toBe('alto')
    fireEvent.click(getByRole('button', { name: 'Cancelar' }))
    expect(getByText('Hay cambios sin aplicar.')).toBeTruthy()
    fireEvent.click(getByRole('button', { name: 'Descartar' }))
    expect(queryByRole('dialog')).toBeNull()
    expect(document.documentElement.dataset.contrast).toBeUndefined()
    expect(localStorage.getItem(CLAVE_AJUSTES)).toBeNull()
  })

  it('Aplicar guarda; Restablecer vuelve a los de por defecto en la vista previa', () => {
    const { getByRole, getByText } = montar()
    fireEvent.click(getByRole('button', { name: 'Configuración' }))
    fireEvent.click(getByText('Animaciones'))
    fireEvent.click(getByRole('radio', { name: 'Rápida' }))
    fireEvent.click(getByRole('button', { name: 'Aplicar' }))
    expect(JSON.parse(localStorage.getItem(CLAVE_AJUSTES)!).velocidadDados).toBe('rapida')
    fireEvent.click(getByRole('button', { name: 'Configuración' }))
    fireEvent.click(getByText('Animaciones'))
    fireEvent.click(getByRole('button', { name: 'Restablecer' }))
    expect(getByRole('radio', { name: 'Dramática' }).getAttribute('aria-checked')).toBe('true')
  })
})
