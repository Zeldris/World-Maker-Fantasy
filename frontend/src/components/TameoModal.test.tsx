import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import { ROLL_DURATION_MS } from './DiceRoll'

vi.mock('../lib/api', () => ({
  postIntentarTameo: vi.fn(),
  postConfirmarTameo: vi.fn(),
  postSoltarTameo: vi.fn(),
  postAlCorral: vi.fn(),
}))

import { postIntentarTameo, postAlCorral } from '../lib/api'
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

/// P347/P349: «Al corral» sin Corral del Ganadero sale desactivado y con el motivo; con él, deja un aviso.
describe('TameoModal — Al corral (P347, P349)', () => {
  afterEach(cleanup)

  const murgol = { npcSlug: 'murgol', name: 'Múrgol', tipo: 'FAUNA' as const, felicidad: 80, umbral: 80, atributoResistencia: null, enJaula: true, alCorral: true }

  it('P347: sin Corral del Ganadero el botón está desactivado y dice por qué', () => {
    const { getByRole, getByText } = render(
      <TameoModal saveId="s1" pendiente={{ ...murgol, hayCorral: false }} onConfirmado={() => {}} onSoltado={() => {}} onCancel={() => {}} />,
    )
    expect((getByRole('button', { name: /Al corral/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(getByText('Construye un Corral del Ganadero')).toBeTruthy()
  })

  it('P349: con Corral lo lleva y pasa el aviso del backend a quien abrió el modal', async () => {
    vi.mocked(postAlCorral).mockResolvedValue({ ganadoId: 'g1', buildingId: 'b1', sexo: 'F', aviso: 'El Múrgol entra en los Corrales del Ganadero.' })
    const onConfirmado = vi.fn()
    const { getByRole, queryByText } = render(
      <TameoModal saveId="s1" pendiente={{ ...murgol, hayCorral: true }} onConfirmado={onConfirmado} onSoltado={() => {}} onCancel={() => {}} />,
    )
    expect(queryByText('Construye un Corral del Ganadero')).toBeNull()
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /Al corral/ }))
    })
    expect(postAlCorral).toHaveBeenCalledWith('s1', 'murgol')
    expect(onConfirmado).toHaveBeenCalledWith('El Múrgol entra en los Corrales del Ganadero.')
  })
})
