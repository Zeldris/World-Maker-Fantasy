import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

vi.mock('../lib/api', () => ({ getParcela: vi.fn(), construirEnParcela: vi.fn() }))

import { getParcela } from '../lib/api'
import { ParcelaDetailModal } from './ParcelaDetailModal'
import type { RecipeStatusInfo, ZonaParcelaInfo } from '../types'

// P213 — las opciones de una parcela vacía salían con el slug de la receta («totem-clan-maktor», «tablon-avisos»)
// porque solo las habilidades de oficio (la choza) daban nombre. Ahora usan el nombre de la receta.
const candidata = (recipeKey: string, name?: string): RecipeStatusInfo => ({
  recipeKey, recipeCategory: 'construccion', met: true, ingredients: [], missingRequisitos: [], locationOk: true, requiredLocationName: null, blockedReason: null, name,
})
const parcela = { id: 'p1', tipo: 'BASICA', x: 0, y: 0, building: null } as unknown as ZonaParcelaInfo

describe('P213 — nombres de las opciones de una parcela vacía', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('un edificio sin habilidad sale con el nombre de su receta, sin artículo y en mayúscula, no con el slug', async () => {
    vi.mocked(getParcela).mockResolvedValue({
      parcela: { id: 'p1', tipo: 'BASICA', x: 0, y: 0, locationName: 'Hogar de Maktor' },
      ocupada: false,
      building: null,
      candidates: [candidata('totem-clan-maktor', 'Tótem del Clan Maktor'), candidata('tablon-avisos', 'un tablón de avisos'), candidata('mercado', 'un mercado')],
    })
    const { findByText, queryByText } = render(<ParcelaDetailModal saveId="s1" parcela={parcela} professionRecipes={[]} onCancel={() => {}} onConstruido={() => {}} />)
    expect(await findByText('Tablón de avisos')).toBeTruthy()
    expect(await findByText('Mercado')).toBeTruthy()
    expect(await findByText('Tótem del Clan Maktor')).toBeTruthy()
    expect(queryByText('tablon-avisos')).toBeNull()
    expect(queryByText('totem-clan-maktor')).toBeNull()
  })

  it('sin nombre de receta cae al slug legible («Tablon avisos»), nunca al slug crudo', async () => {
    vi.mocked(getParcela).mockResolvedValue({
      parcela: { id: 'p1', tipo: 'BASICA', x: 0, y: 0 },
      ocupada: false,
      building: null,
      candidates: [candidata('tablon-avisos')],
    })
    const { findByText, queryByText } = render(<ParcelaDetailModal saveId="s1" parcela={parcela} professionRecipes={[]} onCancel={() => {}} onConstruido={() => {}} />)
    expect(await findByText('Tablon avisos')).toBeTruthy()
    expect(queryByText('tablon-avisos')).toBeNull()
  })
})
