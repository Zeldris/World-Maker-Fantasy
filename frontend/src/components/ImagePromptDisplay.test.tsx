import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, cleanup, act, fireEvent, waitFor } from '@testing-library/react'
import { ImagePromptSlot } from './ImagePromptDisplay'
import { HerramientasAdminContext, fijarModoDesarrollador } from '../lib/modoDesarrollador'
import { getImagePrompt, requestImagePrompt, saveImagePromptUsado } from '../lib/api'

vi.mock('../lib/api', () => ({
  getImagePrompt: vi.fn(),
  requestImagePrompt: vi.fn(),
  saveImagePromptUsado: vi.fn(),
}))

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

/// CFG-38 (usuaria, 2026-10-24) — el prompt usado (editado a mano) se guarda aparte del base y regenerar no lo pisa.
describe('ImagePromptSlot — CFG-38 prompt usado', () => {
  const conBase = { ...props, existingPrompt: 'base prompt' }
  const enAdmin = (p = conBase) =>
    render(
      <HerramientasAdminContext.Provider value={true}>
        <ImagePromptSlot {...p} />
      </HerramientasAdminContext.Provider>,
    )

  beforeEach(() => {
    vi.mocked(getImagePrompt).mockReset()
    vi.mocked(requestImagePrompt).mockReset()
    vi.mocked(saveImagePromptUsado).mockReset()
  })
  afterEach(() => cleanup())

  it('si hay prompt usado, lo enseña en primer plano con su fecha', async () => {
    vi.mocked(getImagePrompt).mockResolvedValue({ prompt: 'base prompt', promptUsado: 'used prompt', promptUsadoAt: '2026-10-24T10:00:00.000Z' })
    const { findByText, getByText } = enAdmin()
    expect(await findByText('used prompt')).toBeTruthy()
    expect(getByText('Icono · prompt usado (editado 2026-10-24)')).toBeTruthy()
    expect(getImagePrompt).toHaveBeenCalledWith('helek-sirik', 'clase', 'guardian', 'icono')
  })

  it('Editar parte del base y Guardar lo manda como usado', async () => {
    vi.mocked(getImagePrompt).mockResolvedValue({ prompt: 'base prompt', promptUsado: null, promptUsadoAt: null })
    vi.mocked(saveImagePromptUsado).mockResolvedValue({ promptUsado: 'base prompt, sunset', promptUsadoAt: '2026-10-24T11:00:00.000Z' })
    const { getByRole, getByLabelText, findByText } = enAdmin()
    await waitFor(() => expect(getImagePrompt).toHaveBeenCalled())
    fireEvent.click(getByRole('button', { name: 'Editar' }))
    const area = getByLabelText('Prompt usado de icono') as HTMLTextAreaElement
    expect(area.value).toBe('base prompt')
    fireEvent.change(area, { target: { value: 'base prompt, sunset' } })
    fireEvent.click(getByRole('button', { name: 'Guardar' }))
    expect(await findByText('base prompt, sunset')).toBeTruthy()
    expect(saveImagePromptUsado).toHaveBeenCalledWith('helek-sirik', 'clase', 'guardian', 'icono', 'base prompt, sunset')
  })

  it('«Regenerar base» cambia solo el base y deja el usado', async () => {
    vi.mocked(getImagePrompt).mockResolvedValue({ prompt: 'base prompt', promptUsado: 'used prompt', promptUsadoAt: null })
    vi.mocked(requestImagePrompt).mockResolvedValue({ prompt: 'new base' } as never)
    const { findByText, getByRole, getByText } = enAdmin()
    await findByText('used prompt')
    fireEvent.click(getByRole('button', { name: 'Regenerar base' }))
    expect(await findByText('new base')).toBeTruthy()
    expect(getByText('used prompt')).toBeTruthy()
    expect(saveImagePromptUsado).not.toHaveBeenCalled()
  })

  it('«Volver al base» borra el usado', async () => {
    vi.mocked(getImagePrompt).mockResolvedValue({ prompt: 'base prompt', promptUsado: 'used prompt', promptUsadoAt: null })
    vi.mocked(saveImagePromptUsado).mockResolvedValue({ promptUsado: null, promptUsadoAt: null })
    const { findByText, getByRole, queryByText } = enAdmin()
    await findByText('used prompt')
    fireEvent.click(getByRole('button', { name: 'Editar' }))
    fireEvent.click(getByRole('button', { name: 'Volver al base' }))
    await waitFor(() => expect(queryByText('used prompt')).toBeNull())
    expect(saveImagePromptUsado).toHaveBeenCalledWith('helek-sirik', 'clase', 'guardian', 'icono', null)
  })
})
