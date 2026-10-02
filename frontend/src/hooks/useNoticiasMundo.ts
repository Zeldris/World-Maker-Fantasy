import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { getNuevasDelMundo } from '../lib/api'
import type { LogEntry } from '../types'

/// Fase D del hito 0.1 («El mundo vivo, visible») — el tick de fondo escribe noticias en el canal WORLD
/// (expediciones de facción, etapas de la agenda) mientras la partida está abierta, pero el panel "El
/// mundo" solo se rellenaba al cargar. Este hook pide lo nuevo desde la última entrada que ya hay: al
/// terminar cada turno y cada `INTERVALO_MS`. Consulta barata (sin IA), así que el intervalo es corto.
export const INTERVALO_NOTICIAS_MS = 2 * 60_000

interface Params {
  saveId: string | null
  worldLog: LogEntry[]
  setWorldLog: Dispatch<SetStateAction<LogEntry[]>>
  characterThinking: boolean
  /// HUD-6 (hito 0.2) — noticias recién llegadas, para avisar con una notificación.
  onNuevas?: (entradas: LogEntry[]) => void
}

export function useNoticiasMundo({ saveId, worldLog, setWorldLog, characterThinking, onNuevas }: Params) {
  const ultimaIdRef = useRef<string | null>(null)
  ultimaIdRef.current = worldLog.length > 0 ? worldLog[worldLog.length - 1].id : null
  const pidiendoRef = useRef(false)

  async function traer() {
    const desde = ultimaIdRef.current
    if (!saveId || !desde || pidiendoRef.current) return
    pidiendoRef.current = true
    try {
      const { entradas } = await getNuevasDelMundo(saveId, desde)
      if (entradas.length > 0) {
        onNuevas?.(entradas)
        setWorldLog((prev) => {
          const ids = new Set(prev.map((e) => e.id))
          const nuevas = entradas.filter((e) => !ids.has(e.id))
          return nuevas.length > 0 ? [...prev, ...nuevas] : prev
        })
      }
    } catch {
      // Best-effort: se reintenta en el siguiente turno o intervalo.
    } finally {
      pidiendoRef.current = false
    }
  }
  const traerRef = useRef(traer)
  traerRef.current = traer

  // Al terminar un turno (characterThinking true → false).
  const pensabaRef = useRef(characterThinking)
  useEffect(() => {
    if (pensabaRef.current && !characterThinking) void traerRef.current()
    pensabaRef.current = characterThinking
  }, [characterThinking])

  useEffect(() => {
    if (!saveId) return
    const intervalo = setInterval(() => void traerRef.current(), INTERVALO_NOTICIAS_MS)
    return () => clearInterval(intervalo)
  }, [saveId])

  return { traer }
}
