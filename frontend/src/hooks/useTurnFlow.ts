import { useRef, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { ChatComposerHandle } from '../components/ChatComposer'
import { requestTurnClassify, requestTurnNarrate, getSave, type ClassifyResponse, type ConfirmarCazaResultado, type SaveDetail } from '../lib/api'
import { isBusyError, isEndedGameError, isPendingDeathError, isTurnLockedError, applyInventoryDelta, questCompletedLogEntry } from '../lib/gameViewHelpers'
import { playerActionEntry } from '../lib/simulateAI'
import { duracionTirada, temporizadorTirada } from '../lib/duracionTirada'
import type {
  ActiveEffect,
  BuildingInfo,
  CombatExchangeInfo,
  CompanionInfo,
  CondicionFisica,
  CurrentLocationInfo,
  DestinationInfo,
  EntornoTemporalInfo,
  InitiativeRollInfo,
  InventoryItemInfo,
  KingdomFoundedInfo,
  KingdomStatsInfo,
  LogEntry,
  MentionedEntityBanner,
  PostCombatInteractionInfo,
  ProfessionProgressInfo,
  QuestInfo,
  SubjectInfo,
  TerritoryInfo,
} from '../types'

interface UseTurnFlowParams {
  saveId: string | null
  fictionalDate: string
  busyUntil: string | null
  /// UX-3 (hito 0.1) — turno o respuesta del narrador ya en curso (lo marcan también combate,
  /// misiones y la reconexión, no solo este hook).
  characterThinking: boolean
  endedAt: string | null
  pendingDeathResolution: boolean
  characterLog: LogEntry[]
  composerRef: RefObject<ChatComposerHandle | null>
  buildEntityBanner: (text: string, logEntryId?: string, forcedTarget?: { entityType: string; entitySlug: string }) => MentionedEntityBanner | undefined
  pollForResolution: (params: {
    saveId: string
    logLengthBeforeThisTurn: number
    fictionalDate: string
    syncFromSave: (save: SaveDetail) => void
    setCharacterLog: Dispatch<SetStateAction<LogEntry[]>>
  }) => Promise<void>
  syncFromSave: (save: SaveDetail) => void
  setCombatAwaitingDefense: Dispatch<SetStateAction<boolean>>
  setInput: Dispatch<SetStateAction<string>>
  setCharacterThinking: Dispatch<SetStateAction<boolean>>
  setTimedThinkingText: Dispatch<SetStateAction<string | null>>
  setStreamingNarration: Dispatch<SetStateAction<string | null>>
  setDiceReveal: Dispatch<SetStateAction<{ exchange: CombatExchangeInfo; npcName: string | null } | null>>
  setCharacterLog: Dispatch<SetStateAction<LogEntry[]>>
  setPostCombatTarget: Dispatch<SetStateAction<PostCombatInteractionInfo | null>>
  setCondicionFisica: Dispatch<SetStateAction<CondicionFisica>>
  setPlayerActiveEffects: Dispatch<SetStateAction<ActiveEffect[]>>
  setEntorno: Dispatch<SetStateAction<EntornoTemporalInfo | null>>
  setEnergia: Dispatch<SetStateAction<number>>
  setEnergiaMax: Dispatch<SetStateAction<number>>
  setHambre: Dispatch<SetStateAction<number>>
  setSed: Dispatch<SetStateAction<number>>
  /// Bug real jugando en vivo (2026-09-04): el turno que ABRE combate (esta función) nunca leía
  /// `nextInitiativeRoll` — solo `handleCombatTurnResolved` (useCombatFlow.ts, turnos DENTRO de un
  /// panel ya abierto) lo hacía, y `openCombat()` la resetea a null al abrir el panel. Mismo
  /// patrón exacto que el fix ya aplicado para `esperandoDefensaJugador` más abajo.
  setLastInitiativeRoll: Dispatch<SetStateAction<InitiativeRollInfo | null>>
  setFictionalDate: Dispatch<SetStateAction<string>>
  /// B29 — resultado de la caza arrancada por un ataque de texto libre a fauna adyacente; el dueño
  /// (GameView) lo trata con `handleHuntResolved`, igual que la caza desde la tarjeta.
  onCazaPorTexto?: (resultado: ConfirmarCazaResultado) => void
  setSuggestions: Dispatch<SetStateAction<string[]>>
  setQuests: Dispatch<SetStateAction<QuestInfo[]>>
  setTerritories: Dispatch<SetStateAction<TerritoryInfo[]>>
  setBuildings: Dispatch<SetStateAction<BuildingInfo[]>>
  setSubjects: Dispatch<SetStateAction<SubjectInfo[]>>
  setKingdomStats: Dispatch<SetStateAction<KingdomStatsInfo | null>>
  setDeathCount: Dispatch<SetStateAction<number>>
  setFactionsStatus: Dispatch<SetStateAction<Record<string, number>>>
  setProfessionProgress: Dispatch<SetStateAction<ProfessionProgressInfo[]>>
  /// C.2 (checklist frontend 2026-08-27) — este hook solo necesita marcar "sí hay" (nunca
  /// sincroniza contra la escena), así que recibe el helper con nombre en vez del setter crudo
  /// (`useActionModalsState.ts § markCarcassPending`).
  markCarcassPending: () => void
  setInventory: Dispatch<SetStateAction<InventoryItemInfo[]>>
  setCombateIniciado: Dispatch<SetStateAction<{ npcs: import('../types').NpcInSceneInfo[] } | null>>
  setEndedAt: Dispatch<SetStateAction<string | null>>
  /// Muerte permanente, botón Aceptar/Reintentar (2026-08-31) — mismo patrón que `setEndedAt`.
  setPendingDeathResolution: Dispatch<SetStateAction<boolean>>
  setCurrentLocation: Dispatch<SetStateAction<CurrentLocationInfo | null>>
  setDestinations: Dispatch<SetStateAction<DestinationInfo[]>>
  setCompanions: Dispatch<SetStateAction<CompanionInfo[]>>
  setKingdomFoundedInfo: Dispatch<SetStateAction<KingdomFoundedInfo | null>>
  setXp: Dispatch<SetStateAction<number>>
  setLevel: Dispatch<SetStateAction<number>>
  setPendingAttributePoints: Dispatch<SetStateAction<number>>
  setBusyUntil: Dispatch<SetStateAction<string | null>>
  setBusyActivity: Dispatch<SetStateAction<string | null>>
  setBusyDuracionMinutos: Dispatch<SetStateAction<number | null>>
}

/// A.1 (checklist frontend 2026-08-27, "GameView.tsx es un god file... handleSubmit sigue entero
/// en el componente") — extraído siguiendo el MISMO criterio ya usado para `useCombatFlow.ts`
/// (2026-08-21): todo el "estado de save" (characterLog, inventory, xp, level, condicionFisica,
/// energia, fictionalDate, endedAt, quests, territorios, reino...) lo sigue escribiendo TAMBIÉN
/// `syncFromSave` fuera de este hook — no se puede mover sin duplicar esa escritura, así que
/// GameView sigue siendo su dueño y este hook lo recibe como parámetros (valor + setter). El único
/// estado propio de este hook es ninguno — `handleSubmit` no tenía ningún `useState` local, solo
/// lee/escribe estado de GameView y llama funciones ya devueltas por otros hooks
/// (`buildEntityBanner`, `pollForResolution`, `syncFromSave`, `combat.setCombatAwaitingDefense`).
export function useTurnFlow(params: UseTurnFlowParams) {
  const {
    saveId,
    fictionalDate,
    busyUntil,
    characterThinking,
    endedAt,
    pendingDeathResolution,
    characterLog,
    composerRef,
    buildEntityBanner,
    pollForResolution,
    syncFromSave,
    setCombatAwaitingDefense,
    setInput,
    setCharacterThinking,
    setTimedThinkingText,
    setStreamingNarration,
    setDiceReveal,
    setCharacterLog,
    setPostCombatTarget,
    setCondicionFisica,
    setPlayerActiveEffects,
    setEntorno,
    setEnergia,
    setEnergiaMax,
    setHambre,
    setSed,
    setLastInitiativeRoll,
    setFictionalDate,
    onCazaPorTexto,
    setSuggestions,
    setQuests,
    setTerritories,
    setBuildings,
    setSubjects,
    setKingdomStats,
    setDeathCount,
    setFactionsStatus,
    setProfessionProgress,
    markCarcassPending,
    setInventory,
    setCombateIniciado,
    setEndedAt,
    setPendingDeathResolution,
    setCurrentLocation,
    setDestinations,
    setCompanions,
    setKingdomFoundedInfo,
    setXp,
    setLevel,
    setPendingAttributePoints,
    setBusyUntil,
    setBusyActivity,
    setBusyDuracionMinutos,
  } = params

  // F9-3 (2026-09-29) — la hora de "TU ACCIÓN" se lee del valor MÁS reciente, no del capturado por el
  // cierre de `handleSubmit`: `handleCazarEnZona` espera a la API y llama a un `handleSubmit` de un
  // render anterior (tras caminar/cazar la cabecera ya avanzó y la entrada salía con la hora vieja).
  const fictionalDateRef = useRef(fictionalDate)
  fictionalDateRef.current = fictionalDate

  // UX-3 (hito 0.1, roadmap-front-ux.md H1) — el composer ya se deshabilitaba con un turno en curso,
  // pero Construir (Reino), Viajar desde una salida de zona y los modales de Campamento/Viajar
  // llaman a `handleSubmit` directamente: la acción salía en el registro y el backend la rechazaba
  // después (`isTurnLockedError`). Dos guardias: la ref del estado de GameView (mismo motivo que
  // `fictionalDateRef`, un `handleSubmit` de un render anterior leería el valor viejo) y otra
  // propia que se marca en el acto, antes de cualquier render (doble clic).
  const characterThinkingRef = useRef(characterThinking)
  characterThinkingRef.current = characterThinking
  const turnoEnCursoRef = useRef(false)

  async function handleSubmit(
    action: string,
    // Panel "Curar" con varios objetos/usos a la vez (petición explícita, 2026-08-18) — reenviado
    // tal cual a requestTurnNarrate, mismo criterio que `lootItemNames` en submitCombatAction.
    // "Comer/Beber" (2026-09-04) — mismo patrón que healItemUses.
    // P90/P130: de una caza, lo que el backend guarda en el diario como acción de la jugadora (`null`
    // en una emboscada: no hay acción suya). Sin él, la acción tal cual.
    extras?: { healItemUses?: { itemId: string; quantity: number }[]; hambreSedItemUses?: { itemId: string; quantity: number }[]; accionEnDiario?: string | null },
  ) {
    if (!action || !saveId || busyUntil || endedAt || pendingDeathResolution) return
    if (turnoEnCursoRef.current || characterThinkingRef.current) return
    turnoEnCursoRef.current = true
    composerRef.current?.clear()
    setInput('')
    // Bug real (2026-07-23, "al cambiar de pestaña el narrador da error de localhost"): el stream
    // de /turn/narrate no tiene AbortController ni timeout — si el navegador corta la conexión de
    // fondo (típico al cambiar de pestaña con una narración larga en curso), `reader.read()` falla
    // en el cliente, pero el backend NUNCA se entera: `narrateAndPersistTurn` sigue corriendo y
    // persiste el turno igual. El error de "conexión" de más abajo comprobaba solo eso, nunca si
    // el turno había terminado de verdad en el backend — se guarda la longitud de ANTES para
    // poder distinguir "se cortó pero terminó bien" de "de verdad no llegó a nada".
    const logLengthBeforeThisTurn = characterLog.length

    const accionEnDiario = extras?.accionEnDiario === undefined ? action : extras.accionEnDiario
    if (accionEnDiario !== null) setCharacterLog((prev) => [...prev, playerActionEntry(accionEnDiario, fictionalDateRef.current)])
    setCharacterThinking(true)
    setTimedThinkingText(null)
    setStreamingNarration(null)

    try {
      // El prefetch de arriba (preview:true) ya precalentó la caché del backend con este mismo
      // texto si no cambió desde entonces — esta llamada sigue siendo la real (persiste log/
      // transit como siempre), pero el propio backend se salta Ollama/tabla si encuentra la
      // caché, sin que el frontend tenga que decidir nada ni arriesgar quedarse sin "transit" por
      // reutilizar la respuesta cruda del preview.
      const classifyResult: ClassifyResponse = await requestTurnClassify({ saveId, action })
      const { classification, roll, travel } = classifyResult

      if (classifyResult.blocked) {
        // Validador de "grounding" de la acción del jugador (docs/mecanicas/18-validacion-accion-jugador.md)
        // — el backend ya resolvió el turno (persistió acción + respuesta determinista en el log)
        // sin pasar por /turn/narrate. `resolveBlockedTurn` (turn.ts) no toca nada más del `Save`
        // aparte de los 2 `LogEntry` ya persistidos — la propia acción del jugador ya vive en
        // `characterLog` (entrada optimista de más arriba), así que solo falta añadir la respuesta
        // bloqueada en memoria, mismo patrón que el bloque narrate normal de más abajo (construir
        // la LogEntry en vez de recargar la partida entera). `harvestSuggestion` (Pieza 6d,
        // 2026-09-03) viaja igual de efímero que `questOffer`/`dynamicModeOffer` — nunca sobrevive
        // a una recarga, coherente con el resto de ofertas de este mismo tipo.
        setCharacterThinking(false)
        const blocked = classifyResult.blocked
        // QA-73: la respuesta tal como la guardó el backend (mismo id y estilo que tras recargar).
        setCharacterLog((prev) => [...prev, { ...blocked.logEntry, harvestSuggestion: blocked.harvestSuggestion }])
        return
      }

      if (classifyResult.transit) {
        // Banda extendida/larga: el backend ya lo resolvió en diferido (acción + texto de
        // inicio + CharacterTransit) — recargamos la partida entera para reflejarlo, en vez
        // de intentar reconstruir esas entradas a mano en el cliente.
        setCharacterThinking(false)
        const save = await getSave(saveId)
        syncFromSave(save)
        return
      }

      if (classifyResult.postCombatInteraction) {
        // Interacción con un NPC/fauna ya convaleciente o muerto, fuera de combate (docs/19 pieza
        // 2) — el backend no persistió nada (no fue una acción de verdad, solo abrió el menú), así
        // que hay que deshacer el "TÚ: ..." optimista que se metió arriba antes de llamar a
        // classify, o quedaría una entrada fantasma en el log que nunca existió en el backend.
        setCharacterThinking(false)
        setCharacterLog((prev) => prev.slice(0, logLengthBeforeThisTurn))
        setPostCombatTarget(classifyResult.postCombatInteraction)
        return
      }

      if (classifyResult.cazaPorTexto) {
        // B29 — el backend ya persistió la acción y decidió (caza limpia resuelta, o `actionText` que
        // hay que mandar por el turno normal): se queda el "TÚ: ..." optimista (sí existe en BD).
        setCharacterThinking(false)
        onCazaPorTexto?.(classifyResult.cazaPorTexto)
        return
      }

      if (classification.banda === 'corta' && classifyResult.duracionMinutos) {
        const { duracionMinutos, produccion } = classifyResult
        setTimedThinkingText(`${action} — unos ${duracionMinutos} min de juego${produccion ? ` (${produccion})` : ''}...`)
      }

      const {
        narration,
        progression,
        condicionFisica: newCondicion,
        activeEffects: newActiveEffects,
        entorno: newEntorno,
        energia: newEnergia,
        energiaMax: newEnergiaMax,
        hambre: newHambre,
        sed: newSed,
        timeLabel: newTimeLabel,
        combateIniciado: combate,
        esperandoDefensaJugador,
        nextInitiativeRoll,
        finDePartida,
        pendingDeathResolution: newPendingDeathResolution,
        newInventoryItems,
        removedInventoryItemIds,
        updatedInventoryItems,
        logEntryId,
        quests: updatedQuests,
        newQuestInfo,
        newQuestOfferInfo,
        npcInteractionOffer,
        dynamicModeOffer,
        ofertaDescartada,
        questCompletedInfo,
        factionRepChange,
        professionXpGains,
        newKingdomFounded,
        companionCreated,
        territories: updatedTerritories,
        buildings: updatedBuildings,
        subjects: updatedSubjects,
        kingdomStats: updatedKingdomStats,
        deathCount: updatedDeathCount,
        factionsStatus: updatedFactionsStatus,
        professionProgress: updatedProfessionProgress,
        combatEncounterLootSummary,
        discoveredLocationSlug,
        combatExchangeDisplay,
        intercambiosExtra,
      } = await requestTurnNarrate(
        {
          saveId,
          action,
          classification,
          roll,
          travel,
          npcsInScene: classifyResult.npcsInScene,
          healItemUses: extras?.healItemUses,
          hambreSedItemUses: extras?.hambreSedItemUses,
        },
        {
          onChunk: (delta) => setStreamingNarration((prev) => (prev ?? '') + delta),
          onReset: () => setStreamingNarration(null),
          onExchangeResolved: (exchange, npcName) => setDiceReveal({ exchange, npcName }),
        },
      )
      setStreamingNarration(null)
      setEntorno(newEntorno)
      setFictionalDate(newTimeLabel)
      // Bug real jugando en vivo (2026-09-07, "vida/energía deben cambiar DESPUÉS de la tirada de
      // combate, no antes") — mismo criterio que `useCombatFlow.ts § handleCombatTurnResolved`: si
      // este turno (el que ABRE combate) trae ya un intercambio real resuelto (caso raro: una
      // emboscada que golpea en el mismo turno que se detecta), retrasa condición/energía hasta que
      // `DiceRollReveal` termine de animarlo, en vez de aplicarlo de inmediato mientras los dados
      // todavía pueden seguir rodando en pantalla.
      const applyExchangeResult = () => {
        setCondicionFisica(newCondicion)
        setPlayerActiveEffects(newActiveEffects)
        setEnergia(newEnergia)
        setEnergiaMax(newEnergiaMax)
        setHambre(newHambre)
        setSed(newSed)
      }
      if (combatExchangeDisplay && !finDePartida) {
        temporizadorTirada(() => {
          applyExchangeResult()
          // P56: aterrizados los dados, la tarjeta de la animación sobra (el intercambio ya está en
          // el diario). Antes se quedaba montada hasta el turno siguiente (causa de P11).
          setDiceReveal(null)
        }, 2 * duracionTirada())
      } else {
        applyExchangeResult()
      }
      // Las sugerencias del turno anterior ya no aplican a la escena nueva — se limpian aquí
      // (bajo demanda ahora, ver comentario de `suggestions` más arriba: se piden con su propio
      // botón, no llegan solas con cada narración).
      setSuggestions([])
      setQuests(updatedQuests)
      // Bug real (auditoría de deuda técnica 2026-08-04): construir/mejorar/fundar un edificio de
      // verdad en la DB no se veía en el mapa ni en el panel de Reino hasta recargar la partida
      // entera — `syncFromSave` (más abajo) solo se llama al cargar/reconectar, nunca aquí. Mismo
      // criterio que `quests`: el backend ya manda la lista/valor completo cada turno.
      setTerritories(updatedTerritories)
      setBuildings(updatedBuildings)
      setSubjects(updatedSubjects)
      setKingdomStats(updatedKingdomStats)
      // Bug real (auditoría 2026-08-06): mismo problema que arriba — el contador de muertes, la
      // pestaña Reputación y la pestaña Profesiones se quedaban con el valor de la última recarga
      // completa hasta la siguiente, aunque el turno que se acaba de resolver ya los cambiara.
      setDeathCount(updatedDeathCount)
      setFactionsStatus(updatedFactionsStatus)
      setProfessionProgress(updatedProfessionProgress)
      // Desollar pasiva (2026-08-25) — este turno resolvió un CombatEncounter con caídos reales;
      // se marca de inmediato en vez de esperar al próximo cambio de ubicación (el combate ya
      // pasó en la escena actual, la ubicación no cambia).
      if (combatEncounterLootSummary && combatEncounterLootSummary.length > 0) markCarcassPending()
      if (newInventoryItems.length > 0 || removedInventoryItemIds.length > 0 || updatedInventoryItems.length > 0) {
        setInventory((prev) => applyInventoryDelta(prev, newInventoryItems, removedInventoryItemIds, updatedInventoryItems))
      }
      if (combate && combate.npcs.length > 0) setCombateIniciado(combate)
      // Bug real (auditoría de elementos desconectados, 2026-08-23): este turno (el que ABRE
      // combate/emboscada) nunca leía `esperandoDefensaJugador` — solo `handleCombatTurnResolved`
      // (useCombatFlow.ts, turnos DENTRO de un panel ya abierto) lo hacía. Tras el fix de
      // `pendingNpcAttack` en la emboscada real (2026-08-22), un fallo en el turno de apertura ya
      // hace que el NPC ataque primero de verdad — pero la UI nunca pasaba a mostrar "Defensa" en
      // ese primer intercambio, el jugador seguía viendo "Ataque" pese a que mecánicamente le tocaba
      // defenderse.
      setCombatAwaitingDefense(esperandoDefensaJugador)
      // Bug real jugando en vivo (2026-09-04): mismo hueco exacto que el de arriba, pero para la
      // iniciativa — el turno que ABRE combate calcula/persiste `nextInitiativeRoll` desde siempre
      // (turnResolution.ts), pero nunca se aplicaba al estado aquí, y `openCombat()`
      // (useCombatFlow.ts) la resetea a null al abrir el panel — el badge de iniciativa solo
      // aparecía a partir del SEGUNDO intercambio (o recargando la página, que sí la rehidrata).
      if (combate && combate.npcs.length > 0) setLastInitiativeRoll(nextInitiativeRoll)
      if (finDePartida) setEndedAt(new Date().toISOString())
      if (newPendingDeathResolution) setPendingDeathResolution(true)

      if (travel) {
        // Un viaje resuelto síncronamente (banda corta) ya cambió currentLocationId en el
        // backend — resincronizamos posición/destinos en vez de intentar reconstruirlo a mano
        // aquí. Best-effort: si esta resincronización falla, el próximo turno o refresco de
        // panel ya trae la posición al día — no hay error puntual que mostrar por un viaje que,
        // mecánicamente, ya se resolvió bien en el backend.
        getSave(saveId)
          .then((save) => {
            setCurrentLocation(save.currentLocation)
            setDestinations(save.destinations)
          })
          .catch(() => {})
      }

      // Calculado fuera del updater (ver comentario igual en handleCombatTurnResolved) — evita que
      // la doble invocación de StrictMode en dev deduplique la entidad contra sí misma.
      // Hallazgo 38 — `discoveredLocationSlug` fuerza el banner de la Location con prioridad
      // absoluta sobre cualquier mención del texto (ej. un NPC presente en la llegada).
      const entityBanner = buildEntityBanner(
        narration.narration,
        logEntryId,
        discoveredLocationSlug ? { entityType: 'location', entitySlug: discoveredLocationSlug } : undefined,
      )
      setCharacterLog((prev) => {
        // P167 (QA-27): la oferta pacífica que había queda respondida con este turno: su tarjeta pierde
        // los botones (como al alejarse andando, `onOfertaDescartada`).
        const previas = ofertaDescartada ? prev.map((e) => (e.dynamicModeOffer && !e.dynamicModeOffer.combateForzado ? { ...e, dynamicModeOffer: undefined } : e)) : prev
        const next = [
          ...previas,
          {
            id: logEntryId,
            channel: 'character' as const,
            text: narration.narration,
            timeLabel: newTimeLabel,
            // P56 (QA-27): si el turno abrió un combate con intercambio real, la tirada que cuenta es
            // ese intercambio; la tirada simple de la acción («TÚ … → Fallo») contradecía al lado.
            // Igual que se ve tras recargar (el diario pinta el intercambio en lugar de la tirada).
            roll: combatExchangeDisplay ? undefined : roll,
            combatExchange: combatExchangeDisplay ?? undefined,
            createdAt: new Date().toISOString(),
            xpDelta: progression.xpDelta > 0 ? progression.xpDelta : undefined,
            // UX 2026-09-01 (ver comentario del mismo campo en types.ts § LogEntry) — separa el
            // chip de hito/capítulo del de XP normal en vez de sumarlos en un único "+N XP".
            xpHitoDelta: progression.xpHito && progression.xpHito > 0 ? progression.xpHito : undefined,
            xpHitoLabel: progression.xpHitoLabel ?? undefined,
            entityBanner,
            newQuest: newQuestInfo ?? undefined,
            questOffer: newQuestOfferInfo ?? undefined,
            npcInteractionOffer: npcInteractionOffer ?? undefined,
            dynamicModeOffer: dynamicModeOffer ?? undefined,
            factionRepChange: factionRepChange ?? undefined,
            // Feedback de UX (2026-09-04, misma petición que factionRepChange de arriba) — solo
            // el primer elemento: hoy nunca hay más de un oficio ganando XP en el mismo turno.
            professionXpGain: professionXpGains[0] ?? undefined,
          },
        ]
        // P55 (QA-27), P117/QA-70: lo que sigue a la narración, en el orden en que lo guardó el backend
        // (subida de nivel, desbloqueos, los demás ataques del combate de grupo, golpes gratis, brújula).
        for (const extra of intercambiosExtra ?? []) {
          next.push({
            id: extra.logEntryId,
            channel: 'character' as const,
            text: extra.text,
            timeLabel: newTimeLabel,
            createdAt: new Date().toISOString(),
            combate: extra.combate ?? true,
            combatExchange: extra.combatExchange,
            isLevelUp: extra.esSubidaDeNivel,
          })
        }
        // Misión completada (2026-08-13) — ver el mismo bloque en handleCombatTurnResolved: fila
        // real aparte, nunca fusionada con la narración principal.
        if (questCompletedInfo) next.push(questCompletedLogEntry(questCompletedInfo, newTimeLabel))
        return next
      })
      // Bug real (auditoría de deuda técnica 2026-08-04, mismo patrón que companionCreated):
      // `narration.newItem` (name+description sueltos del LLM) se añadía aquí con un id
      // inventado en el cliente (`item-${Date.now()}`) que el backend no reconoce — equipar ese
      // objeto fallaba con 404 hasta la siguiente recarga completa. El backend ahora también
      // empuja este objeto a `newInventoryItems` (igual que saqueo/despiece/crafteo), que ya se
      // procesa arriba con el id REAL — este bloque aparte sobra y solo podía desincronizar.
      // Bug real (2026-08-04, tope de slots de compañero): `narration.newCompanion` es solo lo
      // que el modelo PROPUSO — el backend puede rechazarlo en silencio por falta de hueco.
      // `companionCreated` es lo que de verdad se persistió, null si se rechazó.
      if (companionCreated) {
        setCompanions((prev) => [...prev, companionCreated])
      }
      if (newKingdomFounded) {
        setKingdomFoundedInfo(newKingdomFounded)
      }
      setXp(progression.newXp)
      // La línea «sube a nivel» llega del backend en `intercambiosExtra`, en su sitio (P117/QA-70).
      if (progression.leveledUp) {
        setLevel(progression.newLevel)
        setPendingAttributePoints((prev) => prev + progression.attributePointsGained)
      }
    } catch (err) {
      if (isEndedGameError(err)) {
        setEndedAt(err.endedAt)
        setCharacterLog((prev) => prev.slice(0, -1))
      } else if (isPendingDeathError(err)) {
        // Turno mandado mientras había una muerte sin resolver que el estado local todavía no
        // reflejaba (p. ej. otra pestaña, o un refresco a medias) — el backend ya lo bloqueó,
        // aquí solo sincronizamos el flag para que el botón aparezca sin más acción del jugador.
        setPendingDeathResolution(true)
        setCharacterLog((prev) => prev.slice(0, -1))
      } else if (isBusyError(err)) {
        setBusyUntil(err.busyUntil)
        setBusyActivity(err.activity)
        setBusyDuracionMinutos(err.duracionMinutos ?? null)
        setCharacterLog((prev) => prev.slice(0, -1))
      } else if (isTurnLockedError(err)) {
        // Candado de turno (auditoría de código completa, 2026-08-07) — a diferencia del resto de
        // errores de aquí abajo, este turno se rechazó de raíz, nunca llegó a narrar: NO hay nada
        // resolviéndose en segundo plano que valga la pena sondear (por eso NO cae al sondeo de
        // reconexión de más abajo, que esperaría minutos un resultado que nunca va a llegar).
        setCharacterLog((prev) => [
          ...prev.slice(0, -1),
          {
            id: `turn-locked-${Date.now()}`,
            channel: 'character',
            text: 'Todavía se está resolviendo tu turno anterior — espera un momento e inténtalo de nuevo.',
            timeLabel: fictionalDate,
            createdAt: new Date().toISOString(),
          },
        ])
      } else {
        // Sondeo de reconexión (2026-07-23) — ver src/hooks/useReconnectionPolling.ts para la
        // lógica completa (intervalos, tope de intentos, mensajes de fallback).
        setTimedThinkingText('Esperando confirmación del narrador...')
        // El sondeo espera acción + narración (+2); sin acción en el diario (emboscada, P90), solo la narración.
        await pollForResolution({ saveId, logLengthBeforeThisTurn: logLengthBeforeThisTurn - (accionEnDiario === null ? 1 : 0), fictionalDate, syncFromSave, setCharacterLog })
      }
      setDiceReveal(null)
    } finally {
      turnoEnCursoRef.current = false
      setCharacterThinking(false)
      setTimedThinkingText(null)
      setStreamingNarration(null)
    }
  }

  return { handleSubmit }
}
