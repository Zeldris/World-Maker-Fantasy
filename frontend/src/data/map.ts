export interface MapRegion {
  name: string
  description: string
  isCurrent?: boolean
}

export interface PointOfInterest {
  name: string
  description: string
}

// Contenido tomado de docs/rpgtarkor/areas.md — condensado para la UI. Berig es el continente
// de Gorhorn (único personaje probado hasta ahora); Vaelira se añadirá cuando haga falta.
// "isCurrent" está fijo a Llanuras del Viento Rojo porque todavía no hay seguimiento real de
// posición del personaje (docs/09-panel-personaje.md § 7) — actualizar cuando exista.
export const beriRegions: MapRegion[] = [
  {
    name: 'Las Llanuras del Viento Rojo',
    description: 'Estepa infinita de tierra rojiza, volcanes lejanos, tormentas de arena magnética. Territorio del Clan Maktor (extinto) y el Clan Serhu. Aquí está Gorhorn ahora.',
    isCurrent: true,
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
    description: 'Selva y pantano donde el sonido se apaga de forma antinatural. Territorio Nabieus/Faerus.',
  },
]

export const llanurasPuntosDeInteres: PointOfInterest[] = [
  {
    name: 'La Hondonada del Eco',
    description: 'Refugio natural contra el viento y las tormentas de arena — buen lugar para acampar.',
  },
  {
    name: 'Los Pilares Rotos',
    description: 'Formación rocosa erosionada, visible desde lejos — punto de referencia para orientarse.',
  },
  {
    name: 'El Pozo de Cauce Viejo',
    description: 'Uno de los pocos puntos de agua permanentes de la región.',
  },
  {
    name: 'El Cruce de las Cenizas',
    description: 'Donde el camino de la Meseta del Orden se bifurca — zona de paso de patrullas de la Concordia.',
  },
  {
    name: 'Los Restos de Maktor',
    description: 'El último asentamiento del clan de Gorhorn antes de su aniquilación. No ha vuelto todavía.',
  },
]
