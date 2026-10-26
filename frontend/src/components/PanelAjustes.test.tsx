import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import { AjustesProvider } from '../context/AjustesProvider'
import { BotonAjustes } from './BotonAjustes'
import { AJUSTES_POR_DEFECTO, CLAVE_AJUSTES } from '../lib/ajustes'
import { PanelAjustes } from './PanelAjustes'

const getRitmoMundo = vi.fn()
const setRitmoMundo = vi.fn()
vi.mock('../lib/api', () => ({
  getRitmoMundo: (...a: unknown[]) => getRitmoMundo(...a),
  setRitmoMundo: (...a: unknown[]) => setRitmoMundo(...a),
}))

/// CFG-1/CFG-4 (hito 0.2) — botón ⚙️ y panel de configuración con vista previa.
describe('CFG-4 — panel de configuración', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-contrast')
  })
  afterEach(() => {
    cleanup()
  })

  const montar = () =>
    render(
      <AjustesProvider>
        <BotonAjustes />
      </AjustesProvider>,
    )

  it('vista previa en vivo; cancelar con cambios pide confirmación y descartar los deshace', () => {
    const { getByRole, getByText, queryByRole } = montar()
    fireEvent.click(getByRole('button', { name: 'Configuración' }))
    fireEvent.click(getByText('Accesibilidad'))
    fireEvent.click(getByRole('checkbox', { name: /Alto contraste/ }))
    expect(document.documentElement.dataset.contrast).toBe('alto')
    fireEvent.click(getByRole('button', { name: 'Cancelar' }))
    expect(getByText('Hay cambios sin aplicar.')).toBeTruthy()
    fireEvent.click(getByRole('button', { name: 'Descartar' }))
    expect(queryByRole('dialog')).toBeNull()
    expect(document.documentElement.dataset.contrast).toBeUndefined()
    expect(localStorage.getItem(CLAVE_AJUSTES)).toBeNull()
  })

  it('Aplicar guarda; Restablecer vuelve a los de por defecto en la vista previa', () => {
    const { getByRole, getByText } = montar()
    fireEvent.click(getByRole('button', { name: 'Configuración' }))
    fireEvent.click(getByText('Animaciones'))
    fireEvent.click(within(getByRole('radiogroup', { name: 'Velocidad de las tiradas' })).getByRole('radio', { name: 'Rápida' }))
    fireEvent.click(getByRole('button', { name: 'Aplicar' }))
    expect(JSON.parse(localStorage.getItem(CLAVE_AJUSTES)!).velocidadDados).toBe('rapida')
    fireEvent.click(getByRole('button', { name: 'Configuración' }))
    fireEvent.click(getByText('Animaciones'))
    fireEvent.click(getByRole('button', { name: 'Restablecer' }))
    expect(getByRole('radio', { name: 'Dramática' }).getAttribute('aria-checked')).toBe('true')
  })

  it('CFG-26: reasignar un atajo en Controles intercambia con el que tenía esa tecla', () => {
    const { getByRole, getByText, getAllByRole } = montar()
    fireEvent.click(getByRole('button', { name: 'Configuración' }))
    fireEvent.click(getByText('Controles'))
    fireEvent.click(getAllByRole('button', { name: 'Cambiar' })[0])
    fireEvent.keyDown(getByRole('textbox', { name: /Inventario/ }), { key: 'm' })
    fireEvent.click(getByRole('button', { name: 'Aplicar' }))
    const atajos = JSON.parse(localStorage.getItem(CLAVE_AJUSTES)!).atajos
    expect(atajos.inventario).toBe('m')
    expect(atajos.mapa).toBe('i')
  })
})


/// CR-12 (hito 0.2) — «Ritmo del mundo», pestaña Partida (solo con una partida abierta).
describe('CR-12 — ritmo del mundo en Configuración', () => {
  beforeEach(() => {
    getRitmoMundo.mockReset().mockResolvedValue({ estiloNarrador: 'EQUILIBRADO' })
    setRitmoMundo.mockReset().mockResolvedValue({})
  })
  afterEach(() => cleanup())

  it('sin partida no hay pestaña Partida', () => {
    const { queryByText } = render(<PanelAjustes guardados={AJUSTES_POR_DEFECTO} onCerrar={() => {}} />)
    expect(queryByText('Partida')).toBeNull()
    expect(getRitmoMundo).not.toHaveBeenCalled()
  })

  it('con partida carga el ritmo y Aplicar guarda el nuevo en la partida', async () => {
    const onCerrar = vi.fn()
    const { getByText, getByRole } = render(<PanelAjustes guardados={AJUSTES_POR_DEFECTO} partidaId="s1" onCerrar={onCerrar} />)
    fireEvent.click(getByText('Partida'))
    await waitFor(() => expect(getByRole('radio', { name: 'Equilibrado' }).getAttribute('aria-checked')).toBe('true'))
    expect((getByRole('button', { name: 'Aplicar' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(getByRole('radio', { name: 'Caótico' }))
    fireEvent.click(getByRole('button', { name: 'Aplicar' }))
    expect(setRitmoMundo).toHaveBeenCalledWith('s1', { estiloNarrador: 'CAOTICO' })
    expect(onCerrar).toHaveBeenCalled()
  })

  it('CR-67: intensidad y tamaño de los asaltos, sin opción de quitarlos', async () => {
    const { getByText, getByRole, queryByRole } = render(<PanelAjustes guardados={AJUSTES_POR_DEFECTO} partidaId="s1" onCerrar={vi.fn()} />)
    fireEvent.click(getByText('Partida'))
    await waitFor(() => expect(getByRole('radio', { name: 'Dura' })).toBeTruthy())
    expect(queryByRole('radio', { name: /Sin asaltos/ })).toBeNull()
    fireEvent.click(getByRole('radio', { name: 'Dura' }))
    fireEvent.click(getByRole('radio', { name: 'Fácil' }))
    fireEvent.click(getByRole('button', { name: 'Aplicar' }))
    expect(setRitmoMundo).toHaveBeenCalledWith('s1', { intensidadAsaltos: 'DURA', tamanoAsaltos: 'FACIL' })
  })

  it('P257: el texto bajo la intensidad cambia con el nivel elegido', async () => {
    const { getByText, getByRole, queryByText } = render(<PanelAjustes guardados={AJUSTES_POR_DEFECTO} partidaId="s1" onCerrar={vi.fn()} />)
    fireEvent.click(getByText('Partida'))
    await waitFor(() => expect(getByRole('radio', { name: 'Dura' })).toBeTruthy())
    expect(getByText(/^Normal: atacan cuando son bastante más fuertes/)).toBeTruthy()
    fireEvent.click(getByRole('radio', { name: 'Dura' }))
    expect(getByText(/^Dura: se atreven con poca ventaja/)).toBeTruthy()
    expect(queryByText(/^Normal: atacan cuando/)).toBeNull()
  })
})
