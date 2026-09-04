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
  requestHuirEnCurso: vi.fn(),
  postCapturar: vi.fn(),
  dejarVivir: vi.fn(),
}))

import { requestTurnClassify, requestTurnNarrate, requestFlee, requestHuirEnCurso, postCapturar, dejarVivir } from '../lib/api'

const mockClassify = vi.mocked(requestTurnClassify)
const mockNarrate = vi.mocked(requestTurnNarrate)
const mockPostCapturar = vi.mocked(postCapturar)
const mockDejarVivir = vi.mocked(dejarVivir)
const mockFlee = vi.mocked(requestFlee)
const mockHuirEnCurso = vi.mocked(requestHuirEnCurso)

function npc(overrides: Partial<NpcInSceneInfo> & { slug: string; name: string }): NpcInSceneInfo {
  return { condicionFisica: 'ILESO', saqueado: false, lootedItemNames: [], analizado: false, capturable: true, activeEffects: [], ...overrides }
}

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

function useHarness(initialCombateIniciado: { npcs: NpcInSceneInfo[] } | null = null) {
  const [combateIniciado, setCombateIniciado] = useState<{ npcs: NpcInSceneInfo[] } | null>(initialCombateIniciado)
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
    setPlayerActiveEffects: vi.fn(),
    setEntorno: vi.fn(),
    setEnergia: vi.fn(),
    setEnergiaMax: vi.fn(),
    setFictionalDate: vi.fn(),
    setEndedAt,
    setDiceReveal: vi.fn(),
    markCarcassPending: () => setCarcassPending(true),
  })

  return { combat, combateIniciado, setCombateIniciado, inventory, characterLog, quests, deathCount, factionsStatus, xp, level, pendingAttributePoints, condicionFisica, endedAt, carcassPending }
}

beforeEach(() => {
  mockClassify.mockReset()
  mockNarrate.mockReset()
  mockFlee.mockReset()
  mockHuirEnCurso.mockReset()
  mockPostCapturar.mockReset()
  mockDejarVivir.mockReset()
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
      {
        slug: 'orco',
        name: 'Orco Enfurecido',
        condicion: 'ILESO',
        yaSaqueado: false,
        lootedItemNames: [],
        analizado: false,
        activeEffects: [],
        participantId: undefined,
        instanceNumber: undefined,
        // Tarjeta persistente de Convaleciente (fix 2026-08-28, LogPanel.tsx) — capturable ahora
        // se propaga desde NpcInSceneInfo, antes se perdía en npcInSceneToCombatDisplay.
        capturable: true,
      },
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

// BUG CERRADO (2026-08-29, ver comentario de `CombatParticipant.dismissedGrupo` en schema.prisma
// y `combatKeyFor` en gameViewHelpers.ts): Capturar/Clemente filtraban `combatNpcStates` por
// `slug` a secas — con 2+ individuos del mismo Npc de catálogo en el mismo CombatEncounter (mismo
// slug, `participantId` distinto), marcar `dismissed` sobre UNO los marcaba a TODOS de golpe.
describe('handleCapturarSeleccion/handleDejarVivirSeleccion: identificador de combatientes duplicados (bug real 2026-08-29)', () => {
  it('Capturar sobre un individuo de un grupo de 2 (mismo slug) marca dismissed SOLO en ese participantId', async () => {
    const { result } = renderHook(() => useHarness())
    const npcs = [
      npc({ slug: 'gesgurio', name: 'Gesgurio', condicionFisica: 'CONVALECIENTE', participantId: 'p1' }),
      npc({ slug: 'gesgurio', name: 'Gesgurio', condicionFisica: 'CONVALECIENTE', participantId: 'p2' }),
    ]
    act(() => {
      result.current.setCombateIniciado({ npcs })
      result.current.combat.openCombat({ npcs })
    })
    mockPostCapturar.mockResolvedValueOnce({ npcSlug: 'gesgurio', tipo: 'FAUNA', inventoryItemId: 'item-1', capturaExpiraAtMinutes: null })

    await act(() => result.current.combat.handleCapturarSeleccion(result.current.combat.combatNpcsDisplay[0]))

    expect(mockPostCapturar).toHaveBeenCalledWith(expect.any(String), 'gesgurio', 'p1')
    const [p1, p2] = result.current.combat.combatNpcsDisplay
    expect(p1.dismissed).toBe(true)
    expect(p2.dismissed).not.toBe(true) // el otro individuo del grupo NO se ve afectado
  })

  it('Clemente (dejarVivir) sobre un individuo de un grupo de 2 marca dismissed SOLO en ese participantId', async () => {
    const { result } = renderHook(() => useHarness())
    const npcs = [
      npc({ slug: 'gesgurio', name: 'Gesgurio', condicionFisica: 'CONVALECIENTE', participantId: 'p1' }),
      npc({ slug: 'gesgurio', name: 'Gesgurio', condicionFisica: 'CONVALECIENTE', participantId: 'p2' }),
    ]
    act(() => {
      result.current.setCombateIniciado({ npcs })
      result.current.combat.openCombat({ npcs })
    })
    mockDejarVivir.mockResolvedValueOnce({ npcSlug: 'gesgurio', logEntry: { id: 'log-1', text: 'x', timeLabel: 'x', createdAt: 'x' } })

    await act(() => result.current.combat.handleDejarVivirSeleccion(result.current.combat.combatNpcsDisplay[1]))

    expect(mockDejarVivir).toHaveBeenCalledWith(expect.any(String), 'gesgurio', 'p2')
    const [p1, p2] = result.current.combat.combatNpcsDisplay
    expect(p1.dismissed).not.toBe(true) // el otro individuo del grupo NO se ve afectado
    expect(p2.dismissed).toBe(true)
  })
})

// BUG CERRADO (2026-08-29, ver docs/checklist-pruebas-juego.md "recargar tras Convaleciente atasca
// el combate del todo") — antes del fix, la tarjeta Matar/Capturar/Clemente solo nacía de
// `entry.convalecienteOffers` (ligado al `characterLog` efímero de React) y nunca sobrevivía a una
// recarga real, aunque el bloqueo del composer (`combatHasPendingConvalecientes`) sí persistía —
// atasco total sin ninguna vía de UI. El fix (LogPanel.tsx) calcula la tarjeta directamente de
// `combatNpcsDisplay`, que a su vez sale de `combateIniciado` (viene de `GET /saves/:id`). Test
// nuevo, faltante desde el cierre original del bug (mencionado como pendiente en el checklist):
// monta el hook YA con `combateIniciado` poblado (nunca abierto por un `openCombat()` en esta
// sesión de React) — simula exactamente una recarga real con el navegador recién cargado.
describe('Recarga con un CONVALECIENTE pendiente (bug real 2026-08-28, cerrado 2026-08-29)', () => {
  it('combatNpcsDisplay/combatHasPendingConvalecientes reflejan al CONVALECIENTE ya al montar, sin pasar por openCombat', () => {
    const { result } = renderHook(() =>
      useHarness({ npcs: [npc({ slug: 'kirelon-arenoso', name: 'Kirelon Arenoso', condicionFisica: 'CONVALECIENTE' })] }),
    )
    // `combatOpen` sigue false — el panel nunca se "abrió" en esta sesión de React, pero el dato ya
    // está disponible para que LogPanel.tsx pueda ofrecer la tarjeta persistente igualmente.
    expect(result.current.combat.combatOpen).toBe(false)
    expect(result.current.combat.combatNpcsDisplay).toEqual([
      expect.objectContaining({ slug: 'kirelon-arenoso', name: 'Kirelon Arenoso', condicion: 'CONVALECIENTE' }),
    ])
    expect(result.current.combat.combatHasPendingConvalecientes).toBe(true)
  })

  it('un NPC MUERTO o ya dismissed al montar NO bloquea el composer', () => {
    const { result } = renderHook(() =>
      useHarness({ npcs: [npc({ slug: 'kirelon-arenoso', name: 'Kirelon Arenoso', condicionFisica: 'MUERTO' })] }),
    )
    expect(result.current.combat.combatHasPendingConvalecientes).toBe(false)
  })
})

// Bug real jugando en vivo (2026-09-03, verificación con Playwright de "Dejar vivir/Capturar en
// grupo de 2+ del mismo tipo"): el describe de arriba ya cubría que la tarjeta persistente APARECE
// correctamente sin `openCombat()` — pero nadie ejercitaba pulsar Clemente/Capturar EN ESE MISMO
// estado (`combatNpcStates` sigue en `[]`, `openCombat()` nunca se llamó en esta sesión de React).
// `handleCapturarSeleccion`/`handleDejarVivirSeleccion` usaban `prev.map(...)` para marcar
// `dismissed: true` — un `.map()` no CREA nada nuevo si el `participantId` no existe todavía en el
// array, así que la actualización se perdía en silencio: el backend marcaba `dismissedGrupo`
// correctamente (confirmado en Postgres real), pero la tarjeta seguía apareciendo en pantalla
// porque el estado local nunca reflejaba la resolución. Confirmado en vivo que reproducir el mismo
// flujo tras pulsar "Combatir" primero (que sí llama a `openCombat()`) no mostraba el bug — el
// hueco era específico de resolver directo desde la tarjeta del log, sin abrir el panel antes.
describe('Clemente/Capturar SIN openCombat previo — mismo escenario de "recarga real" (bug real 2026-09-03)', () => {
  it('Clemente sobre un CONVALECIENTE, con combatNpcStates vacío al empezar, sí marca dismissed y desbloquea combatHasPendingConvalecientes', async () => {
    const { result } = renderHook(() =>
      useHarness({ npcs: [npc({ slug: 'zense-ceniza', name: 'Zense Ceniza', condicionFisica: 'CONVALECIENTE', participantId: 'p1' })] }),
    )
    expect(result.current.combat.combatOpen).toBe(false) // openCombat() nunca se llamó
    expect(result.current.combat.combatHasPendingConvalecientes).toBe(true)
    mockDejarVivir.mockResolvedValueOnce({ npcSlug: 'zense-ceniza', logEntry: { id: 'log-1', text: 'x', timeLabel: 'x', createdAt: 'x' } })

    await act(() => result.current.combat.handleDejarVivirSeleccion(result.current.combat.combatNpcsDisplay[0]))

    expect(result.current.combat.combatNpcsDisplay[0].dismissed).toBe(true)
    expect(result.current.combat.combatHasPendingConvalecientes).toBe(false)
  })

  it('Capturar sobre un CONVALECIENTE, con combatNpcStates vacío al empezar, sí marca dismissed y desbloquea combatHasPendingConvalecientes', async () => {
    const { result } = renderHook(() =>
      useHarness({ npcs: [npc({ slug: 'zense-ceniza', name: 'Zense Ceniza', condicionFisica: 'CONVALECIENTE', participantId: 'p1' })] }),
    )
    expect(result.current.combat.combatOpen).toBe(false)
    mockPostCapturar.mockResolvedValueOnce({ npcSlug: 'zense-ceniza', tipo: 'FAUNA', inventoryItemId: 'item-1', capturaExpiraAtMinutes: null })

    await act(() => result.current.combat.handleCapturarSeleccion(result.current.combat.combatNpcsDisplay[0]))

    expect(result.current.combat.combatNpcsDisplay[0].dismissed).toBe(true)
    expect(result.current.combat.combatHasPendingConvalecientes).toBe(false)
  })

  it('con 2 individuos del mismo tipo y solo uno sembrado en combatNpcStates, Clemente sobre el NO sembrado también lo crea y marca dismissed solo a él', async () => {
    const { result } = renderHook(() =>
      useHarness({
        npcs: [
          npc({ slug: 'zense-ceniza', name: 'Zense Ceniza', condicionFisica: 'CONVALECIENTE', participantId: 'p1' }),
          npc({ slug: 'zense-ceniza', name: 'Zense Ceniza', condicionFisica: 'ILESO', participantId: 'p2' }),
        ],
      }),
    )
    mockDejarVivir.mockResolvedValueOnce({ npcSlug: 'zense-ceniza', logEntry: { id: 'log-1', text: 'x', timeLabel: 'x', createdAt: 'x' } })

    const objetivo = result.current.combat.combatNpcsDisplay.find((n) => n.participantId === 'p1')!
    await act(() => result.current.combat.handleDejarVivirSeleccion(objetivo))

    const [p1, p2] = result.current.combat.combatNpcsDisplay
    expect(p1.dismissed).toBe(true)
    expect(p2.dismissed).not.toBe(true) // el otro individuo del grupo NO se ve afectado
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

  it('bug real jugando en vivo (2026-08-27, "he perdido un combate...me sale victoria"): justDied marca combatPlayerJustDied, única señal real de derrota tras respawn', async () => {
    mockClassify.mockResolvedValue({ classification: { atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'instantanea' }, roll: undefined } as never)
    mockNarrate.mockResolvedValue(baseNarrateResponse({ condicionFisica: 'ILESO', justDied: true }) as never)
    const { result } = renderHook(() => useHarness())
    act(() => result.current.setCombateIniciado({ npcs: [npc({ slug: 'orco', name: 'Orco' })] }))
    act(() => result.current.combat.openCombat())
    expect(result.current.combat.combatPlayerJustDied).toBe(false)
    await act(() => result.current.combat.submitCombatAction('Ataco a mi enemigo', {}))
    await waitFor(() => expect(result.current.combat.combatPlayerJustDied).toBe(true))
  })

  it('un combate ganado limpio (sin justDied) nunca marca combatPlayerJustDied', async () => {
    mockClassify.mockResolvedValue({ classification: { atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'instantanea' }, roll: undefined } as never)
    mockNarrate.mockResolvedValue(baseNarrateResponse({ condicionFisica: 'ILESO', justDied: false }) as never)
    const { result } = renderHook(() => useHarness())
    act(() => result.current.setCombateIniciado({ npcs: [npc({ slug: 'orco', name: 'Orco' })] }))
    act(() => result.current.combat.openCombat())
    await act(() => result.current.combat.submitCombatAction('Ataco a mi enemigo', {}))
    expect(result.current.combat.combatPlayerJustDied).toBe(false)
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

  // Fase 2 de efectos de clase (2026-08-27) — a diferencia de `lootedItemNames` (solo crece), un
  // `activeEffects` puede EXPIRAR de un turno a otro sin que ninguna otra condición de la fusión
  // (condicion/yaSaqueado/analizado/lootedItemNames) cambie — el backend debe mandar siempre,
  // sin comparar longitudes.
  it('sincroniza siempre activeEffects con el backend, aunque nada más de la fusión haya cambiado (puede expirar, no solo crecer)', async () => {
    mockClassify.mockResolvedValue({ classification: { atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'instantanea' }, roll: undefined } as never)
    mockNarrate.mockResolvedValue(
      baseNarrateResponse({
        combateIniciado: {
          npcs: [npc({ slug: 'orco', name: 'Orco', condicionFisica: 'ILESO', activeEffects: [] })],
        },
      }) as never,
    )
    const { result } = renderHook(() => useHarness())
    act(() =>
      result.current.setCombateIniciado({
        npcs: [npc({ slug: 'orco', name: 'Orco', condicionFisica: 'ILESO', activeEffects: [{ attribute: 'destreza', magnitude: -4, turnsRemaining: 1, sourceAbility: 'Golpe Envenenado' }] })],
      }),
    )
    act(() => result.current.combat.openCombat())
    expect(result.current.combat.combatNpcsDisplay[0]?.activeEffects).toHaveLength(1)

    await act(() => result.current.combat.submitCombatAction('Ataco a mi enemigo', {}))
    await waitFor(() => {
      // El efecto expiró (turnsRemaining llegó a 0 en el backend) — condicion/yaSaqueado/analizado
      // no cambiaron este turno, pero activeEffects sí debe reflejar la lista vacía real.
      expect(result.current.combat.combatNpcsDisplay.find((n) => n.slug === 'orco')?.activeEffects).toEqual([])
    })
  })

  // Bug real jugando en vivo (2026-09-04, combate múltiple real contra 4 Zense Ceniza): el botón
  // "Matar" de la tarjeta efímera del log (LogPanel.tsx § entry.convalecienteOffers) no hacía NADA
  // en el backend con 2+ individuos del mismo slug — `convalecienteOffers` solo guardaba `npcSlug`
  // (compartido por TODOS los individuos de la especie en el mismo CombatEncounter), y
  // `handleMatarConvaleciente` (GameView.tsx) busca por `combatKeyFor(n) === npcKey`, que para un
  // combate múltiple real siempre es el `participantId` — un slug puro nunca coincide, así que el
  // `.find()` fallaba en silencio y el clic no llamaba a ningún endpoint. Confirmado en Postgres
  // real: 3 clics reales en "Matar" sin ningún LogEntry ni dismissedGrupo nuevos. Fix: la oferta
  // efímera ahora también lleva `combatKey` (participantId cuando existe), igual que ya hacía la
  // tarjeta PERSISTENTE (combatNpcsDisplay, LogPanel.tsx:559) desde el cierre del bug hermano del
  // 2026-08-29/2026-09-03.
  it('con 2+ individuos del mismo slug, el nuevo convaleciente ofrece su combatKey real (participantId), no el slug compartido', async () => {
    mockClassify.mockResolvedValue({ classification: { atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'instantanea' }, roll: undefined } as never)
    mockNarrate.mockResolvedValue(
      baseNarrateResponse({
        combateIniciado: {
          npcs: [
            npc({ slug: 'zense-ceniza', name: 'Zense Ceniza', condicionFisica: 'ILESO', participantId: 'p1' }),
            npc({ slug: 'zense-ceniza', name: 'Zense Ceniza', condicionFisica: 'CONVALECIENTE', participantId: 'p2' }),
          ],
        },
      }) as never,
    )
    const { result } = renderHook(() => useHarness())
    act(() =>
      result.current.setCombateIniciado({
        npcs: [
          npc({ slug: 'zense-ceniza', name: 'Zense Ceniza', condicionFisica: 'ILESO', participantId: 'p1' }),
          npc({ slug: 'zense-ceniza', name: 'Zense Ceniza', condicionFisica: 'ILESO', participantId: 'p2' }),
        ],
      }),
    )
    act(() => result.current.combat.openCombat())

    await act(() => result.current.combat.submitCombatAction('Ataco a mi enemigo', {}))

    await waitFor(() => {
      expect(result.current.characterLog[0]?.convalecienteOffers).toEqual([
        expect.objectContaining({ npcSlug: 'zense-ceniza', combatKey: 'p2' }),
      ])
    })
  })
})

// REDISEÑADO 2026-08-30 (petición explícita, dos rondas: "matar tiene que abrir el combate de
// nuevo, no resolverse...lo de resolverse es antiguo y ya no encaja" — y tras reportar en vivo que
// el primer intento seguía ejecutando un Ataque Básico automático al pulsar, sin dejar elegir nada:
// "deberia dejarme continuar el combate...elegir una habilidad...pero ahora mismo se ejecuta como
// una accion"). "Matar" ya NO dispara ningún turno — solo marca `targetedForKill` para desbloquear
// el panel de combate normal (`combatHasPendingConvalecientes`) y ocultar la tarjeta persistente
// del log; el ataque real lo dispara el jugador después, por el camino normal de combate.
describe('handleDecapitarSeleccion', () => {
  it('marca targetedForKill sin disparar ningún turno ni cambiar la condición', () => {
    const { result } = renderHook(() => useHarness())
    act(() => result.current.setCombateIniciado({ npcs: [npc({ slug: 'orco', name: 'Orco', condicionFisica: 'CONVALECIENTE' })] }))
    act(() => result.current.combat.openCombat())

    const target = result.current.combat.combatNpcsDisplay[0]!
    expect(target.targetedForKill).toBeFalsy()

    act(() => result.current.combat.handleDecapitarSeleccion([target]))

    expect(mockClassify).not.toHaveBeenCalled()
    expect(mockNarrate).not.toHaveBeenCalled()
    const updated = result.current.combat.combatNpcsDisplay[0]!
    expect(updated.condicion).toBe('CONVALECIENTE')
    expect(updated.targetedForKill).toBe(true)
  })

  it('desbloquea combatHasPendingConvalecientes y oculta la tarjeta persistente para ese NPC', () => {
    const { result } = renderHook(() => useHarness())
    act(() => result.current.setCombateIniciado({ npcs: [npc({ slug: 'orco', name: 'Orco', condicionFisica: 'CONVALECIENTE' })] }))
    act(() => result.current.combat.openCombat())

    expect(result.current.combat.combatHasPendingConvalecientes).toBe(true)

    const target = result.current.combat.combatNpcsDisplay[0]!
    act(() => result.current.combat.handleDecapitarSeleccion([target]))

    expect(result.current.combat.combatHasPendingConvalecientes).toBe(false)
  })

  it('con varios NPC seleccionados, marca targetedForKill en todos ellos', () => {
    const { result } = renderHook(() =>
      useHarness({
        npcs: [
          npc({ slug: 'orco', name: 'Orco', condicionFisica: 'CONVALECIENTE' }),
          npc({ slug: 'quio', name: 'Quio', condicionFisica: 'CONVALECIENTE' }),
        ],
      }),
    )
    act(() => result.current.combat.openCombat())

    act(() => result.current.combat.handleDecapitarSeleccion(result.current.combat.combatNpcsDisplay))

    expect(mockClassify).not.toHaveBeenCalled()
    expect(result.current.combat.combatNpcsDisplay.every((n) => n.targetedForKill)).toBe(true)
  })
})

describe('handleSaquearSeleccion', () => {
  it('marca yaSaqueado de forma optimista y lo mantiene si el turno se resuelve bien', async () => {
    mockClassify.mockResolvedValue({ classification: { atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'instantanea' }, roll: undefined } as never)
    mockNarrate.mockResolvedValue(baseNarrateResponse() as never)
    const { result } = renderHook(() => useHarness())
    act(() => result.current.setCombateIniciado({ npcs: [npc({ slug: 'orco', name: 'Orco', condicionFisica: 'MUERTO' })] }))
    act(() => result.current.combat.openCombat())

    await act(() => result.current.combat.handleSaquearSeleccion(['Maza orca'], ['orco'], { orco: ['Maza orca'] }))
    await waitFor(() => {
      const orco = result.current.combat.combatNpcsDisplay.find((n) => n.slug === 'orco')
      expect(orco?.yaSaqueado).toBe(true)
      expect(orco?.lootedItemNames).toEqual(['Maza orca'])
    })
  })

  it('bug real (2026-08-28): revierte yaSaqueado/lootedItemNames si el turno falla — no deja la UI mintiendo "saqueado" sin persistir nada', async () => {
    mockClassify.mockResolvedValue({ classification: { atributo: 'fuerza', dificultad: 15, razon: 'x', banda: 'instantanea' }, roll: undefined } as never)
    mockNarrate.mockRejectedValue(new Error('fallo de red'))
    const { result } = renderHook(() => useHarness())
    act(() => result.current.setCombateIniciado({ npcs: [npc({ slug: 'orco', name: 'Orco', condicionFisica: 'MUERTO' })] }))
    act(() => result.current.combat.openCombat())

    await act(() => result.current.combat.handleSaquearSeleccion(['Maza orca'], ['orco'], { orco: ['Maza orca'] }))
    await waitFor(() => {
      const orco = result.current.combat.combatNpcsDisplay.find((n) => n.slug === 'orco')
      expect(orco?.yaSaqueado).toBe(false)
      expect(orco?.lootedItemNames).toEqual([])
    })
  })
})

describe('handleFleeAttempt', () => {
  it('huida con éxito: limpia combateIniciado sin abrir el popup', async () => {
    mockFlee.mockResolvedValue({ escaped: true, text: 'Logras escapar.', roll: { attribute: 'destreza', value: 10, roll: 15, difficulty: 12, result: 20, success: true } })
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
    mockFlee.mockResolvedValue({ escaped: false, text: 'No consigues escapar.', roll: { attribute: 'destreza', value: 10, roll: 3, difficulty: 12, result: 8, success: false } })
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

  // Ronda de correcciones 2026-08-28 (P3.2): "Huir DENTRO de combate debe tener riesgo real" — antes
  // handleCombatHuir mandaba el intento como texto libre por submitCombatAction (motor de
  // intercambio normal, fire-and-forget). Ahora usa el endpoint dedicado combat/huir-en-curso, con
  // la misma tirada determinista que handleFleeAttempt, y un fallo aplica un golpe directo real.
  it('handleCombatHuir con éxito: cierra el popup, limpia combateIniciado, no toca condicionFisica', async () => {
    mockHuirEnCurso.mockResolvedValue({ escaped: true, text: 'Escapas del combate.', condicionFisica: 'ILESO', roll: { attribute: 'destreza', value: 10, roll: 15, difficulty: 12, result: 20, success: true } })
    const { result } = renderHook(() => useHarness())
    act(() => result.current.setCombateIniciado({ npcs: [npc({ slug: 'orco', name: 'Orco' })] }))
    act(() => result.current.combat.openCombat())
    await act(() => result.current.combat.handleCombatHuir())
    await waitFor(() => {
      expect(result.current.combat.combatOpen).toBe(false)
      expect(result.current.combateIniciado).toBeNull()
      expect(result.current.condicionFisica).toBe('ILESO')
      expect(result.current.characterLog).toHaveLength(1)
    })
  })

  it('handleCombatHuir con fallo: el popup se queda abierto, condicionFisica refleja el golpe directo', async () => {
    mockHuirEnCurso.mockResolvedValue({ escaped: false, text: 'No consigues huir y recibes un golpe.', condicionFisica: 'HERIDO', roll: { attribute: 'destreza', value: 10, roll: 3, difficulty: 12, result: 8, success: false } })
    const { result } = renderHook(() => useHarness())
    act(() => result.current.setCombateIniciado({ npcs: [npc({ slug: 'orco', name: 'Orco' })] }))
    act(() => result.current.combat.openCombat())
    await act(() => result.current.combat.handleCombatHuir())
    await waitFor(() => {
      expect(result.current.combat.combatOpen).toBe(true)
      expect(result.current.combateIniciado).not.toBeNull()
      expect(result.current.condicionFisica).toBe('HERIDO')
    })
  })

  // Bug real jugando en vivo (2026-08-28): pulsar Huir estando CONVALECIENTE devuelve 409 del
  // guard del backend ("resuelve tu propia condición primero") — el catch original lo tragaba en
  // silencio, el botón parecía no hacer nada. Ahora debe avisar en el log de personaje.
  it('handleCombatHuir cuando la llamada falla (409 u otro error): avisa en el log en vez de no hacer nada', async () => {
    mockHuirEnCurso.mockRejectedValue(new Error('No puedes intentar huir estando convaleciente — resuelve tu propia condición primero.'))
    const { result } = renderHook(() => useHarness())
    act(() => result.current.setCombateIniciado({ npcs: [npc({ slug: 'orco', name: 'Orco' })] }))
    act(() => result.current.combat.openCombat())
    await act(() => result.current.combat.handleCombatHuir())
    await waitFor(() => {
      expect(result.current.combat.combatOpen).toBe(true)
      expect(result.current.characterLog).toHaveLength(1)
      expect(result.current.characterLog[0].text).toContain('convaleciente')
    })
  })
})
