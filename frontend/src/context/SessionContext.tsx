import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Character, Dificultad, World } from '../types'
import { applyWorldTheme } from '../lib/worldTheme'
import { SessionContext } from './sessionContext'

/// UX-16 (hito 0.1, roadmap-front-ux.md H16) — la selección del asistente de partida nueva (mundo,
/// personaje, dificultad) se guarda en `sessionStorage`: antes vivía solo en memoria y recargar en
/// `/partida/nueva` acababa en "No se encuentra esta partida". `sessionStorage` (no `localStorage`)
/// para que cada pestaña lleve su propio asistente y nada sobreviva a cerrar el juego.
export const SESSION_STORAGE_KEY = 'tarkor.sesion-asistente'

interface SesionGuardada {
  selectedWorld: World | null
  selectedCharacter: Character | null
  selectedDificultad: Dificultad
}

function leerSesionGuardada(): SesionGuardada | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SesionGuardada) : null
  } catch {
    return null
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [guardada] = useState(leerSesionGuardada)
  const [selectedWorld, setSelectedWorld] = useState<World | null>(guardada?.selectedWorld ?? null)
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(guardada?.selectedCharacter ?? null)
  const [selectedDificultad, setSelectedDificultad] = useState<Dificultad>(guardada?.selectedDificultad ?? 'MEDIO')

  useEffect(() => {
    applyWorldTheme(selectedWorld?.theme ?? null)
  }, [selectedWorld])

  useEffect(() => {
    try {
      if (!selectedWorld && !selectedCharacter && selectedDificultad === 'MEDIO') sessionStorage.removeItem(SESSION_STORAGE_KEY)
      else sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ selectedWorld, selectedCharacter, selectedDificultad }))
    } catch {
      // Almacenamiento bloqueado (modo privado, cuota): el asistente sigue funcionando en memoria.
    }
  }, [selectedWorld, selectedCharacter, selectedDificultad])

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
