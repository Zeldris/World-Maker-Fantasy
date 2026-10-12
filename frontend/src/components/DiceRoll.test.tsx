import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, act, fireEvent } from '@testing-library/react'
import { forcedGradosFor, DiceRollSingle, DiceRollVs, ROLL_DURATION_MS } from './DiceRoll'

// Bug real jugando en vivo (2026-09-07, "las dos tiradas de combate deberían ser mi tirada vs la
// suya, no contra una dificultad"): en un check OPUESTO (iniciativa, y cualquier intercambio de
// combate ya resuelto como check opuesto — `esCheckOpuesto`), cada lado siempre calcula su propio
// `success`/`gradoExito` contra `difficulty: 0` de relleno (backend, `rollInitiative`/
// `resolveExchange`), así que `result >= 0` es SIEMPRE verdadero — el color/desenlace visual de
// CADA lado por separado salía siempre "claro"/verde, ganara o no la comparación real contra el
// rival. `forcedGradosFor` decide el color por comparación directa entre ambos resultados.
describe('forcedGradosFor', () => {
  it('P69: con ganador del backend, un empate de iniciativa es de la jugadora', () => {
    expect(forcedGradosFor(16, 16, false, 'izquierda')).toEqual({ leftGrado: 'claro', rightGrado: 'fallo' })
    expect(forcedGradosFor(16, 16, false, 'derecha')).toEqual({ leftGrado: 'fallo', rightGrado: 'claro' })
  })

  it('con showDifficulty=true (tirada normal contra dificultad real): no fuerza nada', () => {
    expect(forcedGradosFor(18, 5, true)).toEqual({ leftGrado: undefined, rightGrado: undefined })
  })

  it('con showDifficulty=false: el lado con mayor result gana (claro), el otro pierde (fallo)', () => {
    expect(forcedGradosFor(18, 5, false)).toEqual({ leftGrado: 'claro', rightGrado: 'fallo' })
    expect(forcedGradosFor(5, 18, false)).toEqual({ leftGrado: 'fallo', rightGrado: 'claro' })
  })

  it('empate exacto: gana el lado derecho (mismo criterio que "el golpe no logra superar la defensa")', () => {
    expect(forcedGradosFor(12, 12, false)).toEqual({ leftGrado: 'fallo', rightGrado: 'claro' })
  })

  it('reproduce el bug real: con difficulty=0 de relleno, ambos lados serían "claro" sin esto — aquí solo uno lo es', () => {
    // Caso real observado jugando: iniciativa 8 vs 6 — con el bug viejo (gradoOf contra
    // difficulty:0) ambos saldrían 'claro'. Con el fix, solo el ganador real.
    const { leftGrado, rightGrado } = forcedGradosFor(8, 6, false)
    expect(leftGrado).toBe('claro')
    expect(rightGrado).toBe('fallo')
    expect([leftGrado, rightGrado]).not.toEqual(['claro', 'claro'])
  })
})

/// DAD-3 y DAD-4 (hito 0.1) — la cuenta completa al aterrizar y los nombres reales sin truncar.
describe('DiceRollSingle / DiceRollVs — DAD-3, DAD-4', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('al aterrizar enseña dado + bono = total vs dificultad → Éxito', () => {
    vi.useFakeTimers()
    const { getByTestId, queryByTestId } = render(
      <DiceRollSingle roll={{ attribute: 'fuerza', value: 10, roll: 12, difficulty: 15, result: 17, success: true, gradoExito: 'claro' }} />,
    )
    expect(queryByTestId('tirada-total')).toBeNull()
    act(() => {
      vi.advanceTimersByTime(ROLL_DURATION_MS + 10)
    })
    expect(getByTestId('tirada-total').textContent).toBe('12 + 5 = 17 vs 15 → Éxito')
  })

  it('suma aparte lo que no es dado ni bono para que la cuenta cuadre', () => {
    vi.useFakeTimers()
    const { getByTestId } = render(
      <DiceRollSingle roll={{ attribute: 'fuerza', value: 10, roll: 3, difficulty: 15, result: 10, success: false, gradoExito: 'fallo' }} />,
    )
    act(() => {
      vi.advanceTimersByTime(ROLL_DURATION_MS + 10)
    })
    expect(getByTestId('tirada-total').textContent).toBe('3 + 5 + 2 = 10 vs 15 → Fallo')
  })

  it('tirada opuesta: nombres reales y, con los dos dados ya caídos, quién gana', () => {
    vi.useFakeTimers()
    const lado = (roll: number, result: number) => ({ attribute: 'carisma' as const, value: 8, roll, difficulty: 0, result, success: true })
    const { getByText, getByTestId, queryByTestId } = render(
      <DiceRollVs left={lado(15, 19)} right={lado(4, 8)} leftLabel="Gorhorn el de las Llanuras Altas" rightLabel="Corredor de cauce" leftFirst showDifficulty={false} />,
    )
    expect(getByText('Gorhorn el de las Llanuras Altas').className).not.toContain('truncate')
    act(() => {
      vi.advanceTimersByTime(ROLL_DURATION_MS + 10)
    })
    expect(queryByTestId('tirada-comparacion')).toBeNull()
    act(() => {
      vi.advanceTimersByTime(ROLL_DURATION_MS)
    })
    expect(getByTestId('tirada-comparacion').textContent).toBe('19 vs 8 → Gorhorn el de las Llanuras Altas')
  })
  it('CFG-20: un clic en los dados (o Espacio) salta a la tirada aterrizada, con el «vs» resuelto', () => {
    vi.useFakeTimers()
    const lado = (roll: number, result: number) => ({ attribute: 'carisma' as const, value: 8, roll, difficulty: 0, result, success: true })
    const alAterrizar = vi.fn()
    const { getByTestId, queryByTestId, getByText } = render(
      <DiceRollVs left={lado(15, 19)} right={lado(4, 8)} leftLabel="Gorhorn" rightLabel="Corredor" leftFirst showDifficulty={false} onAllLanded={alAterrizar} />,
    )
    expect(queryByTestId('tirada-comparacion')).toBeNull()
    act(() => {
      fireEvent.click(getByText('Gorhorn'))
    })
    expect(getByTestId('tirada-comparacion').textContent).toBe('19 vs 8 → Gorhorn')
    expect(alAterrizar).toHaveBeenCalledTimes(1)
    act(() => {
      vi.advanceTimersByTime(3 * ROLL_DURATION_MS)
    })
    expect(alAterrizar).toHaveBeenCalledTimes(1)
  })

  it('CFG-20: Espacio también salta, salvo escribiendo en un campo', () => {
    vi.useFakeTimers()
    const { getByTestId, queryByTestId } = render(
      <DiceRollSingle roll={{ attribute: 'fuerza', value: 10, roll: 12, difficulty: 15, result: 17, success: true, gradoExito: 'claro' }} />,
    )
    const campo = document.createElement('textarea')
    document.body.appendChild(campo)
    act(() => {
      fireEvent.keyDown(campo, { key: ' ' })
    })
    expect(queryByTestId('tirada-total')).toBeNull()
    act(() => {
      fireEvent.keyDown(document.body, { key: ' ' })
    })
    expect(getByTestId('tirada-total').textContent).toBe('12 + 5 = 17 vs 15 → Éxito')
    campo.remove()
  })
})
