import { useEffect, useState } from 'react'
import type { DiscoveryItem } from '../types'

interface DiscoveryRevealProps {
  discoveries: DiscoveryItem[]
  onAttach: (item: DiscoveryItem) => void
}

// Revelado progresivo (docs/14-combate-y-muerte.md § 3.1): la lista de hallazgos ya la decidió
// el backend en /turn/classify — este componente solo reproduce visualmente el "ir encontrando
// cosas" mientras /turn/narrate corre en paralelo, con un ritmo comprimido (no minutos reales).
const REVEAL_INTERVAL_MS = 1400

// Rediseño a lista (petición explícita de la usuaria, 2026-07-23, viendo un screenshot: los
// chips sueltos "no quedan claros como están ahora" — su propia idea fue "mostrarlos... como una
// lista/tabla de 'lo detectado' en vez de chips sueltos"). Cada fila deja nombre y cantidad en su
// propia columna (nunca truncados/apretados dentro de un chip) y un botón "Añadir" explícito en
// vez de depender solo de un tooltip para saber qué hace el icono.
export function DiscoveryReveal({ discoveries, onAttach }: DiscoveryRevealProps) {
  const [revealedCount, setRevealedCount] = useState(0)

  useEffect(() => {
    setRevealedCount(0)
    if (discoveries.length === 0) return
    const timers = discoveries.map((_, i) =>
      setTimeout(() => setRevealedCount((prev) => Math.max(prev, i + 1)), (i + 1) * REVEAL_INTERVAL_MS),
    )
    return () => timers.forEach(clearTimeout)
  }, [discoveries])

  if (discoveries.length === 0) return null

  return (
    <div className="px-1 py-1.5">
      <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-wood-500">Has encontrado</p>
      <ul className="flex flex-col gap-1">
        {discoveries.slice(0, revealedCount).map((d, i) => (
          <li
            key={`${d.itemCatalogSlug}-${i}`}
            className="animate-pop-once flex items-center justify-between gap-3 rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-1.5"
          >
            <span className="flex min-w-0 items-center gap-2 text-xs text-wood-200">
              <span aria-hidden="true">✨</span>
              <span className="truncate font-medium">{d.name}</span>
              {d.cantidad > 1 && <span className="shrink-0 text-wood-500">×{d.cantidad}</span>}
            </span>
            <button
              onClick={() => onAttach(d)}
              className="tactile shrink-0 rounded border border-accent-600/60 px-2 py-0.5 text-2xs font-medium text-accent-300 transition-colors hover:bg-accent-500/10"
            >
              Añadir
            </button>
          </li>
        ))}
      </ul>
      {revealedCount < discoveries.length && <p className="mt-1 text-2xs italic text-wood-500">buscando más...</p>}
    </div>
  )
}
