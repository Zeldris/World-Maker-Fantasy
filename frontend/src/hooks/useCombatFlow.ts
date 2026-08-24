import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import type { CombatNpcDisplay } from '../components/CombatComposer'
import { requestTurnClassify, requestTurnNarrate, requestFlee, type EnciclopediaResponse } from '../lib/api'
import { isTurnLockedError, npcInSceneToCombatDisplay, applyInventoryDelta, questCompletedLogEntry } from '../lib/gameViewHelpers'
import { combatDifficultyFor, type CombatDifficulty } from '../lib/combatDifficulty'
import type {
  CombatExchangeInfo,
  CondicionFisica,
  DiscoveryItem,
  InitiativeRollInfo,
  InventoryItemInfo,
  LogEntry,
  NpcInSceneInfo,
  ProgressionResult,
  QuestInfo,
  SavedActionInfo,
} from '../types'
import type { PanelId } from '../components/NavTabs'

// Espejo de limiteMuertes() en backend/src/services/death.ts — MUERTO añadido (2026-07-30, botón
// "Decapitar") como peor escalón, para que la fusión "nunca empeora sin razón real" de
// handleCombatTurnResolved siga funcionando igual.
const CONDICION_ORDER: CondicionFisica[] = ['ILESO', 'HERIDO', 'GRAVE', 'CONVALECIENTE', 'MUERTO']

interface UseCombatFlowParams {
  saveId: string | null
  fictionalDate: string
  level: number
  savedActions: SavedActionInfo[]
  inventory: InventoryItemInfo[]
  setInventory: Dispatch<SetStateAction<InventoryItemInfo[]>>
  enciclopediaData: EnciclopediaResponse | null
  buildEntityBanner: (narration: string, logEntryId: string) => LogEntry['entityBanner']
  combateIniciado: { npcs: NpcInSceneInfo[] } | null
  setCombateIniciado: Dispatch<SetStateAction<{ npcs: NpcInSceneInfo[] } | null>>
  setLastInitiativeRoll: Dispatch<SetStateAction<InitiativeRollInfo | null>>
  setDiscoveries: Dispatch<SetStateAction<DiscoveryItem[]>>
  activePanel: PanelId | null
  setActivePanel: Dispatch<SetStateAction<PanelId | null>>
  combatDisabledTabs: PanelId[]
  setCharacterThinking: Dispatch<SetStateAction<boolean>>
  setCharacterLog: Dispatch<SetStateAction<LogEntry[]>>
  setQuests: Dispatch<SetStateAction<QuestInfo[]>>
  setDeathCount: Dispatch<SetStateAction<number>>
  setFactionsStatus: Dispatch<SetStateAction<Record<string, number>>>
  setProfessionProgress: Dispatch<SetStateAction<import('../types').ProfessionProgressInfo[]>>
  setXp: Dispatch<SetStateAction<number>>
  setLevel: Dispatch<SetStateAction<number>>
  setPendingAttributePoints: Dispatch<SetStateAction<number>>
  setCondicionFisica: Dispatch<SetStateAction<CondicionFisica>>
  setEnergia: Dispatch<SetStateAction<number>>
  setEnergiaMax: Dispatch<SetStateAction<number>>
  setFictionalDate: Dispatch<SetStateAction<string>>
  setEndedAt: Dispatch<SetStateAction<string | null>>
  setDiceReveal: Dispatch<SetStateAction<{ exchange: CombatExchangeInfo; npcName: string | null } | null>>
}

/// Bloque de combate de GameView.tsx (deuda técnica 2026-08-21) — extraído tras confirmar que
/// `combateIniciado`/`lastInitiativeRoll`/`discoveries`/`activePanel` y todo el "estado de save"
/// (characterLog, inventory, xp, level, condicionFisica, energia, fictionalDate, endedAt, quests,
/// deathCount, factionsStatus, professionProgress) los escriben TAMBIÉN `syncFromSave`/
/// `handleSubmit`/`handleHuntResolved` fuera de este hook — no se pueden mover aquí sin duplicar
/// esa escritura, así que GameView sigue siendo su dueño y este hook los recibe como parámetros
/// (valor + setter). Lo que sí es puramente interno de combate (nunca tocado desde fuera) se
/// queda como estado propio del hook: `combatOpen`, `combatNpcStates`, `combatBusy`, `combatEnded`,
/// `combatAwaitingDefense`, la selección de NPC/habilidad/objeto/texto libre, y `fleeingPreCombat`.
export function useCombatFlow(params: UseCombatFlowParams) {
  const {
    saveId,
    fictionalDate,
    level,
    savedActions,
    inventory,
    setInventory,
    enciclopediaData,
    buildEntityBanner,
    combateIniciado,
    setCombateIniciado,
    setLastInitiativeRoll,
    setDiscoveries,
    activePanel,
    setActivePanel,
    combatDisabledTabs,
    setCharacterThinking,
    setCharacterLog,
    setQuests,
    setDeathCount,
    setFactionsStatus,
    setProfessionProgress,
    setXp,
    setLevel,
    setPendingAttributePoints,
    setCondicionFisica,
    setEnergia,
    setEnergiaMax,
    setFictionalDate,
    setEndedAt,
    setDiceReveal,
  } = params

  const [combatOpen, setCombatOpen] = useState(false)
  const [fleeingPreCombat, setFleeingPreCombat] = useState(false)
  const [combatNpcStates, setCombatNpcStates] = useState<CombatNpcDisplay[]>([])
  const [combatBusy, setCombatBusy] = useState(false)
  const [combatEnded, setCombatEnded] = useState(false)
  const [combatAwaitingDefense, setCombatAwaitingDefense] = useState(false)
  const [combatSelectedNpcSlug, setCombatSelectedNpcSlug] = useState<string | null>(null)
  const [combatSelectedAbilityId, setCombatSelectedAbilityId] = useState<string | null>(null)
  const [combatSelectedItemId, setCombatSelectedItemId] = useState<string | null>(null)
  const [combatFreeText, setCombatFreeText] = useState('')

  // Auditoría de rendimiento 2026-07-28 ("rascar segundos"): memoizado — sin esto, `.map()`
  // devolvía una referencia NUEVA en cada render de GameView, y el useEffect de `allResolved` de
  // abajo depende de este array entero: sin una referencia estable, se disparaba en cada render.
  const combatNpcsDisplay: CombatNpcDisplay[] = useMemo(
    () =>
      (combateIniciado?.npcs ?? []).map(
        (n) => combatNpcStates.find((s) => s.slug === n.slug) ?? npcInSceneToCombatDisplay(n),
      ),
    [combateIniciado, combatNpcStates],
  )

  // Indicador de dificultad antes de pulsar "Combatir" (2026-07-29) — usa el NPC de mayor nivel
  // del encuentro (el peor caso), mismo criterio que `difficultyHintFor` en el backend.
  const combatDifficulty: CombatDifficulty | null = useMemo(() => {
    if (!combateIniciado || !enciclopediaData) return null
    const levels = combateIniciado.npcs
      .map((n) => enciclopediaData.npcs.find((e) => e.slug === n.slug)?.level ?? enciclopediaData.faunaFlora.find((f) => f.sourceSlug === n.slug)?.level)
      .filter((l): l is number => typeof l === 'number')
    if (levels.length === 0) return null
    return combatDifficultyFor(Math.max(...levels) - level)
  }, [combateIniciado, enciclopediaData, level])

  // Bug real (2026-07-25, "revisar partida"): `combatEnded` solo se marcaba con `finDePartida` o
  // la muerte del PROPIO personaje — nunca cuando el enemigo quedaba derrotado. Un NPC en GRAVE ya
  // se puede saquear, así que saquearlo es la señal real de "esto ya terminó" aunque nunca llegue
  // a CONVALECIENTE.
  useEffect(() => {
    if (!combatOpen || combatEnded || combatNpcsDisplay.length === 0) return
    const allResolved = combatNpcsDisplay.every((n) => n.condicion === 'CONVALECIENTE' || n.condicion === 'MUERTO' || n.yaSaqueado)
    if (allResolved) setCombatEnded(true)
  }, [combatOpen, combatEnded, combatNpcsDisplay])

  // `combatOverride` (bug real, auditoría de bugs 2026-08-21): "Cazar" resolviendo una presa
  // débil SIN combate (`handleHuntResolved`, GameView.tsx) hace `setCombateIniciado(result.combate)`
  // y llama a `openCombat()` en la misma sincronía — sin este parámetro, la función leía
  // `combateIniciado` del cierre de ESTE render (el `setState` de la línea anterior todavía no se
  // había aplicado), que en ese flujo es siempre `null`. `openCombat` devolvía sin hacer nada.
  function openCombat(combatOverride?: { npcs: NpcInSceneInfo[] } | null) {
    const combate = combatOverride ?? combateIniciado
    if (!combate) return
    // Bug real (auditoría 2026-07-30): un turno puede traer a la vez un hallazgo (`discoveries`)
    // Y una emboscada (`combateIniciado`) — sin esto, el aviso de "hallazgo descubierto" se quedaba
    // solapado visualmente por encima del popup de combate recién abierto.
    setDiscoveries([])
    setCombatNpcStates(combate.npcs.map(npcInSceneToCombatDisplay))
    setCombatEnded(false)
    setCombatSelectedNpcSlug(combate.npcs[0]?.slug ?? null)
    setCombatSelectedAbilityId(null)
    setCombatSelectedItemId(null)
    setCombatFreeText('')
    // Bug real (auditoría 2026-07-30): NO se resetea `combatAwaitingDefense` aquí a propósito.
    // `handleCombatHuir` cierra el popup de inmediato sin esperar la resolución real (fire-and-
    // forget) — si la huida falla y el NPC contraataca, `handleCombatTurnResolved` deja
    // `combatAwaitingDefense=true` (turno real, correcto) mientras el popup sigue cerrado y
    // reaparece el aviso "⚔️ Combatir". Si `openCombat()` lo reseteaba aquí sin más, reabrir el
    // popup mostraba los controles de ataque en vez del prompt de "Defenderte", aunque el backend
    // (`Save.pendingNpcAttack`) siga esperando esa defensa de todos modos.
    setLastInitiativeRoll(null)
    if (activePanel && combatDisabledTabs.includes(activePanel)) {
      setActivePanel(null)
    }
    setCombatOpen(true)
  }

  async function submitCombatAction(
    action: string,
    opts: { savedActionId?: string; lootItemNames?: string[]; allowAfterEnded?: boolean; isItemUse?: boolean },
  ): Promise<boolean> {
    // Bug real jugando en vivo (2026-07-31): Registrar/Decapitar/Saquear son las acciones que la
    // pantalla de combate YA terminado ofrece — sin `allowAfterEnded`, esas llamadas nunca
    // llegaban ni a hacer la petición.
    if (!action.trim() || combatBusy || (combatEnded && !opts.allowAfterEnded) || !saveId) return false
    setCombatBusy(true)
    // Bug real (2026-07-29, "no veo el cuadro rojo del narrador generando el texto" en combate):
    // combatBusy solo bloquea los botones de CombatPanel — nunca activaba `characterThinking`.
    setCharacterThinking(true)
    try {
      const classifyResult = await requestTurnClassify({ saveId, action, enCombate: true, savedActionId: opts.savedActionId })
      const { classification, roll } = classifyResult
      if (classifyResult.blocked) {
        return false
      }
      if (classifyResult.transit) {
        // Salvaguarda (auditoría 2026-07-28): el backend ya fuerza banda "instantánea" para
        // cualquier acción de combate — esto no debería pasar nunca, pero si pasara, seguir a
        // narrate igualmente resolvería el turno DOS veces.
        setCharacterLog((prev) => [
          ...prev,
          {
            id: `combat-err-${Date.now()}`,
            channel: 'character',
            text: 'Esta acción tardaría demasiado para resolverse en mitad de un combate — prueba con algo más directo.',
            timeLabel: fictionalDate,
            createdAt: new Date().toISOString(),
            combate: true,
          },
        ])
        return false
      }
      const {
        narration,
        progression,
        condicionFisica,
        energia,
        energiaMax,
        timeLabel: newTimeLabel,
        combateIniciado: combate,
        finDePartida,
        justDied,
        newInventoryItems,
        removedInventoryItemIds,
        updatedInventoryItems,
        logEntryId,
        quests: updatedQuests,
        newQuestInfo,
        questCompletedInfo,
        esperandoDefensaJugador,
        npcAbilityUsed,
        playerAbilityUsed,
        combatExchangeDisplay,
        nextInitiativeRoll,
        deathCount: updatedDeathCount,
        factionsStatus: updatedFactionsStatus,
        professionProgress: updatedProfessionProgress,
      } = await requestTurnNarrate(
        {
          saveId,
          action,
          classification,
          roll,
          enCombate: true,
          savedActionId: opts.savedActionId,
          npcsInScene: classifyResult.npcsInScene,
          lootItemNames: opts.lootItemNames,
          isItemUse: opts.isItemUse,
        },
        { onExchangeResolved: (exchange, npcName) => setDiceReveal({ exchange, npcName }) },
      )
      setQuests(updatedQuests)
      // Bug real (auditoría 2026-08-06): matar/decapitar a un NPC de facción en combate cambia
      // `factionsStatus`, y morir en combate cambia `deathCount` — sin esto, Personaje →
      // Reputación/Profesiones y el contador de muertes se quedaban con el valor de antes.
      setDeathCount(updatedDeathCount)
      setFactionsStatus(updatedFactionsStatus)
      setProfessionProgress(updatedProfessionProgress)
      handleCombatTurnResolved({
        narration: narration.narration,
        progression,
        condicionFisica,
        energia,
        energiaMax,
        timeLabel: newTimeLabel,
        finDePartida,
        newInventoryItems,
        removedInventoryItemIds,
        updatedInventoryItems,
        logEntryId,
        combate,
        esperandoDefensaJugador,
        npcAbilityUsed,
        playerAbilityUsed,
        combatExchangeDisplay,
        nextInitiativeRoll,
        newQuestInfo,
        questCompletedInfo,
      })
      // Bug real (2026-07-29, "si muero no hace lo que fijamos que haría"): `condicionFisica` ya
      // llega resuelta a ILESO tras un respawn sobrevivible (nunca MUERTO) — sin `justDied` este
      // chequeo nunca se cumplía salvo fin de partida.
      if (finDePartida || justDied) setCombatEnded(true)
      return true
    } catch (err) {
      // Candado de turno (auditoría de código completa, 2026-08-07) — este intercambio se
      // rechazó de raíz (ya había uno en curso para esta partida), mensaje propio en vez del
      // genérico de abajo.
      setCharacterLog((prev) => [
        ...prev,
        {
          id: `combat-err-${Date.now()}`,
          channel: 'character',
          text: isTurnLockedError(err)
            ? 'Todavía se está resolviendo tu turno anterior — espera un momento e inténtalo de nuevo.'
            : 'No se pudo resolver este turno de combate.',
          timeLabel: fictionalDate,
          createdAt: new Date().toISOString(),
          combate: true,
        },
      ])
      return false
    } finally {
      setCombatBusy(false)
      setCharacterThinking(false)
      setDiceReveal(null)
    }
  }

  function handleCombatHuir() {
    // Fire-and-forget + cierre inmediato: no se espera el resultado narrativo para volver al modo
    // normal.
    submitCombatAction('Intento huir de este combate, alejándome como pueda.', {})
    setCombatOpen(false)
    setCombateIniciado(null)
    setCombatAwaitingDefense(false)
  }

  async function handleCombatRegistrar(npc: CombatNpcDisplay) {
    setCombatNpcStates((prev) => prev.map((n) => (n.slug === npc.slug ? { ...n, yaSaqueado: true } : n)))
    // Comillas alrededor del nombre (bug real, auditoría 2026-07-28): igual que handleAttack ya
    // hace para que el backend resuelva `explicitTarget` — sin ellas, el saqueo podía alcanzar a
    // cualquier otro NPC derrotado en escena, no solo al pulsado aquí.
    const ok = await submitCombatAction(`Registro el cuerpo de '${npc.name}'.`, { allowAfterEnded: true })
    // Rollback (bug real, auditoría 2026-07-28): si el turno falla, el saqueo optimista de arriba
    // dejaba al NPC marcado como saqueado en la UI para siempre.
    if (!ok) {
      setCombatNpcStates((prev) => prev.map((n) => (n.slug === npc.slug ? { ...n, yaSaqueado: false } : n)))
    }
  }

  // Botón "Decapitar" (petición explícita, 2026-07-30) — golpe de gracia determinista contra un
  // enemigo YA convaleciente, sin tirada. UN único prompt mencionando a todos por nombre, SIN
  // comillas — con comillas, `explicitTarget` solo extrae UN nombre, así que varios seleccionados
  // a la vez solo rematarían al primero.
  async function handleDecapitarSeleccion(npcs: CombatNpcDisplay[]) {
    if (npcs.length === 0) return
    setCombatNpcStates((prev) => prev.map((n) => (npcs.some((p) => p.slug === n.slug) ? { ...n, condicion: 'MUERTO' } : n)))
    const nombres = npcs.map((n) => n.name).join(', ')
    const ok = await submitCombatAction(`Remato a ${nombres}, asestándoles el golpe de gracia final.`, { allowAfterEnded: true })
    if (!ok) {
      setCombatNpcStates((prev) => prev.map((n) => (npcs.some((p) => p.slug === n.slug) ? { ...n, condicion: 'CONVALECIENTE' } : n)))
      return
    }
    // Rediseño 2026-07-31 (petición explícita: "solo salir o decapitar cierran el combate") —
    // decapitar es un cierre deliberado, a diferencia de saquear.
    setCombatOpen(false)
    setCombateIniciado(null)
    setCombatAwaitingDefense(false)
  }

  // Resumen de combate (petición explícita, 2026-07-30) — recibe los NOMBRES de objetos YA
  // confirmados desde el modal de selección. UN solo prompt mencionando a cada enemigo por su
  // nombre real, SIN comillas.
  //
  // Saqueo parcial (2026-07-31): a diferencia de Decapitar/Salir, saquear NUNCA cierra el combate
  // por su cuenta — `quedaAlgoPorSaquear` (CombatPanel.tsx) reacciona solo al estado real de
  // `yaSaqueado` de cada NPC.
  async function handleSaquearSeleccion(itemNames: string[], fullyLootedSlugs: string[], itemNamesByNpc: Record<string, string[]>) {
    const porSaquear = combatNpcsDisplay.filter((n) => (n.condicion === 'CONVALECIENTE' || n.condicion === 'MUERTO') && !n.yaSaqueado)
    if (porSaquear.length > 0) {
      setCombatNpcStates((prev) =>
        prev.map((n) => {
          const added = itemNamesByNpc[n.slug]
          // `undefined` = este NPC no formaba parte de esta ronda de saqueo, se deja igual.
          if (added === undefined) return n
          return {
            ...n,
            yaSaqueado: fullyLootedSlugs.includes(n.slug) ? true : n.yaSaqueado,
            lootedItemNames: added.length > 0 ? [...new Set([...n.lootedItemNames, ...added])] : n.lootedItemNames,
          }
        }),
      )
      const nombres = porSaquear.map((n) => n.name).join(', ')
      await submitCombatAction(`Registro los cuerpos de los enemigos derrotados en este combate: ${nombres}.`, { lootItemNames: itemNames, allowAfterEnded: true })
    }
  }

  function resetCombatSelection() {
    setCombatSelectedAbilityId(null)
    setCombatSelectedItemId(null)
    setCombatFreeText('')
  }

  function handleCombatAttack() {
    const selectedAbility = savedActions.find((a) => a.id === combatSelectedAbilityId)
    if (!selectedAbility) return
    // Defensa a ciegas (rediseño del turno de combate, 2026-07-28): reactiva, sin objetivo propio
    // que elegir.
    if (combatAwaitingDefense) {
      submitCombatAction(selectedAbility.promptText, { savedActionId: selectedAbility.id })
      resetCombatSelection()
      return
    }
    const selectedNpc = combatNpcsDisplay.find((n) => n.slug === combatSelectedNpcSlug) ?? null
    const base = selectedAbility.promptText.trim().replace(/\.+$/, '')
    const action = selectedNpc ? `${base} '${selectedNpc.name}'.` : selectedAbility.promptText
    submitCombatAction(action, { savedActionId: selectedAbility.id })
    resetCombatSelection()
  }

  // Objetos consumibles (petición explícita, 2026-07-22): siempre de uso propio, nunca contra un
  // NPC objetivo. `isItemUse: true` deja que el backend active el intercambio de verdad sin que
  // consumir cuente nunca como golpe propio.
  function handleCombatUseItem() {
    const selectedItem = inventory.find((i) => i.id === combatSelectedItemId)
    if (!selectedItem) return
    submitCombatAction(`Uso '${selectedItem.name}'.`, { isItemUse: true })
    resetCombatSelection()
  }

  function handleCombatActuar() {
    if (combatSelectedAbilityId) handleCombatAttack()
    else if (combatSelectedItemId) handleCombatUseItem()
  }

  function handleCombatFreeSubmit() {
    if (!combatFreeText.trim()) return
    submitCombatAction(combatFreeText, {})
    resetCombatSelection()
  }

  function handleCombatTurnResolved(params: {
    narration: string
    progression: ProgressionResult
    condicionFisica: CondicionFisica
    energia: number
    energiaMax: number
    timeLabel: string
    finDePartida: boolean
    newInventoryItems: InventoryItemInfo[]
    removedInventoryItemIds: string[]
    updatedInventoryItems: { id: string; name: string }[]
    logEntryId: string
    combate?: { npcs: NpcInSceneInfo[] } | null
    esperandoDefensaJugador: boolean
    npcAbilityUsed: { npcName: string; abilityName: string; rol: 'ataque' | 'defensa' } | null
    playerAbilityUsed: { name: string; icon: string; description: string; rol: 'ataque' | 'defensa' } | null
    combatExchangeDisplay: CombatExchangeInfo | null
    nextInitiativeRoll: InitiativeRollInfo | null
    newQuestInfo?: { title: string; objetivo: string } | null
    questCompletedInfo?: { logEntryId: string; text: string; title: string; grantedItems: string[]; rewardXp: number } | null
  }) {
    // `buildEntityBanner` se calcula FUERA del updater (bug real, 2026-07-24): StrictMode invoca
    // dos veces en dev cualquier función pasada a `setState`, y `buildEntityBanner` muta un ref
    // como efecto secundario — la primera invocación (de prueba, descartada) marcaba la entidad
    // como "ya mostrada", así que la segunda la encontraba deduplicada.
    const entityBanner = buildEntityBanner(params.narration, params.logEntryId)
    setCharacterLog((prev) => {
      const next = [
        ...prev,
        {
          id: params.logEntryId,
          channel: 'character' as const,
          text: params.narration,
          timeLabel: params.timeLabel,
          createdAt: new Date().toISOString(),
          entityBanner,
          combate: true,
          npcAbilityUsed: params.npcAbilityUsed ?? undefined,
          playerAbilityUsed: params.playerAbilityUsed ?? undefined,
          combatExchange: params.combatExchangeDisplay ?? undefined,
          newQuest: params.newQuestInfo ?? undefined,
        },
      ]
      // Misión completada (2026-08-13) — LogEntry REAL aparte, nunca fusionada con la narración
      // principal de arriba: el combate puede cerrar una misión en el mismo golpe que la mata,
      // pero son dos filas distintas en la DB.
      if (params.questCompletedInfo) next.push(questCompletedLogEntry(params.questCompletedInfo, params.timeLabel))
      return next
    })
    if (params.newInventoryItems.length > 0 || params.removedInventoryItemIds.length > 0 || params.updatedInventoryItems.length > 0) {
      setInventory((prev) =>
        applyInventoryDelta(prev, params.newInventoryItems, params.removedInventoryItemIds, params.updatedInventoryItems),
      )
    }
    setXp(params.progression.newXp)
    if (params.progression.leveledUp) {
      setLevel(params.progression.newLevel)
      setPendingAttributePoints((prev) => prev + params.progression.attributePointsGained)
    }
    setCondicionFisica(params.condicionFisica)
    setEnergia(params.energia)
    setEnergiaMax(params.energiaMax)
    setFictionalDate(params.timeLabel)
    setCombatAwaitingDefense(params.esperandoDefensaJugador)
    setLastInitiativeRoll(params.nextInitiativeRoll)
    // Bug real (auditoría 2026-07-28): esta función (la que resuelve CADA turno mientras el
    // combate ya está abierto) nunca aplicaba el `combateIniciado` de la respuesta — un NPC nuevo
    // añadido a media pelea quedaba invisible en CombatComposer.
    if (params.combate && params.combate.npcs.length > 0) {
      setCombateIniciado(params.combate)
      setCombatNpcStates((prev) => {
        const bySlug = new Map(prev.map((n) => [n.slug, n]))
        for (const n of params.combate!.npcs) {
          const real: CombatNpcDisplay = npcInSceneToCombatDisplay(n)
          const local = bySlug.get(n.slug)
          if (!local) {
            bySlug.set(n.slug, real)
            continue
          }
          // El backend manda: solo se sustituye el estado local si el real ha avanzado más (nunca
          // "resucita" a alguien que el propio jugador ya vio caer más allá).
          const avanza = CONDICION_ORDER.indexOf(real.condicion) > CONDICION_ORDER.indexOf(local.condicion)
          if (avanza || (real.yaSaqueado && !local.yaSaqueado) || (real.analizado && !local.analizado)) {
            bySlug.set(n.slug, real)
          } else if (real.lootedItemNames.length > local.lootedItemNames.length) {
            // Saqueo parcial (2026-07-31): `lootedItemNames` solo crece, aunque `condicion`/
            // `yaSaqueado` no hayan cambiado este turno.
            bySlug.set(n.slug, { ...local, lootedItemNames: n.lootedItemNames })
          }
        }
        return Array.from(bySlug.values())
      })
    }
    if (params.finDePartida) {
      setEndedAt(new Date().toISOString())
      setCombatOpen(false)
      setCombateIniciado(null)
      setCombatAwaitingDefense(false)
    }
  }

  // Huir ANTES de entrar al combate (petición explícita de la usuaria, 2026-07-24) — una sola
  // tirada determinista en el backend, así que no hay hueco de tiempo en el que una recarga pueda
  // revivir un combate del que ya se huyó. Si falla, se abre el popup normal para pelear de verdad.
  async function handleFleeAttempt() {
    if (!saveId || fleeingPreCombat) return
    setFleeingPreCombat(true)
    try {
      const { escaped, text } = await requestFlee(saveId)
      setCharacterLog((prev) => [
        ...prev,
        { id: `flee-${Date.now()}`, channel: 'character', text, timeLabel: fictionalDate, createdAt: new Date().toISOString() },
      ])
      if (escaped) {
        setCombateIniciado(null)
      } else {
        openCombat()
      }
    } catch {
      // Si falla la llamada en sí (no la tirada), se deja el aviso de "Combatir" tal cual.
    } finally {
      setFleeingPreCombat(false)
    }
  }

  // Botón "Continuar" del resumen de combate ya terminado (petición explícita, 2026-07-30) — este
  // combate ya terminó de verdad (todos los NPCs resueltos, ver `combatEnded` arriba); aquí sí es
  // seguro limpiar `combatAwaitingDefense`, para que el PRÓXIMO combate no herede por error un
  // "toca defender" de este que ya se cerró.
  function closeCombat() {
    setCombatOpen(false)
    setCombateIniciado(null)
    setCombatAwaitingDefense(false)
  }

  return {
    combatOpen,
    combatNpcsDisplay,
    combatDifficulty,
    combatBusy,
    combatEnded,
    combatAwaitingDefense,
    setCombatAwaitingDefense,
    combatSelectedNpcSlug,
    setCombatSelectedNpcSlug,
    combatSelectedAbilityId,
    setCombatSelectedAbilityId,
    combatSelectedItemId,
    setCombatSelectedItemId,
    combatFreeText,
    setCombatFreeText,
    fleeingPreCombat,
    openCombat,
    closeCombat,
    submitCombatAction,
    handleFleeAttempt,
    handleCombatActuar,
    handleCombatRegistrar,
    handleDecapitarSeleccion,
    handleCombatHuir,
    handleSaquearSeleccion,
    handleCombatFreeSubmit,
  }
}
