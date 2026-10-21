import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'

vi.mock('../../../lib/api', () => ({
  getDefensa: vi.fn(),
  postEquiposMilicia: vi.fn(),
  postGuarnicion: vi.fn(),
  postLlamarMilicia: vi.fn(),
  postRepararEdificio: vi.fn(),
  getGuerra: vi.fn().mockResolvedValue({ enemigas: [] }),
  getPartidas: vi.fn().mockResolvedValue({ partidas: [], opciones: { origen: null, cazadores: [], grupos: [], destinos: [] } }),
  postTributo: vi.fn(),
  postAtacarAsentamiento: vi.fn(),
}))

import { getDefensa, postEquiposMilicia, postLlamarMilicia, postRepararEdificio, type AsentamientoDefensa } from '../../../lib/api'
import { DefensaSection, efectoDeModulo } from './DefensaSection'

/// CR-65 (65f): Reino › Defensa.
const capital: AsentamientoDefensa = {
  id: 'cap', nombre: 'Karot Veku', capital: true, region: 'Llanuras', locationId: 'l1',
  modulos: [
    { id: 'emp', modulo: 'empalizada', nombre: 'un muro de piedra', escalon: 2, golpes: 2, caida: true, equiposMilicia: 0 },
    { id: 'arm', modulo: 'armeria', nombre: 'una armería', escalon: 1, golpes: 0, caida: false, equiposMilicia: 3 },
    { id: 'tor', modulo: 'torre-vigia', nombre: 'una torre de vigía', escalon: 1, golpes: 0, caida: false, equiposMilicia: 0 },
  ],
  guarnicion: [{ id: 's1', nombre: 'Brog', rol: 'vigia' }],
  efecto: { cobertura: 0, radioTramos: 1, bonoAltura: 2, equiposMilicia: 5, plazasGuarnicion: 3, bonoMoral: 0, aguante: 2 },
}

describe('DefensaSection (CR-65 65f)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('cada módulo dice lo que da', () => {
    expect(efectoDeModulo(capital.modulos[0]!, capital)).toBe('caída: no cubre hasta repararla')
    expect(efectoDeModulo({ ...capital.modulos[0]!, caida: false }, { ...capital, efecto: { ...capital.efecto, cobertura: 2 } })).toBe('cobertura +2 · ha encajado 2 de 2 asaltos')
    expect(efectoDeModulo(capital.modulos[1]!, capital)).toBe('3 de 5 equipos de milicia')
    expect(efectoDeModulo(capital.modulos[2]!, capital)).toBe('ve 1 tramo de camino · +2 al tirar desde lo alto')
    // P296: una Empalizada dañada se lista como caída y lo dice.
    expect(efectoDeModulo({ ...capital.modulos[0]!, danado: true }, capital)).toBe('dañada: no cubre hasta repararla')
  })

  it('P284: con el Ayuntamiento dañado no dice «necesita un Ayuntamiento», dice que lo repares; y un módulo dañado se puede reparar', async () => {
    vi.mocked(getDefensa).mockResolvedValue({ asentamientos: [], avistados: [], danados: [{ id: 'ayu', nombre: 'Karot Veku' }] })
    const { findByText, queryByText } = render(<DefensaSection saveId="s" onRefreshSave={async () => {}} />)
    expect(await findByText(/Karot Veku está dañado y no defiende: repáralo en la pestaña Edificios/)).toBeTruthy()
    expect(queryByText(/necesita un Ayuntamiento para defenderse/)).toBeNull()
    cleanup()
    const torreDanada: AsentamientoDefensa = { ...capital, modulos: [{ id: 'tor', modulo: 'torre-vigia', nombre: 'torre', escalon: 1, golpes: 0, caida: false, danado: true, equiposMilicia: 0 }] }
    vi.mocked(getDefensa).mockResolvedValue({ asentamientos: [torreDanada], avistados: [] })
    vi.mocked(postRepararEdificio).mockResolvedValue({ ok: true, coste: 4 })
    const r = render(<DefensaSection saveId="s" onRefreshSave={async () => {}} />)
    const boton = await r.findByRole('button', { name: 'Reparar' })
    await act(async () => {
      fireEvent.click(boton)
    })
    expect(postRepararEdificio).toHaveBeenCalledWith('s', 'tor')
  })

  it('P295: sin milicia posible, el botón se desactiva y dice por qué', async () => {
    vi.mocked(getDefensa).mockResolvedValue({ asentamientos: [capital], avistados: [{ asentamientoId: 'cap', asentamiento: 'Karot Veku', viajeroId: 'v1', quien: 'Bandidos', gente: 6, tramos: 1, sinMilicia: 'No hay trabajadores adultos que armar.' }] })
    const { findByRole, getAllByText } = render(<DefensaSection saveId="s" onRefreshSave={async () => {}} />)
    const boton = (await findByRole('button', { name: 'Llamar a la milicia' })) as HTMLButtonElement
    expect(boton.disabled).toBe(true)
    expect(getAllByText('No hay trabajadores adultos que armar.').length).toBeGreaterThan(0)
  })

  it('alerta de asalto con «Llamar a la milicia»; reparar y comprar equipo', async () => {
    vi.mocked(getDefensa).mockResolvedValue({ asentamientos: [capital], avistados: [{ asentamientoId: 'cap', asentamiento: 'Karot Veku', viajeroId: 'v1', quien: 'Bandidos', gente: 6, tramos: 1 }] })
    vi.mocked(postLlamarMilicia).mockResolvedValue({ ok: true, armados: 3 })
    vi.mocked(postRepararEdificio).mockResolvedValue({ ok: true, coste: 0 })
    vi.mocked(postEquiposMilicia).mockResolvedValue({ ok: true, comprados: 1 })
    const { findByRole, getByRole, getByText } = render(<DefensaSection saveId="s" onRefreshSave={async () => {}} />)
    const alerta = await findByRole('alert', { name: 'Asaltos a la vista' })
    expect(alerta.textContent).toContain('Bandidos: 6 a 1 tramo de Karot Veku')
    expect(getByText(/Guarnición 1\/3: Brog \(vigía\)/)).toBeTruthy()
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Llamar a la milicia' }))
    })
    expect(postLlamarMilicia).toHaveBeenCalledWith('s', 'cap')
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Reparar' }))
    })
    expect(postRepararEdificio).toHaveBeenCalledWith('s', 'emp')
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Comprar un equipo' }))
    })
    expect(postEquiposMilicia).toHaveBeenCalledWith('s', 'arm', 1)
  })
})
