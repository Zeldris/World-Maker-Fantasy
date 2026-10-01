import { SelectionModalShell, confirmButtonClasses } from './SelectionModalShell'

interface ConfirmModalProps {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  /// 'danger' para acciones irreversibles (borrar), 'accent' para el resto (reiniciar sigue siendo
  /// destructivo de progreso pero no de la fila en sí — se deja a criterio del caller).
  tone?: 'accent' | 'danger'
  confirming?: boolean
  /// UX-24 (hito 0.1) — fallo del intento anterior: se muestra bajo el mensaje y el botón de
  /// confirmar pasa a decir *Reintentar* (el modal sigue abierto con todo su contexto).
  error?: string | null
}

/// Confirmación de acciones irreversibles con el estilo de la app, en vez de `window.confirm`
/// (feedback en vivo, 2026-09-04: "que salga nuestro propio modal en vez de esto" — el diálogo
/// nativo del navegador desentona con el resto de la UI). Mismo cascarón que los 11 modales de
/// selección (`SelectionModalShell`), solo con un mensaje de texto como cuerpo — reutiliza
/// `confirmButtonClasses('danger')`, ya existente para este caso pero sin ningún consumidor hasta
/// ahora.
export function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel, tone = 'danger', confirming = false, error = null }: ConfirmModalProps) {
  return (
    <SelectionModalShell
      title={title}
      onCancel={onCancel}
      cancelDisabled={confirming}
      footer={
        <button type="button" onClick={onConfirm} disabled={confirming} className={confirmButtonClasses(tone)}>
          {confirming ? 'Un momento...' : error ? 'Reintentar' : confirmLabel}
        </button>
      }
    >
      <p className="text-sm leading-relaxed text-wood-300">{message}</p>
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger-300">
          <span aria-hidden="true">⚠️ </span>
          {error}
        </p>
      )}
    </SelectionModalShell>
  )
}
