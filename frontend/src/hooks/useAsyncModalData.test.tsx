import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAsyncModalData } from './useAsyncModalData'

/// Cobertura nueva (2026-09-03) — hook compartido por 7 modales de selección
/// (CampSelectionModal/CapturaModal/EntregaModal/HuntSelectionModal/SaquearZonaModal/
/// HarvestSelectionModal/AprenderOficioModal), sin cobertura propia hasta ahora (señalado como
/// "menos urgente" en la auditoría de deuda técnica del 2026-08-25, retomado por ser puro y sin
/// timers — a diferencia de useTransitPolling/useSurroundingsPolling/useReconnectionPolling, que sí
/// necesitarían fake timers y se dejan fuera de esta pasada).
describe('useAsyncModalData', () => {
  it('empieza en loading:true, y pasa a loading:false + onSuccess llamado tras resolver', async () => {
    const onSuccess = vi.fn()
    const fetchFn = vi.fn().mockResolvedValue({ items: ['a', 'b'] })
    const { result } = renderHook(() => useAsyncModalData(fetchFn, onSuccess, 'Error al cargar', []))

    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(onSuccess).toHaveBeenCalledWith({ items: ['a', 'b'] })
    expect(result.current.error).toBeNull()
  })

  it('si fetchFn rechaza, error se fija al mensaje dado y loading vuelve a false, sin llamar a onSuccess', async () => {
    const onSuccess = vi.fn()
    const fetchFn = vi.fn().mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useAsyncModalData(fetchFn, onSuccess, 'No se pudo cargar la lista', []))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('No se pudo cargar la lista')
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('cambiar las deps dispara un nuevo fetch (mismo criterio que useEffect estándar)', async () => {
    const onSuccess = vi.fn()
    const fetchFn = vi.fn().mockResolvedValue('ok')
    const { result, rerender } = renderHook(({ dep }) => useAsyncModalData(fetchFn, onSuccess, 'x', [dep]), {
      initialProps: { dep: 1 },
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchFn).toHaveBeenCalledTimes(1)

    rerender({ dep: 2 })
    expect(result.current.loading).toBe(true) // vuelve a loading al re-disparar
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('setError permite limpiar el error manualmente (ej. al reintentar desde el modal)', async () => {
    const onSuccess = vi.fn()
    const fetchFn = vi.fn().mockRejectedValue(new Error('x'))
    const { result } = renderHook(() => useAsyncModalData(fetchFn, onSuccess, 'Fallo real', []))
    await waitFor(() => expect(result.current.error).toBe('Fallo real'))

    result.current.setError(null)
    await waitFor(() => expect(result.current.error).toBeNull())
  })
})
