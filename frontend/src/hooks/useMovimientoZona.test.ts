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

  it('un encuentro corta el trayecto, deja la oferta en el registro y olvida el destino', async () => {
    vi.mocked(moverEnZona).mockResolvedValue({
      jugador: { x: 50, y: 0 }, caminoRestante: [{ x: 100, y: 0 }], zonePointsMovidos: [],
      colision: { targetName: 'Aullador rojo', temperamento: 'CAUTELOSO' },
      dynamicModeOffer: { targetName: 'Aullador rojo' },
      logEntry: { id: 'l1', text: 'Gorhorn se topa con un aullador rojo, que le observa con cautela.', timeLabel: '', createdAt: '' },
    } as never)
    const onEncuentroZona = vi.fn()
    const { result } = renderHook(() => useMovimientoZona({ saveId: 's1', setData: vi.fn(), msPorPaso: 0, onEncuentroZona }))
    await act(async () => {
      await result.current.moverA({ x: 300, y: 0 })
    })
    expect(moverEnZona).toHaveBeenCalledTimes(1)
    expect(onEncuentroZona).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1', dynamicModeOffer: expect.objectContaining({ busy: false }) }))
    // QA-59 (P102, P103): el aviso del mapa es la frase del backend, con su artículo y quién vio a quién.
    expect(result.current.mensajeMovimiento).toBe('Gorhorn se topa con un aullador rojo, que le observa con cautela.')
    expect(result.current.destinoPendiente).toBeNull()
  })

  // QA-27 (P8): un aviso sin encuentro (recurso que aún no sabes aprovechar) se ve en el mapa.
  it('un aviso del backend sin encuentro se enseña en el mapa y entra en el diario', async () => {
    vi.mocked(moverEnZona).mockResolvedValue({
      jugador: { x: 50, y: 0 }, caminoRestante: [], zonePointsMovidos: [],
      logEntry: { id: 'l2', text: 'Gorhorn ve Colmena de Lebude cerca, pero todavía no sabe aprovecharlo.', timeLabel: '', createdAt: '' },
    } as never)
    vi.mocked(getZona).mockResolvedValue({ disponible: true } as never)
    const onEncuentroZona = vi.fn()
    const { result } = renderHook(() => useMovimientoZona({ saveId: 's1', setData: vi.fn(), msPorPaso: 0, onEncuentroZona }))
    await act(async () => {
      await result.current.moverA({ x: 50, y: 0 })
    })
    expect(onEncuentroZona).toHaveBeenCalledWith(expect.objectContaining({ id: 'l2', channel: 'character' }))
    expect(result.current.mensajeMovimiento).toContain('todavía no sabe aprovecharlo')
  })

  // P125/P133/P135 (QA-27): «Seguir mi camino» tras un encuentro.
  describe('«Seguir mi camino» tras un encuentro', () => {
    const recurso = (x: number, quedan: number) => ({
      jugador: { x, y: 0 }, caminoRestante: Array.from({ length: quedan }, () => ({ x: 0, y: 0 })), zonePointsMovidos: [],
      dynamicModeOffer: { tipo: 'RECURSO', targetSlug: 'murgoles', targetName: 'Múrgoles', quienInicia: 'jugador' },
      logEntry: { id: `l${x}`, text: 'Gorhorn encuentra Múrgoles domados cerca.', timeLabel: '', createdAt: '' },
    })
    const paso = (x: number, quedan: number) => ({ jugador: { x, y: 0 }, caminoRestante: Array.from({ length: quedan }, () => ({ x: 0, y: 0 })), zonePointsMovidos: [] })
    const usarEnMapa = () => renderHook(() => useMovimientoZona({ saveId: 's1', setData: vi.fn(), msPorPaso: 0, onEncuentroZona: vi.fn(), onEncuentroEnMapa: vi.fn() }))

    it('a medio camino: sigue andando y al llegar hace lo que esperaba (P125/P133)', async () => {
      vi.mocked(moverEnZona).mockResolvedValueOnce(recurso(50, 0) as never).mockResolvedValueOnce(paso(100, 1) as never).mockResolvedValueOnce(paso(150, 0) as never)
      vi.mocked(getZona).mockResolvedValue({ disponible: true } as never)
      const alLlegar = vi.fn()
      const { result } = usarEnMapa()
      await act(async () => {
        await result.current.moverA({ x: 175, y: 0 }, { alLlegar })
      })
      expect(alLlegar).not.toHaveBeenCalled()
      expect(result.current.destinoPendiente).toEqual({ x: 175, y: 0 })
      act(() => result.current.reanudar())
      await waitFor(() => expect(alLlegar).toHaveBeenCalledWith({ disponible: true }))
      expect(moverEnZona).toHaveBeenCalledTimes(3)
    })

    it('ya en el destino: no vuelve a pedir la casilla (que ofrecería lo mismo otra vez) y termina el viaje (P135)', async () => {
      vi.mocked(moverEnZona).mockResolvedValueOnce(recurso(150, 0) as never)
      vi.mocked(getZona).mockResolvedValue({ disponible: true } as never)
      const alLlegar = vi.fn()
      const { result } = usarEnMapa()
      await act(async () => {
        await result.current.moverA({ x: 175, y: 0 }, { alLlegar })
      })
      act(() => result.current.reanudar())
      await waitFor(() => expect(alLlegar).toHaveBeenCalledWith({ disponible: true }))
      expect(moverEnZona).toHaveBeenCalledTimes(1)
      expect(result.current.destinoPendiente).toBeNull()
    })

    it('la ruta acaba junto al punto pulsado (otra casilla): el backend dice que llegó y no se vuelve a pedir (P135)', async () => {
      // Clic en un pin a x=275, pero la ruta termina al lado (x=225): el encuentro sale en el último paso.
      vi.mocked(moverEnZona).mockResolvedValueOnce({ ...recurso(225, 0), llegado: true } as never)
      vi.mocked(getZona).mockResolvedValue({ disponible: true } as never)
      const alLlegar = vi.fn()
      const { result } = usarEnMapa()
      await act(async () => {
        await result.current.moverA({ x: 275, y: 0 }, { alLlegar })
      })
      act(() => result.current.reanudar())
      await waitFor(() => expect(alLlegar).toHaveBeenCalledWith({ disponible: true }))
      expect(moverEnZona).toHaveBeenCalledTimes(1)
    })

    it('un clic nuevo olvida la acción del trayecto anterior', async () => {
      vi.mocked(moverEnZona).mockResolvedValueOnce(recurso(50, 0) as never).mockResolvedValueOnce(paso(100, 0) as never)
      vi.mocked(getZona).mockResolvedValue({ disponible: true } as never)
      const alLlegar = vi.fn()
      const { result } = usarEnMapa()
      await act(async () => {
        await result.current.moverA({ x: 175, y: 0 }, { alLlegar })
      })
      await act(async () => {
        await result.current.moverA({ x: 100, y: 0 })
      })
      expect(alLlegar).not.toHaveBeenCalled()
    })
  })
})

