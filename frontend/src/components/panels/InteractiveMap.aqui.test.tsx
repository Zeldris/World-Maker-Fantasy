import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { InteractiveMap } from './InteractiveMap'
import { beriRegions } from '../../data/map'

/// P33 (QA-27): el mapa de Berig abría arriba, en Cristal Helado, con la jugadora en las Llanuras.
describe('P33 — el mapa de Berig abre donde está la jugadora', () => {
  const vistos: Element[] = []
  const original = Element.prototype.scrollIntoView
  afterEach(() => {
    cleanup()
    vistos.length = 0
    Element.prototype.scrollIntoView = original
  })
  function espiar() {
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      vistos.push(this)
    })
  }

  it('con el mapa de la región, lleva el scroll a su punto', () => {
    espiar()
    const nodos = [
      { slug: 'karot-veku', name: 'Karot Veku', description: 'x', x: 100, y: 100 },
      { slug: 'hondonada-del-eco', name: 'Hondonada del Eco', description: 'x', x: 300, y: 300 },
    ]
    render(
      <InteractiveMap
        regions={beriRegions}
        currentRegion="Las Llanuras del Viento Rojo"
        currentLocationSlug="hondonada-del-eco"
        llanurasNodes={nodos}
        llanurasEdges={[]}
        hasLlanurasMap
        hasCristalHeladoMap={false}
      />,
    )
    expect(vistos).toHaveLength(1)
    expect(vistos[0].getAttribute('data-aqui')).toBe('nodo')
    expect(vistos[0].querySelector('title')?.textContent).toBe('Estás aquí')
  })

  it('sin mapa de la región, lleva el scroll a su región', () => {
    espiar()
    render(
      <InteractiveMap regions={beriRegions} currentRegion="Las Llanuras del Viento Rojo" hasLlanurasMap={false} hasCristalHeladoMap={false} />,
    )
    expect(vistos).toHaveLength(1)
    expect(vistos[0].getAttribute('data-aqui')).toBe('region')
  })
})
