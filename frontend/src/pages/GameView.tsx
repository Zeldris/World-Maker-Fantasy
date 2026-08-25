import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSession } from '../context/useSession'
import { LogPanel } from '../components/LogPanel'
import { CollapsedRail } from '../components/CollapsedRail'
import { ChatComposer, type ChatComposerHandle } from '../components/ChatComposer'
import { SuggestionBar } from '../components/SuggestionBar'
import { SideNav } from '../components/SideNav'
import { characterTabs, worldTabs, type PanelId } from '../components/NavTabs'
import { PanelDrawer } from '../components/PanelDrawer'
import { MapaPanel } from '../components/panels/MapaPanel'
import { DiarioPanel } from '../components/panels/DiarioPanel'
import { ZonaPanel } from '../components/panels/ZonaPanel'
import { InventarioPanel } from '../components/panels/InventarioPanel'
import { EnciclopediaPanel } from '../components/panels/EnciclopediaPanel'
import { SLOT_LABEL, isCompatibleWithSlot, isConsumibleSlot } from '../lib/equipSlots'
import { PersonajePanel, type PersonajeSubTab } from '../components/panels/PersonajePanel'
import { DetailModal, type DetailTarget } from '../components/DetailModal'
import { useEnciclopedia } from '../hooks/useEnciclopedia'
import { useEntityBanner } from '../hooks/useEntityBanner'
import { useReconnectionPolling } from '../hooks/useReconnectionPolling'
import { useSurroundingsPolling } from '../hooks/useSurroundingsPolling'
import { useRecipesData } from '../hooks/useRecipesData'
import { useCombatFlow } from '../hooks/useCombatFlow'
import { useTransitPolling } from '../hooks/useTransitPolling'
import type { EnciclopediaLinkTarget } from '../lib/enciclopediaIndex'
import { EnciclopediaLinkProvider } from '../context/EnciclopediaLinkContext'
import { CompanerosPanel } from '../components/panels/CompanerosPanel'
import { ReinoPanel } from '../components/panels/ReinoPanel'
import { MisionesPanel } from '../components/panels/MisionesPanel'
import { HabilidadesPanel } from '../components/panels/HabilidadesPanel'
import { playerActionEntry } from '../lib/simulateAI'
import { CombatComposer } from '../components/CombatComposer'
import { CombatPanel } from '../components/CombatPanel'
import { HealthBar } from '../components/HealthBar'
import { EnergyBar } from '../components/EnergyBar'
import { KingdomFoundingModal } from '../components/KingdomFoundingModal'
import { HarvestSelectionModal } from '../components/HarvestSelectionModal'
import { REINO_ABILITY_RECIPE_KEY } from '../data/reinoRecipes'
import { PostCombatInteractionModal } from '../components/PostCombatInteractionModal'
import { HuntSelectionModal } from '../components/HuntSelectionModal'
import { CampSelectionModal } from '../components/CampSelectionModal'
import { TravelDestinationModal } from '../components/TravelDestinationModal'
import { SaquearZonaModal } from '../components/SaquearZonaModal'
import { HealSelectionModal } from '../components/HealSelectionModal'
import { inventoryCapacityFor, totalInventoryUnits } from '../lib/inventoryCapacity'
import {
  requestTurnClassify,
  requestTurnNarrate,
  createSave,
  getSave,
  pauseSave,
  resumeSave,
  spendAttributePoint,
  createSavedAction,
  deleteSavedAction,
  updateSavedAction,
  fundarReino,
  setItemSlot,
  requestSuggestions,
  getRecolectarLocalizado,
  type SaveDetail,
  type ClassifyResponse,
} from '../lib/api'
import { characterWaitingFlavor, combatWaitingFlavor, worldWaitingFlavor, useRotatingFlavor } from '../lib/waitingFlavor'
import {
  isBusyError,
  isEndedGameError,
  isTurnLockedError,
  formatCountdown,
  formatFictionalDuration,
  applyInventoryDelta,
  questCompletedLogEntry,
} from '../lib/gameViewHelpers'
import type {
  AlmacenItemInfo,
  Attribute,
  AttributeBlock,
  BuildingInfo,
  CombatExchangeInfo,
  CompanionInfo,
  CondicionFisica,
  CurrentLocationInfo,
  DestinationInfo,
  Dificultad,
  EquipSlot,
  InitiativeRollInfo,
  InventoryItemInfo,
  KingdomFoundedInfo,
  KingdomStatsInfo,
  LogEntry,
  NpcInSceneInfo,
  PlantillaEquipoInfo,
  PostCombatInteractionInfo,
  ProfessionProgressInfo,
  QuestInfo,
  SavedActionCategory,
  SavedActionInfo,
  SecondaryAttributeBlock,
  SessionSummaryInfo,
  SubjectInfo,
  TerritoryInfo,
} from '../types'

/// Combina los adjuntos del composer con el texto libre en una única acción (docs/14-combate-y-muerte.md
/// § 3: "composición verbo + objetivo"). Una habilidad (verbo) emparejada con un NPC o un hallazgo
/// (objetivo) en la misma tanda se combina como "{promptText} '{nombre del objetivo}'." — los
/// prompts de habilidad ya están en primera persona con el enemigo implícito ("mi enemigo"), así
/// que añadir el nombre entre comillas al final desambigua el objetivo sin reescribir cada prompt.
/// Un hallazgo sin habilidad asociada se recoge con cantidad explícita; un objeto de inventario
/// mantiene la mención simple de siempre.
// Espejo de limiteMuertes() en backend/src/services/death.ts — NOVATO no tiene límite, así que
// no aparece aquí (el indicador de muerte permanente solo se muestra para MEDIO/AVANZADO).
const LIMITE_MUERTES: Record<Exclude<Dificultad, 'NOVATO'>, number> = { MEDIO: 4, AVANZADO: 2 }

export function GameView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { selectedWorld, selectedCharacter, selectedDificultad } = useSession()

  const [saveId, setSaveId] = useState<string | null>(null)
  const [worldIdSlug, setWorldIdSlug] = useState<string | null>(null)
  const [worldName, setWorldName] = useState<string | null>(null)
  const [characterName, setCharacterName] = useState<string | null>(null)
  const [characterMotivation, setCharacterMotivation] = useState<string | null>(null)
  // Bug real (auditoría de elementos desconectados, 2026-08-23): el backend ya mandaba estos dos
  // campos en CADA carga de partida (SaveDetail), pero `syncFromSave` los tiraba sin más — solo se
  // usaban al CREAR el personaje, nunca se volvían a mostrar durante la partida ya en marcha.
  const [characterArchetype, setCharacterArchetype] = useState<string | null>(null)
  const [characterOrigin, setCharacterOrigin] = useState<string | null>(null)
  const [characterAttributes, setCharacterAttributes] = useState<AttributeBlock | null>(null)
  // Bonus de equipo por atributo, aparte de la base (2026-08-14) — solo cambia al equipar/quitar
  // (syncFromSave), nunca al gastar puntos de atributo ni al resolver un turno, así que no hace
  // falta tocarlo en esos otros sitios donde se actualiza characterAttributes.
  const [characterAttributeBonuses, setCharacterAttributeBonuses] = useState<Partial<AttributeBlock>>({})
  const [secondaryAttributes, setSecondaryAttributes] = useState<SecondaryAttributeBlock | null>(null)
  const [characterLog, setCharacterLog] = useState<LogEntry[]>([])
  const [worldLog, setWorldLog] = useState<LogEntry[]>([])
  // Log de Reino (2026-08-17) — canal aparte, alternable con el de mundo, nunca los dos a la vez.
  const [kingdomLog, setKingdomLog] = useState<LogEntry[]>([])
  const [worldLogView, setWorldLogView] = useState<'world' | 'kingdom'>('world')
  // Animación de dados en paralelo (petición explícita, 2026-08-15) — el intercambio de combate ya
  // resuelto (dos tiradas + desenlace) llega ANTES que el texto de narración (ver
  // TurnNarrateHandlers.onExchangeResolved, api.ts); null en cuanto el turno termina de resolverse
  // del todo (éxito o error), para que nunca sobreviva al siguiente turno sin intercambio.
  const [diceReveal, setDiceReveal] = useState<{ exchange: CombatExchangeInfo; npcName: string | null } | null>(null)
  // Sugerencias de próxima acción bajo demanda (petición explícita, 2026-08-15) — llamada aparte
  // disparada por el botón "Sugerir" (ChatComposer.tsx), no dentro del turno normal (ver
  // comentario de cabecera de `generateSuggestions`, backend narrador.ts); [] = barra oculta.
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [inventory, setInventory] = useState<InventoryItemInfo[]>([])
  // Pop-up de recolección (rediseño de profesiones, 2026-08-07) — null = cerrado.
  const [harvestModal, setHarvestModal] = useState<{ oficio: string; label: string } | null>(null)
  // Desollar pasa a pasiva (2026-08-25, petición explícita: "la habilidad de desollar debe pasar
  // a pasiva") — ya no es un botón en Habilidades, aparece solo cuando hay cadáveres reales
  // pendientes (narrativos o los que deja un CombatEncounter resuelto), reutilizando el mismo GET
  // que antes solo pedía el botón (`carcassCandidatesFor`, backend). null = todavía sin comprobar
  // esta escena; false/true = ya se comprobó.
  const [carcassPending, setCarcassPending] = useState<boolean | null>(null)
  const [huntModalOpen, setHuntModalOpen] = useState(false)
  // Paneles nuevos (2026-08-17, comentarios de startingAbilities.ts): "Volver al campamento",
  // "Viajar", "Saquear" y "Curar" — mismo patrón que huntModalOpen. "Volver al campamento"/"Viajar"
  // comparten el mismo `onSelect`/`onCancel` de un único texto de acción (ver
  // `handleSimpleModalSelect` más abajo), así que se colapsan en un único estado (auditoría de
  // deuda técnica 2026-08-18, antes 3 booleanos casi idénticos) — "Saquear" y "Curar" se quedan
  // aparte, cada uno con su propio estado: sus confirmaciones mandan algo más que el texto
  // (`lootItemNames`/`healItemUses`), una forma distinta de verdad (mismo motivo por el que
  // "Curar" salió del trío el 2026-08-18, rediseño de varios objetos/usos a la vez).
  const [simpleModal, setSimpleModal] = useState<'camp' | 'travel' | null>(null)
  const [saquearZonaModalOpen, setSaquearZonaModalOpen] = useState(false)
  const [healModalOpen, setHealModalOpen] = useState(false)
  // Interacción con un NPC/fauna ya convaleciente o muerto, fuera de combate (docs/19-post-combate-
  // y-recompensas-mision.md pieza 2) — null = cerrado. `/turn/classify` lo detecta y corta el
  // turno antes de narrar; este panel deja Saquear/Decapitar/Salir sin gastar generación.
  const [postCombatTarget, setPostCombatTarget] = useState<PostCombatInteractionInfo | null>(null)
  const [companions, setCompanions] = useState<CompanionInfo[]>([])
  const [level, setLevel] = useState(1)
  const [xp, setXp] = useState(0)
  const [pendingAttributePoints, setPendingAttributePoints] = useState(0)
  const [kingdomName, setKingdomName] = useState<string | null>(null)
  // Popup de fundación de reino (2026-08-04) — se abre solo al construir el Ayuntamiento tier 1.
  const [kingdomFoundedInfo, setKingdomFoundedInfo] = useState<KingdomFoundedInfo | null>(null)
  const [territories, setTerritories] = useState<TerritoryInfo[]>([])
  const [buildings, setBuildings] = useState<BuildingInfo[]>([])
  const [subjects, setSubjects] = useState<SubjectInfo[]>([])
  // Grupo 3 § Compañeros y supervivencia (2026-08-25) — Almacén de Reino + Plantillas de equipo.
  const [almacenItems, setAlmacenItems] = useState<AlmacenItemInfo[]>([])
  const [plantillasEquipo, setPlantillasEquipo] = useState<PlantillaEquipoInfo[]>([])
  const [factionsStatus, setFactionsStatus] = useState<Record<string, number>>({})
  const [kingdomStats, setKingdomStats] = useState<KingdomStatsInfo | null>(null)
  const [professionProgress, setProfessionProgress] = useState<ProfessionProgressInfo[]>([])
  const [deathCount, setDeathCount] = useState(0)
  const [dificultad, setDificultad] = useState<Dificultad>('NOVATO')
  const [savedActions, setSavedActions] = useState<SavedActionInfo[]>([])
  const [combatSlots, setCombatSlots] = useState(3)
  const [fictionalDate, setFictionalDate] = useState('Día 1, mañana')
  const [currentLocation, setCurrentLocation] = useState<CurrentLocationInfo | null>(null)
  // Roster estático de recetas de oficio + estado real de cada receta EN ESTA PARTIDA — ver
  // src/hooks/useRecipesData.ts para la lógica completa (por qué dos fetches independientes, de
  // qué depende cada uno).
  const { professionRecipes, recipesStatus } = useRecipesData(saveId, inventory, characterAttributes, currentLocation)
  const [destinations, setDestinations] = useState<DestinationInfo[]>([])
  // Desollar pasiva (2026-08-25) — se comprueba al entrar a una escena nueva, best-effort (mismo
  // criterio que la resincronización de viaje más abajo: si falla, el próximo cambio de ubicación
  // o turno ya lo vuelve a intentar, no hay error puntual que mostrar por esto).
  useEffect(() => {
    if (!saveId || !currentLocation) return
    let cancelled = false
    getRecolectarLocalizado(saveId, 'desollador')
      .then(({ sources }) => {
        if (!cancelled) setCarcassPending(sources.length > 0)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [saveId, currentLocation])
  const [input, setInput] = useState('')
  const composerRef = useRef<ChatComposerHandle>(null)
  const [characterThinking, setCharacterThinking] = useState(false)
  const [timedThinkingText, setTimedThinkingText] = useState<string | null>(null)
  // Streaming (roadmap de velocidad, 2026-07-20, punto 13): la narración crece en vivo mientras
  // el Narrador la genera, en vez de aparecer entera al final — null mientras dura el prefill
  // (el modelo todavía no ha emitido ningún token de "narration") o si no hay turno en curso.
  const [streamingNarration, setStreamingNarration] = useState<string | null>(null)
  const [busyUntil, setBusyUntil] = useState<string | null>(null)
  const [busyActivity, setBusyActivity] = useState<string | null>(null)
  const [busyDuracionMinutos, setBusyDuracionMinutos] = useState<number | null>(null)
  const [activePanel, setActivePanel] = useState<PanelId | null>(null)
  // Colapsar logs (2026-08-14, petición explícita: "que pueda colapsar el log de personaje a la
  // izquierda y que el de mundo ocupe todo... y al revés... lo mismo con las de combate") — un
  // solo estado tri-valuado en vez de dos booleanos independientes, para que nunca puedan quedar
  // los dos colapsados a la vez (no habría nada que ver).
  const [collapsedSide, setCollapsedSide] = useState<'character' | 'world' | null>(null)
  const [personajeSubTab, setPersonajeSubTab] = useState<PersonajeSubTab>('equipo')
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null)
  // Solo se usa para el detalle de la Enciclopedia (kind: 'info') — guarda el callback concreto
  // de "insertar este elemento" para esa entrada, ver handleEnciclopediaDetail.
  const [detailInsertHandler, setDetailInsertHandler] = useState<(() => void) | null>(null)
  // Texto clicable en narración/diario/descripciones (2026-07-22, petición explícita) — un solo
  // índice construido una vez, reutilizado por LogPanel/DiarioPanel/DetailModal. Clicar una
  // mención simplemente reemplaza `detailTarget` (mismo estado de siempre), no abre nada nuevo.
  const {
    index: enciclopediaIndex,
    raw: enciclopediaData,
    loading: enciclopediaLoading,
    refetch: refetchEnciclopedia,
  } = useEnciclopedia(worldIdSlug, saveId, recipesStatus)
  // Bug real (2026-08-14, "todo eso no está saliendo en la enciclopedia" — objetos recolectados de
  // verdad descubiertos en BD, ver `recordEntityDiscoveries` en el backend, pero invisibles en la
  // UI): tras el dedupe de doble fetch del 2026-08-13, la Enciclopedia se pedía UNA sola vez al
  // montar la partida y nunca más. En vez de enganchar un refetch en cada sitio que puede descubrir
  // algo (recolectar, cazar, crafteo, narración normal — demasiados, fácil dejarse uno), se
  // refresca aquí, al abrir la propia pestaña: garantiza datos frescos justo cuando de verdad se
  // van a ver, sin repetir la petición mientras el panel sigue cerrado.
  useEffect(() => {
    if (activePanel === 'enciclopedia') refetchEnciclopedia()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel])
  // Banner de elemento citado bajo la narración (petición explícita de la usuaria, 2026-07-24) —
  // ver src/hooks/useEntityBanner.ts para la lógica completa (ventana de "no repetir", reconstrucción
  // de banners persistidos al cargar la Enciclopedia).
  const { buildEntityBanner } = useEntityBanner(saveId, enciclopediaIndex, setCharacterLog, setWorldLog)
  const [notFound, setNotFound] = useState(false)
  const [condicionFisica, setCondicionFisica] = useState<CondicionFisica>('ILESO')
  // Sistema de fatiga (2026-07-29) — mismo patrón que condicionFisica: se sincroniza al cargar la
  // partida y se actualiza con cada respuesta de turno.
  const [energia, setEnergia] = useState(100)
  const [energiaMax, setEnergiaMax] = useState(100)
  // Hambre/Sed (Grupo 3 § Compañeros y supervivencia, 2026-08-25) — a diferencia de condicionFisica/
  // energia, no viaja en la respuesta de turno (avanzan solas en el worldTick de fondo, no con
  // cada acción) — se resincroniza cada vez que se recarga la partida (loadSave), igual que el
  // resto del estado "lento" (kingdomStats, subjects...).
  const [hambre, setHambre] = useState(100)
  const [sed, setSed] = useState(100)
  const [endedAt, setEndedAt] = useState<string | null>(null)
  const [combateIniciado, setCombateIniciado] = useState<{ npcs: NpcInSceneInfo[] } | null>(null)
  // Rediseño del turno de combate (2026-07-29, "quiero que sea más claro cuando es turno de
  // ataque... indicándome qué salió en los dados") — tirada real de iniciativa del último turno
  // resuelto, para que CombatPanel explique CON NÚMEROS por qué le toca atacar/defender ahora.
  // Escrita también por `syncFromSave` (al recargar), así que se queda aquí y no en useCombatFlow.
  const [lastInitiativeRoll, setLastInitiativeRoll] = useState<InitiativeRollInfo | null>(null)

  // Tabs que no tienen sentido en pleno combate (petición explícita, 2026-07-24) — Estadísticas,
  // Equipo, Habilidades y Enciclopedia se dejan libres a propósito ("no fuerces nada, ya lo
  // gestionaremos con un tutorial futuro"): solo se restringe lo que de verdad no se puede hacer
  // en mitad de una pelea (viajar, gestionar el Reino, leer el diario...).
  // 'profesiones' ya no es un PanelId de nivel superior (vive como sub-pestaña dentro de
  // PersonajePanel, que recibe `combatOpen` y deshabilita esa sub-pestaña por su cuenta).
  const COMBAT_DISABLED_CHARACTER_TABS: PanelId[] = ['inventario', 'companeros', 'reino']
  const COMBAT_DISABLED_WORLD_TABS: PanelId[] = ['mapa', 'zona', 'diario', 'misiones']

  const [quests, setQuests] = useState<QuestInfo[]>([])
  const [chapters, setChapters] = useState<SessionSummaryInfo[]>([])

  // Bloque de combate (deuda técnica 2026-08-21) — ver src/hooks/useCombatFlow.ts para la lógica
  // completa. `combateIniciado`/`lastInitiativeRoll` siguen viviendo aquí (los escribe también
  // `syncFromSave`/`handleSubmit`/`handleHuntResolved`, fuera del combate en sí); todo lo demás
  // (combatOpen, selección de NPC/habilidad/objeto, texto libre, huida previa...) es interno al
  // hook.
  const combat = useCombatFlow({
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
    combatDisabledTabs: [...COMBAT_DISABLED_CHARACTER_TABS, ...COMBAT_DISABLED_WORLD_TABS],
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
    setCarcassPending,
  })

  // Pop del botón "Nivel X" solo en una subida real, nunca al cargar la partida (roadmap de
  // animaciones 2026-07-20, item 7) — mismo patrón que HealthBar: comparar contra un ref, no
  // animar en el primer render.
  const [levelPop, setLevelPop] = useState(0)
  const prevLevelRef = useRef(level)
  useEffect(() => {
    if (prevLevelRef.current !== level) {
      setLevelPop((p) => p + 1)
      prevLevelRef.current = level
    }
  }, [level])

  // Mismo patrón que el pop de nivel — el chip de muertes solo destella cuando sube de verdad.
  const [deathPop, setDeathPop] = useState(0)
  const prevDeathCountRef = useRef(deathCount)
  useEffect(() => {
    if (prevDeathCountRef.current !== deathCount) {
      setDeathPop((p) => p + 1)
      prevDeathCountRef.current = deathCount
    }
  }, [deathCount])

  // Sondeo de ambientación cada 10 min reales — ver src/hooks/useSurroundingsPolling.ts para la
  // lógica completa (por qué usa refs internos, por qué se corta durante un turno/combate en
  // curso; mismo patrón que useReconnectionPolling/useEntityBanner).
  const { worldThinking } = useSurroundingsPolling({
    saveId,
    characterThinking,
    combatActive: !!combateIniciado,
    fictionalDate,
    buildEntityBanner,
    setWorldLog,
  })

  const characterFlavor = useRotatingFlavor(characterThinking, combat.combatOpen ? combatWaitingFlavor : characterWaitingFlavor)
  const worldFlavor = useRotatingFlavor(worldThinking, worldWaitingFlavor)

  // Sondeo de reconexión tras un turno que no confirmó a tiempo — ver
  // src/hooks/useReconnectionPolling.ts para la lógica completa (intervalos, tope de intentos,
  // limpieza al desmontar).
  const { pollForResolution } = useReconnectionPolling()

  // Solapar classify con el tecleo (roadmap de velocidad, 2026-07-19): tras ~1,5s sin tocar el
  // composer, se lanza ya la clasificación en segundo plano con `preview:true` — no persiste nada
  // (backend, ver classifyCache.ts), solo precalienta la caché del servidor con este texto exacto.
  // Si el jugador envía lo mismo antes de que caduque, el envío real (más abajo) se beneficia solo
  // con que el backend encuentre la caché — el frontend no necesita rastrear ni reutilizar la
  // respuesta cruda del preview (evita el riesgo de perder "discoveries"/"transit" del envío real).
  useEffect(() => {
    const action = input.trim()
    const composerDisabled = characterThinking || !!busyUntil || !!endedAt || (!!combateIniciado && !combat.combatOpen)
    if (!action || !saveId || composerDisabled) return

    const timer = setTimeout(() => {
      requestTurnClassify({ saveId, action, preview: true }).catch(() => {})
    }, 1500)

    return () => clearTimeout(timer)
  }, [input, saveId, characterThinking, busyUntil, endedAt, combateIniciado, combat.combatOpen])

  // Vuelca un SaveDetail completo en el estado local — usado al cargar la partida y al
  // resincronizar tras resolverse una acción por tiempo en diferido (CharacterTransit).
  function syncFromSave(save: SaveDetail) {
    setCharacterName(save.characterName)
    setCharacterMotivation(save.characterMotivation)
    setCharacterArchetype(save.characterArchetype)
    setCharacterOrigin(save.characterOrigin)
    setCharacterAttributes(save.attributes)
    setCharacterAttributeBonuses(save.attributeBonuses)
    setSecondaryAttributes(save.secondaryAttributes)
    setFictionalDate(save.fictionalDateLabel)
    setCharacterLog(save.characterLog)
    setWorldLog(save.worldLog)
    setKingdomLog(save.kingdomLog)
    setInventory(save.inventory)
    setCompanions(save.companions)
    setLevel(save.level)
    setXp(save.xp)
    setPendingAttributePoints(save.pendingAttributePoints)
    setKingdomName(save.kingdomName)
    setTerritories(save.territories)
    setBuildings(save.buildings)
    setSubjects(save.subjects)
    setAlmacenItems(save.almacenItems)
    setPlantillasEquipo(save.plantillasEquipo)
    setFactionsStatus(save.factionsStatus)
    setKingdomStats(save.kingdomStats)
    setProfessionProgress(save.professionProgress)
    setBusyUntil(save.transit?.busyUntil ?? null)
    setBusyActivity(save.transit?.activity ?? null)
    setBusyDuracionMinutos(save.transit?.duracionMinutos ?? null)
    setSavedActions(save.savedActions)
    setCombatSlots(save.habilidadSlots)
    setCurrentLocation(save.currentLocation)
    setDestinations(save.destinations)
    setCondicionFisica(save.condicionFisica)
    setEnergia(save.energia)
    setEnergiaMax(save.energiaMax)
    setHambre(save.hambre)
    setSed(save.sed)
    setDeathCount(save.deathCount)
    setDificultad(save.dificultad)
    setEndedAt(save.endedAt)
    setQuests(save.quests)
    setChapters(save.chapters)
    // Bug real (2026-07-23, "revisar partida"): antes `combateIniciado` solo se fijaba con la
    // respuesta directa de `/turn/narrate` — cualquier resincronización (sondeo de reconexión,
    // recarga de página) perdía el aviso de combate aunque el backend lo hubiera calculado bien.
    if (save.combateIniciado && save.combateIniciado.npcs.length > 0) {
      setCombateIniciado(save.combateIniciado)
      // Bug real (2026-08-21, jugando en vivo: "al recargar la página se está perdiendo el mensaje
      // de la iniciativa y la tirada de los dados") — mismo criterio que `combatExchange`/
      // `npcAbilityUsed` (LogPanel): `lastInitiativeRoll` solo vivía en memoria del turno recién
      // jugado (`handleCombatTurnResolved`), nunca se rehidrataba al recargar. El último LogEntry
      // con `initiativeRoll` persistido (ver InitiativeRollInfo, types.ts) es la misma fuente de
      // verdad que ya usa el backend para decidir quién actúa en el próximo intercambio.
      const lastInitiativeEntry = [...save.characterLog].reverse().find((e) => e.initiativeRoll)
      setLastInitiativeRoll(lastInitiativeEntry?.initiativeRoll ?? null)
    }
  }

  // Grupo 3 § Compañeros y supervivencia (2026-08-25) — resincroniza la partida entera tras una
  // mutación que crea un Companion (confirmar tameo/persuasión), mismo patrón ya usado al equipar
  // (ver comentario de `handleSlotClick`).
  async function refreshSave() {
    if (!saveId) return
    const save = await getSave(saveId)
    syncFromSave(save)
  }

  async function handleFundarReino(name: string, description?: string) {
    if (!saveId) return
    const result = await fundarReino(saveId, name, description)
    setKingdomName(result.kingdomName)
    setKingdomFoundedInfo(null)
  }

  // Bug real (auditoría de deuda técnica 2026-08-04): cancelar el popup de fundación (o recargar
  // la página mientras seguía abierto) perdía la única oportunidad de nombrar el reino para
  // siempre — `newKingdomFounded` solo llega una vez, al construir el Ayuntamiento tier 1 desde
  // cero. Reconstruye el mismo popup a partir de lo que ya hay persistido (Building+Territory) en
  // vez de depender de aquella notificación puntual. El outcome ya se decidió de verdad al
  // construir (Territory.control) — aquí solo se aproxima el texto informativo, la fundación en sí
  // no se repite.
  function handleReabrirFundacionReino() {
    const ayuntamiento = buildings.find((b) => b.recipeKey === 'ayuntamiento')
    if (!ayuntamiento) return
    const territory = territories.find((t) => t.id === ayuntamiento.territoryId)
    setKingdomFoundedInfo({
      title: ayuntamiento.name,
      region: territory?.region ?? '',
      outcome: territory?.control === 'DISPUTADO' ? 'CONFLICTO' : 'CONQUISTADA',
      suggestedName: characterName === 'Gorhorn' ? 'Maktor' : null,
      nameLocked: characterName === 'Gorhorn',
    })
  }

  async function handleCreateHabilidad(params: {
    name: string
    promptText: string
    icon: string
    description: string
    category: SavedActionCategory
  }) {
    if (!saveId) return
    const created = await createSavedAction(saveId, params)
    setSavedActions((prev) => [...prev, created])
  }

  async function handleDeleteHabilidad(habilidadId: string) {
    if (!saveId) return
    setSavedActions((prev) => prev.filter((a) => a.id !== habilidadId))
    try {
      await deleteSavedAction(saveId, habilidadId)
    } catch {
      // Si falla, se resincroniza en la próxima carga de la partida.
    }
  }

  async function handleUpdateHabilidad(habilidadId: string, params: { name: string; promptText: string; icon: string; description: string }) {
    if (!saveId) return
    const updated = await updateSavedAction(saveId, habilidadId, params)
    setSavedActions((prev) => prev.map((a) => (a.id === habilidadId ? updated : a)))
    // Bug real (auditoría 2026-07-28): DetailModal vuelve a modo vista con el `target` que se le
    // pasó al abrirse, no con `savedActions` — sin esto, la ficha mostraba nombre/descripción
    // previos al cambio hasta cerrarla y reabrirla, aunque la lista de abajo ya estuviera al día.
    setDetailTarget((prev) => (prev?.kind === 'ability' && prev.ability.id === habilidadId ? { kind: 'ability', ability: updated } : prev))
  }

  function handleItemDetail(item: InventoryItemInfo) {
    setDetailTarget({ kind: 'item', item })
    setDetailInsertHandler(null)
  }

  function handleAbilityDetail(ability: SavedActionInfo) {
    // Enlace a Enciclopedia (rediseño de profesiones, 2026-08-07): `recipeKey` no viene del
    // backend en el SavedAction real — se resuelve aquí cruzando por `name` contra el roster
    // estático ya cargado (profesionRecipes), que cubre tanto category 'profesion' como 'reino'
    // CON oficio (ej. la Choza, 2026-08-13). Lo que no tiene oficio (Campamento/Ayuntamiento) cae
    // a REINO_ABILITY_RECIPE_KEY (data/reinoRecipes.ts); el resto se queda sin recipeKey, sin
    // enlace, sin cambio de comportamiento.
    const matchingRecipe =
      ability.category === 'profesion' || ability.category === 'reino' ? professionRecipes.find((r) => r.ability.name === ability.name) : undefined
    const reinoRecipeKey = ability.category === 'reino' && !matchingRecipe ? REINO_ABILITY_RECIPE_KEY[ability.name] : undefined
    const recipeLink = matchingRecipe
      ? { recipeKey: matchingRecipe.recipeKey, recipeCategory: matchingRecipe.recipeCategory }
      : reinoRecipeKey
        ? { recipeKey: reinoRecipeKey, recipeCategory: 'construccion' as const }
        : undefined
    setDetailTarget({ kind: 'ability', ability: recipeLink ? { ...ability, ...recipeLink } : ability })
    setDetailInsertHandler(null)
  }

  // Rediseño de equipar (2026-07-30, petición explícita: "que al clicarlo se abra un panel donde
  // aparece por qué lo puedo sustituir" — antes una ranura OCUPADA abría el detalle simple
  // (`handleItemDetail`, solo "Quitar", sin forma de sustituir directo) y una VACÍA abría un picker
  // sin filtrar por compatibilidad. Ahora CUALQUIER ranura abre el mismo panel — lo puesto ahora
  // mismo (si lo hay) + candidatos ya filtrados por `isCompatibleWithSlot` (equipSlots.ts).
  function handleSlotClick(slot: EquipSlot, equipped: InventoryItemInfo | undefined) {
    setDetailTarget({
      kind: 'slotManager',
      slot,
      slotLabel: SLOT_LABEL[slot],
      equipped,
      options: inventory.filter((i) => !i.slot && i.id !== equipped?.id && isCompatibleWithSlot(i, slot)),
    })
    setDetailInsertHandler(null)
  }

  function handleEnciclopediaInsert(chip: { icon: string; label: string; description?: string }) {
    composerRef.current?.insertChip(chip)
    setActivePanel(null)
  }

  function handleEnciclopediaDetail(target: DetailTarget, onInsertForTarget?: () => void) {
    setDetailTarget(target)
    setDetailInsertHandler(() => onInsertForTarget ?? null)
  }

  // Texto clicable en narración/diario/descripciones (2026-07-22): clic normal navega a la ficha
  // (se limpia el insert handler que hubiera de antes, p.ej. si se navega a otra ficha desde
  // dentro del propio modal); Shift+clic inserta directo sin navegar, ver handleEntityQuickInsert.
  function handleEntityDetailNavigate(target: DetailTarget) {
    setDetailTarget(target)
    setDetailInsertHandler(null)
  }

  // Shift+clic izquierdo (petición explícita, 2026-07-22) sobre CUALQUIER enlace a la Enciclopedia
  // — no solo las tarjetas del panel, también las menciones clicables dentro de narración/diario/
  // descripciones (EnciclopediaLinkedText) — inserta el chip directo en el composer sin abrir nada.
  function handleEntityQuickInsert(target: EnciclopediaLinkTarget) {
    composerRef.current?.insertChip({ icon: target.icon, label: target.name, description: target.description })
  }

  // Habilidades base de recolección (rediseño de profesiones, 2026-08-07) — Minar/Talar/Desollar
  // abren el pop-up de selección (HarvestSelectionModal) en vez de mandar texto libre al composer;
  // el oficio no viaja en el SavedAction (solo hay 3, mapeo fijo aquí es más simple que pedir todo
  // un roster al backend para esto). Desollar se sumó al pop-up el 2026-08-09 (petición explícita:
  // "que al usar la habilidad de profesión de desollar funcione como el resto") — antes era una
  // habilidad normal de texto libre; ahora busca en la escena presas ya derrotadas (cazadas por el
  // jugador o descritas como cadáver por la narración) igual que Minar/Talar buscan vetas/madera,
  // solo que sin "Explorar" propio (backend/src/routes/saves/recolectar.ts § carcassCandidatesFor).
  // Los valores son solo el PREFIJO base del oficio (sin raza/región) — metodoForOficio
  // (harvestAbilities.ts) empareja por prefijo, no por igualdad exacta.
  // "Recolectar hierbas" (herborista) sumado 2026-08-13 — bug real jugando en vivo: la habilidad
  // existía en backend (harvestAbilities.ts) pero, al faltar aquí, caía al chip de texto libre en
  // vez de abrir el mismo pop-up de selección que el resto de recolectoras.
  // Desollar pasa a pasiva (2026-08-25, ver comentario completo junto a `carcassPending` arriba) —
  // ya no abre este pop-up desde un clic en Habilidades, así que sale de este mapa; el mismo
  // `HarvestSelectionModal` se sigue reutilizando tal cual, ahora abierto desde el aviso de escena.
  const HARVEST_ABILITY_OFICIO: Record<string, string> = {
    Minar: 'minero',
    Talar: 'talador',
    'Recolectar hierbas': 'herborista',
    Recoger: 'recolector-general',
  }

  // Paneles nuevos (2026-08-17) — mismo patrón que HARVEST_ABILITY_OFICIO: pop-up de selección
  // real en vez del `promptText` incompleto que llevaban estas 2 habilidades desde su alta
  // original. "Saquear"/"Curar" no están aquí porque su confirmación es una forma distinta (manda
  // `lootItemNames`/`healItemUses` además del texto), ver `saquearZonaModalOpen`/`healModalOpen`.
  const SIMPLE_MODAL_ABILITY: Record<string, 'camp' | 'travel'> = {
    'Volver al campamento': 'camp',
    Viajar: 'travel',
  }

  function handleAttachAbility(ability: SavedActionInfo) {
    const oficio = HARVEST_ABILITY_OFICIO[ability.name]
    if (oficio) {
      setHarvestModal({ oficio, label: ability.name })
      setActivePanel(null)
      return
    }
    // "Cazar" (revisión de partida 2026-08-08) — mismo patrón que Minar/Talar: abre un pop-up en
    // vez de mandar `promptText` directo al composer.
    if (ability.name === 'Cazar') {
      setHuntModalOpen(true)
      setActivePanel(null)
      return
    }
    const simpleModalKind = SIMPLE_MODAL_ABILITY[ability.name]
    if (simpleModalKind) {
      setSimpleModal(simpleModalKind)
      setActivePanel(null)
      return
    }
    if (ability.name === 'Saquear') {
      setSaquearZonaModalOpen(true)
      setActivePanel(null)
      return
    }
    if (ability.name === 'Curar') {
      setHealModalOpen(true)
      setActivePanel(null)
      return
    }
    composerRef.current?.insertChip({ icon: ability.icon, label: ability.name, description: ability.description, value: ability.promptText })
    setActivePanel(null)
  }

  // Cierre + envío compartidos por los 3 modales de `simpleModal` (auditoría de deuda técnica
  // 2026-08-18) — los tres resuelven igual: un único texto de acción que pasa por el turno normal.
  function handleSimpleModalSelect(actionText: string) {
    setSimpleModal(null)
    handleSubmit(actionText)
  }

  function closeSimpleModal() {
    setSimpleModal(null)
  }

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
          logEntry: { id: string; text: string; timeLabel: string; createdAt: string }
        }
      | { resuelveSinCombate: false; actionText: string },
  ) {
    setHuntModalOpen(false)
    if (result.resuelveSinCombate) {
      setCharacterLog((prev) => [...prev, { ...result.logEntry, channel: 'character' }])
      setCombateIniciado(result.combate)
      // `result.combate` explícito (ver comentario de `openCombat`) — `combateIniciado` todavía no
      // se ha actualizado en este mismo tick, así que confiar en el estado aquí abriría un panel
      // de combate vacío.
      combat.openCombat(result.combate)
      return
    }
    handleSubmit(result.actionText)
  }

  function handleAttachItem(item: InventoryItemInfo) {
    composerRef.current?.insertChip({ icon: '🎒', label: item.name, description: item.description })
    setActivePanel(null)
  }

  async function handleEquipItem(item: InventoryItemInfo, slot: EquipSlot) {
    const previous = inventory
    // Solo puede haber un objeto por hueco — el que ya lo ocupara vuelve a la mochila, igual que
    // hace el backend en la misma transacción.
    setInventory((prev) =>
      prev.map((i) => {
        if (i.id === item.id) return { ...i, slot }
        if (i.slot === slot) return { ...i, slot: null }
        return i
      }),
    )
    try {
      if (saveId) {
        await setItemSlot(saveId, item.id, slot)
        // Bug real jugando en vivo (2026-08-12, "me he puesto la maza pero sigo viendo la
        // habilidad de estocada del cuchillo"): el backend SÍ resincroniza las habilidades de arma
        // dinámicas en la misma transacción del PATCH (syncDynamicCombatAbilities, dynamicAbilities.ts)
        // — el hueco era puramente de caché del frontend, `setItemSlot` solo actualiza `inventory`
        // en local y nunca vuelve a pedir `savedActions`, así que el tab de Habilidades seguía
        // mostrando la instantánea de antes de equipar hasta el próximo turno/recarga. Un `getSave`
        // + `syncFromSave` tras equipar es el mismo patrón ya usado en el resto de mutaciones de
        // esta pantalla (ver `handleCancelTransit` más arriba).
        const save = await getSave(saveId)
        syncFromSave(save)
      }
    } catch (err) {
      setInventory(previous)
      // Re-lanzado a propósito (sesión de diseño 2026-07-23): el equipar puede fallar de verdad
      // ahora (requisitos de atributo no cumplidos) — DetailModal espera esta promesa y muestra
      // el mensaje en vez de que el objeto "se desequipe solo" en silencio.
      throw err
    }
  }

  async function handleUnequipItem(item: InventoryItemInfo) {
    const previous = inventory
    setInventory((prev) => prev.map((i) => (i.id === item.id ? { ...i, slot: null } : i)))
    try {
      if (saveId) {
        await setItemSlot(saveId, item.id, null)
        // Mismo hueco de caché que handleEquipItem — desequipar también dispara
        // syncDynamicCombatAbilities en el backend (vuelve al arma desarmada/la otra mano).
        const save = await getSave(saveId)
        syncFromSave(save)
      }
    } catch (err) {
      setInventory(previous)
      throw err
    }
  }

  // Sugerencias de próxima acción bajo demanda (petición explícita, 2026-08-15) — llamada aparte
  // del turno normal, ver comentario de `suggestions` más arriba.
  async function handleRequestSuggestions() {
    if (!saveId || suggestionsLoading) return
    setSuggestionsLoading(true)
    try {
      const { suggestions: newSuggestions } = await requestSuggestions(saveId)
      setSuggestions(newSuggestions)
    } catch (err) {
      // Sin sugerencias esta vez — la jugadora sigue pudiendo escribir su acción a mano, mismo
      // criterio que `handleFleeAttempt` de arriba (fallo de la llamada en sí, no algo que romper
      // el resto de la UI). `console.error` sí se deja (bug real, 2026-08-20: "le doy a sugerir...
      // pienso pero no las veo" — antes esto era un `catch {}` totalmente mudo, así que un fallo
      // real de la llamada y un array vacío legítimo se veían IGUAL en pantalla: nada. Con esto al
      // menos queda rastro en la consola de si de verdad falló la petición o si volvió vacía.
      console.error('[sugerencias] no se pudieron obtener:', err)
    } finally {
      setSuggestionsLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function createNewSave() {
      if (!selectedWorld || !selectedCharacter) return
      // Intro propia por personaje pregenerado (2026-07-28, petición explícita: "había
      // actualizado algunos mensajes... pero no veo que salgan") — antes esta plantilla genérica
      // era la ÚNICA fuente posible, sin ningún hueco para una intro narrativa propia por
      // personaje; el texto rico que ya se había escrito (data/mock.ts) nunca llegaba a usarse.
      const introCharacterText =
        selectedCharacter.introCharacterText ??
        `${selectedCharacter.name} llega a las tierras de ${selectedWorld.name}. ${selectedCharacter.motivation} Todo lo que ocurra a partir de ahora empieza aquí.`
      const introWorldText =
        selectedCharacter.introWorldText ??
        `El mundo de ${selectedWorld.name} sigue su curso, ajeno por ahora a la llegada de un nuevo actor en la historia.`
      try {
        const { id: newId } = await createSave({
          worldSlug: selectedWorld.id,
          pregeneratedCharacterId: selectedCharacter.isPregenerated ? selectedCharacter.id : undefined,
          characterName: selectedCharacter.name,
          characterArchetype: selectedCharacter.archetype,
          characterOrigin: selectedCharacter.origin,
          characterMotivation: selectedCharacter.motivation,
          attributes: selectedCharacter.attributes,
          portraitInitial: selectedCharacter.portraitInitial,
          introCharacterText,
          introWorldText,
          dificultad: selectedDificultad,
        })
        if (!cancelled) navigate(`/solitario/partida/${newId}`, { replace: true })
      } catch {
        if (!cancelled) setNotFound(true)
      }
    }

    async function loadExistingSave(existingId: string) {
      try {
        const save = await getSave(existingId)
        if (cancelled) return
        setSaveId(save.id)
        setWorldIdSlug(save.worldSlug)
        setWorldName(save.worldName)
        syncFromSave(save)
      } catch {
        if (!cancelled) setNotFound(true)
      }
    }

    if (id === 'nueva') {
      createNewSave()
    } else if (id) {
      loadExistingSave(id)
    }

    return () => {
      cancelled = true
    }
    // Deliberadamente solo `id`: este efecto debe correr una única vez por navegación de ruta
    // (crear o cargar), nunca de nuevo porque `selectedWorld`/`selectedCharacter`/
    // `selectedDificultad` (SessionContext) cambien de referencia por otra razón — eso repetiría
    // `createNewSave`/`loadExistingSave` sin que el jugador haya navegado a ningún sitio nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Pausar/reanudar la partida de verdad al salir (roadmap 2026-07-20: "quiero que la partida se
  // pause si salgo de ella"). `resume` al entrar/recuperar `saveId`; `pause` tanto al desmontar
  // (navegar a otra vista dentro de la SPA) como en `beforeunload` (cerrar la pestaña o recargar,
  // el único momento en que el desmontaje de React no está garantizado).
  useEffect(() => {
    if (!saveId) return
    // Best-effort: si falla, la partida sigue marcada "en pausa" en el backend pero la usuaria ya
    // está jugando con normalidad — no hay ninguna acción real que ofrecerle ante este fallo.
    resumeSave(saveId).catch(() => {})

    const handleBeforeUnload = () => pauseSave(saveId)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      pauseSave(saveId)
    }
  }, [saveId])

  async function handleSubmit(
    action: string,
    // Panel "Curar" con varios objetos/usos a la vez (petición explícita, 2026-08-18) — reenviado
    // tal cual a requestTurnNarrate, mismo criterio que `lootItemNames` en submitCombatAction.
    extras?: { healItemUses?: { itemId: string; quantity: number }[] },
  ) {
    if (!action || !saveId || busyUntil || endedAt) return
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

    setCharacterLog((prev) => [...prev, playerActionEntry(action, fictionalDate)])
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
        // Validador de "grounding" de la acción del jugador (docs/18-validacion-accion-jugador.md)
        // — el backend ya resolvió el turno (persistió acción + respuesta determinista en el log)
        // sin pasar por /turn/narrate. Recargar la partida basta, mismo patrón que `transit`.
        setCharacterThinking(false)
        const save = await getSave(saveId)
        syncFromSave(save)
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

      if (classification.banda === 'corta' && classifyResult.duracionMinutos) {
        const { duracionMinutos, produccion } = classifyResult
        setTimedThinkingText(`${action} — unos ${duracionMinutos} min de juego${produccion ? ` (${produccion})` : ''}...`)
      }

      const {
        narration,
        progression,
        condicionFisica: newCondicion,
        energia: newEnergia,
        energiaMax: newEnergiaMax,
        timeLabel: newTimeLabel,
        combateIniciado: combate,
        esperandoDefensaJugador,
        finDePartida,
        newInventoryItems,
        removedInventoryItemIds,
        updatedInventoryItems,
        logEntryId,
        quests: updatedQuests,
        newQuestInfo,
        questCompletedInfo,
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
      } = await requestTurnNarrate(
        { saveId, action, classification, roll, travel, npcsInScene: classifyResult.npcsInScene, healItemUses: extras?.healItemUses },
        {
          onChunk: (delta) => setStreamingNarration((prev) => (prev ?? '') + delta),
          onReset: () => setStreamingNarration(null),
          onExchangeResolved: (exchange, npcName) => setDiceReveal({ exchange, npcName }),
        },
      )
      setStreamingNarration(null)
      setCondicionFisica(newCondicion)
      setEnergia(newEnergia)
      setEnergiaMax(newEnergiaMax)
      setFictionalDate(newTimeLabel)
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
      if (combatEncounterLootSummary && combatEncounterLootSummary.length > 0) setCarcassPending(true)
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
      combat.setCombatAwaitingDefense(esperandoDefensaJugador)
      if (finDePartida) setEndedAt(new Date().toISOString())

      if (travel) {
        // Un viaje resuelto síncronamente (banda corta) ya cambió currentLocationId en el
        // backend — resincronizamos posición/destinos en vez de reconstruirlo a mano aquí.
        // Best-effort: si esta resincronización falla, el próximo turno o refresco de panel ya
        // trae la posición al día — no hay error puntual que mostrar por un viaje que, mecánicamente,
        // ya se resolvió bien en el backend.
        getSave(saveId)
          .then((save) => {
            setCurrentLocation(save.currentLocation)
            setDestinations(save.destinations)
          })
          .catch(() => {})
      }

      // Calculado fuera del updater (ver comentario igual en handleCombatTurnResolved) — evita que
      // la doble invocación de StrictMode en dev deduplique la entidad contra sí misma.
      const entityBanner = buildEntityBanner(narration.narration, logEntryId)
      setCharacterLog((prev) => {
        const next = [
          ...prev,
          {
            id: logEntryId,
            channel: 'character' as const,
            text: narration.narration,
            timeLabel: newTimeLabel,
            roll,
            createdAt: new Date().toISOString(),
            xpDelta: progression.xpDelta > 0 ? progression.xpDelta : undefined,
            entityBanner,
            newQuest: newQuestInfo ?? undefined,
          },
        ]
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
      if (progression.leveledUp) {
        setLevel(progression.newLevel)
        setPendingAttributePoints((prev) => prev + progression.attributePointsGained)
        const attributeNote =
          progression.attributePointsGained > 0
            ? ` Gana ${progression.attributePointsGained} puntos de atributo para repartir.`
            : ''
        setCharacterLog((prev) => [
          ...prev,
          {
            id: `levelup-${Date.now()}`,
            channel: 'character',
            text: `${characterName} sube a nivel ${progression.newLevel}.${attributeNote}`,
            timeLabel: newTimeLabel,
            createdAt: new Date().toISOString(),
            isLevelUp: true,
          },
        ])
      }
    } catch (err) {
      if (isEndedGameError(err)) {
        setEndedAt(err.endedAt)
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
        await pollForResolution({ saveId, logLengthBeforeThisTurn, fictionalDate, syncFromSave, setCharacterLog })
      }
    } finally {
      setCharacterThinking(false)
      setTimedThinkingText(null)
      setStreamingNarration(null)
      setDiceReveal(null)
    }
  }

  async function handleSpendAttributePoint(attribute: Attribute) {
    if (!saveId) return
    try {
      const result = await spendAttributePoint(saveId, attribute)
      setCharacterAttributes(result.attributes)
      setPendingAttributePoints(result.pendingAttributePoints)
    } catch {
      // Silencioso: el botón se puede reintentar, no bloquea la partida.
    }
  }

  // Bloque de transit/busy (deuda técnica 2026-08-21) — ver src/hooks/useTransitPolling.ts.
  // `busyUntil`/`busyActivity`/`busyDuracionMinutos` los siguen escribiendo `syncFromSave`
  // (arriba) y `handleSubmit` (abajo, en el catch de `isBusyError`), fuera del hook.
  const { cancelingTransit, nowTick, handleCancelTransit } = useTransitPolling({ saveId, busyUntil, syncFromSave })

  if (notFound || (!saveId && id !== 'nueva')) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-wood-400">No se encuentra esta partida.</p>
        <button onClick={() => navigate('/solitario')} className="text-sm text-accent-400 hover:text-accent-300">
          ← Volver al menú
        </button>
      </div>
    )
  }

  if (!saveId || !worldName || !characterName || !characterAttributes || !secondaryAttributes) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="gem animate-pulse-soft" />
        <p className="text-wood-500 italic">Cargando partida...</p>
      </div>
    )
  }

  const panelTitles: Record<PanelId, string> = {
    mapa: 'Mapa',
    inventario: 'Inventario',
    personaje: 'Personaje',
    diario: 'Diario',
    misiones: 'Misiones',
    companeros: 'Compañeros',
    reino: 'Reino',
    habilidades: 'Habilidades',
    enciclopedia: 'Enciclopedia',
    zona: 'Zona',
  }
  // Roadmap de diseño CSS (Fable, 2026-07-20, Nivel 3): el marco del cajón sigue la misma
  // partición que ya usan characterTabs/worldTabs (riel izquierdo "Tu personaje" vs derecho "El
  // mundo") — Diario se deja en 'accent' por defecto porque mezcla ambos canales por diseño
  // (ver DiarioPanel, gem/gem2 por entrada) y no encaja limpiamente en ninguno de los dos.
  const panelAccent: Record<PanelId, 'accent' | 'accent2'> = {
    inventario: 'accent',
    personaje: 'accent',
    habilidades: 'accent',
    companeros: 'accent',
    reino: 'accent',
    mapa: 'accent2',
    zona: 'accent2',
    diario: 'accent',
    misiones: 'accent2',
    enciclopedia: 'accent2',
  }

  return (
    <EnciclopediaLinkProvider
      value={{ enciclopediaIndex, onEntityDetail: handleEntityDetailNavigate, onEntityQuickInsert: handleEntityQuickInsert }}
    >
    <div className="relative flex min-h-0 flex-1 flex-col">
      <header className="iron-band relative flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-2.5">
        <div className="min-w-0">
          <button
            onClick={() =>
              // Bug real (2026-07-24, "al darle a salir de la partida, que me lleve a las
              // partidas no a seleccionar mundo"): CharacterSaves resuelve el personaje por id
              // contra `pregeneratedCharacters` o `selectedCharacter` (SessionContext, en memoria,
              // se pierde al recargar) — tras recargar GameView directamente, ninguna de las dos
              // vías resuelve nada (aquí nunca se manda un id de personaje real, sino `saveId`),
              // así que caía al aviso de "elige mundo y personaje". `characterName` va por query,
              // como respaldo que CharacterSaves ya puede usar sin depender de esa sesión en memoria.
              navigate(`/solitario/mundo/${worldIdSlug}/personaje/${saveId}?characterName=${encodeURIComponent(characterName ?? '')}`)
            }
            className="text-xs text-wood-500 transition-colors hover:text-accent-300"
          >
            ← Salir a tus partidas
          </button>
          <p className="mt-0.5 truncate font-serif text-base tracking-wide text-wood-200">
            <span className="text-accent-400">{characterName}</span>
            <span className="mx-2 text-wood-600">·</span>
            <span className="text-wood-300">{worldName}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => {
              setPersonajeSubTab('estadisticas')
              setActivePanel('personaje')
            }}
            title={pendingAttributePoints > 0 ? `${pendingAttributePoints} puntos de atributo por repartir` : 'Nivel'}
            className="relative flex items-center gap-1.5 rounded-md border border-iron-700 bg-wood-950/60 px-2.5 py-1 font-serif text-xs tracking-wide text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300"
          >
            <span key={levelPop} className={`inline-flex items-center gap-1.5 ${levelPop > 0 ? 'animate-pop-once' : ''}`}>
              <span className="gem" />
              Nivel {level}
            </span>
            {pendingAttributePoints > 0 && (
              <span className="ml-1 rounded-full bg-accent-500 px-1.5 text-2xs font-bold text-wood-950">
                +{pendingAttributePoints}
              </span>
            )}
          </button>
          <HealthBar condicionFisica={condicionFisica} />
          <EnergyBar energia={energia} energiaMax={energiaMax} />
          {dificultad !== 'NOVATO' && (
            // Indicador de muerte permanente (2026-07-19, auditoría de frontend): docs/14 § 4.2
            // ya tiene un límite real de muertes por dificultad, pero el jugador no tenía ninguna
            // señal en pantalla de cuántas le quedan hasta el fin de partida definitivo.
            <span
              key={deathPop}
              title={`Muerte permanente a la ${LIMITE_MUERTES[dificultad]}ª muerte (dificultad ${dificultad.toLowerCase()})`}
              className={`relative rounded-md border border-iron-700 bg-wood-950/60 px-2.5 py-1 font-serif text-xs tracking-wide text-wood-300 ${
                deathPop > 0 ? 'animate-pop-once' : ''
              }`}
            >
              {deathPop > 0 && (
                <span aria-hidden="true" className="animate-edge-flash-red pointer-events-none absolute inset-0 rounded-md border border-danger-500" />
              )}
              💀 {deathCount}/{LIMITE_MUERTES[dificultad]}
            </span>
          )}
          <span className="rounded-md border border-iron-700 bg-wood-950/60 px-2.5 py-1 font-serif text-xs tracking-wide text-wood-300">
            {fictionalDate}
          </span>
        </div>
        <div className="accent-hairline absolute inset-x-0 bottom-0" />
      </header>

      <div className="flex min-h-0 flex-1 gap-2 overflow-hidden p-2">
        <SideNav
          tabs={characterTabs}
          active={activePanel}
          align="left"
          dimmed={!!activePanel}
          disabledIds={combat.combatOpen ? COMBAT_DISABLED_CHARACTER_TABS : undefined}
          onSelect={(id) => setActivePanel((prev) => (prev === id ? null : id))}
        />
        <div
          className={`grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden ${
            collapsedSide === 'character' ? 'lg:grid-cols-[2.75rem_1fr]' : collapsedSide === 'world' ? 'lg:grid-cols-[1fr_2.75rem]' : 'lg:grid-cols-2'
          }`}
        >
          {collapsedSide === 'character' ? (
            <CollapsedRail label="Tu personaje" icon="›" accentClass="text-accent-300" onExpand={() => setCollapsedSide(null)} />
          ) : (
            <LogPanel
              title="Tu personaje"
              subtitle="Lo que haces, dices y percibes"
              entries={characterLog}
              accent="accent"
              isThinking={characterThinking}
              thinkingText={streamingNarration ?? timedThinkingText ?? characterFlavor}
              streaming={!!streamingNarration}
              combate={combat.combatOpen}
              diceReveal={diceReveal}
              emptyHint="Aquí aparecerá lo que le ocurra a tu personaje."
              onCollapse={() => setCollapsedSide('character')}
              collapseIcon="‹"
              characterName={characterName ?? undefined}
            />
          )}
          {collapsedSide === 'world' ? (
            <CollapsedRail
              label={combat.combatOpen && combateIniciado ? 'Combate' : 'El mundo'}
              icon="‹"
              accentClass={combat.combatOpen && combateIniciado ? 'text-danger-400' : 'text-accent2-300'}
              onExpand={() => setCollapsedSide(null)}
            />
          ) : combat.combatOpen && combateIniciado ? (
            // Rediseño de la vista de combate (2026-07-28, petición explícita: "quiero que la
            // sección de combate salga sustituyendo a los logs de mundo") — el panel "El mundo"
            // se sustituye por CombatPanel mientras dura el combate; el log de mundo en sí sigue
            // acumulándose por debajo, sin perderse, listo para cuando termine.
            <CombatPanel
              playerCondicion={condicionFisica}
              energia={energia}
              npcs={combat.combatNpcsDisplay}
              selectedNpcSlug={combat.combatSelectedNpcSlug}
              onSelectNpc={combat.setCombatSelectedNpcSlug}
              combatAbilities={savedActions.filter((a) => a.category === 'combate')}
              selectedAbilityId={combat.combatSelectedAbilityId}
              onSelectAbility={combat.setCombatSelectedAbilityId}
              // Consumibles de combate (2026-07-30, petición explícita: "raciones y cataplasma
              // catalogalo como Consumible que tendrá 6 slots en equipo donde podrás añadir los
              // consumibles que quieres usar en el combate") — antes CUALQUIER objeto sin ranura
              // (mochila entera, incluidos documentos/materiales) contaba como "usable" en
              // combate; ahora solo lo que el jugador equipó a propósito en una de las 6 ranuras.
              combatItems={inventory.filter((i) => isConsumibleSlot(i.slot))}
              selectedItemId={combat.combatSelectedItemId}
              onSelectItem={combat.setCombatSelectedItemId}
              playerAttributes={characterAttributes}
              busy={combat.combatBusy}
              ended={combat.combatEnded}
              awaitingDefense={combat.combatAwaitingDefense}
              lastInitiativeRoll={lastInitiativeRoll}
              onActuar={combat.handleCombatActuar}
              onRegistrar={combat.handleCombatRegistrar}
              onDecapitarSeleccion={combat.handleDecapitarSeleccion}
              onHuir={combat.handleCombatHuir}
              onContinue={combat.closeCombat}
              onSaquearSeleccion={combat.handleSaquearSeleccion}
              onAbilityDetail={handleAbilityDetail}
              onItemDetail={handleItemDetail}
              enciclopedia={enciclopediaData}
              onCollapse={() => setCollapsedSide('world')}
              collapseIcon="›"
            />
          ) : (
            <LogPanel
              title={worldLogView === 'world' ? 'El mundo' : 'Reino'}
              subtitle={worldLogView === 'world' ? 'Lo que ocurre más allá de tu personaje' : 'Lo que ocurre en tu reino'}
              entries={worldLogView === 'world' ? worldLog : kingdomLog}
              accent="accent2"
              isThinking={worldLogView === 'world' && worldThinking}
              thinkingText={worldFlavor}
              emptyHint={worldLogView === 'world' ? 'El mundo todavía no ha mostrado sus cartas.' : 'Todavía no ha pasado nada en tu reino.'}
              onCollapse={() => setCollapsedSide('world')}
              collapseIcon="›"
              // Alternar Mundo/Reino (2026-08-17) — solo tiene sentido ofrecerlo una vez hay reino
              // fundado, o si ya quedó alguna entrada de reino de cuando lo hubo.
              onToggleView={kingdomName || kingdomLog.length > 0 ? () => setWorldLogView((v) => (v === 'world' ? 'kingdom' : 'world')) : undefined}
              toggleViewLabel={worldLogView === 'world' ? 'Reino' : 'Mundo'}
              characterName={characterName ?? undefined}
            />
          )}
        </div>
        <SideNav
          tabs={worldTabs}
          active={activePanel}
          align="right"
          dimmed={!!activePanel}
          disabledIds={combat.combatOpen ? COMBAT_DISABLED_WORLD_TABS : undefined}
          onSelect={(id) => setActivePanel((prev) => (prev === id ? null : id))}
        />
      </div>

      {busyUntil && (
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-iron-800 bg-wood-950/90 px-4 py-2 text-center text-xs text-wood-400">
          <span>
            <span className="gem mr-1.5 align-middle" /> Ocupado{busyActivity ? ` con "${busyActivity}"` : ''} — vuelve en{' '}
            <span className="font-mono font-semibold text-accent-300">{formatCountdown(busyUntil, nowTick)}</span>
            {busyDuracionMinutos ? (
              <>
                {' '}
                (<span className="font-semibold text-wood-200">{formatFictionalDuration(busyDuracionMinutos)}</span> en {worldName})
              </>
            ) : null}{' '}
            (sobre las {new Date(busyUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}), se resolverá solo.
          </span>
          <button
            onClick={handleCancelTransit}
            disabled={cancelingTransit}
            className="tactile rounded-lg border border-iron-700 bg-wood-950/60 px-2.5 py-1 text-2xs text-wood-300 transition-colors hover:border-red-700/60 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelingTransit ? 'Cancelando...' : 'Cancelar acción'}
          </button>
        </div>
      )}

      {combateIniciado && !combat.combatOpen && !endedAt && (
        <div className="flex flex-col items-center gap-1.5 border-t border-iron-800 bg-wood-950/90 px-4 py-2 text-center">
          {combat.combatDifficulty && (
            <p className={`text-2xs font-semibold uppercase tracking-[0.1em] ${combat.combatDifficulty.colorClass}`}>
              Dificultad: {combat.combatDifficulty.label}
            </p>
          )}
          <div className="flex items-center justify-center gap-2">
            <button
              // `() => combat.openCombat()` explícito, no `combat.openCombat` a secas (bug real
              // introducido al añadir `combatOverride`, auditoría 2026-08-21): un handler de
              // `onClick` pasado directo recibe el `MouseEvent` como primer argumento — con
              // `openCombat` aceptando ahora un parámetro opcional, ese evento se habría colado
              // como `combatOverride` (truthy, sin `.npcs`) y reventado en `combate.npcs.map(...)`.
              onClick={() => combat.openCombat()}
              disabled={combat.fleeingPreCombat}
              className="animate-alert-pulse rounded-lg border border-red-700 bg-danger-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-danger-400 shadow-[0_0_14px_-4px_color-mix(in_srgb,var(--color-danger-500)_70%,transparent)] transition-colors hover:bg-danger-500/20 disabled:opacity-50"
            >
              ⚔️ Combatir
            </button>
            <button
              onClick={combat.handleFleeAttempt}
              disabled={combat.fleeingPreCombat}
              className="tactile rounded-lg border border-iron-700 bg-wood-950/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 disabled:opacity-50"
            >
              {combat.fleeingPreCombat ? 'Huyendo...' : '🏃 Huir'}
            </button>
          </div>
        </div>
      )}

      {endedAt ? (
        <div className="animate-entry-in-slow border-t border-iron-800 bg-wood-950/90 px-4 py-5 text-center">
          <div className="animate-line-extend mx-auto mb-3 h-px w-24 origin-center bg-red-800" />
          <p className="text-sm text-danger-400">
            {characterName} ya no puede seguir — esta partida ha terminado. Puedes reiniciarla desde
            "Sus partidas".
          </p>
        </div>
      ) : combat.combatOpen && combateIniciado ? (
        // Rework 2026-07-24, recortado en el rediseño de la vista de combate (2026-07-28): sigue
        // sustituyendo al ChatComposer normal en el mismo sitio, pero ahora solo es el input de
        // texto libre — enemigos/ficha/habilidades/objetos/Actuar viven en CombatPanel, arriba.
        <CombatComposer
          freeText={combat.combatFreeText}
          onFreeTextChange={combat.setCombatFreeText}
          onSubmit={combat.handleCombatFreeSubmit}
          busy={combat.combatBusy}
          ended={combat.combatEnded}
        />
      ) : (
        <>
          {/* Petición explícita, 2026-08-15: "si se detecta combate: true que no saque
              sugerencias" — sin `!combateIniciado`, la barra seguía saliendo con el aviso
              "⚔️ Combatir / 🏃 Huir" ya en pantalla (combate detectado pero el popup todavía sin
              abrir, `combatOpen` false): mismo criterio que ya usa `composerDisabled`/el propio
              banner de arriba para esa combinación exacta de estados. */}
          {!combateIniciado && carcassPending && (
            // Desollar pasiva (2026-08-25) — sustituye al botón que había en Habilidades: aparece
            // solo mientras hay cadáveres reales pendientes en la escena actual (narrativos o los
            // que deja un CombatEncounter resuelto), abre el mismo pop-up de siempre.
            <button
              type="button"
              onClick={() => setHarvestModal({ oficio: 'desollador', label: 'Desollar' })}
              className="tactile mx-4 mb-2 flex items-center gap-2 rounded-lg border border-accent-700/60 bg-accent-500/10 px-3 py-2 text-left text-sm text-accent-200 hover:bg-accent-500/20"
            >
              <span className="text-lg leading-none">🔪</span>
              <span>Hay presas caídas sin desollar en esta zona.</span>
            </button>
          )}
          {!combateIniciado && (
            <SuggestionBar
              suggestions={suggestions}
              onPick={(text) => composerRef.current?.setTextWithChips(text, enciclopediaIndex)}
              loading={suggestionsLoading}
            />
          )}
          <ChatComposer
            ref={composerRef}
            onChange={setInput}
            onSubmit={handleSubmit}
            disabled={characterThinking || !!busyUntil || (!!combateIniciado && !combat.combatOpen)}
            onRequestSuggestions={combateIniciado ? undefined : handleRequestSuggestions}
            suggestionsLoading={suggestionsLoading}
          />
        </>
      )}

      {detailTarget && (
        <DetailModal
          target={detailTarget}
          onClose={() => {
            setDetailTarget(null)
            setDetailInsertHandler(null)
          }}
          onUnequip={handleUnequipItem}
          onEquip={handleEquipItem}
          onSaveAbility={handleUpdateHabilidad}
          onDeleteAbility={handleDeleteHabilidad}
          onInsert={detailInsertHandler ?? undefined}
          worldSlug={worldIdSlug}
        />
      )}

      {kingdomFoundedInfo && (
        <KingdomFoundingModal info={kingdomFoundedInfo} onCancel={() => setKingdomFoundedInfo(null)} onConfirm={handleFundarReino} />
      )}

      {harvestModal && saveId && characterAttributes && (
        <HarvestSelectionModal
          saveId={saveId}
          oficio={harvestModal.oficio}
          oficioLabel={harvestModal.label}
          inventoryUsed={totalInventoryUnits(inventory)}
          inventoryCapacity={inventoryCapacityFor(
            characterAttributes,
            inventory.filter((i) => i.slot !== null),
          )}
          onConfirm={(created, updated, logEntry) => {
            // Bug real jugando en vivo (2026-08-07, "no acumula los items"): recolectar el mismo
            // objeto dos veces creaba dos filas sueltas en vez de sumar a la pila ya existente —
            // mismo patrón exacto que `applyInventoryDelta` ya resuelve para crafteo/construcción.
            setInventory((prev) => applyInventoryDelta(prev, created, [], updated))
            // Registro escrito determinista (petición explícita, 2026-08-07: "un texto de
            // narración que no dependa de la AI") — mismo canal (personaje) que cualquier otra
            // narración, sin pasar por streaming ni por el Narrador.
            if (logEntry) {
              setCharacterLog((prev) => [...prev, { ...logEntry, channel: 'character' }])
              // Coste de tiempo de recolección (petición explícita, 2026-08-14) — backend/
              // recolectar.ts ahora avanza el reloj de verdad; sin esto, `fictionalDate` (el mismo
              // valor congelado que ya causaba "se logea mal la hora") se quedaba atrás del propio
              // `timeLabel` que este turno acaba de sellar en su LogEntry.
              setFictionalDate(logEntry.timeLabel)
            }
            // Desollar pasiva (2026-08-25) — tras confirmar, puede que ya no quede nada pendiente
            // (o solo una parte, si había varias presas) — se recomprueba en vez de asumir false.
            if (harvestModal?.oficio === 'desollador' && saveId) {
              getRecolectarLocalizado(saveId, 'desollador')
                .then(({ sources }) => setCarcassPending(sources.length > 0))
                .catch(() => {})
            }
            setHarvestModal(null)
          }}
          onCancel={() => setHarvestModal(null)}
        />
      )}

      {huntModalOpen && saveId && (
        <HuntSelectionModal saveId={saveId} onResuelto={handleHuntResolved} onCancel={() => setHuntModalOpen(false)} />
      )}

      {simpleModal === 'camp' && saveId && (
        <CampSelectionModal saveId={saveId} onSelect={handleSimpleModalSelect} onCancel={closeSimpleModal} />
      )}
      {simpleModal === 'travel' && saveId && (
        <TravelDestinationModal saveId={saveId} onSelect={handleSimpleModalSelect} onCancel={closeSimpleModal} />
      )}
      {healModalOpen && (
        <HealSelectionModal
          inventory={inventory}
          condicionFisica={condicionFisica}
          onConfirm={(actionText, healItemUses) => {
            setHealModalOpen(false)
            handleSubmit(actionText, { healItemUses })
          }}
          onCancel={() => setHealModalOpen(false)}
        />
      )}

      {saquearZonaModalOpen && saveId && (
        <SaquearZonaModal
          saveId={saveId}
          onConfirm={(actionText, lootItemNames) => {
            setSaquearZonaModalOpen(false)
            combat.submitCombatAction(actionText, { lootItemNames, allowAfterEnded: true })
          }}
          onCancel={() => setSaquearZonaModalOpen(false)}
        />
      )}

      {postCombatTarget && (
        <PostCombatInteractionModal
          target={postCombatTarget}
          busy={characterThinking}
          onSalir={() => setPostCombatTarget(null)}
          onSaquear={() => {
            const target = postCombatTarget
            setPostCombatTarget(null)
            handleSubmit(`Saqueo el cuerpo de '${target.name}'.`)
          }}
          onDecapitar={() => {
            const target = postCombatTarget
            setPostCombatTarget(null)
            handleSubmit(`Decapito a '${target.name}'.`)
          }}
        />
      )}

      {activePanel && (
        <PanelDrawer title={panelTitles[activePanel]} accent={panelAccent[activePanel]} onClose={() => setActivePanel(null)}>
          {activePanel === 'personaje' && (
            <PersonajePanel
              activeSubTab={personajeSubTab}
              onSubTabChange={setPersonajeSubTab}
              characterArchetype={characterArchetype}
              characterOrigin={characterOrigin}
              items={inventory}
              onSlotClick={handleSlotClick}
              attributes={characterAttributes}
              attributeBonuses={characterAttributeBonuses}
              secondaryAttributes={secondaryAttributes}
              level={level}
              xp={xp}
              pendingAttributePoints={pendingAttributePoints}
              onSpendPoint={handleSpendAttributePoint}
              condicionFisica={condicionFisica}
              energia={energia}
              energiaMax={energiaMax}
              hambre={hambre}
              sed={sed}
              factionsStatus={factionsStatus}
            />
          )}
          {activePanel === 'mapa' && (
            <MapaPanel worldSlug={worldIdSlug} currentLocation={currentLocation} destinations={destinations} inventory={inventory} quests={quests} buildings={buildings} />
          )}
          {activePanel === 'zona' && saveId && <ZonaPanel saveId={saveId} />}
          {activePanel === 'diario' && saveId && <DiarioPanel saveId={saveId} chapters={chapters} />}
          {activePanel === 'inventario' && (
            <InventarioPanel
              items={inventory}
              capacity={inventoryCapacityFor(
                characterAttributes,
                inventory.filter((i) => i.slot !== null),
              )}
              onUse={handleAttachItem}
              onDetail={handleItemDetail}
            />
          )}
          {activePanel === 'companeros' && saveId && (
            <CompanerosPanel saveId={saveId} companions={companions} inventory={inventory} onRefreshSave={refreshSave} />
          )}
          {activePanel === 'misiones' && <MisionesPanel quests={quests} />}
          {activePanel === 'reino' && saveId && (
            <ReinoPanel
              saveId={saveId}
              kingdomName={kingdomName}
              characterMotivation={characterMotivation}
              territories={territories}
              buildings={buildings}
              subjects={subjects}
              companions={companions}
              kingdomStats={kingdomStats}
              onFundarReino={handleReabrirFundacionReino}
              inventory={inventory}
              almacenItems={almacenItems}
              plantillasEquipo={plantillasEquipo}
              onRefreshSave={refreshSave}
            />
          )}
          {activePanel === 'enciclopedia' && (
            <EnciclopediaPanel
              data={enciclopediaData}
              loading={enciclopediaLoading}
              recipesStatus={recipesStatus}
              onInsert={handleEnciclopediaInsert}
              onDetail={handleEnciclopediaDetail}
            />
          )}
          {activePanel === 'habilidades' && (
            <HabilidadesPanel
              savedActions={savedActions}
              combatSlots={combatSlots}
              professionProgress={professionProgress}
              professionRecipes={professionRecipes}
              recipesStatus={recipesStatus}
              onUse={handleAttachAbility}
              onCreate={handleCreateHabilidad}
              onDetail={handleAbilityDetail}
            />
          )}
        </PanelDrawer>
      )}
    </div>
    </EnciclopediaLinkProvider>
  )
}
