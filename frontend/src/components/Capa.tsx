import { useContext, type ReactNode } from 'react'
import { CapasContext } from '../context/capasContext'
import { useSaliendo } from './Presencia'

/// UX-9 (hito 0.2) — envoltorio de cada overlay de la partida. Si la capa espera detrás de otra más
/// importante, se oculta con `hidden` pero sigue montada (no pierde lo que tenía a medias) y vuelve
/// al cerrarse la de arriba. Una capa hija (la ficha de detalle) va siempre por encima.
export function Capa({ id, hija = false, children }: { id: string; hija?: boolean; children: ReactNode }) {
  const estado = useContext(CapasContext)
  // BAS-7: al cerrarse ya no está en el gestor de capas, pero se ve mientras sale (`Presencia`).
  const saliendo = useSaliendo()
  const visible = saliendo || !estado || estado.visibles.has(id)
  const clases = [hija ? 'relative z-[60]' : '', saliendo ? 'animate-overlay-out pointer-events-none' : ''].filter(Boolean).join(' ')
  return (
    <div data-capa={id} hidden={!visible} aria-hidden={saliendo || undefined} className={clases || undefined}>
      {children}
    </div>
  )
}
