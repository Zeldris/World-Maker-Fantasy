import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { ImagePromptSlot } from './ImagePromptDisplay'
import { HerramientasAdminContext, fijarModoDesarrollador } from '../lib/modoDesarrollador'

/// CFG-33 (hito 0.1, roadmap-front.md H17) — las herramientas de prompts no se ven en partida salvo
/// con el modo desarrollador; en la página de admin, siempre.
const props = { label: 'Icono', existingPrompt: null, worldSlug: 'helek-sirik', entityType: 'clase' as never, entitySlug: 'guardian', sizeProfile: 'icono' as never }

describe('ImagePromptSlot — CFG-33', () => {
  afterEach(() => {
    cleanup()
    fijarModoDesarrollador(false)
  })

  it('apagado por defecto: no se pinta', () => {
    const { container } = render(<ImagePromptSlot {...props} />)
    expect(container.innerHTML).toBe('')
  })

  it('con el modo desarrollador activo aparece, y desaparece al apagarlo', () => {
    const { container, getByRole } = render(<ImagePromptSlot {...props} />)
    act(() => fijarModoDesarrollador(true))
    expect(getByRole('button', { name: 'Generar icono' })).toBeTruthy()
    act(() => fijarModoDesarrollador(false))
    expect(container.innerHTML).toBe('')
  })

  it('en la página de admin se ve siempre', () => {
    const { getByRole } = render(
      <HerramientasAdminContext.Provider value={true}>
        <ImagePromptSlot {...props} />
      </HerramientasAdminContext.Provider>,
    )
    expect(getByRole('button', { name: 'Generar icono' })).toBeTruthy()
  })
})
