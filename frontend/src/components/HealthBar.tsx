import { useEffect, useRef, useState } from 'react'
import type { CondicionFisica } from '../types'
import { saludForCondicion, CONDICION_LABEL } from '../lib/health'

// Roadmap de diseño CSS (Fable, 2026-07-20): GRAVE/INCAPACITADO usan los tokens danger/cost —
// MUERTO se queda en red-950/800 de Tailwind a propósito (más oscuro que el propio token
// "danger", mismo criterio que iron-900/800/700 frente a accent-300..600: estructural, no acento).
const BAR_COLOR: Record<CondicionFisica, string> = {
  ILESO: 'from-moss-600 to-moss-400',
  HERIDO: 'from-moss-600 to-moss-400',
  GRAVE: 'from-cost-600 to-cost-400',
  INCAPACITADO: 'from-red-800 to-danger-500',
  MUERTO: 'from-red-950 to-red-800',
}

// Peor a mejor, de izquierda a derecha en severidad — para saber si un cambio es golpe o mejora.
const CONDICION_ORDER: CondicionFisica[] = ['ILESO', 'HERIDO', 'GRAVE', 'INCAPACITADO', 'MUERTO']

export function HealthBar({ condicionFisica }: { condicionFisica: CondicionFisica }) {
  const salud = saludForCondicion(condicionFisica)
  const prevRef = useRef(condicionFisica)
  const [flash, setFlash] = useState<'worse' | 'better' | null>(null)

  // Remonta con key={condicionFisica} (relanza el shake/overlay one-shot); la dirección (golpe
  // vs mejora) se decide comparando contra el valor anterior real, no solo "cambió".
  useEffect(() => {
    const prev = prevRef.current
    if (prev !== condicionFisica) {
      setFlash(CONDICION_ORDER.indexOf(condicionFisica) > CONDICION_ORDER.indexOf(prev) ? 'worse' : 'better')
      prevRef.current = condicionFisica
    }
  }, [condicionFisica])

  const grave = condicionFisica === 'GRAVE' || condicionFisica === 'INCAPACITADO'

  return (
    <div
      key={condicionFisica}
      className={`relative flex items-center gap-1.5 overflow-hidden rounded-md border border-iron-700 bg-wood-950/60 px-2.5 py-1 ${
        flash === 'worse' ? 'animate-shake-no' : ''
      } ${grave ? 'animate-pulse-slow' : ''}`}
    >
      {flash && (
        <span
          className={`pointer-events-none absolute inset-0 ${flash === 'worse' ? 'animate-hit-flash-red bg-danger-500' : 'animate-hit-flash-moss bg-moss-500'}`}
          aria-hidden="true"
        />
      )}
      <span className="font-serif text-xs tracking-wide text-wood-300">{CONDICION_LABEL[condicionFisica]}</span>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-iron-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-500 ${BAR_COLOR[condicionFisica]}`}
          style={{ width: `${salud}%` }}
        />
      </div>
      <span className="font-mono tabular-nums text-2xs text-wood-400">{salud}</span>
    </div>
  )
}
