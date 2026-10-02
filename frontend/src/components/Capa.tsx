import { useContext, type ReactNode } from 'react'
import { CapasContext } from '../context/capasContext'

/// UX-9 (hito 0.2) — envoltorio de cada overlay de la partida. Si la capa espera detrás de otra más
/// importante, se oculta con `hidden` pero sigue montada (no pierde lo que tenía a medias) y vuelve
/// al cerrarse la de arriba. Una capa hija (la ficha de detalle) va siempre por encima.
export function Capa({ id, hija = false, children }: { id: string; hija?: boolean; children: ReactNode }) {
  const estado = useContext(CapasContext)
  const visible = !estado || estado.visibles.has(id)
  return (
    <div data-capa={id} hidden={!visible} className={hija ? 'relative z-[60]' : undefined}>
      {children}
    </div>
  )
}
