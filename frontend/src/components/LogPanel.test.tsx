import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
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

// F9-1 (decisión de Álvaro, 2026-09-29) — la tarjeta "Cazar" avisa cuando la caza es peligrosa.
describe('LogPanel — aviso de riesgo en la tarjeta Cazar', () => {
  const baseProps = { title: 'Tu personaje', subtitle: 'x', accent: 'accent' as const, emptyHint: 'vacío' }
  function entryConOferta(extra: Partial<NonNullable<LogEntry['dynamicModeOffer']>>): LogEntry {
    return {
      id: '1',
      channel: 'character',
      text: 'x',
      timeLabel: 'Día 1',
      createdAt: new Date().toISOString(),
      dynamicModeOffer: { tipo: 'FAUNA', targetSlug: 'gesgurio', targetName: 'Gesgurio', zonePointId: 'zp1', cantidad: 3, ...extra },
    }
  }

  it('riesgo mortal: línea roja con el motivo, y el botón Cazar sigue disponible', () => {
    const e = entryConOferta({ riesgoCaza: { riesgo: 'mortal', motivo: 'Un grupo de 3 Gesgurio (nivel 2) frente a tu nivel 1.' } })
    const { getByRole, getByText } = render(<LogPanel {...baseProps} entries={[e]} isThinking={false} />)
    const aviso = getByRole('alert')
    expect(aviso.getAttribute('data-riesgo')).toBe('mortal')
    expect(aviso.textContent).toContain('matarte en un solo turno')
    expect(aviso.textContent).toContain('3 Gesgurio')
    expect(getByText('Cazar')).toBeTruthy()
  })

  it('riesgo alto: línea de advertencia', () => {
    const e = entryConOferta({ riesgoCaza: { riesgo: 'alto', motivo: 'Es un grupo.' } })
    const { getByRole } = render(<LogPanel {...baseProps} entries={[e]} isThinking={false} />)
    expect(getByRole('alert').getAttribute('data-riesgo')).toBe('alto')
  })

  it('riesgo bajo o sin dato: sin aviso', () => {
    const bajo = entryConOferta({ riesgoCaza: { riesgo: 'bajo', motivo: '' } })
    expect(render(<LogPanel {...baseProps} entries={[bajo]} isThinking={false} />).queryByRole('alert')).toBeNull()
    cleanup()
    const sin = entryConOferta({})
    expect(render(<LogPanel {...baseProps} entries={[sin]} isThinking={false} />).queryByRole('alert')).toBeNull()
  })
})

// Modal de detalle de RECURSO (2026-09-29, petición de Álvaro) — "Interactuar" en la tarjeta de un
// recurso ya no recolecta directo: avisa al padre para abrir el modal de detalle (estado en
// useModoDinamico.ts). NPC/FAUNA siguen por su callback de siempre.
describe('LogPanel — "Interactuar" en una oferta RECURSO', () => {
  const baseProps = {
    title: 'Tu personaje',
    subtitle: 'x',
    accent: 'accent' as const,
    emptyHint: 'vacío',
  }
  function entradaConOferta(tipo: 'RECURSO' | 'NPC'): LogEntry {
    return {
      id: 'e1',
      channel: 'character',
      text: 'Encuentras algo cerca.',
      timeLabel: 'Día 1',
      createdAt: new Date().toISOString(),
      dynamicModeOffer: { tipo, targetSlug: 'lucre-blanco', targetName: 'Lucre Blanco', metodo: tipo === 'RECURSO' ? 'TALA' : undefined },
    }
  }

  it('abre el detalle (onVerRecursoDetalle con slug/nombre/metodo) y NO cae en ningún otro callback de interacción', () => {
    const onVerRecursoDetalle = vi.fn()
    const onInteractuarModoDinamico = vi.fn()
    const { getByText } = render(
      <LogPanel {...baseProps} entries={[entradaConOferta('RECURSO')]} onVerRecursoDetalle={onVerRecursoDetalle} onInteractuarModoDinamico={onInteractuarModoDinamico} />,
    )
    fireEvent.click(getByText('Interactuar'))
    expect(onVerRecursoDetalle).toHaveBeenCalledWith('e1', 'lucre-blanco', 'Lucre Blanco', 'TALA')
    expect(onInteractuarModoDinamico).not.toHaveBeenCalled()
  })

  it('"Ignorar" sigue llamando a onDismissDynamicModeOffer sin abrir el detalle', () => {
    const onVerRecursoDetalle = vi.fn()
    const onDismissDynamicModeOffer = vi.fn()
    const { getByText } = render(
      <LogPanel {...baseProps} entries={[entradaConOferta('RECURSO')]} onVerRecursoDetalle={onVerRecursoDetalle} onDismissDynamicModeOffer={onDismissDynamicModeOffer} />,
    )
    fireEvent.click(getByText('Ignorar'))
    expect(onDismissDynamicModeOffer).toHaveBeenCalledWith('e1')
    expect(onVerRecursoDetalle).not.toHaveBeenCalled()
  })

  it('una oferta NPC sigue usando onInteractuarModoDinamico, no el detalle de recurso', () => {
    const onVerRecursoDetalle = vi.fn()
    const onInteractuarModoDinamico = vi.fn()
    const { getByText } = render(
      <LogPanel {...baseProps} entries={[entradaConOferta('NPC')]} onVerRecursoDetalle={onVerRecursoDetalle} onInteractuarModoDinamico={onInteractuarModoDinamico} />,
    )
    fireEvent.click(getByText('Interactuar'))
    expect(onInteractuarModoDinamico).toHaveBeenCalledTimes(1)
    expect(onVerRecursoDetalle).not.toHaveBeenCalled()
  })
})
