import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { EdificiosParcelasSection } from './EdificiosParcelasSection'
import * as api from '../../../lib/api'
import type { BuildingInfo, RecipeStatusInfo } from '../../../types'

// P284/P296/P301 — un edificio dañado se repara desde su tarjeta, con el coste visible.
// P302 — un doble clic en Construir solo manda una orden.
const receta = (recipeKey: string, name: string): RecipeStatusInfo => ({
  recipeKey,
  recipeCategory: 'construccion',
  met: true,
  ingredients: [{ label: 'leña', tienes: 6, necesitas: 6, met: true }],
  missingRequisitos: [],
  locationOk: true,
  requiredLocationName: null,
  blockedReason: null,
  name,
  requiresAyuntamiento: true,
  upgradesRecipeKey: null,
})

const edificio = (over: Record<string, unknown>) =>
  ({ id: 'b1', name: 'Ayuntamiento', kind: 'x', description: 'd', status: 'ACTIVO', recipeKey: 'ayuntamiento', ...over }) as unknown as BuildingInfo

describe('P284/P302 — reparar y doble clic', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('un edificio dañado ofrece Reparar con su coste y llama a la ruta', async () => {
    const spy = vi.spyOn(api, 'postRepararEdificio').mockResolvedValue({ ok: true, coste: 9 })
    const refresh = vi.fn().mockResolvedValue(undefined)
    const { getByRole, getByText } = render(
      <EdificiosParcelasSection buildings={[edificio({ status: 'DANADO', costeReparar: 9 })]} saveId="s1" onRefreshSave={refresh} />,
    )
    expect(getByText(/Coste: 9/)).toBeTruthy()
    const btn = getByRole('button', { name: 'Reparar' })
    fireEvent.click(btn)
    expect(spy).toHaveBeenCalledWith('s1', 'b1')
  })

  it('un edificio ACTIVO no tiene Reparar', () => {
    const { queryByRole } = render(<EdificiosParcelasSection buildings={[edificio({})]} saveId="s1" onRefreshSave={async () => {}} />)
    expect(queryByRole('button', { name: 'Reparar' })).toBeNull()
  })

  it('doble clic en Construir manda una sola orden mientras la petición está en vuelo', () => {
    const onBuild = vi.fn(() => new Promise<void>(() => {}))
    const { getByRole } = render(<EdificiosParcelasSection buildings={[]} recipesStatus={[receta('pozo', 'un pozo')]} onBuild={onBuild} />)
    const btn = getByRole('button', { name: /Pozo/ })
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(onBuild).toHaveBeenCalledTimes(1)
  })
})
