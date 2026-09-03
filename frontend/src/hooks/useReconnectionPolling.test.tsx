import { StrictMode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReconnectionPolling } from './useReconnectionPolling'
import type { SaveDetail } from '../lib/api'
import type { LogEntry } from '../types'

/// Cobertura nueva (2026-09-03) — hueco de "hooks/ entera sin cobertura" (auditoría de deuda
/// técnica 2026-08-25), segundo hook de polling con fake timers (mismo patrón validado en
/// useSurroundingsPolling.test.tsx). El bucle imperativo de `pollForResolution` (hasta 72 intentos
/// cada 10s, ~12 min reales en el peor caso) tiene 2 condiciones de parada reales (resolución real
/// vs. desmontaje) y 2 caminos de mensaje de error distintos (con/sin ningún GET exitoso) — se
/// prueba con MAX_POLL_ATTEMPTS reducido indirectamente disparando el resultado antes.
vi.mock('../lib/api', () => ({
  getSave: vi.fn(),
}))

import { getSave } from '../lib/api'

const mockGetSave = vi.mocked(getSave)
const POLL_INTERVAL_MS = 10_000

function fakeSave(overrides: Partial<SaveDetail> = {}): SaveDetail {
  return { characterLog: [] as LogEntry[], ...overrides } as SaveDetail
}

beforeEach(() => {
  mockGetSave.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useReconnectionPolling', () => {
  it('primer intento es inmediato (sin esperar 10s) — si ya hay narración nueva, resuelve sin más sondeos', async () => {
    // La condición real es characterLog.length > logLengthBeforeThisTurn + 1 (estrictamente mayor,
    // no ≥) — con logLengthBeforeThisTurn: 0 hace falta longitud 2 para resolver en el primer
    // intento.
    const save = fakeSave({ characterLog: [{ id: '1' } as LogEntry, { id: '2' } as LogEntry] })
    mockGetSave.mockResolvedValueOnce(save)
    const syncFromSave = vi.fn()
    const setCharacterLog = vi.fn()
    const { result } = renderHook(() => useReconnectionPolling())

    await act(async () => {
      await result.current.pollForResolution({
        saveId: 'save-1',
        logLengthBeforeThisTurn: 0,
        fictionalDate: 'Día 1',
        syncFromSave,
        setCharacterLog,
      })
    })

    expect(mockGetSave).toHaveBeenCalledTimes(1)
    expect(syncFromSave).toHaveBeenCalledWith(save)
    expect(setCharacterLog).not.toHaveBeenCalled() // resuelto de verdad, sin mensaje de error
  })

  it('varios GET sin narración nueva, luego uno con narración nueva — resuelve en el intento correcto, sondeando cada 10s', async () => {
    vi.useFakeTimers()
    mockGetSave
      .mockResolvedValueOnce(fakeSave({ characterLog: [{ id: '1' } as LogEntry] }))
      .mockResolvedValueOnce(fakeSave({ characterLog: [{ id: '1' } as LogEntry] }))
      .mockResolvedValueOnce(fakeSave({ characterLog: [{ id: '1' } as LogEntry, { id: '2' } as LogEntry] }))
    const syncFromSave = vi.fn()
    const { result } = renderHook(() => useReconnectionPolling())

    const pollPromise = act(async () => {
      const p = result.current.pollForResolution({
        saveId: 'save-1',
        logLengthBeforeThisTurn: 0,
        fictionalDate: 'Día 1',
        syncFromSave,
        setCharacterLog: vi.fn(),
      })
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2)
      await p
    })
    await pollPromise

    expect(mockGetSave).toHaveBeenCalledTimes(3)
    expect(syncFromSave).toHaveBeenCalledTimes(1)
  })

  it('un GET fallido no detiene el sondeo — se reintenta igual en el siguiente intervalo', async () => {
    vi.useFakeTimers()
    mockGetSave
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(fakeSave({ characterLog: [{ id: '1' } as LogEntry, { id: '2' } as LogEntry] }))
    const syncFromSave = vi.fn()
    const { result } = renderHook(() => useReconnectionPolling())

    await act(async () => {
      const p = result.current.pollForResolution({
        saveId: 'save-1',
        logLengthBeforeThisTurn: 0,
        fictionalDate: 'Día 1',
        syncFromSave,
        setCharacterLog: vi.fn(),
      })
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
      await p
    })

    expect(mockGetSave).toHaveBeenCalledTimes(2)
    expect(syncFromSave).toHaveBeenCalledTimes(1)
  })

  it('si nunca hay narración nueva pero SÍ hubo algún GET exitoso, avisa con el mensaje de "puede que tengas que reintentarla" tras agotar los intentos', async () => {
    vi.useFakeTimers()
    mockGetSave.mockResolvedValue(fakeSave({ characterLog: [{ id: '1' } as LogEntry] }))
    const syncFromSave = vi.fn()
    const setCharacterLog = vi.fn()
    const { result } = renderHook(() => useReconnectionPolling())

    await act(async () => {
      const p = result.current.pollForResolution({
        saveId: 'save-1',
        logLengthBeforeThisTurn: 0,
        fictionalDate: 'Día 1',
        syncFromSave,
        setCharacterLog,
      })
      // 72 intentos * 10s — el primero es inmediato, así que 71 avances de 10s agotan el bucle.
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 71)
      await p
    })

    expect(mockGetSave).toHaveBeenCalledTimes(72)
    // syncFromSave solo se llama UNA vez, al final, con el último GET exitoso (lastSuccessfulSave)
    // — no en cada intento, aunque los 72 hayan tenido éxito de red.
    expect(syncFromSave).toHaveBeenCalledTimes(1)
    expect(setCharacterLog).toHaveBeenCalledTimes(1)
    const call = setCharacterLog.mock.calls[0][0] as (prev: LogEntry[]) => LogEntry[]
    const appended = call([])
    expect(appended[0].text).toContain('puede que tengas que reintentarla')
  }, 20_000)

  it('si TODOS los GET fallan, avisa con el mensaje de "no se pudo contactar con el Narrador"', async () => {
    vi.useFakeTimers()
    mockGetSave.mockRejectedValue(new Error('network'))
    const setCharacterLog = vi.fn()
    const { result } = renderHook(() => useReconnectionPolling())

    await act(async () => {
      const p = result.current.pollForResolution({
        saveId: 'save-1',
        logLengthBeforeThisTurn: 0,
        fictionalDate: 'Día 1',
        syncFromSave: vi.fn(),
        setCharacterLog,
      })
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 71)
      await p
    })

    expect(setCharacterLog).toHaveBeenCalledTimes(1)
    const call = setCharacterLog.mock.calls[0][0] as (prev: LogEntry[]) => LogEntry[]
    const appended = call([])
    expect(appended[0].text).toContain('No se pudo contactar con el Narrador')
  }, 20_000)

  it('desmontar detiene el sondeo — ningún GET más tras unmount, sin mensaje de error', async () => {
    vi.useFakeTimers()
    mockGetSave.mockResolvedValue(fakeSave({ characterLog: [{ id: '1' } as LogEntry] }))
    const setCharacterLog = vi.fn()
    const { result, unmount } = renderHook(() => useReconnectionPolling())

    let pollPromise!: Promise<void>
    await act(async () => {
      pollPromise = result.current.pollForResolution({
        saveId: 'save-1',
        logLengthBeforeThisTurn: 0,
        fictionalDate: 'Día 1',
        syncFromSave: vi.fn(),
        setCharacterLog,
      })
      await vi.advanceTimersByTimeAsync(0) // deja correr el primer intento inmediato
    })
    const countTrasPrimerIntento = mockGetSave.mock.calls.length

    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10)
      await pollPromise
    })

    expect(mockGetSave).toHaveBeenCalledTimes(countTrasPrimerIntento)
    expect(setCharacterLog).not.toHaveBeenCalled() // desmontado antes de agotar intentos: sin aviso
  })

  // Bug real encontrado en vivo (2026-09-03) verificando un fix de reconexión tras F5: en
  // StrictMode (activo en dev, main.tsx) React monta este mismo hook, lo desmonta y lo vuelve a
  // montar una vez al arrancar — antes del fix, el cleanup ponía `mountedRef.current = false` pero
  // nada lo reafirmaba a `true` en el remontaje real que sigue vivo, dejando el guard apagado para
  // siempre desde el arranque. Resultado: CUALQUIER `pollForResolution` posterior, sin importar
  // cuánto tiempo después, entraba con `mountedRef.current` ya en `false` y el `for` no ejecutaba
  // ni una iteración — ni un solo GET, ni mensaje de error, silencio total. `wrapper: StrictMode`
  // reproduce el ciclo real de React (no dos instancias del hook independientes — la primera
  // versión de este test usaba `unmount()` + `renderHook()` de nuevo y NO detectaba el bug, porque
  // cada llamada crea su propio `mountedRef` fresco; StrictMode monta/desmonta/remonta la MISMA
  // instancia lógica, que es justo el caso real).
  it('sobrevive al ciclo de montaje doble de StrictMode (mount→unmount→remount) sin quedar sordo para siempre', async () => {
    const save = fakeSave({ characterLog: [{ id: '1' } as LogEntry, { id: '2' } as LogEntry] })
    mockGetSave.mockResolvedValueOnce(save)
    const syncFromSave = vi.fn()
    const setCharacterLog = vi.fn()

    const { result } = renderHook(() => useReconnectionPolling(), { wrapper: StrictMode })
    await act(async () => {
      await result.current.pollForResolution({
        saveId: 'save-1',
        logLengthBeforeThisTurn: 0,
        fictionalDate: 'Día 1',
        syncFromSave,
        setCharacterLog,
      })
    })

    expect(mockGetSave).toHaveBeenCalledTimes(1)
    expect(syncFromSave).toHaveBeenCalledWith(save)
  })
})
