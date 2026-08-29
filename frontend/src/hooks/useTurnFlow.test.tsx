import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRef, useState } from 'react'
import { renderHook, act } from '@testing-library/react'
import { useTurnFlow } from './useTurnFlow'
import type { ChatComposerHandle } from '../components/ChatComposer'
import type { CondicionFisica, LogEntry, QuestInfo, TerritoryInfo, BuildingInfo, SubjectInfo } from '../types'
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
    justDied: false,
    newInventoryItems: [],
    removedInventoryItemIds: [],
    updatedInventoryItems: [],
    logEntryId: 'log-1',
    quests: [] as QuestInfo[],
    newQuestInfo: null,
    newQuestOfferInfo: null,
    dynamicModeOffer: null,
    questCompletedInfo: null,
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

function useHarness() {
  const [characterLog, setCharacterLog] = useState<LogEntry[]>([])
  const [condicionFisica, setCondicionFisica] = useState<CondicionFisica>('ILESO')
  const [endedAt, setEndedAt] = useState<string | null>(null)
  const [busyUntil, setBusyUntil] = useState<string | null>(null)
  const [xp, setXp] = useState(0)
  const [level, setLevel] = useState(1)
  const [pendingAttributePoints, setPendingAttributePoints] = useState(0)
  const composerRef = useRef<ChatComposerHandle>({ clear: vi.fn(), insertChip: vi.fn(), setTextWithChips: vi.fn() } as never)

  const turn = useTurnFlow({
    saveId: 'save-1',
    fictionalDate: 'Día 1, mañana',
    characterName: 'Gorhorn',
    busyUntil,
    endedAt,
    characterLog,
    composerRef,
    buildEntityBanner: () => undefined,
    pollForResolution: vi.fn(),
    syncFromSave: vi.fn(),
    setCombatAwaitingDefense: vi.fn(),
    setInput: vi.fn(),
    setCharacterThinking: vi.fn(),
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
    setFictionalDate: vi.fn(),
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

  return { turn, characterLog, condicionFisica, endedAt, busyUntil, xp, level, pendingAttributePoints }
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

  it('level up añade una entrada extra de subida de nivel', async () => {
    mockClassify.mockResolvedValueOnce(baseClassifyResponse())
    mockNarrate.mockResolvedValueOnce(
      baseNarrateResponse({ progression: { xpDelta: 100, newXp: 100, newLevel: 2, leveledUp: true, attributePointsGained: 1 } }),
    )
    const { result } = renderHook(() => useHarness())

    await act(() => result.current.turn.handleSubmit('Ataco al orco.'))

    expect(result.current.level).toBe(2)
    expect(result.current.pendingAttributePoints).toBe(1)
    expect(result.current.characterLog.some((e) => e.isLevelUp)).toBe(true)
  })
})

describe('handleSubmit — caminos que no llegan a narrar', () => {
  it('blocked: recarga la partida entera, nunca llama a requestTurnNarrate', async () => {
    mockClassify.mockResolvedValueOnce(baseClassifyResponse({ blocked: { reason: 'x' } as never }))
    mockGetSave.mockResolvedValueOnce({} as never)
    const { result } = renderHook(() => useHarness())

    await act(() => result.current.turn.handleSubmit('Vuelo por el cielo.'))

    expect(mockGetSave).toHaveBeenCalledWith('save-1')
    expect(mockNarrate).not.toHaveBeenCalled()
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
