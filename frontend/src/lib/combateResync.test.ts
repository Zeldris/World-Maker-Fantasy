import { describe, expect, it } from 'vitest'
import { combateTrasResync } from './combateResync'

const orco = { npcs: [{ slug: 'orco' }] }

describe('combateTrasResync (P288)', () => {
  it('toma el combate de la partida si lo trae', () => {
    expect(combateTrasResync(orco, null, false)).toBe(orco)
  })
  it('limpia el combate local cuando la partida ya no tiene combate y el panel está cerrado', () => {
    expect(combateTrasResync(null, orco, false)).toBeNull()
    expect(combateTrasResync({ npcs: [] }, orco, false)).toBeNull()
  })
  it('con el panel abierto conserva el local (pantalla de resumen)', () => {
    expect(combateTrasResync(null, orco, true)).toBe(orco)
  })
})
