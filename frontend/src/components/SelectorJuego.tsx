import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

/// REI-113 (hito 0.1, roadmap-front-reino.md R23) — selector con la estética del juego en lugar del
/// `<select>` nativo (que se pinta con el estilo del sistema operativo). Patrón de botón + lista
/// emergente accesible: `aria-haspopup="listbox"`, opciones con `role="option"`, flechas/Inicio/Fin
/// para moverse, `Enter`/espacio para elegir, `Esc` o clic fuera para cerrar, y el foco vuelve al
/// botón al cerrar.
export interface OpcionSelector<T extends string> {
  value: T
  label: string
  /// Segunda línea opcional dentro de la lista (no en el botón).
  descripcion?: string
}

interface SelectorJuegoProps<T extends string> {
  value: T
  opciones: OpcionSelector<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  disabled?: boolean
  /// Tooltip del botón (p. ej. el motivo de que esté deshabilitado).
  title?: string
  /// Clases extra para el botón (ancho, tamaño de letra…).
  className?: string
}

export function SelectorJuego<T extends string>({ value, opciones, onChange, ariaLabel, disabled, title, className }: SelectorJuegoProps<T>) {
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(0)
  const raizRef = useRef<HTMLDivElement>(null)
  const botonRef = useRef<HTMLButtonElement>(null)
  const listaRef = useRef<HTMLUListElement>(null)
  const idLista = useId()
  const seleccionada = opciones.find((o) => o.value === value)

  useEffect(() => {
    if (!abierto) return
    const alPulsarFuera = (e: MouseEvent) => {
      if (raizRef.current && !raizRef.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', alPulsarFuera)
    listaRef.current?.focus()
    return () => document.removeEventListener('mousedown', alPulsarFuera)
  }, [abierto])

  function abrir() {
    if (disabled) return
    setActivo(Math.max(0, opciones.findIndex((o) => o.value === value)))
    setAbierto(true)
  }

  function cerrar() {
    setAbierto(false)
    botonRef.current?.focus()
  }

  function elegir(i: number) {
    const opcion = opciones[i]
    if (opcion && opcion.value !== value) onChange(opcion.value)
    cerrar()
  }

  function onKeyDownBoton(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      abrir()
    }
  }

  function onKeyDownLista(e: KeyboardEvent<HTMLUListElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActivo((i) => Math.min(opciones.length - 1, i + 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActivo((i) => Math.max(0, i - 1))
        break
      case 'Home':
        e.preventDefault()
        setActivo(0)
        break
      case 'End':
        e.preventDefault()
        setActivo(opciones.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        elegir(activo)
        break
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        cerrar()
        break
      case 'Tab':
        setAbierto(false)
        break
    }
  }

  return (
    <div ref={raizRef} className="relative inline-block">
      <button
        ref={botonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? idLista : undefined}
        disabled={disabled}
        title={title}
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={onKeyDownBoton}
        className={`tactile flex w-full items-center justify-between gap-2 rounded-lg border border-iron-700 bg-wood-950/60 px-2 py-1 text-left text-2xs text-wood-200 transition-colors hover:border-accent-600/60 disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ''}`}
      >
        <span className="truncate">{seleccionada?.label ?? '—'}</span>
        <span aria-hidden="true" className={`text-wood-500 transition-transform ${abierto ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>
      {abierto && (
        <ul
          ref={listaRef}
          id={idLista}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          aria-activedescendant={`${idLista}-${activo}`}
          onKeyDown={onKeyDownLista}
          className="absolute left-0 z-30 mt-1 max-h-60 min-w-full overflow-y-auto rounded-lg border border-iron-600 bg-wood-900 py-1 shadow-xl focus:outline-none"
        >
          {opciones.map((o, i) => (
            <li
              key={o.value}
              id={`${idLista}-${i}`}
              role="option"
              aria-selected={o.value === value}
              onMouseEnter={() => setActivo(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(i)}
              className={`cursor-pointer px-2.5 py-1.5 text-2xs ${i === activo ? 'bg-accent-500/15 text-accent-200' : 'text-wood-300'} ${o.value === value ? 'font-semibold' : ''}`}
            >
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="w-3 text-accent-400">{o.value === value ? '✓' : ''}</span>
                {o.label}
              </span>
              {o.descripcion && <span className="block pl-4.5 text-wood-500">{o.descripcion}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
