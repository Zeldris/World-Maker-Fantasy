import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { SelectorJuego } from './SelectorJuego'

/// REI-113 (hito 0.1) — selector del juego: ratón y teclado.
const opciones = [
  { value: '', label: 'Sin rol' },
  { value: 'guardia', label: 'Guardia', descripcion: 'Defiende el asentamiento' },
  { value: 'trabajador', label: 'Trabajador' },
]

describe('SelectorJuego', () => {
  afterEach(() => cleanup())

  it('enseña la opción actual y elige con el ratón', () => {
    const onChange = vi.fn()
    const { getByRole, getByText } = render(<SelectorJuego value="" opciones={opciones} onChange={onChange} ariaLabel="Rol de Ana" />)
    const boton = getByRole('button', { name: 'Rol de Ana' })
    expect(boton.textContent).toContain('Sin rol')
    fireEvent.click(boton)
    expect(getByRole('listbox')).toBeTruthy()
    expect(getByText('Defiende el asentamiento')).toBeTruthy()
    fireEvent.click(getByRole('option', { name: /Guardia/ }))
    expect(onChange).toHaveBeenCalledWith('guardia')
  })

  it('con teclado: flecha abre, flechas mueven, Enter elige; Esc cierra sin cambiar', () => {
    const onChange = vi.fn()
    const { getByRole, queryByRole } = render(<SelectorJuego value="guardia" opciones={opciones} onChange={onChange} ariaLabel="Rol" />)
    const boton = getByRole('button', { name: 'Rol' })
    fireEvent.keyDown(boton, { key: 'ArrowDown' })
    const lista = getByRole('listbox')
    fireEvent.keyDown(lista, { key: 'ArrowDown' })
    fireEvent.keyDown(lista, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('trabajador')
    expect(queryByRole('listbox')).toBeNull()

    fireEvent.keyDown(boton, { key: 'ArrowDown' })
    fireEvent.keyDown(getByRole('listbox'), { key: 'Escape' })
    expect(queryByRole('listbox')).toBeNull()
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('elegir la misma opción no avisa; deshabilitado no abre', () => {
    const onChange = vi.fn()
    const { getByRole, queryByRole, rerender } = render(<SelectorJuego value="guardia" opciones={opciones} onChange={onChange} ariaLabel="Rol" />)
    fireEvent.click(getByRole('button', { name: 'Rol' }))
    fireEvent.click(getByRole('option', { name: /Guardia/ }))
    expect(onChange).not.toHaveBeenCalled()
    rerender(<SelectorJuego value="guardia" opciones={opciones} onChange={onChange} ariaLabel="Rol" disabled />)
    fireEvent.click(getByRole('button', { name: 'Rol' }))
    expect(queryByRole('listbox')).toBeNull()
  })
})
