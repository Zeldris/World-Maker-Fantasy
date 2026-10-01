import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { ZonaSalidaModal } from './ZonaSalidaModal'
import { EdificiosParcelasSection } from './panels/reino/EdificiosParcelasSection'
import type { ZonaSalidaInfo } from '../lib/api'
import type { RecipeStatusInfo } from '../types'

/// UX-3 (hito 0.1, roadmap-front-ux.md H1) — los botones que lanzan un turno fuera del composer
/// (Viajar desde una salida de zona, Construir en Reino) se deshabilitan con el motivo mientras el
/// narrador escribe, en vez de dejar que la acción salga y el backend la rechace después.
describe('UX-3 — botones que lanzan un turno con bloqueoTurno', () => {
  afterEach(() => {
    cleanup()
  })

  const salida = { locationId: 'l1', slug: 'hondonada', nombre: 'Hondonada', x: 0, y: 0, visitada: false, teaser: null, description: null, imageUrl: null } as unknown as ZonaSalidaInfo

  it('ZonaSalidaModal: Viajar deshabilitado con el motivo y sin llamar a onViajar', () => {
    const onViajar = vi.fn()
    const { getByRole } = render(<ZonaSalidaModal salida={salida} onViajar={onViajar} onCancel={() => {}} bloqueoTurno="El narrador todavía está escribiendo." />)
    const boton = getByRole('button', { name: /Viajar/ }) as HTMLButtonElement
    expect(boton.disabled).toBe(true)
    expect(boton.title).toBe('El narrador todavía está escribiendo.')
    fireEvent.click(boton)
    expect(onViajar).not.toHaveBeenCalled()
  })

  it('ZonaSalidaModal: sin bloqueo, Viajar manda la acción', () => {
    const onViajar = vi.fn()
    const { getByRole } = render(<ZonaSalidaModal salida={salida} onViajar={onViajar} onCancel={() => {}} />)
    fireEvent.click(getByRole('button', { name: /Viajar/ }))
    expect(onViajar).toHaveBeenCalledWith('Viajo hacia Hondonada.')
  })

  it('EdificiosParcelasSection: Construir deshabilitado con el motivo aunque la receta se pueda hacer', () => {
    const onBuild = vi.fn()
    const recipesStatus = [{ recipeCategory: 'construccion', recipeKey: 'cuartel-avanzado', met: true, blockedReason: null }] as unknown as RecipeStatusInfo[]
    const { getByRole, getAllByText } = render(
      <EdificiosParcelasSection buildings={[]} recipesStatus={recipesStatus} onBuild={onBuild} bloqueoTurno="El narrador todavía está escribiendo." />,
    )
    const boton = getByRole('button', { name: /Cuartel avanzado/ }) as HTMLButtonElement
    expect(boton.disabled).toBe(true)
    expect(getAllByText('El narrador todavía está escribiendo.').length).toBeGreaterThan(0)
    fireEvent.click(boton)
    expect(onBuild).not.toHaveBeenCalled()
  })
})
