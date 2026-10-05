import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { InteractiveMap } from './InteractiveMap'
import { beriRegions } from '../../data/map'
import { posicionDeExpedicion } from '../../lib/leyendas'

/// CR-46 — expediciones en el mapa de Berig.
describe('CR-46 — expediciones en el mapa', () => {
  afterEach(cleanup)

  it('va hasta la mitad del viaje y después vuelve por el mismo camino', () => {
    const o = { x: 0, y: 0 }
    const d = { x: 10, y: 20 }
    expect(posicionDeExpedicion(o, d, 0.25)).toEqual({ x: 5, y: 10, vuelve: false })
    expect(posicionDeExpedicion(o, d, 0.5)).toEqual({ x: 10, y: 20, vuelve: false })
    expect(posicionDeExpedicion(o, d, 0.75)).toEqual({ x: 5, y: 10, vuelve: true })
    expect(posicionDeExpedicion(o, undefined, 0.3)).toBeNull()
  })

  it('se dibuja entre su origen y su destino y, al pulsarla, dice adónde va y cuándo vuelve', () => {
    const nodos = [
      { slug: 'campamento-helsig', name: 'Campamento Helsig', description: 'x', x: 100, y: 100 },
      { slug: 'hondonada-del-eco', name: 'Hondonada del Eco', description: 'x', x: 300, y: 300 },
    ]
    const { getByRole } = render(
      <InteractiveMap
        regions={beriRegions}
        currentRegion="Las Llanuras del Viento Rojo"
        llanurasNodes={nodos}
        llanurasEdges={[]}
        hasLlanurasMap
        hasCristalHeladoMap={false}
        expediciones={[
          { id: 'e1', faccion: 'Clan Helsig', oficio: 'minero', motivo: null, origenSlug: 'campamento-helsig', destinoSlug: 'hondonada-del-eco', destinoNombre: 'Hondonada del Eco', diaRegreso: 5, progreso: 0.25, delReino: false },
        ]}
      />,
    )
    fireEvent.click(getByRole('button', { name: 'Expedición de Clan Helsig' }))
    const tarjeta = getByRole('region', { name: 'Expedición' })
    expect(tarjeta.textContent).toContain('Va a Hondonada del Eco')
    expect(tarjeta.textContent).toContain('día 6')
  })
})
