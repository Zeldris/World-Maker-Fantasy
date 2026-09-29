/// Catálogo de mundo estructurado (docs/mecanicas/12-mundo-estructurado.md) — ubicaciones, NPCs, armería
/// y recursos cosechables de las Llanuras del Viento Rojo (alcance v1: solo Gorhorn). Igual que
/// loreChunks.ts, la fuente de verdad editorial sigue siendo docs/rpgtarkor/*.md; esto es el
/// mismo contenido en forma de filas deterministas. Idempotente vía upsert por @@unique —
/// correr de nuevo con `npm run seed-catalog` cuando cambie el contenido.

import type { Attribute, AttributeBlock } from '../services/dice.js';
import type { Requisitos } from '../services/requisitos.js';
import type { Estacion, EstadoClima, EquipSlot, ItemTipo, MetodoObtencion, WeaponCategory, Clase, Especializacion, PesoArmadura, AbilityEffect } from '@prisma/client';
import type { TerrainTag } from '../services/terrain.js';
import type { FloraCategoria } from '../services/floraCategoria.js';
import type { FaunaCategoria } from '../services/faunaAbilities.js';
import type { MomentoDelDia } from '../services/worldClock.js';

export interface LocationInput {
  slug: string;
  name: string;
  region: string;
  kind: string;
  description: string;
  aliases: string[];
  /// Coordenadas cartográficas reales en km, origen Los Pilares Rotos, +x=este/+y=norte (petición
  /// explícita, 2026-08-15: la Aguja de Cardo Brújula necesita decir en qué dirección cardinal
  /// queda cada camino conocido desde aquí). Copiadas TAL CUAL de las coordenadas ya MEDIDAS/
  /// confirmadas de `docs/mecanicas/13-escala-del-mundo.md` (§1.1/§2.2bis para el núcleo original, §2.2ter
  /// para la tercera ampliación) — NUNCA de `frontend/src/data/map.ts` a secas: ese archivo tiene
  /// varios nodos (hondonada-del-eco, tumulos-del-honor, osario-de-la-manada, manaderos,
  /// cruce-de-las-cenizas) con posición ajustada SOLO para que los iconos no se pisen en el mapa,
  /// desacoplada a propósito de la posición mecánica real — usar esas habría dado direcciones
  /// cardinales incorrectas. Opcionales: una Location sin coordenadas simplemente no participa en
  /// el cálculo de dirección (falla cerrado, nunca inventa una).
  x?: number;
  y?: number;
  /// Frase corta para el icono de salida de región en Zona (2026-09-17) — ver el comentario del
  /// campo homónimo en schema.prisma. Solo hace falta curarla para Locations que de verdad son
  /// destino de algún `LocationLink` real (la mayoría del catálogo no lo es todavía); el resto se
  /// queda `undefined`/null sin problema.
  teaser?: string;
}

export const locations: LocationInput[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // REGIÓN: LAS LLANURAS DEL VIENTO ROJO
  // ══════════════════════════════════════════════════════════════════════════

  {
    slug: 'agujas-iman',
    name: 'Las Agujas Imán',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'hito',
    description:
      'Un campo de rocas negras brillante (formadas de arena imán) imantadas y levitando magneticamente, donde las tormentas de arena magnética peinan la arena en crestas y estalactitas flotantes. El sentido de la orientación se pierde entre ellas; a sotavento se acumula arena imán y crece el Cardo Brújula.',
    // 'las agujas' quitado a propósito (auditoría 2026-08-02, "revisar partida"): prefijo literal de
    // 'las agujas iman'/'las agujas imán' — el enlazador de texto clicable (enciclopediaIndex.ts)
    // partía "Avanzo a las Agujas Imán" en pin("Las Agujas Imán") + "Iman" suelto repetido detrás,
    // porque el alias corto ganaba por posición sobre el más específico.
    aliases: ['las agujas iman', 'las agujas imán'],
    x: -7,
    y: 8.3,
    teaser: 'Se cuenta que allí la brújula deja de servir y la arena flota como si el suelo respirara',
  },

  {
    slug: 'campamento-serhu',
    name: 'Colmillo Ceniza - Karot Veku',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'asentamiento',
    description:
      'El asentamiento del Clan Serhu, cerca del Pozo de Cauce Viejo del que dependen para el agua — empalizada de estacas afiladas rodeando chozas de techo cónico, con vigías apostados en las torres de la entrada. Hogar de la Terk\'ikar Ulkha Ketg y el Kort\'ikar Torgash Ketg. Se llega visto desde lejos por los vigías del clan.',
    // 'clan serhu'/'los serhu' quitados a propósito (auditoría 2026-08-02, "revisar partida"): se
    // usan todo el rato para describir la AFILIACIÓN de un personaje ("una orca marcada del Clan
    // Serhu"), no el sitio — el enlazador de texto clicable (enciclopediaIndex.ts) los enlazaba
    // igual, aunque nadie de la escena estuviera en el campamento de verdad. Mismo criterio que el
    // bug histórico de Torgash/Ulkha vía "Serhu" en matchNpcAliases (docs/runbooks/revisar-partida.md § 3).
    // 'karot veku'/'colmillo ceniza' añadidos (auditoría 2026-08-03, "revisa todos los MD"): nombre
    // nativo del poblado ya documentado en areas.md ("el nombre del poblado es Karot Veku en
    // lengua común Colmillo Ceniza") desde que se escribió esa doc, pero nunca había llegado al
    // catálogo del juego — hallazgo de la propia usuaria jugando ("juraría que le habíamos puesto
    // un alias").
    aliases: ['campamento del clan serhu', 'karot veku', 'colmillo ceniza'],
    x: 21,
    y: -5,
    teaser: 'Una empalizada de estacas se recorta contra el horizonte, con vigías que no pierden de vista a quien se acerca',
  },

  // "Interior" de un asentamiento con FactionBuilding real (2026-08-31, "Trabajador de Reino") —
  // Location de catálogo más, mismo criterio que el resto (no un nivel de mapa nuevo): entrar/
  // salir es un LocationLink normal de coste 0 (ver locationLinks más abajo), reutilizando el
  // 100% del sistema de viaje/Zona/ZonePoint ya existente. Sin x/y propias a propósito — no es un
  // punto nuevo del mapa de MUNDO, vive "dentro" de las mismas coordenadas que campamento-serhu.
  {
    slug: 'campamento-serhu-interior',
    name: 'Hogar Ketg - Ketg\'lukar',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'interior',
    description:
      'Dentro de la empalizada de Karot Veku: tierra apisonada en torno a una plaza central, sendas marcadas por el paso constante entre los distintos puntos del poblado — cada construcción real (Ketg\'lukar, talleres de cada oficio) tiene su propia ubicación marcada en el mapa de la zona, sin representarlas ya prefijadas en el fondo. En el centro simbólico, el Ketg\'sedsar Karot Veku — el Salón Ketg del Colmillo Ceniza —, donde la Terk\'ikar Ulkha Ketg y el Kort\'ikar Torgash Ketg reciben a quien cruza la entrada.',
    aliases: ['ketg\'lukar', 'ketg\'sedsar','ketglukar', 'ketgsedsar'],
    teaser: 'Más allá de la empalizada debe abrirse la vida cotidiana del clan, aunque nadie ajeno la haya visto de cerca',
  },

  {
    slug: 'cruce-de-las-cenizas',
    name: 'El Cruce de las Cenizas',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'cruce',
    description:
      'El punto donde el camino que viene de la Meseta del Orden se bifurca en la llanura — zona de paso habitual de patrullas de la Concordia de Hierro. Se asienta en una muesca de la frontera donde El Margen Silencioso se adentra en la llanura: mirando al sur, ya se distingue el Puesto Rabioso del Márgen al otro lado.',
    aliases: ['el cruce de las cenizas'],
    x: 0,
    y: -18,
    teaser: 'Un cruce de caminos donde suelen verse patrullas yendo y viniendo desde la Meseta del Orden',
  },

  {
    slug: 'filo-de-las-brasas',
    name: 'El Filo de las Brasas',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'mirador',
    description:
      'Una cresta de roca oscura al noreste de Los Restos de Maktor, donde la estepa empieza a ceder ante la tierra volcánica — el primer lugar del núcleo jugable desde el que los volcanes activos que solo se veían "a lo lejos" se distinguen de verdad, con su calima de calor y ceniza en el aire. Territorio real de la Salamandra de Escoria, que antes solo aparecía aquí como avanzadilla ocasional.',
    aliases: ['el filo de las brasas'],
    x: 16,
    y: 31,
    teaser: 'Desde la estepa ya se adivina una cresta oscura donde el calor empieza a temblar en el aire',
  },

  {
    slug: 'hondonada-del-eco',
    name: 'La Hondonada del Eco',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'refugio',
    // Auditoría de lore 2026-08-22/23: el "único riesgo" contradecía a areas.md (aquí decía
    // emboscada/visibilidad, areas.md dice tormentas por acumulación de viento). Confirmado con la
    // usuaria: se queda el de areas.md.
    description:
      'Una depresión profunda en la tierra rojiza, con paredes de arcilla endurecida que cortan el viento y amortiguan el sonido — la voz rebota dentro, de ahí el nombre. Varias bocas de cueva se abren en las paredes, a distintas alturas. Refugio real contra el viento y las tormentas de arena magnética, buen lugar para acampar, descansar o pasar la noche. Único riesgo: al estar hundida, el propio viento se acumula dentro y puede crear tormentas de arena momentáneas.',
    aliases: ['la hondonada del eco'],
    x: 5,
    y: 7.5,
    teaser: 'Cuentan que allí hasta el propio viento se queda atrapado y repite cada sonido una y otra vez',
  },

  {
    slug: 'manaderos',
    name: 'Los Manaderos',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'punto de agua',
    description:
      'Donde la corriente subterránea aflora en charcas estacionales entre chudos rojizos — otro punto de la misma corriente que alimenta el Pozo de Cauce Viejo, no su origen ni su final. Aquí paren las hembras de Corredor de Cauce; cazar crías ofende la costumbre orca.',
    aliases: ['manaderos', 'los manaderos'],
    x: 18.1,
    y: 2.8,
    teaser: 'Charcas estacionales entre chudos rojizos, dicen que allí paren las hembras de Corredor de Cauce',
  },

  // --- Puntos de interés nuevos dentro del núcleo ya cartografiado (roadmap 2026-07-20,
  // propuesta de Fable, ver memoria project_tarkor_propuesta_fauna_flora.md) — coordenadas
  // coherentes con docs/mecanicas/13-escala-del-mundo.md § 1.1, minutos ya calculados por Fable con el
  // mismo método (5 km/h, sinuosidad 1,1) que el resto del grafo.
  {
    slug: 'osario-de-la-manada',
    name: 'El Osario de la Manada',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'hito',
    description:
      'El esqueleto de una Gargantúa de Ceniza muerta hace décadas, costillas como arcos blanqueados visibles desde lejos. Los orcos lo tratan con respeto: se toma hueso, no se profana — la única fuente conocida de placas óseas y hueso largo de gargantúa sin necesidad de cacería ritual.',
    aliases: ['el osario de la manada'],
    x: 10.95,
    y: 7.6,
    teaser: 'Un costillar blanqueado se recorta contra el cielo, tan grande que se distingue desde muy lejos',
  },

  // --- Ampliación del núcleo medido (checklist 2026-07-21/22, punto 6 — "Puerta 2" de
  // project_tarkor_roadmap_mapa: el núcleo v1 era solo ~18% de la región completa de Llanuras,
  // docs/mecanicas/13-escala-del-mundo.md § 2.2 ya reservaba "pastos de temporada al este" y "zona volcánica
  // del norte/noreste" sin nombrar hasta que el juego los pisara — este es ese momento. Coordenadas
  // y minutos calculados con el mismo método (5 km/h, sinuosidad 1,1) que el resto del grafo.
  {
    slug: 'pastos-de-la-deriva',
    name: 'Los Pastos de la Deriva',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'pasto estacional',
    description:
      'Praderas abiertas al este de Los Manaderos, donde la hierba dura más tiempo que en el núcleo del clan — hasta aquí siguen las manadas de Corredores de Cauce su migración, y hasta aquí llevan los Serhu a sus múrgoles cuando el pasto cercano se agota. Sin asentamiento fijo: se ocupa por temporadas, se abandona el resto del año.',
    aliases: ['los pastos de la deriva'],
    x: 30,
    y: -1,
    teaser: 'Praderas abiertas que solo se ocupan por temporadas, cuando el pasto cercano ya no basta',
  },

  {
    slug: 'pilares-rotos',
    name: 'Paso de los Pilares Rotos',
    region: 'Las Llanuras del Viento Rojo',
    // 'kind' corregido (auditoría de lore 2026-08-22): decía "paso que conecta regiones", pero
    // areas.md lo describe como cruce interno de las Llanuras ("transitar de forma facil entre
    // los diferentes puntos de las Llanuras de Viento Rojo") y sus 5 locationLinks de abajo
    // conectan únicamente con otros nodos de esta misma región — ninguno cruza a otra región.
    kind: 'paso que conecta puntos de las Llanuras',
    description:
      'Tres columnas erosionadas de lo que en tiempos remotos fue una formación rocosa mucho más alta, unidas entre sí por puentes colgantes y con pequeños estandartes clavados en lo alto de cada una — visibles desde casi cualquier punto de la llanura, el punto de referencia que usa cualquiera para orientarse aquí. Su sombra da algo de resguardo del sol a mediodía, pero es terreno abierto y no defendible.',
    aliases: ['los pilares rotos'],
    x: 0,
    y: 0,
    teaser: 'Tres columnas erosionadas que se ven desde casi cualquier punto de la llanura, buena referencia para orientarse',
  },

  {
    slug: 'pozo-cauce-viejo',
    name: 'El Pozo de Cauce Viejo',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'punto de agua',
    description:
      'Uno de los pocos puntos de agua permanentes de la región, sobre la corriente subterránea que siguen los Corredores de Cauce — cruce de viajeros para bien o para mal. Actualmente hay construido un pozo antiguo que es utilizado por el clan serhu.',
    aliases: ['el pozo de cauce viejo'],
    x: 13.5,
    y: 0,
    teaser: 'Se dice que es de los pocos sitios de la región donde el agua nunca falta',
  },

  {
    slug: 'restos-de-maktor',
    name: 'Los Restos de Maktor',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'ruinas',
    description:
      'La ubicación aproximada del último asentamiento del Clan Maktor antes de su aniquilación — hoy poco más que cimientos quemados y arcilla removida en la estepa profunda, sin senda marcada que lleve hasta ellas. Gorhorn, único superviviente conocido del clan, no ha vuelto todavía.',
    // "maktor" a secas quitado del alias (2026-07-30, petición explícita en vivo: "al mencionar
    // Maktor solo está linkando la zona siempre, eso está mal... Maktor por sí solo no lo uses
    // para linkar") — bug real de dos caras con la misma raíz: (1) enciclopediaIndex.ts (frontend)
    // enlazaba CUALQUIER mención de "Maktor" a esta ubicación, aunque fuera parte del propio
    // apellido/clan de Gorhorn ("Gorhorn Maktor", "el honor de los Maktor"), que no tiene nada que
    // ver con las ruinas la mayoría de las veces; (2) ya había causado un bug real DISTINTO antes
    // (2026-07-23, "revisar partida"): "Soy Gorhorn Maktor, quien eres..." activaba
    // `matchDestination` (travel.ts) y el jugador "viajaba" 290 min a las ruinas en mitad de una
    // conversación, solo porque se presentaba con su apellido. Las formas multi-palabra que quedan
    // ("restos de maktor", "los restos", "ruinas de maktor") ya son inequívocas por sí solas.
    aliases: ['los restos de maktor', 'ruinas de maktor'],
    x: 10,
    y: 20.5,
    teaser: 'Cimientos quemados sin senda marcada, lo poco que quedó de un clan entero aniquilado',
  },

  {
    slug: 'tumulos-del-honor',
    name: 'Los Túmulos del Honor',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'hito',
    description:
      'Campo de túmulos de piedra donde los clanes de las Llanuras entierran a quienes murieron con honor: duelos aceptados, cacerías rituales. Terreno neutral sagrado — ni Serhu ni Maktor pelearon jamás aquí.',
    aliases: ['los tumulos del honor', 'los túmulos del honor'],
    x: 6.2,
    y: 5.6,
    teaser: 'Un campo de piedra donde se dice que ningún clan alzó nunca las armas contra otro',
  },

  // --- Tercera ampliación del núcleo (checklist, sesión "ampliamos lore" 2026-08-05): sabana,
  // fosa de Espina del Viento, costa norte y desierto Nabierus — ver areas.md § Puntos de interés
  // y docs/mecanicas/13-escala-del-mundo.md § 2.2ter para la topología y coordenadas. Cada zona nueva cuelga
  // de UN único nodo del núcleo ya existente (nunca de varios), a propósito: el objetivo explícito
  // de la usuaria era que no se pudiera ir en línea recta de cualquier parte a cualquier parte —
  // para llegar a la costa hay que pasar por Los Manaderos → El Oasis → La Desembocadura; para el
  // desierto profundo, por Las Agujas Imán → La Fosa → Las Dunas → El Vientre. Sin `locationLink`
  // ni nodo de mapa para La Ciudad Hundida / El Archivo Cegado / El Observatorio Roto: son
  // contenido futuro explícito (tras el terremoto sin fecha fijada), no entran al grafo todavía.
  {
    slug: 'oasis-de-chudos-rojos',
    name: 'El Oasis de Chudos Rojos',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'punto de agua y vegetacion',
    description:
      'Agua en superficie de verdad, alimentada por la misma corriente subterránea que sigue Los Manaderos — un punto verde real en medio del polvo rojo, disputado entre clanes, fauna y cualquiera que necesite descansar de la travesía.',
    aliases: ['el oasis de chudos rojos', 'oasis de chudos rojos'],
    x: 24.3,
    y: 14.9,
    teaser: 'Un punto verde de verdad en medio del polvo rojo, dicen que siempre hay agua en superficie',
  },

  {
    slug: 'desembocadura-callada',
    name: 'La Desembocadura Callada',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'costa',
    description:
      'El punto donde la corriente subterránea que alimenta El Pozo de Cauce Viejo y Los Manaderos aflora por fin al mar, en una marisma salobre de chudos y barro — cierra el recorrido completo del agua de las Llanuras, desde su nacimiento tierra adentro hasta el mar.',
    aliases: ['la desembocadura callada', 'desembocadura callada'],
    x: -2,
    y: 42,
    teaser: 'El lugar donde dicen que el agua de toda la llanura termina por fin encontrando el mar',
  },

  {
    slug: 'playa-de-ceniza-blanca',
    name: 'Playa de Ceniza Blanca',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'costa',
    description:
      'Franja de arena clara entre dos brazos bajos de roca — la zona costera más accesible y menos hostil de toda la región, el único punto donde el mar se alcanza y se usa sin escalar ni cruzar marisma.',
    aliases: ['playa de ceniza blanca', 'la playa de ceniza blanca'],
    x: -20,
    y: 22,
    teaser: 'La franja de costa de la que todos hablan como la más fácil de alcanzar sin sobresaltos',
  },

  {
    slug: 'acantilados-partidos',
    name: 'Los Acantilados Partidos',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'costa',
    description:
      'Pared costera vertical partida por grietas profundas, oleaje violento rompiendo abajo y nidos de aves marinas en las cornisas más altas — bello y letal, un mal paso aquí no perdona.',
    aliases: ['los acantilados partidos', 'acantilados partidos'],
    x: -21,
    y: 44,
    teaser: 'Un tramo de costa del que se habla con respeto: hermoso de ver, poco perdonan un mal paso',
  },

  {
    slug: 'pozas-de-marea',
    name: 'Las Pozas de Marea',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'costa',
    description:
      'Costa baja de roca plana, salpicada de charcas que la marea llena y vacía dos veces al día — vida propia y contenida en cada poza, zona de recolección tranquila entre dos extremos más hostiles de la costa.',
    aliases: ['las pozas de marea', 'pozas de marea'],
    x: -20,
    y: 36,
    teaser: 'Costa baja y tranquila, fama de buen sitio para recoger lo que deja la marea al retirarse',
  },

  {
    slug: 'embarcadero-de-ceniza',
    name: 'El Embarcadero de Ceniza',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'asentamiento',
    description:
      'Puesto avanzado del Clan Serhu en la costa norte, botes de fondo plano varados sobre travesaños de madera y redes tendidas a secar — primer contacto real del clan con el mar. Pesca y transporte de corta distancia a lo largo de la costa; ningún Serhu se aventura mar adentro.',
    aliases: ['el embarcadero de ceniza', 'embarcadero de ceniza'],
    x: -21,
    y: 54,
    teaser: 'Botes varados y redes al secar, el único punto donde se dice que el clan tocó el mar',
  },

  {
    slug: 'fosa-horadada',
    name: 'La Fosa Horadada',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'hito',
    description:
      'Un sumidero amplio y profundo, paredes de arena compactada perforadas por decenas de bocas de túnel — la mayor madriguera conocida de Espina del Viento de toda la región. Bajar es una decisión, no un accidente: la red se extiende bajo tierra mucho más de lo que sugiere la boca del pozo.',
    aliases: ['la fosa horadada', 'fosa horadada'],
    x: -16,
    y: -16,
    teaser: 'Un sumidero perforado de bocas de túnel que corre la fama de esconder una madriguera enorme',
  },

  {
    slug: 'dunas-ahogadas',
    name: 'Las Dunas Ahogadas',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'ruinas',
    description:
      'Fragmentos de piedra tallada y metal ennegrecido asomando entre dunas rojas que el viento cubre y descubre sin patrón fijo — la única prueba visible de que un reino entero, el de los Nabierus, sigue enterrado debajo.',
    aliases: ['las dunas ahogadas', 'dunas ahogadas'],
    x: -24,
    y: -28,
    teaser: 'Dunas que el viento mueve sin descanso, viajeros cuentan haber visto asomar metal viejo entre ellas',
  },

  {
    slug: 'vientre-del-engano',
    name: 'El Vientre del Engaño',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'hito',
    description:
      'Una hondonada seca y estéril donde nada crece, y donde nacen —según los pastores— todas las tormentas de arena magnética de la región. El punto exacto, aunque nadie vivo lo sepa ya, donde las hijas de Madre desataron sin saberlo la sequía y el viento que sepultaron el Reino Nabierus.',
    aliases: ['el vientre del engaño', 'vientre del engaño'],
    x: -10,
    y: -40,
    teaser: 'Los pastores hablan de una hondonada seca donde no crece nada y nace todo el mal viento',
  },

  {
    slug: 'laberinto-de-canones',
    name: 'El Laberinto de Cañones',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'cañón',
    description:
      'Badlands de paredes de arcilla estrecha y sinuosa, fácil perderse, ecos que engañan al oído — terreno de emboscada tanto para depredadores como para quien conoce sus atajos.',
    aliases: ['el laberinto de cañones', 'laberinto de cañones'],
    x: 6,
    y: -42,
    teaser: 'Badlands estrechas de las que se cuenta que hasta los ecos engañan y es fácil perder el rumbo',
  },

  {
    slug: 'fumarolas-negras',
    name: 'Las Fumarolas Negras',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'hito',
    description:
      'Campo de grietas humeantes y vidrio volcánico negro más allá de El Filo de las Brasas — más hostil y menos transitado que el propio Filo, donde el calor sale directo de la tierra.',
    aliases: ['las fumarolas negras', 'fumarolas negras'],
    x: 19,
    y: 42,
    teaser: 'Más allá del Filo se dice que el propio suelo humea, más hostil que nada visto hasta ahí',
  },

  {
    slug: 'paso-de-los-huesos',
    name: 'El Paso de los Huesos',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'cañón',
    description:
      "Cañón estrecho tapizado de restos óseos de migraciones fallidas de Corredores de Cauce — paso obligado natural hacia La Sabana Alta, y recordatorio de que ni la propia migración sagrada de los orcos sale siempre bien.",
    aliases: ['el paso de los huesos', 'paso de los huesos'],
    x: 41,
    y: 2,
    teaser: 'Un cañón estrecho del que se dice que quedan restos de migraciones que nunca llegaron a buen puerto',
  },

  {
    slug: 'sabana-alta-colmillar',
    // Nombre corregido (auditoría de lore 2026-08-21): 'Colmillar' no aparece en ningún documento
    // de lore — areas.md, docs/mecanicas/13-escala-del-mundo.md § 2.2ter y docs/registros/ampliar-lore-checklist.md
    // coinciden en llamarla simplemente "La Sabana Alta" (incluso la propia descripción de
    // 'paso-de-los-huesos' más arriba, en este mismo archivo, ya la nombra así sin "Colmillar").
    // Slug sin tocar (referenciado por locationTerrainTags y locationLinks más abajo).
    name: 'La Sabana Alta',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'pradera',
    description:
      'Praderas de hierba roja que llega a la cintura, mucho más alta y densa que la hierba rasa del resto de la llanura — el viento la mueve en oleadas visibles desde lejos. Refugio y coto de caza de manadas de Corredores de Cauce que no se ven en otras zonas del núcleo.',
    aliases: ['la sabana alta', 'sabana alta', 'la sabana alta colmillar', 'sabana alta colmillar'],
    x: 54,
    y: -10,
    teaser: 'Se habla de una hierba alta que se mece en oleadas visibles mucho antes de llegar hasta ella',
  },

  {
    slug: 'yegr-kegi',
    name: 'Vergel de la Arena - Yegr Kegi',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'coto de caza',
    description:
      'Coto de caza y comercio de los Faerus de la llanura, donde se encuentra su puesto avanzado Yegr Kegi — el punto donde su artesanía en pieles y su relación con los orcos se pone a prueba cara a cara.',
    aliases: ['vergel de la arena', 'yegr kegi'],
    // Coordenada Y corregida 2026-09-06 (auditoría de lore, hallazgo A8): estaba en -175, fuera de
    // rango del resto del núcleo (~-42 a 54) — probable error de escala/tecleo. Recalculada por
    // proporción al minutosBase (300 min, frente a los 320 de Grieta Cantora) para dar ~43
    // unidades de distancia real desde El Cruce de las Cenizas. PENDIENTE: la usuaria revisará su
    // posición jugando en vivo y podrá ajustarla si no encaja del todo.
    x: -8,
    y: -60,
    teaser: 'Un puesto Faerus donde dicen que se comercia piel y confianza a partes iguales con los orcos',
  },
  {
    slug: 'jakut-ger-interior',
    name: 'Trono Rojo - Jakut Ger',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'interior',
    description:
      'Dentro de los muros de hueso que marcan la zona de la manada se puede encontrar un gran salón de piel y hueso, el Jakut Ger, decorado con grandes calaveras y prolongados huesos tallados en forma de garras — aquí los guerreros y sabios se reúnen para planear y mantener las relaciones de comercio con los pocos orcos que deciden probar suerte.',
    aliases: ['jakut ger', 'trono rojo'],
  },

  {
    slug: 'grieta-cantora',
    name: 'La Grieta Cantora',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'hito',
    description:
      'Formación rocosa donde el viento, al colarse por sus grietas, produce un sonido propio y constante — el contraste exacto con El Margen Silencioso, donde el sonido se apaga: aquí el viento canta.',
    aliases: ['la grieta cantora', 'grieta cantora'],
    // Coordenada Y corregida 2026-09-06 (auditoría de lore, hallazgo A8): estaba en -100, fuera de
    // rango del resto del núcleo (~-42 a 54) — probable error de escala/tecleo. Recalculada para
    // dar exactamente los 46 unidades de distancia real desde El Cruce de las Cenizas que el
    // propio comentario del locationLink de abajo ya afirmaba ("la arista más larga... 46 unidades
    // reales"), coherente con minutosBase: 320. PENDIENTE: la usuaria revisará su posición jugando
    // en vivo y podrá ajustarla si no encaja del todo.
    x: 6,
    y: -64,
    teaser: 'Dicen que allí el viento no calla nunca, y que se le oye cantar mucho antes de llegar',
  },

  {
    slug: 'campo-yermo',
    name: 'El Campo Yermo',
    region: 'Las Llanuras del Viento Rojo',
    kind: 'ruinas',
    description:
      "Llanura marcada por huesos viejos y metal oxidado que nadie ha reclamado nunca del todo — posible escenario de la guerra interna entre Maktor y Serhu de hace más de mil años, el \"primer golpe\" que dejó al Clan Maktor maltrecho durante un milenio.",
    aliases: ['el campo yermo', 'campo yermo'],
    x: 19,
    y: 22,
    teaser: 'Una llanura de huesos y metal viejo que nadie ha llegado a reclamar del todo',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // REGIÓN: LA MESETA DEL ORDEN
  // ══════════════════════════════════════════════════════════════════════════

  // --- Capitales/asentamientos principales por raza y zona (2026-07-22, petición explícita:
  // "vamos ya a crear capitales con nombres para cada raza y zona siguiendo el lore") — mismo
  // patrón que las 4 "otras regiones" de arriba (kind sin coordenadas ni LocationLink, anclas de
  // referencia para la Enciclopedia, no destinos alcanzables todavía). Escala deliberadamente
  // modesta fuera de la Meseta del Orden (docs/mecanicas/13-escala-del-mundo.md: Berig entero apenas
  // 8.000-10.000 almas) — Cristal Helado y Ciénaga Troncal son campamento/poblado, no ciudad.
  // Los Faerus SÍ tienen dos poblados reales, Hashma y Kegi (decisión de la usuaria, auditoría
  // 2026-07-28, corrigiendo la vieja nota "sin ciudades, sin escritura" de razas.md) — ver más
  // abajo. El Claro de la Manada sigue existiendo aparte, como tercer punto de encuentro sin
  // construcción, no como sustituto de una capital que ya tienen.
  {
    slug: 'baluarte-de-goirme',
    name: 'El Baluarte de Goirme',
    region: 'La Meseta del Orden',
    kind: 'asentamiento',
    description:
      'La mayor de las ciudades-fortaleza Goirntes, sede de la Concordia de Hierro — muros de hierro negro pulido tallados con la misma simetría antinatural que el resto de la Meseta, y el obelisco de leyes más alto de todo Berig en su plaza central. Lleva el nombre de la Semilla que dio forma a su pueblo. Fuera del núcleo jugable actual.',
    aliases: ['el baluarte', 'baluarte de goirme', 'baluarte', 'la capital goirnte'],
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
    aliases: ['la meseta del orden'],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TANDA OpenCode 2026-09-27/28 — 2 lugares nuevos de La Meseta del Orden (A-18, A-19)
  // ══════════════════════════════════════════════════════════════════════════

  {
    slug: 'puesto-del-corredor',
    name: 'El Puesto del Corredor',
    region: 'La Meseta del Orden',
    kind: 'puesto de control',
    description:
      'El puesto de control en el extremo sur del corredor costero occidental, donde el camino que bordea El Margen Silencioso entra en la Meseta del Orden. Toda columna de la Concordia que va o vuelve del Cruce de las Cenizas pasa por aquí — la otra puerta de las que siempre llegan en columna y por una sola. Una explanada de piedra gris pulida con tres caminos que se cruzan en ángulos exactos: el corredor costero, el que sube al Baluarte de Goirme y el que lleva a las forjas de la frontera norte. Un obelisco menor lleva los edictos de paso, y los inspectores anotan cada carga, cada nombre y cada hora — un registro de entrada sin su salida es un asunto inacabado, y se persigue. Una escuadra de doce y dos inspectores de la casta de ley lo guardan de forma permanente. Fuera del núcleo jugable actual.',
    aliases: ['el puesto del corredor', 'puesto del corredor'],
  },
  {
    slug: 'canteras-del-eje',
    name: 'Las Canteras del Eje',
    region: 'La Meseta del Orden',
    kind: 'cantera',
    description:
      'La cantera y el taller de talla de donde sale cada obelisco de leyes de Berig, siempre de la misma veta que el primer obelisco del Baluarte de Goirme — un edicto grabado en otra piedra no se considera del todo válido, y ningún Goirnte sabría explicar por qué: simplemente, no está en su sitio. Galerías paralelas excavadas siguiendo los ejes de la Meseta; los bloques se cortan con herramientas de aleación de Hierba del Hierro y se pulen con arena y agua en surcos tallados en el suelo. Se trabaja en silencio y por turnos, y un obelisco a medio tallar nunca se abandona: si su talladora muere, otra lo termina con la misma herramienta. Un linaje de talladores de la casta de construcción, unos treinta activos, trabaja aquí de forma permanente. Fuera del núcleo jugable actual.',
    aliases: ['las canteras del eje', 'canteras del eje'],
  },

  // Tanda OpenCode 2026-09-27/28 (P-07) — las 3 ciudades-fortaleza numeradas de la Meseta,
  // fundadas tras El Baluarte de Goirme por orden de fundación. Código opcional (Meseta fuera de
  // núcleo), añadido igualmente por ser de bajo coste con el mismo patrón sin coordenadas.
  {
    slug: 'vresk-hes',
    name: 'Vresk Hes',
    region: 'La Meseta del Orden',
    kind: 'asentamiento',
    description:
      'La segunda ciudad-fortaleza de la Meseta del Orden, en el interior, entre los campos de Hierba del Hierro. Allí están las forjas mayores de la Concordia de Hierro, y de allí salen las aleaciones grises y las armas que cada mes suben al Clan Serhu. Como todas las ciudades Goirntes, tiene su propio obelisco de leyes (Vresk\'ord) en la plaza central. Fuera del núcleo jugable actual.',
    aliases: ['vresk hes'],
  },
  {
    slug: 'vresk-tuh',
    name: 'Vresk Tuh',
    region: 'La Meseta del Orden',
    kind: 'asentamiento',
    description:
      'La tercera ciudad-fortaleza de la Meseta del Orden, en la frontera norte, junto a El Margen Silencioso. Es la ciudad de los Goirntes de piel clara y ágiles que trabajan la madera; de aquí salen las cuadrillas de la tala del borde y las patrullas que protegen a los leñadores. Es la ciudad que más odia a los Faerus y la que más los teme. Fuera del núcleo jugable actual.',
    aliases: ['vresk tuh'],
  },
  {
    slug: 'vresk-kei',
    name: 'Vresk Kei',
    region: 'La Meseta del Orden',
    kind: 'asentamiento',
    description:
      'La cuarta ciudad-fortaleza de la Meseta del Orden, el puerto oriental. Recibe las balsas de madera del tributo que bajan por la Costa Corredor desde Ciénaga Troncal. Fuera del núcleo jugable actual.',
    aliases: ['vresk kei'],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // REGIÓN: CRISTAL HELADO
  // ══════════════════════════════════════════════════════════════════════════

  {
    slug: 'campamento-helsig',
    name: 'Honor Helado - Helske Tugh',
    region: 'Cristal Helado',
    kind: 'asentamiento',
    description:
      'A los pies de la ladera, la tribu orca del Clan Helsig (Honor Helado), expertos en tallar hielo sílice, turnos de mina y caza escasa. Aquí trabajó Gorhorn tres meses de joven, y aquí sigue Hagar.',
    aliases: ['helske tugh', 'campamento del clan helsig', 'honor helado'],
  },
  {
    slug: 'campamento-helsig-interior',
    name: 'Hogar Helsig - Helsig\'lukar',
    // Fix real (2026-09-13, auditoría de lore Helek) — región corregida de "Las Llanuras del
    // Viento Rojo" a "Cristal Helado": el Clan Helsig vive en Cristal Helado (ver
    // `campamento-helsig`, justo arriba), probable copia-pega del bloque de
    // `campamento-serhu-interior` sin actualizar este campo.
    region: 'Cristal Helado',
    kind: 'interior',
    description:
      'Dentro de la empalizada de Helske Tugh se encuentra el salón Helsig\'sedsar, en el centro del poblado — junto a los talleres de oficio de los suyos, cada uno con su propia ubicación en el mapa de la zona.',
    aliases: ['helsig\'lukar', 'helsig\'sedsar', 'helsiglukar', 'helsigsedsar'],
  },
  {
    slug: 'veta-helada',
    name: 'La Veta Helada',
    region: 'Cristal Helado',
    kind: 'region',
    description:
      "Region de tundra congelada, con grandes yacimientos de hielo sílice en las profundidades del hielo, amplia zona de roca negra oscura cubierta de nieve y amplios lagos congelados con grietas que deja ver en el fondo el brillo del hielo sílice. La zona es rica en minerales y fauna adaptada al frío extremo, pero pobre en vegetación.",
    aliases: ['veta helada'],
  },
  {
    slug: 'red-profunda-final',
    name: 'La Red Profunda Final',
    region: 'Cristal Helado',
    kind: 'region',
    description:
      "Red de tuneles que recorre la parte norte de Cristal Helado, las cuales van por debajo de las grandes montañas. Creados antiguamente sin saber exactamente quien los creo. Actualmente es una zona casi inexplorada con vegetación y fauna adaptada a la oscuridad y el frio extremo. La zona es rica en minerales pero pocas veces alguien se aventura a explorarla por el peligro que representa. De ahi el nombre de la zona, ya que se dice que quien entra es para ver su final.",
    aliases: ['la red profunda final'],
  },
  {
    slug: 'lago-cristalice',
    name: 'El Lago Cristalice',
    region: 'Cristal Helado',
    kind: 'region',
    description:
      "Lago congelado que deja ver en el fondo una veta gigante de hielo sílice anclada en las profundidades del lago creando asi un efecto de luz en las noches oscuras reflejando el brillo del cielo. La zona es rica en hielo silice.",
    aliases: ['lago cristalice'],
  },
  {
    slug: 'pico-escarcha',
    name: 'El Pico Escarcha',
    region: 'Cristal Helado',
    kind: 'region',
    description:
      "La cumbre más alta de la cordillera, siempre cubierta de una capa de escarcha que nunca llega a derretirse del todo ni en los días más templados. Desde su ladera se ve toda La Veta Helada extenderse hacia el sur — los pocos que suben cuentan que el viento corta como una hoja y que el propio hielo sílice de las profundidades se nota crujir bajo las botas.",
    aliases: ['pico escarcha'],
  },
  {
    slug: 'pico-ocaso-negro',
    // Nombre corregido (auditoría de lore 2026-08-21): typo interno, "Ocason" no es una palabra —
    // el propio slug ya decía 'ocaso' correctamente; el nombre y el alias no coincidían con él.
    name: 'El Pico Ocaso Negro',
    region: 'Cristal Helado',
    kind: 'region',
    description:
      "Roca negra desnuda, sin apenas nieve que se le pegue — al ponerse el sol, la piedra oscura absorbe la última luz y la cumbre entera parece arder un instante antes de apagarse del todo. Los orcos del Clan Helsig evitan acercarse tras el ocaso; dicen que es entonces cuando la montaña 'respira'.",
    aliases: ['pico ocaso negro', 'pico ocason negro'],
  },
  {
    slug: 'pico-tundra-negra',
    name: 'El Pico Tundra Negra',
    region: 'Cristal Helado',
    kind: 'region',
    description:
      "Vigía de piedra oscura sobre la propia Tundra Negra Refleja, más bajo que sus vecinos pero más escarpado — sus laderas de roca suelta hacen la subida traicionera incluso para cazadores expertos. Da nombre a toda la tundra que se extiende a sus pies.",
    aliases: ['pico tundra negra'],
  },
  {
    slug: 'tundra-negra-refleja',
    name: 'La Tundra Negra Refleja',
    region: 'Cristal Helado',
    kind: 'region',
    description:
      "Llanura helada de roca volcánica oscura pulida por siglos de viento y hielo, tan lisa que en las noches despejadas devuelve el reflejo entero del cielo estrellado como si se caminara sobre un segundo firmamento. Traicionera bajo los pies — el hielo que cubre la roca negra es casi invisible hasta que ya se ha resbalado.",
    aliases: ['tundra negra refleja'],
  },
  {
    slug: 'tundra-polvo-nocturno',
    name: 'La Tundra Polvo Nocturno',
    region: 'Cristal Helado',
    kind: 'region',
    description:
      "Extensión de nieve fina y ceniza volcánica arrastrada desde el Pico Ocaso Negro, que de noche se levanta con el viento en remolinos oscuros — de ahí el nombre. Respirar sin cubrirse la boca en esas noches deja la garganta áspera durante días; de día, en cambio, es tundra silenciosa y despejada como cualquier otra.",
    aliases: ['tundra polvo nocturno'],
  },
  {
    slug: 'costa-celeste-agitada',
    name: 'La Costa Celeste Agitada',
    region: 'Cristal Helado',
    kind: 'region',
    description:
      "El límite norte de Cristal Helado, donde la tundra se rompe en acantilados sobre un mar de un azul intenso, casi antinatural, agitado por corrientes frías que nunca amainan del todo. Los témpanos que se desprenden arrastran vetas visibles de hielo sílice hasta mar adentro, brillando bajo la superficie como si el propio mar estuviera imantado.",
    aliases: ['costa celeste agitada'],
  },
  {
    slug: 'cascada-cristal-tres-aguas',
    name: 'La Cascada Cristal Tres Aguas',
    region: 'Cristal Helado',
    kind: 'region',
    description:
      "Punto donde tres arroyos nacidos en el deshielo de otros tantos glaciares se juntan y caen juntos por un único salto de roca cubierta de escarcha permanente — de ahí el nombre. El agua, cargada de polvo de hielo sílice, cae con un brillo que no tiene ningún otro salto de agua de la región.",
    aliases: ['cascada cristal tres aguas'],
  },
  {
    slug: 'desfiladeros-bruma',
    name: 'Los Desfiladeros de Bruma',
    region: 'Cristal Helado',
    kind: 'region',
    description:
      "Red de gargantas estrechas entre paredes de roca helada, donde el aire frío que baja de los picos y el más templado de los valles se encuentran y generan una bruma espesa casi permanente, incluso en los días más claros. Fácil perder el rumbo ahí dentro sin algo que marque el camino — se dice que hasta los cazadores del Clan Helsig más experimentados evitan cruzarlos solos.",
    aliases: ['desfiladeros de bruma'],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // REGIÓN: CIÉNAGA TRONCAL
  // ══════════════════════════════════════════════════════════════════════════

  {
    slug: 'campamento-goshg',
    name: 'Piel Musgo - Silh Makut',
    region: 'Ciénaga Troncal',
    kind: 'asentamiento',
    description:
      "Campamento del Clan Goshg — empalizadas de madera oscura levantadas sobre pilotes por encima del agua, unidas por pasarelas y canoas. Aquí se reúnen las dos tribus Goshg en la estación de las crecidas. Hogar de la Terk'ikar Doshka, que gobierna la tribu, y su hermano menor, el Kort'ikar Dulgren, que lidera la guerra. Fuera del núcleo jugable actual.",
    aliases: ['silh makut', 'piel musgo', 'campamento del clan goshg'],
  },
  {
    slug: 'campamento-goshg-interior',
    name: 'Hogar Goshg - Goshg\'lukar',
    // Fix real (2026-09-13, auditoría de lore Helek) — región corregida de "Las Llanuras del
    // Viento Rojo" a "Ciénaga Troncal": el Clan Goshg vive en Ciénaga Troncal (ver
    // `campamento-goshg`, justo arriba). Descripción también corregida — decía literalmente
    // "Helske Tugh" (el campamento del Clan HELSIG), pegado sin adaptar del bloque de Helsig.
    region: 'Ciénaga Troncal',
    kind: 'interior',
    description:
      "Dentro de la empalizada de Silh Makut se encuentra el salón Goshg'sedsar, sede de la Terk'ikar Doshka y el Kort'ikar Dulgren.",
    aliases: ['goshg\'lukar', 'goshg\'sedsar', 'goshglukar', 'goshgsedsar'],
  },
  {
    slug: 'conclave-keseg-prisilke',
    name: 'Conclave Fin Susurrado - Keseg Prisilke',
    region: 'Ciénaga Troncal',
    kind: 'asentamiento',
    description:
      'Poblado Nabieus en la explanada más pequeña del sur de la ciénaga, del conclave Keseg Prisilke — nombre en lengua común: Fin Susurrado. Cuerpos adaptados a vivir en las zonas más difíciles del pantano, distintos de sus parientes del Margen Silencioso. Sin conexión previa con Gorhorn. Fuera del núcleo jugable actual.',
    aliases: ['conclave fin susurrado', 'keseg prisilke'],
  },
  {
    slug: 'conclave-keseg-prisilke-interior',
    name: 'Jeyselet',
    region: 'Ciénaga Troncal',
    // Fix real (2026-09-13, auditoría de lore Helek) — `kind` corregido de 'asentamiento' a
    // 'interior' (mismo bug de copia-pega que `campamento-feg-tusha-interior` más abajo): un
    // interior no debe duplicarse como asentamiento propio del mapa de mundo, es parte del mismo
    // punto que su exterior (`conclave-keseg-prisilke`).
    kind: 'interior',
    description:
      'Dentro de la empalizada de Keseg Prisilke se encuentra el salón Jeyselet.',
    aliases: ['jeyselet'],
  },
  {
    slug: 'trepaderes-humededos',
    name: 'Los Trepaderes Humededos',
    region: 'Ciénaga Troncal',
    kind: 'región',
    description:
      'Terreno húmedo, en gran parte inhabitable, con tres pequeñas zonas llanas invadidas por Trepadores Ocaso. Rica en alimento y madera, pobre en minerales. La zona llana más amplia la habitan las dos tribus del Clan Goshg, que viven de los Trepadores Ocaso y los Cornantes y tallan sus tótems en la misma madera oscura que Gorhorn lleva a la espalda; la explanada más pequeña del sur (ver Jeyselt) la habita una tribu Nabieus adaptada al pantano. Sin conexión previa con Gorhorn — territorio completamente nuevo si la partida llega aquí. Fuera del núcleo jugable actual.',
    // 'la cienaga'/'la ciénaga' quitados (auditoría 2026-08-02, "revisar partida"): prefijo literal
    // de 'cienaga troncal'/'ciénaga troncal' de esta misma entidad — el enlazador de texto clicable
    // (enciclopediaIndex.ts) hace matching de izquierda a derecha y el alias corto ganaba SIEMPRE
    // sobre el más específico ("la Ciénaga Troncal" se partía en pin("Los territorios del Clan
    // Goshg") + "Troncal" suelto). 'cienaga troncal'/'ciénaga troncal' ya cubren de sobra la mención
    // real sin ser prefijo de nada más.
    aliases: ['trepaderes humedos', 'trepaderes húmededos'],
  },
  {
    slug: 'marismas-lodo-negro',
    name: 'Marismas de Lodo negro',
    region: 'Ciénaga Troncal',
    kind: 'región',
    description:
      'Marismas que sea crean de la mezcla de resina de Bolco (Arbol oscuro de resina negra) el agua y el fango gris. En la superficie acumulan los restos mas espesos de la resina formando una capa protectora y viscosa, bajo esta una red tuneles submarinos con el agua mas puro y cristalina de Berig.',
    aliases: ['marismas de lodo negro'],
  },
  {
    slug: 'tuneles-musgosos',
    name: 'Tuneles Musgosos',
    region: 'Ciénaga Troncal',
    kind: 'región',
    description:
      'Galerías secas bajo las raíces entrelazadas de los Trepadores Ocaso más viejos, tapizadas de musgo, por donde se cruza la Ciénaga sin tocar el agua. Los cazadores de Keseg Prisilke las conocen como nadie; en las crecidas, son el refugio de medio pantano. Fuera del núcleo jugable actual.',
    aliases: ['tuneles musgosos'],
  },
  {
    slug: 'raices-madre-fango',
    name: 'Raices Madre Fango',
    region: 'Ciénaga Troncal',
    kind: 'región',
    description:
      'El Trepador Ocaso más viejo de la Ciénaga, con unas raíces tan anchas que forman una isla firme y alta. Es el único suelo seco donde los Goshg pueden levantar sus piras: aquí queman a sus muertos y dejan sus tótems funerarios, colgados de las raíces. Fuera del núcleo jugable actual.',
    aliases: ['raices madre fango'],
  },
  {
    slug: 'cumbre-bruma-negra',
    name: 'Cumbre Bruma Negra',
    region: 'Ciénaga Troncal',
    kind: 'región',
    description:
      'La única altura de la Ciénaga, una loma de roca vieja que asoma sobre el dosel. Por la mañana la envuelve la niebla de las charcas, oscurecida por el humo de resina de las hogueras de los vigías Goshg, que desde aquí ven llegar a los Serhu. Fuera del núcleo jugable actual.',
    aliases: ['cumbre bruma negra'],
  },
  {
    slug: 'cataratas-madre-fango',
    name: 'Cataratas Madre Fango',
    region: 'Ciénaga Troncal',
    kind: 'región',
    description:
      'Donde el agua que rodea las Raíces Madre cae de golpe a un nivel más bajo del pantano, en un salto de agua marrón. Los Borboles remontan aquí en primavera y es la mejor pesca de la región. Fuera del núcleo jugable actual.',
    aliases: ['cataratas madre fango'],
  },
  {
    slug: 'costa-marea-vida',
    name: 'Costa Marea Vida',
    region: 'Ciénaga Troncal',
    kind: 'región',
    description:
      'Marismas de marea en la costa oriental, al norte de la Costa Corredor, donde la mezcla de agua dulce y salada da marisco en abundancia. Los Goshg la recolectan en marea baja. Fuera del núcleo jugable actual.',
    aliases: ['costa marea vida'],
  },
  {
    slug: 'costa-corredor',
    name: 'Costa Corredor',
    region: 'Ciénaga Troncal',
    kind: 'región',
    description:
      'La costa oriental donde se entrega la madera del tributo a las balsas Goirntes que bajan hacia la Meseta. Es el único punto de la Ciénaga donde se ven Goirntes con regularidad. Fuera del núcleo jugable actual.',
    aliases: ['costa corredor'],
  },
  {
    slug: 'embarcadero-goshg',
    name: 'Embarcadero Silh Makut',
    region: 'Ciénaga Troncal',
    kind: 'región',
    description:
      'El muelle propio de El Cerco de los Pilotes, del que salen las canoas de fondo plano hacia la Costa Corredor y hacia Jeyselt. Fuera del núcleo jugable actual.',
    aliases: ['embarcadero silh makut'],
  },
  {
    slug: 'desfiladero-esmeralda',
    name: 'Desfiladero Esmeralda',
    region: 'Ciénaga Troncal',
    kind: 'región',
    description:
      'Garganta de paredes cubiertas de un musgo verde intenso, en el borde norte de la Ciénaga. Es la salida hacia Cristal Helado, y por él pasa la Senda del Sílice: el sitio donde se cruzan las caravanas Helsig y los porteadores Goshg. Fuera del núcleo jugable actual.',
    aliases: ['desfiladero esmeralda'],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // REGIÓN: EL MARGEN SILENCIOSO
  // ══════════════════════════════════════════════════════════════════════════

  {
    slug: 'claro-de-la-manada',
    name: 'El Claro de la Manada',
    region: 'El Margen Silencioso',
    kind: 'pasto estacional',
    description:
      'Un claro amplio en la mitad occidental del Margen Silencioso donde las manadas Faerus que no viven en Hashma o Kegi se juntan para cazar y compartir la primera pieza — un lugar de encuentro, no una construcción. Algunas manadas mantienen pequeños puestos avanzados más allá de la frontera norte, ya en las Llanuras del Viento Rojo. Fuera del núcleo jugable actual.',
    aliases: ['claro de la manada', 'el claro', 'territorio faerus'],
  },

  {
    slug: 'campamento-feg-tusha',
    name: 'Selviterna - Hashma',
    region: 'El Margen Silencioso',
    kind: 'asentamiento',
    description:
      'Poblado principal de los Faerus de la selva, en la mitad occidental del Margen Silencioso, cerca de la costa — colgado sobre los árboles, hogar del clan Feg Tusha. Nombre en lengua común: Selviterna. Fuera del núcleo jugable actual.',
    // 'poblado faerus' quitado a propósito (auditoría de documentación/lore 2026-08-18): prefijo
    // literal de 'poblado faerus de las llanuras' (alias de Kegi, el otro poblado Faerus) — mismo
    // patrón ya arreglado antes en este archivo para 'las agujas'/'clan serhu' (ver comentarios de
    // 'agujas-iman'/'campamento-serhu' arriba). 'selviterna'/'feg tusha' ya identifican Hashma sin
    // ambigüedad.
    aliases: ['hashma', 'selviterna', 'campamento feg tusha'],
  },
  {
    slug: 'campamento-feg-tusha-interior',
    name: 'Trono Madre - Jakut Tusha',
    region: 'El Margen Silencioso',
    // Fix real (2026-09-13, auditoría de lore Helek) — `kind` corregido de 'asentamiento' a
    // 'interior', mismo bug que `conclave-keseg-prisilke-interior`. Alias corregidos: este slug
    // nació de renombrar el antiguo 'kegi' (ver worldCatalog.ts, historial), pero conservaba sus
    // alias viejos ('kegi', 'poblado faerus de las llanuras') sin actualizar — ya no describen el
    // nuevo nombre. Erratas de redacción también corregidas.
    kind: 'interior',
    description:
      'Dentro de la espesa jungla, en lo alto del árbol más robusto, se puede encontrar un gran salón de piel y hueso, el Jakut Tusha, decorado con grandes calaveras y prolongados huesos tallados en forma de garras — aquí los guerreros y sabios se reúnen para planear sus siguientes movimientos.',
    aliases: ['jakut tusha', 'trono madre'],
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
      // cruzan algo la frontera norte hacia las Llanuras.
      'Cinturón denso de selva templada, pantanos y bosques de coníferas de madera negra que separa la Meseta del Orden de las tierras salvajes del norte — un laberinto donde el sonido parece apagarse de forma antinatural. Los Nabieus predominan en la mitad oriental, con presencia dispersa hasta el borde de Ciénaga Troncal; los Faerus ocupan la mayor parte del resto de la región, con pequeños puestos avanzados que se adentran algo más allá de la frontera oeste con las Llanuras del Viento Rojo. Fuera del núcleo jugable actual.',
    aliases: ['el margen silencioso'],
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

  // ══════════════════════════════════════════════════════════════════════════
  // TANDA OpenCode 2026-09-27/28 — 3 lugares nuevos de El Margen Silencioso (A-15 a A-17)
  // ══════════════════════════════════════════════════════════════════════════

  {
    slug: 'cruce-de-las-ausencias',
    name: 'El Cruce de las Ausencias',
    region: 'El Margen Silencioso',
    kind: 'cruce',
    description:
      'El centro de El Margen Silencioso, en la línea donde la selva Faerus (oeste) da paso a la mitad oriental de los Nabieus. No es de nadie. Bosque cerrado de coníferas de madera negra de copas bajas, suelo hecho un entramado de raíces cubierto de Musgo Callado. La quietud es total: no se oye el viento, ni los pasos propios, ni la respiración del que va al lado. Es el paso de los cazadores Faerus hacia las Llanuras y de los mensajeros Nabieus hacia el sur — sin asentamiento. Rige una norma que nadie ha pactado pero todos cumplen: dentro del Cruce nadie ataca a nadie de otra raza, porque nadie oiría pedir ayuda. Las manadas cuentan que aquí grupos enteros "se desvanecieron" — no hay nada sobrenatural: el Mekiosi espera inmóvil y caza de una embestida, y donde no se oye un grito, un grupo que se separa unos pasos puede perder a uno tras otro sin que el resto lo note. Fuera del núcleo jugable actual.',
    aliases: ['cruce de las ausencias', 'el cruce'],
    teaser: 'Aquí nadie oye cuando llamas.',
  },
  {
    slug: 'aguas-sordas',
    name: 'Las Aguas Sordas',
    region: 'El Margen Silencioso',
    kind: 'pantano',
    description:
      'La franja pantanosa de El Margen Silencioso, entre El Cruce de las Ausencias y la mitad oriental. Canales y charcas de agua negra entre raíces de coníferas, con islas de raíz que ceden bajo el peso de algo grande. El agua no suena: ni chapoteo ni goteo. La única forma de saber que algo se mueve es mirar el agua — las ondas se ven, pero no se oyen. Nadie vive aquí: los cazadores del Feg Tusha bajan en temporada seca. Aquí aprendieron los Nabieus que la vibración viaja mejor por el agua, antes de la segunda huida hacia Ciénaga Troncal. Fuera del núcleo jugable actual.',
    aliases: ['las aguas sordas', 'aguas sordas'],
    teaser: 'Mira el agua. No va a avisarte de otra forma.',
  },
  {
    slug: 'proa-gris',
    name: 'La Proa Gris',
    region: 'El Margen Silencioso',
    kind: 'mirador',
    description:
      'El borde sur de El Margen Silencioso, donde la roca gris de la Meseta del Orden se adentra en la selva como la proa de un barco — la única altura del Margen. Un espolón de piedra gris con la misma simetría antinatural de la Meseta, que se deshace a medida que avanza hacia la selva: en la base, las grietas son rectas y paralelas; en la punta, ya son irregulares, como si el trabajo de Goirme se hubiera quedado sin fuerza. Termina en cortados de treinta metros sobre el dosel. Solo crece musgo en las grietas. Es el único punto del Margen desde el que se ve lejos: los Nabieus de Keseg Sael mantienen aquí un turno de vigía rotativo (5-10 a la vez) que cuenta las columnas de la Concordia por el corredor costero occidental. Es terreno de caza de las Sombras de Kroj, que usan sus precipicios, y los vigías bajan antes del anochecer sin excepción. Fuera del núcleo jugable actual.',
    aliases: ['la proa gris', 'proa gris'],
    teaser: 'Desde aquí se ve la Meseta entera. Lo que oyes detrás no es tu eco.',
  },
];

/// Terreno de cada Location, leído a mano de su propia `description` de arriba (filtro de
/// recolección/caza por zona, ver `terrain.ts`) — solo las Locations de Las Llanuras del Viento
/// Rojo, la única región con núcleo jugable real hoy; el resto queda fuera del diccionario a
/// propósito (`pasaFiltroTerreno` no filtra nada para una Location no catalogada, así que no hace
/// falta "neutralizarla" explícitamente). Una Location sin tags claros en su prosa se deja fuera
/// del diccionario en vez de forzar una categoría dudosa.
export const locationTerrainTags: Record<string, TerrainTag[]> = {
  'agujas-iman': ['arido', 'rocoso'],
  // 'volcanico' añadido 2026-08-22 (análisis de réplica): sin él, Volcanita/Rovalnica/Fercaneo
  // habrían pasado a aparecer en TODA la región en cuanto se les diera población (ver
  // harvestSourceTerrainTag) — justo lo contrario de "casi imposible de encontrar salvo aquí".
  'filo-de-las-brasas': ['rocoso', 'arido', 'volcanico'],
  'hondonada-del-eco': ['rocoso', 'arido'],
  'manaderos': ['humedo', 'vegetacion'],
  'pastos-de-la-deriva': ['vegetacion'],
  'pilares-rotos': ['rocoso', 'arido'],
  'pozo-cauce-viejo': ['humedo'],
  'restos-de-maktor': ['arido'],
  'tumulos-del-honor': ['arido'],
  // Añadidas 2026-08-23 (auditoría lore↔código, faltaban pese a tener fauna/flora ancladas y ser
  // del mismo `kind: 'hito'` que sus vecinas de arriba, que sí tienen tag):
  'cruce-de-las-cenizas': ['arido', 'vegetacion'],
  'osario-de-la-manada': ['arido'],
  'oasis-de-chudos-rojos': ['humedo', 'vegetacion'],
  'desembocadura-callada': ['humedo','vegetacion','rocoso'],
  'playa-de-ceniza-blanca': ['humedo','arido'],
  'acantilados-partidos': ['rocoso', 'humedo'],
  'pozas-de-marea': ['humedo'],
  'embarcadero-de-ceniza': ['humedo'],
  'fosa-horadada': ['arido'],
  'dunas-ahogadas': ['arido'],
  'vientre-del-engano': ['arido'],
  'laberinto-de-canones': ['arido', 'rocoso'],
  'fumarolas-negras': ['rocoso', 'volcanico'],
  'paso-de-los-huesos': ['rocoso','arido'],
  'sabana-alta-colmillar': ['vegetacion','arido'],
  'yegr-kegi': ['vegetacion','humedo'],
  'grieta-cantora': ['rocoso'],
  'campo-yermo': ['arido'],
};

export interface LocationLinkInput {
  fromSlug: string;
  toSlug: string;
  minutosBase: number;
  terreno: string;
  riesgo?: string;
}

export const locationLinks: LocationLinkInput[] = [
  // --- Desde Campamento del Clan Serhu ---

  // Entrada/salida del interior (2026-08-31, "Trabajador de Reino") — `minutosBase: 0` a
  // propósito (instantáneo, "es solo cruzar la empalizada"), reutiliza el sistema de viaje normal
  // sin ningún mecanismo narrativo nuevo. `minutosConDestreza` topa a `Math.max(1, ...)`, así que
  // en la práctica cuesta 1 minuto de ficción — imperceptible, no un tramo real.
  {
    fromSlug: 'campamento-serhu',
    toSlug: 'campamento-serhu-interior',
    minutosBase: 0,
    terreno: 'La entrada de la empalizada',
  },

  {
    fromSlug: 'campamento-serhu',
    toSlug: 'pastos-de-la-deriva',
    minutosBase: 130,
    terreno: 'Senda de pastoreo estacional',
  },

  {
    fromSlug: 'campamento-serhu',
    toSlug: 'restos-de-maktor',
    minutosBase: 360,
    terreno: 'Estepa profunda',
    riesgo: 'Tormentas de arena magnética',
  },

  // --- Desde El Cruce de las Cenizas ---

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

  // --- Desde La Hondonada del Eco ---

  {
    fromSlug: 'hondonada-del-eco',
    toSlug: 'pozo-cauce-viejo',
    minutosBase: 150,
    terreno: 'Terreno de hondonadas',
    riesgo: 'Nidos de Espina del Viento entre las hondonadas',
  },

  // --- Desde Los Manaderos ---

  {
    fromSlug: 'manaderos',
    toSlug: 'campamento-serhu',
    minutosBase: 100,
    terreno: 'Senda de pastoreo',
    riesgo: 'Vigías Serhu — se llega visto desde lejos',
  },

  // --- Aristas de la ampliación del núcleo (checklist 2026-07-21/22, "Puerta 2") ---
  {
    fromSlug: 'manaderos',
    toSlug: 'pastos-de-la-deriva',
    minutosBase: 165,
    terreno: 'Llanura de hierba alta, senda de manada',
    riesgo: 'Corredores de Cauce y múrgoles en migración, tránsito denso',
  },

  // --- Desde El Osario de la Manada ---

  {
    fromSlug: 'osario-de-la-manada',
    toSlug: 'restos-de-maktor',
    minutosBase: 155,
    terreno: 'Estepa profunda',
    riesgo: 'Tormentas de arena magnética',
  },

  // --- Desde Los Pilares Rotos ---

  {
    fromSlug: 'pilares-rotos',
    toSlug: 'agujas-iman',
    minutosBase: 130,
    terreno: 'Llanura abierta',
    riesgo: 'Desorientación entre las rocas imantadas — una aguja de cardo la anula',
  },

  {
    fromSlug: 'pilares-rotos',
    toSlug: 'hondonada-del-eco',
    minutosBase: 120,
    terreno: 'Arcilla agrietada, llanura abierta',
  },

  // --- Aristas a los 4 puntos de interés nuevos (roadmap 2026-07-20) ---
  {
    fromSlug: 'pilares-rotos',
    toSlug: 'osario-de-la-manada',
    minutosBase: 160,
    terreno: 'Estepa abierta, sin senda',
    riesgo: 'Zense Ceniza y carroñeros nocturnos atraídos por los huesos',
  },

  {
    fromSlug: 'pilares-rotos',
    toSlug: 'pozo-cauce-viejo',
    minutosBase: 180,
    terreno: 'Llanura siguiendo el cauce subterráneo',
    riesgo: 'Manadas de Corredores de Cauce en migración',
  },

  {
    fromSlug: 'pilares-rotos',
    toSlug: 'restos-de-maktor',
    minutosBase: 300,
    terreno: 'Estepa profunda sin senda',
    riesgo: 'Tormentas de arena magnética, sin refugio',
  },

  // --- Desde El Pozo de Cauce Viejo ---

  {
    fromSlug: 'pozo-cauce-viejo',
    toSlug: 'campamento-serhu',
    minutosBase: 120,
    terreno: 'Senda de pastoreo marcada',
    riesgo: 'Vigías Serhu — se llega visto desde lejos',
  },

  {
    fromSlug: 'pozo-cauce-viejo',
    toSlug: 'manaderos',
    minutosBase: 65,
    terreno: 'Siguiendo la corriente subterránea',
    riesgo: 'Corredores de Cauce pariendo — cazar crías ofende la costumbre orca',
  },

  {
    fromSlug: 'pozo-cauce-viejo',
    toSlug: 'tumulos-del-honor',
    minutosBase: 110,
    terreno: 'Llanura de hierba alta',
  },

  // --- Desde Los Restos de Maktor ---

  {
    fromSlug: 'restos-de-maktor',
    toSlug: 'filo-de-las-brasas',
    minutosBase: 160,
    terreno: 'Ascenso rocoso hacia el borde volcánico',
    riesgo: 'Calor creciente, Salamandras de Escoria territoriales',
  },

  // --- Desde Los Túmulos del Honor ---

  {
    fromSlug: 'tumulos-del-honor',
    toSlug: 'restos-de-maktor',
    minutosBase: 185,
    terreno: 'Estepa profunda',
    riesgo: 'Tormentas de arena magnética',
  },

  // --- Tercera ampliación del núcleo (sesión "ampliamos lore" 2026-08-05) — cada zona nueva
  // cuelga de UN único nodo del núcleo ya existente, a propósito (ver comentario en `locations`
  // arriba): sin aristas cruzadas entre cadenas nuevas, y ninguna arista nueva toca los 12 nodos
  // originales entre sí. Minutos recalculados una segunda vez (misma sesión, "décima pasada") a
  // partir de las distancias REALES ya confirmadas contra el mapa (ver `frontend/src/data/map.ts`)
  // — no la triangulación a ciegas original (5 km/h/sinuosidad 1,1, que resultó no coincidir con
  // el polígono real). Regla de la usuaria: los minutos no tienen que ser exactamente
  // proporcionales a la distancia, pero nunca puede haber una inversión (un punto más lejano no
  // puede costar menos tiempo que uno más cercano). Tabla completa en
  // docs/mecanicas/13-escala-del-mundo.md § 2.2ter, ya actualizada a juego con estos valores.

  // --- Desde Los Manaderos: la cadena del río hacia el mar ---
  {
    fromSlug: 'manaderos',
    toSlug: 'oasis-de-chudos-rojos',
    minutosBase: 115,
    terreno: 'Siguiendo la corriente subterránea hacia el norte',
    riesgo: 'Espinas del Viento en las hondonadas del cauce',
  },
  {
    fromSlug: 'oasis-de-chudos-rojos',
    toSlug: 'desembocadura-callada',
    minutosBase: 280,
    terreno: 'Marisma y chudos, la corriente ensanchándose hacia el mar',
    riesgo: 'Terreno blando, fácil quedarse atascado',
  },
  // Cadena de la costa: reordenada por distancia real (Desembocadura → Pozas → Acantilados →
  // Embarcadero es el tramo más largo entero; Pozas → Playa es el ramal corto hacia el sur).
  {
    fromSlug: 'desembocadura-callada',
    toSlug: 'pozas-de-marea',
    minutosBase: 180,
    terreno: 'Costa baja de roca plana',
    riesgo: 'Marea — algunas charcas se cubren sin aviso',
  },
  {
    fromSlug: 'pozas-de-marea',
    toSlug: 'playa-de-ceniza-blanca',
    minutosBase: 130,
    terreno: 'Costa de arena clara',
  },
  {
    fromSlug: 'pozas-de-marea',
    toSlug: 'acantilados-partidos',
    minutosBase: 90,
    terreno: 'Costa rocosa ascendente',
    riesgo: 'Oleaje violento, grietas ocultas en el borde',
  },
  {
    fromSlug: 'acantilados-partidos',
    toSlug: 'embarcadero-de-ceniza',
    minutosBase: 100,
    terreno: 'Costa siguiendo la línea de pesca Serhu',
    riesgo: 'Vigías Serhu del embarcadero — se llega visto',
  },

  // --- Desde Las Agujas Imán: la cadena del desierto profundo ---
  {
    fromSlug: 'agujas-iman',
    toSlug: 'fosa-horadada',
    minutosBase: 220,
    terreno: 'Arena suelta más allá de las rocas imantadas',
    riesgo: 'Nidos de Espina del Viento — la mayor madriguera conocida',
  },
  {
    fromSlug: 'fosa-horadada',
    toSlug: 'dunas-ahogadas',
    minutosBase: 135,
    terreno: 'Dunas rojas cambiantes',
    riesgo: 'Tormentas de arena magnética, orientación inestable',
  },
  {
    fromSlug: 'dunas-ahogadas',
    toSlug: 'vientre-del-engano',
    minutosBase: 175,
    terreno: 'Desierto profundo, tierra estéril',
    riesgo: 'Origen de las tormentas de arena magnética de la región',
  },
  {
    fromSlug: 'vientre-del-engano',
    toSlug: 'laberinto-de-canones',
    minutosBase: 150,
    terreno: 'Badlands de arcilla estrecha y sinuosa',
    riesgo: 'Fácil perderse, terreno de emboscada',
  },

  // --- Desde El Filo de las Brasas: más adentro del borde volcánico ---
  {
    fromSlug: 'filo-de-las-brasas',
    toSlug: 'fumarolas-negras',
    minutosBase: 110,
    terreno: 'Grietas humeantes y vidrio volcánico',
    riesgo: 'Calor extremo directo del suelo',
  },

  // --- Desde Los Pastos de la Deriva: la cadena de la sabana ---
  {
    fromSlug: 'pastos-de-la-deriva',
    toSlug: 'paso-de-los-huesos',
    minutosBase: 110,
    terreno: 'Cañón estrecho tapizado de restos óseos',
    riesgo: 'Paso obligado, sin ruta alternativa',
  },
  {
    fromSlug: 'paso-de-los-huesos',
    toSlug: 'sabana-alta-colmillar',
    minutosBase: 165,
    terreno: 'Hierba roja hasta la cintura',
    riesgo: 'Aulladores Rojos aprovechando el sigilo de la hierba alta',
  },

  // --- Desde El Cruce de las Cenizas: frontera con El Margen Silencioso ---
  {
    fromSlug: 'cruce-de-las-cenizas',
    toSlug: 'yegr-kegi',
    minutosBase: 300,
    terreno: 'Frontera boscosa con El Margen Silencioso',
    riesgo: 'Territorio Faerus — el trato exige respeto',
  },
  // Replanteado (calibración visual 2026-08-05): La Grieta Cantora colgaba de El Osario de la
  // Manada (en el núcleo), pero tras confirmar su posición real quedó mucho más cerca de El
  // Cruce de las Cenizas — la línea antigua cruzaba todo el mapa sin necesidad. Es la arista más
  // larga de toda esta ampliación (46 unidades reales), de ahí el minutosBase más alto.
  {
    fromSlug: 'cruce-de-las-cenizas',
    toSlug: 'grieta-cantora',
    minutosBase: 320,
    terreno: 'Estepa abierta hacia la formación rocosa',
    riesgo: 'Trayecto largo y sin refugio, expuesto a tormentas de arena magnética',
  },

  // --- Sueltas, cuelgan de un nodo ya existente sin cadena propia ---
  {
    fromSlug: 'restos-de-maktor',
    toSlug: 'campo-yermo',
    minutosBase: 95,
    terreno: 'Estepa marcada por metal oxidado y huesos viejos',
    riesgo: 'Tormentas de arena magnética',
  },
];

export type NpcKindInput = 'PRINCIPAL' | 'PLANTILLA';

export interface NpcHabilidadRacial {
  icon: string;
  name: string;
  description: string;
  categoria: 'ataque' | 'defensa' | 'utilidad';
  /// Rediseño del turno de combate (2026-07-28) — mismo campo que `HabilidadRacial`
  /// (berigLore.ts) y las habilidades de clase: "tipo" para la rueda de debilidades y atributo
  /// con el que se tira, elegido por lo que la habilidad representa (garras=destreza,
  /// mordisco pesado=fuerza, acecho sigiloso=destreza...), nunca uniforme por especie.
  preferredAttribute: Attribute;
  /// Sistema de categorías de raza de fauna (2026-09-02) — nivel al que este animal concreto
  /// desbloquea esta habilidad ESPECÍFICA suya (las 3 propias, encima de las 7 de
  /// `NpcInput.faunaCategoria`), mismo criterio de reparto que `FAUNA_ESPECIFICA_LEVELS`
  /// (faunaAbilities.ts): 4/12/20. Filtrado por nivel real en `npcCombatAbilitiesFor`
  /// (npcCombatAbilities.ts), igual que las de categoría/clase.
  level: number;
  /// `AbilityEffect` real (2026-09-02) — antes este campo no existía y `npcCombatAbilitiesFor`
  /// forzaba siempre `effects: []` para toda habilidad racial (puramente descriptivas, ver
  /// comentario viejo, ya corregido, de `NpcCombatAbility.effects`). Ahora cada habilidad
  /// específica de fauna lleva su propio efecto mecánico real, mismo vocabulario que
  /// `StartingAbility.effects` — solo los ya implementados de verdad (ver comentario de cabecera
  /// de `FAUNA_CATEGORIA_ABILITIES`, faunaAbilities.ts, para el mapa completo y por qué
  /// `PROVOCACION` se queda fuera pese a ser un valor válido del enum).
  effects: AbilityEffect[];
}

export interface NpcInput {
  slug: string;
  name: string;
  kind: NpcKindInput;
  aliases: string[];
  faction: string | null;
  role: string;
  /// "el"/"la" para nombres descriptivos/de rol que el Narrador confunde de género en prosa libre
  /// (bug real jugando, 2026-07-31 — ver comentario completo en schema.prisma). Omitido = nombre
  /// propio, no necesita artículo.
  articulo?: 'el' | 'la';
  /// "M"/"F" — ver comentario completo en schema.prisma § Npc.genero (bug real jugando,
  /// 2026-07-30: Gistera Koh, nombre propio, narrada como "el orco" pese a que su `bio` ya dice
  /// "Orca"). Distinto de `articulo`: se puebla solo donde ya se ha visto el fallo en vivo.
  genero?: 'M' | 'F';
  level: number;
  levelMax?: number;
  attributes: AttributeBlock;
  bio: string;
  personality: string;
  homeLocationSlug?: string;
  /// `professionId` que este NPC enseña (2026-08-31, "Trabajador de Reino") — ver comentario del
  /// campo homónimo en schema.prisma.
  teachesProfession?: string;
  /// Menú contextual de interacción (2026-09-06) — ver comentario completo del enum
  /// `NpcInteractionType` en schema.prisma. Omitido = `[]`, sin menú contextual.
  interactionTypes?: ('MAESTRO_OFICIO' | 'NPC_MISION' | 'NPC_LORE')[];
  /// slug de ItemCatalog -> { cantidad, notas }
  loadout: { itemSlug: string; cantidad?: number; notas?: string }[];
  /// Rediseño de la vista de combate (2026-07-28) — solo humanoides ("seres inteligentes que
  /// pueden portar equipo"): `raza` referencia un slug de `BERIG_RAZAS` (berigLore.ts), `clase`
  /// uno de `Clase` (classAbilities.ts). Ninguno de los dos es obligatorio — un NPC social/no
  /// combatiente (mercader, peregrino...) puede no tener `clase`, y un NPC de apoyo fuera del
  /// grafo de las Llanuras puede no tener ninguno de los dos.
  raza?: string;
  /// Clase de combate (2026-08-24, Grupo 3 § Sistema de clases, docs/rpgtarkor/sistemas-combate/clases.md) — antes
  /// `string` libre (dejó pasar el typo real "Cazadora" en cazadora-serhu, ya corregido). Todos
  /// los NPC humanoides de este catálogo llevan una desde esta pasada — fauna se queda sin ella,
  /// nunca la tuvo (ver comentario de arriba).
  clase?: Clase;
  /// Especialización dentro de `clase`, ver Especializacion (schema.prisma). Solo Guerrero/
  /// Cazador/Chamán tienen alguna `ClassAbilityUnlock` real construida hoy — el resto de clases
  /// se asigna igual (scaffolding, mismo criterio que Domador/Totémico dentro de esas 3), sin
  /// ninguna habilidad real detrás todavía.
  especializacion?: Especializacion;
  /// Solo fauna (sin `raza`/`clase`: no son "seres inteligentes que portan equipo") — frase corta
  /// de su ataque natural (alimenta baseAttack.ts) y hasta 6 habilidades raciales propias,
  /// categorizadas (2 ataque, 2 defensa, 2 utilidad como máximo orientativo, no un mínimo fijo).
  ataqueNatural?: string;
  /// Categorías de raza de fauna (2026-09-02, ver comentario completo en faunaAbilities.ts y en
  /// `Npc.faunaCategoria`, schema.prisma) — solo fauna, sistema PARALELO a `clase` (nunca ambos a
  /// la vez en la práctica: fauna no lleva `clase`). Concede las 7 habilidades base de esa
  /// categoría (compartidas por toda la fauna de la misma categoría), filtradas por nivel, encima
  /// de las hasta 3 `habilidadesRaciales` propias de esta fila. Omitido = sin categoría asignada
  /// todavía (fauna puramente ambiental sin combate real, o pendiente de clasificar).
  faunaCategoria?: FaunaCategoria;
  habilidadesRaciales?: NpcHabilidadRacial[];
  /// Disposición al combate (schema.prisma § Temperamento) — default 'CAUTELOSO' (comportamiento
  /// actual dependiente del verbo del jugador) si no se especifica.
  /// Ampliado a los 5 valores reales de `Temperamento` (schema.prisma) — tanda OpenCode
  /// 2026-09-27/28: Lusa, Gero y Tasko son los primeros NPC de catálogo con AMIGABLE explícito
  /// (antes solo AGRESIVO/CAUTELOSO/INOFENSIVO se habían usado aquí; ENEMIGO nunca se fija a mano,
  /// solo lo desplaza `effectiveTemperamento` por reputación pésima).
  temperamento?: 'AMIGABLE' | 'AGRESIVO' | 'CAUTELOSO' | 'INOFENSIVO' | 'ENEMIGO';
  /// Medios de movimiento POSIBLES (schema.prisma § MedioMovimiento, gate de alcanzabilidad de
  /// "Interactuar", 2026-09-08) — array, un anfibio real declara los dos
  /// (`['TERRESTRE', 'ACUATICO']`). Default `['TERRESTRE']` si no se especifica.
  medio?: ('TERRESTRE' | 'AEREO' | 'ACUATICO')[];
  /// % (0-100) de que esta especie/individuo tenga la capacidad en absoluto — no un booleano fijo,
  /// ver comentario de estos campos en schema.prisma. Default 0 si no se especifica.
  comerciablePct?: number;
  reclutablePct?: number;
  domesticablePct?: number;
  capturablePct?: number;
  cortejablePct?: number;
  /// Grupo 3 § Compañeros y supervivencia (2026-08-25) — cuál de los 7 atributos propios de este
  /// NPC/fauna se usa como resistencia en la tirada opuesta de tameo/persuasión (companionSupervivencia.ts
  /// § rollOpposed). Solo calibrado a mano donde domesticablePct/reclutablePct > 0.
  atributoResistencia?: Attribute;
  /// Núcleo jugable actual (auditoría 2026-08-14, bug real jugando en vivo: "Sella Marn" —
  /// Nabieus de El Margen Silencioso, región marcada "fuera del núcleo jugable actual" en
  /// decenas de sitios de este catálogo, pero solo como texto/comentario — apareció en combate
  /// real de todas formas). `npcScene.ts` da por candidato a CUALQUIER NPC `kind: 'PRINCIPAL'`
  /// sin mirar región ("personajes únicos pueden aparecer en cualquier sitio por guion"), y hasta
  /// ahora no había ningún campo real que ese filtro pudiera comprobar para las excepciones.
  /// Default `true` (omitido = sí, es del núcleo) — solo se pone `false` explícitamente en los
  /// PRINCIPAL de regiones todavía no jugables (Berig, El Margen Silencioso...).
  nucleoJugable?: boolean;
  /// Compañero de fauna con nombre propio de OTRO Npc de este catálogo (auditoría de lore
  /// 2026-09-13, hallazgo C10) — slug del dueño, referencia laxa sin FK. Ver comentario completo
  /// en schema.prisma § Npc.companionOfNpcSlug. Omitido = sin compañero (la inmensa mayoría).
  companionOfNpcSlug?: string;
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
  // ══════════════════════════════════════════════════════════════════════════
  // REGIÓN: LAS LLANURAS DEL VIENTO ROJO
  // ══════════════════════════════════════════════════════════════════════════

  {
    slug: 'aullador-rojo',
    name: 'Aullador Rojo',
    kind: 'PLANTILLA',
    aliases: ['aullador rojo', 'aulladores rojos'],
    faction: null,
    role: 'Depredador de jauría que sigue a los Corredores en migración',
    articulo: 'el',
    level: 1,
    levelMax: 4,
    attributes: { fuerza: 6, destreza: 10, constitucion: 7, inteligencia: 8, voluntad: 6, carisma: 6, magia: 0 },
    bio: 'Criatura flaca de cuatro patas, pelaje rojizo rasposo, mechones de pelo negro en los tobillos y patas desproporcionadamente largas — el pelaje enredado con parches de arena fosilizada que brillan como vetas minerales rojas, y una hilera de púas oscuras erizadas a lo largo del lomo. Colmillos curvos y amarillentos de tamaño exagerado, costillas marcadas bajo la piel tensa, y una cola negra tupida que arrastra borrando sus propias huellas. Sigue a las manadas de Corredores en migración, cobrándose a los rezagados. Caza en jaurías de 4-6; un aullador solo nunca ataca a un orco adulto — una jauría con hambre, sí.',
    personality: 'Paciente, cobarde en solitario y osado en grupo; rodea antes de atacar.',
    loadout: [],
    ataqueNatural: 'Clava sus colmillos curvos y amarillentos en los puntos débiles, exagerados para su tamaño.',
    temperamento: 'CAUTELOSO',
    domesticablePct: 20,
    // Tameo (Grupo 3 § Compañeros y supervivencia, 2026-08-25) — depredador ágil, resiste por
    // instinto de huida/ataque rápido, no por fuerza bruta.
    atributoResistencia: 'destreza',
    capturablePct: 35,
    // Categoría de raza de fauna (2026-09-02) — GUELISES: caza en jaurías de 4-6, texto literal
    // de su propia bio ("un aullador solo nunca ataca a un orco adulto — una jauría con hambre,
    // sí"), coordinación de grupo real.
    faunaCategoria: 'GUELISES',
    habilidadesRaciales: [
      { icon: '🐺', name: 'Posicion defensiva', description: 'Adopta una posición defensiva al enfrentar a sus enemigos y a la minima oportunidad contra ataca', categoria: 'defensa', preferredAttribute: 'destreza', level: 4, effects: ['AGUANTE'] },
      { icon: '🔄', name: 'Filos centella', description: 'Se coloca en tu punto ciego y busca tus puntos débiles para atacar rapidamente con sus pronunciados colmillos.', categoria: 'ataque', preferredAttribute: 'destreza', level: 12, effects: ['ATAQUE'] },
      { icon: '🐾', name: 'Instinto Solitario', description: 'En cuanto se queda solo, se retira a toda velocidad — casi imposible rematarlo en la huida.', categoria: 'utilidad', preferredAttribute: 'inteligencia', level: 20, effects: ['AGUANTE'] },
    ],
  },

  {
    // Renombrado (2026-09-02, decisión explícita de la usuaria: nombres de fauna no deben ser
    // palabras reales de la Tierra — mismo criterio aplicado a la nueva fauna de Los Acantilados
    // Partidos) — de "Buitre Cenizo" a "Zense Ceniza". Slug sin cambiar (zense-ceniza, sin
    // referencias a `name` en el resto del código, solo por slug/id). Nota pendiente de la usuaria:
    // todos los nombres actuales de fauna/flora/etc. están en lengua común — en algún momento se
    // añadirán versiones en los idiomas propios de cada raza cuando ella lo indique explícitamente.
    slug: 'zense-ceniza',
    name: 'Zense Ceniza',
    kind: 'PLANTILLA',
    aliases: ['zense ceniza', 'zense', 'zenses ceniza'],
    faction: null,
    role: 'Carroñero de caza menor y señal ambiental',
    articulo: 'el',
    level: 1,
    levelMax: 3,
    attributes: { fuerza: 6, destreza: 8, constitucion: 6, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 },
    // Bio ajustada (checklist 2026-07-21/22, ronda de imágenes) al primer prompt de imagen que la
    // usuaria generó de verdad y validó — más fiero de aspecto de lo esperado, aunque su papel en
    // el mundo (carroñero, señal ambiental, nivel 1) no cambia.
    bio: 'Ave carroñera de plumaje negro intenso, revuelto y salvaje, con la piel bajo el plumaje de un gris ceniza brillante sobre escamas pardas — de aspecto mucho más fiero de lo esperado. El pico entreabierto deja ver pequeños dientes afilados, y sus ojos brillan de un gris ceniciento sólido con destellos blancos. Envergadura enorme y desproporcionada para su cuerpo, garras afiladas y curvas colgando de las patas al planear. Siempre en círculos sobre lo que muere en la llanura. Los orcos los leen como los Goirntes leen mapas: dónde caen los Zense, algo ha caído antes.',
    personality: 'Cobarde con lo vivo, atrevidísima con lo muerto.',
    loadout: [],
    ataqueNatural: 'Picotea y araña con sus garras curvas, torpe y dudosa mientras su presa todavía respira.',
    temperamento: 'CAUTELOSO',
    domesticablePct: 25,
    // Tameo (2026-08-25) — carroñero aéreo, resiste esquivando, no plantando cara.
    atributoResistencia: 'destreza',
    capturablePct: 50,
    // Categoría de raza de fauna (2026-09-02) — CORVENES: ave de presa/carroñera, "cae en picado
    // sobre su presa" desde altura, texto literal de su propia habilidad de ataque.
    faunaCategoria: 'CORVENES',
    habilidadesRaciales: [
      { icon: '🐦', name: 'Plumaje ferreo', description: 'Aprrieta los musculos para protegerse de los ataques formando una malla resistente con su plumaje.', categoria: 'defensa', preferredAttribute: 'fuerza', level: 4, effects: ['AGUANTE'] },
      { icon: '🦅', name: 'Vuelo Embestida', description: 'Alza el vuelo, al obtener cierta altura cae en picado sobre su presa', categoria: 'ataque', preferredAttribute: 'destreza', level: 12, effects: ['ATAQUE'] },
      { icon: '🦴', name: 'Carroña', description: 'Busca rapidamente un cadáver para alimentarse y recuperar un poco de salud', categoria: 'utilidad', preferredAttribute: 'inteligencia', level: 20, effects: ['RECUPERACION'] },
    ],
  },

  {
    // Añadido 2026-08-03 (sesión "ampliamos lore" — ver docs/rpgtarkor/lore-mundo/flora-fauna.md y
    // areas.md § Historia profunda): en lengua orca, Makt'orik, "Guardián del aullido nocturno" —
    // de ahí el nombre del Clan Maktor, que domó uno de estos hace generaciones. Costumbre entre
    // los altos cargos del clan tener uno domado propio; de ahí el emblema (colmillo orco marcado
    // por un zarpazo de Canizor). domesticablePct alto a propósito, más que Aullador Rojo, por esa
    // misma afinidad cultural — capturablePct bajo porque, a diferencia de un Corredor dócil, no
    // se deja atrapar sin más: se le doma, o se le enfrenta.
    slug: 'canizor',
    name: 'Canizor',
    kind: 'PLANTILLA',
    aliases: ['canizor', 'canizores', "makt'orik"],
    faction: null,
    role: 'Fiera solitaria de las llanuras, domable, ligada al Clan Maktor',
    articulo: 'el',
    level: 1,
    levelMax: 4,
    attributes: { fuerza: 9, destreza: 10, constitucion: 8, inteligencia: 6, voluntad: 7, carisma: 3, magia: 0 },
    bio: 'Fiera de cuerpo corto de pelo, cruce entre un gran felino y un cánido salvaje — cabeza y mandíbula de tigre sobre un porte lobuno, fiero y de mirada fija. Las hembras son más corpulentas, de pelaje más abundante; los machos, más finos, de pelo más corto y tonos más claros. A diferencia de los Aulladores Rojos, caza y vive en solitario, marcando territorio con aullidos largos al caer la noche. Los orcos lo llaman Makt\'orik, "Guardián del aullido nocturno" — el Clan Maktor le debe su nombre a uno domado por su fundadora hace generaciones, y desde entonces sus jefes y altos cargos siguen la misma costumbre.',
    personality: 'Territorial y desconfiado con desconocidos, pero de lealtad total una vez domado.',
    loadout: [],
    ataqueNatural: 'Zarpazo profundo seguido de una dentellada a la garganta si el primer golpe no basta.',
    // CAUTELOSO, no AGRESIVO (2026-08-03): con domesticablePct 45 y la lealtad total ya descrita
    // en la personalidad, forzar combate en casi cualquier interacción (lo que hace AGRESIVO en
    // shouldForceCombat) bloquearía la propia costumbre de doma que le da sentido narrativo.
    temperamento: 'CAUTELOSO',
    domesticablePct: 45,
    // Tameo (2026-08-25) — "territorial y desconfiado... lealtad total una vez domado", resiste
    // por pura voluntad territorial, no por fuerza o velocidad.
    atributoResistencia: 'voluntad',
    capturablePct: 20,
    // Categoría de raza de fauna (2026-09-02) — ACECHANTES: "a diferencia de los Aulladores Rojos,
    // caza y vive en solitario" (texto literal de su bio), depredador solitario territorial.
    faunaCategoria: 'ACECHANTES',
    habilidadesRaciales: [
      { icon: '🐾', name: 'Zarpazo marcado', description: 'Ataca con las garras delanteras, dejando el mismo tipo de marca que lleva el emblema del Clan Maktor.', categoria: 'ataque', preferredAttribute: 'fuerza', level: 4, effects: ['ATAQUE'] },
      { icon: '🌙', name: 'Cazador nocturno', description: 'Ve y se mueve mejor de noche, cuando caza de verdad — más peligroso al caer el sol.', categoria: 'ataque', preferredAttribute: 'destreza', level: 12, effects: ['ATAQUE', 'ATURDIMIENTO'] },
      { icon: '🦴', name: 'Instinto territorial', description: 'Defiende su terreno con más fuerza de la que muestra al cazar — no huye si se siente acorralado en él.', categoria: 'defensa', preferredAttribute: 'voluntad', level: 20, effects: ['AGUANTE'] },
    ],
  },

  {
    slug: 'corredor-de-cauce',
    name: 'Corredor de Cauce',
    kind: 'PLANTILLA',
    aliases: ['corredor de cauce', 'corredores de cauce'],
    faction: null,
    role: 'Bestia de seis patas de las Llanuras del Viento Rojo',
    articulo: 'el',
    level: 1,
    levelMax: 2,
    attributes: { fuerza: 6, destreza: 12, constitucion: 4, inteligencia: 4, voluntad: 3, carisma: 3, magia: 0 },
    bio: 'Bestia veloz de seis patas y piel rojiza que se camufla en el polvo de la llanura — hocico alargado con grandes bigotes y ojos oscuros y redondos, orejas pequeñas y pegadas al cráneo, una hilera de placas óseas superpuestas recorriéndole el lomo hasta una cola larga y afilada en la punta. Se desplaza en manadas siguiendo las corrientes subterráneas. Los clanes orcos la cazan en carreras rituales.',
    personality: 'Huidiza, rápida a la primera señal de peligro — no busca el enfrentamiento.',
    loadout: [],
    ataqueNatural: 'Embiste con la cabeza y las placas óseas del lomo, más para abrirse paso que para herir de verdad.',
    temperamento: 'INOFENSIVO',
    domesticablePct: 55,
    // Tameo (2026-08-25) — "bestia veloz de seis patas", resiste huyendo, no plantando cara.
    atributoResistencia: 'destreza',
    capturablePct: 60,
    // Categoría de raza de fauna (2026-09-02) — BESTIONES: "se desplaza en manadas" (texto literal
    // de su bio), herbívoro grande de manada pese a su tamaño moderado.
    faunaCategoria: 'BESTIONES',
    habilidadesRaciales: [
      { icon: '🏃', name: 'Fuga audaz', description: 'Al primer sobresalto intenta huir siendo casi imposible pararlo.', categoria: 'utilidad', preferredAttribute: 'destreza', level: 4, effects: ['AGUANTE'] },
      { icon: '🦴', name: 'Placas del Lomo', description: 'La hilera de placas óseas del lomo amortigua un golpe que a otra bestia la habría derribado.', categoria: 'defensa', preferredAttribute: 'fuerza', level: 12, effects: ['AGUANTE'] },
      { icon: '💥', name: 'Embestida Volatil', description: 'Carga con todo su peso y puede derribar a quien no logre apartarse a tiempo.', categoria: 'ataque', preferredAttribute: 'fuerza', level: 20, effects: ['ATAQUE', 'ATURDIMIENTO'] },
    ],
  },

  {
    slug: 'corretolvas',
    name: 'Corretolvas',
    kind: 'PLANTILLA',
    aliases: ['corretolva', 'corretolvas'],
    faction: null,
    role: 'Ave corredora de caza menor',
    articulo: 'el',
    level: 1,
    levelMax: 1,
    attributes: { fuerza: 5, destreza: 16, constitucion: 3, inteligencia: 3, voluntad: 4, carisma: 8, magia: 0 },
    bio: 'Criatura corredora incapaz de volar, cuerpo alargado que se desplaza casi paralelo al suelo — plumaje rojizo veteado de gris polvoriento, cresta escamosa negra rematada en plumas rojas, patas largas y nervudas con garras negras afiladas, ojos ámbar pequeños y brillantes, pico largo y curvo para escarbar el suelo. Se mueve en bandadas entre la hierba rojiza — caza menor, se cobra con trampa o lanza corta.',
    personality: 'Nerviosa, huye en bandada al primer sobresalto.',
    loadout: [],
    ataqueNatural: 'Picotea y araña con sus garras negras, más por pánico que por intención real de herir.',
    temperamento: 'INOFENSIVO',
    domesticablePct: 40,
    // Tameo (2026-08-25) — corredor incapaz de volar, resiste huyendo a la carrera.
    atributoResistencia: 'destreza',
    capturablePct: 70,
    // Categoría de raza de fauna (2026-09-02) — ZANCUDOS: "criatura corredora incapaz de volar"
    // (texto literal de su bio), ave terrestre de patas largas.
    faunaCategoria: 'ZANCUDOS',
    habilidadesRaciales: [
      { icon: '💥', name: 'Picoteo Incesante', description: 'En un ataque agil, ejecuta continuos picotazos en las partes mas debil de su agresor. Busca atacar las partes mas blandas y desprotegidas.', categoria: 'ataque', preferredAttribute: 'destreza', level: 4, effects: ['ATAQUE'] },
      { icon: '🐦', name: 'Vuelo en Bandada', description: 'Se coloca en posición de carrera y sin que te puedas dar cuenta huye del combate desapareciendo entre las tornmentas de arena roja.', categoria: 'utilidad', preferredAttribute: 'destreza', level: 12, effects: ['AGUANTE'] },
    ],
  },

  {
    slug: 'cruzavientos',
    name: 'Cruzavientos',
    kind: 'PLANTILLA',
    aliases: ['cruzavientos', 'cruzaviento'],
    faction: null,
    role: 'Ave planeadora que anida en Los Pilares Rotos',
    articulo: 'el',
    // Bug real jugando en vivo (2026-08-23/26, "un cruzavientos me lleva atacando... en todas las
    // zonas por las que he pasado"): sin `homeLocationSlug`, `detectNpcsInScene` (npcScene.ts) lo
    // trata como candidato plausible en CUALQUIER región del mundo — el único caso entre toda la
    // fauna AGRESIVO del catálogo sin ubicación fijada, pese a que su propia `personality` dice
    // "agresiva con cualquiera que se acerque a SU TERRITORIO de anidación". Ancla su territorio a
    // donde el propio lore ya dice que anida — sigue apareciendo en toda Las Llanuras del Viento
    // Rojo (misma región que Pilares Rotos), solo deja de colarse en regiones ajenas.
    homeLocationSlug: 'pilares-rotos',
    level: 5,
    levelMax: 10,
    attributes: { fuerza: 14, destreza: 10, constitucion: 10, inteligencia: 6, voluntad: 7, carisma: 2, magia: 2 },
    bio: 'Planeadora grande de alas rígidas que cabalga los frentes de viento. Vuela alto y en círculos con buen tiempo; cuando cruza baja y en línea recta, los pastores saben que viene tormenta de arena magnética. Anida en lo alto de los Pilares Rotos. Cazarla es dificilísimo salvo en nido o con trampa cebada.',
    // Auditoría de lore 2026-08-22/23: `personality` contradecía `temperamento: 'AGRESIVO'` (decía
    // puramente esquiva, nunca atacaba). Confirmado con la usuaria que el ave SÍ es agresiva de
    // verdad — se reescribe para reflejarlo; la dificultad de caza es de PUNTERÍA/captura en el
    // combate ya iniciado (vuelo errático), no de que evite el enfrentamiento.
    personality: 'Agresiva con cualquiera que se acerque a su territorio de anidación — se lanza en picado sin dudarlo. Una vez en el aire, su vuelo errático la hace endemoniadamente difícil de acertar o de dar caza de verdad.',
    loadout: [],
    ataqueNatural: 'Golpe de garras rápidas y afiladas desde el aire.',
    temperamento: 'AGRESIVO',
    // Gate de alcanzabilidad de "Interactuar" (2026-09-08) — "planeadora... se lanza en picado" no
    // es alcanzable desde tierra sin que la narración describa una condición (posado en el nido, en
    // tierra herido...). Hoy sin efecto observable (ya excluido de cualquier oferta pacífica por su
    // propio AGRESIVO), pero honesto con su bio — y listo si algún día deja de ser el único caso.
    medio: ['AEREO'],
    domesticablePct: 5,
    // Tameo (2026-08-25) — planeadora salvaje e independiente, resiste por puro instinto libre,
    // casi nunca cede.
    atributoResistencia: 'voluntad',
    capturablePct: 10,
    // Categoría de raza de fauna (2026-09-02) — CORVENES: "planeadora... cabalga los frentes de
    // viento", ave de presa agresiva de vuelo alto. 4 específicas (por encima del máximo
    // orientativo de 3, dentro del tope real "hasta 6" de `habilidadesRaciales`) — repartidas en
    // 4/12/20/28, un tramo más allá del patrón estándar de 3 (4/12/20).
    faunaCategoria: 'CORVENES',
    habilidadesRaciales: [
      { icon: '🌬️', name: 'Vuelo Errático', description: 'Despliega sus alas rígidas y se mueve rapido haciendo movimientos impredecibles siendo muy dificil alcanzarlo', categoria: 'utilidad', preferredAttribute: 'destreza', level: 4, effects: ['AGUANTE'] },
      { icon: '💥', name: 'Embestida Aérea', description: 'Carga con todo su peso desde el aire embistiendo con su afilado plumaje a sus enemigos', categoria: 'ataque', preferredAttribute: 'destreza', level: 12, effects: ['ATAQUE'] },
      { icon: '🩸', name: 'Garras Sangrantes', description: 'Busca tus puntos débiles y los ataca con sus garras afiladas bucando desgarrar tendones.', categoria: 'ataque', preferredAttribute: 'fuerza', level: 20, effects: ['ATAQUE', 'ATURDIMIENTO'] },
      { icon: '🌋', name: 'Coraza Ceniza', description: 'Colaca sus alas al frente creando un escudo de plumaje solido que le protege casi de cualquier ataque.', categoria: 'defensa', preferredAttribute: 'constitucion', level: 28, effects: ['AGUANTE'] },
    ],
  },

  {
    slug: 'gargantua-de-ceniza',
    name: 'Gargantúa de Ceniza',
    kind: 'PLANTILLA',
    aliases: ['gargantúa de ceniza', 'gargantua de ceniza'],
    faction: null,
    role: 'Bestia grande cazada con lanzas de hueso',
    articulo: 'la',
    level: 6,
    levelMax: 12,
    attributes: { fuerza: 20, destreza: 6, constitucion: 22, inteligencia: 4, voluntad: 9, carisma: 2, magia: 0 },
    bio: 'Bestia grande y pesada, de piel gris ceniza curtida bajo una coraza natural de placas óseas gruesas y blanquecinas que se solapan como escamas — costillas visibles bajo la piel cuando respira hondo, andar lento y pisadas que tiemblan en el suelo. Solo se caza de adulta con lanzas de hueso, en cacerías serias, no en un enfrentamiento casual.',
    // Auditoría de lore 2026-08-22/23: `temperamento: 'AGRESIVO'` forzaba combate en CUALQUIER
    // encuentro, contradiciendo "no busca presas activamente" y el trato de respeto ritual que le
    // dan las Terk'ikar. Confirmado con la usuaria: CAUTELOSO (no fuerza combate solo — mismo
    // patrón que Guchapo/Cuernahoja/Imanio — pero sí pelea de verdad si el jugador se acerca
    // demasiado/la provoca, que es justo lo que ya hace CAUTELOSO cuando el jugador ataca).
    personality: 'Territorial y peligrosa si se la acorrala o se le ataca, pero no busca presas activamente — no dudará en embestir si el jugador se acerca demasiado o la provoca.',
    loadout: [],
    ataqueNatural: 'Embiste con todo su peso, aplastando lo que se interponga en su camino.',
    temperamento: 'CAUTELOSO',
    domesticablePct: 5,
    // Tameo (2026-08-25) — "bestia grande y pesada", resiste por pura masa/resistencia física.
    atributoResistencia: 'constitucion',
    capturablePct: 10,
    // Categoría de raza de fauna (2026-09-02) — BESTIONES: "bestia grande y pesada", cazada en
    // cacerías serias, mismo perfil de gran herbívoro/bestia que Corredor de Cauce/Múrgol.
    faunaCategoria: 'BESTIONES',
    habilidadesRaciales: [
      { icon: '🦴', name: 'Coraza de Placas', description: 'Las gruesas placas óseas que le cubren el lomo absorben buena parte de cualquier golpe directo.', categoria: 'defensa', preferredAttribute: 'fuerza', level: 4, effects: ['AGUANTE'] },
      { icon: '💥', name: 'Embestida Sísmica', description: 'Carga con todo su peso y puede derribar a quien no logre apartarse a tiempo.', categoria: 'ataque', preferredAttribute: 'fuerza', level: 12, effects: ['ATAQUE', 'ATURDIMIENTO'] },
      { icon: '🐾', name: 'Paso Pesado', description: 'El suelo tiembla bajo sus pisadas — imposible acercarse a ella sin que lo note.', categoria: 'utilidad', preferredAttribute: 'voluntad', level: 20, effects: ['INTIMIDACION'] },
    ],
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
    aliases: ['murgol', 'múrgol'],
    faction: null,
    role: 'Ganado de los clanes de las Llanuras',
    articulo: 'el',
    level: 1,
    levelMax: 5,
    attributes: { fuerza: 9, destreza: 6, constitucion: 10, inteligencia: 2, voluntad: 5, carisma: 2, magia: 2 },
    bio: 'Criatura lanuda y voluminosa de cuatro patas, pelaje gris ceniza con matices rojizos y polvo rojo siempre enredado en la lana espesa que le cae sobre los ojos — cornamenta ramificada, gruesa y ampliamente extendida a los lados de la cabeza, boca de dientes planos y cuadrados, ojos negros con un destello amarillento. El ganado de los clanes de las Llanuras: lana, leche y carne. Los del Clan Serhu llevan una muesca en la oreja — un múrgol con muesca de clan es propiedad, cazarlo es robo a ojos Serhu.',
    personality: 'Dócil, gregario, se espanta con las tormentas.',
    loadout: [],
    ataqueNatural: 'Topetazo torpe con su cornamenta ramificada, casi siempre sin intención real de dañar.',
    temperamento: 'INOFENSIVO',
    domesticablePct: 90,
    // Tameo (2026-08-25) — "dócil, gregario", ganado de los clanes, resiste poco y por pura masa.
    atributoResistencia: 'constitucion',
    capturablePct: 80,
    // Categoría de raza de fauna (2026-09-02) — BESTIONES: "gregario", ganado de manada de los
    // clanes, mismo perfil que Corredor de Cauce/Gargantúa de Ceniza.
    faunaCategoria: 'BESTIONES',
    habilidadesRaciales: [
      { icon: '💥', name: 'Embestida Sísmica', description: 'Carga con todo su peso y puede derribar a quien no logre apartarse a tiempo.', categoria: 'ataque', preferredAttribute: 'fuerza', level: 4, effects: ['ATAQUE'] },
      { icon: '🧶', name: 'Lana Espesa', description: 'La gruesa capa de lana enredada de polvo amortigua cualquier golpe menor antes de que llegue a la piel.', categoria: 'defensa', preferredAttribute: 'constitucion', level: 12, effects: ['AGUANTE'] },
    ],
  },

  {
    slug: 'rondador-de-brasas',
    name: 'Rondador de Brasas',
    kind: 'PLANTILLA',
    aliases: ['rondador', 'rondador de brasas', 'bestia nocturna', 'bestia de la noche'],
    faction: null,
    role: 'Carroñero-cazador nocturno que ronda el fuego de los campamentos',
    articulo: 'el',
    level: 2,
    levelMax: 6,
    attributes: { fuerza: 14, destreza: 11, constitucion: 11, inteligencia: 8, voluntad: 9, carisma: 2, magia: 3 },
    bio: 'Carroñero-cazador nocturno de complexión robusta y pelaje ceniciento, mandíbula pesada y lomo encorvado con una hilera de púas óseas asomando entre el pelo — ojos que brillan en un dorado intenso en la oscuridad, visibles antes que el resto del cuerpo. No teme al fuego: lo busca — ha aprendido que donde hay brasas hay carne, cazada o dormida. Ronda el borde de la luz durante horas antes de decidirse. Solitario; ver dos juntos es señal de un cadáver grande cerca.',
    personality: 'Paciente y silencioso; se retira ante un grupo despierto, ataca a lo aislado o dormido.',
    // Confirmado 2026-08-21 (ampliación de lore): también residente de El Filo de las Brasas, el
    // único punto realmente volcánico del núcleo — no teme al fuego, "busca ascuas". No le quita
    // su presencia general en campamentos del resto de la región (ancla narrativa, no exclusiva).
    homeLocationSlug: 'filo-de-las-brasas',
    loadout: [],
    ataqueNatural: 'Cierra su pesada mandíbula de un mordisco certero, tras horas acechando en la sombra.',
    temperamento: 'AGRESIVO',
    domesticablePct: 10,
    // Tameo (2026-08-25) — carroñero-cazador nocturno testarudo, resiste por puro instinto.
    atributoResistencia: 'voluntad',
    capturablePct: 15,
    // Categoría de raza de fauna (2026-09-02) — ACECHANTES: "solitario", ronda en la sombra sin
    // ser visto antes de atacar, depredador de emboscada nocturno.
    faunaCategoria: 'ACECHANTES',
    habilidadesRaciales: [
      { icon: '🌒', name: 'Acecho Nocturno', description: 'Ronda el borde de la luz sin ser visto — el primer golpe contra un objetivo que no lo ha notado cae con fuerza extra.', categoria: 'ataque', preferredAttribute: 'destreza', level: 4, effects: ['ATAQUE', 'ATURDIMIENTO'] },
      { icon: '🩸', name: 'Mordisco Abrasado', description: 'Propina un mordisco abrasador que cercena la carné con sus colmillos y la calcina a la vez. Recupera una parte de la energia si el golpe es crítico y le resta esa misma energia a su rival.', categoria: 'ataque', preferredAttribute: 'fuerza', level: 12, effects: ['ATAQUE', 'RECUPERACION'] },
      { icon: '🔥', name: 'Brasa Berserker', description: 'En un fuerte aullido y en posicion defensiv, acelera su sangre dejando ver las venas de fuego y expulsando vapor pudiendo endurecer su cuerpo brevemente para detener el impacto. Si la defensa acierta tambien recupera un poco sus heridas, uso unico por combate.', categoria: 'defensa', preferredAttribute: 'destreza', level: 20, effects: ['AGUANTE', 'RECUPERACION'] },
    ],
  },

  {
    slug: 'salamandra-de-escoria',
    name: 'Salamandra de Escoria',
    kind: 'PLANTILLA',
    aliases: ['salamandra', 'salamandra de escoria', 'lagarto de fuego', 'lagarto grande'],
    faction: null,
    role: 'Reptil de escamas volcánicas, avanzadilla rara del borde norte',
    articulo: 'la',
    level: 3,
    levelMax: 4,
    attributes: { fuerza: 13, destreza: 9, constitucion: 13, inteligencia: 5, voluntad: 8, carisma: 2, magia: 4 },
    bio: 'Reptil de complexión robusta y baja, hocico alargado y dientes afilados siempre visibles, y una hilera de protuberancias rocosas en el lomo que arden con vetas de lava y desprenden humo — escamas como escoria volcánica que retienen calor, tocarla quema. Come Raíz de Fuego sin inmutarse. Su territorio real es El Filo de las Brasas, en el borde volcánico del núcleo (checklist 2026-07-21/22, ampliación del núcleo) — antes solo aparecía como avanzadilla rara más al sur, ahora se la encuentra donde de verdad vive.',
    personality: 'Lenta y territorial; avisa hinchando la garganta con un silbido de vapor antes de cargar.',
    homeLocationSlug: 'filo-de-las-brasas',
    loadout: [],
    ataqueNatural: 'Muerde y golpea de refilón con sus escamas al rojo vivo — quema con solo tocar.',
    temperamento: 'CAUTELOSO',
    domesticablePct: 15,
    // Tameo (2026-08-25) — reptil de "complexión robusta", resiste por dureza física propia.
    atributoResistencia: 'constitucion',
    capturablePct: 20,
    // Categoría de raza de fauna (2026-09-02) — MUDOS_SALVAJE: reptil de escamas volcánicas que
    // "arden con vetas de lava" — un rasgo imposible para un reptil normal, coherente con la magia
    // Salvaje derramada tras el Estallido de Tarkor (genesis.md), no un poder propio de Florial
    // (creador de ESCAMADOS "normales").
    faunaCategoria: 'MUDOS_SALVAJE',
    habilidadesRaciales: [
      { icon: '🔥', name: 'Piel Ardiente', description: 'Sus escamas retienen el calor de la lava — golpearla de cerca, cuerpo a cuerpo, también quema.', categoria: 'ataque', preferredAttribute: 'fuerza', level: 4, effects: ['ATAQUE'] },
      { icon: '🌋', name: 'Escamas de Escoria', description: 'La coraza de escoria volcánica resiste el calor y buena parte del daño físico directo.', categoria: 'defensa', preferredAttribute: 'fuerza', level: 12, effects: ['AGUANTE'] },
      { icon: '💨', name: 'Silbido de Vapor', description: 'Hincha la garganta y silba con fuerza antes de cargar — el aviso basta para hacer dudar a cualquiera.', categoria: 'utilidad', preferredAttribute: 'carisma', level: 20, effects: ['INTIMIDACION'] },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Ampliación de lore 2026-08-21 — repaso "zona por zona" de Las Llanuras del Viento Rojo
  // (docs/runbooks/ampliar-lore.md § 1.5, docs/rpgtarkor/lore-mundo/flora-fauna.md). 12 fauna nuevas, ver el .md para
  // el detalle narrativo completo de cada una.
  // ══════════════════════════════════════════════════════════════════════════

  {
    slug: 'gesgurio',
    name: 'Gesgurio',
    kind: 'PLANTILLA',
    aliases: ['gesgurio', 'gesgurios'],
    faction: null,
    role: 'Insecto carroñero de emboscada de La Hondonada del Eco',
    articulo: 'el',
    level: 1,
    levelMax: 3,
    attributes: { fuerza: 4, destreza: 9, constitucion: 6, inteligencia: 3, voluntad: 5, carisma: 1, magia: 0 },
    bio: 'Insecto de 5 a 20 cm, caparazón quitinoso color arcilla roja con púas más oscuras que lo camuflan contra las paredes de la Hondonada, patas dentadas bajo el caparazón para agarrarse a la roca. Come huesos de quien no logra cruzar la Hondonada; sin huesos, sigue de lejos, sin ser detectado, cualquier señal de vida —sobre todo moribundos o convalecientes— esperando a que perezcan.',
    personality: 'Paciente y sigiloso, nunca ataca a algo con fuerzas — el equivalente terrestre del Zense Ceniza.',
    homeLocationSlug: 'hondonada-del-eco',
    loadout: [],
    ataqueNatural: 'Muerde con mandíbulas pequeñas pero constantes, buscando puntos ya heridos.',
    temperamento: 'CAUTELOSO',
    // Hueco de datos real encontrado jugando en vivo (2026-09-08): sin `atributoResistencia`
    // (default null), `POST /saves/:id/capturar/:npcSlug` (companeros.ts, "Objetivo no capturable")
    // rechazaba SIEMPRE la captura pese a `capturablePct: 30` ya poblado — constitucion, mismo
    // criterio que el resto de fauna QUITINOS/acorazada del catálogo ("caparazón resiste golpes").
    atributoResistencia: 'constitucion',
    // Hueco de datos real encontrado jugando en vivo (2026-08-29): sin `capturablePct` (default 0
    // en el schema), `avistadosFor` (cazar.ts) siempre da 1 avistado sin importar la población real
    // — el combate múltiple (Grupo 3 § Mundo determinista, Capa 4) era matemáticamente inalcanzable
    // cazando en La Hondonada del Eco, la única zona con `ZonePoint` sembrado hoy. Gesgurio es el
    // candidato natural (insecto abundante, población real más alta de la zona — ver
    // `worldPopulation.ts` — bio coherente con aparecer en grupo, a diferencia de Kirelon Arenoso,
    // depredador solitario de alto nivel). Valor bajo-medio (no es fácil de avistar en grupo real,
    // "sigiloso... sin ser detectado" en su propia bio) — sirve para que `avistadosFor(30, 2146) =
    // round(30/10) = 3` dé un grupo real sin ser un valor arbitrario alto.
    capturablePct: 30,
    // Categoría de raza de fauna (2026-09-02) — QUITINOS: "insecto... caparazón quitinoso", igual
    // que Escorante/Lebude/Imanio — artrópodo acorazado real, aunque cace por emboscada.
    faunaCategoria: 'QUITINOS',
    habilidadesRaciales: [
      { icon: '🦴', name: 'Emboscada camuflada', description: 'Ataca desde el camuflaje contra la roca, sin que la presa lo vea venir.', categoria: 'ataque', preferredAttribute: 'destreza', level: 4, effects: ['ATAQUE'] },
      { icon: '🛡️', name: 'Caparazón de arcilla', description: 'El caparazón absorbe golpes directos casi tan bien como la propia roca a la que imita.', categoria: 'defensa', preferredAttribute: 'constitucion', level: 12, effects: ['AGUANTE'] },
      { icon: '👁️', name: 'Acecho paciente', description: 'Sigue de lejos a una presa débil sin que lo detecte, esperando el momento.', categoria: 'utilidad', preferredAttribute: 'inteligencia', level: 20, effects: ['ANALISIS'] },
    ],
  },

  {
    slug: 'kirelon-arenoso',
    name: 'Kirelon Arenoso',
    kind: 'PLANTILLA',
    aliases: ['kirelon', 'kirelon arenoso', 'kirelones'],
    faction: null,
    role: 'Depredador nocturno ciego de La Hondonada del Eco',
    articulo: 'el',
    level: 8,
    levelMax: 14,
    attributes: { fuerza: 17, destreza: 10, constitucion: 16, inteligencia: 6, voluntad: 10, carisma: 2, magia: 1 },
    bio: 'Reptil ciego de 2 a 4 metros, escama negra, cabeza gigante, se guía por olfato y vibración. Cuatro patas con garras de Yerreo para excavar y romper roca, hocico largo y achatado como el de un cocodrilo, hilera de dientes en sierra salvo dos colmillos superiores y dos inferiores al final de la fila, de punta cuadrada en vez de afilada, membranas entre las extremidades como un faldón. Pasa el día bajo tierra descansando; solo emerge de noche o con temperaturas bajas a cazar. Si se ve amenazado, puede desprenderse de una extremidad desmagnetizada para distraer y huir — alta capacidad regenerativa, recupera el miembro en pocos días.',
    personality: 'Paciente bajo tierra, letal y directo una vez emerge — no juega con la presa.',
    homeLocationSlug: 'hondonada-del-eco',
    loadout: [],
    ataqueNatural: 'Embiste con el hocico y cierra la sierra de dientes sobre el punto que ha localizado por vibración.',
    temperamento: 'AGRESIVO',
    // Categoría de raza de fauna (2026-09-02) — MUDOS_SALVAJE: "garras de Yerreo" (mineral/metal
    // especial, no anatomía reptil normal) y "extremidad desmagnetizada" — imantación real en el
    // cuerpo de un reptil no es un rasgo natural de ESCAMADOS, encaja con la magia Salvaje
    // derramada tras el Estallido de Tarkor (genesis.md), mismo criterio que Salamandra de Escoria.
    faunaCategoria: 'MUDOS_SALVAJE',
    habilidadesRaciales: [
      { icon: '🌑', name: 'Caza por vibración', description: 'No necesita ver — localiza a su presa por el más mínimo movimiento en la arena.', categoria: 'ataque', preferredAttribute: 'inteligencia', level: 4, effects: ['ATAQUE'] },
      { icon: '🦷', name: 'Sierra de dientes', description: 'Cierra la mandíbula en sierra sobre el punto débil ya localizado.', categoria: 'ataque', preferredAttribute: 'fuerza', level: 12, effects: ['ATAQUE'] },
      { icon: '🦴', name: 'Extremidad desmagnetizada', description: 'Se desprende de una pata quitándole la imantación al detectar peligro real — distrae y huye, la regenera en días.', categoria: 'utilidad', preferredAttribute: 'constitucion', level: 20, effects: ['AGUANTE'] },
    ],
  },

  {
    slug: 'ruptidar',
    name: 'Ruptidar',
    kind: 'PLANTILLA',
    aliases: ['ruptidar', 'ruptidares'],
    faction: null,
    role: 'Limpiador de arena, sin amenaza, presente en cualquier zona arenosa',
    articulo: 'el',
    level: 1,
    levelMax: 1,
    attributes: { fuerza: 1, destreza: 4, constitucion: 3, inteligencia: 1, voluntad: 2, carisma: 1, magia: 0 },
    bio: 'Reptil serpentiforme de 30 a 60 cm, se desliza bajo la arena filtrando materia orgánica descompuesta y dejando limpia la arena superficial. Cuerpo seco y duro como piedra en vida, coraza inerte que sostienen sus propios órganos; al morir, esa coraza se deshace en arena. Presente en cualquier zona arenosa de la región, no solo en un único punto.',
    personality: 'Totalmente inofensivo, indiferente a cualquier presencia.',
    loadout: [],
    ataqueNatural: 'No ataca.',
    temperamento: 'INOFENSIVO',
    // Categoría de raza de fauna (2026-09-02) — ESCAMADOS: "reptil serpentiforme", sin
    // `habilidadesRaciales` propias (totalmente inofensivo, nivel 1 fijo) — igual recibe las 7 de
    // categoría por completitud del catálogo, aunque rara vez llegue a combate real.
    faunaCategoria: 'ESCAMADOS',
    habilidadesRaciales: [],
  },

  {
    slug: 'ferike',
    name: 'Ferike',
    kind: 'PLANTILLA',
    aliases: ['ferike', 'ferikes'],
    faction: null,
    role: 'Depredador ágil del borde de la selva del Margen Silencioso',
    articulo: 'el',
    level: 10,
    levelMax: 16,
    attributes: { fuerza: 15, destreza: 17, constitucion: 12, inteligencia: 7, voluntad: 10, carisma: 3, magia: 0 },
    bio: 'Bestia de 1,5 a 3 metros, cuatro patas, pelaje espeso —raíz negra, rastas verde oscuro que arrastran por el suelo—, garras curvas y anchas capaces de desgarrar y escalar árboles, ojos violeta oscuro brillantes, dientes tan largos que no le permiten cerrar la boca del todo. Cuerpo musculoso y esbelto, muy ágil pese a que el pelaje la hace parecer más grande de lo que es. Cazan a cualquiera que se adentre en la sombra de la espesura; temen solo a los Faerus. Los machos tienen cola de espigas de pelo negro que pueden "apretar" para usarla como maza —barridos, golpes al suelo, también ritual de cortejo—; las hembras no tienen cola, pero desarrollan dientes y garras más fuertes: son ellas las cazadoras y alfas de la manada.',
    personality: 'Territorial y decidido — no ataca por sorpresa, avisa con un gruñido bajo antes de cargar.',
    homeLocationSlug: 'cruce-de-las-cenizas',
    loadout: [],
    ataqueNatural: 'Zarpazo con las garras curvas, buscando desgarrar antes que morder.',
    temperamento: 'AGRESIVO',
    // Categoría de raza de fauna (2026-09-02) — GUELISES: "cazadoras y alfas de la manada" (texto
    // literal de su bio) — estructura de manada real liderada por las hembras.
    faunaCategoria: 'GUELISES',
    habilidadesRaciales: [
      { icon: '🐾', name: 'Zarpazo desgarrador', description: 'Ataca con las garras anchas, pensadas para desgarrar tanto carne como corteza de árbol.', categoria: 'ataque', preferredAttribute: 'fuerza', level: 4, effects: ['ATAQUE'] },
      { icon: '🌿', name: 'Maza de cola', description: 'Solo los machos: aprieta los pelos de la cola en forma de maza y golpea en barrido — puede alcanzar varias extremidades.', categoria: 'ataque', preferredAttribute: 'destreza', level: 12, effects: ['ATAQUE'] },
      { icon: '💨', name: 'Agilidad esbelta', description: 'Pese al pelaje voluminoso, el cuerpo real es esbelto y muy ágil — esquiva mejor de lo que aparenta.', categoria: 'defensa', preferredAttribute: 'destreza', level: 20, effects: ['AGUANTE'] },
    ],
  },

  {
    slug: 'guchapo',
    name: 'Guchapo',
    kind: 'PLANTILLA',
    aliases: ['guchapo', 'guchapos', 'sapo gigante'],
    faction: null,
    role: 'Sapo gigante de las charcas de El Pozo de Cauce Viejo',
    articulo: 'el',
    level: 2,
    levelMax: 4,
    attributes: { fuerza: 8, destreza: 4, constitucion: 12, inteligencia: 3, voluntad: 6, carisma: 2, magia: 0 },
    bio: 'Sapos de 120 a 210 cm, redondos y gordos —almacenan agua en grandes cantidades, piel tersa por la presión—, con lengua larga y viscosa dividida en tres puntas, ojos colocados de forma extraña bajo la boca, frente corta e hinchada llena de verrugas. Cazan insectos, viven en las charcas más profundas y salen poco. Colores marrón/verde; el alfa de cada grupo es rojo, el más grande y el único agresivo, solo si se invade su charca.',
    personality: 'Muy asustadizo salvo el alfa, que defiende la charca sin dudar.',
    homeLocationSlug: 'pozo-cauce-viejo',
    loadout: [],
    ataqueNatural: 'Lengua viscosa trifurcada que atrapa y arrastra, o embestida directa el alfa.',
    temperamento: 'CAUTELOSO',
    domesticablePct: 10,
    // Tameo (2026-08-25) — sapo grande y voluminoso, resiste por pura masa/aguante.
    atributoResistencia: 'constitucion',
    // Categoría de raza de fauna (2026-09-02) — ESCAMADOS: "sapo", anfibio de charca.
    faunaCategoria: 'ESCAMADOS',
    habilidadesRaciales: [
      { icon: '👅', name: 'Lengua trifurcada', description: 'Lanza la lengua dividida en tres puntas para atrapar a un insecto o distraer a un agresor.', categoria: 'ataque', preferredAttribute: 'destreza', level: 4, effects: ['ATAQUE'] },
      { icon: '💧', name: 'Piel tersa', description: 'La piel, tensa por el agua acumulada, amortigua golpes menores como un colchón.', categoria: 'defensa', preferredAttribute: 'constitucion', level: 12, effects: ['AGUANTE'] },
      { icon: '😨', name: 'Huida al agua', description: 'Se sumerge en la charca más profunda al primer sobresalto, casi imposible de seguir.', categoria: 'utilidad', preferredAttribute: 'destreza', level: 20, effects: ['AGUANTE'] },
    ],
  },

  {
    slug: 'lebude',
    name: 'Lebude',
    kind: 'PLANTILLA',
    aliases: ['lebude', 'lebudes'],
    faction: null,
    role: 'Avispa-luciérnaga venenosa en colmena, El Pozo de Cauce Viejo',
    articulo: 'el',
    level: 3,
    levelMax: 7,
    attributes: { fuerza: 5, destreza: 14, constitucion: 6, inteligencia: 5, voluntad: 7, carisma: 2, magia: 0 },
    bio: 'Híbrido luciérnaga-avispa, 5 a 15 cm, negro con rayas gris ceniza, ojos blancos de libélula, aguijón grande — su veneno no es mortal pero deja mermado a quien pica (-50% de estadísticas durante un tiempo). Colmenas en forma de pequeñas montañas unidas entre sí, junto a los Telda Común. Comida favorita: Guchapos y Escorantes. Cazan en manada, con bajas reales cuando se enfrentan a un Escorante.',
    personality: 'Coordinado y agresivo en manada, tímido en solitario.',
    homeLocationSlug: 'pozo-cauce-viejo',
    loadout: [],
    ataqueNatural: 'Clava el aguijón cargado de veneno debilitante.',
    temperamento: 'AGRESIVO',
    // Categoría de raza de fauna (2026-09-02) — QUITINOS: insecto híbrido luciérnaga-avispa.
    // "Aguijón debilitante" (merma de estadísticas) narrativamente pediría `DEBILIDAD`, PENDIENTE
    // sin motor real — se queda en ATAQUE, mismo criterio que el resto del catálogo.
    faunaCategoria: 'QUITINOS',
    habilidadesRaciales: [
      { icon: '🐝', name: 'Aguijón debilitante', description: 'El veneno no mata, pero merma a fondo las capacidades de quien pica durante un tiempo.', categoria: 'ataque', preferredAttribute: 'destreza', level: 4, effects: ['ATAQUE'] },
      // Reescrita 2026-09-02 (auditoría "narrativa de jauría/manada en 1v1", petición explícita de
      // la usuaria — este caso concreto ya existía antes de la sesión de categorías de fauna) —
      // antes dependía de "coordina el ataque con el resto de la colmena", incoherente en un
      // combate 1v1 donde no hay compañeros reales en la escena. Ahora describe el mismo instinto
      // de rodeo propio de la especie, ejecutado en solitario. Mismo effects/categoria/nivel.
      { icon: '🕸️', name: 'Ataque de enjambre', description: 'Rodea a la presa con el mismo instinto de acoso que usaría junto al resto de la colmena, atacando desde varios ángulos a la vez.', categoria: 'ataque', preferredAttribute: 'inteligencia', level: 12, effects: ['ATAQUE', 'ATURDIMIENTO'] },
      { icon: '💡', name: 'Vuelo errático luminoso', description: 'El vuelo parpadeante y errático dificulta seguirlo o alcanzarlo.', categoria: 'defensa', preferredAttribute: 'destreza', level: 20, effects: ['AGUANTE'] },
    ],
  },

  {
    slug: 'escorante',
    name: 'Escorante',
    kind: 'PLANTILLA',
    aliases: ['escorante', 'escorantes'],
    faction: null,
    role: 'Escarabajo acorazado herbívoro de El Pozo de Cauce Viejo',
    articulo: 'el',
    level: 2,
    levelMax: 5,
    attributes: { fuerza: 10, destreza: 5, constitucion: 14, inteligencia: 4, voluntad: 9, carisma: 1, magia: 0 },
    bio: 'Escarabajo de 40 a 60 cm, caparazón oscuro y amarillo con detalles arcillosos/rojos, cuerno frontal en forma de pala para cavar y enterrarse en zonas húmedas. Herbívoro cauteloso, se alimenta del Musgo Arcilla. Diminutos pinchos en el caparazón segregan un líquido de sabor muy desagradable, disuade a los Guchapos. Su depredador real son los Lebudes, que cazan en manada.',
    personality: 'Cauteloso, prefiere enterrarse a huir corriendo.',
    homeLocationSlug: 'pozo-cauce-viejo',
    loadout: [],
    ataqueNatural: 'Embiste con el cuerno frontal en forma de pala.',
    temperamento: 'CAUTELOSO',
    // Categoría de raza de fauna (2026-09-02) — QUITINOS: "escarabajo acorazado", mismo perfil que
    // Lebude/Gesgurio/Imanio.
    faunaCategoria: 'QUITINOS',
    habilidadesRaciales: [
      { icon: '🛡️', name: 'Cuerno excavador', description: 'Embiste con el cuerno usado normalmente para cavar — más fuerza que precisión.', categoria: 'ataque', preferredAttribute: 'fuerza', level: 4, effects: ['ATAQUE'] },
      { icon: '🦠', name: 'Pinchos repelentes', description: 'Los pinchos del caparazón segregan un líquido tan desagradable que disuade a la mayoría de depredadores.', categoria: 'defensa', preferredAttribute: 'constitucion', level: 12, effects: ['INTIMIDACION'] },
      { icon: '🕳️', name: 'Enterrarse', description: 'Se entierra en terreno húmedo en segundos, casi invisible una vez oculto.', categoria: 'utilidad', preferredAttribute: 'constitucion', level: 20, effects: ['AGUANTE'] },
    ],
  },

  {
    slug: 'jusha-esmeralda',
    name: 'Jusha Esmeralda',
    kind: 'PLANTILLA',
    aliases: ['jusha', 'jusha esmeralda', 'jushas'],
    faction: null,
    role: 'Pez de las charcas profundas de Los Manaderos',
    articulo: 'la',
    level: 1,
    levelMax: 2,
    attributes: { fuerza: 3, destreza: 6, constitucion: 5, inteligencia: 2, voluntad: 3, carisma: 1, magia: 0 },
    bio: 'Pez de 20-30 cm, escamas verde musgo con brillos azul oscuro, aleta dorsal espinosa sin membrana, cola amplia, hocico redondo, dientes planos para raspar algas del fondo. Población baja, en las charcas más profundas. Sabor amargo pero comestible. Puede saltar de charca en charca por zonas de barro, rara vez, solo si su charca se ve amenazada o en sequía severa.',
    personality: 'Esquivo, población escasa — se ve poco.',
    homeLocationSlug: 'manaderos',
    loadout: [],
    ataqueNatural: 'No ataca, huye.',
    temperamento: 'INOFENSIVO',
    // Categoría de raza de fauna (2026-09-02) — NADANTES: "pez de las charcas profundas".
    faunaCategoria: 'NADANTES',
    habilidadesRaciales: [
      { icon: '💦', name: 'Salto de charca', description: 'Salta entre charcas por el barro cuando su charca se ve amenazada o en sequía.', categoria: 'utilidad', preferredAttribute: 'destreza', level: 4, effects: ['AGUANTE'] },
    ],
  },

  {
    slug: 'miruina',
    name: 'Miruina',
    kind: 'PLANTILLA',
    aliases: ['miruina', 'miruinas'],
    faction: null,
    role: 'Roedor nocturno nadador de Los Manaderos, caza Jusha en manada',
    articulo: 'el',
    level: 4,
    levelMax: 8,
    attributes: { fuerza: 9, destreza: 13, constitucion: 9, inteligencia: 6, voluntad: 6, carisma: 2, magia: 0 },
    bio: 'Roedor nocturno de 100 a 120 cm, escamas de las que brota pelo, nadador experto, pelaje impermeable bajo el agua, negro con mechas blancas. Incisivos orientados en varias direcciones para rasgar escamas de Jusha (su presa favorita), ojos más de pez que de roedor, muy pequeños, no soportan la luz del día. Caza en manada de noche, descansa en las charcas tras comer. De día amplía sus madrigueras bajo el agua, con un túnel que sube hasta la superficie para respirar.',
    personality: 'Coordinado y persistente en manada, ciego de día.',
    homeLocationSlug: 'manaderos',
    loadout: [],
    ataqueNatural: 'Muerde y rasga con los incisivos multidireccionales.',
    temperamento: 'AGRESIVO',
    // Categoría de raza de fauna (2026-09-02) — GUELISES: "caza en manada de noche" (texto literal
    // de su bio, role y personality), coordinación de grupo real pese a ser roedor de base —
    // comportamiento de caza en jauría prevalece sobre taxonomía (RONDINES no describe manada).
    faunaCategoria: 'GUELISES',
    habilidadesRaciales: [
      // Reescrita 2026-09-02 (auditoría "narrativa de jauría/manada en 1v1", caso preexistente a
      // la sesión de categorías de fauna) — antes dependía de "coordina el ataque con el resto de
      // la manada". Ahora describe el mismo instinto de caza nocturna, ejecutado en solitario.
      { icon: '🌙', name: 'Caza al abrigo de la noche', description: 'Ataca al abrigo de la noche con el mismo instinto de caza en manada de siempre, aunque hoy cace sola.', categoria: 'ataque', preferredAttribute: 'destreza', level: 4, effects: ['ATAQUE'] },
      { icon: '🦫', name: 'Incisivos rasgadores', description: 'Los incisivos multidireccionales rasgan escamas y piel con facilidad.', categoria: 'ataque', preferredAttribute: 'fuerza', level: 12, effects: ['ATAQUE'] },
      { icon: '🕳️', name: 'Madriguera con respiradero', description: 'Puede retirarse a su madriguera bajo el agua, con salida de aire propia, y desaparecer.', categoria: 'defensa', preferredAttribute: 'constitucion', level: 20, effects: ['AGUANTE'] },
    ],
  },

  {
    slug: 'quio',
    name: 'Quio',
    kind: 'PLANTILLA',
    aliases: ['quio', 'quios'],
    faction: null,
    role: 'Gusano filtrador de las orillas de Los Manaderos',
    articulo: 'el',
    level: 1,
    levelMax: 1,
    attributes: { fuerza: 1, destreza: 3, constitucion: 3, inteligencia: 1, voluntad: 2, carisma: 1, magia: 0 },
    bio: 'Gusano de 10 a 20 cm, blanco con manchas marronas, tipo oruga con boca de filtro (sin dientes, pelos que retienen y filtran, como las barbas de una ballena). Vive en el fango de las orillas, se alimenta de restos orgánicos — el "limpiador"/carroñero de la zona.',
    personality: 'Totalmente inofensivo, indiferente a cualquier presencia.',
    homeLocationSlug: 'manaderos',
    loadout: [],
    ataqueNatural: 'No ataca.',
    temperamento: 'INOFENSIVO',
    // Categoría de raza de fauna (2026-09-02) — NADANTES: "gusano filtrador" de las orillas, vive
    // en el agua/fango, sin `habilidadesRaciales` propias (totalmente inofensivo, nivel 1 fijo).
    faunaCategoria: 'NADANTES',
    habilidadesRaciales: [],
  },

  {
    slug: 'tura-jusha',
    name: 'Tura Jusha',
    kind: 'PLANTILLA',
    aliases: ['tura jusha', 'tura', 'turas jusha'],
    faction: null,
    role: 'Ave sin vuelo de Los Manaderos, caza crías de Jusha de día',
    articulo: 'la',
    level: 3,
    levelMax: 6,
    attributes: { fuerza: 6, destreza: 12, constitucion: 7, inteligencia: 4, voluntad: 5, carisma: 2, magia: 0 },
    bio: 'Ave de patas larguísimas que se ensanchan hacia el pie, terminado en una garra tipo dinosaurio con uñas retráctiles negras, escamas grises. No vuela — alas cortas y anchas para planear o saltar dentro/fuera de las charcas. Plumaje alborotado, pico ancho que almacena agua. Caza de día, especializada en crías de Jusha desorientadas.',
    personality: 'Activa y oportunista de día, discreta.',
    homeLocationSlug: 'manaderos',
    loadout: [],
    ataqueNatural: 'Picotazo rápido con el pico ancho, o zarpazo con la garra retráctil.',
    temperamento: 'CAUTELOSO',
    // Categoría de raza de fauna (2026-09-02) — ZANCUDOS: "ave sin vuelo... de patas larguísimas",
    // ave terrestre/de charca, mismo perfil que Corretolvas.
    faunaCategoria: 'ZANCUDOS',
    habilidadesRaciales: [
      { icon: '🦶', name: 'Garra retráctil', description: 'Zarpazo con la garra tipo dinosaurio de la pata, retráctil hasta el último momento.', categoria: 'ataque', preferredAttribute: 'destreza', level: 4, effects: ['ATAQUE'] },
      { icon: '💦', name: 'Salto entre charcas', description: 'Planea o salta brevemente para entrar y salir de las charcas sin mojarse del todo.', categoria: 'utilidad', preferredAttribute: 'destreza', level: 12, effects: ['AGUANTE'] },
    ],
  },

  {
    slug: 'cuernahoja',
    name: 'Cuernahoja',
    kind: 'PLANTILLA',
    aliases: ['cuernahoja', 'cuernahojas'],
    faction: null,
    role: 'Gacela de manada de Los Pastos de la Deriva',
    articulo: 'la',
    level: 2,
    levelMax: 5,
    attributes: { fuerza: 7, destreza: 12, constitucion: 8, inteligencia: 3, voluntad: 7, carisma: 2, magia: 0 },
    bio: 'Fauna de 120-180 cm, tipo gacela con cuernos finos y largos de cabra montesa (sin apenas espiral), cuello ancho, pelaje muy corto rojo por arriba y blanco por el vientre. Come pasto y hojas altas gracias al cuello largo. Manada, inofensiva salvo que se le ataque. Dimorfismo: las hembras llevan más rojo que los machos y cuernos más anchos — son ellas las que defienden la manada ante una amenaza.',
    personality: 'Tranquila y de manada; las hembras se plantan de inmediato ante cualquier amenaza real.',
    homeLocationSlug: 'pastos-de-la-deriva',
    loadout: [],
    ataqueNatural: 'Embiste con los cuernos, más las hembras que los machos.',
    temperamento: 'CAUTELOSO',
    domesticablePct: 20,
    // Tameo (2026-08-25) — fauna de manada, esquiva/huye antes que plantar cara.
    atributoResistencia: 'destreza',
    // Categoría de raza de fauna (2026-09-02) — BESTIONES: "gacela de manada", herbívoro grande
    // de grupo, mismo perfil que Corredor de Cauce/Múrgol/Gargantúa de Ceniza.
    faunaCategoria: 'BESTIONES',
    habilidadesRaciales: [
      { icon: '🦌', name: 'Embestida de cuernos', description: 'Carga y embiste con los cuernos — las hembras, más anchos, golpean con más fuerza.', categoria: 'ataque', preferredAttribute: 'fuerza', level: 4, effects: ['ATAQUE'] },
      // Ambas reescritas 2026-09-02 (auditoría "narrativa de jauría/manada en 1v1", petición
      // explícita de la usuaria) — "Alfa defensora" antes dependía de "interponerse entre la
      // manada y la amenaza, para que el resto huya"; "Estampida de manada" antes dependía de que
      // "toda la manada huya a la vez", incoherente en un combate 1v1 sin compañeros reales en la
      // escena. Ambas reescritas para describir el mismo instinto de alfa/manada, ejecutado en
      // solitario. Mismo effects/categoria/nivel en las dos.
      { icon: '👑', name: 'Instinto de alfa', description: 'Se planta de frente con el porte de una alfa, con el mismo instinto que la lleva a ganar tiempo para el resto de la manada.', categoria: 'defensa', preferredAttribute: 'voluntad', level: 12, effects: ['CONTROL'] },
      { icon: '💨', name: 'Estampida instintiva', description: 'Rompe a correr en un zigzag errático, el mismo instinto de huida en estampida que usaría junto a la manada, difícil de seguir aunque corra sola.', categoria: 'utilidad', preferredAttribute: 'destreza', level: 20, effects: ['AGUANTE'] },
    ],
  },

  {
    slug: 'imanio',
    name: 'Imanio',
    kind: 'PLANTILLA',
    aliases: ['imanio', 'imanios'],
    faction: null,
    role: 'Insecto cubierto de rocas imantadas, Las Agujas Imán',
    articulo: 'el',
    level: 3,
    levelMax: 6,
    attributes: { fuerza: 9, destreza: 3, constitucion: 14, inteligencia: 2, voluntad: 8, carisma: 1, magia: 2 },
    bio: 'Insecto largo y fino, tipo bicho palo, de quitina que atrae rocas imantadas flotantes formando una armadura de piedra a su alrededor — muy lento pero fuerte una vez cubierto, puede doblar su tamaño real (80-180 cm sin contar rocas). Cuerpo blanco con tonos azules, casi invisible bajo las rocas, que se van deformando con el tiempo a la forma de su cuerpo. Se alimenta de Arena Imán, vaga por la zona buscándola. Inofensivo salvo que se le ataque.',
    personality: 'Lento, pacífico, defensivo cuando no queda otra salida.',
    homeLocationSlug: 'agujas-iman',
    loadout: [],
    ataqueNatural: 'Golpea con el peso de las rocas que lo cubren.',
    temperamento: 'CAUTELOSO',
    // Categoría de raza de fauna (2026-09-02) — MUDOS_SALVAJE: "atrae rocas imantadas flotantes"
    // — magnetismo activo real, no anatomía de insecto normal, mismo criterio que Kirelon
    // Arenoso/Nuente (magnetismo de Las Agujas Imán como huella de la magia Salvaje derramada).
    faunaCategoria: 'MUDOS_SALVAJE',
    habilidadesRaciales: [
      { icon: '🪨', name: 'Coraza de piedra', description: 'La armadura de rocas imantadas absorbe la mayor parte de cualquier golpe directo.', categoria: 'defensa', preferredAttribute: 'constitucion', level: 4, effects: ['AGUANTE'] },
      { icon: '🦵', name: 'Extremidad desmagnetizada', description: 'Se desprende de una parte del cuerpo, quitándole la imantación, para distraer a un depredador y huir — regenera en días.', categoria: 'utilidad', preferredAttribute: 'constitucion', level: 12, effects: ['AGUANTE'] },
    ],
  },

  {
    slug: 'nuente',
    name: 'Nuente',
    kind: 'PLANTILLA',
    aliases: ['nuente', 'nuentes'],
    faction: null,
    role: 'Depredador nocturno que ve magnetismo, Las Agujas Imán',
    articulo: 'el',
    level: 5,
    levelMax: 9,
    attributes: { fuerza: 8, destreza: 14, constitucion: 7, inteligencia: 9, voluntad: 8, carisma: 2, magia: 3 },
    bio: 'Bestia nocturna de 80-120 cm, mezcla deliberada casi alienígena — cuerpo de rana, alas de murciélago, cabeza tipo golem con forma de búho, halos en los ojos, orejas puntiagudas y finas (no necesita oír), pelaje blanco acabado en mechas azul marino. En vez de ecolocalización por sonido, "ve" el magnetismo de las cosas — se mueve con total agilidad en la oscuridad total. Solo sale de noche; caza Imanios. Garras afiladas y boca preparada para sorber los fluidos de su presa.',
    personality: 'Silencioso y calculador, no agresivo hacia quien no lo busca.',
    homeLocationSlug: 'agujas-iman',
    loadout: [],
    ataqueNatural: 'Sorbe los fluidos de su presa con la boca preparada para ello.',
    temperamento: 'CAUTELOSO',
    // Efecto pasivo confirmado con la usuaria (2026-08-21): -2 a la tirada de ataque del jugador
    // si usa arma de hierro/metal contra el Nuente — pendiente de enganchar en combatExchange.ts
    // (comprobar tipoArma/material del arma equipada), no hay campo hoy para representarlo aquí.
    // Categoría de raza de fauna (2026-09-02) — MUDOS_SALVAJE: "mezcla deliberada casi
    // alienígena" (texto literal de su propia bio) que "ve" el magnetismo en vez de oír — el caso
    // más explícito de todo el catálogo de algo imposible para un animal normal.
    faunaCategoria: 'MUDOS_SALVAJE',
    habilidadesRaciales: [
      { icon: '🩸', name: 'Succión vital', description: 'Sorbe los fluidos de su presa con la boca preparada para ello.', categoria: 'ataque', preferredAttribute: 'destreza', level: 4, effects: ['ATAQUE', 'RECUPERACION'] },
      { icon: '🧲', name: 'Onda Magnética', description: 'Deflecta metal e inmoviliza brevemente a un Imanio con una onda magnética dirigida.', categoria: 'utilidad', preferredAttribute: 'magia', level: 12, effects: ['CONTROL'] },
      { icon: '🦉', name: 'Vuelo errático nocturno', description: 'Vuela con total agilidad en la oscuridad total, casi imposible de seguir.', categoria: 'defensa', preferredAttribute: 'destreza', level: 20, effects: ['AGUANTE'] },
    ],
  },

  {
    slug: 'towrgu',
    name: 'Towrgu',
    kind: 'PLANTILLA',
    aliases: ['towrgu', 'towrgus'],
    faction: null,
    role: 'Depredador solitario de emboscada, La Sabana Alta',
    articulo: 'el',
    level: 4,
    levelMax: 12,
    attributes: { fuerza: 10, destreza: 14, constitucion: 9, inteligencia: 4, voluntad: 7, carisma: 2, magia: 0 },
    bio: 'Bestia de 120 a 160 cm, pelaje en tonos de rojo con manchas, corto y erizado, ojos ámbar, garras curvas que le permiten trepar y desgarrar con la misma facilidad. Musculado, dientes cortos y afilados en una boca extremadamente grande que se abre casi hasta las orejas. Bigotes espesos y curvados por su propio peso, cola larga negra rematada en un mechón rojo. Caza al acecho, aprovechando el sigilo que da el Pasto de Sangre para emboscar desde la hierba alta, igual que hace el Aullador Rojo con los Corredores de Cauce.',
    personality: 'Solitario y territorial, ataca sin previo aviso desde la cobertura de la hierba.',
    homeLocationSlug: 'sabana-alta-colmillar',
    loadout: [],
    ataqueNatural: 'Zarpazo de garras curvas seguido de una mordida de boca extremadamente grande.',
    temperamento: 'AGRESIVO',
    // Categoría de raza de fauna (2026-09-02) — ACECHANTES: "depredador solitario de emboscada"
    // (texto literal de su propio `role`), caza al acecho desde cobertura.
    faunaCategoria: 'ACECHANTES',
    habilidadesRaciales: [
      { icon: '🐾', name: 'Emboscada del pasto rojo', description: 'Aprovecha el sigilo de la hierba alta del Pasto de Sangre para atacar por sorpresa desde la cobertura.', categoria: 'ataque', preferredAttribute: 'destreza', level: 4, effects: ['ATAQUE', 'ATURDIMIENTO'] },
      { icon: '🦷', name: 'Mordida desgarradora', description: 'Abre su boca enorme casi hasta las orejas para una mordida directa y brutal.', categoria: 'ataque', preferredAttribute: 'fuerza', level: 12, effects: ['ATAQUE'] },
      { icon: '🧗', name: 'Trepa de garras curvas', description: 'Sus garras curvas le permiten trepar con la misma facilidad con la que desgarran, útil para perseguir o huir.', categoria: 'utilidad', preferredAttribute: 'destreza', level: 20, effects: ['AGUANTE'] },
    ],
  },

  {
    slug: 'coracelo',
    name: 'Coracelo',
    kind: 'PLANTILLA',
    aliases: ['coracelo', 'coracelos'],
    faction: null,
    role: 'Roedor constructor de madrigueras fortificadas, La Sabana Alta',
    articulo: 'el',
    level: 2,
    levelMax: 8,
    attributes: { fuerza: 7, destreza: 6, constitucion: 10, inteligencia: 6, voluntad: 5, carisma: 2, magia: 0 },
    bio: 'Roedor de 40 a 100 cm, pelaje espeso y largo —ceniza claro o marrón claro— que arrastra un poco por el suelo y oculta casi por completo ojos y extremidades. Manos muy desarrolladas que le permiten usar piedras y madera como herramientas para levantar madrigueras fortificadas donde refugiarse de los depredadores. Sus zarpas traseras, más grandes y con garras, son las que usa para defenderse, junto con dos largos colmillos inferiores cuadrados. La cola termina en una especie de bulto de escamas duras —equiparable en resistencia al hierro— que usa para golpear y partir rocas hasta encajarlas en su construcción.',
    personality: 'Cauteloso y esquivo, prefiere huir a su madriguera antes que enfrentarse a nada.',
    homeLocationSlug: 'sabana-alta-colmillar',
    loadout: [],
    ataqueNatural: 'Zarpazo de las patas traseras o golpe directo con la cola-maza de escamas, casi siempre solo para defenderse.',
    temperamento: 'CAUTELOSO',
    domesticablePct: 10,
    // Tameo (2026-08-25) — roedor que ya usa piedras/madera como herramienta, resiste con astucia
    // propia, no fuerza ni velocidad.
    atributoResistencia: 'inteligencia',
    // Categoría de raza de fauna (2026-09-02) — RONDINES: "roedor constructor de madrigueras"
    // (texto literal de su `role`), pequeño mamífero de comportamiento defensivo.
    faunaCategoria: 'RONDINES',
    habilidadesRaciales: [
      { icon: '🦴', name: 'Cola-maza de escamas', description: 'Golpea con el bulto de escamas duras del final de su cola, capaz de partir roca —resistencia equiparable al hierro.', categoria: 'ataque', preferredAttribute: 'fuerza', level: 4, effects: ['ATAQUE'] },
      { icon: '🖐️', name: 'Manos hábiles', description: 'Usa piedras y madera como herramientas para levantar y reforzar su madriguera.', categoria: 'utilidad', preferredAttribute: 'inteligencia', level: 12, effects: ['ANALISIS'] },
      { icon: '🕳️', name: 'Madriguera fortificada', description: 'Se retira a su propia madriguera reforzada con roca, casi imposible de forzar desde fuera.', categoria: 'defensa', preferredAttribute: 'constitucion', level: 20, effects: ['AGUANTE'] },
    ],
  },

  // Fauna de Playa de Ceniza Blanca (zona 15 del repaso "zona por zona", 2026-09-02) — zona
  // pacífica/de descanso, sin fauna combatible: todos los peces son "no ataca, huye" o inofensivos
  // sésiles, se obtienen vía la nueva profesión "pescador" (Pescar/Buscar), nunca por Cazar.
  {
    slug: 'jashil-verde',
    name: 'Jashil Verde',
    kind: 'PLANTILLA',
    aliases: ['jashil verde', 'jashil'],
    faction: null,
    role: 'Pez abundante de la costa de Playa de Ceniza Blanca',
    articulo: 'el',
    level: 1,
    levelMax: 2,
    attributes: { fuerza: 2, destreza: 5, constitucion: 3, inteligencia: 1, voluntad: 2, carisma: 1, magia: 0 },
    bio: 'Pez de 40 a 60 cm, cuerpo largo y escuálido como un pez aguja, varias filas de branquias visibles, cabeza similar a la de un lucio. Colores verdes vívidos mezclados, aletas dorsales de un esmeralda intenso. Muy abundante en esta costa.',
    personality: 'Inofensivo, no reacciona a la presencia de un pescador.',
    homeLocationSlug: 'playa-de-ceniza-blanca',
    loadout: [],
    ataqueNatural: 'No ataca, huye.',
    temperamento: 'INOFENSIVO',
    // Categoría de raza de fauna (2026-09-02) — NADANTES: pez de costa.
    faunaCategoria: 'NADANTES',
    habilidadesRaciales: [],
  },

  {
    slug: 'jashil-rojo',
    name: 'Jashil Rojo',
    kind: 'PLANTILLA',
    aliases: ['jashil rojo'],
    faction: null,
    role: 'Pez abundante de la costa de Playa de Ceniza Blanca, variante cromática del Jashil Verde',
    articulo: 'el',
    level: 1,
    levelMax: 2,
    attributes: { fuerza: 2, destreza: 5, constitucion: 3, inteligencia: 1, voluntad: 2, carisma: 1, magia: 0 },
    bio: 'Idéntico en forma al Jashil Verde —cuerpo largo y escuálido, cabeza de lucio, varias filas de branquias—, pero en tonos rojos variados con aleta dorsal color rubí.',
    personality: 'Inofensivo, no reacciona a la presencia de un pescador.',
    homeLocationSlug: 'playa-de-ceniza-blanca',
    loadout: [],
    ataqueNatural: 'No ataca, huye.',
    temperamento: 'INOFENSIVO',
    // Categoría de raza de fauna (2026-09-02) — NADANTES: pez de costa, variante cromática del
    // Jashil Verde.
    faunaCategoria: 'NADANTES',
    habilidadesRaciales: [],
  },

  {
    slug: 'toluh',
    name: 'Toluh',
    kind: 'PLANTILLA',
    aliases: ['toluh'],
    faction: null,
    role: 'Pez migratorio de gran tamaño, solo en otoño en Playa de Ceniza Blanca',
    articulo: 'el',
    level: 4,
    levelMax: 6,
    attributes: { fuerza: 8, destreza: 3, constitucion: 14, inteligencia: 2, voluntad: 3, carisma: 1, magia: 0 },
    // "pez luna" quitado de la comparación (auditoría de coherencia código↔lore, 2026-09-05) —
    // "luna" no es una palabra válida en ningún texto de este mundo (Helek Sirik no tiene luna,
    // genesis.md § "El cielo sin luna"), ni siquiera como comparación de forma.
    bio: 'Pez de 1 a 1,40 m, gris oscuro, ancho y circular con aletas muy desarrolladas que le permiten acelerar rápido pese a no ser veloz. Escamas grandes que cubren todo su cuerpo como una armadura. Come principalmente algas, en las zonas más profundas de la costa. Migra por el mar como las ballenas — solo aparece en las jornadas de otoño.',
    personality: 'Inofensivo, presa grande y pacífica, nunca ataca.',
    homeLocationSlug: 'playa-de-ceniza-blanca',
    loadout: [],
    ataqueNatural: 'No ataca.',
    temperamento: 'INOFENSIVO',
    // Categoría de raza de fauna (2026-09-02) — NADANTES: pez migratorio de gran tamaño.
    faunaCategoria: 'NADANTES',
    habilidadesRaciales: [],
  },

  {
    slug: 'negueo-turquesa',
    name: 'Negueo Turquesa',
    kind: 'PLANTILLA',
    aliases: ['negueo turquesa', 'negueo'],
    faction: null,
    role: 'Pez carroñero de la costa de Playa de Ceniza Blanca',
    articulo: 'el',
    level: 1,
    levelMax: 2,
    attributes: { fuerza: 2, destreza: 4, constitucion: 3, inteligencia: 1, voluntad: 2, carisma: 1, magia: 0 },
    bio: 'Pez de 10 a 30 cm con aspecto de sargo pero en tonos turquesa, más gordo que un sargo y con dientes de piraña. Carroñero — se alimenta de restos orgánicos y cadáveres que llegan a la costa, esperando cerca de la orilla. Carne de sabor pobre y poca energía, aunque hay recetas de cocina que saben aprovechar su amargor.',
    personality: 'Cauteloso — se acerca a la comida, pero se aparta si detecta una amenaza real.',
    homeLocationSlug: 'playa-de-ceniza-blanca',
    loadout: [],
    ataqueNatural: 'No ataca directamente, pero no es fácil de acorralar.',
    temperamento: 'CAUTELOSO',
    // Categoría de raza de fauna (2026-09-02) — NADANTES: pez carroñero de costa.
    faunaCategoria: 'NADANTES',
    habilidadesRaciales: [],
  },

  {
    slug: 'negueo-solar',
    name: 'Negueo Solar',
    kind: 'PLANTILLA',
    aliases: ['negueo solar'],
    faction: null,
    role: 'Pez carroñero de la costa de Playa de Ceniza Blanca, variante cromática del Negueo Turquesa',
    articulo: 'el',
    level: 1,
    levelMax: 2,
    attributes: { fuerza: 2, destreza: 4, constitucion: 3, inteligencia: 1, voluntad: 2, carisma: 1, magia: 0 },
    bio: 'Idéntico en forma al Negueo Turquesa —aspecto de sargo, dientes de piraña, carroñero—, pero en distintos tonos amarillos.',
    personality: 'Cauteloso — se acerca a la comida, pero se aparta si detecta una amenaza real.',
    homeLocationSlug: 'playa-de-ceniza-blanca',
    loadout: [],
    ataqueNatural: 'No ataca directamente, pero no es fácil de acorralar.',
    temperamento: 'CAUTELOSO',
    // Categoría de raza de fauna (2026-09-02) — NADANTES: pez carroñero de costa, variante
    // cromática del Negueo Turquesa.
    faunaCategoria: 'NADANTES',
    habilidadesRaciales: [],
  },

  {
    slug: 'bulco-de-arena',
    name: 'Bulco de Arena',
    kind: 'PLANTILLA',
    aliases: ['bulco de arena', 'bulco'],
    faction: null,
    role: 'Caracol de mar de la costa de Playa de Ceniza Blanca',
    articulo: 'el',
    level: 1,
    levelMax: 1,
    attributes: { fuerza: 1, destreza: 1, constitucion: 2, inteligencia: 1, voluntad: 1, carisma: 1, magia: 0 },
    bio: 'Caracol de mar de 5 a 15 cm, concha rugosa y puntiaguda con montañitas redondas simétricas, entre rojo muy oscuro y marrón claro. Interior blando y viscoso, con mucho sabor a mar. Los Terinte los desentierran con fruición, aunque también se pueden encontrar buscando en la arena.',
    personality: 'Sésil, sin reacción — no huye ni se defiende.',
    homeLocationSlug: 'playa-de-ceniza-blanca',
    loadout: [],
    ataqueNatural: 'No ataca.',
    temperamento: 'INOFENSIVO',
    // Categoría de raza de fauna (2026-09-02) — NADANTES: "caracol de mar" — sin categoría propia
    // de molusco, agrupado con el resto de fauna acuática/marina de la costa (criterio amplio,
    // mismo bucket que Jashil/Negueo/Toluh).
    faunaCategoria: 'NADANTES',
    habilidadesRaciales: [],
  },

  {
    slug: 'terinte',
    name: 'Terinte',
    kind: 'PLANTILLA',
    aliases: ['terinte'],
    faction: null,
    role: 'Mamífero excavador de la costa de Playa de Ceniza Blanca, puramente ambiental',
    articulo: 'el',
    level: 1,
    levelMax: 2,
    attributes: { fuerza: 2, destreza: 9, constitucion: 3, inteligencia: 3, voluntad: 2, carisma: 2, magia: 0 },
    bio: 'Parecido a un hurón, 40 a 60 cm, pelaje claro como la arena. Escarba túneles en busca de marisco, muy rápido, con garras adaptadas a cavar y un morro puntiagudo. Su lengua se divide en dos partes redondas (no planas, a diferencia de una serpiente), con pequeños dientes al final a modo de papilas, con los que atrapa marisco — no tiene dientes en la boca. Sale a escarbar en cuanto detecta que no hay nadie cerca, o se le puede ver alguna vez despistado antes de desaparecer.',
    personality: 'Cauteloso — huye nada más detectar una presencia amenazante.',
    homeLocationSlug: 'playa-de-ceniza-blanca',
    loadout: [],
    ataqueNatural: 'No ataca, huye.',
    temperamento: 'CAUTELOSO',
    // Puramente narrativo/ambiental a propósito (decisión explícita de la usuaria, 2026-09-02): no
    // proporciona ningún material real — no lleva HarvestYield, nunca aparece en ningún modal
    // mecánico (Cazar/Pescar/Buscar), solo lo menciona el Narrador en la escena.
    // Categoría de raza de fauna (2026-09-02) — RONDINES: "mamífero excavador" terrestre, pequeño,
    // mismo perfil que Coracelo pese a no ser combatible en la práctica.
    faunaCategoria: 'RONDINES',
    habilidadesRaciales: [],
  },

  {
    slug: 'benusa-pesquera',
    name: 'Benusa Pesquera',
    kind: 'PLANTILLA',
    aliases: ['benusa pesquera', 'benusa'],
    faction: null,
    role: 'Ave pescadora migratoria de la costa de Playa de Ceniza Blanca, puramente ambiental',
    articulo: 'la',
    level: 1,
    levelMax: 2,
    attributes: { fuerza: 2, destreza: 7, constitucion: 3, inteligencia: 3, voluntad: 2, carisma: 2, magia: 0 },
    bio: 'Ave de cuerpo similar a una cigüeña pero de patas cortas, cuello largo de cormorán, pico fino y puntiagudo similar al de un pelícano pero sin apenas papada. Plumas blancas que, en posición de pesca, dejan ver un brillo azul con el que engaña a los peces haciéndoles creer que son escamas — pico azulado con franjas blancas, ojos extraños de iris y pupila de ave pero forma reptiliana. Principalmente acuática, con largos vuelos migratorios: descansa en esta costa en verano y primavera, y el resto del año se refugia en la costa sur del Margen Silencioso. Su presa favorita es el Jashil, el pez más abundante de toda la costa de Berig.',
    personality: 'Cauteloso — furtiva y activa al pescar, pero no agresiva hacia nadie más.',
    homeLocationSlug: 'playa-de-ceniza-blanca',
    loadout: [],
    ataqueNatural: 'No ataca.',
    temperamento: 'CAUTELOSO',
    // Puramente narrativo/ambiental a propósito (2026-09-02): depredador natural del Jashil, mismo
    // patrón que Miruina/Tura Jusha en Los Manaderos — un depredador NPC no duplica el recurso de
    // su presa. Sin HarvestYield, no entra en ningún modal mecánico.
    // Gate de alcanzabilidad de "Interactuar" (2026-09-08) — "principalmente acuática", pescando en
    // la costa. Sin efecto observable hoy (ya sin HarvestYield/no entra en ningún modal mecánico),
    // honesto con su bio.
    medio: ['ACUATICO'],
    // Categoría de raza de fauna (2026-09-02) — CORVENES: "ave... pescadora", ave de presa/pesca
    // pese a no ser combatible en la práctica.
    faunaCategoria: 'CORVENES',
    habilidadesRaciales: [],
  },

  {
    slug: 'manesti-azul',
    name: 'Manesti Azul',
    kind: 'PLANTILLA',
    aliases: ['manesti azul', 'manesti'],
    faction: null,
    role: 'Criatura híbrida de la costa de Playa de Ceniza Blanca, puramente ambiental',
    articulo: 'el',
    level: 1,
    levelMax: 2,
    attributes: { fuerza: 2, destreza: 3, constitucion: 2, inteligencia: 2, voluntad: 2, carisma: 1, magia: 0 },
    bio: 'Criatura de 10 a 15 cm, mitad lagartija mitad crustáceo: cuerpo redondo con la cabeza centrada en él (no plana al suelo como una lagartija), dos patas traseras de cangrejo normal y otras dos intermedias que le ayudan a sostenerse en pie, y delanteras que emulan manos de 3 dedos cuadrados hechos del mismo material que un cangrejo. Azul muy oscuro por arriba, perdiendo tono hacia abajo hasta quedar blanco en el centro del vientre.',
    personality: 'Curiosa, indiferente al entorno.',
    homeLocationSlug: 'playa-de-ceniza-blanca',
    loadout: [],
    ataqueNatural: 'No ataca.',
    temperamento: 'INOFENSIVO',
    // Puramente narrativo/ambiental a propósito (2026-09-02): sin ninguna pista de que aporte
    // material real — curiosidad de fauna, no entra en ningún modal mecánico.
    // Categoría de raza de fauna (2026-09-02) — NADANTES: "mitad lagartija mitad crustáceo" de la
    // costa, semi-acuática — sin mención de mutación/magia en su bio (a diferencia de Kirelon/
    // Nuente/Salamandra), se queda en NADANTES por hábitat en vez de MUDOS_SALVAJE.
    faunaCategoria: 'NADANTES',
    habilidadesRaciales: [],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Los Acantilados Partidos (2026-09-02, sesión "categorías de raza de fauna") — 2 animales
  // nuevos diseñados en esta misma sesión, ficha cerrada con la usuaria.
  // ══════════════════════════════════════════════════════════════════════════

  {
    slug: 'celubia-palida',
    name: 'Celubia Pálida',
    kind: 'PLANTILLA',
    aliases: ['celubia palida', 'celubia'],
    faction: null,
    role: 'Ave marina de presa que nidifica en las cornisas de Los Acantilados Partidos',
    articulo: 'la',
    level: 2,
    levelMax: 4,
    attributes: { fuerza: 7, destreza: 11, constitucion: 6, inteligencia: 3, voluntad: 5, carisma: 2, magia: 0 },
    bio: 'Ave de 90 cm a 1,20 m de envergadura total (cuerpo de 40 cm, alas largas y estrechas), plumaje blanco que en vuelo deja tras de sí una estela de espuma seca que nunca cae del todo — se disuelve en el aire como si el propio oleaje la hubiera escupido junto al ave. Pico largo y curvo, casi tan largo como la cabeza, adaptado a partir el agua en picados verticales sobre el oleaje violento de la base del acantilado. Nidifica en las cornisas más altas, casi inaccesibles, donde nadie salvo otra Celubia se atrevería a asomarse.',
    personality: 'Indiferente lejos del nido, ferozmente territorial cerca de él.',
    homeLocationSlug: 'acantilados-partidos',
    loadout: [],
    ataqueNatural: 'Picotazos rápidos en vuelo rasante, buscando los ojos de quien se acerca al nido.',
    temperamento: 'AGRESIVO',
    // Categoría de raza de fauna (2026-09-02) — CORVENES: ave marina de presa, picado vertical
    // desde altura, mismo perfil que Zense Ceniza/Cruzavientos.
    faunaCategoria: 'CORVENES',
    habilidadesRaciales: [
      { icon: '👁️', name: 'Picotazo al ojo', description: 'Busca los ojos de quien se acerca al nido, picoteando en vuelo rasante justo donde más duele.', categoria: 'ataque', preferredAttribute: 'destreza', level: 4, effects: ['ATAQUE', 'ATURDIMIENTO'] },
      { icon: '🌊', name: 'Estela de espuma', description: 'Deja tras de sí una estela de espuma seca que confunde la trayectoria de cualquier golpe dirigido a ella.', categoria: 'defensa', preferredAttribute: 'destreza', level: 12, effects: ['AGUANTE'] },
      { icon: '🪺', name: 'Defensa del nido', description: 'Se lanza en picado una y otra vez contra cualquiera que se acerque a la cornisa donde nidifica, sin tregua.', categoria: 'utilidad', preferredAttribute: 'voluntad', level: 20, effects: ['INTIMIDACION'] },
    ],
  },

  {
    slug: 'terkash',
    name: 'Terkash',
    kind: 'PLANTILLA',
    aliases: ['terkash'],
    faction: null,
    role: 'Crustáceo de las grietas profundas de Los Acantilados Partidos',
    articulo: 'el',
    level: 2,
    levelMax: 4,
    attributes: { fuerza: 9, destreza: 5, constitucion: 12, inteligencia: 1, voluntad: 3, carisma: 1, magia: 0 },
    bio: 'Crustáceo de 50 a 80 cm de largo, caparazón grisáceo veteado del mismo color que la roca partida donde vive, casi imposible de distinguir hasta que se mueve. Dos pinzas desiguales — la mayor, capaz de partir la propia roca de la grieta para ensancharla; la menor, rápida, usada para acorralar y sujetar. Vive encajado en las grietas más profundas del acantilado, donde el oleaje nunca llega del todo pero la humedad se queda atrapada. Sin salida de escape en su propia grieta, ataca sin dudarlo a cualquier presencia que le corte el paso.',
    personality: 'Territorial y sin miedo dentro de su propia grieta — no tiene adónde huir, así que no lo intenta.',
    homeLocationSlug: 'acantilados-partidos',
    loadout: [],
    ataqueNatural: 'Pinzazo con la pinza mayor, capaz de aplastar hueso; la menor sujeta mientras la mayor golpea.',
    temperamento: 'AGRESIVO',
    // Categoría de raza de fauna (2026-09-02) — QUITINOS: crustáceo acorazado (no insecto, pero
    // sin categoría propia de crustáceo — encaja mejor aquí por caparazón/pinzas que en
    // cualquier otra categoría con contenido real, decisión explícita dejada "a tu criterio").
    faunaCategoria: 'QUITINOS',
    habilidadesRaciales: [
      { icon: '🦞', name: 'Pinza mayor', description: 'Cierra la pinza capaz de partir roca sobre el punto que ha logrado acorralar con la menor.', categoria: 'ataque', preferredAttribute: 'fuerza', level: 4, effects: ['ATAQUE'] },
      { icon: '🪨', name: 'Caparazón de grieta', description: 'El caparazón, del mismo tono que la roca partida, absorbe el golpe casi tan bien como la propia grieta.', categoria: 'defensa', preferredAttribute: 'constitucion', level: 12, effects: ['AGUANTE'] },
      { icon: '✂️', name: 'Sujeción de la pinza menor', description: 'Sujeta con la pinza rápida mientras prepara el golpe final de la mayor, sin soltar presa.', categoria: 'utilidad', preferredAttribute: 'fuerza', level: 20, effects: ['CONTROL'] },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TANDA OpenCode 2026-09-27/28 — fauna nueva del Margen Silencioso (A-28 a A-31), Ciénaga
  // Troncal, Cristal Helado y La Meseta del Orden (P-01), y fauna antigua del lore que nunca llegó
  // al catálogo (P-02). Todas fuera del núcleo jugable actual salvo que se diga lo contrario —
  // mismo criterio que Cornante/Sombra de Kroj: sin `homeLocationSlug` fijo (esas regiones no
  // tienen Location sembradas todavía), con nota de región en la `condicion` de su HarvestYield.
  // ══════════════════════════════════════════════════════════════════════════

  // A-28 — Leshra: primera especie real de la familia Umbrias (Kroj).
  {
    slug: 'leshra',
    name: 'Leshra',
    kind: 'PLANTILLA',
    nucleoJugable: false,
    aliases: ['leshra'],
    faction: null,
    role: 'Ave nocturna del dosel medio y bajo de El Margen Silencioso, primera especie de la familia Umbrias',
    articulo: 'la',
    level: 2,
    levelMax: 5,
    attributes: { fuerza: 5, destreza: 13, constitucion: 5, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 },
    bio: 'Ave nocturna de 50-70 cm de cuerpo y unos 120 cm de envergadura, con alas anchas y redondeadas. El borde de sus plumas está deshilachado y rompe el aire en remolinos diminutos que no hacen ruido. Su plumaje gris ceniza atrapa la luz como la piel Nabieus: a la vista es un hueco, no un color. Tiene los ojos muy grandes. No canta ni grazna. Vive en el dosel medio y bajo de El Margen Silencioso, y se alimenta de Brozanes e insectos grandes del sotobosque.',
    personality: 'Solo ataca si alguien se acerca a su nido.',
    loadout: [],
    ataqueNatural: 'Garras en picado desde atrás, sin aviso.',
    temperamento: 'CAUTELOSO',
    medio: ['AEREO'],
    faunaCategoria: 'UMBRIAS',
    habilidadesRaciales: [
      { icon: '🌑', name: 'Picado mudo', description: 'Cae sobre la presa desde el dosel sin que se oiga.', categoria: 'ataque', preferredAttribute: 'destreza', level: 4, effects: ['ATAQUE'] },
      { icon: '🕳️', name: 'Hueco en la noche', description: 'Su plumaje no devuelve la luz — cuesta fijar un golpe sobre ella en la oscuridad.', categoria: 'defensa', preferredAttribute: 'destreza', level: 12, effects: ['AGUANTE'] },
      { icon: '🍃', name: 'Vuelo sin rastro', description: 'Se aleja entre las ramas sin que se sepa hacia dónde.', categoria: 'utilidad', preferredAttribute: 'destreza', level: 20, effects: ['AGUANTE'] },
    ],
  },

  // A-29 — Morvasa: serpiente de las charcas de Las Aguas Sordas (Margen).
  {
    slug: 'morvasa',
    name: 'Morvasa',
    kind: 'PLANTILLA',
    nucleoJugable: false,
    aliases: ['morvasa'],
    faction: null,
    role: 'Serpiente de agua de Las Aguas Sordas, El Margen Silencioso',
    articulo: 'la',
    level: 3,
    levelMax: 6,
    attributes: { fuerza: 8, destreza: 12, constitucion: 7, inteligencia: 3, voluntad: 6, carisma: 1, magia: 0 },
    bio: 'Serpiente de 180-220 cm, esbelta, de escamas verde pardo con vetas ceniza. No traga presas grandes: las paraliza con un veneno neurotóxico y las come por partes. Caza inmóvil bajo el agua de los canales de Las Aguas Sordas; la única señal de que está ahí es una onda en la superficie. Se alimenta de Brozanes, crías de ave y anfibios.',
    personality: 'Espera sin moverse hasta que la presa entra en el agua.',
    loadout: [],
    ataqueNatural: 'Mordisco desde el agua, rápido y bajo.',
    temperamento: 'CAUTELOSO',
    medio: ['ACUATICO'],
    faunaCategoria: 'ESCAMADOS',
    habilidadesRaciales: [
      { icon: '🐍', name: 'Mordida paralizante', description: 'Inyecta un veneno neurotóxico que inmoviliza a la presa un instante.', categoria: 'ataque', preferredAttribute: 'destreza', level: 4, effects: ['ATAQUE', 'CONTROL'] },
      { icon: '🌊', name: 'Bajo la superficie', description: 'Se sumerge y es difícil de alcanzar.', categoria: 'defensa', preferredAttribute: 'destreza', level: 12, effects: ['AGUANTE'] },
      { icon: '⭕', name: 'Onda quieta', description: 'Espera sin moverse hasta que la presa entra en el agua.', categoria: 'utilidad', preferredAttribute: 'voluntad', level: 20, effects: ['AGUANTE'] },
    ],
  },

  // A-30 — Brozán: la presa base del Margen (Leshra, Morvasa y Mekiosi se alimentan de él).
  {
    slug: 'brozan',
    name: 'Brozán',
    kind: 'PLANTILLA',
    nucleoJugable: false,
    aliases: ['brozan', 'brozán'],
    faction: null,
    role: 'Roedor de la hojarasca de El Margen Silencioso, la presa base de la región',
    articulo: 'el',
    level: 1,
    levelMax: 2,
    attributes: { fuerza: 3, destreza: 9, constitucion: 4, inteligencia: 3, voluntad: 4, carisma: 2, magia: 0 },
    bio: 'Roedor de 35-45 cm, de cuerpo redondeado, con pelaje gris verdoso y vetas negras que imitan la corteza podrida. Orejas pequeñas, cola corta y garras delanteras de excavar. Vive entre raíces y tocones del suelo del Margen, y se alimenta de Carnosa de Tocón, raíces y semillas. Es la presa base de la región: se lo comen la Leshra desde el aire, la Morvasa en el agua y el Mekiosi si pasa demasiado cerca.',
    personality: 'Huye siempre a la primera señal de peligro.',
    loadout: [],
    ataqueNatural: 'No ataca — huye.',
    temperamento: 'INOFENSIVO',
    medio: ['TERRESTRE'],
    faunaCategoria: 'RONDINES',
    capturablePct: 25,
    habilidadesRaciales: [
      { icon: '🕳️', name: 'Huida a la madriguera', description: 'Se escabulle a la primera señal de peligro, buscando la raíz o el tocón más cercano.', categoria: 'utilidad', preferredAttribute: 'destreza', level: 4, effects: ['AGUANTE'] },
    ],
  },

  // A-31 — Hoscón: el carroñero que camina, porque el dosel cerrado del Margen no deja ver el
  // suelo desde el aire.
  {
    slug: 'hoscon',
    name: 'Hoscón',
    kind: 'PLANTILLA',
    nucleoJugable: false,
    aliases: ['hoscon', 'hoscón'],
    faction: null,
    role: 'Carroñero terrestre de El Margen Silencioso',
    articulo: 'el',
    level: 1,
    levelMax: 2,
    attributes: { fuerza: 4, destreza: 6, constitucion: 6, inteligencia: 3, voluntad: 5, carisma: 1, magia: 0 },
    bio: 'El Zense Ceniza encuentra la carroña desde el aire, dando círculos sobre la llanura — en el Margen eso es imposible, el dosel cerrado no deja ver el suelo. El Hoscón ha resuelto el problema caminando: vuela poco y bajo, y recorre el suelo del bosque siguiendo el olor. Ave de 60-85 cm, plumaje gris pardo apagado, cuello pelado y pico ancho y plano para raspar hueso, con patas fuertes y alas cortas. Nombre de "hosco": huraño, siempre de espaldas a quien lo mira. Donde camina un Hoscón hay algo muerto cerca, y los cazadores Faerus lo siguen igual que los orcos siguen al Zense.',
    personality: 'Huraño, siempre de espaldas a quien lo mira.',
    loadout: [],
    ataqueNatural: 'No ataca — carroñero puro.',
    temperamento: 'INOFENSIVO',
    medio: ['TERRESTRE'],
    faunaCategoria: 'CORVENES',
    habilidadesRaciales: [
      { icon: '👃', name: 'Rastro de carroña', description: 'Sigue el olor de algo muerto a través del suelo del bosque cerrado.', categoria: 'utilidad', preferredAttribute: 'inteligencia', level: 4, effects: ['ANALISIS'] },
    ],
  },

  // P-01 — fauna nueva de Cristal Helado, Ciénaga Troncal y La Meseta del Orden.

  // Hielaga: la presa escasa por la que los Helsig racionan.
  {
    slug: 'hielaga',
    name: 'Hielaga',
    kind: 'PLANTILLA',
    nucleoJugable: false,
    aliases: ['hielaga'],
    faction: null,
    role: 'Bóvido de montaña de Cristal Helado, presa principal de los Helsig',
    articulo: 'la',
    level: 1,
    levelMax: 4,
    attributes: { fuerza: 6, destreza: 8, constitucion: 9, inteligencia: 3, voluntad: 5, carisma: 2, magia: 0 },
    bio: 'Bóvido de montaña pequeño, de 70-90 cm a la cruz, con doble pelaje blanco grisáceo y pezuñas anchas con almohadillas de cuerno que agarran en el hielo. Raspa el Liquen Escarcha de las rocas con los incisivos. Vive en manadas de 6 a 12 que bajan a La Veta Helada en invierno. Es la presa principal de los Helsig y la razón de que racionen: una manada tarda años en recuperarse si se caza de más.',
    personality: 'Nerviosa, huye en manada al primer indicio de peligro.',
    loadout: [],
    ataqueNatural: 'Cornada de defensa, solo acorralada.',
    temperamento: 'CAUTELOSO',
    medio: ['TERRESTRE'],
    faunaCategoria: 'BESTIONES',
    habilidadesRaciales: [
      { icon: '❄️', name: 'Pisada en el hielo', description: 'Sus pezuñas anchas agarran en el hielo donde cualquier otro resbalaría.', categoria: 'utilidad', preferredAttribute: 'destreza', level: 4, effects: ['AGUANTE'] },
    ],
  },

  // Nievón: depredador que espera enterrado en la nieve junto a los pasos de las Hielagas.
  {
    slug: 'nievon',
    name: 'Nievón',
    kind: 'PLANTILLA',
    nucleoJugable: false,
    aliases: ['nievon', 'nievón'],
    faction: null,
    role: 'Felino de emboscada de Cristal Helado',
    articulo: 'el',
    level: 5,
    levelMax: 11,
    attributes: { fuerza: 14, destreza: 13, constitucion: 12, inteligencia: 4, voluntad: 8, carisma: 1, magia: 0 },
    bio: 'Felino bajo y largo, de 150-190 cm, de pelaje blanco hueco que aísla tanto que no deja escapar calor a la superficie. Espera enterrado bajo la nieve polvo junto a los pasos de las Hielagas, a veces días enteros; respira por un orificio que deja un pequeño cráter de escarcha, la única señal de que está ahí. Los Helsig enseñan a sus críos a mirar la nieve antes que el horizonte. Es el mismo patrón que el Mekiosi del Margen, en frío.',
    personality: 'Paciente hasta el extremo — puede esperar enterrado días enteros.',
    loadout: [],
    ataqueNatural: 'Embestida desde bajo la nieve, sin aviso.',
    temperamento: 'AGRESIVO',
    medio: ['TERRESTRE'],
    faunaCategoria: 'ACECHANTES',
    habilidadesRaciales: [
      { icon: '🥶', name: 'Emboscada de nieve', description: 'Espera enterrado junto al paso hasta que la presa está encima.', categoria: 'ataque', preferredAttribute: 'fuerza', level: 4, effects: ['ATAQUE'] },
      { icon: '⚪', name: 'Pelaje hueco', description: 'Su pelaje blanco no deja escapar calor — casi invisible contra la nieve.', categoria: 'defensa', preferredAttribute: 'constitucion', level: 12, effects: ['AGUANTE'] },
      { icon: '🫁', name: 'Aliento contenido', description: 'Respira apenas por un orificio diminuto mientras espera enterrado.', categoria: 'utilidad', preferredAttribute: 'voluntad', level: 20, effects: ['AGUANTE'] },
    ],
  },

  // Escarchín: la única pesca de Cristal Helado, en El Lago Cristalice.
  {
    slug: 'escarchin',
    name: 'Escarchín',
    kind: 'PLANTILLA',
    nucleoJugable: false,
    aliases: ['escarchin', 'escarchín'],
    faction: null,
    role: 'Pez de invierno de El Lago Cristalice, Cristal Helado',
    articulo: 'el',
    level: 1,
    levelMax: 2,
    attributes: { fuerza: 2, destreza: 5, constitucion: 3, inteligencia: 1, voluntad: 2, carisma: 1, magia: 0 },
    bio: 'Pez de 20-35 cm, casi transparente, que vive bajo el hielo de El Lago Cristalice en agua a punto de congelarse. Su sangre lleva sustancias que le impiden cristalizar. Se mueve despacio y se pesca por agujeros en el hielo con sedal de tendón — la única pesca de la región, y tan importante como la mina en los años de hambre.',
    personality: 'Lento, casi inmóvil en el agua helada.',
    loadout: [],
    ataqueNatural: 'No ataca.',
    temperamento: 'INOFENSIVO',
    medio: ['ACUATICO'],
    faunaCategoria: 'NADANTES',
    habilidadesRaciales: [],
  },

  // Tragalodo: el depredador grande de la Ciénaga, que acude a la sangre del Cornante acorralado.
  {
    slug: 'tragalodo',
    name: 'Tragalodo',
    kind: 'PLANTILLA',
    nucleoJugable: false,
    aliases: ['tragalodo'],
    faction: null,
    role: 'Reptil acorazado del agua baja de Ciénaga Troncal',
    articulo: 'el',
    level: 8,
    levelMax: 14,
    attributes: { fuerza: 17, destreza: 6, constitucion: 16, inteligencia: 3, voluntad: 9, carisma: 1, magia: 0 },
    bio: 'Reptil acorazado de 3-4 m, de placas pardas cubiertas de barro seco y ojos a ras de cabeza. Caza en el agua baja, justo donde los Goshg acorralan a los Cornantes, y huele la sangre desde lejos — por eso la caza del Cornante es cosa de grupo y de prisa.',
    personality: 'Agresivo en cuanto huele sangre en el agua.',
    loadout: [],
    ataqueNatural: 'Mordisco desde el agua, con toda la fuerza del cuerpo.',
    temperamento: 'AGRESIVO',
    medio: ['ACUATICO', 'TERRESTRE'],
    faunaCategoria: 'ESCAMADOS',
    habilidadesRaciales: [
      { icon: '🦷', name: 'Mordisco de fango', description: 'Ataca desde el agua baja con todo el peso de su cuerpo acorazado.', categoria: 'ataque', preferredAttribute: 'fuerza', level: 4, effects: ['ATAQUE'] },
      { icon: '🛡️', name: 'Placas de fango', description: 'Sus placas cubiertas de barro seco absorben el golpe.', categoria: 'defensa', preferredAttribute: 'constitucion', level: 12, effects: ['AGUANTE'] },
      { icon: '🩸', name: 'Olfato de sangre', description: 'Acude a la sangre en el agua desde muy lejos.', categoria: 'utilidad', preferredAttribute: 'inteligencia', level: 20, effects: ['ANALISIS'] },
    ],
  },

  // Borbol: su golpe de cola al respirar es lo que leen los cazadores de Keseg Prisilke.
  {
    slug: 'borbol',
    name: 'Borbol',
    kind: 'PLANTILLA',
    nucleoJugable: false,
    aliases: ['borbol'],
    faction: null,
    role: 'Pez de fondo de las charcas de Ciénaga Troncal',
    articulo: 'el',
    level: 1,
    levelMax: 2,
    attributes: { fuerza: 2, destreza: 4, constitucion: 3, inteligencia: 1, voluntad: 2, carisma: 1, magia: 0 },
    bio: 'Pez de fondo de 30-50 cm que respira aire: cada pocos minutos sube a la superficie con un golpe de cola. Esa vibración es lo que leen los cazadores de Keseg Prisilke con la pierna metida en el agua — la escucha con la palma, llevada al agua. Carne grasa que se ahúma bien.',
    personality: 'Tranquilo, sube a respirar por costumbre sin alterarse.',
    loadout: [],
    ataqueNatural: 'No ataca.',
    temperamento: 'INOFENSIVO',
    medio: ['ACUATICO'],
    faunaCategoria: 'NADANTES',
    habilidadesRaciales: [],
  },

  // Zancapilote: la alarma natural del Cerco de los Pilotes contra el Tragalodo.
  {
    slug: 'zancapilote',
    name: 'Zancapilote',
    kind: 'PLANTILLA',
    nucleoJugable: false,
    aliases: ['zancapilote'],
    faction: null,
    role: 'Ave zancuda de los pilotes de Ciénaga Troncal',
    articulo: 'el',
    level: 2,
    levelMax: 5,
    attributes: { fuerza: 5, destreza: 10, constitucion: 5, inteligencia: 4, voluntad: 5, carisma: 2, magia: 0 },
    bio: 'Ave zancuda gris de 1,5 m que anida en los pilotes abandonados de El Cerco de los Pilotes y roba pescado de las redes. Los Goshg la toleran porque grazna en cuanto algo grande se mueve bajo el agua: es su alarma natural contra el Tragalodo.',
    personality: 'Nerviosa, grazna alto ante cualquier movimiento grande en el agua.',
    loadout: [],
    ataqueNatural: 'Picotazo defensivo, rara vez.',
    temperamento: 'CAUTELOSO',
    medio: ['TERRESTRE', 'AEREO'],
    faunaCategoria: 'ZANCUDOS',
    habilidadesRaciales: [
      { icon: '📯', name: 'Alarma del agua', description: 'Grazna en cuanto algo grande se mueve bajo el agua.', categoria: 'utilidad', preferredAttribute: 'voluntad', level: 4, effects: ['ANALISIS'] },
    ],
  },

  // Vreskal: primera especie de la familia Ordenados (Goirme), en La Meseta del Orden.
  {
    slug: 'vreskal',
    name: 'Vreskal',
    kind: 'PLANTILLA',
    nucleoJugable: false,
    aliases: ['vreskal'],
    faction: null,
    role: 'Lagarto de las grietas de La Meseta del Orden, primera especie de la familia Ordenados',
    articulo: 'el',
    level: 1,
    levelMax: 3,
    attributes: { fuerza: 3, destreza: 7, constitucion: 4, inteligencia: 2, voluntad: 3, carisma: 1, magia: 0 },
    bio: 'Lagarto de palmo y medio con el cuerpo cubierto de placas hexagonales idénticas, que se añaden una a una a medida que crece siguiendo siempre el mismo patrón. Vive en las grietas rectas de la Meseta y en las juntas de las murallas de las ciudades-fortaleza. Se mueve en líneas rectas y gira en ángulos fijos, nunca en curva. Come insectos y la costra mineral de la Hierba del Hierro. Los Goirntes lo tienen por buena señal: donde hay Vreskales, dicen, la piedra está bien puesta. Matar uno en una muralla está mal visto — es la firma de Goirme en la fauna, igual que la simetría lo es en la piedra.',
    personality: 'Nunca se mueve en curva, solo en líneas rectas y giros de ángulo fijo.',
    loadout: [],
    ataqueNatural: 'No ataca.',
    temperamento: 'INOFENSIVO',
    medio: ['TERRESTRE'],
    faunaCategoria: 'ORDENADOS',
    habilidadesRaciales: [],
  },

  // P-02 — fauna antigua del lore que nunca llegó al catálogo técnico. Hetris, Mekiosi y Vistue ya
  // se nombran en clases.md como las formas de Cambiaformas del Druida (Kiri usa Hetris) — mismo
  // slug que su HarvestYield/homeLocationSlug de referencia.

  // Sombras de Kroj: fauna nocturna en grupo de El Margen Silencioso.
  {
    slug: 'sombra-de-kroj',
    name: 'Sombra de Kroj',
    kind: 'PLANTILLA',
    nucleoJugable: false,
    aliases: ['sombra de kroj', 'sombras de kroj'],
    faction: null,
    role: 'Ave nocturna que devuelve el sonido ajeno como eco, El Margen Silencioso',
    articulo: 'la',
    level: 3,
    levelMax: 8,
    attributes: { fuerza: 6, destreza: 11, constitucion: 6, inteligencia: 4, voluntad: 5, carisma: 1, magia: 0 },
    bio: 'Criaturas voladoras nocturnas medianas, de plumaje gris ceniza y vuelo silencioso. Cazan en grupo. No imitan voces mortales: las devuelven, acumulando el sonido de pasos y respiración ajenos en vez de dejarlo escapar, como hace todo en su territorio, y lo sueltan de vuelta distorsionado como un eco retrasado, para atraer viajeros hacia trampas o precipicios. No tienen cuerdas vocales complejas porque no las necesitan.',
    personality: 'Caza en grupo, coordinada, aprovechando la confusión que genera.',
    loadout: [],
    ataqueNatural: 'Ataque en grupo tras desorientar con el eco.',
    temperamento: 'AGRESIVO',
    medio: ['AEREO'],
    faunaCategoria: 'UMBRIAS',
    habilidadesRaciales: [
      { icon: '🔊', name: 'Eco devuelto', description: 'Devuelve el sonido de pasos y voces distorsionado, desorientando a quien lo oye.', categoria: 'ataque', preferredAttribute: 'inteligencia', level: 4, effects: ['ATAQUE', 'ATURDIMIENTO'] },
      { icon: '🌑', name: 'Vuelo silencioso', description: 'No hace ningún ruido al volar ni al cazar.', categoria: 'defensa', preferredAttribute: 'destreza', level: 12, effects: ['AGUANTE'] },
      { icon: '👥', name: 'Caza en grupo', description: 'Coordina el ataque con el resto de la bandada.', categoria: 'utilidad', preferredAttribute: 'voluntad', level: 20, effects: ['MULTIPLE'] },
    ],
  },

  // Hetris: felino-simio arbóreo del dosel alto (forma de Cambiaformas de Kiri).
  {
    slug: 'hetris',
    name: 'Hetris',
    kind: 'PLANTILLA',
    nucleoJugable: false,
    aliases: ['hetris'],
    faction: null,
    role: 'Felino-simio arbóreo del dosel alto de El Margen Silencioso',
    articulo: 'el',
    level: 4,
    levelMax: 9,
    attributes: { fuerza: 10, destreza: 15, constitucion: 8, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 },
    bio: 'Felino-simio arbóreo de 80-120 cm, cuerpo esbelto y extremidades largas con garras curvas, cola prensil casi tan larga como el cuerpo, pelaje corto gris verdoso que se funde con la corteza húmeda del Margen. Vive en el dosel alto, rara vez baja al suelo — caza acechando desde las ramas y dejándose caer sobre la presa antes de que perciba el peligro; el golpe inicial casi siempre decide la caza. Solitario y territorial, evita a los Ferikes (que sí cazan en el suelo) por instinto más que por miedo.',
    personality: 'Solitario y territorial, rara vez baja al suelo.',
    loadout: [],
    ataqueNatural: 'Se deja caer desde el dosel sobre la presa.',
    temperamento: 'AGRESIVO',
    medio: ['TERRESTRE'],
    faunaCategoria: 'ACECHANTES',
    habilidadesRaciales: [
      { icon: '🌳', name: 'Caída del dosel', description: 'Se deja caer desde las ramas altas sobre la presa antes de que perciba el peligro.', categoria: 'ataque', preferredAttribute: 'destreza', level: 4, effects: ['ATAQUE'] },
      { icon: '🐾', name: 'Corteza viva', description: 'Su pelaje se funde con la corteza húmeda del Margen.', categoria: 'defensa', preferredAttribute: 'destreza', level: 12, effects: ['AGUANTE'] },
      { icon: '🐒', name: 'Cola prensil', description: 'Se sujeta y desplaza por el dosel con una agilidad que ningún depredador de suelo iguala.', categoria: 'utilidad', preferredAttribute: 'destreza', level: 20, effects: ['AGUANTE'] },
    ],
  },

  // Mekiosi: bestia inmóvil del suelo del Margen (referencia directa del Nievón, en frío).
  {
    slug: 'mekiosi',
    name: 'Mekiosi',
    kind: 'PLANTILLA',
    nucleoJugable: false,
    aliases: ['mekiosi'],
    faction: null,
    role: 'Bestia de emboscada del suelo de El Margen Silencioso',
    articulo: 'el',
    level: 7,
    levelMax: 13,
    attributes: { fuerza: 16, destreza: 5, constitucion: 15, inteligencia: 3, voluntad: 7, carisma: 1, magia: 0 },
    bio: 'Bestia de 200-250 cm, complexión pesada y musculosa, piel gruesa de tonos pardos y verdes que imita el musgo y la corteza podrida del suelo del Margen, patas cortas y robustas, cabeza ancha con mandíbula capaz de partir hueso. Aguanta inmóvil horas, casi como una raíz cubierta de musgo, esperando a que una presa se acerque lo suficiente antes de cargar con todo su peso en una sola embestida. Solitario, territorio amplio, no necesita manada.',
    personality: 'Aguanta inmóvil horas antes de cargar de una sola embestida.',
    loadout: [],
    ataqueNatural: 'Embestida con todo el peso del cuerpo, tras esperar inmóvil.',
    temperamento: 'AGRESIVO',
    medio: ['TERRESTRE'],
    faunaCategoria: 'ACECHANTES',
    habilidadesRaciales: [
      { icon: '💥', name: 'Embestida de musgo', description: 'Carga con todo su peso tras esperar inmóvil durante horas.', categoria: 'ataque', preferredAttribute: 'fuerza', level: 4, effects: ['ATAQUE'] },
      { icon: '🪨', name: 'Piel de corteza', description: 'Su piel imita el musgo y la corteza podrida — casi invisible inmóvil.', categoria: 'defensa', preferredAttribute: 'constitucion', level: 12, effects: ['AGUANTE'] },
      { icon: '🦴', name: 'Mandíbula que parte hueso', description: 'Su mordisco es capaz de partir hueso de un solo golpe.', categoria: 'utilidad', preferredAttribute: 'fuerza', level: 20, effects: ['ATAQUE'] },
    ],
  },

  // Vistue: corredor de manada del Margen que caza por agotamiento.
  {
    slug: 'vistue',
    name: 'Vistue',
    kind: 'PLANTILLA',
    nucleoJugable: false,
    aliases: ['vistue'],
    faction: null,
    role: 'Corredor de manada de El Margen Silencioso',
    articulo: 'el',
    level: 3,
    levelMax: 7,
    attributes: { fuerza: 8, destreza: 13, constitucion: 8, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 },
    bio: 'Corredor de manada de 130-170 cm, cuerpo alargado y patas largas hechas para la carrera sostenida, pelaje corto oscuro con una franja más clara a lo largo del lomo, hocico estrecho, orejas grandes que regulan su temperatura en carreras largas. Caza en manadas de 5 a 8, no por fuerza bruta sino por resistencia — persiguen a una presa durante horas, turnándose en cabeza, hasta que esta se rinde de puro agotamiento. Poco peligroso en solitario, mucho en manada.',
    personality: 'Poco peligroso solo, implacable en manada.',
    loadout: [],
    ataqueNatural: 'Mordisco tras una persecución larga, en relevos de manada.',
    temperamento: 'AGRESIVO',
    medio: ['TERRESTRE'],
    faunaCategoria: 'GUELISES',
    habilidadesRaciales: [
      { icon: '🏃', name: 'Relevo de caza', description: 'Se turna con la manada para perseguir a la presa durante horas sin cansarse.', categoria: 'ataque', preferredAttribute: 'destreza', level: 4, effects: ['ATAQUE'] },
      { icon: '👂', name: 'Orejas de largo aliento', description: 'Regula su temperatura en carreras largas mejor que cualquier presa.', categoria: 'utilidad', preferredAttribute: 'constitucion', level: 12, effects: ['AGUANTE'] },
      { icon: '🐺', name: 'Caza en manada', description: 'Coordina con el resto de la manada para agotar a la presa por turnos.', categoria: 'utilidad', preferredAttribute: 'voluntad', level: 20, effects: ['MULTIPLE'] },
    ],
  },

  // Cornante: alimento principal del Clan Goshg en Ciénaga Troncal.
  {
    slug: 'cornante',
    name: 'Cornante',
    kind: 'PLANTILLA',
    nucleoJugable: false,
    aliases: ['cornante', 'cornantes'],
    faction: null,
    role: 'Bestia de cornamenta ancha de Ciénaga Troncal, alimento principal del Clan Goshg',
    articulo: 'el',
    level: 3,
    levelMax: 8,
    attributes: { fuerza: 13, destreza: 6, constitucion: 13, inteligencia: 2, voluntad: 6, carisma: 1, magia: 0 },
    bio: 'Criatura de cuatro patas, corpulenta y de gran tamaño, con cornamenta ancha y ramificada. Es la principal fuente de alimento de los orcos en Ciénaga Troncal. Cazar un Cornante es trabajo de grupo y de paciencia: se le acorrala hacia el agua baja, donde su propio peso lo hunde — y hay que hacerlo rápido, porque un Cornante hundido atrae Tragalodos.',
    personality: 'Cauteloso pero pesado — su propio tamaño lo condena si lo acorralan hacia el agua.',
    loadout: [],
    ataqueNatural: 'Cornada al ser acorralado.',
    temperamento: 'CAUTELOSO',
    medio: ['TERRESTRE'],
    faunaCategoria: 'BESTIONES',
    habilidadesRaciales: [
      { icon: '🦌', name: 'Cornada de acorralado', description: 'Ataca con su cornamenta ancha cuando ya no tiene salida.', categoria: 'ataque', preferredAttribute: 'fuerza', level: 4, effects: ['ATAQUE'] },
      { icon: '🐘', name: 'Peso propio', description: 'Su propio tamaño lo hunde en el agua baja de la ciénaga.', categoria: 'defensa', preferredAttribute: 'constitucion', level: 12, effects: ['AGUANTE'] },
    ],
  },
];

export const npcs: NpcInput[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // REGIÓN: LAS LLANURAS DEL VIENTO ROJO
  // ══════════════════════════════════════════════════════════════════════════

  // Gistera Koh — encuentro guionizado del primer turno de la partida (ver turnResolution.ts,
  // hook del primer turno). PRINCIPAL: personaje con nombre e historia propia, no un arquetipo
  // repetible. No es objetivo de combate ni de saqueo — el loadout es solo lo que lleva encima
  // para huir, contexto narrativo si el jugador la registra. Historia completa reescrita
  // 2026-08-05 (ver npcs.md #13 para el detalle íntegro): es la hija adoptiva del artesano Uhuld
  // Koh, ejecutado por los suyos a sueldo Goirnte por tramar liberar a los orcos del yugo de la
  // casta de Ketg. Auditoría de contenido de Enciclopedia (2026-09-15): la `bio` de abajo SÍ
  // filtraba directamente quién la mató, que el asesino la sigue en secreto, y el mecanismo exacto
  // de su confianza en Gorhorn — recortada a lo que Gistera contaría de sí misma sin desvelar esos
  // giros; npcs.md #13 sigue teniendo el detalle íntegro para quien edite el catálogo.
  {
    slug: 'gistera-koh',
    name: 'Gistera Koh',
    kind: 'PRINCIPAL',
    aliases: ['gistera koh', 'gistera'],
    faction: null,
    genero: 'F',
    role: 'Hija adoptiva de un artesano Serhu ejecutado por los suyos, huye del guerrero que lo mató',
    level: 1,
    attributes: { fuerza: 6, destreza: 8, constitucion: 6, inteligencia: 6, voluntad: 10, carisma: 6, magia: 4 },
    bio: 'Orca de origen desconocido: un artesano Serhu, Uhuld Koh, la encontró desorientada en el desierto a los 10 años y la crió como propia, dándole su nombre. Uhuld murió hace poco, en circunstancias que ella no cuenta a nadie — el clan no le dio rito ni tumba. Gistera huyó esa misma noche y no ha dejado de mirar atrás desde entonces.',
    personality: 'Aguda y pragmática, mide cada palabra antes de gastarla — no tiene tiempo ni margen para el orgullo que se permiten los guerreros con clan.',
    homeLocationSlug: 'hondonada-del-eco',
    raza: 'orcos',
    // Clase/especialización asignada (2026-08-24, Grupo 3 § Sistema de clases) — Supervivencia
    // encaja con una fugitiva sola, sin manada ni compañero, que sobrevive por su cuenta.
    clase: 'CAZADOR',
    especializacion: 'SUPERVIVENCIA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 15,
    reclutablePct: 55,
    // Persuasión (2026-08-25) — "aguda y pragmática, mide cada palabra", resiste con la cabeza,
    // no con orgullo ni fuerza.
    atributoResistencia: 'inteligencia',
    capturablePct: 5,
    cortejablePct: 25,
    loadout: [
      { itemSlug: 'cuchillo-corto' },
      { itemSlug: 'racion-viaje', cantidad: 1 },
      { itemSlug: 'odre-agua' },
    ],
  },

  {
    slug: 'orco-expulsado',
    name: 'Guerrero orco expulsado',
    kind: 'PLANTILLA',
    // 'orco expulsado' añadido (auditoría de catálogo fauna/npcs, 2026-08-13): único NPC de su
    // familia de arquetipos itinerantes sin ninguna forma corta — 'guerrero orco expulsado' exige
    // la frase completa como substring literal (matchNpcAliases, npcScene.ts), y "el orco
    // expulsado" (sin "guerrero") es la forma más natural de referirse a él en juego.
    aliases: ['orco expulsado'],
    faction: null,
    genero: 'M', // Bio explícita en masculino ("Orco corpulento") — misma auditoría de género, 2026-08-08.
    role: 'Guerrero sin clan, separado de los suyos',
    articulo: 'el',
    level: 1,
    levelMax: 2,
    attributes: { fuerza: 8, destreza: 6, constitucion: 11, inteligencia: 4, voluntad: 11, carisma: 4, magia: 0 },
    bio: 'Orco corpulento de piel beige y parda, curtida como la propia estepa de las Llanuras — cualquier pintura o marca de clan que llevara se ha desdibujado bajo meses de polvo y mala vida. Guerrero sin clan visible, separado de los suyos por la guerra o la desgracia — arquetipo instanciable, no un individuo con historia propia.',
    personality: 'Desconfiado, a la defensiva, impredecible según cómo se le aborde.',
    raza: 'orcos',
    // Especialista (2026-08-24, Grupo 3 § Sistema de clases) — "arquetipo instanciable, no un
    // individuo con historia propia", coherente con el generalista de Guerrero.
    clase: 'GUERRERO',
    especializacion: 'ESPECIALISTA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 20,
    // Persuasión (2026-08-25) — "desconfiado, a la defensiva", resiste con pura voluntad recelosa.
    atributoResistencia: 'voluntad',
    capturablePct: 40,
    loadout: [
      { itemSlug: 'maza-orca', notas: 'Mellada' },
      { itemSlug: 'racion-carne', cantidad: 1, notas: 'Pasada' },
      { itemSlug: 'botas-de-estepa' }
    ],
  },

  {
    slug: 'cazadora-serhu',
    name: 'Cazadora Serhu',
    kind: 'PLANTILLA',
    aliases: ['cazadora serhu'],
    faction: 'Clan Serhu',
    role: 'Joven cazadora en formación del Clan Serhu',
    level: 2,
    levelMax: 6,
    attributes: { fuerza: 6, destreza: 12, constitucion: 6, inteligencia: 9, voluntad: 7, carisma: 8, magia: 0 },
    bio: 'Orca joven del Clan Serhu, todavía sin el volumen ni las cicatrices de un guerrero veterano — piel beige y parda como el resto del clan, colmillos aún cortos, marca de clan tatuada y reciente en el antebrazo. Sale a cazar o vigilar los alrededores del campamento.',
    personality: 'Curioso, algo fanfarrón, todavía sin la reserva de los guerreros veteranos.',
    homeLocationSlug: 'campamento-serhu',
    raza: 'orcos',
    // "Cazadora" corregido a la clase real (2026-08-24, Grupo 3 § Sistema de clases — typo de
    // género que ya rompía cualquier filtro exacto por 'Cazador'). Instintivo: joven, "algo
    // fanfarrón", todavía sin la reserva de un veterano — encaja con la rama de iniciativa/
    // velocidad de la clase.
    clase: 'CAZADOR',
    especializacion: 'INSTINTIVO',
    temperamento: 'CAUTELOSO',
    comerciablePct: 20,
    reclutablePct: 25,
    // Persuasión (2026-08-25) — "curiosa, algo fanfarrona", cede por carisma/bravata, no por lógica.
    atributoResistencia: 'carisma',
    capturablePct: 20,
    cortejablePct: 15,
    loadout: [
      { itemSlug: 'lanza-corta-caza' },
      { itemSlug: 'racion-viaje', cantidad: 2 },
      { itemSlug: 'guantes-piel-corredor' },
      { itemSlug: 'bandolera-de-caza' },
      // silbato-hueso-caza (auditoría de items sin uso, 2026-08-24): huérfano en ItemCatalog
      // desde antes de esta sesión — "señales de caza Serhu" encaja literal con una cazadora
      // Serhu de verdad saliendo a cazar, no con un NPC cualquiera.
      { itemSlug: 'silbato-hueso-caza' },
    ],
  },

  {
    slug: 'torgash-ketg',
    name: 'Torgash Ketg',
    kind: 'PRINCIPAL',
    aliases: ['Torgash Ketg'],
    faction: 'Clan Serhu',
    genero: 'M', // Bio explícita en masculino ("Orco del Clan Serhu") — misma auditoría de género, 2026-08-08.
    role: "Kort'ikar del Clan Serhu",
    level: 20,
    attributes: { fuerza: 26, destreza: 14, constitucion: 32, inteligencia: 12, voluntad: 22, carisma: 12, magia: 8 },
    bio: "Orco del Clan Serhu, de las Llanuras del Viento Rojo — piel en los tonos beige y arcilla propios de los orcos del desierto, corpulento incluso para los suyos, colmillos intactos de quien ha sobrevivido más duelos que la mayoría. Pelo negro ya veteado de gris, recogido en trenzas cortas con cuentas de hueso que marcan sus años de guerra. Veterano de las escaramuzas fronterizas; ascendió a Kort'ikar cuando su predecesor murió en el frente. Busca unificar los clanes para retirar a su pueblo de la guerra de la Concordia.",
    personality: 'Grave, económico con las palabras, pragmático hasta rozar la herejía cultural (prefiere pactar a duelar). Detesta a la Concordia en silencio.',
    homeLocationSlug: 'campamento-serhu',
    raza: 'orcos',
    // Guardián (2026-08-24, Grupo 3 § Sistema de clases) — Kort'ikar que lidera en la guerra y
    // "busca unificar los clanes", el tanque social más que el bruiser rabioso.
    clase: 'GUERRERO',
    especializacion: 'GUARDIAN',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 0,
    // Persuasión (2026-08-25) — "grave, pragmático... prefiere pactar a duelar", resiste con pura
    // voluntad de líder, casi nunca cede por persuasión sola (reclutablePct 5).
    atributoResistencia: 'voluntad',
    capturablePct: 0,
    loadout: [
      { itemSlug: 'hacha-guerra-orca', notas: 'Con la marca del Clan Serhu grabada en la cabeza' },
      { itemSlug: 'lanza-hueso-gargantua' },
      { itemSlug: 'amuleto-hueso', notas: 'Colmillos de corredor de su primera cacería' },
      // marca-de-clan → renombrado a "Cinturón de cargador" (pasada de objetos narrativos sin
      // uso, 2026-09-02) — el propio Kort'ikar del Clan Serhu es el portador natural del símbolo
      // tallado de su clan, ahora en la hebilla de un cinturón con función real (+4 slots).
      { itemSlug: 'marca-de-clan', notas: 'El símbolo tallado del Clan Serhu en la hebilla, como corresponde a su Kort\'ikar' },
      { itemSlug: 'racion-viaje', cantidad: 3 },
      { itemSlug: 'ascuas-raiz-fuego', cantidad: 1 },
      { itemSlug: 'odre-agua' },
    ],
  },
  {
    slug: 'guerrero-serhu',
    name: 'Guerrero serhu',
    kind: 'PLANTILLA',
    aliases: ['guerrero serhu'],
    faction: 'Clan Serhu',
    genero: 'M',
    role: 'Guerrero del Clan Serhu que patrullan las llanuras del Viento Rojo.',
    articulo: 'el',
    level: 4,
    levelMax: 10,
    attributes: { fuerza: 12, destreza: 8, constitucion: 11, inteligencia: 5, voluntad: 11, carisma: 4, magia: 0},
    bio: 'Orco del Clan Serhu — piel beige y arcilla curtida por el sol de las llanuras, trenzas cortas sujetas con cuentas de hueso. Patrulla el territorio del clan en cuadrillas; entra en combate sin dudar en cuanto detecta una amenaza real.',
    personality: '',
    raza: 'orcos',
    clase: 'GUERRERO',
    especializacion: 'BERSERKER',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 5,
    atributoResistencia: 'voluntad',
    capturablePct: 10,
    loadout: [
    ],
  },
  {
    slug: 'guerrera-serhu',
    name: 'Guerrera serhu',
    kind: 'PLANTILLA',
    aliases: ['guerrera serhu'],
    faction: 'Clan Serhu',
    genero: 'F',
    role: 'Guerrera del Clan Serhu que patrullan las llanuras del Viento Rojo.',
    articulo: 'la',
    level: 6,
    levelMax: 12,
    attributes: { fuerza: 14, destreza: 9, constitucion: 9, inteligencia: 8, voluntad: 11, carisma: 6, magia: 0 },
    bio: 'Orca del Clan Serhu — piel beige y arcilla curtida por el sol de las llanuras, trenzas cortas sujetas con cuentas de hueso. Patrulla el territorio del clan en cuadrillas; entra en combate sin dudar en cuanto detecta una amenaza real.',
    personality: '',
    raza: 'orcos',
    clase: 'GUERRERO',
    especializacion: 'BERSERKER',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 5,
    atributoResistencia: 'voluntad',
    capturablePct: 10,
    loadout: [
    ],
  },
  {
    slug: 'guardia-serhu',
    name: 'Guardia serhu',
    kind: 'PLANTILLA',
    aliases: ['guardia serhu'],
    faction: 'Clan Serhu',
    genero: 'M',
    role: 'Guardia de las murallas y del campamento del Clan Serhu - Karot Veku.',
    articulo: 'el',
    level: 16,
    levelMax: 18,
    attributes: { fuerza: 16, destreza: 12, constitucion: 22, inteligencia: 6, voluntad: 17, carisma: 10, magia: 0 },
    bio: 'Orco del Clan Serhu — corpulento y de pie firme, apostado en las murallas de Karot Veku o en la entrada del campamento. Vigila más de lo que habla; no deja pasar a nadie sin reconocerlo antes.',
    personality: '',
    raza: 'orcos',
    clase: 'GUERRERO',
    especializacion: 'GUARDIAN',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 0,
    atributoResistencia: 'voluntad',
    capturablePct: 0,
    loadout: [
    ],
  },
  {
    slug: 'ufag-ketg',
    name: 'Ufag Ketg',
    kind: 'PLANTILLA',
    aliases: ['ufag ketg'],
    faction: 'Clan Serhu',
    genero: 'F',
    role: 'Mesok\'ikar del Clan Serhu, unico chamán de la tribu y guía espiritual de los suyos.',
    articulo: 'la',
    level: 18,
    attributes: { fuerza: 16, destreza: 18, constitucion: 18, inteligencia: 16, voluntad: 14, carisma: 10, magia: 22 },
    bio: "Orca del Clan Serhu — pintura ritual en tonos ocre marcándole el rostro y los brazos, tótems de hueso y pluma trenzados en el pelo. Única Mesok'ikar del clan; media entre los vivos, los espíritus y las Gargantúas que guían la migración.",
    personality: '',
    raza: 'orcos',
    clase: 'CHAMAN',
    especializacion: 'OPRESOR',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 0,
    atributoResistencia: 'voluntad',
    capturablePct: 0,
    loadout: [
    ],
  },
  {
    slug: 'gisot-ketg',
    name: 'Gisot Ketg',
    kind: 'PLANTILLA',
    aliases: ['gisot ketg'],
    faction: 'Clan Serhu',
    genero: 'M',
    role: 'Mano derecha del Kort\'ikar del Clan Serhu, encargada de la seguridad y la vigilancia de los suyos.',
    articulo: 'el',
    level: 18,
    attributes: { fuerza: 24, destreza: 14, constitucion: 18, inteligencia: 6, voluntad: 20, carisma: 10, magia: 0 },
    bio: 'Orco del Clan Serhu — masivo incluso para su raza, cicatrices de duelos visibles en los antebrazos. Responde directamente ante Torgash Ketg; se ocupa de la seguridad del campamento y de que las patrullas cumplan su ronda.',
    personality: '',
    raza: 'orcos',
    clase: 'GUERRERO',
    especializacion: 'BERSERKER',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 0,
    atributoResistencia: 'voluntad',
    capturablePct: 0,
    loadout: [
    ],
  },
  {
    slug: 'jorer-susig',
    name: 'Jorer Susig',
    kind: 'PLANTILLA',
    aliases: ['jorer susig'],
    faction: 'Clan Serhu',
    genero: 'M',
    role: 'Uno de los guardias de las murallas que perdio a su padre en manos de Torgash Ketg y acabo sometido.',
    articulo: 'el',
    level: 12,
    attributes: { fuerza: 12, destreza: 12, constitucion: 14, inteligencia: 10, voluntad: 18, carisma: 12, magia: 0 },
    bio: 'Guerrero sometido por los Ketg, su familia son de una larga sucesion de antiguos guerrerores que en el pasad eran fieles a los Maktor.Hermano de Tirag Susig',
    personality: '',
    raza: 'orcos',
    clase: 'GUERRERO',
    especializacion: 'LANCERO',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 20,
    atributoResistencia: 'carisma',
    capturablePct: 0,
    loadout: [
    ],
  },
  {
    // `kind` corregido de PLANTILLA a PRINCIPAL (auditoría de lore 2026-09-13, C9) — Tirag Susig
    // es un personaje con nombre propio (hermana de Jorer Susig, compañera con nombre propio
    // Gisoki), no una plantilla genérica de "cazadora Serhu cualquiera" — mismo criterio que
    // Ulkha Ketg/Torgash Ketg, las otras fichas de nombre propio del Clan Serhu.
    slug: 'tirag-susig',
    name: 'Tirag Susig',
    kind: 'PRINCIPAL',
    aliases: ['tirag susig'],
    faction: 'Clan Serhu',
    genero: 'F',
    role: 'Cazadora y exploradora para el clan Serhu.',
    articulo: 'la',
    level: 12,
    attributes: { fuerza: 12, destreza: 12, constitucion: 14, inteligencia: 10, voluntad: 18, carisma: 12, magia: 0 },
    // Erratas corregidas (C9): "sometido" → "sometida" (concuerda con Tirag, femenino),
    // "guerrerores"/"pasad" → "guerreros"/"pasado".
    bio: 'Cazadora sometida por los Ketg, su familia es de una larga sucesión de antiguos guerreros que en el pasado eran fieles a los Maktor. Hermana de Jorer Susig. Acompañada siempre por su compañero Gisoki, un aullador rojo que tiene una mecha blanca de pelo en la cabeza que lo caracteriza.',
    personality: 'Reservada y desconfiada con los desconocidos, leal sin condiciones con quien ya se ha ganado su respeto — igual que Gisoki, no suelta a nadie una vez decide protegerlo.',
    raza: 'orcos',
    clase: 'CAZADOR',
    especializacion: 'DOMADOR',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 20,
    atributoResistencia: 'carisma',
    capturablePct: 0,
    loadout: [
    ],
  },
  {
    // Compañero de fauna con nombre propio (auditoría de lore 2026-09-13, hallazgo C10) — hasta
    // ahora solo mencionado en la bio de Tirag Susig. Mismo criterio que Gogorath/Ulkha Ketg más
    // arriba: shape de fauna normal (`aullador-rojo` como especie base) con `kind: 'PRINCIPAL'`,
    // protegido, y `companionOfNpcSlug` vinculándolo a su dueña.
    slug: 'gisoki',
    name: 'Gisoki',
    kind: 'PRINCIPAL',
    aliases: ['gisoki'],
    faction: 'Clan Serhu',
    genero: 'M',
    role: 'Aullador rojo, compañero de la cazadora Tirag Susig',
    articulo: 'el',
    level: 10,
    attributes: { fuerza: 8, destreza: 15, constitucion: 9, inteligencia: 9, voluntad: 9, carisma: 6, magia: 0 },
    bio: 'Aullador rojo con una mecha blanca de pelo en la cabeza que lo distingue del resto de su especie. Domesticado por Tirag Susig, la sigue de cerca en cada partida de caza — donde una jauría entera huiría de un orco adulto, él se queda, entrenado para dar la cara junto a ella.',
    personality: 'Alerta y receloso con cualquiera que no sea Tirag, se pega a sus talones sin que se lo pida.',
    homeLocationSlug: 'campamento-serhu',
    companionOfNpcSlug: 'tirag-susig',
    loadout: [],
    ataqueNatural: 'Clava sus colmillos curvos y amarillentos en los puntos débiles, exagerados para su tamaño.',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 0,
    domesticablePct: 0,
    capturablePct: 0,
    faunaCategoria: 'GUELISES',
    habilidadesRaciales: [
      { icon: '🐺', name: 'Posicion defensiva', description: 'Adopta una posición defensiva al enfrentar a sus enemigos y a la minima oportunidad contra ataca', categoria: 'defensa', preferredAttribute: 'destreza', level: 4, effects: ['AGUANTE'] },
      { icon: '🔄', name: 'Filos centella', description: 'Se coloca en tu punto ciego y busca tus puntos débiles para atacar rapidamente con sus pronunciados colmillos.', categoria: 'ataque', preferredAttribute: 'destreza', level: 12, effects: ['ATAQUE'] },
      { icon: '🦴', name: 'Adiestrado para Quedarse', description: 'A diferencia de su especie, nunca huye solo — entrenado para no abandonar a Tirag pase lo que pase.', categoria: 'utilidad', preferredAttribute: 'voluntad', level: 20, effects: ['AGUANTE'] },
    ],
  },

  // "Trabajador de Reino" (2026-08-31) — los 2 primeros Maestros de prueba (Herrero/Curtidor),
  // siguiendo la regla generativa de areas.md ("por cada oficio, un Maestro único PRINCIPAL,
  // protegido/no capturable, que enseña el oficio"). `capturablePct`/`reclutablePct: 0` a
  // propósito — no son fauna cazable ni NPC persuadible/reclutable como Companion, su única
  // interacción mecánica es enseñar su oficio (ver `POST /saves/:id/npc/:slug/aprender-oficio`).
  // El resto de los 11 oficios queda para siguientes pasadas.
  {
    slug: 'maestro-herrero-serhu',
    name: 'Maestro Herrero Serhu',
    kind: 'PRINCIPAL',
    aliases: ['maestro herrero', 'el herrero de Karot Veku'],
    faction: 'Clan Serhu',
    genero: 'M',
    role: 'Maestro Herrero del Clan Serhu',
    level: 5,
    attributes: { fuerza: 18, destreza: 10, constitucion: 16, inteligencia: 10, voluntad: 12, carisma: 9, magia: 2 },
    bio: 'Orco corpulento de manos cubiertas de quemaduras viejas ya curtidas, cejas chamuscadas por décadas frente a la fragua. Funde la mena que trae el resto del clan en lingotes reales — sin él, Karot Veku no tendría hachas de guerra propias, solo las heredadas.',
    personality: 'Paciente con quien de verdad quiere aprender, cortante con quien solo busca un favor rápido.',
    homeLocationSlug: 'campamento-serhu-interior',
    teachesProfession: 'herrero-orcos-llanuras',
    interactionTypes: ['MAESTRO_OFICIO'],
    raza: 'orcos',
    clase: 'GUERRERO',
    especializacion: 'ESPECIALISTA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'fuerza',
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'herrero-serhu',
    name: 'Herrero Serhu',
    kind: 'PRINCIPAL',
    aliases: ['herrero serhu'],
    faction: 'Clan Serhu',
    genero: 'M',
    role: 'Herrero del Clan Serhu',
    level: 1,
    attributes: { fuerza: 8, destreza: 6, constitucion: 6, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 },
    bio: 'Orco corpulento de manos cubiertas de quemaduras viejas ya curtidas, cejas chamuscadas por décadas frente a la fragua. Aprendices del maestro herrero.',
    personality: 'Pocas palabras, su funcion es trabajar y ayudar al maestro herrero.',
    homeLocationSlug: 'campamento-serhu-interior',
    raza: 'orcos',
    clase: 'GUERRERO',
    especializacion: 'ESPECIALISTA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 5,
    atributoResistencia: 'fuerza',
    capturablePct: 20,
    loadout: [],
  },
  {
    slug: 'herrera-serhu',
    name: 'Herrera Serhu',
    kind: 'PRINCIPAL',
    aliases: ['herrera serhu'],
    faction: 'Clan Serhu',
    genero: 'F',
    role: 'Herrera del Clan Serhu',
    level: 1,
    attributes: { fuerza: 9, destreza: 6, constitucion: 6, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 },
    bio: 'Orca corpulenta de manos cubiertas de quemaduras viejas ya curtidas, cejas chamuscadas por décadas frente a la fragua. Aprendices del maestro herrero.',
    personality: 'Pocas palabras, su funcion es trabajar y ayudar al maestro herrero.',
    homeLocationSlug: 'campamento-serhu-interior',
    raza: 'orcos',
    clase: 'GUERRERO',
    especializacion: 'ESPECIALISTA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 5,
    atributoResistencia: 'fuerza',
    capturablePct: 20,
    loadout: [],
  },
  {
    slug: 'maestra-curtidora-serhu',
    name: 'Maestra Curtidora Serhu',
    kind: 'PRINCIPAL',
    aliases: ['maestra curtidora', 'la curtidora de Karot Veku'],
    faction: 'Clan Serhu',
    genero: 'F',
    role: 'Maestra Curtidora del Clan Serhu',
    level: 5,
    attributes: { fuerza: 12, destreza: 15, constitucion: 13, inteligencia: 11, voluntad: 13, carisma: 10, magia: 2 },
    bio: 'Orca de dedos ágiles y manchados del tinte oscuro de las pieles que trabaja, siempre con un cuchillo curvo de desollador al cinto. Cada pieza de cuero real que sale de Karot Veku ha pasado por sus manos primero.',
    personality: 'Directa, poco dada a rodeos — enseña haciendo, no explicando de más.',
    homeLocationSlug: 'campamento-serhu-interior',
    teachesProfession: 'curtidor-orcos-llanuras',
    interactionTypes: ['MAESTRO_OFICIO'],
    raza: 'orcos',
    clase: 'CAZADOR',
    especializacion: 'SUPERVIVENCIA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'destreza',
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'curtidora-serhu',
    name: 'Curtidora Serhu',
    kind: 'PRINCIPAL',
    aliases: ['curtidora serhu'],
    faction: 'Clan Serhu',
    genero: 'F',
    role: 'Curtidora del Clan Serhu',
    level: 1,
    attributes: { fuerza: 9, destreza: 6, constitucion: 6, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 },
    bio: 'Orca de dedos ágiles y manchados del tinte oscuro de las pieles que trabaja, siempre con un cuchillo curvo de desollador al cinto. Aprendices de la maestra curtidora.',
    personality: 'Pocas palabras, su funcion es trabajar y ayudar a la maestra curtidora.',
    homeLocationSlug: 'campamento-serhu-interior',
    raza: 'orcos',
    clase: 'CAZADOR',
    especializacion: 'SUPERVIVENCIA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'destreza',
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'curtidor-serhu',
    name: 'Curtidor Serhu',
    kind: 'PRINCIPAL',
    aliases: ['curtidor serhu'],
    faction: 'Clan Serhu',
    genero: 'M',
    role: 'Curtidor del Clan Serhu',
    level: 1,
    attributes: { fuerza: 9, destreza: 6, constitucion: 6, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 },
    bio: 'Orco de dedos ágiles y manchados del tinte oscuro de las pieles que trabaja, siempre con un cuchillo curvo de desollador al cinto. Aprendices de la maestra curtidora.',
    personality: 'Pocas palabras, su funcion es trabajar y ayudar a la maestra curtidora.',
    homeLocationSlug: 'campamento-serhu-interior',
    raza: 'orcos',
    clase: 'CAZADOR',
    especializacion: 'SUPERVIVENCIA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'destreza',
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'maestro-cocinero-serhu',
    name: 'Maestro Cocinero Serhu',
    kind: 'PRINCIPAL',
    aliases: ['maestro cocinero', 'el cocinero de Karot Veku'],
    faction: 'Clan Serhu',
    genero: 'M',
    role: 'Maestro Cocinero del Clan Serhu',
    level: 5,
    attributes: { fuerza: 11, destreza: 13, constitucion: 14, inteligencia: 12, voluntad: 12, carisma: 13, magia: 2 },
    bio: 'Orco de brazos gruesos y delantal siempre manchado, vigila las ollas de la cocina común de Karot Veku con la misma seriedad con la que otros vigilan la muralla. Sabe estirar una caza pobre para alimentar a todo el clan sin que nadie note la escasez.',
    personality: 'Bromista con quien colabora, seco con quien desperdicia comida.',
    homeLocationSlug: 'campamento-serhu-interior',
    teachesProfession: 'cocinero-orcos-llanuras',
    interactionTypes: ['MAESTRO_OFICIO'],
    raza: 'orcos',
    clase: 'GUERRERO',
    especializacion: 'ESPECIALISTA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'constitucion',
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'cocinero-serhu',
    name: 'Cocinero Serhu',
    kind: 'PRINCIPAL',
    aliases: ['cocinero serhu'],
    faction: 'Clan Serhu',
    genero: 'M',
    role: 'Cocinero del Clan Serhu',
    level: 1,
    attributes: { fuerza: 9, destreza: 6, constitucion: 6, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 },
    bio: 'Orco joven de Karot Veku — pela, corta y acarrea en la cocina común bajo las órdenes del Maestro Cocinero. Aprende el oficio a base de repetición y algún que otro grito.',
    personality: 'Pocas palabras, su funcion es trabajar y ayudar al maestro cocinero.',
    homeLocationSlug: 'campamento-serhu-interior',
    raza: 'orcos',
    clase: 'CAZADOR',
    especializacion: 'SUPERVIVENCIA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'destreza',
    capturablePct: 0,
    loadout: [],
  },

  // Consolidación (2026-09-01, "Trabajador de Reino: 8 de 11 oficios sin Maestro real") — 2 Maestros
  // más, mismo patrón exacto que Herrero/Curtidor/Cocinero de arriba (mismo `homeLocationSlug`,
  // mismos campos de mecánica). Quedan 6 oficios más sin Maestro (herborista, alquimista, domador,
  // desollador, peletero, primeros-auxilios) para otra pasada.
  {
    slug: 'maestra-herborista-serhu',
    name: 'Maestra Herborista Serhu',
    kind: 'PRINCIPAL',
    aliases: ['maestra herborista', 'la herborista de Karot Veku'],
    faction: 'Clan Serhu',
    genero: 'F',
    role: 'Maestra Herborista del Clan Serhu',
    level: 5,
    attributes: { fuerza: 8, destreza: 12, constitucion: 10, inteligencia: 15, voluntad: 14, carisma: 9, magia: 3 },
    bio: 'Orca menuda de manos manchadas de savia y tierra, siempre con un manojo de plantas recién cortadas colgado del cinto. Conoce cada mata útil en un día de camino alrededor de Karot Veku, y las que hay que evitar.',
    personality: 'Observadora, habla poco y solo de lo que importa — plantas, tierra, clima.',
    homeLocationSlug: 'campamento-serhu-interior',
    teachesProfession: 'herborista-orcos-llanuras',
    interactionTypes: ['MAESTRO_OFICIO'],
    raza: 'orcos',
    clase: 'CHAMAN',
    especializacion: 'RUNICO',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'inteligencia',
    capturablePct: 0,
    loadout: [],
  },

  {
    slug: 'maestro-alquimista-serhu',
    name: 'Maestro Alquimista Serhu',
    kind: 'PRINCIPAL',
    aliases: ['maestro alquimista', 'el alquimista de Karot Veku'],
    faction: 'Clan Serhu',
    genero: 'M',
    role: 'Maestro Alquimista del Clan Serhu',
    level: 5,
    attributes: { fuerza: 9, destreza: 11, constitucion: 12, inteligencia: 16, voluntad: 13, carisma: 8, magia: 4 },
    bio: 'Orco de dedos manchados de pigmentos y quemaduras pequeñas de morteros que hierven más de la cuenta, rodeado siempre de un olor agrio que no se va del todo. Convierte lo que trae la herborista en pociones y elixires reales, algunos más fiables que otros.',
    personality: 'Metódico hasta la obsesión con las proporciones, impaciente con quien interrumpe una mezcla a medias.',
    homeLocationSlug: 'campamento-serhu-interior',
    teachesProfession: 'alquimista-orcos-llanuras',
    interactionTypes: ['MAESTRO_OFICIO'],
    raza: 'orcos',
    clase: 'CHAMAN',
    especializacion: 'RUNICO',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'inteligencia',
    capturablePct: 0,
    loadout: [],
  },

  {
    slug: 'maestro-domador-serhu',
    name: 'Maestro Domador Serhu',
    kind: 'PRINCIPAL',
    aliases: ['maestro domador', 'el domador de Karot Veku'],
    faction: 'Clan Serhu',
    genero: 'M',
    role: 'Maestro Domador del Clan Serhu',
    level: 5,
    attributes: { fuerza: 13, destreza: 14, constitucion: 13, inteligencia: 10, voluntad: 15, carisma: 12, magia: 2 },
    bio: 'Orco de cicatrices finas en los antebrazos, ganadas enseñando a criaturas de la llanura a confiar en una mano humanoide. Pasa más tiempo entre los corrales de Karot Veku que dentro del propio campamento.',
    personality: 'Paciente hasta límites que exasperan al resto del clan, firme sin levantar nunca la voz.',
    homeLocationSlug: 'campamento-serhu-interior',
    teachesProfession: 'domador-orcos-llanuras',
    interactionTypes: ['MAESTRO_OFICIO'],
    raza: 'orcos',
    clase: 'CAZADOR',
    especializacion: 'DOMADOR',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'voluntad',
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'ganadero-serhu',
    name: 'Ganadero Serhu',
    kind: 'PRINCIPAL',
    aliases: ['ganadero serhu'],
    faction: 'Clan Serhu',
    genero: 'M',
    role: 'Ganadero del Clan Serhu',
    level: 1,
    attributes: { fuerza: 9, destreza: 6, constitucion: 6, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 },
    bio: 'Orco joven de Karot Veku — limpia corrales, acarrea forraje y observa al Maestro Domador trabajar con las criaturas del clan. Todavía no confía en acercarse solo a nada más grande que él.',
    personality: 'Pocas palabras, su funcion es trabajar y ayudar al maestro domador.',
    homeLocationSlug: 'campamento-serhu-interior',
    raza: 'orcos',
    clase: 'CAZADOR',
    especializacion: 'SUPERVIVENCIA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'destreza',
    capturablePct: 0,
    loadout: [],
  },

  {
    slug: 'maestro-desollador-serhu',
    name: 'Maestro Desollador Serhu',
    kind: 'PRINCIPAL',
    aliases: ['maestro desollador', 'el desollador de Karot Veku'],
    faction: 'Clan Serhu',
    genero: 'M',
    role: 'Maestro Desollador del Clan Serhu',
    level: 5,
    attributes: { fuerza: 15, destreza: 14, constitucion: 13, inteligencia: 9, voluntad: 11, carisma: 7, magia: 1 },
    bio: 'Orco fornido de delantal duro por la sangre seca de tantas presas, cuchillo de desollar siempre afilado al cinto. Cada piel que entra en Karot Veku pasa por su tajo antes de llegar a la curtidora.',
    personality: 'Práctico y sin remilgos, respeta a quien trae presa real más que a quien solo habla de caza.',
    homeLocationSlug: 'campamento-serhu-interior',
    teachesProfession: 'desollador-orcos-llanuras',
    interactionTypes: ['MAESTRO_OFICIO'],
    raza: 'orcos',
    clase: 'CAZADOR',
    especializacion: 'INSTINTIVO',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'fuerza',
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'desolladora-serhu',
    name: 'Desolladora Serhu',
    kind: 'PRINCIPAL',
    aliases: ['desolladora serhu'],
    faction: 'Clan Serhu',
    genero: 'F',
    role: 'Desolladora del Clan Serhu',
    level: 1,
    attributes: { fuerza: 9, destreza: 6, constitucion: 6, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 },
    bio: 'Orca joven de Karot Veku — manos ya curtidas de sujetar el cuchillo de desollar, aprendiendo el oficio pieza a pieza junto al Maestro Desollador.',
    personality: 'Pocas palabras, su funcion es trabajar y ayudar al maestro desollador.',
    homeLocationSlug: 'campamento-serhu-interior',
    raza: 'orcos',
    clase: 'CAZADOR',
    especializacion: 'SUPERVIVENCIA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'destreza',
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'maestro-peletero-serhu',
    name: 'Maestro Peletero Serhu',
    kind: 'PRINCIPAL',
    aliases: ['maestro peletero', 'el peletero de Karot Veku'],
    faction: 'Clan Serhu',
    genero: 'M',
    role: 'Maestro Peletero del Clan Serhu',
    level: 5,
    attributes: { fuerza: 11, destreza: 15, constitucion: 12, inteligencia: 12, voluntad: 11, carisma: 10, magia: 2 },
    bio: 'Orco de manos ásperas por el manejo constante de pieles curtidas, siempre rodeado de cortes y retales a medio coser. Da forma a capas y forros reales de Karot Veku a partir de lo que ya preparó la curtidora.',
    personality: 'Práctico, orgulloso de su trabajo sin alardear de él, generoso con los aprendices de verdad.',
    homeLocationSlug: 'campamento-serhu-interior',
    teachesProfession: 'peletero-orcos-llanuras',
    interactionTypes: ['MAESTRO_OFICIO'],
    raza: 'orcos',
    clase: 'CAZADOR',
    especializacion: 'SUPERVIVENCIA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'destreza',
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'peletero-serhu',
    name: 'Peletero Serhu',
    kind: 'PRINCIPAL',
    aliases: ['peletero serhu'],
    faction: 'Clan Serhu',
    genero: 'M',
    role: 'Peletero del Clan Serhu',
    level: 1,
    attributes: { fuerza: 9, destreza: 6, constitucion: 6, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 },
    bio: 'Orco joven de Karot Veku — dedos rápidos con la aguja, aprendiendo a dar forma a pieles bajo la mirada del Maestro Peletero.',
    personality: 'Pocas palabras, su funcion es trabajar y ayudar al maestro peletero.',
    homeLocationSlug: 'campamento-serhu-interior',
    raza: 'orcos',
    clase: 'CAZADOR',
    especializacion: 'SUPERVIVENCIA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'destreza',
    capturablePct: 0,
    loadout: [],
  },

  {
    slug: 'maestra-primeros-auxilios-serhu',
    name: 'Maestra de Primeros Auxilios Serhu',
    kind: 'PRINCIPAL',
    aliases: ['maestra de primeros auxilios', 'la sanadora de Karot Veku'],
    faction: 'Clan Serhu',
    genero: 'F',
    role: 'Maestra de Primeros Auxilios del Clan Serhu',
    level: 5,
    attributes: { fuerza: 10, destreza: 13, constitucion: 12, inteligencia: 13, voluntad: 15, carisma: 11, magia: 3 },
    bio: 'Orca de manos firmes y voz calmada incluso ante la peor herida, siempre con vendas y cataplasmas listas al cinto. Es la primera cara que ve cualquiera del clan que vuelve mal parado de la llanura.',
    personality: 'Serena bajo presión, seca con quien se queja más de lo herido que está.',
    homeLocationSlug: 'campamento-serhu-interior',
    teachesProfession: 'primeros-auxilios-orcos-llanuras',
    interactionTypes: ['MAESTRO_OFICIO'],
    raza: 'orcos',
    clase: 'CHAMAN',
    especializacion: 'TOTEMICO',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'voluntad',
    capturablePct: 0,
    loadout: [],
  },

  // Maestro Pescador (2026-09-02, profesión "pescador" nueva, zona 15 de Playa de Ceniza Blanca) —
  // sin él, nadie podía aprender pescador en absoluto (hallazgo de verificación tras implementar
  // Pescar/Buscar). Mismo patrón que el resto de Maestros de oficio; `teachesProfession: 'pescador'`
  // SIN sufijo regional, a diferencia del resto — pescador es universal (harvestAbilities.ts, todas
  // las razas), no un combo raza+región de professions.ts.
  {
    slug: 'maestro-pescador-serhu',
    name: 'Maestro Pescador Serhu',
    kind: 'PRINCIPAL',
    aliases: ['maestro pescador', 'el pescador de Playa de Ceniza Blanca'],
    faction: 'Clan Serhu',
    genero: 'M',
    role: 'Maestro Pescador, Playa de Ceniza Blanca',
    level: 5,
    attributes: { fuerza: 11, destreza: 13, constitucion: 12, inteligencia: 10, voluntad: 12, carisma: 8, magia: 1 },
    bio: 'Orco curtido por el sol y la sal, manos ásperas de manejar sedal y cuerda a diario. Conoce cada banco de Jashil y sabe leer cuándo el Toluh puede aparecer en la orilla profunda. Baja de vez en cuando desde Karot Veku a instalarse en la playa una temporada.',
    personality: 'Paciente, habla poco y solo cuando el pez no muerde.',
    homeLocationSlug: 'playa-de-ceniza-blanca',
    teachesProfession: 'pescador',
    interactionTypes: ['MAESTRO_OFICIO'],
    raza: 'orcos',
    clase: 'CAZADOR',
    especializacion: 'SUPERVIVENCIA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'destreza',
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'pescador-serhu',
    name: 'Pescador Serhu',
    kind: 'PRINCIPAL',
    aliases: ['pescador serhu'],
    faction: 'Clan Serhu',
    genero: 'M',
    role: 'Pescador del Clan Serhu',
    level: 1,
    attributes: { fuerza: 9, destreza: 6, constitucion: 6, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 },
    bio: 'Orco joven de Karot Veku — pasa temporadas en la Playa de Ceniza Blanca junto al Maestro Pescador, aprendiendo a leer bancos de peces y corrientes.',
    personality: 'Pocas palabras, su funcion es trabajar y ayudar al maestro pescador.',
    homeLocationSlug: 'campamento-serhu-interior',
    raza: 'orcos',
    clase: 'CAZADOR',
    especializacion: 'SUPERVIVENCIA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'destreza',
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'pescadora-serhu',
    name: 'Pescadora Serhu',
    kind: 'PRINCIPAL',
    aliases: ['pescadora serhu'],
    faction: 'Clan Serhu',
    genero: 'F',
    role: 'Pescadora del Clan Serhu',
    level: 1,
    attributes: { fuerza: 9, destreza: 6, constitucion: 6, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 },
    bio: 'Orca joven de Karot Veku — pasa temporadas en la Playa de Ceniza Blanca junto al Maestro Pescador, aprendiendo a leer bancos de peces y corrientes.',
    personality: 'Pocas palabras, su funcion es trabajar y ayudar al maestro pescador.',
    homeLocationSlug: 'campamento-serhu-interior',
    raza: 'orcos',
    clase: 'CAZADOR',
    especializacion: 'SUPERVIVENCIA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'destreza',
    capturablePct: 0,
    loadout: [],
  },

  {
    slug: 'maestro-carpintero-serhu',
    name: 'Maestro Carpintero Serhu',
    kind: 'PRINCIPAL',
    aliases: ['maestro carpintero', 'el carpintero de Karot Veku'],
    faction: 'Clan Serhu',
    genero: 'M',
    role: 'Maestro Carpintero del Clan Serhu',
    level: 5,
    attributes: { fuerza: 14, destreza: 16, constitucion: 12, inteligencia: 11, voluntad: 10, carisma: 8, magia: 2 },
    bio: 'Orco de antebrazos nudosos y astillas siempre prendidas a la ropa, huele a resina de trepador del ocaso incluso lejos de su taller. Da forma a los mangos de las armas y a los soportes de Karot Veku — sin él, cada hacha real se quedaría en solo el filo.',
    personality: 'Meticuloso hasta la exasperación con el veteado de la madera, impaciente con quien no respeta la herramienta.',
    homeLocationSlug: 'campamento-serhu-interior',
    teachesProfession: 'carpintero-orcos-llanuras',
    interactionTypes: ['MAESTRO_OFICIO'],
    raza: 'orcos',
    clase: 'GUERRERO',
    especializacion: 'ESPECIALISTA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'fuerza',
    capturablePct: 0,
    loadout: [],
  },

  {
    slug: 'maestra-sastre-serhu',
    name: 'Maestra Sastre Serhu',
    kind: 'PRINCIPAL',
    aliases: ['maestra sastre', 'la sastre de Karot Veku'],
    faction: 'Clan Serhu',
    genero: 'F',
    role: 'Maestra Sastre del Clan Serhu',
    level: 5,
    attributes: { fuerza: 9, destreza: 17, constitucion: 11, inteligencia: 13, voluntad: 12, carisma: 11, magia: 2 },
    bio: 'Orca de dedos rápidos y un punzón siempre a mano, cose arneses y prendas de cuero curtido con una precisión que desentona con la rudeza del resto del campamento. Cada arnés real de Karot Veku ha pasado por su rueca antes de salir a la llanura.',
    personality: 'Habladora mientras trabaja, exigente con el acabado — no deja salir nada a medio coser.',
    homeLocationSlug: 'campamento-serhu-interior',
    teachesProfession: 'sastre-orcos-llanuras',
    interactionTypes: ['MAESTRO_OFICIO'],
    raza: 'orcos',
    clase: 'CAZADOR',
    especializacion: 'SUPERVIVENCIA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'destreza',
    capturablePct: 0,
    loadout: [],
  },

  {
    slug: 'mercader-de-paso',
    name: 'Mercader de paso',
    kind: 'PLANTILLA',
    aliases: ['mercader', 'mercader de paso', 'comerciante', 'un mercader'],
    faction: null,
    genero: 'M', // Bio explícita en masculino ("Orco sin clan") — misma auditoría de género, 2026-08-08.
    role: 'Comerciante itinerante',
    articulo: 'el',
    level: 1,
    levelMax: 1,
    attributes: { fuerza: 7, destreza: 9, constitucion: 6, inteligencia: 11, voluntad: 10, carisma: 14, magia: 4 },
    bio: 'Orco sin clan — hace años cambió la lanza por la balanza de trueque, algo que pocos orcos entienden y menos aún respetan —, piel curtida por soles de media docena de regiones distintas, más delgado que un guerrero de su edad. Comerciante itinerante que cruza las rutas de la región con mercancía de trueque.',
    personality: 'Locuaz, siempre calculando el precio de todo, evita el conflicto directo.',
    raza: 'orcos',
    // Clase asignada (2026-08-24, Grupo 3 § Sistema de clases, "todos los NPC deben tener clase")
    // — "cambió la lanza por la balanza de trueque": fue guerrero, generalista sin identidad de
    // combate fuerte, coherente con haberlo dejado casi del todo.
    clase: 'GUERRERO',
    especializacion: 'ESPECIALISTA',
    temperamento: 'INOFENSIVO',
    comerciablePct: 90,
    reclutablePct: 10,
    // Persuasión (2026-08-25) — "locuaz, siempre calculando el precio", resiste con labia propia.
    atributoResistencia: 'carisma',
    capturablePct: 15,
    cortejablePct: 5,
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

  {
    slug: 'oficial-concordia',
    name: 'Oficial de patrulla de la Concordia',
    kind: 'PLANTILLA',
    aliases: ['oficial de la concordia', 'oficial concordia', 'oficial goirntes'],
    faction: 'Concordia de Hierro',
    role: 'Oficial al mando de una patrulla',
    articulo: 'el',
    level: 4,
    levelMax: 5,
    attributes: { fuerza: 12, destreza: 10, constitucion: 9, inteligencia: 13, voluntad: 15, carisma: 12, magia: 4 },
    bio: 'Goirnte de la Meseta del Orden — misma piel gris y fría al tacto que el resto de los suyos, aunque en un oficial se nota menos tensa: ha aprendido a controlar hasta ese reflejo. Porte rígido, uniforme sin una arruga fuera de sitio. Oficial al mando de una patrulla de la Concordia de Hierro. Lleva correspondencia sellada y el sello que acredita (o incrimina) su misión.',
    personality: 'Frío, calculador, más peligroso en el trato que en el combate directo.',
    // Mismo motivo que soldado-concordia (ver su comentario) — ancla a la frontera real.
    homeLocationSlug: 'cruce-de-las-cenizas',
    raza: 'goirntes',
    // Caballero, exclusiva goirnte (2026-08-24, Grupo 3 § Sistema de clases) — reasignado desde
    // Guerrero, más fiel a la restricción de raza del diseño. Caballero del Valor: "más peligroso
    // en el trato que en el combate directo", encaja con la rama de utilidad/maniobra política
    // más que con el tanque puro (Orden) o el bruiser (Dolor).
    clase: 'CABALLERO',
    especializacion: 'CABALLERO_DEL_VALOR',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 10,
    // Persuasión (2026-08-25) — "frío, calculador", resiste con la cabeza, no con el físico.
    atributoResistencia: 'inteligencia',
    capturablePct: 25,
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

  // Misión inicial de combate — PRINCIPAL, no PLANTILLA, porque es un encuentro único ligado a
  // esta misión (una sola fila de NpcState por partida), no un arquetipo repetible como
  // orco-expulsado. Vive en la propia Hondonada del Eco: su descripción ya avisa de que, al estar
  // hundida, "no se ve quién se acerca por arriba hasta que es tarde" — la emboscada encaja sin
  // inventar una ubicación nueva. Su loadout incluye el "Mapa de las Llanuras" que la misión da
  // como recompensa.
  //
  // Historia completa reescrita 2026-08-05 (ver npcs.md #14 para el detalle íntegro): ya no
  // persigue a Gistera Koh por un duelo de honor rechazado — es uno de los tres guerreros Serhu
  // pagados en secreto por los Goirntes para matar al artesano Uhuld Koh, padre adoptivo de
  // Gistera, antes de que su plan contra la casta de Ketg saliera a la luz.
  {
    slug: 'orco-enfurecido-hondonada',
    name: 'Orco enfurecido',
    kind: 'PRINCIPAL',
    aliases: ['orco enfurecido'],
    faction: 'Clan Serhu',
    genero: 'M',
    role: "Uno de los guerreros que mataron a Uhuld Koh por encargo Goirnte; persigue a Gistera Koh sin que sus compañeros lo sepan",
    articulo: 'el',
    level: 1,
    attributes: { fuerza: 6, destreza: 4, constitucion: 5, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 },
    bio: "Orco del Clan Serhu, calvo y de complexión corpulenta, piel beige agrietada, sin pintura de clan visible — se la arrancó él mismo, en el mismo arranque de furia que lo trajo hasta aquí. Uno de los tres guerreros pagados en secreto por los Goirntes para asegurar la muerte del artesano Uhuld Koh, cuyo plan amenazaba con exponer la represión de los suyos: fue él quien le aplastó el cráneo con la maza después de que Uhuld, ya herido, lo alcanzara con el hacha. Vio huir esa misma noche a la hija adoptiva de Uhuld y la siguió por su cuenta, sin avisar a sus compañeros — ni él mismo sabe ya si por acabar el encargo o por una obsesión que se le ha ido de las manos. A pocos kilómetros del Karot Veku estuvo a punto de caer en una trampa que ella le tendió; la humillación de haberlo estado a punto de lograr una fugitiva a la que dobla en tamaño terminó de quebrarlo. Duerme y merodea en la Hondonada del Eco, donde el terreno hundido le permite ver llegar a cualquiera antes de que lo vean a él.",
    personality: 'Errático y violento con cualquiera, obsesivo con ella — ataca al primer contacto sin intentar hablar.',
    homeLocationSlug: 'hondonada-del-eco',
    raza: 'orcos',
    clase: 'GUERRERO',
    especializacion: 'BERSERKER',
    temperamento: 'AGRESIVO',
    capturablePct: 0,
    loadout: [
      { itemSlug: 'maza-orca', notas: 'Astillada, con sangre seca' },
      { itemSlug: 'vendaje-improvisado-orcos-llanuras', notas: 'A medio usar, manchado' },
      { itemSlug: 'racion-carne-ahumada' },
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
    articulo: 'el',
    level: 1,
    levelMax: 1,
    attributes: { fuerza: 8, destreza: 7, constitucion: 7, inteligencia: 8, voluntad: 13, carisma: 10, magia: 4 },
    bio: 'Orco de un clan cualquiera de las Llanuras, piel en el tono beige o pardo propio de esas tribus, cuerpo delgado y marcado más por el camino que por la guerra. Lleva una tira de tela oscura anudada al brazo, señal de luto que cualquier clan reconoce. Sin prisa ni destino más allá de Los Túmulos del Honor — lleva algo que dejar en la tumba de alguien que murió con honor. No busca compañía ni pelea; si se le trata con respeto, agradece la charla en el camino.',
    personality: 'Callado y ensimismado, cortés si se le habla primero; el duelo, no el miedo, es lo que le hace evitar el contacto.',
    raza: 'orcos',
    // Chamán / Totémico (2026-08-24, Grupo 3 § Sistema de clases) — peregrino de luto ritual,
    // encaja con la rama espiritual/de invocación más que con cualquier especialización de
    // combate — scaffolding sin habilidades reales todavía (0/8, bloqueada por invocación).
    clase: 'CHAMAN',
    especializacion: 'TOTEMICO',
    temperamento: 'INOFENSIVO',
    comerciablePct: 10,
    reclutablePct: 5,
    // Persuasión (2026-08-25) — "callado y ensimismado", resiste desde dentro, por voluntad
    // espiritual propia, no por la razón ni la fuerza.
    atributoResistencia: 'voluntad',
    capturablePct: 5,
    cortejablePct: 10,
    loadout: [
      { itemSlug: 'racion-viaje', cantidad: 1 },
      { itemSlug: 'odre-agua' },
      { itemSlug: 'amuleto-hueso', notas: 'La ofrenda que lleva para dejar en el túmulo' },
    ],
  },

  {
    slug: 'soldado-concordia',
    name: 'Soldado de patrulla de la Concordia',
    kind: 'PLANTILLA',
    aliases: ['soldado de la concordia', 'soldado concordia', 'patrulla de la concordia', 'soldado goirntes'],
    faction: 'Concordia de Hierro',
    role: 'Soldado de patrulla fronteriza',
    articulo: 'el',
    level: 2,
    levelMax: 3,
    attributes: { fuerza: 12, destreza: 10, constitucion: 11, inteligencia: 7, voluntad: 13, carisma: 8, magia: 4 },
    bio: 'Goirnte de la Meseta del Orden — piel gris, fría al tacto, que se tensa visiblemente cuando se concentra, rasgo propio de su pueblo. Uniformado con la disciplina que exige su casta de nacimiento. Soldado raso de una patrulla de la Concordia de Hierro que vigila la frontera de las Llanuras. Una patrulla tipo son 3 soldados + 1 oficial.',
    personality: 'Disciplinado, sigue órdenes sin cuestionar demasiado.',
    // Ancla a la frontera real (2026-07-30, petición explícita en vivo: "ha hablado de goirntes en
    // una zona poco probable... ha mezclado dos zonas estando yo en la Hondonada del Eco") — sin
    // esto (homeLocationSlug null = itinerante puro), la sugerencia de encuentro ambiental
    // (turnResolution.ts) lo ofrecía en CUALQUIER punto del mundo con la misma probabilidad,
    // contradiciendo su propia bio ("vigila la FRONTERA de las Llanuras"). "El Cruce de las
    // Cenizas" ya es, literalmente, "zona de paso habitual de patrullas de la Concordia de
    // Hierro" en su propia descripción — el sitio correcto, no la Hondonada del Eco (el valle
    // escondido y natal de Gorhorn, bien al interior).
    homeLocationSlug: 'cruce-de-las-cenizas',
    raza: 'goirntes',
    // Caballero, exclusiva goirnte (2026-08-24, ver comentario de oficial-concordia arriba) —
    // Orden: "disciplinado, sigue órdenes sin cuestionar", el rango y fila de la misma doctrina
    // militar.
    clase: 'CABALLERO',
    especializacion: 'CABALLERO_DEL_ORDEN',
    temperamento: 'CAUTELOSO',
    comerciablePct: 5,
    reclutablePct: 5,
    // Persuasión (2026-08-25) — "disciplinado, sigue órdenes sin cuestionar", resiste con
    // constitución/disciplina física, no con inteligencia.
    atributoResistencia: 'constitucion',
    capturablePct: 30,
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
    slug: 'ulkha-ketg',
    name: 'Ulkha Ketg',
    kind: 'PRINCIPAL',
    aliases: ['ulkha ketg'],
    faction: 'Clan Serhu',
    genero: 'F', // Bio explícita en femenino ("Orca del Clan Serhu") — misma auditoría de género, 2026-08-08.
    role: "Terk'ikar del Clan Serhu",
    level: 24,
    attributes: { fuerza: 16, destreza: 28, constitucion: 14, inteligencia: 20, voluntad: 16, carisma: 15, magia: 0 },
    bio: 'Orca del Clan Serhu, de las Llanuras del Viento Rojo — piel beige curtida por décadas de sol y viento, cabello gris casi blanco recogido en un moño alto sujeto con agujas de hueso de gargantúa. Menuda para una orca, su autoridad no se apoya en el físico sino en la voz baja y la mirada que no parpadea. Jefa del Clan Serhu; gobierna asentamiento, pastoreo y migraciones. Como compañero tiene sometido a un macho Gargantúa adulto llamado Gogorath, que tiene una cicatriz en el ojo izquierdo y su color de piel es más oscuro que el de sus hermanos.',
    personality: 'Fría en el cálculo y cálida en el trato, en ese orden. Guía a las Gargantúas en las migraciones — oficio aprendido, no magia.',
    homeLocationSlug: 'campamento-serhu',
    raza: 'orcos',
    // Cazador / Domador (reasignada de Chamán/Rúnico, auditoría de lore 2026-09-06 — el "don de
    // comunión" que antes justificaba esta clase se quitó del lore por decisión explícita de la
    // usuaria: el vínculo con las Gargantúas nunca fue magia de ningún tipo, es la misma
    // especialización Domador que cualquier Cazador puede tener ("controlar bestias, añadir
    // buffs", clases.md), aplicada a este animal en concreto — coherente con que Domador es una
    // especialización de Cazador, no un poder atado al cargo de Terk'ikar ni a la clase Chamán.
    clase: 'CAZADOR',
    especializacion: 'DOMADOR',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 0,
    // Persuasión (2026-08-25) — "fría en el cálculo", resiste razonando, no con orgullo ni fuerza.
    atributoResistencia: 'inteligencia',
    capturablePct: 0,
    loadout: [
      { itemSlug: 'cuchillo-deshuello' },
      { itemSlug: 'manojo-salvia-polvo', cantidad: 3 },
      { itemSlug: 'amuleto-hueso', notas: 'Vértebras de gargantúa — símbolo de su vínculo con la manada' },
      { itemSlug: 'sal-trueque', cantidad: 2 },
      { itemSlug: 'odre-agua' },
      { itemSlug: 'cataplasma-salvia-polvo', cantidad: 2 },
      { itemSlug: 'cataplasma-flor-ceniza', cantidad: 2 },
    ],
  },
  {
    // Compañero de fauna con nombre propio (auditoría de lore 2026-09-13, hallazgo C10) — hasta
    // ahora solo mencionado en la bio de Ulkha Ketg ("un macho Gargantúa adulto llamado Gogorath").
    // Ficha real: mismo shape que cualquier otra fila de fauna del catálogo (`gargantua-de-ceniza`
    // como especie base), pero `kind: 'PRINCIPAL'` (individuo con nombre, no plantilla genérica) y
    // protegido (comerciable/reclutable/domesticable/capturable a 0 — ya pertenece a Ulkha, el
    // jugador no puede cazarlo/domesticarlo aparte). `companionOfNpcSlug` lo vincula a su dueña
    // para el icono de grupo en el mapa de Zona (ver zona.ts) — sin ZonePoint propio, se mueve
    // siempre junto al de Ulkha.
    slug: 'gogorath',
    name: 'Gogorath',
    kind: 'PRINCIPAL',
    aliases: ['gogorath'],
    faction: 'Clan Serhu',
    genero: 'M',
    role: 'Gargantúa sometido, compañero de la Terk\'ikar Ulkha Ketg',
    articulo: 'el',
    level: 18,
    attributes: { fuerza: 22, destreza: 7, constitucion: 24, inteligencia: 5, voluntad: 10, carisma: 3, magia: 0 },
    bio: 'Macho Gargantúa adulto, de piel más oscura que la del resto de su manada, con una cicatriz vieja que le cierra el ojo izquierdo. Sometido por Ulkha Ketg hace años, la sigue allá donde va — guía y protege las migraciones del Clan Serhu bajo su mando. Dócil con Ulkha y con quien ella señale, pero conserva todo el peligro de su especie si algo la amenaza de verdad.',
    personality: 'Tranquilo mientras Ulkha esté cerca y en calma; se planta y embiste sin dudar si a ella la atacan.',
    homeLocationSlug: 'campamento-serhu',
    companionOfNpcSlug: 'ulkha-ketg',
    loadout: [],
    ataqueNatural: 'Embiste con todo su peso, aplastando lo que se interponga en su camino.',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 0,
    domesticablePct: 0,
    capturablePct: 0,
    faunaCategoria: 'BESTIONES',
    habilidadesRaciales: [
      { icon: '🦴', name: 'Coraza de Placas', description: 'Las gruesas placas óseas que le cubren el lomo absorben buena parte de cualquier golpe directo.', categoria: 'defensa', preferredAttribute: 'fuerza', level: 4, effects: ['AGUANTE'] },
      { icon: '💥', name: 'Embestida Sísmica', description: 'Carga con todo su peso y puede derribar a quien no logre apartarse a tiempo.', categoria: 'ataque', preferredAttribute: 'fuerza', level: 12, effects: ['ATAQUE', 'ATURDIMIENTO'] },
      { icon: '👁️', name: 'Furia del Vínculo Roto', description: 'Si Ulkha resulta herida delante de él, entra en una embestida ciega e imparable.', categoria: 'ataque', preferredAttribute: 'fuerza', level: 20, effects: ['ATAQUE'] },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // REGIÓN: LA MESETA DEL ORDEN
  // ══════════════════════════════════════════════════════════════════════════

  {
    slug: 'yovenne-tal',
    name: 'Archimagistrada Yovenne Tal',
    kind: 'PRINCIPAL',
    // Meseta del Orden — "Fuera del núcleo jugable actual... Gorhorn no ha estado aquí" (ver su
    // entrada de región más arriba). Auditoría 2026-08-14, ver comentario de `nucleoJugable`.
    nucleoJugable: false,
    aliases: ['yovenne tal', 'archimagistrada yovenne tal', 'archimagistrada tal'],
    // A-01 (2026-09-28): lidera Los del Obelisco, la facción moderada, que no es rama de la Concordia.
    faction: 'Los del Obelisco',
    genero: 'F', // Título ya en femenino ("Archimagistrada", no "Archimagistrado") — misma auditoría de género, 2026-08-08.
    role: 'Archimagistrada de la facción moderada Goirnte',
    level: 5,
    attributes: { fuerza: 6, destreza: 7, constitucion: 6, inteligencia: 15, voluntad: 15, carisma: 14, magia: 3 },
    bio: 'Goirnte de la Meseta del Orden — piel gris que se nota tensarse incluso al hablar de leyes, señal de una mente que nunca deja de calcular el orden de las cosas. Vigila de cerca a la facción radical desde dentro de la propia jerarquía Goirnte, siempre exigiendo que todo se resuelva "en orden" y por canal legítimo.',
    personality: 'Cita de memoria las leyes de los obeliscos, artículo y línea; jamás improvisa un argumento que no pueda sostener por escrito.',
    raza: 'goirntes',
    // Mago (2026-08-24, Grupo 3 § Sistema de clases) — "Archimagistrada" ya es su propio título;
    // Poder Magia (no Poder Semilla, sin vínculo con ninguna Semilla concreta en su bio) —
    // scaffolding sin habilidades reales todavía, Mago no está construido esta pasada.
    clase: 'MAGO',
    especializacion: 'PODER_MAGIA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 10,
    reclutablePct: 20,
    // Persuasión (2026-08-25) — "cita de memoria las leyes... jamás improvisa", solo cede ante
    // argumentos, nunca ante la fuerza ni el carisma.
    atributoResistencia: 'inteligencia',
    capturablePct: 10,
    loadout: [],
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
    // Meseta del Orden — fuera del núcleo jugable actual, mismo motivo que Yovenne Tal arriba.
    nucleoJugable: false,
    aliases: ['vrask ombra', 'general ombra', 'general vrask ombra'],
    faction: 'Concordia de Hierro',
    role: 'Mando militar de la Concordia de Hierro',
    level: 6,
    attributes: { fuerza: 11, destreza: 8, constitucion: 10, inteligencia: 15, voluntad: 16, carisma: 13, magia: 3 },
    bio: 'Goirnte de la Meseta del Orden — piel gris severa, tensa incluso en reposo, curtida por años de mando. Ejecuta las órdenes que le llegan sin cuestionarlas en público, aunque quienes lo conocen notan que últimamente pregunta más de lo que debería.',
    personality: 'Habla poco y en tono bajo; cuanto más tranquilo suena, más peligroso es el momento. Jamás repite una orden.',
    raza: 'goirntes',
    // Caballero del Orden (2026-08-24, Grupo 3 § Sistema de clases) — "mando militar", disciplina
    // de casta, misma doctrina que oficial/soldado de la Concordia.
    clase: 'CABALLERO',
    especializacion: 'CABALLERO_DEL_ORDEN',
    temperamento: 'CAUTELOSO',
    comerciablePct: 10,
    reclutablePct: 5,
    // Persuasión (2026-08-25) — "cuanto más tranquilo suena, más peligroso", resiste con la
    // cabeza fría, no con el físico.
    atributoResistencia: 'inteligencia',
    capturablePct: 10,
    loadout: [],
  },

  {
    slug: 'kael-dorn',
    name: 'Kael Dorn',
    kind: 'PRINCIPAL',
    // Meseta del Orden / Berig — fuera del núcleo jugable actual, mismo motivo que Yovenne Tal.
    nucleoJugable: false,
    aliases: ['kael dorn', 'kael'],
    faction: null,
    // Bio explícita en masculino ("el hombre más buscado de Berig") — misma auditoría de género,
    // 2026-08-13 (auditoría de catálogo fauna/npcs).
    genero: 'M',
    role: 'Exmiembro de la facción radical Goirnte, fugitivo',
    level: 3,
    attributes: { fuerza: 8, destreza: 9, constitucion: 6, inteligencia: 8, voluntad: 8, carisma: 6, magia: 4 },
    bio: 'Goirnte de la Meseta del Orden — piel gris apagada, más floja y menos tensa de lo normal en los suyos, como si hubiera dejado de concentrarse en nada desde hace tiempo. Exmiembro de la facción radical, hoy fugitivo y escondido.',
    personality: 'Habla en círculos y nunca termina las frases que rozan "esa noche"; sobresalta con los ruidos de metal.',
    raza: 'goirntes',
    // Cazador / Supervivencia (2026-08-24, Grupo 3 § Sistema de clases) — fugitivo escondido, ya
    // rompió con la disciplina militar goirnte (dejó la facción radical), no encaja como
    // Caballero. Cazador no está ligado a ninguna raza — Supervivencia por vivir escondido.
    clase: 'CAZADOR',
    especializacion: 'SUPERVIVENCIA',
    temperamento: 'INOFENSIVO',
    comerciablePct: 15,
    reclutablePct: 35,
    // Persuasión (2026-08-25) — "sobresalta con los ruidos de metal", roto por dentro, resiste
    // (poco) con voluntad frágil, no con la cabeza ni el físico.
    atributoResistencia: 'voluntad',
    capturablePct: 40,
    loadout: [],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // REGIÓN: CRISTAL HELADO
  // ══════════════════════════════════════════════════════════════════════════

  {
    slug: 'hagar-kiugh',
    name: 'Hagar Kiugh',
    kind: 'PRINCIPAL',
    // "Vive fuera del grafo v1 (Cristal Helado)... si la partida lo trae, no debe improvisársele
    // números" — ya documentado como fuera de núcleo en su propia bio, ahora también como dato.
    nucleoJugable: false,
    aliases: ['hagar kiugh'],
    faction: 'Clan Helsig',
    genero: 'M', // Bio explícita en masculino ("Orco del Clan Helsig") — misma auditoría de género, 2026-08-08.
    role: 'Minero de hielo sílice, amigo de infancia de Gorhorn',
    level: 2,
    attributes: { fuerza: 15, destreza: 8, constitucion: 13, inteligencia: 8, voluntad: 12, carisma: 11, magia: 9 },
    bio: 'Orco del Clan Helsig, de las tribus orcas de Cristal Helado — piel de un pálido azulado propio de los orcos de zonas nevadas, curtida por el viento de la montaña más que por el sol. Manos gruesas y llenas de callos de picar hielo sílice, cara ancha y siempre a punto de reírse, el contrapunto exacto del Gorhorn callado que conoció en las minas. Amigo de Gorhorn del Clan Helsig, de las minas de hielo sílice en Cristal Helado. Vive fuera del grafo v1 (Cristal Helado), pero es el vínculo personal vivo de Gorhorn — si la partida lo trae, no debe improvisársele números.',
    personality: 'Leal, ruidoso, de risa fácil — el opuesto exacto del Gorhorn callado de las minas, por eso encajaron.',
    raza: 'orcos',
    // Guerrero / Especialista (2026-08-24, Grupo 3 § Sistema de clases) — minero, no un
    // combatiente de identidad marcada; generalista de bajo perfil, coherente con "de risa fácil"
    // más que con ninguna rama agresiva.
    clase: 'GUERRERO',
    especializacion: 'ESPECIALISTA',
    temperamento: 'INOFENSIVO',
    comerciablePct: 0,
    reclutablePct: 20,
    // Persuasión (2026-08-25) — "leal, ruidoso, de risa fácil", cede fácil por carisma/afecto.
    atributoResistencia: 'carisma',
    cortejablePct: 20,
    loadout: [
      { itemSlug: 'pico-minero' },
      { itemSlug: 'cuchillo-hielo-silice' },
      { itemSlug: 'esquirla-hielo-silice', cantidad: 2 },
      { itemSlug: 'racion-viaje', cantidad: 2 },
      { itemSlug: 'piedras-chispa' },
    ],
  },
  {
    slug: 'guardiana-helsig',
    name: 'Guardiana helsig',
    kind: 'PLANTILLA',
    aliases: ['guardiana helsig'],
    faction: 'Clan Helsig',
    genero: 'F',
    role: 'Guardiana de las murallas y del campamento del Clan Helsig - Helske Tugh',
    articulo: 'la',
    level: 16,
    levelMax: 18,
    attributes: { fuerza: 18, destreza: 12, constitucion: 24, inteligencia: 6, voluntad: 17, carisma: 10, magia: 0 },
    bio: 'Orca del Clan Helsig — corpulenta y abrigada de pieles gruesas, apostada en las murallas de Helske Tugh contra el frío y contra cualquier intruso. Vigila más de lo que habla.',
    personality: '',
    raza: 'orcos',
    clase: 'GUERRERO',
    especializacion: 'GUARDIAN',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 0,
    atributoResistencia: 'voluntad',
    capturablePct: 0,
    loadout: [
    ],
  },
  {
    // Líderes del Clan Helsig (auditoría de lore 2026-09-13, hallazgo C7) — ya documentadas en
    // areas.md § Clan Helsig desde 2026-08-05 ("nombres confirmados por la usuaria") pero sin
    // ficha Npc real hasta ahora. homeLocationSlug al interior (no a Helske Tugh exterior) porque
    // ahí es donde vive el único edificio jugable real del clan, Helsig'sedsar (ver ZonePoint,
    // sembrado junto a los 6 Maestros de oficio en la misma auditoría).
    slug: 'brenka',
    name: 'Brenka',
    kind: 'PRINCIPAL',
    aliases: ['brenka', "terk'ikar brenka", 'terk\'ikar del clan helsig'],
    faction: 'Clan Helsig',
    genero: 'F',
    role: "Terk'ikar del Clan Helsig",
    level: 20,
    attributes: { fuerza: 14, destreza: 12, constitucion: 18, inteligencia: 16, voluntad: 20, carisma: 17, magia: 0 },
    bio: 'Orca del Clan Helsig, de las tribus gélidas de Cristal Helado — piel de un pálido azulado curtido por décadas de viento de montaña, manos ásperas de quien también ha tallado hielo sílice antes de gobernar. Gobierna el asentamiento, el reparto de caza y el turno de minas del clan; su pareja, la Kort\'ikar Solgra, lidera la guerra mientras ella sostiene el resto. Firme en que "nadie come dos veces hasta que todos han comido una" se cumpla siempre, sin excepción de rango.',
    personality: 'Severa con el reparto, paciente con la gente — deja que Solgra hable primero de guerra y ella cierre siempre con la última palabra sobre el clan.',
    homeLocationSlug: 'campamento-helsig-interior',
    raza: 'orcos',
    clase: 'GUERRERO',
    especializacion: 'GUARDIAN',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 0,
    // Persuasión (2026-08-25) — "severa con el reparto", cede solo ante razones bien calculadas.
    atributoResistencia: 'voluntad',
    capturablePct: 0,
    loadout: [
      { itemSlug: 'cuchillo-hielo-silice' },
      { itemSlug: 'racion-viaje', cantidad: 2 },
    ],
  },
  {
    slug: 'solgra',
    name: 'Solgra',
    kind: 'PRINCIPAL',
    aliases: ['solgra', "kort'ikar solgra", 'kort\'ikar del clan helsig'],
    faction: 'Clan Helsig',
    genero: 'F',
    role: "Kort'ikar del Clan Helsig",
    level: 20,
    attributes: { fuerza: 19, destreza: 16, constitucion: 19, inteligencia: 11, voluntad: 16, carisma: 12, magia: 0 },
    bio: 'Orca del Clan Helsig, de complexión más recia que la media de su tribu, cicatrices de hielo sílice mal curadas en los antebrazos — el precio de aprender a pelear con el mismo filo que se talla en las minas. Pareja de la Terk\'ikar Brenka; lidera la guerra y la defensa del clan mientras Brenka gobierna el resto. Mantiene un perfil neutral y defensivo ante los Goirntes, evitando la confrontación abierta salvo que el clan esté en juego de verdad.',
    personality: 'Directa hasta lo brusco en el combate, pero nunca decide sola algo que afecte al clan entero sin hablarlo antes con Brenka.',
    homeLocationSlug: 'campamento-helsig-interior',
    raza: 'orcos',
    clase: 'GUERRERO',
    especializacion: 'ESPECIALISTA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 0,
    // Persuasión (2026-08-25) — "directa hasta lo brusco", resiste por pura fuerza de voluntad de
    // guerrera, no por cálculo.
    atributoResistencia: 'fuerza',
    capturablePct: 0,
    loadout: [
      { itemSlug: 'cuchillo-hielo-silice' },
      { itemSlug: 'racion-viaje', cantidad: 2 },
    ],
  },
  {
    slug: 'maestra-peletera-helsig',
    name: 'Maestra Peletera Helsig',
    kind: 'PRINCIPAL',
    aliases: ['maestra peletera helsig'],
    faction: 'Clan Helsig',
    genero: 'F',
    role: 'Maestra Peletera del Clan Helsig',
    level: 5,
    attributes: { fuerza: 11, destreza: 15, constitucion: 12, inteligencia: 12, voluntad: 11, carisma: 10, magia: 2 },
    bio: 'Orca de manos ásperas por el manejo constante de pieles curtidas, siempre rodeada de cortes y retales a medio coser. Da forma a capas y forros reales de Helske Tugh a partir de lo que ya preparó la curtidora.',
    personality: 'Práctica, orgullosa de su trabajo sin alardear de él, generosa con los aprendices de verdad.',
    homeLocationSlug: 'campamento-helsig-interior',
    teachesProfession: 'peletero-orcos-cristal',
    interactionTypes: ['MAESTRO_OFICIO'],
    raza: 'orcos',
    clase: 'CAZADOR',
    especializacion: 'SUPERVIVENCIA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'destreza',
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'peletera-helsig',
    name: 'Peletera Helsig',
    kind: 'PRINCIPAL',
    aliases: ['peletera helsig'],
    faction: 'Clan Helsig',
    genero: 'F',
    role: 'Peletera del Clan Helsig',
    level: 1,
    attributes: { fuerza: 11, destreza: 15, constitucion: 12, inteligencia: 12, voluntad: 11, carisma: 10, magia: 2 },
    bio: 'Orca del Clan Helsig — manos ágiles pese al frío, siempre rodeada de pieles gruesas a medio coser en el interior de Helske Tugh. Da forma a los abrigos que mantienen vivo al clan en Cristal Helado.',
    personality: 'Callada mientras cose, habladora en cuanto suelta la aguja — cambia de humor de golpe.',
    homeLocationSlug: 'campamento-helsig-interior',
    teachesProfession: 'peletero-orcos-cristal',
    interactionTypes: ['MAESTRO_OFICIO'],
    raza: 'orcos',
    clase: 'CAZADOR',
    especializacion: 'SUPERVIVENCIA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 0,
    atributoResistencia: 'destreza',
    capturablePct: 20,
    loadout: [],
  },
  {
    slug: 'maestra-herrera-helsig',
    name: 'Maestra Herrera Helsig',
    kind: 'PRINCIPAL',
    aliases: ['maestra herrera helsig'],
    faction: 'Clan Helsig',
    genero: 'F',
    role: 'Maestra Herrera del Clan Helsig',
    level: 5,
    attributes: { fuerza: 11, destreza: 15, constitucion: 12, inteligencia: 12, voluntad: 11, carisma: 10, magia: 2 },
    bio: 'Orca del Clan Helsig — brazos marcados de quemaduras pequeñas, siempre junto a la fragua que nunca se apaga en el interior de Helske Tugh. Forja las armas y herramientas que el frío de Cristal Helado no perdona.',
    personality: 'Práctica, orgullosa de su trabajo sin alardear de él, generosa con los aprendices de verdad.',
    homeLocationSlug: 'campamento-helsig-interior',
    teachesProfession: 'herrero-orcos-cristal',
    interactionTypes: ['MAESTRO_OFICIO'],
    raza: 'orcos',
    clase: 'GUERRERO',
    especializacion: 'BERSERKER',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'destreza',
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'maestro-cocinero-helsig',
    name: 'Maestro Cocinero Helsig',
    kind: 'PRINCIPAL',
    aliases: ['maestro cocinero helsig'],
    faction: 'Clan Helsig',
    genero: 'M',
    role: 'Maestro Cocinero del Clan Helsig',
    level: 5,
    attributes: { fuerza: 11, destreza: 15, constitucion: 12, inteligencia: 12, voluntad: 11, carisma: 10, magia: 2 },
    bio: 'Orco del Clan Helsig — brazos gruesos, delantal manchado, vigila las ollas de Helske Tugh con la misma seriedad con la que otros vigilan la muralla. Sabe estirar una caza pobre para alimentar a todo el clan en pleno invierno.',
    personality: 'Bromista con quien colabora, seco con quien desperdicia comida.',
    homeLocationSlug: 'campamento-helsig-interior',
    teachesProfession: 'cocinero-orcos-cristal',
    interactionTypes: ['MAESTRO_OFICIO'],
    raza: 'orcos',
    clase: 'GUERRERO',
    especializacion: 'BERSERKER',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'destreza',
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'maestro-minero-helsig',
    name: 'Maestro Minero Helsig',
    kind: 'PRINCIPAL',
    aliases: ['maestro minero helsig'],
    faction: 'Clan Helsig',
    genero: 'M',
    role: 'Maestro Minero del Clan Helsig',
    level: 5,
    attributes: { fuerza: 11, destreza: 15, constitucion: 12, inteligencia: 12, voluntad: 11, carisma: 10, magia: 2 },
    bio: 'Orco del Clan Helsig — polvo de mineral incrustado en los nudillos, conoce cada galería excavada en el hielo de Cristal Helado como la palma de su mano. Sabe leer dónde vale la pena picar y dónde solo hay hielo muerto.',
    personality: 'Directo hasta lo brusco, más cómodo bajo tierra que rodeado de gente.',
    homeLocationSlug: 'campamento-helsig-interior',
    teachesProfession: 'minero-cristal',
    interactionTypes: ['MAESTRO_OFICIO'],
    raza: 'orcos',
    clase: 'GUERRERO',
    especializacion: 'ESPECIALISTA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'destreza',
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'maestro-herborista-helsig',
    name: 'Maestro Herborista Helsig',
    kind: 'PRINCIPAL',
    aliases: ['maestro herborista helsig'],
    faction: 'Clan Helsig',
    genero: 'M',
    role: 'Maestro Herborista del Clan Helsig',
    level: 5,
    attributes: { fuerza: 11, destreza: 15, constitucion: 12, inteligencia: 12, voluntad: 11, carisma: 10, magia: 2 },
    bio: 'Orco del Clan Helsig — conoce cada liquen y raíz que sobrevive al frío de Cristal Helado, y sabe cuáles curan y cuáles solo lo parecen. Sale a buscar plantas incluso con la peor ventisca.',
    personality: 'Reservado con los desconocidos, se abre en cuanto reconoce un interés real por las plantas.',
    homeLocationSlug: 'campamento-helsig-interior',
    teachesProfession: 'herborista-orcos-cristal',
    interactionTypes: ['MAESTRO_OFICIO'],
    raza: 'orcos',
    clase: 'CAZADOR',
    especializacion: 'SUPERVIVENCIA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'destreza',
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'maestra-alquimista-helsig',
    name: 'Maestra Alquimista Helsig',
    kind: 'PRINCIPAL',
    aliases: ['maestra alquimista helsig'],
    faction: 'Clan Helsig',
    genero: 'F',
    role: 'Maestra Alquimista del Clan Helsig',
    level: 5,
    attributes: { fuerza: 11, destreza: 15, constitucion: 12, inteligencia: 12, voluntad: 11, carisma: 10, magia: 2 },
    bio: 'Orca del Clan Helsig — dedos manchados de reactivos, siempre entre frascos y morteros en el rincón más caliente de Helske Tugh. Convierte lo que trae el herborista en algo que de verdad sirve.',
    personality: 'Meticulosa hasta la obsesión, explica cada paso aunque nadie se lo pida.',
    homeLocationSlug: 'campamento-helsig-interior',
    teachesProfession: 'alquimista-orcos-cristal',
    interactionTypes: ['MAESTRO_OFICIO'],
    raza: 'orcos',
    clase: 'CAZADOR',
    especializacion: 'INSTINTIVO',
    temperamento: 'CAUTELOSO',
    comerciablePct: 30,
    reclutablePct: 0,
    atributoResistencia: 'destreza',
    capturablePct: 0,
    loadout: [],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // REGIÓN: EL MARGEN SILENCIOSO
  // ══════════════════════════════════════════════════════════════════════════

  {
    slug: 'sella-marn',
    name: 'Sella Marn',
    kind: 'PRINCIPAL',
    // El Margen Silencioso, Nabieus — el hallazgo real que motivó este campo (auditoría 2026-08-14,
    // "creo que el nabierus era... Sella Marn" — apareció en combate pese a ser de una región
    // marcada "fuera del núcleo jugable actual" en todo el catálogo).
    nucleoJugable: false,
    aliases: ['sella marn', 'sella'],
    faction: null,
    role: 'Traficante de información independiente',
    level: 3,
    attributes: { fuerza: 5, destreza: 10, constitucion: 5, inteligencia: 15, voluntad: 10, carisma: 12, magia: 4 },
    bio: 'Nabieus del Margen Silencioso — piel gris apagada que no refleja ni absorbe la luz, cuerpo delgado y casi sin peso, como el resto de los suyos. Compra y vende información a ambas alianzas por igual, sin lealtades — y siempre parece saber justo lo que más incomodaría oír a quien tiene delante.',
    personality: 'Habla más alto que cualquier otro Nabieus — deliberadamente, un gesto casi obsceno entre los suyos que usa para incomodar y marcar distancia con su propio pueblo.',
    raza: 'nabieus',
    // Segador, exclusiva nabieus / Ilustrado (2026-08-24, Grupo 3 § Sistema de clases) — "traficante
    // de información independiente" es literalmente la identidad de Ilustrado ("lee el destino/
    // probabilidades, ventaja de información") — encaje temático directo.
    clase: 'SEGADOR',
    especializacion: 'ILUSTRADO',
    temperamento: 'CAUTELOSO',
    comerciablePct: 85,
    reclutablePct: 20,
    // Persuasión (2026-08-25) — traficante de información, resiste calculando, no con orgullo.
    atributoResistencia: 'inteligencia',
    capturablePct: 15,
    cortejablePct: 10,
    loadout: [],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // INVOCACIONES DE COMBATE (Fase 3 § 3d, 2026-08-27, docs/producto/21-roadmap.md) — ficha de catálogo
  // normal (kind PLANTILLA, repetible) para que un tótem invocado sea reconocible como cualquier
  // otro NPC en la Enciclopedia — se descubre solo, por mención en la narración de combate, mismo
  // mecanismo que el resto del catálogo (entityDiscovery.ts), sin campo de "temporalidad" nuevo:
  // el tótem individual dura 1-2 turnos en un combate concreto, pero su ficha es permanente. Sin
  // `raza`/`clase` (objeto invocado, no un ser inteligente con equipo propio, mismo criterio que
  // fauna) — el eje "humanoide no-inteligente estilo murloc" que la usuaria pidió para futuras
  // invocaciones queda deliberadamente sin construir aquí, ver memoria de sesión 2026-08-27.
  // ══════════════════════════════════════════════════════════════════════════

  {
    slug: 'totem-de-guerra',
    name: 'Tótem de Guerra',
    kind: 'PLANTILLA',
    aliases: ['totem de guerra', 'el totem'],
    faction: null,
    role: 'Invocación de combate del Chamán — aguanta un golpe, ataca dos turnos y desaparece',
    articulo: 'el',
    level: 1,
    attributes: { fuerza: 8, destreza: 6, constitucion: 4, inteligencia: 1, voluntad: 1, carisma: 1, magia: 10 },
    bio: 'Un tótem de madera y hueso tallado en plena batalla, clavado en tierra por un Chamán — no piensa ni actúa por voluntad propia, solo canaliza la magia de quien lo invocó mientras dura. Se astilla y cae al primer golpe certero que reciba, o en cuanto se agota su breve tiempo en pie.',
    personality: 'No tiene personalidad propia — objeto animado brevemente, no un ser con voluntad.',
    temperamento: 'AGRESIVO',
    ataqueNatural: 'Descarga de energía arcana concentrada a través de la talla del tótem',
    loadout: [],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // NPC DE PRUEBA POR RAZA (2026-09-01, petición explícita: "añade ya un npc genérico para cada
  // raza para este tipo de pruebas") — uno por raza jugable hoy sin representante combatible fácil
  // de forzar (Goirnte y Faerus tenían pasivas raciales sin confirmar en pantalla por falta de
  // escenario, no por bug; Faerus no tenía NINGÚN NPC en todo el catálogo). Viven en Las Agujas
  // Imán (hito sin dueño ni facción) para no tocar contenido narrativo real. `temperamento:
  // 'AGRESIVO'` para poder combatirlos directo, sin depender de random de hostilidad. Clase = la
  // exclusiva de su propia raza (mismo criterio que el resto del catálogo humanoide), nivel 1
  // (tronco común real ya construido para las 3).
  //
  // `nucleoJugable: false` (mismo criterio que Sella Marn) — bloqueo real confirmado dos veces esta
  // misma sesión: (1) sin ella, `detectNpcsInScene` (npcScene.ts) los descarta ANTES de comprobar
  // "itinerante sin homeLocationSlug", así que no pueden aparecer en escena la primera vez sin un
  // `NpcState` ya existente; (2) sin ella, al ser itinerantes sin `homeLocationSlug`, son candidatos
  // en CUALQUIER ubicación del mundo — rompió 2 tests de integración reales de
  // `turn.integration.test.ts` que no esperaban verlos en escena (uno de ellos en la misma
  // `hondonada-del-eco` usada para forzarlos en vivo). Para usarlos de verdad: crear a mano el
  // `NpcState` de la partida real primero (`INSERT INTO "NpcState" (saveId, npcId, scope,
  // condicionFisica, ...)`, mismo patrón que Sella Marn) — eso libera el candado SOLO para esa
  // partida concreta (`encounteredIds`, npcScene.ts, es por `saveId`), sin volver itinerantes
  // universales para el resto del mundo/tests.
  // ══════════════════════════════════════════════════════════════════════════

  {
    slug: 'goirnte-renegado',
    name: 'Goirnte Renegado',
    kind: 'PLANTILLA',
    nucleoJugable: false,
    aliases: ['goirnte renegado', 'renegado'],
    faction: null,
    role: 'NPC de prueba — Goirnte hostil sin trama, para verificar mecánica de raza/clase en vivo',
    articulo: 'el',
    level: 1,
    attributes: { fuerza: 10, destreza: 8, constitucion: 12, inteligencia: 8, voluntad: 8, carisma: 6, magia: 2 },
    bio: 'Un Goirnte expulsado de la Meseta del Orden por una deuda de honor que nunca reconoció — deambula solo por Las Agujas Imán, armado y desconfiado de cualquiera que se acerque.',
    personality: 'Cortante, calculador, sin paciencia para explicaciones.',
    raza: 'goirntes',
    clase: 'CABALLERO',
    especializacion: 'CABALLERO_DEL_VALOR',
    temperamento: 'AGRESIVO',
    loadout: [],
  },

  {
    slug: 'faerus-erratico',
    name: 'Faerus Errático',
    kind: 'PLANTILLA',
    nucleoJugable: false,
    aliases: ['faerus erratico', 'errático'],
    faction: null,
    role: 'NPC de prueba — Faerus hostil sin trama, para verificar mecánica de raza/clase en vivo',
    articulo: 'el',
    level: 1,
    attributes: { fuerza: 8, destreza: 12, constitucion: 8, inteligencia: 6, voluntad: 6, carisma: 6, magia: 6 },
    bio: 'Un Faerus separado de su manada, errante entre Las Agujas Imán — el campo magnético confunde su olfato y lo deja al borde de la agresión constante.',
    personality: 'Nervioso, reactivo, ataca antes de que le ataquen.',
    raza: 'faerus',
    clase: 'DRUIDA',
    especializacion: 'CAMBIAFORMAS',
    temperamento: 'AGRESIVO',
    loadout: [],
  },

  {
    slug: 'nabieus-enloquecido',
    name: 'Nabieus Enloquecido',
    kind: 'PLANTILLA',
    nucleoJugable: false,
    aliases: ['nabieus enloquecido', 'enloquecido'],
    faction: null,
    role: 'NPC de prueba — Nabieus hostil sin trama, para verificar mecánica de raza/clase en vivo',
    articulo: 'el',
    level: 1,
    attributes: { fuerza: 6, destreza: 10, constitucion: 6, inteligencia: 12, voluntad: 8, carisma: 4, magia: 8 },
    bio: 'Un Nabieus que perdió el contacto con El Margen Silencioso hace demasiado — su calma característica se rompió en algo más errático e imprevisible, sin dejar de ser frío y calculador a su manera.',
    personality: 'Impredecible, frío pese a todo, no negocia.',
    raza: 'nabieus',
    clase: 'SEGADOR',
    especializacion: 'PARCA',
    temperamento: 'AGRESIVO',
    loadout: [],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // REGIÓN: CIÉNAGA TRONCAL — LÍDERES DEL CLAN GOSHG
  // ══════════════════════════════════════════════════════════════════════════
  // Ya documentadas en prosa desde antes (campamento-goshg-interior, factions § clan-goshg) pero
  // sin ficha Npc real hasta ahora (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.3, 2026-09-21 — motor de
  // disputas de facción necesita un líder real del que leer Inteligencia, mismo criterio que
  // Brenka/Solgra para Helsig). `nucleoJugable: false` (mismo criterio que Hagar Kiugh/Sella Marn):
  // Ciénaga Troncal sigue "fuera del núcleo jugable actual" (ver campamento-goshg más arriba) — no
  // deben aparecer en escena normal todavía, solo existir como dato de catálogo real.

  {
    slug: 'doshka',
    name: 'Doshka',
    kind: 'PRINCIPAL',
    nucleoJugable: false,
    aliases: ['doshka', "terk'ikar doshka", 'terk\'ikar del clan goshg'],
    faction: 'Clan Goshg',
    genero: 'F',
    role: "Terk'ikar del Clan Goshg",
    level: 20,
    attributes: { fuerza: 13, destreza: 12, constitucion: 17, inteligencia: 15, voluntad: 18, carisma: 16, magia: 0 },
    bio: 'Orca del Clan Goshg, de las dos tribus hermanadas de Ciénaga Troncal — gobierna Silh Makut desde el salón Goshg\'sedsar, manos curtidas de tallar tótems en la misma madera oscura que trabaja su gente. Reparte la caza de Trepadores Ocaso y Cornantes entre las dos tribus con el mismo cuidado con que casa a sus jóvenes entre sí. Su hermano menor, el Kort\'ikar Dulgren, lidera la guerra mientras ella sostiene el resto — mantiene, como los Helsig, un perfil neutral y defensivo ante los Goirntes.',
    personality: 'Paciente y conciliadora entre las dos tribus, pero inflexible en cuanto a mantener el perfil bajo del clan ante forasteros.',
    homeLocationSlug: 'campamento-goshg-interior',
    raza: 'orcos',
    clase: 'GUERRERO',
    especializacion: 'GUARDIAN',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 0,
    // Persuasión (2026-08-25, mismo criterio ya aplicado a Brenka) — conciliadora pero firme, cede
    // solo ante razones bien calculadas, nunca por presión emocional.
    atributoResistencia: 'voluntad',
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'dulgren',
    name: 'Dulgren',
    kind: 'PRINCIPAL',
    nucleoJugable: false,
    aliases: ['dulgren', "kort'ikar dulgren", 'kort\'ikar del clan goshg'],
    faction: 'Clan Goshg',
    genero: 'M',
    role: "Kort'ikar del Clan Goshg",
    level: 20,
    attributes: { fuerza: 18, destreza: 15, constitucion: 18, inteligencia: 10, voluntad: 14, carisma: 11, magia: 0 },
    bio: 'Orco del Clan Goshg, hermano menor de la Terk\'ikar Doshka — complexión recia de quien caza Cornantes en aguas poco profundas, cicatrices de dientes y garras en los antebrazos. Lidera la guerra y la defensa de las dos tribus mientras Doshka gobierna el resto. Mantiene, como los Helsig, un perfil neutral y defensivo ante los Goirntes, evitando la confrontación abierta salvo que el clan esté en juego de verdad.',
    personality: 'Protector hasta lo brusco, nunca decide nada que afecte al clan entero sin hablarlo antes con Doshka.',
    homeLocationSlug: 'campamento-goshg-interior',
    raza: 'orcos',
    clase: 'CAZADOR',
    especializacion: 'SUPERVIVENCIA',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 0,
    // Persuasión (2026-08-25, mismo criterio ya aplicado a Solgra) — resiste por pura fuerza de
    // voluntad de guerrero, no por cálculo.
    atributoResistencia: 'fuerza',
    capturablePct: 0,
    loadout: [],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TANDA OpenCode 2026-09-27/28 — lore aprobado en docs/borradores-opencode/propuestas-aprobadas.md
  // ══════════════════════════════════════════════════════════════════════════

  // A-37 — Primer Censor Tarsen Vold: líder de la facción radical de la Concordia de Hierro,
  // sustituye a Yovenne Tal como líder de esa Faction (ver seed-catalog.ts § FACTION_LEADER_SLUG).
  // `nucleoJugable: false` — La Meseta del Orden no es jugable todavía, mismo criterio que Yovenne
  // Tal/Vrask Ombra/Kael Dorn.
  {
    slug: 'tarsen-vold',
    name: 'Tarsen Vold',
    kind: 'PRINCIPAL',
    nucleoJugable: false,
    aliases: ['tarsen vold', 'primer censor', 'primer censor tarsen vold'],
    faction: 'Concordia de Hierro',
    genero: 'M',
    articulo: 'el',
    role: 'Primer Censor de la Concordia de Hierro, líder de la facción radical',
    level: 7,
    attributes: { fuerza: 9, destreza: 9, constitucion: 11, inteligencia: 16, voluntad: 15, carisma: 12, magia: 3 },
    bio: 'Goirnte alto y enjuto, con la piel gris casi azulada por los años de archivo y la cabeza afeitada. Los ojos obsidiana no se apartan nunca de quien le habla. Viste la toga gris de la casta de ley, sin una sola insignia — presume de no necesitarlas. Es el líder de la facción radical y, por tanto, de la Concordia de Hierro: no es un general, eso es Vrask Ombra, sino un censor, de la misma casta de ley que Yovenne Tal. Esa es la tragedia política de la Meseta: las dos cabezas del orden salieron de la misma casta y leyeron las mismas leyes. Donde Yovenne lee "el edicto obliga también al que lo grabó", Tarsen lee "el orden que no se defiende no es orden". Pertenece a los círculos radicales que conocen la verdad completa del Detonante; qué sabe exactamente queda reservado. Vrask Ombra le obedece sin creerle. A Yovenne la respeta como rival legítima: nunca la ha amenazado, porque eso sería desorden. Kael Dorn es el cabo suelto que más le preocupa.',
    personality: 'Frío, paciente, convencido. No odia a nadie: ordena. Habla en frases completas, sin prisa, y termina siempre lo que empieza. Nunca levanta la voz. No le hace falta.',
    raza: 'goirntes',
    clase: 'CABALLERO',
    especializacion: 'CABALLERO_DEL_ORDEN',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 0,
    cortejablePct: 0,
    atributoResistencia: 'voluntad',
    capturablePct: 0,
    loadout: [
      { itemSlug: 'sello-anular-concordia' },
      { itemSlug: 'correspondencia-concordia' },
    ],
  },

  // A-38 — Cinco Faerus de Hashma (Feg Tusha), en el interior vacío campamento-feg-tusha-interior.
  // `nucleoJugable: false` — El Margen Silencioso fuera del núcleo jugable. `capturablePct: 0`
  // (raza sintiente jugable). Hulki es el `liderNpcId` de la Faction feg-tusha (A-04).
  {
    slug: 'hulki',
    name: 'Hulki',
    kind: 'PRINCIPAL',
    nucleoJugable: false,
    aliases: ['hulki'],
    faction: 'Feg Tusha',
    genero: 'F',
    role: 'La que más a menudo está en el Jakut Tusha',
    level: 18,
    attributes: { fuerza: 12, destreza: 15, constitucion: 12, inteligencia: 20, voluntad: 22, carisma: 10, magia: 8 },
    bio: 'Vieja, con el pelaje encanecido en el hocico, delgada pero con los hombros de quien ha cargado presas toda la vida. Piel de hojas finas que susurra al moverse cuando quiere que se le oiga; pelaje denso en tonos de corteza y musgo, como toda la manada de Hashma. Se sienta en el Jakut Tusha más que nadie porque casi nadie le disputa el sitio: huele el miedo ajeno antes de que el otro sepa que lo tiene. Es quien decide si un forastero pasa del primer árbol. No es un cargo — es el sitio desde el que se decide mientras se está sentada en él.',
    personality: 'Paciente, seca, imposible de engañar.',
    homeLocationSlug: 'campamento-feg-tusha-interior',
    raza: 'faerus',
    clase: 'DRUIDA',
    especializacion: 'AULLADOR',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 0,
    cortejablePct: 0,
    atributoResistencia: 'voluntad',
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'tira',
    name: 'Tira',
    kind: 'PRINCIPAL',
    nucleoJugable: false,
    aliases: ['tira'],
    faction: 'Feg Tusha',
    genero: 'F',
    role: 'Cazadora mayor: reparte la primera pieza',
    level: 6,
    attributes: { fuerza: 13, destreza: 15, constitucion: 11, inteligencia: 11, voluntad: 10, carisma: 6, magia: 3 },
    bio: 'Cicatrices de garra de Ferike en un antebrazo. Es quien corta y reparte la Vash\'grath (la primera pieza) en cada caza de la manada, y por tanto quien sabe de verdad quién es de la manada y quién no. Si un forastero come de su mano, algo ha cambiado.',
    personality: 'Directa, justa hasta la dureza.',
    homeLocationSlug: 'campamento-feg-tusha-interior',
    raza: 'faerus',
    clase: 'CAZADOR',
    especializacion: 'INSTINTIVO',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 10,
    atributoResistencia: 'voluntad',
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'kiri',
    name: 'Kiri',
    kind: 'PRINCIPAL',
    nucleoJugable: false,
    aliases: ['kiri'],
    faction: 'Feg Tusha',
    genero: 'M',
    role: 'Vigía del dosel',
    level: 5,
    attributes: { fuerza: 10, destreza: 16, constitucion: 9, inteligencia: 10, voluntad: 9, carisma: 4, magia: 5 },
    bio: 'Joven, delgado y de brazos largos. Pasa las noches en el dosel en forma de Hetris — su forma de Cambiaformas es fauna real del Margen. Es el primero que ve llegar a una patrulla y el último en bajar.',
    personality: 'Callado, nervioso en el suelo y tranquilo en las ramas.',
    homeLocationSlug: 'campamento-feg-tusha-interior',
    raza: 'faerus',
    clase: 'DRUIDA',
    especializacion: 'CAMBIAFORMAS',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 15,
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'lusa',
    name: 'Lusa',
    kind: 'PRINCIPAL',
    nucleoJugable: false,
    aliases: ['lusa'],
    faction: 'Feg Tusha',
    genero: 'F',
    role: 'Cuida a los Feg\'nur, los heridos que no se abandonan',
    level: 4,
    attributes: { fuerza: 7, destreza: 10, constitucion: 10, inteligencia: 13, voluntad: 14, carisma: 9, magia: 6 },
    bio: 'Mayor, de movimientos lentos. Cuida en una plataforma aparte a los heridos de la manada, con Musgo Callado para que duerman y Flor de Víspera para calmarlos. Es lo más parecido a una sanadora que tienen los Faerus, aunque no enseña ningún oficio del motor: el oficio de curación Faerus está por diseñar.',
    personality: 'Cálida con los suyos y fría con los demás, hasta que un forastero herido le cambia el juicio.',
    homeLocationSlug: 'campamento-feg-tusha-interior',
    raza: 'faerus',
    clase: 'DRUIDA',
    especializacion: 'ADAPTADO',
    temperamento: 'AMIGABLE',
    comerciablePct: 0,
    reclutablePct: 0,
    cortejablePct: 0,
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'gero',
    name: 'Gero',
    kind: 'PRINCIPAL',
    nucleoJugable: false,
    aliases: ['gero'],
    faction: 'Feg Tusha',
    genero: 'M',
    role: 'Joven corredor entre Hashma y Kegi',
    level: 3,
    attributes: { fuerza: 10, destreza: 14, constitucion: 10, inteligencia: 9, voluntad: 8, carisma: 7, magia: 3 },
    bio: 'Joven de pelaje menos denso que el resto: tiene madre de Kegi. Lleva y trae noticias entre las dos manadas. Es el Faerus más fácil de encontrar fuera del Margen y el único de Hashma que ha hablado alguna vez con un orco.',
    personality: 'Curioso, impulsivo y hablador para ser Faerus.',
    homeLocationSlug: 'campamento-feg-tusha-interior',
    raza: 'faerus',
    clase: 'CAZADOR',
    especializacion: 'SUPERVIVENCIA',
    temperamento: 'AMIGABLE',
    comerciablePct: 0,
    reclutablePct: 25,
    cortejablePct: 10,
    atributoResistencia: 'carisma',
    capturablePct: 0,
    loadout: [],
  },

  // A-39 — Dos Faerus de Kegi (Feg Ger). Yeru es el `liderNpcId` de la Faction feg-ger (A-05).
  // Tasko lleva su Ashi'krul de serie (A-32).
  {
    slug: 'yeru',
    name: 'Yeru',
    kind: 'PRINCIPAL',
    nucleoJugable: false,
    aliases: ['yeru'],
    faction: 'Feg Ger',
    genero: 'F',
    role: 'La que más a menudo está en el Jakut Ger',
    level: 18,
    attributes: { fuerza: 19, destreza: 18, constitucion: 16, inteligencia: 17, voluntad: 16, carisma: 12, magia: 5 },
    bio: 'Pelaje corto, rojizo con matices verdes, más fino que el de Hashma — piel de hojas que susurra. Madura, fuerte y de hombros anchos para ser Faerus, con una muesca en la oreja izquierda. Conoció a Gorhorn durante el año que pasó con la manada: lo recuerda como "el orco que olía a pena y no a miedo". Nunca compartió con él la primera pieza, y aún no sabe si fue un error. Si Gorhorn vuelve a Kegi, podría ofrecerle la Vash\'grath — sería el primer orco en recibirla desde los Maktor, y renovaría el pacto antiguo. Es una misión posible, no un hecho canonizado.',
    personality: 'Reservada y leal. Pone a prueba antes de confiar.',
    homeLocationSlug: 'jakut-ger-interior',
    raza: 'faerus',
    clase: 'DRUIDA',
    especializacion: 'SALVAJE',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 0,
    atributoResistencia: 'voluntad',
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'tasko',
    name: 'Tasko',
    kind: 'PRINCIPAL',
    nucleoJugable: false,
    aliases: ['tasko'],
    faction: 'Feg Ger',
    genero: 'M',
    role: 'Curtidor y tallador de Kegi',
    level: 5,
    attributes: { fuerza: 11, destreza: 14, constitucion: 10, inteligencia: 12, voluntad: 9, carisma: 10, magia: 2 },
    bio: 'Joven para su oficio, con las manos manchadas de tanino. Talla las dagas Ashi\'krul y lleva el comercio en El Vergel de Kegi. Es el único Faerus que regatea, y lo hace fatal.',
    personality: 'Entusiasta, charlatán y nada diplomático.',
    homeLocationSlug: 'yegr-kegi',
    raza: 'faerus',
    clase: 'GUERRERO',
    especializacion: 'ESPECIALISTA',
    temperamento: 'AMIGABLE',
    comerciablePct: 60,
    reclutablePct: 15,
    atributoResistencia: 'carisma',
    capturablePct: 0,
    loadout: [
      { itemSlug: 'ashi-krul' },
      { itemSlug: 'colmillo-ferike', cantidad: 3 },
    ],
  },

  // P-04 — NPC Nabieus: portavoces/líderes de Keseg Sael y Keseg Prisilke (A-02/A-03).
  {
    slug: 'aven-tessk',
    name: 'Aven Tessk',
    kind: 'PRINCIPAL',
    nucleoJugable: false,
    aliases: ['aven tessk', 'aven'],
    faction: 'Keseg Sael',
    genero: 'M',
    articulo: 'el',
    role: 'Portavoz del cónclave de Keseg Sael',
    level: 16,
    attributes: { fuerza: 5, destreza: 8, constitucion: 6, inteligencia: 18, voluntad: 18, carisma: 9, magia: 4 },
    bio: 'Viejo, casi transparente a la vista, se sabe de memoria cientos de tablillas del Archivo del Refugio sin Nombre. No es líder: repite, con una voz que es poco más que aire, lo último que decidió el Keseg\'Vhurne (el cónclave), y se calla si nadie ha decidido nada. Sabe que el nombre de Yerin Slaad figura en los registros de la carta del sabotaje, y el cónclave lo protege sin decírselo: es de los suyos y lleva la culpa de todos.',
    personality: 'Nunca termina una frase que el otro pueda terminar por él.',
    homeLocationSlug: 'refugio-sin-nombre',
    raza: 'nabieus',
    clase: 'SEGADOR',
    especializacion: 'ILUSTRADO',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 0,
    atributoResistencia: 'voluntad',
    capturablePct: 0,
    loadout: [],
  },
  {
    slug: 'ilka-dren',
    name: 'Ilka Dren',
    kind: 'PRINCIPAL',
    nucleoJugable: false,
    aliases: ['ilka dren', 'ilka'],
    faction: 'Keseg Prisilke',
    genero: 'F',
    role: 'Cazadora mayor de Jeyselt, trata con los Goshg',
    level: 14,
    attributes: { fuerza: 10, destreza: 17, constitucion: 11, inteligencia: 14, voluntad: 13, carisma: 8, magia: 2 },
    bio: 'Brazos y piernas largos, manchas verdes hasta el cuello y la postura encorvada de la rama de la Ciénaga. Lee el agua metiendo la pierna hasta la rodilla y sabe cuántos Borboles hay en una charca antes de verlos. Negocia la madera con la Terk\'ikar Doshka de igual a igual, y le cae mejor que cualquier Nabieus del Margen.',
    personality: 'Susurra, pero sin las pausas cargadas del Margen; dice lo que piensa.',
    homeLocationSlug: 'conclave-keseg-prisilke-interior',
    raza: 'nabieus',
    clase: 'CAZADOR',
    especializacion: 'INSTINTIVO',
    temperamento: 'CAUTELOSO',
    comerciablePct: 0,
    reclutablePct: 0,
    atributoResistencia: 'destreza',
    capturablePct: 0,
    loadout: [],
  },
];

/// Potencial de oficio de los NPC de facción (docs/producto/plan-roadmap-oct-2026.md § 13-A, H-8),
/// sembrado en `NpcProfessionPotential`/`NpcProfessionProgress` por seed-catalog.ts. Escrito a mano,
/// mismo criterio que `teachesProfession`. Valores por defecto del plan (pendientes de revisión de
/// Álvaro): Maestro/a (`teachesProfession`) → tope 9; trabajador cuyo `role`
/// NOMBRA un oficio → tope 6. Todos empiezan en nivel 1 sin XP (decisión de Álvaro, 2026-09-29). Guerreros, guardias, líderes, chamanes, cazadores y fauna:
/// sin entrada. Nunca se inventa un oficio que el `role` no diga; un oficio sin `professionId` en
/// data/professions.ts se omite (hoy: "Ganadero" de ganadero-serhu, "tallador" de Tasko no es el
/// oficio `talador`, que es tala).
export interface NpcProfessionPotentialInput {
  professionId: string;
  nivelMaximo: number;
  nivelInicial: number;
}

const MAESTRO = { nivelMaximo: 9, nivelInicial: 1 } as const;
const TRABAJADOR = { nivelMaximo: 6, nivelInicial: 1 } as const;

export const npcProfessionPotentials: Record<string, NpcProfessionPotentialInput[]> = {
  // --- Clan Serhu (orcos, Llanuras): Maestros ---
  'maestro-herrero-serhu': [{ professionId: 'herrero-orcos-llanuras', ...MAESTRO }],
  'maestra-curtidora-serhu': [{ professionId: 'curtidor-orcos-llanuras', ...MAESTRO }],
  'maestro-cocinero-serhu': [{ professionId: 'cocinero-orcos-llanuras', ...MAESTRO }],
  'maestra-herborista-serhu': [{ professionId: 'herborista-orcos-llanuras', ...MAESTRO }],
  'maestro-alquimista-serhu': [{ professionId: 'alquimista-orcos-llanuras', ...MAESTRO }],
  'maestro-domador-serhu': [{ professionId: 'domador-orcos-llanuras', ...MAESTRO }],
  'maestro-desollador-serhu': [{ professionId: 'desollador-orcos-llanuras', ...MAESTRO }],
  'maestro-peletero-serhu': [{ professionId: 'peletero-orcos-llanuras', ...MAESTRO }],
  'maestra-primeros-auxilios-serhu': [{ professionId: 'primeros-auxilios-orcos-llanuras', ...MAESTRO }],
  'maestro-pescador-serhu': [{ professionId: 'pescador', ...MAESTRO }],
  'maestro-carpintero-serhu': [{ professionId: 'carpintero-orcos-llanuras', ...MAESTRO }],
  'maestra-sastre-serhu': [{ professionId: 'sastre-orcos-llanuras', ...MAESTRO }],
  // --- Clan Serhu: trabajadores cuyo `role` nombra el oficio ---
  'herrero-serhu': [{ professionId: 'herrero-orcos-llanuras', ...TRABAJADOR }],
  'herrera-serhu': [{ professionId: 'herrero-orcos-llanuras', ...TRABAJADOR }],
  'curtidora-serhu': [{ professionId: 'curtidor-orcos-llanuras', ...TRABAJADOR }],
  'curtidor-serhu': [{ professionId: 'curtidor-orcos-llanuras', ...TRABAJADOR }],
  'cocinero-serhu': [{ professionId: 'cocinero-orcos-llanuras', ...TRABAJADOR }],
  'desolladora-serhu': [{ professionId: 'desollador-orcos-llanuras', ...TRABAJADOR }],
  'peletero-serhu': [{ professionId: 'peletero-orcos-llanuras', ...TRABAJADOR }],
  'pescador-serhu': [{ professionId: 'pescador', ...TRABAJADOR }],
  'pescadora-serhu': [{ professionId: 'pescador', ...TRABAJADOR }],
  // --- Clan Helsig (orcos, Cristal): Maestros (peletera-helsig también enseña `peletero-orcos-cristal`) ---
  'maestra-peletera-helsig': [{ professionId: 'peletero-orcos-cristal', ...MAESTRO }],
  'peletera-helsig': [{ professionId: 'peletero-orcos-cristal', ...MAESTRO }],
  'maestra-herrera-helsig': [{ professionId: 'herrero-orcos-cristal', ...MAESTRO }],
  'maestro-cocinero-helsig': [{ professionId: 'cocinero-orcos-cristal', ...MAESTRO }],
  'maestro-minero-helsig': [{ professionId: 'minero-cristal', ...MAESTRO }],
  'maestro-herborista-helsig': [{ professionId: 'herborista-orcos-cristal', ...MAESTRO }],
  'maestra-alquimista-helsig': [{ professionId: 'alquimista-orcos-cristal', ...MAESTRO }],
  // --- Clan Helsig: "Minero de hielo sílice" ---
  'hagar-kiugh': [{ professionId: 'minero-cristal', ...TRABAJADOR }],
  // --- Feg Ger (faerus, Llanuras — Yegr Kegi): "Curtidor y tallador de Kegi" ---
  tasko: [{ professionId: 'curtidor-faerus-llanuras', ...TRABAJADOR }],
};


export interface ItemCatalogInput {
  slug: string;
  name: string;
  /// Formas reales de referirse al objeto, más cortas/coloquiales que el nombre completo del
  /// catálogo ("hacha de mano" en vez de "Hacha de mano orca") — mismo campo y propósito que
  /// Npc.aliases (auditoría 2026-07-30, "revisar partida": ni la Enciclopedia progresiva
  /// (entityDiscovery.ts) ni el texto clicable de narración (enciclopediaIndex.ts, frontend)
  /// reconocían nada que no fuera el nombre EXACTO y completo). Verificado sin colisiones contra
  /// el resto del catálogo (ver scripts/_checkItemAliases.ts, ya borrado tras usarlo) — nunca un
  /// sustantivo genérico corto (mismo motivo que itemReference.ts: "res" o "daga" sueltos
  /// matchean dentro de cualquier palabra que los contenga como substring, sin límite de palabra
  /// en entityDiscovery.ts). Omitido = sin alias, el nombre completo sigue siendo reconocible.
  aliases?: string[];
  category: string;
  /// Ranura de equipo (2026-07-30, petición explícita: "categorizar por ranura para que no pueda
  /// poner un casco en los pies") — solo con sentido en `tipo: EQUIPABLE`; null en el resto
  /// (nunca se equipan). Familia, no exacto: ARMA_PRINCIPAL/ANILLO_1 aquí valen también para
  /// ARMA_SECUNDARIA/ANILLO_2 (ver `equipSlotFamily`, equipment.ts) — cualquier arma va en
  /// cualquier mano, cualquier anillo en cualquier dedo.
  equipSlot?: EquipSlot;
  /// Restricción de armadura por peso (2026-08-31, clases.md § "Restricción de armadura por
  /// peso") — solo con sentido en las 6 ranuras de armadura real (CASCO/ARMADURA_SUPERIOR/
  /// ARMADURA_INFERIOR/GUANTES/BOTAS/CINTURON); omitido en el resto. Ver `pesoArmaduraPermitidoFor`
  /// (weaponAbilities.ts) para qué clases pueden equipar cada tramo.
  pesoArmadura?: PesoArmadura;
  /// Categorización mecánica (2026-07-29) — ver itemTaxonomy.ts. `category` (arriba) sigue
  /// siendo el subtipo fino DENTRO de este tipo.
  tipo: ItemTipo;
  description: string;
  /// Bonificadores reales al equipar (2026-07-19; mapa múltiple desde 2026-08-03, sustituye al
  /// par statBonusAttribute/statBonusAmount) — armas (uno o más de los 7 atributos jugables) y,
  /// desde el slot de defensa, armaduras reales ('defensa', resta a la dificultad de contraataque
  /// en npcScene.ts). El resto del catálogo sigue siendo puramente narrativo.
  /// 'inventorySlots' (rediseño de profesiones, 2026-08-07): cosméticos con +N slots de
  /// inventario, ver `effectiveInventorySlotsBonus` (equipment.ts) — el tipo del catálogo de seed
  /// no lo incluía todavía porque hasta el 2026-09-02 ningún objeto real lo usaba.
  statBonuses?: Partial<Record<Attribute | 'defensa' | 'inventorySlots', number>>;
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
  /// Tope real de curación al usar este objeto (2026-07-29) — solo con sentido en objetos
  /// `category: 'medicinal'` que de verdad traten heridas (no antídotos/sedantes). Omitido = no
  /// cura condición física. Ver comentario del campo homónimo en schema.prisma.
  curaHasta?: 'GRAVE' | 'HERIDO' | 'ILESO';
  /// Primeros auxilios (2026-08-13) — con `curaHasta` puesto, decide si este objeto rompe el tope
  /// de golpe (comportamiento normal, `false`/omitido) o solo sube UN escalón como mucho, con
  /// `curaHasta` de tope de ESE escalón (ver healCeilingFor, death.ts). Ver comentario del campo
  /// homónimo en schema.prisma.
  curaUnPaso?: boolean;
  /// Categoría de arma (2026-07-29, sistema de habilidades por arma) — decide qué atributo usa
  /// la habilidad de ataque/defensa que este objeto genera al equiparlo. Solo en `category: 'arma'`.
  tipoArma?: WeaponCategory;
  /// Cantidad de energía que restaura al usarlo (2026-07-29, sistema de fatiga) — mismo criterio
  /// que `curaHasta` pero numérico. Omitido = no restaura energía.
  curaEnergia?: number;
  /// Puntos porcentuales de Hambre que restaura al usarlo (2026-09-04, habilidad "Comer/Beber") —
  /// mismo criterio que `curaEnergia` pero sobre el pool de Hambre. Omitido = no sacia hambre.
  curaHambre?: number;
  /// Puntos porcentuales de Sed que restaura al usarlo (hallazgo 13, revisar-partida-hallazgos.md
  /// 2026-09-06) — mismo criterio que `curaHambre` pero sobre el pool de Sed. Omitido = no sacia
  /// sed.
  curaAgua?: number;
  /// Slug de ItemCatalog que se inserta en el inventario al consumir este ítem (hallazgo 13) —
  /// caso único hoy: el odre de agua lleno devuelve el odre vacío al beberse. Omitido = el ítem
  /// se borra/reduce sin más al consumirse, sin dejar nada a cambio.
  emptyContainerCatalogSlug?: string;
  /// Solo en `tipo: 'ESPECIAL'` (2026-08-03) — clave estable que un sistema concreto consulta
  /// para activar su propio comportamiento (p.ej. `'reveal-map-llanuras'`, MapaPanel.tsx) y texto
  /// explicando el efecto para mostrar en inventario/detalle, aparte de `description`. Ver
  /// comentario de ambos campos en schema.prisma.
  effectKey?: string;
  effectDescription?: string;
  /// Oficios (prefijo sin raza/región) para los que este objeto cuenta como herramienta requerida
  /// (2026-08-17) — ver comentario del campo homónimo en schema.prisma. Omitido = `[]`, no cuenta
  /// como herramienta de ningún oficio.
  herramientaParaOficio?: string[];
  /// Valor económico en Goirnos, moneda única de Berig (2026-08-31, sistema de economía) —
  /// obligatorio, no opcional: todo objeto del catálogo tiene un precio, aunque sea 0 (reliquias/
  /// objetos de misión no vendibles, con comentario explicando por qué). Fórmula base determinista
  /// por `tipo`/`tier`/`statBonuses`/`curaEnergia`/`curaHasta` en `valorGoirnosBaseFor`
  /// (services/economia.ts) — el valor de cada entrada de abajo parte de esa fórmula pero puede
  /// estar AJUSTADO a mano contra el lore real (rareza de `lugarOrigen`, objetos codiciados según
  /// `description`, reliquias sin mercado). Primer consumidor real: aprender un oficio de un NPC
  /// (10 Goirnos o trueque equivalente).
  valorGoirnos: number;
}

export const items: ItemCatalogInput[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // TIPO: EQUIPABLE
  // ══════════════════════════════════════════════════════════════════════════

  // --- arma ---

  {
    slug: 'cuchillo-corto',
    name: 'Cuchillo corto',
    category: 'arma',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMA_PRINCIPAL',
    description: 'Hoja corta de hierro sin adornos, mango de madera desgastada — común, sin origen especial.',
    statBonuses: { destreza: 3 },
    dimensiones: 'Hoja de 15 cm, mango de 10 cm.',
    tier: 2,
    valorGoirnos: 16,
    requisitos: { destreza: 10, fuerza: 6 },
    tipoArma: 'CUCHILLO',
  },

  {
    slug: 'cuchillo-hielo-silice',
    name: 'Cuchillo de hielo sílice',
    aliases: ['cuchillo de sílice'],
    category: 'arma',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMA_PRINCIPAL',
    description: 'Hoja de hielo sílice de un blanco azulado translúcido, extremadamente dura y fría al tacto incluso lejos de la montaña, con la empuñadura de hueso tallada con marcas rúnicas — filo mineral, comercio con los Helsig.',
    statBonuses: { destreza: 2 },
    dimensiones: 'Hoja de 18 cm, empuñadura de 10 cm.',
    lugarOrigen: 'Clan Helsig, minas de Cristal Helado.',
    tier: 1,
    valorGoirnos: 9,
    requisitos: { destreza: 6 },
    tipoArma: 'CUCHILLO',
    // Arma Y herramienta a la vez (2026-08-17, petición explícita: "vale también para poder hacer
    // crafteos con peletería o usar la recolección de desuello") — filo lo bastante fino para
    // despellejar/curtir, no solo para pelear.
    herramientaParaOficio: ['curtidor', 'desollador'],
  },

  {
    slug: 'daga-aleacion-goirntes',
    name: 'Daga de aleación goirntes',
    aliases: ['daga de aleación'],
    category: 'arma',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMA_PRINCIPAL',
    description: 'Hoja corta de aleación gris pulida, empuñadura ajustada — manufactura refinada goirntes.',
    statBonuses: { destreza: 3 },
    dimensiones: 'Hoja de 20 cm.',
    lugarOrigen: 'Manufactura goirnte, Meseta del Orden.',
    tier: 2,
    valorGoirnos: 16,
    requisitos: { destreza: 11, fuerza: 5 },
    tipoArma: 'DAGA',
  },

  {
    slug: 'espada-corta-goirntes',
    name: 'Espada corta goirntes',
    aliases: ['espada corta'],
    category: 'arma',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMA_PRINCIPAL',
    description: 'Hoja recta de aleación gris pulida, más ligera y mejor equilibrada que cualquier arma orca — manufactura goirnte, refinada hasta en el filo.',
    statBonuses: { destreza: 1, fuerza: 1 },
    dimensiones: 'Hoja recta de 55 cm, empuñadura de 12 cm.',
    tier: 1,
    valorGoirnos: 9,
    requisitos: { fuerza: 8, destreza: 4 },
    lugarOrigen: 'Manufactura goirnte, Meseta del Orden.',
    tipoArma: 'ESPADA_1_MANO',
  },

  // Consolidación (auditoría 2026-09-01, "EXPULSAR estructuralmente inalcanzable, no existe ningún
  // escudo en el mundo"): primer ítem tipoArma:'ESCUDO' real del catálogo — el enum y toda la
  // infraestructura de armas (weaponAbilities.ts) ya lo soportaban, solo faltaba el dato. Desbloquea
  // "Embate de Escudo" (GUERRERO/GUARDIAN nivel 28, ATAQUE+EXPULSAR). Manufactura goirnte, mismo
  // criterio ya usado en este bloque (07-mundo-helek-sirik.md asocia a los Goirntes con mejor
  // metalurgia) — equipSlot ARMA_SECUNDARIA (vale para cualquier mano, ver comentario de
  // schema.prisma) y bono en constitución (WEAPON_CATEGORY_ATTRIBUTE.ESCUDO, weaponAbilities.ts).
  {
    slug: 'escudo-torre-goirntes',
    name: 'Escudo de torre goirntes',
    aliases: ['escudo de torre', 'escudo goirnte'],
    category: 'arma',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMA_SECUNDARIA',
    description: 'Plancha de aleación gris curvada, remachada sobre un armazón de madera densa — manufactura goirnte, pensada para aguantar en la línea de un muro de escudos.',
    statBonuses: { constitucion: 2 },
    dimensiones: 'Óvalo de 90 x 55 cm.',
    tier: 1,
    valorGoirnos: 10,
    requisitos: { constitucion: 8, fuerza: 6 },
    lugarOrigen: 'Manufactura goirnte, Meseta del Orden.',
    tipoArma: 'ESCUDO',
  },

  {
    slug: 'garrote-matorral-cuerno',
    name: 'Garrote de matorral de cuerno',
    aliases: ['garrote de matorral'],
    category: 'arma',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMA_PRINCIPAL',
    description: 'Madera densa y retorcida, tallada a mano — la primera arma para quien no tiene ninguna.',
    statBonuses: { fuerza: 1 },
    dimensiones: 'Palo de 60 cm.',
    tier: 1,
    valorGoirnos: 7,
    requisitos: { fuerza: 6, destreza: 4 },
    // Corregido (auditoría de lore/catálogo, 2026-08-21): decía "Manufactura goirnte, Meseta del
    // Orden" — copiado por error de la plantilla de armas goirntes de más arriba, contradice tanto
    // la propia descripción ("tallada a mano — la primera arma para quien no tiene ninguna") como
    // la receta de crafteo real (crafting.ts, tallado a mano con leña de matorral de cuerno) y el
    // origen geográfico de esa leña (harvestSourceRegion['matorral-de-cuerno'] = Llanuras del
    // Viento Rojo, no Meseta del Orden).
    lugarOrigen: 'Llanuras del Viento Rojo.',
    tipoArma: 'GARROTE_1_MANO',
  },

  // Crafteo v1: reparar el hacha rota de Gorhorn (roadmap 2026-07-20)
  {
    slug: 'hacha-guerra-maktor-restaurada',
    name: 'Hacha de guerra Maktor',
    aliases: ['Hacha de guera Maktor'],
    category: 'arma',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMA_PRINCIPAL',
    description: 'El hacha rota del clan, reforjada — la cabeza reasentada y el filo devuelto. Lo único del Clan Maktor que ha vuelto a estar entero.',
    statBonuses: { fuerza: 4, constitucion: 2, destreza: 1, voluntad: 1 },
    dimensiones: 'Astil de 85 cm, cabeza de 22 cm.',
    lugarOrigen: 'Clan Maktor, Llanuras del Viento Rojo.',
    // Mismo requisito que la receta de crafteo homónima (crafting.ts, axeRepair).
    tier: 4,
    valorGoirnos: 36,
    requisitos: { fuerza: 16, destreza: 12, constitucion: 14 },
    tipoArma: 'HACHA_1_MANO',
  },

  {
    slug: 'hacha-guerra-orca',
    name: 'Hacha de guerra orca',
    aliases: ['hacha de guerra orca'],
    category: 'arma',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMA_PRINCIPAL',
    description: 'Hacha pesada de cabeza de hierro ennegrecido y mango de madera envuelto en tiras de cuero — el arma orca por excelencia.',
    statBonuses: { fuerza: 3 },
    dimensiones: 'Astil de 80 cm, cabeza de hierro de 20 cm de ancho.',
    lugarOrigen: 'Manufactura orca, sin clan de origen único.',
    // Sesión de diseño 2026-07-23: arma común (tier 1) — requisito modesto, cualquier guerrero
    // orco adulto puede blandirla.
    tier: 2,
    valorGoirnos: 16,
    requisitos: { fuerza: 12, destreza: 6, constitucion: 6 },
    tipoArma: 'HACHA_1_MANO',
  },

  {
    slug: 'hacha-guerra-maktor-rota',
    name: 'Hacha de guerra rota',
    aliases: ['hacha rota'],
    category: 'arma',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMA_PRINCIPAL',
    description: 'El hacha de guerra de su clan, con la cabeza de metal mellada y partida por la mitad, el astil envuelto en varias vueltas de tiras de cuero — la usa como una maza pesada.',
    statBonuses: { fuerza: 1 },
    dimensiones: 'Astil de 75 cm, cabeza de hierro partida por la mitad.',
    lugarOrigen: 'Clan Maktor, Llanuras del Viento Rojo.',
    tier: 1,
    valorGoirnos: 7,
    requisitos: { fuerza: 6, destreza: 4, constitucion: 4 },
    tipoArma: 'HACHA_1_MANO',
  },

  // Armas nuevas
  {
    slug: 'hacha-de-mano-orca',
    name: 'Hacha de mano orca',
    aliases: ['hacha de mano'],
    category: 'arma',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMA_PRINCIPAL',
    description: 'Hacha pequeña de cabeza de hierro y mango corto — versión ligera de una mano, para la mano secundaria.',
    statBonuses: { fuerza: 3 },
    dimensiones: 'Mango de 35 cm, cabeza de 12 cm.',
    lugarOrigen: 'Manufactura orca.',
    tier: 2,
    valorGoirnos: 16,
    requisitos: { fuerza: 8, destreza: 6, constitucion: 5},
    tipoArma: 'HACHA_1_MANO',
  },

  {
    slug: 'lanza-corta-caza',
    name: 'Lanza corta de caza',
    aliases: ['lanza corta'],
    category: 'arma',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMA_PRINCIPAL',
    description: 'Asta corta y ligera de madera clara con punta de hueso afilado, del tamaño justo para manejarla con una mano — la de los jóvenes cazadores.',
    statBonuses: { destreza: 2, fuerza: 1, voluntad: 1 },
    dimensiones: 'Asta de 120 cm, punta de hueso de 15 cm.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
    tier: 2,
    valorGoirnos: 18,
    requisitos: { fuerza: 6, destreza: 12, voluntad: 6 },
    tipoArma: 'LANZA',
  },

  {
    slug: 'lanza-hueso-gargantua',
    name: 'Lanza de hueso de gargantúa',
    aliases: ['lanza de hueso'],
    category: 'arma',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMA_PRINCIPAL',
    description: 'Asta larga rematada en una punta de hueso de gargantúa pulido hasta sacarle filo, blanco amarillento veteado — usada en cacerías rituales y duelos de honor.',
    statBonuses: { destreza: 5, fuerza: 2, carisma: 1 },
    dimensiones: 'Asta de 190 cm, punta de hueso de 25 cm.',
    lugarOrigen: 'Llanuras del Viento Rojo, cacería ritual orca.',
    // Sesión de diseño 2026-07-23: arma de duelo/cacería ritual (tier 2) — exige algo más de
    // fuerza que un arma común para manejarla con la distancia y el respeto que exige un duelo.
    tier: 3,
    valorGoirnos: 31,
    requisitos: { destreza: 14, fuerza: 8, carisma: 6, voluntad: 8 },
    tipoArma: 'LANZA',
  },

  {
    slug: 'maza-orca',
    name: 'Maza orca',
    category: 'arma',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMA_PRINCIPAL',
    description: 'Maza de cabeza nudosa de hueso reforzado con remaches de hierro, mango corto envuelto en cuero — tosca, pesada, hecha para aplastar, no para el filo.',
    statBonuses: { fuerza: 1, voluntad: 1 },
    dimensiones: 'Mango de 55 cm, cabeza nudosa de 15 cm de diámetro.',
    lugarOrigen: 'Manufactura orca.',
    tier: 1,
    valorGoirnos: 9,
    requisitos: { fuerza: 6, destreza: 4, constitucion: 4 },
    tipoArma: 'MAZA_1_MANO',
  },

  {
    // Crafteada por herrero-orcos-llanuras a partir de Cola de Coracelo (ver crafting.ts,
    // CORACELO_MACE_RECIPE) — no es objeto de loot suelto, no aparece en ningún HarvestYield.
    slug: 'maza-coracelo',
    name: 'Maza de Coracelo',
    aliases: ['maza de coracelo'],
    category: 'arma',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMA_PRINCIPAL',
    description: 'Maza corta rematada con el bulto de escamas de la cola de un Coracelo, resistencia equiparable al hierro — remachada a un mango de madera por un herrero orco.',
    statBonuses: { fuerza: 2, constitucion: 1 },
    dimensiones: 'Mango de 45 cm, cabeza de escamas de 15 cm.',
    lugarOrigen: 'Manufactura orca, La Sabana Alta.',
    tier: 3,
    valorGoirnos: 21,
    requisitos: { fuerza: 9, destreza: 5, constitucion: 5 },
    tipoArma: 'MAZA_1_MANO',
  },

  {
    slug: 'pica-de-patrulla-goirntes',
    name: 'Pica de patrulla goirntes',
    aliases: ['pica de patrulla'],
    category: 'arma',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMA_PRINCIPAL',
    description: 'Asta larga rematada en punta de aleación gris — arma de formación estándar en una patrulla fronteriza.',
    statBonuses: { fuerza: 1, destreza: 3 },
    dimensiones: 'Asta de 210 cm.',
    lugarOrigen: 'Concordia de Hierro, Meseta del Orden.',
    tier: 2,
    valorGoirnos: 18,
    requisitos: { fuerza: 6, destreza: 12, voluntad: 8 },
    tipoArma: 'PICA',
  },

  // --- herramienta ---

  {
    // Slug ajustado (petición explícita, 2026-08-15: "renombrases el slug con el nombre del
    // archivo" — imagen ya subida "aguja-cardo-brujula-banner.png").
    slug: 'aguja-cardo-brujula',
    name: 'Aguja de Cardo Brújula',
    // 'brújula' añadido (2026-08-15, feature de exploración) — así se reconoce "uso la brújula"
    // en detectsCompassUse (itemReference.ts) sin exigir el nombre completo. 'cardo brújula'
    // quitado a propósito (auditoría de documentación/lore 2026-08-18): coincidía exactamente con
    // el alias de la PLANTA en bruto (`harvestSourceAliases['cardo-brujula']`) — mencionar la
    // planta en narración desbloqueaba en la Enciclopedia esta herramienta ya crafteada
    // (`recordEntityDiscoveries` no distingue exclusividad entre fauna/flora e ítem, los dos
    // bucles son independientes), aunque el jugador nunca la hubiera fabricado. 'brújula' solo ya
    // cubre el mismo caso de uso sin la colisión.
    aliases: ['aguja de cardo', 'brújula'],
    category: 'herramienta',
    tipo: 'EQUIPABLE',
    valorGoirnos: 5,
    equipSlot: 'ACCESORIO',
    description: 'Aguja imantada natural: colgada de un hilo señala siempre el mismo rumbo, incluso en plena tormenta.',
    dimensiones: 'Aguja de 4-8 cm, colgada de un hilo de 15-25 cm.',
    lugarOrigen: 'Las Agujas Imán, Llanuras del Viento Rojo.',
  },

  {
    slug: 'antorcha-de-resina',
    name: 'Antorcha de resina de ciénaga',
    aliases: ['antorcha de resina'],
    category: 'herramienta',
    tipo: 'EQUIPABLE',
    valorGoirnos: 5,
    equipSlot: 'ARMA_SECUNDARIA',
    description: 'Antorcha de madera envuelta en resina oscura de ciénaga — arde incluso con lluvia, comercio Llanuras-Ciénaga.',
    dimensiones: 'Antorcha de 55 cm.',
    lugarOrigen: 'Comercio Llanuras-Ciénaga Troncal.',
  },

  {
    slug: 'cuchillo-deshuello',
    name: 'Cuchillo de deshuello de hielo sílice',
    aliases: ['cuchillo de deshuello'],
    category: 'herramienta',
    tipo: 'EQUIPABLE',
    valorGoirnos: 5,
    equipSlot: 'ARMA_SECUNDARIA',
    description: 'Hoja corta y curva de hielo sílice, más gruesa que un cuchillo normal para no quebrarse contra piel dura — para pieles duras, canon de Cristal Helado.',
    dimensiones: 'Hoja curva de 14 cm, notablemente más gruesa que un cuchillo estándar.',
    lugarOrigen: 'Clan Helsig, Cristal Helado.',
  },

  {
    slug: 'cuerda-tendon',
    name: 'Cuerda de tendón',
    category: 'herramienta',
    tipo: 'EQUIPABLE',
    valorGoirnos: 5,
    equipSlot: 'ACCESORIO',
    description: 'Cuerda trenzada de tendón seco, resistente y algo rígida al tacto — hecha de tendón de Corredor de Cauce.',
    dimensiones: 'Rollo de 8 metros, 4 mm de grosor.',
  },

  {
    slug: 'kit-costura-hueso',
    name: 'Kit de costura de hueso',
    aliases: ['kit de costura'],
    category: 'herramienta',
    tipo: 'EQUIPABLE',
    valorGoirnos: 5,
    equipSlot: 'ACCESORIO',
    description: 'Agujas de hueso fino y cordel enrollado en un retal de cuero — reparar ropa y pieles en ruta.',
    dimensiones: 'Estuche de 15x8 cm.',
  },

  {
    slug: 'pico-minero',
    name: 'Pico de minero',
    category: 'herramienta',
    tipo: 'EQUIPABLE',
    valorGoirnos: 5,
    equipSlot: 'ARMA_SECUNDARIA',
    description: 'Pico de cabeza de hierro pesado y mango largo de madera, punta desgastada de golpear roca y hielo — herramienta de minería de hielo sílice.',
    dimensiones: 'Cabeza de 25 cm, mango de 90 cm.',
    lugarOrigen: 'Cristal Helado.',
    // Herramienta real de minero (2026-08-23, Grupo 3): existía el objeto (loadout de Hagar
    // Kiugh) pero sin esta etiqueta no contaba para `hasToolForOficio`/
    // `OFICIOS_CON_HERRAMIENTA_REQUERIDA` — mismo mecanismo que ya usa el cuchillo de hielo
    // sílice para curtidor/desollador.
    herramientaParaOficio: ['minero'],
  },

  {
    slug: 'piedra-de-afilar',
    name: 'Piedra de afilar',
    category: 'herramienta',
    tipo: 'EQUIPABLE',
    valorGoirnos: 5,
    equipSlot: 'ACCESORIO',
    description: 'Piedra plana y áspera, gastada por un lado de tanto uso — mantiene el filo de un arma.',
    dimensiones: 'Piedra de 10x4 cm.',
  },

  {
    slug: 'piedras-chispa',
    name: 'Piedras de chispa',
    category: 'herramienta',
    tipo: 'EQUIPABLE',
    valorGoirnos: 5,
    equipSlot: 'ACCESORIO',
    description: 'Un par de piedras oscuras y ásperas al tacto, bordes desgastados de tanto entrechocarlas — para encender fuego sin Raíz de Fuego.',
    dimensiones: 'Par de piedras de unos 5 cm cada una.',
  },

  // Utilidad, consumibles y objetos narrativos
  {
    slug: 'cuerdas',
    name: 'Cuerdas',
    category: 'cordaje',
    tipo: 'MATERIAL',
    description: 'Cuerdas trenzadas de fibra vegetal, bastas pero resistentes — atan a un rival vencido antes de que se recupere. Se gastan al usarlas.',
    dimensiones: 'Rollo de 5 metros, 6 mm de grosor.',
    // CONVALECIENTE deja de ser "victoria automática" (2026-08-26) — requisito real de
    // POST /capturar/:npcSlug (companeros.ts), sustituye a trampa-de-lazo (que no era
    // crafteable). Se consume 1 unidad por captura con éxito, a diferencia de trampa-de-lazo
    // (equipable, reutilizable).
    // tier explícito (2026-08-28, rediseño de captura — ver plazoCapturaHorasForTier,
    // companionSupervivencia.ts): tier 1 = 6h de plazo en inventario antes de escaparse. Ya era el
    // default de ItemCatalog.tier, se hace explícito porque ahora tiene significado mecánico real.
    tier: 1,
    valorGoirnos: 3,
  },
  {
    slug: 'trampa-de-lazo',
    name: 'Trampa de lazo de tendón',
    aliases: ['trampa de lazo'],
    category: 'herramienta',
    tipo: 'EQUIPABLE',
    valorGoirnos: 5,
    equipSlot: 'ACCESORIO',
    description: 'Lazo trenzado de tendón anclado a una estaca de madera — para cazar sin necesidad de perseguir.',
    dimensiones: 'Lazo de 1 metro, estaca de 30 cm.',
  },

  // --- ropa ---

  {
    slug: 'sello-anular-concordia',
    name: 'Anillo de sello de la Concordia',
    aliases: ['anillo de sello'],
    category: 'ropa',
    tipo: 'EQUIPABLE',
    valorGoirnos: 5,
    equipSlot: 'ANILLO_1',
    description: 'Anillo de aleación gris con el sello de la Concordia grabado — acredita, o incrimina, a quien lo lleva.',
    dimensiones: 'Anillo de 2 cm de diámetro.',
    lugarOrigen: 'Concordia de Hierro.',
  },

  // Anillos
  {
    slug: 'anillo-vertebra-corredor',
    name: 'Anillo de vértebra de corredor',
    aliases: ['anillo de vértebra'],
    category: 'ropa',
    tipo: 'EQUIPABLE',
    equipSlot: 'ANILLO_1',
    description: 'Anillo tallado de una sola vértebra de Corredor de Cauce, pulida hasta sacarle brillo — recuerdo de una presa.',
    statBonuses: { carisma: 1 , inteligencia: 1 },
    tier: 2,
    valorGoirnos: 14,
    dimensiones: 'Anillo de 2 cm de diámetro.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },

  {
    slug: 'arnes-cuero',
    name: 'Arnés de cuero',
    category: 'ropa',
    tipo: 'EQUIPABLE',
    valorGoirnos: 9,
    equipSlot: 'CAMISA',
    description: 'Arnés de cuero curtido, correas cruzadas al pecho, remaches de hueso.',
    statBonuses: { constitucion: 2 },
    dimensiones: 'Ajustable a un contorno de torso de 90 a 120 cm.',
  },

  // Accesorio
  { 
    slug: 'bandolera-de-caza',
    name: 'Bandolera de caza', 
    category: 'ropa',
    tipo: 'EQUIPABLE', 
    valorGoirnos: 5,
    equipSlot: 'ACCESORIO', 
    description: 'Lazadas de tendón para cuchillo, trampas y piezas menores.', 
    dimensiones: 'Banda cruzada de 100 cm.', 
    lugarOrigen: 'Llanuras del Viento Rojo.' 
  },

  // Botas
  { 
    slug: 'botas-de-estepa', 
    name: 'Botas de estepa', 
    category: 'ropa',
    tipo: 'EQUIPABLE', 
    valorGoirnos: 11,
    equipSlot: 'BOTAS',
    description: 'Cuero y suela de piel de corredor, gastadas.',
    // Peso de armadura (2026-08-31, clases.md § restricción por peso) — destreza+voluntad
    // dominantes, tramo Medio.
    pesoArmadura: 'MEDIO',
    statBonuses: { voluntad: 1, destreza: 2 },
    dimensiones: 'Caña hasta el tobillo.', 
    lugarOrigen: 'Llanuras del Viento Rojo.' 
  },

  {
    slug: 'botas-marcha-goirntes',
    name: 'Botas de marcha goirntes',
    aliases: ['botas de marcha'],
    category: 'ropa',
    tipo: 'EQUIPABLE',
    equipSlot: 'BOTAS',
    description: 'Suela claveteada de aleación, equipamiento estándar de patrulla.',
    tier: 2,
    valorGoirnos: 16,
    // Peso de armadura (2026-08-31) — "equipamiento estándar de patrulla" Goirnte, coherente con
    // el resto del uniforme (Medio, no Pesado de Caballero).
    pesoArmadura: 'MEDIO',
    statBonuses: { destreza: 1, constitucion: 2 },
    dimensiones: 'Caña hasta media pantorrilla.',
    lugarOrigen: 'Concordia de Hierro, Meseta del Orden.',
    requisitos: { fuerza: 8, destreza: 8, constitucion: 6 },
  },

  {
    slug: 'capa-piel-gargantua',
    name: 'Capa de piel de gargantúa',
    aliases: ['capa de piel'],
    category: 'ropa',
    tipo: 'EQUIPABLE',
    equipSlot: 'ACCESORIO',
    description: 'Capa gruesa de piel gris ceniza de gargantúa, pesada y cálida, con pequeñas placas óseas todavía cosidas al cuero.',
    dimensiones: 'Capa de 140 cm de largo.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
    statBonuses: {voluntad: 2, destreza: 3, carisma: 2 },
    tier: 3,
    valorGoirnos: 29,
    requisitos: { fuerza: 12, destreza: 8, constitucion: 10, voluntad: 6 },
  },

  {
    slug: 'capucha-piel-corredor',
    name: 'Capucha de piel de corredor',
    aliases: ['capucha de piel'],
    category: 'ropa',
    tipo: 'EQUIPABLE',
    equipSlot: 'CASCO',
    description: 'Capucha de piel rojiza de Corredor de Cauce, ajustada a la cabeza — protege del sol y de la arena magnética.',
    dimensiones: 'Ajustada a cabeza y cuello.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
    // Peso de armadura (2026-08-31) — pieza ligera de cuero, sin metal, coherente con explorador
    // ágil (Medio).
    pesoArmadura: 'MEDIO',
    statBonuses: {constitucion: 1, voluntad: 1 },
    tier: 1,
    valorGoirnos: 9,
    requisitos: { fuerza: 8, destreza: 8, constitucion: 6 },
  },

  // Cinturón
  {
    slug: 'cinturon-de-trofeos',
    name: 'Cinturón de trofeos de hueso',
    aliases: ['cinturón de trofeos'],
    category: 'ropa',
    tipo: 'EQUIPABLE',
    equipSlot: 'CINTURON',
    description: 'Colmillos y garras cosidos al cuero — entre orcos, respeto a la vista.',
    // Peso de armadura (2026-08-31) — pieza decorativa de trofeos, sin protección real, tramo
    // Ligero (mismo criterio que tocado-plumas/capa-melena-ferike: prestigio, no defensa).
    pesoArmadura: 'LIGERO',
    statBonuses: { carisma: 1, voluntad: 1 },
    dimensiones: 'Cinturón de 90 a 110 cm.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
    tier: 2,
    valorGoirnos: 14,
  },

  {
    slug: 'cota-ligera-goirntes',
    name: 'Cota de aleación ligera goirntes',
    aliases: ['cota ligera'],
    category: 'ropa',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMADURA_SUPERIOR',
    description: 'Cota de anillas finas de un gris metálico apagado, sorprendentemente ligera — de Hierba del Hierro procesada.',
    // Peso de armadura (2026-08-31) — el requisito real es Constitución (ver comentario debajo),
    // coherente con Medio (explorador/patrulla Goirnte), no Ligero puro (sigue siendo metal, y
    // Ligero es el tramo reservado a caster/tela sin protección física real).
    pesoArmadura: 'MEDIO',
    statBonuses: { defensa: 2 },
    dimensiones: 'Cota hasta la cadera, anillas de 1 cm de diámetro.',
    lugarOrigen: 'Manufactura goirnte, Meseta del Orden.',
    // Sesión de diseño 2026-07-23: aguantar el peso de una cota completa toda una jornada exige
    // resistencia física real. Requisito movido de 'resistenciaFisica' (atributo secundario) a
    // Constitución (2026-08-22, remodelado de atributos secundarios): resistenciaFisica se
    // eliminó por duplicar el papel que ya cumple Constitución entre los 7 primarios.
    tier: 2,
    valorGoirnos: 14,
    requisitos: { constitucion: 8 },
  },

  { 
    slug: 'faldar-piel-gargantua', 
    name: 'Faldar de piel de gargantúa', 
    aliases: ['faldar de piel'], 
    category: 'ropa',
    tipo: 'EQUIPABLE', 
    equipSlot: 'ARMADURA_INFERIOR', 
    description: 'Faldar de piel gris ceniza de gargantúa, con pequeñas placas óseas todavía cosidas al cuero — abrigo, no defensa.',
    dimensiones: 'Faldar de 55 cm de largo.',
    lugarOrigen: 'Llanuras del Viento Rojo.' ,
    // Peso de armadura (2026-08-31) — destreza dominante, "abrigo, no defensa" (piel sin metal).
    pesoArmadura: 'MEDIO',
    statBonuses: {constitucion: 1, destreza: 2 },
    tier: 2,
    valorGoirnos: 16,
    requisitos: { fuerza: 8, destreza: 8, constitucion: 6 },
  },

  // Guantes
  {
    slug: 'guantes-piel-corredor',
    name: 'Guantes de piel de corredor',
    aliases: ['guantes de piel'],
    category: 'ropa',
    tipo: 'EQUIPABLE',
    valorGoirnos: 9,
    equipSlot: 'GUANTES',
    description: 'Agarre firme para lanza y cuchillo.',
    pesoArmadura: 'MEDIO',
    statBonuses: { destreza: 1, constitucion: 1 },
    dimensiones: 'Talla estándar de mano orca.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },

  {
    slug: 'manoplas-goirntes',
    name: 'Manoplas de aleación goirntes',
    aliases: ['manoplas de aleación'],
    category: 'ropa',
    tipo: 'EQUIPABLE',
    valorGoirnos: 12,
    equipSlot: 'GUANTES',
    description: 'Manoplas de aleación gris articuladas en los nudillos — pieza de saqueo poco común, solo la lleva un oficial.',
    // Peso de armadura (2026-08-31) — aleación de metal real, constitución pura, tramo Pesado.
    pesoArmadura: 'PESADO',
    statBonuses: { constitucion: 2 },
    dimensiones: 'Talla estándar articulada en los nudillos.',
    lugarOrigen: 'Concordia de Hierro, Meseta del Orden.',
  },

  { 
    slug: 'manta-campana-goirntes', 
    name: 'Manta de campaña goirntes', 
    aliases: ['manta de campaña'], 
    category: 'ropa',
    tipo: 'EQUIPABLE', 
    equipSlot: 'ACCESORIO',
    description: 'Lana encerada, enrollada al hombro.', 
    dimensiones: 'Manta enrollada de 150x90 cm.', 
    lugarOrigen: 'Meseta del Orden.' ,
    statBonuses: {constitucion: 2, voluntad: 1 },
    tier: 2,
    valorGoirnos: 16,
    requisitos: { fuerza: 8, destreza: 8, constitucion: 6 },
  },

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
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMADURA_INFERIOR',
    description: 'Piel con pequeños detalles de pelo de cornamenta.',
    dimensiones: 'Cubren de la cadera al tobillo.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
    pesoArmadura: 'MEDIO',
    statBonuses: { destreza: 2 },
    tier: 1,
    valorGoirnos: 9,
    requisitos: { fuerza: 6, destreza: 4, constitucion: 6 },
  },

  {
    slug: 'perneras-cuero-goirntes',
    name: 'Perneras de cuero goirntes',
    aliases: ['perneras de cuero'],
    category: 'ropa',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMADURA_INFERIOR',
    description: 'Perneras de cuero reforzado gris — completa el uniforme de patrulla junto a la cota ligera.',
    pesoArmadura: 'MEDIO',
    statBonuses: { destreza: 1, constitucion: 1 },
    dimensiones: 'Cubren de la cadera al tobillo.',
    lugarOrigen: 'Meseta del Orden.',
    tier: 1,
    valorGoirnos: 9,
    requisitos: { fuerza: 8, destreza: 8, constitucion: 6 },
  },

  // Armadura superior/inferior
  {
    slug: 'peto-placas-gargantua',
    name: 'Peto de placas óseas de gargantúa',
    aliases: ['peto de placas'],
    category: 'ropa',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMADURA_SUPERIOR',
    description: 'Peto de placas óseas blanquecinas de gargantúa cosidas sobre cuero grueso — armadura pesada, las placas solo salen de cacería ritual o cadáver ya viejo.',
    // Peso de armadura (2026-08-31) — "armadura pesada" en la propia descripción, constitución
    // dominante, requisito de fuerza 14. Tramo Pesado sin duda.
    pesoArmadura: 'PESADO',
    statBonuses: { constitucion: 3, voluntad: 2, carisma: 2 },
    dimensiones: 'Cubre el torso completo.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
    // Mismo requisito que la receta de crafteo homónima (crafting.ts, gargantuaArmor) — equiparla
    // exige la misma fuerza que montarla, tanto si se craftea como si se encuentra ya hecha.
    tier: 3,
    valorGoirnos: 29,
    requisitos: { fuerza: 14, constitucion: 16, voluntad: 6, destreza: 8 },
  },

  { 
    slug: 'talabarte-goirntes', 
    name: 'Talabarte de cuero goirntes', 
    aliases: ['talabarte de cuero'], 
    category: 'ropa',
    tipo: 'EQUIPABLE', 
    equipSlot: 'CINTURON', 
    description: 'Correaje de oficial, hebilla con el sello de la Concordia.',
    dimensiones: 'Correaje ajustable al torso.',
    lugarOrigen: 'Concordia de Hierro, Meseta del Orden.',
    // Peso de armadura (2026-08-31) — mismo uniforme de patrulla que botas/perneras/cota-ligera
    // Goirnte (Medio, no Pesado — ese es Caballero, otra rama de la misma facción).
    pesoArmadura: 'MEDIO',
    statBonuses: {constitucion: 2, voluntad: 1 },
    tier: 2,
    valorGoirnos: 16,
    requisitos: { fuerza: 8, destreza: 8, constitucion: 6 },
  },

  // --- Ampliación de equipo/objetos (roadmap 2026-07-20, propuesta de Fable, ver memoria
  // project_tarkor_propuesta_objetos.md) — llena los huecos de EquipSlot que antes no tenían
  // ningún objeto real asignable. Cada uno con origen concreto (ver loadout de los NPCs, más abajo).
  // Casco
  {
    slug: 'yelmo-patrulla-goirntes',
    name: 'Yelmo de patrulla goirntes',
    aliases: ['yelmo de patrulla'],
    category: 'ropa',
    tipo: 'EQUIPABLE',
    equipSlot: 'CASCO',
    description: 'Casco abierto de aleación ligera, sello de la Concordia en la frente.',
    // Peso de armadura (2026-08-31) — pese a "aleación ligera" en el nombre, los requisitos reales
    // (fuerza 12, constitución 12) y constitución 4 pura son de tanque — Pesado por sus números,
    // no por el nombre.
    pesoArmadura: 'PESADO',
    statBonuses: { constitucion: 4 },
    dimensiones: 'Casco abierto, contorno de cabeza de 55 a 60 cm.',
    lugarOrigen: 'Concordia de Hierro, Meseta del Orden.',
    tier: 3,
    valorGoirnos: 23,
    requisitos: { fuerza: 12, destreza: 6, constitucion: 12, voluntad: 8 },
  },

  // 5 equipables nuevos (2026-08-24, Grupo 3 § 27 recursos/materiales sin receta que los use —
  // ver docs/producto/21-roadmap.md) — cierran el destino real de items recolectables desde el 2026-08-23
  // que hasta ahora no servían para nada.
  {
    slug: 'armadura-quitina-roja',
    name: 'Armadura de quitina roja',
    aliases: ['armadura de quitina'],
    category: 'ropa',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMADURA_SUPERIOR',
    description: 'Placas de quitina roja de Gesgurio cosidas sobre un refuerzo de caparazón de Espina del Viento y quitina de Escorante — ligera, pero resiste bien el corte.',
    // Peso de armadura (2026-08-31) — "ligera" en la propia descripción, sin requisito de fuerza
    // (solo destreza), coherente con Medio pese a la constitución pura (quitina, no metal macizo).
    pesoArmadura: 'MEDIO',
    statBonuses: { constitucion: 4 },
    dimensiones: 'Cubre el torso completo.',
    lugarOrigen: 'La Hondonada del Eco, Llanuras del Viento Rojo.',
    tier: 3,
    valorGoirnos: 23,
    requisitos: { destreza: 10 },
  },
  {
    slug: 'zarpas-towrgu',
    name: 'Zarpas de Towrgu',
    aliases: ['zarpas', 'guantelete de garras'],
    category: 'arma',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMA_SECUNDARIA',
    tipoArma: 'DAGA',
    description: 'Garras de Towrgu montadas sobre un guantelete de cuero — arma de cercanía, tan rápida como brutal.',
    statBonuses: { destreza: 3 },
    dimensiones: 'Guantelete con 4 garras de 15 cm.',
    lugarOrigen: 'La Sabana Alta, Llanuras del Viento Rojo.',
    tier: 5,
    valorGoirnos: 31,
    requisitos: { destreza: 14 },
  },
  {
    slug: 'placas-escama-jusha',
    name: 'Placas de escama de Jusha',
    aliases: ['placas de escama'],
    category: 'ropa',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMADURA_SUPERIOR',
    description: 'Escamas de Jusha Esmeralda cosidas en hilera sobre cuero fino — armadura ligera, se mueve con quien la lleva.',
    // Peso de armadura (2026-08-31) — "armadura ligera" en su propia descripción, destreza+
    // constitución empatadas, tramo Medio (explorador ágil).
    pesoArmadura: 'MEDIO',
    statBonuses: { destreza: 2, constitucion: 2 },
    dimensiones: 'Cubre el torso completo.',
    lugarOrigen: 'Los Manaderos, Llanuras del Viento Rojo.',
    tier: 2,
    valorGoirnos: 18,
    requisitos: { destreza: 8 },
  },
  {
    slug: 'tocado-plumas',
    name: 'Tocado de plumas',
    aliases: ['tocado', 'penacho de plumas'],
    category: 'ropa',
    tipo: 'EQUIPABLE',
    equipSlot: 'CASCO',
    description: 'Plumas rojizas de Corretolvas y plumas de Tura Jusha trenzadas en un tocado ceremonial — más presencia que protección.',
    // Peso de armadura (2026-08-31) — "más presencia que protección", sin peso real, tramo
    // Ligero (mismo criterio que capa-melena-ferike/cinturon-de-trofeos: piezas de prestigio).
    pesoArmadura: 'LIGERO',
    statBonuses: { carisma: 2 },
    dimensiones: 'Tocado de 40 cm de alto.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
    tier: 1,
    valorGoirnos: 9,
    requisitos: { destreza: 6 },
  },
  {
    slug: 'capa-melena-ferike',
    name: 'Capa de melena de Ferike',
    aliases: ['capa de ferike'],
    category: 'ropa',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMADURA_SUPERIOR',
    description: 'Capa cosida con la melena de la cola de un Ferike macho — objeto de prestigio real, casi nadie ha visto una de cerca.',
    // Peso de armadura (2026-08-31) — objeto de prestigio, sin protección real, tramo Ligero.
    pesoArmadura: 'LIGERO',
    statBonuses: { carisma: 5 },
    dimensiones: 'Capa hasta media pierna.',
    lugarOrigen: 'El Cruce de las Cenizas, Llanuras del Viento Rojo.',
    tier: 7,
    valorGoirnos: 60,
    requisitos: { destreza: 16 },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TIPO: CONSUMIBLE
  // ══════════════════════════════════════════════════════════════════════════

  // --- consumible ---

  { 
    slug: 'agua-hervida-liquen', 
    name: 'Agua hervida de liquen', 
    aliases: ['agua hervida'], 
    category: 'consumible',
    tipo: 'CONSUMIBLE', 
    valorGoirnos: 18,
    equipSlot: 'CONSUMIBLE_1', 
    description: 'Liquen húmedo del cauce hervido sobre fuego — más segura de beber que masticarlo en crudo.',
    dimensiones: 'Cantimplora de 500 ml.',
    curaEnergia: 30,
    curaHasta: 'HERIDO',
    curaUnPaso: true,
    // Hallazgo 13 (revisar-partida-hallazgos.md 2026-09-06) — "Agua hervida" por nombre propio,
    // candidato claro a saciar sed de forma proporcional (no el 100% fijo del odre lleno).
    curaAgua: 30,
  },

  { 
    slug: 'bulbo-cauce', 
    name: 'Bulbo del Cauce', 
    category: 'consumible',
    tipo: 'CONSUMIBLE', 
    valorGoirnos: 10,
    equipSlot: 'CONSUMIBLE_1', 
    description: 'Tubérculo fibroso: comida y un trago de agua en uno.',
    dimensiones: 'Tubérculo de 8 cm.',
    curaEnergia: 15,
    curaHasta: 'GRAVE',
    // Hallazgo 13 — "un trago de agua" explícito en la descripción.
    curaAgua: 15,
  },

  // Hallazgo 13 (revisar-partida-hallazgos.md 2026-09-06) — "el consumo de agua pasa a depender
  // de un ítem odre; se craftea con peletería T1... una acción narrativa de 'recoger agua' lo
  // convierte en 'odre con agua'; beber de él sube el agua al 100%". Dos filas de catálogo (no un
  // campo de estado en InventoryItem, decisión explícita): `odre-agua` es el vacío — ya existía en
  // el catálogo como accesorio decorativo de loadout de NPC (`tipo: 'EQUIPABLE'`), reubicado aquí
  // y pasado a `'CONSUMIBLE'` sin equipar (decisión explícita: vive en mochila, no ocupa
  // ACCESORIO) — y `odre-agua-lleno` es el nuevo, con `curaAgua: 100` (repone del todo, como el
  // viejo botón fijo "Beber agua", ahora retirado) y `emptyContainerCatalogSlug: 'odre-agua'`
  // (al beberlo, devuelve el vacío al inventario en vez de desaparecer del todo).
  {
    slug: 'odre-agua',
    name: 'Odre de agua',
    category: 'consumible',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 5,
    description: 'Odre de cuero curtido cosido a mano, correa larga para llevar al hombro — imprescindible en la estepa, vacío hasta que se llena en una fuente real.',
    dimensiones: 'Capacidad de 2 litros, correa de 70 cm.',
  },

  {
    slug: 'odre-agua-lleno',
    name: 'Odre de agua lleno',
    category: 'consumible',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 6,
    equipSlot: 'CONSUMIBLE_1',
    description: 'El mismo odre de cuero curtido, lleno hasta el tapón — listo para beber.',
    dimensiones: 'Capacidad de 2 litros, correa de 70 cm.',
    curaAgua: 100,
    emptyContainerCatalogSlug: 'odre-agua',
  },

  { 
    slug: 'glandula-ignea', 
    name: 'Glándula ígnea de salamandra', 
    aliases: ['glándula ígnea'], 
    category: 'consumible',
    tipo: 'CONSUMIBLE', 
    equipSlot: 'CONSUMIBLE_1', 
    description: 'Bolsa membranosa de un rojo anaranjado, caliente al tacto — iniciador de fuego potente, pariente animal de la Raíz de Fuego.',
    dimensiones: 'Bolsa de 6 cm.',
    // tier 5 (Grupo 3 § HarvestYield.condicion, 2026-08-24): mismo caso que veneno-espina/
    // ascuas-raiz-fuego — "extracción con cuidado (destreza, Media 15 — falla = se inflama)".
    tier: 5,
    valorGoirnos: 10,
  },

  {
    slug: 'grano-espiga-roja',
    name: 'Grano de espiga roja',
    aliases: ['grano de espiga roja'],
    category: 'consumible',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 4,
    equipSlot: 'CONSUMIBLE_1',
    description: 'Puñado de grano rojo ocre de Espiga Roja — tostado o crudo, como forraje.',
    dimensiones: 'Puñado de 100 a 200 g.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
    curaEnergia: 10,
  },

  { 
    slug: 'liquen-humedo', 
    name: 'Liquen húmedo del cauce', 
    aliases: ['liquen húmedo'], 
    category: 'consumible',
    tipo: 'CONSUMIBLE', 
    valorGoirnos: 9,
    equipSlot: 'CONSUMIBLE_1', 
    description: 'Masticado calma la sed; donde crece, cavar un par de codos da agua.',
    dimensiones: 'Puñado de unos 10 cm.',
    curaEnergia: 10,
    curaHasta: 'GRAVE',
    // Hallazgo 13 — "calma la sed" explícito, el candidato más claro de todos.
    curaAgua: 10,
  },

  {
    slug: 'aguardiente-goirntes',
    name: 'Petaca de aguardiente goirntes',
    aliases: ['petaca de aguardiente'],
    category: 'consumible',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 8,
    equipSlot: 'CONSUMIBLE_1',
    description: 'Petaca de metal con licor claro y fuerte — ración líquida de campaña, limpia heridas o da valor.',
    dimensiones: 'Petaca de 15 cm, 250 ml.',
    lugarOrigen: 'Meseta del Orden.',
    curaEnergia: 30,
  },

  { 
    slug: 'racion-carne-ahumada',
    name: 'Ración de carne ahumada',
    aliases: ['carne ahumada'],
    category: 'consumible',
    tipo: 'CONSUMIBLE', 
    valorGoirnos: 9,
    equipSlot: 'CONSUMIBLE_1', 
    description: 'Ahumada sobre fuego — a diferencia de la carne fresca, aguanta mucho más antes de estropearse.', 
    dimensiones: 'Trozos de 300 a 500 g.',
    curaEnergia: 10,
    curaHasta: 'GRAVE',
    curaHambre: 14,
  },

  {
    slug: 'racion-carne',
    name: 'Ración de carne fresca',
    aliases: ['carne fresca'],
    category: 'consumible',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 3,
    equipSlot: 'CONSUMIBLE_1',
    description: 'Trozos de carne fresca de caza, todavía con algo de sangre — se estropea en días.',
    dimensiones: 'Trozos de 300 a 500 g.',
    // curaEnergia bajado de 15 a 8 (auditoría "recolectables que deberían ser crafteables",
    // 2026-08-31): antes curaba MÁS que su propia versión ahumada (racion-carne-ahumada, 10, y
    // encima con curaHasta: GRAVE que la cruda no tiene) — comer la carne cruda salía mejor que
    // cocinarla, invirtiendo el incentivo. Mismo criterio que `SMOKE_MEAT_RECIPE` (crafting.ts):
    // procesar el ingrediente debe ganar en algún eje real, nunca perder en todos.
    curaEnergia: 8,
    curaHambre: 10,
  },

  {
    slug: 'racion-viaje',
    name: 'Ración de viaje',
    // "Raciones de viaje" (plural) es el nombre literal del equipo inicial de Gorhorn
    // (startingInventory.ts) — sin este alias, ni entityDiscovery.ts ni enciclopediaIndex.ts
    // reconocían el objeto que de verdad lleva en el inventario (bug real, auditoría 2026-07-30).
    aliases: ['raciones de viaje'],
    category: 'consumible',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 6,
    equipSlot: 'CONSUMIBLE_1',
    description: 'Bulto envuelto en tela basta con lo justo para aguantar el camino — unidad estándar de raciones, "para N días".',
    dimensiones: 'Bulto de 15x10 cm por ración.',
    // Sistema de fatiga (2026-07-29, bug real encontrado jugando en vivo): es el consumible real
    // del kit inicial de Gorhorn (ver startingInventory.ts) — sin esto, "comer para recuperar
    // energía" era inalcanzable para una partida nueva, porque su único objeto de comida no
    // restauraba nada (solo lo hacía `racion-carne-ahumada`, que él nunca lleva encima).
    curaEnergia: 20,
    curaHambre: 28,
  },

  {
    slug: 'racion-goirntes',
    name: 'Ración goirntes',
    category: 'consumible',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 5,
    equipSlot: 'CONSUMIBLE_1',
    description: 'Bloque compacto de comida prensada envuelto en papel encerado — más compacta y mejor conservada que la de campaña orca.',
    dimensiones: 'Bloque de 12x8 cm.',
    lugarOrigen: 'Meseta del Orden.',
    curaEnergia: 15,
    curaHambre: 20,
  },

  {
    // Slug ajustado (petición explícita, 2026-08-15: "renombrases el slug con el nombre del
    // archivo" — imagen ya subida "ascuas-raiz-fuego-banner.png"). Distinto de la FUENTE
    // (`sourceSlug: 'raiz-de-fuego'`, harvestSourceAliases/harvestSourceRegion/etc. más abajo, que
    // sigue igual — esto es solo el objeto ya recolectado, no la planta).
    slug: 'ascuas-raiz-fuego',
    name: 'Ascuas de Raíz de Fuego',
    category: 'consumible',
    tipo: 'CONSUMIBLE',
    equipSlot: 'CONSUMIBLE_1',
    description: 'Tallo nudoso y oscuro de Raíz de Fuego, caliente al tacto incluso recién cortado — iniciador de fuego, potencialmente explosivo.',
    dimensiones: 'Tallo de unos 20 cm.',
    // tier 5 (Grupo 3 § HarvestYield.condicion, 2026-08-24): mismo caso que veneno-espina —
    // "extracción con cuidado (destreza, Media 15 — falla = se inflama)" en texto sin dificultad
    // real detrás; tier 5 da la dificultad 15 que el texto prometía.
    tier: 5,
    valorGoirnos: 10,
  },

  // --- medicinal ---

  {
    slug: 'veneno-espina',
    name: 'Aguijón con veneno de Espina del Viento',
    aliases: ['aguijón de espina'],
    category: 'medicinal',
    tipo: 'CONSUMIBLE',
    equipSlot: 'CONSUMIBLE_1',
    description: 'Aguijón oscuro extraído con cuidado, todavía con una gota espesa de veneno en la punta — altera la percepción del dolor.',
    dimensiones: 'Aguijón de 6 cm.',
    // tier 5 (Grupo 3 § HarvestYield.condicion, 2026-08-24): el propio HarvestYield de este item
    // decía "extracción cuidadosa (destreza, Media 15)" en texto sin que el motor lo respetara —
    // dificultadForTier(tier) = 10 + tier, tier 5 da la dificultad 15 real que el texto prometía.
    tier: 5,
    valorGoirnos: 10,
  },

  {
    slug: 'cataplasma-flor-ceniza',
    name: 'Cataplasma de Flor de Ceniza',
    aliases: ['cataplasma de flor de ceniza'],
    category: 'medicinal',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 13,
    equipSlot: 'CONSUMIBLE_1',
    description: 'Forma preparada de los pétalos de Flor de Ceniza — adormece el dolor y ayuda a dormir a un herido, más suave que la cataplasma de salvia.',
    dimensiones: 'Emplasto de 8x8 cm.',
    // Corregido (auditoría de catálogo, 2026-08-13): prometía curar en su propia descripción pero
    // no tenía ningún efecto mecánico real — mismo patrón crudo→preparado que salvia (HERIDO→ILESO,
    // manojo-salvia-polvo/cataplasma-salvia-polvo): pétalos-flor-ceniza (crudo) ya cura hasta GRAVE, la
    // forma preparada sube un escalón, igual que su hermana de salvia.
    curaHasta: 'HERIDO',
    curaUnPaso: true,
    curaEnergia: 5,
  },

  {
    // Slug ajustado (petición explícita, 2026-08-15: "renombrases el slug con el nombre del
    // archivo", sin preposiciones — "eso es fallo mío" al nombrar el archivo, pero el `name` sí
    // las lleva) — imagen ya subida "cataplasma-salvia-polvo-banner.png".
    slug: 'cataplasma-salvia-polvo',
    name: 'Cataplasma de salvia del polvo',
    aliases: ['cataplasma de salvia'],
    category: 'medicinal',
    tipo: 'CONSUMIBLE', 
    valorGoirnos: 22,
    equipSlot: 'CONSUMIBLE_1', 
    description: 'Pasta verde grisácea de hojas machacadas de Salvia del Polvo — forma preparada de la salvia, corta hemorragias y limpia heridas.', 
    dimensiones: 'Emplasto de 10x10 cm.', 
    lugarOrigen: 'Llanuras del Viento Rojo.', 
    curaHasta: 'ILESO',
    curaUnPaso: true,
  },

  // Crafteo Tier 2, ronda 2 de objetos (roadmap 2026-07-20)
  {
    slug: 'contraveneno-salvia-ceniza',
    name: 'Contraveneno de salvia y ceniza',
    aliases: ['contraveneno'],
    category: 'medicinal',
    tipo: 'CONSUMIBLE', 
    valorGoirnos: 6,
    equipSlot: 'CONSUMIBLE_1', 
    description: 'Pasta oscura de olor amargo, mezcla preparada de salvia del polvo y pétalos de Flor de Ceniza — neutraliza el veneno de Espina del Viento.', 
    dimensiones: 'Pasta de 50 g.' 
  },

  {
    slug: 'manojo-salvia-polvo',
    name: 'Manojo de salvia del polvo',
    aliases: ['manojo de salvia'],
    category: 'medicinal',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 7,
    equipSlot: 'CONSUMIBLE_1',
    description: 'Manojo de hojas grises secas de Salvia del Polvo, atadas con un cordel — machacadas, cortan hemorragias y limpian heridas.',
    dimensiones: 'Manojo de 15 cm.',
    lugarOrigen: 'Llanuras del Viento Rojo.', 
    curaHasta: 'GRAVE',
    curaUnPaso: true,
  },

  {
    // Slug ajustado (petición explícita, 2026-08-15: "renombrases el slug con el nombre del
    // archivo" — imagen ya subida "infusion-petalos-flor-ceniza-banner.png").
    slug: 'infusion-petalos-flor-ceniza',
    name: 'Infusión de Pétalos de Flor de Ceniza',
    aliases: ['pétalos de flor de ceniza'],
    category: 'medicinal',
    tipo: 'CONSUMIBLE', 
    valorGoirnos: 9,
    equipSlot: 'CONSUMIBLE_1', 
    description: 'Infusión que adormece el dolor y deja dormir a un herido.',
    dimensiones: 'Puñado de pétalos de 3 a 4 cm.',
    curaHasta: 'GRAVE',
    curaEnergia: 10,
    curaUnPaso: true,
    // Hallazgo 13 — infusión (preparada con agua) sin mención explícita de sed en su descripción,
    // incluida igualmente por criterio de la usuaria ("toda infusión hidrata").
    curaAgua: 10,
  },

  // Primeros auxilios (2026-08-13, petición explícita: "una profesión que sea primeros-auxilios
  // que tenga pocas recetas de objetos básicos... si es convaleciente solo hay un item que te lleva
  // a grave... luego otro que mejora al siguiente, de grave a herido y de herido a ileso") — 3
  // objetos escalonados (curaUnPaso: true, ver crafting.ts § oficio 'primeros-auxilios-orcos-
  // llanuras') más uno de energía pura, todos crafteados a partir de lo que ya recolecta
  // herborista en Llanuras. Deliberadamente MÁS débiles objeto a objeto que 'manojo-salvia-polvo'/
  // 'infusion-petalos-flor-ceniza' en crudo (que ya curan HERIDO/GRAVE de golpe sin craftear nada)
  // — el profesión existe para el escalón final (HERIDO→ILESO), no para competir con la materia
  // prima.
  {
    // Slug ajustado (petición explícita, 2026-08-15: "renombrases el slug con el nombre del
    // archivo", sin preposiciones) — imagen ya subida "vendaje-improvisado-orcos-llanuras-banner.png".
    slug: 'vendaje-improvisado-orcos-llanuras',
    name: 'Vendaje improvisado orco de las Llanuras',
    category: 'medicinal',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 7,
    equipSlot: 'CONSUMIBLE_1',
    description: 'Tiras de tela atadas sobre un manojo machacado de salvia del polvo — primeros auxilios de campaña, lo justo para dejar de desangrarse.',
    dimensiones: 'Vendaje de 2 m.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
    curaHasta: 'GRAVE',
    curaUnPaso: true,
  },

  {
    slug: 'cataplasma-basica-salvia',
    name: 'Cataplasma básica de salvia',
    aliases: ['cataplasma básica'],
    category: 'medicinal',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 12,
    equipSlot: 'CONSUMIBLE_1',
    description: 'Salvia del polvo y pétalos de Flor de Ceniza machacados juntos en una pasta simple — cura mejor que el vendaje improvisado, pero sigue siendo primeros auxilios de campaña.',
    dimensiones: 'Emplasto de 10x10 cm.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
    curaHasta: 'HERIDO',
    curaUnPaso: true,
  },

  {
    slug: 'cataplasma-completa-salvia-ceniza',
    name: 'Cataplasma completa de salvia y ceniza',
    aliases: ['cataplasma completa'],
    category: 'medicinal',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 22,
    equipSlot: 'CONSUMIBLE_1',
    description: 'La preparación más cuidada de primeros auxilios que se puede hacer en campaña — doble ración de salvia del polvo y pétalos de Flor de Ceniza, machacados y aplicados con calma. Cierra hasta la última herida.',
    dimensiones: 'Emplasto de 15x15 cm.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
    curaHasta: 'ILESO'
  },

  {
    slug: 'infusion-espiga-roja',
    name: 'Infusión de espiga roja',
    aliases: ['infusión de espiga'],
    category: 'medicinal',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 10,
    equipSlot: 'CONSUMIBLE_1',
    description: 'Grano de espiga roja tostado e infusionado en agua hirviendo — más nutritiva que el grano crudo, prepara para seguir adelante.',
    dimensiones: 'Cuenco de 250 ml.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
    curaEnergia: 40,
    // Hallazgo 13 — infusión preparada "en agua hirviendo", candidato claro.
    curaAgua: 25,
  },

  // 8 consumibles nuevos (2026-08-24, Grupo 3 § 27 recursos/materiales sin receta) — mismo
  // criterio que boungo-asado (2026-07-29), primera receta real de varios oficios que ya
  // existían pero no tenían ningún objeto propio más allá de su primer ejemplo.
  {
    slug: 'carne-jusha-ahumada',
    name: 'Carne de Jusha ahumada',
    aliases: ['carne ahumada de jusha'],
    category: 'consumible',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 4,
    equipSlot: 'CONSUMIBLE_1',
    description: 'Carne de Jusha Esmeralda ahumada sobre brasas — se conserva mejor que cruda y rinde más energía.',
    dimensiones: 'Ración de 200 g.',
    lugarOrigen: 'Los Manaderos, Llanuras del Viento Rojo.',
    curaEnergia: 14,
    curaHambre: 18,
  },
  {
    slug: 'pan-trigo-escarlata',
    name: 'Pan de trigo escarlata',
    aliases: ['pan de trigo'],
    category: 'consumible',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 4,
    equipSlot: 'CONSUMIBLE_1',
    description: 'Trigo escarlata molido y horneado sobre piedra caliente — pan denso, poco habitual entre los orcos de las Llanuras.',
    dimensiones: 'Hogaza de 300 g.',
    lugarOrigen: 'La Sabana Alta, Llanuras del Viento Rojo.',
    curaEnergia: 10,
    curaHambre: 12,
  },
  {
    slug: 'panal-endulzado',
    name: 'Panal endulzado',
    aliases: ['panal de miel'],
    category: 'consumible',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 3,
    equipSlot: 'CONSUMIBLE_1',
    description: 'Panal de Lebude prensado y endulzado — dulce concentrado, poco cuerpo pero mucha energía rápida.',
    dimensiones: 'Trozo de 100 g.',
    lugarOrigen: 'El Pozo de Cauce Viejo, Llanuras del Viento Rojo.',
    curaEnergia: 8,
  },
  {
    slug: 'cuajada-murgol',
    name: 'Cuajada de múrgol',
    aliases: ['cuajada'],
    category: 'consumible',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 4,
    equipSlot: 'CONSUMIBLE_1',
    description: 'Leche de los múrgoles domados del Campamento del Clan Serhu, cuajada y prensada — de las pocas cosas que se producen dentro de la propia empalizada, no se cazan ni se recolectan.',
    dimensiones: 'Cuña de 150 g.',
    lugarOrigen: 'Karot Veku - Campamento del Clan Serhu, Llanuras del Viento Rojo.',
    curaEnergia: 10,
  },
  {
    slug: 'cataplasma-musgo',
    name: 'Cataplasma de musgo',
    aliases: ['cataplasma de musgo rojo'],
    category: 'medicinal',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 12,
    equipSlot: 'CONSUMIBLE_1',
    description: 'Musgo rojo machacado en una pasta simple, aplicada directamente sobre la herida — primeros auxilios de campaña, sin más pretensión.',
    dimensiones: 'Emplasto de 10x10 cm.',
    lugarOrigen: 'El Pozo de Cauce Viejo, Llanuras del Viento Rojo.',
    curaHasta: 'HERIDO',
    curaUnPaso: true,
  },
  {
    slug: 'filtro-salvatura',
    name: 'Filtro de Salvatura',
    aliases: ['filtro de salvatura'],
    category: 'medicinal',
    tipo: 'CONSUMIBLE',
    equipSlot: 'CONSUMIBLE_1',
    description: 'Pétalos de Flor Salvatura hervidos junto a pasto de sangre y pasto solar — primera poción real de la alquimia orca de las Llanuras más allá del contraveneno.',
    dimensiones: 'Frasco de 100 ml.',
    lugarOrigen: 'La Sabana Alta / Los Pastos de la Deriva, Llanuras del Viento Rojo.',
    curaHasta: 'HERIDO',
    curaUnPaso: true,
    tier: 2,
    valorGoirnos: 14,
  },
  {
    slug: 'filtro-claridad-quio',
    name: 'Filtro de claridad de Quio',
    aliases: ['filtro de claridad'],
    category: 'medicinal',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 3,
    equipSlot: 'CONSUMIBLE_1',
    description: 'El filtro natural de Quio, destilado en un frasco pequeño — despeja la cabeza tras un golpe fuerte.',
    dimensiones: 'Frasco de 50 ml.',
    lugarOrigen: 'Los Manaderos, Llanuras del Viento Rojo.',
    curaEnergia: 6,
  },
  {
    slug: 'estera-chudo-trenzado',
    name: 'Estera de Chudo Trenzado',
    aliases: ['estera de chudo', 'estera'],
    category: 'consumible',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 3,
    equipSlot: 'CONSUMIBLE_1',
    description: 'Chudos rojizos, verdileas acuáticas y hojas de Telda trenzados en una estera para dormir — un descanso de verdad, no solo suelo desnudo.',
    dimensiones: 'Estera de 180x60 cm.',
    lugarOrigen: 'Los Manaderos, Llanuras del Viento Rojo.',
    curaEnergia: 6,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TIPO: MATERIAL
  // ══════════════════════════════════════════════════════════════════════════

  // --- bloque ---

  {
    slug: 'bloque-piedra-tallada',
    name: 'Bloque de piedra tallada',
    aliases: ['bloque de piedra'],
    category: 'bloque',
    tipo: 'MATERIAL',
    valorGoirnos: 3,
    description: 'Bloque de piedra desbastado a golpes de maza y cincel hasta dejarlo plano por al menos dos caras — ya no es solo cascote, sirve para levantar un muro de verdad.',
    dimensiones: 'Bloque de 30x20x15 cm.',
  },

  // --- metal ---

  { 
    slug: 'lingote-aleacion-goirntes', 
    name: 'Lingote de aleación goirntes', 
    aliases: ['lingote de aleación'], 
    category: 'metal',
    tipo: 'MATERIAL', 
    valorGoirnos: 6,
    description: 'Metal refinado de la Meseta del Orden, moldeado en lingote — bien de comercio serio, no baratija.', 
    dimensiones: 'Lingote de 20x5x5 cm.', 
    lugarOrigen: 'Meseta del Orden.' 
  },

  {
    // Renombrado con identidad regional (2026-09-02, mismo criterio que Roca de Llanura Roja) —
    // "hierro" a secas sin apellido colisionaría con el hierro de otras regiones más adelante.
    slug: 'lingote-de-hierro',
    name: 'Lingote de Hierro de Llanura Roja',
    aliases: ['lingote de hierro'],
    category: 'metal',
    tipo: 'MATERIAL',
    valorGoirnos: 3,
    description: 'Metal fundido y colado en un molde sencillo, de la mena que se encuentra por toda la Llanura Roja — ya listo para forjar en la fragua del campamento.',
    dimensiones: 'Lingote de 20x5x5 cm.',
  },

  // Receta nueva (2026-08-15) — variante imantada del lingote de hierro, paso intermedio para
  // forjar la Aguja de Cardo Brújula (mena de hierro + arena imán fundidas juntas en la fragua).
  {
    slug: 'lingote-hierro-imantado',
    name: 'Lingote de Hierro Imantado de Llanura Roja',
    aliases: ['lingote imantado', 'lingote de hierro imantado'],
    category: 'metal',
    tipo: 'MATERIAL',
    valorGoirnos: 3,
    description: 'Lingote de hierro de la Llanura Roja fundido junto a arena imán — conserva un tirón magnético débil pero constante, notable si se acerca a otro metal.',
    dimensiones: 'Lingote de 20x5x5 cm.',
  },

  // --- viga ---

  // 3 materiales procesados nuevos (2026-08-24, Grupo 3 § materiales procesados de construcción,
  // ver docs/mecanicas/17-reglas-construcciones-reino.md) — mismo patrón que
  // bloque-piedra-tallada/lingote-de-hierro arriba: crudo → material procesado por oficio
  // regional, consumido por el Ayuntamiento mediano/grande a partir de ahora.
  {
    slug: 'viga-madera-tallada',
    name: 'Viga de madera tallada',
    aliases: ['viga de madera', 'viga tallada'],
    category: 'viga',
    tipo: 'MATERIAL',
    valorGoirnos: 3,
    description: 'Tronco desbastado y escuadrado en una viga recta de sección uniforme — lista para sostener un techo o un muro de verdad, ya no sirve solo de leña.',
    dimensiones: 'Viga de 200x15x15 cm.',
  },

  // --- columna ---

  {
    slug: 'columna-hueso',
    name: 'Columna de hueso',
    aliases: ['columna de hueso', 'columna osea'],
    category: 'columna',
    tipo: 'MATERIAL',
    valorGoirnos: 3,
    description: 'Varios huesos largos trabados y reforzados en un único puntal rígido — técnica orca de aprovechar lo que caza la propia tierra en vez de depender solo de piedra o madera.',
    dimensiones: 'Columna de 180x10x10 cm.',
  },

  // --- cordaje ---

  {
    slug: 'cordaje-trenzado',
    name: 'Cordaje trenzado',
    aliases: ['cordaje', 'cuerda trenzada'],
    category: 'cordaje',
    tipo: 'MATERIAL',
    valorGoirnos: 3,
    description: 'Fibra vegetal trenzada en cabos gruesos y resistentes — ata vigas, tensa pieles de techo, asegura lo que un edificio grande no puede confiar solo al peso.',
    dimensiones: 'Rollo de cordaje de 10 m.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TIPO: RECURSO
  // ══════════════════════════════════════════════════════════════════════════

  // --- hierba ---

  // --- Materia prima de otras regiones de Berig (2026-07-22, "incluye de momento solo todo lo
  // que sea de Berig") — Hierba del Hierro en bruto no tenía item propio, solo su forma ya
  // procesada (cota-ligera-goirntes); las demás fuentes nuevas reutilizan items ya existentes.
  {
    slug: 'hierba-del-hierro',
    name: 'Hierba del Hierro',
    category: 'hierba',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Hojas grisáceas extremadamente duras y ricas en minerales — materia prima de las aleaciones goirntes, sin procesar todavía.',
    dimensiones: 'Hojas de 20 a 30 cm.',
    lugarOrigen: 'Meseta del Orden.',
  },

  // Materia prima nueva (2026-08-15, petición explícita: "estos 3 no deberían ser extraibles sino
  // crafteables") — el Cardo Brújula recolectado en bruto, antes de tallarlo en la Aguja de Cardo
  // Brújula (ver CraftingRecipe en crafting.ts). Mismo slug que harvestSourceAliases/
  // harvestSourceRegion/harvestSourceDescriptions/harvestSourceTerrainTag ('cardo-brujula', más
  // abajo) a propósito — son tablas distintas (sourceSlug vs. ItemCatalog.slug), mismo patrón ya
  // usado por raiz-de-fuego/ascuas-raiz-fuego.
  {
    slug: 'cardo-brujula',
    name: 'Cardo Brújula',
    category: 'hierba',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Tallo espinoso rematado en una flor cerrada de un morado apagado, que siempre gira despacio hasta señalar el mismo rumbo — sin tallar todavía tiene curiosidad, pero ningún uso práctico.',
    dimensiones: 'Tallo de 25 cm.',
    lugarOrigen: 'Las Agujas Imán, Llanuras del Viento Rojo.',
  },

  // --- hueso ---

  // --- Materiales de fauna/flora nueva (roadmap 2026-07-20, propuesta de Fable, ver memoria
  // project_tarkor_propuesta_fauna_flora.md) ---
  {
    slug: 'colmillo-aullador',
    name: 'Colmillo de Aullador Rojo',
    aliases: ['colmillo de aullador'],
    category: 'hueso',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Colmillo curvo y afilado de Aullador Rojo — pieza clásica de los amuletos de hueso orcos.',
    dimensiones: 'Colmillo de 6 cm.',
  },

  {
    slug: 'hueso-largo-gargantua',
    name: 'Hueso largo de gargantúa',
    aliases: ['hueso largo'],
    category: 'hueso',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Hueso largo y macizo de un blanco amarillento, pesado en la mano — materia prima de lanzas.',
    dimensiones: 'Hueso de 90 cm de largo.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },

  {
    slug: 'hueso-ligero',
    name: 'Hueso ligero',
    category: 'hueso',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Hueso pequeño y liviano, fácil de tallar — para abalorios, agujas, mangos.',
    dimensiones: 'Fragmentos de 5 a 15 cm.',
  },

  {
    slug: 'placa-osea-gargantua',
    name: 'Placa ósea de gargantúa',
    aliases: ['placa ósea'],
    category: 'hueso',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Placa ósea blanquecina y gruesa, curva como una costilla — usada en construcción o armadura pesada.',
    dimensiones: 'Placa curva de 40x25 cm.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },

  // --- madera ---

  {
    slug: 'lena-matorral-cuerno',
    name: 'Leña de matorral de cuerno',
    aliases: ['leña de matorral'],
    category: 'madera',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Trozos de madera oscura y retorcida, corteza agrietada — arde lento y caliente. Producto de la fórmula de leña ya existente.',
    dimensiones: 'Trozos de 20 a 40 cm.',
  },

  // --- mena ---

  {
    // Slug ajustado (petición explícita, 2026-08-15: "renombrases el slug con el nombre del
    // archivo" — imagen ya subida "mena-hierro-llanuras-banner.png").
    slug: 'mena-hierro-llanuras',
    name: 'Mena de Hierro de las Llanuras',
    category: 'mena',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Roca oscura veteada de óxido rojizo, pesada para su tamaño — hierro sin refinar, todavía sin ninguna utilidad hasta pasar por la fragua.',
    dimensiones: 'Fragmentos de 10 a 20 cm.',
    lugarOrigen: 'Los Pilares Rotos, Llanuras del Viento Rojo.',
  },

  // --- piedra ---

  {
    slug: 'cuna-hielo-silice-sin-tallar',
    name: 'Cuña de hielo sílice sin tallar',
    aliases: ['cuña sin tallar'],
    category: 'piedra',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Bloque en bruto de hielo sílice de las minas de Cristal Helado, todavía sin tallar por manos Helsig — solo tiene sentido de verdad si se abre Cristal Helado.',
    dimensiones: 'Bloque en bruto de 15x10 cm.',
    lugarOrigen: 'Cristal Helado.'
  },

  // Receta nueva (2026-09-09, cierre del hueco de catálogo "12 fauna sin HarvestYield") — la propia
  // bio del Imanio (worldCatalog.ts § fauna) describe su armadura como "rocas imantadas flotantes"
  // que se van deformando con el tiempo a la forma de su cuerpo — distinto del mineral genérico
  // `arena-iman`/`punado-arena-iman` (recurso de suelo, no de fauna): esta pieza es la propia
  // armadura recogida al desollarlo, ya con esa deformación acumulada.
  {
    slug: 'roca-imanio',
    name: 'Roca imantada de Imanio',
    aliases: ['roca imantada', 'roca de imanio', 'rocas de imanio'],
    category: 'piedra',
    tipo: 'RECURSO',
    description: 'Fragmento de roca imantada, deformado con el tiempo hasta ajustarse al cuerpo de un Imanio — conserva un tirón magnético débil que se nota al acercarla a cualquier metal.',
    dimensiones: 'Fragmento de 8 a 15 cm, irregular.',
    tier: 4,
    valorGoirnos: 8,
  },

  {
    slug: 'esquirla-hielo-silice',
    name: 'Esquirla de hielo sílice',
    aliases: ['esquirla de hielo'],
    category: 'piedra',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Esquirla translúcida de un blanco azulado, fría al tacto y con un filo natural — para tallar filos y prótesis.',
    dimensiones: 'Esquirla de 10 a 20 cm.',
    lugarOrigen: 'Cristal Helado.',
  },

  {
    // Renombrado de "Piedra" a nombre propio de región (2026-09-02, zona 15 del repaso "Playa de
    // Ceniza Blanca") — decisión de diseño: evitar nombres genéricos sueltos que puedan colisionar
    // entre regiones distintas más adelante (Cristal Helado, Margen Silencioso...); `category:
    // 'piedra'` se mantiene, las 5 recetas que la consumen (construction.ts/crafting.ts) matchean
    // por categoría, no por slug exacto, así que el renombrado no rompe nada. Sin alias "piedra" a
    // propósito (misma decisión de diseño): un alias genérico solo puede ganar UNA región cuando
    // haya más de una "piedra" real en el catálogo — mismo criterio ya aplicado a
    // punado-arena-iman/saquito-arena-iman.
    slug: 'piedra',
    name: 'Roca de Llanura Roja',
    aliases: ['roca de llanura roja'],
    category: 'piedra',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Bloques y cascotes de roca rojiza erosionada, típica de toda la Llanura Roja — sirven para levantar muros, cimientos o un campamento.',
    dimensiones: 'Bloques de 20 a 30 cm.'
  },

  // Materia prima nueva (2026-08-15, mismo cambio que Cardo Brújula arriba) — la arena imán en
  // bruto, antes de embolsarla en un Saquito de arena imán o fundirla en un Lingote de hierro
  // imantado (ver crafting.ts). Slug distinto del narrativo 'saquito-arena-iman' a propósito: son
  // objetos mecánicamente distintos, no un simple rename.
  {
    slug: 'punado-arena-iman',
    name: 'Puñado de arena imán',
    aliases: ['arena imán', 'limaduras'],
    category: 'piedra',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Arena oscura y fina, cargada de limaduras magnéticas que dejan las tormentas — se pega a cualquier cosa de hierro que se le acerque.',
    dimensiones: 'Puñado de unos 100 g.',
    lugarOrigen: 'Las Agujas Imán, Llanuras del Viento Rojo.',
  },

  // --- piel ---

  {
    slug: 'lana-murgol',
    name: 'Lana de múrgol',
    category: 'piel',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Mechones de lana parda enredada de múrgol — fieltro para ropa y mantas.',
    dimensiones: 'Mechones de 10 a 20 cm.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Ampliación de lore 2026-08-21 — repaso "zona por zona" de Las Llanuras del Viento Rojo.
  // Ver docs/rpgtarkor/lore-mundo/flora-fauna.md/items.md para el detalle narrativo completo.
  // ══════════════════════════════════════════════════════════════════════════

  {
    slug: 'fibra-enredaderas-llanuras',
    name: 'Fibra de Enredaderas de las Llanuras',
    aliases: ['fibra vegetal', 'fibra de enredadera'],
    category: 'fibras',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Tallos fibrosos de las enredaderas que trepan por sombra en la Hondonada del Eco y la base de Los Pilares Rotos — material base de crafteo ligero.',
    dimensiones: 'Fibras de 30 a 60 cm.',
  },

  {
    slug: 'mena-yerreo',
    name: 'Mena de Yerreo',
    aliases: ['yerreo', 'mena de yerreo'],
    category: 'mena',
    tipo: 'RECURSO',
    description: 'Mineral con la apariencia del hierro pero de vetas rojas y brillos anaranjados — muy difícil de encontrar y en cantidades mínimas donde aparece.',
    dimensiones: 'Fragmentos de 5 a 10 cm.',
    tier: 4,
    valorGoirnos: 15,
    lugarOrigen: 'La Hondonada del Eco, Llanuras del Viento Rojo.',
  },

  {
    slug: 'lingote-yerreo',
    name: 'Lingote de Yerreo',
    aliases: ['lingote de yerreo'],
    category: 'metal',
    tipo: 'MATERIAL',
    description: 'Yerreo fundido en lingote — se obtiene fundiendo su mena, o directamente de las garras del Kirelon Arenoso si el cazador es herrero con fragua a mano.',
    dimensiones: 'Lingote de 15 cm.',
    tier: 4,
    valorGoirnos: 12,
  },

  {
    slug: 'lingote-hiyerro',
    name: 'Lingote de Hiyerro',
    aliases: ['hiyerro', 'lingote de hiyerro'],
    category: 'metal',
    tipo: 'MATERIAL',
    // Distinto a propósito de 'lingote-hierro-imantado' (ya existente, hierro + arena imán, para
    // la Aguja de Cardo Brújula) — nombre parecido, aleación distinta y muy superior: aquí entra
    // Yerreo, no solo arena imán. Alias sin solape con "hierro imantado" para que el detector no
    // confunda las dos recetas.
    description: 'La mejor aleación orca de las Llanuras — hierro, Yerreo y Arena Imán fundidos juntos. Material de las armas de mayor tier que un herrero de la región puede forjar. No debe confundirse con el Lingote de hierro imantado (aleación mucho más simple, sin Yerreo).',
    dimensiones: 'Lingote de 15 cm.',
    tier: 7,
    valorGoirnos: 21,
  },

  {
    slug: 'trozo-quitina-roja',
    name: 'Trozo de quitina roja',
    aliases: ['quitina roja', 'trozo de quitina'],
    category: 'quitina',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Fragmento del caparazón de un Gesgurio, color arcilla roja con púas más oscuras.',
    dimensiones: 'Fragmento de 3 a 6 cm.',
  },

  {
    slug: 'pieza-quitina-roja',
    name: 'Pieza de quitina roja',
    aliases: ['pieza de quitina'],
    category: 'quitina',
    tipo: 'MATERIAL',
    description: 'Varios trozos de quitina roja de Gesgurio, trabajados hasta formar una pieza completa lista para crafteo.',
    dimensiones: 'Pieza de 10 cm.',
    tier: 2,
    valorGoirnos: 6,
  },

  {
    slug: 'hueso-kirelon',
    name: 'Hueso de Kirelon',
    aliases: ['hueso de kirelon'],
    category: 'hueso',
    tipo: 'RECURSO',
    description: 'Hueso macizo del Kirelon Arenoso, depredador ciego de La Hondonada del Eco.',
    dimensiones: 'Hueso de 40 a 60 cm.',
    tier: 3,
    valorGoirnos: 6,
  },

  {
    slug: 'craneo-kirelon',
    name: 'Cráneo de Kirelon',
    aliases: ['craneo de kirelon', 'cráneo de kirelon'],
    category: 'hueso',
    tipo: 'RECURSO',
    description: 'Cráneo alargado del Kirelon Arenoso, hocico achatado y dientes en sierra todavía visibles.',
    dimensiones: 'Cráneo de 50 cm.',
    tier: 4,
    valorGoirnos: 10,
  },

  {
    slug: 'piel-kirelon',
    name: 'Piel de escamas de Kirelon',
    aliases: ['piel de kirelon'],
    category: 'piel',
    tipo: 'RECURSO',
    description: 'Escamas negras del Kirelon Arenoso, resistentes y flexibles pese a su grosor.',
    dimensiones: 'Piel de 1 a 2 m².',
    tier: 4,
    valorGoirnos: 10,
  },

  {
    slug: 'garras-kirelon',
    name: 'Garras de Kirelon',
    aliases: ['garras de kirelon'],
    category: 'hueso',
    tipo: 'RECURSO',
    description: 'Garras del Kirelon Arenoso, compuestas en su mayoría de Yerreo — un herrero con fragua a mano puede fundirlas directo en 2 Lingotes de Yerreo.',
    dimensiones: 'Garras de 12 cm.',
    tier: 5,
    valorGoirnos: 15,
  },

  {
    slug: 'madera-lucre-blanco',
    name: 'Madera de Lucre Blanco',
    aliases: ['madera de lucre'],
    category: 'madera',
    tipo: 'RECURSO',
    description: 'Tronco claro y muy resistente de los árboles de Lucre Blanco, en las cumbres de Los Pilares Rotos.',
    dimensiones: 'Tablones de 1 m.',
    tier: 6,
    valorGoirnos: 20,
  },

  {
    slug: 'resina-lucre-blanco',
    name: 'Resina de Lucre Blanco',
    aliases: ['resina de lucre'],
    category: 'resina',
    tipo: 'RECURSO',
    description: 'Resina blanca translúcida del Lucre Blanco — pegamento muy resistente.',
    dimensiones: 'Bloques de 8x5 cm.',
    tier: 5,
    valorGoirnos: 15,
  },

  // Junba Verde (zona 15 del repaso "zona por zona", Playa de Ceniza Blanca, 2026-09-02) — árbol
  // de tronco claro rematado en una maraña de lianas y hojas que le da forma de seta.
  {
    slug: 'madera-jumba',
    name: 'Madera Jumba',
    aliases: ['madera jumba', 'madera de junba verde'],
    category: 'madera',
    tipo: 'RECURSO',
    description: 'Madera clara y ligera del tronco de Junba Verde — fácil de trabajar, típica del mobiliario costero.',
    dimensiones: 'Tablones de 1 m.',
    tier: 2,
    valorGoirnos: 8,
  },

  {
    slug: 'resina-jumba-verde',
    name: 'Resina Jumba Verde',
    aliases: ['resina jumba', 'resina de junba verde'],
    category: 'resina',
    tipo: 'RECURSO',
    description: 'Resina verde intensa de las lianas de Junba Verde — pegajosa, de olor dulzón.',
    dimensiones: 'Bloques de 8x5 cm.',
    tier: 2,
    valorGoirnos: 6,
  },

  // Loot pescable/marisco de Playa de Ceniza Blanca (zona 15 del repaso, 2026-09-02) — vía la
  // nueva profesión "pescador" (Pescar/Buscar), nunca Cazar.
  {
    slug: 'carne-jashil',
    name: 'Carne de Jashil',
    aliases: ['carne de jashil'],
    category: 'alimento',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Carne de Jashil, pez abundante de Playa de Ceniza Blanca — sabor suave, base habitual de la cocina costera.',
    dimensiones: 'Filetes de 100 g.',
    tier: 1,
  },

  {
    slug: 'carne-toluh',
    name: 'Carne de Toluh',
    aliases: ['carne de toluh'],
    category: 'alimento',
    tipo: 'RECURSO',
    valorGoirnos: 6,
    description: 'Carne del Toluh, pez migratorio de gran tamaño — ración abundante, muy apreciada por lo raro que es dar con uno.',
    dimensiones: 'Filetes de 500 g.',
    tier: 7,
  },

  {
    slug: 'escamas-toluh',
    name: 'Escamas de Toluh',
    aliases: ['escamas de toluh'],
    category: 'escamas',
    tipo: 'RECURSO',
    description: 'Escama grande y dura del Toluh, gris oscuro — codiciada para crear armaduras.',
    dimensiones: 'Escamas de 8 a 10 cm.',
    tier: 7,
    valorGoirnos: 25,
  },

  {
    slug: 'carne-negueo',
    name: 'Carne de Negueo',
    aliases: ['carne de negueo', 'carne de negueo turquesa', 'carne de negueo solar'],
    category: 'alimento',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Carne de Negueo (Turquesa o Solar), pez carroñero de sabor pobre — poca energía, pero algunas recetas de cocina saben aprovechar su amargor.',
    dimensiones: 'Filetes de 60 g.',
    tier: 1,
  },

  {
    slug: 'bulco-arena-marisco',
    name: 'Bulco de Arena',
    aliases: ['bulco de arena', 'marisco de bulco'],
    category: 'alimento',
    tipo: 'RECURSO',
    valorGoirnos: 2,
    description: 'Interior blando y viscoso del caracol Bulco de Arena, mucho sabor a mar — marisco de la costa de Playa de Ceniza Blanca.',
    dimensiones: 'Pieza de 5 a 15 cm.',
    tier: 1,
  },

  {
    slug: 'musgo-rojo',
    name: 'Musgo Rojo',
    aliases: ['musgo arcilla', 'musgo rojo'],
    category: 'planta',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Musgo rojo como pelaje, recogido del Musgo Arcilla que crece pegado a la roca en zonas húmedas — material de construcción para tejados orcos.',
    dimensiones: 'Puñados de 200 g.',
  },

  {
    slug: 'madera-telda',
    name: 'Madera de Telda',
    aliases: ['madera de telda comun', 'madera de telda ceniza'],
    category: 'madera',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Madera clara de los árboles Telda —Común en El Pozo de Cauce Viejo, Ceniza en El Cruce de las Cenizas, misma especie y mismo recurso.',
    dimensiones: 'Tablones de 80 cm.',
  },

  {
    slug: 'resina-telda-gris',
    name: 'Resina Telda Gris',
    aliases: ['resina de telda'],
    category: 'resina',
    tipo: 'RECURSO',
    description: 'Resina gris de los árboles Telda — pegamento de uso general.',
    dimensiones: 'Bloques de 8x5 cm.',
    tier: 2,
    valorGoirnos: 3,
  },

  {
    slug: 'hojas-telda',
    name: 'Hojas de Telda',
    aliases: ['hojas de telda'],
    category: 'planta',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Hojas grandes de los árboles Telda, de 30 a 50 cm — material de tejados y cobertizos orcos. Misma hoja para Telda Común, Telda Ceniza y Telda Atardecer, solo cambian tronco/resina entre variantes.',
    dimensiones: 'Hojas de 30 a 50 cm.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },

  {
    slug: 'piel-guchapo',
    name: 'Piel de Guchapo',
    aliases: ['piel de guchapo'],
    category: 'piel',
    tipo: 'RECURSO',
    description: 'Piel tersa de Guchapo, tensa por el agua que el animal acumula en vida.',
    dimensiones: 'Piel de 1 m².',
    tier: 3,
    valorGoirnos: 6,
  },

  {
    slug: 'cera-lebude',
    name: 'Cera Lebude',
    aliases: ['cera de lebude'],
    category: 'cera',
    tipo: 'RECURSO',
    description: 'Cera de las colmenas de Lebude, en forma de pequeñas montañas junto a los Telda — material de construcción.',
    dimensiones: 'Bloques de 10x10 cm.',
    tier: 3,
    valorGoirnos: 6,
  },

  {
    slug: 'miel-lebude',
    name: 'Miel Lebude',
    aliases: ['miel de lebude'],
    category: 'alimento',
    tipo: 'RECURSO',
    description: 'Miel de las colmenas de Lebude — ingrediente de cocina.',
    dimensiones: 'Tarro de 200 g.',
    tier: 2,
    valorGoirnos: 3,
  },

  {
    slug: 'quitina-escorante',
    name: 'Quitina Escorante',
    aliases: ['quitina de escorante'],
    category: 'quitina',
    tipo: 'RECURSO',
    description: 'Fragmento del caparazón acorazado del Escorante, con los diminutos pinchos que segregan su líquido repelente.',
    dimensiones: 'Fragmento de 8 cm.',
    tier: 3,
    valorGoirnos: 6,
  },

  {
    slug: 'piel-ferike',
    name: 'Piel de Ferike',
    aliases: ['piel de ferike'],
    category: 'piel',
    tipo: 'RECURSO',
    description: 'Pelaje espeso de Ferike, raíz negra y puntas verde oscuro — material para abalorios de tier alto.',
    dimensiones: 'Piel de 1,5 m².',
    tier: 6,
    valorGoirnos: 20,
  },

  {
    slug: 'garras-ferike',
    name: 'Garras Ferike',
    aliases: ['garras de ferike'],
    category: 'hueso',
    tipo: 'RECURSO',
    description: 'Garras curvas y anchas del Ferike, capaces de desgarrar y escalar árboles.',
    dimensiones: 'Garras de 15 cm.',
    tier: 6,
    valorGoirnos: 20,
  },

  {
    slug: 'melena-cola-ferike',
    name: 'Melena de cola Ferike',
    aliases: ['melena de ferike', 'melena de cola'],
    category: 'pelo',
    tipo: 'RECURSO',
    description: 'Espigas de pelo negro de la cola-maza de un Ferike macho — objeto especial, muy baja probabilidad de loot, ingrediente del crafteo de mayor calidad de su tier.',
    dimensiones: 'Mechón de 40 cm.',
    tier: 7,
    valorGoirnos: 30,
  },

  {
    slug: 'leche-murgol',
    name: 'Leche de Múrgol',
    aliases: ['leche de murgol'],
    category: 'alimento',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Leche del recinto de Múrgol domados del Campamento del Clan Serhu.',
    dimensiones: 'Odre de 1 litro.',
  },

  {
    slug: 'fragmento-gargantua',
    name: 'Fragmento de Gargantúa',
    aliases: ['fragmentos de gargantua'],
    category: 'hueso',
    tipo: 'RECURSO',
    description: 'Trozo pequeño del esqueleto de la Gargantúa de Ceniza de El Osario de la Manada.',
    dimensiones: 'Fragmento de 10 a 20 cm.',
    tier: 2,
    valorGoirnos: 3,
  },

  {
    slug: 'hueso-gargantua-construccion',
    name: 'Huesos de Gargantúa',
    aliases: ['huesos de gargantua'],
    category: 'hueso',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Piezas grandes del esqueleto de El Osario de la Manada — material de construcción, distinto del Hueso largo (materia prima de lanzas) y la Placa ósea (armadura).',
    dimensiones: 'Huesos de 60 a 100 cm.',
  },

  {
    slug: 'boungo',
    name: 'Boungo',
    aliases: ['boungo', 'seta boungo'],
    category: 'alimento',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Seta de sombrero marrón oscuro con manchas rojas, tallo fino beis, aspecto seco — crece en otoño en El Osario de la Manada, en cúmulos apretados.',
    dimensiones: 'Setas de 5 a 30 cm.',
  },

  {
    slug: 'boungo-asado',
    name: 'Boungo asado',
    aliases: ['boungo asado', 'setas asadas'],
    category: 'consumible',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 4,
    equipSlot: 'CONSUMIBLE_1',
    description: 'Boungo asado sobre brasas por un cocinero orco — la primera receta real del oficio de cocinero-orcos-llanuras, más allá de las raciones reasignadas.',
    dimensiones: 'Ración de 150 g.',
    curaEnergia: 12,
  },

  {
    slug: 'verdileas-acuaticas',
    name: 'Verdileas Acuáticas',
    aliases: ['verdileas', 'algas de manaderos'],
    category: 'planta',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Alga de Los Manaderos, base de la cadena trófica de la charca — alimento de la Jusha Esmeralda.',
    dimensiones: 'Mata de 20 cm.',
  },

  // Temune (zona 15 del repaso "zona por zona", Playa de Ceniza Blanca, 2026-09-02) — algas
  // anchas y curvadas arrancadas por la corriente, varadas en la orilla.
  {
    slug: 'algas-temune',
    name: 'Algas Temune',
    aliases: ['algas temune', 'temune'],
    category: 'planta',
    tipo: 'RECURSO',
    description: 'Alga ancha y curvada, de color verde tirando a marrón, sabor suave a mar — ingrediente habitual de la cocina costera.',
    dimensiones: 'Mata de 40 a 60 cm.',
    tier: 1,
    valorGoirnos: 2,
  },

  {
    // Renombrado 2026-09-04 (creación del vocabulario de mundo, docs/rpgtarkor/lore-mundo/lenguas-helek.md) —
    // "Junco" es fauna/flora real de la Tierra, sustituido por "Chudo" en todo el catálogo: mismo
    // patrón que Telda (especie base con variantes regionales, no "árbol" genérico).
    slug: 'chudos-rojizos',
    name: 'Chudos Rojizos',
    aliases: ['chudos', 'chudos rojizos', 'chudos de los manaderos'],
    category: 'planta',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Chudos rojizos de las charcas de Los Manaderos — material de tejido y techado.',
    dimensiones: 'Tallos de 80 cm a 1,2 m.',
  },

  {
    slug: 'carne-jusha',
    name: 'Carne de Jusha',
    aliases: ['carne de jusha'],
    category: 'alimento',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Carne de Jusha Esmeralda, sabor amargo pero comestible — ingrediente de cocinero-orcos-llanuras.',
    dimensiones: 'Filetes de 100 g.',
  },

  {
    slug: 'escama-jusha',
    name: 'Escama de Jusha',
    aliases: ['escama de jusha'],
    category: 'escamas',
    tipo: 'RECURSO',
    description: 'Escama verde musgo con brillos azul oscuro de la Jusha Esmeralda.',
    dimensiones: 'Escamas de 1 a 2 cm.',
    tier: 2,
    valorGoirnos: 3,
  },

  {
    slug: 'piel-miruina',
    name: 'Piel de Miruina',
    aliases: ['piel de miruina'],
    category: 'piel',
    tipo: 'RECURSO',
    description: 'Piel impermeable del Miruina, roedor nadador nocturno de Los Manaderos.',
    dimensiones: 'Piel de 1 m².',
    tier: 3,
    valorGoirnos: 6,
  },

  {
    slug: 'filtro-quio',
    name: 'Filtro de Quio',
    aliases: ['filtro de quio'],
    category: 'filtro',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Boca filtradora del Quio, pelos finos que retienen y filtran como las barbas de una ballena.',
    dimensiones: 'Filtro de 3 cm.',
  },

  {
    slug: 'plumas-tura-jusha',
    name: 'Plumas de Tura Jusha',
    aliases: ['plumas de tura jusha'],
    category: 'pluma',
    tipo: 'RECURSO',
    description: 'Plumas del plumaje alborotado de la Tura Jusha.',
    dimensiones: 'Plumas de 10 a 15 cm.',
    tier: 2,
    valorGoirnos: 3,
  },

  {
    slug: 'garra-tura-jusha',
    name: 'Garra retráctil de Tura Jusha',
    aliases: ['garra de tura jusha'],
    category: 'hueso',
    tipo: 'RECURSO',
    description: 'Garra tipo dinosaurio, con uña retráctil negra, de la pata de la Tura Jusha.',
    dimensiones: 'Garra de 8 cm.',
    tier: 2,
    valorGoirnos: 3,
  },

  {
    slug: 'pasto-solar',
    name: 'Pasto Solar',
    aliases: ['pasto solar', 'hierba comun'],
    category: 'hierba',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Hierba amarilla, el pasto base de toda la llanura allí donde crece vegetación.',
    dimensiones: 'Manojo de 200 g.',
    // Sin candado de Location única (ver harvestSourceHomeLocationSlug) desde 2026-08-22 — sin
    // lugarOrigen, el fallback de región de `selectDiscoveries` (discovery.ts) lo habría dejado
    // sin filtrar ni siquiera por región, no solo por zona.
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },

  {
    slug: 'fibra-gradias',
    name: 'Fibra de Gradias',
    aliases: ['gradias', 'fibra de gradias'],
    category: 'fibras',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Ramas fibrosas del arbusto Gradias — sus hojas anchas sueltan toda su agua acumulada al triturarlas.',
    dimensiones: 'Ramas de 30 cm.',
  },

  {
    slug: 'petalos-flor-salvatura',
    name: 'Pétalos de Flor Salvatura',
    aliases: ['flor salvatura', 'petalos de salvatura'],
    category: 'medicinal',
    tipo: 'RECURSO',
    description: 'Pétalos verdes con tono azulado de la Flor Salvatura, planta negra de aspecto muerto — ingrediente base de alquimia para varias recetas de pociones curativas.',
    dimensiones: 'Pétalos de 4 cm.',
    tier: 3,
    valorGoirnos: 6,
  },

  {
    slug: 'piel-cuernahoja',
    name: 'Piel de Cuernahoja',
    aliases: ['piel de cuernahoja'],
    category: 'piel',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Pelaje corto y ligero de Cuernahoja, rojo por arriba y blanco por el vientre.',
    dimensiones: 'Piel de 1 m².',
  },

  {
    // Renombrado por completo (pasada de objetos narrativos sin uso, 2026-09-02) — de "Cuerno de
    // Cuernahoja" (cuerno en bruto sin más función) a un material de crafteo real: el casquillo de
    // hueso que enganchase la punta de una lanza al asta, oficio típico orco de las Llanuras.
    slug: 'cuerno-cuernahoja',
    name: 'Enganche de hueso de Cuernahoja',
    aliases: ['cuerno de cuernahoja', 'enganche de hueso', 'enganche de cuernahoja'],
    category: 'cuerno',
    tipo: 'RECURSO',
    description: 'Casquillo de hueso de Cuernahoja, vaciado y pulido para encajar la punta de una lanza en el asta — el de las hembras, más ancho, es la variante de mayor calidad.',
    dimensiones: 'Casquillo de 30 a 40 cm.',
    tier: 2,
    valorGoirnos: 3,
    // PENDIENTE DE IMPLEMENTAR (misma pasada, decisión explícita de la usuaria): ingrediente
    // material para craftear una Lanza, específicamente el enganche que une la punta al asta —
    // crafteo típico de los orcos de las Llanuras. Ver memoria
    // tarkor_pasada_objetos_narrativos_2026-09-02. No implementado todavía.
  },

  {
    slug: 'volcanita',
    name: 'Volcanita',
    aliases: ['volcanita'],
    category: 'mena',
    tipo: 'RECURSO',
    description: 'Mineral volcánico de El Filo de las Brasas, veta común de la zona.',
    dimensiones: 'Fragmentos de 8 cm.',
    tier: 3,
    valorGoirnos: 6,
  },

  {
    slug: 'rovalnica',
    name: 'Rovalnica',
    aliases: ['rovalnica'],
    category: 'piedra',
    tipo: 'RECURSO',
    description: 'Roca de construcción negra con vetas rojas, de El Filo de las Brasas.',
    dimensiones: 'Bloques de 20 cm.',
    tier: 2,
    valorGoirnos: 3,
  },

  {
    slug: 'fercaneo',
    name: 'Fercaneo',
    aliases: ['fercaneo'],
    category: 'mena',
    tipo: 'RECURSO',
    description: 'Mineral casi imposible de encontrar, solo cerca de cráteres y lava en El Filo de las Brasas —más probable en Las Fumarolas Negras—, protegido por las propias Salamandras de Escoria.',
    dimensiones: 'Fragmentos de 5 cm.',
    tier: 5,
    valorGoirnos: 22,
  },

  {
    slug: 'pasto-de-sangre',
    name: 'Pasto de Sangre',
    aliases: ['pasto de sangre', 'hierba roja'],
    category: 'hierba',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Hierba roja de La Sabana Alta, más alta y densa que el Pasto Solar del que desciende — el tono rojo viene de la mezcla de esa raza de pasto con la mineralización, también roja, del agua de la zona.',
    dimensiones: 'Manojo de 200 g.',
    lugarOrigen: 'La Sabana Alta, Llanuras del Viento Rojo.',
  },

  {
    slug: 'madera-telda-atardecer',
    name: 'Madera de Telda Atardecer',
    aliases: ['madera de telda atardecer', 'telda atardecer'],
    category: 'madera',
    tipo: 'RECURSO',
    description: 'Madera de la misma especie que la Telda Común y la Telda Ceniza, pero con tronco y hojas de tonos rojos — la mejor madera de todas las variantes de Telda conocidas, propia de La Sabana Alta.',
    dimensiones: 'Tablones de 80 cm.',
    tier: 4,
    valorGoirnos: 10,
  },

  {
    slug: 'resina-telda-atardecer',
    name: 'Resina de Telda Atardecer',
    aliases: ['resina de telda atardecer'],
    category: 'resina',
    tipo: 'RECURSO',
    description: 'Resina roja de los árboles de Telda Atardecer — pegamento más fino que la Resina Telda Gris común.',
    dimensiones: 'Bloques de 8x5 cm.',
    tier: 3,
    valorGoirnos: 6,
  },

  {
    slug: 'trigo-escarlata',
    name: 'Trigo Escarlata',
    aliases: ['trigo escarlata'],
    category: 'alimento',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Espigas de un rojo intenso, base para harinas — crece salvaje en La Sabana Alta. Los orcos de las Llanuras nunca han logrado cultivarlo de verdad: la presión Goirnte y el terreno que ocupan no les han dejado desarrollar una agricultura propia, una de las razones reales de que el clan nunca se haya expandido como civilización.',
    dimensiones: 'Espigas de 25 cm.',
  },

  {
    slug: 'roca-luclara',
    name: 'Roca Luclara',
    aliases: ['roca luclara'],
    category: 'piedra',
    tipo: 'RECURSO',
    description: 'Piedra clara, casi blanca, similar al mármol — los Towrgu excavan en ella sus propios nidos. Material de construcción de tier alto para edificaciones de Las Llanuras.',
    dimensiones: 'Bloques de 25 cm.',
    tier: 6,
    valorGoirnos: 20,
  },

  {
    slug: 'piel-towrgu',
    name: 'Piel de Towrgu',
    aliases: ['piel de towrgu'],
    category: 'piel',
    tipo: 'RECURSO',
    description: 'Pelaje corto y erizado de Towrgu, en tonos de rojo con manchas.',
    dimensiones: 'Piel de 1,3 m².',
    tier: 4,
    valorGoirnos: 10,
  },

  {
    slug: 'garras-towrgu',
    name: 'Garras de Towrgu',
    aliases: ['garras de towrgu'],
    category: 'garra',
    tipo: 'RECURSO',
    description: 'Garras curvas de Towrgu, tan afiladas para trepar como para desgarrar.',
    dimensiones: 'Garras de 6 a 8 cm.',
    tier: 5,
    valorGoirnos: 15,
  },

  // Receta nueva (2026-09-09, cierre del hueco de catálogo "12 fauna sin HarvestYield" — Imanio y
  // Nuente eran los 2 únicos slugs pendientes reales, ver worldCatalog.ts § harvestYields más
  // abajo): garra del depredador nocturno de Las Agujas Imán, mismo patrón exacto que
  // aullador-rojo/zense-ceniza (trofeo con `condicion: 'cuchillo'`).
  {
    slug: 'garra-nuente',
    name: 'Garra de Nuente',
    aliases: ['garra de nuente', 'garras de nuente'],
    category: 'garra',
    tipo: 'RECURSO',
    description: 'Garra afilada de Nuente, curtida por la caza nocturna en Las Agujas Imán — sirve tanto de trofeo como para tallar puntas de flecha.',
    dimensiones: 'Garra de 5 a 7 cm.',
    tier: 6,
    valorGoirnos: 18,
  },

  {
    slug: 'colmillos-towrgu',
    name: 'Colmillos de Towrgu',
    aliases: ['colmillos de towrgu', 'dientes de towrgu'],
    category: 'hueso',
    tipo: 'RECURSO',
    description: 'Dientes cortos y afilados de una boca capaz de abrirse casi hasta las orejas.',
    dimensiones: 'Colmillos de 3 a 5 cm.',
    tier: 6,
    valorGoirnos: 20,
  },

  {
    slug: 'piel-coracelo',
    name: 'Piel de Coracelo',
    aliases: ['piel de coracelo'],
    category: 'piel',
    tipo: 'RECURSO',
    description: 'Pelaje espeso y largo de Coracelo, en tonos ceniza claro o marrón claro.',
    dimensiones: 'Piel de 80 cm.',
    tier: 2,
    valorGoirnos: 3,
  },

  {
    slug: 'colmillos-coracelo',
    name: 'Colmillos de Coracelo',
    aliases: ['colmillos de coracelo'],
    category: 'hueso',
    tipo: 'RECURSO',
    description: 'Los dos largos colmillos inferiores, cuadrados, de un Coracelo.',
    dimensiones: 'Colmillos de 8 a 12 cm.',
    tier: 3,
    valorGoirnos: 6,
  },

  {
    slug: 'cola-coracelo',
    name: 'Cola de Coracelo',
    aliases: ['cola de coracelo'],
    category: 'escamas',
    tipo: 'RECURSO',
    description: 'El bulto de escamas duras del final de la cola de un Coracelo, que el animal usa en vida para partir roca — resistencia equiparable al hierro. Material crudo para crafteos que no son de construcción.',
    dimensiones: 'Bulto de 15 cm.',
    tier: 4,
    valorGoirnos: 10,
  },

  {
    slug: 'piel-corredor',
    name: 'Piel de Corredor de Cauce',
    aliases: ['piel de corredor'],
    category: 'piel',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Piel rojiza de Corredor de Cauce, fina y flexible, curtida para aguantar el calor de la llanura.',
    dimensiones: 'Pieza de aproximadamente 100x60 cm.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },

  {
    slug: 'piel-gargantua',
    name: 'Piel de gargantúa',
    category: 'piel',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Piel gruesa de un gris ceniciento, curtida en placas rígidas — solo de cacería ritual o cadáver ya muerto.',
    dimensiones: 'Placa de aproximadamente 150x100 cm.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },

  {
    slug: 'piel-canizor',
    name: 'Piel de Canizor',
    category: 'piel',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Pelaje corto y denso, entre felino y cánido — el de una hembra es más tupido y se paga mejor. Muy valorada por los Maktor: llevarla es una forma de reclamar la vieja costumbre del clan.',
    dimensiones: 'Pieza de aproximadamente 90x55 cm.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },

  {
    slug: 'piel-rondador',
    name: 'Piel de Rondador de Brasas',
    aliases: ['piel de rondador'],
    category: 'piel',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Piel gruesa de un gris ceniciento, pelaje espeso propio de cazador nocturno — buena capa.',
    dimensiones: 'Pieza de aproximadamente 80x50 cm.',
  },

  {
    slug: 'piel-salamandra',
    name: 'Piel de Salamandra de Escoria',
    aliases: ['piel de salamandra'],
    category: 'piel',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Piel escamosa de un gris ceniciento, resistente al fuego — cuero ignífugo.',
    dimensiones: 'Pieza de aproximadamente 90x60 cm.',
  },

  // --- pluma ---

  {
    slug: 'plumas-rojizas',
    name: 'Puñado de plumas rojizas',
    aliases: ['plumas rojizas'],
    category: 'pluma',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Puñado de plumas cortas de un rojo apagado, de Corretolvas — uso decorativo o trueque menor.',
    dimensiones: 'Plumas de 8 a 10 cm.',
  },

  // --- quitina ---

  {
    slug: 'caparazon-espina',
    name: 'Caparazón de Espina del Viento',
    aliases: ['caparazón de espina'],
    category: 'quitina',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Placa de quitina oscura y brillante, dura como el cuerno, del caparazón de una Espina del Viento.',
    dimensiones: 'Placa de 30x20 cm.',
  },

  // --- resina ---

  {
    slug: 'resina-trepador-ocaso',
    name: 'Bloque de resina de Trepador Ocaso',
    aliases: ['resina de trepador ocaso'],
    category: 'resina',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Bloque de resina ambarina y pegajosa — sella e impermeabiliza.',
    dimensiones: 'Bloque de 10x10 cm.',
    lugarOrigen: 'Margen Silencioso.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TIPO: NARRATIVO
  // ══════════════════════════════════════════════════════════════════════════

  // --- documento ---

  {
    slug: 'correspondencia-concordia',
    name: 'Correspondencia sellada de la Concordia',
    aliases: ['correspondencia sellada'],
    category: 'documento',
    tipo: 'NARRATIVO',
    valorGoirnos: 8,
    description: 'Rollo de pergamino sellado con cera y el emblema de la Concordia — puede saber demasiado.',
    dimensiones: 'Rollo de 20 cm.',
    lugarOrigen: 'Concordia de Hierro.',
  },

  {
    slug: 'mapa-de-patrullas',
    name: 'Croquis de rutas de patrulla',
    aliases: ['croquis de rutas'],
    category: 'documento',
    tipo: 'NARRATIVO',
    valorGoirnos: 10,
    description: 'Croquis a mano alzada sobre cuero fino, rutas marcadas con tinta desvaída — saber por dónde no pasar.',
    dimensiones: 'Croquis en cuero de 25x20 cm.',
    lugarOrigen: 'Concordia de Hierro.',
  },

  { 
    slug: 'diario-de-soldado', 
    name: 'Diario de un soldado goirntes', 
    aliases: ['diario de soldado'], 
    category: 'documento',
    tipo: 'NARRATIVO', 
    valorGoirnos: 3,
    description: 'Cuaderno de tapas de cuero gastado, letra apretada — un nombre, una familia en la Meseta, humaniza el saqueo.', 
    dimensiones: 'Cuaderno de 15x10 cm.', 
    lugarOrigen: 'Meseta del Orden.' 
  },

  // Objeto con efecto mecánico real (petición explícita, 2026-07-23): tenerlo en el inventario
  // desbloquea ver los puntos de ubicación de Llanuras en la pestaña de Mapa — mismo patrón "un
  // objeto por región" pensado para el resto de Berig cuando se pueble con coordenadas.
  // Migrado 2026-08-03 a `tipo: ESPECIAL` + `effectKey` (antes el frontend comprobaba el nombre
  // EXACTO del objeto a mano, `InteractiveMap.tsx`/`MapaPanel.tsx` — frágil, se rompía si se
  // renombraba en un saqueo/regalo personalizado; ver MapaPanel.tsx para el consumidor real).
  {
    slug: 'mapa-de-las-llanuras',
    name: 'Mapa de las Llanuras',
    aliases: ['mapa de llanuras'],
    category: 'especial',
    tipo: 'ESPECIAL',
    valorGoirnos: 0,
    description: 'Piel curtida con las rutas, campamentos y pozos de las Llanuras del Viento Rojo marcados a mano por generaciones de clanes — suficiente para orientarse por el territorio sin perderse.',
    effectKey: 'reveal-map-llanuras',
    effectDescription: 'Mientras lo lleves encima, la pestaña Mapa muestra los puntos de ubicación reales de Las Llanuras del Viento Rojo, no solo la región resaltada.',
    dimensiones: 'Piel curtida de 40x30 cm, enrollada.',
    lugarOrigen: 'Llanuras del Viento Rojo.',
  },
  {
    slug: 'mapa-de-cristal-helado',
    name: 'Mapa de Cristal Helado',
    aliases: ['mapa de cristal helado'],
    category: 'especial',
    tipo: 'ESPECIAL',
    valorGoirnos: 0,
    description: 'Piel curtida con las rutas, campamentos y pozos de Cristal Helado marcados a mano por generaciones de clanes — suficiente para orientarse por el territorio sin perderse.',
    effectKey: 'reveal-map-cristal-helado',
    effectDescription: 'Mientras lo lleves encima, la pestaña Mapa muestra los puntos de ubicación reales de Cristal Helado, no solo la región resaltada.',
    dimensiones: 'Piel curtida de 40x30 cm, enrollada.',
    lugarOrigen: 'Cristal Helado.',
  },
  
  {
    slug: 'sello-patrulla-concordia',
    name: 'Sello de patrulla de la Concordia',
    aliases: ['sello de patrulla'],
    category: 'documento',
    tipo: 'NARRATIVO',
    valorGoirnos: 12,
    description: 'Disco de aleación grabado con el emblema de una patrulla — acredita, o incrimina, a quien lo lleva.',
    dimensiones: 'Disco de 4 cm de diámetro.',
    lugarOrigen: 'Concordia de Hierro.',
  },

  { 
    slug: 'tablilla-quemada-maktor', 
    name: 'Tablilla quemada', 
    category: 'documento',
    tipo: 'NARRATIVO', 
    valorGoirnos: 2,
    description: 'Fragmento de una tablilla de arcilla cocida, ennegrecida por el fuego que arrasó el asentamiento — lo que queda de la escritura apenas se distingue.', 
    dimensiones: 'Fragmento de 12x8 cm.', 
    lugarOrigen: 'Clan Maktor.' 
  },

  // --- valor ---

  {
    slug: 'abalorios',
    name: 'Abalorios variados',
    aliases: ['abalorios'],
    // Categoría 'cosmetico' + ranura COSMETICO_CINTURA (2026-08-03, sustituye a ABALORIO —
    // retirada del enum, ver EquipSlot en schema.prisma).
    category: 'cosmetico',
    tipo: 'NARRATIVO',
    valorGoirnos: 2,
    equipSlot: 'COSMETICO_CINTURA',
    // Pasada de objetos narrativos sin función real en juego (2026-09-02, "al menos todo objeto
    // que se almacene en el inventario" debía aportar algo) — al ser equipable, el gancho natural
    // es statBonuses, no venta/lore: cuentas de trueque llevadas como adorno, encaja con la
    // sociabilidad que representa el carisma.
    statBonuses: { carisma: 3 },
    description: 'Puñado de cuentas de hueso, piedra pulida y vidrio volcánico ensartadas en cordel — trueque menor.',
    dimensiones: 'Cuentas de 1 cm en cordel de 30 cm.',
  },

  {
    slug: 'amuleto-hueso',
    name: 'Amuleto de hueso',
    category: 'cosmetico',
    tipo: 'NARRATIVO',
    valorGoirnos: 6,
    // Colgante de verdad (2026-07-30, "categorizar por ranura"). Ranura actualizada 2026-08-03:
    // COSMETICO_CINTURA (ABALORIO retirado del enum) — ya no comparte hueco con el Tótem Maktor,
    // que ahora vive en COSMETICO_ESPALDA, más abajo.
    equipSlot: 'COSMETICO_CINTURA',
    // Recalibrado (2026-09-02, misma pasada que abalorios): trofeo de caza importante, no solo
    // adorno — voluntad por lo que representa haber cobrado esa presa, carisma por llevarlo visible.
    statBonuses: { voluntad: 1, carisma: 2 },
    description: 'Cordel de cuero con vértebras o colmillos tallados de una presa importante, colgados como cuentas.',
    dimensiones: 'Cordel de 40 cm con piezas de 2 a 3 cm.',
  },

  { slug: 'esquirla-celeste-caida',
    name: 'Esquirla celeste caída',
    aliases: ['esquirla celeste'],
    category: 'valor',
    tipo: 'NARRATIVO',
    // "Origen Azul" corregido (auditoría de coherencia código↔lore, 2026-09-05) — es el NOMBRE
    // DEL PLANETA (genesis.md: "Helek Sirik" = "Origen Azul"), nunca un fenómeno del cielo; la
    // frase original sonaba a un astro o entidad celeste. El fragmento real es del cinturón de
    // micro-cristales (genesis.md § "El cielo sin luna") — nadie en las Llanuras conoce su origen
    // exacto ni el reparto de autoría entre Semillas, solo que a veces cae uno tras una tormenta.
    description: 'Fragmento diminuto y frío al tacto, caído del cielo durante una tormenta — nadie en las Llanuras sabe explicar de dónde viene el cinturón que brilla de noche, solo que a veces deja esto atrás.',
    dimensiones: 'Fragmento de 2 cm.',
    // tier 9 (Grupo 3 § HarvestYield.condicion, 2026-08-24): el propio HarvestYield lo describe
    // "extremadamente rara — tratar como añadido narrativo ocasional... nunca drop garantizado",
    // más raro que fercaneo (tier 5, "casi imposible") y melena-cola-ferike (tier 7, "muy baja
    // probabilidad") — el tier más alto del catálogo hasta hoy, a propósito.
    //
    // PENDIENTE DE IMPLEMENTAR (pasada de objetos narrativos sin uso, 2026-09-02, decisión
    // explícita de la usuaria): este será el ingrediente exclusivo de un Báculo mágico nuevo, tier
    // 7 (el tier máximo de armas de ataque hoy — la primera arma `WeaponCategory.BACULO`, que ya
    // existe en el enum y ya tiene habilidad básica lista en weaponAbilities.ts pero ningún objeto
    // real todavía). Solo obtenible en La Hondonada del Eco, de noche, muy poco probable — valor en
    // Goirnos alto acorde. Ver memoria tarkor_pasada_objetos_narrativos_2026-09-02 para el detalle
    // técnico completo (BACULO→magia ya mapeado, ficha de habilidad ya escrita, CHAMAN_WEAPONS ya
    // lo incluye). No tocar sin retomar esa pieza completa — de momento sigue sin receta ni drop
    // condicionado por momento del día.
    tier: 9,
    valorGoirnos: 80,
  },

  {
    slug: 'garra-rondador',
    name: 'Garra de Rondador de Brasas',
    aliases: ['garra de rondador'],
    category: 'valor',
    tipo: 'NARRATIVO',
    valorGoirnos: 20,
    description: 'Garra curva y negra de Rondador de Brasas — trofeo de amuleto de primer orden.',
    dimensiones: 'Garra de 8 cm.',
    // PENDIENTE DE IMPLEMENTAR (pasada de objetos narrativos sin uso, 2026-09-02, decisión
    // explícita de la usuaria): ingrediente necesario de una receta nueva de dagas tier 3. Ver
    // memoria tarkor_pasada_objetos_narrativos_2026-09-02. No implementado todavía.
  },

  // --- Tier 0, ronda 2 de objetos (roadmap 2026-07-20, ver memoria
  // project_tarkor_roadmap_objetos_2.md) — cierra 7 huecos reales del catálogo: Restos de Maktor
  // y Túmulos del Honor sin objeto propio, rareza cósmica del Origen Azul, comercio goirntes
  // ampliado, y dos formas preparadas más (mismo patrón que cataplasma-salvia-polvo).
  {
    // Renombrado y recalibrado (pasada de objetos narrativos sin uso, 2026-09-02): "Marca de
    // clan" era un colgante puramente decorativo sin ningún stat — pasa a ser un cinturón real con
    // función práctica, manteniendo el símbolo de clan tallado como parte del diseño visual (ver
    // notas del loadout que lo entrega, más abajo en este archivo).
    slug: 'marca-de-clan',
    name: 'Cinturón de cargador',
    aliases: ['marca de clan', 'cinturon de cargador'],
    category: 'cosmetico',
    tipo: 'NARRATIVO',
    valorGoirnos: 4,
    equipSlot: 'COSMETICO_CINTURA',
    statBonuses: { inventorySlots: 4 },
    description: 'Ancho cinturón de cuero reforzado con bolsas y correas, el símbolo de un clan tallado en la hebilla — pensado para cargar de verdad, no solo para lucirlo.',
    dimensiones: 'Cinturón de cuero de 6 cm de ancho.',
  },

  {
    // panuelo-luto-serhu → reemplazado por "Mochila Curtida" (pasada de objetos narrativos sin
    // uso, 2026-09-02): el pañuelo era puro ritual sin función (valorGoirnos: 0, loot pasivo de
    // Los Túmulos del Honor) — la usuaria pidió sustituirlo directamente por un cosmético de
    // espalda crafteable real. Slug sin cambiar. Receta real: MOCHILA_CURTIDA_RECIPE
    // (crafting.ts, oficio curtidor-orcos-llanuras).
    slug: 'panuelo-luto-serhu',
    name: 'Mochila Curtida',
    aliases: ['mochila curtida', 'mochila'],
    category: 'cosmetico',
    tipo: 'NARRATIVO',
    valorGoirnos: 25,
    equipSlot: 'COSMETICO_ESPALDA',
    statBonuses: { inventorySlots: 10 },
    description: 'Mochila de cuero grueso curtido, correas reforzadas y varios compartimentos — carga de verdad, pensada para pasar días fuera del campamento.',
    dimensiones: 'Mochila de 45x30 cm.',
    tier: 4,
  },

  {
    slug: 'pluma-sombra-kroj',
    name: 'Pluma de Sombra de Kroj',
    aliases: ['pluma de sombra'],
    category: 'valor',
    tipo: 'NARRATIVO',
    valorGoirnos: 15,
    description: 'Pluma larga de un negro casi azulado que absorbe la luz — objeto de trueque con el Margen Silencioso.',
    dimensiones: 'Pluma de 25 cm.',
    lugarOrigen: 'Margen Silencioso.',
    // PENDIENTE DE IMPLEMENTAR (pasada de objetos narrativos sin uso, 2026-09-02, decisión
    // explícita de la usuaria): ingrediente para craftear un Arco tier 5. Ver memoria
    // tarkor_pasada_objetos_narrativos_2026-09-02. No implementado todavía.
  },

  {
    slug: 'pluma-timonera',
    name: 'Pluma timonera de Cruzavientos',
    aliases: ['pluma timonera'],
    category: 'valor',
    tipo: 'NARRATIVO',
    valorGoirnos: 10,
    description: 'Pluma larga y rígida de Cruzavientos, punta gris acerado — adorno y trueque, los Serhu las montan en lanzas y trenzas.',
    dimensiones: 'Pluma de 30 cm.',
    // PENDIENTE DE IMPLEMENTAR (pasada de objetos narrativos sin uso, 2026-09-02, decisión
    // explícita de la usuaria): ingrediente para craftear una Armadura tier 5 — difícil de
    // conseguir, Cruzavientos es fauna de nido en altura, dificilísima de cazar salvo en el nido o
    // con trampa cebada (ver flora-fauna.md). Ver memoria
    // tarkor_pasada_objetos_narrativos_2026-09-02. No implementado todavía.
  },

  {
    slug: 'sal-trueque',
    name: 'Sal de trueque',
    category: 'valor',
    tipo: 'NARRATIVO',
    valorGoirnos: 6,
    description: 'Bloques de sal gris comprimida, ásperos al tacto — la moneda de facto de la estepa.',
    dimensiones: 'Bloques de 8x5 cm.',
  },

  {
    // Slug ajustado (petición explícita, 2026-08-15: "renombrases el slug con el nombre del
    // archivo" — imagen ya subida "saquito-arena-iman-banner.png").
    slug: 'saquito-arena-iman',
    name: 'Saquito de arena imán',
    // Sin alias corto a propósito (auditoría de documentación/lore 2026-08-18): 'arena imán' ya lo
    // usa 'punado-arena-iman' (la materia prima en bruto, objeto mecánicamente distinto) —
    // compartirlo colisionaba y siempre ganaba el primero declarado. El nombre completo (3
    // palabras) ya es lo bastante corto sin necesitar uno.
    category: 'valor',
    tipo: 'NARRATIVO',
    valorGoirnos: 12,
    description: 'Limaduras que dejan las tormentas — los herreros goirntes pagan bien por un saquito.',
    dimensiones: 'Saquito de 10x8 cm.',
    // PENDIENTE DE IMPLEMENTAR (auditoría de lore en profundidad 2026-09-02, confirmado de nuevo
    // en la pasada de objetos narrativos sin uso, misma fecha): areas.md/items.md prometen que
    // este saquito es "el único ítem que evita perder la Arena Imán suelta del inventario al
    // entrar en Las Agujas Imán" — ni ese effectKey ni la lógica de pérdida de Arena Imán en la
    // zona existen hoy en el motor. Ya es craftable de verdad (SAND_POUCH_RECIPE, crafting.ts),
    // solo falta el efecto protector en sí. Ver memoria
    // tarkor_pasada_objetos_narrativos_2026-09-02. No implementado todavía.
  },

  { 
    slug: 'silbato-hueso-caza',
    name: 'Silbato de hueso de caza',
    aliases: ['silbato de hueso'],
    category: 'valor',
    tipo: 'NARRATIVO',
    valorGoirnos: 4,
    description: 'Pequeño silbato tallado en hueso pulido — señales de caza Serhu.',
    dimensiones: 'Silbato de 5 cm.', lugarOrigen: 'Clan Serhu, Llanuras del Viento Rojo.',
    // APARCADO — DISEÑO MÁS AMPLIO QUE UN SOLO OBJETO (pasada de objetos narrativos sin uso,
    // 2026-09-02, decisión explícita de la usuaria): pieza de una profesión de Reino nueva,
    // "ganadería" (hermana de la agricultura ya existente) — herramienta requerida para que un
    // Trabajador de Reino se dedique al cuidado de ganado. Por ahora solo orcos y Goirntes (no
    // Nabieus ni Faerus). NO retomar como objeto suelto — es parte del desarrollo real de Reino,
    // aparcado hasta cerrar más el modo RPG. Ver memoria
    // tarkor_pasada_objetos_narrativos_2026-09-02.
  },

  {
    // Añadido 2026-08-23 (auditoría lore↔código): `startingInventory.ts` y
    // `MAKTOR_CLAN_TOTEM_RECIPE` (construction.ts) llevaban desde 2026-08-15 referenciando este
    // slug por string, sin que existiera fila real aquí — el equipo inicial de Gorhorn funcionaba
    // en juego (el matching de receta/inventario es por `catalogSlug`, no por FK), pero el tótem
    // era invisible en la Enciclopedia/`entityDiscovery.ts`. Sin `statBonuses` a propósito: es
    // cosmético puro, decisión ya cerrada (ver comentario en `startingInventory.ts`).
    slug: 'totem-maktor',
    name: 'Tótem Maktor',
    aliases: ['tótem maktor', 'tótem de gorhorn', 'tótem personal'],
    category: 'cosmetico',
    tipo: 'NARRATIVO',
    valorGoirnos: 0,
    equipSlot: 'COSMETICO_ESPALDA',
    description: 'El tótem del Clan Maktor, atado con cuerdas a la espalda — el objeto más importante de Gorhorn, lo único que le queda de sus ancestros.',
    dimensiones: 'Talla de madera de unos 40 cm, tallada a mano.',
    lugarOrigen: 'Gran tótem de la plaza del Clan Maktor — fragmento que Gorhorn arrancó al huir de la incursión que aniquiló al clan.',
  },

  {
    slug: 'totem-clan-roto',
    name: 'Tótem de clan roto',
    aliases: ['tótem de clan roto'],
    category: 'cosmetico',
    tipo: 'NARRATIVO',
    valorGoirnos: 8,
    equipSlot: 'COSMETICO_ESPALDA',
    statBonuses: { carisma: 1 },
    description: 'Fragmento de madera de ciénaga tallada, roto por la mitad, con restos de un símbolo de clan irreconocible — gancho de un posible superviviente Maktor.',
    dimensiones: 'Fragmento de 15 cm.',
    // Se queda tras la ampliación de lore 2026-08-21 (a diferencia del Juguete/Brazalete, sí
    // retirados): es ingrediente real de `MAKTOR_CLAN_TOTEM_RECIPE` (construction.ts), pendiente
    // de confirmar con la usuaria si se mantiene o si prefiere retirar también esa receta.
    lugarOrigen: 'Los Restos de Maktor, Llanuras del Viento Rojo (madera de ciénaga, de origen distante).',
  },

  // cuerno-caza-tallado eliminado (pasada de objetos narrativos sin uso, 2026-09-02) — era un
  // instrumento decorativo redundante con 'cuerno-cuernahoja' (más arriba en este archivo, ahora
  // renombrado "Enganche de hueso de Cuernahoja" — casquillo real de lanza, no cuerno decorativo).
  {
    slug: 'vela-cera-lebude',
    name: 'Vela de cera de Lebude',
    aliases: ['vela de cera'],
    category: 'valor',
    tipo: 'NARRATIVO',
    valorGoirnos: 3,
    description: 'Cera de la colmena de Lebude moldeada en una vela gruesa — arde más limpio y más tiempo que la resina, apreciada por quienes pasan la noche fuera del campamento.',
    dimensiones: 'Vela de 15 cm.',
    lugarOrigen: 'El Pozo de Cauce Viejo, Llanuras del Viento Rojo.',
    // PENDIENTE DE IMPLEMENTAR (pasada de objetos narrativos sin uso, 2026-09-02, decisión
    // explícita de la usuaria): material para recetas de construction.ts (edificios de Reino
    // avanzados, patrón `requirements`/`requiresAyuntamiento: true`, ver MAKTOR_CLAN_TOTEM_RECIPE
    // como ejemplo) — no crafting.ts (equipo personal). Ver memoria
    // tarkor_pasada_objetos_narrativos_2026-09-02. No implementado todavía.
  },

  // Pescador (2026-09-02, profesión nueva universal, Pieza 1) — dos objetos nuevos: la caña
  // (herramienta real, equipable, mismo patrón que `pico-minero`) y el cebo (material consumible,
  // se gasta al pescar, mismo patrón que `cuerdas`). Decisión explícita de la usuaria: ambos son
  // CRAFTEABLES, no de partida — caña con carpintero (WOOD_BEAM_RECIPE como plantilla), cebo con
  // el propio pescador (receta real, no entrega gratuita). Ver CANA_PESCA_RECIPE/CEBO_PESCA_RECIPE
  // en crafting.ts.
  {
    slug: 'cana-pesca',
    name: 'Caña de pescar',
    aliases: ['caña de pescar', 'caña'],
    category: 'herramienta',
    tipo: 'EQUIPABLE',
    valorGoirnos: 6,
    equipSlot: 'ARMA_SECUNDARIA',
    description: 'Vara flexible de madera de Telda con sedal de tendón trenzado y anzuelo de hueso tallado — imprescindible para pescar en la costa.',
    dimensiones: 'Vara de 1,80 m.',
    lugarOrigen: 'Playa de Ceniza Blanca.',
    herramientaParaOficio: ['pescador-pescar'],
  },

  {
    // `tipo: 'CONSUMIBLE'`/`category: 'consumible'` (no MATERIAL — itemTaxonomy.ts solo admite
    // ['metal','bloque','quitina','viga','columna','cordaje'] ahí, todo procesado de construcción;
    // cebo no encaja y sí es, mecánicamente, un consumible que se gasta al usarlo, mismo criterio
    // que `agua-hervida-liquen`) — a diferencia de esos, sin `equipSlot`/`curaEnergia` propios: no
    // se "usa" desde el inventario como una poción, se consume automáticamente al confirmar Pescar
    // (recolectar.ts, mismo mecanismo `totalQuantity`/`planConsumption` que ya usa crafting.ts
    // para ingredientes — no depende de `equipSlot` para nada).
    slug: 'cebo-pesca',
    name: 'Cebo',
    aliases: ['cebo', 'cebo de pesca'],
    category: 'consumible',
    tipo: 'CONSUMIBLE',
    valorGoirnos: 2,
    description: 'Gusanos de arena y trozos de marisco ensartados en el anzuelo — atraen a los peces de la costa. Se gasta al pescar.',
    dimensiones: 'Bote de 10 unidades.',
    lugarOrigen: 'Playa de Ceniza Blanca.',
  },

  // --- Los Acantilados Partidos (2026-09-02, sesión "categorías de raza de fauna") ---

  {
    slug: 'plumas-celubia',
    name: 'Plumas de Celubia',
    aliases: ['plumas de celubia'],
    category: 'pluma',
    tipo: 'RECURSO',
    valorGoirnos: 3,
    description: 'Plumas largas y blancas de Celubia Pálida, con restos secos de la estela de espuma que deja en vuelo.',
    dimensiones: 'Plumas de 15 a 20 cm.',
    lugarOrigen: 'Los Acantilados Partidos.',
    tier: 2,
  },

  {
    slug: 'huevo-celubia',
    name: 'Huevo de Celubia',
    aliases: ['huevo de celubia'],
    category: 'alimento',
    tipo: 'RECURSO',
    valorGoirnos: 5,
    description: 'Huevo moteado de Celubia Pálida, robado de una cornisa casi inaccesible — poco comunes, más por lo peligroso de alcanzar el nido que por su escasez real.',
    dimensiones: 'Huevo de unos 8 cm.',
    lugarOrigen: 'Los Acantilados Partidos.',
    tier: 3,
  },

  {
    slug: 'carne-terkash',
    name: 'Carne de Terkash',
    aliases: ['carne de terkash'],
    category: 'alimento',
    tipo: 'RECURSO',
    valorGoirnos: 3,
    description: 'Carne blanca de crustáceo, extraída con cuidado del caparazón del Terkash — sabor intenso a mar.',
    dimensiones: 'Trozos de 200 a 400 g.',
    lugarOrigen: 'Los Acantilados Partidos.',
    tier: 1,
  },

  {
    slug: 'caparazon-terkash',
    name: 'Caparazón de Terkash',
    aliases: ['caparazón de terkash'],
    category: 'quitina',
    tipo: 'MATERIAL',
    valorGoirnos: 8,
    description: 'Placa de caparazón grisáceo veteado, dura como la roca partida donde vivía el Terkash — material de construcción y de armadura.',
    dimensiones: 'Placa de 40x25 cm.',
    lugarOrigen: 'Los Acantilados Partidos.',
    tier: 3,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TANDA OpenCode 2026-09-27/28 — flora y minerales de El Margen Silencioso (A-20 a A-24),
  // Ciénaga Troncal (A-25 a A-27, P-03) y Cristal Helado (P-03).
  // ══════════════════════════════════════════════════════════════════════════

  // A-20 — Musgo Callado: absorbe el sonido, El Margen Silencioso.
  {
    slug: 'musgo-callado',
    name: 'Musgo Callado',
    aliases: ['musgo callado'],
    category: 'fibras',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Musgo gris apagado, sin brillo, que cubre troncos, ramas y suelo en todo El Margen Silencioso — una maraña de filamentos finísimos con bolsas de aire entre ellos. El sonido entra, rebota dentro de los filamentos y se disipa sin salir, como en un fieltro grueso a escala de bosque. Relleno aislante para jergones y forros.',
    dimensiones: 'Cojines de 5-15 cm de grosor.',
    lugarOrigen: 'El Margen Silencioso.',
    tier: 1,
  },

  // A-21 — Veldria Hueca: madera y resina que conducen la vibración del suelo.
  {
    slug: 'madera-veldria-hueca',
    name: 'Madera de Veldria Hueca',
    aliases: ['madera de veldria'],
    category: 'madera',
    tipo: 'RECURSO',
    valorGoirnos: 4,
    description: 'Madera negra y ligera de la Veldria Hueca, conífera de El Margen Silencioso cuyo tronco tiene un corazón hueco y seco. La pared del tronco conduce la vibración del suelo aunque el aire de dentro no transmita nada — los Nabieus fabrican con ella tubos de escucha enterrados.',
    dimensiones: 'Vigas de 2-3 m.',
    lugarOrigen: 'El Margen Silencioso.',
    tier: 3,
  },
  {
    slug: 'resina-veldria',
    name: 'Resina de Veldria',
    aliases: ['resina de veldria hueca'],
    category: 'resina',
    tipo: 'RECURSO',
    valorGoirnos: 5,
    description: 'Resina oscura de la Veldria Hueca, con olor a lluvia — pegamento que no cruje al secar.',
    dimensiones: 'Bloques de 8x5 cm.',
    lugarOrigen: 'El Margen Silencioso.',
    tier: 3,
  },

  // A-22 — Flor de Víspera: sedante que abre al atardecer.
  {
    slug: 'petalos-vispera',
    name: 'Pétalos de Víspera',
    aliases: ['petalos de vispera', 'pétalos de víspera'],
    category: 'medicinal',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Pétalos gris perla de la Flor de Víspera, planta baja de El Margen Silencioso cuyas flores solo se abren al atardecer y se cierran ante un movimiento brusco. Su aroma es un sedante suave: calma y ayuda a dormir, sin tocar el dolor — a diferencia de la Flor de Ceniza. Ingrediente base de alquimia para infusiones de descanso.',
    dimensiones: 'Pétalos de 2-3 cm.',
    lugarOrigen: 'El Margen Silencioso.',
    tier: 1,
  },

  // A-23 — Cántaro de Hoja: guarda agua de lluvia limpia.
  {
    slug: 'agua-cantaro',
    name: 'Agua de Cántaro',
    aliases: ['agua de cantaro de hoja'],
    category: 'consumible',
    tipo: 'CONSUMIBLE',
    equipSlot: 'CONSUMIBLE_1',
    valorGoirnos: 1,
    description: 'Agua de lluvia limpia guardada en el tallo hueco del arbusto Cántaro de Hoja, de El Margen Silencioso — un respiro real en una región de charcas estancadas.',
    dimensiones: 'Tallo de 4-8 cm de diámetro.',
    lugarOrigen: 'El Margen Silencioso.',
    tier: 1,
    curaAgua: 30,
  },
  {
    slug: 'tallo-cantaro',
    name: 'Tallo de Cántaro',
    aliases: ['tallo de cantaro de hoja'],
    category: 'madera',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Tallo hueco y seco del Cántaro de Hoja, una vez drenada el agua — leña sencilla o tubo simple.',
    dimensiones: 'Tallos de 60-90 cm.',
    lugarOrigen: 'El Margen Silencioso.',
    tier: 1,
  },

  // A-24 — Carnosa de Tocón: seta de los tocones caídos, alimento del Brozán.
  {
    slug: 'carnosa-de-tocon',
    name: 'Carnosa de Tocón',
    aliases: ['carnosa de tocon'],
    category: 'alimento',
    tipo: 'RECURSO',
    valorGoirnos: 2,
    description: 'Seta carnosa en forma de embudo que crece sobre los tocones caídos de las coníferas de madera negra de El Margen Silencioso, gris azulada por fuera y beige por dentro. Cruda amarga; asada o en guiso, de sabor suave a tierra. Es la comida del Brozán.',
    dimensiones: 'Sombreros de 15-30 cm.',
    lugarOrigen: 'El Margen Silencioso.',
    tier: 2,
  },

  // A-25 — Bulbo de Turbera: alimento base de Keseg Prisilke y los Goshg, Ciénaga Troncal.
  {
    slug: 'bulbo-de-turbera',
    name: 'Bulbo de Turbera',
    aliases: ['bulbo de turbera'],
    category: 'alimento',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Tubérculo elíptico de piel parda y pulpa blanca y firme, que crece en el fango de turba de las zonas llanas de Ciénaga Troncal. Alimento base de Keseg Prisilke y de los Goshg cuando falla la caza de Cornantes — cocido, frito o seco al humo.',
    dimensiones: 'Tubérculos de 15-30 cm.',
    lugarOrigen: 'Ciénaga Troncal.',
    tier: 1,
  },

  // A-26 — Velo de Charca: comida y cura de quemaduras, Ciénaga Troncal.
  {
    slug: 'velo-de-charca',
    name: 'Velo de Charca',
    aliases: ['velo de charca'],
    category: 'medicinal',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Láminas gelatinosas y translúcidas que cubren la superficie de las charcas quietas de Ciénaga Troncal, entre los pilotes y bajo los Trepadores Ocaso. Comestible en sopa; aplicada fresca sobre una quemadura, enfría y protege — la cura de campo más habitual de los Goshg, que se queman a menudo con la resina de sus antorchas.',
    dimensiones: 'Láminas de 5-15 cm.',
    lugarOrigen: 'Ciénaga Troncal.',
    tier: 1,
    curaUnPaso: true,
  },

  // A-27 — Herrumbrera: hierro de pantano, Ciénaga Troncal (segunda Vetria de Berig).
  {
    slug: 'corteza-herrumbre',
    name: 'Corteza Herrumbre',
    aliases: ['corteza de herrumbrera'],
    category: 'mena',
    tipo: 'RECURSO',
    valorGoirnos: 2,
    description: 'Corteza de color óxido, pesada y áspera, de la Herrumbrera — arbusto de Ciénaga Troncal que crece en las orillas de agua estancada, donde el fango arrastra hierro disuelto. Sus raíces lo concentran en la corteza, el mismo principio que la Hierba del Hierro pero con un mineral mucho más pobre. No brilla. Da para puntas de lanza y clavos, no para una herrería de verdad — 10 unidades equivalen a 1 de mena de hierro pobre al fundir.',
    dimensiones: 'Trozos de 10-15 cm.',
    lugarOrigen: 'Ciénaga Troncal.',
    tier: 2,
  },

  // P-03 — flora nueva de la pasada de conexión: Liquen Escarcha (Cristal Helado) y Bolco (Ciénaga).
  {
    slug: 'liquen-escarcha',
    name: 'Liquen Escarcha',
    aliases: ['liquen escarcha'],
    category: 'alimento',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Costra verde grisácea que crece unos milímetros al año sobre la roca orientada al sol de Cristal Helado — lo único que comen las Hielagas en invierno, y los Helsig lo hierven en caldo en los años de hambre. Arrancarlo entero está mal visto: se raspa la mitad y se deja la otra para que vuelva.',
    dimensiones: 'Costras de 5-10 cm.',
    lugarOrigen: 'Cristal Helado.',
    tier: 1,
  },
  {
    slug: 'resina-bolco',
    name: 'Resina de Bolco',
    aliases: ['resina de bolco'],
    category: 'resina',
    tipo: 'RECURSO',
    valorGoirnos: 2,
    description: 'Resina negra y pesada del Bolco, árbol bajo y ancho de las Marismas de Lodo Negro en Ciénaga Troncal, pariente del Trepador Ocaso pero sin vetas doradas. Gotea al agua y flota, formando la capa viscosa de las Marismas que conserva el agua limpia de debajo. Impermeabilizante pesado con el que los Goshg calafatean el fondo de las canoas.',
    dimensiones: 'Bloques de 10x6 cm.',
    lugarOrigen: 'Ciénaga Troncal.',
    tier: 2,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TANDA OpenCode 2026-09-27/28 — items de A-32 a A-36
  // ══════════════════════════════════════════════════════════════════════════

  // A-32 — Colmillo de Ferike (material nuevo del despiece) y Ashi'krul (arma Faerus de Kegi).
  {
    slug: 'colmillo-ferike',
    name: 'Colmillo de Ferike',
    aliases: ['colmillo de ferike'],
    category: 'hueso',
    tipo: 'RECURSO',
    valorGoirnos: 8,
    description: 'Colmillo de Ferike, de 20-35 cm, marfil con vetas pardas — duro pero quebradizo contra la piedra. El Ferike tiene los dientes tan largos que no le permiten cerrar la boca del todo.',
    dimensiones: 'Colmillos de 20-35 cm.',
    lugarOrigen: 'El Cruce de las Cenizas.',
    tier: 6,
  },
  {
    slug: 'colmillo-ferike-hembra',
    name: 'Colmillo de Ferike hembra',
    aliases: ['colmillo de ferike hembra'],
    category: 'hueso',
    tipo: 'RECURSO',
    valorGoirnos: 12,
    description: 'Colmillo de una hembra de Ferike — más fuerte y grande que el de un macho, la variante de mayor calidad, mismo criterio que el Enganche de hueso de Cuernahoja. Es el material con el que se talla la daga Ashi\'krul.',
    dimensiones: 'Colmillos de 25-40 cm.',
    lugarOrigen: 'El Cruce de las Cenizas.',
    tier: 6,
  },
  {
    slug: 'ashi-krul',
    name: 'Ashi\'krul',
    aliases: ["ashi'krul", 'ashikrul', 'el colmillo que huele'],
    category: 'arma',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMA_SECUNDARIA',
    tipoArma: 'DAGA',
    valorGoirnos: 30,
    description: 'Daga Faerus tallada en un colmillo de Ferike hembra, con la empuñadura envuelta en piel de Ferike. El Ferike solo teme a los Faerus, y la hembra es la cazadora y alfa de su manada — llevar su colmillo dice que su portador cazó a quien caza. Se talla en Kegi, dentro del Feg Ger; no se fabrica con ningún oficio del jugador, se compra o se gana.',
    statBonuses: { destreza: 4 },
    dimensiones: 'Hoja de 25 cm tallada en el propio colmillo.',
    lugarOrigen: 'Kegi, Feg Ger.',
    tier: 6,
    requisitos: { destreza: 13 },
  },

  // A-33 — Desollador de sílice: hoja Helsig, montado en el Desolladero del Clan Serhu.
  {
    slug: 'desollador-silice',
    name: 'Desollador de sílice',
    aliases: ['desollador de silice'],
    category: 'herramienta',
    tipo: 'EQUIPABLE',
    equipSlot: 'ARMA_SECUNDARIA',
    tipoArma: 'CUCHILLO',
    valorGoirnos: 20,
    description: 'Cuchillo de desuello hecho entre dos clanes: la hoja, de hielo sílice con forma de hoz corta, la tallan los Helsig; las cachas, de Caparazón de Espina del Viento, las pone el Desolladero del Clan Serhu, porque la quitina no resbala con sangre en las manos. Es el único objeto de Karot Veku que reconoce abiertamente que los Serhu necesitan a otro clan para algo. Versión de oficio del cuchillo de hielo sílice de Gorhorn, más fina, útil también al peletero.',
    statBonuses: { destreza: 2 },
    dimensiones: 'Hoja curva de 14 cm, empuñadura de 11 cm.',
    lugarOrigen: 'Hoja del Clan Helsig; montado en el Desolladero del Clan Serhu.',
    tier: 3,
    requisitos: { destreza: 9 },
    herramientaParaOficio: ['desollador', 'curtidor', 'peletero'],
  },

  // A-34 — Ungüento de Espina: primer crafteo del veneno de Espina del Viento (antes solo loot).
  {
    slug: 'unguento-espina',
    name: 'Ungüento de Espina',
    aliases: ['unguento de espina', 'ungüento de espina del viento'],
    category: 'medicinal',
    tipo: 'CONSUMIBLE',
    equipSlot: 'CONSUMIBLE_1',
    valorGoirnos: 12,
    description: 'Pasta ámbar de olor amargo y picante, hecha diluyendo el veneno de Espina del Viento en resina hasta que deja de ser un peligro y se vuelve un anestésico de campo. Adormece la piel en segundos — mal dosificada, adormece también el juicio.',
    dimensiones: 'Cuenco de cuerno de 6 cm con tapa de cera.',
    lugarOrigen: 'Karot Veku, taller de alquimia.',
    tier: 3,
    curaHasta: 'GRAVE',
    curaUnPaso: true,
  },

  // A-35 — Manto de Cornisa: da uso a las Plumas de Celubia, sin bonificadores.
  {
    slug: 'manto-cornisa',
    name: 'Manto de Cornisa',
    aliases: ['manto de cornisa'],
    category: 'cosmetico',
    tipo: 'NARRATIVO',
    equipSlot: 'COSMETICO_ESPALDA',
    valorGoirnos: 6,
    description: 'Manto corto de fieltro de lana de Múrgol, gris con restos de polvo rojo, con plumas blancas de Celubia cosidas en hilera sobre los hombros — en la punta, las plumas conservan un rastro de espuma seca que nunca termina de caerse. Lo lleva quien trepó a las cornisas más altas de Los Acantilados Partidos y volvió: la prueba de valor de la costa, cosa de jóvenes que quieren presumir, no un rito sagrado.',
    dimensiones: 'Manto de 45x60 cm.',
    lugarOrigen: 'Las Llanuras del Viento Rojo.',
    tier: 2,
  },

  // A-36 — Incisivos de Miruina: primera herramienta del catálogo que sale directamente de un
  // animal sin fabricarse.
  {
    slug: 'incisivos-miruina',
    name: 'Incisivos de Miruina',
    aliases: ['incisivos de miruina'],
    category: 'hueso',
    tipo: 'RECURSO',
    valorGoirnos: 3,
    description: 'Peine natural de dientes de Miruina, orientados en varias direcciones para rasgar escamas de Jusha en vida del animal — fuera de él, un rascador que arranca escamas y restos de carne de una piel sin cortarla.',
    dimensiones: 'Piezas de 4-6 cm.',
    lugarOrigen: 'Los Manaderos.',
    tier: 2,
    herramientaParaOficio: ['curtidor', 'peletero'],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TANDA OpenCode 2026-09-27/28 — recursos de despiece de la fauna nueva (A-28 a A-31, P-01, P-02)
  // ══════════════════════════════════════════════════════════════════════════

  // A-28 — Leshra
  {
    slug: 'plumas-leshra',
    name: 'Plumas de Leshra',
    aliases: ['plumas de leshra'],
    category: 'pluma',
    tipo: 'RECURSO',
    valorGoirnos: 3,
    description: 'Plumas de borde deshilachado de la Leshra, que rompen el aire en remolinos diminutos sin hacer ruido — material de emplumado con el que los Faerus hacen flechas que no silban.',
    dimensiones: 'Plumas de 15-25 cm.',
    lugarOrigen: 'El Margen Silencioso.',
    tier: 2,
  },

  // A-29 — Morvasa
  {
    slug: 'veneno-morvasa',
    name: 'Veneno de Morvasa',
    aliases: ['veneno de morvasa'],
    category: 'medicinal',
    tipo: 'RECURSO',
    valorGoirnos: 6,
    description: 'Veneno neurotóxico extraído con cuidado de la Morvasa — paraliza en vez de matar. Ingrediente de alquimia.',
    dimensiones: 'Frasco de 5 cl.',
    lugarOrigen: 'El Margen Silencioso.',
    tier: 3,
  },
  {
    slug: 'piel-morvasa',
    name: 'Piel de Morvasa',
    aliases: ['piel de morvasa'],
    category: 'piel',
    tipo: 'RECURSO',
    valorGoirnos: 3,
    description: 'Piel de escamas verde pardo con vetas ceniza de la Morvasa.',
    dimensiones: 'Piezas de 40x20 cm.',
    lugarOrigen: 'El Margen Silencioso.',
    tier: 2,
  },

  // A-30 — Brozán
  {
    slug: 'piel-brozan',
    name: 'Piel de Brozán',
    aliases: ['piel de brozan'],
    category: 'piel',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Piel gris verdosa del Brozán, con vetas negras que imitan la corteza podrida.',
    dimensiones: 'Piezas de 20x15 cm.',
    lugarOrigen: 'El Margen Silencioso.',
    tier: 1,
  },

  // A-31 — Hoscón
  {
    slug: 'plumon-hoscon',
    name: 'Plumón de Hoscón',
    aliases: ['plumon de hoscon'],
    category: 'pluma',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Plumón gris pardo apagado del Hoscón — relleno sencillo.',
    dimensiones: 'Mechones de 5-10 cm.',
    lugarOrigen: 'El Margen Silencioso.',
    tier: 1,
  },

  // P-01 — Hielaga, Nievón, Escarchín, Tragalodo, Borbol, Zancapilote, Vreskal
  {
    slug: 'piel-hielaga',
    name: 'Piel de Hielaga',
    aliases: ['piel de hielaga'],
    category: 'piel',
    tipo: 'RECURSO',
    valorGoirnos: 4,
    description: 'Doble pelaje blanco grisáceo de la Hielaga — la piel más abrigada de Berig.',
    dimensiones: 'Piezas de 50x35 cm.',
    lugarOrigen: 'Cristal Helado.',
    tier: 2,
  },
  {
    slug: 'piel-nievon',
    name: 'Piel de Nievón',
    aliases: ['piel de nievon'],
    category: 'piel',
    tipo: 'RECURSO',
    valorGoirnos: 8,
    description: 'Pelaje blanco y hueco del Nievón, que no deja escapar calor — apenas visible contra la nieve.',
    dimensiones: 'Piezas de 80x50 cm.',
    lugarOrigen: 'Cristal Helado.',
    tier: 5,
  },
  {
    slug: 'colmillos-nievon',
    name: 'Colmillos de Nievón',
    aliases: ['colmillos de nievon'],
    category: 'hueso',
    tipo: 'RECURSO',
    valorGoirnos: 8,
    description: 'Colmillos del Nievón, el depredador que espera enterrado en la nieve junto a los pasos de las Hielagas.',
    dimensiones: 'Colmillos de 10-15 cm.',
    lugarOrigen: 'Cristal Helado.',
    tier: 5,
  },
  {
    slug: 'carne-escarchin',
    name: 'Carne de Escarchín',
    aliases: ['carne de escarchin'],
    category: 'alimento',
    tipo: 'RECURSO',
    valorGoirnos: 2,
    description: 'Carne grasa del Escarchín, muy apreciada en los años de hambre de Cristal Helado.',
    dimensiones: 'Piezas de 10-20 cm.',
    lugarOrigen: 'Cristal Helado.',
    tier: 1,
  },
  {
    slug: 'placas-tragalodo',
    name: 'Placas de Tragalodo',
    aliases: ['placas de tragalodo'],
    category: 'piel',
    tipo: 'RECURSO',
    valorGoirnos: 6,
    description: 'Placas pardas cubiertas de barro seco del Tragalodo — armadura pesada de la Ciénaga.',
    dimensiones: 'Placas de 30x20 cm.',
    lugarOrigen: 'Ciénaga Troncal.',
    tier: 5,
  },
  {
    slug: 'dientes-tragalodo',
    name: 'Dientes de Tragalodo',
    aliases: ['dientes de tragalodo'],
    category: 'hueso',
    tipo: 'RECURSO',
    valorGoirnos: 5,
    description: 'Dientes del Tragalodo, el depredador grande de las aguas bajas de la Ciénaga.',
    dimensiones: 'Piezas de 6-10 cm.',
    lugarOrigen: 'Ciénaga Troncal.',
    tier: 4,
  },
  {
    slug: 'carne-borbol',
    name: 'Carne de Borbol',
    aliases: ['carne de borbol'],
    category: 'alimento',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Carne grasa del Borbol, pez de fondo de las charcas de la Ciénaga — se ahúma bien.',
    dimensiones: 'Piezas de 10-15 cm.',
    lugarOrigen: 'Ciénaga Troncal.',
    tier: 1,
  },
  {
    slug: 'plumas-zancapilote',
    name: 'Plumas de Zancapilote',
    aliases: ['plumas de zancapilote'],
    category: 'pluma',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Plumas grises del Zancapilote, el ave que anida en los pilotes de la Ciénaga.',
    dimensiones: 'Plumas de 10-15 cm.',
    lugarOrigen: 'Ciénaga Troncal.',
    tier: 1,
  },
  {
    slug: 'placas-vreskal',
    name: 'Placas de Vreskal',
    aliases: ['placas de vreskal'],
    category: 'piedra',
    tipo: 'RECURSO',
    valorGoirnos: 1,
    description: 'Placas hexagonales idénticas del caparazón del Vreskal — se usan como teselas decorativas.',
    dimensiones: 'Placas de 1-2 cm.',
    lugarOrigen: 'La Meseta del Orden.',
    tier: 1,
  },

  // P-02 — Sombra de Kroj, Hetris, Mekiosi, Vistue (Hetris/Mekiosi/Vistue no tenían despiece)
  {
    slug: 'piel-hetris',
    name: 'Piel de Hetris',
    aliases: ['piel de hetris'],
    category: 'piel',
    tipo: 'RECURSO',
    valorGoirnos: 4,
    description: 'Pelaje corto gris verdoso del Hetris, que se funde con la corteza húmeda del Margen.',
    dimensiones: 'Piezas de 40x25 cm.',
    lugarOrigen: 'El Margen Silencioso.',
    tier: 3,
  },
  {
    slug: 'garras-hetris',
    name: 'Garras de Hetris',
    aliases: ['garras de hetris'],
    category: 'garra',
    tipo: 'RECURSO',
    valorGoirnos: 5,
    description: 'Garras curvas del Hetris, felino-simio arbóreo del dosel alto del Margen.',
    dimensiones: 'Garras de 3-5 cm.',
    lugarOrigen: 'El Margen Silencioso.',
    tier: 4,
  },
  {
    slug: 'piel-mekiosi',
    name: 'Piel de Mekiosi',
    aliases: ['piel de mekiosi'],
    category: 'piel',
    tipo: 'RECURSO',
    valorGoirnos: 5,
    description: 'Piel gruesa del Mekiosi, de tonos pardos y verdes que imitan el musgo y la corteza podrida.',
    dimensiones: 'Piezas de 60x40 cm.',
    lugarOrigen: 'El Margen Silencioso.',
    tier: 4,
  },
  {
    slug: 'colmillos-mekiosi',
    name: 'Colmillos de Mekiosi',
    aliases: ['colmillos de mekiosi'],
    category: 'hueso',
    tipo: 'RECURSO',
    valorGoirnos: 6,
    description: 'Colmillos del Mekiosi, capaces de partir hueso de un mordisco.',
    dimensiones: 'Colmillos de 8-12 cm.',
    lugarOrigen: 'El Margen Silencioso.',
    tier: 5,
  },
  {
    slug: 'piel-vistue',
    name: 'Piel de Vistue',
    aliases: ['piel de vistue'],
    category: 'piel',
    tipo: 'RECURSO',
    valorGoirnos: 3,
    description: 'Pelaje corto oscuro del Vistue, con una franja más clara a lo largo del lomo.',
    dimensiones: 'Piezas de 40x25 cm.',
    lugarOrigen: 'El Margen Silencioso.',
    tier: 3,
  },
];

// ══════════════════════════════════════════════════════════════════════════
// FACCIONES (Enciclopedia § "Facciones", 2026-08-06)
// ══════════════════════════════════════════════════════════════════════════

export interface FactionInput {
  slug: string;
  name: string;
  /// Uno de BERIG_RAZAS (berigLore.ts: 'goirntes'|'orcos'|'nabieus'|'faerus') — texto libre, sin
  /// FK, mismo criterio que Npc.raza.
  raza: string;
  description: string;
}

// Las 4 facciones ya presentes como `Npc.faction` (texto libre) en el catálogo de arriba, ahora
// formalizadas con ficha propia. El `name` de cada una debe coincidir EXACTAMENTE con el string
// usado en `faction:` de los NPCs de esa facción (seed-catalog.ts falla pronto si no coinciden) —
// contenido sourced de docs/rpgtarkor/lore-mundo/areas.md § "Los clanes orcos" y las menciones de la
// Concordia en historia.md/razas.md/npcs.md, sin inventar nada nuevo.
export const factions: FactionInput[] = [
  {
    slug: 'clan-serhu',
    name: 'Clan Serhu',
    raza: 'orcos',
    description:
      'Clan orco de las Llanuras del Viento Rojo, asentado en el Campamento del Clan Serhu junto al Pozo de Cauce Viejo — empalizada de estacas afiladas rodeando chozas de techo cónico, con vigías apostados en las torres de la entrada. Fundado generaciones atrás por el usurpador Ketg tras traicionar a su propia Terk\'ikar, Nietka, con ayuda Goirnte — desde entonces gobierna una casta cerrada de descendientes suyos, hoy la Terk\'ikar Ulkha y el Kort\'ikar Torgash, que sostiene su poder puertas adentro por miedo, no por el honor y la asamblea abierta del resto de clanes orcos. Bajo control indirecto de la Concordia de Hierro, que les provee armas a cambio de someter a otras tribus orcas y lanzar incursiones en su nombre. Su tótem es una cabeza de Gargantúa de Ceniza tallada, herencia compartida con el Clan Maktor de antes del golpe de Ketg.',
  },
  {
    slug: 'clan-helsig',
    name: 'Clan Helsig',
    raza: 'orcos',
    description:
      'Tribu orca de las zonas gélidas de Cristal Helado. Gobernada por la Terk\'ikar Brenka y su pareja, la Kort\'ikar Solgra, que lidera la guerra. Su vida diaria la dicta la montaña: turnos en las minas, talla paciente del hielo sílice y una caza tan escasa que racionar es ley no escrita. Comercian cuchillos y herramientas con el resto de clanes a cambio de comida y pieles, y aceptan brazos de fuera en sus minas — así llegó a conocer Gorhorn a Hagar, de este clan. Mantienen un perfil neutral y defensivo ante los Goirntes, evitando la confrontación abierta.',
  },
  {
    slug: 'clan-goshg',
    name: 'Clan Goshg',
    raza: 'orcos',
    description:
      'Dos tribus pequeñas de orcos en las zonas húmedas de Ciénaga Troncal, hermanadas por nombre y parentesco — se reúnen en El Cerco de los Pilotes (empalizadas de madera oscura sobre pilotes, unidas por pasarelas y canoas) en la estación de las crecidas, y casan a sus jóvenes entre sí. Gobernadas por la Terk\'ikar Doshka; su hermano menor, el Kort\'ikar Dulgren, lidera la guerra. Viven de cazar Cornantes y de los Trepadores Ocaso — canoas, empalizadas, antorchas de resina, madera de ciénaga para tótems. Zona rica en alimento pero pobre en minerales. Mantienen, como los Helsig, un perfil neutral y defensivo ante los Goirntes.',
  },
  {
    slug: 'concordia-de-hierro',
    name: 'Concordia de Hierro',
    raza: 'goirntes',
    description:
      'Alianza militar Goirnte formada tras El Detonante, con sede en el Baluarte de Goirme — la mayor de las ciudades-fortaleza Goirntes, muros de hierro negro pulido tallados con una simetría antinatural y el obelisco de leyes más alto de todo Berig en su plaza central. La lidera oficialmente la facción radical del orden Goirnte, encabezada por el Primer Censor Tarsen Vold, convencida de que la magia salvaje es una amenaza existencial que exige mano dura — bajo su mando unificado somete a clanes orcos y a los Nabieus, de grado o por presión, y resucita con otro nombre las viejas imposiciones del Yugo de Hierro: tributo en mineral, madera y contingentes de guerra obligatorios. Su mando militar recae en el General Vrask Ombra.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TANDA OpenCode 2026-09-27/28 — 5 facciones nuevas (A-01 a A-05)
  // ══════════════════════════════════════════════════════════════════════════

  // A-01 — Los del Obelisco: facción moderada Goirnte, comparte La Meseta del Orden con la
  // Concordia de Hierro (ver reputation.ts § REGION_OWNING_FACTIONS).
  {
    slug: 'los-del-obelisco',
    name: 'Los del Obelisco',
    raza: 'goirntes',
    description:
      'Corriente moderada del orden Goirnte, nacida de la casta de ley. Magistrados y archiveros de los obeliscos que se niegan a que la Concordia sea todo el orden: no se rebelan, porque desobedecer es desorden, pero exigen que cada orden se sostenga en un edicto grabado. Los lidera la Archimagistrada Yovenne Tal desde El Baluarte de Goirme. Buscan pruebas presentadas en orden de la traición del sello y citan de memoria el Primer Edicto del Tributo contra el uso que la Concordia hace hoy de los contingentes orcos.',
  },

  // A-02 — Keseg Sael: los Nabieus de la mitad oriental de El Margen Silencioso. Primera facción
  // dueña mecánica del Margen (compartida con Feg Tusha, ver reputation.ts).
  {
    slug: 'keseg-sael',
    name: 'Keseg Sael',
    raza: 'nabieus',
    description:
      'Los Nabieus de la mitad oriental de El Margen Silencioso, dispersos en torno a El Refugio sin Nombre. Hacia fuera el clan no da su nombre, "el fin del callar", porque el Refugio es el único lugar donde un Nabieus puede dejar de guardar lo que sabe. Sirven a la Concordia como mensajeros por pura supervivencia, bajo el código del Karo\'sael, y guardan bajo el Refugio un archivo de tablillas de observación, herencia del reino que Madre enterró.',
  },

  // A-03 — Keseg Prisilke: los Nabieus del sur de Ciénaga Troncal, en Jeyselt.
  {
    slug: 'keseg-prisilke',
    name: 'Keseg Prisilke',
    raza: 'nabieus',
    description:
      'El clan nabieus del sur de Ciénaga Troncal, con poblado en Jeyselt ("Fin Susurrado"). Generaciones en aguas altas les dieron brazos y piernas más largos, piel con manchas verdes y una postura encorvada. Viven de la caza y de la madera de los Trepadores Ocaso más que del sigilo, y comparten la Ciénaga con el Clan Goshg en una convivencia práctica. La Concordia les exige madera, no cartas.',
  },

  // A-04 — Feg Tusha: la manada base Faerus, en Hashma. Su liderNpcId es Hulki (A-38, quien más
  // a menudo está en el Jakut Tusha, ver A-06).
  {
    slug: 'feg-tusha',
    name: 'Feg Tusha',
    raza: 'faerus',
    description:
      'La manada base de los Faerus, en Hashma (Selviterna), el poblado colgado sobre los árboles en la selva occidental de El Margen Silencioso, cerca de la costa. La más numerosa y la más salvaje: pelaje denso en tonos de corteza y musgo, artesanía mínima y un olfato que manda sobre la vista. Su asentamiento marca el año 0 de Berig. No tienen cargo de mando: decide quien está sentado en el Jakut Tusha, el Trono Madre. Hostiles a la Concordia y a los Serhu, que los tratan como presa.',
  },

  // A-05 — Feg Ger: la manada Faerus de la llanura, en Kegi. Su liderNpcId es Yeru (A-39). No es
  // dueña de ninguna región (vive en territorio Serhu sin disputarlo).
  {
    slug: 'feg-ger',
    name: 'Feg Ger',
    raza: 'faerus',
    description:
      'La manada Faerus de la llanura, en Kegi, en la franja sur de las Llanuras del Viento Rojo. Pelaje corto y rojizo, la artesanía de cuero más fina de su raza y la única manada que comercia de verdad, en El Vergel de Kegi. Nació de un pacto antiguo con el Clan Maktor: comercian con cualquier orco, pero solo comparten la primera pieza con quien consideran de la manada. Deciden desde el Jakut Ger, el Trono Rojo, sin cargo de mando.',
  },
];

/// Relaciones iniciales entre facciones (H-7, decisión de Álvaro 2026-09-29: "sacarlas de las
/// propuestas aprobadas"). Fuente: tablas "Relaciones iniciales" de A-01..A-05
/// (docs/borradores-opencode/propuestas-aprobadas.md) y el conflicto Serhu+Concordia contra
/// Helsig+Goshg de `worldAgenda.ts`. `presion` en la escala de `factionRelations.ts` (0-19 ALIANZA,
/// 20-39 TRATADO_COMERCIAL, 40-59 NEUTRAL, 60-79 TENSION, 80-100 GUERRA). Las parejas que el lore
/// deja en "neutral" o "sin contacto" no llevan fila (sin fila = NEUTRAL). Una fila por pareja; el
/// motor lee las dos direcciones.
export interface FactionRelationInput {
  source: string;
  target: string;
  presion: number;
  /// Postura del lore y de dónde sale, para revisar rápido.
  motivo: string;
}

export const factionRelationsIniciales: FactionRelationInput[] = [
  { source: 'Concordia de Hierro', target: 'Los del Obelisco', presion: 65, motivo: 'A-01: tensión alta, sin ruptura' },
  { source: 'Los del Obelisco', target: 'Keseg Sael', presion: 55, motivo: 'A-01/A-02: desconfianza útil / cautela' },
  { source: 'Los del Obelisco', target: 'Clan Serhu', presion: 58, motivo: 'A-01: frialdad, los ven como brazo de los radicales' },
  { source: 'Concordia de Hierro', target: 'Keseg Sael', presion: 62, motivo: 'A-02: sumisión sin lealtad (el Yugo, la Purga)' },
  { source: 'Keseg Sael', target: 'Feg Tusha', presion: 45, motivo: 'A-02/A-04: convivencia distante, comparten el Margen' },
  { source: 'Keseg Sael', target: 'Keseg Prisilke', presion: 30, motivo: 'A-02/A-03: parentesco' },
  { source: 'Keseg Prisilke', target: 'Clan Goshg', presion: 35, motivo: 'A-03: convivencia práctica, intercambian madera' },
  { source: 'Concordia de Hierro', target: 'Keseg Prisilke', presion: 62, motivo: 'A-03: tributo resignado' },
  { source: 'Concordia de Hierro', target: 'Feg Tusha', presion: 85, motivo: 'A-04: hostil, las patrullas los tratan como presa' },
  { source: 'Clan Serhu', target: 'Feg Tusha', presion: 85, motivo: 'A-04: hostil, incursiones de la casta de Ketg' },
  { source: 'Feg Tusha', target: 'Feg Ger', presion: 25, motivo: 'A-04/A-05: misma raza, sin rivalidad' },
  { source: 'Clan Serhu', target: 'Feg Ger', presion: 38, motivo: 'A-05: comercio frío, vecinos inevitables' },
  { source: 'Concordia de Hierro', target: 'Feg Ger', presion: 80, motivo: 'A-05: hostil, como con Feg Tusha pero con menos patrullas' },
  { source: 'Clan Serhu', target: 'Concordia de Hierro', presion: 25, motivo: 'worldAgenda: Serhu aliado en la sombra de la Concordia' },
  { source: 'Clan Serhu', target: 'Clan Helsig', presion: 70, motivo: 'worldAgenda: incursiones Serhu contra Helsig' },
  { source: 'Clan Serhu', target: 'Clan Goshg', presion: 70, motivo: 'worldAgenda: incursiones Serhu contra Goshg' },
  { source: 'Concordia de Hierro', target: 'Clan Helsig', presion: 65, motivo: 'worldAgenda: la Concordia empuja a Serhu contra Helsig' },
  { source: 'Concordia de Hierro', target: 'Clan Goshg', presion: 65, motivo: 'worldAgenda: la Concordia empuja a Serhu contra Goshg' },
];

// ══════════════════════════════════════════════════════════════════════════
// HISTORIA (Enciclopedia § "Historia", 2026-08-06)
// ══════════════════════════════════════════════════════════════════════════

export interface HistoriaEntryInput {
  slug: string;
  title: string;
  /// 'comun' = después del año 0 (docs/rpgtarkor/lore-mundo/cronologia.md), se agrupa por bloques de 500
  /// años en la Enciclopedia. 'semillas' = mítico, anterior al año 0
  /// (docs/rpgtarkor/lore-mundo/cronologia-mitica.md), lista plana sin bloques — `year` siempre null aquí.
  era: 'comun' | 'semillas';
  year: number | null;
  text: string;
  /// Solo true para hallazgos de la Era de las Semillas, escritos en el idioma de las Semillas —
  /// el texto real no se sirve al frontend hasta que `translatorNpcSlug` también esté descubierto
  /// (ver /world/:slug/enciclopedia). Ninguna entrada de esta pasada lo necesita todavía: no existe
  /// hoy ningún NPC traductor en el catálogo (Nabierus no está definido como personaje jugable
  /// aún) — el campo y su gating quedan construidos y probados con datos sintéticos, sin contenido
  /// real que dependa de él por ahora.
  requiresTranslation?: boolean;
  /// Debe existir en `items` (validado en seed-catalog.ts) — el objeto físico que, al
  /// descubrirse/poseerse, desbloquea esta entrada.
  documentoItemSlug: string;
  /// Solo si requiresTranslation=true — debe existir en `npcs`/`fauna` (validado en seed-catalog.ts).
  translatorNpcSlug?: string;
}

// Los 5 objetos `category: 'documento'` ya existentes en el catálogo de arriba, cada uno enganchado
// a su propia entrada de lore. Años anclados a docs/rpgtarkor/lore-mundo/cronologia.md (hoy, año ~4.010 —
// "El Detonante" ~4.005-4.008 formó la Concordia de Hierro actual).
export const historiaEntries: HistoriaEntryInput[] = [
  {
    slug: 'correspondencia-concordia',
    title: 'Correo interceptado de la Concordia',
    era: 'comun',
    year: 4009,
    text: 'Un rollo de pergamino sellado con cera y el emblema de la Concordia de Hierro, interceptado antes de llegar a su destinatario. Órdenes de mando cifradas en el lenguaje burocrático de los obeliscos — quien lo lea con cuidado encontrará más de lo que debería saber sobre los movimientos de la Concordia en la frontera de las Llanuras.',
    documentoItemSlug: 'correspondencia-concordia',
  },
  {
    slug: 'mapa-de-patrullas',
    title: 'Rutas de patrulla de la Concordia',
    era: 'comun',
    year: 4009,
    text: 'Un croquis a mano alzada sobre cuero fino, con las rutas de patrulla de la Concordia de Hierro marcadas en tinta ya desvaída por el tiempo — un rastro de por dónde no conviene pasar, y de hasta dónde llega de verdad el control Goirnte sobre el territorio de las Llanuras.',
    documentoItemSlug: 'mapa-de-patrullas',
  },
  {
    slug: 'diario-de-soldado',
    title: 'Diario de un soldado goirnte',
    era: 'comun',
    year: 4009,
    text: 'Un cuaderno de tapas de cuero gastado y letra apretada, encontrado entre los efectos de un soldado raso de la Concordia de Hierro. No hay órdenes ni secretos militares — solo un nombre, una familia esperando en la Meseta del Orden, y la cuenta de los días que faltan para volver a casa. Un recordatorio incómodo de que quienes ejecutan las órdenes de la Concordia rara vez las han elegido.',
    documentoItemSlug: 'diario-de-soldado',
  },
  {
    slug: 'sello-patrulla-concordia',
    title: 'Sello de patrulla de la Concordia',
    era: 'comun',
    year: 4009,
    text: 'Un disco de aleación gris grabado con el emblema de una patrulla de la Concordia de Hierro. Acredita a quien lo lleva ante cualquier puesto Goirnte del territorio — o lo incrimina, si quien lo lleva no tiene ningún derecho a portarlo.',
    documentoItemSlug: 'sello-patrulla-concordia',
  },
  {
    slug: 'tablilla-quemada-maktor',
    title: 'La caída del Clan Maktor',
    era: 'comun',
    year: 4000,
    text: 'Un fragmento de tablilla de arcilla cocida, ennegrecido por el fuego que arrasó el asentamiento del Clan Maktor. Lo poco que se distingue basta para reconstruir lo esencial: más de mil años después de un primer golpe que ya había dejado al clan maltrecho, una revuelta contra el yugo Serhu terminó en una incursión Goirnte orquestada para desprestigiar a los propios Serhu — que no intervinieron. El clan fue aniquilado casi por completo aquel día. Solo se tiene noticia de un superviviente, un niño de diez años que logró escapar.',
    documentoItemSlug: 'tablilla-quemada-maktor',
  },
];

export interface HarvestYieldInput {
  sourceSlug: string;
  /// Categoría amplia de la fuente (2026-08-15, sustituye a `sourceName`, que colisionaba con el
  /// slug técnico usado para enlazar objeto/fauna/flora extraíble): agrupa varias fuentes bajo el
  /// mismo bucket en el front. Clave de `SOURCE_CATEGORY_NAMES` (más abajo) — el nombre legible ya
  /// NO se repite aquí, se resuelve a partir de esta clave (`sourceCategoryNameFor`). El propio tipo
  /// `SourceCategory` ya obliga en compilación a usar una clave dada de alta en el enum.
  sourceCategory: SourceCategory;
  /// Qué verbo exige harvest.ts para esta fuente (2026-07-29) — ver itemTaxonomy.ts. Invariante:
  /// todas las entradas de un mismo sourceSlug deben compartir el mismo método (validado en
  /// seed-catalog.ts).
  metodoObtencion: MetodoObtencion;
  itemSlug: string;
  cantidad: number;
  condicion?: string;
  /// Bypass real de `rollGathering` (2026-08-23, Grupo 3 § HarvestYield.condicion) — para recursos
  /// que el propio `condicion` ya describe como reconocimiento trivial ("los orcos de las Llanuras
  /// lo conocen de niños", "para Gorhorn no requiere tirada"): antes ese texto era pura
  /// documentación sin efecto real, el motor tiraba igual que para cualquier otro recurso. Con esto
  /// en `true`, `applyGatheringRoll` (recolectar.ts) deja pasar el yield intacto, cantidad máxima
  /// siempre, sin comparar contra ninguna dificultad. Omitido = `false`.
  sinTirada?: boolean;
  /// Gate real de herramienta POR YIELD (2026-08-23, Grupo 3 § HarvestYield.condicion, corregido
  /// tras un bug real: usar OFICIOS_CON_HERRAMIENTA_REQUERIDA — crafting.ts — bloqueaba TODO el
  /// oficio de minero, hasta la Piedra común, cuando solo 2 vetas concretas exigen herramienta).
  /// Marca yields cuya `condicion` ya pide una herramienta específica ("requiere pico de minero")
  /// sin que el resto del oficio la necesite — hoy solo minero, contra `pico-minero`. Omitido =
  /// `false`.
  requiereHerramienta?: boolean;
  /// Gate real de estación (2026-08-24, Grupo 3 § Sistema de estaciones, ver
  /// docs/rpgtarkor/lore-mundo/estaciones.md) — para yields cuya `condicion` ya describe una estación en
  /// texto ("crece en otoño") sin que el motor la respetara. Omitido = disponible todo el año,
  /// igual que el resto del catálogo.
  estacionRequerida?: Estacion;
  /// Gate real de clima (2026-08-24, Grupo 3 § Eventos de clima puntuales, ver
  /// docs/rpgtarkor/lore-mundo/clima-tormentas.md) — umbral de severidad MÍNIMA (`climaSeveridadAlMenos`,
  /// worldClock.ts), no igualdad exacta como `estacionRequerida`. Omitido = sin restricción de
  /// clima, igual que el resto del catálogo.
  climaRequerido?: EstadoClima;
}

export const harvestYields: HarvestYieldInput[] = [
  // --- Arena Imán ---

  {
    // itemSlug cambiado de 'saquito-arena-iman' a 'punado-arena-iman' (2026-08-15, petición
    // explícita: "estos 3 no deberían ser extraibles sino crafteables") — el Saquito ya solo se
    // consigue crafteando (peletería orco de las Llanuras), la extracción da la arena en bruto.
    sourceSlug: 'arena-iman',
    sourceCategory: 'mineral',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'punado-arena-iman',
    cantidad: 1,
    condicion: 'solo tras una tormenta de arena magnética reciente',
    // Gate real de clima (2026-08-24, Grupo 3 § Eventos de clima puntuales) — antes esta
    // `condicion` era pura documentación sin efecto en el motor.
    climaRequerido: 'TORMENTA_GRANDE',
  },

  {
    sourceSlug: 'arena-iman',
    sourceCategory: 'mineral',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'esquirla-celeste-caida',
    cantidad: 1,
    condicion: 'extremadamente rara — tratar como añadido narrativo ocasional tras una tormenta fuerte, nunca drop garantizado',
    climaRequerido: 'TORMENTA_EXTREMA',
  },

  // --- Aullador Rojo ---

  // --- Fauna/flora nueva (roadmap 2026-07-20, propuesta de Fable) ---
  { 
    sourceSlug: 'aullador-rojo',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'racion-carne', 
    cantidad: 2, 
    condicion: 'carne dura de depredador — mejor cocinada' 
  },

  { 
    sourceSlug: 'aullador-rojo',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA', 
    itemSlug: 'hueso-ligero', 
    cantidad: 3 
  },

  {
    sourceSlug: 'aullador-rojo',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'colmillo-aullador',
    cantidad: 2,
    condicion: 'cuchillo'
  },

  // --- Imanio y Nuente (2026-09-09, cierre "12 fauna sin HarvestYield") ---
  // Las Agujas Imán, terrestres — CAZA, no PESCA/BUSQUEDA (esas dos son exclusivas de la fauna
  // acuática/de costa de Playa de Ceniza Blanca, ya sembrada aparte). Ruptidar/Benusa Pesquera/
  // Manesti Azul/Terinte se quedan sin receta a propósito (ambientales por diseño, ver sus bios) —
  // solo estos 2 eran el hueco real de contenido pendiente.

  {
    sourceSlug: 'imanio',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'roca-imanio',
    cantidad: 2,
    condicion: 'la armadura se desprende sola al morir, sin necesitar herramienta',
  },

  {
    sourceSlug: 'nuente',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'racion-carne',
    cantidad: 1,
    condicion: 'carne de depredador nocturno — mejor cocinada',
  },

  {
    sourceSlug: 'nuente',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'hueso-ligero',
    cantidad: 2,
  },

  {
    sourceSlug: 'nuente',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'garra-nuente',
    cantidad: 1,
    condicion: 'cuchillo',
  },

  // --- Zense Ceniza (slug zense-ceniza) ---

  { 
    sourceSlug: 'zense-ceniza',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA', 
    itemSlug: 'racion-carne', 
    cantidad: 1, 
    condicion: 'carne de carroñero — mala fama, solo con hambre real' 
  },

  { 
    sourceSlug: 'zense-ceniza',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA', 
    itemSlug: 'hueso-ligero', 
    cantidad: 2 
  },

  // --- Bulbo del Cauce ---

  {
    sourceSlug: 'bulbo-del-cauce',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'bulbo-cauce',
    cantidad: 1,
    condicion: '1 por hora de recolección — fórmula determinista en timedActions.ts, patrón leña',
  },

  // --- Canizor (añadido 2026-08-03, sesión "ampliamos lore") ---

  { 
    sourceSlug: 'canizor',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA', 
    itemSlug: 'piel-canizor', 
    cantidad: 1, 
    condicion: 'cuchillo (deshuello) — la piel de una hembra vale más' 
  },

  { 
    sourceSlug: 'canizor',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA', 
    itemSlug: 'racion-carne', 
    cantidad: 2 
  },

  { 
    sourceSlug: 'canizor',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA', 
    itemSlug: 'hueso-ligero', 
    cantidad: 2 
  },

  // --- Cardo Brújula ---

  {
    // itemSlug cambiado de 'aguja-cardo-brujula' a 'cardo-brujula' (2026-08-15, petición explícita:
    // "estos 3 no deberían ser extraibles sino crafteables") — la Aguja ya solo se consigue
    // crafteando (herrería orco de las Llanuras), la extracción da la planta en bruto.
    sourceSlug: 'cardo-brujula',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'cardo-brujula',
    cantidad: 1,
  },

  // --- Cornante ---

  {
    sourceSlug: 'cornante',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'racion-carne',
    cantidad: 3,
    condicion: 'Solo en Ciénaga Troncal, cacería de grupo — fuera del núcleo jugable actual',
  },

  // --- Corredor de Cauce ---

  { 
    sourceSlug: 'corredor-de-cauce',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA', 
    itemSlug: 'piel-corredor', 
    cantidad: 1, 
    condicion: 'cuchillo (deshuello)' 
  },

  { 
    sourceSlug: 'corredor-de-cauce',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA', 
    itemSlug: 'racion-carne', 
    cantidad: 4 
  },

  { 
    sourceSlug: 'corredor-de-cauce',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA', 
    itemSlug: 'cuerda-tendon', 
    cantidad: 2, 
    condicion: 'cuchillo' 
  },

  { 
    sourceSlug: 'corredor-de-cauce',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA', 
    itemSlug: 'hueso-ligero', 
    cantidad: 6 
  },

  // --- Corretolvas ---

  { sourceSlug: 'corretolvas',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA', 
    itemSlug: 'racion-carne', 
    cantidad: 1 
  },

  { 
    sourceSlug: 'corretolvas',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA', 
    itemSlug: 'plumas-rojizas', 
    cantidad: 1 
  },

  // --- Cruzavientos ---

  { 
    sourceSlug: 'cruzavientos',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA', 
    itemSlug: 'racion-carne', 
    cantidad: 2 
  },

  { 
    sourceSlug: 'cruzavientos',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA', 
    itemSlug: 'pluma-timonera', 
    cantidad: 2 
  },

  // --- Espiga Roja ---

  {
    sourceSlug: 'espiga-roja',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'grano-espiga-roja',
    cantidad: 1,
    condicion: '1 por hora de recolección — fórmula determinista en timedActions.ts, patrón leña',
  },

  // --- Espina del Viento ---

  {
    sourceSlug: 'espina-del-viento',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'veneno-espina',
    cantidad: 1,
    condicion: 'extracción cuidadosa (destreza, Media 15 — falla = veneno perdido, no herida automática)',
  },

  { 
    sourceSlug: 'espina-del-viento',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA', 
    itemSlug: 'caparazon-espina', 
    cantidad: 1 
  },

  // --- Flor de Ceniza ---

  {
    sourceSlug: 'flor-de-ceniza',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'infusion-petalos-flor-ceniza',
    cantidad: 1,
    condicion: 'solo en suelo de ceniza — borde norte del núcleo y zona volcánica',
  },

  // --- Gargantúa de Ceniza ---

  {
    sourceSlug: 'gargantua-de-ceniza',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'placa-osea-gargantua',
    cantidad: 2,
    condicion: 'SOLO cadáver ya muerto o cacería ritual de clan — nunca loot casual',
  },

  {
    sourceSlug: 'gargantua-de-ceniza',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'hueso-largo-gargantua',
    cantidad: 1,
    condicion: 'SOLO cadáver ya muerto o cacería ritual de clan — nunca loot casual',
  },

  {
    sourceSlug: 'gargantua-de-ceniza',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'piel-gargantua',
    cantidad: 1,
    condicion: 'SOLO cadáver ya muerto o cacería ritual de clan — nunca loot casual',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Ampliación de lore 2026-08-21 — repaso "zona por zona" de Las Llanuras del Viento Rojo.
  // ══════════════════════════════════════════════════════════════════════════

  // --- El Osario de la Manada (hallazgo: la zona ya decía en el lore "única fuente conocida de
  // placas óseas y hueso largo de gargantúa sin necesidad de cacería ritual", pero nunca tuvo un
  // sourceSlug propio — hueso-largo-gargantua/placa-osea-gargantua solo salían de CAZA directa a
  // una Gargantúa de Ceniza viva. Inconsistencia preexistente, no de esta pasada; resuelta aquí de
  // paso para los 2 recursos nuevos, sin tocar los 2 ya existentes) ---

  {
    sourceSlug: 'osario-de-la-manada',
    sourceCategory: 'objeto',
    metodoObtencion: 'PASIVO',
    itemSlug: 'fragmento-gargantua',
    cantidad: 2,
  },

  {
    sourceSlug: 'osario-de-la-manada',
    sourceCategory: 'objeto',
    metodoObtencion: 'PASIVO',
    itemSlug: 'hueso-gargantua-construccion',
    cantidad: 1,
  },

  // --- Enredaderas de las Llanuras (La Hondonada del Eco, base de Los Pilares Rotos) ---

  // Bug real jugando en vivo (2026-09-06, hallazgo 8 de la sesión de pruebas: "Recoger vs
  // Recolectar mezclados") — 10 fuentes de categoría 'planta' llevaban `metodoObtencion: 'PASIVO'`
  // (recolector-general, habilidad "Recoger") en vez de 'EXTRACCION' (herborista, "Recolectar"),
  // contradiciendo el propio criterio ya documentado en recolectar.ts § pasivoCandidatesFor: "si
  // son recursos solo se puede recoger con profesiones, si son ítems entonces con este recoger".
  // Corregidas aquí y en las 9 fichas siguientes marcadas con este mismo comentario: enredaderas-
  // llanuras, musgo-arcilla, hojas-telda-fuente, boungo, verdileas-acuaticas, chudos-rojizos,
  // pasto-solar, gradias, pasto-de-sangre, trigo-escarlata.
  {
    sourceSlug: 'enredaderas-llanuras',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'fibra-enredaderas-llanuras',
    cantidad: 2,
  },

  // --- Yerreo (La Hondonada del Eco) ---

  {
    sourceSlug: 'yerreo',
    sourceCategory: 'mineral',
    metodoObtencion: 'MINERIA',
    itemSlug: 'mena-yerreo',
    cantidad: 1,
    condicion: 'veta rarísima, muy pocas unidades donde aparece — requiere pico de minero',
    requiereHerramienta: true,
  },

  // --- Gesgurio ---

  {
    sourceSlug: 'gesgurio',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'trozo-quitina-roja',
    cantidad: 3,
  },

  // --- Kirelon Arenoso ---

  {
    sourceSlug: 'kirelon-arenoso',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'hueso-kirelon',
    cantidad: 2,
  },

  {
    sourceSlug: 'kirelon-arenoso',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'craneo-kirelon',
    cantidad: 1,
  },

  {
    sourceSlug: 'kirelon-arenoso',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'piel-kirelon',
    cantidad: 1,
  },

  {
    sourceSlug: 'kirelon-arenoso',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'garras-kirelon',
    cantidad: 1,
    condicion: 'un herrero con fragua a mano puede fundirlas directo en 2 Lingotes de Yerreo',
  },

  // --- Lucre Blanco (cumbres de Los Pilares Rotos) ---

  {
    sourceSlug: 'lucre-blanco',
    sourceCategory: 'planta',
    metodoObtencion: 'TALA',
    itemSlug: 'madera-lucre-blanco',
    cantidad: 2,
  },

  {
    sourceSlug: 'resina-lucre-blanco-fuente',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'resina-lucre-blanco',
    cantidad: 1,
  },

  // --- Junba Verde (Playa de Ceniza Blanca) ---

  {
    sourceSlug: 'junba-verde',
    sourceCategory: 'planta',
    metodoObtencion: 'TALA',
    itemSlug: 'madera-jumba',
    cantidad: 2,
  },

  {
    sourceSlug: 'junba-verde-resina-fuente',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'resina-jumba-verde',
    cantidad: 1,
  },

  // --- Temune (Playa de Ceniza Blanca) ---

  {
    sourceSlug: 'temune',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'algas-temune',
    cantidad: 2,
  },

  // --- Musgo Arcilla (El Pozo de Cauce Viejo) ---

  {
    sourceSlug: 'musgo-arcilla',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'musgo-rojo',
    cantidad: 2,
  },

  // --- Telda Común (El Pozo de Cauce Viejo) y Telda Ceniza (El Cruce de las Cenizas) ---

  {
    sourceSlug: 'telda-comun',
    sourceCategory: 'planta',
    metodoObtencion: 'TALA',
    itemSlug: 'madera-telda',
    cantidad: 2,
  },

  {
    sourceSlug: 'telda-ceniza',
    sourceCategory: 'planta',
    metodoObtencion: 'TALA',
    itemSlug: 'madera-telda',
    cantidad: 2,
  },

  {
    sourceSlug: 'resina-telda-fuente',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'resina-telda-gris',
    cantidad: 1,
  },

  {
    sourceSlug: 'hojas-telda-fuente',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'hojas-telda',
    cantidad: 3,
  },

  // --- Guchapo, Lebude, Escorante (El Pozo de Cauce Viejo) ---

  {
    sourceSlug: 'guchapo',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'piel-guchapo',
    cantidad: 1,
  },

  {
    sourceSlug: 'guchapo',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'racion-carne',
    cantidad: 1,
  },

  {
    sourceSlug: 'lebude',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'cera-lebude',
    cantidad: 1,
    condicion: 'de la colmena, no del individuo cazado',
  },

  {
    sourceSlug: 'lebude',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'miel-lebude',
    cantidad: 1,
    condicion: 'de la colmena, no del individuo cazado',
  },

  {
    sourceSlug: 'escorante',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'quitina-escorante',
    cantidad: 2,
  },

  // --- Ferike (El Cruce de las Cenizas) ---

  {
    sourceSlug: 'ferike',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'piel-ferike',
    cantidad: 1,
  },

  {
    sourceSlug: 'ferike',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'garras-ferike',
    cantidad: 2,
  },

  {
    sourceSlug: 'ferike',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'melena-cola-ferike',
    cantidad: 1,
    condicion: 'objeto especial, muy baja probabilidad de loot — solo machos, tienen cola',
  },

  // --- Boungo (El Osario de la Manada) ---

  {
    sourceSlug: 'boungo',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'boungo',
    cantidad: 3,
    condicion: 'crece en otoño',
    // Gate real de estación (2026-08-24, Grupo 3 § Sistema de estaciones) — antes esta
    // `condicion` era pura documentación sin efecto en el motor.
    estacionRequerida: 'OTONO',
  },

  // --- Imanio, Nuente (Las Agujas Imán) ---
  // Sin loot: el Imanio no lleva nada crafteable propio (solo rocas imantadas, ver Fase 2
  // pendiente de diseño) y el Nuente tampoco tiene loot descrito — ambos entran en combate/
  // encuentro sin dar recursos, igual que Ruptidar. Corrección 2026-08-23 (auditoría lore↔código):
  // Quio SÍ tiene recurso propio (Filtro de Quio, `flora-fauna.md`) — este comentario lo agrupaba
  // aquí por error; su fila real vive más abajo, junto al resto de fauna de Los Manaderos.

  // --- Verdileas Acuáticas, Chudos Rojizos (Los Manaderos) ---

  {
    sourceSlug: 'verdileas-acuaticas',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'verdileas-acuaticas',
    cantidad: 2,
  },

  {
    sourceSlug: 'chudos-rojizos',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'chudos-rojizos',
    cantidad: 2,
  },

  // --- Jusha Esmeralda, Miruina, Tura Jusha (Los Manaderos) ---

  {
    sourceSlug: 'jusha-esmeralda',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'carne-jusha',
    cantidad: 1,
  },

  {
    sourceSlug: 'jusha-esmeralda',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'escama-jusha',
    cantidad: 2,
  },

  {
    sourceSlug: 'miruina',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'piel-miruina',
    cantidad: 1,
  },

  {
    sourceSlug: 'miruina',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'racion-carne',
    cantidad: 1,
  },

  {
    // Añadido 2026-08-23 (auditoría lore↔código): `filtro-quio` existía como item desde antes
    // pero sin ninguna fila de HarvestYield que lo conectara a `quio` — recurso huérfano,
    // inalcanzable en juego pese a estar descrito en flora-fauna.md.
    sourceSlug: 'quio',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'filtro-quio',
    cantidad: 1,
  },

  {
    sourceSlug: 'tura-jusha',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'plumas-tura-jusha',
    cantidad: 2,
  },

  {
    sourceSlug: 'tura-jusha',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'garra-tura-jusha',
    cantidad: 1,
  },

  // --- Pasto Solar, Gradias, Cuernahoja, Flor Salvatura (Los Pastos de la Deriva) ---

  {
    sourceSlug: 'pasto-solar',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'pasto-solar',
    cantidad: 2,
  },

  {
    sourceSlug: 'gradias',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'fibra-gradias',
    cantidad: 2,
  },

  {
    sourceSlug: 'flor-salvatura',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'petalos-flor-salvatura',
    cantidad: 1,
  },

  {
    sourceSlug: 'cuernahoja',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'piel-cuernahoja',
    cantidad: 1,
  },

  {
    sourceSlug: 'cuernahoja',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'cuerno-cuernahoja',
    cantidad: 1,
    condicion: 'el de hembra (más ancho) es la variante de mayor calidad',
  },

  {
    sourceSlug: 'cuernahoja',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'racion-carne',
    cantidad: 1,
  },

  // --- Volcanita, Rovalnica, Fercaneo (El Filo de las Brasas / Las Fumarolas Negras) ---

  {
    sourceSlug: 'volcanita',
    sourceCategory: 'mineral',
    metodoObtencion: 'MINERIA',
    itemSlug: 'volcanita',
    cantidad: 1,
  },

  {
    sourceSlug: 'rovalnica',
    sourceCategory: 'mineral',
    metodoObtencion: 'MINERIA',
    itemSlug: 'rovalnica',
    cantidad: 1,
  },

  {
    sourceSlug: 'fercaneo',
    sourceCategory: 'mineral',
    metodoObtencion: 'MINERIA',
    itemSlug: 'fercaneo',
    cantidad: 1,
    condicion: 'casi imposible de encontrar, protegido por Salamandras de Escoria — más probable en Las Fumarolas Negras que en el resto de El Filo de las Brasas (pendiente: el motor no distingue hoy probabilidad por Location dentro del mismo sourceSlug)',
  },

  // --- La Sabana Alta (Pasto de Sangre, Telda Atardecer, Trigo Escarlata, Roca Luclara, Towrgu,
  // Coracelo) — zona 14 del repaso "zona por zona", añadido 2026-08-22. ---

  {
    sourceSlug: 'pasto-de-sangre',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'pasto-de-sangre',
    cantidad: 2,
  },

  {
    sourceSlug: 'telda-atardecer',
    sourceCategory: 'planta',
    metodoObtencion: 'TALA',
    itemSlug: 'madera-telda-atardecer',
    cantidad: 1,
  },

  {
    sourceSlug: 'resina-telda-atardecer-fuente',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'resina-telda-atardecer',
    cantidad: 1,
  },

  {
    sourceSlug: 'trigo-escarlata',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'trigo-escarlata',
    cantidad: 2,
  },

  {
    sourceSlug: 'roca-luclara',
    sourceCategory: 'mineral',
    metodoObtencion: 'MINERIA',
    itemSlug: 'roca-luclara',
    cantidad: 1,
  },

  {
    sourceSlug: 'towrgu',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'piel-towrgu',
    cantidad: 1,
  },

  {
    sourceSlug: 'towrgu',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'garras-towrgu',
    cantidad: 1,
  },

  {
    sourceSlug: 'towrgu',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'colmillos-towrgu',
    cantidad: 1,
  },

  {
    sourceSlug: 'coracelo',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'piel-coracelo',
    cantidad: 1,
  },

  {
    sourceSlug: 'coracelo',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'colmillos-coracelo',
    cantidad: 1,
  },

  {
    sourceSlug: 'coracelo',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'cola-coracelo',
    cantidad: 1,
  },

  // --- Hielo Sílice ---

  // --- Fauna/flora de otras regiones de Berig (2026-07-22, "incluye de momento solo todo lo que
  // sea de Berig") — todas fuera del núcleo jugable actual (Gorhorn no ha estado en ninguna de
  // estas regiones), marcado explícitamente en `condicion` en vez de fingir que son alcanzables.
  {
    sourceSlug: 'hielo-silice',
    sourceCategory: 'mineral',
    metodoObtencion: 'MINERIA',
    itemSlug: 'cuna-hielo-silice-sin-tallar',
    cantidad: 1,
    condicion: 'Solo en Cristal Helado — fuera del núcleo jugable actual',
  },

  // --- Hierba del Hierro ---

  {
    sourceSlug: 'hierba-del-hierro',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'hierba-del-hierro',
    cantidad: 1,
    condicion: 'Solo en la Meseta del Orden — fuera del núcleo jugable actual',
  },

  // --- Liquen del Cauce ---

  {
    sourceSlug: 'liquen-del-cauce',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'liquen-humedo',
    cantidad: 1,
    condicion: 'reconocerlo (los pastores de las Llanuras lo conocen — para Gorhorn no requiere tirada)',
    sinTirada: true,
  },

  // Auditoría "revisar partida" (2026-08-30, petición explícita: "Agua hervida de liquen debería
  // ser un objeto crafteable, no un recurso"): este HarvestYield daba el agua YA hervida por
  // simple recolección/EXTRACCION, con una `condicion` de texto libre ("requiere hervirlo sobre
  // fuego") que nunca se verificaba mecánicamente — retirado. Ahora es una CraftingRecipe real
  // (BOILED_LICHEN_WATER_RECIPE, crafting.ts) a partir de Liquen húmedo del cauce (arriba, sigue
  // siendo recolección directa — es el recurso crudo real).

  // --- Matorral de Cuerno ---

  {
    sourceSlug: 'matorral-de-cuerno',
    sourceCategory: 'planta',
    metodoObtencion: 'TALA',
    itemSlug: 'lena-matorral-cuerno',
    cantidad: 1,
    condicion: 'la cantidad real la calcula la fórmula de leña ya existente en timedActions.ts',
  },

  // --- Múrgol ---

  { 
    sourceSlug: 'murgol',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA', 
    itemSlug: 'racion-carne', 
    cantidad: 3 
  },

  { 
    sourceSlug: 'murgol',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA', 
    itemSlug: 'lana-murgol', 
    cantidad: 1, 
    condicion: 'cuchillo' 
  },

  {
    sourceSlug: 'murgol',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'hueso-ligero',
    cantidad: 4
  },

  // --- Múrgoles domados (Campamento del Clan Serhu) ---

  // sourceSlug DISTINTO de 'murgol' a propósito (2026-08-24, Grupo 3 § 27 recursos/materiales sin
  // receta) — la invariante de HarvestYield exige que todas las filas de un mismo sourceSlug
  // compartan metodoObtencion (validado en seed-catalog.ts), y 'murgol' ya es CAZA (fauna
  // salvaje). Esto es leche de los múrgoles YA domados dentro del campamento — PASIVO, nunca se
  // caza. `leche-murgol` no tenía ninguna HarvestYield antes de esto, era huérfano total.
  {
    sourceSlug: 'murgoles-domados-campamento',
    sourceCategory: 'fauna',
    metodoObtencion: 'PASIVO',
    itemSlug: 'leche-murgol',
    cantidad: 3,
  },

  // --- Ofrendas de los Túmulos del Honor ---

  // `PASIVO`, no `EXTRACCION` (auditoría 2026-08-14, petición explícita: "solo deberían salir
  // hierbas en recolectar y salieron todos los objetos narrativos") — no son plantas, son objetos
  // de recuerdo/ofrenda; con `EXTRACCION` se colaban en el pop-up de Herborista junto a hierbas de
  // verdad. `PASIVO` los deja donde tienen sentido narrativo: solo salen al "Explorar la zona"
  // genérico (discovery.ts), nunca ligados a un oficio concreto.
  // --- Raíz de Fuego ---

  {
    sourceSlug: 'raiz-de-fuego',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'ascuas-raiz-fuego',
    cantidad: 1,
    condicion: 'extracción con cuidado (destreza, Media 15 — falla = se inflama)',
  },

  // --- Restos personales de Maktor ---

  // --- Tier 0, ronda 2 de objetos (roadmap 2026-07-20) ---
  // `PASIVO`, no `EXTRACCION` — mismo motivo que "Ofrendas de los Túmulos del Honor" arriba,
  // objetos de recuerdo del clan de Gorhorn, no hierbas (auditoría 2026-08-14).
  //
  // Ampliación de lore 2026-08-21 ("zona sin vida, agrietada... solo el recuerdo de lo que pudo
  // ser, no loot real"): quitados Juguete de hueso tallado y Brazalete trenzado del Clan Maktor
  // (trofeos sin más, sin ninguna otra dependencia). `totem-clan-roto` y Tablilla quemada se
  // quedan PENDIENTES de confirmar con la usuaria — el tótem es ingrediente real de
  // `MAKTOR_CLAN_TOTEM_RECIPE` (construction.ts, receta de Reino ya implementada, con tests
  // propios) y la tablilla es el documento legible "La caída del Clan Maktor" — ninguno de los dos
  // es un trofeo suelto como los dos ya retirados.
  {
    sourceSlug: 'restos-personales-maktor',
    sourceCategory: 'objeto',
    metodoObtencion: 'PASIVO',
    itemSlug: 'tablilla-quemada-maktor',
    cantidad: 1
  },

  {
    sourceSlug: 'restos-personales-maktor',
    sourceCategory: 'objeto',
    metodoObtencion: 'PASIVO',
    itemSlug: 'totem-clan-roto',
    cantidad: 1,
  },

  // --- Roca de Los Pilares Rotos ---

  // Roadmap de construcción (2026-07-20/21, petición explícita de la usuaria: recursos reales
  // para construir un campamento) — grounded en areas.md: Los Pilares Rotos es literalmente una
  // "formación rocosa erosionada", cantera natural sin necesidad de inventar un lugar nuevo.
  {
    sourceSlug: 'roca-pilares-rotos',
    sourceCategory: 'mineral',
    metodoObtencion: 'MINERIA',
    itemSlug: 'piedra',
    cantidad: 3,
    condicion: 'formación rocosa erosionada — buena cantera improvisada, 3 piedras por recolección',
  },

  // --- Rondador de Brasas ---

  {
    sourceSlug: 'rondador-de-brasas',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'piel-rondador',
    cantidad: 1,
    condicion: 'cuchillo de deshuello',
  },

  { 
    sourceSlug: 'rondador-de-brasas',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA', 
    itemSlug: 'garra-rondador', 
    cantidad: 2 
  },

  { 
    sourceSlug: 'rondador-de-brasas',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA', 
    itemSlug: 'racion-carne', 
    cantidad: 3, 
    condicion: 'carne fuerte — mejor ahumada' 
  },

  // --- Salamandra de Escoria ---

  {
    sourceSlug: 'salamandra-de-escoria',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'glandula-ignea',
    cantidad: 1,
    condicion: 'extracción con cuidado (destreza, Media 15 — falla = se inflama)',
  },

  {
    sourceSlug: 'salamandra-de-escoria',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'piel-salamandra',
    cantidad: 1,
    condicion: 'cuchillo de deshuello',
  },

  { 
    sourceSlug: 'salamandra-de-escoria',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA', 
    itemSlug: 'racion-carne', 
    cantidad: 2 
  },

  // --- Salvia del Polvo ---

  {
    sourceSlug: 'salvia-del-polvo',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'manojo-salvia-polvo',
    cantidad: 1,
    condicion: 'reconocerla (los orcos de las Llanuras la conocen de niños — para Gorhorn no requiere tirada)',
    sinTirada: true,
  },

  // --- Sombra de Kroj ---

  {
    sourceSlug: 'sombra-de-kroj',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'pluma-sombra-kroj',
    cantidad: 1,
    condicion: 'Solo en El Margen Silencioso — fuera del núcleo jugable actual',
  },

  // --- Trepador Ocaso ---

  {
    sourceSlug: 'trepador-ocaso',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'resina-trepador-ocaso',
    cantidad: 1,
    condicion: 'Solo en Ciénaga Troncal — fuera del núcleo jugable actual',
  },

  // --- Veta de Hierro de las Llanuras Rojas (slug sin tocar: veta-hierro-pilares-rotos) ---

  // Receta de refinado nueva (2026-07-29, petición explícita: "convertir una mena de mineral en
  // un lingote") — misma formación rocosa que ya da piedra, con una veta de hierro real dentro.
  {
    sourceSlug: 'veta-hierro-pilares-rotos',
    sourceCategory: 'mineral',
    metodoObtencion: 'MINERIA',
    itemSlug: 'mena-hierro-llanuras',
    cantidad: 2,
    condicion: 'requiere pico de minero — vetas visibles entre las grietas de la roca erosionada',
    requiereHerramienta: true,
  },

  // Peces y marisco de Playa de Ceniza Blanca (zona 15 del repaso, 2026-09-02) — profesión
  // "pescador" nueva (ver harvestAbilities.ts): Pescar (PESCA, caña+cebo) para los peces, Buscar
  // (BUSQUEDA, sin herramienta) para el marisco. `sourceCategory: 'fauna'` mismo criterio que
  // jusha-esmeralda (fauna real con Npc propio) — no confundir con el resto de fauna del catálogo,
  // que usa CAZA (combate/desuello): estos peces son 'INOFENSIVO'/'CAUTELOSO' ("no ataca, huye"),
  // nunca se cazan. Cantidad 1 por captura para los 6 (peces/caracoles individuales, no vetas).

  // --- Jashil Verde / Jashil Rojo (mismo item, dos peces cromáticamente distintos) ---

  {
    sourceSlug: 'jashil-verde',
    sourceCategory: 'fauna',
    metodoObtencion: 'PESCA',
    itemSlug: 'carne-jashil',
    cantidad: 1,
  },

  {
    sourceSlug: 'jashil-rojo',
    sourceCategory: 'fauna',
    metodoObtencion: 'PESCA',
    itemSlug: 'carne-jashil',
    cantidad: 1,
  },

  // --- Toluh (migratorio, solo otoño — tier 7, dos yields del mismo pez) ---

  {
    sourceSlug: 'toluh',
    sourceCategory: 'fauna',
    metodoObtencion: 'PESCA',
    itemSlug: 'carne-toluh',
    cantidad: 1,
    condicion: 'pez migratorio, solo en otoño',
    estacionRequerida: 'OTONO',
  },

  {
    sourceSlug: 'toluh',
    sourceCategory: 'fauna',
    metodoObtencion: 'PESCA',
    itemSlug: 'escamas-toluh',
    cantidad: 1,
    condicion: 'pez migratorio, solo en otoño',
    estacionRequerida: 'OTONO',
  },

  // --- Negueo Turquesa / Negueo Solar (mismo item, dos peces cromáticamente distintos) ---

  {
    sourceSlug: 'negueo-turquesa',
    sourceCategory: 'fauna',
    metodoObtencion: 'PESCA',
    itemSlug: 'carne-negueo',
    cantidad: 1,
  },

  {
    sourceSlug: 'negueo-solar',
    sourceCategory: 'fauna',
    metodoObtencion: 'PESCA',
    itemSlug: 'carne-negueo',
    cantidad: 1,
  },

  // --- Bulco de Arena (marisco, Buscar — sin herramienta) ---

  {
    sourceSlug: 'bulco-de-arena',
    sourceCategory: 'fauna',
    metodoObtencion: 'BUSQUEDA',
    itemSlug: 'bulco-arena-marisco',
    cantidad: 1,
  },

  // --- Celubia Pálida / Terkash (Los Acantilados Partidos, 2026-09-02) ---

  {
    sourceSlug: 'celubia-palida',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'plumas-celubia',
    cantidad: 2,
    condicion: 'plumas largas del plumaje, más abundantes tras un ejemplar adulto',
  },

  {
    sourceSlug: 'celubia-palida',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'huevo-celubia',
    cantidad: 1,
    condicion: 'solo si se caza cerca del nido, en la cornisa — raro fuera de la época de cría',
  },

  {
    sourceSlug: 'terkash',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'carne-terkash',
    cantidad: 2,
    condicion: 'carne blanca extraída del caparazón',
  },

  {
    sourceSlug: 'terkash',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'caparazon-terkash',
    cantidad: 1,
    condicion: 'caparazón entero, útil como material de construcción/armadura',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TANDA OpenCode 2026-09-27/28 — HarvestYield de flora y fauna nuevas. Todo El Margen
  // Silencioso/Ciénaga Troncal/Cristal Helado/La Meseta del Orden queda fuera del núcleo jugable
  // actual (mismo criterio que Cornante/Sombra de Kroj: sin homeLocationSlug/harvestSourceRegion
  // propios, con la región anotada en `condicion`).
  // ══════════════════════════════════════════════════════════════════════════

  // --- A-20: Musgo Callado ---
  {
    sourceSlug: 'musgo-callado',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'musgo-callado',
    cantidad: 3,
    condicion: 'El Margen Silencioso — fuera del núcleo jugable actual, sin herramienta',
    sinTirada: true,
  },

  // --- A-21: Veldria Hueca ---
  {
    sourceSlug: 'veldria-hueca',
    sourceCategory: 'planta',
    metodoObtencion: 'TALA',
    itemSlug: 'madera-veldria-hueca',
    cantidad: 2,
    condicion: 'El Margen Silencioso — fuera del núcleo jugable actual; los Nabieus solo toman ramas caídas',
  },
  {
    sourceSlug: 'resina-veldria-fuente',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'resina-veldria',
    cantidad: 1,
    condicion: 'El Margen Silencioso — fuera del núcleo jugable actual',
  },

  // --- A-22: Flor de Víspera ---
  {
    sourceSlug: 'flor-de-vispera',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'petalos-vispera',
    cantidad: 2,
    condicion: 'El Margen Silencioso — fuera del núcleo jugable actual; sus flores solo se abren al atardecer',
  },

  // --- A-23: Cántaro de Hoja ---
  {
    sourceSlug: 'cantaro-de-hoja',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'agua-cantaro',
    cantidad: 1,
    condicion: 'El Margen Silencioso — fuera del núcleo jugable actual; se regenera con la siguiente lluvia',
    sinTirada: true,
  },
  {
    sourceSlug: 'cantaro-de-hoja',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'tallo-cantaro',
    cantidad: 1,
    condicion: 'El Margen Silencioso — fuera del núcleo jugable actual, una vez drenada el agua',
  },

  // --- A-24: Carnosa de Tocón ---
  {
    sourceSlug: 'carnosa-de-tocon',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'carnosa-de-tocon',
    cantidad: 1,
    condicion: 'El Margen Silencioso — fuera del núcleo jugable actual, sobre tocones caídos',
  },

  // --- A-25: Bulbo de Turbera (Ciénaga Troncal) ---
  {
    sourceSlug: 'bulbo-de-turbera',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'bulbo-de-turbera',
    cantidad: 2,
    condicion: 'Ciénaga Troncal — fuera del núcleo jugable actual',
    sinTirada: true,
  },

  // --- A-26: Velo de Charca (Ciénaga Troncal) ---
  {
    sourceSlug: 'velo-de-charca',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'velo-de-charca',
    cantidad: 2,
    condicion: 'Ciénaga Troncal — fuera del núcleo jugable actual, sobre charcas quietas',
  },

  // --- A-27: Herrumbrera (Ciénaga Troncal) ---
  {
    sourceSlug: 'herrumbrera',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'corteza-herrumbre',
    cantidad: 2,
    condicion: 'Ciénaga Troncal — fuera del núcleo jugable actual, orillas de agua estancada',
  },

  // --- P-03: Liquen Escarcha (Cristal Helado) y Bolco (Ciénaga Troncal) ---
  {
    sourceSlug: 'liquen-escarcha',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'liquen-escarcha',
    cantidad: 1,
    condicion: 'Cristal Helado — fuera del núcleo jugable actual; se raspa solo la mitad, nunca la costra entera',
  },
  {
    sourceSlug: 'bolco',
    sourceCategory: 'planta',
    metodoObtencion: 'EXTRACCION',
    itemSlug: 'resina-bolco',
    cantidad: 1,
    condicion: 'Ciénaga Troncal — fuera del núcleo jugable actual, Marismas de Lodo Negro',
  },

  // --- A-28: Leshra ---
  {
    sourceSlug: 'leshra',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'plumas-leshra',
    cantidad: 1,
    condicion: 'El Margen Silencioso — fuera del núcleo jugable actual',
  },

  // --- A-29: Morvasa ---
  {
    sourceSlug: 'morvasa',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'veneno-morvasa',
    cantidad: 1,
    condicion: 'El Margen Silencioso — fuera del núcleo jugable actual, extracción cuidadosa',
  },
  {
    sourceSlug: 'morvasa',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'piel-morvasa',
    cantidad: 1,
    condicion: 'El Margen Silencioso — fuera del núcleo jugable actual',
  },

  // --- A-30: Brozán ---
  {
    sourceSlug: 'brozan',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'racion-carne',
    cantidad: 1,
    condicion: 'El Margen Silencioso — fuera del núcleo jugable actual',
  },
  {
    sourceSlug: 'brozan',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'piel-brozan',
    cantidad: 1,
    condicion: 'El Margen Silencioso — fuera del núcleo jugable actual',
  },

  // --- A-31: Hoscón ---
  {
    sourceSlug: 'hoscon',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'plumon-hoscon',
    cantidad: 1,
    condicion: 'El Margen Silencioso — fuera del núcleo jugable actual',
  },

  // --- P-01: Hielaga, Nievón, Escarchín (Cristal Helado); Tragalodo, Borbol, Zancapilote
  // (Ciénaga Troncal); Vreskal (La Meseta del Orden) ---
  {
    sourceSlug: 'hielaga',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'racion-carne',
    cantidad: 2,
    condicion: 'Cristal Helado — fuera del núcleo jugable actual; caza racionada, no se caza de más',
  },
  {
    sourceSlug: 'hielaga',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'piel-hielaga',
    cantidad: 1,
    condicion: 'Cristal Helado — fuera del núcleo jugable actual',
  },
  {
    sourceSlug: 'nievon',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'piel-nievon',
    cantidad: 1,
    condicion: 'Cristal Helado — fuera del núcleo jugable actual',
  },
  {
    sourceSlug: 'nievon',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'colmillos-nievon',
    cantidad: 1,
    condicion: 'Cristal Helado — fuera del núcleo jugable actual',
  },
  {
    sourceSlug: 'escarchin',
    sourceCategory: 'fauna',
    metodoObtencion: 'PESCA',
    itemSlug: 'carne-escarchin',
    cantidad: 1,
    condicion: 'Cristal Helado — fuera del núcleo jugable actual, pesca de invierno en El Lago Cristalice',
  },
  {
    sourceSlug: 'tragalodo',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'placas-tragalodo',
    cantidad: 1,
    condicion: 'Ciénaga Troncal — fuera del núcleo jugable actual',
  },
  {
    sourceSlug: 'tragalodo',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'dientes-tragalodo',
    cantidad: 1,
    condicion: 'Ciénaga Troncal — fuera del núcleo jugable actual',
  },
  {
    sourceSlug: 'borbol',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'carne-borbol',
    cantidad: 1,
    condicion: 'Ciénaga Troncal — fuera del núcleo jugable actual',
  },
  {
    sourceSlug: 'zancapilote',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'plumas-zancapilote',
    cantidad: 1,
    condicion: 'Ciénaga Troncal — fuera del núcleo jugable actual',
  },
  {
    sourceSlug: 'vreskal',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'placas-vreskal',
    cantidad: 1,
    condicion: 'La Meseta del Orden — fuera del núcleo jugable actual; matar uno en una muralla está mal visto',
  },

  // --- P-02: Sombra de Kroj, Hetris, Mekiosi, Vistue (El Margen Silencioso) ---
  {
    sourceSlug: 'sombra-de-kroj',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'pluma-sombra-kroj',
    cantidad: 1,
    condicion: 'El Margen Silencioso — fuera del núcleo jugable actual',
  },
  {
    sourceSlug: 'hetris',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'piel-hetris',
    cantidad: 1,
    condicion: 'El Margen Silencioso — fuera del núcleo jugable actual',
  },
  {
    sourceSlug: 'hetris',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'garras-hetris',
    cantidad: 1,
    condicion: 'El Margen Silencioso — fuera del núcleo jugable actual',
  },
  {
    sourceSlug: 'mekiosi',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'piel-mekiosi',
    cantidad: 1,
    condicion: 'El Margen Silencioso — fuera del núcleo jugable actual',
  },
  {
    sourceSlug: 'mekiosi',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'colmillos-mekiosi',
    cantidad: 1,
    condicion: 'El Margen Silencioso — fuera del núcleo jugable actual',
  },
  {
    sourceSlug: 'vistue',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'piel-vistue',
    cantidad: 1,
    condicion: 'El Margen Silencioso — fuera del núcleo jugable actual',
  },
  {
    sourceSlug: 'vistue',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'racion-carne',
    cantidad: 1,
    condicion: 'El Margen Silencioso — fuera del núcleo jugable actual',
  },
  {
    sourceSlug: 'cornante',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'racion-carne',
    cantidad: 4,
    condicion: 'Ciénaga Troncal — fuera del núcleo jugable actual; cazado en grupo, acorralado hacia el agua baja',
  },

  // --- A-32: Colmillo de Ferike, despiece ampliado del Ferike (ya existente) ---
  {
    sourceSlug: 'ferike',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'colmillo-ferike',
    cantidad: 1,
    condicion: 'de un macho — 20-35 cm, marfil con vetas pardas',
  },
  {
    sourceSlug: 'ferike',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'colmillo-ferike-hembra',
    cantidad: 1,
    condicion: 'solo de una hembra — variante de mayor calidad, con la que se talla la Ashi\'krul',
  },

  // --- A-36: Incisivos de Miruina, despiece ampliado de la Miruina (ya existente) ---
  {
    sourceSlug: 'miruina',
    sourceCategory: 'fauna',
    metodoObtencion: 'CAZA',
    itemSlug: 'incisivos-miruina',
    cantidad: 1,
    condicion: 'junto a la Piel de Miruina',
  },
];

/// Especie/planta -> aliases de jugador, para el matcher determinista de despiece/recolección
/// (docs/12 § 3.3). Vive aquí y no en HarvestYield porque varias filas comparten sourceSlug.
/// ⚠️ EL ORDEN DE ESTE OBJETO IMPORTA — NO reordenar/alfabetizar (hallazgo real reorganizando este
/// archivo, 2026-08-02): `matchHarvestSource` (harvest.ts) recorre `Object.entries(...)` y devuelve
/// el PRIMER slug cuyo alias haga match, incluida la rama de tolerancia por palabra suelta
/// (`fuzzyMatchesAnyStem`) — con dos fuentes que comparten una palabra (p. ej. "cauce" en
/// "corredor de cauce" y "bulbo del cauce"), quién gana depende SOLO del orden de declaración
/// aquí. Alfabetizarlo de verdad rompió `matchHarvestSource('Despiezo un corredor de cauce')`,
/// que empezó a devolver `bulbo-del-cauce` en vez de `corredor-de-cauce` — detectado por el test
/// existente, no por inspección. Si se añade una fuente nueva cuyo alias comparta palabra con otra
/// ya existente, la que se quiera priorizar va ANTES.
export const harvestSourceAliases: Record<string, string[]> = {
  'murgoles-domados-campamento': ['múrgoles domados', 'murgoles domados', 'recinto de múrgol'],
  'corredor-de-cauce': ['corredor de cauce', 'corredor', 'corredores de cauce'],
  'gargantua-de-ceniza': ['gargantúa', 'gargantua', 'gargantúa de ceniza', 'gargantua de ceniza'],
  // 'espina' (sola) quitada como alias (2026-09-06, bug real: "la espina dorsal" se enlazaba como
  // esta criatura en la Enciclopedia) — a diferencia de "corredor"/"gargantúa", "espina" es un
  // sustantivo común de la lengua que aparece en frases normales ("espina dorsal") sin relación
  // con esta fauna; las formas largas siguen cubriendo toda mención real a la criatura.
  'espina-del-viento': ['espina del viento', 'espinas del viento'],
  'raiz-de-fuego': ['raíz de fuego', 'raiz de fuego'],
  // 'musgo-arcilla' colocado justo después de 'raiz-de-fuego' a propósito (2026-08-23, auditoría
  // lore↔código) — NO antes: "musgo" está a distancia de edición 2 de "fuego" (m-u-s-g-o vs
  // f-u-e-g-o, 2 sustituciones), dentro del umbral de `fuzzyMatchesAnyStem`, y esa colisión es
  // simétrica — cualquiera de las dos entradas que se compruebe primero "roba" a la otra. Se prioriza
  // 'raiz-de-fuego' (fuente establecida desde hace tiempo) sobre 'musgo-arcilla' (fuente nueva de
  // hoy): con este orden, "musgo arcilla"/"musgo" sueltos pueden, en el peor caso, malinterpretarse
  // como Raíz de Fuego — colisión de fondo del propio algoritmo de tolerancia a erratas, no
  // resoluble solo reordenando; pendiente de decidir con la usuaria si se quiere tocar el
  // matcher (`fuzzyMatchesAnyStem`, travel.ts) o vivir con ella.
  'musgo-arcilla': ['musgo arcilla', 'musgo rojo', 'musgo'],
  corretolvas: ['corretolva', 'corretolvas'],
  'salvia-del-polvo': ['salvia del polvo', 'salvia'],
  'espiga-roja': ['espiga roja', 'espiga'],
  'matorral-de-cuerno': ['matorral de cuerno', 'matorral', 'leña'],
  // 'roca-luclara' y 'yerreo' colocados ANTES de 'roca-pilares-rotos'/'veta-hierro-pilares-rotos'
  // a propósito (2026-08-23, resolviendo colisión detectada en la auditoría lore↔código de esa
  // fecha): sus propios alias contienen las palabras genéricas "roca"/"mena" que las dos entradas
  // de abajo también reclaman — si se comprobaran después, cualquier mención de Roca Luclara o
  // Yerreo se malinterpretaría como la roca/veta genérica de Los Pilares Rotos.
  'roca-luclara': ['roca luclara'],
  yerreo: ['yerreo', 'mena de yerreo'],
  'roca-pilares-rotos': ['roca', 'rocas', 'piedra', 'piedras', 'canto rodado', 'pedrusco', 'pilares rotos'],
  // Alias distintos a propósito de 'roca-pilares-rotos' de arriba (2026-07-29) — "mena"/"veta" no
  // deben coincidir nunca con "piedra"/"roca" genéricas, para que picar piedra suelta y minar la
  // veta de hierro sean intenciones claramente distintas del jugador.
  'veta-hierro-pilares-rotos': ['veta de hierro', 'veta', 'mena de hierro', 'mena'],
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
  'zense-ceniza': ['buitre', 'buitres', 'buitre cenizo', 'buitres cenizos', 'carroneras', 'carroñeras'],
  // Flora/mineral nueva
  'cardo-brujula': ['cardo', 'cardo brújula', 'cardo brujula', 'cardos'],
  'liquen-del-cauce': ['liquen', 'liquen del cauce'],
  'bulbo-del-cauce': ['bulbo', 'bulbos', 'bulbo del cauce', 'tuberculo', 'tubérculo'],
  'flor-de-ceniza': ['flor de ceniza', 'flores de ceniza', 'amapola'],
  // "arena magnética" es una frase ya muy usada en la prosa de tormentas (roadmap 2026-07-20,
  // aviso de Fable) — solo aliases que no colisionen con eso.
  'arena-iman': ['arena iman', 'arena imán', 'limaduras'],
  // Tier 0, ronda 2 (roadmap 2026-07-20) — dos fuentes nuevas ligadas a Location, no a fauna/flora.
  'restos-personales-maktor': ['restos personales', 'objetos personales', 'pertenencias de maktor', 'restos personales de maktor'],
  // Otras regiones de Berig (2026-07-22) — fuera del núcleo jugable, ver harvestYields arriba.
  'hielo-silice': ['hielo silice', 'hielo sílice'],
  'hierba-del-hierro': ['hierba del hierro', 'hierba de hierro'],
  'trepador-ocaso': ['trepador ocaso', 'trepadores ocaso', 'trepador del ocaso'],
  cornante: ['cornante', 'cornantes'],
  'sombra-de-kroj': ['sombra de kroj', 'sombras de kroj'],

  // Fauna/flora añadida 2026-08-23 (auditoría lore↔código, tabla desactualizada desde 2026-08-03):
  // 17 fauna y 23 flora/mineral con `HarvestYield`/`Npc` real (ampliación de lore 2026-08-21/22)
  // que nunca llegaron a esta tabla — invisibles/rotos en el matcher de despiece/recolección real.
  //
  // 'flor-salvatura' colocada aquí arriba a propósito, fuera del bloque de flora de abajo: su
  // alias 'flor salvatura'/'flor de salvatura' contiene la palabra 'tura', alias también de
  // 'tura-jusha' más abajo — si 'tura-jusha' se comprobara primero (recorrido de
  // `Object.entries`, ver comentario de cabecera de esta tabla), cualquier mención de Flor
  // Salvatura se malinterpretaría como Tura Jusha.
  'flor-salvatura': ['flor salvatura', 'flor de salvatura', 'flores de salvatura'],

  // 'orco-expulsado' (bug real jugando en vivo, 2026-09-06/07, reportado por la usuaria: "al darle a
  // Cazar... salía Ruptidar y Orco rezagado... y luego parpadea, se actualiza y solo queda el
  // Ruptidar"): faltaba por completo en este mapa, así que `detectHarvestSourcesInScene` (harvest.ts)
  // nunca reconocía el hecho de sesión que `POST /cazar/explorar` acababa de persistir con su
  // nombre — el refresco silencioso de 2s (HuntSelectionModal.tsx) releía `sessionFacts` vía el GET
  // y lo filtraba fuera en cuanto llegaba, aunque el POST inicial sí lo hubiera mostrado. No es una
  // condición de carrera (`appendSessionFacts` está awaited de verdad antes de responder el POST):
  // es que el slug nunca tuvo alias con los que matchear, por lo que `harvestSourceAliases[slug] ??
  // []` devolvía vacío y el `.some(...)` de la línea 114 (harvest.ts) siempre era `false` para esta
  // especie. Mismo patrón que 'ruptidar'/'canizor' de abajo. NOTA: hay otros ~17 slugs de
  // `WorldPopulation` FAUNA sin entrada aquí (ver worldPopulation.ts) — no auditados uno a uno en
  // esta pasada, este fix cubre solo el caso reportado y confirmado.
  //
  // Slug corregido (2026-09-09, bug de catálogo real encontrado investigando un flake de test): el
  // `Npc` se renombró de `orco-rezagado` a `orco-expulsado` (commit `145252a`, 2026-08-18) DESPUÉS
  // de que este alias se escribiera — la clave quedó apuntando al slug viejo, así que este fix ya
  // no aplicaba a ningún `Npc` real en Postgres desde entonces (aunque seguía "funcionando" contra
  // la fila `WorldPopulation` huérfana del mismo slug, ya borrada — ver worldPopulation.ts).
  'orco-expulsado': ['orco rezagado', 'guerrero orco rezagado', 'orcos rezagados', 'orco expulsado', 'guerrero orco expulsado', 'orcos expulsados'],

  // Fauna nueva (mismos aliases que los del Npc correspondiente, ver array `fauna` arriba).
  canizor: ['canizor', 'canizores', "makt'orik"],
  gesgurio: ['gesgurio', 'gesgurios'],
  'kirelon-arenoso': ['kirelon', 'kirelon arenoso', 'kirelones'],
  ruptidar: ['ruptidar', 'ruptidares'],
  ferike: ['ferike', 'ferikes'],
  guchapo: ['guchapo', 'guchapos', 'sapo gigante'],
  lebude: ['lebude', 'lebudes'],
  escorante: ['escorante', 'escorantes'],
  // Corrección 2026-08-23 (verificación propia tras el pase inicial del agente, que había puesto
  // 'tura-jusha' primero): esa versión arreglaba "tura jusha"/"turas jusha" pero rompía POR
  // COMPLETO 'jusha-esmeralda' — cualquier mención de "jusha"/"jusha esmeralda"/"jushas" pasaba a
  // resolver siempre a Tura Jusha, porque `fuzzyMatchCandidates` extrae "jusha" como stem
  // independiente de la propia frase "tura jusha", sin relación con el orden de comprobación. No
  // hay ningún orden que arregle las dos direcciones a la vez (colisión simétrica, misma familia
  // que 'musgo-arcilla'/'raiz-de-fuego' más arriba): "jusha" es sustring literal de "tura jusha",
  // así que cualquiera que se compruebe primero se queda también con la frase completa del otro.
  // Se prioriza aquí 'jusha-esmeralda' (nombre propio real, con receta de cocina real detrás) sobre
  // 'tura-jusha' (nombre compuesto) — el único caso que queda roto es la frase completa "tura
  // jusha"/"turas jusha" (el alias corto y más natural, bare 'tura', sigue funcionando bien: no
  // contiene "jusha" y no tiene 5+ letras para colisionar).
  'jusha-esmeralda': ['jusha', 'jusha esmeralda', 'jushas'],
  'tura-jusha': ['tura jusha', 'tura', 'turas jusha'],
  miruina: ['miruina', 'miruinas'],
  quio: ['quio', 'quios'],
  cuernahoja: ['cuernahoja', 'cuernahojas'],
  imanio: ['imanio', 'imanios'],
  nuente: ['nuente', 'nuentes'],
  towrgu: ['towrgu', 'towrgus'],
  coracelo: ['coracelo', 'coracelos'],

  // Flora/mineral nueva (aliases derivados del nombre real, ver `items`/`harvestYields` arriba).
  boungo: ['boungo', 'seta boungo', 'setas boungo'],
  // Sin 'llanuras' como palabra suelta a propósito (bug real detectado por el test existente de
  // `matchHarvestSource`, 2026-08-23): 'llanuras'/'llanura' es palabra de 5+ letras y
  // `fuzzyMatchesAnyStem` (distancia de edición ≤2) la confundía con CUALQUIER mención genérica de
  // "la llanura" en texto sin relación alguna con esta planta — 'enredaderas'/'enredadera' bastan,
  // son palabras distintivas sin colisión conocida.
  'enredaderas-llanuras': ['enredaderas', 'enredadera'],
  fercaneo: ['fercaneo', 'fercaneos'],
  gradias: ['gradias', 'arbusto gradias', 'arbusto de gradias'],
  'hojas-telda-fuente': ['hojas de telda', 'hoja de telda'],
  'chudos-rojizos': ['chudos rojizos', 'chudos', 'chudos de los manaderos'],
  // 'resina-lucre-blanco-fuente' antes que 'lucre-blanco' a propósito: 'resina de lucre blanco'
  // contiene literalmente 'lucre blanco' — si 'lucre-blanco' se comprobara primero, cualquier
  // mención de la resina se malinterpretaría como la madera.
  'resina-lucre-blanco-fuente': ['resina de lucre blanco', 'resina de lucre'],
  'lucre-blanco': ['lucre blanco', 'arbol de lucre blanco', 'lucres blancos'],
  'pasto-de-sangre': ['pasto de sangre', 'hierba roja'],
  // Junba Verde/Temune (zona 15 del repaso, Playa de Ceniza Blanca, 2026-09-02) — fuente de
  // resina separada de la de madera, mismo criterio que resina-lucre-blanco-fuente (evita que
  // mencionar "resina de junba" se malinterprete como el árbol/madera).
  'junba-verde-resina-fuente': ['resina de junba', 'resina de junba verde'],
  'junba-verde': ['junba verde', 'arbol de junba verde', 'junbas verdes'],
  temune: ['temune', 'algas temune'],
  'pasto-solar': ['pasto solar', 'hierba comun', 'hierba común'],
  // 'resina-telda-atardecer-fuente' antes que 'telda-atardecer' Y que 'resina-telda-fuente' a
  // propósito: 'resina de telda atardecer' contiene literalmente 'telda atardecer' y también
  // 'resina de telda' — si cualquiera de las otras dos se comprobara antes, las menciones de esta
  // resina se malinterpretarían.
  'resina-telda-atardecer-fuente': ['resina de telda atardecer', 'resina telda atardecer'],
  'telda-atardecer': ['telda atardecer', 'teldas atardecer'],
  'resina-telda-fuente': ['resina de telda', 'resina telda gris'],
  'telda-ceniza': ['telda ceniza', 'teldas ceniza'],
  'telda-comun': ['telda comun', 'telda común', 'teldas comunes'],
  'trigo-escarlata': ['trigo escarlata', 'trigos escarlata'],
  rovalnica: ['rovalnica', 'rovalnicas'],
  'verdileas-acuaticas': ['verdileas acuaticas', 'verdileas', 'algas de manaderos'],
  volcanita: ['volcanita', 'volcanitas'],
};

/// Descripción física/visual de cada fuente de flora o mineral SIN fila Npc propia (2026-07-22,
/// petición explícita: "ampliar toda la info... para mejorar el resultado de los prompts de
/// imágenes"). Antes estas 14 fuentes no tenían NINGÚN texto descriptivo en ningún sitio —
/// HarvestYield no tiene columna description y loreContextFor() en imagePromptContext.ts no leía
/// nada más que "flora o material recolectable" a secas. `espina-del-viento` vive aquí y no en el
/// array `fauna` de arriba porque es peligro ambiental puro (docs/rpgtarkor/lore-mundo/areas.md), sin ficha
/// de combate ni Npc propio — pero sigue necesitando descripción visual igual que cualquier otra.
/// Bug real (2026-07-22): la Enciclopedia usaba "¿existe Npc con este slug?" como proxy de "¿es
/// fauna (animal) o flora/mineral?" — funciona para las 9 fauna cazable de arriba (sí tienen
/// Npc), pero Espina del Viento, Cornante y Sombra de Kroj son animales de verdad (escorpión,
/// alce-hipopótamo, ave rapaz) SIN ficha de combate propia (peligro ambiental o fuera del núcleo
/// jugable), así que salían mal categorizados como "Flora / material" en el icono y la etiqueta.
/// Set aparte, no un booleano más en `harvestSourceDescriptions`, para no forzar a toda fuente
/// flora/mineral a declarar explícitamente "no soy fauna".
///
/// `murgoles-domados-campamento` (hallazgo 22, revisar-partida-hallazgos.md 2026-09-07) — mismo
/// bug exacto: `sourceCategory: 'fauna'` (leche de los Múrgoles ya domados del campamento, ver su
/// ficha de HarvestYield arriba) pero `sourceSlug` DISTINTO de 'murgol' (el Npc real) a propósito,
/// por la invariante de metodoObtencion compartido — sin Npc con ese slug exacto, salía mal
/// categorizado como flora en icono/carpeta de imágenes, igual que las 3 fuentes originales.
export const harvestSourcesThatAreFaunaWithoutNpc = new Set(['cornante', 'espina-del-viento', 'sombra-de-kroj', 'murgoles-domados-campamento']);

/// Zona de origen explícita por fuente (2026-07-29, colapsables de fauna/flora por zona en la
/// Enciclopedia) — confirmado por la usuaria: la inmensa mayoría de estas pertenecen a Llanuras
/// del Viento Rojo (excepciones documentadas junto a cada una, ya sea Ciénaga Troncal, Meseta del
/// Orden o Cristal Helado). Necesario aparte del `homeLocationSlug` del Npc (muchas fauna cazable
/// no tiene uno fijo — itinerante por la llanura, sin un solo punto de "casa") y del `lugarOrigen`
/// del objeto que dan (varias comparten un mismo objeto genérico entre especies, ej. "Ración de
/// carne fresca", que no puede llevar una región fija sin mentir sobre las demás fuentes que
/// también lo dan).
///
/// Auditoría de catálogo EXTRACCION (2026-08-13): 7 fuentes con `metodoObtencion: 'EXTRACCION'`/
/// `'MINERIA'` reales y con descripción propia (`harvestSourceDescriptions`) que mencionaba una
/// región concreta llevaban sin fila aquí — sin ella, `detectsWrongRegionHarvestClaim`
/// (playerActionValidation.ts) nunca puede avisar "eso no se da en esta tierra" para ellas, y las
/// del núcleo jugable (Llanuras) tampoco entraban en `candidateSourcesFor` (recolectar.ts), que
/// filtra por `WorldPopulation.distribucion[región]` — mismo bug de fondo que las 3 filas de
/// `WorldPopulation` que faltaban (ver worldPopulation.ts). Añadidas: `espiga-roja`,
/// `restos-personales-maktor`, `salvia-del-polvo` y `veta-hierro-pilares-rotos` (las 4 del núcleo,
/// Llanuras — esta última ya tenía población sembrada pero le faltaba la propia entrada de región,
/// inconsistencia real); `hierba-del-hierro` (Meseta del Orden), `trepador-ocaso` (Ciénaga
/// Troncal) y `hielo-silice` (Cristal Helado) solo como documentación — ya estaban marcadas "fuera
/// del núcleo jugable actual" en su propio `condicion`/descripción, así que no llevan fila nueva
/// en `WorldPopulation` (añadir población ahí sería inventar contenido inalcanzable hoy).
/// Fuentes PASIVAS ligadas a una Location CONCRETA, no solo a su región (auditoría 2026-08-14,
/// petición explícita tras reiniciar partida: "los elementos pasivos deberían estar en zonas
/// concretas y específicas... los relacionados con Maktor que se encuentren en los restos de
/// Maktor... y el resto repartidos por las zonas donde más encaje" — bug real confirmado: al
/// reiniciar, "Brazalete trenzado del Clan Maktor"/"Pañuelo de luto Serhu"/"Tótem de clan roto"
/// salían ya en el PRIMER "Exploro la zona", en La Hondonada del Eco, sin ninguna relación real
/// con dónde vivió/cayó el Clan Maktor). El propio comentario original de estas dos fuentes
/// (2026-07-20) ya decía "ligadas a Location, no a fauna/flora" — nunca se llegó a construir esa
/// parte, solo la de región (`harvestSourceRegion` de abajo). `selectDiscoveries` (discovery.ts)
/// exige coincidencia EXACTA de `Location.slug` para cualquier fuente listada aquí, no solo de
/// región — a diferencia de `harvestSourceRegion`, que sigue siendo "en cualquier sitio de la
/// región". Las dos ubicaciones ya existían en el catálogo con nombre/descripción que encajan
/// solos: `restos-de-maktor` ("último asentamiento del Clan Maktor... antes de su aniquilación") y
/// `tumulos-del-honor` ("donde los clanes... entierran a quienes murieron con honor").
/// `string[]` (hallazgo 29b, revisar-partida-hallazgos.md 2026-09-07) — algunas fuentes viven de
/// verdad en más de una Location a la vez (misma corriente subterránea entre varios afloramientos,
/// o fauna errante entre 2 zonas concretas), y forzarlas a un único slug sería menos fiel que el
/// propio `ZonePoint` (que ya admite varias filas para la misma entidad, ej. Ruptidar en 6
/// Locations). `candidateFaunaFor` (cazar.ts) y `candidateSourcesFor` (recolectar.ts) comprueban
/// pertenencia, no igualdad exacta, así que ambas formas conviven sin caso especial.
export const harvestSourceHomeLocationSlug: Record<string, string | string[]> = {
  'restos-personales-maktor': 'restos-de-maktor',

  // Ampliación de lore 2026-08-21 — mismo criterio que arriba, ligado a Location concreta.
  'osario-de-la-manada': 'osario-de-la-manada',
  yerreo: 'hondonada-del-eco',
  gesgurio: 'hondonada-del-eco',
  'kirelon-arenoso': 'hondonada-del-eco',
  'lucre-blanco': 'pilares-rotos',
  'resina-lucre-blanco-fuente': 'pilares-rotos',
  'junba-verde': 'playa-de-ceniza-blanca',
  'junba-verde-resina-fuente': 'playa-de-ceniza-blanca',
  temune: 'playa-de-ceniza-blanca',
  'musgo-arcilla': 'pozo-cauce-viejo',
  'telda-comun': 'pozo-cauce-viejo',
  'resina-telda-fuente': 'pozo-cauce-viejo',
  // 'hojas-telda-fuente' quitado de aquí (2026-08-22, misma corrección que 'pasto-solar' arriba):
  // Hojas de Telda es la misma hoja para las 3 variantes de Telda (Común/Ceniza/Atardecer), pero
  // el candado a una única Location la dejaba indetectable en El Cruce de las Cenizas y ahora
  // también en La Sabana Alta — hueco real preexistente, no solo de esta pasada.
  guchapo: 'pozo-cauce-viejo',
  lebude: 'pozo-cauce-viejo',
  // Checklist consolidado 2026-08-27, P1.2 — bug real jugando en vivo (auditoría lore↔código,
  // 2026-08-23): Quio (Npc.homeLocationSlug ya lo tenía, línea ~1681) apareció narrado el mismo
  // Día 1 en Hondonada del Eco, Paso de los Pilares Rotos Y Los Manaderos — sin este candado en
  // la tabla que sí consulta la recolección/caza (distinta de `Npc.homeLocationSlug`, que solo
  // alimenta `detectNpcsInScene`), quedaba sin anclar a su zona real para desuello/caza.
  quio: 'manaderos',
  escorante: 'pozo-cauce-viejo',
  'telda-ceniza': 'cruce-de-las-cenizas',
  ferike: 'cruce-de-las-cenizas',
  boungo: 'osario-de-la-manada',
  'verdileas-acuaticas': 'manaderos',
  'chudos-rojizos': 'manaderos',
  'jusha-esmeralda': 'manaderos',
  miruina: 'manaderos',
  'tura-jusha': 'manaderos',
  // 'pasto-solar' quitado de aquí a propósito (2026-08-22, análisis de réplica): para un
  // `HarvestYield` PASIVO, esta entrada es un candado real de zona única en `discovery.ts`
  // (`selectDiscoveries`), no solo flavor — con él, Pasto Solar SOLO podía "descubrirse" en Los
  // Pastos de la Deriva pese a que su propia bio ya dice "la hierba base de TODA la llanura" y el
  // candidato #3 del checklist pedía justo confirmarlo en cualquier pradera/estepa (La Sabana Alta
  // entre ellas). Sin candado, cae en el filtro de región más permisivo del propio
  // `selectDiscoveries` (por `lugarOrigen`/región), que ya cubre toda Las Llanuras.
  gradias: 'pastos-de-la-deriva',
  'flor-salvatura': 'pastos-de-la-deriva',
  cuernahoja: 'pastos-de-la-deriva',
  volcanita: 'filo-de-las-brasas',
  rovalnica: 'filo-de-las-brasas',
  fercaneo: 'filo-de-las-brasas',

  // La Sabana Alta (zona 14, añadido 2026-08-22).
  'pasto-de-sangre': 'sabana-alta-colmillar',
  'telda-atardecer': 'sabana-alta-colmillar',
  'resina-telda-atardecer-fuente': 'sabana-alta-colmillar',
  'trigo-escarlata': 'sabana-alta-colmillar',
  'roca-luclara': 'sabana-alta-colmillar',
  towrgu: 'sabana-alta-colmillar',
  coracelo: 'sabana-alta-colmillar',

  // Múrgoles domados del propio campamento (2026-08-24, Grupo 3 § 27 recursos/materiales sin
  // receta) — a diferencia de la fauna salvaje de arriba, esta fuente vive dentro de la
  // empalizada, no en el mapa exterior.
  'murgoles-domados-campamento': 'campamento-serhu',

  // Hallazgo 29b (revisar-partida-hallazgos.md 2026-09-07, "ya me sale lo mismo en esas
  // habilidades que me salía en la Hondonada" al llegar a Los Pilares Rotos) — auditoría completa
  // del catálogo: `cazar.ts` nunca consultaba esta tabla en absoluto (solo `recolectar.ts` lo
  // hacía), así que NINGUNA de las 37 fichas de fauna cazable tenía candado real de Location, pese
  // a que 29 de ellas ya llevaban su propio `Npc.homeLocationSlug` (usado solo por `npcScene.ts`
  // hasta ahora). Bloque mecánico — mismo dato ya escrito en la ficha del Npc, solo trasladado
  // aquí para que `candidateFaunaFor` (cazar.ts, este mismo hallazgo) también lo respete.
  cruzavientos: 'pilares-rotos',
  'rondador-de-brasas': 'filo-de-las-brasas',
  'salamandra-de-escoria': 'filo-de-las-brasas',
  'jashil-verde': 'playa-de-ceniza-blanca',
  'jashil-rojo': 'playa-de-ceniza-blanca',
  toluh: 'playa-de-ceniza-blanca',
  'negueo-turquesa': 'playa-de-ceniza-blanca',
  'negueo-solar': 'playa-de-ceniza-blanca',
  'bulco-de-arena': 'playa-de-ceniza-blanca',
  'celubia-palida': 'acantilados-partidos',
  terkash: 'acantilados-partidos',

  // Bloque editorial — las 8 fichas de fauna que no tenían NINGÚN dato de ubicación (ni
  // `homeLocationSlug` ni `ZonePoint`), decidido caso por caso con la usuaria a partir del lore ya
  // escrito en cada bio, no inventado desde cero. `ruptidar` queda deliberadamente FUERA de este
  // bloque: su propia bio dice "presente en cualquier zona arenosa... no solo en un único punto",
  // ya bien representada por sus 6 `ZonePoint` reales — forzarla aquí sería menos fiel al lore que
  // dejarla en el filtro de región amplio, coherente con su propio texto.
  'aullador-rojo': 'pastos-de-la-deriva', // "sigue a las manadas de Corredores en migración" — mismas praderas sin asentamiento fijo donde migran los Corredores de Cauce
  // `zense-ceniza` queda FUERA a propósito, igual que Ruptidar (2026-09-07, tras verificar la
  // suite de integración real): es la fauna de prueba compartida en `cazar.integration.test.ts`
  // (4 describes, docenas de aserciones) precisamente por "sin `faunaTerrainTag` propio, pasa en
  // cualquier sitio" — coherente además con su propia bio ("carroñera errante... siempre en
  // círculos sobre lo que muere"), no tiene un hogar fijo real, mismo criterio que Ruptidar.
  canizor: 'restos-de-maktor', // "el Clan Maktor le debe su nombre a uno domado por su fundadora" — única Location real del clan en el catálogo
  'corredor-de-cauce': 'manaderos', // "aquí paren las hembras de Corredor de Cauce" (descripción de la propia Location) — Pozo Cauce Viejo ya saturado con 3 fichas sin relación
  'gargantua-de-ceniza': 'osario-de-la-manada', // esqueleto real de una Gargantúa muerta ya sembrado en esta Location — vínculo directo, no inferido
  corretolvas: 'yegr-kegi', // ya tenía ZonePoint real ahí (línea ~8780) — solo trasladado, sin decisión editorial nueva. Slug actualizado 2026-09-13 tras el rename a Yegr Kegi.
  murgol: 'oasis-de-chudos-rojos', // ya tenía ZonePoint real ahí (línea ~8699) — "ganado que abreva", coherente con agua en superficie

  // Bloque editorial — flora/mineral con pista de lore clara en su propia `description`
  // (`harvestSourceDescriptions`), decidido con la usuaria. `cardo-brujula`/`espiga-roja` quedan
  // deliberadamente FUERA (sin candado): ninguna pista real las distingue de la llanura genérica,
  // y mismo criterio que `pasto-solar`/`matorral-de-cuerno`/`hojas-telda-fuente` arriba — mejor sin
  // candado que uno inventado sin base.
  'arena-iman': 'agujas-iman', // mismo nombre, "limaduras que las tormentas dejan a sotavento de las rocas" — el propio campo de rocas magnéticas
  'bulbo-del-cauce': ['pozo-cauce-viejo', 'manaderos', 'oasis-de-chudos-rojos'], // "crece enterrado junto al Liquen del Cauce", misma corriente subterránea que aflora en los 3 puntos
  'liquen-del-cauce': ['pozo-cauce-viejo', 'manaderos', 'oasis-de-chudos-rojos'], // "crece allí donde el agua corre justo bajo la superficie" — mismos 3 afloramientos
  'flor-de-ceniza': 'fumarolas-negras', // "solo brota en suelo de ceniza volcánica" — la Location más volcánica del núcleo (grietas humeantes, vidrio volcánico)
  'raiz-de-fuego': 'fumarolas-negras', // "crece pegada a grietas volcánicas" — mismo motivo que Flor de Ceniza
  'salvia-del-polvo': 'hondonada-del-eco', // "crece pegada al suelo en hondonadas y rincones de sombra" — coincide con el propio nombre de la Location
};

export const harvestSourceRegion: Record<string, string> = {
  'arena-iman': 'Llanuras del Viento Rojo',
  'murgoles-domados-campamento': 'Llanuras del Viento Rojo',
  'aullador-rojo': 'Llanuras del Viento Rojo',
  'zense-ceniza': 'Llanuras del Viento Rojo',
  'bulbo-del-cauce': 'Llanuras del Viento Rojo',
  'cardo-brujula': 'Llanuras del Viento Rojo',
  // Corregido (2026-07-29, auditoría al asignar población): su propia descripción dice "se
  // hunden en el barro de la ciénaga" — no encaja con Llanuras pese a la instrucción general.
  // 5 fuentes CAZA sin entrada (auditoría de catálogo, 2026-08-13, hallazgo del agente de
  // recolección dejado fuera de su alcance explícito — cerrado ahora): mismo hueco que el resto
  // de esta tabla, misma región que ya tienen sembrada en `worldPopulation.ts` (`distribucion`).
  'canizor': 'Llanuras del Viento Rojo',
  cornante: 'Ciénaga Troncal',
  'corredor-de-cauce': 'Llanuras del Viento Rojo',
  corretolvas: 'Llanuras del Viento Rojo',
  cruzavientos: 'Llanuras del Viento Rojo',
  'espiga-roja': 'Llanuras del Viento Rojo',
  'espina-del-viento': 'Llanuras del Viento Rojo',
  'flor-de-ceniza': 'Llanuras del Viento Rojo',
  'gargantua-de-ceniza': 'Llanuras del Viento Rojo',
  // Fuera del núcleo jugable (2026-08-13) — su propia descripción/condicion lo dice: "laderas de
  // las montañas de Cristal Helado". Solo documentación, sin fila de `WorldPopulation`.
  'hielo-silice': 'Cristal Helado',
  // Fuera del núcleo jugable (2026-08-13) — condicion explícita: "Solo en la Meseta del Orden —
  // fuera del núcleo jugable actual". Solo documentación, sin fila de `WorldPopulation`.
  'hierba-del-hierro': 'Meseta del Orden',
  'liquen-del-cauce': 'Llanuras del Viento Rojo',
  'matorral-de-cuerno': 'Llanuras del Viento Rojo',
  murgol: 'Llanuras del Viento Rojo',
  'raiz-de-fuego': 'Llanuras del Viento Rojo',
  // Restos de Maktor (Location `restos-de-maktor`, ver `locations` arriba) tiene
  // region: 'Las Llanuras del Viento Rojo' — dentro del núcleo jugable, solo le faltaba esta fila.
  'restos-personales-maktor': 'Llanuras del Viento Rojo',
  'roca-pilares-rotos': 'Llanuras del Viento Rojo',
  'rondador-de-brasas': 'Llanuras del Viento Rojo',
  'salamandra-de-escoria': 'Llanuras del Viento Rojo',
  // Su condicion dice "los orcos de las Llanuras la conocen de niños" — mismo núcleo jugable.
  'salvia-del-polvo': 'Llanuras del Viento Rojo',
  // Única fauna/fuente CAZA fuera de Llanuras/Ciénaga — misma forma sin artículo que el resto de
  // este mapa (y que `distribucion` en `worldPopulation.ts`); su propia descripción dice "caza en
  // grupo en El Margen Silencioso".
  'sombra-de-kroj': 'Margen Silencioso',
  // Fuera del núcleo jugable (2026-08-13) — condicion explícita: "Solo en Ciénaga Troncal — fuera
  // del núcleo jugable actual". Solo documentación, sin fila de `WorldPopulation`.
  'trepador-ocaso': 'Ciénaga Troncal',
  // Misma formación rocosa que 'roca-pilares-rotos' (ya en Llanuras arriba) — le faltaba su propia
  // entrada aunque ya tuviera fila de `WorldPopulation` sembrada (inconsistencia real, 2026-08-13).
  'veta-hierro-pilares-rotos': 'Llanuras del Viento Rojo',

  // Ampliación de lore 2026-08-21 — todas las zonas cubiertas en esta pasada están dentro del
  // núcleo jugable, Llanuras del Viento Rojo.
  'osario-de-la-manada': 'Llanuras del Viento Rojo',
  'enredaderas-llanuras': 'Llanuras del Viento Rojo',
  yerreo: 'Llanuras del Viento Rojo',
  gesgurio: 'Llanuras del Viento Rojo',
  'kirelon-arenoso': 'Llanuras del Viento Rojo',
  'lucre-blanco': 'Llanuras del Viento Rojo',
  'resina-lucre-blanco-fuente': 'Llanuras del Viento Rojo',
  'junba-verde': 'Llanuras del Viento Rojo',
  'junba-verde-resina-fuente': 'Llanuras del Viento Rojo',
  temune: 'Llanuras del Viento Rojo',
  'musgo-arcilla': 'Llanuras del Viento Rojo',
  'telda-comun': 'Llanuras del Viento Rojo',
  'telda-ceniza': 'Llanuras del Viento Rojo',
  'resina-telda-fuente': 'Llanuras del Viento Rojo',
  'hojas-telda-fuente': 'Llanuras del Viento Rojo',
  guchapo: 'Llanuras del Viento Rojo',
  lebude: 'Llanuras del Viento Rojo',
  escorante: 'Llanuras del Viento Rojo',
  ferike: 'Llanuras del Viento Rojo',
  boungo: 'Llanuras del Viento Rojo',
  'verdileas-acuaticas': 'Llanuras del Viento Rojo',
  'chudos-rojizos': 'Llanuras del Viento Rojo',
  'jusha-esmeralda': 'Llanuras del Viento Rojo',
  miruina: 'Llanuras del Viento Rojo',
  'tura-jusha': 'Llanuras del Viento Rojo',
  'pasto-solar': 'Llanuras del Viento Rojo',
  gradias: 'Llanuras del Viento Rojo',
  'flor-salvatura': 'Llanuras del Viento Rojo',
  cuernahoja: 'Llanuras del Viento Rojo',
  volcanita: 'Llanuras del Viento Rojo',
  rovalnica: 'Llanuras del Viento Rojo',
  fercaneo: 'Llanuras del Viento Rojo',
  'pasto-de-sangre': 'Llanuras del Viento Rojo',
  'telda-atardecer': 'Llanuras del Viento Rojo',
  'resina-telda-atardecer-fuente': 'Llanuras del Viento Rojo',
  'trigo-escarlata': 'Llanuras del Viento Rojo',
  'roca-luclara': 'Llanuras del Viento Rojo',
  towrgu: 'Llanuras del Viento Rojo',
  coracelo: 'Llanuras del Viento Rojo',

  // Peces y marisco de Playa de Ceniza Blanca (zona 15, 2026-09-02, profesión "pescador") — todos
  // dentro de Las Llanuras del Viento Rojo, misma región que el resto de la costa.
  'jashil-verde': 'Llanuras del Viento Rojo',
  'jashil-rojo': 'Llanuras del Viento Rojo',
  toluh: 'Llanuras del Viento Rojo',
  'negueo-turquesa': 'Llanuras del Viento Rojo',
  'negueo-solar': 'Llanuras del Viento Rojo',
  'bulco-de-arena': 'Llanuras del Viento Rojo',
};

/// Categorías amplias de fuente recolectable (2026-08-15, petición explícita: "tener un enum con
/// todos los sourceCategory y sus sourceCategoryName... que lo que añadamos ahí sirva para poder
/// agrupar y añadir el value de la etiqueta que agrupa") — única fuente de verdad de qué categorías
/// existen y cómo se llaman en el front (`recolectar.ts` la usa para resolver el nombre a partir
/// de `HarvestYield.sourceCategory`, ya no se guarda el nombre repetido en cada fila). Extensible:
/// añadir una clave nueva aquí basta para dar de alta una categoría, sin tocar el resto del motor.
export const SOURCE_CATEGORY_NAMES = {
  mineral: 'Mineral',
  planta: 'Planta',
  fauna: 'Fauna',
  objeto: 'Objeto',
} as const;

export type SourceCategory = keyof typeof SOURCE_CATEGORY_NAMES;

/// Nombre legible de una categoría — el slug tal cual si no está en `SOURCE_CATEGORY_NAMES`
/// (nunca revienta por una clave nueva todavía sin registrar, mismo criterio "falla suave" que
/// `sourceDisplayNameFor` de abajo).
export function sourceCategoryNameFor(category: string): string {
  return (SOURCE_CATEGORY_NAMES as Record<string, string>)[category] ?? category;
}

/// Nombre legible de cada fuente flora/mineral/objeto SIN fila Npc propia (2026-08-15, hueco real
/// abierto al quitar `HarvestYield.sourceName`: ese campo antes doblaba como nombre individual de
/// la especie/mineral en la Enciclopedia — `buildFaunaFloraSection`, world.ts — Y como el texto
/// que registra el enlazador de narración clicable, `enciclopediaIndex.ts`). Las fuentes CON Npc
/// (fauna cazable, array `fauna` arriba) ya tienen su nombre real en `Npc.name`, no hace falta
/// repetirlo aquí. Los valores son los mismos `sourceName` que tenía cada fuente en `harvestYields`
/// antes de este cambio, solo movidos aquí.
export const harvestSourceDisplayName: Record<string, string> = {
  'murgoles-domados-campamento': 'Múrgoles domados',
  'arena-iman': 'Arena Imán',
  'bulbo-del-cauce': 'Bulbo del Cauce',
  'cardo-brujula': 'Cardo Brújula',
  cornante: 'Cornante',
  'espiga-roja': 'Espiga Roja',
  'espina-del-viento': 'Espina del Viento',
  'flor-de-ceniza': 'Flor de Ceniza',
  'hielo-silice': 'Hielo Sílice',
  'hierba-del-hierro': 'Hierba del Hierro',
  'liquen-del-cauce': 'Liquen del Cauce',
  'matorral-de-cuerno': 'Matorral de Cuerno',
  'raiz-de-fuego': 'Raíz de Fuego',
  'restos-personales-maktor': 'Restos personales de Maktor',
  // Renombrada de "Roca de Los Pilares Rotos" (2026-09-02, zona 15 del repaso "Playa de Ceniza
  // Blanca") — el nombre atado a un sitio concreto no encajaba al generalizar la fuente a varias
  // zonas de la región; slug sin tocar.
  'roca-pilares-rotos': 'Roca de Llanura Roja',
  'salvia-del-polvo': 'Salvia del Polvo',
  'sombra-de-kroj': 'Sombra de Kroj',
  'trepador-ocaso': 'Trepador Ocaso',
  // Renombrada de "Veta de hierro de Los Pilares Rotos" (2026-09-06, bug real jugando en vivo) —
  // mismo criterio que 'roca-pilares-rotos' arriba: es hierro corriente de toda la llanura, no
  // exclusivo de esta Location; slug sin tocar.
  'veta-hierro-pilares-rotos': 'Veta de Hierro de las Llanuras Rojas',

  // Flora/mineral añadida 2026-08-23 (auditoría lore↔código, tabla desactualizada desde
  // 2026-08-03) — nombres reales tomados del `ItemCatalogInput` correspondiente en `items` arriba.
  boungo: 'Boungo',
  'enredaderas-llanuras': 'Enredaderas de las Llanuras',
  fercaneo: 'Fercaneo',
  'flor-salvatura': 'Flor Salvatura',
  gradias: 'Gradias',
  'hojas-telda-fuente': 'Hojas de Telda',
  'chudos-rojizos': 'Chudos Rojizos',
  'lucre-blanco': 'Lucre Blanco',
  'junba-verde': 'Junba Verde',
  'junba-verde-resina-fuente': 'Junba Verde',
  temune: 'Temune',
  'musgo-arcilla': 'Musgo Arcilla',
  'pasto-de-sangre': 'Pasto de Sangre',
  'pasto-solar': 'Pasto Solar',
  'resina-lucre-blanco-fuente': 'Resina de Lucre Blanco',
  'resina-telda-atardecer-fuente': 'Resina de Telda Atardecer',
  // Corregido 2026-09-04 (auditoría estática lore↔código, cuelgue de Ollama) — el ItemCatalog real
  // que da esta fuente se llama "Resina Telda Gris" (worldCatalog.ts, cerca de Telda Común/Ceniza),
  // no "Resina de Telda" a secas; este display name sí llega al jugador (Enciclopedia, ZonePoint).
  'resina-telda-fuente': 'Resina Telda Gris',
  'roca-luclara': 'Roca Luclara',
  rovalnica: 'Rovalnica',
  'telda-atardecer': 'Telda Atardecer',
  'telda-ceniza': 'Telda Ceniza',
  'telda-comun': 'Telda Común',
  'trigo-escarlata': 'Trigo Escarlata',
  'verdileas-acuaticas': 'Verdileas Acuáticas',
  volcanita: 'Volcanita',
  yerreo: 'Yerreo',
};

/// Nombre real de una fuente (2026-08-15) — helper compartido para no repetir el mismo fallback
/// (Npc.name si existe, si no `harvestSourceDisplayName`, si no el slug tal cual) en cada sitio que
/// antes leía `HarvestYield.sourceName` directamente (harvest.ts, entityDiscovery.ts,
/// imagePromptContext.ts, world.ts). `npcName` lo pasa el caller si ya tiene el Npc a mano (evita
/// una consulta redundante); null/undefined si la fuente no tiene fila Npc propia.
export function sourceDisplayNameFor(sourceSlug: string, npcName?: string | null): string {
  return npcName ?? harvestSourceDisplayName[sourceSlug] ?? sourceSlug;
}

export const harvestSourceDescriptions: Record<string, string> = {
  'murgoles-domados-campamento':
    'El pequeño recinto de múrgoles domados dentro de la empalizada del Campamento del Clan Serhu — de las pocas cosas que el clan produce sin cazar ni recolectar.',
  'arena-iman':
    'Limaduras oscuras y finas que las tormentas de arena magnética dejan acumuladas a sotavento de las rocas, brillo metálico apagado bajo el sol, se pegan a cualquier hoja de metal cercana.',
  'bulbo-del-cauce':
    'Tubérculo fibroso de piel parda y pulpa acuosa, crece enterrado junto al Liquen del Cauce — comida y un trago de agua en una misma pieza.',
  'cardo-brujula':
    'Cardo espinoso de tallo rígido y flor cerrada de un gris metálico apagado, con una única fibra central imantada que, colgada de un hilo, siempre señala el mismo rumbo.',
  'cornante':
    'Criatura de cuatro patas, corpulenta y de gran tamaño, cornamenta ancha y ramificada, pelaje oscuro y empapado, pisadas pesadas que se hunden en el barro de la ciénaga.',
  'espiga-roja':
    'Cereal silvestre de espigas del mismo rojo ocre que la tierra de la llanura, tallos finos que se doblan al viento en oleadas visibles desde lejos.',
  'espina-del-viento':
    'Criatura del desierto de apenas un metro de altura, caparazón quitinoso de un rojizo oxidado que imita las dunas rojas que lo rodean — pequeñas protuberancias en el caparazón parecen cristales de arena roja calcificada. La cola segmentada se arquea alta, rematada en un saco de veneno translúcido y pulsante con forma de punta de flecha. Se entierra a medias en la arena fina, invisible hasta que ataca, casi siempre durante una tormenta de arena magnética — entre los surcos de arena cercanos a veces se ven ejemplares más pequeños construyendo sus propios nidos.',
  'flor-de-ceniza':
    'Flor pequeña de pétalos grises translúcidos, casi cenicientos, que solo brota en suelo de ceniza volcánica — su infusión adormece el dolor.',
  // Otras regiones de Berig (2026-07-22) — fuera del núcleo jugable actual.
  'hielo-silice':
    'Mineral de un blanco azulado translúcido que se encuentra en las laderas de las montañas de Cristal Helado, frío al tacto y duro como el pedernal — no se forja, se talla.',
  'hierba-del-hierro':
    'Hojas grisáceas de bordes duros como el metal, ricas en vetas minerales visibles a contraluz — crece en la Meseta del Orden, materia prima de las aleaciones goirntes.',
  'liquen-del-cauce':
    'Musgo húmedo de un verde apagado casi gris, crece en parches allí donde el agua corre justo bajo la superficie — masticado deja un regusto mineral y calma la sed.',
  'matorral-de-cuerno':
    'Arbusto bajo de madera oscura y retorcida en espirales como cuernos entrelazados, corteza agrietada y reseca — la única leña de verdad en la llanura abierta.',
  'raiz-de-fuego':
    'Enredadera parásita de tallos oscuros y nudosos que crece pegada a grietas volcánicas, acumulando calor en su interior hasta un punto crítico — perturbada sin cuidado, libera un gas inflamable con un chasquido seco.',
  'restos-personales-maktor':
    'Objetos personales medio enterrados entre los cimientos quemados de Los Restos de Maktor — cuero ennegrecido, hueso tallado, todo cubierto de una fina capa de ceniza vieja.',
  'roca-pilares-rotos':
    'Bloques y cascotes de roca rojiza, erosionados por el viento y el paso del tiempo — superficie áspera, veteada de ocre y gris, típica de toda la Llanura Roja.',
  'salvia-del-polvo':
    'Mata baja de hojas grises apagadas y aroma amargo, crece pegada al suelo en hondonadas y rincones de sombra — machacada entre los dedos suelta un jugo oscuro que corta hemorragias.',
  'sombra-de-kroj':
    'Criatura voladora mediana de plumaje gris ceniza y vuelo absolutamente silencioso, ojos oscuros y fijos — caza en grupo en El Margen Silencioso devolviendo, como un eco retrasado, los pasos y la respiración de sus presas.',
  'trepador-ocaso':
    'Árbol oscuro de corteza casi negra que rezuma una resina densa de vetas doradas al partirla — forma la mayor parte de la Ciénaga Troncal.',
  'veta-hierro-pilares-rotos':
    'Vetas oscuras de óxido rojizo visibles entre las grietas de la roca erosionada de Los Pilares Rotos — hay que picar de verdad para sacar la mena, no basta con recoger cascotes sueltos.',

  // Flora/mineral añadida 2026-08-23 (auditoría lore↔código, tabla desactualizada desde
  // 2026-08-03) — descripciones adaptadas de la `description` real del `ItemCatalogInput`
  // correspondiente en `items` arriba, sin inventar datos nuevos.
  boungo:
    'Seta de sombrero marrón oscuro con manchas rojas, tallo fino beis, aspecto seco — crece en otoño en El Osario de la Manada, en cúmulos apretados.',
  'enredaderas-llanuras':
    'Tallos fibrosos de enredaderas que trepan por sombra en la Hondonada del Eco y la base de Los Pilares Rotos.',
  fercaneo:
    'Mineral casi imposible de encontrar, solo cerca de cráteres y lava en El Filo de las Brasas —más probable en Las Fumarolas Negras—, protegido por las propias Salamandras de Escoria.',
  'flor-salvatura':
    'Planta negra de aspecto muerto con pétalos verdes de tono azulado — ingrediente base de alquimia para varias pociones curativas.',
  gradias:
    'Arbusto de ramas fibrosas y hojas anchas que sueltan toda su agua acumulada al triturarlas.',
  'hojas-telda-fuente':
    'Hojas grandes de los árboles Telda, de 30 a 50 cm — la misma hoja para Telda Común, Telda Ceniza y Telda Atardecer, solo cambian tronco y resina entre variantes.',
  'chudos-rojizos':
    'Chudos rojizos de las charcas de Los Manaderos, tallos de 80 cm a 1,2 m — material de tejido y techado.',
  'lucre-blanco':
    'Árbol de tronco claro y madera muy resistente que crece en las cumbres de Los Pilares Rotos.',
  'junba-verde':
    'Árbol de tronco claro como la arena, rematado en una maraña de lianas y hojas de un verde intenso que le da forma de seta — 3 m de tronco, hasta 3,50 m contando el copete de lianas.',
  'junba-verde-resina-fuente':
    'Resina verde intensa que rezuma de las lianas de Junba Verde — pegajosa, de olor dulzón.',
  temune:
    'Algas anchas de color verde tirando a marrón, arrancadas por la corriente y varadas en la orilla, terminadas en bulbos rellenos de semillas — muchas curvas en toda su longitud.',
  'musgo-arcilla':
    'Musgo rojo como pelaje, crece pegado a la roca en zonas húmedas de El Pozo de Cauce Viejo — material de construcción para tejados orcos.',
  'pasto-de-sangre':
    'Hierba roja de La Sabana Alta, más alta y densa que el Pasto Solar del que desciende — el tono rojo viene de la mineralización, también roja, del agua de la zona.',
  'pasto-solar':
    'Hierba amarilla, el pasto base de toda la llanura allí donde crece vegetación.',
  'resina-lucre-blanco-fuente':
    'Resina blanca translúcida que exuda el árbol de Lucre Blanco — pegamento muy resistente.',
  'resina-telda-atardecer-fuente':
    'Resina roja que exuda el árbol de Telda Atardecer, más fina que la Resina Telda Gris común, propia de La Sabana Alta.',
  'resina-telda-fuente':
    'Resina gris que exudan los árboles Telda, Común o Ceniza — pegamento de uso general.',
  'roca-luclara':
    'Piedra clara, casi blanca, similar al mármol — los Towrgu excavan en ella sus propios nidos, material de construcción de tier alto.',
  rovalnica:
    'Roca de construcción negra con vetas rojas, de El Filo de las Brasas.',
  'telda-atardecer':
    'Árbol de la misma especie que la Telda Común y la Telda Ceniza, pero de tronco y hojas de tonos rojos — la mejor madera de las variantes de Telda, propia de La Sabana Alta.',
  'telda-ceniza':
    'Árbol Telda de El Cruce de las Cenizas, misma especie y mismo recurso que la Telda Común de El Pozo de Cauce Viejo.',
  'telda-comun':
    'Árbol de madera clara que crece en El Pozo de Cauce Viejo.',
  'trigo-escarlata':
    'Espigas de un rojo intenso que crecen salvajes en La Sabana Alta, base para harinas — los orcos de las Llanuras nunca han logrado cultivarlo de verdad.',
  'verdileas-acuaticas':
    'Alga de Los Manaderos, base de la cadena trófica de la charca — alimento de la Jusha Esmeralda.',
  volcanita:
    'Mineral volcánico de El Filo de las Brasas, la veta más común de la zona.',
  yerreo:
    'Mineral con la apariencia del hierro pero de vetas rojas y brillos anaranjados, muy difícil de encontrar y en cantidades mínimas donde aparece, en La Hondonada del Eco.',
};

/// Afinidad de terreno de cada fuente EXTRACCION/MINERIA/TALA (filtro por zona, ver `terrain.ts`)
/// — una sola etiqueta por fuente, leída de su propia `harvestSourceDescriptions`/`condicion` de
/// arriba. `undefined` (fuente no listada aquí) = sin afinidad marcada, nunca se filtra por
/// terreno (mismo criterio "solo premia, nunca penaliza" de `attributeWheel.ts`).
export const harvestSourceTerrainTag: Record<string, TerrainTag> = {
  'cardo-brujula': 'arido',
  'bulbo-del-cauce': 'humedo',
  'liquen-del-cauce': 'humedo',
  'espiga-roja': 'vegetacion',
  'flor-de-ceniza': 'rocoso',
  'salvia-del-polvo': 'arido',
  'raiz-de-fuego': 'rocoso',
  'arena-iman': 'arido',
  // Generalizada de 'rocoso' a 'arido' (2026-09-02, zona 15 del repaso) — piedra rojiza suelta,
  // no formación rocosa vertical; con 'arido' aparece también en Playa de Ceniza Blanca y el
  // resto de zonas áridas de la región, coherente con el mismo criterio ya aplicado a Ruptidar.
  'roca-pilares-rotos': 'arido',
  'veta-hierro-pilares-rotos': 'rocoso',
  'matorral-de-cuerno': 'vegetacion',
  // Fuera del núcleo jugable hoy (ver harvestSourceRegion) — tagueadas igual por completitud, sin
  // efecto real hasta que esas regiones tengan Locations jugables catalogadas.
  'hierba-del-hierro': 'rocoso',
  'trepador-ocaso': 'humedo',
  // Añadidas 2026-08-22 al aplicar el análisis de réplica entre zonas (checklist, "NO replicar sin
  // más"): sin `WorldPopulation` propio hasta ahora (bug real encontrado y corregido en la misma
  // pasada, ver worldPopulation.ts), así que nunca habían llegado a filtrarse por terreno. Sin esta
  // etiqueta, en cuanto tuvieran población pasarían a aparecer en TODA la región (comportamiento
  // por defecto sin tag) — justo lo contrario de "deliberadamente único de su zona".
  yerreo: 'rocoso', // mismo tag que su Location (Hondonada del Eco); no hay categoría más fina
  // que la aísle del resto de zonas rocosas — imprecisión conocida, no bloqueante (ver checklist).
  volcanita: 'volcanico', // Filo de las Brasas / Fumarolas Negras, ver locationTerrainTags
  rovalnica: 'volcanico',
  fercaneo: 'volcanico',
  'lucre-blanco': 'rocoso', // Los Pilares Rotos (altas cumbres)
  'resina-lucre-blanco-fuente': 'rocoso',
  // homeLocationSlug ya candado exacto a Playa de Ceniza Blanca — 'costero' es solo informativo,
  // Location.terrainTags de la playa no lo incluye (['humedo','arido']), así que este tag nunca
  // interviene en el filtro real (ver comentario de pasaFiltroTerreno, terrain.ts).
  'junba-verde': 'costero',
  'junba-verde-resina-fuente': 'costero',
  temune: 'costero',
  'telda-comun': 'humedo', // El Pozo de Cauce Viejo
  // Telda Ceniza es la misma especie que Telda Común con corteza distinta (El Cruce de las
  // Cenizas) — comparte resina/hojas con ella, mismo tag por coherencia (Cruce de las Cenizas no
  // tiene locationTerrainTags propio todavía, así que hoy no filtra de todos modos).
  'telda-ceniza': 'humedo',
  'resina-telda-fuente': 'humedo',
  'flor-salvatura': 'vegetacion', // Los Pastos de la Deriva
  // La Sabana Alta (zona 14, añadido 2026-08-22).
  'telda-atardecer': 'vegetacion',
  'resina-telda-atardecer-fuente': 'vegetacion',
  'roca-luclara': 'arido', // pradera árida, no rocosa — misma imprecisión conocida que 'yerreo'

  // Flora/mineral añadida 2026-08-23 (auditoría lore↔código, tabla desactualizada desde
  // 2026-08-03) — mismo tag que otras fuentes ya ancladas al mismo `homeLocationSlug`
  // (`harvestSourceHomeLocationSlug` arriba) vía `locationTerrainTags`. Skips documentados en el
  // resumen de la tarea: 'boungo' (osario-de-la-manada, sin fila en locationTerrainTags ni
  // precedente), 'enredaderas-llanuras' y 'hojas-telda-fuente' (sin homeLocationSlug fijo a
  // propósito, ver comentario junto a esa tabla) y 'pasto-solar' (candado quitado a propósito
  // 2026-08-22, ver mismo sitio).
  gradias: 'vegetacion', // Los Pastos de la Deriva, mismo tag que flor-salvatura/cuernahoja
  'chudos-rojizos': 'humedo', // Los Manaderos
  'musgo-arcilla': 'humedo', // El Pozo de Cauce Viejo, mismo tag que telda-comun/resina-telda-fuente
  'pasto-de-sangre': 'vegetacion', // La Sabana Alta
  'trigo-escarlata': 'vegetacion', // La Sabana Alta
  'verdileas-acuaticas': 'humedo', // Los Manaderos
};

/// Género de flora (2026-09-04, ver docs/rpgtarkor/lore-mundo/genesis.md § Florial/Tarkor y
/// floraCategoria.ts para el diseño completo) — asignación inicial de las 25 fuentes de flora ya
/// existentes al cerrar el sistema. Las resinas comparten género con su árbol/planta de origen
/// (misma especie, dos productos). Solo 2 casos BROTES_SALVAJES por ahora (Raíz de Fuego, Cardo
/// Brújula) — ambos ya tenían una propiedad físicamente imposible en su bio sin categorizar antes.
export const harvestSourceFloraCategoria: Record<string, FloraCategoria> = {
  // VELDRIAS — árboles con madera + resina emparejada.
  'telda-comun': 'VELDRIAS',
  'telda-ceniza': 'VELDRIAS',
  'telda-atardecer': 'VELDRIAS',
  'resina-telda-fuente': 'VELDRIAS',
  'resina-telda-atardecer-fuente': 'VELDRIAS',
  'hojas-telda-fuente': 'VELDRIAS',
  'lucre-blanco': 'VELDRIAS',
  'resina-lucre-blanco-fuente': 'VELDRIAS',
  'junba-verde': 'VELDRIAS',
  'junba-verde-resina-fuente': 'VELDRIAS',
  // ZARCOS — arbustos de leña sin resina propia.
  'matorral-de-cuerno': 'ZARCOS',
  // HELDRAS — hierbas/pastos base, variantes regionales por mineralización.
  'pasto-solar': 'HELDRAS',
  'pasto-de-sangre': 'HELDRAS',
  // GRANOLES — cereales silvestres.
  'trigo-escarlata': 'GRANOLES',
  'espiga-roja': 'GRANOLES',
  // TRENIAS — fibra para tejido/cordaje (no pasto).
  'enredaderas-llanuras': 'TRENIAS',
  gradias: 'TRENIAS',
  'chudos-rojizos': 'TRENIAS',
  // MARELAS — algas de costa/charca.
  temune: 'MARELAS',
  'verdileas-acuaticas': 'MARELAS',
  // BULVIAS — raíces/tubérculos de agua.
  'bulbo-del-cauce': 'BULVIAS',
  // MUSCARIAS — líquenes/musgos, cobertura de superficie sin tallo propio.
  'liquen-del-cauce': 'MUSCARIAS',
  'musgo-arcilla': 'MUSCARIAS',
  // SALVIRAS — flores/plantas de alquimia y curación de campo.
  'flor-de-ceniza': 'SALVIRAS',
  'flor-salvatura': 'SALVIRAS',
  'salvia-del-polvo': 'SALVIRAS',
  // FONGARES — setas.
  boungo: 'FONGARES',
  // VETRIAS — flora con mineral real incrustado en su propia estructura.
  'hierba-del-hierro': 'VETRIAS',
  // BROTES_SALVAJES — flora normal mutada por la magia Salvaje, especie base real reconocible con
  // algo imposible ya en su bio.
  'raiz-de-fuego': 'BROTES_SALVAJES', // acumula calor volcánico hasta el punto de inflamarse
  'cardo-brujula': 'BROTES_SALVAJES', // fibra imantada que siempre señala el mismo rumbo
  // Trepador Ocaso (Ciénaga Troncal, fuera del núcleo jugable) queda sin asignar todavía — sin
  // suficiente lore propio para decidir entre VELDRIAS (árbol con resina) y BROTES_SALVAJES (la
  // resina de vetas doradas podría o no ser mágica) hasta que se repase esa región.
};

/// Afinidad de hábitat de cada especie cazable (filtro por zona, ver `terrain.ts`) — leída de su
/// propia `bio` en el array `fauna` de arriba. Especies sin terreno claro en su bio (aéreas,
/// itinerantes, o ligadas al comportamiento más que al suelo) se dejan fuera del diccionario:
/// nunca se penalizan, se ven en cualquier zona de la región igual que hoy.
export const faunaTerrainTag: Record<string, TerrainTag> = {
  // Cambiado de 'arido' a 'vegetacion' (auditoría de lore fauna/flora, 2026-08-22): su propia bio
  // dice "Sigue a las manadas de Corredores de Cauce en migración, cobrándose a los rezagados"
  // (mismo texto en flora-fauna.md) — con 'arido' nunca coincidía con Corredor de Cauce, que el
  // comentario de abajo ya retaggeó a 'vegetacion' justo para anclar su corredor migratorio real
  // (Los Manaderos → Los Pastos de la Deriva → La Sabana Alta). Sin este cambio, el depredador y
  // la única presa que la propia ficha le atribuye casi nunca aparecían en la misma zona.
  'aullador-rojo': 'vegetacion',
  // Cambiado de 'humedo' a 'vegetacion' (2026-08-22, análisis de réplica entre zonas): con
  // 'humedo' aparecía en zonas costeras sin ninguna conexión de lore (Playa de Ceniza Blanca,
  // Acantilados Partidos, Pozas de Marea, Embarcadero de Ceniza) y NO aparecía en La Sabana Alta,
  // pese a que areas.md la describe explícitamente como "refugio y coto de caza de manadas de
  // Corredores de Cauce que no se ven en otras zonas del núcleo". 'vegetacion' ancla de verdad el
  // corredor migratorio real: Los Manaderos (nacen) → Los Pastos de la Deriva (pastan) → La
  // Sabana Alta (refugio/caza) — las 3 únicas Locations con ese tag hoy.
  'corredor-de-cauce': 'vegetacion',
  corretolvas: 'vegetacion',
  cruzavientos: 'rocoso', // anida en Los Pilares Rotos
  // Cambiado de 'rocoso' a 'vegetacion' (2026-09-02, corredor migratorio real, decisión explícita
  // de la usuaria) — 'rocoso' no tenía ningún comentario que lo justificara y no encajaba con
  // ninguna zona de pasto amplio; mismo tag y mismas 3 Locations que Corredor de Cauce/Aullador
  // Rojo (Los Manaderos → Los Pastos de la Deriva → La Sabana Alta), coherente con flora-fauna.md
  // ("las Terk'ikar logran que transporten comunidades enteras en migraciones estacionales").
  'gargantua-de-ceniza': 'vegetacion',
  murgol: 'vegetacion',
  'salamandra-de-escoria': 'rocoso', // homeLocationSlug: filo-de-las-brasas
  // Añadido 2026-08-22 (análisis de réplica): sin tag aparecía en TODA la región (playas
  // incluidas) pese a que su propia bio ya dice "presente en cualquier zona arenosa" — 'arido' es
  // justo esa etiqueta, cubre Hondonada del Eco, Pilares Rotos, Restos de Maktor, Túmulos del
  // Honor, Filo de las Brasas, Sabana Alta, Paso de los Huesos, Dunas Ahogadas, Vientre del
  // Engaño, Fosa Horadada, Campo Yermo — exactamente "cualquier zona arenosa", sin inventar nada.
  ruptidar: 'arido',
  // La Sabana Alta (zona 14, añadido 2026-08-22).
  towrgu: 'vegetacion',
  coracelo: 'vegetacion',

  // Fauna añadida 2026-08-23 (auditoría lore↔código, tabla desactualizada desde 2026-08-03) —
  // mismo tag que otras fuentes ya ancladas al mismo `homeLocationSlug` (Npc.homeLocationSlug o
  // `harvestSourceHomeLocationSlug` arriba) vía `locationTerrainTags`. Skip documentado en el
  // resumen de la tarea: 'canizor' (fiera solitaria e itinerante, sin homeLocationSlug fijo).
  gesgurio: 'rocoso', // La Hondonada del Eco, mismo tag que yerreo
  'kirelon-arenoso': 'rocoso', // La Hondonada del Eco
  ferike: 'humedo', // El Cruce de las Cenizas, mismo tag que telda-ceniza (sin locationTerrainTags
  // propio todavía, ver comentario de harvestSourceTerrainTag — mismo criterio de "coherencia" ya
  // aplicado ahí)
  guchapo: 'humedo', // El Pozo de Cauce Viejo, mismo tag que telda-comun/musgo-arcilla
  lebude: 'humedo',
  escorante: 'humedo',
  'jusha-esmeralda': 'humedo', // Los Manaderos
  miruina: 'humedo',
  quio: 'humedo',
  'tura-jusha': 'humedo',
  cuernahoja: 'vegetacion', // Los Pastos de la Deriva, mismo tag que flor-salvatura/gradias
  imanio: 'rocoso', // Las Agujas Iman (formación rocosa, ver bio: "armadura de rocas imantadas")
  nuente: 'rocoso', // Las Agujas Iman, mismo territorio que su presa (Imanio)
};

/// Momento del día real en que cada especie está activa (2026-09-02, fauna diurna/nocturna real —
/// ver `momentoDelDiaFor`, worldClock.ts) — leído de su propia `bio` en el array `fauna` de
/// arriba, mismo criterio exacto que `faunaTerrainTag`: solo entran las especies cuya bio describe
/// un comportamiento diurno/nocturno explícito y sin ambigüedad, el resto se deja fuera del
/// diccionario y nunca se filtra por hora (sin dato = sin filtrar, igual que terreno/estación/clima
/// en toda esta zona del catálogo).
export const faunaMomentoDelDia: Record<string, MomentoDelDia> = {
  // "Pasa el día bajo tierra descansando; solo emerge de noche o con temperaturas bajas a cazar".
  'kirelon-arenoso': 'noche',
  // "Solo sale de noche; caza Imanios".
  nuente: 'noche',
  // "Roedor nocturno... Caza en manada de noche... De día amplía sus madrigueras bajo el agua...
  // no soportan la luz del día".
  miruina: 'noche',
  // "Carroñero-cazador nocturno... Ronda el borde de la luz de un campamento durante horas".
  'rondador-de-brasas': 'noche',
  // Marca territorio "con aullidos largos al caer la noche"; habilidad racial Cazador nocturno:
  // "Ve y se mueve mejor de noche, cuando caza de verdad".
  canizor: 'noche',
  // "Caza de día, especializada en crías de Jusha desorientadas" — único candidato DIURNO de los
  // 6, incluido a propósito (bio igual de explícita que el resto, aunque el matiz sea más suave).
  'tura-jusha': 'dia',
};

/// Grupo 3 § Mundo determinista (docs/rpgtarkor/lore-mundo/mundo-determinista.md, 2026-08-25) — Capa 1: zonas
/// navegables, PROTOTIPO en una sola zona (La Hondonada del Eco, `hondonada-del-eco`) antes de
/// repetir en el resto — mismo criterio que el Mapa de Cristal Helado ("un nodo a la vez"). Los 3
/// elementos reales ya documentados de esta zona (`harvestSourceHomeLocationSlug` arriba: yerreo/
/// gesgurio/kirelon-arenoso, los únicos 3 con `homeLocationSlug: 'hondonada-del-eco'`).
///
/// Posiciones PROVISIONALES (lienzo 800×600 de referencia, sin PNG real generado todavía) — a
/// recalibrar a mano contra la imagen real en cuanto exista, mismo proceso que ya se usó para
/// Cristal Helado. Distribuidas según la propia bio de cada especie: el Kirelon Arenoso emerge de
/// bocas de cueva en las paredes ("varias bocas de cueva abriéndose... a distintas alturas"), el
/// Gesgurio se camufla contra las paredes de arcilla, el Yerreo es una veta mineral en la roca.
export interface ZonePointInput {
  locationSlug: string;
  x: number;
  y: number;
  // 'EDIFICIO' añadido (ampliación 2026-08-31, Las Llanuras del Viento Rojo zona por zona): ya
  // existía en el motor (schema.prisma ZonePointTipo, zonePoints.ts, zona.ts) para asentamientos
  // reales, pero el tipo de datos de este archivo se había quedado corto — solo faltaba aquí.
  tipo: 'FAUNA' | 'RECURSO' | 'NPC' | 'EDIFICIO';
  targetSlug: string;
  label?: string;
  // Sistema de plantillas de movimiento (2026-09-17, services/movementTemplates.ts) — nombre de
  // una plantilla ESPECÍFICA curada a mano (`SPECIFIC_MOVEMENT_TEMPLATES`), reutilizable entre
  // varios ZonePoint a la vez. Omitido = usa la plantilla GENERAL inferida en tiempo real del lore
  // del Npc (faunaCategoria/temperamento/role/kind/medio) — nunca queda sin ninguna asignada.
  plantillaEspecifica?: string;
}

export const zonePoints: ZonePointInput[] = [
  { locationSlug: 'hondonada-del-eco', x: 620, y: 180, tipo: 'FAUNA', targetSlug: 'kirelon-arenoso', label: 'Boca de cueva (Kirelon Arenoso)' },
  { locationSlug: 'hondonada-del-eco', x: 260, y: 340, tipo: 'FAUNA', targetSlug: 'gesgurio', label: 'Pared de arcilla (Gesgurio)' },
  { locationSlug: 'hondonada-del-eco', x: 400, y: 470, tipo: 'RECURSO', targetSlug: 'yerreo', label: 'Veta de Yerreo' },
  // Franja 3 de "Interactuar" (2026-09-08) — el "perseguidor sin nombrar" de Gistera Koh
  // (`orco-enfurecido-hondonada`, mecanismo de inyección determinista en escena, turnResolution.ts
  // § PURSUER_REFERENCE_REGEX) no tenía ningún ZonePoint real hasta ahora — con el gate de
  // colisión de celda nuevo, un agresivo sin ZonePoint nunca fuerza combate. Posición coherente con
  // su propia bio ("duerme y merodea en la Hondonada del Eco, donde el terreno hundido le permite
  // ver llegar a cualquiera antes de que lo vean a él") — borde superior del lienzo, punto de
  // vigilancia elevado, distinto de la cueva del Kirelon y la pared del Gesgurio.
  { locationSlug: 'hondonada-del-eco', x: 400, y: 130, tipo: 'NPC', targetSlug: 'orco-enfurecido-hondonada', label: 'Punto de vigilancia (Orco Enfurecido)' },
  // Gistera Koh (2026-09-08, misma pieza) — aunque `faction: null` significa que nunca puede
  // desplazarse a AGRESIVO/ENEMIGO (así que el gate de combate no la necesitaba), la usuaria pidió
  // explícitamente que TODO tenga ZonePoint real: sin posición propia, tampoco tendría celda real
  // en el sistema de cuadrícula — jamás podría colisionar/dar aviso de Interactuar, ni aparecer en
  // el punto correcto del mapa (solo asignación dinámica aleatoria la primera vez que aparece en
  // escena). Escondida del Orco Enfurecido — punto resguardado, lejos de su vigilancia elevada.
  { locationSlug: 'hondonada-del-eco', x: 220, y: 500, tipo: 'NPC', targetSlug: 'gistera-koh', label: 'Refugio oculto (Gistera Koh)' },

  // ══════════════════════════════════════════════════════════════════════════
  // Ampliación 2026-08-31 — resto de Las Llanuras del Viento Rojo (27 Locations, todo el núcleo
  // jugable salvo Hondonada del Eco, ya sembrada arriba). Mismo criterio que el prototipo: cruce
  // categórico Location↔terreno (`locationTerrainTags`/`faunaTerrainTag`/`harvestSourceTerrainTag`,
  // ver `terrain.ts`), NPC solo con nombre propio anclado por `homeLocationSlug`, EDIFICIO solo en
  // asentamientos con estructura real descrita en su `description`. Coordenadas PROVISIONALES
  // (lienzo 800×600, sin PNG real generado todavía para estas zonas) — mismo aviso que arriba.
  // ══════════════════════════════════════════════════════════════════════════

  // Las Agujas Imán — imanio/nuente tienen homeLocationSlug propio aquí; cardo-brujula/arena-iman
  // no tienen homeLocationSlug fijo en la tabla de recursos, pero la propia description de la
  // Location los nombra explícitamente ("a sotavento se acumula arena imán y crece el Cardo
  // Brújula") — match textual directo, no solo de terreno.
  { locationSlug: 'agujas-iman', x: 200, y: 160, tipo: 'FAUNA', targetSlug: 'imanio', label: 'Imanio bajo su coraza de rocas' },
  { locationSlug: 'agujas-iman', x: 560, y: 210, tipo: 'FAUNA', targetSlug: 'nuente', label: 'Nuente al acecho nocturno' },
  { locationSlug: 'agujas-iman', x: 380, y: 420, tipo: 'RECURSO', targetSlug: 'cardo-brujula', label: 'Cardo Brújula a sotavento' },
  { locationSlug: 'agujas-iman', x: 620, y: 480, tipo: 'RECURSO', targetSlug: 'arena-iman', label: 'Arena Imán acumulada' },

  // Karot Veku - Campamento del Clan Serhu. Múrgoles domados: recurso interior del propio
  // campamento, homeLocationSlug directo.
  //
  // "Trabajador de Reino" (2026-08-31) — el punto EDIFICIO de la empalizada dejó de apuntar a sí
  // mismo (anti-patrón: `targetSlug` = slug de la propia Location, sin catálogo real detrás).
  // Ahora referencia el `FactionBuilding` sede real (`ketg-sedsar`, ver más abajo — renombrado de
  // `ketg-lukar` el 2026-09-13, ver comentario junto a su definición). Torgash/Ulkha se mudan al
  // interior (viven en el Ketg'sedsar de verdad, coherente con su lore — "reciben a quien cruza la
  // entrada") — sus puntos NPC pasan a `campamento-serhu-interior`.
  { locationSlug: 'campamento-serhu', x: 400, y: 300, tipo: 'EDIFICIO', targetSlug: 'ketg-sedsar', label: 'Ketg\'sedsar — el Salón del Colmillo Ceniza' },
  { locationSlug: 'campamento-serhu', x: 400, y: 460, tipo: 'RECURSO', targetSlug: 'murgoles-domados-campamento', label: 'Recinto de múrgoles domados' },
  // Cazadora Serhu (hallazgo 4, 2026-09-15): único NPC con homeLocationSlug en el exterior de
  // Karot Veku sin ZonePoint — "sale a cazar o vigilar los alrededores del campamento" (bio real),
  // coherente con estar fuera de la empalizada en vez de en el interior con los demás.
  // Plantilla de movimiento específica (2026-09-17) — ronda entre el corral y la entrada del
  // campamento, coherente con su propia bio ("sale a cazar o vigilar los alrededores").
  { locationSlug: 'campamento-serhu', x: 620, y: 200, tipo: 'NPC', targetSlug: 'cazadora-serhu', label: 'Cazadora Serhu, vigilando los alrededores', plantillaEspecifica: 'cazadora-vigilancia-campamento-serhu' },

  // Interior de Karot Veku (2026-08-31, "Trabajador de Reino") — mismo lienzo 800×600, propio de
  // esta Location. Torgash/Ulkha en el propio Ketg'sedsar (centro); los 3 edificios de profesión
  // ya sembrados (Herrería/Curtiduría/Cocina) a los lados, con sus Maestros.
  { locationSlug: 'campamento-serhu-interior', x: 400, y: 300, tipo: 'EDIFICIO', targetSlug: 'ketg-sedsar', label: 'Ketg\'sedsar — el Salón del Colmillo Ceniza' },
  { locationSlug: 'campamento-serhu-interior', x: 400, y: 220, tipo: 'NPC', targetSlug: 'torgash-ketg', label: "Torgash Ketg, Kort'ikar" },
  { locationSlug: 'campamento-serhu-interior', x: 400, y: 380, tipo: 'NPC', targetSlug: 'ulkha-ketg', label: "Ulkha Ketg, Terk'ikar" },
  { locationSlug: 'campamento-serhu-interior', x: 180, y: 300, tipo: 'EDIFICIO', targetSlug: 'herreria-serhu', label: 'Herrería del Clan Serhu' },
  { locationSlug: 'campamento-serhu-interior', x: 160, y: 240, tipo: 'NPC', targetSlug: 'maestro-herrero-serhu', label: 'Maestro Herrero del Clan Serhu' },
  { locationSlug: 'campamento-serhu-interior', x: 620, y: 300, tipo: 'EDIFICIO', targetSlug: 'curtiduria-serhu', label: 'Curtiduría del Clan Serhu' },
  { locationSlug: 'campamento-serhu-interior', x: 640, y: 240, tipo: 'NPC', targetSlug: 'maestra-curtidora-serhu', label: 'Maestra Curtidora del Clan Serhu' },
  { locationSlug: 'campamento-serhu-interior', x: 400, y: 460, tipo: 'EDIFICIO', targetSlug: 'cocina-serhu', label: 'Cocina común de Karot Veku' },
  { locationSlug: 'campamento-serhu-interior', x: 340, y: 500, tipo: 'NPC', targetSlug: 'maestro-cocinero-serhu', label: 'Maestro Cocinero del Clan Serhu' },
  // Franja 3 de "Interactuar" (2026-09-08) — el resto de Maestros de oficio sin edificio propio
  // sembrado todavía, distribuidos por el resto del poblado (sin sistema de movimiento por
  // cuadrícula al sembrarlo, pero con separación real >60px entre sí, mismo criterio que
  // `DISTANCIA_MINIMA_ENTRE_PUNTOS` para que ningún par quede literalmente encima del otro).
  // 5 de estos 8 ya tienen FactionBuilding propio desde la tanda OpenCode 2026-09-27/28 (A-09) —
  // ver los ZonePoint EDIFICIO añadidos justo debajo de cada uno. Peletero, Primeros Auxilios y
  // Sastre siguen sin edificio propio (fuera de alcance de A-09).
  { locationSlug: 'campamento-serhu-interior', x: 160, y: 380, tipo: 'NPC', targetSlug: 'maestro-alquimista-serhu', label: 'Maestro Alquimista del Clan Serhu' },
  { locationSlug: 'campamento-serhu-interior', x: 100, y: 400, tipo: 'EDIFICIO', targetSlug: 'taller-alquimia-serhu', label: 'Taller de Alquimia del Clan Serhu' },
  { locationSlug: 'campamento-serhu-interior', x: 640, y: 380, tipo: 'NPC', targetSlug: 'maestro-domador-serhu', label: 'Maestro Domador del Clan Serhu' },
  { locationSlug: 'campamento-serhu-interior', x: 700, y: 400, tipo: 'EDIFICIO', targetSlug: 'corrales-domador-serhu', label: 'Corrales del Domador' },
  { locationSlug: 'campamento-serhu-interior', x: 220, y: 460, tipo: 'NPC', targetSlug: 'maestro-desollador-serhu', label: 'Maestro Desollador del Clan Serhu' },
  { locationSlug: 'campamento-serhu-interior', x: 160, y: 520, tipo: 'EDIFICIO', targetSlug: 'desolladero-serhu', label: 'Desolladero del Clan Serhu' },
  { locationSlug: 'campamento-serhu-interior', x: 580, y: 460, tipo: 'NPC', targetSlug: 'maestro-peletero-serhu', label: 'Maestro Peletero del Clan Serhu' },
  { locationSlug: 'campamento-serhu-interior', x: 640, y: 500, tipo: 'EDIFICIO', targetSlug: 'peleteria-serhu', label: 'Peletería del Clan Serhu' },
  { locationSlug: 'campamento-serhu-interior', x: 220, y: 160, tipo: 'NPC', targetSlug: 'maestra-primeros-auxilios-serhu', label: 'Maestra de Primeros Auxilios del Clan Serhu' },
  { locationSlug: 'campamento-serhu-interior', x: 160, y: 120, tipo: 'EDIFICIO', targetSlug: 'casa-de-curas-serhu', label: 'Casa de curas del Clan Serhu' },
  { locationSlug: 'campamento-serhu-interior', x: 580, y: 160, tipo: 'NPC', targetSlug: 'maestra-herborista-serhu', label: 'Maestra Herborista del Clan Serhu' },
  { locationSlug: 'campamento-serhu-interior', x: 640, y: 120, tipo: 'EDIFICIO', targetSlug: 'herboristeria-serhu', label: 'Herboristería del Clan Serhu' },
  { locationSlug: 'campamento-serhu-interior', x: 300, y: 140, tipo: 'NPC', targetSlug: 'maestra-sastre-serhu', label: 'Maestra Sastre del Clan Serhu' },
  { locationSlug: 'campamento-serhu-interior', x: 280, y: 75, tipo: 'EDIFICIO', targetSlug: 'sastreria-serhu', label: 'Sastrería del Clan Serhu' },
  { locationSlug: 'campamento-serhu-interior', x: 500, y: 140, tipo: 'NPC', targetSlug: 'maestro-carpintero-serhu', label: 'Maestro Carpintero del Clan Serhu' },
  { locationSlug: 'campamento-serhu-interior', x: 500, y: 80, tipo: 'EDIFICIO', targetSlug: 'carpinteria-serhu', label: 'Carpintería del Clan Serhu' },
  // Tirag Susig (auditoría de lore 2026-09-13, C9/C10) — sin ZonePoint hasta ahora (era
  // `kind: 'PLANTILLA'`, corregido a PRINCIPAL). Necesita punto real para que su companion Gisoki
  // tenga de qué punto colgar el icono de grupo (ver companionsByOwnerSlug, zona.ts).
  { locationSlug: 'campamento-serhu-interior', x: 500, y: 460, tipo: 'NPC', targetSlug: 'tirag-susig', label: 'Tirag Susig, cazadora' },

  // Interior de Helske Tugh (2026-09-13, ampliación de lore/auditoría) — mismo lienzo 800×600 y
  // mismo patrón que Karot Veku: salón central, 6 edificios de oficio a su alrededor (todos los
  // que ya tienen Maestro real, ver factionBuildings § Clan Helsig más abajo) con separación >60px
  // entre pares, y la guardiana suelta junto a la entrada — mismo criterio de
  // `DISTANCIA_MINIMA_ENTRE_PUNTOS` que el resto del archivo.
  { locationSlug: 'campamento-helsig-interior', x: 400, y: 300, tipo: 'EDIFICIO', targetSlug: 'helsig-sedsar', label: 'Helsig\'sedsar — el Salón de Honor Helado' },
  { locationSlug: 'campamento-helsig-interior', x: 180, y: 300, tipo: 'EDIFICIO', targetSlug: 'herreria-helsig', label: 'Herrería del Clan Helsig' },
  { locationSlug: 'campamento-helsig-interior', x: 160, y: 240, tipo: 'NPC', targetSlug: 'maestra-herrera-helsig', label: 'Maestra Herrera del Clan Helsig' },
  { locationSlug: 'campamento-helsig-interior', x: 620, y: 300, tipo: 'EDIFICIO', targetSlug: 'peleteria-helsig', label: 'Peletería del Clan Helsig' },
  { locationSlug: 'campamento-helsig-interior', x: 640, y: 240, tipo: 'NPC', targetSlug: 'maestra-peletera-helsig', label: 'Maestra Peletera del Clan Helsig' },
  { locationSlug: 'campamento-helsig-interior', x: 660, y: 300, tipo: 'NPC', targetSlug: 'peletera-helsig', label: 'Peletera del Clan Helsig' },
  { locationSlug: 'campamento-helsig-interior', x: 400, y: 460, tipo: 'EDIFICIO', targetSlug: 'cocina-helsig', label: 'Cocina común de Helske Tugh' },
  { locationSlug: 'campamento-helsig-interior', x: 340, y: 500, tipo: 'NPC', targetSlug: 'maestro-cocinero-helsig', label: 'Maestro Cocinero del Clan Helsig' },
  { locationSlug: 'campamento-helsig-interior', x: 400, y: 140, tipo: 'EDIFICIO', targetSlug: 'mina-helsig', label: 'Boca de mina del Clan Helsig' },
  { locationSlug: 'campamento-helsig-interior', x: 460, y: 100, tipo: 'NPC', targetSlug: 'maestro-minero-helsig', label: 'Maestro Minero del Clan Helsig' },
  { locationSlug: 'campamento-helsig-interior', x: 220, y: 460, tipo: 'EDIFICIO', targetSlug: 'herboristeria-helsig', label: 'Herboristería del Clan Helsig' },
  { locationSlug: 'campamento-helsig-interior', x: 160, y: 500, tipo: 'NPC', targetSlug: 'maestro-herborista-helsig', label: 'Maestro Herborista del Clan Helsig' },
  { locationSlug: 'campamento-helsig-interior', x: 580, y: 460, tipo: 'EDIFICIO', targetSlug: 'alquimia-helsig', label: 'Taller de alquimia del Clan Helsig' },
  { locationSlug: 'campamento-helsig-interior', x: 640, y: 500, tipo: 'NPC', targetSlug: 'maestra-alquimista-helsig', label: 'Maestra Alquimista del Clan Helsig' },
  // Plantilla de movimiento específica (2026-09-17) — recorre el perímetro interior circular del
  // campamento (mismo diseño que la imagen real de campamento-serhu-interior-mapa.png), en vez de
  // la ida-vuelta corta genérica de PATRULLA_BREVE.
  { locationSlug: 'campamento-helsig-interior', x: 100, y: 300, tipo: 'NPC', targetSlug: 'guardiana-helsig', label: 'Guardiana del Clan Helsig', plantillaEspecifica: 'guardia-perimetro-interior-campamento' },
  // Brenka/Solgra (auditoría de lore 2026-09-13, C7) — líderes del clan, sin ZonePoint hasta
  // ahora pese a ficha real. Junto al salón, mismo patrón que Torgash/Ulkha en Karot Veku.
  { locationSlug: 'campamento-helsig-interior', x: 400, y: 220, tipo: 'NPC', targetSlug: 'brenka', label: "Brenka, Terk'ikar" },
  { locationSlug: 'campamento-helsig-interior', x: 400, y: 380, tipo: 'NPC', targetSlug: 'solgra', label: "Solgra, Kort'ikar" },

  // Interior de Silh Makut (2026-09-13, ampliación de lore/auditoría) — solo el salón por ahora
  // (ver factionBuildings § Clan Goshg): ningún NPC del clan tiene `homeLocationSlug` aquí todavía.
  { locationSlug: 'campamento-goshg-interior', x: 400, y: 300, tipo: 'EDIFICIO', targetSlug: 'goshg-sedsar', label: 'Goshg\'sedsar — el Salón de Piel Musgo' },

  // El Cruce de las Cenizas — Ferike tiene homeLocationSlug directo aquí. Telda Ceniza y Matorral
  // de Cuerno tienen homeLocationSlug/tag de vegetación coherentes con la propia description
  // ('vegetacion' en locationTerrainTags).
  { locationSlug: 'cruce-de-las-cenizas', x: 220, y: 260, tipo: 'FAUNA', targetSlug: 'ferike', label: 'Ferike en el borde de la sombra' },
  { locationSlug: 'cruce-de-las-cenizas', x: 480, y: 180, tipo: 'RECURSO', targetSlug: 'telda-ceniza', label: 'Telda Ceniza' },
  { locationSlug: 'cruce-de-las-cenizas', x: 560, y: 440, tipo: 'RECURSO', targetSlug: 'matorral-de-cuerno', label: 'Matorral de Cuerno' },

  // El Filo de las Brasas — Rondador de Brasas y Salamandra de Escoria tienen homeLocationSlug
  // directo. Volcanita es la veta "más común de la zona" (harvestSourceDescriptions); Fercaneo es
  // más raro pero su propia description ya lo ancla aquí ("solo cerca de cráteres y lava en El
  // Filo de las Brasas").
  { locationSlug: 'filo-de-las-brasas', x: 240, y: 200, tipo: 'FAUNA', targetSlug: 'rondador-de-brasas', label: 'Rondador de Brasas al borde de la luz' },
  { locationSlug: 'filo-de-las-brasas', x: 540, y: 260, tipo: 'FAUNA', targetSlug: 'salamandra-de-escoria', label: 'Salamandra de Escoria' },
  { locationSlug: 'filo-de-las-brasas', x: 340, y: 440, tipo: 'RECURSO', targetSlug: 'volcanita', label: 'Veta de Volcanita' },
  { locationSlug: 'filo-de-las-brasas', x: 620, y: 480, tipo: 'RECURSO', targetSlug: 'fercaneo', label: 'Fercaneo entre cráteres' },

  // Los Manaderos — Jusha Esmeralda, Miruina y Quio tienen homeLocationSlug directo (Tura Jusha
  // queda fuera por cupo, misma charca que Jusha Esmeralda). Chudos Rojizos tiene homeLocationSlug
  // directo también.
  { locationSlug: 'manaderos', x: 220, y: 180, tipo: 'FAUNA', targetSlug: 'jusha-esmeralda', label: 'Jusha Esmeralda en charca profunda' },
  { locationSlug: 'manaderos', x: 540, y: 220, tipo: 'FAUNA', targetSlug: 'miruina', label: 'Madriguera de Miruina' },
  { locationSlug: 'manaderos', x: 320, y: 420, tipo: 'FAUNA', targetSlug: 'quio', label: 'Quio filtrando el fango de la orilla' },
  { locationSlug: 'manaderos', x: 600, y: 460, tipo: 'RECURSO', targetSlug: 'chudos-rojizos', label: 'Chudos Rojizos' },

  // El Osario de la Manada — hito pequeño, sin fauna viva anclada propia (la Gargantúa que le da
  // nombre lleva muerta décadas). Solo los 2 recursos con homeLocationSlug directo.
  { locationSlug: 'osario-de-la-manada', x: 400, y: 260, tipo: 'RECURSO', targetSlug: 'osario-de-la-manada', label: 'Costillas de la Gargantúa' },
  { locationSlug: 'osario-de-la-manada', x: 500, y: 420, tipo: 'RECURSO', targetSlug: 'boungo', label: 'Cúmulo de Boungo' },

  // Los Pastos de la Deriva — Cuernahoja tiene homeLocationSlug directo; Gradias y Flor Salvatura
  // también.
  { locationSlug: 'pastos-de-la-deriva', x: 260, y: 220, tipo: 'FAUNA', targetSlug: 'cuernahoja', label: 'Manada de Cuernahoja' },
  { locationSlug: 'pastos-de-la-deriva', x: 540, y: 260, tipo: 'RECURSO', targetSlug: 'gradias', label: 'Arbusto de Gradias' },
  { locationSlug: 'pastos-de-la-deriva', x: 400, y: 460, tipo: 'RECURSO', targetSlug: 'flor-salvatura', label: 'Flor Salvatura' },

  // Paso de los Pilares Rotos — Cruzavientos tiene homeLocationSlug directo (anida en lo alto).
  // Roca, Veta de Hierro y Lucre Blanco, los 3 con homeLocationSlug directo — Location con más
  // variedad de recursos minerales/madera del núcleo, de ahí el cupo completo de 4.
  // Plantilla de movimiento específica (2026-09-17, services/movementTemplates.ts) — sobrevuela
  // las 3 columnas reales de la imagen del mapa, coherente con la propia bio ("vuela alto y en
  // círculos... anida en lo alto de los Pilares Rotos"), en vez del anillo genérico de ORBITA_AEREA.
  { locationSlug: 'pilares-rotos', x: 400, y: 140, tipo: 'FAUNA', targetSlug: 'cruzavientos', label: 'Nido de Cruzavientos en lo alto', plantillaEspecifica: 'cruzavientos-pilares-rotos' },
  { locationSlug: 'pilares-rotos', x: 220, y: 320, tipo: 'RECURSO', targetSlug: 'roca-pilares-rotos', label: 'Roca erosionada' },
  { locationSlug: 'pilares-rotos', x: 560, y: 340, tipo: 'RECURSO', targetSlug: 'veta-hierro-pilares-rotos', label: 'Veta de hierro' },
  { locationSlug: 'pilares-rotos', x: 400, y: 500, tipo: 'RECURSO', targetSlug: 'lucre-blanco', label: 'Lucre Blanco en la cumbre' },

  // El Pozo de Cauce Viejo — Guchapo, Lebude y Escorante tienen homeLocationSlug directo (misma
  // charca, cadena trófica descrita en sus propias bios: Lebude caza Guchapo/Escorante). Musgo
  // Arcilla completa el cupo de 4 (también homeLocationSlug directo, material de construcción).
  { locationSlug: 'pozo-cauce-viejo', x: 220, y: 200, tipo: 'FAUNA', targetSlug: 'guchapo', label: 'Charca de Guchapos' },
  { locationSlug: 'pozo-cauce-viejo', x: 540, y: 220, tipo: 'FAUNA', targetSlug: 'lebude', label: 'Colmena de Lebude' },
  { locationSlug: 'pozo-cauce-viejo', x: 300, y: 440, tipo: 'FAUNA', targetSlug: 'escorante', label: 'Escorante enterrado' },
  { locationSlug: 'pozo-cauce-viejo', x: 580, y: 460, tipo: 'RECURSO', targetSlug: 'musgo-arcilla', label: 'Musgo Arcilla' },

  // Los Restos de Maktor — Restos personales tiene homeLocationSlug directo. Ruptidar (limpiador
  // de arena "presente en cualquier zona arenosa", sin homeLocationSlug fijo) completa el terreno
  // árido sin forzar ninguna especie con ancla propia en otro sitio.
  { locationSlug: 'restos-de-maktor', x: 380, y: 260, tipo: 'RECURSO', targetSlug: 'restos-personales-maktor', label: 'Restos personales entre los cimientos' },
  { locationSlug: 'restos-de-maktor', x: 560, y: 420, tipo: 'FAUNA', targetSlug: 'ruptidar', label: 'Ruptidar bajo la arena' },

  // Los Túmulos del Honor — Ofrendas tiene homeLocationSlug directo. Mismo criterio de Ruptidar
  // que Restos de Maktor (terreno árido, sin ancla propia en otra Location).
  { locationSlug: 'tumulos-del-honor', x: 240, y: 440, tipo: 'FAUNA', targetSlug: 'ruptidar', label: 'Ruptidar bajo la arena' },

  // El Oasis de Chudos Rojos — sin fauna/recurso propio con homeLocationSlug fijo aquí; match por
  // terreno (humedo/vegetacion) con especies/plantas sin ancla en otra Location. Bulbo del Cauce y
  // Liquen del Cauce comparten la misma corriente subterránea que la propia description del Oasis
  // nombra explícitamente. Múrgol (ganado itinerante, sin homeLocationSlug fijo) encaja con el
  // propio texto: "disputado entre clanes, fauna y cualquiera que necesite descansar".
  { locationSlug: 'oasis-de-chudos-rojos', x: 260, y: 220, tipo: 'RECURSO', targetSlug: 'bulbo-del-cauce', label: 'Bulbo del Cauce' },
  { locationSlug: 'oasis-de-chudos-rojos', x: 540, y: 260, tipo: 'RECURSO', targetSlug: 'liquen-del-cauce', label: 'Liquen del Cauce' },
  { locationSlug: 'oasis-de-chudos-rojos', x: 400, y: 460, tipo: 'FAUNA', targetSlug: 'murgol', label: 'Múrgoles abrevando' },

  // La Desembocadura Callada — sin fauna/recurso costero propio catalogado (ninguna especie del
  // catálogo tiene ancla marina/costera real); match por terreno con lo poco disponible: Liquen
  // del Cauce (humedo, cierra el mismo recorrido de agua que la propia description nombra) y Flor
  // de Ceniza (rocoso, coincide con el brazo de roca que menciona locationTerrainTags). Match
  // débil a propósito — anotado en el resumen de la tarea, no hay más candidatos reales.
  { locationSlug: 'desembocadura-callada', x: 320, y: 260, tipo: 'RECURSO', targetSlug: 'liquen-del-cauce', label: 'Liquen del Cauce en la marisma' },
  { locationSlug: 'desembocadura-callada', x: 540, y: 420, tipo: 'RECURSO', targetSlug: 'flor-de-ceniza', label: 'Flor de Ceniza' },

  // Playa de Ceniza Blanca — mismo hueco real de fauna/recurso costero que el resto de la costa
  // (ver comentario de Desembocadura Callada). Bulbo del Cauce (humedo) y Salvia del Polvo (arido)
  // son los únicos matches de terreno sin ancla previa en otra Location.
  { locationSlug: 'playa-de-ceniza-blanca', x: 300, y: 300, tipo: 'RECURSO', targetSlug: 'bulbo-del-cauce', label: 'Bulbo del Cauce' },
  { locationSlug: 'playa-de-ceniza-blanca', x: 540, y: 380, tipo: 'RECURSO', targetSlug: 'salvia-del-polvo', label: 'Salvia del Polvo' },
  { locationSlug: 'playa-de-ceniza-blanca', x: 200, y: 220, tipo: 'RECURSO', targetSlug: 'junba-verde', label: 'Junba Verde' },
  { locationSlug: 'playa-de-ceniza-blanca', x: 450, y: 480, tipo: 'RECURSO', targetSlug: 'temune', label: 'Algas Temune varadas' },
  { locationSlug: 'playa-de-ceniza-blanca', x: 620, y: 220, tipo: 'RECURSO', targetSlug: 'roca-pilares-rotos', label: 'Roca de Llanura Roja' },
  // Franja 3 de "Interactuar" (2026-09-08) — "conoce cada banco de Jashil y sabe leer cuándo el
  // Toluh puede aparecer en la orilla profunda" (bio) — borde inferior del lienzo, hacia el agua,
  // separado de los recursos ya sembrados.
  { locationSlug: 'playa-de-ceniza-blanca', x: 400, y: 560, tipo: 'NPC', targetSlug: 'maestro-pescador-serhu', label: 'Maestro Pescador, junto a la orilla' },
  // Edificio de facción (P-10, 2026-09-28) — el embarcadero real del Maestro, no la Location
  // 'embarcadero-de-ceniza' (que ya tiene su propio ZonePoint EDIFICIO apuntándose a sí misma sin
  // FactionBuilding real detrás, anti-patrón previo fuera de alcance de esta tanda).
  { locationSlug: 'playa-de-ceniza-blanca', x: 560, y: 540, tipo: 'EDIFICIO', targetSlug: 'embarcadero-pesca-serhu', label: 'Embarcadero de pesca del Clan Serhu' },

  // Los Acantilados Partidos — mismo hueco real de fauna/recurso costero. Flor de Ceniza (rocoso)
  // y Liquen del Cauce (humedo) son los matches de terreno disponibles.
  { locationSlug: 'acantilados-partidos', x: 320, y: 240, tipo: 'RECURSO', targetSlug: 'flor-de-ceniza', label: 'Flor de Ceniza en la grieta' },
  { locationSlug: 'acantilados-partidos', x: 520, y: 420, tipo: 'RECURSO', targetSlug: 'liquen-del-cauce', label: 'Liquen del Cauce' },

  // Las Pozas de Marea — mismo hueco real de fauna/recurso costero. Bulbo y Liquen del Cauce,
  // únicos matches de terreno húmedo disponibles, coherentes con "vida propia en cada poza".
  { locationSlug: 'pozas-de-marea', x: 300, y: 280, tipo: 'RECURSO', targetSlug: 'bulbo-del-cauce', label: 'Bulbo del Cauce en la poza' },
  { locationSlug: 'pozas-de-marea', x: 520, y: 400, tipo: 'RECURSO', targetSlug: 'liquen-del-cauce', label: 'Liquen del Cauce' },

  // El Embarcadero de Ceniza — único EDIFICIO real de la costa (botes varados + redes tendidas,
  // descritos en su propia description). Liquen del Cauce completa con el único match de terreno
  // húmedo disponible sin ancla previa.
  { locationSlug: 'embarcadero-de-ceniza', x: 400, y: 280, tipo: 'EDIFICIO', targetSlug: 'embarcadero-de-ceniza', label: 'Botes y redes del Embarcadero' },
  { locationSlug: 'embarcadero-de-ceniza', x: 560, y: 440, tipo: 'RECURSO', targetSlug: 'liquen-del-cauce', label: 'Liquen del Cauce' },

  // La Fosa Horadada — Espina del Viento no tiene homeLocationSlug en la tabla de recursos, pero
  // la propia description de la Fosa la nombra explícitamente ("la mayor madriguera conocida de
  // Espina del Viento de toda la región") — match textual directo, único punto, hito pequeño y
  // peligroso sin más lore de fauna/recurso propio.
  { locationSlug: 'fosa-horadada', x: 400, y: 300, tipo: 'RECURSO', targetSlug: 'espina-del-viento', label: 'Madriguera de Espina del Viento' },

  // Las Dunas Ahogadas — ruinas del Reino Nabierus bajo la arena; Arena Imán (arido, sin ancla
  // previa) y Ruptidar (arido, "cualquier zona arenosa") son los matches de terreno disponibles.
  { locationSlug: 'dunas-ahogadas', x: 340, y: 260, tipo: 'RECURSO', targetSlug: 'arena-iman', label: 'Arena Imán entre las dunas' },
  { locationSlug: 'dunas-ahogadas', x: 540, y: 420, tipo: 'FAUNA', targetSlug: 'ruptidar', label: 'Ruptidar bajo la arena' },

  // El Vientre del Engaño — hondonada seca y estéril "donde nada crece"; se deja deliberadamente
  // con solo 2 puntos de terreno árido genérico (Ruptidar, Salvia del Polvo), sin forzar más
  // variedad que contradiga la propia description ("nada crece").
  { locationSlug: 'vientre-del-engano', x: 380, y: 280, tipo: 'FAUNA', targetSlug: 'ruptidar', label: 'Ruptidar bajo la arena' },
  { locationSlug: 'vientre-del-engano', x: 560, y: 440, tipo: 'RECURSO', targetSlug: 'salvia-del-polvo', label: 'Salvia del Polvo en la sombra' },

  // El Laberinto de Cañones — badlands de arcilla árida/rocosa sin fauna/recurso propio anclado;
  // Flor de Ceniza (rocoso) y Ruptidar (arido) son los matches de terreno disponibles.
  { locationSlug: 'laberinto-de-canones', x: 320, y: 260, tipo: 'RECURSO', targetSlug: 'flor-de-ceniza', label: 'Flor de Ceniza en la sombra del cañón' },
  { locationSlug: 'laberinto-de-canones', x: 540, y: 420, tipo: 'FAUNA', targetSlug: 'ruptidar', label: 'Ruptidar bajo la arena' },

  // Las Fumarolas Negras — más hostil que El Filo de las Brasas; Fercaneo tiene match textual
  // directo en su propia description ("más probable en Las Fumarolas Negras"). Raíz de Fuego
  // (rocoso/volcánico, sin ancla previa) completa el segundo punto.
  { locationSlug: 'fumarolas-negras', x: 340, y: 260, tipo: 'RECURSO', targetSlug: 'fercaneo', label: 'Fercaneo entre grietas humeantes' },
  { locationSlug: 'fumarolas-negras', x: 540, y: 420, tipo: 'RECURSO', targetSlug: 'raiz-de-fuego', label: 'Raíz de Fuego' },

  // El Paso de los Huesos — cañón estrecho, paso obligado hacia La Sabana Alta; sin fauna/recurso
  // propio anclado, un único match de terreno (Flor de Ceniza, rocoso) — hito de paso, no de
  // permanencia.
  { locationSlug: 'paso-de-los-huesos', x: 400, y: 300, tipo: 'RECURSO', targetSlug: 'flor-de-ceniza', label: 'Flor de Ceniza entre los huesos' },

  // La Sabana Alta — Towrgu y Coracelo tienen homeLocationSlug directo; Pasto de Sangre y Trigo
  // Escarlata (también homeLocationSlug directo) son los recursos que la propia description nombra
  // por nombre ("hierba roja... más alta y densa"). Telda Atardecer y Roca Luclara quedan fuera
  // por cupo (4 máximo).
  { locationSlug: 'sabana-alta-colmillar', x: 220, y: 200, tipo: 'FAUNA', targetSlug: 'towrgu', label: 'Towrgu al acecho en el pasto alto' },
  { locationSlug: 'sabana-alta-colmillar', x: 560, y: 240, tipo: 'FAUNA', targetSlug: 'coracelo', label: 'Madriguera fortificada de Coracelo' },
  { locationSlug: 'sabana-alta-colmillar', x: 320, y: 440, tipo: 'RECURSO', targetSlug: 'pasto-de-sangre', label: 'Pasto de Sangre' },
  { locationSlug: 'sabana-alta-colmillar', x: 580, y: 460, tipo: 'RECURSO', targetSlug: 'trigo-escarlata', label: 'Trigo Escarlata' },

  // Yegr Kegi (El Vergel de la Arena) — coto de caza/comercio de los Faerus; sin fauna/recurso
  // propio anclado (fuera del alcance directo de Gorhorn). Corretolvas (vegetacion, caza menor sin
  // ancla previa ni conflicto con el corredor migratorio de Corredor de Cauce, reservado a
  // Manaderos/Pastos/Sabana) y Liquen del Cauce (humedo) son los matches de terreno disponibles.
  // Fix real (2026-09-13, auditoría de lore Helek) — `locationSlug` corregido de 'vergel-de-kegi'
  // (slug viejo, renombrado a 'yegr-kegi' junto con el resto de nombres nativos) a la referencia
  // real: quedaron huérfanos tras el rename, invisibles en el mapa de zona real.
  { locationSlug: 'yegr-kegi', x: 340, y: 260, tipo: 'FAUNA', targetSlug: 'corretolvas', label: 'Bandada de Corretolvas' },
  { locationSlug: 'yegr-kegi', x: 540, y: 420, tipo: 'RECURSO', targetSlug: 'liquen-del-cauce', label: 'Liquen del Cauce' },

  // La Grieta Cantora — hito puramente sonoro/atmosférico (el viento cantando en las grietas), sin
  // lore de fauna o recurso propio; un único match débil de terreno rocoso (Flor de Ceniza),
  // anotado en el resumen de la tarea como el caso más flojo de todo el lote.
  { locationSlug: 'grieta-cantora', x: 400, y: 300, tipo: 'RECURSO', targetSlug: 'flor-de-ceniza', label: 'Flor de Ceniza entre las grietas' },

  // El Campo Yermo — llanura de huesos viejos y metal oxidado sin fauna/recurso propio anclado; un
  // único match de terreno árido (Ruptidar), coherente con "nadie ha reclamado nunca del todo".
  { locationSlug: 'campo-yermo', x: 400, y: 300, tipo: 'FAUNA', targetSlug: 'ruptidar', label: 'Ruptidar entre los restos oxidados' },

  // ══════════════════════════════════════════════════════════════════════════
  // Ampliación 2026-09-28 — Fase 3 del plan "lo que funciona por zona se hace desde la zona"
  // (docs/registros/plan-mecanicas-por-zona-2026-09-28.md): cobertura de mapa para toda fuente
  // CAZA/TALA/MINERIA/EXTRACCION/PESCA/BUSQUEDA con presencia real en Las Llanuras del Viento
  // Rojo (`WorldPopulation.distribucion`/`HarvestYield`) que hasta ahora no tenía NINGÚN
  // `ZonePoint` en ninguna Location de la región — con las acciones de caza/recolección pasando a
  // exigir colisión con un `ZonePoint` real (Fase 2/4 del mismo plan), estas 23 fuentes habrían
  // quedado imposibles de obtener. Cada punto se colocó SOLO en una Location que pasa EXACTAMENTE
  // el mismo filtro que ya aplica el motor (`candidateFaunaFor`/`candidateSourcesFor`:
  // `harvestSourceHomeLocationSlug`/`Npc.homeLocationSlug` + `pasaFiltroTerreno` contra
  // `locationTerrainTags`×`faunaTerrainTag`/`harvestSourceTerrainTag`, terrain.ts) — verificado con
  // un script de comprobación aparte (importando esas mismas funciones/mapas), no a ojo. Ninguna
  // especie ni dato de lore nuevo: solo dónde vive cada punto en el mapa. Coordenadas PROVISIONALES
  // (lienzo 800×600, mismo aviso que la ampliación 2026-08-31), a ≥60px de cualquier punto ya
  // sembrado en su Location (incluidos los de esta misma ampliación) y con margen ≥40px del borde.
  //
  // Pesca/Búsqueda (Playa de Ceniza Blanca, único candidato: los 6 Npc de peces/marisco tienen su
  // propio `homeLocationSlug` fijo ahí — ver `harvestSourceHomeLocationSlug`) se siembran como
  // `tipo: 'RECURSO'` (no FAUNA): son fuentes de `HarvestYield` PESCA/BUSQUEDA, mismo criterio ya
  // usado por el resto de RECURSO de este archivo, nunca fauna cazable con Cazar.
  //
  // Excepciones — NO se pudo sembrar ningún punto real por conflicto de datos ya existente (no
  // introducido por esta ampliación, ver `zonePointsCobertura.test.ts` para la lista formal):
  //   - `gargantua-de-ceniza` (CAZA): `harvestSourceHomeLocationSlug` la ancla EN EXCLUSIVA a
  //     `osario-de-la-manada` (el esqueleto real que da nombre a esa Location), pero su propio
  //     `faunaTerrainTag` es 'vegetacion' y `locationTerrainTags['osario-de-la-manada']` es solo
  //     ['arido'] — el filtro de terreno y el candado de Location se contradicen entre sí, así que
  //     NINGUNA Location de la región puede pasar los dos filtros a la vez con los datos actuales.
  //   - `junba-verde-resina-fuente` (EXTRACCION): mismo choque, ya preexistente en su hermano
  //     `junba-verde` (TALA, ya sembrado desde 2026-08-31) — `harvestSourceHomeLocationSlug` la
  //     ancla EN EXCLUSIVA a `playa-de-ceniza-blanca`, pero su `harvestSourceTerrainTag` es
  //     'costero' y `locationTerrainTags['playa-de-ceniza-blanca']` es solo ['humedo','arido'], sin
  //     'costero' — pese al comentario junto a `harvestSourceTerrainTag` que asume que ese tag
  //     "nunca interviene en el filtro real" (ya no es cierto desde que la playa tiene
  //     `locationTerrainTags` propio, 2026-08-23). Requiere que Álvaro decida en el runbook de lore
  //     si añadir 'costero' a `locationTerrainTags['playa-de-ceniza-blanca']` o quitar el tag de
  //     terreno de estas dos fuentes — fuera del alcance de esta tarea (solo posiciones de mapa).
  //
  // CAZA — cada especie en la única Location que pasa `harvestSourceHomeLocationSlug` (o, sin
  // candado, sin ningún filtro real que la restrinja, ver Zense Ceniza).
  { locationSlug: 'pastos-de-la-deriva', x: 660, y: 420, tipo: 'FAUNA', targetSlug: 'aullador-rojo', label: 'Aullador Rojo acechando entre el pasto alto' },
  { locationSlug: 'restos-de-maktor', x: 150, y: 460, tipo: 'FAUNA', targetSlug: 'canizor', label: 'Canizor merodeando entre las ruinas' },
  { locationSlug: 'acantilados-partidos', x: 150, y: 120, tipo: 'FAUNA', targetSlug: 'celubia-palida', label: 'Celubia Pálida en la grieta alta' },
  { locationSlug: 'acantilados-partidos', x: 700, y: 150, tipo: 'FAUNA', targetSlug: 'terkash', label: 'Terkash posado en el acantilado' },
  { locationSlug: 'manaderos', x: 120, y: 460, tipo: 'FAUNA', targetSlug: 'corredor-de-cauce', label: 'Corredor de Cauce pastando junto al agua' },
  { locationSlug: 'manaderos', x: 700, y: 300, tipo: 'FAUNA', targetSlug: 'tura-jusha', label: 'Tura Jusha acechando crías desorientadas' },
  // Zense Ceniza — deliberadamente sin `harvestSourceHomeLocationSlug` ni `faunaTerrainTag` propio
  // (ver comentario junto a esa tabla: "carroñera errante... siempre en círculos sobre lo que
  // muere", igual que Ruptidar), así que pasa el filtro en CUALQUIER Location de la región. Se
  // elige El Osario de la Manada por coherencia con su propia bio, no por candado real.
  { locationSlug: 'osario-de-la-manada', x: 150, y: 150, tipo: 'FAUNA', targetSlug: 'zense-ceniza', label: 'Zense Ceniza sobrevolando los huesos' },

  // TALA/MINERIA/EXTRACCION — mismo criterio de candado de Location + terreno.
  { locationSlug: 'sabana-alta-colmillar', x: 100, y: 340, tipo: 'RECURSO', targetSlug: 'telda-atardecer', label: 'Telda Atardecer en la ladera' },
  // Resina junto a su propio árbol (Telda Atardecer, arriba), a 100px — mismo criterio que el resto
  // de pares árbol/resina del archivo (p.ej. Lucre Blanco/Resina Lucre Blanco, Los Pilares Rotos).
  { locationSlug: 'sabana-alta-colmillar', x: 100, y: 440, tipo: 'RECURSO', targetSlug: 'resina-telda-atardecer-fuente', label: 'Resina de Telda Atardecer' },
  { locationSlug: 'sabana-alta-colmillar', x: 700, y: 340, tipo: 'RECURSO', targetSlug: 'roca-luclara', label: 'Roca Luclara entre el pasto' },
  { locationSlug: 'pozo-cauce-viejo', x: 100, y: 340, tipo: 'RECURSO', targetSlug: 'telda-comun', label: 'Telda Común junto a la charca' },
  // Resina junto a su propio árbol (Telda Común, arriba), a 100px.
  { locationSlug: 'pozo-cauce-viejo', x: 100, y: 440, tipo: 'RECURSO', targetSlug: 'resina-telda-fuente', label: 'Resina de Telda Común' },
  { locationSlug: 'filo-de-las-brasas', x: 700, y: 150, tipo: 'RECURSO', targetSlug: 'rovalnica', label: 'Veta de Rovalnica' },
  // Resina junto a su propio árbol (Lucre Blanco, ya sembrado en la cumbre, 400,500), a 80px.
  { locationSlug: 'pilares-rotos', x: 480, y: 500, tipo: 'RECURSO', targetSlug: 'resina-lucre-blanco-fuente', label: 'Resina de Lucre Blanco' },
  // Espiga Roja — sin `harvestSourceHomeLocationSlug` propio a propósito (ver comentario junto a
  // esa tabla: "ninguna pista real la distingue de la llanura genérica"), pasa el filtro en
  // cualquier Location con tag 'vegetacion'; se elige El Cruce de las Cenizas por tener hueco real.
  { locationSlug: 'cruce-de-las-cenizas', x: 700, y: 300, tipo: 'RECURSO', targetSlug: 'espiga-roja', label: 'Espiga Roja entre la ceniza' },

  // PESCA/BUSQUEDA — único candidato real, La Playa de Ceniza Blanca (`homeLocationSlug` directo
  // de los 6 Npc de peces/marisco). `tipo: 'RECURSO'` (fuentes de HarvestYield PESCA/BUSQUEDA, no
  // fauna cazable con Cazar).
  { locationSlug: 'playa-de-ceniza-blanca', x: 60, y: 60, tipo: 'RECURSO', targetSlug: 'jashil-rojo', label: 'Banco de Jashil Rojo' },
  { locationSlug: 'playa-de-ceniza-blanca', x: 700, y: 60, tipo: 'RECURSO', targetSlug: 'jashil-verde', label: 'Banco de Jashil Verde' },
  { locationSlug: 'playa-de-ceniza-blanca', x: 60, y: 480, tipo: 'RECURSO', targetSlug: 'negueo-solar', label: 'Negueo Solar entre las rocas' },
  { locationSlug: 'playa-de-ceniza-blanca', x: 700, y: 480, tipo: 'RECURSO', targetSlug: 'negueo-turquesa', label: 'Negueo Turquesa entre las rocas' },
  { locationSlug: 'playa-de-ceniza-blanca', x: 150, y: 140, tipo: 'RECURSO', targetSlug: 'toluh', label: 'Toluh en la orilla profunda' },
  { locationSlug: 'playa-de-ceniza-blanca', x: 620, y: 140, tipo: 'RECURSO', targetSlug: 'bulco-de-arena', label: 'Bulco de Arena enterrado' },

  // Hallazgo adicional (2026-09-28, mismo test de cobertura de esta ampliación, no parte de la
  // lista original de 23): Flor de Ceniza y Salvia del Polvo ya tenían `ZonePoint` propio desde
  // antes de esta tarea, pero NINGUNO de sus puntos existentes está en la única Location que
  // permite `harvestSourceHomeLocationSlug` (candado exclusivo) — se añaden aquí sin tocar los
  // puntos viejos (quedan igual, simplemente no eran válidos y siguen sin serlo; no se borra nada).
  // Flor de Ceniza: home exclusivo 'fumarolas-negras' ("solo brota en suelo de ceniza volcánica"),
  // que sí tiene tag 'rocoso' (locationTerrainTags) — compatible con su propio harvestSourceTerrainTag.
  { locationSlug: 'fumarolas-negras', x: 700, y: 150, tipo: 'RECURSO', targetSlug: 'flor-de-ceniza', label: 'Flor de Ceniza junto a las grietas volcánicas' },
  // Salvia del Polvo: home exclusivo 'hondonada-del-eco' ("crece pegada al suelo en hondonadas y
  // rincones de sombra" — coincide con el propio nombre de la Location), que sí tiene tag 'arido'.
  { locationSlug: 'hondonada-del-eco', x: 700, y: 400, tipo: 'RECURSO', targetSlug: 'salvia-del-polvo', label: 'Salvia del Polvo en la sombra de la hondonada' },
];

/// Edificios de FACCIÓN AJENA (2026-08-31, "Trabajador de Reino") — catálogo de mundo puro, nunca
/// `Building`/`saveId` del jugador (ver comentario del modelo `FactionBuilding`, schema.prisma).
/// El jugador nunca construye ni mejora estos edificios, solo los visita. `profession: null` marca
/// el edificio SEDE (equivalente al Ayuntamiento del jugador — lo que "establece que existe" como
/// asentamiento real); el resto son edificios de oficio concreto, con capacidad de trabajadores por
/// tier (1=pequeño→1, 2=mediano→3, 3=grande→6, `tierCapacityFor`).
///
/// Solo Karot Veku por ahora, y dentro de Karot Veku solo 2 de los 11 oficios (Herrero/Curtidor,
/// petición explícita: "1-2 oficios de prueba primero") — el resto de oficios/asentamientos queda
/// para siguientes pasadas una vez verificado el motor completo (modelo + vista de interior +
/// aprender oficio) de punta a punta con estos 2.
export interface FactionBuildingInput {
  slug: string;
  name: string;
  factionSlug: string;
  locationSlug: string;
  profession: string | null;
  tier: number;
  description: string;
}

export const factionBuildings: FactionBuildingInput[] = [
  // Fix real (2026-09-13, auditoría de lore Helek) — según `lenguas-helek.md`, `Lukar` = "Hogar"
  // (el recinto/interior entero, ya la propia Location `campamento-serhu-interior`) y `Sedsar` =
  // "Salón" (el edificio ceremonial puntual dentro de ese recinto). Este `FactionBuilding` es el
  // edificio concreto — el salón, no el hogar entero —, así que el nombre correcto es
  // `Ketg'sedsar`, no `Ketg'lukar` (que ya está en uso para la Location interior completa,
  // duplicando el mismo morfema en dos escalas distintas). Mismo criterio aplicado a Helsig/Goshg
  // más abajo, que sí nacieron ya con `Xsedsar` para su salón.
  {
    slug: 'ketg-sedsar',
    name: 'Ketg\'sedsar — el Salón del Colmillo Ceniza',
    factionSlug: 'Clan Serhu',
    locationSlug: 'campamento-serhu-interior',
    profession: null,
    tier: 3,
    description:
      'La choza más grande de Karot Veku, en el centro del poblado — sede de la Terk\'ikar Ulkha Ketg y el Kort\'ikar Torgash Ketg. Lo que hace de Karot Veku un asentamiento real del Clan Serhu, no solo un campamento de paso.',
  },
  {
    slug: 'herreria-serhu',
    name: 'Herrería del Clan Serhu',
    factionSlug: 'Clan Serhu',
    locationSlug: 'campamento-serhu-interior',
    profession: 'herrero-orcos-llanuras',
    tier: 1,
    // Descripción ampliada (tanda OpenCode 2026-09-27/28, A-09) — encaja con la herrería
    // "mediocre y mal orientada" del canon.
    description:
      'Fragua orca de piedra y arcilla cocida, con el yunque hundido a golpes de generaciones de aprendices, bajo un horno de arcilla endurecida cubierto por una lona de parches y un humo que nunca termina de irse del todo. El Maestro Herrero Serhu funde mena en lingotes para todo el clan.',
  },
  {
    slug: 'curtiduria-serhu',
    name: 'Curtiduría del Clan Serhu',
    factionSlug: 'Clan Serhu',
    locationSlug: 'campamento-serhu-interior',
    profession: 'curtidor-orcos-llanuras',
    tier: 1,
    description:
      'Pieles tensadas en bastidores de madera alrededor de una hoguera baja que nunca se apaga del todo — el olor a curtido llega antes de ver la propia choza. La Maestra Curtidora Serhu trabaja aquí el cuero de la caza del clan.',
  },
  {
    slug: 'cocina-serhu',
    name: 'Cocina común de Karot Veku',
    factionSlug: 'Clan Serhu',
    locationSlug: 'campamento-serhu-interior',
    profession: 'cocinero-orcos-llanuras',
    tier: 1,
    description:
      'Ollas de hierro colgadas sobre brasas siempre vivas, bajo un cobertizo abierto por los cuatro costados para que el humo escape. El Maestro Cocinero Serhu alimenta a todo el clan desde aquí.',
  },

  // Tanda OpenCode 2026-09-27/28 (A-09) — los 5 talleres que `areas.md` ya prometía en el
  // Ketg'lukar y el catálogo no tenía. Mismo patrón que Herrería/Curtiduría/Cocina de arriba:
  // un FactionBuilding por oficio, ocupado por su Maestro ya sembrado (§ npcs, slugs
  // 'maestr[oa]-<oficio>-serhu'), sin receta de `construction.ts` — el jugador no los construye.
  {
    slug: 'herboristeria-serhu',
    name: 'Herboristería del Clan Serhu',
    factionSlug: 'Clan Serhu',
    locationSlug: 'campamento-serhu-interior',
    profession: 'herborista-orcos-llanuras',
    tier: 1,
    description:
      'Estancia baja de adobe con tejado de Musgo Rojo, primer uso real del Musgo Arcilla como material de construcción. De cuerdas de fibra de Enredadera cuelgan a secar manojos de Salvia del Polvo y Flor de Ceniza, sobre mesas de piedra con morteros de hueso. Huele a amargo y a ceniza fría. De aquí sale la cataplasma de salvia que Gorhorn lleva de serie.',
  },
  {
    slug: 'taller-alquimia-serhu',
    name: 'Taller de Alquimia del Clan Serhu',
    factionSlug: 'Clan Serhu',
    locationSlug: 'campamento-serhu-interior',
    profession: 'alquimista-orcos-llanuras',
    tier: 1,
    description:
      'Pegado a la herboristería, separado por una cortina de piel curtida. Tiene un fogón pequeño alimentado con Matorral de Cuerno (arde lento y caliente, la leña que la alquimia necesita), recipientes de cuerno de Múrgol y Flor Salvatura en conserva. Es el único lugar del poblado donde se trabaja a fuego lento y con paciencia, a contrapelo del carácter del clan — los demás Serhu lo miran con cierta desconfianza.',
  },
  {
    slug: 'corrales-domador-serhu',
    name: 'Corrales del Domador',
    factionSlug: 'Clan Serhu',
    locationSlug: 'campamento-serhu-interior',
    profession: 'domador-orcos-llanuras',
    tier: 1,
    description:
      'Recinto dentro de la empalizada con postes de Huesos de Gargantúa traídos del Osario de la Manada — donde el canon dice que "se toma hueso, no se profana", y el Domador es precisamente el oficio ligado a la Gargantúa. Un abrevadero de piedra se llena a mano desde el Pozo de Cauce Viejo. Aquí se aclimatan las bestias recién domadas antes de pasar al gran recinto de Múrgol de fuera; la Terk\'ikar Ulkha Ketg, que es Domadora, lo visita a diario.',
  },
  {
    slug: 'desolladero-serhu',
    name: 'Desolladero del Clan Serhu',
    factionSlug: 'Clan Serhu',
    locationSlug: 'campamento-serhu-interior',
    profession: 'desollador-orcos-llanuras',
    tier: 1,
    description:
      'A sotavento, junto a la salida trasera hacia el recinto de Múrgol. Bastidores de cornamenta de Múrgol para tensar pieles, y un canal de arcilla que saca la sangre fuera de la empalizada. Es el oficio en el que los Serhu destacan de verdad — aquí se venden los Desolladores de sílice.',
  },
  {
    slug: 'carpinteria-serhu',
    name: 'Carpintería del Clan Serhu',
    factionSlug: 'Clan Serhu',
    locationSlug: 'campamento-serhu-interior',
    profession: 'carpintero-orcos-llanuras',
    tier: 1,
    description:
      'Suelo de arcilla y bancos con herramientas de asta y hueso. En soportes de piedra se secan vigas de Telda, impregnadas de Resina Telda Gris. De aquí salen las estacas de la empalizada y los botes de fondo plano del Embarcadero de Ceniza.',
  },

  // Tanda OpenCode / P-10 (2026-09-28, edificios-de-oficio.md § 4) — 3 más de los que faltaban en
  // Karot Veku (Peletería, Sastrería, Casa de curas: los 3 tienen Maestro real ya sembrado) + el
  // Embarcadero de pesca, en Playa de Ceniza Blanca (donde vive el Maestro Pescador Serhu, no en
  // El Embarcadero de Ceniza — esa Location ya tiene su propio ZonePoint EDIFICIO apuntándose a sí
  // misma sin FactionBuilding real detrás, un anti-patrón previo fuera de alcance de esta tanda).
  // Quedan aplazados a propósito: Obrador de piedra (sin Maestro Constructor Serhu sembrado
  // todavía) y la Casa de curas de Helsig (oficio existe, pero sin Maestro real tampoco).
  {
    slug: 'peleteria-serhu',
    name: 'Peletería del Clan Serhu',
    factionSlug: 'Clan Serhu',
    locationSlug: 'campamento-serhu-interior',
    profession: 'peletero-orcos-llanuras',
    tier: 1,
    description:
      'Mesas de corte junto a la curtiduría, donde el cuero ya curtido se cose en capas, capuchas y guantes reales para todo el clan. El Maestro Peletero Serhu da forma aquí a la ropa de abrigo de Karot Veku.',
  },
  {
    slug: 'sastreria-serhu',
    name: 'Sastrería del Clan Serhu',
    factionSlug: 'Clan Serhu',
    locationSlug: 'campamento-serhu-interior',
    profession: 'sastre-orcos-llanuras',
    tier: 1,
    description:
      'Mesas de corte y estanterías de fibra y fieltro, aparte de la peletería porque aquí no se trabaja piel — mochilas, prendas de fibra y algún cosmético real salen de este taller.',
  },
  {
    slug: 'casa-de-curas-serhu',
    name: 'Casa de curas del Clan Serhu',
    factionSlug: 'Clan Serhu',
    locationSlug: 'campamento-serhu-interior',
    profession: 'primeros-auxilios-orcos-llanuras',
    tier: 1,
    description:
      'Camastros y mesas de vendaje junto a la herboristería, donde los heridos del clan se recuperan bajo la vigilancia de la Maestra de Primeros Auxilios Serhu.',
  },
  {
    slug: 'embarcadero-pesca-serhu',
    name: 'Embarcadero de pesca del Clan Serhu',
    factionSlug: 'Clan Serhu',
    locationSlug: 'playa-de-ceniza-blanca',
    profession: 'pescador',
    tier: 1,
    description:
      'Un muelle sencillo en la costa de Playa de Ceniza Blanca, de donde el Maestro Pescador Serhu saca Jashil y Toluh para todo el clan cuando baja desde Karot Veku una temporada.',
  },

  // Clan Helsig (2026-09-13, ampliación de lore/auditoría) — mismo patrón que Karot Veku
  // (Trabajador de Reino, 2026-08-31): salón central + un edificio por oficio con su Maestro real.
  // A diferencia de Serhu (solo 2-3 oficios sembrados de los 11 posibles), aquí se siembran los 6
  // oficios que ya tienen Maestro real en el catálogo (ver worldCatalog.ts § npcs, slugs
  // '*-helsig'), sin dejar ninguno a medias.
  {
    slug: 'helsig-sedsar',
    name: 'Helsig\'sedsar — el Salón de Honor Helado',
    factionSlug: 'Clan Helsig',
    locationSlug: 'campamento-helsig-interior',
    profession: null,
    tier: 3,
    description:
      'La choza más grande de Helske Tugh, en el centro del poblado — lo que hace del campamento un asentamiento real del Clan Helsig, no solo un puesto minero de paso.',
  },
  {
    slug: 'herreria-helsig',
    name: 'Herrería del Clan Helsig',
    factionSlug: 'Clan Helsig',
    locationSlug: 'campamento-helsig-interior',
    profession: 'herrero-orcos-cristal',
    tier: 1,
    description:
      'Fragua orca tallada en la propia roca de la ladera, con el hielo sílice apilado en bloques junto al fuelle. La Maestra Herrera Helsig funde y talla aquí el hielo sílice para todo el clan.',
  },
  {
    slug: 'peleteria-helsig',
    name: 'Peletería del Clan Helsig',
    factionSlug: 'Clan Helsig',
    locationSlug: 'campamento-helsig-interior',
    profession: 'peletero-orcos-cristal',
    tier: 1,
    description:
      'Pieles gruesas curtidas y cosidas contra el frío de Cristal Helado, colgadas a secar bajo un cobertizo cerrado por los cuatro costados. La Maestra Peletera Helsig da forma aquí a capas y forros reales.',
  },
  {
    slug: 'cocina-helsig',
    name: 'Cocina común de Helske Tugh',
    factionSlug: 'Clan Helsig',
    locationSlug: 'campamento-helsig-interior',
    profession: 'cocinero-orcos-cristal',
    tier: 1,
    description:
      'Ollas de hierro sobre brasas protegidas del viento por muros bajos de piedra, bajo un cobertizo cerrado que retiene el calor. El Maestro Cocinero Helsig alimenta a todo el clan desde aquí.',
  },
  {
    slug: 'mina-helsig',
    name: 'Boca de mina del Clan Helsig',
    factionSlug: 'Clan Helsig',
    locationSlug: 'campamento-helsig-interior',
    profession: 'minero-cristal',
    tier: 1,
    description:
      'Entrada excavada en la ladera helada, apuntalada con vigas de madera oscura, de donde el clan extrae el hielo sílice que sostiene su economía. El Maestro Minero Helsig organiza aquí los turnos de mina.',
  },
  {
    slug: 'herboristeria-helsig',
    name: 'Herboristería del Clan Helsig',
    factionSlug: 'Clan Helsig',
    locationSlug: 'campamento-helsig-interior',
    profession: 'herborista-orcos-cristal',
    tier: 1,
    description:
      'Choza de secado con manojos de la escasa vegetación de Cristal Helado colgados del techo, cada uno resistente al frío a su manera. El Maestro Herborista Helsig prepara aquí lo poco que la tierra helada ofrece.',
  },
  {
    slug: 'alquimia-helsig',
    name: 'Taller de alquimia del Clan Helsig',
    factionSlug: 'Clan Helsig',
    locationSlug: 'campamento-helsig-interior',
    profession: 'alquimista-orcos-cristal',
    tier: 1,
    description:
      'Mesa de piedra fría cubierta de frascos y morteros, donde el hielo sílice y las pocas hierbas del clan se combinan en brebajes reales. La Maestra Alquimista Helsig trabaja aquí sus preparados.',
  },

  // Clan Goshg (2026-09-13, ampliación de lore/auditoría) — solo el salón por ahora: a diferencia
  // de Helsig, ningún NPC del Clan Goshg tiene `homeLocationSlug` apuntando todavía al interior
  // nuevo (Doshka/Dulgren siguen en el exterior, `campamento-goshg`) — sin Maestros reales que
  // posicionar, sembrar edificios de oficio vacíos sería anticipar contenido sin sustento, así que
  // se deja para cuando existan esos NPC.
  {
    slug: 'goshg-sedsar',
    name: 'Goshg\'sedsar — el Salón de Piel Musgo',
    factionSlug: 'Clan Goshg',
    locationSlug: 'campamento-goshg-interior',
    profession: null,
    tier: 3,
    description:
      'La choza más grande de Silh Makut, levantada sobre pilotes como el resto del poblado — sede de la Terk\'ikar Doshka y el Kort\'ikar Dulgren.',
  },
];

/// Capacidad de trabajadores por tier (2026-08-31) — mismo espíritu que
/// `companionSlotsForRecipeKey` (construction.ts), pero para catálogo de facción ajena, no Building
/// del jugador. 1=pequeño/2=mediano/3=grande, igual que el resto de tiers de este archivo.
export function tierCapacityFor(tier: number): number {
  return { 1: 1, 2: 3, 3: 6 }[tier] ?? 0;
}
