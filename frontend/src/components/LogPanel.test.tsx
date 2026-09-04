import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { LogPanel } from './LogPanel'
import type { LogEntry } from '../types'

// Sin `globals: true` en vitest.config.ts, @testing-library/react no desmonta automáticamente
// entre tests — dos `render()` en tests distintos del mismo archivo se ACUMULAN en el DOM (bug
// real encontrado escribiendo el describe de abajo: un test veía contenido del anterior). El
// describe existente de arriba nunca lo topó porque solo usaba `rerender` dentro de un mismo test.
afterEach(() => {
  cleanup()
})

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

// Legend "Tirada de iniciativa" (2026-09-04, petición explícita jugando en vivo: poder distinguir
// esta tirada del resto de tiradas de turno normal en el log) — solo debe aparecer cuando la
// entrada trae `initiativeRoll` (turno de emboscada/apertura de combate real), nunca en un turno
// normal cualquiera con `roll` (explorar, hablar, recolectar...).
describe('LogPanel — legend "Tirada de iniciativa"', () => {
  const baseProps = {
    title: 'Tu personaje',
    subtitle: 'x',
    accent: 'accent' as const,
    emptyHint: 'vacío',
  }
  const roll = { attribute: 'destreza' as const, value: 12, roll: 7, difficulty: 15, result: 13, success: false, gradoExito: 'fallo' as const }
  const side = { ...roll, valorEfectivo: 12 }
  const initiativeRoll = { ganador: 'jugador' as const, jugador: side, npc: { ...side, roll: 3 } }

  it('muestra el legend cuando la entrada trae initiativeRoll (turno de apertura de combate)', () => {
    const entry: LogEntry = { id: '1', channel: 'character', text: 'x', timeLabel: 'Día 1', createdAt: new Date().toISOString(), roll, initiativeRoll }
    const { getByText } = render(<LogPanel {...baseProps} entries={[entry]} isThinking={false} />)
    expect(getByText('Tirada de iniciativa')).toBeTruthy()
  })

  it('NO muestra el legend en un turno normal con roll pero sin initiativeRoll', () => {
    const entry: LogEntry = { id: '1', channel: 'character', text: 'x', timeLabel: 'Día 1', createdAt: new Date().toISOString(), roll }
    const { queryByText } = render(<LogPanel {...baseProps} entries={[entry]} isThinking={false} />)
    expect(queryByText('Tirada de iniciativa')).toBeNull()
  })
})
