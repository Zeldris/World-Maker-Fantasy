import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import { ROLL_DURATION_MS } from './DiceRoll'

vi.mock('../lib/api', () => ({
  postIntentarTameo: vi.fn(),
  postConfirmarTameo: vi.fn(),
  postSoltarTameo: vi.fn(),
}))

import { postIntentarTameo } from '../lib/api'
import { TameoModal } from './TameoModal'

const mockIntentar = vi.mocked(postIntentarTameo)

function respuesta(gano: boolean, felicidad: number) {
  return {
    roll: {
      playerAttribute: 'carisma' as const, playerValue: 10, playerRoll: gano ? 18 : 2, playerResult: gano ? 23 : 7,
      resistenciaAttribute: 'voluntad' as const, resistenciaValue: 8, resistenciaRoll: 6, resistenciaResult: 10,
      margen: gano ? 13 : -3, gano,
    },
    felicidad,
  } as never
}

/// DAD-1/DAD-2 (hito 0.1, roadmap-front.md H18/H19) — cada tirada de Tameo se anima de nuevo y el
/// veredicto (texto, color y Felicidad) espera a que caigan los dos dados.
describe('TameoModal — DAD-1, DAD-2', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockIntentar.mockReset()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  const pendiente = { npcSlug: 'corredor', name: 'Corredor de cauce', tipo: 'FAUNA' as const, felicidad: 10, umbral: 100, atributoResistencia: null, enJaula: true }

  it('el veredicto y la Felicidad llegan al aterrizar; la segunda tirada vuelve a animarse', async () => {
    mockIntentar.mockResolvedValueOnce(respuesta(true, 40)).mockResolvedValueOnce(respuesta(false, 35))
    const { getByRole, getByText, queryByText, getByTestId, queryByTestId } = render(
      <TameoModal saveId="s1" pendiente={pendiente} characterName="Gorhorn" onConfirmado={() => {}} onSoltado={() => {}} onCancel={() => {}} />,
    )

    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Carisma' }))
    })
    expect(getByText('Tirando…')).toBeTruthy()
    expect(queryByText('¡Gana confianza!')).toBeNull()
    expect(getByText('10 / 100')).toBeTruthy()
    expect(getByText('Gorhorn')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(2 * ROLL_DURATION_MS + 10)
    })
    expect(getByText('¡Gana confianza!')).toBeTruthy()
    expect(getByText('40 / 100')).toBeTruthy()
    expect(getByTestId('tirada-comparacion')).toBeTruthy()

    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Carisma' }))
    })
    // Tirada nueva = componente nuevo: vuelve a girar en vez de enseñar ya el resultado anterior.
    expect(getByText('Tirando…')).toBeTruthy()
    expect(queryByTestId('tirada-comparacion')).toBeNull()
    act(() => {
      vi.advanceTimersByTime(2 * ROLL_DURATION_MS + 10)
    })
    expect(getByText('No cede esta vez.')).toBeTruthy()
    expect(getByText('35 / 100')).toBeTruthy()
  })
})
