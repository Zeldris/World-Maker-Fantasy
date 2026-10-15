import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { LogPanel } from './LogPanel'
import { ExtendedRollBadge } from './ExtendedRollBadge'
import { isExtendedLogRoll } from '../types'
import type { GatheringRollInfo, LogEntry, ExtendedLogRoll } from '../types'

afterEach(() => {
  cleanup()
})

// Fase 10 (2026-09-29, "todas las tiradas visibles") — las tiradas que antes se descartaban en el
// backend llegan como `LogEntry.roll` con `kind`; el badge estático (recarga/Diario) las pinta.

const gathering = (over: Partial<GatheringRollInfo> = {}): GatheringRollInfo => ({
  attribute: 'inteligencia',
  value: 20,
  bonusOficio: 2,
  rolls: [14],
  usedRoll: 14,
  result: 26,
  advantage: false,
  ...over,
})

describe('isExtendedLogRoll', () => {
  it('distingue las tiradas con `kind` de un RollInfo de combate/turno', () => {
    expect(isExtendedLogRoll({ kind: 'caza-sigilo', chance: 50, roll: 10, exito: true, npcName: 'x' })).toBe(true)
    expect(isExtendedLogRoll({ attribute: 'fuerza', value: 10, roll: 5, difficulty: 12, result: 10, success: false })).toBe(false)
    expect(isExtendedLogRoll(undefined)).toBe(false)
  })
})

describe('ExtendedRollBadge (modo estático)', () => {
  it('recolección: tirada de Explorar + segunda tirada por objeto, con dado, bono, dificultad y grado', () => {
    const roll: ExtendedLogRoll = {
      kind: 'recoleccion',
      tirada: gathering(),
      segundas: [{ sourceSlug: 'toluh', itemSlug: 'carne-toluh', itemName: 'Carne de Toluh', roll: gathering({ rolls: [3], usedRoll: 3, result: 15 }), dificultad: 17, grado: 'fallo', paso: false }],
    }
    render(<ExtendedRollBadge roll={roll} />)
    expect(screen.getByTestId('recoleccion-tirada').textContent).toContain('🎲14 + 12 = 26')
    const segundas = screen.getByTestId('segundas-tiradas')
    expect(segundas.textContent).toContain('Carne de Toluh')
    expect(segundas.textContent).toContain('🎲3 + 12 = 15')
    expect(segundas.textContent).toContain('vs 17')
    expect(segundas.textContent).toContain('Fallo')
  })

  // P158 (QA-27): «12 +5 = 17 · Recolección · Destreza» sin decir contra qué tiraba ni qué sacó.
  it('recolección desde el mapa: la tirada dice contra qué tiró y el grado', () => {
    render(<ExtendedRollBadge roll={{ kind: 'recoleccion', tirada: gathering({ dificultad: 15, grado: 'con_coste' }) }} />)
    const tirada = screen.getByTestId('recoleccion-tirada').textContent
    expect(tirada).toContain('vs 15')
    expect(tirada).toContain('Éxito parcial')
  })

  it('recolección con ventaja por Suerte: muestra los dos dados', () => {
    render(<ExtendedRollBadge roll={{ kind: 'recoleccion', tirada: gathering({ rolls: [4, 17], usedRoll: 17, advantage: true, result: 29 }) }} />)
    expect(screen.getByTestId('recoleccion-tirada').textContent).toContain('🎲4/17')
  })

  it('iniciativa de encuentro: tirada opuesta Destreza vs Destreza y quién ve primero', () => {
    render(
      <ExtendedRollBadge
        characterName="Gorhorn"
        roll={{
          kind: 'iniciativa-encuentro',
          quienInicia: 'npc',
          npcName: 'Corretolva',
          jugador: { attribute: 'destreza', value: 10, roll: 4, bono: 5, result: 9 },
          npc: { attribute: 'destreza', value: 16, roll: 12, bono: 8, result: 20 },
        }}
      />,
    )
    const badge = screen.getByTestId('iniciativa-encuentro')
    expect(badge.textContent).toContain('Gorhorn')
    expect(badge.textContent).toContain('🎲4 + 5 = 9')
    expect(badge.textContent).toContain('Corretolva')
    expect(badge.textContent).toContain('🎲12 + 8 = 20')
    expect(badge.textContent).toContain('Te ve primero')
  })

  it('caza sigilosa: d100 contra la probabilidad real', () => {
    render(<ExtendedRollBadge roll={{ kind: 'caza-sigilo', chance: 60, roll: 85, exito: false, npcName: 'Corretolva' }} />)
    const badge = screen.getByTestId('caza-sigilo')
    expect(badge.textContent).toContain('🎲85 (d100) > 60%')
    expect(badge.textContent).toContain('Te detecta')
  })

  it('combate en grupo: cuántos entran (d6) y la iniciativa en orden de actuación', () => {
    render(
      <ExtendedRollBadge
        roll={{
          kind: 'combate-grupo',
          engagement: [{ slug: 'zense', name: 'Zense Ceniza', roll: 6, delta: 1, cantidadElegida: 3, avistados: 5, cantidadTirada: 4, cantidadReal: 4 }],
          iniciativa: [
            { participantId: 'a', nombre: 'Gorhorn', bando: 'JUGADOR', attribute: 'destreza', value: 10, roll: 15, result: 20, rolls: [15] },
            { participantId: 'b', nombre: 'Zense Ceniza 1', bando: 'ENEMIGO', attribute: 'destreza', value: 8, roll: 2, result: 6, rolls: [2] },
          ],
        }}
      />,
    )
    const badge = screen.getByTestId('combate-grupo')
    expect(badge.textContent).toContain('Zense Ceniza')
    expect(badge.textContent).toContain('🎲6 (d6)')
    expect(badge.textContent).toContain('uno más')
    expect(badge.textContent).toContain('4 de 5 entran')
    expect(badge.textContent).toContain('Gorhorn: 🎲15 + 5 = 20')
    expect(badge.textContent).toContain('Zense Ceniza 1: 🎲2 + 4 = 6')
  })
})

describe('LogPanel con LogEntry.roll extendido', () => {
  it('pinta la tirada de una entrada de encuentro tras una recarga (sin modo en vivo) y no rompe RollBadge', () => {
    Element.prototype.scrollTo = vi.fn()
    const entry: LogEntry = {
      id: 'e1',
      channel: 'character',
      text: 'Gorhorn se topa con una Corretolva.',
      timeLabel: 'Día 1',
      createdAt: new Date().toISOString(),
      roll: { kind: 'caza-sigilo', chance: 40, roll: 12, exito: true, npcName: 'Corretolva' },
    }
    render(<LogPanel title="Tu personaje" subtitle="x" accent="accent" emptyHint="vacío" entries={[entry]} />)
    expect(screen.getByTestId('caza-sigilo').textContent).toContain('🎲12 (d100) ≤ 40%')
  })
})
