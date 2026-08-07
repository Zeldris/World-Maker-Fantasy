import type { ReactNode } from 'react'
import { TooltipAnchor } from './TooltipAnchor'

/// Deduplicado (auditoría 2026-07-22): InventarioPanel.tsx y HabilidadesPanel.tsx repetían la
/// misma tarjeta de icono al carácter (tooltip + botón de usar + botón "ⓘ" de detalle solo
/// visible al pasar el ratón), con solo el badge/chip extra cambiando entre uno y otro. El
/// `EntryCard` de EnciclopediaPanel.tsx queda fuera a propósito: su acción principal es "ver
/// detalle" (no "usar") y su atajo es Shift+clic en vez de un botón "ⓘ" — comportamiento
/// genuinamente distinto, no la misma tarjeta con otro nombre.
export function IconCard({
  icon,
  name,
  tooltip,
  onUse,
  onDetail,
  badge,
  extra,
  locked,
}: {
  icon: string
  name: string
  tooltip: string
  onUse: () => void
  onDetail: () => void
  /// Insignia pequeña en la esquina superior izquierda (p. ej. la "E" de equipado en Inventario).
  badge?: ReactNode
  /// Contenido extra bajo el nombre, dentro del propio botón (p. ej. el chip de bonificador).
  extra?: ReactNode
  /// Receta/habilidad que SÍ conoces pero no alcanzas todavía por nivel de oficio (rediseño de
  /// profesiones, 2026-08-07 — distinto del "???" de EntryCard en la Enciclopedia, que oculta la
  /// identidad de algo no descubierto: aquí ya sabes qué es, el tooltip explica qué falta). El
  /// click principal queda inerte; `onDetail` (la ficha) sigue funcionando igual.
  locked?: { reason: string }
}) {
  return (
    <div className="group relative">
      <TooltipAnchor text={locked ? locked.reason : tooltip} className="block">
        <button
          onClick={locked ? undefined : onUse}
          disabled={!!locked}
          className={`tactile flex w-full flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center transition-colors ${
            locked
              ? 'cursor-not-allowed border-iron-800 bg-wood-950/20 opacity-60'
              : 'border-iron-700 bg-wood-950/40 hover:border-accent-600/60 hover:bg-accent-500/10'
          }`}
        >
          <span className="text-2xl leading-none">{icon}</span>
          <span className="text-2xs leading-tight text-wood-200">{name}</span>
          {extra}
        </button>
      </TooltipAnchor>
      {badge}
      <button
        onClick={onDetail}
        aria-label={`Detalle de ${name}`}
        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-iron-700 bg-wood-950 text-2xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 sm:hidden sm:group-hover:flex"
      >
        ⓘ
      </button>
    </div>
  )
}
