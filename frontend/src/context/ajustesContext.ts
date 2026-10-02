import { createContext } from 'react'
import { AJUSTES_POR_DEFECTO, type Ajustes } from '../lib/ajustes'

export interface AjustesValue {
  ajustes: Ajustes
  /// Aplica y guarda (CFG-5). Con `vistaPrevia`, aplica sin guardar (el panel de CFG-4).
  setAjustes: (ajustes: Ajustes, opciones?: { vistaPrevia?: boolean }) => void
}

/// CFG-6 (hito 0.2) — ajustes del jugador. Sin proveedor (tests), los de por defecto.
export const AjustesContext = createContext<AjustesValue>({ ajustes: AJUSTES_POR_DEFECTO, setAjustes: () => {} })
