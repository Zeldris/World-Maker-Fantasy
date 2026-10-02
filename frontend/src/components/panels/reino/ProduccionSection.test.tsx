import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, cleanup, act, waitFor } from '@testing-library/react'

vi.mock('../../../lib/api', () => ({
  getOrdenesProduccion: vi.fn(),
  getRecetasProduccionEdificio: vi.fn(),
  crearOrdenProduccion: vi.fn(),
  actualizarOrdenProduccion: vi.fn(),
  borrarOrdenProduccion: vi.fn(),
  asignarCompanionABuilding: vi.fn(),
  getAlmacenLimites: vi.fn(),
  setAlmacenLimite: vi.fn(),
}))

import { getOrdenesProduccion, getRecetasProduccionEdificio, actualizarOrdenProduccion, borrarOrdenProduccion, getAlmacenLimites } from '../../../lib/api'
import { ProduccionSection } from './ProduccionSection'
import type { BuildingInfo } from '../../../types'

/// REI-33 (hito 0.1, roadmap-front-reino.md R13/R14) — las órdenes desactivadas se reactivan o se
/// borran (con confirmación), y el límite de una orden "único" se edita.
const edificio = { id: 'b1', name: 'Ahumadero', status: 'ACTIVO' } as unknown as BuildingInfo
const orden = (over: object) => ({ id: 'o1', buildingId: 'b1', recipeKey: 'smokeMeat', modo: 'reponer', limite: null, prioridad: 5, cantidadProducidaAcumulada: 3, activa: true, ...over })

describe('ProduccionSection — REI-33', () => {
  beforeEach(() => {
    vi.mocked(getRecetasProduccionEdificio).mockResolvedValue({ oficio: null, recipeKeys: [] } as never)
    vi.mocked(getAlmacenLimites).mockResolvedValue({ limites: [] } as never)
    vi.mocked(actualizarOrdenProduccion).mockResolvedValue({ ok: true } as never)
    vi.mocked(borrarOrdenProduccion).mockResolvedValue({ ok: true })
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  function renderizar() {
    return render(<ProduccionSection saveId="s1" buildings={[edificio]} companions={[]} almacenItems={[]} professionRecipes={[]} onRefreshSave={async () => {}} />)
  }

  it('una orden desactivada se reactiva desde «Desactivadas»', async () => {
    vi.mocked(getOrdenesProduccion).mockResolvedValue({ ordenes: [orden({ activa: false })] } as never)
    const { findByText, getByRole } = renderizar()
    fireEvent.click(await findByText(/Desactivadas \(1\)/))
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Reactivar' }))
    })
    expect(actualizarOrdenProduccion).toHaveBeenCalledWith('s1', 'o1', { activa: true })
  })

  it('borrar pide confirmación antes de llamar a la API', async () => {
    vi.mocked(getOrdenesProduccion).mockResolvedValue({ ordenes: [orden({ activa: false })] } as never)
    const { findByText, getByRole, getAllByRole } = renderizar()
    fireEvent.click(await findByText(/Desactivadas \(1\)/))
    fireEvent.click(getByRole('button', { name: 'Borrar' }))
    expect(borrarOrdenProduccion).not.toHaveBeenCalled()
    const botonesBorrar = getAllByRole('button', { name: 'Borrar' })
    await act(async () => {
      fireEvent.click(botonesBorrar[botonesBorrar.length - 1])
    })
    await waitFor(() => expect(borrarOrdenProduccion).toHaveBeenCalledWith('s1', 'o1'))
  })

  it('una orden "único" activa enseña producidas/límite y el límite se edita con Enter', async () => {
    vi.mocked(getOrdenesProduccion).mockResolvedValue({ ordenes: [orden({ modo: 'unico', limite: 10 })] } as never)
    const { findByLabelText } = renderizar()
    const input = (await findByLabelText('Límite de smokeMeat')) as HTMLInputElement
    fireEvent.change(input, { target: { value: '4' } })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(actualizarOrdenProduccion).toHaveBeenCalledWith('s1', 'o1', { limite: 4 })
  })
})
