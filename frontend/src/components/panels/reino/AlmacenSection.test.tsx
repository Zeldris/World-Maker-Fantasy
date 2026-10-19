import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, cleanup, act, waitFor } from '@testing-library/react'

vi.mock('../../../lib/api', () => ({
  depositarEnAlmacen: vi.fn(),
  retirarDeAlmacen: vi.fn(),
  getAlmacenLimites: vi.fn(),
  setAlmacenLimite: vi.fn(),
}))

import { retirarDeAlmacen, getAlmacenLimites, setAlmacenLimite } from '../../../lib/api'
import { AlmacenSection } from './AlmacenSection'

/// REI-40/REI-41 (hito 0.1, roadmap-front-reino.md R9/R22) — una fila por recurso con su cantidad y
/// su tope al lado, en vez de una fila por unidad.
const item = (id: string, name: string, catalogSlug: string | null) => ({ id, name, description: '', catalogSlug })

describe('AlmacenSection — REI-40, REI-41', () => {
  beforeEach(() => {
    vi.mocked(getAlmacenLimites).mockResolvedValue({ limites: [{ catalogSlug: 'madera', limite: 10 }] })
    vi.mocked(retirarDeAlmacen).mockResolvedValue({} as never)
    vi.mocked(setAlmacenLimite).mockResolvedValue({ ok: true, catalogSlug: 'madera', limite: 20 })
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('30 maderas son una fila ×30 con Retirar 1, tope y barra', async () => {
    const maderas = Array.from({ length: 30 }, (_, i) => item(`m${i}`, 'Madera', 'madera'))
    const onRefreshSave = vi.fn().mockResolvedValue(undefined)
    const { getAllByText, getByText, findByLabelText, getByRole } = render(
      <AlmacenSection saveId="s1" inventory={[]} almacenItems={maderas} onRefreshSave={onRefreshSave} />,
    )
    expect(getAllByText('Madera')).toHaveLength(31) // 1 fila + 30 unidades dentro del desplegable
    expect(getByText('×30')).toBeTruthy()
    const tope = (await findByLabelText('Tope de Madera')) as HTMLInputElement
    await waitFor(() => expect(tope.value).toBe('10'))
    expect(getByRole('meter').getAttribute('aria-valuenow')).toBe('30')

    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Retirar 1' }))
    })
    expect(retirarDeAlmacen).toHaveBeenCalledWith('s1', 'm0')

    fireEvent.change(tope, { target: { value: '20' } })
    await act(async () => {
      fireEvent.keyDown(tope, { key: 'Enter' })
    })
    expect(setAlmacenLimite).toHaveBeenCalledWith('s1', 'madera', 20)
  })

  it('un objeto sin catalogSlug no tiene tope (no se puede limitar)', async () => {
    const { queryByLabelText, getByRole } = render(
      <AlmacenSection saveId="s1" inventory={[]} almacenItems={[item('x', 'Amuleto raro', null)]} onRefreshSave={async () => {}} />,
    )
    await act(async () => {})
    expect(queryByLabelText('Tope de Amuleto raro')).toBeNull()
    expect(getByRole('button', { name: 'Retirar' })).toBeTruthy()
  })
})

describe('AlmacenSection — P225 fallo de carga de topes', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('si fallan los topes avisa con Reintentar y al reintentar los carga', async () => {
    vi.mocked(getAlmacenLimites).mockRejectedValueOnce(new Error('500')).mockResolvedValue({ limites: [{ catalogSlug: 'madera', limite: 10 }] })
    const { findByRole, findByLabelText } = render(
      <AlmacenSection saveId="s1" inventory={[]} almacenItems={[item('m1', 'Madera', 'madera')]} onRefreshSave={vi.fn().mockResolvedValue(undefined)} />,
    )
    const aviso = await findByRole('alert')
    expect(aviso.textContent).toContain('No se pudieron cargar los topes del almacén.')
    await act(async () => {
      fireEvent.click(await findByRole('button', { name: /Reintentar/ }))
    })
    expect(getAlmacenLimites).toHaveBeenCalledTimes(2)
    const tope = (await findByLabelText('Tope de Madera')) as HTMLInputElement
    await waitFor(() => expect(tope.value).toBe('10'))
  })
})
