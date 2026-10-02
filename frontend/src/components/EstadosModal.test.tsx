import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, renderHook, waitFor } from '@testing-library/react'
import { CargandoModal, ErrorCarga, ExitoModal } from './EstadosModal'
import { useAsyncModalData } from '../hooks/useAsyncModalData'

/// MOD-2 (hito 0.2) — estados comunes de los modales.
describe('MOD-2 — estados de modal', () => {
  afterEach(() => {
    cleanup()
  })

  it('cargando: texto y filas de esqueleto, marcado como ocupado', () => {
    const { getByRole } = render(<CargandoModal texto="Buscando destinos..." filas={4} />)
    const estado = getByRole('status')
    expect(estado.getAttribute('aria-busy')).toBe('true')
    expect(estado.textContent).toContain('Buscando destinos...')
    expect(estado.querySelectorAll('[aria-hidden="true"]')).toHaveLength(4)
  })

  it('error de carga con «Reintentar»; sin handler no hay botón', () => {
    const onReintentar = vi.fn()
    const { getByRole, rerender, queryByRole } = render(<ErrorCarga mensaje="No se pudo cargar" onReintentar={onReintentar} />)
    fireEvent.click(getByRole('button', { name: 'Reintentar' }))
    expect(onReintentar).toHaveBeenCalled()
    rerender(<ErrorCarga mensaje="No se pudo cargar" />)
    expect(queryByRole('button', { name: 'Reintentar' })).toBeNull()
  })

  it('éxito con sello', () => {
    const { getByRole } = render(<ExitoModal>Le entregas la daga a Brenn.</ExitoModal>)
    expect(getByRole('status').textContent).toContain('✓Le entregas la daga a Brenn.')
  })

  it('useAsyncModalData: reintentar vuelve a pedir y limpia el error', async () => {
    const fetchFn = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce('ok')
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useAsyncModalData(fetchFn, onSuccess, 'Falló', []))
    await waitFor(() => expect(result.current.error).toBe('Falló'))
    result.current.reintentar()
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('ok'))
    expect(result.current.error).toBeNull()
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })
})
