import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSession } from '../context/useSession'
import { LogPanel } from '../components/LogPanel'
import { ChatComposer, type ChatComposerHandle } from '../components/ChatComposer'
import { SideNav } from '../components/SideNav'
import { characterTabs, worldTabs, type PanelId } from '../components/NavTabs'
import { PanelDrawer } from '../components/PanelDrawer'
import { MapaPanel } from '../components/panels/MapaPanel'
import { DiarioPanel } from '../components/panels/DiarioPanel'
import { InventarioPanel } from '../components/panels/InventarioPanel'
import { EnciclopediaPanel } from '../components/panels/EnciclopediaPanel'
import { SLOT_LABEL, isCompatibleWithSlot, isConsumibleSlot } from '../lib/equipSlots'
import { PersonajePanel, type PersonajeSubTab } from '../components/panels/PersonajePanel'
import { DetailModal, type DetailTarget } from '../components/DetailModal'
import { useEnciclopedia } from '../hooks/useEnciclopedia'
import type { EnciclopediaLinkTarget } from '../lib/enciclopediaIndex'
import { EnciclopediaLinkProvider } from '../context/EnciclopediaLinkContext'
import { CompanerosPanel } from '../components/panels/CompanerosPanel'
import { ReinoPanel } from '../components/panels/ReinoPanel'
import { MisionesPanel } from '../components/panels/MisionesPanel'
import { HabilidadesPanel } from '../components/panels/HabilidadesPanel'
import { playerActionEntry } from '../lib/simulateAI'
import { DiscoveryReveal } from '../components/DiscoveryReveal'
import { CombatComposer, type CombatNpcDisplay } from '../components/CombatComposer'
import { CombatPanel } from '../components/CombatPanel'
import { combatDifficultyFor } from '../lib/combatDifficulty'
import { HealthBar } from '../components/HealthBar'
import { KingdomFoundingModal } from '../components/KingdomFoundingModal'
import { HarvestSelectionModal } from '../components/HarvestSelectionModal'
import { inventoryCapacityFor } from '../lib/inventoryCapacity'
import {
  requestTurnClassify,
  requestTurnNarrate,
  requestSurroundings,
  requestFlee,
  createSave,
  getSave,
  pauseSave,
  resumeSave,
  cancelTransit,
  spendAttributePoint,
  createSavedAction,
  deleteSavedAction,
  updateSavedAction,
  fundarReino,
  setItemSlot,
  setLogEntryBanner,
  resolveImageUrl,
  getProfessionRecipes,
  type SaveDetail,
  type ClassifyResponse,
} from '../lib/api'
import { characterWaitingFlavor, combatWaitingFlavor, worldWaitingFlavor, useRotatingFlavor } from '../lib/waitingFlavor'
import { pickMentionedEntityBanner, mentionedEntityKey, resolveEntityBannerFromRef } from '../lib/mentionedEntityBanner'
import { isBusyError, isEndedGameError, isTurnLockedError, formatCountdown, formatFictionalDuration, applyInventoryDelta } from '../lib/gameViewHelpers'
import type {
  Attribute,
  AttributeBlock,
  BuildingInfo,
  CompanionInfo,
  CondicionFisica,
  CurrentLocationInfo,
  DestinationInfo,
  Dificultad,
  DiscoveryItem,
  EquipSlot,
  InventoryItemInfo,
  KingdomFoundedInfo,
  KingdomStatsInfo,
  LogEntry,
  MentionedEntityBanner,
  NpcInSceneInfo,
  ProfessionProgressInfo,
  ProfessionRecipeInfo,
  ProgressionResult,
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
  const [characterAttributes, setCharacterAttributes] = useState<AttributeBlock | null>(null)
  const [secondaryAttributes, setSecondaryAttributes] = useState<SecondaryAttributeBlock | null>(null)
  const [characterLog, setCharacterLog] = useState<LogEntry[]>([])
  const [worldLog, setWorldLog] = useState<LogEntry[]>([])
  const [inventory, setInventory] = useState<InventoryItemInfo[]>([])
  // Pop-up de recolección (rediseño de profesiones, 2026-08-07) — null = cerrado.
  const [harvestModal, setHarvestModal] = useState<{ oficio: string; label: string } | null>(null)
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
  const [factionsStatus, setFactionsStatus] = useState<Record<string, number>>({})
  const [kingdomStats, setKingdomStats] = useState<KingdomStatsInfo | null>(null)
  const [professionProgress, setProfessionProgress] = useState<ProfessionProgressInfo[]>([])
  // Roster estático de recetas de oficio (rediseño de profesiones, 2026-08-07) — independiente de
  // partida, se pide una sola vez al montar (no cambia mientras se juega). Habilidades > Profesiones
  // lo usa para mostrar TODAS las recetas de una profesión creadora, bloqueadas o no.
  const [professionRecipes, setProfessionRecipes] = useState<ProfessionRecipeInfo[]>([])
  useEffect(() => {
    getProfessionRecipes()
      .then(setProfessionRecipes)
      .catch(() => {
        // Si falla, Habilidades > Profesiones simplemente no muestra el roster bloqueado — no
        // rompe nada más, no hace falta reintentar agresivamente.
      })
  }, [])
  const [deathCount, setDeathCount] = useState(0)
  const [dificultad, setDificultad] = useState<Dificultad>('NOVATO')
  const [savedActions, setSavedActions] = useState<SavedActionInfo[]>([])
  const [combatSlots, setCombatSlots] = useState(3)
  const [fictionalDate, setFictionalDate] = useState('Día 1, mañana')
  const [currentLocation, setCurrentLocation] = useState<CurrentLocationInfo | null>(null)
  const [destinations, setDestinations] = useState<DestinationInfo[]>([])
  const [input, setInput] = useState('')
  const composerRef = useRef<ChatComposerHandle>(null)
  const [characterThinking, setCharacterThinking] = useState(false)
  const [worldThinking, setWorldThinking] = useState(false)
  const [timedThinkingText, setTimedThinkingText] = useState<string | null>(null)
  // Streaming (roadmap de velocidad, 2026-07-20, punto 13): la narración crece en vivo mientras
  // el Narrador la genera, en vez de aparecer entera al final — null mientras dura el prefill
  // (el modelo todavía no ha emitido ningún token de "narration") o si no hay turno en curso.
  const [streamingNarration, setStreamingNarration] = useState<string | null>(null)
  const [busyUntil, setBusyUntil] = useState<string | null>(null)
  const [busyActivity, setBusyActivity] = useState<string | null>(null)
  const [busyDuracionMinutos, setBusyDuracionMinutos] = useState<number | null>(null)
  const [cancelingTransit, setCancelingTransit] = useState(false)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [activePanel, setActivePanel] = useState<PanelId | null>(null)
  const [personajeSubTab, setPersonajeSubTab] = useState<PersonajeSubTab>('equipo')
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null)
  // Solo se usa para el detalle de la Enciclopedia (kind: 'info') — guarda el callback concreto
  // de "insertar este elemento" para esa entrada, ver handleEnciclopediaDetail.
  const [detailInsertHandler, setDetailInsertHandler] = useState<(() => void) | null>(null)
  // Texto clicable en narración/diario/descripciones (2026-07-22, petición explícita) — un solo
  // índice construido una vez, reutilizado por LogPanel/DiarioPanel/DetailModal. Clicar una
  // mención simplemente reemplaza `detailTarget` (mismo estado de siempre), no abre nada nuevo.
  const { index: enciclopediaIndex, raw: enciclopediaData } = useEnciclopedia(worldIdSlug)
  // Banner de elemento citado bajo la narración (petición explícita de la usuaria, 2026-07-24):
  // ventana de "no repetir" de las últimas 4 narraciones, en memoria de esta sesión — no hace
  // falta persistirlo, un cambio de partida/recarga simplemente empieza la ventana de cero.
  //
  // Bug real jugando en vivo (2026-07-24, "sigue sin salir la imagen"): la primera versión
  // guardaba solo una lista de las últimas 6 claves MOSTRADAS y la recortaba con `.slice(-6)` —
  // es decir, expiraba una entrada solo cuando aparecían 6 entidades DISTINTAS nuevas después de
  // ella. Con solo 2-3 candidatas reales con imagen subida en esta zona del juego (Gistera Koh,
  // Orco Enfurecido...), en cuanto cada una se mostraba una vez quedaban ambas bloqueadas para
  // siempre — nunca hay una tercera/cuarta/etc. distinta que las empuje fuera de la ventana. Ahora
  // la expiración es por Nº DE NARRACIONES transcurridas (turnCounter), no por cuántas entidades
  // distintas se han enseñado — así una NPC protagonista puede volver a aparecer pasadas unas
  // pocas narraciones aunque no haya ninguna otra entidad nueva de por medio.
  // `enciclopediaIndexRef` (mismo patrón que `characterThinkingRef`/`fictionalDateRef` más abajo):
  // `tickSurroundings` vive dentro de un efecto con `[saveId]` como única dependencia, así que su
  // clausura se crea una sola vez — sin el ref, se quedaría leyendo para siempre el índice vacío
  // del primer render, de antes de que `useEnciclopedia` terminara de cargar los datos reales.
  const RECENTLY_SHOWN_TURN_WINDOW = 4
  const recentlyShownEntitiesRef = useRef<Map<string, number>>(new Map())
  const entityBannerTurnRef = useRef(0)
  const enciclopediaIndexRef = useRef(enciclopediaIndex)
  useEffect(() => {
    enciclopediaIndexRef.current = enciclopediaIndex
  }, [enciclopediaIndex])
  // Reconstruye `entityBanner` para las entradas ya persistidas (rework 2026-07-24) en cuanto la
  // Enciclopedia termina de cargar — `syncFromSave` (al entrar/recargar) las rellena con
  // `entityBannerType`/`entityBannerSlug` (la referencia que sí sobrevive en BD), pero necesita el
  // índice de la Enciclopedia ya construido para resolver la imagen real; como ese fetch es
  // asíncrono y separado, este efecto corre en cuanto está listo, no en el momento de la carga.
  useEffect(() => {
    if (!enciclopediaIndex.bySlugKey.size) return
    const resolve = (entry: LogEntry): LogEntry => {
      if (entry.entityBanner || !entry.entityBannerType || !entry.entityBannerSlug) return entry
      const resolved = resolveEntityBannerFromRef(entry.entityBannerType, entry.entityBannerSlug, enciclopediaIndex)
      if (!resolved) return entry
      // Bug real jugando en vivo (2026-07-24, "las imágenes al recargar no se ven" — icono de
      // imagen rota): `resolveEntityBannerFromRef` devuelve la ruta relativa tal cual (igual que
      // `pickMentionedEntityBanner` con `bannerUrl`), quien llama es quien la convierte en URL
      // completa con `resolveImageUrl` (mismo patrón que `buildEntityBanner`) — faltaba aquí.
      const imageUrl = resolveImageUrl(resolved.imageUrl)
      if (!imageUrl) return entry
      return { ...entry, entityBanner: { ...resolved, imageUrl } }
    }
    setCharacterLog((prev) => prev.map(resolve))
    setWorldLog((prev) => prev.map(resolve))
  }, [enciclopediaIndex])
  // `logEntryId` (rework 2026-07-24, persistencia de banners): el id REAL de la fila LogEntry ya
  // creada en el backend para esta narración — antes se usaba un id inventado (`c-${Date.now()}`)
  // que no correspondía a nada en BD, así que no había forma de guardarle luego qué entidad se
  // mostró. Si se pasa, y hay match, se dispara un PATCH de fondo (fire-and-forget: un fallo aquí
  // solo significa que la imagen no sobrevive a una recarga, nada más grave).
  function buildEntityBanner(text: string, logEntryId?: string): MentionedEntityBanner | undefined {
    // Cualquier fallo aquí es puramente cosmético (una imagen de más o de menos) — nunca debe
    // impedir que la narración en sí se guarde/muestre. Aislado en try/catch tras un bug real
    // sospechado de un remount/HMR dejando `recentlyShownEntitiesRef` con una forma antigua.
    try {
      const currentTurn = ++entityBannerTurnRef.current
      const recentlyShown = new Set(
        Array.from(recentlyShownEntitiesRef.current.entries())
          .filter(([, shownAtTurn]) => currentTurn - shownAtTurn < RECENTLY_SHOWN_TURN_WINDOW)
          .map(([key]) => key),
      )
      const match = pickMentionedEntityBanner(text, enciclopediaIndexRef.current, recentlyShown)
      if (!match) return undefined
      const imageUrl = resolveImageUrl(match.bannerUrl)
      if (!imageUrl) return undefined
      recentlyShownEntitiesRef.current.set(mentionedEntityKey(match.target), currentTurn)
      if (logEntryId && saveId && match.target.entityType && match.target.entitySlug) {
        setLogEntryBanner(saveId, logEntryId, match.target.entityType, match.target.entitySlug).catch(() => {})
      }
      return { name: match.target.name, icon: match.target.icon, imageUrl }
    } catch (err) {
      console.error('buildEntityBanner failed', err)
      return undefined
    }
  }
  const [notFound, setNotFound] = useState(false)
  const [discoveries, setDiscoveries] = useState<DiscoveryItem[]>([])
  const [condicionFisica, setCondicionFisica] = useState<CondicionFisica>('ILESO')
  // Sistema de fatiga (2026-07-29) — mismo patrón que condicionFisica: se sincroniza al cargar la
  // partida y se actualiza con cada respuesta de turno.
  const [energia, setEnergia] = useState(100)
  const [energiaMax, setEnergiaMax] = useState(100)
  const [endedAt, setEndedAt] = useState<string | null>(null)
  const [combateIniciado, setCombateIniciado] = useState<{ npcs: NpcInSceneInfo[] } | null>(null)
  const [combatOpen, setCombatOpen] = useState(false)
  const [fleeingPreCombat, setFleeingPreCombat] = useState(false)
  // Rework de combate in-place (2026-07-24): antes este estado (condición heurística por NPC,
  // saqueado) vivía dentro de CombatModal.tsx, remontado limpio cada vez que el popup se abría.
  // Ahora que no hay popup (el composer normal se sustituye por CombatComposer en el mismo sitio),
  // este estado vive aquí y se inicializa a mano en `openCombat()` cada vez que arranca una pelea.
  // 'MUERTO' añadido (2026-07-30, botón "Decapitar") — antes esta lista se topaba en INCAPACITADO
  // a propósito porque nada en combate podía mostrar MUERTO; ahora que sí puede pasar, tiene que
  // seguir siendo el peor escalón de todos para que la fusión "nunca empeora sin razón real" de
  // `handleCombatTurnResolved` (más abajo) siga funcionando igual.
  const CONDICION_ORDER: CondicionFisica[] = ['ILESO', 'HERIDO', 'GRAVE', 'INCAPACITADO', 'MUERTO']
  const [combatNpcStates, setCombatNpcStates] = useState<CombatNpcDisplay[]>([])
  const [combatBusy, setCombatBusy] = useState(false)
  const [combatEnded, setCombatEnded] = useState(false)
  // Rediseño de la vista de combate (2026-07-28): este estado vivía dentro de CombatComposer.tsx,
  // remontado limpio cada vez que el combate se abría/cerraba (era un componente condicional).
  // Ahora vive aquí porque lo comparten dos sitios distintos del layout a la vez (CombatPanel,
  // arriba en el panel derecho, y el input de texto libre recortado, abajo) — `openCombat()` lo
  // reinicia a mano, igual que antes hacía el `useState` inicial de aquel componente.
  // Rediseño del turno de combate (2026-07-28) — true entre "el NPC ganó la iniciativa" y "el
  // jugador ya eligió su defensa a ciegas"; gatea el sub-modo de CombatPanel (oculta objetivos/
  // Huir/objetos, cambia "Actuar" por "Defenderte").
  const [combatAwaitingDefense, setCombatAwaitingDefense] = useState(false)
  // Rediseño del turno de combate (2026-07-29, "quiero que sea más claro cuando es turno de
  // ataque... indicándome qué salió en los dados") — tirada real de iniciativa del último turno
  // resuelto, para que CombatPanel explique CON NÚMEROS por qué le toca atacar/defender ahora.
  const [lastInitiativeRoll, setLastInitiativeRoll] = useState<{ ganador: 'jugador' | 'npc'; jugadorTirada: number; npcTirada: number } | null>(null)
  const [combatSelectedNpcSlug, setCombatSelectedNpcSlug] = useState<string | null>(null)
  const [combatSelectedAbilityId, setCombatSelectedAbilityId] = useState<string | null>(null)
  const [combatSelectedItemId, setCombatSelectedItemId] = useState<string | null>(null)
  const [combatFreeText, setCombatFreeText] = useState('')
  // Auditoría de rendimiento 2026-07-28 ("rascar segundos"): memoizado — sin esto, `.map()`
  // devolvía una referencia NUEVA en cada render de GameView (cada chunk de narración en
  // streaming, cada tecla del composer...), y el useEffect de más abajo depende de este array
  // entero: sin una referencia estable, se disparaba en cada uno de esos renders, no solo cuando
  // el combate realmente cambia.
  const combatNpcsDisplay: CombatNpcDisplay[] = useMemo(
    () =>
      (combateIniciado?.npcs ?? []).map((n) => {
        const state = combatNpcStates.find((s) => s.slug === n.slug)
        return (
          state ?? {
            slug: n.slug,
            name: n.name,
            // Botón "Decapitar" (2026-07-30) — ya no se colapsa MUERTO a INCAPACITADO, ver
            // CombatNpcDisplay.condicion.
            condicion: n.condicionFisica,
            yaSaqueado: n.saqueado,
            lootedItemNames: n.lootedItemNames,
          }
        )
      }),
    [combateIniciado, combatNpcStates],
  )

  // Indicador de dificultad antes de pulsar "Combatir" (2026-07-29, petición explícita: "que
  // aparezca un texto en color... que me indique la dificultad según los niveles"). Usa el NPC de
  // mayor nivel del encuentro (el peor caso, no un promedio que escondiera al más peligroso del
  // grupo) — mismo criterio de diferencia de nivel que `difficultyHintFor` en el backend.
  const combatDifficulty = useMemo(() => {
    if (!combateIniciado || !enciclopediaData) return null
    const levels = combateIniciado.npcs
      .map((n) => enciclopediaData.npcs.find((e) => e.slug === n.slug)?.level ?? enciclopediaData.faunaFlora.find((f) => f.sourceSlug === n.slug)?.level)
      .filter((l): l is number => typeof l === 'number')
    if (levels.length === 0) return null
    return combatDifficultyFor(Math.max(...levels) - level)
  }, [combateIniciado, enciclopediaData, level])
  // Bug real (2026-07-25, "revisar partida"): `combatEnded` solo se marcaba con `finDePartida` o
  // la muerte del PROPIO personaje — nunca cuando el enemigo quedaba derrotado. Un NPC en GRAVE ya
  // se puede saquear (ver "Registrar" en CombatComposer), así que saquearlo es la señal real de
  // "esto ya terminó" aunque nunca llegue a INCAPACITADO — sin esto, la pantalla de combate se
  // quedaba encallada para siempre tras looter a un enemigo que no llegó a caer del todo.
  useEffect(() => {
    if (!combatOpen || combatEnded || combatNpcsDisplay.length === 0) return
    const allResolved = combatNpcsDisplay.every((n) => n.condicion === 'INCAPACITADO' || n.condicion === 'MUERTO' || n.yaSaqueado)
    if (allResolved) setCombatEnded(true)
  }, [combatOpen, combatEnded, combatNpcsDisplay])

  // Tabs que no tienen sentido en pleno combate (petición explícita, 2026-07-24) — Estadísticas,
  // Equipo, Habilidades y Enciclopedia se dejan libres a propósito ("no fuerces nada, ya lo
  // gestionaremos con un tutorial futuro"): solo se restringe lo que de verdad no se puede hacer
  // en mitad de una pelea (viajar, gestionar el Reino, leer el diario...).
  // 'profesiones' ya no es un PanelId de nivel superior (vive como sub-pestaña dentro de
  // PersonajePanel, que recibe `combatOpen` y deshabilita esa sub-pestaña por su cuenta).
  const COMBAT_DISABLED_CHARACTER_TABS: PanelId[] = ['inventario', 'companeros', 'reino']
  const COMBAT_DISABLED_WORLD_TABS: PanelId[] = ['mapa', 'diario', 'misiones']

  function openCombat() {
    if (!combateIniciado) return
    // Bug real (auditoría 2026-07-30): un turno puede traer a la vez un hallazgo (`discoveries`)
    // Y una emboscada (`combateIniciado`) — sin esto, el aviso de "hallazgo descubierto" se quedaba
    // solapado visualmente por encima del popup de combate recién abierto.
    setDiscoveries([])
    setCombatNpcStates(
      combateIniciado.npcs.map((n) => ({
        slug: n.slug,
        name: n.name,
        // Botón "Decapitar" (2026-07-30) — ya no se colapsa MUERTO a INCAPACITADO, ver
        // CombatNpcDisplay.condicion.
        condicion: n.condicionFisica,
        yaSaqueado: n.saqueado,
        lootedItemNames: n.lootedItemNames,
      })),
    )
    setCombatEnded(false)
    // Mismo reinicio que antes hacía el `useState` inicial de CombatComposer al montarse.
    setCombatSelectedNpcSlug(combateIniciado.npcs[0]?.slug ?? null)
    setCombatSelectedAbilityId(null)
    setCombatSelectedItemId(null)
    setCombatFreeText('')
    // Bug real (auditoría 2026-07-30): NO se resetea `combatAwaitingDefense` aquí a propósito.
    // `handleCombatHuir` cierra el popup de inmediato sin esperar la resolución real (fire-and-
    // forget) — si la huida falla y el NPC contraataca, `handleCombatTurnResolved` deja
    // `combatAwaitingDefense=true` (turno real, correcto) mientras el popup sigue cerrado y
    // reaparece el aviso "⚔️ Combatir". Si `openCombat()` lo reseteaba aquí sin más, reabrir el
    // popup mostraba los controles de ataque en vez del prompt de "Defenderte", aunque el backend
    // (`Save.pendingNpcAttack`) siga esperando esa defensa de todos modos — confuso aunque no
    // rompía la mecánica real. El combate SÍ termina en `false` cuando de verdad termina, ver
    // `onContinue`/`handleCombatHuir`/`finDePartida` en handleCombatTurnResolved.
    setLastInitiativeRoll(null)
    if (activePanel && (COMBAT_DISABLED_CHARACTER_TABS.includes(activePanel) || COMBAT_DISABLED_WORLD_TABS.includes(activePanel))) {
      setActivePanel(null)
    }
    setCombatOpen(true)
  }

  async function submitCombatAction(
    action: string,
    opts: { savedActionId?: string; lootItemNames?: string[]; allowAfterEnded?: boolean },
  ): Promise<boolean> {
    // Bug real jugando en vivo (2026-07-31, "al decapitarlo no se ha cerrado el combate... el
    // saqueo listaba las 3 cosas en vez de 1"): este guard bloqueaba CUALQUIER acción en cuanto
    // `combatEnded` era true — correcto para "Actuar"/Huir (no tiene sentido seguir peleando una
    // vez resuelto), pero Registrar/Decapitar/Saquear son justo las acciones que la pantalla de
    // combate YA terminado ofrece, y hoy dejaron de cerrar el combate por su cuenta (saqueo parcial,
    // ver handleSaquearSeleccion) — sin `allowAfterEnded`, esas tres llamadas nunca llegaban ni a
    // hacer la petición: `handleSaquearSeleccion`/`handleDecapitarSeleccion` marcaban optimistamente
    // el estado local y luego `submitCombatAction` devolvía `false` en silencio, sin tocar el
    // backend — el modal de saqueo volvía a mostrar todo porque NADA se había persistido de verdad.
    if (!action.trim() || combatBusy || (combatEnded && !opts.allowAfterEnded) || !saveId) return false
    setCombatBusy(true)
    // Bug real (2026-07-29, "no veo el cuadro rojo del narrador generando el texto" en combate):
    // combatBusy solo bloquea los botones de CombatPanel — nunca activaba `characterThinking`,
    // así que el LogPanel de "Tu personaje" nunca mostraba la tarjeta de "pensando" mientras se
    // esperaba la narración de este turno, aunque sí lo hace fuera de combate (ver handleSubmit).
    setCharacterThinking(true)
    try {
      const classifyResult = await requestTurnClassify({ saveId, action, enCombate: true, savedActionId: opts.savedActionId })
      const { classification, roll } = classifyResult
      if (classifyResult.transit) {
        // Salvaguarda (auditoría 2026-07-28): el backend ya fuerza banda "instantánea" para
        // cualquier acción de combate (turn.ts), así que esto no debería pasar nunca — pero si
        // pasara, seguir a narrate igualmente resolvería el turno DOS veces (ahora y otra vez al
        // vencer ese transit, esta vez sin `enCombate`/`pendingNpcAttack`, perdiendo un ataque de
        // NPC pendiente sin que el jugador llegue a defenderse). Se corta aquí en vez de arriesgar
        // una doble resolución silenciosa.
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
        combateIniciado: combate,
        finDePartida,
        justDied,
        newInventoryItems,
        removedInventoryItemIds,
        updatedInventoryItems,
        logEntryId,
        quests: updatedQuests,
        newQuestInfo,
        esperandoDefensaJugador,
        npcAbilityUsed,
        nextInitiativeRoll,
        deathCount: updatedDeathCount,
        factionsStatus: updatedFactionsStatus,
        professionProgress: updatedProfessionProgress,
      } = await requestTurnNarrate({
        saveId,
        action,
        classification,
        roll,
        enCombate: true,
        savedActionId: opts.savedActionId,
        npcsInScene: classifyResult.npcsInScene,
        lootItemNames: opts.lootItemNames,
      })
      // Auditoría 2026-07-28: antes había aquí un downgrade optimista de la condición del NPC
      // basado en `roll.success` (la tirada tabulada de classify) — desde que el intercambio real
      // se decide en resolveExchange (turnResolution.ts), esa tirada ya no tiene relación con si
      // el golpe conectó de verdad, así que podía mostrar al NPC más herido de lo que estaba y
      // quedarse así para siempre (el merge de `combate.npcs` de abajo nunca corrige hacia atrás).
      // El backend ya devuelve la condición fresca del NPC golpeado en la misma respuesta —
      // `handleCombatTurnResolved` es la única fuente de verdad ahora.
      setQuests(updatedQuests)
      // Bug real (auditoría 2026-08-06): matar/decapitar a un NPC de facción en combate cambia
      // `factionsStatus` en el acto (reputation.ts), y morir en combate cambia `deathCount` — sin
      // esto, Personaje → Reputación/Profesiones y el contador de muertes se quedaban con el valor
      // de antes del combate hasta recargar la partida entera.
      setDeathCount(updatedDeathCount)
      setFactionsStatus(updatedFactionsStatus)
      setProfessionProgress(updatedProfessionProgress)
      handleCombatTurnResolved({
        narration: narration.narration,
        progression,
        condicionFisica,
        energia,
        energiaMax,
        finDePartida,
        newInventoryItems,
        removedInventoryItemIds,
        updatedInventoryItems,
        logEntryId,
        combate,
        esperandoDefensaJugador,
        npcAbilityUsed,
        nextInitiativeRoll,
        newQuestInfo,
      })
      // Bug real (2026-07-29, "si muero no hace lo que fijamos que haría"): `condicionFisica` ya
      // llega resuelta a ILESO tras un respawn sobrevivible (nunca MUERTO) — sin `justDied` este
      // chequeo nunca se cumplía salvo fin de partida, y el combate seguía igual tras morir.
      if (finDePartida || justDied) setCombatEnded(true)
      return true
    } catch (err) {
      // Candado de turno (auditoría de código completa, 2026-08-07) — este intercambio se
      // rechazó de raíz (ya había uno en curso para esta partida), mensaje propio en vez del
      // genérico de abajo para que quede claro que no fue un fallo real.
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
    }
  }

  function handleCombatHuir() {
    // Fire-and-forget + cierre inmediato (mismo comportamiento que tenía CombatModal.handleHuir):
    // no se espera el resultado narrativo para volver al modo normal.
    submitCombatAction('Intento huir de este combate, alejándome como pueda.', {})
    setCombatOpen(false)
    setCombateIniciado(null)
    setCombatAwaitingDefense(false)
  }

  async function handleCombatRegistrar(npc: CombatNpcDisplay) {
    setCombatNpcStates((prev) => prev.map((n) => (n.slug === npc.slug ? { ...n, yaSaqueado: true } : n)))
    // Comillas alrededor del nombre (bug real, auditoría 2026-07-28): igual que handleAttack ya
    // hace para que el backend resuelva `explicitTarget` — sin ellas, el saqueo podía alcanzar a
    // cualquier otro NPC derrotado que estuviera también en escena, no solo al pulsado aquí.
    const ok = await submitCombatAction(`Registro el cuerpo de '${npc.name}'.`, { allowAfterEnded: true })
    // Rollback (bug real, auditoría 2026-07-28): si el turno falla, el saqueo optimista de arriba
    // dejaba al NPC marcado como saqueado en la UI para siempre, aunque el backend nunca llegó a
    // aplicarlo — el botón de registrar desaparecía sin que el saqueo hubiera ocurrido de verdad.
    if (!ok) {
      setCombatNpcStates((prev) => prev.map((n) => (n.slug === npc.slug ? { ...n, yaSaqueado: false } : n)))
    }
  }

  // Botón "Decapitar" (petición explícita, 2026-07-30: "un botón que solo sale cuando está
  // incapacitado para matarlo") — golpe de gracia determinista contra un enemigo YA incapacitado,
  // sin tirada (ver `detectsExecuteIntent`/`executeTarget` en turnResolution.ts). Comillas
  // alrededor del nombre, mismo motivo que `handleCombatRegistrar`: sin ellas, el backend podría
  // rematar a cualquier otro enemigo derrotado en escena, no solo al pulsado aquí.
  //
  // Ajustado tras probarlo en vivo (2026-07-30: "tienes que marcar todos aquellos que quieras
  // decapitar... un popup con checkbox... y confirmarlo") — recibe la selección YA confirmada
  // desde el modal (CombatSelectionModal en CombatPanel.tsx), nunca un solo NPC. UN único prompt
  // mencionando a todos por nombre, SIN comillas — mismo motivo que `handleSaquearSeleccion` más
  // abajo: con comillas, `explicitTarget` (el regex `'([^']+)'`) solo extrae UN nombre, así que
  // varios seleccionados a la vez solo rematarían al primero.
  async function handleDecapitarSeleccion(npcs: CombatNpcDisplay[]) {
    if (npcs.length === 0) return
    setCombatNpcStates((prev) => prev.map((n) => (npcs.some((p) => p.slug === n.slug) ? { ...n, condicion: 'MUERTO' } : n)))
    const nombres = npcs.map((n) => n.name).join(', ')
    const ok = await submitCombatAction(`Remato a ${nombres}, asestándoles el golpe de gracia final.`, { allowAfterEnded: true })
    if (!ok) {
      setCombatNpcStates((prev) => prev.map((n) => (npcs.some((p) => p.slug === n.slug) ? { ...n, condicion: 'INCAPACITADO' } : n)))
      return
    }
    // Rediseño 2026-07-31 (petición explícita: "solo salir o decapitar cierran el combate") —
    // decapitar es un cierre deliberado, a diferencia de saquear (que se queda abierto por si
    // dejaste algo sin recoger, ver `handleSaquearSeleccion`). Mismo cierre que "Salir".
    setCombatOpen(false)
    setCombateIniciado(null)
    setCombatAwaitingDefense(false)
  }

  // Resumen de combate (petición explícita, 2026-07-30: "no se entiende que vencí... quiero que
  // cuando acabes te saque una vista... con un botón salir y un botón saquear que lance un prompt
  // ya directamente en personaje para saquear a todos los enemigos derrotados"), ajustado tras
  // probarlo en vivo ("que pueda marcar los que me quiero quedar") — recibe los NOMBRES de
  // objetos YA confirmados desde el modal de selección; el backend (`lootItemNames`, ver
  // turnResolution.ts) solo copia esos, no el loadout entero. UN solo prompt mencionando a cada
  // enemigo por su nombre real, SIN comillas (mismo motivo que arriba: con comillas solo se
  // saquearía al primero).
  //
  // Bug real (probado en vivo, 2026-07-30): la primera versión de este prompt no nombraba a NADIE
  // — sin ningún alias de NPC en el texto, `detectNpcsInScene` (turnResolution.ts) nunca los
  // detectaba "en escena" para este turno, así que `lootMode` nunca se activaba: no aparecía nada
  // en el inventario y el estado de combate del servidor (`pendingCombatNpcSlugs`) nunca se
  // tocaba, así que al recargar la página el popup de combate volvía a aparecer como si nada
  // hubiera pasado.
  // Saqueo parcial (2026-07-31, petición explícita: "que no cierre la pestaña de combate... si no
  // saqueas todo el botón sigue para poder saquear lo que dejaste") — a diferencia de Decapitar/
  // Salir, saquear NUNCA cierra el combate por su cuenta: `quedaAlgoPorSaquear` (CombatPanel.tsx)
  // ya reacciona solo al estado real de `yaSaqueado` de cada NPC, así que el botón desaparece o
  // sigue sin necesitar ningún cierre explícito aquí. Solo se marca `yaSaqueado` en los NPC de
  // `fullyLootedSlugs` (los que tuvieron el 100% de sus objetos marcados en el modal) — el
  // backend (`NpcState.lootedItemNames`) es quien de verdad decide esto; el resto se queda tal
  // cual hasta la respuesta real del turno.
  //
  // Bug real (2026-08-01, "saqueé 2 de 3 y me volvía a listar los 3"): antes esto solo marcaba
  // `yaSaqueado` de forma optimista y confiaba en que la respuesta del turno (`combate.npcs`, ver
  // el merge de `handleCombatTurnResolved`) trajera `lootedItemNames` frescos — pero el saqueo ya
  // no genera ningún `combateIniciado` en la respuesta (no hay intercambio de combate ni el modelo
  // narra un slug que copiar), así que ese merge nunca se disparaba y el modal seguía ofreciendo
  // TODO el loadout la próxima vez, aunque el backend ya lo tuviera bien registrado. Se marca
  // `lootedItemNames` aquí mismo, con lo que el propio modal ya seleccionó — no hace falta esperar
  // al servidor para saber esto: el backend nunca rechaza un objeto real de su loadout.
  async function handleSaquearSeleccion(itemNames: string[], fullyLootedSlugs: string[], itemNamesByNpc: Record<string, string[]>) {
    const porSaquear = combatNpcsDisplay.filter((n) => (n.condicion === 'INCAPACITADO' || n.condicion === 'MUERTO') && !n.yaSaqueado)
    if (porSaquear.length > 0) {
      setCombatNpcStates((prev) =>
        prev.map((n) => {
          const added = itemNamesByNpc[n.slug]
          // `undefined` = este NPC no formaba parte de esta ronda de saqueo, se deja igual. Un
          // array VACÍO sí es una respuesta real (auditoría 2026-08-07: NPC con loadout vacío en
          // catálogo, nada que añadir pero SÍ puede quedar marcado como saqueado del todo) — antes
          // se trataba igual que "no tocado" y `yaSaqueado` nunca se ponía a `true` en la sesión
          // en curso (solo se corregía tras recargar la partida).
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

  // Rediseño de la vista de combate (2026-07-28): mismos handlers que antes vivían dentro de
  // CombatComposer.tsx (handleAttack/handleUseItem/resetSelection), movidos aquí porque el estado
  // de selección que usan ahora se comparte entre CombatPanel (arriba) y el input de texto libre
  // recortado (abajo).
  function resetCombatSelection() {
    setCombatSelectedAbilityId(null)
    setCombatSelectedItemId(null)
    setCombatFreeText('')
  }

  function handleCombatAttack() {
    const selectedAbility = savedActions.find((a) => a.id === combatSelectedAbilityId)
    if (!selectedAbility) return
    // Defensa a ciegas (rediseño del turno de combate, 2026-07-28): reactiva, sin objetivo propio
    // que elegir — el backend ya sabe que toca resolver la defensa pendiente del NPC por su
    // propio `Save.pendingNpcAttack`, así que el texto no menciona ningún NPC.
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
  // NPC objetivo.
  function handleCombatUseItem() {
    const selectedItem = inventory.find((i) => i.id === combatSelectedItemId)
    if (!selectedItem) return
    submitCombatAction(`Uso '${selectedItem.name}'.`, {})
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
  const [quests, setQuests] = useState<QuestInfo[]>([])
  const [chapters, setChapters] = useState<SessionSummaryInfo[]>([])

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

  const characterFlavor = useRotatingFlavor(characterThinking, combatOpen ? combatWaitingFlavor : characterWaitingFlavor)
  const worldFlavor = useRotatingFlavor(worldThinking, worldWaitingFlavor)

  // El temporizador de alrededores vive en un efecto aparte que no se reinicia en cada render
  // (ver más abajo) — necesita leer el valor más reciente de estos, no el de cuando arrancó.
  const characterThinkingRef = useRef(characterThinking)
  const fictionalDateRef = useRef(fictionalDate)
  // Bug real encontrado auditando la partida de Gorhorn (2026-07-23, "revisar partida" — petición
  // explícita de la usuaria: "la AI del narrador esta generando un prompt fuera de responder a
  // que yo le ponga... nos esta haciendo mas bien que mal"): el sondeo de ambientación cada 5 min
  // ya evitaba solaparse con un turno en curso o un gancho sin responder, pero no con un combate
  // pendiente/abierto — un evento ambiental ("¿Qué haces?" con el mismo NPC ya atacando) llegó a
  // dispararse en mitad de un intercambio de golpes real, muy confuso. `combateIniciado` (no solo
  // `combatOpen`) cubre también la ventana entre "se marcó el combate" y "el jugador pulsa
  // Combatir", que es tan real como el propio popup abierto.
  const combatActiveRef = useRef(false)
  useEffect(() => {
    characterThinkingRef.current = characterThinking
  }, [characterThinking])
  useEffect(() => {
    combatActiveRef.current = !!combateIniciado
  }, [combateIniciado])
  useEffect(() => {
    fictionalDateRef.current = fictionalDate
  }, [fictionalDate])

  // Bug real (auditoría 2026-07-30): a diferencia de todos los demás bucles asíncronos largos de
  // este archivo (cada uno con su propio flag `cancelled` de limpieza de efecto), el sondeo de
  // reconexión de más abajo (hasta 72 intentos, ~12 min reales) vive dentro de un handler
  // imperativo (`handleSubmit`), no de un `useEffect` — sin nada que lo corte, seguía llamando al
  // backend y a `setState` varios minutos después de que la jugadora navegara fuera de esta
  // pantalla (desmontaje real de GameView).
  const mountedRef = useRef(true)
  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Solapar classify con el tecleo (roadmap de velocidad, 2026-07-19): tras ~1,5s sin tocar el
  // composer, se lanza ya la clasificación en segundo plano con `preview:true` — no persiste nada
  // (backend, ver classifyCache.ts), solo precalienta la caché del servidor con este texto exacto.
  // Si el jugador envía lo mismo antes de que caduque, el envío real (más abajo) se beneficia solo
  // con que el backend encuentre la caché — el frontend no necesita rastrear ni reutilizar la
  // respuesta cruda del preview (evita el riesgo de perder "discoveries"/"transit" del envío real).
  useEffect(() => {
    const action = input.trim()
    const composerDisabled = characterThinking || !!busyUntil || !!endedAt || (!!combateIniciado && !combatOpen)
    if (!action || !saveId || composerDisabled) return

    const timer = setTimeout(() => {
      requestTurnClassify({ saveId, action, preview: true }).catch(() => {})
    }, 1500)

    return () => clearTimeout(timer)
  }, [input, saveId, characterThinking, busyUntil, endedAt, combateIniciado, combatOpen])

  // Vuelca un SaveDetail completo en el estado local — usado al cargar la partida y al
  // resincronizar tras resolverse una acción por tiempo en diferido (CharacterTransit).
  function syncFromSave(save: SaveDetail) {
    setCharacterName(save.characterName)
    setCharacterMotivation(save.characterMotivation)
    setCharacterAttributes(save.attributes)
    setSecondaryAttributes(save.secondaryAttributes)
    setFictionalDate(save.fictionalDateLabel)
    setCharacterLog(save.characterLog)
    setWorldLog(save.worldLog)
    setInventory(save.inventory)
    setCompanions(save.companions)
    setLevel(save.level)
    setXp(save.xp)
    setPendingAttributePoints(save.pendingAttributePoints)
    setKingdomName(save.kingdomName)
    setTerritories(save.territories)
    setBuildings(save.buildings)
    setSubjects(save.subjects)
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
    setDeathCount(save.deathCount)
    setDificultad(save.dificultad)
    setEndedAt(save.endedAt)
    setQuests(save.quests)
    setChapters(save.chapters)
    // Bug real (2026-07-23, "revisar partida"): antes `combateIniciado` solo se fijaba con la
    // respuesta directa de `/turn/narrate` — cualquier resincronización (sondeo de reconexión,
    // recarga de página) perdía el aviso de combate aunque el backend lo hubiera calculado bien.
    if (save.combateIniciado && save.combateIniciado.npcs.length > 0) setCombateIniciado(save.combateIniciado)
  }

  async function handleCancelTransit() {
    if (!saveId || cancelingTransit) return
    setCancelingTransit(true)
    try {
      await cancelTransit(saveId)
      const save = await getSave(saveId)
      syncFromSave(save)
    } catch {
      // Si falla (p. ej. ya se resolvió justo antes), el sondeo de 30s ya en marcha lo reflejará.
    } finally {
      setCancelingTransit(false)
    }
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
      outcome: territory?.control === 'DISPUTADO' ? 'CONFLICTO' : 'PACIFICA',
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
    // estático ya cargado (profesionRecipes). Solo aplica a habilidades de oficio (category
    // 'profesion'); el resto se queda sin recipeKey, sin enlace, sin cambio de comportamiento.
    const matchingRecipe = ability.category === 'profesion' ? professionRecipes.find((r) => r.ability.name === ability.name) : undefined
    setDetailTarget({ kind: 'ability', ability: matchingRecipe ? { ...ability, recipeKey: matchingRecipe.recipeKey } : ability })
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

  // Habilidades base de recolección (rediseño de profesiones, 2026-08-07) — Minar/Talar abren el
  // pop-up de selección (HarvestSelectionModal) en vez de mandar texto libre al composer; el
  // oficio no viaja en el SavedAction (solo hay 2, mapeo fijo aquí es más simple que pedir todo un
  // roster al backend para esto). Desollar es una habilidad normal: el despiece por texto libre
  // ya funciona igual que antes, no necesita el pop-up (target siempre una presa ya derrotada
  // delante, no una fuente que "explorar").
  const HARVEST_ABILITY_OFICIO: Record<string, string> = { Minar: 'minero', Talar: 'talador' }

  function handleAttachAbility(ability: SavedActionInfo) {
    const oficio = HARVEST_ABILITY_OFICIO[ability.name]
    if (oficio) {
      setHarvestModal({ oficio, label: ability.name })
      setActivePanel(null)
      return
    }
    composerRef.current?.insertChip({ icon: ability.icon, label: ability.name, description: ability.description, value: ability.promptText })
    setActivePanel(null)
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
      if (saveId) await setItemSlot(saveId, item.id, slot)
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
      if (saveId) await setItemSlot(saveId, item.id, null)
    } catch (err) {
      setInventory(previous)
      throw err
    }
  }

  function handleAttachDiscovery(discovery: DiscoveryItem) {
    composerRef.current?.insertChip({ icon: '✨', label: discovery.name })
  }

  function handleCombatTurnResolved(params: {
    narration: string
    progression: ProgressionResult
    condicionFisica: CondicionFisica
    energia: number
    energiaMax: number
    finDePartida: boolean
    newInventoryItems: InventoryItemInfo[]
    removedInventoryItemIds: string[]
    updatedInventoryItems: { id: string; name: string }[]
    logEntryId: string
    combate?: { npcs: NpcInSceneInfo[] } | null
    esperandoDefensaJugador: boolean
    npcAbilityUsed: { npcName: string; abilityName: string; rol: 'ataque' | 'defensa' } | null
    nextInitiativeRoll: { ganador: 'jugador' | 'npc'; jugadorTirada: number; npcTirada: number } | null
    newQuestInfo?: { title: string; objetivo: string } | null
  }) {
    // `buildEntityBanner` se calcula FUERA del updater (bug real, 2026-07-24, "sigue sin salir la
    // imagen" pese a candidatos válidos): StrictMode invoca dos veces en dev cualquier función
    // pasada a `setState`, y `buildEntityBanner` muta `recentlyShownEntitiesRef` como efecto
    // secundario — la primera invocación (de prueba, descartada) marcaba la entidad como "ya
    // mostrada", así que la segunda (la que React realmente usa) la encontraba deduplicada y
    // devolvía `undefined` siempre. Calcularlo una sola vez, antes de `setCharacterLog`, evita la
    // doble ejecución por completo.
    const entityBanner = buildEntityBanner(params.narration, params.logEntryId)
    setCharacterLog((prev) => [
      ...prev,
      {
        id: params.logEntryId,
        channel: 'character',
        text: params.narration,
        timeLabel: fictionalDate,
        createdAt: new Date().toISOString(),
        entityBanner,
        combate: true,
        npcAbilityUsed: params.npcAbilityUsed ?? undefined,
        newQuest: params.newQuestInfo ?? undefined,
      },
    ])
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
    setCombatAwaitingDefense(params.esperandoDefensaJugador)
    setLastInitiativeRoll(params.nextInitiativeRoll)
    // Bug real (auditoría 2026-07-28): esta función (la que resuelve CADA turno mientras el
    // combate ya está abierto) nunca aplicaba el `combateIniciado` de la respuesta — a diferencia
    // de fuera de combate (ver más abajo), donde sí se hace. Un NPC nuevo añadido a media pelea
    // quedaba invisible en CombatComposer, y si la condición real del backend avanzaba más de lo
    // que reflejaba el estado local, el botón "Registrar" podía no aparecer nunca para un NPC ya
    // derrotado de verdad en el servidor.
    if (params.combate && params.combate.npcs.length > 0) {
      setCombateIniciado(params.combate)
      setCombatNpcStates((prev) => {
        const bySlug = new Map(prev.map((n) => [n.slug, n]))
        for (const n of params.combate!.npcs) {
          const real: CombatNpcDisplay = {
            slug: n.slug,
            name: n.name,
            // Botón "Decapitar" (2026-07-30) — ya no se colapsa MUERTO a INCAPACITADO, ver
            // CombatNpcDisplay.condicion.
            condicion: n.condicionFisica,
            yaSaqueado: n.saqueado,
            lootedItemNames: n.lootedItemNames,
          }
          const local = bySlug.get(n.slug)
          if (!local) {
            bySlug.set(n.slug, real)
            continue
          }
          // El backend manda: solo se sustituye el estado local si el real ha avanzado más (nunca
          // "resucita" a alguien que el propio jugador ya vio caer más allá, por si acaso llega
          // desordenado).
          const avanza = CONDICION_ORDER.indexOf(real.condicion) > CONDICION_ORDER.indexOf(local.condicion)
          if (avanza || (real.yaSaqueado && !local.yaSaqueado)) {
            bySlug.set(n.slug, real)
          } else if (real.lootedItemNames.length > local.lootedItemNames.length) {
            // Saqueo parcial (2026-07-31): `lootedItemNames` solo crece, aunque `condicion`/
            // `yaSaqueado` no hayan cambiado este turno — sin esto, la lista de "qué te falta por
            // llevarte" se quedaba congelada en lo que había al abrir el combate.
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

  // Huir ANTES de entrar al combate (petición explícita de la usuaria, 2026-07-24): botón junto al
  // aviso de "⚔️ Combatir" — una sola tirada determinista en el backend (sin IA, ver
  // `/saves/:id/combat/flee`), así que no hay hueco de tiempo en el que una recarga pueda revivir
  // un combate del que ya se huyó (el bug real de carrera que sí tiene el "Huir" de dentro del
  // popup, que pasa por classify+narrate). Si falla, se abre el popup normal para pelear de verdad.
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
      // Si falla la llamada en sí (no la tirada), se deja el aviso de "Combatir" tal cual —
      // la jugadora puede reintentar huir o entrar al combate normalmente.
    } finally {
      setFleeingPreCombat(false)
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
    resumeSave(saveId).catch(() => {})

    const handleBeforeUnload = () => pauseSave(saveId)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      pauseSave(saveId)
    }
  }, [saveId])

  async function handleSubmit(action: string) {
    if (!action || !saveId || busyUntil || endedAt) return
    composerRef.current?.clear()
    setInput('')
    setDiscoveries([])
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
      // transit/discoveries como siempre), pero el propio backend se salta Ollama/tabla si
      // encuentra la caché, sin que el frontend tenga que decidir nada ni arriesgar quedarse sin
      // "discoveries"/"transit" por reutilizar la respuesta cruda del preview.
      const classifyResult: ClassifyResponse = await requestTurnClassify({ saveId, action })
      const { classification, roll, travel } = classifyResult
      setDiscoveries(classifyResult.discoveries ?? [])

      if (classifyResult.transit) {
        // Banda extendida/larga: el backend ya lo resolvió en diferido (acción + texto de
        // inicio + CharacterTransit) — recargamos la partida entera para reflejarlo, en vez
        // de intentar reconstruir esas entradas a mano en el cliente.
        setCharacterThinking(false)
        const save = await getSave(saveId)
        syncFromSave(save)
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
        combateIniciado: combate,
        finDePartida,
        newInventoryItems,
        removedInventoryItemIds,
        updatedInventoryItems,
        logEntryId,
        quests: updatedQuests,
        newQuestInfo,
        newKingdomFounded,
        companionCreated,
        territories: updatedTerritories,
        buildings: updatedBuildings,
        subjects: updatedSubjects,
        kingdomStats: updatedKingdomStats,
        deathCount: updatedDeathCount,
        factionsStatus: updatedFactionsStatus,
        professionProgress: updatedProfessionProgress,
      } = await requestTurnNarrate(
        { saveId, action, classification, roll, travel, npcsInScene: classifyResult.npcsInScene },
        {
          onChunk: (delta) => setStreamingNarration((prev) => (prev ?? '') + delta),
          onReset: () => setStreamingNarration(null),
        },
      )
      setStreamingNarration(null)
      setCondicionFisica(newCondicion)
      setEnergia(newEnergia)
      setEnergiaMax(newEnergiaMax)
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
      if (newInventoryItems.length > 0 || removedInventoryItemIds.length > 0 || updatedInventoryItems.length > 0) {
        setInventory((prev) => applyInventoryDelta(prev, newInventoryItems, removedInventoryItemIds, updatedInventoryItems))
      }
      if (combate && combate.npcs.length > 0) setCombateIniciado(combate)
      if (finDePartida) setEndedAt(new Date().toISOString())

      if (travel) {
        // Un viaje resuelto síncronamente (banda corta) ya cambió currentLocationId en el
        // backend — resincronizamos posición/destinos en vez de reconstruirlo a mano aquí.
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
      setCharacterLog((prev) => [
        ...prev,
        {
          id: logEntryId,
          channel: 'character',
          text: narration.narration,
          timeLabel: fictionalDate,
          roll,
          createdAt: new Date().toISOString(),
          xpDelta: progression.xpDelta > 0 ? progression.xpDelta : undefined,
          entityBanner,
          newQuest: newQuestInfo ?? undefined,
        },
      ])
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
            timeLabel: fictionalDate,
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
        // Sondeo de reconexión (2026-07-23): antes se comprobaba una sola vez y ya se avisaba de
        // "puede que tengas que reintentarla" — pero el backend sigue narrando en segundo plano
        // bastante después de que el stream del cliente se corte (cola de Ollama, rotación cloud),
        // así que un solo intento inmediato disparaba el aviso demasiado pronto. Sondea cada 10s
        // mientras el composer sigue bloqueado (characterThinking se queda a true hasta el
        // finally), mostrando un indicador discreto en vez del aviso de error.
        //
        // Bug real encontrado auditando la partida de Gorhorn (2026-07-23, "revisar partida" —
        // "una cosa que pasa mucho y me obliga a recargar"): el tope original (~2 min) se quedaba
        // corto frente al peor caso REAL de la cascada de reintentos de `narrateAction`
        // (narrador.ts): intento 1 (180s) + intento 2 (240s) + intento 3 (90s) = 510s solo en
        // narrar, más hasta 120s si además hay una réplica de diálogo (`generateNpcReply`) — hasta
        // ~10-11 minutos en el peor caso real en este hardware CPU-only. Con un tope de 2 min, el
        // aviso de "puede que tengas que reintentarla" saltaba con el turno TODAVÍA en curso.
        const POLL_INTERVAL_MS = 10_000
        const MAX_POLL_ATTEMPTS = 72
        setTimedThinkingText('Esperando confirmación del narrador...')
        let resolved = false
        let lastSuccessfulSave: Awaited<ReturnType<typeof getSave>> | null = null
        for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS && !resolved && mountedRef.current; attempt++) {
          if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
          if (!mountedRef.current) break
          try {
            const save = await getSave(saveId)
            lastSuccessfulSave = save
            if (save.characterLog.length > logLengthBeforeThisTurn + 1) {
              syncFromSave(save)
              resolved = true
            }
          } catch {
            // Se reintenta en el siguiente sondeo — no se distingue de "aún no ha terminado".
          }
        }
        if (!resolved && mountedRef.current) {
          if (lastSuccessfulSave) {
            syncFromSave(lastSuccessfulSave)
            setCharacterLog((prev) => [
              ...prev,
              {
                id: `err-${Date.now()}`,
                channel: 'character',
                text: 'La acción quedó registrada, pero la narración sigue sin completarse tras esperar — puede que tengas que reintentarla.',
                timeLabel: fictionalDate,
                createdAt: new Date().toISOString(),
              },
            ])
          } else {
            setCharacterLog((prev) => [
              ...prev,
              {
                id: `err-${Date.now()}`,
                channel: 'character',
                text: 'No se pudo contactar con el Narrador. ¿Está el backend corriendo en localhost:3001?',
                timeLabel: fictionalDate,
                createdAt: new Date().toISOString(),
              },
            ])
          }
        }
      }
    } finally {
      setCharacterThinking(false)
      setTimedThinkingText(null)
      setStreamingNarration(null)
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

  // Panel "El mundo" v1: ambientación del entorno inmediato cada 10 minutos reales (subido de 5,
  // petición explícita de la usuaria, 2026-07-23), puramente descriptiva — nunca toca el chat de
  // personaje ni propone eventos (ver comentario de `tickSurroundings` más abajo).
  useEffect(() => {
    if (!saveId) return

    let cancelled = false
    let inFlight = false

    async function tickSurroundings() {
      // No competir con un turno de jugador ya en curso — el backend solo procesa una
      // llamada a Ollama a la vez, y amontonar peticiones fue lo que causó fallos reales
      // en pruebas (una narración forzada a cortarse por falta de margen). Se reintenta
      // en el siguiente tick. Tampoco durante un combate pendiente/abierto (`combatActiveRef`,
      // bug real 2026-07-23): un evento ambiental reintroduciendo al mismo NPC que ya está
      // atacando es puro ruido confuso en mitad de una pelea.
      if (inFlight || characterThinkingRef.current || combatActiveRef.current) return
      inFlight = true
      setWorldThinking(true)
      try {
        const timeLabel = fictionalDateRef.current
        // Puramente descriptivo (petición explícita de la usuaria, 2026-07-23: "el sondeo
        // ambiental solo tiene que lanzarse en el chat de mundo... no tiene que preguntar que
        // hace, solo exponer que hay a tu alrededor") — ya nunca toca el chat de PERSONAJE.
        const { description, logEntryId } = await requestSurroundings({ saveId: saveId! })
        if (cancelled) return
        const nowIso = new Date().toISOString()
        const entityBanner = buildEntityBanner(description, logEntryId)
        setWorldLog((prev) => [...prev, { id: logEntryId, channel: 'world', text: description, timeLabel, createdAt: nowIso, entityBanner }])
      } catch {
        // Ambientación fallida no bloquea la partida — se reintenta en el siguiente tick.
      } finally {
        inFlight = false
        if (!cancelled) setWorldThinking(false)
      }
    }

    const interval = setInterval(tickSurroundings, 10 * 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
    // Deliberadamente solo `saveId`: `buildEntityBanner` no está memoizada (nueva referencia cada
    // render) pero lee todo lo reactivo que necesita de refs (enciclopediaIndexRef,
    // recentlyShownEntitiesRef, entityBannerTurnRef) — incluirla aquí recrearía el intervalo de
    // 10 minutos en cada render, rompiendo la cadencia real del sondeo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveId])

  // Mientras el personaje está en una acción por tiempo (extendida/larga), sondea la partida
  // cada 30s para detectar cuándo el worldTick la resuelve — en ese momento `transit` desaparece
  // y syncFromSave trae ya la narración diferida que se generó en el worker.
  useEffect(() => {
    if (!saveId || !busyUntil) return
    let cancelled = false

    const interval = setInterval(async () => {
      try {
        const save = await getSave(saveId)
        if (cancelled) return
        if (!save.transit) syncFromSave(save)
      } catch {
        // Se reintenta en el siguiente sondeo.
      }
    }, 30_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [saveId, busyUntil])

  // Reloj de la cuenta atrás (roadmap 2026-07-20): solo aritmética local, ningún request — el
  // sondeo real que confirma la resolución sigue siendo el de 30s de arriba.
  useEffect(() => {
    if (!busyUntil) return
    const tick = setInterval(() => setNowTick(Date.now()), 1_000)
    return () => clearInterval(tick)
  }, [busyUntil])

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
          disabledIds={combatOpen ? COMBAT_DISABLED_CHARACTER_TABS : undefined}
          onSelect={(id) => setActivePanel((prev) => (prev === id ? null : id))}
        />
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden lg:grid-cols-2">
          <LogPanel
            title="Tu personaje"
            subtitle="Lo que haces, dices y percibes"
            entries={characterLog}
            accent="accent"
            isThinking={characterThinking}
            thinkingText={streamingNarration ?? timedThinkingText ?? characterFlavor}
            streaming={!!streamingNarration}
            combate={combatOpen}
            emptyHint="Aquí aparecerá lo que le ocurra a tu personaje."
          />
          {combatOpen && combateIniciado ? (
            // Rediseño de la vista de combate (2026-07-28, petición explícita: "quiero que la
            // sección de combate salga sustituyendo a los logs de mundo") — el panel "El mundo"
            // se sustituye por CombatPanel mientras dura el combate; el log de mundo en sí sigue
            // acumulándose por debajo, sin perderse, listo para cuando termine.
            <CombatPanel
              playerName={characterName ?? 'Tú'}
              playerCondicion={condicionFisica}
              energia={energia}
              energiaMax={energiaMax}
              npcs={combatNpcsDisplay}
              selectedNpcSlug={combatSelectedNpcSlug}
              onSelectNpc={setCombatSelectedNpcSlug}
              combatAbilities={savedActions.filter((a) => a.category === 'combate')}
              selectedAbilityId={combatSelectedAbilityId}
              onSelectAbility={setCombatSelectedAbilityId}
              // Consumibles de combate (2026-07-30, petición explícita: "raciones y cataplasma
              // catalogalo como Consumible que tendrá 6 slots en equipo donde podrás añadir los
              // consumibles que quieres usar en el combate") — antes CUALQUIER objeto sin ranura
              // (mochila entera, incluidos documentos/materiales) contaba como "usable" en
              // combate; ahora solo lo que el jugador equipó a propósito en una de las 6 ranuras.
              combatItems={inventory.filter((i) => isConsumibleSlot(i.slot))}
              selectedItemId={combatSelectedItemId}
              onSelectItem={setCombatSelectedItemId}
              busy={combatBusy}
              ended={combatEnded}
              awaitingDefense={combatAwaitingDefense}
              lastInitiativeRoll={lastInitiativeRoll}
              onActuar={handleCombatActuar}
              onRegistrar={handleCombatRegistrar}
              onDecapitarSeleccion={handleDecapitarSeleccion}
              onHuir={handleCombatHuir}
              onContinue={() => {
                setCombatOpen(false)
                setCombateIniciado(null)
                // Este combate ya terminó de verdad (todos los NPCs resueltos, ver `combatEnded`
                // más arriba) — mismo criterio que `openCombat()` ya no puede asumir por su
                // cuenta: aquí sí es seguro limpiar `combatAwaitingDefense`, para que el PRÓXIMO
                // combate (uno nuevo, sin relación) no herede por error un "toca defender" de
                // este que ya se cerró.
                setCombatAwaitingDefense(false)
              }}
              onSaquearSeleccion={handleSaquearSeleccion}
              onAbilityDetail={handleAbilityDetail}
              onItemDetail={handleItemDetail}
              enciclopedia={enciclopediaData}
            />
          ) : (
            <LogPanel
              title="El mundo"
              subtitle="Lo que ocurre más allá de tu personaje"
              entries={worldLog}
              accent="accent2"
              isThinking={worldThinking}
              thinkingText={worldFlavor}
              emptyHint="El mundo todavía no ha mostrado sus cartas."
            />
          )}
        </div>
        <SideNav
          tabs={worldTabs}
          active={activePanel}
          align="right"
          dimmed={!!activePanel}
          disabledIds={combatOpen ? COMBAT_DISABLED_WORLD_TABS : undefined}
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

      {discoveries.length > 0 && !endedAt && (
        <div className="border-t border-iron-800 bg-wood-950/90 px-4">
          <DiscoveryReveal discoveries={discoveries} onAttach={handleAttachDiscovery} />
        </div>
      )}

      {combateIniciado && !combatOpen && !endedAt && (
        <div className="flex flex-col items-center gap-1.5 border-t border-iron-800 bg-wood-950/90 px-4 py-2 text-center">
          {combatDifficulty && (
            <p className={`text-2xs font-semibold uppercase tracking-[0.1em] ${combatDifficulty.colorClass}`}>
              Dificultad: {combatDifficulty.label}
            </p>
          )}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={openCombat}
              disabled={fleeingPreCombat}
              className="animate-alert-pulse rounded-lg border border-red-700 bg-danger-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-danger-400 shadow-[0_0_14px_-4px_color-mix(in_srgb,var(--color-danger-500)_70%,transparent)] transition-colors hover:bg-danger-500/20 disabled:opacity-50"
            >
              ⚔️ Combatir
            </button>
            <button
              onClick={handleFleeAttempt}
              disabled={fleeingPreCombat}
              className="tactile rounded-lg border border-iron-700 bg-wood-950/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 disabled:opacity-50"
            >
              {fleeingPreCombat ? 'Huyendo...' : '🏃 Huir'}
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
      ) : combatOpen && combateIniciado ? (
        // Rework 2026-07-24, recortado en el rediseño de la vista de combate (2026-07-28): sigue
        // sustituyendo al ChatComposer normal en el mismo sitio, pero ahora solo es el input de
        // texto libre — enemigos/ficha/habilidades/objetos/Actuar viven en CombatPanel, arriba.
        <CombatComposer
          freeText={combatFreeText}
          onFreeTextChange={setCombatFreeText}
          onSubmit={handleCombatFreeSubmit}
          busy={combatBusy}
          ended={combatEnded}
        />
      ) : (
        <ChatComposer
          ref={composerRef}
          onChange={setInput}
          onSubmit={handleSubmit}
          disabled={characterThinking || !!busyUntil || (!!combateIniciado && !combatOpen)}
        />
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
          inventoryUsed={inventory.length}
          inventoryCapacity={inventoryCapacityFor(
            characterAttributes,
            inventory.filter((i) => i.slot !== null),
          )}
          onConfirm={(created) => {
            setInventory((prev) => [...prev, ...created])
            setHarvestModal(null)
          }}
          onCancel={() => setHarvestModal(null)}
        />
      )}

      {activePanel && (
        <PanelDrawer title={panelTitles[activePanel]} accent={panelAccent[activePanel]} onClose={() => setActivePanel(null)}>
          {activePanel === 'personaje' && (
            <PersonajePanel
              activeSubTab={personajeSubTab}
              onSubTabChange={setPersonajeSubTab}
              items={inventory}
              onSlotClick={handleSlotClick}
              attributes={characterAttributes}
              secondaryAttributes={secondaryAttributes}
              level={level}
              xp={xp}
              pendingAttributePoints={pendingAttributePoints}
              onSpendPoint={handleSpendAttributePoint}
              condicionFisica={condicionFisica}
              energia={energia}
              energiaMax={energiaMax}
              factionsStatus={factionsStatus}
            />
          )}
          {activePanel === 'mapa' && (
            <MapaPanel worldSlug={worldIdSlug} currentLocation={currentLocation} destinations={destinations} inventory={inventory} quests={quests} buildings={buildings} />
          )}
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
          {activePanel === 'companeros' && <CompanerosPanel companions={companions} />}
          {activePanel === 'misiones' && <MisionesPanel quests={quests} />}
          {activePanel === 'reino' && (
            <ReinoPanel
              kingdomName={kingdomName}
              characterMotivation={characterMotivation}
              territories={territories}
              buildings={buildings}
              subjects={subjects}
              kingdomStats={kingdomStats}
              onFundarReino={handleReabrirFundacionReino}
            />
          )}
          {activePanel === 'enciclopedia' && (
            <EnciclopediaPanel worldSlug={worldIdSlug} saveId={saveId} onInsert={handleEnciclopediaInsert} onDetail={handleEnciclopediaDetail} />
          )}
          {activePanel === 'habilidades' && (
            <HabilidadesPanel
              savedActions={savedActions}
              combatSlots={combatSlots}
              professionProgress={professionProgress}
              professionRecipes={professionRecipes}
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
