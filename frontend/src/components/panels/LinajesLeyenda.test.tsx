import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { LinajesLeyenda } from './LinajesLeyenda'
import { arbolDeLinaje } from '../../lib/linajes'
import * as api from '../../lib/api'
import type { MiembroLinaje } from '../../lib/api'

const m = (id: string, nombre: string, extra: Partial<MiembroLinaje> = {}): MiembroLinaje => ({ id, tipo: 'NPC', nombre, vivo: true, padreId: null, madreId: null, ...extra })

describe('LinajesLeyenda (CR-52)', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('el árbol cuelga a cada cría de su madre (o de su padre si la madre no es del linaje), sin repetir', () => {
    const miembros = [m('p', 'Torgash Ketg'), m('ma', 'Ulkha Ketg'), m('c', 'Brakka Ketg', { padreId: 'p', madreId: 'ma' }), m('d', 'Dorn Ketg', { padreId: 'p', madreId: 'fuera' })]
    const { raices, hijos } = arbolDeLinaje(miembros)
    expect(raices.map((r) => r.id)).toEqual(['p', 'ma'])
    expect(hijos('ma').map((h) => h.id)).toEqual(['c'])
    expect(hijos('p').map((h) => h.id)).toEqual(['d'])
  })

  it('pinta el linaje propio, los rastros, los caídos y lo que se sabe de cada familia', async () => {
    vi.spyOn(api, 'getLinajes').mockResolvedValue({
      linajes: [
        { id: '1', nombre: 'Gorhorn', tipo: 'APELLIDO', pueblo: 'orcos', propio: true, miembros: [{ ...m('s', 'Gorhorn'), tipo: 'PERSONAJE' }], historia: [] },
        {
          id: '2', nombre: 'Veyra', tipo: 'RASTRO', pueblo: 'faerus', propio: false,
          miembros: [m('a', 'Tasko', { vivo: false })],
          historia: [{ sucesoId: 'x', tipo: 'MUERTE_NPC', familia: 'VIDA_MUERTE', nivel: 'NORMAL', texto: 'Muere Tasko.', rumor: false, via: 'OIDAS', sabidoEn: 1, region: null, cuando: 1, fecha: null, lugar: null, actores: [], causas: [] }],
        },
      ],
    })
    render(<LinajesLeyenda saveId="s" />)
    expect(await screen.findByText('Los Gorhorn')).toBeTruthy()
    expect(screen.getByText('· tu linaje')).toBeTruthy()
    expect(screen.getByText('Rastro Veyra')).toBeTruthy()
    expect(screen.getByText('(muerto)')).toBeTruthy()
    expect(screen.getByText('Muere Tasko.')).toBeTruthy()
  })
})
