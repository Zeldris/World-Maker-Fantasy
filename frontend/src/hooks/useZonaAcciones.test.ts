import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../lib/api', () => ({ cazarEnZona: vi.fn() }))
import { cazarEnZona } from '../lib/api'
import { useZonaAcciones } from './useZonaAcciones'

/// P9 (QA-27): el mapa de zona se cierra cuando la caza sale; para eso el hook dice si salió.
describe('P9 — handleCazarEnZona dice si la caza salió', () => {
  const params = () => ({
    saveId: 's1',
    setCharacterLog: vi.fn(),
    setCombateIniciado: vi.fn(),
    openCombat: vi.fn(),
    handleSubmit: vi.fn(),
  })
  beforeEach(() => {
    vi.mocked(cazarEnZona).mockReset()
  })

  it('true si la caza sale (y manda el texto por el turno normal)', async () => {
    vi.mocked(cazarEnZona).mockResolvedValue({ resuelveSinCombate: false, actionText: 'Cazo al Guchapo' } as never)
    const p = params()
    const { result } = renderHook(() => useZonaAcciones(p))
    let salio = false
    await act(async () => {
      salio = await result.current.handleCazarEnZona('e1', 'zp1')
    })
    expect(salio).toBe(true)
    expect(p.handleSubmit).toHaveBeenCalledWith('Cazo al Guchapo', { accionEnDiario: undefined })
  })

  it('false si falla (el mapa sigue abierto con el error en la tarjeta)', async () => {
    vi.mocked(cazarEnZona).mockImplementation(async () => {
      throw new Error('Ya no está aquí')
    })
    const p = params()
    const { result } = renderHook(() => useZonaAcciones(p))
    let salio = true
    await act(async () => {
      salio = await result.current.handleCazarEnZona('e1', 'zp1')
    })
    expect(salio).toBe(false)
    expect(p.handleSubmit).not.toHaveBeenCalled()
  })

  it('al reintentar, el error anterior de la tarjeta se limpia mientras espera (leve P310)', async () => {
    vi.mocked(cazarEnZona).mockReturnValue(new Promise(() => undefined))
    const p = params()
    const { result } = renderHook(() => useZonaAcciones(p))
    act(() => {
      void result.current.handleCazarEnZona('e1', 'zp1')
    })
    const actualizar = p.setCharacterLog.mock.calls[0][0] as (prev: unknown[]) => Array<{ dynamicModeOffer?: Record<string, unknown> }>
    const [entrada] = actualizar([{ id: 'e1', dynamicModeOffer: { busy: false, error: 'Ya no está aquí' } }])
    expect(entrada.dynamicModeOffer).toMatchObject({ busy: true, error: undefined })
  })
})
