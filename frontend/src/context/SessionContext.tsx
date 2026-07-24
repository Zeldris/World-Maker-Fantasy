import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Character, Dificultad, World } from '../types'
import { applyWorldTheme } from '../lib/worldTheme'

interface SessionState {
  selectedWorld: World | null
  selectedCharacter: Character | null
  /// docs/14-combate-y-muerte.md § 4.2 — elegida en el mismo paso que el personaje, se manda a
  /// createSave() al arrancar una partida nueva. Default MEDIO.
  selectedDificultad: Dificultad
  setSelectedWorld: (world: World | null) => void
  setSelectedCharacter: (character: Character | null) => void
  setSelectedDificultad: (dificultad: Dificultad) => void
  reset: () => void
}

const SessionContext = createContext<SessionState | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [selectedWorld, setSelectedWorld] = useState<World | null>(null)
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [selectedDificultad, setSelectedDificultad] = useState<Dificultad>('MEDIO')

  useEffect(() => {
    applyWorldTheme(selectedWorld?.theme ?? null)
  }, [selectedWorld])

  const value = useMemo(
    () => ({
      selectedWorld,
      selectedCharacter,
      selectedDificultad,
      setSelectedWorld,
      setSelectedCharacter,
      setSelectedDificultad,
      reset: () => {
        setSelectedWorld(null)
        setSelectedCharacter(null)
        setSelectedDificultad('MEDIO')
      },
    }),
    [selectedWorld, selectedCharacter, selectedDificultad],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession debe usarse dentro de SessionProvider')
  return ctx
}
