import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../../lib/api', () => ({
  getDescansarCampamentoDisponible: vi.fn().mockResolvedValue({ disponible: false }),
  getEconomiaReino: vi.fn().mockResolvedValue(null),
  postDescansarCampamento: vi.fn(),
  traspasarTesoro: vi.fn(),
}))
import { getDescansarCampamentoDisponible } from '../../../lib/api'
import { VisionGeneralSection } from './VisionGeneralSection'
import type { KingdomStatsInfo, TerritoryInfo } from '../../../types'

const stats = (diasFelicidadBaja: number): KingdomStatsInfo => ({
  poblacion: 5, felicidad: 10, comida: 5, bebida: 5, riqueza: 5, soldados: 0, trabajadores: 0, visitantes: 0,
  diasFelicidadBaja, diasFelicidadAlta: 0, diasParaRebelion: 7, diasParaConsolidar: 7,
})
const perdido = { id: 't2', name: 'Costa', description: 'd', control: 'PERDIDO', population: 0 } as unknown as TerritoryInfo
const territorio = { id: 't1', name: 'Llanuras', description: 'd', control: 'CONTROLADO', population: 3 } as unknown as TerritoryInfo

// P299 / REI-14 — aviso antes de perder el territorio por rebelión.
describe('VisionGeneralSection — aviso de rebelión (P299)', () => {
  afterEach(cleanup)

  it('con felicidad baja avisa de cuántos días de 7 lleva', () => {
    const { getByText } = render(
      <VisionGeneralSection saveId="s1" kingdomName="Reino" territories={[territorio]} kingdomStats={stats(3)} buildings={[]} ayuntamiento onRefreshSave={async () => {}} />,
    )
    expect(getByText(/Felicidad baja: 3 de 7 días para la rebelión/)).toBeTruthy()
  })

  it('con 7 días o más y un territorio perdido dice que el reino se ha rebelado (P299, reabierto)', () => {
    const { getByText, queryByText } = render(
      <VisionGeneralSection saveId="s1" kingdomName="Reino" territories={[perdido]} kingdomStats={stats(14)} buildings={[]} ayuntamiento onRefreshSave={async () => {}} />,
    )
    expect(getByText(/El reino se ha rebelado: 14 días seguidos/)).toBeTruthy()
    expect(queryByText(/de 7 días para la rebelión/)).toBeNull()
  })

  // dailyTick solo rebela los territorios que existen: sin ninguno perdido todavía no hay rebelión que contar.
  it('con 7 días o más pero ningún territorio perdido no dice que se ha rebelado, sino que se rebelará (P299)', () => {
    const { getByText, queryByText } = render(
      <VisionGeneralSection saveId="s1" kingdomName="Reino" territories={[territorio]} kingdomStats={stats(8)} buildings={[]} ayuntamiento onRefreshSave={async () => {}} />,
    )
    expect(queryByText(/se ha rebelado/)).toBeNull()
    expect(getByText(/8 días seguidos \(el límite son 7\)/)).toBeTruthy()
  })

  // REVIEW.md, «Sin copias entre backend y frontend»: el umbral es el que manda el backend.
  it('usa el umbral que llega del backend, no una copia (P299)', () => {
    const { getByText } = render(
      <VisionGeneralSection saveId="s1" kingdomName="Reino" territories={[territorio]} kingdomStats={{ ...stats(3), diasParaRebelion: 10 }} buildings={[]} ayuntamiento onRefreshSave={async () => {}} />,
    )
    expect(getByText(/Felicidad baja: 3 de 10 días para la rebelión/)).toBeTruthy()
  })

  it('sin días de felicidad baja no avisa', () => {
    const { queryByText } = render(
      <VisionGeneralSection saveId="s1" kingdomName="Reino" territories={[territorio]} kingdomStats={stats(0)} buildings={[]} ayuntamiento onRefreshSave={async () => {}} />,
    )
    expect(queryByText(/para la rebelión/)).toBeNull()
  })
})

// P305 — el modal de descansar promete la cura solo con provisiones.
describe('VisionGeneralSection — modal de descansar (P305)', () => {
  afterEach(cleanup)

  async function abrirModal(carencia: 'hambre' | 'sed' | 'ambas' | null) {
    vi.mocked(getDescansarCampamentoDisponible).mockResolvedValue({ disponible: true, carencia })
    const r = render(
      <VisionGeneralSection saveId="s1" kingdomName="Reino" territories={[]} kingdomStats={null} buildings={[]} ayuntamiento onRefreshSave={async () => {}} />,
    )
    fireEvent.click(await r.findByText(/Descansar en el campamento/, { selector: 'button' }))
    return r
  }

  it('con provisiones promete la cura hasta Herido', async () => {
    const { findByText } = await abrirModal(null)
    expect(await findByText(/curándote hasta Herido/)).toBeTruthy()
  })

  it('sin comida ni bebida avisa de que no cura y empeora, y no promete la cura', async () => {
    const { findByText, queryByText } = await abrirModal('ambas')
    expect(await findByText(/Sin comida ni bebida, el descanso no cura y tu estado empeora/)).toBeTruthy()
    await waitFor(() => expect(queryByText(/curándote hasta Herido/)).toBeNull())
  })

  it('solo con hambre o solo con sed lo dice con su causa', async () => {
    const a = await abrirModal('hambre')
    expect(await a.findByText(/Sin comida, el descanso no cura/)).toBeTruthy()
    cleanup()
    const b = await abrirModal('sed')
    expect(await b.findByText(/Sin bebida, el descanso no cura/)).toBeTruthy()
  })
})
