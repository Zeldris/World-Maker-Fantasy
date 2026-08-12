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
  disabled,
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
  /// Receta/habilidad ya desbloqueada pero que no se puede usar AHORA MISMO (2026-08-13: faltan
  /// materiales, atributos o la ubicación correcta — el propio `tooltip` explica qué falta, ej.
  /// "Necesita: 3/5 de piedra"). El click principal queda inerte; `onDetail` sigue funcionando.
  disabled?: boolean
}) {
  return (
    <div className="group relative">
      <TooltipAnchor text={tooltip} className="block">
        <button
          onClick={disabled ? undefined : onUse}
          disabled={!!disabled}
          className={`tactile flex w-full flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center transition-colors ${
            disabled
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
