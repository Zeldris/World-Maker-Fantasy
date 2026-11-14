import { describe, expect, it } from 'vitest'
import { abrirCombateAlCargar, combateTrasResync, hayCombateEnCurso, mapaDeZonaDebeCerrarse } from './combateResync'

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

describe('P426 — hayCombateEnCurso', () => {
  const combate = { npcs: [{ slug: 'orco' }] }
  it('con el combate abierto y sin terminar, está en curso', () => {
    expect(hayCombateEnCurso(combate, true, false)).toBe(true)
    expect(hayCombateEnCurso(combate, false, false)).toBe(true)
  })
  it('con todos los rivales resueltos (resumen de victoria visible), el HUD ya no dice «En combate»', () => {
    expect(hayCombateEnCurso(combate, true, true)).toBe(false)
  })
  it('sin combate, no está en curso', () => {
    expect(hayCombateEnCurso(null, false, false)).toBe(false)
  })
})

describe('P362 — mapaDeZonaDebeCerrarse', () => {
  it('con combate empezado pero el panel aún cerrado (Huir fallido), el mapa debe cerrarse', () => {
    expect(mapaDeZonaDebeCerrarse({ npcs: [{ slug: 'orco' }] }, false)).toBe(true)
  })
  it('con el panel abierto también', () => {
    expect(mapaDeZonaDebeCerrarse(null, true)).toBe(true)
  })
  it('sin combate, el mapa sigue', () => {
    expect(mapaDeZonaDebeCerrarse(null, false)).toBe(false)
    expect(mapaDeZonaDebeCerrarse({ npcs: [] }, false)).toBe(false)
  })
})
