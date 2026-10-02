import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { aplicarAjustes, cargarAjustes, guardarAjustes, type Ajustes } from '../lib/ajustes'
import { AjustesContext } from './ajustesContext'

/// CFG-6 (hito 0.2) — proveedor de los ajustes: los carga, los aplica a <html> y los guarda.
export function AjustesProvider({ children }: { children: ReactNode }) {
  const [guardados, setGuardados] = useState<Ajustes>(() => cargarAjustes())
  const [vista, setVista] = useState<Ajustes | null>(null)
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

  const value = useMemo(() => ({ ajustes, setAjustes }), [ajustes, setAjustes])
  return <AjustesContext.Provider value={value}>{children}</AjustesContext.Provider>
}
