import type { Dispatch, SetStateAction } from 'react'
import { aceptarMision, cancelarMision, getSave } from '../lib/api'
import { questCompletedLogEntry } from '../lib/gameViewHelpers'
import type { InventoryItemInfo, LogEntry, QuestInfo } from '../types'

// Bloque aceptar/descartar oferta de misión extraído de GameView.tsx (Fase 12 del plan, refactor
// puro, mismo patrón que useInventarioAcciones.ts): GameView sigue siendo dueño del log, del XP y
// de las misiones; el hook recibe sus setters como parámetros.
interface UseMisionesAccionesParams {
  saveId: string | null
  setCharacterLog: Dispatch<SetStateAction<LogEntry[]>>
  setCharacterThinking: Dispatch<SetStateAction<boolean>>
  setXp: Dispatch<SetStateAction<number>>
  setQuests: Dispatch<SetStateAction<QuestInfo[]>>
  setInventory: Dispatch<SetStateAction<InventoryItemInfo[]>>
}

export function useMisionesAcciones({ saveId, setCharacterLog, setCharacterThinking, setXp, setQuests, setInventory }: UseMisionesAccionesParams) {
  // Botones Aceptar/Cancelar en una oferta de misión (2026-08-26) — `entryId` identifica la
  // LogEntry concreta cuya tarjeta hay que limpiar (evita que quede pegada tras responder, y
  // evita que un doble clic la reenvíe: la propia limpieza de `questOffer` deshabilita los
  // botones antes de que la petición vuelva).
  async function handleAcceptQuestOffer(entryId: string, title: string, description: string) {
    // Bug real jugando en vivo (2026-08-30, "el cuadro del log de gistera deberia seguir siendo
    // amarillo...no azul") — limpiar `questOffer` sin más quitaba los botones PERO también todo
    // rastro amarillo de esta entrada (LogPanel.tsx la trataba como narración normal en cuanto
    // dejaba de tener botones). `questOfferResolved: true` mantiene el fondo amarillo para siempre
    // — sigue siendo, de hecho, la presentación de una oferta de misión, ya resuelta.
    setCharacterLog((prev) => prev.map((e) => (e.id === entryId ? { ...e, questOffer: undefined, questOfferResolved: true } : e)))
    // Bug real jugando en vivo (2026-08-30, "al añadir la respuesta no se bloquean el prompt y el
    // boton actuar") — esta acción ahora pasa por `generateQuestResponseNarration` (Ollama, no
    // instantánea), pero a diferencia de cualquier turno normal nunca marcaba `characterThinking`:
    // el composer/Actuar seguían habilitados mientras la petición seguía en curso, dejando que la
    // jugadora mandara un turno nuevo por encima de la respuesta todavía pendiente.
    setCharacterThinking(true)
    try {
      const { quest, logEntry, questCompletedInfo } = await aceptarMision(saveId!, title, description)
      if (logEntry) {
        setCharacterLog((prev) => [
          ...prev,
          {
            id: logEntry.id,
            channel: 'character',
            text: logEntry.text,
            timeLabel: logEntry.timeLabel,
            createdAt: logEntry.createdAt,
            // Bug real jugando en vivo (2026-08-30, "el cuadro del log de gistera deberia seguir
            // siendo amarillo...no azul") — sin `newQuest`, LogPanel.tsx pintaba esta entrada con
            // el fondo azul normal en vez del amarillo de "nueva misión" (mismo criterio que
            // cualquier otra aceptación vía el camino de texto libre, que sí lo lleva).
            newQuest: { title: quest.title, objetivo: quest.objetivo ?? description },
          },
        ])
      }
      // Bug real (2026-09-04, auditoría "representar siempre XP/profesión/reputación"): el
      // backend ya concedía +100 XP real y devolvía este campo cuando la misión nace ya
      // COMPLETADA (NPC objetivo ya derrotado antes de aceptar) — se descartaba en silencio, sin
      // chip 🏆 ni actualización del XP visible hasta la próxima recarga. Mismo LogEntry aparte
      // que ya usa el camino de combate (questCompletedLogEntry, useCombatFlow.ts/useTurnFlow.ts).
      if (questCompletedInfo) {
        setCharacterLog((prev) => [...prev, questCompletedLogEntry(questCompletedInfo, logEntry?.timeLabel ?? '')])
        setXp((prev) => prev + questCompletedInfo.rewardXp)
      }
      // P32 (QA-27): la recompensa (el Mapa de las Llanuras) ya está en el inventario del backend;
      // sin recargarlo, el mapa del mundo seguía pidiendo conseguirlo hasta recargar la página.
      getSave(saveId!)
        .then((save) => {
          setQuests(save.quests)
          if (questCompletedInfo?.grantedItems.length) setInventory(save.inventory)
        })
        .catch(() => {})
    } catch {
      // Best-effort (mismo criterio que el resto de acciones deterministas de este archivo): si
      // la petición falla, la tarjeta ya se limpió — la jugadora puede volver a intentarlo escrito
      // a mano si de verdad hace falta, no hay ningún estado a medias que arreglar.
    } finally {
      setCharacterThinking(false)
    }
  }

  function handleDismissQuestOffer(entryId: string) {
    setCharacterLog((prev) => prev.map((e) => (e.id === entryId ? { ...e, questOffer: undefined } : e)))
    // Bug real jugando en vivo (2026-09-03, "misión de apertura no sobrevive a un F5") — la oferta
    // ahora se persiste en el backend al proponerse (`pendingQuestOfferInfo`); sin esta llamada,
    // recargar tras Cancelar hacía reaparecer la tarjeta ya descartada. Best-effort (mismo criterio
    // que el resto de acciones deterministas de este archivo): la tarjeta ya se limpió en pantalla,
    // un fallo de red aquí no bloquea nada más.
    if (saveId) cancelarMision(saveId).catch(() => {})
  }

  return { handleAcceptQuestOffer, handleDismissQuestOffer }
}
