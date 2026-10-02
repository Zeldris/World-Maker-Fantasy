import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { FichaZona } from './FichaZona'
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
})
