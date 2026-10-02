import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Capa } from './Capa'
import { CapasContext } from '../context/capasContext'
import { resolverCapas } from '../lib/capas'

/// UX-9 (hito 0.2) — la capa que espera se oculta pero sigue montada; la ficha (hija) va encima.
describe('UX-9 — Capa', () => {
  afterEach(() => {
    cleanup()
  })

  it('la de nivel inferior queda oculta y montada; la superior y la hija se ven', () => {
    const estado = resolverCapas([
      { id: 'dinamico', nivel: 'escena' },
      { id: 'clase', nivel: 'decision' },
      { id: 'detalle', nivel: 'consulta', hija: true },
    ])
    const { container, getByText } = render(
      <CapasContext.Provider value={estado}>
        <Capa id="dinamico">
          <input defaultValue="a medias" />
        </Capa>
        <Capa id="clase">Elige clase</Capa>
        <Capa id="detalle" hija>
          Ficha
        </Capa>
      </CapasContext.Provider>,
    )
    const dinamico = container.querySelector('[data-capa="dinamico"]') as HTMLElement
    expect(dinamico.hidden).toBe(true)
    expect((dinamico.querySelector('input') as HTMLInputElement).value).toBe('a medias')
    expect((getByText('Elige clase') as HTMLElement).hidden).toBe(false)
    expect(container.querySelector('[data-capa="detalle"]')!.className).toContain('z-[60]')
  })

  it('sin proveedor pinta siempre su contenido', () => {
    const { container } = render(<Capa id="x">Hola</Capa>)
    expect((container.querySelector('[data-capa="x"]') as HTMLElement).hidden).toBe(false)
  })
})
