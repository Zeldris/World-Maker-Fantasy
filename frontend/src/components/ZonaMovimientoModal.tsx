import { useEffect, useRef } from 'react'
import { ZonaPanel } from './panels/ZonaPanel'
import type { LogEntry, ProfessionRecipeInfo } from '../types'

interface ZonaMovimientoModalProps {
  saveId: string
  onEncuentroZona?: (logEntry: LogEntry) => void
  onClose: () => void
  /// Icono de salida de región (2026-09-17) — pasado tal cual a `ZonaPanel`, ver comentario ahí.
  onViajarA?: (actionText: string) => void
  /// Icono de parcela (§ 7.4, 2026-09-21) — pasados tal cual a `ZonaPanel`, ver comentario ahí.
  professionRecipes?: ProfessionRecipeInfo[]
  onRefreshSave?: () => Promise<void>
  /// Pasado tal cual a `ZonaPanel`, ver comentario ahí.
  onOfertaDescartada?: () => void
  /// Cadáveres en el mapa (Fase 5, 2026-09-28) — ver `ZonaPanel`.
  onSaquearCadaver?: (npcSlug: string) => void
  onDesollarCadaver?: (npcSlug: string) => void
}

/// Pieza 2 del rediseño de movimiento en Zona (2026-09-09, decisión explícita de Álvaro: "la opción
/// del modal es mejor, un botón que al darle abre el modal de zona para moverse, así la sección de
/// zona en Mapa solo sería para visualizar y no la utilizaríamos para movernos" — confirmado que
/// es una vista informativa por un lado, "por la que sí nos podemos mover" por el otro). Este modal
/// ES esa segunda vía — envuelve el mismo `ZonaPanel` de siempre con `soloConsulta={false}`
/// (movimiento activo), a pantalla casi completa (`max-w-[90rem]`, más grande que el resto de
/// modales de la app a propósito: Álvaro señaló que la zona "si se pone en pequeño... no se vería
/// mucho"; ampliado dos veces el mismo día tras el layout de 2 columnas — primero `max-w-4xl`→
/// `max-w-6xl` ("aprovecha el ancho, que no quede tan pequeño"), luego →`max-w-[90rem]` al pasar el
/// reparto de columnas de 80/20 a 70/30 ("para dar más margen al texto")). Se abre desde el icono
/// de brújula flotante (GameView.tsx) — decisión explícita de Álvaro de no usar el header de "Tu
/// personaje" ("me parece poco intuitivo"). `columnasAncho` (ZonaPanel.tsx) pone el mapa a la
/// izquierda (70%) y el resto del contenido a la derecha (30%) con su propio scroll — petición
/// explícita de Álvaro: "aprovechemos el espacio horizontal... así no teniendo que scrollear",
/// aplicado SOLO aquí, no en el tab Mapa informativo.
export function ZonaMovimientoModal({ saveId, onEncuentroZona, onClose, onViajarA, professionRecipes, onRefreshSave, onOfertaDescartada, onSaquearCadaver, onDesollarCadaver }: ZonaMovimientoModalProps) {
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
      <div className="plank-panel animate-combat-enter relative flex h-[90vh] w-full max-w-[90rem] flex-col gap-3 overflow-hidden rounded-xl p-5">
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
        <div className="min-h-0 flex-1 overflow-hidden">
          <ZonaPanel
            saveId={saveId}
            onEncuentroZona={onEncuentroZona}
            soloConsulta={false}
            columnasAncho
            onClose={onClose}
            onViajarA={onViajarA}
            professionRecipes={professionRecipes}
            onRefreshSave={onRefreshSave}
            onOfertaDescartada={onOfertaDescartada}
            onSaquearCadaver={onSaquearCadaver}
            onDesollarCadaver={onDesollarCadaver}
          />
        </div>
      </div>
    </div>
  )
}
