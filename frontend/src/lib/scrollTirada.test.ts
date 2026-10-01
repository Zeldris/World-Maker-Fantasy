import { describe, it, expect, afterEach } from 'vitest'
import { debeDesplazarseATirada, marcarScrollManual, reiniciarScrollManual, RESPETO_SCROLL_MANUAL_MS } from './scrollTirada'

/// DAD-5 (hito 0.1) — no arrastrar al jugador hasta la tirada si ya la ve o si está leyendo.
function elementoEn(top: number, bottom: number): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  el.getBoundingClientRect = () => ({ top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON: () => ({}) })
  return el
}

describe('debeDesplazarseATirada', () => {
  afterEach(() => {
    reiniciarScrollManual()
    document.body.innerHTML = ''
  })

  it('no se desplaza si la tirada ya está a la vista', () => {
    expect(debeDesplazarseATirada(elementoEn(100, 200))).toBe(false)
  })

  it('se desplaza si la tirada está por debajo de la ventana', () => {
    expect(debeDesplazarseATirada(elementoEn(window.innerHeight + 50, window.innerHeight + 150))).toBe(true)
  })

  it('respeta un scroll manual reciente aunque la tirada no se vea', () => {
    const ahora = 1_000_000
    marcarScrollManual(ahora - 1000)
    const fuera = elementoEn(window.innerHeight + 50, window.innerHeight + 150)
    expect(debeDesplazarseATirada(fuera, ahora)).toBe(false)
    expect(debeDesplazarseATirada(fuera, ahora + RESPETO_SCROLL_MANUAL_MS)).toBe(true)
  })
})
