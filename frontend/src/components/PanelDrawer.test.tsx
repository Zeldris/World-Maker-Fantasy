import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PanelDrawer } from './PanelDrawer'

/// F9-6: el cajón del Reino quedaba pegado abajo y cortaba Diplomacia/Mercado en pantallas
/// grandes; debe acotar su alto a la ventana/contenedor y desplazar por dentro.
describe('PanelDrawer', () => {
  Element.prototype.scrollTo = () => {}
  it('acota el alto a la ventana y desplaza el contenido por dentro', () => {
    const { container, getByText } = render(
      <PanelDrawer title="Reino" onClose={() => {}}>
        <p>contenido</p>
      </PanelDrawer>,
    )
    const panel = container.querySelector('.plank-panel') as HTMLElement
    // P144: alto fijo (no solo máximo), igual para todos los paneles, cortos o largos.
    expect(panel.className).toContain('h-[min(85vh,100%)]')
    expect(panel.className).not.toContain('max-h-')
    expect(panel.className).toContain('min-h-0')
    expect(getByText('contenido').parentElement?.className).toContain('overflow-y-auto')
  })
})
