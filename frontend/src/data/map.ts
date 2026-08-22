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

/// "Paleta de puntos" (2026-08-04, petición explícita: "que se abra una paleta de puntos como
/// selecciona un color de una paleta de colores") — cuando un nodo del mapa tiene más de una cosa
/// anclada (tu posición, la ubicación en sí, una construcción...), en vez de abrir directo se
/// despliegan estos satélites alrededor del punto y el jugador elige cuál ver en la Enciclopedia.
/// Vive aquí (no en InteractiveMap.tsx) para que MapZoomModal.tsx pueda compartir el mismo tipo
/// sin import circular entre ambos componentes de mapa.
export interface MapNodeOption {
  id: string
  icon: string
  label: string
  onSelect: () => void
}

/// Icono por receta de construcción (2026-08-04, "el campamento" — primera construcción anclada
/// al mapa) — misma `key` que ConstructionRecipe.key en el backend (construction.ts). Sin entrada
/// = construcción libre del modelo sin receta fija, no se pinta ningún icono especial para ella.
// 'ayuntamiento' (2026-08-04, renombrado desde 'atalaya' — docs/17-reglas-construcciones-reino.md)
// siempre guarda esta MISMA key sin importar el tier (pequeño/mediano/grande) — mejorarlo no
// cambia de icono, solo de tamaño/capacidad.
export const CONSTRUCTION_RECIPE_ICONS: Record<string, string> = {
  campamento: '🏕️',
  choza: '🛖',
  ayuntamiento: '🏛️',
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
  // hondonada-del-eco / tumulos-del-honor / osario-de-la-manada (auditoría de deuda técnica
  // 2026-08-04, permiso explícito de la usuaria "tienes permiso para mover lo que necesites"):
  // en sus posiciones MEDIDAS originales (5,7.5)/(6.2,5.6)/(10.95,7.6) quedaban a solo 2.2-2.4
  // unidades entre sí — más cerca que el propio radio de sus iconos (2.0) — así que ya se pisaban
  // un poco entre ellos en reposo, y la paleta de puntos nueva (InteractiveMap.tsx) lo hacía
  // mucho más obvio al desplegar satélites. Confirmado renderizando sobre el PNG real con
  // rsvg-convert antes y después del cambio (mismo método que el resto de este bloque) — el
  // estado "Las Llanuras del Viento Rojo" tiene de sobra sitio libre alrededor, así que se
  // separaron los 3 SOLO entre sí (ningún otro nodo se toca), manteniendo su disposición relativa
  // aproximada (hondonada al oeste, osario al este, túmulos entre medias, hacia Restos de Maktor,
  // como ya describía docs/13-escala-del-mundo.md § 1.1). Es visual, igual que el Cruce de las
  // Cenizas de arriba — la mecánica de viaje sigue usando los minutos reales de LocationLink, no
  // estas coordenadas.
  'hondonada-del-eco': { x: 1, y: 10 },
  'campamento-serhu': { x: 21, y: -5 },
  'restos-de-maktor': { x: 10, y: 20.5 },
  'osario-de-la-manada': { x: 17, y: 12 },
  'agujas-iman': { x: -7, y: 8.3 },
  // manaderos (mismo motivo/permiso que el trío de arriba): a 5.4 unidades de pozo-cauce-viejo,
  // seguía dentro del radio de colisión de la paleta. Empujado en la misma dirección desde su
  // ancla (pozo-cauce-viejo) hasta quedar fuera de ese radio, sin tocar ningún otro nodo.
  manaderos: { x: 20.3, y: 4.2 },
  'tumulos-del-honor': { x: 9, y: 11.5 },
  // Ampliación del núcleo (checklist 2026-07-21/22, "Puerta 2" — ver docs/13-escala-del-mundo.md
  // § 2.2 y su addendum): primeros dos nodos fuera del polígono original de 45×30 km.
  'pastos-de-la-deriva': { x: 30, y: -1 },
  'filo-de-las-brasas': { x: 16, y: 31 },

  // Tercera ampliación (sesión "ampliamos lore" 2026-08-05, docs/13-escala-del-mundo.md § 2.2ter):
  // los deltas triangulados a ciegas (5 km/h, sinuosidad 1,1) sacaban varios nodos fuera del
  // polígono real de Azgaar — sin `rsvg-convert`/Node en este entorno para verificar contra el
  // `.map` real (como sí se hizo para el Cruce de las Cenizas en su día). Recalibrados los 16 uno
  // a uno contra capturas reales que fue compartiendo la usuaria (novena/décima pasada) — a
  // diferencia de El Cruce de las Cenizas, aquí NO quedan decoupleadas: § 2.2ter ya se actualizó
  // con estas mismas coordenadas y con los `minutosBase` de `worldCatalog.ts` recalculados a
  // partir de la distancia real entre ellas (respetando el orden — más lejos nunca menos tiempo
  // — sin ser estrictamente proporcionales). Topología también replanteada esa misma pasada: la
  // costa pasó de abanico a cadena, y La Grieta Cantora se reenganchó de El Osario de la Manada a
  // El Cruce de las Cenizas.
  'oasis-de-juncos-rojos': { x: 24.3, y: 14.9 }, // confirmado correcto 2026-08-05
  // Desacoplado de la distancia triangulada real (280 min, que en línea recta caía muy al norte y
  // fuera del polígono real) — mismo criterio que el Cruce de las Cenizas: la posición visual no
  // tiene por qué coincidir con la distancia mecánica, que sigue intacta en `LocationLink`.
  'desembocadura-callada': { x: -2, y: 42 }, // confirmado correcto 2026-08-05
  'playa-de-ceniza-blanca': { x: -20, y: 22 }, // confirmado correcto 2026-08-05
  'pozas-de-marea': { x: -20, y: 36 }, // confirmado correcto 2026-08-05
  'acantilados-partidos': { x: -21, y: 44 }, // confirmado correcto 2026-08-05
  'embarcadero-de-ceniza': { x: -21, y: 54 }, // confirmado correcto 2026-08-05
  'fosa-horadada': { x: -16, y: -16 }, // confirmado correcto 2026-08-05
  'dunas-ahogadas': { x: -24, y: -28 }, // confirmado correcto 2026-08-05
  'vientre-del-engano': { x: -10, y: -40 }, // confirmado correcto 2026-08-05
  'laberinto-de-canones': { x: 6, y: -42 }, // confirmado correcto 2026-08-05
  'fumarolas-negras': { x: 19, y: 42 }, // confirmado correcto 2026-08-05
  'paso-de-los-huesos': { x: 41, y: 2 }, // confirmado correcto 2026-08-05
  'sabana-alta': { x: 54, y: -10 }, // confirmado correcto 2026-08-05
  'vergel-de-kegi': { x: -8, y: -175 }, // confirmado correcto 2026-08-05
  'grieta-cantora': { x: 6, y: -100 }, // confirmado correcto 2026-08-05
  'campo-yermo': { x: 19, y: 22 }, // confirmado correcto 2026-08-05
}

export interface CristalHeladoNode {
  slug: string
  name: string
  description: string
  x: number
  y: number
}

export type CristalHeladoEdge = LlanurasEdge

// Cristal Helado (añadido 2026-08-22, petición explícita: "solo visual... no viajable de verdad
// todavía") — a diferencia de Llanuras, esta región no tiene coordenadas km reales
// (`LocationInput.x`/`y` en worldCatalog.ts) ni `LocationLink` triangulados: sigue siendo
// contenido de Enciclopedia sin grafo de viaje (ver docs/rpgtarkor/areas.md § Cristal Helado).
// Sin un ancla real como tuvo Llanuras (campamento-serhu contra el .map de Azgaar), estas
// coordenadas viven DIRECTAMENTE en el mismo espacio de píxeles del lienzo (800×600) — no hace
// falta ninguna proyección tipo `projectLlanurasNodes`.
//
// Calibración en vivo 2026-08-22 ("un nodo a la vez", mismo criterio que Llanuras): las 12
// posiciones están confirmadas por la usuaria viendo el render real contra el PNG, agrupadas
// dentro del contorno real de la región. A diferencia de Llanuras, ninguna se movió a ciegas: cada
// valor salió de una ronda de prueba/captura de pantalla con la usuaria, no de una fórmula.
export const cristalHeladoNodePositions: Record<string, { x: number; y: number }> = {
  'campamento-clan-helsig': { x: 603, y: 112 }, // confirmado correcto 2026-08-22
  'veta-helada': { x: 598, y: 98 }, // confirmado correcto 2026-08-22
  'red-profunda-final': { x: 627, y: 38 }, // confirmado correcto 2026-08-22
  'lago-cristalice': { x: 652, y: 84 }, // confirmado correcto 2026-08-22
  'pico-escarcha': { x: 566, y: 71 }, // confirmado correcto 2026-08-22
  'pico-ocaso-negro': { x: 588, y: 69 }, // confirmado correcto 2026-08-22
  'pico-tundra-negra': { x: 606, y: 61 }, // confirmado correcto 2026-08-22
  'tundra-negra-refleja': { x: 682, y: 82 }, // confirmado correcto 2026-08-22
  'tundra-polvo-nocturno': { x: 600, y: 49 }, // confirmado correcto 2026-08-22
  'costa-celeste-agitada': { x: 522, y: 74 }, // confirmado correcto 2026-08-22
  'cascada-cristal-tres-aguas': { x: 634, y: 116 }, // confirmado correcto 2026-08-22
  'desfiladeros-bruma': { x: 654, y: 42 }, // confirmado correcto 2026-08-22
}
