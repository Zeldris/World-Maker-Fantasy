import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, within, renderHook, act } from '@testing-library/react'
import { InteractiveMap } from './InteractiveMap'
import { beriRegions } from '../../data/map'
import { useRumoresDelMapa } from '../../hooks/useRumoresDelMapa'

/// INT-9 (hito 0.2) — rumor con lugar: pergamino en la región hasta que se lee.
describe('INT-9 — rumores en el mapa de Berig', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })
  const rumor = { sucesoId: 'a', region: 'Ciénaga Troncal', texto: 'Se dice que algo pasó en la Ciénaga.' }

  it('marca la región con pergamino y, al pulsarla, enseña sus rumores y los da por leídos', () => {
    const onLeerRumores = vi.fn()
    const { getByRole, container } = render(
      <InteractiveMap
        regions={beriRegions}
        currentRegion="Las Llanuras del Viento Rojo"
        hasLlanurasMap={false}
        hasCristalHeladoMap={false}
        rumores={[rumor]}
        regionesConRumor={new Set(['Ciénaga Troncal'])}
        onLeerRumores={onLeerRumores}
      />,
    )
    expect(getByRole('img', { name: 'Rumores de Ciénaga Troncal sin leer' })).toBeTruthy()
    const forma = [...container.querySelectorAll('g[role="button"]')].find((g) => within(g as HTMLElement).queryByRole('img', { name: /Ciénaga Troncal/ }))!
    fireEvent.click(forma)
    expect(onLeerRumores).toHaveBeenCalledWith('Ciénaga Troncal')
    expect(getByRole('list', { name: 'Rumores de Ciénaga Troncal' }).textContent).toContain('algo pasó en la Ciénaga')
  })

  it('el hook recuerda lo leído por partida', () => {
    const log = [{ id: '1', channel: 'world', text: rumor.texto, timeLabel: '', createdAt: '', noticia: { sucesoId: 'a', rumor: { region: 'Ciénaga Troncal', pasoEn: 0 } } }] as never
    const { result } = renderHook(() => useRumoresDelMapa('s1', log))
    expect(result.current.sinLeer.has('Ciénaga Troncal')).toBe(true)
    act(() => result.current.marcarLeidos('Ciénaga Troncal'))
    expect(result.current.sinLeer.size).toBe(0)
    const otra = renderHook(() => useRumoresDelMapa('s1', log))
    expect(otra.result.current.sinLeer.size).toBe(0)
  })
})
