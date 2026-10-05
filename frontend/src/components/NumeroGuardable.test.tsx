import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import { createRoot } from 'react-dom/client'
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

  it('un valor nuevo desde fuera reemplaza el borrador', () => {
    const onGuardar = vi.fn().mockResolvedValue(true)
    const { getByLabelText, rerender } = render(<NumeroGuardable ariaLabel="Tope" valor={20} onGuardar={onGuardar} />)
    const input = getByLabelText('Tope') as HTMLInputElement
    fireEvent.change(input, { target: { value: '7' } })
    rerender(<NumeroGuardable ariaLabel="Tope" valor={20} onGuardar={onGuardar} />)
    expect(input.value).toBe('7')
    rerender(<NumeroGuardable ariaLabel="Tope" valor={30} onGuardar={onGuardar} />)
    expect(input.value).toBe('30')
    expect(onGuardar).not.toHaveBeenCalled()
  })

  // QA-12 (2026-10-05) — causa del intermitente de `ProduccionSection.test.tsx`: cuando el campo se
  // monta fuera de `act` (p. ej. al llegar una respuesta), lo escrito antes de que corran los efectos
  // del montaje se perdía, porque un efecto copiaba `valor` encima del borrador. Aquí el montaje va
  // sin `act` y se escribe en cuanto el campo aparece, antes de los efectos: siempre.
  it('lo escrito antes de que corran los efectos del montaje no se pierde', async () => {
    const entorno = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    const actPrevio = entorno.IS_REACT_ACT_ENVIRONMENT
    entorno.IS_REACT_ACT_ENVIRONMENT = false
    const onGuardar = vi.fn().mockResolvedValue(true)
    const contenedor = document.body.appendChild(document.createElement('div'))
    const root = createRoot(contenedor)
    try {
      const montado = new Promise<HTMLInputElement>((resolver) => {
        const observador = new MutationObserver(() => {
          const input = contenedor.querySelector('input')
          if (input) {
            observador.disconnect()
            resolver(input)
          }
        })
        observador.observe(contenedor, { childList: true, subtree: true })
      })
      root.render(<NumeroGuardable ariaLabel="Límite" valor={10} min={1} onGuardar={onGuardar} />)
      const input = await montado
      fireEvent.change(input, { target: { value: '4' } })
      await new Promise((r) => setTimeout(r, 20))
      fireEvent.keyDown(input, { key: 'Enter' })
      await new Promise((r) => setTimeout(r, 20))
      expect(onGuardar).toHaveBeenCalledWith(4)
    } finally {
      root.unmount()
      contenedor.remove()
      entorno.IS_REACT_ACT_ENVIRONMENT = actPrevio
    }
  })
})
