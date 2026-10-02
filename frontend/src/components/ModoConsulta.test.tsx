import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { PanelDrawer } from './PanelDrawer'
import { InventarioPanel } from './panels/InventarioPanel'
import { ModoConsultaContext } from '../context/modoConsultaContext'
import type { InventoryItemInfo } from '../types'

/// UX-5 (hito 0.2) — paneles en modo consulta: se leen, pero lo que cambia datos se deshabilita con
/// el motivo.
describe('UX-5 — modo consulta', () => {
  // jsdom no implementa scrollTo (PanelDrawer lo usa al abrirse).
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo
  afterEach(() => {
    cleanup()
  })

  const captura = { id: 'c1', name: 'Lobo atado', description: 'Capturado', capturaNpcId: 'n1', slot: null, quantity: 1 } as unknown as InventoryItemInfo
  const montar = (motivo: string | null) =>
    render(
      <PanelDrawer title="Inventario" onClose={vi.fn()} modoConsulta={motivo}>
        <ModoConsultaContext.Provider value={motivo}>
          <InventarioPanel saveId="s1" items={[captura]} goirnos={0} capacity={20} onUse={vi.fn()} onDetail={vi.fn()} onRefreshSave={vi.fn()} />
        </ModoConsultaContext.Provider>
      </PanelDrawer>,
    )

  it('con motivo: aviso en el cajón y Depositar/Soltar deshabilitados con el motivo', () => {
    const { getByRole, getByText } = montar('El narrador todavía está escribiendo.')
    expect(getByRole('status').textContent).toContain('Solo consulta: El narrador todavía está escribiendo.')
    const depositar = getByText('Depositar').closest('button')!
    expect(depositar.disabled).toBe(true)
    expect(depositar.title).toBe('El narrador todavía está escribiendo.')
    expect(getByText('Soltar').closest('button')!.disabled).toBe(true)
  })

  it('sin motivo: sin aviso y los botones activos', () => {
    const { queryByRole, getByText } = montar(null)
    expect(queryByRole('status')).toBeNull()
    expect(getByText('Depositar').closest('button')!.disabled).toBe(false)
  })
})
