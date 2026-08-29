import type { ReactNode } from 'react'

interface SelectionModalShellProps {
  title: string
  onCancel: () => void
  /// Deshabilita el propio botón Cancelar (p. ej. mientras `confirming`) — la mayoría de modales de
  /// solo listado (Campamento/Viajar) no lo necesitan, se queda `false` por defecto.
  cancelDisabled?: boolean
  children: ReactNode
  /// Contenido del pie DESPUÉS de Cancelar, normalmente un único botón de confirmar — se omite del
  /// todo en los modales donde cada fila dispara la acción directamente (Volver al campamento,
  /// Viajar), que solo necesitan Cancelar.
  footer?: ReactNode
}

/// Cascarón visual compartido de los modales de selección (overlay + plank-panel + título +
/// Cancelar) — extraído (auditoría de deuda técnica 2026-08-18) tras confirmarse que este bloque
/// vivía duplicado byte-a-byte en 11 componentes distintos. El cuerpo (lista de candidatos, estados
/// de carga/error/vacío) varía demasiado entre modales como para compartirlo también aquí — cada
/// uno sigue escribiendo el suyo como `children`.
export function SelectionModalShell({ title, onCancel, cancelDisabled, children, footer }: SelectionModalShellProps) {
  return (
    <div className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onCancel}>
      <div
        className="plank-panel animate-combat-enter relative flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-lg text-wood-100">{title}</h3>
        {children}
        <div className="flex gap-2">
          <button type="button"
            onClick={onCancel}
            disabled={cancelDisabled}
            className="tactile flex-1 rounded-lg border border-iron-700 bg-wood-950/50 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          {footer}
        </div>
      </div>
    </div>
  )
}

/// Clases del botón de confirmar con degradado — mismo criterio de tono que ya usaba
/// CombatSelectionModal.tsx (`tone`): accent para acciones neutras, danger para irreversibles.
/// Compartido para no repetir la misma tira larga de clases en cada modal de confirmar.
export function confirmButtonClasses(tone: 'accent' | 'danger' = 'accent'): string {
  const toneClasses =
    tone === 'danger'
      ? 'border-danger-600 bg-danger-600/20 text-danger-300 hover:bg-danger-600/35'
      : 'border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 text-wood-950'
  return `tactile flex-1 rounded-lg border px-3.5 py-2 text-xs font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:border-iron-700 disabled:from-wood-700 disabled:to-wood-700 disabled:text-wood-500 ${toneClasses}`
}
