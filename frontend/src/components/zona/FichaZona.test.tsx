import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { EstandarteSalida, EtiquetaNombre, FichaJugador, FichaZona, anclaEtiqueta } from './FichaZona'
import { COLOR_DISPOSICION } from '../../lib/zonaFichas'

/// ZON-10/11/13 (hito 0.1, roadmap-front-zona.md) — ficha legible y a tamaño fijo de pantalla.
function enSvg(ui: React.ReactNode) {
  return render(<svg>{ui}</svg>)
}

describe('FichaZona', () => {
  afterEach(() => cleanup())

  it('escala a píxeles de pantalla y tiene área de clic de 40 px', () => {
    const { container } = enSvg(<FichaZona tipo="FAUNA" color={COLOR_DISPOSICION.ENEMIGO} escala={1.5} />)
    expect(container.querySelector('g')!.getAttribute('transform')).toBe('scale(1.5)')
    const hit = container.querySelector('circle[fill="transparent"]')!
    expect(hit.getAttribute('r')).toBe('20')
  })

  it('el color de disposición va en el anillo, con tokens del juego', () => {
    const { container } = enSvg(<FichaZona tipo="NPC" color={COLOR_DISPOSICION.ALIADO} escala={1} />)
    const anillo = [...container.querySelectorAll('path')].find((p) => p.getAttribute('fill') === 'none')!
    expect(anillo.getAttribute('style')).toContain('var(--color-moss-400)')
  })

  it('un grupo lleva insignia ×N fuera de la ficha; desde 3, placas apiladas', () => {
    const dos = enSvg(<FichaZona tipo="FAUNA" color={COLOR_DISPOSICION.NEUTRO} escala={1} cantidad={2} />)
    expect(dos.container.textContent).toBe('×2')
    expect(dos.container.querySelectorAll('g[opacity="0.75"]')).toHaveLength(0)
    cleanup()
    const tres = enSvg(<FichaZona tipo="FAUNA" color={COLOR_DISPOSICION.NEUTRO} escala={1} cantidad={3} />)
    expect(tres.container.textContent).toBe('×3')
    expect(tres.container.querySelectorAll('g[opacity="0.75"]')).toHaveLength(2)
  })

  it('una sola unidad no lleva insignia', () => {
    const { container } = enSvg(<FichaZona tipo="EDIFICIO" color={COLOR_DISPOSICION.NEUTRO} escala={1} />)
    expect(container.textContent).toBe('')
  })

  // ZON-14 (hito 0.1, Z10) — el personaje se distingue, dice hacia dónde va y respira quieto.
  it('ficha del personaje: flecha según el último paso y halo solo quieto', () => {
    const quieto = enSvg(<FichaJugador escala={1} angulo={90} quieto />)
    expect(quieto.getByTestId('flecha-direccion').getAttribute('transform')).toBe('rotate(90)')
    expect(quieto.container.querySelector('.animate-pulse-slow')).not.toBeNull()
    cleanup()
    const andando = enSvg(<FichaJugador escala={1} angulo={null} quieto={false} />)
    expect(andando.queryByTestId('flecha-direccion')).toBeNull()
    expect(andando.container.querySelector('.animate-pulse-slow')).toBeNull()
  })

  // ZON-17 (hito 0.1) — la salida dice a dónde lleva y su etiqueta crece hacia el interior del mapa.
  it('estandarte de salida: destino escrito, etiqueta hacia dentro', () => {
    const este = enSvg(<EstandarteSalida escala={1} angulo={0} texto="Llanura del Viento Rojo" />)
    expect(este.container.textContent).toBe('Llanura del Viento Rojo')
    const rectEste = este.container.querySelector('[data-testid="etiqueta-nombre"] rect')!
    expect(Number(rectEste.getAttribute('x'))).toBeLessThan(0) // crece hacia el oeste (dentro)
    cleanup()
    const norte = enSvg(<EstandarteSalida escala={1} angulo={-90} texto="Camino hacia el norte" />)
    const rectNorte = norte.container.querySelector('[data-testid="etiqueta-nombre"] rect')!
    expect(Number(rectNorte.getAttribute('y'))).toBeGreaterThan(0) // debajo de la salida norte
  })

  // ZON-19 (hito 0.1) — etiqueta legible: placa oscura con texto claro, centrada bajo la ficha.
  it('etiqueta de nombre centrada bajo la ficha', () => {
    const { container } = enSvg(<EtiquetaNombre texto="Gistera Koh" />)
    const rect = container.querySelector('rect')!
    const ancho = Number(rect.getAttribute('width'))
    expect(Number(rect.getAttribute('x'))).toBeCloseTo(-ancho / 2)
    expect(container.textContent).toBe('Gistera Koh')
  })

  // P61 (QA-27): la etiqueta junto al borde crece hacia dentro en vez de cortarse.
  it('ancla la etiqueta hacia dentro junto a los bordes', () => {
    const nombre = 'Salvia del Polvo en la sombra de la hondonada'
    expect(anclaEtiqueta(780, nombre, 1)).toBe('end')
    expect(anclaEtiqueta(20, nombre, 1)).toBe('start')
    expect(anclaEtiqueta(400, nombre, 1)).toBe('middle')
  })
})
