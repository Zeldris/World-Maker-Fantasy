import { useNoticiasMundo } from '../hooks/useNoticiasMundo'
import { useGamePhase } from '../hooks/useGamePhase'
import { useEncuentroForzado } from '../hooks/useEncuentroForzado'
import { usePresence } from '../hooks/usePresence'
import { accionDeTecla } from '../lib/atajos'
import { useAjustes } from '../context/useAjustes'
import { useNotificaciones } from '../hooks/useNotificaciones'
import { notificacionesDeEntrada } from '../lib/notificaciones'
import { avisoDeLlegadas, pesoDeLlegada } from '../lib/llegadas'
import { useDecisionesEnCola } from '../hooks/useDecisionesEnCola'
import { resolverCapas, type CapaAbierta } from '../lib/capas'
import { etiquetaDeFase } from '../lib/gamePhase'
import { combateTrasResync } from '../lib/combateResync'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSession } from '../context/useSession'
import type { ChatComposerHandle } from '../components/ChatComposer'
import type { ComposerChip } from '../types'
// Sugerencias desactivadas (2026-09-06, ver comentario junto a `suggestions` más abajo) —
// `SuggestionBar` deja de importarse mientras la entrada visible está oculta.
// import { SuggestionBar } from '../components/SuggestionBar'
import type { SkillHudView } from '../components/SkillBarMenu'
import { type PanelId } from '../components/NavTabs'
import { debeAvisar } from '../lib/noticias'
import { useRumoresDelMapa } from '../hooks/useRumoresDelMapa'
import { SLOT_LABEL, isCompatibleWithSlot } from '../lib/equipSlots'
import { type PersonajeSubTab } from '../components/panels/PersonajePanel'
import { type DetailTarget } from '../components/DetailModal'
import { useEnciclopedia } from '../hooks/useEnciclopedia'
import { useEntityBanner } from '../hooks/useEntityBanner'
import { useReconnectionPolling } from '../hooks/useReconnectionPolling'
import { useSurroundingsPolling } from '../hooks/useSurroundingsPolling'
import { useSupervivenciaSync } from '../hooks/useSupervivenciaSync'
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
import { type ReinoSubTab } from '../components/panels/ReinoPanel'
import { type MisionesValue } from '../context/misionesContext'
import { REINO_ABILITY_RECIPE_KEY } from '../data/reinoRecipes'
import {
  requestTurnClassify,
  createSave,
  getSave,
  pauseSave,
  resumeSave,
  spendAttributePoint,
  fundarReino,
  type ConfirmarCazaResultado,
  getRecolectarLocalizado,
  resolveImageUrl,
  resolveDeath,
  getAvisosTablon,
  leerBandosTablon,
  aceptarAviso,
  entregarMision,
  abandonarMision,
  type AvisoMisionInfo,
  type BandoInfo,
  type SaveDetail,
} from '../lib/api'
import { characterWaitingFlavor, combatWaitingFlavor, worldWaitingFlavor, useRotatingFlavor } from '../lib/waitingFlavor'
import { combatKeyFor } from '../lib/gameViewHelpers'
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


/// BAS-5 (hito 0.2): el estado y los manejadores de la partida, fuera de `GameView` para que
/// `GameModals` y `GameLayout` lo lean del contexto (`GameViewContext`) en vez de por props.
export function useGameViewState() {
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
  // UX-16 (hito 0.1, H16) — por qué no se pudo crear la partida nueva: sin la selección del
  // asistente (no debería pasar ya, ver SessionContext) o un fallo real de `createSave`.
  const [creacionError, setCreacionError] = useState<'sin-seleccion' | 'fallo' | null>(null)
  const [reintentosCreacion, setReintentosCreacion] = useState(0)
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
  // Fase G del 0.1 (hallazgo G8): al cerrar un combate 1v1 contra fauna, el cadáver ya estaba
  // en el backend pero «Hay presas caídas sin desollar» no salía hasta cambiar de escena (la
  // comprobación de arriba solo mira la ubicación). Se recomprueba al pasar de combate a sin combate.
  const habiaCombateRef = useRef(false)
  useEffect(() => {
    const hayCombate = combateIniciado !== null
    const acabaDeTerminar = habiaCombateRef.current && !hayCombate
    habiaCombateRef.current = hayCombate
    if (!acabaDeTerminar || !saveId) return
    getRecolectarLocalizado(saveId, 'desollador')
      .then(({ sources }) => checkCarcassPending(sources.length > 0))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `checkCarcassPending` es un setter con nombre, estable en la práctica (mismo criterio que el efecto de ubicación de arriba)
  }, [combateIniciado, saveId])
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
  const COMBAT_DISABLED_WORLD_TABS: PanelId[] = ['mapa', 'diario', 'leyendas', 'misiones']

  // Muerte pendiente de resolver (auditoría de código backend 2026-09-07, decisión confirmada con
  // la usuaria: "bloquear todo hasta Aceptar") — el composer ya se bloqueaba
  // (`pendingDeathResolution` más abajo, criterio de `busy`), pero ningún panel de acción lo hacía:
  // con el personaje MUERTO y el susurro de la Entidad ya narrado, se podía seguir equipando
  // objetos, gestionando el Almacén/Reino o crafteando una habilidad nueva. Backend ya rechaza estas
  // mutaciones con 409 (`rejectIfPendingDeath`) — esto es solo el reflejo visual, mismo criterio que
  // ya usa `COMBAT_DISABLED_CHARACTER_TABS`.
  const DEATH_PENDING_DISABLED_TABS: PanelId[] = ['inventario', 'companeros', 'reino', 'habilidades']

  const [quests, setQuests] = useState<QuestInfo[]>([])
  // CR-40 (40g): avisos abiertos (un tablón o la propuesta de un NPC).
  const [avisosAbiertos, setAvisosAbiertos] = useState<{ titulo: string; subtitulo?: string; avisos: AvisoMisionInfo[]; vacio: string; cargando: boolean; bandos?: BandoInfo[] } | null>(null)

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
  // P288: `syncFromSave` lo llaman sondeos que pueden guardar un cierre viejo; el ref lee el valor actual.
  const combatOpenRef = useRef(combat.combatOpen)
  combatOpenRef.current = combat.combatOpen

  // Guard de exclusión mutua entre modales de acción (checklist frontend 2026-08-27, A.2) —
  // `anyActionModalOpen` (useActionModalsState.ts) cubre los 6 modales de ese hook; aquí se añaden
  // los 3 que viven fuera de él (detailTarget/kingdomFoundedInfo de este componente,
  // combat.combatOpen de useCombatFlow) para tener un único punto de verdad de "hay algo abierto
  // encima del juego ahora mismo" antes de decidir si se abre uno nuevo.
  // UX-10 (hito 0.2) — clase, especialización y fundar reino esperan a que acabe el combate, la
  // escena o la narración y a que dé tiempo a leer lo último; la cabecera avisa y deja abrirlas antes.
  const clasePendiente = !!pendingClaseChoice && !pendingDeathResolution && !endedAt && !!worldIdSlug
  const especializacionPendiente = !!pendingEspecializacionChoice && !pendingDeathResolution && !endedAt && !!clase && !!worldIdSlug
  const decisiones = useDecisionesEnCola({
    hayDecision: clasePendiente || especializacionPendiente || !!kingdomFoundedInfo,
    bloqueada: !!combateIniciado || combat.combatOpen || !!activeDynamicMode || characterThinking,
    ultimaNarracion: characterLog[characterLog.length - 1]?.text ?? '',
  })
  const reinoVisible = !!kingdomFoundedInfo && decisiones.mostrar
  const avisoDecision = clasePendiente
    ? 'Tienes una clase por elegir'
    : especializacionPendiente
      ? 'Tienes una especialización por elegir'
      : 'Tu reino espera nombre'
  const anyModalOpen = anyActionModalOpen || !!detailTarget || reinoVisible || combat.combatOpen
  // Un agresivo te corta el paso (2026-09-28) — la brújula se oculta hasta reaccionar (el backend
  // rechaza igualmente moverse con 409, esto solo evita ofrecer algo que no se puede hacer).
  // P116: el servidor decide con la oferta guardada, no con la tarjeta del registro; cuentan las dos.
  const { encuentroForzado: combateForzadoPendiente, guardarOferta: guardarOfertaForzada } = useEncuentroForzado(characterLog)
  // Elecciones obligatorias a la vista (cuando la cola de UX-10 las deja salir).
  const claseVisible = clasePendiente && decisiones.mostrar
  const especializacionVisible = especializacionPendiente && decisiones.mostrar
  // UX-1/UX-2 (hito 0.2) — una sola fase de partida y su matriz de permisos (lib/gamePhase.ts) en
  // vez de banderas sueltas.
  const { fase, puede } = useGamePhase({
    terminada: !!endedAt,
    muertePendiente: pendingDeathResolution,
    enCombate: !!combateIniciado || combat.combatOpen,
    modoDinamico: !!activeDynamicMode,
    narradorEscribiendo: characterThinking,
    eleccionAbierta: claseVisible || especializacionVisible || reinoVisible,
    encuentroPendiente: combateForzadoPendiente,
    ocupado: !!busyUntil,
  })
  const permisoTurno = puede('enviarTurno')
  // UX-3 (hito 0.1) — deshabilita con su motivo los botones que lanzan un turno fuera del composer
  // (Construir, Viajar, Campamento, salida de zona); desde UX-2 el motivo sale de la matriz.
  const bloqueoTurno = permisoTurno.motivo
  // UX-5 (hito 0.2) — paneles en modo consulta: se abren y se leen, pero lo que cambia datos se
  // deshabilita con el motivo (contexto ModoConsulta).
  const modoConsulta = puede('modificarPanel').motivo
  // BAS-7 (hito 0.2) — el cajón se mantiene montado mientras hace su animación de salida.
  const { mostrado: panelMostrado, saliendo: panelSaliendo } = usePresence(activePanel, 220)
  // UX-12 (hito 0.2) — lo que llega al registro con el cajón abierto (lib/llegadas.ts): lo crítico
  // lo cierra, lo importante avisa dentro del cajón, lo menor no interrumpe. `inicioCajon` es la
  // longitud del registro al abrirlo; null en el render de apertura, para no tomar como recién
  // llegado todo lo anterior.
  const [inicioCajon, setInicioCajon] = useState<number | null>(null)
  const cajonAbierto = !!activePanel
  useEffect(() => {
    setInicioCajon(cajonAbierto ? characterLog.length : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cajonAbierto])
  const llegadasCajon = activePanel && inicioCajon !== null ? characterLog.slice(inicioCajon) : []
  const llegaCritico = llegadasCajon.some((e) => pesoDeLlegada(e) === 'critico')
  useEffect(() => {
    if (llegaCritico) setActivePanel(null)
  }, [llegaCritico, setActivePanel])
  // P232: el turno que abre combate cierra el cajón por el cambio de estado de combate (no por una
  // marca en la entrada del diario: el backend la guarda sin ella y se vería distinta tras recargar).
  const hayCombateIniciado = !!combateIniciado && combateIniciado.npcs.length > 0
  useEffect(() => {
    if (hayCombateIniciado) setActivePanel(null)
  }, [hayCombateIniciado, setActivePanel])
  const avisoLlegadas = avisoDeLlegadas(llegadasCajon)
  // UX-7 (hito 0.2) — la brújula y el mapa de zona: moverse solo en `libre`.
  const permisoMover = puede('moverse')
  const etiquetaFase = etiquetaDeFase(fase)

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

  // Fase D (hito 0.1) — noticias del mundo escritas en segundo plano, sin esperar a recargar.
  // HUD-6 (hito 0.2) — notificaciones (toasts): misiones, reputación, oficio, objetos nuevos y
  // noticias del mundo (lib/notificaciones.ts).
  const { notificaciones, notificar, descartar: descartarNotificacion } = useNotificaciones()
  const { ajustes: ajustesAvisos } = useAjustes()
  // NAR-9: suceso al que lleva «Ver en Leyendas» desde una noticia.
  const [leyendaPedida, setLeyendaPedida] = useState<string | null>(null)
  // INT-9: rumores con lugar para el mapa de Berig (pergamino hasta que se leen).
  const rumoresDelMapa = useRumoresDelMapa(saveId ?? null, worldLog)
  const noticiasMundo = useNoticiasMundo({
    saveId,
    worldLog,
    setWorldLog,
    characterThinking,
    // CFG-35: solo lo que pasa del umbral elegido en Ajustes (por defecto, lo importante).
    onNuevas: (entradas) =>
      entradas
        .filter((e) => debeAvisar(e.noticia, ajustesAvisos.avisosSucesos))
        .forEach((e) => {
          const sucesoId = e.noticia?.sucesoId
          notificar({
            tipo: 'accent2',
            icono: '📜',
            texto: e.text.length > 90 ? `${e.text.slice(0, 88)}…` : e.text,
            // UX-36: cada aviso de un suceso lleva a su entrada de Leyendas.
            ...(sucesoId ? { enlace: { label: 'Ver en Leyendas', alPulsar: () => { setLeyendaPedida(sucesoId); setActivePanel('leyendas') } } } : {}),
          })
        }),
  })
  // P219 (c): condición, Hambre y Sed que el worker cambia en BD entre turnos. P323: si la condición empeora, avisa.
  useSupervivenciaSync({
    saveId,
    characterThinking,
    combatActive: !!combateIniciado,
    condicionFisica,
    alEmpeorar: (aviso) => notificar({ tipo: 'danger', icono: '🍖', texto: aviso }),
    setCondicionFisica,
    setHambre,
    setSed,
  })
  // Avisos de las entradas nuevas del registro llegadas en vivo (no las de la carga de la partida).
  const procesadasRef = useRef(0)
  useEffect(() => {
    const nuevas = characterLog.slice(procesadasRef.current)
    procesadasRef.current = characterLog.length
    for (const e of nuevas) {
      if (liveRevealedIdsRef.current.has(e.id)) notificacionesDeEntrada(e).forEach(notificar)
    }
  }, [characterLog, notificar])
  // Objetos nuevos en el inventario: `syncFromSave` apunta los que ya había (carga, reconexión), así
  // solo avisa de lo que llega con un turno.
  const inventarioConocidoRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    for (const item of inventory) {
      if (!inventarioConocidoRef.current.has(item.id)) {
        inventarioConocidoRef.current.add(item.id)
        notificar({ tipo: 'moss', icono: '🎒', texto: `Obtienes ${item.name}` })
      }
    }
  }, [inventory, notificar])

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
    if (!action || !saveId || !puede('enviarTurno').permitido) return

    const timer = setTimeout(() => {
      requestTurnClassify({ saveId, action, preview: true }).catch(() => {})
    }, 1500)

    return () => clearTimeout(timer)
  }, [input, saveId, puede])

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
    guardarOfertaForzada(save.pendingDynamicModeOffer)
    setWorldLog(save.worldLog)
    setKingdomLog(save.kingdomLog)
    inventarioConocidoRef.current = new Set(save.inventory.map((i) => i.id))
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
    // P288: y se limpia si la partida ya no tiene combate (ver `combateTrasResync`).
    setCombateIniciado((actual) => combateTrasResync(save.combateIniciado, actual, combatOpenRef.current))
    if (save.combateIniciado && save.combateIniciado.npcs.length > 0) {
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

  // CR-40 (40g): misiones secundarias del motor — abrir un tablón, la propuesta de un NPC, aceptar,
  // entregar y abandonar. El backend escribe el registro; aquí se resincroniza la partida.
  const misionesValue: MisionesValue = {
    abrirTablon: (buildingId) => {
      if (!saveId) return
      setAvisosAbiertos({ titulo: 'Tablón de avisos', avisos: [], vacio: '', cargando: true })
      // Solo si el modal sigue abierto esperando esta lectura: cerrarlo (o abrir otra cosa) antes de
      // que llegue la respuesta no debe reabrirlo.
      // CR-18 (18d): los bandos se leen a la vez (un fallo ahí no impide ver los avisos).
      Promise.all([getAvisosTablon(saveId, buildingId), leerBandosTablon(saveId, buildingId).catch(() => ({ bandos: [] as BandoInfo[] }))])
        .then(([{ tablon, avisos }, { bandos }]) => {
          // Lo leído en los bandos acaba de llegar a «El mundo».
          if (bandos.length > 0) void noticiasMundo.traer()
          setAvisosAbiertos((prev) =>
            prev?.cargando
              ? {
                  titulo: tablon.nombre.charAt(0).toUpperCase() + tablon.nombre.slice(1),
                  subtitulo: tablon.faccion ?? 'Avisos de las facciones con las que tienes tratado o alianza',
                  avisos,
                  vacio: 'No hay avisos colgados ahora mismo. Vuelve en unos días.',
                  cargando: false,
                  bandos,
                }
              : prev,
          )
        })
        .catch(() => setAvisosAbiertos((prev) => (prev?.cargando ? { titulo: 'Tablón de avisos', avisos: [], vacio: 'No se pudo leer el tablón.', cargando: false } : prev)))
    },
    mostrarOfertaNpc: (npcName, aviso) =>
      // P180 (QA-27): «Trabajo de Orco desconocido» ponía el nombre en mayúscula a media frase; el título es
      // la pregunta y el nombre va debajo.
      setAvisosAbiertos({ titulo: '¿Tienes trabajo?', subtitulo: npcName, avisos: aviso ? [aviso] : [], vacio: `${npcName} no tiene ningún encargo para ti ahora mismo.`, cargando: false }),
  }
  async function handleAceptarAviso(avisoId: string) {
    if (!saveId) return
    await aceptarAviso(saveId, avisoId)
    await refreshSave()
  }
  async function handleEntregarMision(questId: string) {
    if (!saveId) return
    await entregarMision(saveId, questId)
    await refreshSave()
  }
  async function handleAbandonarMision(questId: string) {
    if (!saveId) return
    await abandonarMision(saveId, questId)
    await refreshSave()
  }

  // Fase G del 0.1 (hallazgo G12): al morir en combate, la respuesta del turno no trae la nota de
  // la Entidad (es una LogEntry aparte) ni el turno de combate aplicaba `pendingDeathResolution` —
  // al salir de «Derrota» el juego quedaba con «Muerto» arriba, sin nota, sin «Aceptar» y con el
  // cuadro de texto activo hasta recargar. Se resincroniza la partida al salir tras morir.
  function handleContinuarTrasCombate() {
    const murio = combat.combatPlayerJustDied
    combat.closeCombat()
    if (murio) refreshSave().catch(() => {})
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
  const { handleAcceptQuestOffer, handleDismissQuestOffer } = useMisionesAcciones({ saveId, setCharacterLog, setCharacterThinking, setXp, setQuests, setInventory })

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

  // Responder escribiendo (petición de la usuaria, 2026-10-02) — desde la tarjeta de quien te habla:
  // vuelve al composer (aunque estuviera la barra de habilidades o un panel abierto) con «Le digo a
  // <nombre>: » ya escrito, el nombre como chip y el cursor al final.
  function handleResponderEscribiendo(aQuien: string) {
    if (skillHudView.screen !== 'composer') handleBackToComposer()
    setActivePanel(null)
    requestAnimationFrame(() => composerRef.current?.setTextWithChips(`Le digo ${aQuien}: `, enciclopediaIndex))
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
  // P164 (QA-27): un destino elegido de una lista («Viajar», «Volver al campamento») es un viaje elegido: a un
  // tramo va; a varios, con montura (el motor lo decide). Escrito a mano, no.
  function handleViajeElegido(actionText: string) {
    setSimpleModal(null)
    handleSubmit(actionText, { viajeElegido: true })
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
        if (!cancelled) setCreacionError('sin-seleccion')
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
        // Sin limpiar la promesa, *Reintentar* volvería a esperar la misma ya rechazada.
        creatingSaveRef.current = null
        if (!cancelled) setCreacionError('fallo')
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
      setCreacionError(null)
      createNewSave()
    } else if (id) {
      loadExistingSave(id)
    }

    return () => {
      cancelled = true
    }
    // Deliberadamente solo `id` (y `reintentosCreacion`, que solo cambia al pulsar *Reintentar* de
    // UX-16): este efecto debe correr una única vez por navegación de ruta
    // (crear o cargar), nunca de nuevo porque `selectedWorld`/`selectedCharacter`/
    // `selectedDificultad` (SessionContext) cambien de referencia por otra razón — eso repetiría
    // `createNewSave`/`loadExistingSave` sin que el jugador haya navegado a ningún sitio nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reintentosCreacion])

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

  // Fin de partida real (sin vidas restantes, 2026-08-31): P128 (2026-10-13) lo enseña en
  // `FinDePartidaModal` (GameModals) con el paso a «Tus partidas», donde se reinicia o se empieza otra.
  // Antes saltaba sola a «Elige un mundo» a los 3,5 s, sin decir que la partida había acabado.

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
    buildings,
    setKingdomLog,
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
  // ZON-5 (hito 0.2): el mapa de movimiento ya no se cierra al chocar con algo; si de ahí sale un
  // combate (cazar, un agresivo, o desde la conversación), el combate manda y el mapa se cierra.
  useEffect(() => {
    if (combat.combatOpen) setZonaModalOpen(false)
  }, [combat.combatOpen, setZonaModalOpen])

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
    setEnergia,
    setCombateIniciado,
    setActiveDynamicMode,
    setInventory,
    setXp,
    setQuests,
    setAprenderOficioModalOpen,
    setActivePanel,
    onOfertaTrabajo: misionesValue.mostrarOfertaNpc,
    onNoticiasNuevas: () => void noticiasMundo.traer(),
    onReclutado: () => void refreshSave(),
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
  const { cancelingTransit, errorCancelar, nowTick, handleCancelTransit } = useTransitPolling({ saveId, busyUntil, syncFromSave })

  // Salir a tus partidas (menú de pausa, CFG-3). Bug real (2026-09-04): cerrar el menú antes de
  // navegar, si no quedaba montado por encima de la vista nueva. Bug real (2026-07-24): volver a
  // las partidas de este personaje, con `characterName` por query como respaldo tras recargar.
  function salirAPartidas() {
    setConfirmingExit(false)
    navigate(`/solitario/mundo/${worldIdSlug}/personaje/${saveId}?characterName=${encodeURIComponent(characterName ?? '')}`)
  }
  const { abrirPanel: abrirPanelAjustes, ajustes, setPartidaActual } = useAjustes()
  // CR-12 — el panel de configuración muestra la pestaña «Partida» mientras haya una abierta.
  useEffect(() => {
    setPartidaActual(saveId)
    return () => setPartidaActual(null)
  }, [saveId, setPartidaActual])

  // Composer (UX-13, hito 0.1; UX-1/UX-2, hito 0.2) — se bloquea si la fase no deja enviar turno o
  // hay una capa encima. El cajón de paneles (`activePanel`) queda fuera a propósito: la
  // Enciclopedia inserta chips en el composer con el cajón abierto. B.24 (checklist 2026-08-27):
  // el texto de ayuda dice el primer motivo que aplique de verdad.
  const capaEncimaAbierta =
    anyModalOpen || zonaModalOpen || confirmingExit || !!editingSkillBar || !!recursoDetalle || claseVisible || especializacionVisible
  const composerDisabled = !permisoTurno.permitido || capaEncimaAbierta
  const composerDisabledReason = characterThinking
    ? combateIniciado
      ? 'Resolviendo el combate — puede tardar más de lo habitual...'
      : 'Esperando la narración de tu último turno...'
    : busyUntil
      ? 'Ocupado con algo que lleva tiempo — vuelve cuando termine.'
      : combateIniciado && !combat.combatOpen
        ? 'En combate — usa el panel de combate para actuar.'
        : confirmingExit
          ? 'Partida en pausa — cierra el menú para seguir jugando.'
          : capaEncimaAbierta
            ? 'Resuelve lo que tienes abierto antes de escribir una nueva acción.'
            : (permisoTurno.motivo ?? undefined)

  // UX-9 (hito 0.2) — gestor de capas: cada overlay abierto con su nivel (§ 4.3), en orden de
  // prioridad dentro del nivel. Solo se ve el de nivel más alto; el resto espera oculto y montado
  // (lib/capas.ts). Las condiciones son las mismas con las que se pinta cada uno más abajo.
  const capasAbiertas: CapaAbierta[] = [
    detailTarget && { id: 'detalle', nivel: 'consulta', hija: true },
    panelMostrado && { id: 'panel', nivel: 'consulta' },
    zonaModalOpen && saveId && { id: 'zona', nivel: 'consulta' },
    harvestModal && saveId && characterAttributes && { id: 'recolectar', nivel: 'accion' },
    simpleModal === 'camp' && saveId && { id: 'campamento', nivel: 'accion' },
    simpleModal === 'travel' && saveId && { id: 'viajar', nivel: 'accion' },
    healModalOpen && { id: 'curar', nivel: 'accion' },
    hungerThirstModalOpen && { id: 'comer', nivel: 'accion' },
    entregaModalOpen && saveId && { id: 'entregar', nivel: 'accion' },
    aprenderOficioModalOpen && saveId && { id: 'oficio', nivel: 'accion' },
    avisosAbiertos && { id: 'avisos', nivel: 'accion' },
    saquearZonaModalOpen && saveId && { id: 'saquear', nivel: 'accion' },
    postCombatTarget && { id: 'botin', nivel: 'accion' },
    recursoDetalle && { id: 'recurso', nivel: 'accion' },
    editingSkillBar && { id: 'barra', nivel: 'accion' },
    activeDynamicMode && { id: 'dinamico', nivel: 'escena' },
    claseVisible && { id: 'clase', nivel: 'decision' },
    especializacionVisible && { id: 'especializacion', nivel: 'decision' },
    reinoVisible && { id: 'reino', nivel: 'decision' },
    confirmingExit && { id: 'salir', nivel: 'sistema' },
  ].filter((c): c is CapaAbierta => !!c)
  const estadoCapas = resolverCapas(capasAbiertas)
  // CFG-2 (hito 0.2) — Esc como en un juego: con algo abierto, lo cierra (los modales lo hacen
  // ellos mismos; aquí, el cajón de paneles); sin nada abierto, abre el menú de pausa.
  const capaSuperior = estadoCapas.superior
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (capaSuperior === null) {
        e.preventDefault()
        setConfirmingExit(true)
      } else if (capaSuperior === 'panel') {
        e.preventDefault()
        setActivePanel(null)
      }
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [capaSuperior, setActivePanel])

  // CFG-26 (hito 0.2) — atajos de teclado (lib/atajos.ts, reasignables en Configuración): abren o
  // cierran su panel con las mismas pestañas deshabilitadas que la barra lateral; Z abre la zona si
  // la fase deja moverse. Solo sin modales encima (con el cajón abierto, cambian de panel).
  const pestanasBloqueadas: readonly PanelId[] = pendingDeathResolution
    ? DEATH_PENDING_DISABLED_TABS
    : combat.combatOpen
      ? [...COMBAT_DISABLED_CHARACTER_TABS, ...COMBAT_DISABLED_WORLD_TABS]
      : []
  const atajoRef = useRef({ capaSuperior, pestanasBloqueadas, puedeAbrir: puede('abrirPanel').permitido, puedeMover: permisoMover.permitido, atajos: ajustes.atajos })
  atajoRef.current = { capaSuperior, pestanasBloqueadas, puedeAbrir: puede('abrirPanel').permitido, puedeMover: permisoMover.permitido, atajos: ajustes.atajos }
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      const c = atajoRef.current
      if (e.defaultPrevented || (c.capaSuperior !== null && c.capaSuperior !== 'panel')) return
      const accion = accionDeTecla(e, c.atajos)
      if (!accion) return
      if (accion === 'zona') {
        if (!c.puedeMover || !saveId) return
        e.preventDefault()
        setActivePanel(null)
        setZonaModalOpen(true)
        return
      }
      if (!c.puedeAbrir || c.pestanasBloqueadas.includes(accion)) return
      e.preventDefault()
      setActivePanel((prev) => (prev === accion ? null : accion))
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [saveId, setActivePanel, setZonaModalOpen])


  return {
    id,
    navigate,
    selectedWorld,
    selectedCharacter,
    selectedDificultad,
    saveId,
    setSaveId,
    worldIdSlug,
    setWorldIdSlug,
    worldName,
    setWorldName,
    characterName,
    setCharacterName,
    characterMotivation,
    setCharacterMotivation,
    characterArchetype,
    setCharacterArchetype,
    characterOrigin,
    setCharacterOrigin,
    characterAttributes,
    setCharacterAttributes,
    characterAttributeBonuses,
    setCharacterAttributeBonuses,
    secondaryAttributes,
    setSecondaryAttributes,
    characterLog,
    setCharacterLogRaw,
    liveRevealedIdsRef,
    setCharacterLog,
    worldLog,
    setWorldLog,
    kingdomLog,
    setKingdomLog,
    worldLogView,
    setWorldLogView,
    diceReveal,
    setDiceReveal,
    setSuggestions,
    inventory,
    setInventory,
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
    companions,
    setCompanions,
    level,
    setLevel,
    xp,
    setXp,
    goirnos,
    setGoirnos,
    pendingAttributePoints,
    setPendingAttributePoints,
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
    professionProgress,
    setProfessionProgress,
    deathCount,
    setDeathCount,
    dificultad,
    setDificultad,
    savedActions,
    setSavedActions,
    activeCombatAbilityNames,
    setActiveCombatAbilityNames,
    combatSlots,
    setCombatSlots,
    fictionalDate,
    setFictionalDate,
    entorno,
    setEntorno,
    currentLocation,
    setCurrentLocation,
    professionRecipes,
    recipesStatus,
    destinations,
    setDestinations,
    input,
    setInput,
    confirmingExit,
    setConfirmingExit,
    skillHudView,
    setSkillHudView,
    skillBars,
    setSkillBars,
    editingSkillBar,
    setEditingSkillBar,
    composerRef,
    pendingComposerTextRef,
    wasActionModalOpenRef,
    characterThinking,
    setCharacterThinking,
    timedThinkingText,
    setTimedThinkingText,
    streamingNarration,
    setStreamingNarration,
    busyUntil,
    setBusyUntil,
    busyActivity,
    setBusyActivity,
    busyDuracionMinutos,
    setBusyDuracionMinutos,
    activePanel,
    setActivePanel,
    enciclopediaInitialCategory,
    setEnciclopediaInitialCategory,
    enciclopediaOpenKey,
    setEnciclopediaOpenKey,
    collapsedSide,
    setCollapsedSide,
    personajeSubTab,
    setPersonajeSubTab,
    reinoSubTab,
    setReinoSubTab,
    detailTarget,
    setDetailTarget,
    detailInsertHandler,
    setDetailInsertHandler,
    enciclopediaIndex,
    enciclopediaData,
    enciclopediaLoading,
    refetchEnciclopedia,
    buildEntityBanner,
    notFound,
    setNotFound,
    creacionError,
    setCreacionError,
    reintentosCreacion,
    setReintentosCreacion,
    condicionFisica,
    setCondicionFisica,
    playerActiveEffects,
    setPlayerActiveEffects,
    energia,
    setEnergia,
    energiaMax,
    setEnergiaMax,
    hambre,
    setHambre,
    sed,
    setSed,
    endedAt,
    setEndedAt,
    pendingDeathResolution,
    setPendingDeathResolution,
    resolvingDeath,
    setResolvingDeath,
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
    combateIniciado,
    setCombateIniciado,
    habiaCombateRef,
    lastInitiativeRoll,
    setLastInitiativeRoll,
    COMBAT_DISABLED_CHARACTER_TABS,
    COMBAT_DISABLED_WORLD_TABS,
    DEATH_PENDING_DISABLED_TABS,
    quests,
    setQuests,
    avisosAbiertos,
    setAvisosAbiertos,
    combat,
    clasePendiente,
    especializacionPendiente,
    decisiones,
    reinoVisible,
    avisoDecision,
    anyModalOpen,
    combateForzadoPendiente,
    claseVisible,
    especializacionVisible,
    fase,
    puede,
    permisoTurno,
    bloqueoTurno,
    modoConsulta,
    panelMostrado,
    panelSaliendo,
    inicioCajon,
    setInicioCajon,
    cajonAbierto,
    llegadasCajon,
    llegaCritico,
    avisoLlegadas,
    permisoMover,
    etiquetaFase,
    worldThinking,
    notificaciones,
    notificar,
    descartarNotificacion,
    ajustesAvisos,
    leyendaPedida,
    setLeyendaPedida,
    rumoresDelMapa,
    noticiasMundo,
    procesadasRef,
    inventarioConocidoRef,
    characterFlavor,
    worldFlavor,
    pollForResolution,
    syncFromSave,
    refreshSave,
    misionesValue,
    handleAceptarAviso,
    handleEntregarMision,
    handleAbandonarMision,
    handleContinuarTrasCombate,
    handleFundarReino,
    handleReabrirFundacionReino,
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
    handleAcceptQuestOffer,
    handleDismissQuestOffer,
    handleMatarConvaleciente,
    handleCapturarConvaleciente,
    handleClementeConvaleciente,
    handleItemDetail,
    handleAbilityDetail,
    handleSlotClick,
    handleResponderEscribiendo,
    handleEnciclopediaInsert,
    handleEnciclopediaDetail,
    handleEntityDetailNavigate,
    handleEntityQuickInsert,
    handleOpenHarvestSuggestion,
    handleViajeElegido,
    closeSimpleModal,
    handleAttachItem,
    handleEquipItem,
    handleUnequipItem,
    handleTirarItem,
    creatingSaveRef,
    cazaPorTextoRef,
    handleSubmit,
    zonaModalOpen,
    setZonaModalOpen,
    saquearSoloNpcSlug,
    setSaquearSoloNpcSlug,
    handleCazarEnZona,
    handleHuntResolved,
    handleInteractuarModoDinamico,
    handleDismissDynamicModeOffer,
    recursoDetalle,
    handleVerRecursoDetalle,
    handleCerrarRecursoDetalle,
    handleAccionRecursoDetalle,
    handleChooseNpcInteraction,
    handleElegirDynamicMode,
    handleSalirDynamicMode,
    handleResolveDeath,
    handleOpenEnciclopediaClasses,
    handleSpendAttributePoint,
    cancelingTransit,
    errorCancelar,
    nowTick,
    handleCancelTransit,
    salirAPartidas,
    abrirPanelAjustes,
    ajustes,
    setPartidaActual,
    capaEncimaAbierta,
    composerDisabled,
    composerDisabledReason,
    capasAbiertas,
    estadoCapas,
    capaSuperior,
    pestanasBloqueadas,
    atajoRef,
  }
}

export type GameViewState = ReturnType<typeof useGameViewState>
