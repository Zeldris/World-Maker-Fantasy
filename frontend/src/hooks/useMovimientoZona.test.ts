import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../lib/api', () => ({ moverEnZona: vi.fn(), getZona: vi.fn() }))
import { getZona, moverEnZona } from '../lib/api'
import { useMovimientoZona } from './useMovimientoZona'

/// ZON-35/36/38/86 (hito 0.2) — el bucle de pasos del mapa de zona: parar, reanudar, cancelar,
/// velocidad y pedir el siguiente paso sin sumar la espera de red a la animación.
describe('useMovimientoZona', () => {
  afterEach(() => vi.clearAllMocks())

  /// Un trayecto de `pasos` pasos en línea recta; cada llamada avanza uno.
  function trayecto(pasos: number) {
    let x = 0
    vi.mocked(moverEnZona).mockImplementation(async () => {
      x += 50
      const quedan = Math.max(0, pasos - x / 50)
      return { jugador: { x, y: 0 }, caminoRestante: Array.from({ length: quedan }, () => ({ x: 0, y: 0 })), zonePointsMovidos: [] } as never
    })
    vi.mocked(getZona).mockResolvedValue({ disponible: true } as never)
  }
  const usar = (msPorPaso: number) => renderHook(() => useMovimientoZona({ saveId: 's1', setData: vi.fn(), msPorPaso }))

  it('inmediata: anda el trayecto entero sin esperas y llega', async () => {
    trayecto(4)
    const { result } = usar(0)
    let llegada: unknown
    await act(async () => {
      llegada = await result.current.moverA({ x: 200, y: 0 })
    })
    expect(moverEnZona).toHaveBeenCalledTimes(4)
    expect(llegada).toEqual({ disponible: true })
    expect(result.current.destinoPendiente).toBeNull()
  })

  it('parar deja al personaje donde está, guarda el destino y reanudar sigue', async () => {
    trayecto(6)
    const { result } = usar(40)
    act(() => void result.current.moverA({ x: 300, y: 0 }))
    await waitFor(() => expect(moverEnZona).toHaveBeenCalledTimes(1))
    act(() => result.current.parar())
    await waitFor(() => expect(result.current.movimientoEnCurso).toBe(false))
    const pedidos = vi.mocked(moverEnZona).mock.calls.length
    await new Promise((r) => setTimeout(r, 120))
    expect(moverEnZona).toHaveBeenCalledTimes(pedidos)
    expect(result.current.mensajeMovimiento).toBe('Te detienes.')
    expect(result.current.destinoPendiente).toEqual({ x: 300, y: 0 })
    act(() => result.current.reanudar())
    await waitFor(() => expect(result.current.destinoPendiente).toBeNull(), { timeout: 2000 })
    expect(moverEnZona).toHaveBeenCalledTimes(6)
  })

  it('cancelar para y olvida el destino', async () => {
    trayecto(6)
    const { result } = usar(40)
    act(() => void result.current.moverA({ x: 300, y: 0 }))
    await waitFor(() => expect(moverEnZona).toHaveBeenCalledTimes(1))
    act(() => result.current.cancelar())
    await waitFor(() => expect(result.current.movimientoEnCurso).toBe(false))
    expect(result.current.destinoPendiente).toBeNull()
  })

  it('el doble clic va rápido; cada paso dura lo que su animación, sin sumar la espera de red', async () => {
    trayecto(4)
    const momentos: number[] = []
    const original = vi.mocked(moverEnZona).getMockImplementation()!
    vi.mocked(moverEnZona).mockImplementation(async (...args) => {
      momentos.push(performance.now())
      await new Promise((r) => setTimeout(r, 150)) // red
      return original(...args)
    })
    const { result } = usar(600)
    await act(async () => {
      await result.current.moverA({ x: 200, y: 0 }, { rapido: true })
    })
    expect(result.current.msPasoActual).toBe(250)
    const intervalos = momentos.slice(1).map((t, i) => t - momentos[i]!)
    // Con la red descontada, ~250 ms entre pedidos (sin descontarla serían ~400).
    for (const d of intervalos.slice(1)) expect(d).toBeLessThan(340)
  })
})
