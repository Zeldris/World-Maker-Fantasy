import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { renderHook, act } from '@testing-library/react'

vi.mock('../lib/api', () => ({ getNuevasDelMundo: vi.fn() }))
import { getNuevasDelMundo } from '../lib/api'
import { useNoticiasMundo, INTERVALO_NOTICIAS_MS } from './useNoticiasMundo'
import type { LogEntry } from '../types'

/// Fase D del hito 0.1 — las noticias del mundo llegan sin recargar la partida.
const entrada = (id: string, text: string): LogEntry => ({ id, channel: 'world', text, timeLabel: 'Día 3, tarde', createdAt: '2026-10-02T10:00:00Z' })

function useHarness(thinkingInicial: boolean) {
  const [worldLog, setWorldLog] = useState<LogEntry[]>([entrada('w1', 'Ambiente')])
  const [characterThinking, setCharacterThinking] = useState(thinkingInicial)
  useNoticiasMundo({ saveId: 's1', worldLog, setWorldLog, characterThinking })
  return { worldLog, setCharacterThinking }
}

describe('useNoticiasMundo', () => {
  beforeEach(() => vi.mocked(getNuevasDelMundo).mockReset())

  it('al terminar un turno pide lo posterior a la última entrada y lo añade sin duplicar', async () => {
    vi.mocked(getNuevasDelMundo).mockResolvedValue({ entradas: [entrada('w1', 'Ambiente'), entrada('w2', 'Los recolectores de Clan Serhu regresan…')] })
    const { result } = renderHook(() => useHarness(true))
    await act(async () => {
      result.current.setCharacterThinking(false)
    })
    expect(getNuevasDelMundo).toHaveBeenCalledWith('s1', 'w1')
    expect(result.current.worldLog.map((e) => e.id)).toEqual(['w1', 'w2'])
  })

  it('también pregunta cada cierto tiempo aunque no haya turnos', async () => {
    vi.useFakeTimers()
    vi.mocked(getNuevasDelMundo).mockResolvedValue({ entradas: [] })
    renderHook(() => useHarness(false))
    expect(getNuevasDelMundo).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(INTERVALO_NOTICIAS_MS)
    })
    expect(getNuevasDelMundo).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
