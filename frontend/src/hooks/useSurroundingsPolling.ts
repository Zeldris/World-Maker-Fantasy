import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { requestSurroundings } from '../lib/api'
import type { LogEntry, MentionedEntityBanner } from '../types'

const SURROUNDINGS_INTERVAL_MS = 10 * 60_000

export interface UseSurroundingsPollingResult {
  worldThinking: boolean
}

/// Extraído de GameView.tsx (auditoría de deuda técnica, 2026-08-21) — mismo comportamiento exacto,
/// solo reorganizado en un hook propio (mismo patrón que useReconnectionPolling.ts/
/// useEntityBanner.ts).
///
/// Panel "El mundo" v1: ambientación del entorno inmediato cada 10 minutos reales (subido de 5,
/// petición explícita de la usuaria, 2026-07-23), puramente descriptiva — nunca toca el chat de
/// personaje ni propone eventos.
export function useSurroundingsPolling(params: {
  saveId: string | null
  characterThinking: boolean
  combatActive: boolean
  fictionalDate: string
  buildEntityBanner: (text: string, logEntryId?: string) => MentionedEntityBanner | undefined
  setWorldLog: Dispatch<SetStateAction<LogEntry[]>>
}): UseSurroundingsPollingResult {
  const { saveId, characterThinking, combatActive, fictionalDate, buildEntityBanner, setWorldLog } = params
  const [worldThinking, setWorldThinking] = useState(false)

  // El temporizador de alrededores vive en un efecto aparte que no se reinicia en cada render (ver
  // más abajo) — necesita leer el valor más reciente de estos, no el de cuando arrancó.
  const characterThinkingRef = useRef(characterThinking)
  const fictionalDateRef = useRef(fictionalDate)
  // Bug real encontrado auditando la partida de Gorhorn (2026-07-23, "revisar partida" — petición
  // explícita de la usuaria: "la AI del narrador esta generando un prompt fuera de responder a que
  // yo le ponga... nos esta haciendo mas bien que mal"): el sondeo de ambientación cada 5 min ya
  // evitaba solaparse con un turno en curso o un gancho sin responder, pero no con un combate
  // pendiente/abierto — un evento ambiental ("¿Qué haces?" con el mismo NPC ya atacando) llegó a
  // dispararse en mitad de un intercambio de golpes real, muy confuso. `combatActive` (no solo si
  // el popup de combate está abierto) cubre también la ventana entre "se marcó el combate" y "el
  // jugador pulsa Combatir", que es tan real como el propio popup abierto.
  const combatActiveRef = useRef(combatActive)
  useEffect(() => {
    characterThinkingRef.current = characterThinking
  }, [characterThinking])
  useEffect(() => {
    combatActiveRef.current = combatActive
  }, [combatActive])
  useEffect(() => {
    fictionalDateRef.current = fictionalDate
  }, [fictionalDate])

  useEffect(() => {
    if (!saveId) return
    let cancelled = false
    let inFlight = false

    async function tickSurroundings() {
      // No competir con un turno de jugador ya en curso — el backend solo procesa una llamada a
      // Ollama a la vez, y amontonar peticiones fue lo que causó fallos reales en pruebas (una
      // narración forzada a cortarse por falta de margen). Se reintenta en el siguiente tick.
      // Tampoco durante un combate pendiente/abierto (`combatActiveRef`, bug real 2026-07-23): un
      // evento ambiental reintroduciendo al mismo NPC que ya está atacando es puro ruido confuso
      // en mitad de una pelea.
      if (inFlight || characterThinkingRef.current || combatActiveRef.current) return
      inFlight = true
      setWorldThinking(true)
      try {
        const timeLabel = fictionalDateRef.current
        // Puramente descriptivo (petición explícita de la usuaria, 2026-07-23: "el sondeo
        // ambiental solo tiene que lanzarse en el chat de mundo... no tiene que preguntar que
        // hace, solo exponer que hay a tu alrededor") — ya nunca toca el chat de PERSONAJE.
        const { description, logEntryId } = await requestSurroundings({ saveId: saveId! })
        if (cancelled) return
        const nowIso = new Date().toISOString()
        const entityBanner = buildEntityBanner(description, logEntryId)
        setWorldLog((prev) => [...prev, { id: logEntryId, channel: 'world', text: description, timeLabel, createdAt: nowIso, entityBanner }])
      } catch {
        // Ambientación fallida no bloquea la partida — se reintenta en el siguiente tick.
      } finally {
        inFlight = false
        if (!cancelled) setWorldThinking(false)
      }
    }

    const interval = setInterval(tickSurroundings, SURROUNDINGS_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
    // Deliberadamente solo `saveId`: `buildEntityBanner` no está memoizada (nueva referencia cada
    // render) pero lee todo lo reactivo que necesita de refs (characterThinkingRef,
    // combatActiveRef, fictionalDateRef) — incluirla aquí recrearía el intervalo de 10 minutos en
    // cada render, rompiendo la cadencia real del sondeo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveId])

  return { worldThinking }
}
