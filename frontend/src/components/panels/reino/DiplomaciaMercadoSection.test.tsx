import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'

vi.mock('../../../lib/api', () => ({
  getMercado: vi.fn(),
  getVasallajes: vi.fn(),
  postDiplomacia: vi.fn(),
  postMercadoComprar: vi.fn(),
  postMercadoVender: vi.fn(),
}))

import { getMercado, getVasallajes, postDiplomacia } from '../../../lib/api'
import { DiplomaciaMercadoSection } from './DiplomaciaMercadoSection'
import type { CompanionInfo } from '../../../types'
import type { EnciclopediaFaccionInfo } from '../../../lib/api'
import { ModoConsultaContext } from '../../../context/modoConsultaContext'

/// REI-116 (hito 0.1, roadmap-front-reino.md R4) — la XP y el nivel del diplomático y la etapa de la
/// relación llegaban del backend sin enseñarse.
const faccion = { slug: 'serhu', name: 'Serhu', discovered: true, raza: 'orco', liderNpc: null } as unknown as EnciclopediaFaccionInfo
const ana = { id: 'c1', name: 'Ana', rolReino: 'diplomatico' } as unknown as CompanionInfo

describe('DiplomaciaMercadoSection — REI-116', () => {
  beforeEach(() => {
    vi.mocked(getMercado).mockResolvedValue({ tratado: false, items: [] } as never)
    vi.mocked(getVasallajes).mockResolvedValue({ vasallajes: [] })
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

  it('UX-5 (hito 0.2): en modo consulta las acciones de diplomacia se deshabilitan con el motivo', async () => {
    const utils = render(
      <ModoConsultaContext.Provider value="El narrador todavía está escribiendo.">
        <DiplomaciaMercadoSection saveId="s1" companions={[ana]} factions={[faccion]} goirnos={0} onRefreshSave={async () => {}} />
      </ModoConsultaContext.Provider>,
    )
    await act(async () => {
      fireEvent.click(utils.getByRole('button', { name: /Serhu/ }))
    })
    const negociar = utils.getByRole('button', { name: 'Negociar' }) as HTMLButtonElement
    expect(negociar.disabled).toBe(true)
    expect(negociar.title).toBe('El narrador todavía está escribiendo.')
    fireEvent.click(negociar)
    expect(postDiplomacia).not.toHaveBeenCalled()
  })
})

describe('DiplomaciaMercadoSection — P286/P297 vasallajes', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('enseña si el vasallaje está impagado, su cuota y la próxima revisión', async () => {
    vi.mocked(getVasallajes).mockResolvedValue({
      vasallajes: [{ vasalloSlug: 'clan-serhu', vasalloNombre: 'Clan Serhu', senorSlug: 'concordia-de-hierro', senorNombre: 'Concordia de Hierro', deuda: 1248, alCorriente: false, porcentajePagado: 0, cuota: 1248, sobreprecioArmas: 2, patrullaGuerreros: 20, proximaRevision: 46, rotoEn: null, motivoRuptura: null }],
    })
    let utils!: ReturnType<typeof render>
    await act(async () => {
      utils = render(<DiplomaciaMercadoSection saveId="s1" companions={[ana]} factions={[faccion]} goirnos={0} onRefreshSave={async () => {}} />)
    })
    expect(utils.getByText('Clan Serhu es vasallo de Concordia de Hierro')).toBeTruthy()
    expect(utils.getByText('Impagado: patrullas suspendidas')).toBeTruthy()
    expect(utils.container.textContent).toContain('próxima revisión: día 46')
    expect(utils.container.textContent).toContain('cuota de 1248 Goirnos')
    expect(utils.container.textContent).toContain('patrulla obligada de 20 guerreros')
  })

  it('con pago parcial dice el porcentaje y las patrullas en proporción', async () => {
    vi.mocked(getVasallajes).mockResolvedValue({
      vasallajes: [{ vasalloSlug: 'clan-serhu', vasalloNombre: 'Clan Serhu', senorSlug: 'concordia-de-hierro', senorNombre: 'Concordia de Hierro', deuda: 749, alCorriente: false, porcentajePagado: 40, cuota: 1248, sobreprecioArmas: 2, patrullaGuerreros: 20, proximaRevision: 46, rotoEn: null, motivoRuptura: null }],
    })
    let utils!: ReturnType<typeof render>
    await act(async () => {
      utils = render(<DiplomaciaMercadoSection saveId="s1" companions={[ana]} factions={[faccion]} goirnos={0} onRefreshSave={async () => {}} />)
    })
    expect(utils.container.textContent).toContain('Pago parcial 40 %: patrullas al 40 %')
  })

  it('sin facciones descubiertas la tarjeta de vasallajes sale igual', async () => {
    vi.mocked(getVasallajes).mockResolvedValue({
      vasallajes: [{ vasalloSlug: 'clan-serhu', vasalloNombre: 'Clan Serhu', senorSlug: 'concordia-de-hierro', senorNombre: 'Concordia de Hierro', deuda: 0, alCorriente: true, porcentajePagado: 100, cuota: 1248, sobreprecioArmas: 2, patrullaGuerreros: 20, proximaRevision: 7, rotoEn: null, motivoRuptura: null }],
    })
    let utils!: ReturnType<typeof render>
    await act(async () => {
      utils = render(<DiplomaciaMercadoSection saveId="s1" companions={[ana]} factions={[]} goirnos={0} onRefreshSave={async () => {}} />)
    })
    expect(utils.getByText('Clan Serhu es vasallo de Concordia de Hierro')).toBeTruthy()
    expect(utils.getByText('Sin facciones descubiertas todavía')).toBeTruthy()
    expect(utils.getByText('Al corriente')).toBeTruthy()
  })
})
