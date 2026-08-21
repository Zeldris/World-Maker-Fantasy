import { useMemo, useRef, useState } from 'react'
import berigMapUrl from '../../assets/maps/helek-sirik-berig.png'
import { projectLlanurasNodes, type LlanurasEdge, type LlanurasNode, type MapNodeOption } from '../../data/map'

interface MapZoomModalProps {
  onClose: () => void
  /// Grafo real de Llanuras (petición explícita, 2026-07-23: "en el mapa completo también estaría
  /// bien los puntos con las ubicaciones") — mismos datos que ya recibía el mapa pequeño, para
  /// poder usar el visor ampliado como herramienta real de consulta de todas las ubicaciones.
  llanurasNodes?: LlanurasNode[]
  llanurasEdges?: LlanurasEdge[]
  currentLocationSlug?: string | null
  /// Punto 3 del diseño de Gistera Koh (2026-07-23) — mismo dato que ya recibe el mapa pequeño
  /// (InteractiveMap.tsx), para que el "!" de misión también se vea en el visor ampliado.
  questTargetLocationSlug?: string | null
  /// Paleta de puntos (2026-08-04, ver InteractiveMap.tsx) — mismo contrato que el mapa pequeño,
  /// replicado aquí porque ambos componentes dibujan los nodos por separado.
  getNodeOptions?: (slug: string) => MapNodeOption[]
  buildingIconBySlug?: Map<string, string>
}

// Paleta de puntos — mismas proporciones relativas que InteractiveMap.tsx, pero en las unidades
// base de este componente (radios ya definidos más abajo, NODE_HALO_R≈6.5) y divididas entre
// `scale` como el resto de la insignia para que no crezca al hacer zoom. Reducido en la misma
// proporción que InteractiveMap.tsx (auditoría de deuda técnica 2026-08-04) — aquí el riesgo real
// de invadir el icono de un nodo vecino es menor que en el mapa pequeño porque este componente sí
// tiene una vía de escape real (hacer zoom separa visualmente los nodos del racimo denso, cosa que
// el mapa pequeño no puede hacer), pero se ajusta igual para quedar consistente.
const PALETTE_RADIUS = 10
const PALETTE_ANGLE_START = 200
const PALETTE_ANGLE_END = 340

function paletteOffsets(count: number): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const angleDeg = count === 1 ? 270 : PALETTE_ANGLE_START + (i * (PALETTE_ANGLE_END - PALETTE_ANGLE_START)) / (count - 1)
    const rad = (angleDeg * Math.PI) / 180
    return { x: PALETTE_RADIUS * Math.cos(rad), y: PALETTE_RADIUS * Math.sin(rad) }
  })
}

const MIN_SCALE = 1
const MAX_SCALE = 6
const ZOOM_STEP = 0.5
const WHEEL_SENSITIVITY = 0.0015
// Radio base de los puntos en unidades del lienzo (800×600) a escala 1 — se divide entre `scale`
// al dibujar para que el tamaño EN PANTALLA se quede fijo según se hace zoom (petición explícita,
// 2026-07-23: "quiero que segun hagas zoom el punto se adapte con el mismo tamaño relativo, no que
// crezca"), en vez de crecer junto con el resto del mapa como el resto de la imagen.
const NODE_HALO_R = 6.5
const NODE_HALO_R_CURRENT = 7.8
const NODE_R = 4.5
// Área de clic invisible, más grande que el halo visible (petición explícita, 2026-07-23: "que
// sean clickables") — el punto ya llamaba a `onNodeDetail` al pulsarlo, pero a este tamaño el
// halo real es un blanco muy pequeño para el ratón/dedo.
const NODE_HIT_R = 11

// Visor ampliable del mapa real (roadmap "atlas Azgaar", 2026-07-22): el PNG que exporta Azgaar
// cubre el mundo entero a resolución fija — dentro del panel pequeño se ve bien porque nunca se
// muestra grande, pero si alguien quiere leer el detalle real (nombres de poblado, texto de
// región) hace falta un visor aparte con zoom/paneo, no estirar la misma imagen pequeña. La
// imagen se ajusta con `object-contain` como base ("100%" = todo el mapa visible) y el estado de
// zoom/paneo se aplica ENCIMA con un transform de CSS — así no hace falta medir el contenedor a
// mano para calcular el "ajuste inicial".
export function MapZoomModal({
  onClose,
  llanurasNodes,
  llanurasEdges,
  currentLocationSlug,
  questTargetLocationSlug,
  getNodeOptions,
  buildingIconBySlug,
}: MapZoomModalProps) {
  const [scale, setScale] = useState(MIN_SCALE)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null)
  const [expandedNodeSlug, setExpandedNodeSlug] = useState<string | null>(null)

  const nodePositions = useMemo(() => (llanurasNodes ? projectLlanurasNodes(llanurasNodes) : null), [llanurasNodes])
  const showGraph = nodePositions && llanurasNodes && llanurasEdges

  function clampScale(s: number) {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))
  }

  function reset() {
    setScale(MIN_SCALE)
    setOffset({ x: 0, y: 0 })
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    setScale((s) => clampScale(s - e.deltaY * WHEEL_SENSITIVITY * s))
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, startOffsetX: offset.x, startOffsetY: offset.y }
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    setOffset({
      x: dragRef.current.startOffsetX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.startOffsetY + (e.clientY - dragRef.current.startY),
    })
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current) e.currentTarget.releasePointerCapture(e.pointerId)
    dragRef.current = null
    setIsDragging(false)
  }

  return (
    <div className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="plank-panel animate-combat-enter relative flex h-[88vh] w-full max-w-5xl flex-col gap-3 rounded-xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-lg text-wood-100">Mapa completo</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setScale((s) => clampScale(s - ZOOM_STEP))}
              className="tactile rounded-lg border border-iron-700 px-2.5 py-1 text-sm text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300"
              aria-label="Alejar"
            >
              −
            </button>
            <span className="w-12 text-center text-xs text-wood-400">{Math.round((scale / MIN_SCALE) * 100)}%</span>
            <button
              onClick={() => setScale((s) => clampScale(s + ZOOM_STEP))}
              className="tactile rounded-lg border border-iron-700 px-2.5 py-1 text-sm text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300"
              aria-label="Acercar"
            >
              +
            </button>
            <button
              onClick={reset}
              className="tactile rounded-lg border border-iron-700 px-2.5 py-1 text-xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300"
            >
              Restablecer
            </button>
            <button
              onClick={onClose}
              className="tactile rounded-lg border border-iron-700 bg-wood-950/50 px-2.5 py-1 text-xs text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300"
            >
              Cerrar ✕
            </button>
          </div>
        </div>

        <div
          className="relative flex-1 touch-none overflow-hidden rounded-lg bg-wood-950/60"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onDragStart={(e) => e.preventDefault()}
          onClick={() => setExpandedNodeSlug(null)}
        >
          <div
            className="absolute inset-0"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: 'center center' }}
          >
            {/* `draggable={false}` no basta por sí solo en todos los navegadores para bloquear el
                drag-and-drop nativo de imágenes (bug real: arrastrar para paear abría la imagen en
                otra pestaña) — `-webkit-user-drag: none` + `onDragStart` en la propia imagen es el
                mismo refuerzo ya aplicado al mapa pequeño en InteractiveMap.tsx. */}
            <img
              src={berigMapUrl}
              alt="Mapa completo de Helek Sirik (Vaelira y Berig)"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              className="pointer-events-none h-full w-full select-none object-contain"
              style={{ WebkitUserDrag: 'none' } as React.CSSProperties}
            />

            {/* Puntos de ubicaciones (petición explícita, 2026-07-23) — mismo lienzo 800×600 que
                la imagen, superpuesto con `preserveAspectRatio` por defecto (equivalente a
                `object-contain`) para que ambos coincidan pixel a pixel. Los radios se dividen
                entre `scale` para que el tamaño EN PANTALLA no crezca con el zoom (a diferencia
                del resto del mapa, que sí escala junto con la imagen). */}
            {showGraph && (
              <svg viewBox="0 0 800 600" className="pointer-events-none absolute inset-0 h-full w-full">
                {llanurasEdges.map((edge) => {
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
                      // Mismo bug que InteractiveMap.tsx: `--color-iron-600` no existe en
                      // index.css, dejaba el stroke inválido y la línea invisible (2026-08-05).
                      stroke="var(--color-wood-300)"
                      strokeWidth={0.6 / scale}
                      strokeDasharray={edge.riesgo ? `${2 / scale} ${1.5 / scale}` : undefined}
                      opacity={0.75}
                    />
                  )
                })}
                {llanurasNodes.map((node) => {
                  const pos = nodePositions.get(node.slug)
                  if (!pos) return null
                  const isCurrentNode = node.slug === currentLocationSlug
                  const isQuestTarget = node.slug === questTargetLocationSlug
                  const buildingIcon = buildingIconBySlug?.get(node.slug)
                  const nodeOptions = getNodeOptions?.(node.slug) ?? []
                  const isExpanded = expandedNodeSlug === node.slug
                  // Mismo criterio que InteractiveMap.tsx (auditoría de deuda técnica 2026-08-21) —
                  // un solo cuerpo compartido por onClick/onKeyDown, antes duplicado literal.
                  const selectThisNode = () => {
                    if (nodeOptions.length <= 1) {
                      setExpandedNodeSlug(null)
                      nodeOptions[0]?.onSelect()
                    } else {
                      setExpandedNodeSlug((prev) => (prev === node.slug ? null : node.slug))
                    }
                  }
                  return (
                    <g
                      key={node.slug}
                      role="button"
                      tabIndex={0}
                      className="pointer-events-auto cursor-pointer outline-none"
                      onPointerDown={(e) => e.stopPropagation()}
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
                      <circle cx={pos.x} cy={pos.y} r={NODE_HIT_R / scale} fill="transparent" />
                      {isCurrentNode ? (
                        // Insignia "aquí ahora" (petición explícita, 2026-07-23: icono tipo
                        // contacto de móvil, persona en blanco sobre interior dorado con borde
                        // blanco) — mismo tratamiento que el nodo actual en el mapa pequeño
                        // (InteractiveMap.tsx), con los radios divididos entre `scale` como el
                        // resto de la insignia para que no crezca al hacer zoom.
                        <g>
                          <clipPath id={`zoom-current-node-clip-${node.slug}`}>
                            <circle cx={pos.x} cy={pos.y} r={NODE_HALO_R_CURRENT / scale} />
                          </clipPath>
                          <circle cx={pos.x} cy={pos.y} r={NODE_HALO_R_CURRENT / scale} fill="#d4af37" stroke="white" strokeWidth={0.9 / scale} />
                          <g clipPath={`url(#zoom-current-node-clip-${node.slug})`}>
                            <circle cx={pos.x} cy={pos.y - 1.4 / scale} r={1.5 / scale} fill="white" />
                            <circle cx={pos.x} cy={pos.y + 4.4 / scale} r={3.1 / scale} fill="white" />
                          </g>
                        </g>
                      ) : (
                        <>
                          <circle cx={pos.x} cy={pos.y} r={NODE_HALO_R / scale} fill="rgba(10,8,6,0.55)" />
                          <circle
                            cx={pos.x}
                            cy={pos.y}
                            r={NODE_R / scale}
                            fill="var(--color-wood-300)"
                            stroke="var(--color-iron-700)"
                            strokeWidth={0.8 / scale}
                          />
                        </>
                      )}
                      {isQuestTarget && (
                        // Marca de misión (punto 3 del diseño de Gistera Koh, 2026-07-23) — mismo
                        // tratamiento que en el mapa pequeño, con los radios/offset divididos entre
                        // `scale` para que no crezca al hacer zoom.
                        <g className="pointer-events-none">
                          <circle
                            cx={pos.x + 5.5 / scale}
                            cy={pos.y - 5.5 / scale}
                            r={4.5 / scale}
                            fill="#7f1d1d"
                            stroke="white"
                            strokeWidth={1 / scale}
                          />
                          <text
                            x={pos.x + 5.5 / scale}
                            y={pos.y - 5.5 / scale}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="white"
                            style={{ fontSize: 7 / scale, fontWeight: 700 }}
                          >
                            !
                          </text>
                        </g>
                      )}
                      {buildingIcon && (
                        // Badge de construcción (2026-08-04) — abajo-derecha, mismo criterio que
                        // el mapa pequeño (InteractiveMap.tsx) para no pisar los otros dos badges.
                        <g className="pointer-events-none">
                          <circle
                            cx={pos.x + 5.5 / scale}
                            cy={pos.y + 5.5 / scale}
                            r={4.5 / scale}
                            fill="var(--color-wood-800)"
                            stroke="white"
                            strokeWidth={1 / scale}
                          />
                          <text
                            x={pos.x + 5.5 / scale}
                            y={pos.y + 5.7 / scale}
                            textAnchor="middle"
                            dominantBaseline="central"
                            style={{ fontSize: 5.5 / scale }}
                          >
                            {buildingIcon}
                          </text>
                        </g>
                      )}
                      {isExpanded &&
                        nodeOptions.map((opt, i) => {
                          const offset = paletteOffsets(nodeOptions.length)[i]
                          const ox = pos.x + offset.x / scale
                          const oy = pos.y + offset.y / scale
                          return (
                            <g
                              key={opt.id}
                              className="pointer-events-auto cursor-pointer outline-none"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedNodeSlug(null)
                                opt.onSelect()
                              }}
                            >
                              <title>{opt.label}</title>
                              <line
                                x1={pos.x}
                                y1={pos.y}
                                x2={ox}
                                y2={oy}
                                stroke="var(--color-accent2-500)"
                                strokeWidth={0.9 / scale}
                                opacity={0.6}
                              />
                              <circle cx={ox} cy={oy} r={6.5 / scale} fill="var(--color-wood-950)" stroke="var(--color-accent2-500)" strokeWidth={1 / scale} />
                              <text x={ox} y={oy} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 6.5 / scale }}>
                                {opt.icon}
                              </text>
                            </g>
                          )
                        })}
                    </g>
                  )
                })}
              </svg>
            )}
          </div>
        </div>

        <p className="text-center text-2xs text-wood-500">Arrastra para moverte · rueda del ratón o +/− para hacer zoom</p>
      </div>
    </div>
  )
}
