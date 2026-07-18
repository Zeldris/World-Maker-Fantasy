import { useState } from 'react'
import type { MapRegion } from '../../data/map'

interface Shape {
  name: string
  d: string
  labelX: number
  labelY: number
}

// Disposición aproximada, no cartográfica: Cristal Helado al norte (frío/montañas), Llanuras y
// Ciénaga en la franja central salvaje orca, El Margen Silencioso como cinturón que "separa la
// Meseta del Orden de las tierras salvajes del norte" (docs/rpgtarkor/areas.md), Meseta al sur
// (civilización Goirntes). Formas simples a propósito — el lore no da coordenadas exactas.
const SHAPES: Shape[] = [
  {
    name: 'Cristal Helado',
    d: 'M 30 15 Q 200 -10 370 15 L 370 85 Q 200 105 30 85 Z',
    labelX: 200,
    labelY: 50,
  },
  {
    name: 'Las Llanuras del Viento Rojo',
    d: 'M 20 100 L 190 100 L 190 195 L 20 195 Z',
    labelX: 105,
    labelY: 150,
  },
  {
    name: 'Ciénaga Troncal',
    d: 'M 210 100 L 380 100 L 380 195 L 210 195 Z',
    labelX: 295,
    labelY: 150,
  },
  {
    name: 'El Margen Silencioso',
    d: 'M 20 205 Q 200 225 380 205 L 380 250 Q 200 270 20 250 Z',
    labelX: 200,
    labelY: 235,
  },
  {
    name: 'La Meseta del Orden',
    d: 'M 30 260 Q 200 240 370 260 L 370 310 Q 200 330 30 310 Z',
    labelX: 200,
    labelY: 290,
  },
]

export function InteractiveMap({ regions }: { regions: MapRegion[] }) {
  const current = regions.find((r) => r.isCurrent)
  const [selectedName, setSelectedName] = useState(current?.name ?? regions[0]?.name ?? null)
  const selected = regions.find((r) => r.name === selectedName) ?? null

  return (
    <div className="flex flex-col gap-3">
      <div className="plank-panel overflow-hidden rounded-xl p-2">
        <svg viewBox="0 0 400 325" className="w-full" role="img" aria-label="Mapa del continente de Berig">
          <style>{`.map-region { transition: fill 150ms ease; } .map-region:hover { fill: var(--color-wood-800); }`}</style>
          {SHAPES.map((shape) => {
            const region = regions.find((r) => r.name === shape.name)
            const isCurrent = region?.isCurrent
            const isSelected = selectedName === shape.name
            const fill = isCurrent
              ? 'color-mix(in srgb, var(--color-accent-500) 22%, var(--color-wood-900))'
              : isSelected
                ? 'var(--color-wood-800)'
                : 'var(--color-wood-900)'
            const stroke = isCurrent
              ? 'var(--color-accent-500)'
              : isSelected
                ? 'var(--color-accent-600)'
                : 'var(--color-iron-700)'
            return (
              <g
                key={shape.name}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedName(shape.name)}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedName(shape.name)}
                className="cursor-pointer outline-none"
              >
                <path
                  d={shape.d}
                  className={isCurrent || isSelected ? undefined : 'map-region'}
                  style={{ fill, stroke, strokeWidth: isCurrent ? 2 : 1 }}
                />
                <text
                  x={shape.labelX}
                  y={shape.labelY}
                  textAnchor="middle"
                  className={`pointer-events-none select-none font-serif ${
                    isCurrent ? 'fill-accent-300' : 'fill-wood-300'
                  }`}
                  style={{ fontSize: 12 }}
                >
                  {shape.name}
                </text>
                {isCurrent && (
                  <text x={shape.labelX} y={shape.labelY + 14} textAnchor="middle" className="fill-accent-400" style={{ fontSize: 9 }}>
                    ◆ aquí ahora
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {selected && (
        <div className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
          <p className="flex items-center gap-2 font-medium text-wood-100">
            {selected.isCurrent && <span className="gem" />}
            {selected.name}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-wood-400">{selected.description}</p>
        </div>
      )}
    </div>
  )
}
