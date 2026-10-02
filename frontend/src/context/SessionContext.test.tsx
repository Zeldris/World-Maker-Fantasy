import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { SessionProvider, SESSION_STORAGE_KEY } from './SessionContext'
import { useSession } from './useSession'
import type { SessionState } from './sessionContext'
import type { Character, World } from '../types'

/// UX-16 (hito 0.1, roadmap-front-ux.md H16) — la elección del asistente sobrevive a recargar.
const mundo = { id: 'helek-sirik', name: 'Helek Sirik', theme: null } as unknown as World
const personaje = { id: 'gorhorn', name: 'Gorhorn', isPregenerated: true } as unknown as Character

let sesion: SessionState
function Consumidor() {
  sesion = useSession()
  return null
}

describe('SessionProvider — UX-16', () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => {
    cleanup()
    sessionStorage.clear()
  })

  it('una recarga (provider nuevo) recupera mundo, personaje y dificultad', () => {
    const { unmount } = render(<SessionProvider><Consumidor /></SessionProvider>)
    act(() => {
      sesion.setSelectedWorld(mundo)
      sesion.setSelectedCharacter(personaje)
      sesion.setSelectedDificultad('AVANZADO')
    })
    unmount()

    render(<SessionProvider><Consumidor /></SessionProvider>)
    expect(sesion.selectedWorld?.id).toBe('helek-sirik')
    expect(sesion.selectedCharacter?.id).toBe('gorhorn')
    expect(sesion.selectedDificultad).toBe('AVANZADO')
  })

  it('reset borra lo guardado', () => {
    render(<SessionProvider><Consumidor /></SessionProvider>)
    act(() => sesion.setSelectedWorld(mundo))
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull()
    act(() => sesion.reset())
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('un valor guardado corrupto no rompe el arranque', () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, '{no es json')
    render(<SessionProvider><Consumidor /></SessionProvider>)
    expect(sesion.selectedWorld).toBeNull()
    expect(sesion.selectedDificultad).toBe('MEDIO')
  })
})
