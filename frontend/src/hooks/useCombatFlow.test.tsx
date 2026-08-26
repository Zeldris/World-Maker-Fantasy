import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCombatFlow } from './useCombatFlow'
import type { InventoryItemInfo, LogEntry, NpcInSceneInfo, QuestInfo } from '../types'

/// Cobertura nueva (auditoría de deuda técnica 2026-08-25): useCombatFlow.ts (585 líneas, el hook
/// con más lógica de decisión del proyecto) no tenía ningún test — de hecho `hooks/` entera no
/// tenía ninguno, el frontend no tenía infraestructura para testear hooks/componentes en absoluto
/// (@testing-library/react + jsdom añadidos en esta misma pasada, ver vitest.config.ts). No
/// exhaustivo (79 ramas reales) — cubre los flujos de mayor riesgo, casi todos con un "bug real"
/// documentado en el propio código fuente que los originó.
///
/// `useCombatFlow` recibe ~20 piezas de "estado de save" como parámetros (valor+setter) que
/// GameView.tsx posee de verdad (ver comentario de cabecera del propio hook) — este arnés las
/// declara como `useState` reales dentro de un hook envoltorio, para que las actualizaciones
/// funcionales (`setX((prev) => ...)`) se comporten exactamente igual que en producción, en vez de
/// stubs que solo registran la llamada.
vi.mock('../lib/api', () => ({
  requestTurnClassify: vi.fn(),
  requestTurnNarrate: vi.fn(),
  requestFlee: vi.fn(),
}))

import { requestTurnClassify, requestTurnNarrate, requestFlee } from '../lib/api'

const mockClassify = vi.mocked(requestTurnClassify)
const mockNarrate = vi.mocked(requestTurnNarrate)
const mockFlee = vi.mocked(requestFlee)

function npc(overrides: Partial<NpcInSceneInfo> & { slug: string; name: string }): NpcInSceneInfo {
  return { condicionFisica: 'ILESO', saqueado: false, lootedItemNames: [], analizado: false, ...overrides }
}

function baseProgression() {
  return { xpDelta: 0, newXp: 0, newLevel: 1, leveledUp: false, attributePointsGained: 0 }
}

function baseNarrateResponse(overrides: Partial<Awaited<ReturnType<typeof requestTurnNarrate>>> = {}) {
  return {
    narration: { narration: 'La escena continúa.', newFacts: [] },
    progression: baseProgression(),
    condicionFisica: 'ILESO' as const,
    energia: 100,
    energiaMax: 100,
    timeLabel: 'Día 1, mañana',
    combateIniciado: null,
    finDePartida: false,
    justDied: false,
    newInventoryItems: [],
    removedInventoryItemIds: [],
    updatedInventoryItems: [],
    logEntryId: 'log-1',
    quests: [] as QuestInfo[],
    esperandoDefensaJugador: false,
    npcAbilityUsed: null,
    playerAbilityUsed: null,
    combatExchangeDisplay: null,
    nextInitiativeRoll: null,
    deathCount: 0,
    factionsStatus: {},
    professionProgress: [],
    combatEncounterLootSummary: null,
    ...overrides,
  }
}

function useHarness() {
  const [combateIniciado, setCombateIniciado] = useState<{ npcs: NpcInSceneInfo[] } | null>(null)
  const [inventory, setInventory] = useState<InventoryItemInfo[]>([])
  const [characterLog, setCharacterLog] = useState<LogEntry[]>([])
  const [quests, setQuests] = useState<QuestInfo[]>([])
  const [deathCount, setDeathCount] = useState(0)
  const [factionsStatus, setFactionsStatus] = useState<Record<string, number>>({})
  const [xp, setXp] = useState(0)
  const [level, setLevel] = useState(1)
  const [pendingAttributePoints, setPendingAttributePoints] = useState(0)
  const [condicionFisica, setCondicionFisica] = useState<'ILESO' | 'HERIDO' | 'GRAVE' | 'CONVALECIENTE' | 'MUERTO'>('ILESO')
  const [endedAt, setEndedAt] = useState<string | null>(null)
  const [carcassPending, setCarcassPending] = useState<boolean | null>(null)

  const combat = useCombatFlow({
    saveId: 'save-1',
    fictionalDate: 'Día 1, mañana',
    level,
    savedActions: [{ id: 'ability-1', name: 'Ataque Básico', promptText: 'Ataco a mi enemigo', icon: '⚔️' } as never],
    inventory,
    setInventory,
    enciclopediaData: null,
    buildEntityBanner: () => undefined,
    combateIniciado,
    setCombateIniciado,
    setLastInitiativeRoll: vi.fn(),
    activePanel: null,
    setActivePanel: vi.fn(),
    combatDisabledTabs: [],
    setCharacterThinking: vi.fn(),
    setCharacterLog,
    setQuests,
    setDeathCount,
    setFactionsStatus,
    setProfessionProgress: vi.fn(),
    setXp,
    setLevel,
    setPendingAttributePoints,
    setCondicionFisica,
    setEnergia: vi.fn(),
    setEnergiaMax: vi.fn(),
    setFictionalDate: vi.fn(),
    setEndedAt,
    setDiceReveal: vi.fn(),
    setCarcassPending,
  })

  return { combat, combateIniciado, setCombateIniciado, inventory, characterLog, quests, deathCount, factionsStatus, xp, level, pendingAttributePoints, condicionFisica, endedAt, carcassPending }
}

beforeEach(() => {
  mockClassify.mockReset()
  mockNarrate.mockReset()
  mockFlee.mockReset()
})

describe('openCombat', () => {
  it('abre el combate con los NPC de combateIniciado, reseteando la selección previa', () => {
    const { result } = renderHook(() => useHarness())
    act(() => {
      result.current.setCombateIniciado({ npcs: [npc({ slug: 'orco', name: 'Orco Enfurecido' })] })
    })
    act(() => result.current.combat.openCombat())
    expect(result.current.combat.combatOpen).toBe(true)
    expect(result.current.combat.combatNpcsDisplay).toEqual([
      { slug: 'orco', name: 'Orco Enfurecido', condicion: 'ILESO', yaSaqueado: false, lootedItemNames: [], analizado: false },
    ])
    expect(result.current.combat.combatSelectedNpcSlug).toBe('orco')
  })

  it('bug real (2026-08-21): con combatOverride, abre el combate aunque combateIniciado del closure todavía sea null', () => {
    // Reproduce handleHuntResolved: setCombateIniciado(x) y openCombat(x) en la misma sincronía,
    // ANTES de que el setState anterior se refleje en el closure de este render.
    const { result } = renderHook(() => useHarness())
    const override = { npcs: [npc({ slug: 'murgol', name: 'Múrgol' })] }
    act(() => {
      result.current.setCombateIniciado(override)
      result.current.combat.openCombat(override)
    })
    expect(result.current.combat.combatOpen).toBe(true)
    expect(result.current.combat.combatNpcsDisplay[0]?.slug).toBe('murgol')
  })

  it('no abre nada si no hay combate ni override', () => {
    const { result } = renderHook(() => useHarness())
    act(() => result.current.combat.openCombat())
    expect(result.current.combat.combatOpen).toBe(false)
  })
})

describe('submitCombatAction — guards', () => {
  it('no llama a la API con acción vacía', async () => {
    const { result } = renderHook(() => useHarness())
    const ok = await act(() => result.current.combat.submitCombatAction('   ', {}))
    expect(ok).toBe(false)
    expect(mockClassify).not.toHaveBeenCalled()
  })

  it('bug real (2026-07-31): con combatEnded=true, una acción normal se bloquea pero Registrar (allowAfterEnded) sí llega a la API', async () => {
    mockClassify.mockResolvedValue({ classification: { atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'instantanea' }, roll: undefined } as never)
    mockNarrate.mockResolvedValue(baseNarrateResponse() as never)
    const { result } = renderHook(() => useHarness())
    // Abrir con un rival YA muerto dispara el useEffect que marca combatEnded=true solo (bug real
    // 2026-07-25, "esto ya terminó"). CONVALECIENTE ya no basta (2026-08-26, CONVALECIENTE deja
    // de ser "victoria automática") — hace falta MUERTO o `dismissed`, ver el describe de abajo.
    act(() => result.current.setCombateIniciado({ npcs: [npc({ slug: 'orco', name: 'Orco', condicionFisica: 'MUERTO' })] }))
    act(() => result.current.combat.openCombat())
    await waitFor(() => expect(result.current.combat.combatEnded).toBe(true))

    const ok = await act(() => result.current.combat.submitCombatAction('Ataco de nuevo', {}))
    expect(ok).toBe(false)
    expect(mockClassify).not.toHaveBeenCalled()

    await act(() => result.current.combat.handleCombatRegistrar(result.current.combat.combatNpcsDisplay[0]!))
    expect(mockClassify).toHaveBeenCalledTimes(1)
  })
})

describe('submitCombatAction — camino feliz', () => {
  it('resuelve classify+narrate reales y actualiza quests/deathCount/factionsStatus/xp/condicionFisica', async () => {
    mockClassify.mockResolvedValue({ classification: { atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'instantanea' }, roll: undefined } as never)
    mockNarrate.mockResolvedValue(
      baseNarrateResponse({
        progression: { xpDelta: 50, newXp: 50, newLevel: 1, leveledUp: false, attributePointsGained: 0 },
        condicionFisica: 'HERIDO',
        deathCount: 2,
        factionsStatus: { 'clan-serhu': 10 },
        quests: [{ id: 'q1' } as unknown as QuestInfo],
      }) as never,
    )
    const { result } = renderHook(() => useHarness())
    const ok = await act(() => result.current.combat.submitCombatAction('Ataco a mi enemigo', {}))

    expect(ok).toBe(true)
    expect(mockClassify).toHaveBeenCalledTimes(1)
    expect(mockNarrate).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(result.current.condicionFisica).toBe('HERIDO')
      expect(result.current.deathCount).toBe(2)
      expect(result.current.factionsStatus).toEqual({ 'clan-serhu': 10 })
      expect(result.current.xp).toBe(50)
      expect(result.current.quests).toHaveLength(1)
      expect(result.current.characterLog).toHaveLength(1)
      expect(result.current.characterLog[0]?.text).toBe('La escena continúa.')
    })
  })

  it('en subida de nivel, suma pendingAttributePoints y actualiza level', async () => {
    mockClassify.mockResolvedValue({ classification: { atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'instantanea' }, roll: undefined } as never)
    mockNarrate.mockResolvedValue(
      baseNarrateResponse({ progression: { xpDelta: 500, newXp: 500, newLevel: 3, leveledUp: true, attributePointsGained: 2 } }) as never,
    )
    const { result } = renderHook(() => useHarness())
    await act(() => result.current.combat.submitCombatAction('Ataco a mi enemigo', {}))
    await waitFor(() => {
      expect(result.current.level).toBe(3)
      expect(result.current.pendingAttributePoints).toBe(2)
    })
  })

  it('bug real (2026-07-29): justDied cierra el combate aunque condicionFisica ya llegue en ILESO (respawn)', async () => {
    mockClassify.mockResolvedValue({ classification: { atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'instantanea' }, roll: undefined } as never)
    mockNarrate.mockResolvedValue(baseNarrateResponse({ condicionFisica: 'ILESO', justDied: true }) as never)
    const { result } = renderHook(() => useHarness())
    act(() => result.current.setCombateIniciado({ npcs: [npc({ slug: 'orco', name: 'Orco' })] }))
    act(() => result.current.combat.openCombat())
    await act(() => result.current.combat.submitCombatAction('Ataco a mi enemigo', {}))
    await waitFor(() => expect(result.current.combat.combatEnded).toBe(true))
  })
})

describe('handleCombatAttack — habilidad + objetivo seleccionados', () => {
  it('bug real jugando en vivo (2026-08-26): el nombre del objetivo va introducido por "contra", nunca pegado al final del promptText', async () => {
    mockClassify.mockResolvedValue({ classification: { atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'instantanea' }, roll: undefined } as never)
    mockNarrate.mockResolvedValue(baseNarrateResponse() as never)
    const { result } = renderHook(() => useHarness())
    act(() => result.current.setCombateIniciado({ npcs: [npc({ slug: 'orco', name: 'Orco Enfurecido' })] }))
    act(() => result.current.combat.openCombat())
    act(() => result.current.combat.setCombatSelectedAbilityId('ability-1'))

    await act(() => result.current.combat.handleCombatActuar())

    expect(mockClassify).toHaveBeenCalledWith(expect.objectContaining({ action: "Ataco a mi enemigo, contra 'Orco Enfurecido'." }))
  })
})

describe('handleCombatTurnResolved — fusión de combateIniciado', () => {
  it('nunca "resucita" a un NPC ya visto peor localmente, aunque el backend mande un estado mejor', async () => {
    mockClassify.mockResolvedValue({ classification: { atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'instantanea' }, roll: undefined } as never)
    // El backend manda CONVALECIENTE, pero el estado local YA vio a este NPC MUERTO (un remate
    // previo en el mismo combate) — CONDICION_ORDER dice que MUERTO es "más avanzado" que
    // CONVALECIENTE, así que la fusión no debe pisarlo hacia atrás.
    mockNarrate.mockResolvedValue(
      baseNarrateResponse({ combateIniciado: { npcs: [npc({ slug: 'orco', name: 'Orco', condicionFisica: 'CONVALECIENTE' })] } }) as never,
    )
    const { result } = renderHook(() => useHarness())
    act(() => result.current.setCombateIniciado({ npcs: [npc({ slug: 'orco', name: 'Orco', condicionFisica: 'MUERTO' })] }))
    act(() => result.current.combat.openCombat())
    expect(result.current.combat.combatNpcsDisplay[0]?.condicion).toBe('MUERTO')

    await act(() => result.current.combat.submitCombatAction('Ataco a mi enemigo', {}))
    await waitFor(() => {
      expect(result.current.combat.combatNpcsDisplay.find((n) => n.slug === 'orco')?.condicion).toBe('MUERTO')
    })
  })
})

describe('handleDecapitarSeleccion', () => {
  it('marca MUERTO de forma optimista y lo mantiene si el turno se resuelve bien', async () => {
    mockClassify.mockResolvedValue({ classification: { atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'instantanea' }, roll: undefined } as never)
    mockNarrate.mockResolvedValue(baseNarrateResponse() as never)
    const { result } = renderHook(() => useHarness())
    act(() => result.current.setCombateIniciado({ npcs: [npc({ slug: 'orco', name: 'Orco', condicionFisica: 'CONVALECIENTE' })] }))
    act(() => result.current.combat.openCombat())

    const target = result.current.combat.combatNpcsDisplay[0]!
    await act(() => result.current.combat.handleDecapitarSeleccion([target]))
    await waitFor(() => {
      // CONVALECIENTE deja de ser "victoria automática" (2026-08-26): decapitar ya NO cierra el
      // combate por su cuenta (`combatOpen` se queda `true`, el panel sigue abierto) — el único
      // efecto de Matar al último rival es que `combatEnded` pasa a `true` vía el propio
      // `useEffect` de `combatEnded` (ver más arriba en useCombatFlow.ts), no un cierre manual.
      expect(result.current.combat.combatNpcsDisplay.find((n) => n.slug === 'orco')?.condicion).toBe('MUERTO')
      expect(result.current.combat.combatEnded).toBe(true)
      expect(result.current.combat.combatOpen).toBe(true)
    })
  })

  it('bug real (2026-07-28): revierte a CONVALECIENTE si el turno falla — no deja el saqueo/remate optimista colgado', async () => {
    mockClassify.mockResolvedValue({ classification: { atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'instantanea' }, roll: undefined } as never)
    mockNarrate.mockRejectedValue(new Error('fallo de red'))
    const { result } = renderHook(() => useHarness())
    act(() => result.current.setCombateIniciado({ npcs: [npc({ slug: 'orco', name: 'Orco', condicionFisica: 'CONVALECIENTE' })] }))
    act(() => result.current.combat.openCombat())

    const target = result.current.combat.combatNpcsDisplay[0]!
    await act(() => result.current.combat.handleDecapitarSeleccion([target]))
    await waitFor(() => {
      expect(result.current.combat.combatNpcsDisplay.find((n) => n.slug === 'orco')?.condicion).toBe('CONVALECIENTE')
      expect(result.current.combat.combatOpen).toBe(true) // nunca llegó a cerrarse
    })
  })
})

describe('handleFleeAttempt', () => {
  it('huida con éxito: limpia combateIniciado sin abrir el popup', async () => {
    mockFlee.mockResolvedValue({ escaped: true, text: 'Logras escapar.' })
    const { result } = renderHook(() => useHarness())
    act(() => result.current.setCombateIniciado({ npcs: [npc({ slug: 'orco', name: 'Orco' })] }))
    await act(() => result.current.combat.handleFleeAttempt())
    await waitFor(() => {
      expect(result.current.combateIniciado).toBeNull()
      expect(result.current.combat.combatOpen).toBe(false)
      expect(result.current.characterLog).toHaveLength(1)
    })
  })

  it('huida fallida: abre el popup de combate normal', async () => {
    mockFlee.mockResolvedValue({ escaped: false, text: 'No consigues escapar.' })
    const { result } = renderHook(() => useHarness())
    act(() => result.current.setCombateIniciado({ npcs: [npc({ slug: 'orco', name: 'Orco' })] }))
    await act(() => result.current.combat.handleFleeAttempt())
    await waitFor(() => {
      expect(result.current.combat.combatOpen).toBe(true)
    })
  })
})

describe('closeCombat / handleCombatHuir', () => {
  it('closeCombat resetea combatOpen/combateIniciado/combatAwaitingDefense', () => {
    const { result } = renderHook(() => useHarness())
    act(() => result.current.setCombateIniciado({ npcs: [npc({ slug: 'orco', name: 'Orco' })] }))
    act(() => result.current.combat.openCombat())
    act(() => result.current.combat.closeCombat())
    expect(result.current.combat.combatOpen).toBe(false)
    expect(result.current.combateIniciado).toBeNull()
  })

  it('handleCombatHuir cierra el popup de inmediato (fire-and-forget), sin esperar la respuesta del backend', () => {
    mockClassify.mockImplementation(() => new Promise(() => {})) // nunca resuelve en este test
    const { result } = renderHook(() => useHarness())
    act(() => result.current.setCombateIniciado({ npcs: [npc({ slug: 'orco', name: 'Orco' })] }))
    act(() => result.current.combat.openCombat())
    act(() => result.current.combat.handleCombatHuir())
    expect(result.current.combat.combatOpen).toBe(false)
    expect(result.current.combateIniciado).toBeNull()
  })
})
