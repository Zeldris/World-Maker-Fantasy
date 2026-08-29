import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { LogPanel } from './LogPanel'
import type { LogEntry } from '../types'

/// Bug real (pendiente 2026-08-27, "el foco de pantalla no siempre baja a la narración" —
/// investigado 2026-08-28): con `behavior: 'smooth'` en CADA chunk de streaming, un gesto de
/// scroll manual del usuario a mitad de narración cancela la animación en curso sin ningún evento
/// para detectarlo — el aterrizaje final podía quedarse a medio camino. Fix: el aterrizaje al
/// TERMINAR el turno (`isThinking` true→false) usa `behavior: 'auto'` (instantáneo, no
/// interrumpible), el resto sigue con `'smooth'`.
describe('LogPanel — auto-scroll al terminar de narrar', () => {
  function entry(id: string): LogEntry {
    return { id, channel: 'character', text: 'x', timeLabel: 'Día 1', createdAt: new Date().toISOString() }
  }

  const baseProps = {
    title: 'Tu personaje',
    subtitle: 'x',
    accent: 'accent' as const,
    emptyHint: 'vacío',
  }

  it('usa scroll instantáneo (auto) justo cuando isThinking pasa de true a false', () => {
    const scrollToSpy = vi.fn()
    Element.prototype.scrollTo = scrollToSpy

    const { rerender } = render(<LogPanel {...baseProps} entries={[entry('1')]} isThinking={true} thinkingText="narrando..." />)
    scrollToSpy.mockClear()

    // Turno termina: entra la entrada definitiva Y isThinking pasa a false en el mismo render.
    rerender(<LogPanel {...baseProps} entries={[entry('1'), entry('2')]} isThinking={false} thinkingText={undefined} />)

    expect(scrollToSpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }))
  })

  it('sigue usando scroll suave (smooth) mientras el streaming continúa en curso', () => {
    const scrollToSpy = vi.fn()
    Element.prototype.scrollTo = scrollToSpy

    const { rerender } = render(<LogPanel {...baseProps} entries={[entry('1')]} isThinking={true} thinkingText="narrando un poco" />)
    scrollToSpy.mockClear()

    // Sigue narrando — el texto de streaming crece, isThinking se mantiene true.
    rerender(<LogPanel {...baseProps} entries={[entry('1')]} isThinking={true} thinkingText="narrando un poco más" />)

    expect(scrollToSpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }))
  })
})
