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
  it('al pasar de Zona a Mapa vuelve a las pestañas con el contenido nuevo ya puesto', () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    render(
      <MapaPanel worldSlug={null} saveId="s1" currentLocation={null} destinations={[]} inventory={[]} quests={[]} buildings={[]} entorno={null} onViajar={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Mapa' }))
    expect(scroll).toHaveBeenCalledWith({ block: 'start' })
  })
})
