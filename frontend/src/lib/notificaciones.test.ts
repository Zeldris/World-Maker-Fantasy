import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { agregarNotificacion, MAX_NOTIFICACIONES, notificacionesDeEntrada, type Notificacion } from './notificaciones'
import { DURACION_NOTIFICACION_MS, useNotificaciones } from '../hooks/useNotificaciones'
import type { LogEntry } from '../types'

const e = (extra: Partial<LogEntry>): LogEntry => ({ id: 'x', channel: 'character', text: 't', timeLabel: '', createdAt: '', ...extra }) as LogEntry

/// HUD-6 (hito 0.2) — notificaciones.
describe('HUD-6 — notificaciones', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('agrupa las repetidas (×N, pasa arriba) y no pasa del tope', () => {
    let lista: Notificacion[] = []
    lista = agregarNotificacion(lista, { tipo: 'moss', icono: '🎒', texto: 'Obtienes Piedra' }, 1)
    lista = agregarNotificacion(lista, { tipo: 'quest', icono: '🎯', texto: 'Misión' }, 2)
    lista = agregarNotificacion(lista, { tipo: 'moss', icono: '🎒', texto: 'Obtienes Piedra' }, 3)
    expect(lista.map((n) => [n.texto, n.veces])).toEqual([['Misión', 1], ['Obtienes Piedra', 2]])
    for (let i = 0; i < 10; i++) lista = agregarNotificacion(lista, { tipo: 'accent', icono: 'i', texto: `n${i}` }, 10 + i)
    expect(lista).toHaveLength(MAX_NOTIFICACIONES)
  })

  it('avisos de una entrada: misión aceptada/completada, reputación (con su tono) y oficio que sube', () => {
    expect(notificacionesDeEntrada(e({ newQuest: { title: 'El eco', objetivo: '' } }))[0]).toMatchObject({ tipo: 'quest', texto: 'Misión aceptada: El eco' })
    expect(notificacionesDeEntrada(e({ questCompleted: { title: 'El eco', grantedItems: [], rewardXp: 0 } }))[0].texto).toBe('Misión completada: El eco')
    expect(notificacionesDeEntrada(e({ factionRepChange: { faction: 'Serhu', delta: -5, newValue: 10 } }))[0]).toMatchObject({ tipo: 'danger', texto: 'Reputación con Serhu -5' })
    expect(notificacionesDeEntrada(e({ professionXpGain: { oficio: 'herrero', xpDelta: 10, newLevel: 3, leveledUp: true } }))[0].tipo).toBe('moss')
    expect(notificacionesDeEntrada(e({ professionXpGain: { oficio: 'herrero', xpDelta: 10, newLevel: 2, leveledUp: false } }))).toEqual([])
  })

  it('useNotificaciones: cada aviso se va solo; uno repetido vuelve a contar', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useNotificaciones())
    act(() => result.current.notificar({ tipo: 'moss', icono: '🎒', texto: 'Obtienes Piedra' }))
    act(() => {
      vi.advanceTimersByTime(DURACION_NOTIFICACION_MS - 1000)
    })
    act(() => result.current.notificar({ tipo: 'moss', icono: '🎒', texto: 'Obtienes Piedra' }))
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.notificaciones).toHaveLength(1)
    expect(result.current.notificaciones[0].veces).toBe(2)
    act(() => {
      vi.advanceTimersByTime(DURACION_NOTIFICACION_MS)
    })
    expect(result.current.notificaciones).toHaveLength(0)
  })
})
