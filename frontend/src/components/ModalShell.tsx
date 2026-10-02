import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

// MOD-1 (hito 0.2, roadmap-front.md § 5) — cáscara única de modal. Evolución de
// SelectionModalShell: tamaños, cabecera con icono/subtítulo/✕, pie fijo (los botones no se van con
// el scroll del contenido), Escape, foco inicial, Tab atrapado, foco devuelto al elemento que lo
// abrió, `role="dialog"` y `aria-labelledby`.

export type TamanoModal = 'sm' | 'md' | 'lg' | 'xl' | 'ceremonia'

const ANCHO: Record<TamanoModal, string> = {
  sm: 'max-w-sm max-h-[85vh]',
  md: 'max-w-md max-h-[85vh]',
  lg: 'max-w-2xl max-h-[85vh]',
  xl: 'max-w-[90rem] h-[90vh]',
  ceremonia: 'max-w-3xl min-h-[60vh] max-h-[90vh]',
}

/// MOD-3 (hito 0.2) — teclado en modales: números 1-9 eligen la opción N entre las marcadas con
/// `data-opcion`, flechas arriba/abajo las recorren y Enter pulsa la marcada con `data-confirmar`
/// (si el foco no está ya en un botón ni en un área de texto). Al escribir en un campo de texto,
/// los números y las flechas son del campo. Devuelve true si ha gestionado la tecla.
function teclaDeModal(e: KeyboardEvent<HTMLDivElement>): boolean {
  const destino = e.target as HTMLElement
  const escribiendo = destino.closest('input, textarea, select, [contenteditable="true"]') !== null
  const opciones = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[data-opcion]:not(:disabled)'))
  if (!escribiendo && /^[1-9]$/.test(e.key)) {
    const opcion = opciones[Number(e.key) - 1]
    if (!opcion) return false
    e.preventDefault()
    opcion.click()
    return true
  }
  if (!escribiendo && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && opciones.length > 0) {
    const actual = opciones.indexOf(document.activeElement as HTMLButtonElement)
    const siguiente = actual === -1 ? 0 : Math.min(opciones.length - 1, Math.max(0, actual + (e.key === 'ArrowDown' ? 1 : -1)))
    e.preventDefault()
    opciones[siguiente].focus()
    return true
  }
  if (e.key === 'Enter' && !e.shiftKey && destino.tagName !== 'BUTTON' && destino.tagName !== 'TEXTAREA') {
    const confirmar = e.currentTarget.querySelector<HTMLButtonElement>('[data-confirmar]:not(:disabled)')
    if (!confirmar) return false
    e.preventDefault()
    confirmar.click()
    return true
  }
  return false
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface ModalShellProps {
  title: string
  subtitle?: string
  /// Icono o retrato a la izquierda del título.
  icon?: ReactNode
  tamano?: TamanoModal
  onClose: () => void
  /// Bloquea cerrar (Escape, ✕, clic fuera) mientras algo está en curso.
  closeDisabled?: boolean
  /// Sin ✕ en la cabecera (p. ej. si el pie ya tiene «Cancelar» y no se quiere duplicar).
  sinCerrar?: boolean
  /// El título solo para lectores de pantalla (la ficha pinta su propio encabezado con imagen).
  tituloOculto?: boolean
  /// El cuerpo no hace scroll propio (mapas que gestionan su desplazamiento).
  cuerpoSinScroll?: boolean
  /// Texto del botón de cerrar en vez de la ✕ (p. ej. «Salir» de una escena).
  etiquetaCerrar?: string
  disableOverlayClose?: boolean
  children: ReactNode
  /// Pie fijo: queda abajo aunque el contenido haga scroll.
  footer?: ReactNode
}

export function ModalShell({
  title,
  subtitle,
  icon,
  tamano = 'md',
  onClose,
  closeDisabled = false,
  sinCerrar = false,
  etiquetaCerrar,
  tituloOculto = false,
  cuerpoSinScroll = false,
  disableOverlayClose = false,
  children,
  footer,
}: ModalShellProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const tituloId = useId()

  // Foco inicial en el panel y, al cerrar, de vuelta al elemento que lo abrió (si sigue en la página).
  useEffect(() => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panelRef.current?.focus()
    return () => {
      if (previo && previo.isConnected) previo.focus()
    }
  }, [])

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (teclaDeModal(e)) return
    if (e.key === 'Escape') {
      if (closeDisabled) return
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const focusable = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => !el.closest('[hidden]'))
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
      onClick={disableOverlayClose || closeDisabled ? undefined : onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-label={title}
        onKeyDown={handleKeyDown}
        className={`plank-panel animate-combat-enter relative flex w-full flex-col rounded-xl outline-none ${ANCHO[tamano]}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start gap-3 px-5 pt-5">
          {icon && <div className="shrink-0 text-2xl leading-none">{icon}</div>}
          <div className="min-w-0 flex-1">
            <h3 id={tituloId} className={tituloOculto ? 'sr-only' : `font-serif text-wood-100 ${tamano === 'ceremonia' ? 'text-2xl tracking-wide' : 'text-lg'}`}>
              {title}
            </h3>
            {subtitle && !tituloOculto && <p className="mt-0.5 text-xs text-wood-500">{subtitle}</p>}
          </div>
          {!sinCerrar && (
            <button
              type="button"
              onClick={onClose}
              disabled={closeDisabled}
              aria-label={etiquetaCerrar ?? 'Cerrar'}
              className="tactile shrink-0 rounded-md border border-iron-700 px-2 py-0.5 text-xs text-wood-500 transition-colors hover:border-danger-600/60 hover:text-danger-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {etiquetaCerrar ?? '✕'}
            </button>
          )}
        </div>
        {/* MOD-4 — ceremonia: línea de cristal que se extiende bajo el título. */}
        {tamano === 'ceremonia' && <div aria-hidden="true" className="animate-line-extend mx-5 mt-3 h-px origin-left bg-accent-600/70" />}
        <div className={`flex min-h-0 flex-1 flex-col gap-4 px-5 py-4 ${cuerpoSinScroll ? 'overflow-hidden' : 'overflow-y-auto'}`}>{children}</div>
        {footer && <div className="flex shrink-0 gap-2 border-t border-iron-800/60 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}
