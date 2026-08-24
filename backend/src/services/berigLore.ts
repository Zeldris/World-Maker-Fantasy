import type { Attribute } from './dice.js';

/// Razas y personajes jugables de Berig (2026-07-22, auditoría de lore vs Enciclopedia —
/// "incluye de momento solo todo lo que sea de Berig"): contenido estático igual que
/// classAbilities.ts/startingAbilities.ts — no hay tabla propia en Prisma, es lore de mundo, no
/// de partida. Vive en el backend (y no solo en el frontend, como al principio) para que
/// loreContextFor() pueda generarles prompts de imagen igual que a NPCs/objetos/fauna — la fuente
/// de verdad editorial sigue siendo docs/rpgtarkor/razas.md y personajes.md.
/// Las otras 4 razas (Kelife/Kalisar/Jusaly/Ilvenar) y los otros 4 personajes (Sael/Ithren/Amonir/
/// Cassia), todos de Vaelira, quedan fuera hasta que el juego llegue allí.

/// Variante regional de una raza (2026-07-22, petición explícita: "al pulsar orcos aun pudiese
/// elegir el tipo según la región" — el color de piel Y la estructura corporal orca cambian por
/// clan/clima, lo bastante distinto como para merecer su propia imagen de referencia, no una sola
/// genérica para los tres). `slug` propio (no comparte el de la raza) para que tenga su propia
/// entrada de ImagePrompt/imagen subida — mismo entityType 'raza', slug distinto.
export interface RazaVariante {
  slug: string;
  name: string;
  /// Etiqueta corta para el selector de variante en la UI ("Llanuras" en vez del nombre completo).
  shortLabel: string;
  rasgoFisico: string;
  description: string;
}

/// Habilidad racial (rediseño de la vista de combate, 2026-07-28) — a diferencia de las
/// habilidades de CLASE (classAbilities.ts, de "seres inteligentes que pueden portar equipo"),
/// esta es una única habilidad compartida por TODA la raza, no algo que se aprenda por nivel.
/// Un `Npc` humanoide tiene esta habilidad como su racial (`Npc.raza` referencia el `slug` de
/// aquí); la fauna no la usa — la suya vive directamente en `Npc.habilidadesRaciales` (hasta 6,
/// categorizada), porque cada fila de fauna en worldCatalog.ts ya es una especie entera.
export interface HabilidadRacial {
  icon: string;
  name: string;
  description: string;
  /// Texto en primera persona que se manda al Narrador al usarla en combate (2026-07-29,
  /// sistema de habilidades por arma/raza — el jugador ahora sí puede usar su racial, antes
  /// nunca se le mostraba). `description` es de cara al tooltip, en 3ª persona.
  promptText: string;
  /// Rediseño del turno de combate (2026-07-28) — "tipo" de la habilidad para la rueda de
  /// debilidades (attributeWheel.ts) y el atributo con el que se tira (mismo campo que ya usan
  /// las habilidades de clase, classAbilities.ts). Elegido por lo que la habilidad representa de
  /// verdad, no por plantilla — nunca el mismo atributo por defecto para todas.
  preferredAttribute: Attribute;
}

/// Tope de 10 habilidades de combate (2026-07-29, "vamos a reducirlo a solo 10 activas en
/// combate máx"): 2 de las 10 son raciales — una de ataque y una de defensa por raza, fijas,
/// nunca las de arma equipada ni las de clase. Repartidas a propósito entre los 7 atributos para
/// que ninguno se quede sin representación real en combate (ver reparto completo en el comentario
/// de BERIG_RAZAS más abajo).
export interface HabilidadesRaciales {
  ataque: HabilidadRacial;
  defensa: HabilidadRacial;
}

export interface RazaInfo {
  slug: string;
  name: string;
  icon: string;
  rasgoFisico: string;
  rasgoCaracter: string;
  description: string;
  habilidadesRaciales: HabilidadesRaciales;
  /// Presente solo en razas con diferenciación regional marcada (hoy: Orcos). El resto se
  /// consulta y se ilustra como una sola entrada, sin selector de variante.
  variantes?: RazaVariante[];
}

export const BERIG_RAZAS: RazaInfo[] = [
  {
    slug: 'goirntes',
    name: 'Goirntes — Los del Orden',
    icon: '⚖️',
    rasgoFisico:
      'Piel casi mineral y quitinosa, gris y tensa sobre huesos angulosos — se endurece y deja ver un tenue brillo metálico cuando se concentran o se esfuerzan. Ojos de un negro obsidiana frío; mentón ancho en los machos, algo más leve en las hembras.',
    rasgoCaracter: 'Fríos, calculadores; el orden y la ley ante todo — el desorden les produce una incomodidad física real.',
    description:
      'En la Meseta del Orden cada Goirnte nace hacia una casta de función y cada objeto tiene un lugar asignado — herencia directa de Goirme. Trabajan la Hierba del Hierro y presumen, con razón, de la mejor metalurgia de Helek Sirik. Su tabú cotidiano es lo inacabado: dejar una tarea a medias o un juramento sin cumplir es casi obsceno. Para la mayoría, la guerra de la Concordia de Hierro es un procedimiento más — órdenes que bajan, se cumplen y se archivan; la facción radical la dirige, la moderada intenta frenarla desde dentro. Elige una variante regional abajo para ver cómo cambia el cuerpo Goirnte según su cercanía a la frontera norte.',
    habilidadesRaciales: {
      // Nueva (2026-07-29, ampliación de 1 a 2 habilidades raciales por raza): fríos y
      // calculadores por naturaleza — el ataque Goirnte por excelencia es leer la guardia
      // ajena con precisión matemática, no la fuerza bruta.
      ataque: {
        icon: '📐',
        name: 'Golpe Calculado',
        description: 'Lee la guardia del enemigo con frialdad absoluta y golpea justo donde el cálculo dice que debe ceder — sin margen de error, sin urgencia.',
        promptText: 'Leo la guardia de mi enemigo con frialdad absoluta y golpeo justo donde el cálculo dice que debe ceder.',
        preferredAttribute: 'inteligencia',
      },
      defensa: {
        icon: '🩶',
        name: 'Piel Quitinosa',
        description: 'Bajo tensión, su piel casi mineral se endurece de golpe y deja ver un tenue brillo metálico — encaja un golpe que a cualquier otro habría derribado.',
        promptText: 'Bajo tensión, mi piel casi mineral se endurece de golpe — encajo el impacto sin ceder terreno.',
        preferredAttribute: 'voluntad',
      },
    },
    // Variantes regionales (2026-07-22, petición explícita): los Goirntes de la frontera norte, ya
    // cerca del Margen Silencioso, se adaptaron físicamente al terreno de selva y desarrollaron un
    // oficio distinto (madera en vez de mineral) — mismo patrón que Orcos/Nabieus/Faerus.
    variantes: [
      {
        slug: 'goirntes-meseta',
        name: 'Goirntes de la Meseta del Orden',
        shortLabel: 'Meseta del Orden',
        rasgoFisico:
          'Piel casi mineral y quitinosa, gris y tensa sobre huesos angulosos — se endurece y deja ver un tenue brillo metálico cuando se concentran o se esfuerzan. Ojos de un negro obsidiana frío; mentón ancho en los machos, algo más leve en las hembras.',
        description:
          'La población base, en el corazón de la Meseta — se dedican casi en exclusiva a la forja y transformación de minerales, la mejor metalurgia de Helek Sirik.',
      },
      {
        slug: 'goirntes-frontera-norte',
        name: 'Goirntes de la Frontera Norte',
        shortLabel: 'Frontera Norte',
        rasgoFisico:
          'Piel de un tono bastante más claro que el resto de los suyos, complexión menos corpulenta y mucho más ágil — adaptados a moverse entre la espesura del Margen Silencioso, en la frontera norte de la Meseta.',
        description:
          'Artesanos de la forja con conocimiento real de maderas distintas, al contrario que sus parientes del sur, dedicados casi en exclusiva a los minerales y su transformación — su cercanía al Margen Silencioso les da acceso a maderas que en el resto de la Meseta apenas se ven.',
      },
    ],
  },
  {
    slug: 'orcos',
    name: 'Orcos — Hijos del Estallido',
    icon: '🪓',
    rasgoFisico:
      'Rasgos tribales; corpulentos, hembras más inteligentes y fuertes, machos más fieros y anchos. El cuerpo entero se adapta al clima de cada clan, no solo el color de piel: los Maktor y Serhu de las Llanuras tienen piel beige/arcilla y complexión de músculo largo hecha para el calor y la carrera; los Helsig de Cristal Helado, piel pálida azulada, cuerpo más recio y compacto con más grasa para retener calor; los Goshg de la Ciénaga Troncal, piel verde musgo veteada de rojo pálido y pies/manos anchos que no se hunden en el barro.',
    rasgoCaracter: "Orgullo, fuerza, honor. Clanes regidos por la Terk'ikar (Jefa) y el Kort'ikar (Jefe de Guerra).",
    description:
      'Nacidos de la magia salvaje de Tarkor, sin Semilla creadora propia. El día a día orco es pastoreo, caza y camino: seguir a los Corredores de Cauce, recolectar Raíz de Fuego con cuidado, migrar cuando la Terk\'ikar pacta con una Gargantúa de Ceniza el transporte del clan entero. Las hembras gobiernan la vida y los machos la guerra — costumbre, no ley. A los recién nacidos se les susurra: "Con ira nos quemaron, con honor nos rebelamos, y aún así nadie domó nuestros caminos" — la misma terquedad explica por qué los orcos no son magos: aunque la magia es poderosa en ellos por su origen, nunca fue el camino que eligieron, así que quien la canaliza (el Chamán) nunca la lanza en crudo, siempre a través de un tótem o una runa. Dos tabúes prácticos: interrumpir un duelo de honor ya aceptado, y tocar el tótem de un clan ajeno sin permiso. Los clanes están divididos ante la guerra — el Clan Maktor, usado como carne de cañón hasta la aniquilación, es el precio más caro que ya se ha pagado. Elige una variante regional abajo para ver cómo cambia el cuerpo orco de clan a clan.',
    habilidadesRaciales: {
      ataque: {
        icon: '🩸',
        name: 'Sangre del Estallido',
        description: 'La magia salvaje que los engendró despierta un instante bajo el dolor o la ira — un segundo aliento de fuerza bruta que ningún cuerpo debería tener.',
        promptText: 'La magia salvaje que corre por mi sangre despierta un instante bajo la ira — descargo un segundo aliento de fuerza bruta.',
        preferredAttribute: 'fuerza',
      },
      // Nueva (2026-07-29) — generaciones de guerra y trabajo forzado curtieron a los orcos
      // para encajar el castigo sin ceder terreno, no solo para devolverlo.
      defensa: {
        icon: '🪨',
        name: 'Piel de Guerra',
        description: 'Encaja el golpe con el cuerpo entero y aguanta el dolor sin ceder ni un paso — generaciones de guerra y trabajo forzado han curtido a los orcos para esto.',
        promptText: 'Encajo el golpe con el cuerpo entero y aguanto el dolor sin ceder ni un paso.',
        preferredAttribute: 'constitucion',
      },
    },
    variantes: [
      {
        slug: 'orcos-llanuras',
        name: 'Orcos de las Llanuras del Viento Rojo (Clanes Maktor y Serhu)',
        shortLabel: 'Llanuras',
        rasgoFisico:
          'Piel en tonos beige y arcilla, curtida por el sol y el viento constante de la estepa — se oscurece más con la edad y la intemperie.',
        description:
          'Complexión corpulenta pero de músculo largo y estilizado, hecha para aguantar carreras bajo el calor del día — perseguir a los Corredores de Cauce en sus cacerías rituales lo exige. Menos grasa corporal que sus primos del norte, para disipar calor, no para retenerlo.',
      },
      {
        slug: 'orcos-cristal-helado',
        name: 'Orcos de Cristal Helado (Clan Helsig)',
        shortLabel: 'Cristal Helado',
        rasgoFisico: 'Piel pálida, con un matiz azulado o gris oscuro bajo la superficie.',
        description:
          'Cuerpo más recio y compacto que el de la estepa — extremidades más cortas en proporción al tronco y una capa de grasa notablemente más gruesa, hechos para retener el calor en vez de perderlo. Manos y dedos gruesos, curtidos por el frío constante de las minas de hielo sílice.',
      },
      {
        slug: 'orcos-cienaga-troncal',
        name: 'Orcos de la Ciénaga Troncal (Clan Goshg)',
        shortLabel: 'Ciénaga Troncal',
        rasgoFisico:
          'Piel de un verde musgo intenso veteado de rojo pálido, camuflaje natural entre el follaje oscuro y el barro de la ciénaga.',
        description:
          'Pies y manos anchos que reparten mejor el peso sobre el barro sin hundirse, y una piel notablemente resistente a la humedad constante — donde otro pueblo sufriría llagas y pudrición, un Goshg apenas lo nota.',
      },
    ],
  },
  {
    slug: 'nabieus',
    name: 'Nabieus — Los que silencian',
    icon: '🌑',
    rasgoFisico: 'Cuerpos delgados, piel gris que no refleja luz, casi sin voz audible.',
    // rasgoCaracter ampliado (auditoría de lore 2026-08-21) — razas.md ya tenía consolidado este
    // rasgo (curiosidad fría, fascinación con la muerte/descomposición/enfermedad como "recursos"
    // en vez de horrores) y esta ficha solo se quedaba con la mitad más corta de la frase.
    rasgoCaracter:
      'Inquietantes por su ausencia, sigilo absoluto. Curiosos y fríos, poco sociables con el resto de razas sin llegar a ser agresivos — ven la muerte como un regalo, la descomposición como transformación y la enfermedad como oportunidad: seres científicos y observadores.',
    description:
      'En la mitad oriental del Margen Silencioso, donde hasta el sonido se apaga de forma antinatural, los silencios tienen sintaxis: hay pausas que afirman, niegan o advierten. Su voz casi inaudible obliga a acercarse, y esa cercanía forzada es para ellos la medida de la confianza; levantar la voz es su tabú — gritar es violencia, se grite lo que se grite. Perseguidos durante el Yugo de Hierro por "operar en la sombra sin autorización del orden", fueron el corazón de la Purga Silenciosa. Alquimistas profesionales, entre los más avanzados de Helek Sirik en el estudio y la escritura. Integrados en la Concordia de Hierro por presión, sirven hoy como mensajeros, correos y ojos desde El Refugio sin Nombre, su enclave más estable, con presencia dispersa hasta el borde de Ciénaga Troncal. Elige una variante regional abajo para ver cómo cambia el cuerpo Nabieus según dónde se críen.',
    habilidadesRaciales: {
      // Nueva (2026-07-29) — "ausencia hecha carne": el propio vacío que los envuelve puede
      // usarse como arma, no solo para desaparecer.
      ataque: {
        icon: '🌌',
        name: 'Golpe del Vacío',
        description: 'Ataca desde un silencio que no debería esconder a nadie — el vacío que lo envuelve parece golpear con él, un instante antes de que el enemigo entienda qué ha pasado.',
        promptText: 'Ataco desde un silencio que no debería esconder a nadie — el vacío que me envuelve parece golpear conmigo.',
        preferredAttribute: 'arcano',
      },
      defensa: {
        icon: '🌑',
        name: 'Silencio Antinatural',
        description: 'Se mueve sin el más mínimo ruido, incluso sobre terreno que delataría a cualquier otro — desaparece de la percepción de su enemigo en el momento justo.',
        promptText: 'Me muevo sin el más mínimo ruido y desaparezco de la percepción de mi enemigo justo a tiempo.',
        preferredAttribute: 'destreza',
      },
    },
    // Variantes regionales (2026-07-22, petición explícita: los Nabieus criados en el borde de
    // Ciénaga Troncal desarrollan mutaciones reales, no solo un matiz de color — mismo patrón que
    // las variantes de Orcos, cada una con su propia imagen independiente.
    variantes: [
      {
        slug: 'nabieus-margen',
        name: 'Nabieus del Margen Silencioso',
        shortLabel: 'Margen Silencioso',
        rasgoFisico: 'Cuerpos delgados, piel gris apagada que no refleja ni absorbe la luz, casi sin voz audible.',
        description:
          'La población base, la más numerosa — dispersa por la mitad oriental del Margen Silencioso, mensajeros, correos y ojos de la Concordia de Hierro desde El Refugio sin Nombre.',
      },
      {
        slug: 'nabieus-cienaga-troncal',
        name: 'Nabieus de la Ciénaga Troncal',
        shortLabel: 'Ciénaga Troncal',
        rasgoFisico:
          'Piel marcada por manchas de un verde oscuro — una mutación real que solo se da en quienes se crían junto a la Ciénaga Troncal — y extremidades notablemente más largas que el resto de los suyos, una adaptación real para cruzar a pie lagunas y aguas altas sin hundirse; postura algo encorvada al caminar, un aspecto notablemente más salvaje que el resto de los suyos.',
        description:
          'Generaciones criadas en el borde de la Ciénaga Troncal, lejos del corazón discreto del Margen Silencioso, han cambiado tanto el cuerpo —brazos y piernas alargados para vadear la ciénaga sin problema— como el temperamento: más volcados en la caza y en trabajar la madera de los Trepadores Ocaso que en el sigilo y los mensajes que definen al resto de su gente.',
      },
    ],
  },
  {
    slug: 'faerus',
    name: 'Faerus — Los furiosos',
    icon: '🐾',
    rasgoFisico: 'Piel de hojas finas, cuerpo fibroso y resistente, postura de 2 a 4 patas.',
    rasgoCaracter: 'Instintivos y bestiales, pero sumamente inteligentes; cazadores.',
    description:
      'Ocupan la mayor parte de la mitad occidental del Margen Silencioso, con pequeños puestos avanzados más allá de la frontera oeste, ya en las Llanuras del Viento Rojo. La manada es la única institución Faerus: se caza junto, se come junto —la primera pieza de cada caza se comparte siempre— y se muere junto; abandonar a un herido de la manada es el tabú que no se perdona. Su olfato lee estados de ánimo: un Faerus sabe si tienes miedo antes que tú. Bajo la apariencia bestial hay una inteligencia fría y observadora. Pese a su carácter salvaje, sienten cierta afinidad con los orcos y mantienen comercio abierto con ellos. Sin escritura, y sin nada parecido a las ciudades-fortaleza Goirntes: sus dos únicos asentamientos, Hashma (en la selva, junto a la costa) y Kegi (en la frontera con las Llanuras), son poblados modestos construidos por y para la manada — además de El Claro de la Manada, un punto de encuentro estacional sin construcción propia para las manadas que no viven en ninguno de los dos poblados. No pertenecen a ninguna alianza — nadie los invitó y ellos no habrían ido; la magia salvaje liberada tras la ruptura ya devastó territorios de manada, y esa es la única parte del conflicto que de verdad les concierne. Elige una variante regional abajo para ver cómo cambia el pelaje Faerus según dónde vive la manada.',
    habilidadesRaciales: {
      ataque: {
        icon: '👃',
        name: 'Olfato de la Manada',
        description: 'Su olfato lee el miedo antes que la propia presa lo sienta — anticipa el momento exacto en que el enemigo flaquea y ataca sin dudarlo.',
        promptText: 'Mi olfato lee el miedo de mi enemigo antes que él mismo lo sienta — ataco en el instante exacto en que flaquea.',
        preferredAttribute: 'destreza',
      },
      // Nueva (2026-07-29) — instintivos pero de manada: aunque estén solos, se plantan como
      // si el resto de la Manada Rota respaldara cada paso.
      defensa: {
        icon: '🐺',
        name: 'Presencia de Manada',
        description: 'Se planta como si toda la manada respaldara cada paso, aunque esté solo — el enemigo duda un instante antes de comprometerse del todo.',
        promptText: 'Me planto como si toda la manada respaldara cada paso, aunque esté solo.',
        preferredAttribute: 'carisma',
      },
    },
    // Variantes regionales (2026-07-22, petición explícita): las manadas que empujaron sus puestos
    // avanzados hacia el norte, dentro de las Llanuras del Viento Rojo, desarrollaron un pelaje
    // distinto por el calor — mismo patrón que las variantes de Orcos/Nabieus.
    variantes: [
      {
        slug: 'faerus-margen',
        name: 'Faerus del Margen Silencioso',
        shortLabel: 'Margen Silencioso',
        rasgoFisico: 'Pelaje denso y tupido en tonos de corteza y musgo, propio del clima húmedo del Margen Silencioso.',
        description: 'La manada base, la más numerosa — vive en el corazón de la selva y los pantanos donde nació la especie.',
      },
      {
        slug: 'faerus-frontera-norte',
        name: 'Faerus de la Frontera Norte',
        shortLabel: 'Frontera Norte',
        rasgoFisico:
          'Pelaje mucho más corto que el del resto de la especie, adaptado al calor seco de las Llanuras — tonos rojizos y verdosos, con el rojo dominando con claridad sobre el verde.',
        description:
          'Manadas que empujaron sus puestos avanzados más allá de la frontera norte, ya dentro de las Llanuras del Viento Rojo — generaciones de calor y polvo rojo de la estepa han moldeado su pelaje de forma bien distinta al resto de los suyos.',
      },
    ],
  },
];

export interface PersonajeInfo {
  slug: string;
  name: string;
  /// Nombre corto alternativo (2026-07-30, auditoría "revisar partida" — linkability): el nombre
  /// completo ("Dessa Kaltrenn") es el único registrado hoy en enciclopediaIndex.ts (frontend);
  /// si la narración solo usa el nombre de pila, no engancha. Solo nombres propios (mismo criterio
  /// de riesgo que Npc.aliases) — nunca un sustantivo genérico.
  aliases?: string[];
  raza: string;
  icon: string;
  personalidad: string;
  facultades: string;
  historia: string;
  voz: string;
}

export const BERIG_PERSONAJES: PersonajeInfo[] = [
  {
    slug: 'gorhorn',
    name: 'Gorhorn',
    raza: 'Orcos de las Llanuras, Clan Maktor',
    icon: '🪓',
    personalidad:
      'Orgulloso pero no arrogante — su honor es la única moneda que le queda. Pese a su apariencia tosca es inteligente, quizás el orco macho que más se acerca a la inteligencia de las hembras. Justo pero bárbaro, con una personalidad afable sorprendente para un orco — aunque la paciencia no es su punto fuerte, y cuando la pierde se ve al "verdadero orco" que hay en él.',
    facultades:
      'Fuerza física colosal, instinto de combate devastador a corta distancia y alta resistencia al dolor. Comunión especial con la naturaleza que le permite, con esfuerzo, domar a las criaturas más poderosas de su territorio.',
    // Historia resincronizada (auditoría de lore 2026-08-21) — esta ficha aún tenía la versión
    // descartada ("el padre muere al nacer Gorhorn, en duelo contra el Clan Serhu"), reemplazada
    // en personajes.md/areas.md/worldCatalog.ts desde 2026-08-03 por la versión canónica: el padre
    // sobrevive al parto y muere 10 años después liderando una revuelta contra el yugo Serhu (ver
    // areas.md#historia-profunda-de-los-cuatro-primeros-orcos-a-gorhorn-añadido-2026-08-03, nota
    // editorial explícita de sustitución). No es una contradicción abierta: la decisión ya está
    // tomada y documentada, solo faltaba propagarla aquí.
    historia:
      'Nació en las llanuras de arena roja. Su madre murió al darle a luz; su padre sobrevivió, pero a los 10 años de Gorhorn lideró una revuelta contra el yugo que el Clan Serhu llevaba generaciones imponiendo a los Maktor — los Goirntes, buscando desprestigiar a los Serhu, orquestaron una incursión que aniquiló al Clan Maktor por completo. Su padre murió en ella; los Serhu se quedaron mirando sin intervenir. Gorhorn escapó, quizás el único superviviente, con el hacha rota de su padre y un trozo del gran tótem del clan, y pasó los 10 años siguientes de ayudante de comerciantes, esclavo de los Goirntes, conviviendo con los Faerus y trabajando para las tribus orcas de la ciénaga y de Cristal Helado —donde perdió un colmillo y forjó la amistad con Hagar—. Ahora lucha de forma independiente para que la muerte de su clan no sea en vano y para restaurar el nombre de los Maktor.',
    voz: 'Habla poco, en frases cortas y directas — su honor se demuestra con hechos, no con palabras. Cuando pierde la paciencia, el silencio se rompe de golpe.',
  },
  {
    slug: 'dessa-kaltrenn',
    name: 'Dessa Kaltrenn',
    aliases: ['Dessa'],
    raza: 'Goirntes',
    icon: '⚖️',
    personalidad:
      'Disciplinada hasta lo rígido, incapaz de tolerar la injusticia procedimental aunque la orden se lo exija; su frialdad es una coraza aprendida.',
    facultades:
      'Percibe el "orden" de las cosas de forma casi física. El caos, las mentiras o una jerarquía rota le causan incomodidad tangible que canaliza en un instinto táctico agudo: detecta al instante el punto débil de una formación, plan o argumento.',
    historia:
      'Soldado rasa de la guardia menor de Berig. Fue una de las encargadas de escoltar el sello de contención hasta la isla la noche en que la facción radical lo rompió. Vio que no hubo sabotaje de Vaelira, sino una traición interna. Denunciarlo por canales oficiales significaba morir; callarlo la destrozaba por dentro. Desertó esa misma noche.',
    voz: 'Habla en enumeraciones y órdenes ("primero... después... y solo entonces..."), y se corrige a media frase cuando se oye a sí misma sonar "a la guardia". Miente mal: en vez de mentir, cambia de tema con brusquedad.',
  },
  {
    slug: 'yerin-slaad',
    name: 'Yerin Slaad',
    aliases: ['Yerin'],
    raza: 'Nabieus',
    icon: '🌑',
    personalidad: 'Observador silencioso, casi invisible. Pasar desapercibido ha sido su único método de supervivencia.',
    facultades:
      'Movimiento absolutamente insonoro; puede permanecer inmóvil sin ser detectado. Identifica mentiras e intenciones en los silencios de una conversación.',
    historia:
      'Mensajero de bajo rango que entregaba correspondencia sellada sin hacer preguntas. Una de las cartas que entregó una semana antes de la ruptura contenía, sin saberlo él entonces, las instrucciones para el sabotaje de la facción radical. La culpa de haber sido el cómplice involuntario de la guerra lo atormenta.',
    voz: 'Voz apenas audible que obliga al interlocutor a inclinarse hacia él; usa las palabras justas y ni una más, y responde muchas preguntas con silencios.',
  },
  {
    slug: 'riko',
    name: 'Riko',
    raza: 'Faerus, de la Manada Rota',
    icon: '🐾',
    personalidad: 'Instintivo y con mentalidad de manada (proteger a los suyos), a pesar de haberlo perdido todo.',
    facultades:
      'Cambio de postura fluido de bípeda (manipulación de herramientas) a cuadrúpeda (velocidad extrema y sigilo). Sentidos hiperdesarrollados e inteligencia sobresaliente bajo una apariencia salvaje.',
    historia:
      'Cazador de las fronteras de Berig. Regresó para encontrar su territorio devastado por la magia salvaje. Sin saber si los supervivientes huyeron o murieron, viaja buscando cualquier rastro u olor que lo guíe de vuelta a su gente.',
    voz: 'Frases cortas, en presente, sin adornos ("Huele mal. Nos vamos."); describe a las personas por su olor antes que por su aspecto ("hueles a miedo y a hierro"). Cuando piensa, emite un gruñido bajo casi inaudible.',
  },
];

/// Raza del PERSONAJE JUGABLE (2026-07-29, sistema de habilidades por arma/raza) — mismo patrón
/// que `startingAbilitiesFor`/`startingInventoryFor` (startingAbilities.ts/startingInventory.ts):
/// keyed por `characterName`, no hay todavía un flujo de creación de personaje libre que permita
/// elegir raza para un personaje nuevo. Slug real de `BERIG_RAZAS` arriba.
export function razaFor(characterName: string): string | null {
  if (characterName === 'Gorhorn') return 'orcos';
  return null;
}
