import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

vi.mock('../../../lib/api', () => ({
  getDescansarCampamentoDisponible: vi.fn().mockResolvedValue({ disponible: false }),
  getEconomiaReino: vi.fn().mockResolvedValue(null),
  postDescansarCampamento: vi.fn(),
  traspasarTesoro: vi.fn(),
}))
import { VisionGeneralSection } from './VisionGeneralSection'
import type { KingdomStatsInfo, TerritoryInfo } from '../../../types'

const stats = (diasFelicidadBaja: number): KingdomStatsInfo => ({
  poblacion: 5, felicidad: 10, comida: 5, bebida: 5, riqueza: 5, soldados: 0, trabajadores: 0, visitantes: 0,
  diasFelicidadBaja, diasFelicidadAlta: 0,
})
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

  it('sin días de felicidad baja no avisa', () => {
    const { queryByText } = render(
      <VisionGeneralSection saveId="s1" kingdomName="Reino" territories={[territorio]} kingdomStats={stats(0)} buildings={[]} ayuntamiento onRefreshSave={async () => {}} />,
    )
    expect(queryByText(/para la rebelión/)).toBeNull()
  })
})
