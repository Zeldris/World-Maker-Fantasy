import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'

vi.mock('../../lib/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/api')>()
  return { ...real, getZona: vi.fn(), moverEnZona: vi.fn(), recogerDroppedItem: vi.fn() }
})

import { getZona, moverEnZona } from '../../lib/api'
import { ZonaPanel } from './ZonaPanel'

/// Z-A (hito 0.1, roadmap-front-zona.md) — ZON-20 (leyenda en el mapa) y ZON-62 (cuadrícula bajo demanda).
const zona = {
  disponible: true,
  locationSlug: 'hondonada-del-eco',
  locationName: 'Hondonada del Eco',
  imageUrl: null,
  puntos: [{ id: 'p1', x: 175, y: 125, tipo: 'FAUNA', targetSlug: 'aullador', nombre: 'Aullador rojo', cantidad: 3, color: 'ENEMIGO', descubierto: true }],
  dinamicos: [],
  jugador: { x: 375, y: 325 },
  salidas: [],
  parcelas: [],
}

describe('ZonaPanel — Z-A', () => {
  beforeEach(() => {
    vi.mocked(getZona).mockResolvedValue(zona as never)
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  async function renderizar() {
    const utils = render(<ZonaPanel saveId="s1" soloConsulta />)
    await act(async () => {})
    return utils
  }

  it('ZON-62: la cuadrícula está oculta; se ve mientras se mantiene Alt o fijada con el botón', async () => {
    const { queryByTestId, getByRole } = await renderizar()
    expect(queryByTestId('cuadricula')).toBeNull()
    act(() => {
      fireEvent.keyDown(window, { key: 'Alt' })
    })
    expect(queryByTestId('cuadricula')).not.toBeNull()
    act(() => {
      fireEvent.keyUp(window, { key: 'Alt' })
    })
    expect(queryByTestId('cuadricula')).toBeNull()
    const boton = getByRole('button', { name: /Cuadrícula/ })
    fireEvent.click(boton)
    expect(boton.getAttribute('aria-pressed')).toBe('true')
    expect(queryByTestId('cuadricula')).not.toBeNull()
  })

  it('ZON-20: la leyenda vive dentro del contenedor del mapa, plegada, con las fichas reales', async () => {
    const { getByRole } = await renderizar()
    // El botón de la cuadrícula está dentro del mismo contenedor que el lienzo.
    const mapa = getByRole('button', { name: /Cuadrícula/ }).parentElement!
    expect(mapa.querySelector('svg')).not.toBeNull()
    const leyenda = mapa.querySelector('details')!
    expect(leyenda).not.toBeNull()
    expect(leyenda.open).toBe(false)
    expect(leyenda.textContent).toContain('Salida de la región')
  })
})

/// UX-7 (hito 0.2) — el mapa de zona respeta la fase: con un motivo para no moverse, el clic no
/// pide el paso al backend y deja el motivo a la vista.
describe('ZonaPanel — UX-7', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('con bloqueoMovimiento, ir hacia una salida lejana no llama a moverEnZona y enseña el motivo', async () => {
    const salida = { locationId: 'l2', slug: 'vado', nombre: 'Vado', x: 700, y: 500, visitada: true, alcanzable: false, teaser: null, description: null, imageUrl: null }
    vi.mocked(getZona).mockResolvedValue({ ...zona, salidas: [salida] } as never)
    const utils = render(<ZonaPanel saveId="s1" bloqueoMovimiento="El narrador todavía está escribiendo." />)
    await act(async () => {})
    const marcador = Array.from(utils.container.querySelectorAll('svg g > title')).find((t) => t.textContent === 'Vado')!.parentElement!
    await act(async () => {
      fireEvent.click(marcador)
    })
    expect(moverEnZona).not.toHaveBeenCalled()
    expect(utils.getByText('El narrador todavía está escribiendo.')).toBeTruthy()
  })
})


/// Z-B (hito 0.2) — ZON-30/31/32: al pasar el ratón, la celda se resalta y se ve la ruta prevista
/// con su coste. jsdom no tiene la matriz de pantalla del SVG: se sustituye por la identidad.
describe('ZonaPanel — Z-B, ruta prevista', () => {
  beforeEach(() => {
    vi.mocked(getZona).mockResolvedValue({ ...zona, fictionalMinutes: 7 * 60 + 55 } as never)
    const proto = SVGSVGElement.prototype as unknown as Record<string, unknown>
    proto.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform(this: { x: number; y: number }) { return { x: this.x, y: this.y } } })
    proto.getScreenCTM = () => ({ inverse: () => ({}) })
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('pasar el ratón resalta la celda y prevé la ruta con pasos, minutos y hora de llegada', async () => {
    const { container, queryByTestId, getByTestId } = render(<ZonaPanel saveId="s1" />)
    await act(async () => {})
    const svg = [...container.querySelectorAll('svg')].find((e) => e.getAttribute('viewBox') === '0 0 800 600')!
    // Jugador en (375, 325) = celda (7, 6); ratón en la celda (11, 6): 4 pasos.
    fireEvent.mouseMove(svg, { clientX: 575, clientY: 325 })
    expect(queryByTestId('celda-cursor')).not.toBeNull()
    expect(queryByTestId('ruta-prevista')).not.toBeNull()
    expect(getByTestId('coste-ruta').textContent).toBe('4 pasos · 4 min · llegas a las 07:59')
    fireEvent.mouseLeave(svg)
    expect(queryByTestId('ruta-prevista')).toBeNull()
  })

  it('al andar: bandera en el destino y la ruta que queda; al llegar desaparecen', async () => {
    let x = 375
    vi.mocked(moverEnZona).mockImplementation(async () => {
      x += 50
      return { jugador: { x, y: 325 }, caminoRestante: x < 525 ? [{ x: 525, y: 325 }] : [], zonePointsMovidos: [] } as never
    })
    const { container, queryByTestId, findByTestId } = render(<ZonaPanel saveId="s1" />)
    await act(async () => {})
    const svg = [...container.querySelectorAll('svg')].find((e) => e.getAttribute('viewBox') === '0 0 800 600')!
    fireEvent.click(svg, { clientX: 525, clientY: 325 })
    expect(await findByTestId('bandera-destino')).not.toBeNull()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 2200))
    })
    expect(queryByTestId('bandera-destino')).toBeNull()
  })
})
