import { useEffect, useRef } from 'react'
import { ZonaPanel } from './panels/ZonaPanel'
import type { LogEntry } from '../types'

interface ZonaMovimientoModalProps {
  saveId: string
  onEncuentroZona?: (logEntry: LogEntry) => void
  onClose: () => void
}

/// Pieza 2 del rediseño de movimiento en Zona (2026-09-09, decisión explícita de Álvaro: "la opción
/// del modal es mejor, un botón que al darle abre el modal de zona para moverse, así la sección de
/// zona en Mapa solo sería para visualizar y no la utilizaríamos para movernos" — confirmado que
/// es una vista informativa por un lado, "por la que sí nos podemos mover" por el otro). Este modal
/// ES esa segunda vía — envuelve el mismo `ZonaPanel` de siempre con `soloConsulta={false}`
/// (movimiento activo), a pantalla casi completa (`max-w-4xl`, más grande que el resto de modales
/// de la app a propósito: Álvaro señaló que la zona "si se pone en pequeño... no se vería mucho").
/// Se abre desde el icono de brújula flotante (GameView.tsx) — decisión explícita de Álvaro de no
/// usar el header de "Tu personaje" ("me parece poco intuitivo").
export function ZonaMovimientoModal({ saveId, onEncuentroZona, onClose }: ZonaMovimientoModalProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    rootRef.current?.focus()
  }, [])

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 outline-none"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div className="plank-panel animate-combat-enter relative flex max-h-[90vh] w-full max-w-4xl flex-col gap-3 overflow-hidden rounded-xl p-5">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <p className="font-serif text-sm tracking-wide text-accent2-300">🧭 Moverte por la zona</p>
          <button
            type="button"
            onClick={onClose}
            className="tactile shrink-0 rounded-md border border-iron-700 px-2.5 py-1 text-2xs font-semibold text-wood-500 transition-colors hover:border-danger-600/60 hover:text-danger-300"
          >
            Cerrar
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ZonaPanel saveId={saveId} onEncuentroZona={onEncuentroZona} soloConsulta={false} />
        </div>
      </div>
    </div>
  )
}
