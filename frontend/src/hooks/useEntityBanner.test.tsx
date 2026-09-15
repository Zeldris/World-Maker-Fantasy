import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEntityBanner } from './useEntityBanner'
import { buildEnciclopediaIndex, EMPTY_ENCICLOPEDIA_INDEX, type EnciclopediaIndex } from '../lib/enciclopediaIndex'
import { resolveImageUrl } from '../lib/api'
import type { EnciclopediaNpcInfo, EnciclopediaLocationInfo, EnciclopediaResponse } from '../lib/api'
import type { AttributeBlock } from '../types'
import type { LogEntry } from '../types'

/// Cobertura nueva (2026-09-03) — último de los 6 hooks de "hooks/ entera sin cobertura" (auditoría
/// de deuda técnica 2026-08-25). Usa `buildEnciclopediaIndex` REAL (mismo fixture mínimo que
/// enciclopediaIndex.test.ts, `makeNpc`/`emptyResponse`) en vez de mockear `pickMentionedEntityBanner`
/// — así se ejercita el flujo completo texto→match→banner, no solo la superficie del hook.
/// `resolveImageUrl` es pura (concatena API_URL), tampoco se mockea. Solo `setLogEntryBanner`
/// (persistencia fire-and-forget) es I/O real y se mockea.
vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return { ...actual, setLogEntryBanner: vi.fn() }
})

import { setLogEntryBanner } from '../lib/api'

const mockSetLogEntryBanner = vi.mocked(setLogEntryBanner)

const DUMMY_ATTRIBUTES: AttributeBlock = { fuerza: 1, destreza: 1, constitucion: 1, inteligencia: 1, voluntad: 1, carisma: 1, magia: 1 }

function makeNpc(overrides: Partial<EnciclopediaNpcInfo> & Pick<EnciclopediaNpcInfo, 'slug' | 'name'>): EnciclopediaNpcInfo {
  return {
    kind: 'PRINCIPAL',
    role: 'Rol de prueba',
    faction: null,
    level: 1,
    bio: 'Bio de prueba.',
    aliases: [],
    imagePrompts: { thumbnail: null, banner: null },
    imageUrls: { thumbnail: null, banner: '/uploads/images/npc/gistera-koh-banner.png' },
    discovered: true,
    fase: 'DESCUBIERTO',
    attributes: DUMMY_ATTRIBUTES,
    ataqueBase: { icon: '⚔️', name: 'Golpe', description: 'Golpe de prueba.', preferredAttribute: 'fuerza' },
    items: [],
    ...overrides,
  }
}

function emptyResponse(overrides: Partial<EnciclopediaResponse> = {}): EnciclopediaResponse {
  return {
    npcs: [],
    items: [],
    faunaFlora: [],
    locations: [],
    razas: [],
    personajes: [],
    classes: [],
    constructionRecipes: [],
    craftingRecipes: [],
    factions: [],
    historia: [],
    combate: [],
    reputacion: [],
    ...overrides,
  }
}

const GISTERA_SLUG = 'gistera-koh'
function indexConGistera(): EnciclopediaIndex {
  const npc = makeNpc({ slug: GISTERA_SLUG, name: 'Gistera Koh', aliases: ['Gistera'] })
  return buildEnciclopediaIndex(emptyResponse({ npcs: [npc] }))
}

// Hallazgo 38 (revisar-partida-hallazgos.md 2026-09-07) — Location descubierta.
const HONDONADA_SLUG = 'hondonada-del-eco'
function makeLocation(overrides: Partial<EnciclopediaLocationInfo> & Pick<EnciclopediaLocationInfo, 'slug' | 'name'>): EnciclopediaLocationInfo {
  return {
    aliases: [],
    region: 'Las Llanuras del Viento Rojo',
    kind: 'refugio',
    description: 'Descripción de prueba.',
    imagePrompts: { thumbnail: null, banner: null },
    imageUrls: { thumbnail: null, banner: '/uploads/images/location/hondonada-del-eco-banner.png' },
    discovered: true,
    ...overrides,
  }
}
function indexConGisteraYHondonada(): EnciclopediaIndex {
  const npc = makeNpc({ slug: GISTERA_SLUG, name: 'Gistera Koh', aliases: ['Gistera'] })
  const location = makeLocation({ slug: HONDONADA_SLUG, name: 'La Hondonada del Eco', aliases: ['la hondonada del eco'] })
  return buildEnciclopediaIndex(emptyResponse({ npcs: [npc], locations: [location] }))
}

beforeEach(() => {
  mockSetLogEntryBanner.mockReset().mockResolvedValue(undefined)
})

describe('useEntityBanner', () => {
  it('buildEntityBanner devuelve el banner de la entidad citada en el texto, con la URL ya resuelta', () => {
    const { result } = renderHook(() => useEntityBanner('save-1', indexConGistera(), vi.fn(), vi.fn()))

    const banner = result.current.buildEntityBanner('Gistera Koh te observa con desconfianza.')
    expect(banner).toEqual({
      name: 'Gistera Koh',
      icon: expect.any(String),
      imageUrl: resolveImageUrl('/uploads/images/npc/gistera-koh-banner.png'),
    })
  })

  it('sin ninguna entidad con imagen citada en el texto, devuelve undefined', () => {
    const { result } = renderHook(() => useEntityBanner('save-1', indexConGistera(), vi.fn(), vi.fn()))

    const banner = result.current.buildEntityBanner('Gorhorn camina por la hondonada, sin cruzarse con nadie.')
    expect(banner).toBeUndefined()
  })

  it('con logEntryId, persiste el banner en segundo plano vía setLogEntryBanner (fire-and-forget)', () => {
    const { result } = renderHook(() => useEntityBanner('save-1', indexConGistera(), vi.fn(), vi.fn()))

    result.current.buildEntityBanner('Gistera Koh te observa.', 'log-42')
    expect(mockSetLogEntryBanner).toHaveBeenCalledWith('save-1', 'log-42', 'npc', GISTERA_SLUG)
  })

  it('sin saveId, nunca llama a setLogEntryBanner aunque haya logEntryId (persistencia exige saveId real)', () => {
    const { result } = renderHook(() => useEntityBanner(null, indexConGistera(), vi.fn(), vi.fn()))

    result.current.buildEntityBanner('Gistera Koh te observa.', 'log-42')
    expect(mockSetLogEntryBanner).not.toHaveBeenCalled()
  })

  it('ventana de "no repetir" (RECENTLY_SHOWN_TURN_WINDOW=4): la misma entidad no vuelve a salir en 3 llamadas seguidas, pero sí en la 4ª', () => {
    const { result } = renderHook(() => useEntityBanner('save-1', indexConGistera(), vi.fn(), vi.fn()))
    const texto = 'Gistera Koh sigue ahí.'

    expect(result.current.buildEntityBanner(texto)).toBeDefined() // turno 1: se muestra
    expect(result.current.buildEntityBanner(texto)).toBeUndefined() // turno 2: recién mostrada
    expect(result.current.buildEntityBanner(texto)).toBeUndefined() // turno 3
    expect(result.current.buildEntityBanner(texto)).toBeUndefined() // turno 4
    expect(result.current.buildEntityBanner(texto)).toBeDefined() // turno 5: ventana de 4 ya pasó
  })

  it('reconstruye entityBanner en logs ya persistidos (entityBannerType/entityBannerSlug) en cuanto la Enciclopedia carga, sin duplicar entradas ya resueltas', () => {
    const setCharacterLog = vi.fn()
    const setWorldLog = vi.fn()
    const entradaPendiente: LogEntry = {
      id: 'l1',
      channel: 'character',
      text: 'x',
      timeLabel: 'Día 1',
      createdAt: new Date().toISOString(),
      entityBannerType: 'npc',
      entityBannerSlug: GISTERA_SLUG,
    } as LogEntry
    const entradaYaResuelta: LogEntry = { ...entradaPendiente, id: 'l2', entityBanner: { name: 'ya resuelto', icon: '⚔️', imageUrl: 'x' } } as LogEntry

    renderHook(() => useEntityBanner('save-1', indexConGistera(), setCharacterLog, setWorldLog))

    expect(setCharacterLog).toHaveBeenCalled()
    const updater = setCharacterLog.mock.calls[0][0] as (prev: LogEntry[]) => LogEntry[]
    const resultado = updater([entradaPendiente, entradaYaResuelta])
    expect(resultado[0].entityBanner?.name).toBe('Gistera Koh')
    expect(resultado[1].entityBanner?.name).toBe('ya resuelto') // no se toca, ya tenía banner
  })

  it('con el índice vacío (Enciclopedia todavía sin cargar), NO intenta reconstruir logs persistidos', () => {
    const setCharacterLog = vi.fn()
    renderHook(() => useEntityBanner('save-1', EMPTY_ENCICLOPEDIA_INDEX, setCharacterLog, vi.fn()))

    expect(setCharacterLog).not.toHaveBeenCalled()
  })

  it('buildEntityBanner nunca lanza — un fallo interno devuelve undefined en vez de romper el turno', () => {
    const indiceRoto = { ...indexConGistera(), entries: null } as unknown as EnciclopediaIndex
    const { result } = renderHook(() => useEntityBanner('save-1', indiceRoto, vi.fn(), vi.fn()))

    expect(() => result.current.buildEntityBanner('Gistera Koh te observa.')).not.toThrow()
    expect(result.current.buildEntityBanner('Gistera Koh te observa.')).toBeUndefined()
  })

  it('act() con un enciclopediaIndex actualizado tras el montaje: buildEntityBanner lee el índice FRESCO (clausura vía ref), no el vacío inicial', () => {
    const { result, rerender } = renderHook(
      ({ index }: { index: EnciclopediaIndex }) => useEntityBanner('save-1', index, vi.fn(), vi.fn()),
      { initialProps: { index: EMPTY_ENCICLOPEDIA_INDEX } },
    )
    expect(result.current.buildEntityBanner('Gistera Koh te observa.')).toBeUndefined() // índice aún vacío

    act(() => {
      rerender({ index: indexConGistera() })
    })
    expect(result.current.buildEntityBanner('Gistera Koh te observa.')).toBeDefined()
  })

  // Hallazgo 38 (revisar-partida-hallazgos.md 2026-09-07) — `forcedTarget` fuerza el banner de la
  // Location descubierta con prioridad absoluta, aunque el texto mencione otra entidad (Gistera,
  // que ganaría por `TYPE_PRIORITY` en el camino normal de `pickMentionedEntityBanner`).
  it('con forcedTarget, devuelve el banner de la Location aunque el texto mencione a un NPC con imagen', () => {
    const { result } = renderHook(() => useEntityBanner('save-1', indexConGisteraYHondonada(), vi.fn(), vi.fn()))

    const banner = result.current.buildEntityBanner('Gorhorn llega a un lugar nuevo. Gistera Koh te observa desde lejos.', undefined, {
      entityType: 'location',
      entitySlug: HONDONADA_SLUG,
    })
    expect(banner).toEqual({
      name: 'La Hondonada del Eco',
      icon: expect.any(String),
      imageUrl: resolveImageUrl('/uploads/images/location/hondonada-del-eco-banner.png'),
    })
  })

  it('con forcedTarget, persiste la referencia forzada (no la del texto) vía setLogEntryBanner', () => {
    const { result } = renderHook(() => useEntityBanner('save-1', indexConGisteraYHondonada(), vi.fn(), vi.fn()))

    result.current.buildEntityBanner('Gistera Koh te observa.', 'log-99', { entityType: 'location', entitySlug: HONDONADA_SLUG })
    expect(mockSetLogEntryBanner).toHaveBeenCalledWith('save-1', 'log-99', 'location', HONDONADA_SLUG)
  })

  it('con forcedTarget pero sin imagen real para esa entidad, cae al camino normal (texto)', () => {
    const { result } = renderHook(() => useEntityBanner('save-1', indexConGisteraYHondonada(), vi.fn(), vi.fn()))

    const banner = result.current.buildEntityBanner('Gistera Koh te observa.', undefined, { entityType: 'location', entitySlug: 'slug-inexistente' })
    expect(banner).toEqual({
      name: 'Gistera Koh',
      icon: expect.any(String),
      imageUrl: resolveImageUrl('/uploads/images/npc/gistera-koh-banner.png'),
    })
  })
})
