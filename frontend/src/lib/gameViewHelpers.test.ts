import { describe, it, expect } from 'vitest'
import { formatFictionalDuration, formatCountdown, applyInventoryDelta, formatMinutos, quantityOf, baseNameOf, npcInSceneToCombatDisplay } from './gameViewHelpers'
import type { InventoryItemInfo } from '../types'

// Auditoría de deuda técnica (2026-08-21): estas 4 funciones no tenían ningún test — la única
// cobertura de este archivo eran formatCountdown/formatFictionalDuration. `applyInventoryDelta` en
// particular ya tuvo un bug real documentado en su propio comentario de cabecera (materiales
// fantasma tras craftear/construir); las otras tres son parsing/formato usado en varios sitios del
// panel "Curar" y del mapa/viaje.
function makeItem(overrides: Partial<InventoryItemInfo> & Pick<InventoryItemInfo, 'id' | 'name'>): InventoryItemInfo {
  return { description: '', slot: null, statBonuses: null, ...overrides }
}

describe('applyInventoryDelta', () => {
  it('sin cambios, devuelve el inventario tal cual (mismo contenido)', () => {
    const prev = [makeItem({ id: '1', name: 'Piedra' })]
    expect(applyInventoryDelta(prev, [], [], [])).toEqual(prev)
  })

  it('añade lo nuevo al final', () => {
    const prev = [makeItem({ id: '1', name: 'Piedra' })]
    const added = [makeItem({ id: '2', name: 'Leña' })]
    expect(applyInventoryDelta(prev, added, [], []).map((i) => i.id)).toEqual(['1', '2'])
  })

  it('no duplica lo que ya está (QA-54: una recompensa que también trajo una recarga)', () => {
    const prev = [makeItem({ id: '1', name: 'Mapa de las Llanuras' })]
    expect(applyInventoryDelta(prev, [makeItem({ id: '1', name: 'Mapa de las Llanuras' })], [], []).map((i) => i.id)).toEqual(['1'])
  })

  it('quita lo borrado', () => {
    const prev = [makeItem({ id: '1', name: 'Piedra' }), makeItem({ id: '2', name: 'Leña' })]
    expect(applyInventoryDelta(prev, [], ['1'], []).map((i) => i.id)).toEqual(['2'])
  })

  it('renombra lo reducido (p.ej. una pila que baja de cantidad) sin tocar el resto de campos', () => {
    const prev = [makeItem({ id: '1', name: 'Piedra (9)', description: 'Una piedra cualquiera.' })]
    const result = applyInventoryDelta(prev, [], [], [{ id: '1', name: 'Piedra (8)' }])
    expect(result).toEqual([makeItem({ id: '1', name: 'Piedra (8)', description: 'Una piedra cualquiera.' })])
  })

  it('un mismo turno puede consumir Y crear a la vez (craftear) — quitar/renombrar antes de añadir', () => {
    const prev = [makeItem({ id: '1', name: 'Leña (10)' }), makeItem({ id: '2', name: 'Piedra (5)' })]
    const result = applyInventoryDelta(
      prev,
      [makeItem({ id: '3', name: 'Hacha' })],
      ['2'],
      [{ id: '1', name: 'Leña (4)' }],
    )
    expect(result.map((i) => ({ id: i.id, name: i.name }))).toEqual([
      { id: '1', name: 'Leña (4)' },
      { id: '3', name: 'Hacha' },
    ])
  })
})

describe('formatMinutos', () => {
  it('minutos: por debajo de una hora', () => {
    expect(formatMinutos(30)).toBe('~30 min')
  })

  it('horas: de 1h hasta 23h59, con un decimal', () => {
    expect(formatMinutos(90)).toBe('~1.5h')
  })

  it('días: 24h en adelante', () => {
    expect(formatMinutos(60 * 48)).toBe('~2.0d')
  })
})

describe('quantityOf / baseNameOf (espejo de quantityOf/baseNameOf en ingredients.ts, backend)', () => {
  it('objeto apilado: extrae la cantidad del sufijo "(N)"', () => {
    expect(quantityOf('Piedra (9)')).toBe(9)
    expect(baseNameOf('Piedra (9)')).toBe('Piedra')
  })

  it('objeto suelto sin sufijo: cantidad 1, nombre sin cambios', () => {
    expect(quantityOf('Hacha rota')).toBe(1)
    expect(baseNameOf('Hacha rota')).toBe('Hacha rota')
  })

  it('el sufijo solo cuenta al final del nombre, no en medio', () => {
    expect(quantityOf('Cofre (raro) con Piedra (3)')).toBe(3)
    expect(baseNameOf('Cofre (raro) con Piedra (3)')).toBe('Cofre (raro) con Piedra')
  })
})

describe('formatCountdown (crafteo con espera real, 2026-08-20)', () => {
  const now = Date.parse('2026-08-20T12:00:00.000Z')

  it('resolviendo... cuando ya pasó busyUntil', () => {
    expect(formatCountdown(new Date(now - 1000).toISOString(), now)).toBe('resolviendo...')
  })

  it('segundos: por debajo de un minuto, redondeado hacia arriba', () => {
    expect(formatCountdown(new Date(now + 5_000).toISOString(), now)).toBe('~5s')
    expect(formatCountdown(new Date(now + 4_500).toISOString(), now)).toBe('~5s')
    expect(formatCountdown(new Date(now + 59_000).toISOString(), now)).toBe('~59s')
  })

  it('minutos: 60s en adelante sigue el formato de siempre', () => {
    expect(formatCountdown(new Date(now + 60_000).toISOString(), now)).toBe('~1 min')
    expect(formatCountdown(new Date(now + 5 * 60_000).toISOString(), now)).toBe('~5 min')
  })

  it('horas: sin cambios frente al formato ya existente', () => {
    expect(formatCountdown(new Date(now + 90 * 60_000).toISOString(), now)).toBe('~1h 30min')
  })
})

describe('formatFictionalDuration', () => {
  it('minutos: valores por debajo de una hora', () => {
    expect(formatFictionalDuration(45)).toBe('45 min')
  })

  it('horas: valores de 1h hasta 23h59', () => {
    expect(formatFictionalDuration(120)).toBe('2 h')
    expect(formatFictionalDuration(90)).toBe('1.5 h')
  })

  it('días: 1440+ minutos, como el ejemplo de la usuaria ("2 dias en Helek")', () => {
    expect(formatFictionalDuration(2880)).toBe('2 días')
    expect(formatFictionalDuration(4320)).toBe('3 días')
  })
})

describe('npcInSceneToCombatDisplay (CR-44)', () => {
  it('quien huye queda resuelto y marcado como huido', () => {
    const base = { slug: 'orco', name: 'Orco', condicionFisica: 'GRAVE' as const, saqueado: false, lootedItemNames: [], analizado: false, activeEffects: [], capturable: false, targetedForKill: false }
    expect(npcInSceneToCombatDisplay({ ...base, huido: true })).toMatchObject({ huido: true, dismissed: true, condicion: 'GRAVE' })
    expect(npcInSceneToCombatDisplay(base).dismissed).toBeUndefined()
  })

  it('CR-45: el capitán lleva a quién manda caer encima', () => {
    const base = { slug: 'orco', name: 'Orco', condicionFisica: 'ILESO' as const, saqueado: false, lootedItemNames: [], analizado: false, activeEffects: [], capturable: false, targetedForKill: false }
    expect(npcInSceneToCombatDisplay({ ...base, ordenaCaerSobre: 'ti' }).ordenaCaerSobre).toBe('ti')
    expect(npcInSceneToCombatDisplay(base).ordenaCaerSobre).toBeUndefined()
  })
})
