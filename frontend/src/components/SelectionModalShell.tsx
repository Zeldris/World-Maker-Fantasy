import type { ReactNode } from 'react'
import { ModalShell } from './ModalShell'

interface SelectionModalShellProps {
  title: string
  onCancel: () => void
  cancelDisabled?: boolean
  cancelLabel?: string
  children: ReactNode
  footer?: ReactNode
  disableOverlayClose?: boolean
}

/// Cascarón visual compartido de los modales de selección (auditoría de deuda técnica 2026-08-18:
/// vivía duplicado byte a byte en 11 componentes). El cuerpo varía demasiado entre modales como
/// para compartirlo: cada uno escribe el suyo como `children`.
/// Modal de selección de siempre (Recolectar, Curar, Comer, Entregar…). Desde MOD-1 (hito 0.2) es
/// una envoltura de `ModalShell` tamaño `md`: hereda el pie fijo, la ✕, el foco devuelto al cerrar
/// y `aria-labelledby`, con la misma API para no tocar a quien lo usa.
export function SelectionModalShell({ title, onCancel, cancelDisabled, cancelLabel = 'Cancelar', children, footer, disableOverlayClose = false }: SelectionModalShellProps) {
  return (
    <ModalShell
      title={title}
      onClose={onCancel}
      closeDisabled={cancelDisabled}
      disableOverlayClose={disableOverlayClose}
      // «Cancelar» ya está en el pie: sin ✕ duplicada.
      sinCerrar
      footer={
        <>
          <button type="button"
            onClick={onCancel}
            disabled={cancelDisabled}
            className="tactile flex-1 rounded-lg border border-iron-700 bg-wood-950/50 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          {footer}
        </>
      }
    >
      {children}
    </ModalShell>
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
