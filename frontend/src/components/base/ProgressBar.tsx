import { useEffect, useRef, useState } from 'react'

// BAS-8 (hito 0.2) — barra de progreso con «barra fantasma»: cuando el valor baja, la parte perdida
// se queda un momento en tono claro y luego se recoge, para que se vea cuánto se ha perdido (como
// en los juegos). Sin animaciones si el jugador las ha quitado (lo resuelve el CSS de data-motion).

export const MS_FANTASMA = 700

interface ProgressBarProps {
  /// 0–100.
  pct: number
  /// Clase de color de la barra (p. ej. 'bg-moss-500').
  color: string
  etiqueta: string
  alto?: 'fino' | 'normal'
}

export function ProgressBar({ pct, color, etiqueta, alto = 'normal' }: ProgressBarProps) {
  const valor = Math.max(0, Math.min(100, pct))
  const [fantasma, setFantasma] = useState(valor)
  const previo = useRef(valor)

  useEffect(() => {
    if (valor < previo.current) {
      // Baja: el fantasma se queda en el valor anterior y se recoge tras un momento.
      const t = setTimeout(() => setFantasma(valor), MS_FANTASMA)
      previo.current = valor
      return () => clearTimeout(t)
    }
    previo.current = valor
    setFantasma(valor)
  }, [valor])

  return (
    <div
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(valor)}
      className={`relative w-full overflow-hidden rounded-full bg-iron-800 ${alto === 'fino' ? 'h-1.5' : 'h-2'}`}
    >
      <div data-fantasma className="absolute inset-y-0 left-0 rounded-full bg-wood-200/40 transition-[width] duration-500" style={{ width: `${Math.max(fantasma, valor)}%` }} />
      <div className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ${color}`} style={{ width: `${valor}%` }} />
    </div>
  )
}
