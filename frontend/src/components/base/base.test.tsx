import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import { useState } from 'react'
import { ProgressBar, MS_FANTASMA } from './ProgressBar'
import { Tabs } from './Tabs'
import { Chip } from './Chip'
import { EntityRow } from './EntityRow'

/// BAS-8 (hito 0.2) — librería de componentes base.
describe('BAS-8 — componentes base', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('ProgressBar: al bajar, la barra fantasma se queda en el valor anterior y luego se recoge', () => {
    vi.useFakeTimers()
    const { container, rerender, getByRole } = render(<ProgressBar pct={80} color="bg-moss-500" etiqueta="Vida" />)
    rerender(<ProgressBar pct={30} color="bg-moss-500" etiqueta="Vida" />)
    const fantasma = container.querySelector('[data-fantasma]') as HTMLElement
    expect(fantasma.style.width).toBe('80%')
    expect(getByRole('progressbar', { name: 'Vida' }).getAttribute('aria-valuenow')).toBe('30')
    act(() => {
      vi.advanceTimersByTime(MS_FANTASMA)
    })
    expect(fantasma.style.width).toBe('30%')
  })

  it('Tabs: clic y flechas cambian de pestaña; aria-selected en la activa', () => {
    function Prueba() {
      const [activa, setActiva] = useState<'a' | 'b' | 'c'>('a')
      return <Tabs etiqueta="Secciones" activa={activa} onChange={setActiva} pestanas={[{ id: 'a', label: 'Uno' }, { id: 'b', label: 'Dos' }, { id: 'c', label: 'Tres' }]} />
    }
    const { getByRole } = render(<Prueba />)
    fireEvent.click(getByRole('tab', { name: 'Dos' }))
    expect(getByRole('tab', { name: 'Dos' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(getByRole('tablist'), { key: 'ArrowRight' })
    expect(getByRole('tab', { name: 'Tres' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(getByRole('tablist'), { key: 'Home' })
    expect(getByRole('tab', { name: 'Uno' }).getAttribute('aria-selected')).toBe('true')
  })

  it('Chip y EntityRow pintan su contenido', () => {
    const { getByText } = render(
      <>
        <Chip tono="moss">+40 XP</Chip>
        <EntityRow nombre="Brenn" subtitulo="Maestro herrero" icono="👤" accion={<button type="button">Aprender</button>} />
      </>,
    )
    expect(getByText('+40 XP').className).toContain('text-moss-300')
    expect(getByText('Maestro herrero')).toBeTruthy()
    expect(getByText('Aprender')).toBeTruthy()
  })
})
