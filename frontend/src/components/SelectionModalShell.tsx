import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'

interface SelectionModalShellProps {
  title: string
  onCancel: () => void
  /// Deshabilita el propio botón Cancelar (p. ej. mientras `confirming`) — la mayoría de modales de
  /// solo listado (Campamento/Viajar) no lo necesitan, se queda `false` por defecto.
  cancelDisabled?: boolean
  /// Texto del botón de salida (B4, 2026-09-28) — "Cerrar" en modales puramente informativos.
  cancelLabel?: string
  children: ReactNode
  /// Contenido del pie DESPUÉS de Cancelar, normalmente un único botón de confirmar — se omite del
  /// todo en los modales donde cada fila dispara la acción directamente (Volver al campamento,
  /// Viajar), que solo necesitan Cancelar.
  footer?: ReactNode
  /// Desactiva el cierre al clicar fuera del panel (feedback en vivo, 2026-09-04: editor de barras
  /// de habilidades — con drag&drop y un input de texto en marcha, un clic fuera accidental no debe
  /// tirar la edición en curso, solo el botón Cancelar/Guardar explícito). `false` por defecto —
  /// el resto de modales de solo listado siguen cerrando al clicar fuera, como siempre.
  disableOverlayClose?: boolean
}

/// Selector de elementos enfocables reales dentro del panel — mismo criterio mínimo de siempre para
/// atrapar el foco a mano (sin librería): todo lo que normalmente recibe Tab, excluyendo lo
/// deshabilitado (`disabled`) o sacado explícitamente del tab order (`tabIndex="-1"`, como el propio
/// contenedor scrollable de abajo).
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/// Cascarón visual compartido de los modales de selección (overlay + plank-panel + título +
/// Cancelar) — extraído (auditoría de deuda técnica 2026-08-18) tras confirmarse que este bloque
/// vivía duplicado byte-a-byte en 11 componentes distintos. El cuerpo (lista de candidatos, estados
/// de carga/error/vacío) varía demasiado entre modales como para compartirlo también aquí — cada
/// uno sigue escribiendo el suyo como `children`.
export function SelectionModalShell({ title, onCancel, cancelDisabled, cancelLabel = 'Cancelar', children, footer, disableOverlayClose = false }: SelectionModalShellProps) {
  // Foco al abrirse (2026-08-31, "revisa bien todos los casos del foco/scroll") — cascarón
  // compartido por los 11 modales de selección (Cazar/Recolectar/Curar/Entregar/Saquear/campamento-
  // viaje/etc.), ninguno tenía nada que llevara el foco dentro del modal al abrirse. El contenedor
  // scrollable recibe el foco (tabIndex -1, fuera del tab order normal) en vez de adivinar cuál es
  // el primer campo interactivo de cada uno — varía demasiado entre modales (checkbox, lista,
  // formulario) para un criterio único más específico.
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Accesibilidad básica de modal (auditoría de frontend 2026-09-07, decisión confirmada con la
  // usuaria: empezar por este cascarón — cubre 11 de los ~18 modales del proyecto). Antes ningún
  // modal anunciaba su rol a un lector de pantalla, no cerraba con Escape, y Tab podía "escapar"
  // hacia botones de la página de detrás, tapados visualmente por el overlay pero todavía
  // interactivos. Un único `onKeyDown` en el panel cubre ambos: Escape llama a `onCancel` (salvo
  // `cancelDisabled`, mismo criterio que ya respeta el propio botón Cancelar); Tab/Shift+Tab en el
  // primer/último elemento enfocable envuelve al otro extremo, sin salir nunca del panel.
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      if (cancelDisabled) return
      e.stopPropagation()
      onCancel()
      return
    }
    if (e.key !== 'Tab') return
    const panel = e.currentTarget
    // `offsetParent !== null` (el criterio habitual de "visible") no sirve aquí: jsdom no calcula
    // layout real y lo deja siempre en null, así que el atrapado de foco no se podría probar nunca
    // con @testing-library/react. Ningún modal de este cascarón oculta dinámicamente elementos
    // enfocables dentro del panel, así que basta con excluir lo marcado `hidden` explícitamente.
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => !el.closest('[hidden]'))
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={disableOverlayClose ? undefined : onCancel}
    >
      <div
        ref={scrollRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={handleKeyDown}
        className="plank-panel animate-combat-enter relative flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-xl p-5 outline-none"
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
            {cancelLabel}
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
