import { useEffect, useMemo, useRef, useState } from 'react'
import {
  beriRegions,
  llanurasNodePositions,
  cristalHeladoNodePositions,
  CONSTRUCTION_RECIPE_ICONS,
  type LlanurasEdge,
  type LlanurasNode,
  type CristalHeladoNode,
  type MapNodeOption,
} from '../../data/map'
import { getEnciclopedia, getExpedicionesMapa, getWorldLocations, type EnciclopediaConstructionRecipe, type ExpedicionEnMapa, type AlcanceTorre, type CampamentoInfo, type WorldLocationInfo } from '../../lib/api'
import { formatMinutos } from '../../lib/gameViewHelpers'
import { ESTACION_ICON, CLIMA_ICON } from '../../lib/entorno'
import { ZonaPanel } from './ZonaPanel'
import { InteractiveMap } from './InteractiveMap'
import type { BuildingInfo, CurrentLocationInfo, DestinationInfo, EntornoTemporalInfo, InventoryItemInfo, LogEntry, QuestInfo } from '../../types'
import { PanelSection } from '../PanelSection'
import { useEnciclopediaLink } from '../../context/useEnciclopediaLink'
import { constructionToDetailTarget, locationToDetailTarget, personajeToDetailTarget } from '../../lib/enciclopediaTargets'
import type { EnciclopediaLinkTarget } from '../../lib/enciclopediaIndex'
import type { RumorConLugar } from '../../lib/leyendas'
import { nombreDeEdificio } from '../../lib/edificios'

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
  /// Zona (2026-08-27, auditoría de diseño/UX § 1.1) — para renderizar `<ZonaPanel>` como
  /// subsección propia en vez de pestaña de nivel superior.
  saveId: string | null
  currentLocation: CurrentLocationInfo | null
  destinations: DestinationInfo[]
  inventory: InventoryItemInfo[]
  /// Punto 3 del diseño de Gistera Koh (2026-07-23) — para marcar el objetivo de la misión ACTIVA
  /// con más prioridad (la primera con `targetLocationSlug` real) en el mapa.
  quests: QuestInfo[]
  /// "El campamento" (2026-08-04) — construcciones reales de la partida (Reino), para pintar su
  /// icono en el nodo de su `locationId` y ofrecerlas en la paleta de puntos.
  buildings: BuildingInfo[]
  /// Estación/clima (2026-08-27, auditoría backend↔frontend + diseño/UX § 2.2: "el sitio donde el
  /// jugador ya va a mirar 'dónde estoy y qué hay aquí'... es exactamente donde falta 'qué
  /// estación/clima hay ahora'"). Null solo antes de la primera carga de partida.
  entorno: EntornoTemporalInfo | null
  /// Abre el modal "Viajar" (bug real jugando en vivo, 2026-09-03): los destinos listados aquí
  /// abajo ("Desde aquí se puede ir a...") eran texto plano sin ninguna acción — el modal real ya
  /// existía, abierto solo desde la habilidad "Viajar" en el panel de Habilidades, sin ningún
  /// enlace desde el propio Mapa que muestra esos mismos destinos.
  onViajar: () => void
  /// INT-9 (hito 0.2): rumores con lugar para marcar sus regiones (ver `useRumoresDelMapa`).
  rumores?: RumorConLugar[]
  regionesConRumor?: Set<string>
  onLeerRumores?: (region: string) => void
  /// Conexión real con Interactuar (2026-09-09) — pasado tal cual a `<ZonaPanel>`, ver comentario
  /// ahí. Opcional: sin él, ZonaPanel sigue funcionando, solo sin insertar la tarjeta de oferta al
  /// colisionar con algo no agresivo.
  onEncuentroZona?: (logEntry: LogEntry) => void
}

// Clave de efecto especial (petición explícita, 2026-07-23; migrado 2026-08-03 de comparar por
// nombre exacto de objeto a `effectKey`, `tipo: ESPECIAL` — ver ItemCatalog en schema.prisma) que
// desbloquea ver los puntos de ubicación de Llanuras en el mapa. Ya no se rompe si el objeto se
// renombra en un saqueo/regalo personalizado, a diferencia de comparar por `name`.
const REVEAL_MAP_LLANURAS_EFFECT_KEY = 'reveal-map-llanuras'
// Cristal Helado (añadido 2026-08-22) — mismo patrón de `effectKey` que Llanuras, pero SOLO
// visual: a diferencia de Llanuras, poseer este item no desbloquea destinos de viaje reales
// (`/saves/:id/destinos-viaje` sigue sin tocar, sigue mirando solo 'reveal-map-llanuras') —
// decisión explícita de la usuaria, la región no tiene grafo de viaje (`LocationLink`) todavía.
const REVEAL_MAP_CRISTAL_HELADO_EFFECT_KEY = 'reveal-map-cristal-helado'

// Catálogo real de ubicaciones combinado con la geometría medida/estimada a mano (el backend no
// guarda coordenadas de mapa) — ver comentario en data/map.ts. Un solo fetch por mundo para
// ambas regiones (antes solo existía Llanuras); se pide una sola vez, no en cada render.
function useMapGraphs(worldSlug: string | null) {
  const [llanurasNodes, setLlanurasNodes] = useState<LlanurasNode[] | undefined>(undefined)
  const [llanurasEdges, setLlanurasEdges] = useState<LlanurasEdge[] | undefined>(undefined)
  const [llanurasPoiFallback, setLlanurasPoiFallback] = useState<{ name: string; description: string }[]>([])
  // Cristal Helado no tiene `LocationLink` todavía (sin grafo de viaje real, ver data/map.ts) —
  // por eso no hay `cristalHeladoEdges` aquí, a diferencia de Llanuras.
  const [cristalHeladoNodes, setCristalHeladoNodes] = useState<CristalHeladoNode[] | undefined>(undefined)
  const [cristalHeladoPoiFallback, setCristalHeladoPoiFallback] = useState<{ name: string; description: string }[]>([])
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
        setLocationsBySlug(new Map(locations.map((l) => [l.slug, l])))

        const llanuras = locations.filter((l) => l.slug in llanurasNodePositions)
        setLlanurasNodes(
          llanuras.map((l) => ({
            slug: l.slug,
            name: l.name,
            description: l.description,
            ...llanurasNodePositions[l.slug],
          })),
        )
        setLlanurasPoiFallback(llanuras.map((l) => ({ name: l.name, description: l.description })))
        const llanurasSlugs = new Set(llanuras.map((l) => l.slug))
        setLlanurasEdges(
          links
            .filter((link) => llanurasSlugs.has(link.fromSlug) && llanurasSlugs.has(link.toSlug))
            .map((link) => ({ fromSlug: link.fromSlug, toSlug: link.toSlug, riesgo: link.riesgo !== null })),
        )

        const cristalHelado = locations.filter((l) => l.slug in cristalHeladoNodePositions)
        setCristalHeladoNodes(
          cristalHelado.map((l) => ({
            slug: l.slug,
            name: l.name,
            description: l.description,
            ...cristalHeladoNodePositions[l.slug],
          })),
        )
        setCristalHeladoPoiFallback(cristalHelado.map((l) => ({ name: l.name, description: l.description })))
      })
      .catch(() => {
        // Sin conexión al backend: el mapa se queda sin grafo en vez de romper el panel.
      })
    return () => {
      cancelled = true
    }
  }, [worldSlug])

  return { llanurasNodes, llanurasEdges, llanurasPoiFallback, cristalHeladoNodes, cristalHeladoPoiFallback, locationsBySlug }
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

export function MapaPanel({ worldSlug, saveId, currentLocation, destinations, inventory, quests, buildings, entorno, onViajar, onEncuentroZona, rumores, regionesConRumor, onLeerRumores }: MapaPanelProps) {
  // Sub-tabs Zona/Mapa (2026-08-27, petición explícita: "en la misma sección de Mapa el botón, al
  // darle dentro directamente se vea la zona primero y que sean dos tabs" — Zona vuelve a ser una
  // vista de pleno derecho tras la auditoría de diseño/UX que la había quitado como pestaña de
  // nivel superior el mismo día, pero ahora vive DENTRO del botón Mapa de siempre, no en NavTabs.ts).
  // Mismo patrón visual que el tab Era Común/Semillas de EnciclopediaPanel.tsx.
  const [mapaTab, setMapaTab] = useState<'zona' | 'mapa'>('zona')
  // P169 (QA-27): al cambiar de pestaña, el panel seguía desplazado donde estaba (con «Zona» alta, «Mapa»
  // se abría con las pestañas y el título fuera de la vista). Se vuelve a las pestañas.
  const pestanasRef = useRef<HTMLDivElement>(null)
  const elegirPestana = (id: 'zona' | 'mapa') => {
    if (id === mapaTab) return
    setMapaTab(id)
    pestanasRef.current?.scrollIntoView?.({ block: 'nearest' })
    haCambiadoPestana.current = true
  }
  // P169 (reabierto): el scroll de arriba se hacía antes de pintar la pestaña nueva, y con la ficha de
  // «Zona» desplazada «Mapa» arrancaba a media altura. Se repite ya con el contenido nuevo puesto.
  const haCambiadoPestana = useRef(false)
  useEffect(() => {
    if (!haCambiadoPestana.current) return
    haCambiadoPestana.current = false
    pestanasRef.current?.scrollIntoView?.({ block: 'start' })
  }, [mapaTab])
  // CR-46: expediciones visibles, al abrir el mapa de Berig (best-effort: sin ellas el mapa sigue igual).
  const [expediciones, setExpediciones] = useState<ExpedicionEnMapa[]>([])
  const [alcances, setAlcances] = useState<AlcanceTorre[]>([])
  const [campamentos, setCampamentos] = useState<CampamentoInfo[]>([])
  useEffect(() => {
    if (mapaTab !== 'mapa' || !saveId) return
    let cancelado = false
    getExpedicionesMapa(saveId)
      .then((r) => {
        if (!cancelado) {
          setExpediciones(r.expediciones)
          setAlcances(r.alcances ?? [])
          setCampamentos(r.campamentos ?? [])
        }
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [mapaTab, saveId])
  const {
    llanurasNodes,
    llanurasEdges,
    llanurasPoiFallback: llanurasPuntosDeInteres,
    cristalHeladoNodes,
    locationsBySlug,
  } = useMapGraphs(worldSlug)
  const { protagonistaTarget, constructionsByKey } = useProtagonistaYConstrucciones(worldSlug)
  const { onEntityDetail } = useEnciclopediaLink()
  const hasLlanurasMap = inventory.some((i) => i.effectKey === REVEAL_MAP_LLANURAS_EFFECT_KEY)
  const hasCristalHeladoMap = inventory.some((i) => i.effectKey === REVEAL_MAP_CRISTAL_HELADO_EFFECT_KEY)
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
        label: nombreDeEdificio(b.name),
        onSelect: () => onEntityDetail?.(constructionToDetailTarget(recipe)),
      })
    }
    return options
  }

  return (
    <div className="flex flex-col gap-5">
      <div ref={pestanasRef} className="flex gap-1 rounded-lg border border-iron-800 bg-wood-950/40 p-1">
        {(
          [
            { id: 'zona', label: 'Zona' },
            { id: 'mapa', label: 'Mapa' },
          ] as const
        ).map((tab) => (
          <button type="button"
            key={tab.id}
            onClick={() => elegirPestana(tab.id)}
            className={`tactile flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mapaTab === tab.id ? 'bg-accent2-500/10 text-accent2-300' : 'text-wood-400 hover:text-wood-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pieza 2 del rediseño de movimiento (2026-09-09) — esta vista, dentro del tab Mapa, pasa a
          ser SOLO informativa (`soloConsulta`); el movimiento real vive en `ZonaMovimientoModal`,
          abierto desde el icono de brújula flotante (GameView.tsx). */}
      {mapaTab === 'zona' &&
        (saveId ? (
          <ZonaPanel saveId={saveId} onEncuentroZona={onEncuentroZona} soloConsulta />
        ) : (
          <p className="text-sm italic text-wood-500">Sin partida activa.</p>
        ))}

      {mapaTab === 'mapa' && (
        <div className="flex flex-col gap-5">
          <PanelSection title="Berig">
            {/* Estación/clima (2026-08-27) — mismo tratamiento visual que el pill de fecha del header
                (fondo wood-950/60, borde iron-700, texto 2xs): el sitio donde la jugadora ya mira
                "dónde estoy y qué hay aquí" es el sitio correcto para "qué estación/clima hay ahora",
                el dato que en la práctica decide qué se puede recolectar. */}
            {entorno && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-iron-700 bg-wood-950/60 px-2 py-1 text-2xs text-wood-300">
                  {ESTACION_ICON[entorno.estacion.key]} {entorno.estacion.nombre}
                </span>
                {entorno.clima && (
                  <span className="rounded-full border border-iron-700 bg-wood-950/60 px-2 py-1 text-2xs text-wood-300">
                    {CLIMA_ICON[entorno.clima.key]} {entorno.clima.nombre}
                  </span>
                )}
              </div>
            )}
            <InteractiveMap
              regions={beriRegions}
              currentRegion={currentLocation?.region ?? 'Las Llanuras del Viento Rojo'}
              llanurasNodes={llanurasNodes}
              llanurasEdges={llanurasEdges}
              cristalHeladoNodes={cristalHeladoNodes}
              currentLocationSlug={currentLocation?.slug ?? null}
              hasLlanurasMap={hasLlanurasMap}
              hasCristalHeladoMap={hasCristalHeladoMap}
              questTargetLocationSlug={questTargetLocationSlug}
              getNodeOptions={getNodeOptions}
              buildingIconBySlug={buildingIconBySlug}
              rumores={rumores}
              regionesConRumor={regionesConRumor}
              onLeerRumores={onLeerRumores}
              expediciones={expediciones}
              alcances={alcances}
              campamentos={campamentos}
            />
            {!hasLlanurasMap && !hasCristalHeladoMap && (
              <p className="mt-2 text-xs italic text-wood-500">
                Sin un mapa de la región, solo se ve el contorno — consigue el "Mapa de las Llanuras" o el "Mapa de Cristal Helado" para ver sus puntos de interés.
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
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-wood-300">Desde aquí se puede ir a:</p>
                      <button type="button"
                        onClick={onViajar}
                        className="tactile shrink-0 rounded-lg border border-accent-600/60 px-2.5 py-1 text-2xs text-accent-300 transition-colors hover:bg-accent-500/10"
                      >
                        🧭 Viajar
                      </button>
                    </div>
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
      )}
    </div>
  )
}
