import { useState, type Dispatch, type SetStateAction } from 'react'
import { cazarEnZona } from '../lib/api'
import type { CazaSigiloRoll, CombateGrupoLogRoll, LogEntry, NpcInSceneInfo } from '../types'

// Bloque zona/caza/cadáveres extraído de GameView.tsx (Fase 7 del plan, refactor puro, mismo patrón
// que useCombatFlow.ts): GameView sigue siendo dueño del log, del combate y de `handleSubmit`
// (que viene de useTurnFlow), el hook los recibe como parámetros.
interface UseZonaAccionesParams {
  saveId: string | null
  setCharacterLog: Dispatch<SetStateAction<LogEntry[]>>
  setCombateIniciado: Dispatch<SetStateAction<{ npcs: NpcInSceneInfo[] } | null>>
  openCombat: (npcs: { npcs: NpcInSceneInfo[] }) => void
  handleSubmit: (actionText: string) => void | Promise<void>
}

export function useZonaAcciones({ saveId, setCharacterLog, setCombateIniciado, openCombat, handleSubmit }: UseZonaAccionesParams) {
  // Pieza 2 del rediseño de movimiento en Zona (2026-09-09) — abre `ZonaMovimientoModal` desde el
  // icono de brújula flotante (ver el botón en el JSX final). Se cierra sola, sin `busy`/`error`
  // propio (a diferencia de otros modales del árbol) porque `ZonaMovimientoModal` gestiona su
  // propio `ZonaPanel` internamente sin depender de ningún estado de este componente.
  const [zonaModalOpen, setZonaModalOpen] = useState(false)
  // Cadáveres en el mapa (Fase 5, 2026-09-28) — el pin de un cadáver abre Saquear filtrado a él.
  const [saquearSoloNpcSlug, setSaquearSoloNpcSlug] = useState<string | null>(null)

  // Cazar desde la tarjeta de encuentro (Fase 2, 2026-09-28,
  // `plan-mecanicas-por-zona-2026-09-28.md`) — caza EXACTAMENTE el grupo con el que se ha
  // colisionado (`entry.dynamicModeOffer.zonePointId`), reutilizando el MISMO tratamiento de
  // resultado que `handleHuntResolved` (misma forma de respuesta que `confirmarCaza`): caza limpia
  // → LogEntry + panel de combate ya resuelto con MUERTO; combate (1v1 o en grupo) → `actionText`
  // por el turno normal. En error, se conservan TODOS los campos de la oferta y se muestra
  // `err.message` — mismo patrón que `handleInteractuarModoDinamico`.
  // Resolución del pop-up de caza (revisión de partida 2026-08-08): una única presa débil puede
  // resolverse sin combate (tirada determinista ya hecha en el backend) — se abre directamente el
  // panel de combate ya resuelto (solo queda saquear), sin pasar por `openCombat()`'s banner "⚔️
  // Combatir" porque no hay nada que pelear. Cualquier otro caso NO ha tocado la partida todavía:
  // se manda `actionText` por el turno normal (`handleSubmit`), exactamente como si el jugador lo
  // hubiera escrito él mismo — la narración real es quien decide cómo empieza el encuentro y quien
  // abre el combate (decisión explícita de la usuaria, no una apertura silenciosa desde aquí).
  function handleHuntResolved(
    result:
      | {
          resuelveSinCombate: true
          combate: { npcs: NpcInSceneInfo[] }
          logEntry: { id: string; text: string; timeLabel: string; createdAt: string; roll?: CazaSigiloRoll }
        }
      | {
          resuelveSinCombate: false
          actionText: string
          cazaLimpia?: CazaSigiloRoll
          logEntry?: { id: string; text: string; timeLabel: string; createdAt: string; roll: CombateGrupoLogRoll | CazaSigiloRoll }
        },
  ) {
    if (result.resuelveSinCombate) {
      setCharacterLog((prev) => [...prev, { ...result.logEntry, channel: 'character' }])
      setCombateIniciado(result.combate)
      // `result.combate` explícito (ver comentario de `openCombat`) — `combateIniciado` todavía no
      // se ha actualizado en este mismo tick, así que confiar en el estado aquí abriría un panel
      // de combate vacío.
      openCombat(result.combate)
      return
    }
    // Fase 10 (2026-09-29, "todas las tiradas visibles") — antes de mandar el texto por el turno
    // normal se muestran las tiradas que ya ocurrieron: cuántos del grupo entran + iniciativa, o el d100
    // de la caza sigilosa fallida. Las dos son entradas guardadas por el backend (`logEntry`; QA-73).
    if (result.logEntry) {
      const entrada = result.logEntry
      setCharacterLog((prev) => [...prev, { ...entrada, channel: 'character' }])
    }
    handleSubmit(result.actionText)
  }

  /// Devuelve si la caza salió (para que el mapa de zona se cierre y deje ver Combatir/Huir, P9).
  async function handleCazarEnZona(entryId: string, zonePointId: string): Promise<boolean> {
    setCharacterLog((prev) => prev.map((e) => (e.id === entryId && e.dynamicModeOffer ? { ...e, dynamicModeOffer: { ...e.dynamicModeOffer, busy: true } } : e)))
    try {
      const result = await cazarEnZona(saveId!, zonePointId)
      setCharacterLog((prev) => prev.map((e) => (e.id === entryId ? { ...e, dynamicModeOffer: undefined } : e)))
      handleHuntResolved(result)
      return true
    } catch (err) {
      const motivo = err instanceof Error && err.message ? err.message : 'No se pudo cazar — inténtalo de nuevo.'
      setCharacterLog((prev) =>
        prev.map((e) => (e.id === entryId && e.dynamicModeOffer ? { ...e, dynamicModeOffer: { ...e.dynamicModeOffer, busy: false, error: motivo } } : e)),
      )
      return false
    }
  }

  return { zonaModalOpen, setZonaModalOpen, saquearSoloNpcSlug, setSaquearSoloNpcSlug, handleHuntResolved, handleCazarEnZona }
}
