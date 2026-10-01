import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSession } from '../context/useSession'
import { LogPanel } from '../components/LogPanel'
import { CollapsedRail } from '../components/CollapsedRail'
import { ChatComposer, type ChatComposerHandle } from '../components/ChatComposer'
import type { ComposerChip } from '../types'
// Sugerencias desactivadas (2026-09-06, ver comentario junto a `suggestions` más abajo) —
// `SuggestionBar` deja de importarse mientras la entrada visible está oculta.
// import { SuggestionBar } from '../components/SuggestionBar'
import { SkillBarMenu, type SkillHudView } from '../components/SkillBarMenu'
import { SkillBarHud } from '../components/SkillBarHud'
import { SkillBarEditor } from '../components/SkillBarEditor'
import { TooltipAnchor } from '../components/TooltipAnchor'
import { SideNav } from '../components/SideNav'
import { characterTabs, worldTabs, type PanelId } from '../components/NavTabs'
import { PanelDrawer } from '../components/PanelDrawer'
import { MapaPanel } from '../components/panels/MapaPanel'
import { DiarioPanel } from '../components/panels/DiarioPanel'
import { InventarioPanel } from '../components/panels/InventarioPanel'
import { EnciclopediaPanel } from '../components/panels/EnciclopediaPanel'
import { SLOT_LABEL, isCompatibleWithSlot, isConsumibleSlot } from '../lib/equipSlots'
import { PersonajePanel, type PersonajeSubTab } from '../components/panels/PersonajePanel'
import { ReputacionPanel } from '../components/panels/ReputacionPanel'
import { DetailModal, type DetailTarget } from '../components/DetailModal'
import { useEnciclopedia } from '../hooks/useEnciclopedia'
import { useEntityBanner } from '../hooks/useEntityBanner'
import { useReconnectionPolling } from '../hooks/useReconnectionPolling'
import { useSurroundingsPolling } from '../hooks/useSurroundingsPolling'
import { useRecipesData } from '../hooks/useRecipesData'
import { useCombatFlow } from '../hooks/useCombatFlow'
import { useZonaAcciones } from '../hooks/useZonaAcciones'
import { useInventarioAcciones } from '../hooks/useInventarioAcciones'
import { useModoDinamico } from '../hooks/useModoDinamico'
import { useHabilidadesAcciones } from '../hooks/useHabilidadesAcciones'
import { useMisionesAcciones } from '../hooks/useMisionesAcciones'
import { useTransitPolling } from '../hooks/useTransitPolling'
import { useKingdomState } from '../hooks/useKingdomState'
import { useActionModalsState } from '../hooks/useActionModalsState'
import { useTurnFlow } from '../hooks/useTurnFlow'
import { useClaseEspecializacionState } from '../hooks/useClaseEspecializacionState'
import type { EnciclopediaLinkTarget } from '../lib/enciclopediaIndex'
import { EnciclopediaLinkProvider } from '../context/EnciclopediaLinkContext'
import { CompanerosPanel } from '../components/panels/CompanerosPanel'
import { ReinoPanel, type ReinoSubTab } from '../components/panels/ReinoPanel'
import { MisionesPanel } from '../components/panels/MisionesPanel'
import { HabilidadesPanel } from '../components/panels/HabilidadesPanel'
import { CombatComposer } from '../components/CombatComposer'
import { CombatPanel } from '../components/CombatPanel'
import { HealthBar } from '../components/HealthBar'
import { EnergyBar } from '../components/EnergyBar'
import { KingdomFoundingModal } from '../components/KingdomFoundingModal'
import { HarvestSelectionModal } from '../components/HarvestSelectionModal'
import { REINO_ABILITY_RECIPE_KEY } from '../data/reinoRecipes'
import { PostCombatInteractionModal } from '../components/PostCombatInteractionModal'
import { DynamicModeModal } from '../components/DynamicModeModal'
import { RecursoDetalleModal } from '../components/RecursoDetalleModal'
import { ZonaMovimientoModal } from '../components/ZonaMovimientoModal'
import { CampSelectionModal } from '../components/CampSelectionModal'
import { TravelDestinationModal } from '../components/TravelDestinationModal'
import { SaquearZonaModal } from '../components/SaquearZonaModal'
import { HealSelectionModal } from '../components/HealSelectionModal'
import { HungerThirstSelectionModal } from '../components/HungerThirstSelectionModal'
import { HungerBar } from '../components/HungerBar'
import { ThirstBar } from '../components/ThirstBar'
import { EntregaModal } from '../components/EntregaModal'
import { AprenderOficioModal } from '../components/AprenderOficioModal'
import { EspecializacionModal } from '../components/EspecializacionModal'
import { ClaseModal } from '../components/ClaseModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { inventoryCapacityFor, totalInventoryUnits } from '../lib/inventoryCapacity'
import {
  requestTurnClassify,
  createSave,
  getSave,
  pauseSave,
  resumeSave,
  spendAttributePoint,
  fundarReino,
  type ConfirmarCazaResultado,
  // Sugerencias desactivadas (2026-09-06, ver comentario junto a `setSuggestions` más abajo).
  // requestSuggestions,
  getRecolectarLocalizado,
  resolveImageUrl,
  resolveDeath,
  type SaveDetail,
} from '../lib/api'
import { characterWaitingFlavor, combatWaitingFlavor, worldWaitingFlavor, useRotatingFlavor } from '../lib/waitingFlavor'
import { formatCountdown, formatFictionalDuration, applyInventoryDelta, combatKeyFor } from '../lib/gameViewHelpers'
import { ESTACION_ICON, CLIMA_ICON } from '../lib/entorno'
import { sinHabilidadesRetiradas } from '../lib/abilitiesRetiradasFase4'
import type {
  ActiveEffect,
  Attribute,
  AttributeBlock,
  CombatExchangeInfo,
  EntornoTemporalInfo,
  CompanionInfo,
  CondicionFisica,
  CurrentLocationInfo,
  DestinationInfo,
  Dificultad,
  EquipSlot,
  InitiativeRollInfo,
  InventoryItemInfo,
  LogEntry,
  NpcInSceneInfo,
  ProfessionProgressInfo,
  QuestInfo,
  SavedActionInfo,
  SecondaryAttributeBlock,
  SkillBarInfo,
} from '../types'

/// Combina los adjuntos del composer con el texto libre en una única acción (docs/mecanicas/14-combate-y-muerte.md
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
  const [characterLog, setCharacterLogRaw] = useState<LogEntry[]>([])
  // Tirada en vivo vs histórica (2026-09-04, centralización de todas las tiradas del juego) — ids
  // de LogEntry vistas por PRIMERA vez en esta sesión — LogPanel.tsx anima con DiceRollSingle solo
  // estos ids, el resto (recarga, Diario, turnos ya vistos antes en esta misma sesión) se queda con
  // el RollBadge estático. Mismo criterio implícito que ya usa `diceReveal` para combate: estado
  // efímero, nunca reconstruido desde `LogEntry` persistida.
  //
  // Detección automática por comparación de arrays, no un callback nuevo que cada uno de los 15+
  // sitios que ya llaman `setCharacterLog` tendría que recordar invocar aparte (`useTurnFlow.ts`/
  // `useCombatFlow.ts` viven fuera de este archivo, así que un callback explícito exigiría además
  // enhebrarlo como prop nueva por los dos hooks). `setCharacterLog` sigue siendo la MISMA función
  // que ya se pasa a todo el árbol — solo se envuelve una vez, aquí, sin tocar ningún call-site.
  // `syncFromSave` (carga inicial/recarga, sustituye `characterLog` ENTERO de golpe) usa el setter
  // CRUDO (`setCharacterLogRaw`) en vez de este wrapper — es la única distinción real necesaria:
  // cualquier id nuevo que aparezca vía el wrapper es, por definición, un turno resuelto EN VIVO.
  const liveRevealedIdsRef = useRef<Set<string>>(new Set())
  // Bug real (2026-09-04, "Maximum update depth exceeded" — la vista se quedaba en GameView sin
  // navegar de verdad tras salir de la partida): sin `useCallback`, este wrapper era una función
  // NUEVA en cada render — cualquier `useEffect` que lo listara como dependencia (useEntityBanner.ts,
  // `[enciclopediaIndex, setCharacterLog, setWorldLog]`) se disparaba en cada render, y como ese
  // efecto llama a `setCharacterLog` de vuelta, cada disparo forzaba otro render → bucle infinito
  // que saturaba React y le impedía completar la navegación de React Router a tiempo.
  const setCharacterLog = useCallback<typeof setCharacterLogRaw>((update) => {
    setCharacterLogRaw((prev) => {
      const next = typeof update === 'function' ? update(prev) : update
      const prevIds = new Set(prev.map((e) => e.id))
      for (const entry of next) {
        if (!prevIds.has(entry.id)) liveRevealedIdsRef.current.add(entry.id)
      }
      return next
    })
  }, [])
  const [worldLog, setWorldLog] = useState<LogEntry[]>([])
  // Log de Reino (2026-08-17) — canal aparte, alternable con el de mundo, nunca los dos a la vez.
  const [kingdomLog, setKingdomLog] = useState<LogEntry[]>([])
  const [worldLogView, setWorldLogView] = useState<'world' | 'kingdom'>('world')
  // Animación de dados en paralelo (petición explícita, 2026-08-15) — el intercambio de combate ya
  // resuelto (dos tiradas + desenlace) llega ANTES que el texto de narración (ver
  // TurnNarrateHandlers.onExchangeResolved, api.ts); null en cuanto el turno termina de resolverse
  // del todo (éxito o error), para que nunca sobreviva al siguiente turno sin intercambio.
  const [diceReveal, setDiceReveal] = useState<{ exchange: CombatExchangeInfo; npcName: string | null } | null>(null)
  // Sugerencias de próxima acción bajo demanda (petición explícita, 2026-08-15) — ENTRADA VISIBLE
  // DESACTIVADA (2026-09-06, decisión explícita de la usuaria: "son malísimas y no aportan casi
  // ningún valor... por ahora lo descartamos... dejándolo pendiente por si algún día lo
  // mejoramos"). `setSuggestions` sigue viva (la sigue limpiando `useTurnFlow` en cada turno nuevo,
  // ver más abajo) para no dejar ese hook a medio adaptar; solo el VALOR leído (`suggestions`) y
  // `handleRequestSuggestions`/`SuggestionBar` (más abajo) quedan sin usar mientras la barra está
  // oculta — no se borra nada del backend (`requestSuggestions`/generación de narrador.ts).
  const [, setSuggestions] = useState<string[]>([])
  const [inventory, setInventory] = useState<InventoryItemInfo[]>([])
  // Estado de los pop-ups de acción (deuda técnica, auditoría 2026-08-25) — ver
  // hooks/useActionModalsState.ts para el detalle de cada uno (pop-up de recolección, desollar
  // pasiva, caza, campamento/viajar/saquear/curar, interacción post-combate) — `carcassPending`
  // se escribe vía `markCarcassPending`/`checkCarcassPending` (C.2, checklist frontend 2026-08-27),
  // useCombatFlow/useTurnFlow también lo escriben desde fuera de la apertura/cierre normal.
  const {
    harvestModal,
    setHarvestModal,
    carcassPending,
    markCarcassPending,
    checkCarcassPending,
    simpleModal,
    setSimpleModal,
    saquearZonaModalOpen,
    setSaquearZonaModalOpen,
    healModalOpen,
    setHealModalOpen,
    hungerThirstModalOpen,
    setHungerThirstModalOpen,
    entregaModalOpen,
    setEntregaModalOpen,
    aprenderOficioModalOpen,
    setAprenderOficioModalOpen,
    postCombatTarget,
    setPostCombatTarget,
    activeDynamicMode,
    setActiveDynamicMode,
    anyActionModalOpen,
  } = useActionModalsState()
  const [companions, setCompanions] = useState<CompanionInfo[]>([])
  const [level, setLevel] = useState(1)
  const [xp, setXp] = useState(0)
  const [goirnos, setGoirnos] = useState(0)
  const [pendingAttributePoints, setPendingAttributePoints] = useState(0)
  // Estado de Reino (deuda técnica, auditoría 2026-08-25) — ver hooks/useKingdomState.ts para por
  // qué esto se queda como un hook de PURA agrupación en vez de aislado del todo (syncFromSave y
  // useCombatFlow, más abajo, siguen escribiendo estos mismos setters desde fuera).
  const {
    kingdomName,
    setKingdomName,
    kingdomFoundedInfo,
    setKingdomFoundedInfo,
    territories,
    setTerritories,
    buildings,
    setBuildings,
    subjects,
    setSubjects,
    almacenItems,
    setAlmacenItems,
    plantillasEquipo,
    setPlantillasEquipo,
    factionsStatus,
    setFactionsStatus,
    kingdomStats,
    setKingdomStats,
  } = useKingdomState()
  const [professionProgress, setProfessionProgress] = useState<ProfessionProgressInfo[]>([])
  const [deathCount, setDeathCount] = useState(0)
  const [dificultad, setDificultad] = useState<Dificultad>('NOVATO')
  const [savedActions, setSavedActions] = useState<SavedActionInfo[]>([])
  // "Cinturón de combate" (2026-08-28, pendiente 2026-08-27 punto 3) — nombres YA resueltos por el
  // backend (ver activeCombatAbilityNames, api.ts). Mismo patrón de sincronización que savedActions.
  const [activeCombatAbilityNames, setActiveCombatAbilityNames] = useState<string[]>([])
  const [combatSlots, setCombatSlots] = useState(3)
  const [fictionalDate, setFictionalDate] = useState('Día 1, mañana')
  // Estación/clima (2026-08-27, auditoría backend↔frontend + diseño/UX) — mismo patrón que
  // fictionalDate: se sincroniza al cargar la partida y se actualiza con cada respuesta de turno.
  const [entorno, setEntorno] = useState<EntornoTemporalInfo | null>(null)
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
        if (!cancelled) checkCarcassPending(sources.length > 0)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [saveId, currentLocation])
  const [input, setInput] = useState('')
  // Confirmación al salir de la partida (2026-09-04, petición explícita: "que salga un modal para
  // confirmar la acción, como en borrar o reiniciar") — antes navegaba directo sin aviso, único
  // riesgo real de perder de vista dónde estabas si se pulsaba sin querer. Mismo `ConfirmModal`
  // genérico ya usado en CharacterSaves.tsx para borrar/reiniciar, sin estado async que esperar
  // (es solo navegación, nunca falla).
  const [confirmingExit, setConfirmingExit] = useState(false)
  // Barras de habilidades múltiples fuera de combate (2026-09-04, v2 de la SkillBar única de
  // 2026-08-29) — máquina de 4 pantallas en vez del booleano showSkillBar de antes: composer de
  // texto libre, menú de tipo (General/Profesión/Reino/Escribir), menú de barras de un tipo (con
  // botón Atrás), y la barra activa mostrada en el HUD. Ver SkillBarMenu.tsx.
  const [skillHudView, setSkillHudView] = useState<SkillHudView>({ screen: 'composer' })
  const [skillBars, setSkillBars] = useState<SkillBarInfo[]>([])
  const [editingSkillBar, setEditingSkillBar] = useState<SkillBarInfo | null>(null)
  const composerRef = useRef<ChatComposerHandle>(null)
  // Bug real (2026-08-30, ver handleAttachAbility): con la barra desplegada, `ChatComposer` ni
  // siquiera está montado — cambiar de vista es asíncrono, así que escribir en `composerRef` en la
  // MISMA función no llega a tiempo (la ref sigue `null` hasta el próximo render). Se guarda aquí
  // el texto pendiente y este efecto lo aplica en cuanto el composer se remonta de verdad.
  //
  // Hallazgo 39 (revisar-partida-hallazgos.md 2026-09-07, "el texto completo de la habilidad se
  // pega en el prompt en vez de un link/chip") — para una receta de CRAFTEO, `{ chip: ... }` en vez
  // de texto plano: mismo criterio de "sustituir, no concatenar" (comentario de 2026-08-30 más
  // abajo), pero mostrando el nombre corto + icono en vez del `promptText` completo editable.
  const pendingComposerTextRef = useRef<string | { chip: ComposerChip } | null>(null)
  useEffect(() => {
    if (skillHudView.screen === 'composer' && pendingComposerTextRef.current !== null) {
      const pending = pendingComposerTextRef.current
      if (typeof pending === 'string') {
        composerRef.current?.setText(pending)
      } else {
        composerRef.current?.clear()
        composerRef.current?.insertChip(pending.chip)
      }
      pendingComposerTextRef.current = null
    }
  }, [skillHudView])

  // Foco de vuelta al composer al cerrar cualquier modal de acción (2026-08-31, "revisa bien todos
  // los casos del foco/scroll... cuando abres un modal") — cancelado o resuelto con éxito, ninguno
  // de los 6 modales de `anyActionModalOpen` (Cazar/Recolectar/Curar/Entregar/Saquear/campamento-
  // viaje) devolvía el foco al composer, a diferencia del caso ya arreglado de la barra de
  // habilidades (que llama `setText` internamente). Mismo patrón de transición true→false que el
  // resto de efectos de este archivo — no dispara en el primer render (nada estaba abierto antes).
  const wasActionModalOpenRef = useRef(false)
  useEffect(() => {
    if (wasActionModalOpenRef.current && !anyActionModalOpen) composerRef.current?.focus()
    wasActionModalOpenRef.current = anyActionModalOpen
  }, [anyActionModalOpen])
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
  // Roadmap de especialización (2026-09-01) — "Ver en la Enciclopedia" desde el modal de elección
  // obligatoria fuerza la pestaña 'classes' al abrir el panel. `enciclopediaOpenKey` fuerza un
  // remount de EnciclopediaPanel (su categoría activa es estado interno, `initialCategory` solo se
  // lee en el montaje) para que aplique cada vez que se pulsa el enlace, no solo la primera.
  const [enciclopediaInitialCategory, setEnciclopediaInitialCategory] = useState<'npcs' | 'classes'>('npcs')
  const [enciclopediaOpenKey, setEnciclopediaOpenKey] = useState(0)
  // Colapsar logs (2026-08-14, petición explícita: "que pueda colapsar el log de personaje a la
  // izquierda y que el de mundo ocupe todo... y al revés... lo mismo con las de combate") — un
  // solo estado tri-valuado en vez de dos booleanos independientes, para que nunca puedan quedar
  // los dos colapsados a la vez (no habría nada que ver).
  const [collapsedSide, setCollapsedSide] = useState<'character' | 'world' | null>(null)
  const [personajeSubTab, setPersonajeSubTab] = useState<PersonajeSubTab>('equipo')
  // Sub-tabs de Reino (rediseño 2026-09-21) — mismo patrón que `personajeSubTab`.
  const [reinoSubTab, setReinoSubTab] = useState<ReinoSubTab>('vision-general')
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
  // Fase 2 de efectos de clase (2026-08-27, indicador de combate) — mismo patrón que
  // condicionFisica: se sincroniza al cargar la partida y se actualiza con cada respuesta de turno.
  const [playerActiveEffects, setPlayerActiveEffects] = useState<ActiveEffect[]>([])
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

  // Muerte permanente, botón Aceptar/Reintentar (2026-08-31) — mismo patrón que `endedAt`.
  const [pendingDeathResolution, setPendingDeathResolution] = useState(false)
  const [resolvingDeath, setResolvingDeath] = useState(false)
  // Estado de Clase/Especialización (deuda técnica, auditoría 2026-09) — ver
  // hooks/useClaseEspecializacionState.ts: a diferencia de Reino/modales, aquí SOLO
  // `syncFromSave` (más abajo) escribe estos 5 useState, así que el hook también encapsula los
  // dos handlers de asignación completos, no solo agrupa la declaración.
  const {
    pendingClaseChoice,
    setPendingClaseChoice,
    clasesDisponibles,
    setClasesDisponibles,
    pendingEspecializacionChoice,
    setPendingEspecializacionChoice,
    especializacionesDisponibles,
    setEspecializacionesDisponibles,
    clase,
    setClase,
    handleAssignClase,
    handleAssignEspecializacion,
  } = useClaseEspecializacionState(saveId, syncFromSave)
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
  const COMBAT_DISABLED_WORLD_TABS: PanelId[] = ['mapa', 'diario', 'misiones']

  // Muerte pendiente de resolver (auditoría de código backend 2026-09-07, decisión confirmada con
  // la usuaria: "bloquear todo hasta Aceptar") — el composer ya se bloqueaba
  // (`pendingDeathResolution` más abajo, criterio de `busy`), pero ningún panel de acción lo hacía:
  // con el personaje MUERTO y el susurro de la Entidad ya narrado, se podía seguir equipando
  // objetos, gestionando el Almacén/Reino o crafteando una habilidad nueva. Backend ya rechaza estas
  // mutaciones con 409 (`rejectIfPendingDeath`) — esto es solo el reflejo visual, mismo criterio que
  // ya usa `COMBAT_DISABLED_CHARACTER_TABS`.
  const DEATH_PENDING_DISABLED_TABS: PanelId[] = ['inventario', 'companeros', 'reino', 'habilidades']

  const [quests, setQuests] = useState<QuestInfo[]>([])

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
  })

  // Guard de exclusión mutua entre modales de acción (checklist frontend 2026-08-27, A.2) —
  // `anyActionModalOpen` (useActionModalsState.ts) cubre los 6 modales de ese hook; aquí se añaden
  // los 3 que viven fuera de él (detailTarget/kingdomFoundedInfo de este componente,
  // combat.combatOpen de useCombatFlow) para tener un único punto de verdad de "hay algo abierto
  // encima del juego ahora mismo" antes de decidir si se abre uno nuevo.
  const anyModalOpen = anyActionModalOpen || !!detailTarget || !!kingdomFoundedInfo || combat.combatOpen
  // UX-3 (hito 0.1) — mismas condiciones que la guardia de `handleSubmit` (useTurnFlow.ts), con su
  // motivo: deshabilita los botones que lanzan un turno fuera del composer (Construir, Viajar,
  // Campamento, salida de zona), que pueden estar a la vista mientras el narrador escribe.
  const bloqueoTurno = characterThinking
    ? 'El narrador todavía está escribiendo.'
    : busyUntil
      ? 'Estás ocupado con otra actividad.'
      : endedAt
        ? 'La partida ha terminado.'
        : pendingDeathResolution
          ? 'Primero resuelve lo que ha pasado tras tu muerte.'
          : null
  // Un agresivo te corta el paso (2026-09-28) — la brújula se oculta hasta reaccionar (el backend
  // rechaza igualmente moverse con 409, esto solo evita ofrecer algo que no se puede hacer).
  const combateForzadoPendiente = characterLog.some((e) => e.dynamicModeOffer?.combateForzado)

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
    const composerDisabled =
      characterThinking || !!busyUntil || !!endedAt || pendingDeathResolution || (!!combateIniciado && !combat.combatOpen)
    if (!action || !saveId || composerDisabled) return

    const timer = setTimeout(() => {
      requestTurnClassify({ saveId, action, preview: true }).catch(() => {})
    }, 1500)

    return () => clearTimeout(timer)
  }, [input, saveId, characterThinking, busyUntil, endedAt, pendingDeathResolution, combateIniciado, combat.combatOpen])

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
    // Setter CRUDO (no el wrapper `setCharacterLog`) — carga inicial/recarga completa, ninguna de
    // estas entradas debe animarse como "recién vista" (ver comentario de `liveRevealedIdsRef`).
    setCharacterLogRaw(save.characterLog)
    setWorldLog(save.worldLog)
    setKingdomLog(save.kingdomLog)
    setInventory(save.inventory)
    setCompanions(save.companions)
    setLevel(save.level)
    setXp(save.xp)
    setGoirnos(save.goirnos)
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
    setSavedActions(sinHabilidadesRetiradas(save.savedActions))
    setActiveCombatAbilityNames(save.activeCombatAbilityNames)
    setSkillBars(save.skillBars)
    // Barras de habilidades múltiples (2026-09-04) — recuerda qué barra se veía en el HUD entre
    // sesiones, mismo criterio que el resto de preferencias de UI persistidas (activeCombatAbilityNames).
    setSkillHudView(save.activeSkillBarId ? { screen: 'barra-activa', skillBarId: save.activeSkillBarId } : { screen: 'composer' })
    setCombatSlots(save.habilidadSlots)
    setCurrentLocation(save.currentLocation)
    setDestinations(save.destinations)
    setCondicionFisica(save.condicionFisica)
    setPlayerActiveEffects(save.activeEffects)
    setEntorno(save.entorno)
    setEnergia(save.energia)
    setEnergiaMax(save.energiaMax)
    setHambre(save.hambre)
    setSed(save.sed)
    setDeathCount(save.deathCount)
    setDificultad(save.dificultad)
    setEndedAt(save.endedAt)
    setPendingDeathResolution(save.pendingDeathResolution)
    // Mismo criterio que `openCombat` (useCombatFlow.ts) al entrar en combate: si la muerte deja
    // pendiente de resolver justo mientras uno de los 4 paneles bloqueados ya estaba abierto, se
    // cierra — evita dejar sus controles de mutación visibles y con foco tras el susurro de la
    // Entidad.
    if (save.pendingDeathResolution && activePanel && DEATH_PENDING_DISABLED_TABS.includes(activePanel)) {
      setActivePanel(null)
    }
    setClase(save.clase)
    setPendingClaseChoice(save.pendingClaseChoice)
    setClasesDisponibles(save.clasesDisponibles ?? [])
    setPendingEspecializacionChoice(save.pendingEspecializacionChoice)
    setEspecializacionesDisponibles(save.especializacionesDisponibles ?? [])
    setQuests(save.quests)
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
    // Bug real (2026-08-28/29, jugando en vivo: recargar mientras el enemigo tiene la iniciativa
    // rompe la resolución del turno) — mismo criterio que `lastInitiativeRoll` arriba, pero dejado
    // a medias entonces: se rehidrataba el BANNER de iniciativa, no el MODO del panel que decide
    // qué catálogo de botones ofrecer. Sin esto, `lastInitiativeRoll.ganador === 'npc'` rehidratado
    // sin `combatAwaitingDefense` hacía que CombatPanel.tsx mostrara el catálogo de ATAQUE tras F5,
    // aunque el backend siguiera esperando la defensa real (`Save.pendingNpcAttack`) — el jugador
    // elegía con el catálogo equivocado y perdía el intercambio con su propio atributo de ataque
    // enfrentado a la Destreza real del NPC.
    combat.setCombatAwaitingDefense(save.esperandoDefensaJugador)
    // A.3 (checklist frontend 2026-08-27) — mismo criterio que `combateIniciado` arriba:
    // `pendingDynamicMode` se reconstruye tras CUALQUIER resincronización, no solo en la respuesta
    // directa de `/modo-dinamico/interactuar`/`/responder`. `timeLabel` usa `fictionalDateLabel` de
    // la propia partida (ya sincronizado más arriba) — no viaja aparte en `pendingDynamicMode`.
    if (save.pendingDynamicMode) {
      const p = save.pendingDynamicMode
      // B.6 — mismo criterio que handleInteractuarModoDinamico; si `enciclopediaIndex` todavía no
      // cargó en este punto de la resincronización, simplemente no hay retrato (igual que antes).
      const entityType = p.tipo === 'NPC' ? 'npc' : 'fauna'
      const banner = enciclopediaIndex.bySlugKey.get(`${entityType}:${p.targetSlug}`)
      setActiveDynamicMode({
        turno: { narration: p.narration, opciones: p.opciones, cierra: false, vuelta: p.vuelta, timeLabel: save.fictionalDateLabel },
        busy: false,
        imageUrl: resolveImageUrl(banner?.imageUrls?.banner ?? null),
      })
    }
    // Bug real 2026-08-28 ("oferta de modo dinámico no sobrevive a una recarga") — mismo criterio
    // que `pendingDynamicMode` justo arriba, un escalón antes: si el jugador aún no pulsó
    // "Interactuar"/"Ignorar", `save.characterLog` ya trae de vuelta el turno original que la
    // ofreció, así que no hace falta ninguna LogEntry sintética — solo hay que volver a colgar
    // `dynamicModeOffer` de esa entrada (la última que tenga `combate`/narración no vacía), igual
    // que `entry.convalecienteOffers` sigue colgado de su turno de origen (LogPanel.tsx).
    if (save.pendingDynamicModeOffer) {
      const offer = save.pendingDynamicModeOffer
      setCharacterLog((prev) => {
        const lastIdx = prev.length - 1
        if (lastIdx < 0 || prev[lastIdx].dynamicModeOffer) return prev
        return prev.map((e, i) => (i === lastIdx ? { ...e, dynamicModeOffer: { ...offer, busy: false } } : e))
      })
    }
    // Bug real jugando en vivo (2026-09-03, "misión de apertura no sobrevive a un F5") — mismo
    // criterio exacto que `pendingDynamicModeOffer` justo arriba: la tarjeta "MISIÓN PROPUESTA"
    // reconstruida colgándola de la última entrada del log, en vez de vivir solo en el
    // `characterLog` efímero de React.
    if (save.pendingQuestOfferInfo) {
      const offer = save.pendingQuestOfferInfo
      setCharacterLog((prev) => {
        const lastIdx = prev.length - 1
        if (lastIdx < 0 || prev[lastIdx].questOffer) return prev
        return prev.map((e, i) => (i === lastIdx ? { ...e, questOffer: offer } : e))
      })
    }
    // Menú contextual de interacción con NPC (2026-09-06) — mismo criterio exacto que
    // `pendingDynamicModeOffer`/`pendingQuestOfferInfo` de arriba.
    if (save.pendingNpcInteractionOffer) {
      const offer = save.pendingNpcInteractionOffer
      setCharacterLog((prev) => {
        const lastIdx = prev.length - 1
        if (lastIdx < 0 || prev[lastIdx].npcInteractionOffer) return prev
        return prev.map((e, i) => (i === lastIdx ? { ...e, npcInteractionOffer: { ...offer, busy: false } } : e))
      })
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
    try {
      const result = await fundarReino(saveId, name, description)
      setKingdomName(result.kingdomName)
      setKingdomFoundedInfo(null)
    } catch (err) {
      // Hueco de reintento (auditoría de frontend 2026-09-07, decisión confirmada con la usuaria:
      // arreglarlo): si el POST original SÍ tuvo éxito en el backend pero la respuesta se perdió en
      // tránsito (timeout del lado del cliente tras un 200 real), un reintento choca aquí contra el
      // guard de "reino ya fundado" (`reino.ts`, mensaje exacto "Ya has fundado tu reino") — sin
      // este catch, el modal mostraba ese error tal cual y dejaba a la jugadora sin forma clara de
      // seguir. En vez de reventar, se refresca el estado real (el reino SÍ existe) y se reabre el
      // mismo popup ya reconstruido desde lo persistido (`handleReabrirFundacionReino`, fix de
      // 2026-08-04 para el mismo problema de fondo: "recuperar la oportunidad de nombrar perdida").
      if (err instanceof Error && err.message === 'Ya has fundado tu reino') {
        await refreshSave()
        handleReabrirFundacionReino()
        return
      }
      throw err
    }
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

  // Habilidades/barras de habilidades (Fase 12) — ver hooks/useHabilidadesAcciones.ts.
  const {
    handleCreateHabilidad,
    handleSetActiveCombatAbilityNames,
    handleDeleteHabilidad,
    handleUpdateHabilidad,
    handleAttachAbility,
    handleSelectSkillBar,
    handleBackToComposer,
    handleCreateSkillBar,
    handleSaveSkillBarEdit,
    handleDeleteSkillBar,
  } = useHabilidadesAcciones({
    saveId,
    anyModalOpen,
    skillHudView,
    editingSkillBar,
    pendingComposerTextRef,
    setSavedActions,
    setActiveCombatAbilityNames,
    setDetailTarget,
    setSkillBars,
    setSkillHudView,
    setEditingSkillBar,
    setActivePanel,
    setSimpleModal,
    setSaquearZonaModalOpen,
    setHealModalOpen,
    setHungerThirstModalOpen,
    setEntregaModalOpen,
    setAprenderOficioModalOpen,
  })

  // Aceptar/descartar oferta de misión (Fase 12) — ver hooks/useMisionesAcciones.ts.
  const { handleAcceptQuestOffer, handleDismissQuestOffer } = useMisionesAcciones({ saveId, setCharacterLog, setCharacterThinking, setXp, setQuests })

  // Puente entre la tarjeta Matar/Capturar/Clemente del log (LogPanel.tsx § convalecienteOffers,
  // 2026-08-26) y los handlers ya construidos en useCombatFlow.ts — la tarjeta pasa `combatKeyFor`
  // (participantId cuando existe, slug si no), aquí se resuelve contra el `CombatNpcDisplay` real
  // (mismo objeto que ya usa CombatPanel) para reutilizar exactamente la misma lógica que los
  // botones de combate normales.
  //
  // Bug real jugando en vivo (2026-09-03, verificación con Playwright de "Dejar vivir/Capturar en
  // grupo de 2+ del mismo tipo"): resolvía por `n.slug === npcSlug` a secas — con 2+ individuos
  // del mismo tipo en el mismo `CombatEncounter`, `.find()` siempre cogía el PRIMERO del array,
  // nunca necesariamente el que corresponde a la tarjeta que la jugadora pulsó. El backend sí
  // recibía el `participantId` correcto (viaja dentro del `npc` ya resuelto aquí), así que
  // `dismissedGrupo` quedaba bien marcado en la fila real — pero como el objeto local que
  // `useCombatFlow.ts` actualizaba después podía ser el equivocado, la tarjeta persistente seguía
  // mostrándose tras la acción. Mismo hueco exacto que ya se cerró una vez en `useCombatFlow.ts`
  // directamente (2026-08-29), reaparecido en esta capa (`LogPanel.tsx` pasaba solo `npc.slug`, sin
  // `participantId`, a estos 3 handlers).
  function handleMatarConvaleciente(npcKey: string) {
    const npc = combat.combatNpcsDisplay.find((n) => combatKeyFor(n) === npcKey)
    if (npc) combat.handleDecapitarSeleccion([npc])
  }
  function handleCapturarConvaleciente(npcKey: string) {
    const npc = combat.combatNpcsDisplay.find((n) => combatKeyFor(n) === npcKey)
    if (npc) combat.handleCapturarSeleccion(npc)
  }
  function handleClementeConvaleciente(npcKey: string) {
    const npc = combat.combatNpcsDisplay.find((n) => combatKeyFor(n) === npcKey)
    if (npc) combat.handleDejarVivirSeleccion(npc)
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
  // Recolección por texto libre redirigida al mapa (Pieza 6d 2026-09-03; Fase 4 2026-09-28: las
  // habilidades de recolección se retiraron, todo se recolecta/caza desde la zona) — el botón de
  // `entry.harvestSuggestion` en el log abre el modal de movimiento de zona (🧭).
  function handleOpenHarvestSuggestion() {
    if (anyModalOpen) return
    setActivePanel(null)
    setZonaModalOpen(true)
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

  function handleAttachItem(item: InventoryItemInfo) {
    composerRef.current?.insertChip({ icon: '🎒', label: item.name, description: item.description })
    setActivePanel(null)
  }

  // Equipar/desequipar/tirar (Fase 12) — ver hooks/useInventarioAcciones.ts.
  const { handleEquipItem, handleUnequipItem, handleTirarItem } = useInventarioAcciones({ saveId, inventory, setInventory, syncFromSave })

  // Sugerencias de próxima acción bajo demanda (petición explícita, 2026-08-15) — DESACTIVADA
  // (2026-09-06, ver comentario junto a `setSuggestions` más arriba). Comentada entera en vez de
  // borrada: ninguna entrada visible la llama mientras tanto, así que quedaría como código muerto
  // sin usar (`noUnusedLocals`).
  // async function handleRequestSuggestions() {
  //   if (!saveId || suggestionsLoading) return
  //   setSuggestionsLoading(true)
  //   try {
  //     const { suggestions: newSuggestions } = await requestSuggestions(saveId)
  //     setSuggestions(newSuggestions)
  //   } catch (err) {
  //     console.error('[sugerencias] no se pudieron obtener:', err)
  //   } finally {
  //     setSuggestionsLoading(false)
  //   }
  // }

  // Bug real jugando en vivo (2026-08-26, reabierto 2026-08-30 — "se queda en 'Cargando
  // partida...', pero recargar sí la muestra creada"): StrictMode monta-desmonta-remonta este
  // efecto dos veces seguidas en desarrollo. El guard original (`creatingSaveRef.current = true`,
  // solo un booleano) evitaba el doble POST, pero con un efecto colateral no visto entonces: el
  // PRIMER montaje dispara `createSave` con `cancelled=false` en su closure, React ejecuta su
  // cleanup casi de inmediato (`cancelled=true`), y el SEGUNDO montaje (el que sobrevive, con
  // `cancelled=false` en SU closure) se topa con `creatingSaveRef.current` ya en `true` y retorna
  // sin hacer nada — cuando la promesa del PRIMER montaje por fin resuelve, su propio `cancelled`
  // ya es `true`, así que su `navigate(...)` nunca se ejecuta. Ninguna de las dos ejecuciones llega
  // a navegar nunca, aunque el backend sí creó la partida (de ahí que recargar "arregle" el bug: un
  // montaje fresco, sin la carrera de StrictMode ya consumida, sí llega a `navigate`).
  //
  // Fix: el ref pasa a guardar la PROPIA PROMESA en vez de solo `true` — así, sea cual sea la
  // ejecución que sobreviva con `cancelled=false`, puede esperar esa misma promesa (ya en curso o
  // ya resuelta) y navegar ella misma, sin depender de qué montaje disparó el fetch real.
  const creatingSaveRef = useRef<Promise<{ id: string }> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function createNewSave() {
      // Bug #7: recarga en mitad de la creación (mundo/personaje solo viven en memoria) — antes
      // este `return` silencioso dejaba "Cargando partida..." para siempre; ahora se muestra la
      // pantalla de error con botón de volver a partidas.
      if (!selectedWorld || !selectedCharacter) {
        if (!cancelled) setNotFound(true)
        return
      }
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
      if (!creatingSaveRef.current) {
        creatingSaveRef.current = createSave({
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
      }
      try {
        const { id: newId } = await creatingSaveRef.current
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
        // Hallazgo de UX jugando en vivo (2026-09-03): un turno puede tardar minutos (cola de
        // Ollama) — mientras se espera, el composer se deshabilita con el mensaje "Esperando la
        // narración..." (ver disabledReason más abajo), pero ese estado solo vive en memoria de
        // React (characterThinking). Si la jugadora recarga durante la espera, characterLog llega
        // completo desde el backend pero characterThinking vuelve a false: el composer queda
        // deshabilitado SIN NINGÚN mensaje, indistinguible de una avería. La última entrada real
        // (isPlayerAction: true) sin ninguna respuesta después es la misma señal que ya usa
        // pollForResolution para saber cuándo un turno sigue resolviéndose en segundo plano — solo
        // hacía falta engancharla también aquí, no solo en el catch de un envío en curso.
        const lastEntry = save.characterLog[save.characterLog.length - 1]
        if (lastEntry?.isPlayerAction) {
          setCharacterThinking(true)
          setTimedThinkingText('Esperando confirmación del narrador...')
          pollForResolution({
            saveId: save.id,
            logLengthBeforeThisTurn: save.characterLog.length - 1,
            fictionalDate: save.fictionalDateLabel,
            syncFromSave,
            setCharacterLog,
          }).finally(() => {
            if (cancelled) return
            setCharacterThinking(false)
            setTimedThinkingText(null)
          })
        }
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

  // Fin de partida real (sin vidas restantes, 2026-08-31, petición explícita: "Te sacamos de la
  // partida al selector, permitiendote reiniciarla o crear una nueva, pero no seguir jugando ya
  // que es game over") — antes se quedaba en esta misma vista con un mensaje en línea, sin sacar
  // al jugador; ahora navega sola en cuanto `endedAt` se marca, con un breve momento para que se
  // alcance a leer el susurro/aviso de última vez ya narrado en el log.
  useEffect(() => {
    if (!endedAt) return
    const timer = setTimeout(() => navigate('/solitario'), 3500)
    return () => clearTimeout(timer)
  }, [endedAt, navigate])

  // A.1 (checklist frontend 2026-08-27) — handleSubmit (flujo del turno normal) extraído a
  // useTurnFlow.ts, mismo criterio que useCombatFlow.ts (2026-08-21): GameView sigue siendo dueño
  // de todo el "estado de save" (también lo escribe syncFromSave), el hook lo recibe como
  // parámetros. `combat.setCombatAwaitingDefense` se pasa suelto en vez del objeto `combat`
  // entero, para no acoplar el hook a la forma completa de useCombatFlow.
  const cazaPorTextoRef = useRef<(r: ConfirmarCazaResultado) => void>(() => {})
  const { handleSubmit } = useTurnFlow({
    onCazaPorTexto: (r) => cazaPorTextoRef.current(r),
    saveId,
    fictionalDate,
    characterName,
    busyUntil,
    characterThinking,
    endedAt,
    pendingDeathResolution,
    characterLog,
    composerRef,
    buildEntityBanner,
    pollForResolution,
    syncFromSave,
    setCombatAwaitingDefense: combat.setCombatAwaitingDefense,
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
  })

  // Zona/caza/cadáveres (Fase 7) — ver hooks/useZonaAcciones.ts. Va aquí (tras useTurnFlow) porque
  // necesita `handleSubmit`; los usos anteriores en GameView son solo dentro de callbacks/JSX.
  const { zonaModalOpen, setZonaModalOpen, saquearSoloNpcSlug, setSaquearSoloNpcSlug, handleCazarEnZona, handleHuntResolved } =
    useZonaAcciones({ saveId, setCharacterLog, setCombateIniciado, openCombat: combat.openCombat, handleSubmit })
  cazaPorTextoRef.current = handleHuntResolved

  // Modo dinámico/Interactuar/menú de NPC (Fase 12) — ver hooks/useModoDinamico.ts. Va tras
  // useTurnFlow porque necesita `handleSubmit`; los usos anteriores son solo callbacks/JSX.
  const {
    handleInteractuarModoDinamico,
    handleDismissDynamicModeOffer,
    recursoDetalle,
    handleVerRecursoDetalle,
    handleCerrarRecursoDetalle,
    handleAccionRecursoDetalle,
    handleChooseNpcInteraction,
    handleElegirDynamicMode,
    handleSalirDynamicMode,
  } = useModoDinamico({
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
    openCombat: combat.openCombat,
    handleSubmit,
    refetchEnciclopedia,
  })

  // Muerte permanente, botón Aceptar/Reintentar (2026-08-31) — se llama al pulsar el botón que se
  // muestra mientras `pendingDeathResolution` es true. El backend ya decidió (respawn real o
  // reinicio total) de forma determinista; aquí solo recargamos la partida entera para reflejar
  // lo que sea que haya pasado — mismo patrón que classifyResult.transit/blocked en useTurnFlow.ts
  // (recargar en vez de reconstruir el estado a mano).
  async function handleResolveDeath() {
    if (!saveId || resolvingDeath) return
    setResolvingDeath(true)
    try {
      await resolveDeath(saveId)
      // Fase 9 (verificación en vivo 2026-09-29): tras morir en combate, el respawn/reinicio dejaba
      // colgados en React los botones "Combatir / Huir" del combate anterior hasta recargar —
      // `syncFromSave` no toca el estado de combate. La muerte siempre cierra el combate.
      combat.closeCombat()
      const save = await getSave(saveId)
      syncFromSave(save)
    } catch (err) {
      console.error('resolveDeath falló', err)
    } finally {
      setResolvingDeath(false)
    }
  }

  // handleAssignClase/handleAssignEspecializacion ahora viven en useClaseEspecializacionState.ts.

  function handleOpenEnciclopediaClasses() {
    setEnciclopediaInitialCategory('classes')
    setEnciclopediaOpenKey((k) => k + 1)
    setActivePanel('enciclopedia')
  }

  async function handleSpendAttributePoint(attribute: Attribute) {
    if (!saveId) return
    try {
      const result = await spendAttributePoint(saveId, attribute)
      setCharacterAttributes(result.attributes)
      setPendingAttributePoints(result.pendingAttributePoints)
    } catch (err) {
      // C.8 (checklist frontend 2026-08-27) — mismo criterio que `handleRequestSuggestions` (bug
      // real, 2026-08-20: "fallo silencioso indistinguible de caso vacío"): el botón se puede
      // reintentar sin bloquear la partida, pero un fallo real no debe desaparecer sin rastro.
      console.error('spendAttributePoint falló', err)
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
        <button type="button" onClick={() => navigate('/solitario')} className="text-sm text-accent-400 hover:text-accent-300">
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
    reputacion: 'Reputación',
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
    diario: 'accent',
    misiones: 'accent2',
    enciclopedia: 'accent2',
    reputacion: 'accent2',
  }

  return (
    <EnciclopediaLinkProvider
      value={{ enciclopediaIndex, onEntityDetail: handleEntityDetailNavigate, onEntityQuickInsert: handleEntityQuickInsert }}
    >
    <div className="relative flex min-h-0 flex-1 flex-col">
      <header className="iron-band relative flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-2.5">
        <div className="min-w-0">
          <button type="button"
            onClick={() => setConfirmingExit(true)}
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
          <button type="button"
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
          <HungerBar hambre={hambre} />
          <ThirstBar sed={sed} />
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
          <span
            // C.11 (checklist frontend 2026-08-27) — mismo `rounded-full`/`text-2xs` que el badge
            // expandido de MapaPanel (misma info, tratamiento compacto vs. expandido a propósito,
            // ver comentario de abajo — solo se unifica la FORMA del contenedor, no el contenido).
            className="rounded-full border border-iron-700 bg-wood-950/60 px-2.5 py-1 font-serif text-2xs tracking-wide text-wood-300"
            // Estación/clima (2026-08-27, diseño/UX § 4.1: "candidato natural para absorber
            // estación/clima sin que la jugadora tenga que ir a buscarlos a ningún panel... cero
            // clics adicionales") — solo iconos aquí (el detalle completo en texto ya vive en el
            // badge de Mapa > Berig), el `title` da el nombre completo al pasar el ratón.
            title={entorno ? `${entorno.estacion.nombre}${entorno.clima ? ` · ${entorno.clima.nombre}` : ''}` : undefined}
          >
            {fictionalDate}
            {entorno && (
              <>
                {' '}
                {ESTACION_ICON[entorno.estacion.key]}
                {entorno.clima && CLIMA_ICON[entorno.clima.key]}
              </>
            )}
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
          disabledIds={pendingDeathResolution ? DEATH_PENDING_DISABLED_TABS : combat.combatOpen ? COMBAT_DISABLED_CHARACTER_TABS : undefined}
          disabledReason={pendingDeathResolution ? 'muerte-pendiente' : 'combate'}
          onSelect={(id) => setActivePanel((prev) => (prev === id ? null : id))}
        />
        <div
          className={`relative grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden ${
            collapsedSide === 'character' ? 'lg:grid-cols-[2.75rem_1fr]' : collapsedSide === 'world' ? 'lg:grid-cols-[1fr_2.75rem]' : 'lg:grid-cols-2'
          }`}
        >
          {/* Icono de brújula fijado en el centro entre los dos paneles (2026-09-09, petición
              explícita de Álvaro: "en vez de que flote que esté ubicado justo ahí fijado entre los
              divs pero sin ocupar espacio") — `absolute` centrado sobre ESTE contenedor grid (el
              padre inmediato de los 2 paneles, no el div raíz del componente), oculto en el layout
              de 1 columna (`lg:hidden` en el propio grid-cols-1 de móvil no aplica aquí, así que se
              oculta explícitamente por debajo de `lg` donde los paneles ya no están lado a lado).
              Mismas condiciones de visibilidad que antes (sin abrir ningún modal ya abierto), más
              `activePanel` (bug real 2026-09-09, captura de Álvaro: el botón, en `z-40`, se pintaba
              POR ENCIMA del `PanelDrawer` de Mapa/Reputación/Diario/etc., que vive en `z-20` — ese
              drawer nunca contó como "modal" para `anyModalOpen`, así que la brújula tapaba su
              contenido en vez de quedar oculta detrás). */}
          {saveId && !anyModalOpen && !zonaModalOpen && !activePanel && !combateForzadoPendiente && (
            <button
              type="button"
              onClick={() => setZonaModalOpen(true)}
              title="Moverte por la zona"
              className="tactile absolute bottom-1 left-1/2 z-40 hidden h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-accent2-600/60 bg-wood-950/90 text-xl shadow-lg backdrop-blur-sm transition-colors hover:border-accent2-400 hover:bg-wood-900 lg:flex"
            >
              🧭
            </button>
          )}
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
              onDiceRevealAllLanded={combat.triggerExchangeApply}
              emptyHint="Aquí aparecerá lo que le ocurra a tu personaje."
              onCollapse={() => setCollapsedSide('character')}
              collapseIcon="‹"
              onViewFullHistory={() => setActivePanel('diario')}
              characterName={characterName ?? undefined}
              onAcceptQuestOffer={handleAcceptQuestOffer}
              onDismissQuestOffer={handleDismissQuestOffer}
              onInteractuarModoDinamico={handleInteractuarModoDinamico}
              onVerRecursoDetalle={handleVerRecursoDetalle}
              onCazarEnZona={handleCazarEnZona}
              onDismissDynamicModeOffer={handleDismissDynamicModeOffer}
              onChooseNpcInteraction={handleChooseNpcInteraction}
              onOpenHarvestSuggestion={handleOpenHarvestSuggestion}
              combatNpcsDisplay={combat.combatNpcsDisplay}
              onMatarConvaleciente={handleMatarConvaleciente}
              onCapturarConvaleciente={handleCapturarConvaleciente}
              onClementeConvaleciente={handleClementeConvaleciente}
              liveEntryIds={liveRevealedIdsRef.current}
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
              playerActiveEffects={playerActiveEffects}
              energia={energia}
              npcs={combat.combatNpcsDisplay}
              selectedNpcSlug={combat.combatSelectedNpcSlug}
              onSelectNpc={combat.setCombatSelectedNpcSlug}
              // "Cinturón de combate" (2026-08-28) — solo las genéricas (siempre disponibles) +
              // las marcadas activas por el jugador se ofrecen para pulsar en plena pelea. El
              // resto de habilidades aprendidas sigue existiendo, consultable en Habilidades.
              combatAbilities={savedActions.filter(
                (a) => a.category === 'combate' && (a.isGeneric || activeCombatAbilityNames.includes(a.name)),
              )}
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
              // `awaitingNextInitiative` (hallazgo 25a, revisar-partida-hallazgos.md 2026-09-07,
              // useCombatFlow.ts) — `combatBusy` solo cubre la espera de la respuesta del turno,
              // no la animación posterior de `DiceRollVs` (2×ROLL_DURATION_MS) para la iniciativa
              // siguiente: sin esto, el jugador podía lanzar una habilidad mientras los dados
              // todavía están rodando en pantalla.
              busy={combat.combatBusy || combat.awaitingNextInitiative || combat.awaitingExchangeApply}
              ended={combat.combatEnded}
              playerJustDied={combat.combatPlayerJustDied}
              pendingDecisions={combat.combatHasPendingConvalecientes}
              awaitingDefense={combat.combatAwaitingDefense}
              lastInitiativeRoll={lastInitiativeRoll}
              onActuar={combat.handleCombatActuar}
              onRegistrar={combat.handleCombatRegistrar}
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
          <button type="button"
            onClick={handleCancelTransit}
            disabled={cancelingTransit}
            className="tactile rounded-lg border border-iron-700 bg-wood-950/60 px-2.5 py-1 text-2xs text-wood-300 transition-colors hover:border-red-700/60 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelingTransit ? 'Cancelando...' : 'Cancelar acción'}
          </button>
        </div>
      )}

      {combateIniciado && !combat.combatOpen && !endedAt && !pendingDeathResolution && (
        <div className="flex flex-col items-center gap-1.5 border-t border-iron-800 bg-wood-950/90 px-4 py-2 text-center">
          {combat.combatDifficulty && (
            <p className={`text-2xs font-semibold uppercase tracking-[0.1em] ${combat.combatDifficulty.colorClass}`}>
              Dificultad: {combat.combatDifficulty.label}
            </p>
          )}
          <div className="flex items-center justify-center gap-2">
            <button type="button"
              // `() => combat.openCombat()` explícito, no `combat.openCombat` a secas (bug real
              // introducido al añadir `combatOverride`, auditoría 2026-08-21): un handler de
              // `onClick` pasado directo recibe el `MouseEvent` como primer argumento — con
              // `openCombat` aceptando ahora un parámetro opcional, ese evento se habría colado
              // como `combatOverride` (truthy, sin `.npcs`) y reventado en `combate.npcs.map(...)`.
              onClick={() => combat.openCombat()}
              disabled={combat.fleeingPreCombat}
              className="animate-alert-pulse rounded-lg border border-red-700 bg-danger-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-danger-400 shadow-[0_0_14px_-4px_color-mix(in_srgb,var(--color-danger-500)_70%,transparent)] transition-colors hover:bg-danger-500/20 disabled:opacity-50"
            >
              {/* UX 2026-09-01 (hallazgo jugando en vivo): el botón siempre lleva ⚔️ — nunca hubo
                  aquí una condición que cambiara a ❌ (revisado, no existe en ningún componente de
                  combate; el ❌ visto en partida real fue casi seguro un fallback de fuente del
                  sistema sin glifo de espada, no un icono a propósito del juego). El botón nunca
                  está deshabilitado por dificultad — solo por estar ya huyendo — así que ⚠️ en
                  dificultad alta refuerza "puedes combatir pero es arriesgado" sin la ambigüedad
                  de "no disponible" que tendría un aspa junto al texto "Dificultad" de arriba. */}
              {combat.combatDifficulty?.label === 'Difícil' || combat.combatDifficulty?.label === 'Muy difícil' ? '⚠️' : '⚔️'} Combatir
            </button>
            <button type="button"
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
            {characterName} ya no puede seguir — esta partida ha terminado. Volviendo a "Sus partidas"...
          </p>
        </div>
      ) : pendingDeathResolution ? (
        // Muerte permanente, botón Aceptar/Reintentar (2026-08-31) — el susurro de la Entidad ya
        // está en el log (LogPanel, arriba); este bloque sustituye al composer normal hasta que el
        // jugador confirma, mismo criterio visual que el bloque de `endedAt`.
        <div className="animate-entry-in-slow border-t border-iron-800 bg-wood-950/90 px-4 py-5 text-center">
          <div className="animate-line-extend mx-auto mb-3 h-px w-24 origin-center bg-accent-700" />
          <button
            type="button"
            onClick={handleResolveDeath}
            disabled={resolvingDeath}
            className="tactile rounded-lg border border-accent-600 bg-accent-500/10 px-4 py-2 text-sm font-bold uppercase tracking-wide text-accent-300 transition-colors hover:bg-accent-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resolvingDeath ? 'Resolviendo...' : 'Aceptar'}
          </button>
        </div>
      ) : combat.combatOpen && combateIniciado ? (
        // Rework 2026-07-24, recortado en el rediseño de la vista de combate (2026-07-28): sigue
        // sustituyendo al ChatComposer normal en el mismo sitio, pero ahora solo es el input de
        // texto libre — enemigos/ficha/habilidades/objetos/Actuar viven en CombatPanel, arriba.
        <CombatComposer
          freeText={combat.combatFreeText}
          onFreeTextChange={combat.setCombatFreeText}
          onSubmit={combat.handleCombatFreeSubmit}
          busy={combat.combatBusy || combat.awaitingNextInitiative || combat.awaitingExchangeApply}
          ended={combat.combatEnded}
          pendingDecisions={combat.combatHasPendingConvalecientes}
          rematar={combat.combatNpcsDisplay.filter((n) => n.condicion === 'CONVALECIENTE' && n.targetedForKill && !n.dismissed).map((n) => n.name)}
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
              disabled={anyModalOpen || pendingDeathResolution}
              className="tactile mx-4 mb-2 flex items-center gap-2 rounded-lg border border-accent-700/60 bg-accent-500/10 px-3 py-2 text-left text-sm text-accent-200 hover:bg-accent-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-lg leading-none">🔪</span>
              <span>Hay presas caídas sin desollar en esta zona.</span>
            </button>
          )}
          {/* Sugerencias desactivadas (2026-09-06, decisión explícita de la usuaria: "son
              malísimas y no aportan casi ningún valor... por ahora lo descartamos... dejándolo
              pendiente por si algún día lo mejoramos") — solo se oculta la entrada visible
              (SuggestionBar + botón "Sugerir" del composer), sin borrar `handleRequestSuggestions`/
              `requestSuggestions` ni el endpoint de generación, por si se retoma más adelante. */}
          {(() => {
            // A.4 (checklist frontend 2026-08-27): `anyModalOpen` cubre postCombatTarget/
            // activeDynamicMode/detailTarget/kingdomFoundedInfo — antes el composer seguía editable
            // por debajo de esos modales pese a estar tapado visualmente. Mismo cálculo reutilizado
            // para el toggle y la SkillBar (2026-08-29) — ninguno de los dos debe quedar activo
            // cuando el composer normal tampoco lo estaría.
            const composerDisabled = characterThinking || !!busyUntil || (!!combateIniciado && !combat.combatOpen) || anyModalOpen
            // Toggle a la IZQUIERDA de la propia fila del composer/barra, no encima en su propia
            // línea (2026-08-29, feedback en vivo, segunda vuelta: "no bajaste el botón... a la
            // izquierda donde te dije") — mismo slot visual que la barra, `leftSlot` de
            // `ChatComposer` lo inserta en la MISMA fila flex que el panel de texto, compartiendo
            // el borde/fondo exterior en vez de duplicarlo con una franja aparte. Solo se muestra
            // en la vista `composer` — las otras 2 vistas (menú-barras/barra-activa) ya tienen su
            // propia forma de volver (botón Atrás o ⌨️ directo).
            const skillToggle = !combateIniciado && skillHudView.screen === 'composer' && (
              <TooltipAnchor text="Elegir una habilidad por botón en vez de escribir">
                <button
                  type="button"
                  onClick={() => setSkillHudView({ screen: 'menu-barras' })}
                  disabled={composerDisabled}
                  aria-label="Habilidades"
                  className="skill-slot tactile"
                >
                  <span aria-hidden="true">✨</span>
                </button>
              </TooltipAnchor>
            )
            const activeBar = skillHudView.screen === 'barra-activa' ? skillBars.find((b) => b.id === skillHudView.skillBarId) : undefined
            return (
              <>
                {!combateIniciado && skillHudView.screen === 'menu-barras' ? (
                  <div className="border-t border-iron-800 bg-wood-950/90 px-4 pb-3 pt-3.5">
                    <SkillBarMenu
                      skillBars={skillBars}
                      onNavigate={setSkillHudView}
                      onSelectBar={handleSelectSkillBar}
                      onCreateBar={handleCreateSkillBar}
                      onEditBar={setEditingSkillBar}
                      onDeleteBar={handleDeleteSkillBar}
                    />
                  </div>
                ) : !combateIniciado && skillHudView.screen === 'barra-activa' && activeBar ? (
                  <div className="border-t border-iron-800 bg-wood-950/90 px-4 pb-3 pt-3.5">
                    <SkillBarHud
                      bar={activeBar}
                      savedActions={savedActions}
                      onUse={handleAttachAbility}
                      onBackToComposer={handleBackToComposer}
                      onBackToBars={() => setSkillHudView({ screen: 'menu-barras' })}
                      onEdit={() => setEditingSkillBar(activeBar)}
                      disabled={composerDisabled}
                    />
                  </div>
                ) : (
                  <ChatComposer
                    ref={composerRef}
                    onChange={setInput}
                    onSubmit={handleSubmit}
                    disabled={composerDisabled}
                    leftSlot={skillToggle}
                    // B.24 (checklist frontend 2026-08-27) — antes el texto de ayuda era siempre el
                    // mismo sin importar por qué el composer estaba apagado; orden de prioridad = el
                    // primero que aplique de verdad (characterThinking/busyUntil son los más
                    // frecuentes en la práctica).
                    // Pista de combate (bug real jugando en vivo, 2026-09-03, "narración lenta e
                    // indistinguible de un turno atascado" — hallazgo de UX, no arquitectura: el
                    // combate se resuelve siempre de forma síncrona vía `characterThinking`, sin
                    // `busyUntil`/countdown, así que un turno de combate/caza más lento que el
                    // habitual daba el mismo mensaje genérico que uno realmente colgado).
                    // `combateIniciado` (no `combat.combatOpen`, que exige el panel ya abierto) es
                    // la señal disponible ANTES de que vuelva la respuesta.
                    disabledReason={
                      characterThinking
                        ? combateIniciado
                          ? 'Resolviendo el combate — puede tardar más de lo habitual...'
                          : 'Esperando la narración de tu último turno...'
                        : busyUntil
                          ? 'Ocupado con algo que lleva tiempo — vuelve cuando termine.'
                          : combateIniciado && !combat.combatOpen
                            ? 'En combate — usa el panel de combate para actuar.'
                            : anyModalOpen
                              ? 'Resuelve lo que tienes abierto antes de escribir una nueva acción.'
                              : undefined
                    }
                  />
                )}
              </>
            )
          })()}
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
          onTirar={handleTirarItem}
          onSaveAbility={handleUpdateHabilidad}
          onDeleteAbility={handleDeleteHabilidad}
          onInsert={detailInsertHandler ?? undefined}
          worldSlug={worldIdSlug}
        />
      )}

      {kingdomFoundedInfo && (
        <KingdomFoundingModal info={kingdomFoundedInfo} onCancel={() => setKingdomFoundedInfo(null)} onConfirm={handleFundarReino} />
      )}

      {/* Elección obligatoria de clase al empezar a jugar (2026-09-01, fix de bug real: personaje
          custom sin clase para siempre) — overlay bloqueante, mismo criterio de prioridad que
          muerte/fin de partida. Nunca coincide con el modal de especialización de abajo:
          pendingEspecializacionChoice exige `save.clase` ya asignada. */}
      {pendingClaseChoice && !pendingDeathResolution && !endedAt && worldIdSlug && (
        <ClaseModal clases={clasesDisponibles} worldSlug={worldIdSlug} onConfirm={handleAssignClase} />
      )}

      {/* Elección obligatoria de especialización a nivel 10 (2026-09-01) — overlay bloqueante,
          mismo criterio de prioridad que el resto de estados excluyentes de la partida: la muerte
          permanente/fin de partida ganan si coinciden (no debería pasar de verdad: resolver una
          muerte no sube de nivel), especialización solo se muestra si ninguna de esas dos aplica. */}
      {pendingEspecializacionChoice && !pendingDeathResolution && !endedAt && clase && worldIdSlug && (
        <EspecializacionModal
          clase={clase}
          especializaciones={especializacionesDisponibles}
          worldSlug={worldIdSlug}
          onConfirm={handleAssignEspecializacion}
          onOpenEnciclopedia={handleOpenEnciclopediaClasses}
        />
      )}

      {confirmingExit && (
        <ConfirmModal
          title="Salir a tus partidas"
          message="¿Seguro que quieres salir? Tu progreso ya está guardado — puedes volver a esta partida cuando quieras."
          confirmLabel="Salir"
          tone="accent"
          onCancel={() => setConfirmingExit(false)}
          onConfirm={() => {
            // Bug real (2026-09-04, "la url se actualiza pero no vuelve a la selección de
            // partida"): `navigate()` sin cerrar el modal antes lo dejaba montado por encima de la
            // vista nueva (z-50, overlay a pantalla completa) — la ruta cambiaba de verdad, pero
            // visualmente seguía tapada.
            setConfirmingExit(false)
            // Bug real (2026-07-24, "al darle a salir de la partida, que me lleve a las partidas
            // no a seleccionar mundo"): CharacterSaves resuelve el personaje por id contra
            // `pregeneratedCharacters` o `selectedCharacter` (SessionContext, en memoria, se
            // pierde al recargar) — tras recargar GameView directamente, ninguna de las dos vías
            // resuelve nada (aquí nunca se manda un id de personaje real, sino `saveId`), así que
            // caía al aviso de "elige mundo y personaje". `characterName` va por query, como
            // respaldo que CharacterSaves ya puede usar sin depender de esa sesión en memoria.
            navigate(`/solitario/mundo/${worldIdSlug}/personaje/${saveId}?characterName=${encodeURIComponent(characterName ?? '')}`)
          }}
        />
      )}

      {harvestModal && saveId && characterAttributes && (
        <HarvestSelectionModal
          saveId={saveId}
          oficio={harvestModal.oficio}
          oficioLabel={harvestModal.label}
          highlightSourceSlug={harvestModal.highlightSourceSlug}
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
                .then(({ sources }) => checkCarcassPending(sources.length > 0))
                .catch(() => {})
            }
            setHarvestModal(null)
          }}
          onCancel={() => setHarvestModal(null)}
        />
      )}


      {simpleModal === 'camp' && saveId && (
        <CampSelectionModal saveId={saveId} onSelect={handleSimpleModalSelect} onCancel={closeSimpleModal} bloqueoTurno={bloqueoTurno} />
      )}
      {simpleModal === 'travel' && saveId && (
        <TravelDestinationModal saveId={saveId} onSelect={handleSimpleModalSelect} onCancel={closeSimpleModal} bloqueoTurno={bloqueoTurno} />
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

      {hungerThirstModalOpen && (
        <HungerThirstSelectionModal
          inventory={inventory}
          hambre={hambre}
          sed={sed}
          onConfirm={(actionText, hambreSedItemUses) => {
            setHungerThirstModalOpen(false)
            handleSubmit(actionText, { hambreSedItemUses })
          }}
          onCancel={() => setHungerThirstModalOpen(false)}
        />
      )}

      {editingSkillBar && (
        <SkillBarEditor
          bar={editingSkillBar}
          savedActions={savedActions}
          onSave={handleSaveSkillBarEdit}
          onCancel={() => setEditingSkillBar(null)}
        />
      )}

      {entregaModalOpen && saveId && (
        <EntregaModal
          saveId={saveId}
          onEntregado={(itemId, logEntry) => {
            setInventory((prev) => prev.filter((i) => i.id !== itemId))
            setCharacterLog((prev) => [...prev, { ...logEntry, channel: 'character' }])
            setFictionalDate(logEntry.timeLabel)
            setEntregaModalOpen(false)
          }}
          onCancel={() => setEntregaModalOpen(false)}
        />
      )}

      {aprenderOficioModalOpen && saveId && (
        <AprenderOficioModal
          saveId={saveId}
          onAprendido={(professionId, costeGoirnos, logEntry) => {
            setProfessionProgress((prev) => [...prev, { professionId, nivel: 1, xp: 0 }])
            setGoirnos((prev) => Math.max(0, prev - costeGoirnos))
            setCharacterLog((prev) => [...prev, { ...logEntry, channel: 'character' }])
            setFictionalDate(logEntry.timeLabel)
            setAprenderOficioModalOpen(false)
          }}
          onCancel={() => setAprenderOficioModalOpen(false)}
        />
      )}

      {saquearZonaModalOpen && saveId && (
        <SaquearZonaModal
          saveId={saveId}
          soloNpcSlug={saquearSoloNpcSlug ?? undefined}
          onConfirm={(actionText, lootItemNames) => {
            setSaquearZonaModalOpen(false)
            setSaquearSoloNpcSlug(null)
            combat.submitCombatAction(actionText, { lootItemNames, allowAfterEnded: true })
          }}
          onCancel={() => {
            setSaquearZonaModalOpen(false)
            setSaquearSoloNpcSlug(null)
          }}
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
        />
      )}

      {zonaModalOpen && saveId && (
        <ZonaMovimientoModal
          saveId={saveId}
          onEncuentroZona={(entry) => setCharacterLog((prev) => [...prev, entry])}
          onClose={() => setZonaModalOpen(false)}
          // Icono de salida de región (2026-09-17) — mismo patrón que `handleSimpleModalSelect`:
          // cierra el modal de zona y manda el texto por el turno normal, como si el jugador lo
          // hubiera escrito él mismo (el motor de viaje determinista decide el resto).
          onViajarA={(actionText) => {
            setZonaModalOpen(false)
            handleSubmit(actionText)
          }}
          bloqueoTurno={bloqueoTurno}
          // Icono de parcela (§ 7.4, 2026-09-21) — roster estático ya cargado por useRecipesData
          // (nombre/descripción por recipeKey) + refreshSave (mismo callback que ya usa ReinoPanel
          // tras "Descansar en campamento", una acción directa sin /turn/narrate).
          professionRecipes={professionRecipes}
          onRefreshSave={refreshSave}
          // Alejarse andando de una oferta pacífica la descarta en el backend (2026-09-28) — se
          // retira su tarjeta para no dejar un "Interactuar" huérfano en el log.
          // Cadáveres en el mapa (Fase 5, 2026-09-28) — el pin ya caminó hasta el cadáver y cerró el
          // mapa; aquí solo se abre el modal real (mismos que usaban el botón Saquear y el aviso de
          // escena de Desollar).
          onSaquearCadaver={(npcSlug) => {
            setSaquearSoloNpcSlug(npcSlug)
            setSaquearZonaModalOpen(true)
          }}
          onDesollarCadaver={() => setHarvestModal({ oficio: 'desollador', label: 'Desollar' })}
          onHoraActualizada={setFictionalDate}
          onOfertaDescartada={() =>
            setCharacterLog((prev) => prev.map((e) => (e.dynamicModeOffer && !e.dynamicModeOffer.combateForzado ? { ...e, dynamicModeOffer: undefined } : e)))
          }
        />
      )}

      {recursoDetalle && (
        <RecursoDetalleModal
          nombre={recursoDetalle.targetName}
          metodo={recursoDetalle.metodo}
          entry={enciclopediaData?.faunaFlora.find((f) => f.sourceSlug === recursoDetalle.targetSlug)}
          onAccion={handleAccionRecursoDetalle}
          onCerrar={handleCerrarRecursoDetalle}
        />
      )}

      {activeDynamicMode && (
        <DynamicModeModal
          turno={activeDynamicMode.turno}
          busy={activeDynamicMode.busy}
          error={activeDynamicMode.error}
          imageUrl={activeDynamicMode.imageUrl}
          onElegir={handleElegirDynamicMode}
          onCerrar={() => setActiveDynamicMode(null)}
          onSalir={handleSalirDynamicMode}
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
            />
          )}
          {activePanel === 'reputacion' && (
            <ReputacionPanel factionsStatus={factionsStatus} factions={enciclopediaData?.factions ?? []} worldSlug={worldIdSlug} saveId={saveId} />
          )}
          {activePanel === 'mapa' && (
            <MapaPanel
              worldSlug={worldIdSlug}
              saveId={saveId}
              currentLocation={currentLocation}
              destinations={destinations}
              inventory={inventory}
              quests={quests}
              buildings={buildings}
              entorno={entorno}
              onViajar={() => {
                setSimpleModal('travel')
                setActivePanel(null)
              }}
              onEncuentroZona={(entry) => setCharacterLog((prev) => [...prev, entry])}
            />
          )}
          {activePanel === 'diario' && saveId && <DiarioPanel saveId={saveId} />}
          {activePanel === 'inventario' && saveId && (
            <InventarioPanel
              saveId={saveId}
              items={inventory}
              goirnos={goirnos}
              capacity={inventoryCapacityFor(
                characterAttributes,
                inventory.filter((i) => i.slot !== null),
              )}
              onUse={handleAttachItem}
              onDetail={handleItemDetail}
              onRefreshSave={refreshSave}
            />
          )}
          {activePanel === 'companeros' && saveId && (
            <CompanerosPanel saveId={saveId} companions={companions} inventory={inventory} onRefreshSave={refreshSave} plantillasEquipo={plantillasEquipo} />
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
              professionRecipes={professionRecipes}
              factions={enciclopediaData?.factions ?? []}
              goirnos={goirnos}
              activeSubTab={reinoSubTab}
              onSubTabChange={setReinoSubTab}
              recipesStatus={recipesStatus}
              onBuild={(actionText) => handleSubmit(actionText)}
              bloqueoTurno={bloqueoTurno}
            />
          )}
          {activePanel === 'enciclopedia' && (
            <EnciclopediaPanel
              key={enciclopediaOpenKey}
              data={enciclopediaData}
              loading={enciclopediaLoading}
              recipesStatus={recipesStatus}
              onInsert={handleEnciclopediaInsert}
              onDetail={handleEnciclopediaDetail}
              initialCategory={enciclopediaInitialCategory}
            />
          )}
          {activePanel === 'habilidades' && (
            <HabilidadesPanel
              savedActions={savedActions}
              combatSlots={combatSlots}
              activeCombatAbilityNames={activeCombatAbilityNames}
              onChangeActiveCombatAbilityNames={handleSetActiveCombatAbilityNames}
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
