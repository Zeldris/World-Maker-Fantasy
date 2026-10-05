import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

vi.mock('../lib/api', () => ({ getLeyendasFicha: vi.fn() }))
import { getLeyendasFicha, type EntradaLeyenda } from '../lib/api'
import { EnTuPartida } from './EnTuPartida'

/// CR-20 (20b) — «En tu partida» en una ficha de la Enciclopedia: solo si el personaje sabe algo.
describe('EnTuPartida', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })
  const entrada: EntradaLeyenda = {
    sucesoId: 'g', tipo: 'GUERRA_DECLARADA', familia: 'DIPLOMACIA', nivel: 'GRAVE', texto: 'Clan Serhu declara la guerra a Clan Helsig.', rumor: false, via: 'NPC',
    sabidoEn: 600, region: null, cuando: 600, fecha: null, lugar: null, actores: [], causas: ['otra'],
  }

  it('lista lo sabido de la ficha, con la causa nombrada pero sin enlace', async () => {
    vi.mocked(getLeyendasFicha).mockResolvedValue({ entradas: [entrada] })
    const { findByRole, queryByRole } = render(<EnTuPartida saveId="s1" ficha="faction" slug="clan-serhu" />)
    const seccion = await findByRole('region', { name: 'En tu partida' })
    expect(seccion.textContent).toContain('declara la guerra')
    expect(seccion.textContent).toContain('Por qué pasó:')
    expect(queryByRole('button')).toBeNull()
    expect(getLeyendasFicha).toHaveBeenCalledWith('s1', 'faction', 'clan-serhu')
  })

  it('sin nada sabido no aparece', async () => {
    vi.mocked(getLeyendasFicha).mockResolvedValue({ entradas: [] })
    const { container } = render(<EnTuPartida saveId="s1" ficha="npc" slug="nadie" />)
    await Promise.resolve()
    expect(container.textContent).toBe('')
  })
})
