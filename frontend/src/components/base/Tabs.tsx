import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'

// BAS-8 (hito 0.2) — pestañas con indicador deslizante bajo la activa (patrón WAI-ARIA tablist:
// flechas izquierda/derecha cambian de pestaña, Inicio/Fin a la primera/última).

export interface Pestana<T extends string> {
  id: T
  label: string
  icono?: string
}

export function Tabs<T extends string>({ pestanas, activa, onChange, etiqueta }: { pestanas: Pestana<T>[]; activa: T; onChange: (id: T) => void; etiqueta: string }) {
  const refs = useRef(new Map<T, HTMLButtonElement>())
  const [indicador, setIndicador] = useState<{ left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const el = refs.current.get(activa)
    if (el) setIndicador({ left: el.offsetLeft, width: el.offsetWidth })
  }, [activa, pestanas])

  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = pestanas.findIndex((p) => p.id === activa)
    const destino =
      e.key === 'ArrowRight' ? Math.min(pestanas.length - 1, i + 1) : e.key === 'ArrowLeft' ? Math.max(0, i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? pestanas.length - 1 : -1
    if (destino === -1) return
    e.preventDefault()
    onChange(pestanas[destino].id)
    refs.current.get(pestanas[destino].id)?.focus()
  }

  return (
    <div role="tablist" aria-label={etiqueta} onKeyDown={teclas} className="relative flex gap-1 border-b border-iron-800">
      {pestanas.map((p) => (
        <button
          key={p.id}
          ref={(el) => {
            if (el) refs.current.set(p.id, el)
            else refs.current.delete(p.id)
          }}
          type="button"
          role="tab"
          aria-selected={p.id === activa}
          tabIndex={p.id === activa ? 0 : -1}
          onClick={() => onChange(p.id)}
          className={`tactile px-3 py-1.5 text-xs transition-colors ${p.id === activa ? 'text-accent-200' : 'text-wood-400 hover:text-wood-200'}`}
        >
          {p.icono && <span aria-hidden="true" className="mr-1.5">{p.icono}</span>}
          {p.label}
        </button>
      ))}
      {indicador && (
        <span
          aria-hidden="true"
          data-indicador
          className="absolute -bottom-px h-0.5 rounded-full bg-accent-400 transition-[left,width] duration-300"
          style={{ left: indicador.left, width: indicador.width }}
        />
      )}
    </div>
  )
}
