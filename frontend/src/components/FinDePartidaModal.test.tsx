import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { FinDePartidaModal } from './FinDePartidaModal'

/// P128 (QA-27): la partida terminada lo dice, con muertes y días vividos, y lleva a «Tus partidas».
describe('FinDePartidaModal', () => {
  afterEach(cleanup)

  it('dice que ha terminado, con las muertes y los días vividos', () => {
    render(<FinDePartidaModal characterName="Gorhorn" deathCount={4} fictionalDate="Día 12, 17:40" onIrAPartidas={vi.fn()} esperaMs={0} />)
    expect(screen.getByText('Fin de la partida')).toBeTruthy()
    expect(screen.getByText(/Gorhorn ya no puede seguir/)).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
  })

  it('«Ir a tus partidas» lleva allí', () => {
    const onIrAPartidas = vi.fn()
    render(<FinDePartidaModal characterName="Gorhorn" deathCount={4} fictionalDate="Día 12, 17:40" onIrAPartidas={onIrAPartidas} esperaMs={0} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ir a tus partidas' }))
    expect(onIrAPartidas).toHaveBeenCalled()
  })
  it('espera antes de salir, para leer la última narración', () => {
    vi.useFakeTimers()
    try {
      render(<FinDePartidaModal characterName="Gorhorn" deathCount={4} fictionalDate="Día 12, 17:40" onIrAPartidas={vi.fn()} />)
      expect(screen.queryByText('Fin de la partida')).toBeNull()
      act(() => vi.advanceTimersByTime(3500))
      expect(screen.getByText('Fin de la partida')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})
