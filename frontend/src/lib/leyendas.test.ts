import { describe, it, expect } from 'vitest'
import { agruparCronica, colorDeEntrada, lineaTemporal, porEntidad, rumoresConLugar } from './leyendas'
import type { EntradaLeyenda } from './api'

/// CR-20 (hito 0.2) — agrupaciones de las Leyendas.
describe('leyendas', () => {
  const entrada = (over: Partial<EntradaLeyenda>): EntradaLeyenda => ({
    sucesoId: 'x', tipo: 'ALIANZA', familia: 'DIPLOMACIA', nivel: 'NORMAL', texto: 't', rumor: false, via: 'NPC', sabidoEn: 0,
    region: null, cuando: 0, fecha: null, lugar: null, actores: [], causas: [], ...over,
  })
  const dia = (d: number) => (d - 1) * 1440 + 600

  it('crónica por días y por semanas, lo más reciente primero; un rumor va al día en que se supo', () => {
    const a = entrada({ sucesoId: 'a', cuando: dia(2) })
    const b = entrada({ sucesoId: 'b', cuando: dia(9) })
    const r = entrada({ sucesoId: 'r', rumor: true, cuando: null, sabidoEn: dia(3) })
    expect(agruparCronica([a, b, r], 'dia').map((g) => [g.etiqueta, g.entradas.map((e) => e.sucesoId)])).toEqual([
      ['Día 9', ['b']], ['Día 3', ['r']], ['Día 2', ['a']],
    ])
    expect(agruparCronica([a, b, r], 'semana').map((g) => g.etiqueta)).toEqual(['Semana 2 (días 8-14)', 'Semana 1 (días 1-7)'])
  })

  it('por entidad: personajes, facciones y lugares (también dónde pasó), los de más sucesos primero', () => {
    const serhu = { tipo: 'FACCION', id: 'clan-serhu', nombre: 'Clan Serhu', papel: 'AUTOR' }
    const torgash = { tipo: 'NPC', id: 'n1', nombre: 'Torgash', papel: 'VICTIMA' }
    const e1 = entrada({ sucesoId: '1', actores: [serhu, torgash], region: 'Ciénaga Troncal' })
    const e2 = entrada({ sucesoId: '2', actores: [serhu], lugar: { id: 'l1', nombre: 'Puerto Lodo' } })
    expect(porEntidad([e1, e2], 'facciones').map((g) => [g.nombre, g.entradas.length])).toEqual([['Clan Serhu', 2]])
    expect(porEntidad([e1, e2], 'personajes').map((g) => g.nombre)).toEqual(['Torgash'])
    expect(porEntidad([e1, e2], 'lugares').map((g) => g.nombre)).toEqual(['Ciénaga Troncal', 'Puerto Lodo'])
  })

  it('línea temporal: solo lo destacado y lo grave, de lo antiguo a lo reciente', () => {
    const g = entrada({ sucesoId: 'g', nivel: 'GRAVE', cuando: dia(5) })
    const d = entrada({ sucesoId: 'd', nivel: 'DESTACADO', cuando: dia(1) })
    const n = entrada({ sucesoId: 'n', nivel: 'NORMAL', cuando: dia(3) })
    expect(lineaTemporal([g, n, d]).map((e) => e.sucesoId)).toEqual(['d', 'g'])
  })

  it('las muertes en color de peligro (INT-1)', () => {
    expect(colorDeEntrada({ familia: 'VIDA_MUERTE', tipo: 'MUERTE_NPC' })).toBe('text-danger-400')
    expect(colorDeEntrada({ familia: 'VIDA_MUERTE', tipo: 'NACIMIENTO' })).toBe('text-wood-200')
  })

  it('rumores con lugar de «El mundo» (INT-9): uno por suceso y fuera los ya confirmados', () => {
    const e = (id: string, text: string, noticia: object) => ({ id, channel: 'world', text, timeLabel: '', createdAt: '', noticia }) as never
    const log = [
      e('1', 'Se dice que A.', { sucesoId: 'a', rumor: { region: 'Ciénaga Troncal', pasoEn: 0 } }),
      e('2', 'Se dice que A.', { sucesoId: 'a', rumor: { region: 'Ciénaga Troncal', pasoEn: 0 } }),
      e('3', 'Se dice que B.', { sucesoId: 'b', rumor: { region: 'Cristal Helado', pasoEn: 0 } }),
      e('4', 'Se confirma: B.', { sucesoId: 'b' }),
      e('5', 'Se dice que C.', { sucesoId: 'c', rumor: { region: null, pasoEn: 0 } }),
    ]
    expect(rumoresConLugar(log)).toEqual([{ sucesoId: 'a', region: 'Ciénaga Troncal', texto: 'Se dice que A.' }])
  })
})

