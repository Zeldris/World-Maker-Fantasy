import { describe, it, expect } from 'vitest'
import { avisoDeLlegadas, pesoDeLlegada } from './llegadas'
import type { LogEntry } from '../types'

const e = (extra: Partial<LogEntry> = {}): LogEntry => ({ id: 'x', channel: 'character', text: 't', timeLabel: 'Día 1', createdAt: '', ...extra }) as LogEntry

/// UX-12 (hito 0.2) — lo que llega con el cajón abierto.
describe('UX-12 — llegadas con el cajón abierto', () => {
  it('peso: tu acción es menor; combate o te cortan el paso, crítico; el resto, importante', () => {
    expect(pesoDeLlegada(e({ isPlayerAction: true }))).toBe('menor')
    expect(pesoDeLlegada(e({ combate: true } as Partial<LogEntry>))).toBe('critico')
    expect(pesoDeLlegada(e({ dynamicModeOffer: { tipo: 'NPC', targetSlug: 'a', targetName: 'A', combateForzado: true } }))).toBe('critico')
    expect(pesoDeLlegada(e())).toBe('importante')
  })

  it('aviso según lo último importante, con cuántos más', () => {
    expect(avisoDeLlegadas([e({ isPlayerAction: true })])).toBeNull()
    expect(avisoDeLlegadas([e()])).toBe('El narrador ha respondido')
    expect(avisoDeLlegadas([e(), e({ questOffer: { title: 'T', description: 'D' } } as Partial<LogEntry>)])).toBe('Te proponen una misión (+1 más)')
    expect(avisoDeLlegadas([e({ dynamicModeOffer: { tipo: 'NPC', targetSlug: 'a', targetName: 'A' } })])).toBe('Algo busca tu atención')
  })
})
