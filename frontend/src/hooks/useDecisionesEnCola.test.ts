import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { msDeLectura, useDecisionesEnCola } from './useDecisionesEnCola'

/// UX-10 (hito 0.2) — las decisiones esperan al combate/escena/narración y a leer lo último.
describe('UX-10 — useDecisionesEnCola', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('msDeLectura: entre 2 y 12 s según la longitud', () => {
    expect(msDeLectura('')).toBe(2000)
    expect(msDeLectura('x'.repeat(100))).toBe(4000)
    expect(msDeLectura('x'.repeat(1000))).toBe(12000)
  })

  it('espera mientras está bloqueada y, al terminar, el tiempo de lectura', () => {
    const { result, rerender } = renderHook((p) => useDecisionesEnCola(p), {
      initialProps: { hayDecision: true, bloqueada: true, ultimaNarracion: 'x'.repeat(100) },
    })
    expect(result.current).toMatchObject({ mostrar: false, enEspera: true })
    rerender({ hayDecision: true, bloqueada: false, ultimaNarracion: 'x'.repeat(100) })
    act(() => {
      vi.advanceTimersByTime(3999)
    })
    expect(result.current.mostrar).toBe(false)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toMatchObject({ mostrar: true, enEspera: false })
  })

  it('«abrirYa» la abre aunque haya combate; sin decisión no hay nada', () => {
    const { result, rerender } = renderHook((p) => useDecisionesEnCola(p), {
      initialProps: { hayDecision: true, bloqueada: true, ultimaNarracion: '' },
    })
    act(() => result.current.abrirYa())
    expect(result.current.mostrar).toBe(true)
    rerender({ hayDecision: false, bloqueada: true, ultimaNarracion: '' })
    expect(result.current).toMatchObject({ mostrar: false, enEspera: false })
  })
})
