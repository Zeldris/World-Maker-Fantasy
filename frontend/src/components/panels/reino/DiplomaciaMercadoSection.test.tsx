import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'

vi.mock('../../../lib/api', () => ({
  getMercado: vi.fn(),
  postDiplomacia: vi.fn(),
  postMercadoComprar: vi.fn(),
  postMercadoVender: vi.fn(),
}))

import { getMercado, postDiplomacia } from '../../../lib/api'
import { DiplomaciaMercadoSection } from './DiplomaciaMercadoSection'
import type { CompanionInfo } from '../../../types'
import type { EnciclopediaFaccionInfo } from '../../../lib/api'

/// REI-116 (hito 0.1, roadmap-front-reino.md R4) — la XP y el nivel del diplomático y la etapa de la
/// relación llegaban del backend sin enseñarse.
const faccion = { slug: 'serhu', name: 'Serhu', discovered: true, raza: 'orco', liderNpc: null } as unknown as EnciclopediaFaccionInfo
const ana = { id: 'c1', name: 'Ana', rolReino: 'diplomatico' } as unknown as CompanionInfo

describe('DiplomaciaMercadoSection — REI-116', () => {
  beforeEach(() => {
    vi.mocked(getMercado).mockResolvedValue({ tratado: false, items: [] } as never)
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  async function abrirFaccion() {
    const utils = render(<DiplomaciaMercadoSection saveId="s1" companions={[ana]} factions={[faccion]} goirnos={0} onRefreshSave={async () => {}} />)
    await act(async () => {
      fireEvent.click(utils.getByRole('button', { name: /Serhu/ }))
    })
    return utils
  }

  it('negociar con éxito enseña la XP ganada y el nivel del diplomático', async () => {
    vi.mocked(postDiplomacia).mockResolvedValue({ ok: true, accion: 'negociar', targetFaction: 'Serhu', hechoDeMundo: 'Ana cierra un acuerdo.', xpGanada: 40, nivelDiplomatico: 2 })
    const { getByRole, getByText } = await abrirFaccion()
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Negociar' }))
    })
    expect(getByText('+40 XP de diplomacia · Ana: diplomático nivel 2')).toBeTruthy()
  })

  it('espiar enseña la presión con su barra y la etapa de la relación', async () => {
    vi.mocked(postDiplomacia).mockResolvedValue({ ok: true, accion: 'espiar', targetFaction: 'Serhu', hechoDeMundo: null, presion: 72, type: 'TENSION', stage: 1 })
    const { getByRole, getByText } = await abrirFaccion()
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Espiar' }))
    })
    expect(getByText('Presión 72 / 100')).toBeTruthy()
    expect(getByText('Etapa 1 de 4')).toBeTruthy()
    expect(getByRole('meter', { name: 'Presión entre facciones' }).getAttribute('aria-valuenow')).toBe('72')
  })
})
