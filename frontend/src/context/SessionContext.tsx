import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Character, World } from '../types'
import { applyWorldTheme } from '../lib/worldTheme'

interface SessionState {
  selectedWorld: World | null
  selectedCharacter: Character | null
  setSelectedWorld: (world: World | null) => void
  setSelectedCharacter: (character: Character | null) => void
  reset: () => void
}

const SessionContext = createContext<SessionState | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [selectedWorld, setSelectedWorld] = useState<World | null>(null)
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)

  useEffect(() => {
    applyWorldTheme(selectedWorld?.theme ?? null)
  }, [selectedWorld])

  const value = useMemo(
    () => ({
      selectedWorld,
      selectedCharacter,
      setSelectedWorld,
      setSelectedCharacter,
      reset: () => {
        setSelectedWorld(null)
        setSelectedCharacter(null)
      },
    }),
    [selectedWorld, selectedCharacter],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession debe usarse dentro de SessionProvider')
  return ctx
}
