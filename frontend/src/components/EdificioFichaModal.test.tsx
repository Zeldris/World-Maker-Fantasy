import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'

vi.mock('../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/api')>()), getFichaEdificio: vi.fn() }))
import { getFichaEdificio, type ZonePointInfo } from '../lib/api'
import { EdificioFichaModal } from './EdificioFichaModal'

const punto = { id: 'p1', x: 180, y: 300, tipo: 'EDIFICIO', targetSlug: 'herreria-serhu', nombre: 'Herrería del Clan Serhu', cantidad: 1, color: 'NEUTRO', descubierto: true, faccion: 'Clan Serhu' } as unknown as ZonePointInfo

/// P178 (QA-27): «Ver ficha completa» de un edificio solo daba su nombre y la distancia.
describe('EdificioFichaModal', () => {
  afterEach(cleanup)

  it('enseña de quién es, cómo está, quién lo lleva y qué ofrece; Interactuar llama al dueño', async () => {
    vi.mocked(getFichaEdificio).mockResolvedValue({
      zonePointId: 'p1', nombre: 'Herrería del Clan Serhu', descripcion: 'Fragua orca.', nivel: 1, faccion: 'Clan Serhu', estado: 'En pie', detallesEstado: ['1 asalto perdido'],
      encargado: { slug: 'maestro-herrero-serhu', nombre: 'Orco desconocido', aqui: true },
      ofrece: [{ label: 'Encargos', disponible: true }, { label: 'Comerciar', disponible: false, motivo: 'Llega con el comercio en persona' }],
    })
    const onInteractuar = vi.fn()
    render(<EdificioFichaModal saveId="s" point={punto} onClose={() => {}} onInteractuar={onInteractuar} />)
    await waitFor(() => expect(screen.getByText('En pie')).toBeTruthy())
    expect(screen.getByText('Edificio · nivel 1')).toBeTruthy()
    expect(screen.getByText('1 asalto perdido')).toBeTruthy()
    expect(screen.getByText('Orco desconocido')).toBeTruthy()
    expect(screen.getByText(/está aquí/)).toBeTruthy()
    expect(screen.getByText(/Llega con el comercio en persona/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Interactuar' }))
    expect(onInteractuar).toHaveBeenCalled()
  })

  it('lejos del edificio, «Ir hasta aquí» en vez de Interactuar', async () => {
    vi.mocked(getFichaEdificio).mockResolvedValue({ zonePointId: 'p1', nombre: 'Herrería del Clan Serhu', descripcion: null, nivel: null, faccion: null, estado: 'Caído', detallesEstado: [], encargado: null, ofrece: [] })
    render(<EdificioFichaModal saveId="s" point={punto} onClose={() => {}} onIrHasta={() => {}} />)
    await waitFor(() => expect(screen.getByText('Caído')).toBeTruthy())
    expect(screen.getByText('Nadie se ocupa de él.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Interactuar' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Ir hasta aquí' })).toBeTruthy()
  })
})
