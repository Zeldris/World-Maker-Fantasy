import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'

vi.mock('../../../lib/api', () => ({
  getPartidas: vi.fn(),
  postLanzarPartida: vi.fn(),
  postOrdenPartida: vi.fn(),
}))

import { getPartidas, postLanzarPartida, postOrdenPartida, type OpcionesPartida, type PartidaInfo } from '../../../lib/api'
import { cargaDePartida, lineaDePartida, PartidasSection } from './PartidasSection'

/// CR-63 (63d): Reino › Partidas.
const partida: PartidaInfo = {
  id: 'v1', tipo: 'CAZA', estado: 'IDA', especie: 'murgol', especieNombre: 'Múrgol', ubicacion: 'Los Pilares', destino: 'La Hondonada',
  permanente: true, miembros: ['Brakka', 'Doru'], carga: null,
}
const opciones: OpcionesPartida = {
  origen: { id: 'casa', name: 'Karot Veku' },
  cazadores: [{ id: 's1', name: 'Urga' }],
  grupos: [{ slotIndex: 1, nombre: 'Grupo 2', companeros: [{ id: 'c1', name: 'Ana' }] }],
  destinos: [{ id: 'coto', name: 'La Hondonada', region: 'Llanuras', especies: [{ slug: 'murgol', name: 'Múrgol', cantidad: 12, capturable: true }] }],
}

describe('PartidasSection (CR-63 63d)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('líneas de una partida y de lo que trae', () => {
    expect(lineaDePartida(partida)).toBe('Caza de Múrgol · de camino, en Los Pilares → La Hondonada')
    expect(lineaDePartida({ ...partida, estado: 'TERMINADO' })).toBe('Caza de Múrgol · en casa')
    expect(cargaDePartida({ ...partida, carga: { piezas: 3, capturados: 1 } })).toBe('Trae 3 piezas y 1 atado')
    expect(cargaDePartida(partida)).toBeNull()
    // P283: la que ya volvió dice desde qué día está en casa.
    expect(lineaDePartida({ ...partida, estado: 'TERMINADO', vueltaDia: 12 })).toBe('Caza de Múrgol · en casa desde el día 12')
  })

  it('lista las que están fuera con sus órdenes y lanza una nueva con quien eliges', async () => {
    vi.mocked(getPartidas).mockResolvedValue({ partidas: [partida], opciones })
    vi.mocked(postOrdenPartida).mockResolvedValue({ ok: true })
    vi.mocked(postLanzarPartida).mockResolvedValue({ ok: true, id: 'v2' })
    const { findByText, getByRole, getByLabelText } = render(<PartidasSection saveId="s" onRefreshSave={async () => {}} />)
    expect(await findByText('Caza de Múrgol · de camino, en Los Pilares → La Hondonada')).toBeTruthy()
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'No repetir' }))
    })
    expect(postOrdenPartida).toHaveBeenCalledWith('s', 'v1', 'parar')
    fireEvent.click(getByLabelText('Ana'))
    fireEvent.click(getByLabelText('Urga'))
    fireEvent.click(getByLabelText(/Orden permanente/))
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Lanzar partida (2)' }))
    })
    expect(postLanzarPartida).toHaveBeenCalledWith('s', { tipo: 'CAZA', especie: 'murgol', destinoLocationId: 'coto', companionIds: ['c1'], subjectIds: ['s1'], permanente: true })
  })

  it('sin nadie libre lo dice', async () => {
    vi.mocked(getPartidas).mockResolvedValue({ partidas: [], opciones: { ...opciones, cazadores: [], grupos: [] } })
    const { findByText } = render(<PartidasSection saveId="s" onRefreshSave={async () => {}} />)
    expect(await findByText(/No hay nadie libre/)).toBeTruthy()
  })

  it('P283: con los cazadores fuera no dice que no hay nadie', async () => {
    vi.mocked(getPartidas).mockResolvedValue({ partidas: [partida], opciones: { ...opciones, cazadores: [], grupos: [], cazadoresFuera: ['Urga'] } })
    const { findByText, queryByText } = render(<PartidasSection saveId="s" onRefreshSave={async () => {}} />)
    expect(await findByText(/Tus cazadores \(Urga\) están fuera/)).toBeTruthy()
    expect(queryByText(/No hay nadie libre/)).toBeNull()
  })

  it('P281: un cazador sin arma se avisa y no se puede mandar', async () => {
    vi.mocked(getPartidas).mockResolvedValue({ partidas: [], opciones: { ...opciones, grupos: [], cazadores: [{ id: 's1', name: 'Urga', sinArma: true }] } })
    const { findByRole, getByLabelText } = render(<PartidasSection saveId="s" onRefreshSave={async () => {}} />)
    expect((await findByRole('status')).textContent).toMatch(/Urga no tiene arma/)
    expect((getByLabelText(/Urga/) as HTMLInputElement).disabled).toBe(true)
  })
})
