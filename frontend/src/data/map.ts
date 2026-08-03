export interface MapRegion {
  name: string
  description: string
}

export interface LlanurasNode {
  slug: string
  name: string
  description: string
  x: number
  y: number
}

export interface LlanurasEdge {
  fromSlug: string
  toSlug: string
  /// true = arista con riesgo anotado en LocationLink (tormentas, patrullas, fauna...) — se
  /// dibuja discontinua; sin riesgo, sólida.
  riesgo: boolean
}

// Contenido tomado de docs/rpgtarkor/areas.md — condensado para la UI. Berig es el continente
// de Gorhorn (único personaje probado hasta ahora); Vaelira se añadirá cuando haga falta. Sin
// equivalente en el backend (no hay modelo Region en Prisma, es lore de continente, no de
// ubicación jugable) — se queda a mano a propósito, no es duplicación de una fuente de verdad.
export const beriRegions: MapRegion[] = [
  {
    name: 'Las Llanuras del Viento Rojo',
    description: 'Estepa infinita de tierra rojiza, volcanes lejanos, tormentas de arena magnética. Territorio del Clan Maktor (extinto) y el Clan Serhu.',
  },
  {
    name: 'La Meseta del Orden',
    description: 'Ciudades-fortaleza Goirntes de piedra pulida y hierro negro. El corazón de la Concordia de Hierro.',
  },
  {
    name: 'Cristal Helado',
    description: 'Montañas heladas, en gran parte inexploradas. Territorio del Clan Helsig — Gorhorn tiene un amigo aquí (Hagar).',
  },
  {
    name: 'Ciénaga Troncal',
    description: 'Terreno húmedo y en gran parte inhabitable. Territorio del Clan Goshg — Gorhorn nunca ha estado.',
  },
  {
    name: 'El Margen Silencioso',
    description:
      'Selva y pantano donde el sonido se apaga de forma antinatural. Nabieus al este (hasta el borde de Ciénaga Troncal), Faerus en el resto de la región (con puestos avanzados hacia las Llanuras, al oeste).',
  },
]

// Geometría medida a mano del núcleo de Llanuras (docs/13-escala-del-mundo.md § 1.1, triangulada
// desde las aristas reales de LocationLink) — el backend (modelo Location) no guarda coordenadas
// de mapa, así que esta tabla sigue siendo la única fuente de verdad para dibujarlo. El nombre,
// descripción y aristas de cada nodo YA NO se duplican aquí a mano: MapaPanel los pide en tiempo
// real a GET /world/:slug/locations (ver lib/api.ts, getWorldLocations) y los combina con esta
// tabla por slug — así el mapa nunca puede desincronizarse del catálogo real del backend.
// Calibración real (roadmap "atlas Azgaar", 2026-07-21/22): burg612 "Campamento del Clan Serhu"
// en el .map real de la usuaria cae en (534.6141357421875, 185.10536193847656) — coincide con el
// nodo campamento-serhu del núcleo medido (docs/13-escala-del-mundo.md § 1.1: x=21, y=-5 en km).
// Con esa correspondencia + la escala 1:1 de la propia barra de escala de Azgaar (200km ≈ 202
// unidades del lienzo), el resto del núcleo se proyecta con un simple desplazamiento. Vive aquí
// (no en InteractiveMap.tsx) para que MapZoomModal.tsx pueda dibujar los mismos puntos sobre el
// mapa completo sin duplicar la calibración ni crear un import circular entre ambos componentes.
//
// Bug real (auditoría 2026-08-03, "y el resto de zonas están bien?"): el offset de Y se despejó
// con el signo cambiado (`+5` en vez de `-5`) — con `+5`, el propio campamento-serhu (el nodo
// ancla) se proyectaba en (534.6, 195.1), 10 km al sur de su ancla real (534.6, 185.1). `-5` es
// el signo correcto: reproduce el ancla exacta.
//
// Intento fallido, mismo día — probado y revertido: mover TODO el bloque hacia el sur (offset Y a
// 335) para que el Cruce de las Cenizas quedara junto al borde real con El Margen Silencioso.
// Arreglaba el Cruce pero arrastraba a los otros 11 nodos, que ya estaban bien donde estaban —
// la usuaria lo pilló enseguida viendo el mapa ("las posiciones del resto de localizaciones
// estaban bien pero las has bajado... el cruce cenizas el que había que bajar"). El offset del
// bloque vuelve a depender solo del ancla real de campamento-serhu; ver más abajo cómo se movió
// el Cruce sin tocar el resto.
const LLANURAS_OFFSET_X = 534.6141357421875 - 21
const LLANURAS_OFFSET_Y = 185.10536193847656 - 5

/// docs/13-escala-del-mundo.md § 1.1: +x = este, +y = norte. El lienzo de Azgaar tiene el norte
/// arriba (y menor) igual que cualquier mapa estándar, así que solo hay que invertir el eje Y.
export function projectLlanurasNodes(nodes: LlanurasNode[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  for (const n of nodes) {
    positions.set(n.slug, { x: n.x + LLANURAS_OFFSET_X, y: LLANURAS_OFFSET_Y - n.y })
  }
  return positions
}

export const llanurasNodePositions: Record<string, { x: number; y: number }> = {
  'pilares-rotos': { x: 0, y: 0 },
  'pozo-cauce-viejo': { x: 13.5, y: 0 },
  // `y` (y `x`) NO son la distancia triangulada de docs/13-escala-del-mundo.md § 1.1 (esa sigue
  // siendo (0,-18), MEDIDO contra los tiempos de viaje reales de LocationLink, y no cambia — ver
  // esa tabla para la distancia de juego real Cruce↔Pilares/Pozo). Esta posición es SOLO visual
  // (2026-08-03, misma auditoría de mapa): decisión explícita de la usuaria de dejar de atar el
  // dibujo del Cruce a la triangulación real y ponerlo donde corresponde de verdad contra el PNG.
  // Primer intento (0,-180) lo pegaba al borde exterior; ajuste fino pedido por la usuaria
  // (flecha sobre una captura del mapa real) lo mete en la muesca donde El Margen Silencioso se
  // adentra más en Llanuras, justo frente a "Puesto Rabioso del Márgen" (burg ya nombrado así en
  // el .map real de Azgaar) — verificado renderizando sobre el PNG real con rsvg-convert. El
  // resto del núcleo no se toca. La mecánica de viaje no usa estas coordenadas (usa las horas/km
  // reales de LocationLink en la DB), así que este desacople no cambia ningún tiempo de viaje.
  'cruce-de-las-cenizas': { x: 20, y: -144 },
  'hondonada-del-eco': { x: 5, y: 7.5 },
  'campamento-serhu': { x: 21, y: -5 },
  'restos-de-maktor': { x: 10, y: 20.5 },
  'osario-de-la-manada': { x: 10.95, y: 7.6 },
  'agujas-iman': { x: -7, y: 8.3 },
  manaderos: { x: 18.1, y: 2.8 },
  'tumulos-del-honor': { x: 6.2, y: 5.6 },
  // Ampliación del núcleo (checklist 2026-07-21/22, "Puerta 2" — ver docs/13-escala-del-mundo.md
  // § 2.2 y su addendum): primeros dos nodos fuera del polígono original de 45×30 km.
  'pastos-de-la-deriva': { x: 30, y: -1 },
  'filo-de-las-brasas': { x: 16, y: 31 },
}
