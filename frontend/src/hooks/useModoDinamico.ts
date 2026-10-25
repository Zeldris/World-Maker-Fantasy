import { useState, type Dispatch, type SetStateAction } from 'react'
import { duracionTirada, esperarTirada } from '../lib/duracionTirada'
import {
  abrirMenuNpc,
  chooseNpcInteraction,
  getSave,
  ignorarModoDinamico,
  interactuarModoDinamico,
  interactuarModoDinamicoRecurso,
  resolveImageUrl,
  responderModoDinamico,
} from '../lib/api'
import type { AvisoMisionInfo } from '../lib/api'
import { applyInventoryDelta, questCompletedLogEntry } from '../lib/gameViewHelpers'
import type { PanelId } from '../components/NavTabs'
import type { EnciclopediaIndex } from '../lib/enciclopediaIndex'
import type { InventoryItemInfo, LogEntry, MetodoObtencion, NpcInSceneInfo, QuestInfo } from '../types'
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
  /// P161 (QA-27): la energía que recupera el rato de recolectar, para el HUD.
  setEnergia?: Dispatch<SetStateAction<number>>
  setCombateIniciado: Dispatch<SetStateAction<{ npcs: NpcInSceneInfo[] } | null>>
  setActiveDynamicMode: ReturnType<typeof useActionModalsState>['setActiveDynamicMode']
  setInventory: Dispatch<SetStateAction<InventoryItemInfo[]>>
  setXp: Dispatch<SetStateAction<number>>
  setQuests: Dispatch<SetStateAction<QuestInfo[]>>
  setAprenderOficioModalOpen: (open: boolean) => void
  /// CR-40 (40f/40g): propuesta de trabajo de un NPC («¿Tienes trabajo?»); `aviso` null = no tiene nada.
  onOfertaTrabajo?: (npcName: string, aviso: AvisoMisionInfo | null) => void
  /// CR-18 (18c): tras «¿Qué se cuenta?», traer ya las noticias que el NPC ha dejado en «El mundo».
  onNoticiasNuevas?: () => void
  /// CR-32: alguien se ha unido sin pelear (hay que traer los compañeros).
  onReclutado?: () => void
  setActivePanel: Dispatch<SetStateAction<PanelId | null>>
  openCombat: (npcs: { npcs: NpcInSceneInfo[] }) => void
  handleSubmit: (actionText: string, extras?: { accionEnDiario?: string | null }) => void | Promise<void>
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
  setEnergia,
  setCombateIniciado,
  setActiveDynamicMode,
  setInventory,
  setXp,
  setQuests,
  setAprenderOficioModalOpen,
  setActivePanel,
  onOfertaTrabajo,
  onNoticiasNuevas,
  onReclutado,
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
    /// P142: ya se pasó por el menú fijo del NPC («Charlar» o «Combatir»); no se vuelve a abrir.
    trasMenu?: boolean,
  ) {
    setCharacterLog((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, dynamicModeOffer: { ...e.dynamicModeOffer, tipo, targetSlug, targetName, quienInicia, combateForzado, zonePointId, cantidad, busy: true, error: undefined } } : e)),
    )
    try {
      // P142: un NPC con menú propio (oficio, trabajo, noticias…) lo enseña primero, en el sitio
      // de la tarjeta; «Charlar» vuelve aquí con `trasMenu` para abrir la escena libre.
      if (tipo === 'NPC' && !combateForzado && !trasMenu) {
        const { menu } = await abrirMenuNpc(saveId!, targetSlug)
        if (menu) {
          setCharacterLog((prev) =>
            prev.map((e) => (e.id === entryId ? { ...e, dynamicModeOffer: e.dynamicModeOffer && { ...e.dynamicModeOffer, busy: false }, npcInteractionOffer: { ...menu, busy: false } } : e)),
          )
          return
        }
      }
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
        handleSubmit(turno.actionText, { accionEnDiario: turno.accionEnDiario })
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
                dynamicModeOffer: yaNoDisponible ? undefined : { ...e.dynamicModeOffer, tipo, targetSlug, targetName, quienInicia, combateForzado, zonePointId, cantidad, busy: false, error: motivo },
                ...(yaNoDisponible ? { text: `${e.text} (${motivo})` } : {}),
              }
            : e,
        ),
      )
    }
  }

  function handleDismissDynamicModeOffer(entryId: string) {
    // P150 (QA-27): se dice qué oferta se ignora; si el paso siguiente ya ha puesto otra, esa no se borra.
    const targetSlug = characterLog.find((e) => e.id === entryId)?.dynamicModeOffer?.targetSlug
    setCharacterLog((prev) => prev.map((e) => (e.id === entryId ? { ...e, dynamicModeOffer: undefined } : e)))
    // Best-effort: "ignorar" no tiene consecuencia visible si falla (la oferta ya no se muestra),
    // solo se registra en consola para no perder el rastro por completo si el backend queda con
    // `pendingDynamicMode` huérfano.
    ignorarModoDinamico(saveId!, targetSlug).catch((err) => console.error('ignorarModoDinamico falló', err))
  }

  // RECURSO (2026-09-08, "Ver qué hay en la zona") — a diferencia de `handleInteractuarModoDinamico`
  // (abre DynamicModeModal, conversación de vueltas), esto resuelve TODO de una sola llamada: tirada
  // real + inventario + LogEntry, reutilizando exactamente el mismo patrón de actualización que
  // `HarvestSelectionModal.onConfirm` (applyInventoryDelta + setCharacterLog + setFictionalDate) —
  // mismo backend (`resolverRecoleccion`), solo un disparador distinto.
  async function handleInteractuarModoDinamicoRecurso(entryId: string, targetSlug: string) {
    setCharacterLog((prev) => prev.map((e) => (e.id === entryId && e.dynamicModeOffer ? { ...e, dynamicModeOffer: { ...e.dynamicModeOffer, busy: true, error: undefined } } : e)))
    const targetName = characterLog.find((e) => e.id === entryId)?.dynamicModeOffer?.targetName ?? 'el recurso'
    try {
      const resultado = await interactuarModoDinamicoRecurso(saveId!, targetSlug)
      setCharacterLog((prev) => prev.map((e) => (e.id === entryId ? { ...e, dynamicModeOffer: undefined } : e)))
      // Fase 10 (2026-09-29, "todas las tiradas visibles") — el dado de Explorar se anima ANTES de
      // mostrar lo obtenido (misma regla que `HarvestSelectionModal`: sin esto el resultado
      // spoilearía el dado). QA-73: la línea del dado ya lleva el id de la entrada guardada y, cuando el
      // dado aterriza, se sustituye en su sitio por esa entrada con su tirada completa: queda igual que
      // tras recargar y el dado no se vuelve a animar (mismo id, ya visto en vivo).
      const guardada = { ...resultado.logEntry, channel: 'character' as const }
      if (resultado.roll) {
        setCharacterLog((prev) => [
          ...prev,
          {
            id: guardada.id,
            channel: 'character',
            text: `${characterName ?? 'Tu personaje'} lo intenta con ${targetName}…`,
            timeLabel: fictionalDate,
            createdAt: guardada.createdAt,
            roll: { kind: 'recoleccion', tirada: resultado.roll },
          },
        ])
        await esperarTirada(duracionTirada() + 500)
      }
      if (resultado.items || resultado.updatedItems) {
        setInventory((prev) => applyInventoryDelta(prev, resultado.items ?? [], [], resultado.updatedItems ?? []))
      }
      // El backend guarda siempre el intento, también el fallido (`registrarFallo`).
      setCharacterLog((prev) => (prev.some((e) => e.id === guardada.id) ? prev.map((e) => (e.id === guardada.id ? guardada : e)) : [...prev, guardada]))
      setFictionalDate(resultado.logEntry.timeLabel)
      if (resultado.energia !== undefined) setEnergia?.(resultado.energia)
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
      const entrada = characterLog.find((e) => e.id === entryId)
      const encuentro = entrada?.npcInteractionOffer?.desdeEncuentro ? entrada.dynamicModeOffer : undefined
      // P142: desde el mapa, el encuentro sigue vivo solo para «Charlar»/«Combatir»; el resto lo resuelve.
      const sigueElEncuentro = resultado.accion === 'CHARLAR' || (resultado.accion === 'FORZAR_COMBATE' && resultado.desdeEncuentro)
      setCharacterLog((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, npcInteractionOffer: undefined, ...(encuentro && !sigueElEncuentro ? { dynamicModeOffer: undefined } : {}) } : e)),
      )
      if (resultado.accion === 'CHARLAR') {
        if (encuentro && encuentro.tipo === 'NPC') {
          void handleInteractuarModoDinamico(entryId, 'NPC', encuentro.targetSlug, encuentro.targetName, encuentro.quienInicia, false, encuentro.zonePointId, encuentro.cantidad, true)
        }
      } else if (resultado.accion === 'FORZAR_COMBATE' && resultado.desdeEncuentro && encuentro && encuentro.tipo === 'NPC') {
        void handleInteractuarModoDinamico(entryId, 'NPC', encuentro.targetSlug, encuentro.targetName, 'npc', true, encuentro.zonePointId, encuentro.cantidad, true)
      } else if (resultado.accion === 'ABRIR_APRENDER_OFICIO') {
        setAprenderOficioModalOpen(true)
      } else if (resultado.accion === 'ABRIR_RECLUTAR') {
        setActivePanel('companeros')
      } else if (resultado.accion === 'FORZAR_COMBATE') {
        const npcName = characterLog.find((e) => e.id === entryId)?.npcInteractionOffer?.npcName ?? 'él'
        handleSubmit(`Ataco a '${npcName}'.`)
      } else if (resultado.accion === 'AYUDADO' || resultado.accion === 'CONTADO') {
        setCharacterLog((prev) => [...prev, resultado.logEntry])
        if (resultado.accion === 'CONTADO') onNoticiasNuevas?.()
      } else if (resultado.accion === 'PROPUESTA') {
        setCharacterLog((prev) => [...prev, resultado.logEntry])
        if (resultado.unido) onReclutado?.()
      } else if (resultado.accion === 'OFERTA_TRABAJO') {
        onOfertaTrabajo?.(resultado.npcName, resultado.aviso)
      } else if (resultado.accion === 'SIN_TRABAJO') {
        const npcName = characterLog.find((e) => e.id === entryId)?.npcInteractionOffer?.npcName ?? 'Nadie'
        onOfertaTrabajo?.(npcName, null)
      }
      // 'MOSTRAR_OFERTA_MISION'/'CERRAR' no necesitan ninguna acción más — la tarjeta ya se limpió
      // arriba, y la oferta de misión (si la hay) ya vive en su propia tarjeta independiente.
    } catch (err) {
      // El motivo real del backend (p. ej. «Ese encuentro ya no está disponible» con un menú caducado),
      // mismo criterio que el recurso de arriba.
      const motivo = err instanceof Error && err.message ? err.message : 'No se pudo continuar — inténtalo de nuevo.'
      setCharacterLog((prev) =>
        prev.map((e) =>
          e.id === entryId && e.npcInteractionOffer ? { ...e, npcInteractionOffer: { ...e.npcInteractionOffer, busy: false, error: motivo } } : e,
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
        handleSubmit(turno.actionText, { accionEnDiario: turno.accionEnDiario })
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
        const { quest, logEntry, questCompletedInfo, newInventoryItems } = turno.questAceptada
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
        // P32 / QA-54: la recompensa llega con la respuesta y entra en el inventario visible.
        if (newInventoryItems?.length) setInventory((prev) => applyInventoryDelta(prev, newInventoryItems, [], []))
        getSave(saveId!)
          .then((save) => {
            setQuests(save.quests)
            // Sin la recompensa en la respuesta (un backend anterior), la recarga la trae.
            if (questCompletedInfo?.grantedItems.length && !newInventoryItems?.length) setInventory(save.inventory)
          })
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
