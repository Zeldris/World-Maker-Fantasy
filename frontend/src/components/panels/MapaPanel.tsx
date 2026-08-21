import { useEffect, useMemo, useState } from 'react'
import { beriRegions, llanurasNodePositions, CONSTRUCTION_RECIPE_ICONS, type LlanurasEdge, type LlanurasNode, type MapNodeOption } from '../../data/map'
import { getEnciclopedia, getWorldLocations, type EnciclopediaConstructionRecipe, type WorldLocationInfo } from '../../lib/api'
import { formatMinutos } from '../../lib/gameViewHelpers'
import { InteractiveMap } from './InteractiveMap'
import type { BuildingInfo, CurrentLocationInfo, DestinationInfo, InventoryItemInfo, QuestInfo } from '../../types'
import { PanelSection } from '../PanelSection'
import { useEnciclopediaLink } from '../../context/useEnciclopediaLink'
import { constructionToDetailTarget, locationToDetailTarget, personajeToDetailTarget } from '../../lib/enciclopediaTargets'
import type { EnciclopediaLinkTarget } from '../../lib/enciclopediaIndex'

// Las 3 recetas de Ayuntamiento (construction.ts, backend) comparten `recipeKey: 'ayuntamiento'`
// en la fila real de `Building` tras mejorar — solo `Building.tier` distingue pequeño/mediano/
// grande. El catálogo de la Enciclopedia (`constructionsByKey`, abajo) sí las lista como 3 claves
// separadas ('ayuntamiento'/'ayuntamiento-mediano'/'ayuntamiento-grande') — hay que traducir antes
// de buscar, o la ficha mostrada es siempre la del tier 1.
function recipeKeyForBuilding(b: { recipeKey?: string | null; tier?: number | null }): string | null {
  if (b.recipeKey === 'ayuntamiento' && b.tier === 2) return 'ayuntamiento-mediano'
  if (b.recipeKey === 'ayuntamiento' && b.tier === 3) return 'ayuntamiento-grande'
  return b.recipeKey ?? null
}

interface MapaPanelProps {
  worldSlug: string | null
  currentLocation: CurrentLocationInfo | null
  destinations: DestinationInfo[]
  inventory: InventoryItemInfo[]
  /// Punto 3 del diseño de Gistera Koh (2026-07-23) — para marcar el objetivo de la misión ACTIVA
  /// con más prioridad (la primera con `targetLocationSlug` real) en el mapa.
  quests: QuestInfo[]
  /// "El campamento" (2026-08-04) — construcciones reales de la partida (Reino), para pintar su
  /// icono en el nodo de su `locationId` y ofrecerlas en la paleta de puntos.
  buildings: BuildingInfo[]
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
// Ampliado 2026-08-04 ("el campamento" — primera construcción anclada al mapa) con las recetas de
// construcción indexadas por `key`: mismo `getEnciclopedia` ya se pedía aquí, así que resolver el
// icono/ficha de una `Building` real no necesita ningún fetch nuevo.
function useProtagonistaYConstrucciones(worldSlug: string | null) {
  const [target, setTarget] = useState<EnciclopediaLinkTarget | null>(null)
  const [constructionsByKey, setConstructionsByKey] = useState<Map<string, EnciclopediaConstructionRecipe>>(new Map())

  useEffect(() => {
    if (!worldSlug) return
    let cancelled = false
    getEnciclopedia(worldSlug)
      .then((data) => {
        if (cancelled) return
        const pj = data.personajes.find((p) => p.slug === 'gorhorn')
        if (pj) setTarget(personajeToDetailTarget(pj))
        setConstructionsByKey(new Map(data.constructionRecipes.map((r) => [r.key, r])))
      })
      .catch(() => {
        // Sin conexión al backend: el icono de "aquí ahora" se queda sin abrir nada en vez de romper el panel.
      })
    return () => {
      cancelled = true
    }
  }, [worldSlug])

  return { protagonistaTarget: target, constructionsByKey }
}

export function MapaPanel({ worldSlug, currentLocation, destinations, inventory, quests, buildings }: MapaPanelProps) {
  const { nodes: llanurasNodes, edges: llanurasEdges, poiFallback: llanurasPuntosDeInteres, locationsBySlug } = useLlanurasGraph(worldSlug)
  const { protagonistaTarget, constructionsByKey } = useProtagonistaYConstrucciones(worldSlug)
  const { onEntityDetail } = useEnciclopediaLink()
  const hasLlanurasMap = inventory.some((i) => i.effectKey === REVEAL_MAP_LLANURAS_EFFECT_KEY)
  const questTargetLocationSlug = quests.find((q) => q.status === 'ACTIVA' && q.targetLocationSlug)?.targetLocationSlug ?? null

  // "El campamento" (2026-08-04): Building.locationId es un id real de Location, pero el mapa
  // dibuja por SLUG — se resuelve una vez por render de `buildings`/`locationsBySlug`, no dentro
  // del bucle de nodos. Solo construcciones ACTIVO cuentan (EN_CONSTRUCCION/DANADO/ABANDONADO no
  // se pintan todavía — fuera de alcance de esta primera pasada).
  const buildingsByLocationSlug = useMemo(() => {
    const slugById = new Map(Array.from(locationsBySlug.values()).map((l) => [l.id, l.slug]))
    const bySlug = new Map<string, BuildingInfo[]>()
    for (const b of buildings) {
      if (b.status !== 'ACTIVO' || !b.locationId) continue
      const slug = slugById.get(b.locationId)
      if (!slug) continue
      bySlug.set(slug, [...(bySlug.get(slug) ?? []), b])
    }
    return bySlug
  }, [buildings, locationsBySlug])

  const buildingIconBySlug = useMemo(() => {
    const icons = new Map<string, string>()
    for (const [slug, list] of buildingsByLocationSlug) {
      const icon = list[0]?.recipeKey ? CONSTRUCTION_RECIPE_ICONS[list[0].recipeKey] : undefined
      if (icon) icons.set(slug, icon)
    }
    return icons
  }, [buildingsByLocationSlug])

  // Paleta de puntos (2026-08-04, ver InteractiveMap.tsx): todo lo anclado a este nodo — tu
  // posición (si coincide), la ubicación en sí, y cualquier construcción activa levantada ahí.
  // Con 1 sola opción el mapa la abre directa; con 2+ despliega el abanico. Antes de esto, estar
  // de pie sobre tu propia ubicación SIEMPRE abría tu ficha de personaje sin poder ver nunca la
  // de la ubicación — con la paleta, ese caso (2 opciones) ya te deja elegir.
  function getNodeOptions(slug: string): MapNodeOption[] {
    const options: MapNodeOption[] = []
    if (slug === currentLocation?.slug && protagonistaTarget) {
      options.push({ id: 'protagonist', icon: '👤', label: 'Tú', onSelect: () => onEntityDetail?.(protagonistaTarget) })
    }
    const loc = locationsBySlug.get(slug)
    if (loc) {
      options.push({ id: 'location', icon: '📍', label: loc.name, onSelect: () => onEntityDetail?.(locationToDetailTarget(loc)) })
    }
    for (const b of buildingsByLocationSlug.get(slug) ?? []) {
      // Bug real (auditoría de deuda técnica 2026-08-04): `Building.recipeKey` se queda SIEMPRE en
      // 'ayuntamiento' tras mejorar (turnResolution.ts actualiza name/description/tier del mismo
      // Building.id, nunca la recipeKey — "no se acumulan, mejoras el actual") — buscar la ficha
      // directamente por `b.recipeKey` devolvía siempre la receta del tier 1 ("pequeño"), aunque el
      // badge/nombre del propio mapa ya mostraban el tier real correctamente.
      const recipeKey = recipeKeyForBuilding(b)
      const recipe = recipeKey ? constructionsByKey.get(recipeKey) : undefined
      if (!recipe) continue
      options.push({
        id: `building:${b.id}`,
        icon: CONSTRUCTION_RECIPE_ICONS[b.recipeKey!] ?? '🏗️',
        label: b.name,
        onSelect: () => onEntityDetail?.(constructionToDetailTarget(recipe)),
      })
    }
    return options
  }

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
          getNodeOptions={getNodeOptions}
          buildingIconBySlug={buildingIconBySlug}
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
