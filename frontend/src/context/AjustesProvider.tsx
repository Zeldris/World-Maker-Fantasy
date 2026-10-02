import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { aplicarAjustes, cargarAjustes, guardarAjustes, type Ajustes } from '../lib/ajustes'
import { AjustesContext } from './ajustesContext'
import { PanelAjustes } from '../components/PanelAjustes'

/// CFG-6 (hito 0.2) — proveedor de los ajustes: los carga, los aplica a <html> y los guarda.
export function AjustesProvider({ children }: { children: ReactNode }) {
  const [guardados, setGuardados] = useState<Ajustes>(() => cargarAjustes())
  const [vista, setVista] = useState<Ajustes | null>(null)
  const [panelAbierto, setPanelAbierto] = useState(false)
  const ajustes = vista ?? guardados

  useEffect(() => {
    aplicarAjustes(ajustes)
  }, [ajustes])

  const setAjustes = useCallback((nuevos: Ajustes, opciones?: { vistaPrevia?: boolean }) => {
    if (opciones?.vistaPrevia) {
      setVista(nuevos)
      return
    }
    setVista(null)
    setGuardados(nuevos)
    guardarAjustes(nuevos)
  }, [])

  const descartarVistaPrevia = useCallback(() => setVista(null), [])
  const abrirPanel = useCallback(() => setPanelAbierto(true), [])

  const value = useMemo(() => ({ ajustes, setAjustes, descartarVistaPrevia, abrirPanel }), [ajustes, setAjustes, descartarVistaPrevia, abrirPanel])
  return (
    <AjustesContext.Provider value={value}>
      {children}
      {/* CFG-4 — el panel vive aquí para abrirse desde cualquier pantalla. */}
      {panelAbierto && <PanelAjustes guardados={guardados} onCerrar={() => setPanelAbierto(false)} />}
    </AjustesContext.Provider>
  )
}
