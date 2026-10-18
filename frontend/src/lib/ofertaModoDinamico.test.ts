import { describe, expect, it } from 'vitest'
import { presentacionOferta } from './ofertaModoDinamico'

// P196/P199 (QA-27): el aviso de un encuentro lleva el artículo que manda el backend (`quien`).
describe('presentacionOferta', () => {
  it('titula con `quien` («Un Guchapo busca tu atención»); sin él, con el nombre', () => {
    const conQuien = presentacionOferta('e1', { tipo: 'FAUNA', targetSlug: 'guchapo', targetName: 'Guchapo', quien: 'Un Guchapo' }, {})
    expect(conQuien.title).toBe('Un Guchapo busca tu atención')
    const npc = presentacionOferta('e1', { tipo: 'NPC', targetSlug: 'cazadora-serhu', targetName: 'Cazadora Serhu', quien: 'La Cazadora Serhu' }, {})
    expect(npc.title).toBe('La Cazadora Serhu busca tu atención')
    const antigua = presentacionOferta('e1', { tipo: 'FAUNA', targetSlug: 'guchapo', targetName: 'Guchapo' }, {})
    expect(antigua.title).toBe('Guchapo busca tu atención')
  })
})
