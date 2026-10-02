import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import { NumeroGuardable } from './NumeroGuardable'

/// REI-110 / REI-112 (hito 0.1) — una petición por cambio confirmado, no por tecla.
describe('NumeroGuardable', () => {
  afterEach(() => cleanup())

  it('escribir no guarda; Enter guarda una sola vez con el valor acotado y enseña la ✓', async () => {
    const onGuardar = vi.fn().mockResolvedValue(true)
    const { getByLabelText, getByText } = render(<NumeroGuardable ariaLabel="Prioridad" valor={5} min={0} max={9} onGuardar={onGuardar} />)
    const input = getByLabelText('Prioridad') as HTMLInputElement
    fireEvent.change(input, { target: { value: '1' } })
    fireEvent.change(input, { target: { value: '12' } })
    expect(onGuardar).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(onGuardar).toHaveBeenCalledTimes(1)
    expect(onGuardar).toHaveBeenCalledWith(9)
    expect(getByText('✓')).toBeTruthy()
  })

  it('salir del campo sin cambios no guarda; Esc deshace', async () => {
    const onGuardar = vi.fn().mockResolvedValue(true)
    const { getByLabelText } = render(<NumeroGuardable ariaLabel="Tope" valor={20} min={1} permitirVacio onGuardar={onGuardar} />)
    const input = getByLabelText('Tope') as HTMLInputElement
    await act(async () => {
      fireEvent.blur(input)
    })
    expect(onGuardar).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '7' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input.value).toBe('20')
  })

  it('vaciar con permitirVacio guarda null (sin tope); si el guardado falla vuelve al valor anterior', async () => {
    const onGuardar = vi.fn().mockResolvedValue(false)
    const { getByLabelText } = render(<NumeroGuardable ariaLabel="Tope" valor={20} min={1} permitirVacio onGuardar={onGuardar} />)
    const input = getByLabelText('Tope') as HTMLInputElement
    fireEvent.change(input, { target: { value: '' } })
    await act(async () => {
      fireEvent.blur(input)
    })
    expect(onGuardar).toHaveBeenCalledWith(null)
    expect(input.value).toBe('20')
  })
})
