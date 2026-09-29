import { useState, type Dispatch, type SetStateAction } from 'react'
import { ROLL_DURATION_MS } from '../components/DiceRoll'
import {
  chooseNpcInteraction,
  getSave,
  ignorarModoDinamico,
  interactuarModoDinamico,
  interactuarModoDinamicoRecurso,
  resolveImageUrl,
  responderModoDinamico,
} from '../lib/api'
import { applyInventoryDelta, questCompletedLogEntry } from '../lib/gameViewHelpers'
import type { PanelId } from '../components/NavTabs'
import type { EnciclopediaIndex } from '../lib/enciclopediaIndex'
import type { InventoryItemInfo, LogEntry, MetodoObtencion, NpcInSceneInfo, QuestInfo, RecoleccionLogRoll } from '../types'
import type { useActionModalsState } from './useActionModalsState'

// Bloque "modo dinámico"/Interactuar/menú de NPC extraído de GameView.tsx (Fase 12 del plan,
// refactor puro, mismo patrón que useZonaAcciones.ts): GameView sigue siendo dueño del log, del
// combate y de `handleSubmit`; el hook los recibe agrupados en un objeto de contexto.
interface UseModoDinamicoParams {
  saveId: string | null
  characterLog: LogEntry[]
  characterName: string | null
  fictionalDate: string
  enciclopediaIndex: EnciclopediaIndex
  setCharacterLog: Dispatch<SetStateAction<LogEntry[]>>
  setFictionalDate: Dispatch<SetStateAction<string>>
  setCombateIniciado: Dispatch<SetStateAction<{ npcs: NpcInSceneInfo[] } | null>>
  setActiveDynamicMode: ReturnType<typeof useActionModalsState>['setActiveDynamicMode']
  setInventory: Dispatch<SetStateAction<InventoryItemInfo[]>>
  setXp: Dispatch<SetStateAction<number>>
  setQuests: Dispatch<SetStateAction<QuestInfo[]>>
  setAprenderOficioModalOpen: (open: boolean) => void
  setActivePanel: Dispatch<SetStateAction<PanelId | null>>
  openCombat: (npcs: { npcs: NpcInSceneInfo[] }) => void
  handleSubmit: (actionText: string) => void | Promise<void>
  /// Refresca la Enciclopedia al abrir el detalle de un RECURSO (el descubrimiento ya lo registró el
  /// backend al encontrarlo, pero la copia local puede ir por detrás).
  refetchEnciclopedia?: () => void
}

/// Recurso cuyo modal de detalle está abierto (2026-09-29) — ver `RecursoDetalleModal.tsx`.
export interface RecursoDetalleState {
  entryId: string
  targetSlug: string
  targetName: string
  metodo: MetodoObtencion | null
}

export function useModoDinamico({
  saveId,
  characterLog,
  characterName,
  fictionalDate,
  enciclopediaIndex,
  setCharacterLog,
  setFictionalDate,
  setCombateIniciado,
  setActiveDynamicMode,
  setInventory,
  setXp,
  setQuests,
  setAprenderOficioModalOpen,
  setActivePanel,
  openCombat,
  handleSubmit,
  refetchEnciclopedia,
}: UseModoDinamicoParams) {
  // Modal de detalle de RECURSO (2026-09-29) — "Interactuar" en la tarjeta ya no recolecta directo:
  // abre este modal, y solo su botón principal llama a `handleInteractuarModoDinamicoRecurso`.
  const [recursoDetalle, setRecursoDetalle] = useState<RecursoDetalleState | null>(null)
  function handleVerRecursoDetalle(entryId: string, targetSlug: string, targetName: string, metodo?: MetodoObtencion | null) {
    setRecursoDetalle({ entryId, targetSlug, targetName, metodo: metodo ?? null })
    refetchEnciclopedia?.()
  }
  function handleCerrarRecursoDetalle() {
    setRecursoDetalle(null)
  }
  function handleAccionRecursoDetalle() {
    if (!recursoDetalle) return
    const { entryId, targetSlug } = recursoDetalle
    setRecursoDetalle(null)
    void handleInteractuarModoDinamicoRecurso(entryId, targetSlug)
  }

  // "Modo dinámico" (2026-08-27) — mismo criterio efímero que questOffer: la tarjeta se limpia solo
  // tras un Interactuar/Ignorar QUE FUNCIONÓ, nunca sobrevive a una recarga. A.7 (checklist frontend
  // 2026-08-27): antes se limpiaba ANTES de saber si la petición tenía éxito — un fallo de red dejaba
  // a la jugadora sin ninguna pista de qué pasó. Ahora la tarjeta sigue en pantalla con `busy`/
  // `error` mientras se resuelve, y solo desaparece si de verdad se abrió el modo dinámico.
  async function handleInteractuarModoDinamico(
    entryId: string,
    tipo: 'NPC' | 'FAUNA',
    targetSlug: string,
    targetName: string,
    quienInicia?: 'jugador' | 'npc',
    combateForzado?: boolean,
    zonePointId?: string,
    cantidad?: number,
  ) {
    setCharacterLog((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, dynamicModeOffer: { tipo, targetSlug, targetName, quienInicia, combateForzado, zonePointId, cantidad, riesgoCaza: e.dynamicModeOffer?.riesgoCaza, busy: true } } : e)),
    )
    try {
      const turno = await interactuarModoDinamico(saveId!, tipo, targetSlug, targetName, quienInicia, combateForzado, zonePointId, cantidad)
      setCharacterLog((prev) => prev.map((e) => (e.id === entryId ? { ...e, dynamicModeOffer: undefined } : e)))
      setFictionalDate(turno.timeLabel)
      // AGRESIVO/ENEMIGO, el NPC/fauna vio primero al jugador (2026-09-20) — el combate se abre
      // DIRECTAMENTE, sin pasar por DynamicModeModal (nunca hubo nada que conversar). Mismo patrón
      // que `handleHuntResolved` § caza limpia: `result.combate` explícito, `combateIniciado` aún
      // no se ha actualizado en este mismo tick.
      if (turno.combate) {
        setCombateIniciado(turno.combate)
        openCombat(turno.combate)
        return
      }
      // Agresivo en grupo (Fase 2, 2026-09-28) — combate múltiple ya creado por el backend
      // (`iniciarCaza`), este texto se manda por el turno normal para que la narración real lo
      // abra — mismo patrón EXACTO que `handleHuntResolved` § caza en grupo (`result.actionText`).
      if (turno.actionText) {
        // Fase 10 (2026-09-29) — tiradas de cuántos entran + iniciativa del combate múltiple.
        if (turno.combateGrupoLogEntry) setCharacterLog((prev) => [...prev, { ...turno.combateGrupoLogEntry!, channel: 'character' }])
        handleSubmit(turno.actionText)
        return
      }
      // B.6 (checklist frontend 2026-08-27) — retrato real si ya está subido en la Enciclopedia,
      // resuelto por slug conocido (no por texto, a diferencia de buildEntityBanner) — el modo
      // dinámico siempre sabe el `targetSlug` exacto con certeza.
      const entityType = tipo === 'NPC' ? 'npc' : 'fauna'
      const banner = enciclopediaIndex.bySlugKey.get(`${entityType}:${targetSlug}`)
      const imageUrl = resolveImageUrl(banner?.imageUrls?.banner ?? null)
      setActiveDynamicMode({ turno, busy: false, imageUrl })
      // Bug real 2026-09-09 (Gistera Koh huérfana del motor determinista tras Interactuar) — misma
      // tarjeta "MISIÓN PROPUESTA" que el turno normal, colgada de la última entrada del log (mismo
      // patrón que la reconstrucción tras F5 más arriba). El modal de Interactuar sigue abierto en
      // ese instante (`onCerrar` es manual, no automático al cerrar la conversación) — la tarjeta ya
      // queda lista en el log de fondo, visible en cuanto el jugador pulsa "Continuar".
      if (turno.cierra && turno.newQuestOfferInfo) {
        const offer = turno.newQuestOfferInfo
        setCharacterLog((prev) => {
          const lastIdx = prev.length - 1
          if (lastIdx < 0) return prev
          return prev.map((e, i) => (i === lastIdx ? { ...e, questOffer: offer } : e))
        })
      }
    } catch (err) {
      // 2026-09-28 (bug real jugando en vivo): antes la tarjeta se reconstruía SIN `quienInicia`/
      // `combateForzado` — tras un fallo, un agresivo volvía a ofrecer "Ignorar" y el reintento abría
      // una conversación normal con él. Se conservan todos los campos y se muestra el motivo real;
      // si el encuentro ya no existe (el backend ya descartó la oferta), la tarjeta se retira.
      const motivo = err instanceof Error && err.message ? err.message : 'No se pudo abrir — inténtalo de nuevo.'
      const yaNoDisponible = /ya no está disponible/i.test(motivo)
      setCharacterLog((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? {
                ...e,
                dynamicModeOffer: yaNoDisponible ? undefined : { tipo, targetSlug, targetName, quienInicia, combateForzado, zonePointId, cantidad, riesgoCaza: e.dynamicModeOffer?.riesgoCaza, busy: false, error: motivo },
                ...(yaNoDisponible ? { text: `${e.text} (${motivo})` } : {}),
              }
            : e,
        ),
      )
    }
  }

  function handleDismissDynamicModeOffer(entryId: string) {
    setCharacterLog((prev) => prev.map((e) => (e.id === entryId ? { ...e, dynamicModeOffer: undefined } : e)))
    // Best-effort: "ignorar" no tiene consecuencia visible si falla (la oferta ya no se muestra),
    // solo se registra en consola para no perder el rastro por completo si el backend queda con
    // `pendingDynamicMode` huérfano.
    ignorarModoDinamico(saveId!).catch((err) => console.error('ignorarModoDinamico falló', err))
  }

  // RECURSO (2026-09-08, "Ver qué hay en la zona") — a diferencia de `handleInteractuarModoDinamico`
  // (abre DynamicModeModal, conversación de vueltas), esto resuelve TODO de una sola llamada: tirada
  // real + inventario + LogEntry, reutilizando exactamente el mismo patrón de actualización que
  // `HarvestSelectionModal.onConfirm` (applyInventoryDelta + setCharacterLog + setFictionalDate) —
  // mismo backend (`resolverRecoleccion`), solo un disparador distinto.
  async function handleInteractuarModoDinamicoRecurso(entryId: string, targetSlug: string) {
    setCharacterLog((prev) => prev.map((e) => (e.id === entryId && e.dynamicModeOffer ? { ...e, dynamicModeOffer: { ...e.dynamicModeOffer, busy: true } } : e)))
    const targetName = characterLog.find((e) => e.id === entryId)?.dynamicModeOffer?.targetName ?? 'el recurso'
    try {
      const resultado = await interactuarModoDinamicoRecurso(saveId!, targetSlug)
      setCharacterLog((prev) => prev.map((e) => (e.id === entryId ? { ...e, dynamicModeOffer: undefined } : e)))
      // Fase 10 (2026-09-29, "todas las tiradas visibles") — el dado de Explorar se anima ANTES de
      // mostrar lo obtenido (misma regla que `HarvestSelectionModal`: sin esto el resultado
      // spoilearía el dado). Entrada local con `GatheringDiceReveal` (vía `ExtendedRollBadge` en vivo);
      // el resultado real se aplica cuando el dado aterriza. Al recargar, la tirada vive en
      // `logEntry.roll` (persistida) — en vivo se quita `tirada` del resultado para no pintar el
      // mismo dado dos veces.
      if (resultado.roll) {
        setCharacterLog((prev) => [
          ...prev,
          {
            id: `recurso-tirada-${Date.now()}`,
            channel: 'character',
            text: `${characterName ?? 'Tu personaje'} lo intenta con ${targetName}…`,
            timeLabel: fictionalDate,
            isSystemMessage: true,
            createdAt: new Date().toISOString(),
            roll: { kind: 'recoleccion', tirada: resultado.roll },
          },
        ])
        await new Promise((resolve) => setTimeout(resolve, ROLL_DURATION_MS + 500))
      }
      if (resultado.items || resultado.updatedItems) {
        setInventory((prev) => applyInventoryDelta(prev, resultado.items ?? [], [], resultado.updatedItems ?? []))
      }
      if (resultado.logEntry) {
        const { roll: persistida, ...resto } = resultado.logEntry
        const rollVivo: RecoleccionLogRoll | undefined =
          persistida && resultado.roll ? (persistida.segundas?.length ? { kind: 'recoleccion', segundas: persistida.segundas } : undefined) : persistida
        setCharacterLog((prev) => [...prev, { ...resto, channel: 'character', ...(rollVivo ? { roll: rollVivo } : {}) }])
        setFictionalDate(resultado.logEntry.timeLabel)
      } else {
        // Tirada fallida — sin LogEntry real que guardar (mismo criterio que "caza limpia
        // fallida"), pero la narración determinista del intento sigue siendo útil en pantalla.
        // Con `segundasTiradas` (todas fallaron) se muestran igualmente sus dados.
        setCharacterLog((prev) => [
          ...prev,
          {
            id: `recurso-fallido-${Date.now()}`,
            channel: 'character',
            text: resultado.narration,
            timeLabel: fictionalDate,
            isSystemMessage: true,
            createdAt: new Date().toISOString(),
            ...(resultado.segundasTiradas?.length ? { roll: { kind: 'recoleccion' as const, segundas: resultado.segundasTiradas } } : {}),
          },
        ])
      }
    } catch (err) {
      // El backend explica el motivo real del rechazo (nivel de oficio insuficiente, recurso
      // agotado...) — mostrarlo tal cual (2026-09-28: antes un genérico "inténtalo de nuevo" que
      // invitaba a reintentar algo que nunca iba a funcionar).
      const motivo = err instanceof Error && err.message ? err.message : 'No se pudo recolectar — inténtalo de nuevo.'
      setCharacterLog((prev) =>
        prev.map((e) =>
          e.id === entryId && e.dynamicModeOffer
            ? { ...e, dynamicModeOffer: { ...e.dynamicModeOffer, busy: false, error: motivo } }
            : e,
        ),
      )
    }
  }

  // Menú contextual de interacción con NPC (2026-09-06) — mismo criterio de `busy`/`error` que
  // `handleInteractuarModoDinamico`: la tarjeta sigue visible con el error inline si la petición
  // falla, en vez de desaparecer sin explicación. Cada opción reutiliza un flujo YA EXISTENTE
  // (`AprenderOficioModal`, panel de Compañeros, o el turno normal para Combatir) — esta función
  // solo decide cuál, nunca implementa mecánica nueva.
  async function handleChooseNpcInteraction(entryId: string, npcSlug: string, opcion: string) {
    setCharacterLog((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, npcInteractionOffer: e.npcInteractionOffer ? { ...e.npcInteractionOffer, busy: true } : e.npcInteractionOffer } : e)),
    )
    try {
      const resultado = await chooseNpcInteraction(saveId!, npcSlug, opcion)
      setCharacterLog((prev) => prev.map((e) => (e.id === entryId ? { ...e, npcInteractionOffer: undefined } : e)))
      if (resultado.accion === 'ABRIR_APRENDER_OFICIO') {
        setAprenderOficioModalOpen(true)
      } else if (resultado.accion === 'ABRIR_RECLUTAR') {
        setActivePanel('companeros')
      } else if (resultado.accion === 'FORZAR_COMBATE') {
        const npcName = characterLog.find((e) => e.id === entryId)?.npcInteractionOffer?.npcName ?? 'él'
        handleSubmit(`Ataco a '${npcName}'.`)
      }
      // 'MOSTRAR_OFERTA_MISION'/'CERRAR' no necesitan ninguna acción más — la tarjeta ya se limpió
      // arriba, y la oferta de misión (si la hay) ya vive en su propia tarjeta independiente.
    } catch {
      setCharacterLog((prev) =>
        prev.map((e) =>
          e.id === entryId && e.npcInteractionOffer ? { ...e, npcInteractionOffer: { ...e.npcInteractionOffer, busy: false, error: 'No se pudo continuar — inténtalo de nuevo.' } } : e,
        ),
      )
    }
  }

  async function handleElegirDynamicMode(opcion: string) {
    setActiveDynamicMode((prev) => (prev ? { ...prev, busy: true, error: undefined } : prev))
    try {
      const turno = await responderModoDinamico(saveId!, opcion)
      setFictionalDate(turno.timeLabel)
      // AGRESIVO/ENEMIGO, el jugador eligió "Combatir" (2026-09-20) — mismo patrón que
      // `handleInteractuarModoDinamico`: se cierra este modal y se abre CombatPanel directo.
      if (turno.combate) {
        setActiveDynamicMode(null)
        setCombateIniciado(turno.combate)
        openCombat(turno.combate)
        return
      }
      // Agresivo en grupo (Fase 2, 2026-09-28) — mismo patrón que `handleInteractuarModoDinamico`:
      // combate múltiple ya creado por el backend, se manda por el turno normal.
      if (turno.actionText) {
        setActiveDynamicMode(null)
        if (turno.combateGrupoLogEntry) setCharacterLog((prev) => [...prev, { ...turno.combateGrupoLogEntry!, channel: 'character' }])
        handleSubmit(turno.actionText)
        return
      }
      // `imageUrl` se conserva de la vuelta anterior — el retrato no cambia dentro de la misma
      // conversación, solo se resuelve una vez al abrir (handleInteractuarModoDinamico).
      setActiveDynamicMode((prev) => ({ turno, busy: false, imageUrl: prev?.imageUrl }))
      // Mismo fix que handleInteractuarModoDinamico — ver su comentario completo.
      if (turno.cierra && turno.newQuestOfferInfo) {
        const offer = turno.newQuestOfferInfo
        setCharacterLog((prev) => {
          const lastIdx = prev.length - 1
          if (lastIdx < 0) return prev
          return prev.map((e, i) => (i === lastIdx ? { ...e, questOffer: offer } : e))
        })
      }
      // Gistera Koh, aceptación real (2026-09-09, bug real jugando en vivo — Álvaro: "al acabar de
      // interactuar me sale para aceptar la misión otra vez... como ya aceptamos esto no debería
      // salir... solo un log al final que confirme que la misión se ha aceptado") — a diferencia de
      // `newQuestOfferInfo` (arriba, pide una segunda confirmación por botones), `questAceptada`
      // llega cuando la Quest YA se creó de verdad: mismo patrón que `handleAcceptQuestOffer` (el
      // propio botón "Aceptar" de la tarjeta amarilla) — un LogEntry nuevo con `newQuest` (fondo
      // amarillo, sin botones), nunca `questOffer` (que sí los pinta).
      if (turno.questAceptada?.logEntry) {
        const { quest, logEntry, questCompletedInfo } = turno.questAceptada
        setCharacterLog((prev) => [
          ...prev,
          {
            id: logEntry.id,
            channel: 'character',
            text: logEntry.text,
            timeLabel: logEntry.timeLabel,
            createdAt: logEntry.createdAt,
            newQuest: { title: quest.title, objetivo: quest.objetivo ?? '' },
          },
        ])
        if (questCompletedInfo) {
          setCharacterLog((prev) => [...prev, questCompletedLogEntry(questCompletedInfo, logEntry.timeLabel)])
          setXp((prev) => prev + questCompletedInfo.rewardXp)
        }
        getSave(saveId!)
          .then((save) => setQuests(save.quests))
          .catch(() => {})
      }
    } catch {
      setActiveDynamicMode((prev) => (prev ? { ...prev, busy: false, error: 'No se pudo continuar — inténtalo de nuevo.' } : prev))
    }
  }

  // B.5 (checklist frontend 2026-08-27) — vía de escape real durante una conversación en curso:
  // mismo endpoint que "Ignorar" en la tarjeta de oferta (ignorarModoDinamico), ampliado en backend
  // para limpiar `Save.pendingDynamicMode` también cuando ya hay una interacción en marcha.
  async function handleSalirDynamicMode() {
    setActiveDynamicMode((prev) => (prev ? { ...prev, busy: true, error: undefined } : prev))
    try {
      const { logEntry } = await ignorarModoDinamico(saveId!)
      // Bug real jugando en vivo (2026-09-15, hallazgo Álvaro: "cerrar Interactuar no deja rastro
      // en el log") — el backend ya creaba este LogEntry, pero antes nunca llegaba aquí para
      // insertarlo: la conversación desaparecía visualmente aunque estuviera bien persistida.
      if (logEntry) {
        setCharacterLog((prev) => [...prev, { id: logEntry.id, channel: 'character', text: logEntry.text, timeLabel: logEntry.timeLabel, createdAt: logEntry.createdAt }])
      }
      setActiveDynamicMode(null)
    } catch {
      setActiveDynamicMode((prev) => (prev ? { ...prev, busy: false, error: 'No se pudo salir — inténtalo de nuevo.' } : prev))
    }
  }

  return {
    handleInteractuarModoDinamico,
    handleDismissDynamicModeOffer,
    handleInteractuarModoDinamicoRecurso,
    recursoDetalle,
    handleVerRecursoDetalle,
    handleCerrarRecursoDetalle,
    handleAccionRecursoDetalle,
    handleChooseNpcInteraction,
    handleElegirDynamicMode,
    handleSalirDynamicMode,
  }
}
