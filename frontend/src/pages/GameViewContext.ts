import { createContext, useContext } from 'react'
import type { GameViewState } from './useGameViewState'

/// BAS-5 (hito 0.2): el estado de la partida (`useGameViewState`) para las piezas de `GameView`
/// (`GameModals`, `GameLayout`) sin pasarlo prop a prop.
export const GameViewContext = createContext<GameViewState | null>(null)

export function useGameView(): GameViewState {
  const estado = useContext(GameViewContext)
  if (!estado) throw new Error('useGameView fuera de GameViewContext')
  return estado
}
