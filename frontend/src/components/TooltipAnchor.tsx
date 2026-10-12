import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipAnchorProps {
  text?: string
  /// Segunda línea opcional, con menos énfasis que `text` (2026-08-29, feedback en vivo sobre la
  /// barra de habilidades: "al poner el ratón encima tiene que salir nombre y descripción") — sin
  /// esto, un tooltip de "nombre + descripción" solo tenía una forma de componerse: texto corrido
  /// con un separador a mano (`${nombre} — ${descripcion}`), sin jerarquía visual entre ambos.
  subtext?: string
  children: ReactNode
  className?: string
}

// Generaliza el tooltip estilizado que nació en ChatComposer (chip inline con `.chip-tooltip`,
// ver index.css) a cualquier icono de la app — sustituye el `title` nativo del navegador (sin
// estilo, con el delay del SO) allá donde haya una descripción que mostrar al pasar el ratón.
//
// Portal a `document.body` (bug real 2026-07-21: los paneles del cajón viven dentro de
// `PanelDrawer.tsx`, que tiene `overflow-y-auto` — cualquier tooltip posicionado con CSS puro
// dentro de ese contenedor se recorta en cuanto intenta salir por el borde superior, exactamente
// lo que le pasaba a la primera fila de cualquier cuadrícula). Renderizarlo fuera del árbol, con
// posición calculada del propio ancla, escapa de cualquier `overflow`/contexto de apilamiento de
// un ancestro — no es solo cuestión de z-index.
// Ancho máximo real de `.tooltip-portal` (index.css) — usado aquí para decidir si centrar el
// tooltip sobre el ancla se saldría de la ventana por alguno de los dos lados.
const TOOLTIP_MAX_WIDTH = 240
const VIEWPORT_MARGIN = 8

/// El aviso abierto ahora mismo (P72): nunca hay dos a la vez. `id` es estable por instancia.
let abierto: { id: object; ocultar: () => void } | null = null

export function TooltipAnchor({ text, subtext, children, className = '' }: TooltipAnchorProps) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const idRef = useRef({})
  // Al desmontarse, no deja su cierre colgado en `abierto`.
  useEffect(() => () => {
    if (abierto?.id === idRef.current) abierto = null
  }, [])
  // Bug real jugando en vivo (2026-08-29, feedback sobre la barra de habilidades — icono muy
  // pegado al borde izquierdo de la ventana): centrar SIEMPRE el tooltip sobre el ancla
  // (`left: 50%` + `translateX(-50%)`) lo cortaba contra el borde de la ventana en cuanto el
  // ancla estaba a menos de media anchura del tooltip de cualquiera de los dos lados — no era
  // solo un problema de overflow de un contenedor padre (para eso ya existía el portal), sino del
  // propio viewport. `align` decide si el tooltip se centra sobre el ancla (caso normal) o se
  // ancla a su izquierda/derecha (`left`/`right` del ancla, sin centrar) cuando no cabe centrado.
  const [pos, setPos] = useState<{ top: number; left: number; align: 'center' | 'left' | 'right' } | null>(null)

  function show() {
    const el = anchorRef.current
    if (!el) return
    // P72 (QA-27): un hueco pulsado conserva el foco y su aviso seguía abierto mientras el ratón
    // pasaba por otro. Solo hay un aviso abierto a la vez: abrir uno cierra el anterior.
    if (abierto && abierto.id !== idRef.current) abierto.ocultar()
    abierto = { id: idRef.current, ocultar: () => setPos(null) }
    const rect = el.getBoundingClientRect()
    const center = rect.left + rect.width / 2
    const halfTooltip = TOOLTIP_MAX_WIDTH / 2
    const align = center - halfTooltip < VIEWPORT_MARGIN ? 'left' : center + halfTooltip > window.innerWidth - VIEWPORT_MARGIN ? 'right' : 'center'
    const left = align === 'left' ? rect.left : align === 'right' ? rect.right : center
    setPos({ top: rect.top, left, align })
  }
  function hide() {
    setPos(null)
    if (abierto?.id === idRef.current) abierto = null
  }

  return (
    <span
      ref={anchorRef}
      className={`tooltip-anchor relative ${className}`}
      tabIndex={text ? 0 : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {text &&
        pos &&
        createPortal(
          <span className={`tooltip-portal tooltip-portal-${pos.align}`} style={{ top: pos.top, left: pos.left }}>
            <span className="tooltip-portal-title">{text}</span>
            {subtext && <span className="tooltip-portal-subtext">{subtext}</span>}
          </span>,
          document.body,
        )}
    </span>
  )
}
