import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'

vi.mock('../../../lib/api', () => ({
  getGuerra: vi.fn(),
  getPartidas: vi.fn(),
  postTributo: vi.fn(),
  postAtacarAsentamiento: vi.fn(),
}))

import { getGuerra, getPartidas, postAtacarAsentamiento, postTributo } from '../../../lib/api'
import { GuerraSection } from './GuerraSection'

/// CR-37 (37c): la guerra en Reino › Defensa.
describe('GuerraSection (CR-37 37c)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('sin enemigos, lo dice', async () => {
    vi.mocked(getGuerra).mockResolvedValue({ enemigas: [] })
    vi.mocked(getPartidas).mockResolvedValue({ partidas: [], opciones: { origen: null, cazadores: [], grupos: [], destinos: [] } })
    const { findByText } = render(<GuerraSection saveId="s" onRefreshSave={async () => {}} />)
    expect(await findByText(/Nadie está en guerra/)).toBeTruthy()
  })

  it('tributo y contraataque con quien eliges', async () => {
    vi.mocked(getGuerra).mockResolvedValue({ enemigas: [{ id: 'f1', nombre: 'Clan Rival', relacion: 'GUERRA', presion: 90 }, { id: 'f2', nombre: 'Feg Ger', relacion: 'TENSION', presion: 70 }] })
    vi.mocked(getPartidas).mockResolvedValue({ partidas: [], opciones: { origen: null, cazadores: [], grupos: [], destinos: [] }, guerreros: [{ id: 's1', name: 'Brog', rol: 'soldado' }] })
    vi.mocked(postTributo).mockResolvedValue({ ok: true, pagado: 100, relacion: 'GUERRA' })
    vi.mocked(postAtacarAsentamiento).mockResolvedValue({ ok: true, id: 'v1' })
    const { findByText, getAllByRole, getByRole, getByLabelText } = render(<GuerraSection saveId="s" onRefreshSave={async () => {}} />)
    expect(await findByText('Clan Rival')).toBeTruthy()
    // Solo a quien está en guerra se le puede atacar.
    expect(getAllByRole('button', { name: /Atacar su casa/ })).toHaveLength(1)
    await act(async () => {
      fireEvent.click(getAllByRole('button', { name: 'Tributo de 100' })[1]!)
    })
    expect(postTributo).toHaveBeenCalledWith('s', 'f2', 100)
    fireEvent.click(getByLabelText('Brog al contraataque'))
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Atacar su casa (1)' }))
    })
    expect(postAtacarAsentamiento).toHaveBeenCalledWith('s', 'f1', { companionIds: [], subjectIds: ['s1'] })
  })
})
