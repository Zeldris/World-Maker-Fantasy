import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

// MOD-4 (hito 0.2, roadmap-front.md § 5) — confirmar lo irreversible manteniendo pulsado (ratón,
// toque, Espacio o Enter) en vez del doble clic «Aceptar → Confirmar». El relleno avanza mientras
// se mantiene; soltar antes de tiempo lo cancela.

export const MS_MANTENER = 1000

interface BotonMantenerProps {
  /// Texto del botón («Mantén para elegir Guerrero»).
  children: string
  onConfirmar: () => void
  disabled?: boolean
  ms?: number
}

export function BotonMantener({ children, onConfirmar, disabled = false, ms = MS_MANTENER }: BotonMantenerProps) {
  const [inicio, setInicio] = useState<number | null>(null)
  const [progreso, setProgreso] = useState(0)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animacion = useRef<number | null>(null)

  const parar = () => {
    if (temporizador.current) clearTimeout(temporizador.current)
    if (animacion.current) cancelAnimationFrame(animacion.current)
    temporizador.current = null
    animacion.current = null
    setInicio(null)
    setProgreso(0)
  }

  const empezar = () => {
    if (disabled || inicio !== null) return
    const t0 = performance.now()
    setInicio(t0)
    temporizador.current = setTimeout(() => {
      parar()
      onConfirmar()
    }, ms)
    const pintar = () => {
      setProgreso(Math.min(1, (performance.now() - t0) / ms))
      animacion.current = requestAnimationFrame(pintar)
    }
    animacion.current = requestAnimationFrame(pintar)
  }

  useEffect(() => parar, [])
  useEffect(() => {
    if (disabled) parar()
  }, [disabled])

  const teclaAbajo = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== ' ' && e.key !== 'Enter') return
    e.preventDefault()
    if (!e.repeat) empezar()
  }
  const teclaArriba = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') parar()
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={empezar}
      onPointerUp={parar}
      onPointerLeave={parar}
      onPointerCancel={parar}
      onKeyDown={teclaAbajo}
      onKeyUp={teclaArriba}
      aria-description="Mantén pulsado para confirmar"
      className="tactile relative flex-1 overflow-hidden rounded-lg border border-accent-600 bg-wood-950/60 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-accent-200 transition-colors select-none disabled:cursor-not-allowed disabled:border-iron-700 disabled:text-wood-500"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent-500/70 to-accent-400/70"
        style={{ width: `${progreso * 100}%` }}
      />
      <span className="relative">{children}</span>
    </button>
  )
}
