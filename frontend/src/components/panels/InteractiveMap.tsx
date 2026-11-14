import { useEffect, useMemo, useRef, useState } from 'react'
import type { AlcanceTorre, CampamentoInfo, ExpedicionEnMapa } from '../../lib/api'
import { posicionDeExpedicion } from '../../lib/leyendas'
import { projectLlanurasNodes, type LlanurasEdge, type LlanurasNode, type CristalHeladoNode, type MapNodeOption, type MapRegion } from '../../data/map'
import berigMapUrl from '../../assets/maps/helek-sirik-berig.png'
import { MapZoomModal } from './MapZoomModal'
import { REGIONES_HELEK } from '../../data/helekRegiones'
import type { RumorConLugar } from '../../lib/leyendas'
import { centrarEnSuContenedor } from '../../lib/centrarEnContenedor'

// "Paleta de puntos" (2026-08-04, ver MapNodeOption en data/map.ts): abanico de satélites por
// encima del punto, en vez de un menú/modal aparte — el propio nodo "se abre". Radio y ángulos en
// las mismas unidades pequeñas que el resto del dibujado de este componente (viewBox de ~290×510).
// Reducido de 4.6 a 3.6 (auditoría de deuda técnica 2026-08-04): en el racimo denso del núcleo de
// Llanuras (hondonada-del-eco/tumulos-del-honor/osario-de-la-manada, a solo 2.2-2.4 unidades entre
// sí — más cerca que el radio de sus propios iconos) los satélites podían invadir el icono de un
// nodo VECINO, no solo el propio. Un radio menor reduce cuánto se solapan, pero no lo elimina del
// todo — esos 3 nodos están tan pegados entre sí que ningún radio de paleta lo resuelve solo;
// arreglarlo de verdad exigiría separar sus coordenadas, y eso necesita verificarse contra el
// render real con la usuaria (docs/feedback: nunca mover nodos del mapa a ciegas).
const PALETTE_RADIUS = 3.6
const PALETTE_ANGLE_START = 200
const PALETTE_ANGLE_END = 340

function paletteOffsets(count: number): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const angleDeg = count === 1 ? 270 : PALETTE_ANGLE_START + (i * (PALETTE_ANGLE_END - PALETTE_ANGLE_START)) / (count - 1)
    const rad = (angleDeg * Math.PI) / 180
    return { x: PALETTE_RADIUS * Math.cos(rad), y: PALETTE_RADIUS * Math.sin(rad) }
  })
}

interface Shape {
  name: string
  d: string
  labelX: number
  labelY: number
}

// Fronteras políticas REALES (MAP-4, 2026-11-08): salen de map-generator/mundo/helek.json, importado una
// vez del .map que la usuaria dibujó en Azgaar (docs/map/Helek_World.map), por map-generator/exportar.py
// (data/helekRegiones.ts, generado). Mismo sistema de coordenadas que la imagen de fondo
// (helek-sirik-berig.png, lienzo de 800×600, 1 unidad ≈ 1 km). Solo sirven de región de clic/resalte — el
// color y la textura de terreno ya vienen pintados en la imagen. Aquí queda lo que es del juego: el nombre
// que se muestra (el de MapRegion) y dónde va la etiqueta, por id de región de helek.json.
const ETIQUETAS_REGION: Record<number, Omit<Shape, 'd'>> = {
  17: { name: 'Cristal Helado', labelX: 604.5, labelY: 132 },
  18: { name: 'Las Llanuras del Viento Rojo', labelX: 527.5, labelY: 130 },
  19: { name: 'Ciénaga Troncal', labelX: 635, labelY: 218 },
  20: { name: 'El Margen Silencioso', labelX: 600.5, labelY: 342 },
  21: { name: 'La Meseta del Orden', labelX: 600.5, labelY: 470 },
}
const SHAPES: Shape[] = REGIONES_HELEK.filter((r) => r.id in ETIQUETAS_REGION).map((r) => ({ ...ETIQUETAS_REGION[r.id], d: r.d }))
const regionHelek = (id: number) => REGIONES_HELEK.find((r) => r.id === id)

// Recorte real de Berig dentro del lienzo completo de Azgaar (800×600, mundo entero con Vaelira
// + estrecho). Calculado a partir de los propios paths de estado de arriba, con ~18-19 unidades
// de margen por cada lado — ya no es una composición inventada, es la silueta real que pintó la
// usuaria menos el margen de mar sobrante.
const BERIG_VIEWBOX = { x: 445, y: 0, width: 290, height: 510 }

// Bbox real del estado Llanuras del Viento Rojo (id state18 en el .map) — solo para posicionar la
// barra de escala del núcleo cerca de su esquina, ya no como rectángulo de destino a estirar.
const LLANURAS_SHAPE_BBOX = regionHelek(18)?.bbox ?? { x0: 464, y0: 117, x1: 591, y1: 368 }

// Contorno real del mismo estado (bug real, 2026-07-22: "el cuadro negro en el mapa" — la placa
// de contraste de abajo usaba el bbox como si fuera la forma real, y en las esquinas donde el
// polígono no llega a cubrir todo el rectángulo, la placa oscura sobresalía sobre las regiones
// vecinas). Se referencia el mismo `d` de SHAPES en vez de duplicar la cadena de puntos.
const LLANURAS_PATH_D = SHAPES.find((s) => s.name === 'Las Llanuras del Viento Rojo')?.d ?? ''

// 1 unidad del lienzo ≈ 1 km real (misma escala que usa Azgaar), así que la barra de escala del
// núcleo ya no necesita inferirse — es una constante confirmada por la propia barra de Azgaar.
const LLANURAS_SCALE_BAR_KM = 15

// Cristal Helado (añadido 2026-08-22) — mismo `d` real de SHAPES, sin duplicar la cadena de
// puntos. Bbox calculado del propio path (min/max de cada coordenada), no medido a mano como el
// de Llanuras (`LLANURAS_SHAPE_BBOX`, triangulado contra `LocationLink`) — aquí no hay ningún
// dato real que triangular todavía. Sin barra de escala a propósito: sin coordenadas km reales
// (ver data/map.ts) mostrar un "~X km" sería inventar precisión que no existe.
const CRISTAL_HELADO_PATH_D = SHAPES.find((s) => s.name === 'Cristal Helado')?.d ?? ''
const CRISTAL_HELADO_SHAPE_BBOX = regionHelek(17)?.bbox ?? { x0: 501, y0: 18, x1: 708, y1: 139 }
// Cristal Helado no tiene `LocationLink` todavía (ver data/map.ts) — array estable fuera del
// render para no crear una identidad nueva en cada pasada.
const NO_EDGES: LlanurasEdge[] = []

interface InteractiveMapProps {
  regions: MapRegion[]
  currentRegion: string
  /// Grafo real de Llanuras (roadmap 2026-07-20, Mapa Nivel 1) — opcional porque solo esa región
  /// tiene coordenadas medidas (docs/13 § 1.1); el resto del continente sigue siendo solo formas.
  llanurasNodes?: LlanurasNode[]
  llanurasEdges?: LlanurasEdge[]
  /// Cristal Helado (añadido 2026-08-22): mismo patrón que Llanuras, pero ya en espacio de
  /// píxeles del lienzo (sin proyección, ver data/map.ts) y sin aristas — la región no tiene
  /// grafo de viaje real todavía, solo lectura visual/Enciclopedia.
  cristalHeladoNodes?: CristalHeladoNode[]
  currentLocationSlug?: string | null
  /// Qué hay anclado en este nodo (2026-08-04, reemplaza `onNodeDetail`): puede ser tu posición,
  /// la ubicación en sí, y/o una o más construcciones — con 1 sola opción se abre directo (mismo
  /// comportamiento de siempre), con 2+ se despliega la paleta de satélites en vez de decidir en
  /// silencio cuál mostrar (bug real que tenía el código anterior: de pie sobre tu ubicación,
  /// pulsar el nodo SIEMPRE abría tu propia ficha, nunca la de la ubicación).
  getNodeOptions?: (slug: string) => MapNodeOption[]
  /// Icono de construcción activa por slug de ubicación (2026-08-04, "el campamento" — primera
  /// construcción anclada al mapa) — badge adicional sobre el nodo, independiente de la insignia
  /// de "aquí ahora" y del "!" de misión.
  buildingIconBySlug?: Map<string, string>
  /// "Niebla de guerra" por región (petición explícita, 2026-07-23): sin el objeto "Mapa de las
  /// Llanuras" en el inventario, la región se ve resaltada (sabes en qué región estás) pero sin
  /// los puntos de ubicación concretos — mismo patrón pensado para el resto de Berig cuando tenga
  /// coordenadas propias.
  hasLlanurasMap: boolean
  /// Cristal Helado (añadido 2026-08-22) — mismo patrón que `hasLlanurasMap`.
  hasCristalHeladoMap: boolean
  /// Punto 3 del diseño de Gistera Koh (2026-07-23, antes deferido a propósito): slug de la
  /// Location donde marcar el objetivo de la misión activa con un "!" rojo oscuro — null si la
  /// misión activa no tiene objetivo geográfico conocido, o si aún no coincide con ningún nodo
  /// con coordenadas.
  questTargetLocationSlug?: string | null
  /// INT-9 (hito 0.2): rumores con lugar de «El mundo»; las regiones de `regionesConRumor` (sin leer)
  /// llevan un pergamino hasta que se pulsan, y la tarjeta de la región enseña sus rumores.
  rumores?: RumorConLugar[]
  regionesConRumor?: Set<string>
  onLeerRumores?: (region: string) => void
  /// CR-46: expediciones que el personaje puede ver (las suyas, las aliadas y las de su región).
  expediciones?: ExpedicionEnMapa[]
  /// CR-65 (Q9): lugares que vigila la Torre de cada asentamiento (como el alcance de un satélite de X4).
  alcances?: AlcanceTorre[]
  /// CR-50 (Q7): campamentos de bandidos que conoce el personaje.
  campamentos?: CampamentoInfo[]
}

export function InteractiveMap({
  regions,
  currentRegion,
  llanurasNodes,
  llanurasEdges,
  cristalHeladoNodes,
  currentLocationSlug,
  getNodeOptions,
  buildingIconBySlug,
  hasLlanurasMap,
  hasCristalHeladoMap,
  questTargetLocationSlug,
  rumores = [],
  regionesConRumor,
  onLeerRumores,
  expediciones = [],
  alcances = [],
  campamentos = [],
}: InteractiveMapProps) {
  const [selectedName, setSelectedName] = useState(currentRegion)
  // Paleta de puntos (2026-08-04): qué nodo tiene su abanico de satélites desplegado ahora mismo,
  // null = ninguno. Se cierra solo al elegir una opción, al pulsar el mismo nodo otra vez, o al
  // pulsar fuera (imagen de fondo).
  const [expandedNodeSlug, setExpandedNodeSlug] = useState<string | null>(null)
  // Bug real (auditoría 2026-07-22): `useState(currentRegion)` solo copia la prop la primera vez
  // — si el jugador viaja a otra región con el panel de Mapa ya abierto, `currentRegion` cambia
  // pero el resaltado se quedaba en la región vieja hasta cerrar y reabrir el panel. Se resincroniza
  // cada vez que cambia de verdad la región actual (no en cada render — el jugador puede seguir
  // explorando/clicando otras regiones sin que esto le devuelva la selección a la suya).
  useEffect(() => {
    setSelectedName(currentRegion)
  }, [currentRegion])
  // P33 (QA-27): el lienzo de Berig es más alto que ancho y el panel abre arriba, en Cristal
  // Helado, aunque la jugadora esté en las Llanuras. Al abrir el mapa o cambiar de sitio, se lleva
  // el scroll a su punto (o, sin mapa de la región, a su región).
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const svg = svgRef.current
    // El punto de la jugadora; sin mapa de la región, su insignia; si no, la forma de su región.
    const aqui = svg?.querySelector('[data-aqui="nodo"]') ?? svg?.querySelector('[data-aqui="region"]') ?? svg?.querySelector('[data-aqui="forma"]')
    centrarEnSuContenedor(aqui)
  }, [currentRegion, currentLocationSlug])
  const selected = regions.find((r) => r.name === selectedName) ?? null
  const [selectedNodeSlug, setSelectedNodeSlug] = useState<string | null>(null)
  const [expedicionVista, setExpedicionVista] = useState<string | null>(null)
  const selectedNode = llanurasNodes?.find((n) => n.slug === selectedNodeSlug) ?? cristalHeladoNodes?.find((n) => n.slug === selectedNodeSlug) ?? null

  const nodePositions = useMemo(() => (llanurasNodes ? projectLlanurasNodes(llanurasNodes) : null), [llanurasNodes])
  const showLlanurasGraph = hasLlanurasMap && selectedName === 'Las Llanuras del Viento Rojo' && nodePositions && llanurasNodes && llanurasEdges
  const showCristalHeladoGraph = hasCristalHeladoMap && selectedName === 'Cristal Helado' && cristalHeladoNodes
  // Visor ampliable (roadmap "atlas Azgaar", 2026-07-22): el panel pequeño va bien para elegir
  // región/nodo, pero a este tamaño la imagen real de Azgaar nunca se ve con detalle de verdad —
  // ver MapZoomModal.tsx para el motivo (resolución fija del PNG, no un bug de renderizado).
  const [showZoomModal, setShowZoomModal] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <div className="plank-panel relative overflow-hidden rounded-xl p-2">
        <button type="button"
          onClick={() => setShowZoomModal(true)}
          className="tactile absolute right-3 top-3 z-10 rounded-lg border border-iron-700 bg-wood-950/70 px-2.5 py-1 text-2xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300"
        >
          🔍 Ampliar mapa
        </button>
        <svg
          ref={svgRef}
          viewBox={`${BERIG_VIEWBOX.x} ${BERIG_VIEWBOX.y} ${BERIG_VIEWBOX.width} ${BERIG_VIEWBOX.height}`}
          className="w-full"
          role="img"
          aria-label="Mapa del continente de Berig"
        >
          <style>{`.map-region { transition: fill 150ms ease, stroke 150ms ease; } .map-region:hover { fill: rgba(255,255,255,0.1); stroke: var(--color-accent2-600); }`}</style>

          {/* Mapa real pintado a mano por la usuaria en Azgaar (roadmap "atlas Azgaar",
              2026-07-21/22) — sustituye a las 5 formas dibujadas/texturas procedurales que había
              antes. La imagen cubre el lienzo entero (800×600, mundo con Vaelira + estrecho); el
              viewBox de arriba solo recorta la ventana de Berig.
              `onDragStart` (bug real, 2026-07-22: "no me deja arrastrar el ratón... extrae la
              imagen de la pantalla") — sin esto, arrastrar sobre esta vista estática disparaba el
              drag-and-drop nativo del navegador (el "fantasma" de la imagen siguiendo el cursor,
              como si se sacara del navegador). Esta vista nunca tuvo paneo propio — solo clic para
              elegir región — así que el arreglo es que arrastrar no haga nada, no añadir paneo
              aquí (para eso ya está "Ampliar mapa", que sí lo tiene bien resuelto). */}
          <image
            href={berigMapUrl}
            x={0}
            y={0}
            width={800}
            height={600}
            preserveAspectRatio="xMidYMid slice"
            onDragStart={(e) => e.preventDefault()}
            onClick={() => setExpandedNodeSlug(null)}
            style={{ WebkitUserDrag: 'none', userSelect: 'none' } as React.CSSProperties}
          />

          {SHAPES.map((shape) => {
            const isCurrent = shape.name === currentRegion
            const isSelected = selectedName === shape.name
            // Generalizado 2026-08-22 (antes solo comprobaba Llanuras) — cualquier región con su
            // propio grafo de nodos visible oculta la insignia decorativa de "aquí ahora" sobre
            // la propia forma, igual que ya hacía Llanuras.
            const isLlanurasWithGraph = (shape.name === 'Las Llanuras del Viento Rojo' && showLlanurasGraph) || (shape.name === 'Cristal Helado' && showCristalHeladoGraph)
            // El color/textura de terreno ya vienen en la imagen — aquí solo se resalta el
            // borde (y un tinte muy leve) al pasar el ratón, seleccionar o estar en la región
            // actual; nunca se tapa el arte real con un relleno sólido.
            const fill = isCurrent
              ? 'color-mix(in srgb, var(--color-accent2-500) 16%, transparent)'
              : isSelected
                ? 'rgba(255,255,255,0.06)'
                : 'transparent'
            const stroke = isCurrent ? 'var(--color-accent2-400)' : isSelected ? 'var(--color-accent2-600)' : 'transparent'
            return (
              <g
                key={shape.name}
                data-aqui={isCurrent ? 'forma' : undefined}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedName(shape.name)
                  onLeerRumores?.(shape.name)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedName(shape.name)
                    onLeerRumores?.(shape.name)
                  }
                }}
                className="cursor-pointer outline-none"
              >
                <path
                  d={shape.d}
                  className={isCurrent || isSelected ? undefined : 'map-region'}
                  style={{ fill, stroke, strokeWidth: isCurrent ? 1.5 : 1 }}
                />
                {regionesConRumor?.has(shape.name) && (
                  // INT-9: pergamino de rumor sin leer, encima del nombre de la región.
                  <text
                    x={shape.labelX}
                    y={shape.labelY - 14}
                    textAnchor="middle"
                    fontSize={18}
                    className="pointer-events-none"
                    aria-label={`Rumores de ${shape.name} sin leer`}
                    role="img"
                  >
                    📜
                  </text>
                )}
                {isCurrent && !isLlanurasWithGraph && (
                  // +20 para no tapar el nombre de la región que ya viene escrito en la propia
                  // imagen (Azgaar pinta su etiqueta decorativa cerca del centro de cada estado).
                  // Insignia de "aquí ahora" (petición explícita, 2026-07-23: quitar el texto,
                  // usar un icono tipo contacto de móvil — persona en blanco sobre fondo dorado,
                  // borde blanco) en vez del texto "◆ aquí ahora", que se perdía contra el fondo.
                  <g data-aqui="region" className="pointer-events-none" transform={`translate(${shape.labelX} ${shape.labelY + 20})`}>
                    <clipPath id={`current-badge-clip-${shape.name.replace(/\s+/g, '-')}`}>
                      <circle r={5} />
                    </clipPath>
                    <circle r={5} fill="#d4af37" stroke="white" strokeWidth={1} />
                    <g clipPath={`url(#current-badge-clip-${shape.name.replace(/\s+/g, '-')})`}>
                      <circle cy={-1.6} r={1.7} fill="white" />
                      <circle cy={5.2} r={3.6} fill="white" />
                    </g>
                  </g>
                )}
              </g>
            )
          })}

          {/* Bug real (2026-07-22, "el cuadro negro en el mapa se sigue viendo"): la placa de
              contraste de abajo es un simple rectángulo del bounding box de Llanuras, pero la
              región real es un polígono irregular — en las esquinas donde el polígono no llega a
              cubrir todo el rectángulo, la placa oscura sobresalía sobre las regiones vecinas
              (Cristal Helado/Ciénaga Troncal), justo el bloque negro que se veía en la esquina
              superior derecha de la región. Se recorta al contorno real con un clipPath en vez de
              dejarla como un rectángulo suelto. */}
          <clipPath id="llanuras-clip">
            <path d={LLANURAS_PATH_D} />
          </clipPath>
          <clipPath id="cristal-helado-clip">
            <path d={CRISTAL_HELADO_PATH_D} />
          </clipPath>

          {/* Placa de contraste (roadmap "atlas Azgaar", 2026-07-21/22): el grafo de nodos ahora
              vive encima del arte real de Azgaar, mucho más recargado que el relleno plano de
              antes — sin esto, los puntos/líneas se pierden contra el mapa pintado. Va ANTES de
              aristas/nodos para quedar debajo de ambos, no encima. */}
          {showLlanurasGraph && (
            <rect
              x={LLANURAS_SHAPE_BBOX.x0 - 4}
              y={LLANURAS_SHAPE_BBOX.y0 - 4}
              width={LLANURAS_SHAPE_BBOX.x1 - LLANURAS_SHAPE_BBOX.x0 + 8}
              height={LLANURAS_SHAPE_BBOX.y1 - LLANURAS_SHAPE_BBOX.y0 + 8}
              fill="var(--color-wood-950)"
              opacity={0.30}
              clipPath="url(#llanuras-clip)"
              className="pointer-events-none"
            />
          )}
          {showCristalHeladoGraph && (
            <rect
              x={CRISTAL_HELADO_SHAPE_BBOX.x0 - 4}
              y={CRISTAL_HELADO_SHAPE_BBOX.y0 - 4}
              width={CRISTAL_HELADO_SHAPE_BBOX.x1 - CRISTAL_HELADO_SHAPE_BBOX.x0 + 8}
              height={CRISTAL_HELADO_SHAPE_BBOX.y1 - CRISTAL_HELADO_SHAPE_BBOX.y0 + 8}
              fill="var(--color-wood-950)"
              opacity={0.3}
              clipPath="url(#cristal-helado-clip)"
              className="pointer-events-none"
            />
          )}

          {showLlanurasGraph &&
            llanurasEdges.map((edge) => {
              const from = nodePositions.get(edge.fromSlug)
              const to = nodePositions.get(edge.toSlug)
              if (!from || !to) return null
              return (
                <line
                  key={`${edge.fromSlug}-${edge.toSlug}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  // `--color-iron-600` no existe en index.css (solo iron-700/800/900) — bug real,
                  // hacía el stroke inválido y las líneas de ruta llevaban invisibles desde que se
                  // construyó esta función, no algo específico de las zonas nuevas (2026-08-05,
                  // encontrado jugando: "no veo ninguna línea de ruta en el mapa").
                  stroke="var(--color-wood-300)"
                  strokeWidth={0.6}
                  strokeDasharray={edge.riesgo ? '2 1.5' : undefined}
                  opacity={0.75}
                />
              )
            })}

          {/* Cristal Helado no tiene `LocationLink` todavía — `NO_EDGES` está siempre vacío, este
              bloque no dibuja nada hoy, solo deja el sitio listo para cuando exista un grafo de
              viaje real (mismo criterio de código que el bloque de Llanuras de arriba). */}
          {showCristalHeladoGraph &&
            NO_EDGES.map((edge) => {
              const from = cristalHeladoNodes!.find((n) => n.slug === edge.fromSlug)
              const to = cristalHeladoNodes!.find((n) => n.slug === edge.toSlug)
              if (!from || !to) return null
              return (
                <line
                  key={`${edge.fromSlug}-${edge.toSlug}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="var(--color-wood-300)"
                  strokeWidth={0.6}
                  strokeDasharray={edge.riesgo ? '2 1.5' : undefined}
                  opacity={0.75}
                />
              )
            })}

          {showLlanurasGraph &&
            llanurasNodes.map((node) => {
              const pos = nodePositions.get(node.slug)
              if (!pos) return null
              const isCurrentNode = node.slug === currentLocationSlug
              const isSelectedNode = node.slug === selectedNodeSlug
              const isQuestTarget = node.slug === questTargetLocationSlug
              const buildingIcon = buildingIconBySlug?.get(node.slug)
              const nodeOptions = getNodeOptions?.(node.slug) ?? []
              const isExpanded = expandedNodeSlug === node.slug
              // Paleta de puntos (2026-08-04): con 1 sola cosa anclada se abre directo, como
              // siempre; con 2+ se despliega el abanico de satélites en vez de decidir en silencio
              // cuál mostrar. Un solo cuerpo (auditoría de deuda técnica 2026-08-21) — antes vivía
              // duplicado literal entre onClick/onKeyDown de este mismo nodo.
              const selectThisNode = () => {
                setSelectedNodeSlug(node.slug)
                if (nodeOptions.length <= 1) {
                  setExpandedNodeSlug(null)
                  nodeOptions[0]?.onSelect()
                } else {
                  setExpandedNodeSlug((prev) => (prev === node.slug ? null : node.slug))
                }
              }
              return (
                <g
                  // Roadmap de mapa (Fable 2026-07-20, Nivel 2): la key incluye si es el nodo
                  // actual — al cambiar de ubicación, tanto el nodo que deja de serlo como el que
                  // pasa a serlo remontan, y solo este último lleva `animate-pop-once` (ya
                  // existente en index.css, sin bucle) para que el marcador "aquí ahora" anuncie
                  // la llegada en vez de aparecer en silencio.
                  key={`${node.slug}-${isCurrentNode}`}
                  data-aqui={isCurrentNode ? 'nodo' : undefined}
                  role="button"
                  tabIndex={0}
                  className={`tactile cursor-pointer outline-none${isCurrentNode ? ' animate-pop-once' : ''}`}
                  // Bug real (2026-07-22, "los puntos cuando los quiero clickear se mueven"): sin
                  // `transform-box: fill-box`, cualquier transform CSS sobre un <g> de SVG (el
                  // scale(0.98) de `.tactile:active` al pulsar, el pop de `animate-pop-once`) se
                  // centra por defecto en el origen del viewBox entero (0,0, la esquina superior
                  // del mapa), no en el propio marcador — el punto "saltaba" hacia esa esquina en
                  // vez de encogerse sobre sí mismo, así que el clic real nunca coincidía con
                  // donde estaba el punto un instante antes.
                  style={{ transformBox: 'fill-box', transformOrigin: 'center' } as React.CSSProperties}
                  onClick={(e) => {
                    e.stopPropagation()
                    selectThisNode()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      selectThisNode()
                    }
                  }}
                >
                  {/* `<title>` (bug real, 2026-07-22: "los puntos no se entienden") — tooltip
                      nativo del navegador con el nombre al pasar el ratón, sin esperar a hacer
                      clic. El halo detrás del punto (radio mayor, oscuro y semitransparente) le da
                      contraste contra el arte real de Azgaar, mucho más recargado que el fondo
                      plano de antes — sin él, un punto de 2.5 unidades se pierde a simple vista. */}
                  {/* Petición explícita, 2026-07-23: el nodo actual muestra "Estás aquí" en vez
                      del nombre de la ubicación — el icono de contacto ya representa al personaje,
                      no al lugar. */}
                  <title>{isCurrentNode ? 'Estás aquí' : node.name}</title>
                  {isCurrentNode ? (
                    // Insignia "aquí ahora" (petición explícita, 2026-07-23: icono tipo contacto
                    // de móvil, persona en blanco sobre interior dorado con borde blanco) — para
                    // distinguirse claramente tanto de los puntos normales (dorado apagado, sin
                    // icono) como de los medallones decorativos que ya trae pintados la imagen.
                    <g>
                      <clipPath id={`current-node-badge-clip-${node.slug}`}>
                        <circle cx={pos.x} cy={pos.y} r={2.61} />
                      </clipPath>
                      <circle cx={pos.x} cy={pos.y} r={2.61} fill="#d4af37" stroke="white" strokeWidth={0.57} />
                      <g clipPath={`url(#current-node-badge-clip-${node.slug})`}>
                        <circle cx={pos.x} cy={pos.y - 0.86} r={0.9} fill="white" />
                        <circle cx={pos.x} cy={pos.y + 2.7} r={1.89} fill="white" />
                      </g>
                    </g>
                  ) : (
                    <>
                      <circle cx={pos.x} cy={pos.y} r={2.0} fill="rgba(10,8,6,0.55)" />
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={1.35}
                        fill={isSelectedNode ? 'var(--color-accent2-600)' : 'var(--color-wood-300)'}
                        stroke="var(--color-iron-700)"
                        strokeWidth={0.5}
                      />
                    </>
                  )}
                  {isQuestTarget && (
                    // Marca de misión (punto 3 del diseño de Gistera Koh, 2026-07-23): "!" rojo
                    // oscuro en desplazamiento arriba-derecha del punto, para no taparlo si
                    // coincide con la insignia dorada de "aquí ahora".
                    <g className="pointer-events-none">
                      <circle cx={pos.x + 1.9} cy={pos.y - 1.9} r={1.7} fill="#7f1d1d" stroke="white" strokeWidth={0.4} />
                      <text
                        x={pos.x + 1.9}
                        y={pos.y - 1.9}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="white"
                        style={{ fontSize: 2.4, fontWeight: 700 }}
                      >
                        !
                      </text>
                    </g>
                  )}
                  {buildingIcon && (
                    // Badge de construcción (2026-08-04, "el campamento" — primera construcción
                    // anclada al mapa) — desplazamiento abajo-derecha, para no pisar la insignia
                    // dorada de "aquí ahora" (centro) ni el "!" de misión (arriba-derecha).
                    <g className="pointer-events-none">
                      <circle cx={pos.x + 1.9} cy={pos.y + 1.9} r={1.7} fill="var(--color-wood-800)" stroke="white" strokeWidth={0.4} />
                      <text x={pos.x + 1.9} y={pos.y + 2.0} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 2.1 }}>
                        {buildingIcon}
                      </text>
                    </g>
                  )}
                  {isExpanded &&
                    nodeOptions.map((opt, i) => {
                      const offset = paletteOffsets(nodeOptions.length)[i]
                      const ox = pos.x + offset.x
                      const oy = pos.y + offset.y
                      return (
                        <g
                          key={opt.id}
                          className="tactile cursor-pointer outline-none"
                          style={{ transformBox: 'fill-box', transformOrigin: 'center' } as React.CSSProperties}
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedNodeSlug(null)
                            opt.onSelect()
                          }}
                        >
                          <title>{opt.label}</title>
                          <line x1={pos.x} y1={pos.y} x2={ox} y2={oy} stroke="var(--color-accent2-500)" strokeWidth={0.35} opacity={0.6} />
                          <circle cx={ox} cy={oy} r={2.4} fill="var(--color-wood-950)" stroke="var(--color-accent2-500)" strokeWidth={0.5} />
                          <text x={ox} y={oy} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 2.4 }}>
                            {opt.icon}
                          </text>
                        </g>
                      )
                    })}
                </g>
              )
            })}

          {/* CR-65 (Q9): el alcance de las Torres de vigía, en cada lugar que vigilan. */}
          {showLlanurasGraph &&
            alcances.map((a) => (
              <g key={a.asentamiento} aria-label={`Alcance de la Torre de ${a.asentamiento}`} pointerEvents="none">
                {a.slugs.map((slug) => {
                  const pos = nodePositions.get(slug)
                  return pos ? <circle key={slug} cx={pos.x} cy={pos.y} r={4.6} fill="none" stroke="var(--color-quest-300)" strokeWidth={0.35} strokeDasharray="1 0.8" opacity={0.7} /> : null
                })}
              </g>
            ))}

          {/* CR-50 (Q7): campamentos de bandidos que conoces, en su lugar. */}
          {campamentos.map((c) => {
            // En el mapa de la región que se esté viendo (Llanuras proyectadas o Cristal Helado).
            const pos = showLlanurasGraph ? nodePositions.get(c.slug) : showCristalHeladoGraph ? cristalHeladoNodes?.find((n) => n.slug === c.slug) : undefined
            if (!pos) return null
            return (
              <g key={c.id} aria-label={`Campamento de ${c.grupo}`}>
                <title>{`${c.grupo}: unos ${c.gente} y su cabecilla`}</title>
                <circle cx={pos.x + 2.2} cy={pos.y - 2.2} r={1.9} fill="#7f1d1d" stroke="white" strokeWidth={0.35} />
                <text x={pos.x + 2.2} y={pos.y - 2.2} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 2 }} pointerEvents="none">
                  ⛺
                </text>
              </g>
            )
          })}

          {/* CR-46: expediciones en camino, entre su asentamiento y su destino. */}
          {showLlanurasGraph &&
            expediciones.map((e) => {
              const pos = posicionDeExpedicion(nodePositions.get(e.origenSlug), nodePositions.get(e.destinoSlug), e.progreso)
              if (!pos) return null
              return (
                <g
                  key={e.id}
                  role="button"
                  tabIndex={0}
                  aria-label={e.hostil ? `Asalto de ${e.faccion}` : `Expedición de ${e.faccion}`}
                  className="cursor-pointer outline-none"
                  onClick={(ev) => {
                    ev.stopPropagation()
                    setExpedicionVista((prev) => (prev === e.id ? null : e.id))
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') setExpedicionVista((prev) => (prev === e.id ? null : e.id))
                  }}
                >
                  <title>{`${e.faccion}: ${pos.vuelve ? `vuelve de ${e.destinoNombre}` : `va a ${e.destinoNombre}`}`}</title>
                  <circle cx={pos.x} cy={pos.y} r={2.2} fill={e.hostil ? '#7f1d1d' : e.delReino ? 'var(--color-accent-600)' : 'var(--color-wood-900)'} stroke="var(--color-quest-300)" strokeWidth={0.45} />
                  <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 2.4 }}>
                    ⚑
                  </text>
                </g>
              )
            })}

          {/* Cristal Helado (añadido 2026-08-22) — mismo dibujado que Llanuras, con dos
              diferencias: `pos` es el propio nodo (ya en espacio de píxeles, sin proyección) y no
              hay insignia de misión/construcción todavía (ninguna misión ni Reino apunta aquí). */}
          {showCristalHeladoGraph &&
            cristalHeladoNodes.map((node) => {
              const pos = node
              const isCurrentNode = node.slug === currentLocationSlug
              const isSelectedNode = node.slug === selectedNodeSlug
              const nodeOptions = getNodeOptions?.(node.slug) ?? []
              const isExpanded = expandedNodeSlug === node.slug
              const selectThisNode = () => {
                setSelectedNodeSlug(node.slug)
                if (nodeOptions.length <= 1) {
                  setExpandedNodeSlug(null)
                  nodeOptions[0]?.onSelect()
                } else {
                  setExpandedNodeSlug((prev) => (prev === node.slug ? null : node.slug))
                }
              }
              return (
                <g
                  key={`${node.slug}-${isCurrentNode}`}
                  data-aqui={isCurrentNode ? 'nodo' : undefined}
                  role="button"
                  tabIndex={0}
                  className={`tactile cursor-pointer outline-none${isCurrentNode ? ' animate-pop-once' : ''}`}
                  style={{ transformBox: 'fill-box', transformOrigin: 'center' } as React.CSSProperties}
                  onClick={(e) => {
                    e.stopPropagation()
                    selectThisNode()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      selectThisNode()
                    }
                  }}
                >
                  <title>{isCurrentNode ? 'Estás aquí' : node.name}</title>
                  {isCurrentNode ? (
                    <g>
                      <clipPath id={`current-node-badge-clip-${node.slug}`}>
                        <circle cx={pos.x} cy={pos.y} r={2.61} />
                      </clipPath>
                      <circle cx={pos.x} cy={pos.y} r={2.61} fill="#d4af37" stroke="white" strokeWidth={0.57} />
                      <g clipPath={`url(#current-node-badge-clip-${node.slug})`}>
                        <circle cx={pos.x} cy={pos.y - 0.86} r={0.9} fill="white" />
                        <circle cx={pos.x} cy={pos.y + 2.7} r={1.89} fill="white" />
                      </g>
                    </g>
                  ) : (
                    <>
                      <circle cx={pos.x} cy={pos.y} r={2.0} fill="rgba(10,8,6,0.55)" />
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={1.35}
                        fill={isSelectedNode ? 'var(--color-accent2-600)' : 'var(--color-wood-300)'}
                        stroke="var(--color-iron-700)"
                        strokeWidth={0.5}
                      />
                    </>
                  )}
                  {isExpanded &&
                    nodeOptions.map((opt, i) => {
                      const offset = paletteOffsets(nodeOptions.length)[i]
                      const ox = pos.x + offset.x
                      const oy = pos.y + offset.y
                      return (
                        <g
                          key={opt.id}
                          className="tactile cursor-pointer outline-none"
                          style={{ transformBox: 'fill-box', transformOrigin: 'center' } as React.CSSProperties}
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedNodeSlug(null)
                            opt.onSelect()
                          }}
                        >
                          <title>{opt.label}</title>
                          <line x1={pos.x} y1={pos.y} x2={ox} y2={oy} stroke="var(--color-accent2-500)" strokeWidth={0.35} opacity={0.6} />
                          <circle cx={ox} cy={oy} r={2.4} fill="var(--color-wood-950)" stroke="var(--color-accent2-500)" strokeWidth={0.5} />
                          <text x={ox} y={oy} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 2.4 }}>
                            {opt.icon}
                          </text>
                        </g>
                      )
                    })}
                </g>
              )
            })}

          {/* Barra de escala del núcleo — escala real 1:1 confirmada por la propia barra de
              Azgaar (docs/map), ya no una escala inferida por estiramiento. */}
          {showLlanurasGraph && (
            <g className="pointer-events-none">
              <line
                x1={LLANURAS_SHAPE_BBOX.x0 + 8}
                y1={LLANURAS_SHAPE_BBOX.y1 - 8}
                x2={LLANURAS_SHAPE_BBOX.x0 + 8 + LLANURAS_SCALE_BAR_KM}
                y2={LLANURAS_SHAPE_BBOX.y1 - 8}
                stroke="var(--color-wood-300)"
                strokeWidth={0.8}
              />
              <line
                x1={LLANURAS_SHAPE_BBOX.x0 + 8}
                y1={LLANURAS_SHAPE_BBOX.y1 - 10.5}
                x2={LLANURAS_SHAPE_BBOX.x0 + 8}
                y2={LLANURAS_SHAPE_BBOX.y1 - 5.5}
                stroke="var(--color-wood-300)"
                strokeWidth={0.8}
              />
              <line
                x1={LLANURAS_SHAPE_BBOX.x0 + 8 + LLANURAS_SCALE_BAR_KM}
                y1={LLANURAS_SHAPE_BBOX.y1 - 10.5}
                x2={LLANURAS_SHAPE_BBOX.x0 + 8 + LLANURAS_SCALE_BAR_KM}
                y2={LLANURAS_SHAPE_BBOX.y1 - 5.5}
                stroke="var(--color-wood-300)"
                strokeWidth={0.8}
              />
              <text
                x={LLANURAS_SHAPE_BBOX.x0 + 8 + LLANURAS_SCALE_BAR_KM / 2}
                y={LLANURAS_SHAPE_BBOX.y1 - 2}
                textAnchor="middle"
                className="fill-wood-400"
                style={{ fontSize: 5 }}
              >
                ~{LLANURAS_SCALE_BAR_KM} km
              </text>
            </g>
          )}
        </svg>
      </div>

      {showLlanurasGraph && selectedNode && (
        <div className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
          <p className="flex items-center gap-2 font-medium text-wood-100">
            {selectedNode.slug === currentLocationSlug && <span className="gem2" />}
            {selectedNode.name}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-wood-400">{selectedNode.description}</p>
        </div>
      )}

      {(() => {
        const e = expediciones.find((x) => x.id === expedicionVista)
        if (!e) return null
        return (
          <div role="region" aria-label="Expedición" className="rounded-lg border border-quest-600/50 bg-wood-950/40 px-3.5 py-2.5 text-xs text-wood-300">
            <p className="font-medium text-wood-100">⚑ {e.delReino ? 'Tu expedición' : `Expedición de ${e.faccion}`}</p>
            <p className="mt-1">
              {e.progreso > 0.5 ? `Vuelve de ${e.destinoNombre}` : `Va a ${e.destinoNombre}`} ({e.oficio}
              {e.motivo === 'COMIDA' ? ', a por comida' : ''}) · de vuelta el día {e.diaRegreso + 1}
            </p>
          </div>
        )
      })()}

      {selected && (
        <div className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
          <p className="flex items-center gap-2 font-medium text-wood-100">
            {selected.name === currentRegion && <span className="gem2" />}
            {selected.name}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-wood-400">{selected.description}</p>
          {rumores.some((r) => r.region === selected.name) && (
            <ul aria-label={`Rumores de ${selected.name}`} className="mt-2 flex flex-col gap-1 border-t border-iron-800 pt-2">
              {rumores
                .filter((r) => r.region === selected.name)
                .map((r) => (
                  <li key={r.sucesoId} className="text-xs italic text-wood-300">
                    <span aria-hidden="true" className="mr-1 not-italic">📜</span>
                    {r.texto}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {showZoomModal && (
        <MapZoomModal
          onClose={() => setShowZoomModal(false)}
          llanurasNodes={hasLlanurasMap ? llanurasNodes : undefined}
          llanurasEdges={hasLlanurasMap ? llanurasEdges : undefined}
          cristalHeladoNodes={hasCristalHeladoMap ? cristalHeladoNodes : undefined}
          currentLocationSlug={currentLocationSlug}
          questTargetLocationSlug={questTargetLocationSlug}
          getNodeOptions={getNodeOptions}
          buildingIconBySlug={buildingIconBySlug}
        />
      )}
    </div>
  )
}
