import { describe, it, expect } from 'vitest'
import { playerActionEntry } from './simulateAI'

/// Cobertura nueva (2026-09-03) — sin test hasta ahora. `nextId` mantiene un contador de módulo
/// entre llamadas (garantiza id único aunque dos entradas se creen en el mismo milisegundo real).
describe('playerActionEntry', () => {
  it('construye un LogEntry de canal character, isPlayerAction:true, con el texto y timeLabel dados', () => {
    const entry = playerActionEntry('Ataco al orco.', 'Día 1, mañana')
    expect(entry.channel).toBe('character')
    expect(entry.isPlayerAction).toBe(true)
    expect(entry.text).toBe('Ataco al orco.')
    expect(entry.timeLabel).toBe('Día 1, mañana')
    expect(entry.id).toMatch(/^p-\d+-\d+$/)
  })

  it('dos llamadas seguidas producen ids distintos, aunque el texto/timeLabel sean iguales', () => {
    const a = playerActionEntry('Ataco.', 'Día 1')
    const b = playerActionEntry('Ataco.', 'Día 1')
    expect(a.id).not.toBe(b.id)
  })

  it('createdAt es un ISO string válido, generado en el momento de la llamada', () => {
    const before = Date.now()
    const entry = playerActionEntry('x', 'x')
    const after = Date.now()
    const createdAtMs = new Date(entry.createdAt).getTime()
    expect(createdAtMs).toBeGreaterThanOrEqual(before)
    expect(createdAtMs).toBeLessThanOrEqual(after)
  })
})
