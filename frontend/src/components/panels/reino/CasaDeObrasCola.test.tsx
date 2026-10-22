import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { CasaDeObrasCola } from './CasaDeObrasCola'
import { EdificiosParcelasSection } from './EdificiosParcelasSection'
import * as api from '../../../lib/api'
import type { BuildingInfo, RecipeStatusInfo } from '../../../types'

// P277/P284 — la cola de la Casa de obras: orden, quitar, avisos 🔒 y encargar desde Construir.
const datos = (): api.CasaDeObrasInfo => ({
  casa: { nivel: 1, tierMaximo: 3, plazas: 1 },
  constructores: [{ id: 'c1', name: 'Druk', nivel: 2 }],
  cola: [
    { id: 'o1', tipo: 'CONSTRUIR', nombre: 'un pozo', tier: 1, dias: 1, diasHechos: 0, aviso: null },
    { id: 'o2', tipo: 'CONSTRUIR', nombre: 'un ayuntamiento mediano', tier: 6, dias: 6, diasHechos: 0, aviso: '🔒6: la Casa de obras de nivel 1 llega hasta tier 3' },
  ],
})

describe('Casa de obras — cola', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('pinta la Casa, sus constructores, la cola en orden y el aviso 🔒', async () => {
    vi.spyOn(api, 'getObras').mockResolvedValue(datos())
    const { findByText, getByText, getByLabelText } = render(<CasaDeObrasCola saveId="s1" />)
    expect(await findByText(/Nivel 1: obras hasta tier 3/)).toBeTruthy()
    expect(getByText(/Druk, nivel 2/)).toBeTruthy()
    expect(getByText(/🔒6: la Casa de obras de nivel 1/)).toBeTruthy()
    const items = getByLabelText('Cola de obras').querySelectorAll('li')
    expect(items[0].textContent).toMatch(/1\. un pozo/)
    expect(items[1].textContent).toMatch(/2\. un ayuntamiento mediano/)
  })

  it('subir una obra manda el orden nuevo; quitar llama a la ruta', async () => {
    vi.spyOn(api, 'getObras').mockResolvedValue(datos())
    const orden = vi.spyOn(api, 'putOrdenObras').mockResolvedValue({ ok: true })
    const quitar = vi.spyOn(api, 'deleteObra').mockResolvedValue({ ok: true })
    const { findByRole, getByRole } = render(<CasaDeObrasCola saveId="s1" />)
    fireEvent.click(await findByRole('button', { name: 'Subir un ayuntamiento mediano' }))
    await waitFor(() => expect(orden).toHaveBeenCalledWith('s1', ['o2', 'o1']))
    await waitFor(() => expect((getByRole('button', { name: 'Quitar un pozo' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(getByRole('button', { name: 'Quitar un pozo' }))
    await waitFor(() => expect(quitar).toHaveBeenCalledWith('s1', 'o1'))
  })

  it('Construir: una obra de tier > 3 no la levanta el personaje y se encarga a la Casa; la Jaula sale (P282)', async () => {
    vi.spyOn(api, 'getObras').mockResolvedValue({ ...datos(), cola: [] })
    const encargar = vi.spyOn(api, 'postObra').mockResolvedValue({ ok: true, id: 'o3' })
    const receta = (recipeKey: string, name: string, tier: number, extra: Partial<RecipeStatusInfo> = {}): RecipeStatusInfo => ({
      recipeKey, recipeCategory: 'construccion', met: true, ingredients: [], missingRequisitos: [], locationOk: true, requiredLocationName: null, blockedReason: null, name, tier, panelReino: true, upgradesRecipeKey: null, ...extra,
    })
    const edificios = [
      { id: 'a', name: 'Karot', kind: 'x', description: 'd', status: 'ACTIVO', recipeKey: 'ayuntamiento', tier: 1 },
      { id: 'c', name: 'Casa de obras', kind: 'x', description: 'd', status: 'ACTIVO', recipeKey: 'casa-de-obras', tier: 1 },
    ] as unknown as BuildingInfo[]
    const { getByRole, getAllByRole } = render(
      <EdificiosParcelasSection
        buildings={edificios}
        recipesStatus={[receta('jaula-pequena', 'una jaula pequeña', 1), receta('ayuntamiento-mediano', 'un ayuntamiento mediano', 6, { panelReino: false, upgradesRecipeKey: 'ayuntamiento', nivel: 2 })]}
        onBuild={vi.fn()}
        saveId="s1"
      />,
    )
    expect((getByRole('button', { name: /Jaula pequeña/ }) as HTMLButtonElement).disabled).toBe(false)
    expect((getByRole('button', { name: /Mejorar a Ayuntamiento mediano/ }) as HTMLButtonElement).disabled).toBe(true)
    const encargos = getAllByRole('button', { name: 'Encargar a la Casa de obras' })
    fireEvent.click(encargos[1])
    await waitFor(() => expect(encargar).toHaveBeenCalledWith('s1', { recipeKey: 'ayuntamiento-mediano' }))
  })
})
