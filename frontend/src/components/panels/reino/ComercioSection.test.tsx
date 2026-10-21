import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../../lib/api', () => ({ getComercio: vi.fn(), postOrdenComercio: vi.fn(), deleteOrdenComercio: vi.fn() }))
import { getComercio, postOrdenComercio } from '../../../lib/api'
import { ComercioSection } from './ComercioSection'

const base = {
  reino: true,
  mercado: true,
  socios: [{ slug: 'clan-helsig', name: 'Clan Helsig' }],
  objetos: [{ slug: 'hierro', name: 'Hierro' }],
  ordenes: [],
  caravanas: [{ id: 'c1', tipo: 'COMPRA' as const, nombre: 'Hierro', faccion: 'Clan Helsig', unidades: 5, traidas: 0, riqueza: 40, status: 'EN_CAMINO' as const, diaRegreso: 4 }],
}

/// CR-47 (47d): el Mercado del Reino.
describe('ComercioSection', () => {
  beforeEach(() => vi.mocked(getComercio).mockReset())
  afterEach(cleanup)

  it('sin Mercado pide construirlo', async () => {
    vi.mocked(getComercio).mockResolvedValue({ ...base, mercado: false })
    const { findByText } = render(<ComercioSection saveId="s1" />)
    expect(await findByText('Sin Mercado')).toBeTruthy()
  })

  it('P287: con el Mercado dañado dice que lo repares, no que lo construyas', async () => {
    vi.mocked(getComercio).mockResolvedValue({ ...base, mercado: false, mercadoDanado: true })
    const { findByText } = render(<ComercioSection saveId="s1" />)
    expect(await findByText('Mercado dañado')).toBeTruthy()
    expect(await findByText(/repáralo/)).toBeTruthy()
  })

  it('deja una orden con lo elegido y enseña las caravanas', async () => {
    vi.mocked(getComercio).mockResolvedValue(base)
    vi.mocked(postOrdenComercio).mockResolvedValue({ orden: {} as never })
    const { findByRole, getByRole } = render(<ComercioSection saveId="s1" />)
    const form = await findByRole('form', { name: 'Nueva orden' })
    expect(getByRole('list', { name: 'Caravanas' }).textContent).toContain('vuelve el día 5')
    fireEvent.submit(form)
    await waitFor(() => expect(postOrdenComercio).toHaveBeenCalledWith('s1', { catalogSlug: 'hierro', tipo: 'COMPRA', umbral: 20, lote: 5, factionSlug: null }))
  })
})
