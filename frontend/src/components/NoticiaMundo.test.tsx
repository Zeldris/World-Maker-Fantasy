import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'
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

  it('cada línea del resumen conserva su icono y su oportunidad', () => {
    const { getByRole, getByText } = render(
      <NoticiaMundo
        text={'Mientras pasaban los días…\n• Una caravana viaja de A a B.\n• Algo sin más.'}
        noticia={{ resumen: true, lineas: [{ categoria: 'COMERCIO', oportunidad: { lugar: 'Vado', locationId: 'l', venceEn: 3 * 1440 } }, null] }}
        texto={texto}
      />,
    )
    fireEvent.click(getByText('Mientras pasaban los días…'))
    expect(getByRole('img', { name: 'Comercio' })).toBeTruthy()
    expect(getByText(/En Vado · hasta el día 4/)).toBeTruthy()
  })

  it('día de ficción desde minutos (día 1 = el primero)', () => {
    expect(diaDeFiccion(0)).toBe(1)
    expect(diaDeFiccion(1440)).toBe(2)
  })

  it('CR-34 (34e): la propuesta pendiente lleva Aceptar y Rechazar y, al responder, queda la respuesta', async () => {
    const onResponder = vi.fn(async () => 'ACEPTADA' as const)
    const { getByRole, getByText, queryByRole } = render(
      <NoticiaMundo
        text="Feg Ger propone a tu reino un tratado comercial."
        noticia={{ propuesta: { id: 'p1', faccion: 'Feg Ger', tipo: 'TRATADO', venceEn: 9 * 1440 } }}
        texto={texto}
        onResponderPropuesta={onResponder}
      />,
    )
    expect(getByText(/Hasta el día 10/)).toBeTruthy()
    fireEvent.click(getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(getByText('Aceptada')).toBeTruthy())
    expect(onResponder).toHaveBeenCalledWith('p1', true)
    expect(queryByRole('button', { name: 'Rechazar' })).toBeNull()
  })

  it('CR-34 (34e): una propuesta ya cerrada solo muestra la respuesta', () => {
    const { getByText, queryByRole } = render(
      <NoticiaMundo text="Feg Ger propone a tu reino una alianza." noticia={{ propuesta: { id: 'p2', faccion: 'Feg Ger', tipo: 'ALIANZA', venceEn: 0, respuesta: 'CADUCADA' } }} texto={texto} />,
    )
    expect(getByText('Sin respuesta: rechazada')).toBeTruthy()
    expect(queryByRole('button', { name: 'Aceptar' })).toBeNull()
  })
})
