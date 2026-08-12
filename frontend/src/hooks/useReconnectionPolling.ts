import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { getSave, type SaveDetail } from '../lib/api'
import type { LogEntry } from '../types'

// Sondeo de reconexión (2026-07-23): antes se comprobaba una sola vez y ya se avisaba de "puede
// que tengas que reintentarla" — pero el backend sigue narrando en segundo plano bastante después
// de que el stream del cliente se corte (cola de Ollama, rotación cloud), así que un solo intento
// inmediato disparaba el aviso demasiado pronto. Sondea cada 10s mientras el composer sigue
// bloqueado (characterThinking se queda a true hasta el finally de GameView), mostrando un
// indicador discreto en vez del aviso de error.
//
// Bug real encontrado auditando la partida de Gorhorn (2026-07-23, "revisar partida" — "una cosa
// que pasa mucho y me obliga a recargar"): el tope original (~2 min) se quedaba corto frente al
// peor caso REAL de la cascada de reintentos de `narrateAction` (narrador.ts): intento 1 (180s) +
// intento 2 (240s) + intento 3 (90s) = 510s solo en narrar, más hasta 120s si además hay una
// réplica de diálogo (`generateNpcReply`) — hasta ~10-11 minutos en el peor caso real en este
// hardware CPU-only. Con un tope de 2 min, el aviso de "puede que tengas que reintentarla" saltaba
// con el turno TODAVÍA en curso.
const POLL_INTERVAL_MS = 10_000
const MAX_POLL_ATTEMPTS = 72

export interface UseReconnectionPollingResult {
  pollForResolution: (params: {
    saveId: string
    logLengthBeforeThisTurn: number
    fictionalDate: string
    syncFromSave: (save: SaveDetail) => void
    setCharacterLog: Dispatch<SetStateAction<LogEntry[]>>
  }) => Promise<void>
}

/// Extraído de GameView.tsx (refactor de deuda técnica, 2026-08-13) — mismos intervalos y misma
/// condición de parada, solo movido de sitio.
///
/// Bug real (auditoría 2026-07-30): a diferencia de todos los demás bucles asíncronos largos de
/// GameView (cada uno con su propio flag `cancelled` de limpieza de efecto), este sondeo (hasta 72
/// intentos, ~12 min reales) vive dentro de un handler imperativo (`handleSubmit`), no de un
/// `useEffect` — sin nada que lo corte, seguiría llamando al backend y a `setState` varios minutos
/// después de que la jugadora navegara fuera de la pantalla (desmontaje real de GameView). El
/// `mountedRef` de aquí es justo eso: se pone a `false` al desmontar el componente que use este
/// hook, y `pollForResolution` lo comprueba antes de cada intento y antes de aplicar el resultado.
export function useReconnectionPolling(): UseReconnectionPollingResult {
  const mountedRef = useRef(true)
  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  async function pollForResolution({
    saveId,
    logLengthBeforeThisTurn,
    fictionalDate,
    syncFromSave,
    setCharacterLog,
  }: {
    saveId: string
    logLengthBeforeThisTurn: number
    fictionalDate: string
    syncFromSave: (save: SaveDetail) => void
    setCharacterLog: Dispatch<SetStateAction<LogEntry[]>>
  }): Promise<void> {
    let resolved = false
    let lastSuccessfulSave: SaveDetail | null = null
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS && !resolved && mountedRef.current; attempt++) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      if (!mountedRef.current) break
      try {
        const save = await getSave(saveId)
        lastSuccessfulSave = save
        if (save.characterLog.length > logLengthBeforeThisTurn + 1) {
          syncFromSave(save)
          resolved = true
        }
      } catch {
        // Se reintenta en el siguiente sondeo — no se distingue de "aún no ha terminado".
      }
    }
    if (!resolved && mountedRef.current) {
      if (lastSuccessfulSave) {
        syncFromSave(lastSuccessfulSave)
        setCharacterLog((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            channel: 'character',
            text: 'La acción quedó registrada, pero la narración sigue sin completarse tras esperar — puede que tengas que reintentarla.',
            timeLabel: fictionalDate,
            createdAt: new Date().toISOString(),
          },
        ])
      } else {
        setCharacterLog((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            channel: 'character',
            text: 'No se pudo contactar con el Narrador. ¿Está el backend corriendo en localhost:3001?',
            timeLabel: fictionalDate,
            createdAt: new Date().toISOString(),
          },
        ])
      }
    }
  }

  return { pollForResolution }
}
