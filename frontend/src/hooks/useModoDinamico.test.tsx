import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState } from 'react'

vi.mock('../lib/api', () => ({
  abrirMenuNpc: vi.fn(),
  chooseNpcInteraction: vi.fn(),
  interactuarModoDinamico: vi.fn(),
  getSave: vi.fn(),
  ignorarModoDinamico: vi.fn(),
  interactuarModoDinamicoRecurso: vi.fn(),
  resolveImageUrl: vi.fn(() => null),
  responderModoDinamico: vi.fn(),
}))
import { abrirMenuNpc, chooseNpcInteraction, interactuarModoDinamico } from '../lib/api'
import { useModoDinamico } from './useModoDinamico'
import type { LogEntry } from '../types'

const encuentro: LogEntry = {
  id: 'e1', channel: 'character', text: 'Alguien busca tu atención.', timeLabel: '', createdAt: '',
  dynamicModeOffer: { tipo: 'NPC', targetSlug: 'maestro-cocinero-serhu', targetName: 'Alguien', quienInicia: 'jugador' },
}

function montar(inicial: LogEntry = encuentro) {
  const setActiveDynamicMode = vi.fn()
  const handleSubmit = vi.fn()
  const hook = renderHook(() => {
    const [characterLog, setCharacterLog] = useState<LogEntry[]>([inicial])
    const md = useModoDinamico({
      saveId: 's1', characterLog, characterName: 'Gorhorn', fictionalDate: '', enciclopediaIndex: { bySlugKey: new Map() } as never,
      setCharacterLog, setFictionalDate: vi.fn(), setCombateIniciado: vi.fn(), setActiveDynamicMode, setInventory: vi.fn(), setXp: vi.fn(),
      setQuests: vi.fn(), setAprenderOficioModalOpen: vi.fn(), setActivePanel: vi.fn(), openCombat: vi.fn(), handleSubmit,
    })
    return { characterLog, ...md }
  })
  return { hook, setActiveDynamicMode }
}

/// P142: «Interactuar» con un NPC del mapa abre antes su menú fijo; «Charlar» abre la escena libre.
describe('P142 — menú fijo del NPC desde el encuentro del mapa', () => {
  beforeEach(() => {
    vi.mocked(abrirMenuNpc).mockReset()
    vi.mocked(chooseNpcInteraction).mockReset()
    vi.mocked(interactuarModoDinamico).mockReset()
  })

  it('con menú: lo pone en la entrada y no abre la escena', async () => {
    vi.mocked(abrirMenuNpc).mockResolvedValue({ menu: { npcSlug: 'maestro-cocinero-serhu', npcName: 'Alguien', options: ['Charlar', 'Aprender oficio', 'Salir'], desdeEncuentro: true } })
    const { hook } = montar()
    await act(async () => {
      await hook.result.current.handleInteractuarModoDinamico('e1', 'NPC', 'maestro-cocinero-serhu', 'Alguien', 'jugador')
    })
    expect(interactuarModoDinamico).not.toHaveBeenCalled()
    expect(hook.result.current.characterLog[0].npcInteractionOffer).toMatchObject({ options: ['Charlar', 'Aprender oficio', 'Salir'], desdeEncuentro: true })
    expect(hook.result.current.characterLog[0].dynamicModeOffer).toMatchObject({ busy: false })
  })

  it('sin menú: abre la escena libre como siempre', async () => {
    vi.mocked(abrirMenuNpc).mockResolvedValue({ menu: null })
    vi.mocked(interactuarModoDinamico).mockResolvedValue({ narration: 'Hola', opciones: [], cierra: false, vuelta: 1, timeLabel: '' } as never)
    const { hook, setActiveDynamicMode } = montar()
    await act(async () => {
      await hook.result.current.handleInteractuarModoDinamico('e1', 'NPC', 'maestro-cocinero-serhu', 'Alguien', 'jugador')
    })
    expect(interactuarModoDinamico).toHaveBeenCalledTimes(1)
    expect(setActiveDynamicMode).toHaveBeenCalled()
  })

  it('Charlar en ese menú abre la escena del encuentro sin volver al menú', async () => {
    vi.mocked(abrirMenuNpc).mockResolvedValue({ menu: { npcSlug: 'maestro-cocinero-serhu', npcName: 'Alguien', options: ['Charlar', 'Salir'], desdeEncuentro: true } })
    vi.mocked(chooseNpcInteraction).mockResolvedValue({ accion: 'CHARLAR' })
    vi.mocked(interactuarModoDinamico).mockResolvedValue({ narration: 'Hola', opciones: [], cierra: false, vuelta: 1, timeLabel: '' } as never)
    const { hook, setActiveDynamicMode } = montar()
    await act(async () => {
      await hook.result.current.handleInteractuarModoDinamico('e1', 'NPC', 'maestro-cocinero-serhu', 'Alguien', 'jugador')
    })
    await act(async () => {
      await hook.result.current.handleChooseNpcInteraction('e1', 'maestro-cocinero-serhu', 'Charlar')
    })
    expect(abrirMenuNpc).toHaveBeenCalledTimes(1)
    expect(interactuarModoDinamico).toHaveBeenCalledWith('s1', 'NPC', 'maestro-cocinero-serhu', 'Alguien', 'jugador', false, undefined, undefined)
    expect(setActiveDynamicMode).toHaveBeenCalled()
  })

  it('Salir en ese menú retira también la tarjeta del encuentro', async () => {
    vi.mocked(abrirMenuNpc).mockResolvedValue({ menu: { npcSlug: 'maestro-cocinero-serhu', npcName: 'Alguien', options: ['Charlar', 'Salir'], desdeEncuentro: true } })
    vi.mocked(chooseNpcInteraction).mockResolvedValue({ accion: 'CERRAR' })
    const { hook } = montar()
    await act(async () => {
      await hook.result.current.handleInteractuarModoDinamico('e1', 'NPC', 'maestro-cocinero-serhu', 'Alguien', 'jugador')
    })
    await act(async () => {
      await hook.result.current.handleChooseNpcInteraction('e1', 'maestro-cocinero-serhu', 'Salir')
    })
    expect(hook.result.current.characterLog[0].dynamicModeOffer).toBeUndefined()
    expect(hook.result.current.characterLog[0].npcInteractionOffer).toBeUndefined()
  })
})

/// P309: al pulsar «Interactuar» la tarjeta pasaba a «Interactuando...» y perdía `quien` (el nombre con
/// artículo que manda el backend), `aQuien` y `deBando`: la cabecera quedaba «Cazadora Serhu busca…».
describe('P309 — la tarjeta conserva lo que manda el backend mientras interactúa', () => {
  const cazadora: LogEntry = {
    ...encuentro,
    dynamicModeOffer: {
      tipo: 'NPC', targetSlug: 'cazadora-serhu', targetName: 'Cazadora Serhu', quienInicia: 'jugador',
      quien: 'La Cazadora Serhu', aQuien: 'a la Cazadora Serhu', deBando: { faccion: 'Clan Serhu', deQuien: 'del Clan Serhu', reputacion: -50 },
    },
  }

  it('mientras espera (busy) sigue con `quien`, `aQuien` y `deBando`', async () => {
    let soltar: (v: { menu: null }) => void = () => undefined
    vi.mocked(abrirMenuNpc).mockReset()
    vi.mocked(abrirMenuNpc).mockReturnValue(new Promise((r) => { soltar = r as never }))
    vi.mocked(interactuarModoDinamico).mockReset()
    vi.mocked(interactuarModoDinamico).mockRejectedValue(new Error('No se pudo abrir'))
    const { hook } = montar(cazadora)
    let promesa: Promise<void> = Promise.resolve()
    await act(async () => {
      promesa = hook.result.current.handleInteractuarModoDinamico('e1', 'NPC', 'cazadora-serhu', 'Cazadora Serhu', 'jugador')
    })
    expect(hook.result.current.characterLog[0].dynamicModeOffer).toMatchObject({
      busy: true, quien: 'La Cazadora Serhu', aQuien: 'a la Cazadora Serhu', deBando: { reputacion: -50 },
    })
    await act(async () => {
      soltar({ menu: null })
      await promesa
    })
    // Tras el fallo, la tarjeta sigue siendo la misma, con el motivo.
    expect(hook.result.current.characterLog[0].dynamicModeOffer).toMatchObject({
      busy: false, error: 'No se pudo abrir', quien: 'La Cazadora Serhu', aQuien: 'a la Cazadora Serhu',
    })
  })
})
