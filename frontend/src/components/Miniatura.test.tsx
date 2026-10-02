import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Miniatura } from './Miniatura'
import { EnciclopediaLinkContext } from '../context/enciclopediaLinkContext'
import { EMPTY_ENCICLOPEDIA_INDEX, type EnciclopediaLinkTarget } from '../lib/enciclopediaIndex'

const ficha = (extra: Partial<EnciclopediaLinkTarget>) =>
  ({ kind: 'info', icon: '🐺', name: 'Lobo', description: '', ...extra }) as EnciclopediaLinkTarget

/// MOD-6 (hito 0.2) — miniatura de la entidad en las filas de los modales.
describe('MOD-6 — Miniatura', () => {
  afterEach(() => {
    cleanup()
  })

  const conIndice = (entries: [string, EnciclopediaLinkTarget][], bySlug: [string, EnciclopediaLinkTarget][], ui: React.ReactNode) =>
    render(
      <EnciclopediaLinkContext.Provider value={{ enciclopediaIndex: { ...EMPTY_ENCICLOPEDIA_INDEX, entries: new Map(entries), bySlugKey: new Map(bySlug) } }}>
        {ui}
      </EnciclopediaLinkContext.Provider>,
    )

  it('con imagen en la ficha (por slug): la pinta', () => {
    const { container } = conIndice([], [['fauna:lobo', ficha({ imageUrls: { thumbnail: '/images/lobo.png', banner: null } })]], <Miniatura nombre="Lobo" entityType="fauna" slug="lobo" icono="🐾" />)
    expect(container.querySelector('img')!.getAttribute('src')).toContain('/images/lobo.png')
  })

  it('sin imagen: el icono de su ficha (por nombre); sin ficha, el de reserva', () => {
    const { container, rerender } = conIndice([['lobo', ficha({})]], [], <Miniatura nombre="Lobo" icono="🐾" />)
    expect(container.textContent).toBe('🐺')
    rerender(<Miniatura nombre="Desconocido" icono="🐾" />)
    expect(container.textContent).toBe('🐾')
  })
})
