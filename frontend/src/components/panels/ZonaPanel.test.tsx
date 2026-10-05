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

/// Z-B (hito 0.2) — ZON-40/41: tarjeta al pasar el ratón y menú pegado a la ficha al pulsarla.
describe('ZonaPanel — Z-B, tarjeta y menú de la ficha', () => {
  beforeEach(() => {
    vi.mocked(getZona).mockResolvedValue(zona as never)
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('al pasar el ratón, la tarjeta dice qué es, su disposición, cuántos y a qué distancia', async () => {
    const { container, getByTestId } = render(<ZonaPanel saveId="s1" />)
    await act(async () => {})
    const ficha = [...container.querySelectorAll('g.cursor-pointer')].find((g) => g.querySelector('title')?.textContent?.startsWith('Aullador rojo'))!
    fireEvent.mouseEnter(ficha)
    // Aullador en la celda (3, 2); el personaje en la (7, 6): 4 celdas.
    expect(getByTestId('tarjeta-ficha').textContent).toBe('Aullador rojoFauna · Enemigo · ×3 · a 4 celdas')
  })

  it('al pulsarla, menú pegado con sus acciones; «Ver ficha completa» abre el modal de siempre', async () => {
    const { container, getByRole, findByRole, queryByRole } = render(<ZonaPanel saveId="s1" />)
    await act(async () => {})
    const ficha = [...container.querySelectorAll('g.cursor-pointer')].find((g) => g.querySelector('title')?.textContent?.startsWith('Aullador rojo'))!
    fireEvent.click(ficha)
    const menu = getByRole('menu', { name: 'Aullador rojo' })
    expect([...menu.querySelectorAll('[role="menuitem"]')].map((b) => b.textContent)).toEqual(['Ir hasta aquí', 'Ver ficha completa'])
    fireEvent.click(getByRole('menuitem', { name: 'Ver ficha completa' }))
    expect(queryByRole('menu')).toBeNull()
    expect(await findByRole('dialog')).toBeTruthy()
  })
})

/// Z-B (hito 0.2) — ZON-51 (radio de interacción) y ZON-18 (parcelas con lenguaje de ficha).
describe('ZonaPanel — Z-B, radio y parcelas', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('el radio de interacción rodea al personaje (no en la vista informativa) y la parcela en obras lo dice', async () => {
    vi.mocked(getZona).mockResolvedValue({
      ...zona,
      parcelas: [
        { id: 'pa1', x: 125, y: 475, tipo: 'BASICA', building: null },
        { id: 'pa2', x: 225, y: 475, tipo: 'BASICA', building: { id: 'b1', name: 'Granero', status: 'EN_CONSTRUCCION' } },
      ],
    } as never)
    const { getByTestId, getByLabelText, unmount } = render(<ZonaPanel saveId="s1" />)
    await act(async () => {})
    expect(getByTestId('radio-interaccion').getAttribute('style')).toContain('translate(375px, 325px)')
    expect(getByLabelText('En obras')).toBeTruthy()
    unmount()
    const consulta = render(<ZonaPanel saveId="s1" soloConsulta />)
    await act(async () => {})
    expect(consulta.queryByTestId('radio-interaccion')).toBeNull()
  })
})


/// ZON-5 (hito 0.2, petición de la usuaria) — chocar con algo no cierra el mapa: la tarjeta del
/// encuentro sale junto a su ficha, con sus acciones y «Seguir mi camino».
describe('ZonaPanel — ZON-5, encuentro en el mapa', () => {
  beforeEach(() => {
    vi.mocked(getZona).mockResolvedValue(zona as never)
    const proto = SVGSVGElement.prototype as unknown as Record<string, unknown>
    proto.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform(this: { x: number; y: number }) { return { x: this.x, y: this.y } } })
    proto.getScreenCTM = () => ({ inverse: () => ({}) })
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('el mapa sigue abierto, la tarjeta sale junto a la ficha y «Seguir mi camino» ignora y continúa', async () => {
    let paso = 0
    vi.mocked(moverEnZona).mockImplementation(async () => {
      paso++
      if (paso === 1) {
        return {
          jugador: { x: 325, y: 325 }, caminoRestante: [{ x: 275, y: 325 }], zonePointsMovidos: [],
          colision: { targetSlug: 'aullador', targetName: 'Aullador rojo', temperamento: 'CAUTELOSO' },
          dynamicModeOffer: { tipo: 'FAUNA', targetSlug: 'aullador', targetName: 'Aullador rojo', zonePointId: 'p1', cantidad: 3 },
          logEntry: { id: 'l1', text: 'Un grupo de aulladores.', timeLabel: '', createdAt: '' },
        } as never
      }
      return { jugador: { x: 275, y: 325 }, caminoRestante: [], zonePointsMovidos: [] } as never
    })
    const onClose = vi.fn()
    const ignorar = vi.fn()
    const ofertaEnMapa = vi.fn((entryId: string) =>
      entryId === 'l1'
        ? { tone: 'accent2' as const, icon: '💬', title: 'Un grupo de 3 Aullador rojo busca tu atención', subtitle: '', actions: [{ label: 'Interactuar', tone: 'primary' as const, onClick: vi.fn() }, { label: 'Ignorar', tone: 'neutral' as const, onClick: ignorar }] }
        : null,
    )
    const { container, findByTestId, getByRole } = render(<ZonaPanel saveId="s1" onClose={onClose} onEncuentroZona={vi.fn()} ofertaEnMapa={ofertaEnMapa} />)
    await act(async () => {})
    const svg = [...container.querySelectorAll('svg')].find((e) => e.getAttribute('viewBox') === '0 0 800 600')!
    fireEvent.click(svg, { clientX: 275, clientY: 325 })
    const tarjeta = await findByTestId('encuentro-en-mapa')
    expect(onClose).not.toHaveBeenCalled()
    expect(tarjeta.textContent).toContain('busca tu atención')
    // Junto a la ficha del aullador (175, 125), no al personaje.
    expect(Number(tarjeta.getAttribute('x'))).toBeLessThan(400)
    fireEvent.click(getByRole('button', { name: 'Seguir mi camino' }))
    expect(ignorar).toHaveBeenCalledTimes(1)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 900))
    })
    expect(moverEnZona).toHaveBeenCalledTimes(2)
  })
})

/// Z-D (hito 0.2) — ZON-50/33/53: amenaza, ruta con riesgo y patrulla de lo ya descubierto.
describe('ZonaPanel — Z-D, sin sorpresas', () => {
  beforeEach(() => {
    const proto = SVGSVGElement.prototype as unknown as Record<string, unknown>
    proto.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform(this: { x: number; y: number }) { return { x: this.x, y: this.y } } })
    proto.getScreenCTM = () => ({ inverse: () => ({}) })
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('un hostil conocido lleva su radio y su estado; la ruta hacia él sale en riesgo; su patrulla, al pasar el ratón', async () => {
    const hostil = { ...zona.puntos[0]!, x: 475, y: 325, hostil: true, ruta: [{ x: 475, y: 325 }, { x: 575, y: 325 }] }
    vi.mocked(getZona).mockResolvedValue({ ...zona, puntos: [hostil] } as never)
    const { container, getByTestId, queryByTestId } = render(<ZonaPanel saveId="s1" />)
    await act(async () => {})
    // Personaje en (7, 6) y hostil en (9, 6): a 2 celdas, dentro del radio.
    expect(getByTestId('radio-amenaza').textContent).toBe('¡te persigue!')
    const svg = [...container.querySelectorAll('svg')].find((e) => e.getAttribute('viewBox') === '0 0 800 600')!
    fireEvent.mouseMove(svg, { clientX: 425, clientY: 325 })
    expect(queryByTestId('ruta-en-riesgo')).not.toBeNull()
    expect(queryByTestId('ruta-patrulla')).toBeNull()
    const ficha = [...container.querySelectorAll('g.cursor-pointer')].find((g) => g.querySelector('title')?.textContent?.startsWith('Aullador rojo'))!
    fireEvent.mouseEnter(ficha)
    expect(queryByTestId('ruta-patrulla')).not.toBeNull()
  })
})


/// Z-D (hito 0.2) — ZON-16/ZON-58: estados de las fichas (sin descubrir, agotado, con candado).
describe('ZonaPanel — Z-D, estados de las fichas', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('lo no descubierto sale como silueta con «?»; un recurso agotado, con ⏳; uno que pide nivel, con candado', async () => {
    vi.mocked(getZona).mockResolvedValue({
      ...zona,
      puntos: [
        { ...zona.puntos[0]!, nombre: '???', descubierto: false },
        { id: 'r1', x: 525, y: 125, tipo: 'RECURSO', targetSlug: 'yerreo', nombre: 'Yerreo', cantidad: 1, color: 'INERTE', descubierto: true, agotado: true },
        { id: 'r2', x: 625, y: 125, tipo: 'RECURSO', targetSlug: 'roca-dura', nombre: 'Roca dura', cantidad: 1, color: 'INERTE', descubierto: true, nivelRequerido: 4 },
      ],
    } as never)
    const { container, getByTestId, getAllByTestId } = render(<ZonaPanel saveId="s1" />)
    await act(async () => {})
    expect(getAllByTestId('ficha-desconocida').length).toBeGreaterThan(0)
    expect(getByTestId('ficha-agotada')).toBeTruthy()
    expect(getByTestId('ficha-candado').textContent).toBe('🔒4')
    const roca = [...container.querySelectorAll('g.cursor-pointer')].find((g) => g.querySelector('title')?.textContent?.startsWith('Roca dura'))!
    fireEvent.mouseEnter(roca)
    expect(getByTestId('tarjeta-ficha').textContent).toContain('pide nivel 4 de oficio')
  })
})
