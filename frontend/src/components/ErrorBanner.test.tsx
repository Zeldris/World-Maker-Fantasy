import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup, act, renderHook } from '@testing-library/react'
import { ErrorBanner } from './ErrorBanner'
import { ConfirmModal } from './ConfirmModal'
import { useErrorConReintento } from '../hooks/useErrorConReintento'

/// UX-24 (hito 0.1, roadmap-front-ux.md H23) — ningún error en silencio.
describe('ErrorBanner — UX-24', () => {
  afterEach(() => {
    cleanup()
  })

  it('sin fallo no pinta nada', () => {
    const { container } = render(<ErrorBanner fallo={null} onCerrar={() => {}} />)
    expect(container.innerHTML).toBe('')
  })

  it('muestra mensaje y detalle del backend; Reintentar cierra el aviso y repite la acción', () => {
    const reintentar = vi.fn()
    const onCerrar = vi.fn()
    const { getByRole, getByText } = render(
      <ErrorBanner fallo={{ mensaje: 'No se pudo depositar el objeto en el almacén.', detalle: 'El almacén está lleno', reintentar }} onCerrar={onCerrar} />,
    )
    expect(getByRole('alert')).toBeTruthy()
    expect(getByText('El almacén está lleno')).toBeTruthy()
    fireEvent.click(getByRole('button', { name: 'Reintentar' }))
    expect(onCerrar).toHaveBeenCalledTimes(1)
    expect(reintentar).toHaveBeenCalledTimes(1)
  })

  it('sin reintento solo ofrece cerrar', () => {
    const { queryByRole, getByRole } = render(<ErrorBanner fallo={{ mensaje: 'No se pudo cambiar el nombre.' }} onCerrar={() => {}} />)
    expect(queryByRole('button', { name: 'Reintentar' })).toBeNull()
    expect(getByRole('button', { name: 'Cerrar aviso' })).toBeTruthy()
  })

  it('useErrorConReintento toma el detalle del Error y limpiar lo quita', () => {
    const { result } = renderHook(() => useErrorConReintento())
    act(() => result.current.informar('No se pudo comprar el objeto.', new Error('Sin tratado comercial')))
    expect(result.current.fallo).toMatchObject({ mensaje: 'No se pudo comprar el objeto.', detalle: 'Sin tratado comercial' })
    act(() => result.current.limpiar())
    expect(result.current.fallo).toBeNull()
  })

  it('ConfirmModal con error: lo enseña y el botón pasa a Reintentar', () => {
    const { getByRole } = render(
      <ConfirmModal title="Descansar" message="¿Seguro?" confirmLabel="Descansar" onConfirm={() => {}} onCancel={() => {}} error="No se pudo descansar en el campamento." />,
    )
    expect(getByRole('alert').textContent).toContain('No se pudo descansar en el campamento.')
    expect(getByRole('button', { name: 'Reintentar' })).toBeTruthy()
  })
})
