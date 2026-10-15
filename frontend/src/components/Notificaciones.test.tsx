import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Notificaciones } from './Notificaciones'

describe('Notificaciones', () => {
  it('UX-36: el enlace del aviso lleva a su sitio y cierra el aviso', () => {
    const alPulsar = vi.fn()
    const onDescartar = vi.fn()
    const { getByRole } = render(
      <Notificaciones
        notificaciones={[{ id: 7, veces: 1, tipo: 'accent2', icono: '📜', texto: 'Cae el líder Serhu', enlace: { label: 'Ver en Leyendas', alPulsar } }]}
        onDescartar={onDescartar}
      />,
    )
    fireEvent.click(getByRole('button', { name: 'Ver en Leyendas' }))
    expect(alPulsar).toHaveBeenCalledOnce()
    expect(onDescartar).toHaveBeenCalledWith(7)
  })

  // P163 (QA-27): arriba a la derecha tapaba el «›» del panel El Mundo y la barra lateral.
  it('en escritorio va por debajo de la cabecera de los paneles y a la izquierda de la barra lateral', () => {
    const { container } = render(<Notificaciones notificaciones={[{ id: 1, veces: 1, tipo: 'moss', icono: '🎒', texto: 'Obtienes Salvia' }]} onDescartar={() => {}} />)
    const pila = container.firstElementChild as HTMLElement
    expect(pila.className).toContain('md:top-36')
    expect(pila.className).toContain('md:right-24')
  })
})
