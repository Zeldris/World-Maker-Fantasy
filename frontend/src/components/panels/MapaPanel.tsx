import { useEffect, useState } from 'react'
import { beriRegions, llanurasNodePositions, type LlanurasEdge, type LlanurasNode } from '../../data/map'
import { getEnciclopedia, getWorldLocations, type WorldLocationInfo } from '../../lib/api'
import { InteractiveMap } from './InteractiveMap'
import type { CurrentLocationInfo, DestinationInfo, InventoryItemInfo, QuestInfo } from '../../types'
import { PanelSection } from '../PanelSection'
import { useEnciclopediaLink } from '../../context/useEnciclopediaLink'
import { locationToDetailTarget, personajeToDetailTarget } from '../../lib/enciclopediaTargets'
import type { EnciclopediaLinkTarget } from '../../lib/enciclopediaIndex'

function formatMinutos(minutos: number): string {
  if (minutos < 60) return `~${minutos} min`
  const horas = minutos / 60
  return horas < 24 ? `~${horas.toFixed(1)}h` : `~${(horas / 24).toFixed(1)}d`
}

interface MapaPanelProps {
  worldSlug: string | null
  currentLocation: CurrentLocationInfo | null
  destinations: DestinationInfo[]
  inventory: InventoryItemInfo[]
  /// Punto 3 del diseño de Gistera Koh (2026-07-23) — para marcar el objetivo de la misión ACTIVA
  /// con más prioridad (la primera con `targetLocationSlug` real) en el mapa.
  quests: QuestInfo[]
}

// Clave de efecto especial (petición explícita, 2026-07-23; migrado 2026-08-03 de comparar por
// nombre exacto de objeto a `effectKey`, `tipo: ESPECIAL` — ver ItemCatalog en schema.prisma) que
// desbloquea ver los puntos de ubicación de Llanuras en el mapa. Ya no se rompe si el objeto se
// renombra en un saqueo/regalo personalizado, a diferencia de comparar por `name`.
const REVEAL_MAP_LLANURAS_EFFECT_KEY = 'reveal-map-llanuras'

// Catálogo real de ubicaciones de Llanuras, combinado con la geometría medida a mano (el backend
// no guarda coordenadas de mapa) — ver comentario en data/map.ts. Se pide una sola vez por mundo,
// no en cada render.
function useLlanurasGraph(worldSlug: string | null) {
  const [nodes, setNodes] = useState<LlanurasNode[] | undefined>(undefined)
  const [edges, setEdges] = useState<LlanurasEdge[] | undefined>(undefined)
  const [poiFallback, setPoiFallback] = useState<{ name: string; description: string }[]>([])
  // Ubicaciones completas por slug (petición explícita, 2026-07-22: "cuando pulso alguno de los
  // puntos debería abrirme su entrada en la enciclopedia") — `nodes` solo lleva slug/nombre/
  // descripción/posición (lo que pide el dibujado del SVG), pero `locationToDetailTarget` necesita
  // region/kind también, así que se guarda el objeto completo aparte, indexado por slug.
  const [locationsBySlug, setLocationsBySlug] = useState<Map<string, WorldLocationInfo>>(new Map())

  useEffect(() => {
    if (!worldSlug) return
    let cancelled = false
    getWorldLocations(worldSlug)
      .then(({ locations, links }) => {
        if (cancelled) return
        const withPosition = locations.filter((l) => l.slug in llanurasNodePositions)
        setNodes(
          withPosition.map((l) => ({
            slug: l.slug,
            name: l.name,
            description: l.description,
            ...llanurasNodePositions[l.slug],
          })),
        )
        setLocationsBySlug(new Map(locations.map((l) => [l.slug, l])))
        setPoiFallback(withPosition.map((l) => ({ name: l.name, description: l.description })))
        const slugs = new Set(withPosition.map((l) => l.slug))
        setEdges(
          links
            .filter((link) => slugs.has(link.fromSlug) && slugs.has(link.toSlug))
            .map((link) => ({ fromSlug: link.fromSlug, toSlug: link.toSlug, riesgo: link.riesgo !== null })),
        )
      })
      .catch(() => {
        // Sin conexión al backend: el mapa se queda sin grafo de Llanuras en vez de romper el panel.
      })
    return () => {
      cancelled = true
    }
  }, [worldSlug])

  return { nodes, edges, poiFallback, locationsBySlug }
}

// Ficha del protagonista (petición explícita, 2026-07-23: "si lo clicko me lleva a la enciclopedia
// del personaje que esté jugando") — único personaje jugable probado hasta ahora (Gorhorn), igual
// que el resto del contenido de Berig; se pide una sola vez por mundo, no en cada render.
function useProtagonistaTarget(worldSlug: string | null) {
  const [target, setTarget] = useState<EnciclopediaLinkTarget | null>(null)

  useEffect(() => {
    if (!worldSlug) return
    let cancelled = false
    getEnciclopedia(worldSlug)
      .then((data) => {
        if (cancelled) return
        const pj = data.personajes.find((p) => p.slug === 'gorhorn')
        if (pj) setTarget(personajeToDetailTarget(pj))
      })
      .catch(() => {
        // Sin conexión al backend: el icono de "aquí ahora" se queda sin abrir nada en vez de romper el panel.
      })
    return () => {
      cancelled = true
    }
  }, [worldSlug])

  return target
}

export function MapaPanel({ worldSlug, currentLocation, destinations, inventory, quests }: MapaPanelProps) {
  const { nodes: llanurasNodes, edges: llanurasEdges, poiFallback: llanurasPuntosDeInteres, locationsBySlug } = useLlanurasGraph(worldSlug)
  const protagonistaTarget = useProtagonistaTarget(worldSlug)
  const { onEntityDetail } = useEnciclopediaLink()
  const hasLlanurasMap = inventory.some((i) => i.effectKey === REVEAL_MAP_LLANURAS_EFFECT_KEY)
  const questTargetLocationSlug = quests.find((q) => q.status === 'ACTIVA' && q.targetLocationSlug)?.targetLocationSlug ?? null

  return (
    <div className="flex flex-col gap-5">
      <PanelSection title="Berig">
        <InteractiveMap
          regions={beriRegions}
          currentRegion={currentLocation?.region ?? 'Las Llanuras del Viento Rojo'}
          llanurasNodes={llanurasNodes}
          llanurasEdges={llanurasEdges}
          currentLocationSlug={currentLocation?.slug ?? null}
          hasLlanurasMap={hasLlanurasMap}
          questTargetLocationSlug={questTargetLocationSlug}
          onNodeDetail={(slug) => {
            if (slug === currentLocation?.slug && protagonistaTarget) {
              onEntityDetail?.(protagonistaTarget)
              return
            }
            const loc = locationsBySlug.get(slug)
            if (loc) onEntityDetail?.(locationToDetailTarget(loc))
          }}
        />
        {!hasLlanurasMap && (
          <p className="mt-2 text-xs italic text-wood-500">
            Sin un mapa de la región, solo se ve el contorno — consigue el "Mapa de las Llanuras" para ver sus puntos de interés.
          </p>
        )}
      </PanelSection>

      <PanelSection
        title={currentLocation ? `Puntos de interés — ${currentLocation.region}` : 'Puntos de interés — Llanuras del Viento Rojo'}
      >
        {currentLocation ? (
          <div className="flex flex-col gap-2">
            <div className="rounded-lg border border-accent2-600/50 bg-wood-950/40 px-3.5 py-2.5 text-sm">
              <p className="flex items-center gap-2 font-medium text-wood-100">
                <span className="gem2" />
                {currentLocation.name}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-wood-400">{currentLocation.description}</p>
            </div>
            {destinations.length > 0 && (
              <div className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5 text-sm">
                <p className="mb-1.5 text-xs font-medium text-wood-300">Desde aquí se puede ir a:</p>
                <ul className="flex flex-col gap-1">
                  {destinations.map((d) => (
                    <li key={d.locationId} className="flex items-center justify-between text-xs text-wood-400">
                      <span>{d.name}</span>
                      <span className="text-wood-400">{formatMinutos(d.minutos)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {llanurasPuntosDeInteres.map((poi) => (
              <div key={poi.name} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5 text-sm">
                <p className="font-medium text-wood-100">{poi.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-wood-400">{poi.description}</p>
              </div>
            ))}
          </div>
        )}
      </PanelSection>

      <p className="text-xs text-wood-500 italic">
        Vaelira y el resto del mapa se irán añadiendo cuando la partida los necesite.
      </p>
    </div>
  )
}
