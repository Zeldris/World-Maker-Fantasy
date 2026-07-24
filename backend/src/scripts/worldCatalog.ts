/// Catálogo de mundo estructurado (docs/12-mundo-estructurado.md) — ubicaciones, NPCs, armería
/// y recursos cosechables de las Llanuras del Viento Rojo (alcance v1: solo Gorhorn). Igual que
/// loreChunks.ts, la fuente de verdad editorial sigue siendo docs/rpgtarkor/*.md; esto es el
/// mismo contenido en forma de filas deterministas. Idempotente vía upsert por @@unique —
/// correr de nuevo con `npm run seed-catalog` cuando cambie el contenido.

import type { Attribute } from '../services/dice.js';
import type { Requisitos } from '../services/requisitos.js';

export interface LocationInput {
  slug: string;
  name: string;
  region: string;
  kind: string;
  description: string;
  aliases: string[];
}

export const locations: LocationInput[] = [
  {
    slug: 'hondonada-del-eco',
    name: 'La Hondonada del Eco',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'refugio',
    description:
      'Una depresión profunda en la tierra rojiza, con paredes de arcilla endurecida que cortan el viento y amortiguan el sonido — la voz rebota dentro, de ahí el nombre. Refugio real contra el viento y las tormentas de arena magnética, buen lugar para acampar, descansar o pasar la noche. Único riesgo: al estar hundida, no se ve quién se acerca por arriba hasta que es tarde.',
    aliases: ['hondonada', 'hondonada del eco', 'el eco', 'la hondonada'],
  },
  {
    slug: 'pilares-rotos',
    name: 'Los Pilares Rotos',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'hito',
    description:
      'Tres columnas erosionadas de lo que en tiempos remotos fue una formación rocosa mucho más alta — visibles desde casi cualquier punto de la llanura, el punto de referencia que usa cualquiera para orientarse aquí. Su sombra da algo de resguardo del sol a mediodía, pero es terreno abierto y no defendible.',
    aliases: ['pilares', 'los pilares', 'pilares rotos'],
  },
  {
    slug: 'pozo-cauce-viejo',
    name: 'El Pozo de Cauce Viejo',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'punto de agua',
    description:
      'Uno de los pocos puntos de agua permanentes de la región, sobre la corriente subterránea que siguen los Corredores de Cauce — cruce de viajeros para bien o para mal.',
    aliases: ['pozo', 'el pozo', 'cauce viejo', 'pozo de cauce viejo'],
  },
  {
    slug: 'cruce-de-las-cenizas',
    name: 'El Cruce de las Cenizas',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'cruce',
    description:
      'El punto donde el camino que viene de la Meseta del Orden se bifurca en la llanura — zona de paso habitual de patrullas de la Concordia de Hierro.',
    aliases: ['cruce', 'el cruce', 'cruce de las cenizas', 'cenizas'],
  },
  {
    slug: 'restos-de-maktor',
    name: 'Los Restos de Maktor',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'ruinas',
    description:
      'La ubicación aproximada del último asentamiento del Clan Maktor antes de su aniquilación — hoy poco más que cimientos quemados y arcilla removida en la estepa profunda, sin senda marcada que lleve hasta ellas. Gorhorn, único superviviente conocido del clan, no ha vuelto todavía.',
    aliases: ['restos de maktor', 'maktor', 'los restos', 'ruinas de maktor'],
  },
  {
    slug: 'campamento-serhu',
    name: 'Campamento del Clan Serhu',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'asentamiento',
    description:
      'El asentamiento del Clan Serhu, cerca del Pozo de Cauce Viejo del que dependen para el agua — hogar de la Terk\'ikar Ulkha y el Kort\'ikar Torgash. Se llega visto desde lejos por los vigías del clan.',
    aliases: ['campamento serhu', 'campamento del clan serhu', 'los serhu', 'el campamento', 'clan serhu'],
  },

  // --- Puntos de interés nuevos dentro del núcleo ya cartografiado (roadmap 2026-07-20,
  // propuesta de Fable, ver memoria project_tarkor_propuesta_fauna_flora.md) — coordenadas
  // coherentes con docs/13-escala-del-mundo.md § 1.1, minutos ya calculados por Fable con el
  // mismo método (5 km/h, sinuosidad 1,1) que el resto del grafo.
  {
    slug: 'osario-de-la-manada',
    name: 'El Osario de la Manada',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'hito',
    description:
      'El esqueleto de una Gargantúa de Ceniza muerta hace décadas, costillas como arcos blanqueados visibles desde lejos. Los orcos lo tratan con respeto: se toma hueso, no se profana — la única fuente conocida de placas óseas y hueso largo de gargantúa sin necesidad de cacería ritual.',
    aliases: ['osario', 'el osario', 'huesos de gargantúa', 'huesos de gargantua', 'esqueleto gigante', 'costillas'],
  },
  {
    slug: 'agujas-iman',
    name: 'Las Agujas Imán',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'hito',
    description:
      'Un campo de rocas negras imantadas donde las tormentas de arena magnética peinan la arena en crestas. El sentido de la orientación se pierde entre ellas; a sotavento se acumula arena imán y crece el Cardo Brújula.',
    aliases: ['agujas iman', 'agujas imán', 'las agujas', 'rocas imantadas', 'piedras negras'],
  },
  {
    slug: 'manaderos',
    name: 'Los Manaderos',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'punto de agua',
    description:
      'Donde la corriente subterránea aflora en charcas estacionales entre juncos rojizos — otro punto de la misma corriente que alimenta el Pozo de Cauce Viejo, no su origen ni su final. Aquí paren las hembras de Corredor de Cauce; cazar crías ofende la costumbre orca.',
    aliases: ['manaderos', 'los manaderos', 'charcas', 'juncos', 'aguada'],
  },
  {
    slug: 'tumulos-del-honor',
    name: 'Los Túmulos del Honor',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'hito',
    description:
      'Campo de túmulos de piedra donde los clanes de las Llanuras entierran a quienes murieron con honor: duelos aceptados, cacerías rituales. Terreno neutral sagrado — ni Serhu ni Maktor pelearon jamás aquí.',
    aliases: ['tumulos', 'túmulos', 'tumulos del honor', 'túmulos del honor', 'tumbas', 'campo de tumbas'],
  },

  // --- Ampliación del núcleo medido (checklist 2026-07-21/22, punto 6 — "Puerta 2" de
  // project_tarkor_roadmap_mapa: el núcleo v1 era solo ~18% de la región completa de Llanuras,
  // docs/13-escala-del-mundo.md § 2.2 ya reservaba "pastos de temporada al este" y "zona volcánica
  // del norte/noreste" sin nombrar hasta que el juego los pisara — este es ese momento. Coordenadas
  // y minutos calculados con el mismo método (5 km/h, sinuosidad 1,1) que el resto del grafo.
  {
    slug: 'pastos-de-la-deriva',
    name: 'Los Pastos de la Deriva',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'pasto estacional',
    description:
      'Praderas abiertas al este de Los Manaderos, donde la hierba dura más tiempo que en el núcleo del clan — hasta aquí siguen las manadas de Corredores de Cauce su migración, y hasta aquí llevan los Serhu a sus múrgoles cuando el pasto cercano se agota. Sin asentamiento fijo: se ocupa por temporadas, se abandona el resto del año.',
    aliases: ['pastos de la deriva', 'los pastos', 'pastos', 'pastos estacionales'],
  },
  {
    slug: 'filo-de-las-brasas',
    name: 'El Filo de las Brasas',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'mirador',
    description:
      'Una cresta de roca oscura al noreste de Los Restos de Maktor, donde la estepa empieza a ceder ante la tierra volcánica — el primer lugar del núcleo jugable desde el que los volcanes activos que solo se veían "a lo lejos" se distinguen de verdad, con su calima de calor y ceniza en el aire. Territorio real de la Salamandra de Escoria, que antes solo aparecía aquí como avanzadilla ocasional.',
    aliases: ['filo de las brasas', 'el filo', 'las brasas', 'cresta volcanica', 'cresta volcánica'],
  },

  // --- Otras regiones de Berig (2026-07-22, petición explícita: "incluye de momento solo todo
  // lo que sea de Berig") — fuera del núcleo jugable v1 (solo Llanuras tiene grafo de viaje real),
  // por eso sin LocationLink ni coordenadas de mapa: son anclas de referencia para que la región
  // aparezca en la Enciclopedia con su propia descripción, no destinos alcanzables todavía.
  {
    slug: 'meseta-del-orden',
    name: 'Las ciudades-fortaleza de la Meseta del Orden',
    region: 'La Meseta del Orden',
    kind: 'región',
    description:
      'Desierto de piedra gris tallado con una simetría antinatural — obra del control de Goirme sobre sus hijos. Ciudades-fortaleza geométricas de piedra pulida y hierro negro, acueductos perfectos, leyes grabadas en obeliscos. El corazón de la Concordia de Hierro. Fuera del núcleo jugable actual — Gorhorn no ha estado aquí.',
    aliases: ['meseta del orden', 'la meseta', 'meseta'],
  },
  {
    slug: 'territorios-clan-helsig',
    name: 'Los territorios del Clan Helsig',
    region: 'Cristal Helado',
    kind: 'región',
    description:
      'Zona helada de altas montañas y viento, terreno en gran parte inexplorado. A los pies de la ladera, varias tribus orcas de zonas gélidas — entre ellas el Clan Helsig, expertos en tallar hielo sílice, turnos de mina y caza escasa. Aquí trabajó Gorhorn tres meses de joven, y aquí sigue Hagar. Fuera del núcleo jugable actual.',
    aliases: ['cristal helado', 'territorios del clan helsig', 'clan helsig', 'minas de hielo silice', 'minas de hielo sílice'],
  },
  {
    slug: 'territorios-clan-goshg',
    name: 'Los territorios del Clan Goshg',
    region: 'Ciénaga Troncal',
    kind: 'región',
    description:
      'Terreno húmedo, en gran parte inhabitable, con tres pequeñas zonas llanas invadidas por Trepadores Ocaso. Rica en alimento y madera, pobre en minerales. La habitan las dos tribus del Clan Goshg, que viven de los Trepadores Ocaso y los Cornantes y tallan sus tótems en la misma madera oscura que Gorhorn lleva a la espalda. Sin conexión previa con Gorhorn — territorio completamente nuevo si la partida llega aquí. Fuera del núcleo jugable actual.',
    aliases: ['cienaga troncal', 'ciénaga troncal', 'territorios del clan goshg', 'clan goshg', 'la cienaga', 'la ciénaga'],
  },
  {
    slug: 'margen-silencioso',
    name: 'El Margen Silencioso',
    region: 'El Margen Silencioso',
    kind: 'región',
    description:
      // División este/oeste (2026-07-22, petición explícita): los Nabieus predominan al este,
      // con presencia hasta el borde de Ciénaga Troncal (vecina real, no una frontera cerrada);
      // los Faerus ocupan el resto — la mayor parte de la región — con puestos avanzados que
      // cruzan algo la frontera oeste hacia las Llanuras.
      'Cinturón denso de selva templada, pantanos y bosques de coníferas de madera negra que separa la Meseta del Orden de las tierras salvajes del norte — un laberinto donde el sonido parece apagarse de forma antinatural. Los Nabieus predominan en la mitad oriental, con presencia dispersa hasta el borde de Ciénaga Troncal; los Faerus ocupan la mayor parte del resto de la región, con pequeños puestos avanzados que se adentran algo más allá de la frontera oeste con las Llanuras del Viento Rojo. Fuera del núcleo jugable actual.',
    aliases: ['margen silencioso', 'el margen', 'margen'],
  },

  // --- Capitales/asentamientos principales por raza y zona (2026-07-22, petición explícita:
  // "vamos ya a crear capitales con nombres para cada raza y zona siguiendo el lore") — mismo
  // patrón que las 4 "otras regiones" de arriba (kind sin coordenadas ni LocationLink, anclas de
  // referencia para la Enciclopedia, no destinos alcanzables todavía). Escala deliberadamente
  // modesta fuera de la Meseta del Orden (docs/13-escala-del-mundo.md: Berig entero apenas
  // 8.000-10.000 almas) — Cristal Helado y Ciénaga Troncal son campamento/poblado, no ciudad.
  // Los Faerus NO tienen capital de verdad (razas.md: "sin ciudades, sin escritura") — su entrada
  // es un lugar de encuentro estacional, no una construcción, coherente con "la manada es la
  // única institución Faerus".
  {
    slug: 'baluarte-de-goirme',
    name: 'El Baluarte de Goirme',
    region: 'La Meseta del Orden',
    kind: 'asentamiento',
    description:
      'La mayor de las ciudades-fortaleza Goirntes, sede de la Concordia de Hierro — muros de hierro negro pulido tallados con la misma simetría antinatural que el resto de la Meseta, y el obelisco de leyes más alto de todo Berig en su plaza central. Lleva el nombre de la Semilla que dio forma a su pueblo. Fuera del núcleo jugable actual.',
    aliases: ['el baluarte', 'baluarte de goirme', 'baluarte', 'la capital goirnte'],
  },
  {
    slug: 'veta-helada',
    name: 'La Veta Helada',
    region: 'Cristal Helado',
    kind: 'asentamiento',
    description:
      'El mayor asentamiento del Clan Helsig — poco más que un campamento minero fortificado alrededor del yacimiento de hielo sílice más rico de la región, con turnos de mina que no paran ni de noche. Aquí trabajó Gorhorn tres meses de joven. Fuera del núcleo jugable actual.',
    aliases: ['veta helada', 'la veta', 'campamento helsig', 'minas de la veta helada'],
  },
  {
    slug: 'cerco-de-los-pilotes',
    name: 'El Cerco de los Pilotes',
    region: 'Ciénaga Troncal',
    kind: 'asentamiento',
    description:
      'El mayor de los dos poblados del Clan Goshg — empalizadas de madera oscura levantadas sobre pilotes por encima del agua, unidas por pasarelas y canoas. Aquí se reúnen las dos tribus Goshg en la estación de las crecidas. Fuera del núcleo jugable actual.',
    aliases: ['cerco de los pilotes', 'el cerco', 'pilotes', 'poblado goshg'],
  },
  {
    slug: 'refugio-sin-nombre',
    name: 'El Refugio sin Nombre',
    region: 'El Margen Silencioso',
    kind: 'refugio',
    description:
      'El enclave Nabieus más estable del Margen Silencioso, en la mitad oriental de la región — no tiene nombre propio en ninguna lengua ajena a ellos, y así lo prefieren: cuanto menos se hable de él, más dura. Desde aquí parten los mensajeros y correos que se infiltran en la Concordia de Hierro. Fuera del núcleo jugable actual.',
    aliases: ['refugio sin nombre', 'el refugio', 'enclave nabieus'],
  },
  {
    slug: 'claro-de-la-manada',
    name: 'El Claro de la Manada',
    region: 'El Margen Silencioso',
    kind: 'pasto estacional',
    description:
      'Un claro amplio en la mitad occidental del Margen Silencioso donde las manadas Faerus se juntan para cazar y compartir la primera pieza — no hay ciudad ni escritura Faerus, así que esto es lo más parecido a una capital que tienen: un lugar, no una construcción. Algunas manadas mantienen pequeños puestos avanzados más allá de la frontera oeste, ya en las Llanuras del Viento Rojo. Fuera del núcleo jugable actual.',
    aliases: ['claro de la manada', 'el claro', 'territorio faerus'],
  },
];

export interface LocationLinkInput {
  fromSlug: string;
  toSlug: string;
  minutosBase: number;
  terreno: string;
  riesgo?: string;
}

export const locationLinks: LocationLinkInput[] = [
  {
    fromSlug: 'cruce-de-las-cenizas',
    toSlug: 'pilares-rotos',
    minutosBase: 240,
    terreno: 'Camino apisonado que se deshace en llanura',
    riesgo: 'Paso de patrullas de la Concordia cerca del Cruce',
  },
  {
    fromSlug: 'cruce-de-las-cenizas',
    toSlug: 'pozo-cauce-viejo',
    minutosBase: 300,
    terreno: 'Llanura abierta',
    riesgo: 'Espinas del Viento tras las tormentas',
  },
  {
    fromSlug: 'pilares-rotos',
    toSlug: 'hondonada-del-eco',
    minutosBase: 120,
    terreno: 'Arcilla agrietada, llanura abierta',
  },
  {
    fromSlug: 'pilares-rotos',
    toSlug: 'pozo-cauce-viejo',
    minutosBase: 180,
    terreno: 'Llanura siguiendo el cauce subterráneo',
    riesgo: 'Manadas de Corredores de Cauce en migración',
  },
  {
    fromSlug: 'hondonada-del-eco',
    toSlug: 'pozo-cauce-viejo',
    minutosBase: 150,
    terreno: 'Terreno de hondonadas',
    riesgo: 'Nidos de Espina del Viento entre las hondonadas',
  },
  {
    fromSlug: 'pozo-cauce-viejo',
    toSlug: 'campamento-serhu',
    minutosBase: 120,
    terreno: 'Senda de pastoreo marcada',
    riesgo: 'Vigías Serhu — se llega visto desde lejos',
  },
  {
    fromSlug: 'pilares-rotos',
    toSlug: 'restos-de-maktor',
    minutosBase: 300,
    terreno: 'Estepa profunda sin senda',
    riesgo: 'Tormentas de arena magnética, sin refugio',
  },
  {
    fromSlug: 'campamento-serhu',
    toSlug: 'restos-de-maktor',
    minutosBase: 360,
    terreno: 'Estepa profunda',
    riesgo: 'Tormentas de arena magnética',
  },

  // --- Aristas a los 4 puntos de interés nuevos (roadmap 2026-07-20) ---
  {
    fromSlug: 'pilares-rotos',
    toSlug: 'osario-de-la-manada',
    minutosBase: 160,
    terreno: 'Estepa abierta, sin senda',
    riesgo: 'Buitres cenizos y carroñeros nocturnos atraídos por los huesos',
  },
  {
    fromSlug: 'osario-de-la-manada',
    toSlug: 'restos-de-maktor',
    minutosBase: 155,
    terreno: 'Estepa profunda',
    riesgo: 'Tormentas de arena magnética',
  },
  {
    fromSlug: 'pilares-rotos',
    toSlug: 'agujas-iman',
    minutosBase: 130,
    terreno: 'Llanura abierta',
    riesgo: 'Desorientación entre las rocas imantadas — una aguja de cardo la anula',
  },
  {
    fromSlug: 'pozo-cauce-viejo',
    toSlug: 'manaderos',
    minutosBase: 65,
    terreno: 'Siguiendo la corriente subterránea',
    riesgo: 'Corredores de Cauce pariendo — cazar crías ofende la costumbre orca',
  },
  {
    fromSlug: 'manaderos',
    toSlug: 'campamento-serhu',
    minutosBase: 100,
    terreno: 'Senda de pastoreo',
    riesgo: 'Vigías Serhu — se llega visto desde lejos',
  },
  {
    fromSlug: 'pozo-cauce-viejo',
    toSlug: 'tumulos-del-honor',
    minutosBase: 110,
    terreno: 'Llanura de hierba alta',
  },
  {
    fromSlug: 'tumulos-del-honor',
    toSlug: 'restos-de-maktor',
    minutosBase: 185,
    terreno: 'Estepa profunda',
    riesgo: 'Tormentas de arena magnética',
  },

  // --- Aristas de la ampliación del núcleo (checklist 2026-07-21/22, "Puerta 2") ---
  {
    fromSlug: 'manaderos',
    toSlug: 'pastos-de-la-deriva',
    minutosBase: 165,
    terreno: 'Llanura de hierba alta, senda de manada',
    riesgo: 'Corredores de Cauce y múrgoles en migración, tránsito denso',
  },
  {
    fromSlug: 'campamento-serhu',
    toSlug: 'pastos-de-la-deriva',
    minutosBase: 130,
    terreno: 'Senda de pastoreo estacional',
  },
  {
    fromSlug: 'restos-de-maktor',
    toSlug: 'filo-de-las-brasas',
    minutosBase: 160,
    terreno: 'Ascenso rocoso hacia el borde volcánico',
    riesgo: 'Calor creciente, Salamandras de Escoria territoriales',
  },
];

export type NpcKindInput = 'PRINCIPAL' | 'PLANTILLA';

export interface NpcInput {
  slug: string;
  name: string;
  kind: NpcKindInput;
  aliases: string[];
  faction: string | null;
  role: string;
  level: number;
  levelMax?: number;
  attributes: { fuerza: number; destreza: number; sigilo: number; voluntad: number; carisma: number; arcano: number };
  bio: string;
  personality: string;
  homeLocationSlug?: string;
  /// slug de ItemCatalog -> { cantidad, notas }
  loadout: { itemSlug: string; cantidad?: number; notas?: string }[];
}

/// Fauna cazable (roadmap 2026-07-19, prioridad 1: "despiece exige presa previa"): antes el
/// despiece de una especie animal era repetible infinito sin haber cazado nada — sourceSlug de
/// HarvestYield nunca se cruzaba con ningún estado de partida. Modelarla como Npc PLANTILLA con
/// el MISMO slug que su sourceSlug en harvestYields (ver detectHarvest en services/harvest.ts,
/// que las busca por ese slug) reutiliza toda la maquinaria ya construida: detectNpcsInScene las
/// reconoce en escena (mismos aliases que harvestSourceAliases), el combate y NpcState deciden
/// si está derrotada, y solo entonces harvest.ts permite despiezarla. `loadout: []` a propósito —
/// lo que sueltan al morir vive en HarvestYield/despiece, no en el saqueo de NpcItem (eso es para
/// NPCs con objetos personales, no fauna).
export const fauna: NpcInput[] = [
  {
    slug: 'corredor-de-cauce',
    name: 'Corredor de Cauce',
    kind: 'PLANTILLA',
    aliases: ['corredor de cauce', 'corredor', 'corredores de cauce'],
    faction: null,
    role: 'Bestia de seis patas de las Llanuras del Viento Rojo',
    level: 1,
    levelMax: 2,
    attributes: { fuerza: 10, destreza: 15, sigilo: 9, voluntad: 6, carisma: 3, arcano: 2 },
    bio: 'Bestia veloz de seis patas y piel rojiza que se camufla en el polvo de la llanura, se desplaza en manadas siguiendo las corrientes subterráneas. Los clanes orcos la cazan en carreras rituales.',
    personality: 'Huidiza, rápida a la primera señal de peligro — no busca el enfrentamiento.',
    loadout: [],
  },
  {
    slug: 'gargantua-de-ceniza',
    name: 'Gargantúa de Ceniza',
    kind: 'PLANTILLA',
    aliases: ['gargantúa', 'gargantua', 'gargantúa de ceniza', 'gargantua de ceniza'],
    faction: null,
    role: 'Bestia grande cazada con lanzas de hueso',
    level: 4,
    levelMax: 5,
    attributes: { fuerza: 17, destreza: 8, sigilo: 4, voluntad: 8, carisma: 2, arcano: 2 },
    bio: 'Bestia grande y pesada, de piel gris ceniza curtida bajo una coraza natural de placas óseas gruesas y blanquecinas que se solapan como escamas — costillas visibles bajo la piel cuando respira hondo, andar lento y pisadas que tiemblan en el suelo. Solo se caza de adulta con lanzas de hueso, en cacerías serias, no en un enfrentamiento casual.',
    personality: 'Territorial y peligrosa si se la acorrala, pero no busca presas activamente.',
    loadout: [],
  },
  {
    slug: 'corretolvas',
    name: 'Corretolvas',
    kind: 'PLANTILLA',
    aliases: ['corretolva', 'corretolvas'],
    faction: null,
    role: 'Ave corredora de caza menor',
    level: 1,
    levelMax: 1,
    attributes: { fuerza: 5, destreza: 14, sigilo: 10, voluntad: 5, carisma: 2, arcano: 2 },
    bio: 'Criatura corredora incapaz de volar, cuerpo alargado que se desplaza casi paralelo al suelo — plumaje rojizo veteado de gris polvoriento, cresta escamosa negra rematada en plumas rojas, patas largas y nervudas con garras negras afiladas, ojos ámbar pequeños y brillantes, pico largo y curvo para escarbar el suelo. Se mueve en bandadas entre la hierba rojiza — caza menor, se cobra con trampa o lanza corta.',
    personality: 'Nerviosa, huye en bandada al primer sobresalto.',
    loadout: [],
  },
  {
    slug: 'aullador-rojo',
    name: 'Aullador Rojo',
    kind: 'PLANTILLA',
    aliases: ['aullador', 'aulladores', 'aullador rojo', 'aulladores rojos', 'perro salvaje', 'jauria', 'jauría'],
    faction: null,
    role: 'Depredador de jauría que sigue a los Corredores en migración',
    level: 2,
    levelMax: 3,
    attributes: { fuerza: 11, destreza: 13, sigilo: 12, voluntad: 8, carisma: 3, arcano: 2 },
    bio: 'Criatura flaca de cuatro patas, pelaje rojizo rasposo, mechones de pelo negro en los tobillos y patas desproporcionadamente largas — el pelaje enredado con parches de arena fosilizada que brillan como vetas minerales rojas. Colmillos amarillentos de tamaño exagerado, costillas marcadas bajo la piel tensa, y una cola negra tupida que arrastra borrando sus propias huellas. Sigue a las manadas de Corredores en migración, cobrándose a los rezagados. Caza en jaurías de 4-6; un aullador solo nunca ataca a un orco adulto — una jauría con hambre, sí.',
    personality: 'Paciente, cobarde en solitario y osado en grupo; rodea antes de atacar.',
    loadout: [],
  },
  {
    slug: 'murgol',
    name: 'Múrgol',
    kind: 'PLANTILLA',
    // Bug real jugando en vivo (2026-07-24, "revisar partida, sigue metiendo al murgol"):
    // 'res'/'ganado' son demasiado genéricos para matchNpcAliases (npcScene.ts), que da por bueno
    // un alias de UNA sola palabra si aparece como SUBSTRING literal en cualquier parte del texto
    // — 'res' matcheaba con solo que la acción/hecho de sesión contuviera "eres" (p. ej. "¿quién
    // eres?"), y 'ganado' con la conjugación normal del verbo ganar ("Gorhorn ha ganado un nivel").
    // Ambos casos metían a Múrgol "en escena" sin que tuviera nada que ver, y el modelo acababa
    // narrándolo (confundiéndolo con el NPC real presente). 'rebaño'/'rebano' se quedan: mucho más
    // largos y específicos, sin colisión conocida con palabras comunes.
    aliases: ['murgol', 'múrgol', 'murgoles', 'múrgoles', 'rebano', 'rebaño'],
    faction: null,
    role: 'Ganado de los clanes de las Llanuras',
    level: 1,
    levelMax: 1,
    attributes: { fuerza: 9, destreza: 6, sigilo: 3, voluntad: 5, carisma: 2, arcano: 2 },
    bio: 'Criatura lanuda y voluminosa de cuatro patas, pelaje gris ceniza con matices rojizos y polvo rojo siempre enredado en la lana — cuernos largos y rectos que se enroscan en la punta como arietes, boca de dientes planos y cuadrados, ojos negros con un destello amarillento. El ganado de los clanes de las Llanuras: lana, leche y carne. Los del Clan Serhu llevan una muesca en la oreja — un múrgol con muesca de clan es propiedad, cazarlo es robo a ojos Serhu.',
    personality: 'Dócil, gregario, se espanta con las tormentas.',
    loadout: [],
  },
  {
    slug: 'cruzavientos',
    name: 'Cruzavientos',
    kind: 'PLANTILLA',
    aliases: ['cruzavientos', 'cruzaviento', 'ave de tormenta', 'aves de tormenta', 'rapaz'],
    faction: null,
    role: 'Ave planeadora que anida en Los Pilares Rotos',
    level: 2,
    levelMax: 2,
    attributes: { fuerza: 7, destreza: 16, sigilo: 8, voluntad: 7, carisma: 2, arcano: 2 },
    bio: 'Planeadora grande de alas rígidas que cabalga los frentes de viento. Vuela alto y en círculos con buen tiempo; cuando cruza baja y en línea recta, los pastores saben que viene tormenta de arena magnética. Anida en lo alto de los Pilares Rotos. Cazarla es dificilísimo salvo en nido o con trampa cebada.',
    personality: 'Esquiva, jamás se posa cerca de nada que se mueva.',
    loadout: [],
  },
  {
    slug: 'rondador-de-brasas',
    name: 'Rondador de Brasas',
    kind: 'PLANTILLA',
    aliases: ['rondador', 'rondador de brasas', 'bestia nocturna', 'bestia de la noche'],
    faction: null,
    role: 'Carroñero-cazador nocturno que ronda el fuego de los campamentos',
    level: 3,
    levelMax: 4,
    attributes: { fuerza: 14, destreza: 11, sigilo: 14, voluntad: 9, carisma: 2, arcano: 3 },
    bio: 'Carroñero-cazador nocturno de complexión robusta y pelaje ceniciento, mandíbula pesada y lomo encorvado. No teme al fuego: lo busca — ha aprendido que donde hay brasas hay carne, cazada o dormida. Ronda el borde de la luz durante horas antes de decidirse. Solitario; ver dos juntos es señal de un cadáver grande cerca.',
    personality: 'Paciente y silencioso; se retira ante un grupo despierto, ataca a lo aislado o dormido.',
    loadout: [],
  },
  {
    slug: 'salamandra-de-escoria',
    name: 'Salamandra de Escoria',
    kind: 'PLANTILLA',
    aliases: ['salamandra', 'salamandra de escoria', 'lagarto de fuego', 'lagarto grande'],
    faction: null,
    role: 'Reptil de escamas volcánicas, avanzadilla rara del borde norte',
    level: 3,
    levelMax: 4,
    attributes: { fuerza: 13, destreza: 9, sigilo: 7, voluntad: 8, carisma: 2, arcano: 4 },
    bio: 'Reptil de complexión robusta y baja, escamas como escoria volcánica que retienen calor — tocarla quema. Come Raíz de Fuego sin inmutarse. Su territorio real es El Filo de las Brasas, en el borde volcánico del núcleo (checklist 2026-07-21/22, ampliación del núcleo) — antes solo aparecía como avanzadilla rara más al sur, ahora se la encuentra donde de verdad vive.',
    personality: 'Lenta y territorial; avisa hinchando la garganta con un silbido de vapor antes de cargar.',
    homeLocationSlug: 'filo-de-las-brasas',
    loadout: [],
  },
  {
    slug: 'buitre-cenizo',
    name: 'Buitre Cenizo',
    kind: 'PLANTILLA',
    aliases: ['buitre', 'buitres', 'buitre cenizo', 'buitres cenizos', 'carroneras', 'carroñeras'],
    faction: null,
    role: 'Carroñero de caza menor y señal ambiental',
    level: 1,
    levelMax: 1,
    attributes: { fuerza: 6, destreza: 12, sigilo: 6, voluntad: 4, carisma: 2, arcano: 2 },
    // Bio ajustada (checklist 2026-07-21/22, ronda de imágenes) al primer prompt de imagen que la
    // usuaria generó de verdad y validó — más fiera de aspecto que un buitre real, aunque su papel
    // en el mundo (carroñero, señal ambiental, nivel 1) no cambia.
    bio: 'Buitre de plumaje negro cuervo, revuelto y salvaje, con la piel bajo el plumaje de un gris ceniza brillante sobre escamas pardas — más fiera de aspecto que cualquier buitre real. El pico entreabierto deja ver pequeños dientes afilados, y sus ojos brillan de un gris ceniciento sólido con destellos blancos. Siempre en círculos sobre lo que muere en la llanura. Los orcos los leen como los Goirntes leen mapas: dónde caen los buitres, algo ha caído antes.',
    personality: 'Cobarde con lo vivo, atrevidísima con lo muerto.',
    loadout: [],
  },
];

export const npcs: NpcInput[] = [
  {
    slug: 'torgash',
    name: "Kort'ikar Torgash",
    kind: 'PRINCIPAL',
    aliases: ['torgash', "kort'ikar torgash", 'el kort\'ikar serhu', 'jefe de guerra serhu', 'kort\'ikar del clan serhu'],
    faction: 'Clan Serhu',
    role: "Kort'ikar del Clan Serhu",
    level: 5,
    attributes: { fuerza: 16, destreza: 9, sigilo: 5, voluntad: 15, carisma: 12, arcano: 5 },
    bio: 'Orco del Clan Serhu, de las Llanuras del Viento Rojo — piel en los tonos beige y arcilla propios de los orcos del desierto, corpulento incluso para los suyos, colmillos intactos de quien ha sobrevivido más duelos que la mayoría. Pelo negro ya veteado de gris, recogido en trenzas cortas con cuentas de hueso que marcan sus años de guerra. Veterano de las escaramuzas fronterizas; ascendió a Kort\'ikar cuando su predecesor murió en el frente. Busca unificar los clanes para retirar a su pueblo de la guerra de la Concordia. El padre de Gorhorn murió retando al Kort\'ikar Serhu de entonces, predecesor de Torgash — Torgash lo recuerda y respeta cómo murió.',
    personality: 'Grave, económico con las palabras, pragmático hasta rozar la herejía cultural (prefiere pactar a duelar). Detesta a la Concordia en silencio.',
    homeLocationSlug: 'campamento-serhu',
    loadout: [
      { itemSlug: 'hacha-guerra-orca', notas: 'Con la marca del Clan Serhu grabada en la cabeza' },
      { itemSlug: 'lanza-hueso-gargantua' },
      { itemSlug: 'amuleto-hueso', notas: 'Colmillos de corredor de su primera cacería' },
      { itemSlug: 'racion-viaje', cantidad: 3 },
      { itemSlug: 'raiz-de-fuego', cantidad: 1 },
      { itemSlug: 'odre-agua' },
    ],
  },
  {
    slug: 'ulkha',
    name: "Terk'ikar Ulkha",
    kind: 'PRINCIPAL',
    aliases: ['ulkha', "terk'ikar ulkha", 'la terk\'ikar', 'jefa del clan serhu', 'terk\'ikar del clan serhu'],
    faction: 'Clan Serhu',
    role: "Terk'ikar del Clan Serhu",
    level: 6,
    attributes: { fuerza: 9, destreza: 8, sigilo: 6, voluntad: 16, carisma: 15, arcano: 8 },
    bio: 'Orca del Clan Serhu, de las Llanuras del Viento Rojo — piel beige curtida por décadas de sol y viento, cabello gris casi blanco recogido en un moño alto sujeto con agujas de hueso de gargantúa. Menuda para una orca, su autoridad no se apoya en el físico sino en la voz baja y la mirada que no parpadea. Jefa del Clan Serhu; gobierna asentamiento, pastoreo y migraciones. Decidió no acoger supervivientes Maktor tras la aniquilación — por cálculo de supervivencia, no crueldad: acogerlos habría puesto una diana sobre su clan. Un Gorhorn vivo la enfrenta a esa decisión.',
    personality: 'Fría en el cálculo y cálida en el trato, en ese orden. Comulga con las Gargantúas en las migraciones.',
    homeLocationSlug: 'campamento-serhu',
    loadout: [
      { itemSlug: 'cuchillo-deshuello' },
      { itemSlug: 'manojo-salvia-polvo', cantidad: 3 },
      { itemSlug: 'amuleto-hueso', notas: 'Vértebras de gargantúa — símbolo de su comunión' },
      { itemSlug: 'sal-trueque', cantidad: 2 },
      { itemSlug: 'odre-agua' },
      { itemSlug: 'cataplasma-salvia', cantidad: 2 },
      { itemSlug: 'cataplasma-flor-ceniza', cantidad: 2 },
    ],
  },
  {
    slug: 'hagar',
    name: 'Hagar',
    kind: 'PRINCIPAL',
    aliases: ['hagar'],
    faction: 'Clan Helsig',
    role: 'Minero de hielo sílice, amigo de infancia de Gorhorn',
    level: 2,
    attributes: { fuerza: 15, destreza: 8, sigilo: 5, voluntad: 12, carisma: 11, arcano: 9 },
    bio: 'Orco del Clan Helsig, de las tribus orcas de Cristal Helado — piel de un pálido azulado propio de los orcos de zonas nevadas, curtida por el viento de la montaña más que por el sol. Manos gruesas y llenas de callos de picar hielo sílice, cara ancha y siempre a punto de reírse, el contrapunto exacto del Gorhorn callado que conoció en las minas. Amigo de Gorhorn del Clan Helsig, de las minas de hielo sílice en Cristal Helado. Vive fuera del grafo v1 (Cristal Helado), pero es el vínculo personal vivo de Gorhorn — si la partida lo trae, no debe improvisársele números.',
    personality: 'Leal, ruidoso, de risa fácil — el opuesto exacto del Gorhorn callado de las minas, por eso encajaron.',
    loadout: [
      { itemSlug: 'pico-minero' },
      { itemSlug: 'cuchillo-hielo-silice' },
      { itemSlug: 'esquirla-hielo-silice', cantidad: 2 },
      { itemSlug: 'racion-viaje', cantidad: 2 },
      { itemSlug: 'piedras-chispa' },
    ],
  },
  {
    slug: 'orco-rezagado',
    name: 'Guerrero orco rezagado',
    kind: 'PLANTILLA',
    aliases: ['guerrero orco rezagado', 'rezagado', 'orco rezagado', 'un rezagado'],
    faction: null,
    role: 'Guerrero sin clan, separado de los suyos',
    level: 2,
    levelMax: 3,
    attributes: { fuerza: 14, destreza: 9, sigilo: 7, voluntad: 11, carisma: 7, arcano: 6 },
    bio: 'Orco corpulento de piel beige y parda, curtida como la propia estepa de las Llanuras — cualquier pintura o marca de clan que llevara se ha desdibujado bajo meses de polvo y mala vida. Guerrero sin clan visible, separado de los suyos por la guerra o la desgracia — arquetipo instanciable, no un individuo con historia propia.',
    personality: 'Desconfiado, a la defensiva, impredecible según cómo se le aborde.',
    loadout: [
      { itemSlug: 'maza-orca', notas: 'Mellada' },
      { itemSlug: 'amuleto-hueso' },
      { itemSlug: 'racion-carne', cantidad: 1, notas: 'Pasada' },
      { itemSlug: 'marca-de-clan', notas: 'De su clan, sin especificar cuál' },
      { itemSlug: 'hacha-de-mano-orca' },
      { itemSlug: 'botas-de-estepa' },
      { itemSlug: 'cinturon-de-trofeos' },
      { itemSlug: 'anillo-vertebra-corredor' },
    ],
  },
  // Misión inicial de combate (petición explícita, 2026-07-23: "una mision simple, en la que nos
  // enfrentaremos a un orco enfurecido localizado cerca de nuestra posicion inicial") — PRINCIPAL,
  // no PLANTILLA, porque es un encuentro único ligado a esta misión (una sola fila de NpcState por
  // partida), no un arquetipo repetible como orco-rezagado. Vive en la propia Hondonada del Eco: su
  // descripción ya avisa de que, al estar hundida, "no se ve quién se acerca por arriba hasta que
  // es tarde" — la emboscada encaja sin inventar una ubicación nueva. Su loadout incluye el "Mapa
  // de las Llanuras" que la misión da como recompensa.
  //
  // Bio conectada (segunda vuelta de diseño, 2026-07-23) a Gistera Koh (ver más abajo): ya no es
  // una furia genérica por una pérdida sin nombre — retó a Gistera Koh a un duelo de honor, ella
  // se negó a pelear y huyó, y esa humillación pública es lo que lo rompió. Reutiliza la misma
  // costumbre de duelo de honor ya establecida (el padre de Gorhorn murió reclamando el puesto de
  // Kort'ikar en un duelo — areas.md § "Los clanes orcos"), esta vez del lado de quien lo pierde
  // sin sangre.
  {
    slug: 'orco-enfurecido-hondonada',
    name: 'Orco enfurecido',
    kind: 'PRINCIPAL',
    aliases: ['orco enfurecido', 'el enfurecido', 'orco loco', 'orco de la hondonada'],
    faction: null,
    role: "Guerrero Serhu deshonrado, persigue a Gistera Koh tras un duelo de honor rechazado",
    level: 2,
    attributes: { fuerza: 13, destreza: 10, sigilo: 5, voluntad: 8, carisma: 2, arcano: 2 },
    bio: "Orco del Clan Serhu, piel beige agrietada, sin pintura de clan visible — se la arrancó él mismo, en el mismo arranque de furia que lo trajo hasta aquí. Retó a Gistera Koh a un duelo de honor hace semanas; ella se negó a pelear y huyó en vez de aceptarlo. Para el clan, negarse y huir es deshonra — de ella. Para él, verla huir en vez de enfrentarlo lo rompió de otra forma: humillado en público, dejó de hablar con nadie y salió tras ella sin que ningún Kort'ikar se lo ordenara. Duerme y merodea en la Hondonada del Eco, donde el terreno hundido le permite ver llegar a cualquiera antes de que lo vean a él. Entre sus cosas lleva un mapa de las rutas y campamentos de la región, marcado a mano — lo único suyo que aún tiene sentido.",
    personality: 'Errático y violento con cualquiera, obsesivo con ella — ataca al primer contacto sin intentar hablar.',
    homeLocationSlug: 'hondonada-del-eco',
    loadout: [
      { itemSlug: 'maza-orca', notas: 'Astillada, con sangre seca' },
      { itemSlug: 'amuleto-hueso' },
      { itemSlug: 'mapa-de-las-llanuras' },
    ],
  },
  // Gistera Koh (segunda vuelta de diseño, 2026-07-23: "Una orca de nombre Gistera Koh, expulsada
  // del clan Serhu y perseguida por el orco enfurecido") — encuentro guionizado del primer turno
  // de la partida (ver turnResolution.ts, hook del primer turno). PRINCIPAL: personaje con nombre
  // e historia propia, no un arquetipo repetible. No es objetivo de combate ni de saqueo — el
  // loadout es solo lo que lleva encima para huir, contexto narrativo si el jugador la registra.
  {
    slug: 'gistera-koh',
    name: 'Gistera Koh',
    kind: 'PRINCIPAL',
    aliases: ['gistera koh', 'gistera', 'la orca serhu', 'la expulsada'],
    faction: null,
    role: 'Guerrera expulsada del Clan Serhu, huye del Orco Enfurecido',
    level: 2,
    attributes: { fuerza: 10, destreza: 13, sigilo: 9, voluntad: 11, carisma: 12, arcano: 2 },
    bio: "Orca del Clan Serhu, piel beige y arcilla curtida por el sol de la estepa, trenzas deshechas de días corriendo sin parar. Retada a un duelo de honor por un guerrero de su propio clan, se negó a pelear y huyó — a ojos Serhu, deshonra suficiente para expulsarla. No fue cobardía: vio en sus ojos algo que ya no reconocía, y prefirió vivir señalada antes que enfrentarse a un hombre que ya no estaba del todo cuerdo. Lleva días delante de él, cada vez más cerca. Rápida de lengua y más rápida de ojo — lee a la gente antes de que hablen, y no ha sobrevivido esto solo corriendo.",
    personality: 'Aguda y pragmática, mide cada palabra antes de gastarla — no tiene tiempo ni margen para el orgullo que se permiten los guerreros con clan.',
    homeLocationSlug: 'hondonada-del-eco',
    loadout: [
      { itemSlug: 'cuchillo-corto' },
      { itemSlug: 'racion-viaje', cantidad: 1 },
      { itemSlug: 'odre-agua' },
    ],
  },
  {
    slug: 'cazador-serhu',
    name: 'Joven cazador/a Serhu',
    kind: 'PLANTILLA',
    aliases: ['joven cazador serhu', 'cazador serhu', 'cazadora serhu', 'cazador del clan serhu'],
    faction: 'Clan Serhu',
    role: 'Joven cazador/a en formación del Clan Serhu',
    level: 1,
    levelMax: 2,
    attributes: { fuerza: 11, destreza: 12, sigilo: 10, voluntad: 9, carisma: 8, arcano: 4 },
    bio: 'Orco u orca joven del Clan Serhu, todavía sin el volumen ni las cicatrices de un guerrero veterano — piel beige y parda como el resto del clan, colmillos aún cortos, marca de clan tatuada y reciente en el antebrazo. Sale a cazar o vigilar los alrededores del campamento.',
    personality: 'Curioso, algo fanfarrón, todavía sin la reserva de los guerreros veteranos.',
    homeLocationSlug: 'campamento-serhu',
    loadout: [
      { itemSlug: 'lanza-corta-caza' },
      { itemSlug: 'cuerda-tendon' },
      { itemSlug: 'racion-viaje', cantidad: 2 },
      { itemSlug: 'piel-corredor', cantidad: 1 },
      { itemSlug: 'capucha-piel-corredor' },
      { itemSlug: 'guantes-piel-corredor' },
      { itemSlug: 'bandolera-de-caza' },
      { itemSlug: 'trampa-de-lazo' },
      { itemSlug: 'silbato-hueso-caza' },
    ],
  },
  {
    slug: 'soldado-concordia',
    name: 'Soldado de patrulla de la Concordia',
    kind: 'PLANTILLA',
    aliases: ['soldado de la concordia', 'soldado concordia', 'patrulla de la concordia', 'soldado goirntes'],
    faction: 'Concordia de Hierro',
    role: 'Soldado de patrulla fronteriza',
    level: 2,
    levelMax: 3,
    attributes: { fuerza: 12, destreza: 10, sigilo: 6, voluntad: 13, carisma: 8, arcano: 4 },
    bio: 'Goirnte de la Meseta del Orden — piel gris, fría al tacto, que se tensa visiblemente cuando se concentra, rasgo propio de su pueblo. Uniformado con la disciplina que exige su casta de nacimiento. Soldado raso de una patrulla de la Concordia de Hierro que vigila la frontera de las Llanuras. Una patrulla tipo son 3 soldados + 1 oficial.',
    personality: 'Disciplinado, sigue órdenes sin cuestionar demasiado.',
    loadout: [
      { itemSlug: 'espada-corta-goirntes' },
      { itemSlug: 'cota-ligera-goirntes' },
      { itemSlug: 'racion-goirntes', cantidad: 2 },
      { itemSlug: 'yelmo-patrulla-goirntes' },
      { itemSlug: 'botas-marcha-goirntes' },
      { itemSlug: 'perneras-cuero-goirntes' },
      { itemSlug: 'pica-de-patrulla-goirntes' },
      { itemSlug: 'manta-campana-goirntes' },
      { itemSlug: 'aguardiente-goirntes' },
      { itemSlug: 'diario-de-soldado', notas: 'Un nombre distinto en cada patrulla' },
      { itemSlug: 'piedra-de-afilar' },
    ],
  },
  {
    slug: 'oficial-concordia',
    name: 'Oficial de patrulla de la Concordia',
    kind: 'PLANTILLA',
    aliases: ['oficial de la concordia', 'oficial concordia', 'oficial goirntes'],
    faction: 'Concordia de Hierro',
    role: 'Oficial al mando de una patrulla',
    level: 4,
    levelMax: 5,
    attributes: { fuerza: 12, destreza: 10, sigilo: 6, voluntad: 15, carisma: 12, arcano: 4 },
    bio: 'Goirnte de la Meseta del Orden — misma piel gris y fría al tacto que el resto de los suyos, aunque en un oficial se nota menos tensa: ha aprendido a controlar hasta ese reflejo. Porte rígido, uniforme sin una arruga fuera de sitio. Oficial al mando de una patrulla de la Concordia de Hierro. Lleva correspondencia sellada y el sello que acredita (o incrimina) su misión.',
    personality: 'Frío, calculador, más peligroso en el trato que en el combate directo.',
    loadout: [
      { itemSlug: 'espada-corta-goirntes' },
      { itemSlug: 'cota-ligera-goirntes' },
      { itemSlug: 'correspondencia-concordia' },
      { itemSlug: 'sello-patrulla-concordia' },
      { itemSlug: 'racion-goirntes', cantidad: 2 },
      { itemSlug: 'manoplas-goirntes' },
      { itemSlug: 'talabarte-goirntes' },
      { itemSlug: 'sello-anular-concordia' },
      { itemSlug: 'daga-aleacion-goirntes' },
      { itemSlug: 'mapa-de-patrullas' },
      { itemSlug: 'aguardiente-goirntes' },
      { itemSlug: 'lingote-aleacion-goirntes', notas: 'Paga o soborno, según a quién se lo ofrezca' },
    ],
  },
  // Peregrino de los Túmulos (checklist 2026-07-21/22, punto 3): variedad de TONO, no solo de
  // nombre — hasta ahora los 4 itinerantes eran o amenaza (rezagado, patrulla) o trueque
  // (mercader), ningún encuentro puramente social/pacífico. Grounded en la cultura de honor de
  // areas.md § "Los clanes orcos" y en Los Túmulos del Honor (ya en el catálogo).
  {
    slug: 'peregrino-de-los-tumulos',
    name: 'Peregrino de los Túmulos',
    kind: 'PLANTILLA',
    aliases: ['peregrino', 'peregrina', 'peregrino de los tumulos', 'peregrino de los túmulos', 'viajero de duelo'],
    faction: null,
    role: 'Orco en duelo, viaja a honrar a un caído en Los Túmulos del Honor',
    level: 1,
    levelMax: 1,
    attributes: { fuerza: 8, destreza: 7, sigilo: 6, voluntad: 13, carisma: 10, arcano: 4 },
    bio: 'Orco de un clan cualquiera de las Llanuras, piel en el tono beige o pardo propio de esas tribus, cuerpo delgado y marcado más por el camino que por la guerra. Lleva una tira de tela oscura anudada al brazo, señal de luto que cualquier clan reconoce. Sin prisa ni destino más allá de Los Túmulos del Honor — lleva algo que dejar en la tumba de alguien que murió con honor. No busca compañía ni pelea; si se le trata con respeto, agradece la charla en el camino.',
    personality: 'Callado y ensimismado, cortés si se le habla primero; el duelo, no el miedo, es lo que le hace evitar el contacto.',
    loadout: [
      { itemSlug: 'racion-viaje', cantidad: 1 },
      { itemSlug: 'odre-agua' },
      { itemSlug: 'amuleto-hueso', notas: 'La ofrenda que lleva para dejar en el túmulo' },
    ],
  },
  {
    slug: 'mercader-de-paso',
    name: 'Mercader de paso',
    kind: 'PLANTILLA',
    aliases: ['mercader', 'mercader de paso', 'comerciante', 'un mercader'],
    faction: null,
    role: 'Comerciante itinerante',
    level: 1,
    levelMax: 1,
    attributes: { fuerza: 7, destreza: 9, sigilo: 8, voluntad: 10, carisma: 14, arcano: 4 },
    bio: 'Orco sin clan — hace años cambió la lanza por la balanza de trueque, algo que pocos orcos entienden y menos aún respetan —, piel curtida por soles de media docena de regiones distintas, más delgado que un guerrero de su edad. Comerciante itinerante que cruza las rutas de la región con mercancía de trueque.',
    personality: 'Locuaz, siempre calculando el precio de todo, evita el conflicto directo.',
    loadout: [
      { itemSlug: 'cuchillo-corto' },
      { itemSlug: 'sal-trueque', cantidad: 2 },
      { itemSlug: 'grano-espiga-roja', cantidad: 4 },
      { itemSlug: 'abalorios' },
      { itemSlug: 'kit-costura-hueso' },
      { itemSlug: 'piedra-de-afilar' },
      { itemSlug: 'antorcha-de-resina', cantidad: 2 },
      { itemSlug: 'resina-trepador-ocaso' },
      { itemSlug: 'pluma-sombra-kroj', notas: 'De trueque con el Margen' },
    ],
  },

  // --- NPCs de apoyo de Berig fuera de las Llanuras (2026-07-22, petición explícita: "incluye
  // de momento solo todo lo que sea de Berig") — ganchos hacia otros personajes jugables
  // (Dessa Kaltrenn, Yerin Slaad), no hacia Gorhorn; sin loadout ni homeLocationSlug porque no
  // viven en el grafo de viaje de las Llanuras — son referencia de la Enciclopedia, no NPCs
  // encontrables en la partida de Gorhorn hoy.
  {
    slug: 'vrask-ombra',
    name: 'General Vrask Ombra',
    kind: 'PRINCIPAL',
    aliases: ['vrask ombra', 'general ombra', 'general vrask ombra'],
    faction: 'Concordia de Hierro',
    role: 'Mando militar de la Concordia de Hierro',
    level: 6,
    attributes: { fuerza: 11, destreza: 8, sigilo: 6, voluntad: 16, carisma: 13, arcano: 3 },
    bio: 'Goirnte de la Meseta del Orden — piel gris severa, tensa incluso en reposo, curtida por años de mando. Ejecuta órdenes radicales en público, pero en privado sospecha que la versión oficial es mentira, y busca con discreción —sin poder confiar en sus propios canales— testigos de la noche de la ruptura del sello.',
    personality: 'Habla poco y en tono bajo; cuanto más tranquilo suena, más peligroso es el momento. Jamás repite una orden.',
    loadout: [],
  },
  {
    slug: 'kael-dorn',
    name: 'Kael Dorn',
    kind: 'PRINCIPAL',
    aliases: ['kael dorn', 'kael'],
    faction: null,
    role: 'Exmiembro de la facción radical Goirnte, fugitivo',
    level: 3,
    attributes: { fuerza: 8, destreza: 9, sigilo: 10, voluntad: 8, carisma: 6, arcano: 4 },
    bio: 'Goirnte de la Meseta del Orden — piel gris apagada, más floja y menos tensa de lo normal en los suyos, como si hubiera dejado de concentrarse en nada desde hace tiempo. Exmiembro de la facción radical que ayudó a romper el sello. Vive escondido y consumido por la culpa — es la única prueba viviente de la traición interna, lo que lo convierte en el hombre más buscado de Berig por dos motivos opuestos: los radicales quieren silenciarlo; quienes sospechan la verdad lo necesitan vivo.',
    personality: 'Habla en círculos y nunca termina las frases que rozan "esa noche"; sobresalta con los ruidos de metal.',
    loadout: [],
  },
  {
    slug: 'sella-marn',
    name: 'Sella Marn',
    kind: 'PRINCIPAL',
    aliases: ['sella marn', 'sella'],
    faction: null,
    role: 'Traficante de información independiente',
    level: 3,
    attributes: { fuerza: 5, destreza: 10, sigilo: 15, voluntad: 10, carisma: 12, arcano: 4 },
    bio: 'Nabieus del Margen Silencioso — piel gris apagada que no refleja ni absorbe la luz, cuerpo delgado y casi sin peso, como el resto de los suyos. Compra y vende información a ambas alianzas por igual, sin lealtades — ha olido que lo que Yerin Slaad recuerda de cierta entrega vale más que todo su inventario.',
    personality: 'Habla más alto que cualquier otro Nabieus — deliberadamente, un gesto casi obsceno entre los suyos que usa para incomodar y marcar distancia con su propio pueblo.',
    loadout: [],
  },
  {
    slug: 'yovenne-tal',
    name: 'Archimagistrada Yovenne Tal',
    kind: 'PRINCIPAL',
    aliases: ['yovenne tal', 'archimagistrada yovenne tal', 'archimagistrada tal'],
    faction: 'Concordia de Hierro (facción moderada)',
    role: 'Archimagistrada de la facción moderada Goirnte',
    level: 5,
    attributes: { fuerza: 6, destreza: 7, sigilo: 5, voluntad: 15, carisma: 14, arcano: 3 },
    bio: 'Goirnte de la Meseta del Orden — piel gris que se nota tensarse incluso al hablar de leyes, señal de una mente que nunca deja de calcular el orden de las cosas. Intenta frenar a la facción radical desde la política interna, pero la ley le exige pruebas presentadas "en orden" de la traición del sello que nadie puede presentarle todavía por canal legítimo.',
    personality: 'Cita de memoria las leyes de los obeliscos, artículo y línea; jamás improvisa un argumento que no pueda sostener por escrito.',
    loadout: [],
  },
];

export interface ItemCatalogInput {
  slug: string;
  name: string;
  category: string;
  description: string;
  /// Bonificador real al equipar (2026-07-19) — armas (uno de los 6 atributos jugables) y, desde
  /// el slot de defensa, armaduras reales ('defensa', resta a la dificultad de contraataque en
  /// npcScene.ts). El resto del catálogo sigue siendo puramente narrativo.
  statBonusAttribute?: Attribute | 'defensa';
  statBonusAmount?: number;
  /// Medidas físicas aproximadas, texto libre (2026-07-22, "para los objetos sus medidas y su
  /// lugar de origen... que eso se refleje en los prompts") — para que el generador de imágenes
  /// tenga una cifra concreta en vez de tener que inventarla o dejarla ambigua.
  dimensiones?: string;
  /// Lugar/pueblo de origen o fabricación, cuando aporta algo al lore. Omitido en objetos sin
  /// origen especial (comunes, de fabricación anónima).
  lugarOrigen?: string;
  /// Sesión de diseño 2026-07-23: nivel de rareza/dificultad (1-5) y mínimos de atributo del PJ
  /// para EQUIPARLO (comprobados en PATCH /saves/:id/inventario/:itemId) — UMBRAL puro, nunca
  /// una tirada. Omitidos = tier 1 (común), sin requisito.
  tier?: number;
  requisitos?: Requisitos;
}

export const items: ItemCatalogInput[] = [
  {
    slug: 'hacha-guerra-orca',
    name: 'Hacha de guerra orca',
    category: 'arma',
    description: 'Hacha pesada de cabeza de hierro ennegrecido y mango de madera envuelto en tiras de cuero — el arma orca por excelencia.',
    statBonusAttribute: 'fuerza',
    statBonusAmount: 2,
    dimensiones: 'Astil de 80 cm, cabeza de hierro de 20 cm de ancho.',
    lugarOrigen: 'Manufactura orca, sin clan de origen único.',
    // Sesión de diseño 2026-07-23: arma común (tier 1) — requisito modesto, cualquier guerrero
    // orco adulto puede blandirla.
    tier: 1,
    requisitos: { fuerza: 8 },
  },
  {
    slug: 'maza-orca',
    name: 'Maza orca',
    category: 'arma',
    description: 'Maza de cabeza nudosa de hueso reforzado con remaches de hierro, mango corto envuelto en cuero — tosca, pesada, hecha para aplastar, no para el filo.',
    statBonusAttribute: 'fuerza',
    statBonusAmount: 2,
    dimensiones: 'Mango de 55 cm, cabeza nudosa de 15 cm de diámetro.',
    lugarOrigen: 'Manufactura orca.',
  },
  {
    slug: 'cuchillo-hielo-silice',
    name: 'Cuchillo de hielo sílice',
    category: 'arma',
    description: 'Hoja de hielo sílice de un blanco azulado translúcido, dura como el pedernal y fría al tacto incluso lejos de la montaña — filo mineral, comercio con los Helsig.',
    statBonusAttribute: 'sigilo',
    statBonusAmount: 1,
    dimensiones: 'Hoja de 18 cm, empuñadura de 10 cm.',
    lugarOrigen: 'Clan Helsig, minas de Cristal Helado.',
  },
  {
    slug: 'cuchillo-deshuello',
    name: 'Cuchillo de deshuello de hielo sílice',
    category: 'herramienta',
    description: 'Hoja corta y curva de hielo sílice, más gruesa que un cuchillo normal para no quebrarse contra piel dura — para pieles duras, canon de Cristal Helado.',
    dimensiones: 'Hoja curva de 14 cm, notablemente más gruesa que un cuchillo estándar.',
    lugarOrigen: 'Clan Helsig, Cristal Helado.',
  },
  {
    slug: 'lanza-hueso-gargantua',
    name: 'Lanza de hueso de gargantúa',
    category: 'arma',
    description: 'Asta larga rematada en una punta de hueso de gargantúa pulido hasta sacarle filo, blanco amarillento veteado — usada en cacerías rituales y duelos de honor.',
    statBonusAttribute: 'fuerza',
    statBonusAmount: 1,
    dimensiones: 'Asta de 190 cm, punta de hueso de 25 cm.',
    lugarOrigen: 'Llanuras del Viento Rojo, cacería ritual orca.',
    // Sesión de diseño 2026-07-23: arma de duelo/cacería ritual (tier 2) — exige algo más de
    // fuerza que un arma común para manejarla con la distancia y el respeto que exige un duelo.
    tier: 2,
    requisitos: { fuerza: 10 },
  },
  {
    slug: 'lanza-corta-caza',
    name: 'Lanza corta de caza',
    category: 'arma',
    description: 'Asta corta y ligera de madera clara con punta de hueso afilado, del tamaño justo para manejarla con una mano — la de los jóvenes cazadores.',
    statBonusAttribute: 'destreza',
    statBonusAmount: 1,
    dimensiones: 'Asta de 120 cm, punta de hueso de 15 cm.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },
  {
    slug: 'espada-corta-goirntes',
    name: 'Espada corta goirntes',
    category: 'arma',
    description: 'Hoja recta de aleación gris pulida, más ligera y mejor equilibrada que cualquier arma orca — manufactura goirnte, refinada hasta en el filo.',
    statBonusAttribute: 'destreza',
    statBonusAmount: 1,
    dimensiones: 'Hoja recta de 55 cm, empuñadura de 12 cm.',
    lugarOrigen: 'Manufactura goirnte, Meseta del Orden.',
  },
  {
    slug: 'cuchillo-corto',
    name: 'Cuchillo corto',
    category: 'arma',
    description: 'Hoja corta de hierro sin adornos, mango de madera desgastada — común, sin origen especial.',
    statBonusAttribute: 'sigilo',
    statBonusAmount: 1,
    dimensiones: 'Hoja de 15 cm, mango de 10 cm.',
  },
  {
    slug: 'pico-minero',
    name: 'Pico de minero',
    category: 'herramienta',
    description: 'Pico de cabeza de hierro pesado y mango largo de madera, punta desgastada de golpear roca y hielo — herramienta de minería de hielo sílice.',
    dimensiones: 'Cabeza de 25 cm, mango de 90 cm.',
    lugarOrigen: 'Cristal Helado.',
  },
  {
    slug: 'cuerda-tendon',
    name: 'Cuerda de tendón',
    category: 'herramienta',
    description: 'Cuerda trenzada de tendón seco, resistente y algo rígida al tacto — hecha de tendón de Corredor de Cauce.',
    dimensiones: 'Rollo de 8 metros, 4 mm de grosor.',
  },
  {
    slug: 'odre-agua',
    name: 'Odre de agua',
    category: 'herramienta',
    description: 'Odre de cuero curtido cosido a mano, correa larga para llevar al hombro — imprescindible en la estepa.',
    dimensiones: 'Capacidad de 2 litros, correa de 70 cm.',
  },
  {
    slug: 'piedras-chispa',
    name: 'Piedras de chispa',
    category: 'herramienta',
    description: 'Un par de piedras oscuras y ásperas al tacto, bordes desgastados de tanto entrechocarlas — para encender fuego sin Raíz de Fuego.',
    dimensiones: 'Par de piedras de unos 5 cm cada una.',
  },
  {
    slug: 'arnes-cuero',
    name: 'Arnés de cuero',
    category: 'ropa',
    description: 'Arnés de cuero curtido, correas cruzadas al pecho, remaches de hueso.',
    statBonusAttribute: 'defensa',
    statBonusAmount: 1,
    dimensiones: 'Ajustable a un contorno de torso de 90 a 120 cm.',
  },
  {
    slug: 'cota-ligera-goirntes',
    name: 'Cota de aleación ligera goirntes',
    category: 'ropa',
    description: 'Cota de anillas finas de un gris metálico apagado, sorprendentemente ligera — de Hierba del Hierro procesada.',
    statBonusAttribute: 'defensa',
    statBonusAmount: 2,
    dimensiones: 'Cota hasta la cadera, anillas de 1 cm de diámetro.',
    lugarOrigen: 'Manufactura goirnte, Meseta del Orden.',
    // Sesión de diseño 2026-07-23: aguantar el peso de una cota completa toda una jornada exige
    // resistencia física real (atributo secundario, no fuerza pura) — primer ejemplo de requisito
    // de equipar sobre un atributo distinto a los 6 jugables.
    tier: 2,
    requisitos: { resistenciaFisica: 8 },
  },
  {
    slug: 'capa-piel-gargantua',
    name: 'Capa de piel de gargantúa',
    category: 'ropa',
    description: 'Capa gruesa de piel gris ceniza de gargantúa, pesada y cálida, con pequeñas placas óseas todavía cosidas al cuero.',
    dimensiones: 'Capa de 140 cm de largo.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },
  {
    slug: 'piel-corredor',
    name: 'Piel de Corredor de Cauce',
    category: 'material',
    description: 'Piel rojiza de Corredor de Cauce, fina y flexible, curtida para aguantar el calor de la llanura.',
    dimensiones: 'Pieza de aproximadamente 100x60 cm.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },
  {
    slug: 'piel-gargantua',
    name: 'Piel de gargantúa',
    category: 'material',
    description: 'Piel gruesa de un gris ceniciento, curtida en placas rígidas — solo de cacería ritual o cadáver ya muerto.',
    dimensiones: 'Placa de aproximadamente 150x100 cm.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },
  {
    slug: 'placa-osea-gargantua',
    name: 'Placa ósea de gargantúa',
    category: 'material',
    description: 'Placa ósea blanquecina y gruesa, curva como una costilla — usada en construcción o armadura pesada.',
    dimensiones: 'Placa curva de 40x25 cm.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },
  {
    slug: 'hueso-largo-gargantua',
    name: 'Hueso largo de gargantúa',
    category: 'material',
    description: 'Hueso largo y macizo de un blanco amarillento, pesado en la mano — materia prima de lanzas.',
    dimensiones: 'Hueso de 90 cm de largo.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },
  {
    slug: 'hueso-ligero',
    name: 'Hueso ligero',
    category: 'material',
    description: 'Hueso pequeño y liviano, fácil de tallar — para abalorios, agujas, mangos.',
    dimensiones: 'Fragmentos de 5 a 15 cm.',
  },
  {
    slug: 'caparazon-espina',
    name: 'Caparazón de Espina del Viento',
    category: 'material',
    description: 'Placa de quitina oscura y brillante, dura como el cuerno, del caparazón de una Espina del Viento.',
    dimensiones: 'Placa de 30x20 cm.',
  },
  {
    slug: 'esquirla-hielo-silice',
    name: 'Esquirla de hielo sílice',
    category: 'material',
    description: 'Esquirla translúcida de un blanco azulado, fría al tacto y con un filo natural — para tallar filos y prótesis.',
    dimensiones: 'Esquirla de 10 a 20 cm.',
    lugarOrigen: 'Cristal Helado.',
  },
  {
    slug: 'lena-matorral-cuerno',
    name: 'Leña de matorral de cuerno',
    category: 'material',
    description: 'Trozos de madera oscura y retorcida, corteza agrietada — arde lento y caliente. Producto de la fórmula de leña ya existente.',
    dimensiones: 'Trozos de 20 a 40 cm.',
  },
  { slug: 'piedra', name: 'Piedra', category: 'material', description: 'Bloques y cascotes de roca erosionada — sirven para levantar muros, cimientos o un campamento.', dimensiones: 'Bloques de 20 a 30 cm.' },
  {
    slug: 'racion-viaje',
    name: 'Ración de viaje',
    category: 'consumible',
    description: 'Bulto envuelto en tela basta con lo justo para aguantar el camino — unidad estándar de raciones, "para N días".',
    dimensiones: 'Bulto de 15x10 cm por ración.',
  },
  {
    slug: 'racion-goirntes',
    name: 'Ración goirntes',
    category: 'consumible',
    description: 'Bloque compacto de comida prensada envuelto en papel encerado — más compacta y mejor conservada que la de campaña orca.',
    dimensiones: 'Bloque de 12x8 cm.',
    lugarOrigen: 'Meseta del Orden.',
  },
  {
    slug: 'racion-carne',
    name: 'Ración de carne fresca',
    category: 'consumible',
    description: 'Trozos de carne fresca de caza, todavía con algo de sangre — se estropea en días.',
    dimensiones: 'Trozos de 300 a 500 g.',
  },
  { slug: 'racion-carne-ahumada', name: 'Ración de carne ahumada', category: 'consumible', description: 'Ahumada sobre fuego — a diferencia de la carne fresca, aguanta mucho más antes de estropearse.', dimensiones: 'Trozos de 300 a 500 g.' },
  {
    slug: 'grano-espiga-roja',
    name: 'Grano de espiga roja',
    category: 'consumible',
    description: 'Puñado de grano rojo ocre de Espiga Roja — tostado o crudo, como forraje.',
    dimensiones: 'Puñado de 100 a 200 g.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },
  {
    slug: 'sal-trueque',
    name: 'Sal de trueque',
    category: 'valor',
    description: 'Bloques de sal gris comprimida, ásperos al tacto — la moneda de facto de la estepa.',
    dimensiones: 'Bloques de 8x5 cm.',
  },
  {
    slug: 'manojo-salvia-polvo',
    name: 'Manojo de salvia del polvo',
    category: 'medicinal',
    description: 'Manojo de hojas grises secas de Salvia del Polvo, atadas con un cordel — machacadas, cortan hemorragias y limpian heridas.',
    dimensiones: 'Manojo de 15 cm.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },
  {
    slug: 'veneno-espina',
    name: 'Aguijón con veneno de Espina del Viento',
    category: 'medicinal',
    description: 'Aguijón oscuro extraído con cuidado, todavía con una gota espesa de veneno en la punta — altera la percepción del dolor.',
    dimensiones: 'Aguijón de 6 cm.',
  },
  {
    slug: 'raiz-de-fuego',
    name: 'Raíz de fuego',
    category: 'consumible',
    description: 'Tallo nudoso y oscuro de Raíz de Fuego, caliente al tacto incluso recién cortado — iniciador de fuego, potencialmente explosivo.',
    dimensiones: 'Tallo de unos 20 cm.',
  },
  {
    slug: 'correspondencia-concordia',
    name: 'Correspondencia sellada de la Concordia',
    category: 'documento',
    description: 'Rollo de pergamino sellado con cera y el emblema de la Concordia — puede saber demasiado.',
    dimensiones: 'Rollo de 20 cm.',
    lugarOrigen: 'Concordia de Hierro.',
  },
  {
    slug: 'sello-patrulla-concordia',
    name: 'Sello de patrulla de la Concordia',
    category: 'documento',
    description: 'Disco de aleación grabado con el emblema de una patrulla — acredita, o incrimina, a quien lo lleva.',
    dimensiones: 'Disco de 4 cm de diámetro.',
    lugarOrigen: 'Concordia de Hierro.',
  },
  {
    slug: 'amuleto-hueso',
    name: 'Amuleto de hueso',
    category: 'valor',
    description: 'Cordel de cuero con vértebras o colmillos tallados de una presa importante, colgados como cuentas.',
    dimensiones: 'Cordel de 40 cm con piezas de 2 a 3 cm.',
  },
  {
    slug: 'abalorios',
    name: 'Abalorios variados',
    category: 'valor',
    description: 'Puñado de cuentas de hueso, piedra pulida y vidrio volcánico ensartadas en cordel — trueque menor.',
    dimensiones: 'Cuentas de 1 cm en cordel de 30 cm.',
  },
  {
    slug: 'marca-de-clan',
    name: 'Marca de clan',
    category: 'valor',
    description: 'Colgante o tira de cuero con el símbolo tallado de un clan — cuál exactamente se especifica en las notas.',
    dimensiones: 'Colgante de 5 cm.',
  },
  {
    slug: 'totem-clan-roto',
    name: 'Tótem de clan roto',
    category: 'valor',
    description: 'Fragmento de madera de ciénaga tallada, roto por la mitad, con restos de un símbolo de clan irreconocible — gancho de un posible superviviente Maktor.',
    dimensiones: 'Fragmento de 15 cm.',
    lugarOrigen: 'Ciénaga Troncal.',
  },
  {
    slug: 'totem-maktor',
    // Renombrado a "Tótem Maktor" (petición explícita de la usuaria, 2026-07-24) — mismo objeto
    // que el equipo inicial de Gorhorn (startingInventory.ts), ahora sí enlazado por catalogSlug.
    name: 'Tótem Maktor',
    category: 'valor',
    description: 'Tótem de madera oscura de ciénaga, tallado con la marca del Clan Maktor — único, el de Gorhorn.',
  },
  {
    slug: 'plumas-rojizas',
    name: 'Puñado de plumas rojizas',
    category: 'material',
    description: 'Puñado de plumas cortas de un rojo apagado, de Corretolvas — uso decorativo o trueque menor.',
    dimensiones: 'Plumas de 8 a 10 cm.',
  },

  // --- Ampliación de equipo/objetos (roadmap 2026-07-20, propuesta de Fable, ver memoria
  // project_tarkor_propuesta_objetos.md) — llena los huecos de EquipSlot que antes no tenían
  // ningún objeto real asignable. Cada uno con origen concreto (ver loadout de los NPCs, más abajo).

  // Casco
  {
    slug: 'yelmo-patrulla-goirntes',
    name: 'Yelmo de patrulla goirntes',
    category: 'ropa',
    description: 'Casco abierto de aleación ligera, sello de la Concordia en la frente.',
    statBonusAttribute: 'defensa',
    statBonusAmount: 1,
    dimensiones: 'Casco abierto, contorno de cabeza de 55 a 60 cm.',
    lugarOrigen: 'Concordia de Hierro, Meseta del Orden.',
  },
  {
    slug: 'capucha-piel-corredor',
    name: 'Capucha de piel de corredor',
    category: 'ropa',
    description: 'Capucha de piel rojiza de Corredor de Cauce, ajustada a la cabeza — protege del sol y de la arena magnética.',
    dimensiones: 'Ajustada a cabeza y cuello.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },

  // Guantes
  {
    slug: 'guantes-piel-corredor',
    name: 'Guantes de piel de corredor',
    category: 'ropa',
    description: 'Agarre firme para lanza y cuchillo.',
    statBonusAttribute: 'destreza',
    statBonusAmount: 1,
    dimensiones: 'Talla estándar de mano orca.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },
  {
    slug: 'manoplas-goirntes',
    name: 'Manoplas de aleación goirntes',
    category: 'ropa',
    description: 'Manoplas de aleación gris articuladas en los nudillos — pieza de saqueo poco común, solo la lleva un oficial.',
    statBonusAttribute: 'defensa',
    statBonusAmount: 1,
    dimensiones: 'Talla estándar articulada en los nudillos.',
    lugarOrigen: 'Concordia de Hierro, Meseta del Orden.',
  },

  // Botas
  { slug: 'botas-de-estepa', name: 'Botas de estepa', category: 'ropa', description: 'Cuero y suela de piel de corredor, gastadas.', dimensiones: 'Caña hasta el tobillo.', lugarOrigen: 'Llanuras del Viento Rojo.' },
  {
    slug: 'botas-marcha-goirntes',
    name: 'Botas de marcha goirntes',
    category: 'ropa',
    description: 'Suela claveteada de aleación, equipamiento estándar de patrulla.',
    statBonusAttribute: 'destreza',
    statBonusAmount: 1,
    dimensiones: 'Caña hasta media pantorrilla.',
    lugarOrigen: 'Concordia de Hierro, Meseta del Orden.',
  },

  // Cinturón
  {
    slug: 'cinturon-de-trofeos',
    name: 'Cinturón de trofeos de hueso',
    category: 'ropa',
    description: 'Colmillos y garras cosidos al cuero — entre orcos, respeto a la vista.',
    statBonusAttribute: 'carisma',
    statBonusAmount: 1,
    dimensiones: 'Cinturón de 90 a 110 cm.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },
  { slug: 'talabarte-goirntes', name: 'Talabarte de cuero goirntes', category: 'ropa', description: 'Correaje de oficial, hebilla con el sello de la Concordia.', dimensiones: 'Correaje ajustable al torso.', lugarOrigen: 'Concordia de Hierro, Meseta del Orden.' },

  // Accesorio
  { slug: 'bandolera-de-caza', name: 'Bandolera de caza', category: 'ropa', description: 'Lazadas de tendón para cuchillo, trampas y piezas menores.', dimensiones: 'Banda cruzada de 100 cm.', lugarOrigen: 'Llanuras del Viento Rojo.' },
  { slug: 'manta-campana-goirntes', name: 'Manta de campaña goirntes', category: 'ropa', description: 'Lana encerada, enrollada al hombro.', dimensiones: 'Manta enrollada de 150x90 cm.', lugarOrigen: 'Meseta del Orden.' },

  // Anillos
  {
    slug: 'anillo-vertebra-corredor',
    name: 'Anillo de vértebra de corredor',
    category: 'ropa',
    description: 'Anillo tallado de una sola vértebra de Corredor de Cauce, pulida hasta sacarle brillo — recuerdo de una presa.',
    statBonusAttribute: 'voluntad',
    statBonusAmount: 1,
    dimensiones: 'Anillo de 2 cm de diámetro.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },
  {
    slug: 'sello-anular-concordia',
    name: 'Anillo de sello de la Concordia',
    category: 'ropa',
    description: 'Anillo de aleación gris con el sello de la Concordia grabado — acredita, o incrimina, a quien lo lleva.',
    dimensiones: 'Anillo de 2 cm de diámetro.',
    lugarOrigen: 'Concordia de Hierro.',
  },

  // Armadura superior/inferior
  {
    slug: 'peto-placas-gargantua',
    name: 'Peto de placas óseas de gargantúa',
    category: 'ropa',
    description: 'Peto de placas óseas blanquecinas de gargantúa cosidas sobre cuero grueso — armadura pesada, las placas solo salen de cacería ritual o cadáver ya viejo.',
    statBonusAttribute: 'defensa',
    statBonusAmount: 2,
    dimensiones: 'Cubre el torso completo.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
    // Mismo requisito que la receta de crafteo homónima (crafting.ts, gargantuaArmor) — equiparla
    // exige la misma fuerza que montarla, tanto si se craftea como si se encuentra ya hecha.
    tier: 3,
    requisitos: { fuerza: 10 },
  },
  {
    slug: 'perneras-cuero-goirntes',
    name: 'Perneras de cuero goirntes',
    category: 'ropa',
    description: 'Perneras de cuero reforzado gris — completa el uniforme de patrulla junto a la cota ligera.',
    statBonusAttribute: 'defensa',
    statBonusAmount: 1,
    dimensiones: 'Cubren de la cadera al tobillo.',
    lugarOrigen: 'Meseta del Orden.',
  },
  { slug: 'faldar-piel-gargantua', name: 'Faldar de piel de gargantúa', category: 'ropa', description: 'Faldar de piel gris ceniza de gargantúa, con pequeñas placas óseas todavía cosidas al cuero — abrigo, no defensa.', dimensiones: 'Faldar de 55 cm de largo.', lugarOrigen: 'Llanuras del Viento Rojo.' },

  // Armas nuevas
  {
    slug: 'hacha-de-mano-orca',
    name: 'Hacha de mano orca',
    category: 'arma',
    description: 'Hacha pequeña de cabeza de hierro y mango corto — versión ligera de una mano, para la mano secundaria.',
    statBonusAttribute: 'fuerza',
    statBonusAmount: 1,
    dimensiones: 'Mango de 35 cm, cabeza de 12 cm.',
    lugarOrigen: 'Manufactura orca.',
  },
  {
    slug: 'pica-de-patrulla-goirntes',
    name: 'Pica de patrulla goirntes',
    category: 'arma',
    description: 'Asta larga rematada en punta de aleación gris — arma de formación estándar en una patrulla fronteriza.',
    statBonusAttribute: 'fuerza',
    statBonusAmount: 1,
    dimensiones: 'Asta de 210 cm.',
    lugarOrigen: 'Concordia de Hierro, Meseta del Orden.',
  },
  {
    slug: 'daga-aleacion-goirntes',
    name: 'Daga de aleación goirntes',
    category: 'arma',
    description: 'Hoja corta de aleación gris pulida, empuñadura ajustada — manufactura refinada goirntes.',
    statBonusAttribute: 'sigilo',
    statBonusAmount: 1,
    dimensiones: 'Hoja de 20 cm.',
    lugarOrigen: 'Manufactura goirnte, Meseta del Orden.',
  },
  {
    slug: 'garrote-matorral-cuerno',
    name: 'Garrote de matorral de cuerno',
    category: 'arma',
    description: 'Madera densa y retorcida, tallada a mano — la primera arma para quien no tiene ninguna.',
    statBonusAttribute: 'fuerza',
    statBonusAmount: 1,
    dimensiones: 'Palo de 60 cm.',
  },

  // Utilidad, consumibles y objetos narrativos
  {
    slug: 'trampa-de-lazo',
    name: 'Trampa de lazo de tendón',
    category: 'herramienta',
    description: 'Lazo trenzado de tendón anclado a una estaca de madera — para cazar sin necesidad de perseguir.',
    dimensiones: 'Lazo de 1 metro, estaca de 30 cm.',
  },
  {
    slug: 'kit-costura-hueso',
    name: 'Kit de costura de hueso',
    category: 'herramienta',
    description: 'Agujas de hueso fino y cordel enrollado en un retal de cuero — reparar ropa y pieles en ruta.',
    dimensiones: 'Estuche de 15x8 cm.',
  },
  {
    slug: 'piedra-de-afilar',
    name: 'Piedra de afilar',
    category: 'herramienta',
    description: 'Piedra plana y áspera, gastada por un lado de tanto uso — mantiene el filo de un arma.',
    dimensiones: 'Piedra de 10x4 cm.',
  },
  {
    slug: 'antorcha-de-resina',
    name: 'Antorcha de resina de ciénaga',
    category: 'herramienta',
    description: 'Antorcha de madera envuelta en resina oscura de ciénaga — arde incluso con lluvia, comercio Llanuras-Ciénaga.',
    dimensiones: 'Antorcha de 45 cm.',
    lugarOrigen: 'Comercio Llanuras-Ciénaga Troncal.',
  },
  {
    slug: 'resina-trepador-ocaso',
    name: 'Bloque de resina de Trepador Ocaso',
    category: 'material',
    description: 'Bloque de resina ambarina y pegajosa — sella e impermeabiliza.',
    dimensiones: 'Bloque de 10x10 cm.',
    lugarOrigen: 'Margen Silencioso.',
  },
  { slug: 'cataplasma-salvia', name: 'Cataplasma de salvia del polvo', category: 'medicinal', description: 'Pasta verde grisácea de hojas machacadas de Salvia del Polvo — forma preparada de la salvia, corta hemorragias y limpia heridas.', dimensiones: 'Emplasto de 10x10 cm.', lugarOrigen: 'Llanuras del Viento Rojo.' },
  {
    slug: 'aguardiente-goirntes',
    name: 'Petaca de aguardiente goirntes',
    category: 'consumible',
    description: 'Petaca de metal con licor claro y fuerte — ración líquida de campaña, limpia heridas o da valor.',
    dimensiones: 'Petaca de 15 cm, 250 ml.',
    lugarOrigen: 'Meseta del Orden.',
  },
  {
    slug: 'mapa-de-patrullas',
    name: 'Croquis de rutas de patrulla',
    category: 'documento',
    description: 'Croquis a mano alzada sobre cuero fino, rutas marcadas con tinta desvaída — saber por dónde no pasar.',
    dimensiones: 'Croquis en cuero de 25x20 cm.',
    lugarOrigen: 'Concordia de Hierro.',
  },
  // Objeto con efecto mecánico real (petición explícita, 2026-07-23): tenerlo en el inventario
  // desbloquea ver los puntos de ubicación de Llanuras en la pestaña de Mapa (frontend,
  // InteractiveMap.tsx/MapZoomModal.tsx comprueban su nombre exacto en el inventario) — mismo
  // patrón "un objeto por región" pensado para el resto de Berig cuando se pueble con coordenadas.
  {
    slug: 'mapa-de-las-llanuras',
    name: 'Mapa de las Llanuras',
    category: 'documento',
    description: 'Piel curtida con las rutas, campamentos y pozos de las Llanuras del Viento Rojo marcados a mano por generaciones de clanes — suficiente para orientarse por el territorio sin perderse.',
    dimensiones: 'Piel curtida de 40x30 cm, enrollada.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },
  { slug: 'diario-de-soldado', name: 'Diario de un soldado goirntes', category: 'documento', description: 'Cuaderno de tapas de cuero gastado, letra apretada — un nombre, una familia en la Meseta, humaniza el saqueo.', dimensiones: 'Cuaderno de 15x10 cm.', lugarOrigen: 'Meseta del Orden.' },
  { slug: 'silbato-hueso-caza', name: 'Silbato de hueso de caza', category: 'valor', description: 'Pequeño silbato tallado en hueso pulido — señales de caza Serhu.', dimensiones: 'Silbato de 5 cm.', lugarOrigen: 'Clan Serhu, Llanuras del Viento Rojo.' },
  { slug: 'pluma-sombra-kroj', name: 'Pluma de Sombra de Kroj', category: 'valor', description: 'Pluma larga de un negro casi azulado que absorbe la luz — objeto de trueque con el Margen Silencioso.', dimensiones: 'Pluma de 25 cm.', lugarOrigen: 'Margen Silencioso.' },

  // --- Materiales de fauna/flora nueva (roadmap 2026-07-20, propuesta de Fable, ver memoria
  // project_tarkor_propuesta_fauna_flora.md) ---
  {
    slug: 'colmillo-aullador',
    name: 'Colmillo de Aullador Rojo',
    category: 'material',
    description: 'Colmillo curvo y afilado de Aullador Rojo — pieza clásica de los amuletos de hueso orcos.',
    dimensiones: 'Colmillo de 6 cm.',
  },
  {
    slug: 'lana-murgol',
    name: 'Lana de múrgol',
    category: 'material',
    description: 'Mechones de lana parda enredada de múrgol — fieltro para ropa y mantas.',
    dimensiones: 'Mechones de 10 a 20 cm.',
  },
  { slug: 'pluma-timonera', name: 'Pluma timonera de Cruzavientos', category: 'valor', description: 'Pluma larga y rígida de Cruzavientos, punta gris acerado — adorno y trueque, los Serhu las montan en lanzas y trenzas.', dimensiones: 'Pluma de 30 cm.' },
  {
    slug: 'piel-rondador',
    name: 'Piel de Rondador de Brasas',
    category: 'material',
    description: 'Piel gruesa de un gris ceniciento, pelaje espeso propio de cazador nocturno — buena capa.',
    dimensiones: 'Pieza de aproximadamente 80x50 cm.',
  },
  {
    slug: 'garra-rondador',
    name: 'Garra de Rondador de Brasas',
    category: 'valor',
    description: 'Garra curva y negra de Rondador de Brasas — trofeo de amuleto de primer orden.',
    dimensiones: 'Garra de 8 cm.',
  },
  { slug: 'glandula-ignea', name: 'Glándula ígnea de salamandra', category: 'consumible', description: 'Bolsa membranosa de un rojo anaranjado, caliente al tacto — iniciador de fuego potente, pariente animal de la Raíz de Fuego.', dimensiones: 'Bolsa de 6 cm.' },
  {
    slug: 'piel-salamandra',
    name: 'Piel de Salamandra de Escoria',
    category: 'material',
    description: 'Piel escamosa de un gris ceniciento, resistente al fuego — cuero ignífugo.',
    dimensiones: 'Pieza de aproximadamente 90x60 cm.',
  },
  { slug: 'aguja-de-cardo', name: 'Aguja de Cardo Brújula', category: 'herramienta', description: 'Aguja imantada natural: colgada de un hilo señala siempre el mismo rumbo, incluso en plena tormenta.', dimensiones: 'Aguja de 4 cm, colgada de un hilo de 20 cm.' },
  { slug: 'liquen-humedo', name: 'Liquen húmedo del cauce', category: 'consumible', description: 'Masticado calma la sed; donde crece, cavar un par de codos da agua.', dimensiones: 'Puñado de unos 10 cm.' },
  { slug: 'bulbo-cauce', name: 'Bulbo del Cauce', category: 'consumible', description: 'Tubérculo fibroso: comida y un trago de agua en uno.', dimensiones: 'Tubérculo de 8 cm.' },
  { slug: 'petalos-flor-ceniza', name: 'Pétalos de Flor de Ceniza', category: 'medicinal', description: 'Infusión que adormece el dolor y deja dormir a un herido.', dimensiones: 'Puñado de pétalos de 3 a 4 cm.' },
  { slug: 'arena-magnetica', name: 'Saquito de arena imán', category: 'valor', description: 'Limaduras que dejan las tormentas — los herreros goirntes pagan bien por un saquito.', dimensiones: 'Saquito de 10x8 cm.' },

  // Equipo inicial de Gorhorn (petición explícita de la usuaria, 2026-07-24: "el hacha de guerra
  // y el tótem que llevo equipado no están en la enciclopedia", luego "los pantalones de piel
  // tampoco... revisa que no quede nada fuera") — hasta ahora `startingInventory.ts` no tenía
  // `catalogSlug` en absoluto, así que el equipo inicial era invisible tanto para la Enciclopedia
  // (su lista de objetos sale de ItemCatalog) como para `entityDiscovery.ts` (solo reconoce
  // nombres de ItemCatalog). El hacha SÍ tiene ya su versión reparada en el catálogo
  // (`hacha-guerra-maktor-restaurada`, más abajo) pero nunca la rota original; los pantalones no
  // tenían ninguna fila de catálogo en absoluto.
  {
    slug: 'pantalones-piel',
    name: 'Pantalones de piel',
    category: 'ropa',
    description: 'Piel con pequeños detalles de pelo de cornamenta.',
  },
  {
    slug: 'hacha-guerra-maktor-rota',
    name: 'Hacha de guerra rota',
    category: 'arma',
    description: 'El hacha de guerra de su clan, partida por la mitad — la usa como una maza pesada.',
    statBonusAttribute: 'fuerza',
    statBonusAmount: 2,
    dimensiones: 'Astil de 75 cm, cabeza de hierro partida por la mitad.',
    lugarOrigen: 'Clan Maktor, Llanuras del Viento Rojo.',
  },
  // Crafteo v1: reparar el hacha rota de Gorhorn (roadmap 2026-07-20)
  {
    slug: 'hacha-guerra-maktor-restaurada',
    name: 'Hacha de guerra Maktor restaurada',
    category: 'arma',
    description: 'El hacha rota del clan, reforjada — la cabeza reasentada y el filo devuelto. Lo único del Clan Maktor que ha vuelto a estar entero.',
    statBonusAttribute: 'fuerza',
    statBonusAmount: 3,
    dimensiones: 'Astil de 85 cm, cabeza de 22 cm.',
    lugarOrigen: 'Clan Maktor, Llanuras del Viento Rojo.',
    // Mismo requisito que la receta de crafteo homónima (crafting.ts, axeRepair).
    tier: 3,
    requisitos: { fuerza: 12 },
  },

  // --- Tier 0, ronda 2 de objetos (roadmap 2026-07-20, ver memoria
  // project_tarkor_roadmap_objetos_2.md) — cierra 7 huecos reales del catálogo: Restos de Maktor
  // y Túmulos del Honor sin objeto propio, rareza cósmica del Origen Azul, comercio goirntes
  // ampliado, y dos formas preparadas más (mismo patrón que cataplasma-salvia).
  { slug: 'juguete-hueso-maktor', name: 'Juguete de hueso tallado', category: 'valor', description: 'Una figurita infantil tallada en hueso, medio enterrada entre los cimientos quemados — de algún niño del Clan Maktor que no llegó a crecer.', dimensiones: 'Figurita de 6 cm.', lugarOrigen: 'Ciénaga Troncal, Clan Maktor.' },
  { slug: 'brazalete-trenzado-maktor', name: 'Brazalete trenzado del Clan Maktor', category: 'valor', description: 'Tiras de cuero trenzado con cuentas de hueso, el trenzado propio del clan.', dimensiones: 'Brazalete de 18 cm.', lugarOrigen: 'Clan Maktor.' },
  { slug: 'tablilla-quemada-maktor', name: 'Tablilla quemada', category: 'documento', description: 'Fragmento de una tablilla de arcilla cocida, ennegrecida por el fuego que arrasó el asentamiento — lo que queda de la escritura apenas se distingue.', dimensiones: 'Fragmento de 12x8 cm.', lugarOrigen: 'Clan Maktor.' },
  { slug: 'panuelo-luto-serhu', name: 'Pañuelo de luto Serhu', category: 'valor', description: 'Tela oscura anudada a la piedra de un túmulo — luto Serhu por alguien que murió con honor.', dimensiones: 'Tela de 30x30 cm.', lugarOrigen: 'Clan Serhu.' },
  { slug: 'hueso-marcado-primer-caceria', name: 'Hueso marcado de primera cacería', category: 'valor', description: 'Hueso con muescas rituales — ofrenda dejada por quien cobró su primera pieza en nombre de quien yace en el túmulo.', dimensiones: 'Hueso de 15 cm.', lugarOrigen: 'Llanuras del Viento Rojo.' },
  { slug: 'esquirla-celeste-caida', name: 'Esquirla celeste caída', category: 'valor', description: 'Fragmento diminuto y frío al tacto, caído del cielo durante una tormenta — nadie en las Llanuras sabe explicar de dónde viene el Origen Azul, solo que a veces deja esto atrás.', dimensiones: 'Fragmento de 2 cm.' },
  { slug: 'lingote-aleacion-goirntes', name: 'Lingote de aleación goirntes', category: 'valor', description: 'Metal refinado de la Meseta del Orden, moldeado en lingote — bien de comercio serio, no baratija.', dimensiones: 'Lingote de 20x5x5 cm.', lugarOrigen: 'Meseta del Orden.' },
  { slug: 'cuna-hielo-silice-sin-tallar', name: 'Cuña de hielo sílice sin tallar', category: 'material', description: 'Bloque en bruto de hielo sílice de las minas de Cristal Helado, todavía sin tallar por manos Helsig — solo tiene sentido de verdad si se abre Cristal Helado.', dimensiones: 'Bloque en bruto de 15x10 cm.', lugarOrigen: 'Cristal Helado.' },
  { slug: 'cataplasma-flor-ceniza', name: 'Cataplasma de Flor de Ceniza', category: 'medicinal', description: 'Forma preparada de los pétalos de Flor de Ceniza — adormece el dolor y ayuda a dormir a un herido, más suave que la cataplasma de salvia.', dimensiones: 'Emplasto de 8x8 cm.' },
  { slug: 'agua-hervida-liquen', name: 'Agua hervida de liquen', category: 'consumible', description: 'Liquen húmedo del cauce hervido sobre fuego — más segura de beber que masticarlo en crudo.', dimensiones: 'Cantimplora de 500 ml.' },

  // Crafteo Tier 2, ronda 2 de objetos (roadmap 2026-07-20)
  { slug: 'contraveneno-salvia-ceniza', name: 'Contraveneno de salvia y ceniza', category: 'medicinal', description: 'Pasta oscura de olor amargo, mezcla preparada de salvia del polvo y pétalos de Flor de Ceniza — neutraliza el veneno de Espina del Viento.', dimensiones: 'Pasta de 50 g.' },

  // --- Materia prima de otras regiones de Berig (2026-07-22, "incluye de momento solo todo lo
  // que sea de Berig") — Hierba del Hierro en bruto no tenía item propio, solo su forma ya
  // procesada (cota-ligera-goirntes); las demás fuentes nuevas reutilizan items ya existentes.
  {
    slug: 'hierba-del-hierro',
    name: 'Hierba del Hierro',
    category: 'material',
    description: 'Hojas grisáceas extremadamente duras y ricas en minerales — materia prima de las aleaciones goirntes, sin procesar todavía.',
    dimensiones: 'Hojas de 20 a 30 cm.',
    lugarOrigen: 'Meseta del Orden.',
  },
];

export interface HarvestYieldInput {
  sourceSlug: string;
  sourceName: string;
  itemSlug: string;
  cantidad: number;
  condicion?: string;
}

export const harvestYields: HarvestYieldInput[] = [
  { sourceSlug: 'corredor-de-cauce', sourceName: 'Corredor de Cauce', itemSlug: 'piel-corredor', cantidad: 1, condicion: 'cuchillo (deshuello)' },
  { sourceSlug: 'corredor-de-cauce', sourceName: 'Corredor de Cauce', itemSlug: 'racion-carne', cantidad: 4 },
  { sourceSlug: 'corredor-de-cauce', sourceName: 'Corredor de Cauce', itemSlug: 'cuerda-tendon', cantidad: 2, condicion: 'cuchillo' },
  { sourceSlug: 'corredor-de-cauce', sourceName: 'Corredor de Cauce', itemSlug: 'hueso-ligero', cantidad: 6 },

  {
    sourceSlug: 'gargantua-de-ceniza',
    sourceName: 'Gargantúa de Ceniza',
    itemSlug: 'placa-osea-gargantua',
    cantidad: 2,
    condicion: 'SOLO cadáver ya muerto o cacería ritual de clan — nunca loot casual',
  },
  {
    sourceSlug: 'gargantua-de-ceniza',
    sourceName: 'Gargantúa de Ceniza',
    itemSlug: 'hueso-largo-gargantua',
    cantidad: 1,
    condicion: 'SOLO cadáver ya muerto o cacería ritual de clan — nunca loot casual',
  },
  {
    sourceSlug: 'gargantua-de-ceniza',
    sourceName: 'Gargantúa de Ceniza',
    itemSlug: 'piel-gargantua',
    cantidad: 1,
    condicion: 'SOLO cadáver ya muerto o cacería ritual de clan — nunca loot casual',
  },

  {
    sourceSlug: 'espina-del-viento',
    sourceName: 'Espina del Viento',
    itemSlug: 'veneno-espina',
    cantidad: 1,
    condicion: 'extracción cuidadosa (destreza, Media 15 — falla = veneno perdido, no herida automática)',
  },
  { sourceSlug: 'espina-del-viento', sourceName: 'Espina del Viento', itemSlug: 'caparazon-espina', cantidad: 1 },

  {
    sourceSlug: 'raiz-de-fuego',
    sourceName: 'Raíz de Fuego',
    itemSlug: 'raiz-de-fuego',
    cantidad: 1,
    condicion: 'extracción con cuidado (destreza, Media 15 — falla = se inflama)',
  },

  { sourceSlug: 'corretolvas', sourceName: 'Corretolvas', itemSlug: 'racion-carne', cantidad: 1 },
  { sourceSlug: 'corretolvas', sourceName: 'Corretolvas', itemSlug: 'plumas-rojizas', cantidad: 1 },

  {
    sourceSlug: 'salvia-del-polvo',
    sourceName: 'Salvia del Polvo',
    itemSlug: 'manojo-salvia-polvo',
    cantidad: 1,
    condicion: 'reconocerla (los orcos de las Llanuras la conocen de niños — para Gorhorn no requiere tirada)',
  },

  {
    sourceSlug: 'espiga-roja',
    sourceName: 'Espiga Roja',
    itemSlug: 'grano-espiga-roja',
    cantidad: 1,
    condicion: '1 por hora de recolección — fórmula determinista en timedActions.ts, patrón leña',
  },

  {
    sourceSlug: 'matorral-de-cuerno',
    sourceName: 'Matorral de Cuerno',
    itemSlug: 'lena-matorral-cuerno',
    cantidad: 1,
    condicion: 'la cantidad real la calcula la fórmula de leña ya existente en timedActions.ts',
  },

  // Roadmap de construcción (2026-07-20/21, petición explícita de la usuaria: recursos reales
  // para construir un campamento) — grounded en areas.md: Los Pilares Rotos es literalmente una
  // "formación rocosa erosionada", cantera natural sin necesidad de inventar un lugar nuevo.
  {
    sourceSlug: 'roca-pilares-rotos',
    sourceName: 'Roca de Los Pilares Rotos',
    itemSlug: 'piedra',
    cantidad: 3,
    condicion: 'formación rocosa erosionada — buena cantera improvisada, 3 piedras por recolección',
  },

  // --- Fauna/flora nueva (roadmap 2026-07-20, propuesta de Fable) ---
  { sourceSlug: 'aullador-rojo', sourceName: 'Aullador Rojo', itemSlug: 'racion-carne', cantidad: 2, condicion: 'carne dura de depredador — mejor cocinada' },
  { sourceSlug: 'aullador-rojo', sourceName: 'Aullador Rojo', itemSlug: 'hueso-ligero', cantidad: 3 },
  { sourceSlug: 'aullador-rojo', sourceName: 'Aullador Rojo', itemSlug: 'colmillo-aullador', cantidad: 2, condicion: 'cuchillo' },

  { sourceSlug: 'murgol', sourceName: 'Múrgol', itemSlug: 'racion-carne', cantidad: 3 },
  { sourceSlug: 'murgol', sourceName: 'Múrgol', itemSlug: 'lana-murgol', cantidad: 1, condicion: 'cuchillo' },
  { sourceSlug: 'murgol', sourceName: 'Múrgol', itemSlug: 'hueso-ligero', cantidad: 4 },

  { sourceSlug: 'cruzavientos', sourceName: 'Cruzavientos', itemSlug: 'racion-carne', cantidad: 2 },
  { sourceSlug: 'cruzavientos', sourceName: 'Cruzavientos', itemSlug: 'pluma-timonera', cantidad: 2 },

  {
    sourceSlug: 'rondador-de-brasas',
    sourceName: 'Rondador de Brasas',
    itemSlug: 'piel-rondador',
    cantidad: 1,
    condicion: 'cuchillo de deshuello',
  },
  { sourceSlug: 'rondador-de-brasas', sourceName: 'Rondador de Brasas', itemSlug: 'garra-rondador', cantidad: 2 },
  { sourceSlug: 'rondador-de-brasas', sourceName: 'Rondador de Brasas', itemSlug: 'racion-carne', cantidad: 3, condicion: 'carne fuerte — mejor ahumada' },

  {
    sourceSlug: 'salamandra-de-escoria',
    sourceName: 'Salamandra de Escoria',
    itemSlug: 'glandula-ignea',
    cantidad: 1,
    condicion: 'extracción con cuidado (destreza, Media 15 — falla = se inflama)',
  },
  {
    sourceSlug: 'salamandra-de-escoria',
    sourceName: 'Salamandra de Escoria',
    itemSlug: 'piel-salamandra',
    cantidad: 1,
    condicion: 'cuchillo de deshuello',
  },
  { sourceSlug: 'salamandra-de-escoria', sourceName: 'Salamandra de Escoria', itemSlug: 'racion-carne', cantidad: 2 },

  { sourceSlug: 'buitre-cenizo', sourceName: 'Buitre Cenizo', itemSlug: 'racion-carne', cantidad: 1, condicion: 'carne de carroñero — mala fama, solo con hambre real' },
  { sourceSlug: 'buitre-cenizo', sourceName: 'Buitre Cenizo', itemSlug: 'hueso-ligero', cantidad: 2 },

  {
    sourceSlug: 'cardo-brujula',
    sourceName: 'Cardo Brújula',
    itemSlug: 'aguja-de-cardo',
    cantidad: 1,
    condicion: 'cortarlo sin quebrar la fibra central (destreza, Media 15 — falla = fibra rota, inservible)',
  },
  {
    sourceSlug: 'liquen-del-cauce',
    sourceName: 'Liquen del Cauce',
    itemSlug: 'liquen-humedo',
    cantidad: 1,
    condicion: 'reconocerlo (los pastores de las Llanuras lo conocen — para Gorhorn no requiere tirada)',
  },
  {
    sourceSlug: 'bulbo-del-cauce',
    sourceName: 'Bulbo del Cauce',
    itemSlug: 'bulbo-cauce',
    cantidad: 1,
    condicion: '1 por hora de recolección — fórmula determinista en timedActions.ts, patrón leña',
  },
  {
    sourceSlug: 'flor-de-ceniza',
    sourceName: 'Flor de Ceniza',
    itemSlug: 'petalos-flor-ceniza',
    cantidad: 1,
    condicion: 'solo en suelo de ceniza — borde norte del núcleo y zona volcánica',
  },
  {
    sourceSlug: 'arena-iman',
    sourceName: 'Arena Imán',
    itemSlug: 'arena-magnetica',
    cantidad: 1,
    condicion: 'solo tras una tormenta de arena magnética reciente',
  },

  // --- Tier 0, ronda 2 de objetos (roadmap 2026-07-20) ---
  { sourceSlug: 'restos-personales-maktor', sourceName: 'Restos personales de Maktor', itemSlug: 'juguete-hueso-maktor', cantidad: 1 },
  { sourceSlug: 'restos-personales-maktor', sourceName: 'Restos personales de Maktor', itemSlug: 'brazalete-trenzado-maktor', cantidad: 1 },
  { sourceSlug: 'restos-personales-maktor', sourceName: 'Restos personales de Maktor', itemSlug: 'tablilla-quemada-maktor', cantidad: 1 },

  { sourceSlug: 'ofrendas-tumulos-honor', sourceName: 'Ofrendas de los Túmulos del Honor', itemSlug: 'panuelo-luto-serhu', cantidad: 1 },
  { sourceSlug: 'ofrendas-tumulos-honor', sourceName: 'Ofrendas de los Túmulos del Honor', itemSlug: 'hueso-marcado-primer-caceria', cantidad: 1 },

  {
    sourceSlug: 'arena-iman',
    sourceName: 'Arena Imán',
    itemSlug: 'esquirla-celeste-caida',
    cantidad: 1,
    condicion: 'extremadamente rara — tratar como añadido narrativo ocasional tras una tormenta fuerte, nunca drop garantizado',
  },
  {
    sourceSlug: 'liquen-del-cauce',
    sourceName: 'Liquen del Cauce',
    itemSlug: 'agua-hervida-liquen',
    cantidad: 1,
    condicion: 'requiere hervirlo sobre fuego ya encendido — no se obtiene masticándolo en crudo',
  },

  // --- Fauna/flora de otras regiones de Berig (2026-07-22, "incluye de momento solo todo lo que
  // sea de Berig") — todas fuera del núcleo jugable actual (Gorhorn no ha estado en ninguna de
  // estas regiones), marcado explícitamente en `condicion` en vez de fingir que son alcanzables.
  {
    sourceSlug: 'hielo-silice',
    sourceName: 'Hielo Sílice',
    itemSlug: 'cuna-hielo-silice-sin-tallar',
    cantidad: 1,
    condicion: 'Solo en Cristal Helado — fuera del núcleo jugable actual',
  },
  {
    sourceSlug: 'hierba-del-hierro',
    sourceName: 'Hierba del Hierro',
    itemSlug: 'hierba-del-hierro',
    cantidad: 1,
    condicion: 'Solo en la Meseta del Orden — fuera del núcleo jugable actual',
  },
  {
    sourceSlug: 'trepador-ocaso',
    sourceName: 'Trepador Ocaso',
    itemSlug: 'resina-trepador-ocaso',
    cantidad: 1,
    condicion: 'Solo en Ciénaga Troncal — fuera del núcleo jugable actual',
  },
  {
    sourceSlug: 'cornante',
    sourceName: 'Cornante',
    itemSlug: 'racion-carne',
    cantidad: 3,
    condicion: 'Solo en Ciénaga Troncal, cacería de grupo — fuera del núcleo jugable actual',
  },
  {
    sourceSlug: 'sombra-de-kroj',
    sourceName: 'Sombra de Kroj',
    itemSlug: 'pluma-sombra-kroj',
    cantidad: 1,
    condicion: 'Solo en El Margen Silencioso — fuera del núcleo jugable actual',
  },
];

/// Especie/planta -> aliases de jugador, para el matcher determinista de despiece/recolección
/// (docs/12 § 3.3). Vive aquí y no en HarvestYield porque varias filas comparten sourceSlug.
export const harvestSourceAliases: Record<string, string[]> = {
  'corredor-de-cauce': ['corredor de cauce', 'corredor', 'corredores de cauce'],
  'gargantua-de-ceniza': ['gargantúa', 'gargantua', 'gargantúa de ceniza', 'gargantua de ceniza'],
  'espina-del-viento': ['espina del viento', 'espina', 'espinas del viento'],
  'raiz-de-fuego': ['raíz de fuego', 'raiz de fuego'],
  corretolvas: ['corretolva', 'corretolvas'],
  'salvia-del-polvo': ['salvia del polvo', 'salvia'],
  'espiga-roja': ['espiga roja', 'espiga'],
  'matorral-de-cuerno': ['matorral de cuerno', 'matorral', 'leña'],
  'roca-pilares-rotos': ['roca', 'rocas', 'piedra', 'piedras', 'canto rodado', 'pedrusco', 'pilares rotos'],
  // Fauna nueva (mismos aliases que los del Npc correspondiente, ver array `fauna` arriba)
  'aullador-rojo': ['aullador', 'aulladores', 'aullador rojo', 'aulladores rojos', 'perro salvaje', 'jauria', 'jauría'],
  // 'ganado'/'res' quitados (ver comentario junto al Npc de Múrgol más arriba): mismo tipo de
  // colisión con palabras comunes ("ha ganado un nivel"), aquí con blast radius más pequeño
  // (matchHarvestSource solo se llama tras detectar intención de recolección/caza) pero igual
  // de real si ambas cosas coinciden en la misma acción.
  murgol: ['murgol', 'múrgol', 'murgoles', 'múrgoles', 'rebano', 'rebaño'],
  cruzavientos: ['cruzavientos', 'cruzaviento', 'ave de tormenta', 'aves de tormenta'],
  'rondador-de-brasas': ['rondador', 'rondador de brasas', 'bestia nocturna', 'bestia de la noche'],
  'salamandra-de-escoria': ['salamandra', 'salamandra de escoria', 'lagarto de fuego', 'lagarto grande'],
  'buitre-cenizo': ['buitre', 'buitres', 'buitre cenizo', 'buitres cenizos', 'carroneras', 'carroñeras'],
  // Flora/mineral nueva
  'cardo-brujula': ['cardo', 'cardo brújula', 'cardo brujula', 'cardos'],
  'liquen-del-cauce': ['liquen', 'liquen del cauce', 'musgo'],
  'bulbo-del-cauce': ['bulbo', 'bulbos', 'bulbo del cauce', 'tuberculo', 'tubérculo'],
  'flor-de-ceniza': ['flor de ceniza', 'flores de ceniza', 'amapola'],
  // "arena magnética" es una frase ya muy usada en la prosa de tormentas (roadmap 2026-07-20,
  // aviso de Fable) — solo aliases que no colisionen con eso.
  'arena-iman': ['arena iman', 'arena imán', 'limaduras'],
  // Tier 0, ronda 2 (roadmap 2026-07-20) — dos fuentes nuevas ligadas a Location, no a fauna/flora.
  'restos-personales-maktor': ['restos personales', 'objetos personales', 'pertenencias de maktor', 'restos personales de maktor'],
  'ofrendas-tumulos-honor': ['ofrendas', 'ofrendas de los tumulos', 'ofrendas del tumulo', 'ofrendas de los túmulos'],
  // Otras regiones de Berig (2026-07-22) — fuera del núcleo jugable, ver harvestYields arriba.
  'hielo-silice': ['hielo silice', 'hielo sílice'],
  'hierba-del-hierro': ['hierba del hierro', 'hierba de hierro'],
  'trepador-ocaso': ['trepador ocaso', 'trepadores ocaso', 'trepador del ocaso'],
  cornante: ['cornante', 'cornantes'],
  'sombra-de-kroj': ['sombra de kroj', 'sombras de kroj'],
};

/// Descripción física/visual de cada fuente de flora o mineral SIN fila Npc propia (2026-07-22,
/// petición explícita: "ampliar toda la info... para mejorar el resultado de los prompts de
/// imágenes"). Antes estas 14 fuentes no tenían NINGÚN texto descriptivo en ningún sitio —
/// HarvestYield no tiene columna description y loreContextFor() en imagePromptContext.ts no leía
/// nada más que "flora o material recolectable" a secas. `espina-del-viento` vive aquí y no en el
/// array `fauna` de arriba porque es peligro ambiental puro (docs/rpgtarkor/areas.md), sin ficha
/// de combate ni Npc propio — pero sigue necesitando descripción visual igual que cualquier otra.
/// Bug real (2026-07-22): la Enciclopedia usaba "¿existe Npc con este slug?" como proxy de "¿es
/// fauna (animal) o flora/mineral?" — funciona para las 9 fauna cazable de arriba (sí tienen
/// Npc), pero Espina del Viento, Cornante y Sombra de Kroj son animales de verdad (escorpión,
/// alce-hipopótamo, ave rapaz) SIN ficha de combate propia (peligro ambiental o fuera del núcleo
/// jugable), así que salían mal categorizados como "Flora / material" en el icono y la etiqueta.
/// Set aparte, no un booleano más en `harvestSourceDescriptions`, para no forzar a toda fuente
/// flora/mineral a declarar explícitamente "no soy fauna".
export const harvestSourcesThatAreFaunaWithoutNpc = new Set(['espina-del-viento', 'cornante', 'sombra-de-kroj']);

export const harvestSourceDescriptions: Record<string, string> = {
  'espina-del-viento':
    'Criatura del desierto de apenas un metro de altura, caparazón quitinoso de un rojizo oxidado que imita las dunas rojas que lo rodean — pequeñas protuberancias en el caparazón parecen cristales de arena roja calcificada. La cola segmentada se arquea alta, rematada en un saco de veneno translúcido y pulsante con forma de punta de flecha. Se entierra a medias en la arena fina, invisible hasta que ataca, casi siempre durante una tormenta de arena magnética — entre los surcos de arena cercanos a veces se ven ejemplares más pequeños construyendo sus propios nidos.',
  'raiz-de-fuego':
    'Enredadera parásita de tallos oscuros y nudosos que crece pegada a grietas volcánicas, acumulando calor en su interior hasta un punto crítico — perturbada sin cuidado, libera un gas inflamable con un chasquido seco.',
  'salvia-del-polvo':
    'Mata baja de hojas grises apagadas y aroma amargo, crece pegada al suelo en hondonadas y rincones de sombra — machacada entre los dedos suelta un jugo oscuro que corta hemorragias.',
  'espiga-roja':
    'Cereal silvestre de espigas del mismo rojo ocre que la tierra de la llanura, tallos finos que se doblan al viento en oleadas visibles desde lejos.',
  'matorral-de-cuerno':
    'Arbusto bajo de madera oscura y retorcida en espirales como cuernos entrelazados, corteza agrietada y reseca — la única leña de verdad en la llanura abierta.',
  'roca-pilares-rotos':
    'Bloques y cascotes de roca rojiza erosionada por el viento, desprendidos de la base de Los Pilares Rotos — superficie áspera, veteada de ocre y gris.',
  'cardo-brujula':
    'Cardo espinoso de tallo rígido y flor cerrada de un gris metálico apagado, con una única fibra central imantada que, colgada de un hilo, siempre señala el mismo rumbo.',
  'liquen-del-cauce':
    'Musgo húmedo de un verde apagado casi gris, crece en parches allí donde el agua corre justo bajo la superficie — masticado deja un regusto mineral y calma la sed.',
  'bulbo-del-cauce':
    'Tubérculo fibroso de piel parda y pulpa acuosa, crece enterrado junto al Liquen del Cauce — comida y un trago de agua en una misma pieza.',
  'flor-de-ceniza':
    'Flor pequeña de pétalos grises translúcidos, casi cenicientos, que solo brota en suelo de ceniza volcánica — su infusión adormece el dolor.',
  'arena-iman':
    'Limaduras oscuras y finas que las tormentas de arena magnética dejan acumuladas a sotavento de las rocas, brillo metálico apagado bajo el sol, se pegan a cualquier hoja de metal cercana.',
  'restos-personales-maktor':
    'Objetos personales medio enterrados entre los cimientos quemados de Los Restos de Maktor — cuero ennegrecido, hueso tallado, todo cubierto de una fina capa de ceniza vieja.',
  'ofrendas-tumulos-honor':
    'Pequeños objetos dejados sobre las piedras de Los Túmulos del Honor — telas anudadas, huesos con muescas rituales, expuestos durante años al viento y al polvo rojo de la llanura.',
  // Otras regiones de Berig (2026-07-22) — fuera del núcleo jugable actual.
  'hielo-silice':
    'Mineral de un blanco azulado translúcido que se encuentra en las laderas de las montañas de Cristal Helado, frío al tacto y duro como el pedernal — no se forja, se talla.',
  'hierba-del-hierro':
    'Hojas grisáceas de bordes duros como el metal, ricas en vetas minerales visibles a contraluz — crece en la Meseta del Orden, materia prima de las aleaciones goirntes.',
  'trepador-ocaso':
    'Árbol oscuro de corteza casi negra que rezuma una resina densa de vetas doradas al partirla — forma la mayor parte de la Ciénaga Troncal.',
  cornante:
    'Criatura de cuatro patas, corpulenta y de gran tamaño, cornamenta ancha y ramificada, pelaje oscuro y empapado, pisadas pesadas que se hunden en el barro de la ciénaga.',
  'sombra-de-kroj':
    'Criatura voladora mediana de plumaje gris ceniza y vuelo absolutamente silencioso, ojos oscuros y fijos — caza en grupo en El Margen Silencioso imitando susurros de voces humanas.',
};
