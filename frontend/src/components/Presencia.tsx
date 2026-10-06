import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

/// BAS-7 (hito 0.2): animación de salida de una capa que se desmonta desde fuera
/// (`{abierto && <Capa>…</Capa>}`). Al cerrarse, `Presencia` sigue pintando lo último que mostró
/// durante `ms` con `SaliendoContext` a true (`Capa` lo desvanece y `ModalShell` encoge su panel);
/// luego lo desmonta. Solo con «Animaciones: completas» (`data-motion`, CFG-14); si no, cierra en seco.
export const SaliendoContext = createContext(false)

export function useSaliendo(): boolean {
  return useContext(SaliendoContext)
}

export const MS_SALIDA_CAPA = 220

const conAnimaciones = () => typeof document !== 'undefined' && document.documentElement.dataset.motion === 'completas'

export function Presencia({ children, ms = MS_SALIDA_CAPA }: { children: ReactNode; ms?: number }) {
  const presente = children !== null && children !== undefined && children !== false && children !== ''
  const ultimo = useRef<ReactNode>(null)
  const [saliendo, setSaliendo] = useState(false)
  const [estabaPresente, setEstabaPresente] = useState(presente)
  if (estabaPresente !== presente) {
    setEstabaPresente(presente)
    setSaliendo(!presente && ultimo.current !== null && conAnimaciones())
  }
  useEffect(() => {
    if (presente) ultimo.current = children
  })
  useEffect(() => {
    if (!saliendo) return
    const t = setTimeout(() => setSaliendo(false), ms)
    return () => clearTimeout(t)
  }, [saliendo, ms])

  if (presente) return <SaliendoContext.Provider value={false}>{children}</SaliendoContext.Provider>
  if (saliendo) return <SaliendoContext.Provider value={true}>{ultimo.current}</SaliendoContext.Provider>
  return null
}
