import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { SessionProvider } from './context/SessionContext'
import { ComingSoon } from './pages/ComingSoon'
import { ImagePromptSlot } from './components/ImagePromptDisplay'
import { HerramientasAdminContext, fijarModoDesarrollador } from './lib/modoDesarrollador'

vi.mock('./lib/api', () => ({
  listSaves: vi.fn().mockResolvedValue([]),
  getImagePrompt: vi.fn().mockResolvedValue(null),
  requestImagePrompt: vi.fn(),
  saveImagePromptUsado: vi.fn(),
}))
vi.mock('./components/VersionTag', () => ({ VersionTag: () => null }))
vi.mock('./pages/AdminEnciclopedia', () => ({ AdminEnciclopedia: () => <p>ADMIN-ENCICLOPEDIA</p> }))
vi.mock('./pages/AdminLibro', () => ({ AdminLibro: () => <p>ADMIN-LIBRO</p> }))
vi.mock('./pages/AdminUI', () => ({ AdminUI: () => <p>ADMIN-UI</p> }))

/// INS-33 — el juego empaquetado (`window.__TARKOR__`) no lleva admin; en desarrollo, todo como antes.
const RUTAS = ['/admin/enciclopedia', '/admin/partida/s1/libro', '/admin/ui']
const props = { label: 'Icono', existingPrompt: null, worldSlug: 'helek-sirik', entityType: 'clase' as never, entitySlug: 'guardian', sizeProfile: 'icono' as never }

function app(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <SessionProvider>
        <App />
      </SessionProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  delete window.__TARKOR__
  fijarModoDesarrollador(false)
})

describe('INS-33 — empaquetado', () => {
  it('Home sin el enlace de admin', async () => {
    window.__TARKOR__ = { apiUrl: 'http://127.0.0.1:1' }
    const { queryByText, findByText } = app('/')
    await findByText('¿Cómo quieres jugar?')
    expect(queryByText('Admin: enciclopedia completa')).toBeNull()
  })

  it('las rutas /admin/* no se montan', async () => {
    window.__TARKOR__ = {}
    for (const ruta of RUTAS) {
      const { container, unmount } = app(ruta)
      expect(container.textContent).not.toContain('ADMIN-')
      unmount()
    }
  })

  it('ImagePromptSlot no se pinta ni con modo desarrollador ni con el contexto de admin', () => {
    window.__TARKOR__ = {}
    fijarModoDesarrollador(true)
    const a = render(<ImagePromptSlot {...props} />)
    expect(a.container.innerHTML).toBe('')
    a.unmount()
    const b = render(
      <HerramientasAdminContext.Provider value={true}>
        <ImagePromptSlot {...props} />
      </HerramientasAdminContext.Provider>,
    )
    expect(b.container.innerHTML).toBe('')
  })
})

describe('INS-33 — desarrollo (sin __TARKOR__)', () => {
  it('Home con el enlace y las rutas /admin/* montadas', async () => {
    const h = app('/')
    expect(await h.findByText('Admin: enciclopedia completa')).toBeTruthy()
    h.unmount()
    for (const [ruta, texto] of [[RUTAS[0], 'ADMIN-ENCICLOPEDIA'], [RUTAS[1], 'ADMIN-LIBRO'], [RUTAS[2], 'ADMIN-UI']]) {
      const r = app(ruta)
      expect(r.getByText(texto)).toBeTruthy()
      r.unmount()
    }
  })

  it('ImagePromptSlot sale con el modo desarrollador', () => {
    const { getByRole } = render(<ImagePromptSlot {...props} />)
    act(() => fijarModoDesarrollador(true))
    expect(getByRole('button', { name: 'Generar icono' })).toBeTruthy()
  })
})

describe('INS-33 — ComingSoon', () => {
  it('dice que el multijugador está en construcción para futuras versiones', () => {
    const { getByText } = render(
      <MemoryRouter>
        <ComingSoon />
      </MemoryRouter>,
    )
    expect(getByText(/en construcción para futuras versiones/)).toBeTruthy()
  })
})
