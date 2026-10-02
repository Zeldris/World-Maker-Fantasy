import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { GameHeader } from './GameHeader'

/// BAS-5 (hito 0.2) — cabecera sacada de GameView, mismo comportamiento.
describe('BAS-5 — GameHeader', () => {
  afterEach(() => {
    cleanup()
  })

  const props = {
    characterName: 'Ilse', worldName: 'Tarkor', level: 3, pendingAttributePoints: 2, condicionFisica: 'ILESO' as const,
    energia: 50, energiaMax: 100, hambre: 80, sed: 80, dificultad: 'MEDIO' as const, deathCount: 1,
    decisionEnEspera: true, avisoDecision: 'Tienes una clase por elegir', onAbrirDecision: vi.fn(),
    etiquetaFase: { icono: '🧭', texto: 'Ocupado' }, motivoFase: 'Estás ocupado con otra actividad.', ocupadoHasta: null,
    nowTick: 0, fictionalDate: 'Día 2, tarde', entorno: null, mundoAvanza: true, onSalir: vi.fn(), onAbrirNivel: vi.fn(),
  }

  it('pinta nivel, puntos, muertes, aviso de decisión, fase y fecha; los botones llaman a su handler', () => {
    const { getByText, getByRole } = render(<GameHeader {...props} />)
    expect(getByText('Nivel 3')).toBeTruthy()
    expect(getByText('+2')).toBeTruthy()
    expect(getByText(/💀 1\/4/)).toBeTruthy()
    expect(getByText(/Día 2, tarde/)).toBeTruthy()
    expect(getByRole('status', { name: 'El mundo avanza' })).toBeTruthy()
    expect(getByText(/Ocupado/).getAttribute('title')).toBe('Estás ocupado con otra actividad.')
    fireEvent.click(getByText(/Tienes una clase por elegir/))
    expect(props.onAbrirDecision).toHaveBeenCalled()
    fireEvent.click(getByText('← Salir a tus partidas'))
    expect(props.onSalir).toHaveBeenCalled()
  })
})
