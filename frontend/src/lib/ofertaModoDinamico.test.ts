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

  // P190 (QA-27): lo de un bando lo dice el aviso, con lo que cuesta que te vean.
  it('avisa de que el rebaño o el recinto es de un bando y de lo que cuesta', () => {
    const deBando = { faccion: 'Clan Serhu', deQuien: 'del Clan Serhu', reputacion: -100 }
    const rebano = presentacionOferta('e1', { tipo: 'FAUNA', targetSlug: 'murgol', targetName: 'Múrgol', cantidad: 6, deBando }, {})
    expect(rebano.warning).toEqual({ nivel: 'alto', text: 'Es del Clan Serhu: si te ven cazarlo, perderás reputación con ellos (-100).' })
    const recinto = presentacionOferta('e1', { tipo: 'RECURSO', targetSlug: 'recinto', targetName: 'Recinto', deBando: { ...deBando, reputacion: -50 } }, {})
    expect(recinto.warning?.text).toBe('Es del Clan Serhu: si te ven cogerlo, perderás reputación con ellos (-50).')
    expect(presentacionOferta('e1', { tipo: 'FAUNA', targetSlug: 'guchapo', targetName: 'Guchapo' }, {}).warning).toBeUndefined()
  })
})
