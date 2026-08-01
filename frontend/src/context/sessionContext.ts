import { createContext } from 'react'
import type { Character, Dificultad, World } from '../types'

export interface SessionState {
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

export const SessionContext = createContext<SessionState | null>(null)
