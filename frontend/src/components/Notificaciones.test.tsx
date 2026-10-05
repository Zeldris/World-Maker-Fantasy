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
})
