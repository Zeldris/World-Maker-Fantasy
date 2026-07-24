import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipAnchorProps {
  text?: string
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
export function TooltipAnchor({ text, children, className = '' }: TooltipAnchorProps) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  function show() {
    const el = anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({ top: rect.top, left: rect.left + rect.width / 2 })
  }
  function hide() {
    setPos(null)
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
          <span className="tooltip-portal" style={{ top: pos.top, left: pos.left }}>
            {text}
          </span>,
          document.body,
        )}
    </span>
  )
}
