import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, within } from '@testing-library/react'

vi.mock('../../lib/api', () => ({ getLeyendas: vi.fn() }))
import { getLeyendas, type EntradaLeyenda } from '../../lib/api'
import { LeyendasPanel } from './LeyendasPanel'

/// CR-20 / PAN-9b (hito 0.2) — Leyendas: solo lo que sabe el personaje, por secciones, con causas.
describe('LeyendasPanel', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })
  const dia = (d: number) => (d - 1) * 1440 + 600
  const base: EntradaLeyenda = {
    sucesoId: 'x', tipo: 'ALIANZA', familia: 'DIPLOMACIA', nivel: 'NORMAL', texto: 't', rumor: false, via: 'NPC', sabidoEn: dia(1),
    region: null, cuando: dia(1), fecha: null, lugar: null, actores: [], causas: [],
  }
  const serhu = { tipo: 'FACCION', id: 'clan-serhu', nombre: 'Clan Serhu', papel: 'AUTOR' }
  const entradas: EntradaLeyenda[] = [
    { ...base, sucesoId: 'rumor', rumor: true, via: 'OIDAS', cuando: null, sabidoEn: dia(6), texto: 'Se dice que algo pasó en la Ciénaga.', region: 'Ciénaga Troncal' },
    { ...base, sucesoId: 'guerra', nivel: 'GRAVE', cuando: dia(5), texto: 'Clan Serhu declara la guerra a Clan Helsig.', actores: [serhu], causas: ['tregua'] },
    { ...base, sucesoId: 'tregua', nivel: 'DESTACADO', cuando: dia(2), texto: 'Clan Serhu rompe la tregua.', actores: [serhu] },
    { ...base, sucesoId: 'lluvia', familia: 'CLIMA', cuando: dia(2), texto: 'Llueve sobre las Llanuras.' },
  ]

  it('crónica por días, con el rumor marcado y las causas para volver a ellas', async () => {
    vi.mocked(getLeyendas).mockResolvedValue({ entradas, hayMas: false, siguiente: null })
    const { findByRole, getByRole, container } = render(<LeyendasPanel saveId="s1" />)
    const dia5 = await findByRole('region', { name: 'Día 5' })
    expect(dia5.textContent).toContain('declara la guerra')
    expect(getByRole('region', { name: 'Día 6' }).textContent).toContain('Rumor · lo supiste el día 6')
    expect(container.querySelector('[data-nivel="GRAVE"] [aria-label="Suceso grave"]')).toBeTruthy()
    fireEvent.click(within(dia5).getByRole('button', { name: /Día 2/ }))
    expect(container.querySelector('#leyenda-tregua')?.className).toContain('ring-1')
  })

  it('filtra por familia y agrupa por facción; la línea temporal solo trae lo que marca la historia', async () => {
    vi.mocked(getLeyendas).mockResolvedValue({ entradas, hayMas: false, siguiente: null })
    const { findByRole, getByRole, queryByText, getByText } = render(<LeyendasPanel saveId="s1" />)
    await findByRole('region', { name: 'Día 5' })
    fireEvent.click(getByRole('button', { name: /Clima/ }))
    expect(queryByText(/declara la guerra/)).toBeNull()
    expect(getByText('Llueve sobre las Llanuras.')).toBeTruthy()
    fireEvent.click(getByRole('button', { name: 'Todo' }))
    fireEvent.click(getByRole('button', { name: 'Facciones' }))
    expect(getByText('Clan Serhu')).toBeTruthy()
    fireEvent.click(getByRole('button', { name: 'Línea temporal' }))
    const linea = getByRole('list', { name: 'Línea temporal' })
    expect(within(linea).getAllByRole('listitem').map((li) => li.id)).toEqual(['leyenda-tregua', 'leyenda-guerra'])
  })

  it('sin nada sabido, lo dice', async () => {
    vi.mocked(getLeyendas).mockResolvedValue({ entradas: [], hayMas: false, siguiente: null })
    const { findByText } = render(<LeyendasPanel saveId="s1" />)
    expect(await findByText('Aún no hay leyendas')).toBeTruthy()
  })

  // /code-review: más de una página y «Ver en Leyendas» desde una noticia.
  it('«Ver más antiguas» pide la página siguiente con el cursor y la añade', async () => {
    vi.mocked(getLeyendas)
      .mockResolvedValueOnce({ entradas: [entradas[1]!], hayMas: true, siguiente: 'c1' })
      .mockResolvedValueOnce({ entradas: [entradas[2]!], hayMas: false, siguiente: null })
    const { findByRole, getByRole, queryByRole } = render(<LeyendasPanel saveId="s1" />)
    fireEvent.click(await findByRole('button', { name: 'Ver más antiguas' }))
    expect(await findByRole('region', { name: 'Día 2' })).toBeTruthy()
    expect(getLeyendas).toHaveBeenLastCalledWith('s1', { cursor: 'c1' })
    expect(getByRole('region', { name: 'Día 5' })).toBeTruthy()
    expect(queryByRole('button', { name: 'Ver más antiguas' })).toBeNull()
  })

  it('abierto desde una noticia, señala la entrada de su suceso', async () => {
    vi.mocked(getLeyendas).mockResolvedValue({ entradas, hayMas: false, siguiente: null })
    const { findByRole, container } = render(<LeyendasPanel saveId="s1" irAlSuceso="tregua" />)
    await findByRole('region', { name: 'Día 5' })
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    expect(container.querySelector('#leyenda-tregua')?.className).toContain('ring-1')
  })
})

