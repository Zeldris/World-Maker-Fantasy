import { describe, it, expect } from 'vitest'
import { centrarEnSuContenedor } from './centrarEnContenedor'

function rect(top: number, left: number, height: number, width: number) {
  return () => ({ top, left, height, width, bottom: top + height, right: left + width, x: left, y: top, toJSON: () => ({}) }) as DOMRect
}

/// P33 (QA-27): solo se mueve el contenedor del mapa, nunca la página.
describe('centrarEnSuContenedor', () => {
  it('centra el elemento moviendo solo su contenedor con scroll', () => {
    const pagina = document.createElement('div')
    const contenedor = document.createElement('div')
    contenedor.style.overflowY = 'auto'
    const punto = document.createElement('span')
    contenedor.appendChild(punto)
    pagina.appendChild(contenedor)
    document.body.appendChild(pagina)
    Object.defineProperty(contenedor, 'scrollHeight', { value: 2000 })
    Object.defineProperty(contenedor, 'clientHeight', { value: 400 })
    contenedor.getBoundingClientRect = rect(0, 0, 400, 300)
    punto.getBoundingClientRect = rect(900, 140, 20, 20)
    centrarEnSuContenedor(punto)
    expect(contenedor.scrollTop).toBe(710)
    expect(pagina.scrollTop).toBe(0)
  })

  it('sin contenedor con scroll no hace nada', () => {
    const punto = document.createElement('span')
    document.body.appendChild(punto)
    expect(() => centrarEnSuContenedor(punto)).not.toThrow()
  })
})
