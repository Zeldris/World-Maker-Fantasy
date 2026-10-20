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

describe('ProduccionSection — P225 fallo de carga', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('si falla la carga de órdenes avisa con Reintentar y no dice «Sin órdenes activas»', async () => {
    vi.mocked(getRecetasProduccionEdificio).mockResolvedValue({ oficio: null, recipeKeys: [] } as never)
    vi.mocked(getAlmacenLimites).mockResolvedValue({ limites: [] } as never)
    vi.mocked(getOrdenesProduccion).mockRejectedValueOnce(new Error('500')).mockResolvedValue({ ordenes: [orden({})] } as never)
    const { findByRole, queryByText } = render(
      <ProduccionSection saveId="s1" buildings={[edificio]} companions={[]} almacenItems={[]} professionRecipes={[]} onRefreshSave={async () => {}} />,
    )
    const aviso = await findByRole('alert')
    expect(aviso.textContent).toContain('No se pudieron cargar las órdenes de producción.')
    expect(queryByText('Sin órdenes activas.')).toBeNull()
    await act(async () => {
      fireEvent.click(await findByRole('button', { name: /Reintentar/ }))
    })
    expect(getOrdenesProduccion).toHaveBeenCalledTimes(2)
  })

  it('si las órdenes cargan bien tras un fallo (cambia saveId), el aviso desaparece', async () => {
    vi.mocked(getRecetasProduccionEdificio).mockResolvedValue({ oficio: null, recipeKeys: [] } as never)
    vi.mocked(getAlmacenLimites).mockResolvedValue({ limites: [] } as never)
    vi.mocked(getOrdenesProduccion).mockRejectedValueOnce(new Error('500')).mockResolvedValue({ ordenes: [orden({})] } as never)
    const props = { buildings: [edificio], companions: [], almacenItems: [], professionRecipes: [], onRefreshSave: async () => {} }
    const { findByRole, queryByRole, rerender } = render(<ProduccionSection saveId="s1" {...props} />)
    await findByRole('alert')
    rerender(<ProduccionSection saveId="s2" {...props} />)
    await waitFor(() => expect(queryByRole('alert')).toBeNull())
  })
})

describe('ProduccionSection — carrera al cambiar de edificio', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('si cambia building.id con la primera petición sin resolver, gana la segunda', async () => {
    vi.mocked(getRecetasProduccionEdificio).mockResolvedValue({ oficio: null, recipeKeys: [] } as never)
    vi.mocked(getAlmacenLimites).mockResolvedValue({ limites: [] } as never)
    let resolverPrimera: (v: unknown) => void = () => {}
    vi.mocked(getOrdenesProduccion)
      .mockReturnValueOnce(new Promise((r) => { resolverPrimera = r }) as never)
      .mockResolvedValue({ ordenes: [orden({ id: 'o2', buildingId: 'b2', recipeKey: 'segunda' })] } as never)
    const props = { saveId: 's1', companions: [], almacenItems: [], professionRecipes: [], onRefreshSave: async () => {} }
    const b2 = { id: 'b2', name: 'Otro', status: 'ACTIVO' } as unknown as BuildingInfo
    const { rerender, findByText, queryByText } = render(<ProduccionSection {...props} buildings={[edificio]} />)
    rerender(<ProduccionSection {...props} buildings={[b2]} />)
    await findByText(/segunda/i)
    await act(async () => {
      resolverPrimera({ ordenes: [orden({ id: 'o1', recipeKey: 'primera' })] })
    })
    expect(queryByText(/primera/i)).toBeNull()
    expect(queryByText(/segunda/i)).toBeTruthy()
  })
})
