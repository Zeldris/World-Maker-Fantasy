import { useEffect, useMemo, useState } from 'react'
import type { ExpedicionEnMapa } from '../../lib/api'
import { posicionDeExpedicion } from '../../lib/leyendas'
import { projectLlanurasNodes, type LlanurasEdge, type LlanurasNode, type CristalHeladoNode, type MapNodeOption, type MapRegion } from '../../data/map'
import berigMapUrl from '../../assets/maps/helek-sirik-berig.png'
import { MapZoomModal } from './MapZoomModal'
import type { RumorConLugar } from '../../lib/leyendas'

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

// Fronteras políticas REALES (roadmap "atlas Azgaar", 2026-07-21/22): ya no son formas dibujadas a
// mano — son los paths de estado tal cual salieron del .map real que la usuaria recreó en Azgaar
// (docs/map/Helek_World.map), en el mismo sistema de coordenadas que la imagen de fondo
// (helek-sirik-berig.png, lienzo de 800×600, 1 unidad ≈ 1 km real según la propia barra de escala
// de Azgaar). Solo sirven de región de clic/resalte — el color y la textura de terreno ya vienen
// pintados en la imagen, esto no dibuja nada por sí solo salvo el borde en hover/selección.
const SHAPES: Shape[] = [
  {
    name: 'Cristal Helado',
    d: 'M607,24 L605,29 604,29 601,28 600,28 599,31 595,31 594,34 590,35 589,36 589,36 586,40 583,41 582,41 578,42 576,42 576,41 572,40 572,40 570,39 566,40 562,37 559,39 559,39 556,41 552,40 551,41 546,40 546,40 544,41 543,41 539,46 535,47 535,47 532,48 530,47 526,48 524,52 529,55 524,59 525,61 523,63 524,65 523,68 520,69 520,73 520,73 519,77 519,78 517,81 514,82 514,83 511,84 511,87 509,89 506,90 504,92 504,94 505,97 505,98 507,101 504,103 505,106 504,109 504,111 505,111 505,112 501,117 506,122 506,122 507,123 513,127 517,125 519,125 520,126 527,126 528,125 530,125 533,128 534,129 539,130 542,127 546,127 547,128 548,128 553,125 554,126 558,131 561,130 564,125 566,125 570,129 574,128 575,128 576,129 581,133 583,130 586,129 590,134 595,129 599,132 599,132 605,130 608,130 609,131 613,132 615,133 617,137 623,137 624,136 628,136 632,139 637,139 638,137 644,136 648,139 652,137 652,137 652,136 653,133 656,129 660,135 664,132 666,132 667,136 675,137 675,137 677,136 680,132 681,131 683,131 683,131 692,134 693,132 693,128 701,128 701,126 701,122 702,120 704,118 705,117 706,115 706,115 704,110 703,109 701,106 701,102 700,100 700,99 700,98 700,94 701,92 705,90 706,87 706,86 707,83 708,79 707,78 704,75 704,75 701,74 701,72 702,67 702,65 701,65 700,62 699,61 698,55 698,54 697,54 693,51 692,49 691,48 691,48 687,45 686,42 686,41 685,38 684,38 683,35 681,33 680,29 679,28 677,28 674,29 671,28 669,26 669,25 667,23 665,22 663,23 661,23 661,23 658,22 657,22 653,22 652,21 649,20 649,20 648,20 648,19 643,18 641,19 640,19 635,21 635,21 630,21 629,19 626,22 622,20 622,19 620,19 618,19 614,20 613,21 609,21 609,21 607,24 Z',
    labelX: 604.5,
    labelY: 132,
  },
  {
    name: 'Las Llanuras del Viento Rojo',
    d: 'M498,121 L498,118 498,118 501,117 506,122 506,122 507,123 513,127 517,125 519,125 520,126 527,126 528,125 530,125 533,128 534,129 539,130 542,127 546,127 547,128 548,128 553,125 554,126 558,131 561,130 564,125 566,125 570,129 574,128 575,128 576,129 581,133 581,136 582,136 582,145 583,146 582,151 581,155 581,156 585,158 585,159 582,164 581,166 581,170 582,172 581,178 588,183 588,184 586,187 588,194 589,195 589,200 588,201 587,201 585,202 583,208 580,210 581,216 580,217 580,220 582,222 588,224 589,227 588,228 587,233 588,234 589,240 586,242 587,248 591,250 589,256 588,256 584,257 583,259 578,262 574,256 570,257 568,262 563,260 558,263 555,263 555,268 554,271 558,277 554,279 554,286 561,285 562,285 562,292 561,294 560,296 559,297 560,306 560,307 564,312 559,315 559,315 554,320 552,319 545,324 547,327 547,332 541,334 541,337 541,338 534,340 534,340 526,341 524,340 521,342 525,351 523,352 516,345 513,346 514,353 514,354 515,359 512,361 510,368 510,368 510,368 506,366 502,368 499,366 499,365 496,363 496,362 493,360 491,360 488,359 488,358 484,357 483,354 485,351 485,351 487,348 487,346 491,343 491,342 492,340 492,337 493,336 494,332 493,331 493,328 489,325 489,321 489,320 490,318 491,317 492,314 494,312 494,311 491,307 490,307 487,303 487,303 487,302 487,298 487,297 491,295 491,292 490,291 489,288 489,288 486,283 486,283 483,278 483,278 485,276 486,272 486,272 486,267 487,266 483,262 482,262 479,259 479,259 475,256 476,255 474,251 474,250 471,246 472,246 470,242 469,241 468,240 471,237 470,234 472,232 470,228 468,228 465,226 464,222 464,222 464,221 465,218 465,215 469,213 468,210 470,208 470,206 471,205 471,204 473,200 475,200 477,197 478,196 480,193 480,193 484,190 484,188 486,186 486,183 489,180 490,178 492,176 492,172 491,171 492,166 491,165 492,162 491,162 491,159 492,157 490,154 492,150 491,148 492,146 491,144 491,140 492,138 492,135 492,135 491,133 491,129 490,128 490,124 494,123 494,123 498,121 Z',
    labelX: 527.5,
    labelY: 130,
  },
  {
    name: 'Ciénaga Troncal',
    d: 'M699,132 L701,129 701,128 693,128 693,132 692,134 683,131 683,131 681,131 680,132 677,136 675,137 675,137 667,136 666,132 664,132 660,135 656,129 653,133 652,136 652,137 652,137 648,139 644,136 638,137 637,139 632,139 628,136 624,136 623,137 617,137 615,133 613,132 609,131 608,130 605,130 599,132 599,132 595,129 590,134 586,129 583,130 581,133 581,136 582,136 582,145 583,146 582,151 581,155 581,156 585,158 585,159 582,164 581,166 581,170 582,172 581,178 588,183 588,184 586,187 588,194 589,195 589,200 588,201 587,201 585,202 583,208 580,210 581,216 580,217 580,220 582,222 588,224 589,227 588,228 587,233 588,234 589,240 586,242 587,248 591,250 589,256 588,256 584,257 583,259 578,262 574,256 570,257 568,262 563,260 558,263 555,263 555,268 554,271 558,277 554,279 554,286 561,285 562,285 562,292 569,292 570,291 573,291 576,293 580,292 583,293 588,291 589,290 593,291 596,293 599,292 608,297 609,296 611,297 615,297 617,296 622,301 624,301 627,303 628,303 630,303 633,297 637,298 638,299 638,303 644,305 646,302 653,305 653,306 655,306 661,302 664,302 665,308 673,306 674,302 679,301 681,303 683,302 687,307 691,305 692,306 700,302 701,303 707,302 707,301 714,299 713,295 713,295 711,292 712,291 711,288 712,286 712,285 714,282 713,280 708,279 707,276 708,275 716,276 716,273 715,271 716,268 715,266 715,265 712,260 713,259 714,256 713,255 714,252 713,251 714,247 712,243 710,243 707,240 708,238 707,236 709,232 706,229 707,228 704,224 704,223 706,221 707,220 708,217 707,215 708,213 706,209 707,207 705,205 705,205 703,201 703,201 702,200 698,197 700,191 699,189 700,184 699,183 699,182 698,178 699,176 699,176 699,172 701,170 700,169 699,167 699,163 700,161 702,161 702,160 703,155 702,154 702,154 699,151 698,148 700,146 700,143 700,142 699,139 700,136 699,135 699,132 Z',
    labelX: 635,
    labelY: 218,
  },
  {
    name: 'El Margen Silencioso',
    d: 'M562,292 L561,294 560,296 559,297 560,306 560,307 564,312 559,315 559,315 554,320 552,319 545,324 547,327 547,332 541,334 541,337 541,338 534,340 534,340 526,341 524,340 521,342 525,351 523,352 516,345 513,346 514,353 514,354 515,359 512,361 510,368 510,368 510,368 506,366 502,368 502,371 500,372 498,376 498,376 495,381 495,381 492,386 496,389 497,390 499,393 499,393 501,392 506,394 507,389 512,389 514,388 516,388 517,387 526,385 527,382 532,382 535,379 539,379 540,372 542,371 544,371 545,368 549,365 549,360 553,360 555,358 560,359 562,359 564,359 569,357 574,361 576,360 578,355 581,353 583,354 587,353 590,345 589,344 589,340 596,337 600,340 602,339 602,335 608,332 611,333 614,332 616,333 618,339 619,340 621,340 624,337 626,333 631,332 632,333 633,334 640,337 641,338 645,343 649,340 653,341 657,341 658,340 664,340 665,333 670,334 674,331 679,334 680,333 682,326 686,325 687,324 691,325 693,327 699,325 700,328 707,327 707,324 707,322 707,319 706,316 706,315 707,315 707,311 707,309 709,305 707,302 701,303 700,302 692,306 691,305 687,307 683,302 681,303 679,301 674,302 673,306 665,308 664,302 661,302 655,306 653,306 653,305 646,302 644,305 638,303 638,299 637,298 633,297 630,303 628,303 627,303 624,301 622,301 617,296 615,297 611,297 609,296 608,297 599,292 596,293 593,291 589,290 588,291 583,293 580,292 576,293 573,291 570,291 569,292 562,292 Z',
    labelX: 600.5,
    labelY: 342,
  },
  {
    name: 'La Meseta del Orden',
    d: 'M682,326 L686,325 687,324 691,325 693,327 699,325 700,328 707,327 707,327 707,330 706,332 706,335 709,338 709,340 711,342 711,343 712,345 712,349 712,350 710,351 708,355 707,356 706,359 706,360 705,360 703,363 702,366 700,367 698,370 698,372 695,374 695,377 693,379 693,380 693,381 694,385 692,387 691,390 689,391 689,395 684,396 684,398 684,399 684,402 684,403 685,406 681,410 681,410 678,413 678,413 676,415 674,416 671,418 670,419 669,423 671,426 671,427 672,429 672,432 673,433 672,438 670,439 668,439 667,440 663,442 662,441 659,446 660,447 658,451 658,452 658,454 653,458 653,457 649,457 649,457 645,456 641,459 641,459 640,459 638,462 637,462 634,465 632,465 631,468 630,468 629,472 626,473 625,473 620,476 620,477 618,480 616,482 616,483 614,485 613,485 609,488 609,489 606,493 603,491 600,492 598,490 596,487 593,486 593,482 588,478 588,478 586,484 590,487 590,487 587,491 583,490 583,490 579,489 578,490 575,489 573,489 571,488 571,489 566,486 566,483 563,482 561,480 560,479 560,478 555,474 553,476 550,476 548,477 547,478 544,477 543,477 541,477 537,480 537,481 534,482 533,484 528,484 528,484 523,484 523,484 523,484 519,481 515,484 515,484 513,486 508,485 508,485 503,482 502,483 498,480 497,481 495,479 492,479 490,476 491,473 492,473 493,469 491,466 491,466 491,462 489,460 490,455 490,455 491,451 491,451 493,446 493,444 493,441 493,440 493,438 494,434 494,434 496,433 498,431 498,427 499,425 499,425 498,421 497,420 496,415 496,415 497,412 497,411 499,409 500,405 500,404 499,399 500,399 499,393 501,392 506,394 507,389 512,389 514,388 516,388 517,387 526,385 527,382 532,382 535,379 539,379 540,372 542,371 544,371 545,368 549,365 549,360 553,360 555,358 560,359 562,359 564,359 569,357 574,361 576,360 578,355 581,353 583,354 587,353 590,345 589,344 589,340 596,337 600,340 602,339 602,335 608,332 611,333 614,332 616,333 618,339 619,340 621,340 624,337 626,333 631,332 632,333 633,334 640,337 641,338 645,343 649,340 653,341 657,341 658,340 664,340 665,333 670,334 674,331 679,334 680,333 682,326 Z',
    labelX: 600.5,
    labelY: 470,
  },
]

// Recorte real de Berig dentro del lienzo completo de Azgaar (800×600, mundo entero con Vaelira
// + estrecho). Calculado a partir de los propios paths de estado de arriba, con ~18-19 unidades
// de margen por cada lado — ya no es una composición inventada, es la silueta real que pintó la
// usuaria menos el margen de mar sobrante.
const BERIG_VIEWBOX = { x: 445, y: 0, width: 290, height: 510 }

// Bbox real del estado Llanuras del Viento Rojo (id state18 en el .map) — solo para posicionar la
// barra de escala del núcleo cerca de su esquina, ya no como rectángulo de destino a estirar.
const LLANURAS_SHAPE_BBOX = { x0: 464, y0: 117, x1: 591, y1: 368 }

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
const CRISTAL_HELADO_SHAPE_BBOX = { x0: 501, y0: 18, x1: 708, y1: 139 }
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
                  <g className="pointer-events-none" transform={`translate(${shape.labelX} ${shape.labelY + 20})`}>
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
                  aria-label={`Expedición de ${e.faccion}`}
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
                  <circle cx={pos.x} cy={pos.y} r={2.2} fill={e.delReino ? 'var(--color-accent-600)' : 'var(--color-wood-900)'} stroke="var(--color-quest-300)" strokeWidth={0.45} />
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
