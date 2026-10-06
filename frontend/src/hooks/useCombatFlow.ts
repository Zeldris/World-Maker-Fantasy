import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { CombatNpcDisplay } from '../components/CombatComposer'
import { requestTurnClassify, requestTurnNarrate, requestFlee, requestHuirEnCurso, requestCerrarCombate, requestMatar, postCapturar, dejarVivir, type EnciclopediaResponse } from '../lib/api'
import { isTurnLockedError, npcInSceneToCombatDisplay, combatKeyFor, combatDisplayNameFor, applyInventoryDelta, questCompletedLogEntry } from '../lib/gameViewHelpers'
import { combatDifficultyFor, type CombatDifficulty } from '../lib/combatDifficulty'
import { cancelarTirada, duracionTirada, temporizadorTirada } from '../lib/duracionTirada'
import type {
  ActiveEffect,
  CombatExchangeInfo,
  CondicionFisica,
  EntornoTemporalInfo,
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
  /// Fase 2 de efectos de clase (2026-08-27, indicador de combate) — mismo criterio que
  /// `setCondicionFisica`: GameView.tsx sigue siendo el dueño del estado (también lo escribe
  /// `syncFromSave`/`handleSubmit`), este hook solo lo actualiza en los turnos resueltos DENTRO
  /// del popup ya abierto.
  setPlayerActiveEffects: Dispatch<SetStateAction<ActiveEffect[]>>
  /// Estación/clima (2026-08-27) — mismo criterio que `setFictionalDate`.
  setEntorno: Dispatch<SetStateAction<EntornoTemporalInfo | null>>
  setEnergia: Dispatch<SetStateAction<number>>
  setEnergiaMax: Dispatch<SetStateAction<number>>
  /// Habilidad "Comer/Beber" (2026-09-04) — mismo criterio que setEnergia/setEnergiaMax.
  setHambre: Dispatch<SetStateAction<number>>
  setSed: Dispatch<SetStateAction<number>>
  setFictionalDate: Dispatch<SetStateAction<string>>
  setEndedAt: Dispatch<SetStateAction<string | null>>
  setDiceReveal: Dispatch<SetStateAction<{ exchange: CombatExchangeInfo; npcName: string | null } | null>>
  /// Desollar pasiva (2026-08-25) — un turno DENTRO del popup de combate (mismo `CombatEncounter`
  /// ya abierto, a diferencia del primer turno que lo abre, ver GameView.tsx) también puede ser el
  /// que lo resuelve del todo, con caídos reales que desollar. C.2 (checklist frontend 2026-08-27)
  /// — este hook solo necesita marcar "sí hay" (nunca sincroniza contra la escena), así que recibe
  /// el helper con nombre en vez del setter crudo (`useActionModalsState.ts § markCarcassPending`).
  markCarcassPending: () => void
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
    setPlayerActiveEffects,
    setEntorno,
    setEnergia,
    setEnergiaMax,
    setHambre,
    setSed,
    setFictionalDate,
    setEndedAt,
    setDiceReveal,
    markCarcassPending,
  } = params

  const [combatOpen, setCombatOpen] = useState(false)
  const [fleeingPreCombat, setFleeingPreCombat] = useState(false)
  const [combatNpcStates, setCombatNpcStates] = useState<CombatNpcDisplay[]>([])
  const [combatBusy, setCombatBusy] = useState(false)
  const [combatEnded, setCombatEnded] = useState(false)
  // Bug real jugando en vivo (2026-08-27, "he perdido un combate...me sale victoria"): un respawn
  // sobrevivible deja `condicionFisica` de vuelta en ILESO (ver comentario de la línea de
  // `justDied` más abajo), así que CombatPanel.tsx no tenía ninguna señal propia para distinguir
  // "morí y respawneé" de "gané limpio" — la única pista real era `justDied` de este mismo turno,
  // que se usaba solo para decidir `combatEnded` y nunca se propagaba más allá.
  const [combatPlayerJustDied, setCombatPlayerJustDied] = useState(false)
  const [combatAwaitingDefense, setCombatAwaitingDefense] = useState(false)
  // Bug real jugando en vivo (2026-09-06, "todo debe estar bloqueado" mientras rueda la iniciativa):
  // `combatBusy` volvía a `false` en cuanto la respuesta del turno llegaba, sin esperar a que la
  // animación de `DiceRollVs` (2 × ROLL_DURATION_MS) terminara — dejaba el composer y los botones de
  // habilidad operables durante esos ~10s. `true` desde que se programa el `setTimeout` de abajo
  // hasta que `applyTurnAwaitingDefense` corre de verdad.
  const [awaitingNextInitiative, setAwaitingNextInitiative] = useState(false)
  // Bug real jugando en vivo (2026-09-07, "asegúrate de que vida/energía se ejecutan DESPUÉS de la
  // tirada de combate, no antes"): mismo patrón EXACTO que `awaitingNextInitiative`/
  // `applyTurnAwaitingDefense` de más abajo, pero para la animación del INTERCAMBIO (`DiceRollReveal`,
  // LogPanel.tsx) — sin esto, `handleCombatTurnResolved` aplicaba condición/energía/vida del rival
  // de golpe en cuanto respondía el backend, mientras los dados del golpe todavía podían seguir
  // rodando en pantalla varios segundos más (la narración en streaming a veces termina de generarse
  // ANTES de que la animación fija de `ROLL_DURATION_MS`×2 acabe). `setTimeout` fijo (no un callback
  // `onAllLanded` del componente real, a diferencia de un primer intento descartado) — así no
  // depende de que `DiceRollReveal` esté de verdad montado/visible en ese instante, mismo criterio
  // de robustez que ya usa la iniciativa.
  const [awaitingExchangeApply, setAwaitingExchangeApply] = useState(false)
  // Bug real jugando en vivo (2026-09-07, auditoría de deuda técnica): ninguno de los dos
  // `setTimeout` de más abajo (intercambio/iniciativa) se cancelaba nunca — si la jugadora cerraba
  // el combate, encadenaba un segundo intercambio rápido, o huía con éxito dentro de esos 10s, el
  // timer del turno ANTERIOR seguía vivo y pisaba el estado real con su valor ya obsoleto al
  // disparar. Los ids se guardan en un ref (no en estado — no deben disparar re-render por sí
  // mismos) y se cancelan explícitamente antes de programar uno nuevo y al cerrar el combate.
  const exchangeApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const awaitingDefenseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Bug real jugando en vivo (2026-09-20, "la vida no se actualiza al mostrar el resultado, sino
  // según acaba la SIGUIENTE tirada de iniciativa") — el `setTimeout(2 * ROLL_DURATION_MS)` de más
  // abajo ya estaba calibrado bien respecto a la animación (dos dados secuenciales, 10s reales),
  // pero 10s completos sin ningún feedback de vida tras leer la narración (que sí aparece de
  // inmediato) se percibe como que el update "llega tarde". Fix: en vez de duplicar el cálculo de
  // tiempo con un número mágico, se usa el callback REAL `onAllLanded` que `DiceRollVs` (DiceRoll.tsx)
  // ya dispara en el instante exacto en que el segundo dado aterriza — mismo dato, una sola fuente
  // de verdad. La closure de cada turno se guarda en un ref porque `DiceRollReveal` vive fuera de
  // este hook (LogPanel.tsx, montado por GameView.tsx) y solo puede invocar una función ESTABLE.
  const applyExchangeResultRef = useRef<(() => void) | null>(null)
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
        (n) => combatNpcStates.find((s) => combatKeyFor(s) === combatKeyFor(n)) ?? npcInSceneToCombatDisplay(n),
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
  // la muerte del PROPIO personaje — nunca cuando el enemigo quedaba derrotado.
  //
  // CONVALECIENTE deja de significar "victoria automática" (petición explícita, 2026-08-26): antes
  // bastaba con dejar a un enemigo CONVALECIENTE para que el combate se diera por terminado — ni
  // siquiera hacía falta decidir qué hacer con él. Ahora un CONVALECIENTE SOLO cuenta como
  // resuelto si de verdad muere (`condicion === 'MUERTO'`, un intercambio real tras "Matar" — ver
  // `targetedForKill` más abajo) o si la jugadora eligió "Capturar"/"Clemente" (`dismissed: true`,
  // ver los handlers de más abajo — su `condicion` se queda CONVALECIENTE tal cual). Con un solo
  // enemigo, esto deja el panel de combate ACTIVO hasta que la jugadora responda desde la tarjeta
  // del log (LogPanel.tsx § convalecienteOffers, que además bloquea el composer — ver
  // `combatHasPendingConvalecientes` más abajo), en vez de saltar directa al resumen de victoria.
  useEffect(() => {
    if (!combatOpen || combatEnded || combatNpcsDisplay.length === 0) return
    const allResolved = combatNpcsDisplay.every((n) => n.condicion === 'MUERTO' || n.dismissed)
    if (allResolved) setCombatEnded(true)
  }, [combatOpen, combatEnded, combatNpcsDisplay])

  // Bloqueo del composer (2026-08-26, petición explícita: "se bloquea todo hasta responder la
  // tarjeta o tarjetas de los enemigos convalecientes") — mientras quede al menos un CONVALECIENTE
  // sin decisión tomada (ni "Matar" pulsado, ni "Capturar"/"Clemente"), no se puede seguir actuando
  // (ni texto libre ni Actuar). `targetedForKill` (2026-08-30) cuenta como decisión tomada — pulsar
  // "Matar" desbloquea el panel para que el jugador ataque de verdad, aunque el NPC siga
  // CONVALECIENTE hasta que el golpe real lo remate.
  const combatHasPendingConvalecientes = combatNpcsDisplay.some((n) => n.condicion === 'CONVALECIENTE' && !n.dismissed && !n.targetedForKill)

  // `combatOverride` (bug real, auditoría de bugs 2026-08-21): "Cazar" resolviendo una presa
  // débil SIN combate (`handleHuntResolved`, GameView.tsx) hace `setCombateIniciado(result.combate)`
  // y llama a `openCombat()` en la misma sincronía — sin este parámetro, la función leía
  // `combateIniciado` del cierre de ESTE render (el `setState` de la línea anterior todavía no se
  // había aplicado), que en ese flujo es siempre `null`. `openCombat` devolvía sin hacer nada.
  function openCombat(combatOverride?: { npcs: NpcInSceneInfo[] } | null) {
    const combate = combatOverride ?? combateIniciado
    if (!combate) return
    setCombatNpcStates(combate.npcs.map(npcInSceneToCombatDisplay))
    setCombatEnded(false)
    setCombatPlayerJustDied(false)
    setCombatSelectedNpcSlug(combate.npcs[0] ? combatKeyFor(combate.npcs[0]) : null)
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
    opts: { savedActionId?: string; lootItemNames?: string[]; allowAfterEnded?: boolean; isItemUse?: boolean; energyCost?: number },
  ): Promise<boolean> {
    // Bug real jugando en vivo (2026-07-31): Registrar/Decapitar/Saquear son las acciones que la
    // pantalla de combate YA terminado ofrece — sin `allowAfterEnded`, esas llamadas nunca
    // llegaban ni a hacer la petición.
    if (!action.trim() || combatBusy || (combatEnded && !opts.allowAfterEnded) || !saveId) return false
    setCombatBusy(true)
    // Bug real (2026-07-29, "no veo el cuadro rojo del narrador generando el texto" en combate):
    // combatBusy solo bloquea los botones de CombatPanel — nunca activaba `characterThinking`.
    setCharacterThinking(true)
    // Bug real jugando en vivo (2026-09-07, "la energía que gastas se tiene que restar cuando
    // eliges una habilidad, nada más le das a Actuar") — descuento OPTIMISTA en el instante de
    // enviar, antes de esperar la respuesta del servidor: el coste ya es conocido de antemano (la
    // ficha de la habilidad, no algo que dependa del resultado del intercambio). `handleCombatTurnResolved`
    // sustituye este valor por el real del servidor en cuanto la respuesta llega, sin retraso —
    // mismo criterio que el resto de esta función (nunca se queda "adelantado" para siempre).
    if (opts.energyCost) {
      setEnergia((prev) => Math.max(0, prev - opts.energyCost!))
    }
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
        activeEffects,
        entorno,
        energia,
        energiaMax,
        hambre,
        sed,
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
        newQuestOfferInfo,
        questCompletedInfo,
        factionRepChange,
        professionXpGains,
        esperandoDefensaJugador,
        npcAbilityUsed,
        playerAbilityUsed,
        combatExchangeDisplay,
        nextInitiativeRoll,
        deathCount: updatedDeathCount,
        factionsStatus: updatedFactionsStatus,
        professionProgress: updatedProfessionProgress,
        combatEncounterLootSummary,
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
      // Desollar pasiva (2026-08-25) — ver mismo comentario en GameView.tsx.
      // CR-49: solo la fauna se despelleja; a las personas caídas se las saquea.
      if (combatEncounterLootSummary?.some((c) => !c.esPersona)) markCarcassPending()
      handleCombatTurnResolved({
        narration: narration.narration,
        progression,
        condicionFisica,
        activeEffects,
        entorno,
        energia,
        energiaMax,
        hambre,
        sed,
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
        newQuestOfferInfo,
        questCompletedInfo,
        factionRepChange,
        professionXpGains,
      })
      // Bug real (2026-07-29, "si muero no hace lo que fijamos que haría"): `condicionFisica` ya
      // llega resuelta a ILESO tras un respawn sobrevivible (nunca MUERTO) — sin `justDied` este
      // chequeo nunca se cumplía salvo fin de partida.
      if (finDePartida || justDied) setCombatEnded(true)
      // Bug real jugando en vivo (2026-08-27, "he perdido un combate...me sale victoria") — ver
      // comentario de `combatPlayerJustDied` más arriba: única señal real de que el jugador murió
      // y respawneó DENTRO de este combate, ya que `condicionFisica` vuelve a ILESO tras respawnear.
      if (justDied) setCombatPlayerJustDied(true)
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
      setDiceReveal(null)
      return false
    } finally {
      setCombatBusy(false)
      setCharacterThinking(false)
    }
  }

  // Huir DENTRO de combate con riesgo real (ronda de correcciones 2026-08-28, P3.2). Antes,
  // `handleCombatHuir` mandaba el intento como texto libre por `submitCombatAction`, que lo
  // resolvía con el motor de intercambio normal — un ataque/defensa disfrazado, indistinguible de
  // "Defenderse". Ahora usa el endpoint dedicado `combat/huir-en-curso` (misma tirada determinista
  // que `handleFleeAttempt` pre-combate): si falla, aplica un golpe directo real sin tirada de
  // defensa, reflejado tanto en `condicionFisica` como en la narración.
  async function handleCombatHuir() {
    if (!saveId || combatBusy) return
    setCombatBusy(true)
    try {
      const { escaped, text, condicionFisica: newCondicion, roll } = await requestHuirEnCurso(saveId)
      setCharacterLog((prev) => [
        ...prev,
        { id: `huir-${Date.now()}`, channel: 'character', text, timeLabel: fictionalDate, createdAt: new Date().toISOString(), combate: true, roll },
      ])
      setCondicionFisica(newCondicion as CondicionFisica)
      if (escaped) {
        setCombatOpen(false)
        setCombateIniciado(null)
        setCombatAwaitingDefense(false)
      }
      // Si falla, el popup se queda abierto con el combate en curso — el golpe ya aplicado se ve
      // reflejado en el estado de condición física, sin necesidad de cerrar ni reabrir nada.
    } catch (err) {
      // Bug real jugando en vivo (2026-08-28): pulsar "Huir" estando CONVALECIENTE devuelve 409
      // ("resuelve tu propia condición primero") del guard nuevo del backend, pero este catch lo
      // tragaba en silencio — el botón parecía no hacer nada, sin ningún aviso de qué pasó.
      setCharacterLog((prev) => [
        ...prev,
        {
          id: `huir-err-${Date.now()}`,
          channel: 'character',
          text: err instanceof Error ? err.message : 'No se pudo intentar huir.',
          timeLabel: fictionalDate,
          createdAt: new Date().toISOString(),
          combate: true,
        },
      ])
    } finally {
      setCombatBusy(false)
    }
  }

  async function handleCombatRegistrar(npc: CombatNpcDisplay) {
    const key = combatKeyFor(npc)
    setCombatNpcStates((prev) => prev.map((n) => (combatKeyFor(n) === key ? { ...n, yaSaqueado: true } : n)))
    // Comillas alrededor del nombre (bug real, auditoría 2026-07-28): igual que handleAttack ya
    // hace para que el backend resuelva `explicitTarget` — sin ellas, el saqueo podía alcanzar a
    // cualquier otro NPC derrotado en escena, no solo al pulsado aquí. Identificador de
    // combatientes duplicados (2026-08-27) — `combatDisplayNameFor` cita "Buitre #2" cuando hace
    // falta desambiguar.
    const ok = await submitCombatAction(`Registro el cuerpo de '${combatDisplayNameFor(npc)}'.`, { allowAfterEnded: true })
    // Rollback (bug real, auditoría 2026-07-28): si el turno falla, el saqueo optimista de arriba
    // dejaba al NPC marcado como saqueado en la UI para siempre.
    if (!ok) {
      setCombatNpcStates((prev) => prev.map((n) => (combatKeyFor(n) === key ? { ...n, yaSaqueado: false } : n)))
    }
  }

  // Botón "Decapitar"/"Matar" (petición explícita, 2026-07-30, REDISEÑADO 2026-08-30) — golpe de
  // gracia contra un enemigo CONVALECIENTE. Antes era determinista sin tirada (remate garantizado);
  // petición explícita de la usuaria tras confirmarse que ese diseño era antiguo y ya no encajaba
  // ("matar tiene que abrir el combate de nuevo, no resolverse"): ahora se resuelve como un ataque
  // Rediseño de "Matar" (2026-08-30, ver tarkor_rediseno_matar_combate_real_2026-08-30 — el intento
  // anterior seguía ejecutando un ataque automático (Ataque Básico) en cuanto se pulsaba el botón,
  // sin dejar elegir nada, contradiciendo la intención real del rediseño: "debe abrir el combate de
  // nuevo, no resolverse solo"). Pulsar "Matar" ya NO dispara ningún turno — solo marca
  // `targetedForKill: true`, lo que desbloquea el panel/composer (`combatHasPendingConvalecientes`)
  // y oculta la tarjeta persistente del log para ese NPC (LogPanel.tsx). El jugador ataca después
  // con el panel de combate NORMAL — habilidad elegida o texto libre citando al NPC entre comillas
  // simples (`explicitTarget`, backend), exactamente igual que contra cualquier otro rival — con
  // riesgo real de tirada (el CONVALECIENTE ya lleva el malus más alto de la tabla,
  // `CONDICION_MALUS`, -10, death.ts). El NPC sigue CONVALECIENTE hasta que un intercambio real lo
  // mate; el cierre del combate sigue siendo responsabilidad única del `useEffect` de `combatEnded`
  // de arriba (MUERTO o `dismissed`).
  // Bug real jugando en vivo (2026-09-04/05): `targetedForKill` solo se marcaba en `combatNpcStates`
  // (React), sin llamar a ningún endpoint — recargar la página perdía la decisión, la tarjeta
  // MATAR/CLEMENTE reaparecía de cero y el composer volvía a bloquearse. Ahora se persiste en el
  // backend (`NpcState.targetedForKill`, `POST /saves/:id/combat/matar/:npcSlug`) — el estado
  // optimista local sigue igual para respuesta inmediata sin esperar la red. Solo combate 1v1
  // clásico por ahora (sin `participantId`) — combate múltiple sigue usando solo el estado local.
  function handleDecapitarSeleccion(npcs: CombatNpcDisplay[]) {
    if (npcs.length === 0) return
    setCombatNpcStates((prev) => {
      const next = [...prev]
      for (const npc of npcs) {
        const idx = next.findIndex((s) => combatKeyFor(s) === combatKeyFor(npc))
        if (idx >= 0) next[idx] = { ...next[idx], targetedForKill: true }
        else next.push({ ...npc, targetedForKill: true })
      }
      return next
    })
    if (saveId) {
      for (const npc of npcs) {
        if (!npc.participantId) requestMatar(saveId, npc.slug).catch(() => {})
      }
    }
  }

  // Botón "Capturar" (2026-08-26, CONVALECIENTE deja de ser "victoria automática") — reutiliza
  // `postCapturar` (ya existía para atar fuera de combate, `CapturaModal.tsx`), determinista, sin
  // pasar por el turno narrado. `condicion` NO cambia (se queda CONVALECIENTE de verdad, mismo
  // criterio que "Clemente" — la captura real solo se confirma después, tameo/persuasión aparte);
  // `dismissed: true` lo saca de "pendiente de resolver" para `combatEnded`.
  async function handleCapturarSeleccion(npc: CombatNpcDisplay) {
    try {
      const { logEntry, factionRepChange, misionesPendientes } = await postCapturar(saveId!, npc.slug, npc.participantId)
      // Identificador de combatientes duplicados (mismo criterio que el resto de este archivo,
      // `combatKeyFor` — bug real 2026-08-29: filtrar por `slug` a secas marcaba `dismissed` en
      // TODOS los individuos del mismo tipo a la vez con 2+ del mismo grupo).
      //
      // Bug real jugando en vivo (2026-09-03, verificación con Playwright): resolver desde la
      // tarjeta persistente del log SIN haber abierto el panel de combate antes deja
      // `combatNpcStates` en `[]` (`openCombat()`, único sitio que lo siembra, nunca se ejecutó) —
      // el `.map()` de aquí no crea nada nuevo si el `participantId` no existe todavía en el
      // array, así que `dismissed` nunca se aplicaba y la tarjeta seguía apareciendo pese a que el
      // backend ya había marcado `dismissedGrupo` correctamente. Mismo patrón `Map` que ya usa
      // `handleCombatTurnResolved` más abajo: añade la entrada si no existe, en vez de solo
      // intentar transformar una que puede no estar ahí.
      setCombatNpcStates((prev) => {
        const key = combatKeyFor(npc)
        if (prev.some((n) => combatKeyFor(n) === key)) {
          return prev.map((n) => (combatKeyFor(n) === key ? { ...n, dismissed: true } : n))
        }
        return [...prev, { ...npc, dismissed: true }]
      })
      // Reputación de facción (2026-09-04) — Capturar ganó su propio LogEntry determinista en esta
      // pieza (antes era una mutación silenciosa), mismo patrón que Clemente justo abajo.
      // Aviso de misión pendiente (2026-09-15, hallazgo real jugando en vivo: "Acabar con X" seguía
      // ACTIVA sin ningún aviso tras capturarlo vivo) — se añade al mismo LogEntry en vez de crear
      // una tarjeta aparte, mismo criterio que el resto del proyecto ("el LogEntry cuenta la
      // historia completa de lo que pasó este turno").
      const textoConAviso =
        misionesPendientes.length > 0
          ? `${logEntry.text} (${misionesPendientes.join(', ')} sigue${misionesPendientes.length > 1 ? 'n' : ''} activa${misionesPendientes.length > 1 ? 's' : ''} — el objetivo sigue vivo.)`
          : logEntry.text
      setCharacterLog((prev) => [
        ...prev,
        { id: logEntry.id, channel: 'character', text: textoConAviso, timeLabel: logEntry.timeLabel, createdAt: logEntry.createdAt, combate: true, factionRepChange: factionRepChange ?? undefined },
      ])
    } catch (err) {
      // Nada que deshacer (el estado optimista nunca llegó a aplicarse), pero el motivo del
      // backend («Necesitas cuerdas…», «No tienes hueco…») se enseña: antes se tragaba y el botón
      // parecía no hacer nada (Fase G del 0.1, hallazgo G5).
      avisarErrorEnLog('capturar-err', err, 'No se pudo atar.')
    }
  }

  /// Motivo de un fallo de acción determinista de combate, como entrada del diario (mismo criterio
  /// que `handleCombatHuir`).
  function avisarErrorEnLog(prefijo: string, err: unknown, porDefecto: string) {
    setCharacterLog((prev) => [
      ...prev,
      {
        id: `${prefijo}-${Date.now()}`,
        channel: 'character',
        text: err instanceof Error && err.message ? err.message : porDefecto,
        timeLabel: fictionalDate,
        createdAt: new Date().toISOString(),
        combate: true,
      },
    ])
  }

  // Botón "Clemente" (2026-08-26, antes "Dejarlo vivir") — saca al NPC de
  // `pendingCombatNpcSlugs` en el backend (deja de ser objetivo activo) sin tocar su
  // `condicionFisica`; añade la narración determinista real que devuelve el backend, mismo patrón
  // que `handleFleeAttempt`.
  async function handleDejarVivirSeleccion(npc: CombatNpcDisplay) {
    try {
      const { logEntry, factionRepChange, misionesPendientes } = await dejarVivir(saveId!, npc.slug, npc.participantId)
      // Mismo criterio que `handleCapturarSeleccion` de arriba — `combatKeyFor`, no `slug` a secas,
      // y siembra la entrada si `combatNpcStates` todavía no la tiene (ver comentario largo arriba).
      setCombatNpcStates((prev) => {
        const key = combatKeyFor(npc)
        if (prev.some((n) => combatKeyFor(n) === key)) {
          return prev.map((n) => (combatKeyFor(n) === key ? { ...n, dismissed: true } : n))
        }
        return [...prev, { ...npc, dismissed: true }]
      })
      // Aviso de misión pendiente (2026-09-15) — mismo criterio que `handleCapturarSeleccion`.
      const textoConAviso =
        misionesPendientes.length > 0
          ? `${logEntry.text} (${misionesPendientes.join(', ')} sigue${misionesPendientes.length > 1 ? 'n' : ''} activa${misionesPendientes.length > 1 ? 's' : ''} — el objetivo sigue vivo.)`
          : logEntry.text
      setCharacterLog((prev) => [
        ...prev,
        { id: logEntry.id, channel: 'character', text: textoConAviso, timeLabel: logEntry.timeLabel, createdAt: logEntry.createdAt, combate: true, factionRepChange: factionRepChange ?? undefined },
      ])
    } catch (err) {
      avisarErrorEnLog('clemente-err', err, 'No se pudo dejarlo ir.')
    }
  }

  // Resumen de combate (petición explícita, 2026-07-30) — recibe los NOMBRES de objetos YA
  // confirmados desde el modal de selección. UN solo prompt mencionando a cada enemigo por su
  // nombre real, SIN comillas.
  //
  // Saqueo parcial (2026-07-31): a diferencia de Decapitar/Salir, saquear NUNCA cierra el combate
  // por su cuenta — `quedaAlgoPorSaquear` (CombatPanel.tsx) reacciona solo al estado real de
  // `yaSaqueado` de cada NPC.
  //
  // Bug real (2026-08-28, "saqueo puede mostrar 'saqueado' en UI sin persistir nada"): el estado
  // optimista de abajo se aplicaba SIN esperar a `submitCombatAction`, sin NINGÚN camino de
  // reversión — un turno huérfano/fallido dejaba la UI mintiendo "Muerto · saqueado" para siempre
  // mientras el backend nunca recibió los objetos. Fix: guardar el estado previo antes de mutar,
  // revertirlo si `submitCombatAction` devuelve `false`.
  async function handleSaquearSeleccion(itemNames: string[], fullyLootedSlugs: string[], itemNamesByNpc: Record<string, string[]>) {
    const porSaquear = combatNpcsDisplay.filter((n) => (n.condicion === 'CONVALECIENTE' || n.condicion === 'MUERTO') && !n.yaSaqueado)
    if (porSaquear.length === 0) return
    const previousStates = new Map(porSaquear.map((n) => [combatKeyFor(n), { yaSaqueado: n.yaSaqueado, lootedItemNames: n.lootedItemNames }]))
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
    const ok = await submitCombatAction(`Registro los cuerpos de los enemigos derrotados en este combate: ${nombres}.`, { lootItemNames: itemNames, allowAfterEnded: true })
    if (!ok) {
      setCombatNpcStates((prev) =>
        prev.map((n) => {
          const previous = previousStates.get(combatKeyFor(n))
          return previous ? { ...n, ...previous } : n
        }),
      )
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
      submitCombatAction(selectedAbility.promptText, { savedActionId: selectedAbility.id, energyCost: selectedAbility.energyCost })
      resetCombatSelection()
      return
    }
    const selectedNpc = combatNpcsDisplay.find((n) => combatKeyFor(n) === combatSelectedNpcSlug) ?? null
    // Bug real jugando en vivo (2026-08-26): el objetivo se pegaba pelado al final del promptText
    // ("...con el arma que llevo en la mano principal 'Orco enfurecido'."), leyéndose como si el
    // arma se llamara igual que el enemigo — ningún promptText de weaponAbilities.ts está escrito
    // para terminar con un nombre propio detrás. "contra" antes del nombre lo deja legible pase lo
    // que pase cómo termine la frase de la habilidad (ataque o defensa).
    const base = selectedAbility.promptText.trim().replace(/\.+$/, '')
    // Identificador de combatientes duplicados (2026-08-27, bug real jugando: "ataqué a los dos
    // buitres a la vez") — cita "Buitre #2" cuando hace falta desambiguar, mismo sufijo que el
    // backend acepta al interpretar el texto (`turnResolution.ts`, `esperandoEleccionJugadora`).
    const action = selectedNpc ? `${base}, contra '${combatDisplayNameFor(selectedNpc)}'.` : selectedAbility.promptText
    submitCombatAction(action, { savedActionId: selectedAbility.id, energyCost: selectedAbility.energyCost })
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
    activeEffects: ActiveEffect[]
    entorno: EntornoTemporalInfo
    energia: number
    energiaMax: number
    hambre: number
    sed: number
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
    newQuestOfferInfo?: { title: string; description: string } | null
    questCompletedInfo?: { logEntryId: string; text: string; title: string; grantedItems: string[]; rewardXp: number } | null
    factionRepChange?: { faction: string; delta: number; newValue: number } | null
    professionXpGains?: { oficio: string; xpDelta: number; newLevel: number; leveledUp: boolean }[]
  }) {
    // `buildEntityBanner` se calcula FUERA del updater (bug real, 2026-07-24): StrictMode invoca
    // dos veces en dev cualquier función pasada a `setState`, y `buildEntityBanner` muta un ref
    // como efecto secundario — la primera invocación (de prueba, descartada) marcaba la entidad
    // como "ya mostrada", así que la segunda la encontraba deduplicada.
    const entityBanner = buildEntityBanner(params.narration, params.logEntryId)
    // CONVALECIENTE deja de ser "victoria automática" (2026-08-26) — quién pasa a CONVALECIENTE
    // por PRIMERA vez este intercambio (comparado contra el estado local de ANTES de este turno,
    // no contra el de la respuesta): un NPC que ya estaba CONVALECIENTE de un turno anterior no
    // vuelve a ofrecer tarjeta.
    const newlyConvalecientes = (params.combate?.npcs ?? [])
      .filter((n) => n.condicionFisica === 'CONVALECIENTE' && combatNpcsDisplay.find((d) => combatKeyFor(d) === combatKeyFor(n))?.condicion !== 'CONVALECIENTE')
      .map((n) => ({ npcSlug: n.slug, combatKey: combatKeyFor(n), npcName: n.name, capturable: n.capturable }))
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
          questOffer: params.newQuestOfferInfo ?? undefined,
          convalecienteOffers: newlyConvalecientes.length > 0 ? newlyConvalecientes : undefined,
          factionRepChange: params.factionRepChange ?? undefined,
          professionXpGain: params.professionXpGains?.[0] ?? undefined,
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
    setEntorno(params.entorno)
    setFictionalDate(params.timeLabel)
    // La iniciativa del turno SIGUIENTE ya no se fija aquí: ver `arrancarSiguienteIniciativa` más
    // abajo — arranca cuando el intercambio de este turno ya se aplicó.
    // Bug real jugando en vivo (2026-09-07, "la energía que gastas se tiene que restar cuando
    // eliges una habilidad, nada más le das a Actuar") — a diferencia de vida/condición (que SÍ
    // reflejan el resultado de un golpe y deben esperar a que se vea, más abajo), la energía es el
    // COSTE de haber elegido la habilidad, ya conocido de antemano — `submitCombatAction` ya la
    // descuenta de forma optimista en el cliente en el instante de pulsar Actuar (antes de que
    // exista siquiera esta respuesta). El valor real del servidor manda siempre en cuanto llega
    // (nunca se queda "adelantado" indefinidamente si el cálculo real difiere del estimado), pero
    // eso ocurre AQUÍ, no retrasado con el resto del intercambio — la energía no es algo que el
    // jugador vea "rodar" en la animación de dados.
    setEnergia(params.energia)
    setEnergiaMax(params.energiaMax)
    // Bug real jugando en vivo (2026-09-07, "asegúrate de que vida/energía se ejecutan DESPUÉS de
    // la tirada de combate, no antes"): condición/hambre/sed del jugador y la vida/condición
    // del rival (`combatNpcStates`) reflejan directamente el golpe que ACABA de resolverse en este
    // intercambio — si `params.combatExchangeDisplay` existe, `DiceRollReveal` todavía puede seguir
    // animando ese golpe en pantalla (`ROLL_DURATION_MS`×2, mismo criterio que la iniciativa un poco
    // más abajo), así que aplicar el resultado real de inmediato podía adelantarse a lo que el
    // jugador todavía está viendo rodar. Sin intercambio que animar (golpe gratis, invocación,
    // Aturdimiento) no hay nada que esperar — se aplica igual que siempre, de inmediato.
    const applyExchangeResult = () => {
      setCondicionFisica(params.condicionFisica)
      setPlayerActiveEffects(params.activeEffects)
      setHambre(params.hambre)
      setSed(params.sed)
      // Bug real (auditoría 2026-07-28), sin cambios de fondo: esta función (la que resuelve CADA
      // turno mientras el combate ya está abierto) nunca aplicaba el `combateIniciado` de la
      // respuesta — un NPC nuevo añadido a media pelea quedaba invisible en CombatComposer.
      if (params.combate && params.combate.npcs.length > 0) {
        setCombateIniciado(params.combate)
        setCombatNpcStates((prev) => {
          // Identificador de combatientes duplicados (2026-08-27, bug real jugando: "ataqué a los
          // dos buitres a la vez") — `combatKeyFor` (participantId cuando existe, slug si no) en vez
          // de `slug` puro: dos combatientes del mismo Npc de catálogo ya no colapsan al mismo estado.
          const bySlug = new Map(prev.map((n) => [combatKeyFor(n), n]))
          for (const n of params.combate!.npcs) {
            const real: CombatNpcDisplay = npcInSceneToCombatDisplay(n)
            const key = combatKeyFor(n)
            const local = bySlug.get(key)
            if (!local) {
              bySlug.set(key, real)
              continue
            }
            // El backend manda: solo se sustituye el estado local si el real ha avanzado más (nunca
            // "resucita" a alguien que el propio jugador ya vio caer más allá).
            const avanza = CONDICION_ORDER.indexOf(real.condicion) > CONDICION_ORDER.indexOf(local.condicion)
            if (avanza || (real.huido && !local.huido) || (real.yaSaqueado && !local.yaSaqueado) || (real.analizado && !local.analizado)) {
              bySlug.set(key, real)
            } else if (real.lootedItemNames.length > local.lootedItemNames.length) {
              // Saqueo parcial (2026-07-31): `lootedItemNames` solo crece, aunque `condicion`/
              // `yaSaqueado` no hayan cambiado este turno.
              bySlug.set(key, { ...local, lootedItemNames: n.lootedItemNames, activeEffects: real.activeEffects })
            } else {
              // Fase 2 de efectos de clase (2026-08-27) — a diferencia de `lootedItemNames`
              // (solo crece), un `activeEffects` puede tanto ganar un efecto nuevo como perder uno
              // que acaba de expirar en el MISMO turno — el backend manda siempre, sin comparar
              // longitudes, aunque ninguna otra condición de arriba haya cambiado.
              bySlug.set(key, { ...local, activeEffects: real.activeEffects })
            }
            // CR-45: la orden del capitán cambia cada ronda; manda siempre la del backend.
            const actual = bySlug.get(key)!
            if (actual.ordenaCaerSobre !== real.ordenaCaerSobre) bySlug.set(key, { ...actual, ordenaCaerSobre: real.ordenaCaerSobre })
          }
          return Array.from(bySlug.values())
        })
      }
    }
    // `finDePartida` manda siempre (mismo criterio que `applyTurnAwaitingDefense` más abajo): si el
    // combate termina de verdad este turno, no tiene sentido retrasar la condición final del
    // jugador tras un cierre que ya lo resolvió todo.
    // Cancela cualquier timer/callback de un intercambio ANTERIOR todavía pendiente — sin esto, dos
    // intercambios rápidos seguidos (o cerrar el combate en medio del retraso) dejaban vivo el
    // resuelve-luego viejo, que pisaba el estado ya actualizado por el turno nuevo cuando por fin
    // disparaba.
    cancelarTirada(exchangeApplyTimerRef.current)
    applyExchangeResultRef.current = null
    // Estado visual "de quién es el turno" (2026-09-04, bug real jugando en vivo: "el panel según
    // es turno de ataque o defensa está cambiando antes de color de lo que la tirada tarda en
    // ejecutarse... debería aparecer cuando acaba la tirada, no antes") — con una tirada de
    // iniciativa real que mostrar, este campo espera a que termine de rodar; sin tirada
    // (`nextInitiativeRoll` null, p.ej. Aturdimiento) se aplica de inmediato.
    const applyTurnAwaitingDefense = () => {
      awaitingDefenseTimerRef.current = null
      setCombatAwaitingDefense(params.esperandoDefensaJugador)
      setAwaitingNextInitiative(false)
    }
    // Mismo motivo que `exchangeApplyTimerRef` — cancela el timer de un turno ANTERIOR todavía
    // pendiente antes de programar el de este turno.
    cancelarTirada(awaitingDefenseTimerRef.current)
    // Bug real jugando en vivo (2026-09-29, tercera vez: "la vida no se actualiza cuando termina la
    // tirada de combate, lo hace al final de la tirada de iniciativa") — la causa de fondo era que
    // las DOS animaciones arrancaban a la vez al llegar la respuesta: los dados del intercambio
    // (LogPanel) y los de la iniciativa del turno siguiente (CombatPanel), ambas de
    // `2 × ROLL_DURATION_MS`. La vida sí se aplicaba al acabar la del intercambio, pero como la de
    // iniciativa acababa casi en el mismo instante, se veía como si esperase a la iniciativa. Ahora
    // van en secuencia: dados del golpe → vida/condición aplicadas → tirada de iniciativa.
    const arrancarSiguienteIniciativa = () => {
      setLastInitiativeRoll(params.nextInitiativeRoll)
      if (params.nextInitiativeRoll && !params.finDePartida) {
        awaitingDefenseTimerRef.current = temporizadorTirada(applyTurnAwaitingDefense, 2 * duracionTirada())
      } else {
        applyTurnAwaitingDefense()
      }
    }
    // Bloquea composer/botones desde ya si hay iniciativa por delante, aunque todavía no haya
    // empezado a rodar (primero va el intercambio).
    if (params.nextInitiativeRoll && !params.finDePartida) setAwaitingNextInitiative(true)
    if (params.combatExchangeDisplay && !params.finDePartida) {
      setAwaitingExchangeApply(true)
      const resolverIntercambio = () => {
        exchangeApplyTimerRef.current = null
        applyExchangeResultRef.current = null
        applyExchangeResult()
        setAwaitingExchangeApply(false)
        // `DiceRollReveal` (LogPanel.tsx) ya terminó de animarse en este instante — deja de hacer
        // falta seguir ocupando la tarjeta de "pensando" con él.
        setDiceReveal(null)
        arrancarSiguienteIniciativa()
      }
      // Fuente primaria: el callback `onAllLanded` real (ver comentario junto a la declaración del
      // ref, arriba), invocado por LogPanel.tsx en cuanto DiceRollVs termina de animar de verdad.
      applyExchangeResultRef.current = resolverIntercambio
      // Fallback de seguridad con margen extra — si por lo que sea `DiceRollReveal` nunca llega a
      // montarse/disparar (p.ej. la tarjeta de "pensando" se cierra por otra vía primero), el
      // intercambio no debe quedar aplicado para siempre: se resuelve solo, algo más tarde que la
      // animación real para no adelantarse a ella en el caso normal.
      exchangeApplyTimerRef.current = temporizadorTirada(resolverIntercambio, 2 * duracionTirada() + 1000)
    } else {
      applyExchangeResult()
      setDiceReveal(null)
      arrancarSiguienteIniciativa()
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
      const { escaped, text, roll } = await requestFlee(saveId)
      setCharacterLog((prev) => [
        ...prev,
        { id: `flee-${Date.now()}`, channel: 'character', text, timeLabel: fictionalDate, createdAt: new Date().toISOString(), roll },
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
  // Bug real (2026-09-04/05): esto solo limpiaba el estado LOCAL de React — `Save.pendingCombatNpcSlugs`
  // seguía sucio en el backend, así que la siguiente recarga reconstruía `combateIniciado` desde
  // ahí y dejaba el composer bloqueado para siempre (`GameView.tsx`, `composerDisabled`). Ahora se
  // avisa al backend (`POST /saves/:id/combat/cerrar`) para que lo vacíe de verdad — fire-and-
  // forget, sin bloquear el cierre visual: si el servidor responde 409 (de verdad queda algo
  // pendiente, p.ej. un CONVALECIENTE sin resolver que el cliente no debería haber dejado cerrar),
  // el aviso de combate simplemente reaparecerá en la próxima resincronización, que es exactamente
  // el comportamiento correcto en ese caso — mejor que dejar el botón "Salir" bloqueado esperando.
  function closeCombat() {
    // Cierre real de combate — cualquier timer/callback de intercambio/iniciativa que siga vivo de
    // un turno ya obsoleto no debe disparar después (ver comentario junto a los refs, arriba).
    cancelarTirada(exchangeApplyTimerRef.current)
    cancelarTirada(awaitingDefenseTimerRef.current)
    exchangeApplyTimerRef.current = null
    applyExchangeResultRef.current = null
    awaitingDefenseTimerRef.current = null
    setCombatOpen(false)
    setCombateIniciado(null)
    setCombatAwaitingDefense(false)
    if (saveId) requestCerrarCombate(saveId).catch(() => {})
  }

  /// Invocado por `DiceRollReveal` (vía LogPanel.tsx → `onDiceRevealAllLanded`) en el instante
  /// exacto en que el segundo dado del intercambio termina de aterrizar — referencia ESTABLE
  /// (nunca cambia entre renders) porque la closure real vive en `applyExchangeResultRef`.
  function triggerExchangeApply() {
    applyExchangeResultRef.current?.()
  }

  return {
    combatOpen,
    combatNpcsDisplay,
    combatDifficulty,
    combatBusy,
    awaitingNextInitiative,
    /// Bloquea composer/botones mientras `DiceRollReveal` del intercambio todavía anima (mismo
    /// criterio que `awaitingNextInitiative` para la iniciativa) — sin esto, el jugador podía
    /// mandar otro ataque antes de que el resultado del anterior terminara de mostrarse.
    awaitingExchangeApply,
    triggerExchangeApply,
    combatEnded,
    combatPlayerJustDied,
    combatHasPendingConvalecientes,
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
    handleCapturarSeleccion,
    handleDejarVivirSeleccion,
    handleCombatHuir,
    handleSaquearSeleccion,
    handleCombatFreeSubmit,
  }
}
