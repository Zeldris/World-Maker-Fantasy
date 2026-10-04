import { createContext } from 'react'
import { AJUSTES_POR_DEFECTO, type Ajustes } from '../lib/ajustes'

export interface AjustesValue {
  ajustes: Ajustes
  /// Aplica y guarda (CFG-5). Con `vistaPrevia`, aplica sin guardar (el panel de CFG-4).
  setAjustes: (ajustes: Ajustes, opciones?: { vistaPrevia?: boolean }) => void
  /// Vuelve a los ajustes guardados, descartando la vista previa.
  descartarVistaPrevia: () => void
  /// CFG-4 — abre el panel de configuración (desde la cabecera, Inicio o el menú de pausa).
  abrirPanel: () => void
  /// CR-12 — partida abierta (para la pestaña «Partida» del panel); null fuera de una partida.
  partidaActual: string | null
  setPartidaActual: (saveId: string | null) => void
}

/// CFG-6 (hito 0.2) — ajustes del jugador. Sin proveedor (tests), los de por defecto.
export const AjustesContext = createContext<AjustesValue>({
  ajustes: AJUSTES_POR_DEFECTO,
  setAjustes: () => {},
  descartarVistaPrevia: () => {},
  abrirPanel: () => {},
  partidaActual: null,
  setPartidaActual: () => {},
})
