import { describe, expect, it } from 'vitest'
import { abrirCombateAlCargar, combateTrasResync } from './combateResync'

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

describe('abrirCombateAlCargar (P405)', () => {
  it('reabre el panel si la partida carga con un combate en curso', () => {
    expect(abrirCombateAlCargar({ combateIniciado: orco, pendingDeathResolution: false })).toBe(true)
  })
  it('no lo abre sin combate ni con una muerte pendiente de resolver', () => {
    expect(abrirCombateAlCargar({ combateIniciado: null, pendingDeathResolution: false })).toBe(false)
    expect(abrirCombateAlCargar({ combateIniciado: { npcs: [] }, pendingDeathResolution: false })).toBe(false)
    expect(abrirCombateAlCargar({ combateIniciado: orco, pendingDeathResolution: true })).toBe(false)
  })
})
