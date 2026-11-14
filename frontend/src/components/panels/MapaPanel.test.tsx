import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MapaPanel } from './MapaPanel'

vi.mock('./ZonaPanel', () => ({ ZonaPanel: () => <div>zona</div> }))
vi.mock('./InteractiveMap', () => ({ InteractiveMap: () => <div>mapa</div> }))
vi.mock('../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../lib/api')>()),
  getEnciclopedia: vi.fn().mockResolvedValue(null),
  getExpedicionesMapa: vi.fn().mockResolvedValue({ expediciones: [], alcances: [], campamentos: [] }),
  getWorldLocations: vi.fn().mockResolvedValue({ locations: [], links: [] }),
}))

afterEach(cleanup)

describe('MapaPanel (P169)', () => {
  it('al pasar de Zona a Mapa el contenedor con scroll vuelve a 0 (y se mantiene tras cargar)', async () => {
    const { container } = render(
      <div data-testid="scroll" style={{ overflowY: 'auto' }}>
        <MapaPanel worldSlug={null} saveId="s1" currentLocation={null} destinations={[]} inventory={[]} quests={[]} buildings={[]} entorno={null} onViajar={() => {}} />
      </div>,
    )
    const caja = container.querySelector('[data-testid="scroll"]') as HTMLElement
    caja.scrollTop = 307
    fireEvent.click(screen.getByRole('button', { name: 'Mapa' }))
    expect(caja.scrollTop).toBe(0)
    caja.scrollTop = 307 // contenido tardío que vuelve a desplazar
    await new Promise((r) => setTimeout(r, 300))
    expect(caja.scrollTop).toBe(0)
  })
})
