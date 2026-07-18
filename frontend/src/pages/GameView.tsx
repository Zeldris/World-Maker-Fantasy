import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { LogPanel } from '../components/LogPanel'
import { ChatComposer } from '../components/ChatComposer'
import { BottomBar, type PanelId } from '../components/BottomBar'
import { PanelDrawer } from '../components/PanelDrawer'
import { EstadisticasPanel } from '../components/panels/EstadisticasPanel'
import { MapaPanel } from '../components/panels/MapaPanel'
import { DiarioPanel } from '../components/panels/DiarioPanel'
import { InventarioPanel } from '../components/panels/InventarioPanel'
import { CompanerosPanel } from '../components/panels/CompanerosPanel'
import { ReinoPanel } from '../components/panels/ReinoPanel'
import { HabilidadesPanel } from '../components/panels/HabilidadesPanel'
import { ProfesionesPanel } from '../components/panels/ProfesionesPanel'
import { PlaceholderPanel } from '../components/panels/PlaceholderPanel'
import { playerActionEntry } from '../lib/simulateAI'
import {
  requestTurnClassify,
  requestTurnNarrate,
  requestSurroundings,
  createSave,
  getSave,
  spendAttributePoint,
  createSavedAction,
  deleteSavedAction,
  setProfession,
  type BusyError,
  type SaveDetail,
} from '../lib/api'
import { characterWaitingFlavor, worldWaitingFlavor, useRotatingFlavor } from '../lib/waitingFlavor'
import type {
  Attribute,
  AttributeBlock,
  BuildingInfo,
  CompanionInfo,
  ComposerAttachment,
  InventoryItemInfo,
  LogEntry,
  SavedActionCategory,
  SavedActionInfo,
  SubjectInfo,
  TerritoryInfo,
} from '../types'

function isBusyError(err: unknown): err is BusyError {
  return typeof err === 'object' && err !== null && (err as { status?: number }).status === 409
}

/// Combina los adjuntos del composer (habilidades/objetos marcados) con el texto libre en una
/// única acción — las habilidades aportan su prompt calibrado, los objetos una mención simple.
function buildActionText(attachments: ComposerAttachment[], freeText: string): string {
  const parts = attachments.map((a) => (a.type === 'ability' ? a.ability.promptText : `Uso mi ${a.item.name}.`))
  return [...parts, freeText.trim()].filter(Boolean).join(' ')
}

const actionSuggestions = [
  'Examino mis alrededores con cuidado',
  'Busco un lugar seguro para descansar',
  'Intento escuchar lo que dicen a lo lejos',
  'Reviso mi equipo y mis heridas',
]

export function GameView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { selectedWorld, selectedCharacter } = useSession()

  const [saveId, setSaveId] = useState<string | null>(null)
  const [worldIdSlug, setWorldIdSlug] = useState<string | null>(null)
  const [worldName, setWorldName] = useState<string | null>(null)
  const [characterName, setCharacterName] = useState<string | null>(null)
  const [characterMotivation, setCharacterMotivation] = useState<string | null>(null)
  const [characterAttributes, setCharacterAttributes] = useState<AttributeBlock | null>(null)
  const [characterLog, setCharacterLog] = useState<LogEntry[]>([])
  const [worldLog, setWorldLog] = useState<LogEntry[]>([])
  const [inventory, setInventory] = useState<InventoryItemInfo[]>([])
  const [companions, setCompanions] = useState<CompanionInfo[]>([])
  const [level, setLevel] = useState(1)
  const [xp, setXp] = useState(0)
  const [pendingAttributePoints, setPendingAttributePoints] = useState(0)
  const [kingdomName, setKingdomName] = useState<string | null>(null)
  const [territories, setTerritories] = useState<TerritoryInfo[]>([])
  const [buildings, setBuildings] = useState<BuildingInfo[]>([])
  const [subjects, setSubjects] = useState<SubjectInfo[]>([])
  const [savedActions, setSavedActions] = useState<SavedActionInfo[]>([])
  const [combatSlots, setCombatSlots] = useState(3)
  const [profession, setProfessionState] = useState<string | null>(null)
  const [fictionalDate, setFictionalDate] = useState('Día 1, mañana')
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [characterThinking, setCharacterThinking] = useState(false)
  const [worldThinking, setWorldThinking] = useState(false)
  const [timedThinkingText, setTimedThinkingText] = useState<string | null>(null)
  const [busyUntil, setBusyUntil] = useState<string | null>(null)
  const [busyActivity, setBusyActivity] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<PanelId | null>(null)
  const [notFound, setNotFound] = useState(false)

  const characterFlavor = useRotatingFlavor(characterThinking, characterWaitingFlavor)
  const worldFlavor = useRotatingFlavor(worldThinking, worldWaitingFlavor)

  // El temporizador de alrededores vive en un efecto aparte que no se reinicia en cada render
  // (ver más abajo) — necesita leer el valor más reciente de estos, no el de cuando arrancó.
  const characterThinkingRef = useRef(characterThinking)
  const fictionalDateRef = useRef(fictionalDate)
  useEffect(() => {
    characterThinkingRef.current = characterThinking
  }, [characterThinking])
  useEffect(() => {
    fictionalDateRef.current = fictionalDate
  }, [fictionalDate])

  // Vuelca un SaveDetail completo en el estado local — usado al cargar la partida y al
  // resincronizar tras resolverse una acción por tiempo en diferido (CharacterTransit).
  function syncFromSave(save: SaveDetail) {
    setCharacterName(save.characterName)
    setCharacterMotivation(save.characterMotivation)
    setCharacterAttributes(save.attributes)
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
    setBusyUntil(save.transit?.busyUntil ?? null)
    setBusyActivity(save.transit?.activity ?? null)
    setSavedActions(save.savedActions)
    setCombatSlots(save.habilidadSlots)
    setProfessionState(save.profession)
  }

  async function handleAdoptProfession(name: string) {
    if (!saveId) return
    setProfessionState(name)
    try {
      await setProfession(saveId, name)
    } catch {
      // Si falla, se resincroniza en la próxima carga de la partida.
    }
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

  function handleAttachAbility(ability: SavedActionInfo) {
    setAttachments((prev) => (prev.some((a) => a.type === 'ability' && a.ability.id === ability.id) ? prev : [...prev, { type: 'ability', ability }]))
    setActivePanel(null)
  }

  function handleAttachItem(item: InventoryItemInfo) {
    setAttachments((prev) => (prev.some((a) => a.type === 'item' && a.item.id === item.id) ? prev : [...prev, { type: 'item', item }]))
    setActivePanel(null)
  }

  function handleRemoveAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  useEffect(() => {
    let cancelled = false

    async function createNewSave() {
      if (!selectedWorld || !selectedCharacter) return
      const introCharacterText = `${selectedCharacter.name} llega a las tierras de ${selectedWorld.name}. ${selectedCharacter.motivation} Todo lo que ocurra a partir de ahora empieza aquí.`
      const introWorldText = `El mundo de ${selectedWorld.name} sigue su curso, ajeno por ahora a la llegada de un nuevo actor en la historia.`
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
  }, [id])

  async function handleSubmit() {
    const action = buildActionText(attachments, input)
    if (!action || !saveId || busyUntil) return
    setInput('')
    setAttachments([])

    setCharacterLog((prev) => [...prev, playerActionEntry(action, fictionalDate)])
    setCharacterThinking(true)
    setTimedThinkingText(null)

    try {
      const classifyResult = await requestTurnClassify({ saveId, action })
      const { classification, roll } = classifyResult

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

      const { narration, progression } = await requestTurnNarrate({ saveId, action, classification, roll })

      setCharacterLog((prev) => [
        ...prev,
        {
          id: `c-${Date.now()}`,
          channel: 'character',
          text: narration.narration,
          timeLabel: fictionalDate,
          roll,
          createdAt: new Date().toISOString(),
          xpDelta: progression.xpDelta > 0 ? progression.xpDelta : undefined,
        },
      ])
      if (narration.newItem) {
        setInventory((prev) => [...prev, { id: `item-${Date.now()}`, ...narration.newItem! }])
      }
      if (narration.newCompanion) {
        setCompanions((prev) => [...prev, { id: `companion-${Date.now()}`, ...narration.newCompanion! }])
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
          },
        ])
      }
    } catch (err) {
      if (isBusyError(err)) {
        setBusyUntil(err.busyUntil)
        setBusyActivity(err.activity)
        setCharacterLog((prev) => prev.slice(0, -1))
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
    } finally {
      setCharacterThinking(false)
      setTimedThinkingText(null)
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

  // Panel "El mundo" v1: ambientación del entorno inmediato cada 5 minutos reales, con
  // posibilidad de que surja un evento (decidido por el backend, no por el frontend) que
  // además se refleja en el log del personaje invitando a reaccionar.
  useEffect(() => {
    if (!saveId) return

    let cancelled = false
    let inFlight = false

    async function tickSurroundings() {
      // No competir con un turno de jugador ya en curso — el backend solo procesa una
      // llamada a Ollama a la vez, y amontonar peticiones fue lo que causó fallos reales
      // en pruebas (una narración forzada a cortarse por falta de margen). Se reintenta
      // en el siguiente tick de 5 minutos.
      if (inFlight || characterThinkingRef.current) return
      inFlight = true
      setWorldThinking(true)
      try {
        const timeLabel = fictionalDateRef.current
        const { description, event } = await requestSurroundings({ saveId: saveId! })
        if (cancelled) return
        const nowIso = new Date().toISOString()
        setWorldLog((prev) => [
          ...prev,
          { id: `w-${Date.now()}`, channel: 'world', text: description, timeLabel, createdAt: nowIso },
        ])
        if (event) {
          setCharacterLog((prev) => [
            ...prev,
            {
              id: `c-event-${Date.now()}`,
              channel: 'character',
              text: `${event} ¿Qué haces?`,
              timeLabel,
              createdAt: nowIso,
            },
          ])
        }
      } catch {
        // Ambientación fallida no bloquea la partida — se reintenta en el siguiente tick.
      } finally {
        inFlight = false
        if (!cancelled) setWorldThinking(false)
      }
    }

    const interval = setInterval(tickSurroundings, 5 * 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
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

  if (!saveId || !worldName || !characterName || !characterAttributes) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="gem animate-pulse-soft" />
        <p className="text-wood-500 italic">Cargando partida...</p>
      </div>
    )
  }

  const panelTitles: Record<PanelId, string> = {
    mapa: 'Mapa',
    estadisticas: 'Estadísticas',
    inventario: 'Inventario',
    diario: 'Diario',
    misiones: 'Misiones',
    companeros: 'Compañeros',
    reino: 'Reino',
    habilidades: 'Habilidades',
    profesiones: 'Profesiones',
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <header className="iron-band relative flex items-center justify-between px-5 pb-3 pt-2.5">
        <div>
          <button
            onClick={() => navigate(`/solitario/mundo/${worldIdSlug}/personaje/${saveId}`)}
            className="text-xs text-wood-500 transition-colors hover:text-accent-300"
          >
            ← Salir a tus partidas
          </button>
          <p className="mt-0.5 font-serif text-base tracking-wide text-wood-200">
            <span className="text-accent-400">{characterName}</span>
            <span className="mx-2 text-wood-600">·</span>
            <span className="text-wood-300">{worldName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActivePanel('estadisticas')}
            title={pendingAttributePoints > 0 ? `${pendingAttributePoints} puntos de atributo por repartir` : 'Nivel'}
            className="relative flex items-center gap-1.5 rounded-md border border-iron-700 bg-wood-950/60 px-2.5 py-1 font-serif text-xs tracking-wide text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300"
          >
            <span className="gem" />
            Nivel {level}
            {pendingAttributePoints > 0 && (
              <span className="ml-1 rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-wood-950">
                +{pendingAttributePoints}
              </span>
            )}
          </button>
          <span className="rounded-md border border-iron-700 bg-wood-950/60 px-2.5 py-1 font-serif text-xs tracking-wide text-wood-300">
            {fictionalDate}
          </span>
        </div>
        <div className="accent-hairline absolute inset-x-0 bottom-0" />
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-2">
        <LogPanel
          title="Tu personaje"
          subtitle="Lo que haces, dices y percibes"
          entries={characterLog}
          accent="accent"
          isThinking={characterThinking}
          thinkingText={timedThinkingText ?? characterFlavor}
          emptyHint="Aquí aparecerá lo que le ocurra a tu personaje."
        />
        <LogPanel
          title="El mundo"
          subtitle="Lo que ocurre más allá de tu personaje"
          entries={worldLog}
          accent="accent2"
          isThinking={worldThinking}
          thinkingText={worldFlavor}
          emptyHint="El mundo todavía no ha mostrado sus cartas."
        />
      </div>

      {busyUntil && (
        <div className="border-t border-iron-800 bg-wood-950/90 px-4 py-2 text-center text-xs text-wood-400">
          <span className="gem mr-1.5 align-middle" /> Ocupado{busyActivity ? ` con "${busyActivity}"` : ''} — vuelve en un
          rato, se resolverá solo.
        </div>
      )}
      <ChatComposer
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={characterThinking || !!busyUntil}
        suggestions={actionSuggestions}
        attachments={attachments}
        onRemoveAttachment={handleRemoveAttachment}
      />

      <BottomBar active={activePanel} onSelect={(id) => setActivePanel((prev) => (prev === id ? null : id))} />

      {activePanel && (
        <PanelDrawer title={panelTitles[activePanel]} onClose={() => setActivePanel(null)}>
          {activePanel === 'estadisticas' && (
            <EstadisticasPanel
              attributes={characterAttributes}
              level={level}
              xp={xp}
              pendingAttributePoints={pendingAttributePoints}
              onSpendPoint={handleSpendAttributePoint}
            />
          )}
          {activePanel === 'mapa' && <MapaPanel />}
          {activePanel === 'diario' && <DiarioPanel characterLog={characterLog} worldLog={worldLog} />}
          {activePanel === 'inventario' && <InventarioPanel items={inventory} onUse={handleAttachItem} />}
          {activePanel === 'companeros' && <CompanerosPanel companions={companions} />}
          {activePanel === 'reino' && (
            <ReinoPanel
              kingdomName={kingdomName}
              characterMotivation={characterMotivation}
              territories={territories}
              buildings={buildings}
              subjects={subjects}
            />
          )}
          {activePanel === 'habilidades' && (
            <HabilidadesPanel
              savedActions={savedActions}
              combatSlots={combatSlots}
              onUse={handleAttachAbility}
              onCreate={handleCreateHabilidad}
              onDelete={handleDeleteHabilidad}
            />
          )}
          {activePanel === 'profesiones' && (
            <ProfesionesPanel currentProfession={profession} onAdopt={handleAdoptProfession} />
          )}
          {![
            'estadisticas',
            'mapa',
            'diario',
            'inventario',
            'companeros',
            'reino',
            'habilidades',
            'profesiones',
          ].includes(activePanel) && <PlaceholderPanel id={activePanel} />}
        </PanelDrawer>
      )}
    </div>
  )
}
