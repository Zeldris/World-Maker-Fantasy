import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'

vi.mock('../../lib/api', () => ({
  getViajerosAqui: vi.fn(),
  postPreguntarViajero: vi.fn(),
  postComprarAViajero: vi.fn(),
  postOrdenPartida: vi.fn(),
  postVenderAViajero: vi.fn(),
}))

import { getViajerosAqui, postComprarAViajero, postOrdenPartida, postPreguntarViajero, postVenderAViajero } from '../../lib/api'
import { ViajerosAqui } from './ViajerosAqui'

/// CR-63 (63e): «De paso por aquí».
describe('ViajerosAqui (CR-63 63e)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('sin nadie de paso no pinta nada', async () => {
    vi.mocked(getViajerosAqui).mockResolvedValue({ viajeros: [] })
    const { container } = render(<ViajerosAqui saveId="s" lugar="La Hondonada" />)
    await act(async () => {})
    expect(container.textContent).toBe('')
  })

  it('pregunta, compra a los de otra facción y hace volver a la tuya', async () => {
    vi.mocked(getViajerosAqui).mockResolvedValue({
      viajeros: [
        { id: 'a', propia: false, quien: 'Clan Serhu', tipo: 'CAZA', que: 'partida de caza de Múrgol', estado: 'VUELTA', gente: 8, piezas: 3 },
        { id: 'b', propia: true, quien: 'tu Reino', tipo: 'CAZA', que: 'partida de caza de Jusha', estado: 'IDA', gente: 4, piezas: 0 },
      ],
      vendibles: [{ id: 'i1', name: 'Pan de trigo escarlata', precio: 4 }],
    })
    vi.mocked(postVenderAViajero).mockResolvedValue({ ok: true, precio: 4 })
    vi.mocked(postPreguntarViajero).mockResolvedValue({ ok: true, lineas: ['Día 12, La Hondonada: 5 Múrgol.'] })
    vi.mocked(postComprarAViajero).mockResolvedValue({ ok: true, items: ['Ración de carne fresca'], precio: 6 })
    vi.mocked(postOrdenPartida).mockResolvedValue({ ok: true })
    const { findByText, getAllByRole, getByRole } = render(<ViajerosAqui saveId="s" lugar="La Hondonada" />)
    expect(await findByText(/La de Clan Serhu: partida de caza de Múrgol/)).toBeTruthy()
    await act(async () => {
      fireEvent.click(getAllByRole('button', { name: 'Preguntar' })[0]!)
    })
    expect(postPreguntarViajero).toHaveBeenCalledWith('s', 'a')
    expect(await findByText('Día 12, La Hondonada: 5 Múrgol.')).toBeTruthy()
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Comprar carne' }))
    })
    expect(postComprarAViajero).toHaveBeenCalledWith('s', 'a')
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Volver a casa' }))
    })
    expect(postOrdenPartida).toHaveBeenCalledWith('s', 'b', 'volver')
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Vender' }))
    })
    expect(postVenderAViajero).toHaveBeenCalledWith('s', 'a', 'i1')
  })
})
