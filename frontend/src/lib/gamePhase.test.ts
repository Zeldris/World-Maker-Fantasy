import { describe, it, expect } from 'vitest'
import { calcularFase, canDo, type EstadoParaFase, type FaseJuego } from './gamePhase'

const base: EstadoParaFase = {
  terminada: false, muertePendiente: false, enCombate: false, modoDinamico: false,
  narradorEscribiendo: false, eleccionAbierta: false, encuentroPendiente: false, ocupado: false,
}

/// UX-1 (hito 0.2) — tabla de casos de la fase, con prioridad fija si coinciden.
describe('UX-1 — calcularFase', () => {
  const casos: [Partial<EstadoParaFase>, FaseJuego][] = [
    [{}, 'libre'],
    [{ ocupado: true }, 'ocupado'],
    [{ encuentroPendiente: true, ocupado: true }, 'encuentro'],
    [{ eleccionAbierta: true, encuentroPendiente: true }, 'eleccion'],
    [{ modoDinamico: true, eleccionAbierta: true }, 'dinamico'],
    [{ enCombate: true, modoDinamico: true }, 'combate'],
    [{ narradorEscribiendo: true, enCombate: true }, 'pensando'],
    [{ muertePendiente: true, narradorEscribiendo: true }, 'muerte'],
    [{ terminada: true, muertePendiente: true }, 'fin'],
  ]
  it.each(casos)('%o → %s', (parcial, fase) => {
    expect(calcularFase({ ...base, ...parcial })).toBe(fase)
  })
})

/// UX-2 (hito 0.2) — matriz de permisos de § 5.
describe('UX-2 — canDo', () => {
  it('en libre se puede todo, sin motivo', () => {
    for (const a of ['enviarTurno', 'tarjeta', 'abrirPanel', 'modificarPanel', 'moverse', 'decidir', 'salir'] as const) {
      expect(canDo('libre', a)).toEqual({ permitido: true, motivo: null })
    }
  })

  it('bloquear explicando: los mismos motivos que antes de UX-3', () => {
    expect(canDo('pensando', 'enviarTurno')).toEqual({ permitido: false, motivo: 'El narrador todavía está escribiendo.' })
    expect(canDo('ocupado', 'enviarTurno').motivo).toBe('Estás ocupado con otra actividad.')
    expect(canDo('fin', 'enviarTurno').motivo).toBe('La partida ha terminado.')
    expect(canDo('muerte', 'tarjeta').motivo).toBe('Primero resuelve lo que ha pasado tras tu muerte.')
  })

  it('consultar siempre (salvo en una escena), cambiar datos solo cuando toca', () => {
    for (const f of ['pensando', 'ocupado', 'combate', 'eleccion', 'muerte', 'fin'] as const) {
      expect(canDo(f, 'abrirPanel').permitido).toBe(true)
      expect(canDo(f, 'modificarPanel').permitido).toBe(false)
    }
    expect(canDo('dinamico', 'abrirPanel').permitido).toBe(false)
  })

  it('moverse solo en libre; el encuentro deja escribir y usar su tarjeta pero no moverse', () => {
    expect(canDo('encuentro', 'moverse')).toEqual({ permitido: false, motivo: 'Primero reacciona a quien te corta el paso.' })
    expect(canDo('encuentro', 'enviarTurno').permitido).toBe(true)
    expect(canDo('encuentro', 'tarjeta').permitido).toBe(true)
    expect(canDo('ocupado', 'moverse').permitido).toBe(false)
  })

  it('las decisiones esperan en cola durante combate, escena y narración; en fin no hay', () => {
    expect(canDo('combate', 'decidir')).toEqual({ permitido: false, motivo: 'Estás en combate. La elección se abrirá al terminar.' })
    expect(canDo('eleccion', 'decidir').permitido).toBe(true)
    expect(canDo('fin', 'decidir')).toEqual({ permitido: false, motivo: 'La partida ha terminado.' })
  })

  it('salir siempre se puede; con aviso si el narrador escribe o hay combate', () => {
    expect(canDo('pensando', 'salir').permitido).toBe(true)
    expect(canDo('pensando', 'salir').motivo).toMatch(/narrador/)
    expect(canDo('combate', 'salir').motivo).toMatch(/combate/)
    expect(canDo('muerte', 'salir')).toEqual({ permitido: true, motivo: null })
  })
})
