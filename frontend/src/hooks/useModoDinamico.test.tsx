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

function montar() {
  const setActiveDynamicMode = vi.fn()
  const handleSubmit = vi.fn()
  const hook = renderHook(() => {
    const [characterLog, setCharacterLog] = useState<LogEntry[]>([encuentro])
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
