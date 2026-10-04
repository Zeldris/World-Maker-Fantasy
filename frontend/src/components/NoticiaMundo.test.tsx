import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { NoticiaMundo } from './NoticiaMundo'
import { diaDeFiccion } from '../lib/noticias'

/// UX-38 (hito 0.2) — noticias de «El mundo» con categoría, oportunidad y resumen plegable.
describe('UX-38 — NoticiaMundo', () => {
  afterEach(() => cleanup())
  const texto = (t: string) => t

  it('icono de categoría y etiqueta de la oportunidad con lugar y día', () => {
    const { getByRole, getByText } = render(
      <NoticiaMundo
        text="Gente de A y de B llega a las manos."
        noticia={{ categoria: 'CONFLICTO', oportunidad: { lugar: 'Cruce de las Cenizas', locationId: 'l1', venceEn: 12 * 1440 + 720 } }}
        texto={texto}
      />,
    )
    expect(getByRole('img', { name: 'Conflicto' })).toBeTruthy()
    expect(getByText(/En Cruce de las Cenizas · hasta el día 13/)).toBeTruthy()
  })

  it('el resumen de varios días va plegado y se despliega con una noticia por línea', () => {
    const { container, getByText } = render(
      <NoticiaMundo text={'Mientras pasaban los días…\n• Una caravana viaja de A a B.\n• Se dice que una plaga golpea C.'} noticia={{ resumen: true }} texto={texto} />,
    )
    const details = container.querySelector('details')!
    expect(details.open).toBe(false)
    expect(getByText('(2 noticias)')).toBeTruthy()
    fireEvent.click(getByText('Mientras pasaban los días…'))
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(getByText('Una caravana viaja de A a B.')).toBeTruthy()
  })

  it('día de ficción desde minutos (día 1 = el primero)', () => {
    expect(diaDeFiccion(0)).toBe(1)
    expect(diaDeFiccion(1440)).toBe(2)
  })
})
