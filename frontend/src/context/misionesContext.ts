import { createContext, useContext } from 'react'
import type { AvisoMisionInfo } from '../lib/api'

// CR-40 (40g, hito 0.2): abrir los avisos de un tablón o la propuesta de un NPC desde cualquier
// panel (zona, menú del NPC) sin pasar callbacks por cada capa. Lo provee GameView, que pinta el
// modal y refresca la partida al aceptar.
export interface MisionesValue {
  abrirTablon: (buildingId: string) => void
  /// `aviso` null = el NPC no tiene nada que ofrecer ahora.
  mostrarOfertaNpc: (npcName: string, aviso: AvisoMisionInfo | null) => void
}

export const MisionesContext = createContext<MisionesValue | null>(null)

export function useMisiones(): MisionesValue | null {
  return useContext(MisionesContext)
}
