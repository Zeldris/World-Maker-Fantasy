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
    expect(rebano.warning).toEqual({ nivel: 'aviso', text: 'Es del Clan Serhu: si te ven cazarlo, perderás reputación con ellos (-100).' })
    const recinto = presentacionOferta('e1', { tipo: 'RECURSO', targetSlug: 'recinto', targetName: 'Recinto', deBando: { ...deBando, reputacion: -50 } }, {})
    expect(recinto.warning?.text).toBe('Es del Clan Serhu: si te ven cogerlo, perderás reputación con ellos (-50).')
    expect(presentacionOferta('e1', { tipo: 'FAUNA', targetSlug: 'guchapo', targetName: 'Guchapo' }, {}).warning).toBeUndefined()
  })

  // P307: la fauna de la escena (sin punto en el mapa) también se puede cazar desde su tarjeta.
  it('ofrece Cazar en la fauna sin punto de zona y manda el targetSlug; con punto, su zonePointId', () => {
    const llamadas: unknown[][] = []
    const h = { onCazarEnZona: (...a: unknown[]) => void llamadas.push(a) }
    const escena = presentacionOferta('e1', { tipo: 'FAUNA', targetSlug: 'corredor-de-cauce', targetName: 'Corredor de Cauce' }, h)
    const cazar = escena.actions.find((a) => a.label === 'Cazar')
    expect(cazar).toBeDefined()
    cazar!.onClick()
    expect(llamadas).toEqual([['e1', undefined, 'corredor-de-cauce']])
    const conPunto = presentacionOferta('e2', { tipo: 'FAUNA', targetSlug: 'guchapo', targetName: 'Guchapo', zonePointId: 'zp1' }, h)
    conPunto.actions.find((a) => a.label === 'Cazar')!.onClick()
    expect(llamadas[1]).toEqual(['e2', 'zp1', undefined])
    // Nunca en un NPC ni cuando la fauna te corta el paso.
    expect(presentacionOferta('e3', { tipo: 'NPC', targetSlug: 'x', targetName: 'X' }, h).actions.some((a) => a.label === 'Cazar')).toBe(false)
    expect(presentacionOferta('e4', { tipo: 'FAUNA', targetSlug: 'x', targetName: 'X', combateForzado: true }, h).actions.some((a) => a.label === 'Cazar')).toBe(false)
  })
})
