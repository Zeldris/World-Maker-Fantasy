import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { IconCard } from './IconCard'
import { itemIcon, itemImagen } from '../lib/enciclopediaTargets'

const base = { name: 'Objeto', tooltip: 't', onUse: () => {}, onDetail: () => {} }

describe('UX-41 — IconCard con pictograma', () => {
  afterEach(cleanup)

  it('categoría con imagen: pinta el pictograma, no el emoji', () => {
    const imagen = itemImagen('arma', 'Espada corta')
    expect(imagen).toBeTruthy()
    const { container } = render(<IconCard {...base} icon={itemIcon('arma', 'Espada corta')} imagen={imagen} />)
    expect(container.querySelector('img[data-pictograma]')).toBeTruthy()
    expect(container.textContent).not.toContain('⚔️')
  })

  it('icono por nombre: sin imagen, pinta el emoji', () => {
    expect(itemImagen('arma', 'Hacha de leñador')).toBeUndefined()
    const { container } = render(<IconCard {...base} icon={itemIcon('arma', 'Hacha de leñador')} imagen={itemImagen('arma', 'Hacha de leñador')} />)
    expect(container.querySelector('img[data-pictograma]')).toBeNull()
    expect(container.textContent).toContain('🪓')
  })
})
