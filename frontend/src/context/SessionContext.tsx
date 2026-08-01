import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Character, Dificultad, World } from '../types'
import { applyWorldTheme } from '../lib/worldTheme'
import { SessionContext } from './sessionContext'

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
