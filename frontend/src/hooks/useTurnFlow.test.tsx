import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRef, useState } from 'react'
import { renderHook, act } from '@testing-library/react'
import { useTurnFlow } from './useTurnFlow'
import type { ChatComposerHandle } from '../components/ChatComposer'
import type { CondicionFisica, InitiativeRollInfo, LogEntry, QuestInfo, TerritoryInfo, BuildingInfo, SubjectInfo } from '../types'
import type { BusyError, EndedGameError, TurnLockedError } from '../lib/api'

/// A.1 (checklist frontend 2026-08-27) — handleSubmit extraído de GameView.tsx a useTurnFlow.ts;
/// cobertura nueva mismo criterio que useCombatFlow.test.tsx (no exhaustiva, cubre los flujos de
/// mayor riesgo del turno normal: éxito, los 3 caminos de "no hay narración que aplicar"
/// (blocked/transit/postCombatInteraction), los 3 errores especiales (busy/endedGame/turnLocked) y
/// level-up). El harness declara `useState` reales para el estado que GameView.tsx posee de
/// verdad, mismo patrón que useCombatFlow.test.tsx.
vi.mock('../lib/api', () => ({
  requestTurnClassify: vi.fn(),
  requestTurnNarrate: vi.fn(),
  getSave: vi.fn(),
}))

import { requestTurnClassify, requestTurnNarrate, getSave } from '../lib/api'

const mockClassify = vi.mocked(requestTurnClassify)
const mockNarrate = vi.mocked(requestTurnNarrate)
const mockGetSave = vi.mocked(getSave)

function baseProgression() {
  return { xpDelta: 0, newXp: 0, newLevel: 1, leveledUp: false, attributePointsGained: 0 }
}

function baseNarrateResponse(overrides: Partial<Awaited<ReturnType<typeof requestTurnNarrate>>> = {}) {
  return {
    narration: { narration: 'La escena continúa.', newFacts: [] },
    progression: baseProgression(),
    condicionFisica: 'ILESO' as const,
    activeEffects: [],
    entorno: { estacion: { key: 'PRIMAVERA' as const, nombre: "Ur'gathek" }, clima: null },
    energia: 100,
    energiaMax: 100,
    timeLabel: 'Día 1, mañana',
    combateIniciado: null,
    esperandoDefensaJugador: false,
    npcAbilityUsed: null,
    playerAbilityUsed: null,
    combatExchangeDisplay: null,
    nextInitiativeRoll: null,
    finDePartida: false,
    pendingDeathResolution: false,
    justDied: false,
    newInventoryItems: [],
    removedInventoryItemIds: [],
    updatedInventoryItems: [],
    logEntryId: 'log-1',
    quests: [] as QuestInfo[],
    newQuestInfo: null,
    newQuestOfferInfo: null,
    npcInteractionOffer: null,
    dynamicModeOffer: null,
    questCompletedInfo: null,
    factionRepChange: null,
    professionXpGains: [],
    hambre: 100,
    sed: 100,
    newKingdomFounded: null,
    companionCreated: null,
    territories: [] as TerritoryInfo[],
    buildings: [] as BuildingInfo[],
    subjects: [] as SubjectInfo[],
    kingdomStats: null,
    deathCount: 0,
    factionsStatus: {},
    professionProgress: [],
    combatEncounterLootSummary: null,
    discoveredLocationSlug: null,
    ...overrides,
  }
}

function baseClassifyResponse(overrides: Partial<Awaited<ReturnType<typeof requestTurnClassify>>> = {}) {
  return {
    classification: { requiereTirada: false, atributo: 'destreza' as const, dificultad: 8, razon: 'x', banda: 'instantanea' as const, duracionEstimadaMinutos: 0 },
    roll: undefined,
    travel: null,
    npcsInScene: [],
    blocked: undefined,
    transit: undefined,
    postCombatInteraction: undefined,
    duracionMinutos: undefined,
    produccion: undefined,
    ...overrides,
  }
}

function useHarness(fictionalDate = 'Día 1, mañana', onCazaPorTexto?: (r: unknown) => void, thinkingInicial = false) {
  const [characterLog, setCharacterLog] = useState<LogEntry[]>([])
  const [characterThinking, setCharacterThinking] = useState(thinkingInicial)
  const [condicionFisica, setCondicionFisica] = useState<CondicionFisica>('ILESO')
  const [endedAt, setEndedAt] = useState<string | null>(null)
  const [pendingDeathResolution, setPendingDeathResolution] = useState(false)
  const [busyUntil, setBusyUntil] = useState<string | null>(null)
  const [xp, setXp] = useState(0)
  const [level, setLevel] = useState(1)
  const [pendingAttributePoints, setPendingAttributePoints] = useState(0)
  const [lastInitiativeRoll, setLastInitiativeRoll] = useState<InitiativeRollInfo | null>(null)
  const composerRef = useRef<ChatComposerHandle>({ clear: vi.fn(), insertChip: vi.fn(), setTextWithChips: vi.fn() } as never)

  const turn = useTurnFlow({
    saveId: 'save-1',
    fictionalDate,
    busyUntil,
    characterThinking,
    endedAt,
    pendingDeathResolution,
    characterLog,
    composerRef,
    buildEntityBanner: () => undefined,
    pollForResolution: vi.fn(),
    syncFromSave: vi.fn(),
    setCombatAwaitingDefense: vi.fn(),
    setInput: vi.fn(),
    setCharacterThinking,
    setTimedThinkingText: vi.fn(),
    setStreamingNarration: vi.fn(),
    setDiceReveal: vi.fn(),
    setCharacterLog,
    setPostCombatTarget: vi.fn(),
    setCondicionFisica,
    setPlayerActiveEffects: vi.fn(),
    setEntorno: vi.fn(),
    setEnergia: vi.fn(),
    setEnergiaMax: vi.fn(),
    setHambre: vi.fn(),
    setSed: vi.fn(),
    setLastInitiativeRoll,
    setFictionalDate: vi.fn(),
    onCazaPorTexto: onCazaPorTexto as never,
    setSuggestions: vi.fn(),
    setQuests: vi.fn(),
    setTerritories: vi.fn(),
    setBuildings: vi.fn(),
    setSubjects: vi.fn(),
    setKingdomStats: vi.fn(),
    setDeathCount: vi.fn(),
    setFactionsStatus: vi.fn(),
    setProfessionProgress: vi.fn(),
    markCarcassPending: vi.fn(),
    setInventory: vi.fn(),
    setCombateIniciado: vi.fn(),
    setEndedAt,
    setPendingDeathResolution,
    setCurrentLocation: vi.fn(),
    setDestinations: vi.fn(),
    setCompanions: vi.fn(),
    setKingdomFoundedInfo: vi.fn(),
    setXp,
    setLevel,
    setPendingAttributePoints,
    setBusyUntil,
    setBusyActivity: vi.fn(),
    setBusyDuracionMinutos: vi.fn(),
  })

  return { turn, characterLog, condicionFisica, endedAt, pendingDeathResolution, busyUntil, xp, level, pendingAttributePoints, lastInitiativeRoll }
}

beforeEach(() => {
  mockClassify.mockReset()
  mockNarrate.mockReset()
  mockGetSave.mockReset()
})

describe('handleSubmit — guards', () => {
  it('no llama a la API con acción vacía', async () => {
    const { result } = renderHook(() => useHarness())
    await act(() => result.current.turn.handleSubmit(''))
    expect(mockClassify).not.toHaveBeenCalled()
  })

  it('no llama a la API si ya hay un busyUntil activo', async () => {
    mockClassify.mockResolvedValueOnce(baseClassifyResponse())
    const { result, rerender } = renderHook(() => useHarness())
    // Simula que syncFromSave ya fijó busyUntil antes de este intento de submit.
    act(() => result.current.turn.handleSubmit)
    rerender()
    expect(mockClassify).not.toHaveBeenCalled()
  })

  // UX-3 (hito 0.1) — Construir, Viajar y los modales de Campamento llaman a handleSubmit sin pasar
  // por el composer deshabilitado.
  it('UX-3: no llama a la API si el narrador ya está escribiendo (characterThinking)', async () => {
    const { result } = renderHook(() => useHarness('Día 1, mañana', undefined, true))
    await act(() => result.current.turn.handleSubmit('Me pongo a construir una empalizada'))
    expect(mockClassify).not.toHaveBeenCalled()
    expect(result.current.characterLog).toHaveLength(0)
  })

  it('UX-3: un segundo envío en el mismo instante (doble clic) no lanza otro turno', async () => {
    let resolver!: (v: ReturnType<typeof baseClassifyResponse>) => void
    mockClassify.mockImplementationOnce(() => new Promise((r) => (resolver = r)) as never)
    mockClassify.mockResolvedValue(baseClassifyResponse())
    mockNarrate.mockResolvedValue(baseNarrateResponse() as never)
    const { result } = renderHook(() => useHarness())
    const submit = result.current.turn.handleSubmit
    let primero!: Promise<void>
    act(() => {
      primero = submit('Viajo a la Hondonada')
      void submit('Viajo a la Hondonada')
    })
    expect(mockClassify).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolver(baseClassifyResponse())
      await primero
    })
    // Terminado el turno, se puede volver a actuar.
    await act(() => result.current.turn.handleSubmit('Miro alrededor'))
    expect(mockClassify).toHaveBeenCalledTimes(2)
  })
})

describe('handleSubmit — turno normal exitoso', () => {
  it('narra, actualiza condición física/xp, y añade la entrada al log', async () => {
    mockClassify.mockResolvedValueOnce(baseClassifyResponse())
    mockNarrate.mockResolvedValueOnce(baseNarrateResponse({ condicionFisica: 'HERIDO', progression: { ...baseProgression(), xpDelta: 5, newXp: 5 } }))
    const { result } = renderHook(() => useHarness())

    await act(() => result.current.turn.handleSubmit('Exploro la zona.'))

    expect(result.current.condicionFisica).toBe('HERIDO')
    expect(result.current.xp).toBe(5)
    expect(result.current.characterLog.some((e) => e.text === 'La escena continúa.')).toBe(true)
  })

  // Bug real jugando en vivo (2026-09-04): el turno que ABRE combate calcula/persiste
  // `nextInitiativeRoll` desde siempre (turnResolution.ts), pero este hook nunca lo aplicaba al
  // estado — el badge de iniciativa solo aparecía a partir del SEGUNDO intercambio. Mismo patrón
  // ya cubierto para `esperandoDefensaJugador` (línea ~340), ahora replicado para la iniciativa.
  it('el turno que abre combate aplica la iniciativa recibida, no solo los turnos siguientes', async () => {
    // Enriquecida (2026-09-04, centralización de todas las tiradas del juego) — cada lado es ahora
    // un CombatExchangeSideInfo completo, no solo un número plano.
    const jugadorSide = {
      attribute: 'destreza' as const,
      value: 12,
      valorEfectivo: 12,
      multiplicador: 1,
      malus: 0,
      roll: 10,
      rolls: [10],
      rollMode: 'normal' as const,
      attributeBonus: 0,
      result: 15,
      difficulty: 0,
      success: true,
      gradoExito: 'claro' as const,
    }
    const npcSide = { ...jugadorSide, roll: 3, rolls: [3], result: 8 }
    mockClassify.mockResolvedValueOnce(baseClassifyResponse())
    mockNarrate.mockResolvedValueOnce(
      baseNarrateResponse({
        combateIniciado: { npcs: [{ slug: 'orco', name: 'Orco', condicionFisica: 'ILESO', saqueado: false, lootedItemNames: [], analizado: false, capturable: true, activeEffects: [] }] },
        nextInitiativeRoll: { ganador: 'jugador', jugador: jugadorSide, npc: npcSide },
      }),
    )
    const { result } = renderHook(() => useHarness())

    await act(() => result.current.turn.handleSubmit('Ataco al Orco.'))

    expect(result.current.lastInitiativeRoll).toEqual({ ganador: 'jugador', jugador: jugadorSide, npc: npcSide })
  })

  it('level up: la línea de subida llega del backend y sale antes del golpe gratis que la sigue (P117/QA-70)', async () => {
    mockClassify.mockResolvedValueOnce(baseClassifyResponse())
    mockNarrate.mockResolvedValueOnce(
      baseNarrateResponse({
        progression: { xpDelta: 100, newXp: 100, newLevel: 2, leveledUp: true, attributePointsGained: 1 },
        intercambiosExtra: [
          { logEntryId: 'l1', text: 'Gorhorn sube a nivel 2. Gana 1 puntos de atributo para repartir.', combate: false, esSubidaDeNivel: true },
          { logEntryId: 'l2', text: 'Guchapo 3 te golpea sin que puedas defenderte (estás ocupado con otro rival). Estado: Muerto.', combate: true },
        ],
      }),
    )
    const { result } = renderHook(() => useHarness())

    await act(() => result.current.turn.handleSubmit('Ataco al orco.'))

    expect(result.current.level).toBe(2)
    expect(result.current.pendingAttributePoints).toBe(1)
    const subidas = result.current.characterLog.filter((e) => e.isLevelUp)
    expect(subidas).toHaveLength(1)
    const ids = result.current.characterLog.map((e) => e.id)
    expect(ids.indexOf('l1')).toBeLessThan(ids.indexOf('l2'))
    expect(result.current.characterLog.find((e) => e.id === 'l1')?.combate).toBe(false)
  })
})

describe('handleSubmit — hora de "TU ACCIÓN" (F9-3)', () => {
  it('usa la hora más reciente aunque handleSubmit sea el de un render anterior (camino de caza)', async () => {
    mockClassify.mockResolvedValueOnce(baseClassifyResponse())
    mockNarrate.mockResolvedValueOnce(baseNarrateResponse())
    let fecha = 'Día 1, 08:00'
    const { result, rerender } = renderHook(() => useHarness(fecha))
    const handleSubmitViejo = result.current.turn.handleSubmit
    fecha = 'Día 1, 08:12'
    rerender()
    await act(() => handleSubmitViejo('Cazo al Gesgurio.'))
    const accion = result.current.characterLog.find((e) => e.text === 'Cazo al Gesgurio.')
    expect(accion?.timeLabel).toBe('Día 1, 08:12')
  })
})

describe('handleSubmit — B29 atacar por texto a fauna adyacente', () => {
  it('cazaPorTexto: entrega el resultado a onCazaPorTexto, conserva la acción optimista y nunca llama a requestTurnNarrate', async () => {
    const cazaPorTexto = { resuelveSinCombate: false as const, exito: null, actionText: "Salgo a cazar y ataco a 'Gesgurio'." }
    mockClassify.mockResolvedValueOnce(baseClassifyResponse({ cazaPorTexto }))
    const onCaza = vi.fn()
    const { result } = renderHook(() => useHarness('Día 1, mañana', onCaza))

    await act(() => result.current.turn.handleSubmit('Ataco al Gesgurio.'))

    expect(onCaza).toHaveBeenCalledWith(cazaPorTexto)
    expect(mockNarrate).not.toHaveBeenCalled()
    expect(result.current.characterLog.some((e) => e.text === 'Ataco al Gesgurio.')).toBe(true)
  })
})

describe('handleSubmit — caminos que no llegan a narrar', () => {
  // Pieza 6d (2026-09-03, "mundo determinista, el narrador solo narra"): antes este camino
  // recargaba la partida entera (getSave + syncFromSave) — ahora construye la LogEntry de
  // bloqueo en memoria directamente (resolveBlockedTurn, backend, no toca nada más del Save
  // aparte de los 2 LogEntry ya persistidos), mismo criterio que el bloque narrate normal.
  it('blocked: añade la narración bloqueada al log en memoria, sin recargar la partida ni llamar a requestTurnNarrate', async () => {
    mockClassify.mockResolvedValueOnce(baseClassifyResponse({ blocked: { narration: 'No hay nada así por aquí.' } }))
    const { result } = renderHook(() => useHarness())

    await act(() => result.current.turn.handleSubmit('Vuelo por el cielo.'))

    expect(mockGetSave).not.toHaveBeenCalled()
    expect(mockNarrate).not.toHaveBeenCalled()
    const last = result.current.characterLog.at(-1)
    expect(last?.text).toBe('No hay nada así por aquí.')
    expect(last?.channel).toBe('character')
  })

  it('blocked con harvestSuggestion (Pieza 6d): la LogEntry en memoria lleva el dato del botón', async () => {
    mockClassify.mockResolvedValueOnce(
      baseClassifyResponse({
        blocked: {
          narration: 'Busca el matorral de cuerno en el mapa de la zona.',
          harvestSuggestion: { sourceName: 'matorral de cuerno' },
        },
      }),
    )
    const { result } = renderHook(() => useHarness())

    await act(() => result.current.turn.handleSubmit('Talo el matorral de cuerno.'))

    const last = result.current.characterLog.at(-1)
    expect(last?.harvestSuggestion).toEqual({ sourceName: 'matorral de cuerno' })
  })

  it('transit: recarga la partida entera (banda extendida/larga resuelta en diferido)', async () => {
    mockClassify.mockResolvedValueOnce(baseClassifyResponse({ transit: { activity: 'x', busyUntil: '2026-01-01' } as never }))
    mockGetSave.mockResolvedValueOnce({} as never)
    const { result } = renderHook(() => useHarness())

    await act(() => result.current.turn.handleSubmit('Viajo a Cristal Helado.'))

    expect(mockGetSave).toHaveBeenCalledWith('save-1')
    expect(mockNarrate).not.toHaveBeenCalled()
  })

  it('postCombatInteraction: deshace la entrada optimista del log, nunca llama a requestTurnNarrate', async () => {
    mockClassify.mockResolvedValueOnce(baseClassifyResponse({ postCombatInteraction: { slug: 'orco', name: 'Orco', condicionFisica: 'MUERTO', saqueado: false } as never }))
    const { result } = renderHook(() => useHarness())

    await act(() => result.current.turn.handleSubmit("Saqueo el cuerpo de 'Orco'."))

    expect(mockNarrate).not.toHaveBeenCalled()
    // La entrada optimista "TÚ: ..." se metió y se deshizo — el log queda vacío, no con esa acción.
    expect(result.current.characterLog).toHaveLength(0)
  })
})

describe('handleSubmit — errores especiales', () => {
  it('busy: fija busyUntil y quita la entrada optimista del log', async () => {
    mockClassify.mockResolvedValueOnce(baseClassifyResponse())
    const busyError: BusyError = { status: 409, activity: 'viajar', busyUntil: '2026-01-01T00:00:00Z', duracionMinutos: 30 }
    mockNarrate.mockRejectedValueOnce(busyError)
    const { result } = renderHook(() => useHarness())

    await act(() => result.current.turn.handleSubmit('Viajo lejos.'))

    expect(result.current.busyUntil).toBe('2026-01-01T00:00:00Z')
    expect(result.current.characterLog).toHaveLength(0)
  })

  it('endedGame: fija endedAt y quita la entrada optimista del log', async () => {
    mockClassify.mockResolvedValueOnce(baseClassifyResponse())
    const endedError: EndedGameError = { status: 409, ended: true, endedAt: '2026-01-01T00:00:00Z' }
    mockNarrate.mockRejectedValueOnce(endedError)
    const { result } = renderHook(() => useHarness())

    await act(() => result.current.turn.handleSubmit('Sigo jugando.'))

    expect(result.current.endedAt).toBe('2026-01-01T00:00:00Z')
    expect(result.current.characterLog).toHaveLength(0)
  })

  it('turnLocked: añade un aviso determinista, sin tocar busyUntil/endedAt', async () => {
    mockClassify.mockResolvedValueOnce(baseClassifyResponse())
    const lockedError: TurnLockedError = { status: 409, locked: true }
    mockNarrate.mockRejectedValueOnce(lockedError)
    const { result } = renderHook(() => useHarness())

    await act(() => result.current.turn.handleSubmit('Ataco de nuevo.'))

    expect(result.current.busyUntil).toBeNull()
    expect(result.current.endedAt).toBeNull()
    expect(result.current.characterLog.some((e) => e.text.includes('todavía se está resolviendo') || e.text.includes('espera un momento'))).toBe(true)
  })
})

/// P56 y P55 (QA-27): el turno que abre un combate de grupo con intercambio real.
describe('handleSubmit — turno que abre un combate con intercambio', () => {
  const intercambio = { atacanteEsJugador: true, resultado: 'golpe_normal', rivalNombre: 'Guchapo' } as never

  it('P56: la entrada lleva el intercambio y no la tirada simple de la acción', async () => {
    mockClassify.mockResolvedValueOnce(
      baseClassifyResponse({ roll: { attribute: 'fuerza', value: 11, roll: 6, difficulty: 15, result: 11, success: false } as never }),
    )
    mockNarrate.mockResolvedValueOnce(baseNarrateResponse({ combatExchangeDisplay: intercambio }) as never)
    const { result } = renderHook(() => useHarness())
    await act(() => result.current.turn.handleSubmit('Salgo a cazar y ataco al Guchapo'))
    const entrada = result.current.characterLog.find((e) => e.id === 'log-1')!
    expect(entrada.combatExchange).toBe(intercambio)
    expect(entrada.roll).toBeUndefined()
  })

  it('P55: los demás ataques que recibió van al diario tras la narración', async () => {
    mockClassify.mockResolvedValueOnce(baseClassifyResponse())
    mockNarrate.mockResolvedValueOnce(
      baseNarrateResponse({
        combatExchangeDisplay: intercambio,
        intercambiosExtra: [
          { logEntryId: 'extra-1', text: 'Guchapo te ataca.', combatExchange: intercambio },
          { logEntryId: 'extra-2', text: 'Guchapo te golpea sin que puedas defenderte (estás ocupado con otro rival). Estado: Herido.' },
        ],
      }) as never,
    )
    const { result } = renderHook(() => useHarness())
    await act(() => result.current.turn.handleSubmit('Salgo a cazar y ataco al Guchapo'))
    const ids = result.current.characterLog.map((e) => e.id)
    expect(ids.indexOf('extra-1')).toBe(ids.indexOf('log-1') + 1)
    expect(ids.indexOf('extra-2')).toBe(ids.indexOf('log-1') + 2)
  })
})
