import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { useNavegacionRejilla } from './useNavegacionRejilla'

function Rejilla() {
  const navegar = useNavegacionRejilla()
  return (
    <div onKeyDown={navegar}>
      {['a', 'b', 'c'].map((n, i) => (
        <button key={n} type="button" data-celda disabled={n === 'c' ? false : undefined} data-x={i * 20}>
          {n}
        </button>
      ))}
      <button type="button">fuera</button>
    </div>
  )
}

/// BAS-3 (hito 0.2) — las flechas mueven el foco entre las celdas de la rejilla.
describe('BAS-3 — useNavegacionRejilla', () => {
  afterEach(() => {
    cleanup()
  })

  it('derecha pasa a la celda de al lado; Fin, a la última; fuera de la rejilla no hace nada', () => {
    const { getByText } = render(<Rejilla />)
    for (const b of document.querySelectorAll<HTMLElement>('[data-celda]')) {
      const x = Number(b.dataset.x)
      b.getBoundingClientRect = () => ({ left: x, top: 0, width: 10, height: 10 }) as DOMRect
    }
    getByText('a').focus()
    fireEvent.keyDown(getByText('a'), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(getByText('b'))
    fireEvent.keyDown(getByText('b'), { key: 'End' })
    expect(document.activeElement).toBe(getByText('c'))
    getByText('fuera').focus()
    fireEvent.keyDown(getByText('fuera'), { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(getByText('fuera'))
  })
})
