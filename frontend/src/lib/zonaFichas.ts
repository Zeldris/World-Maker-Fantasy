import { useEffect, useState } from 'react'
import type { ZonePointInfo } from './api'

/// Datos y medida de las fichas del mapa de zona (Z-A, hito 0.1) — fuera de `zona/FichaZona.tsx` para
/// que ese archivo solo exporte componentes.

/// ZON-10 (Z12) — colores de disposición desde los tokens de `index.css`, no hexes sueltos.
export const COLOR_DISPOSICION: Record<ZonePointInfo['color'], string> = {
  ALIADO: 'var(--color-moss-400)',
  NEUTRO: 'var(--color-wood-200)',
  ENEMIGO: 'var(--color-danger-400)',
  SIN_FACCION: 'var(--color-cost-400)',
  INERTE: 'var(--color-accent2-400)',
}

/// ZON-11 — unidades de viewBox por píxel de pantalla del `<svg>`. Devuelve una ref de callback (el
/// `<svg>` del mapa se monta cuando llegan los datos, después del primer render) y la escala; sin
/// `ResizeObserver` (tests) la escala es 1.
export function useEscalaPantalla(anchoViewBox = 800, altoViewBox = 600): { ref: (el: SVGSVGElement | null) => void; escala: number } {
  const [svg, setSvg] = useState<SVGSVGElement | null>(null)
  const [escala, setEscala] = useState(1)
  useEffect(() => {
    if (!svg || typeof ResizeObserver === 'undefined') return
    const medir = () => {
      // `preserveAspectRatio` por defecto (meet): manda el eje que más reduce.
      const { width, height } = svg.getBoundingClientRect()
      if (width > 0 && height > 0) setEscala(Math.max(anchoViewBox / width, altoViewBox / height))
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(svg)
    return () => ro.disconnect()
  }, [svg, anchoViewBox, altoViewBox])
  return { ref: setSvg, escala }
}
