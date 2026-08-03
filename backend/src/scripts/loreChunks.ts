/// Fragmentos de lore curados a mano a partir de docs/rpgtarkor/*.md, listos para indexar con
/// embeddings (ver reindex-lore.ts). Cada vez que el lore cambie en los .md, actualizar aquí
/// los fragmentos afectados y volver a correr `npm run reindex-lore`.
///
/// Los textos están condensados respecto a la prosa original de los .md (que sigue siendo la
/// fuente de verdad para humanos) — lo suficientemente completos para que el Narrador tenga
/// hechos concretos, sin arrastrar párrafos enteros de más a cada recuperación.

export type LoreChunkType =
  | 'FAUNA'
  | 'FLORA'
  | 'NPC'
  | 'CLAN'
  | 'REGION'
  | 'LOOT'
  | 'CULTURA'
  | 'PERSONAJE'
  | 'CONTRATO'
  | 'GANCHO';

export interface LoreChunkInput {
  type: LoreChunkType;
  title: string;
  text: string;
  tags: string[];
  sourceDoc: string;
}

export const loreChunks: LoreChunkInput[] = [
  // --- genesis.md ---
  {
    type: 'CULTURA',
    title: 'Madre y el origen de Helek Sirik',
    text: 'Madre es un ser primordial de origen incierto. Uno de sus nombres más desconocidos es Helek ("origen" en nohade), de ahí el nombre del planeta: Helek Sirik ("Origen Azul"). Oculta algo cuya naturaleza no se ha revelado — ese secreto es el detonante de la caída de Tarkor. El nohade es la lengua divina creada por Berd para que las Semillas se comunicaran entre sí y con Madre; ningún mortal la ha hablado jamás.',
    tags: ['madre', 'genesis', 'nohade'],
    sourceDoc: 'genesis.md',
  },
  {
    type: 'CULTURA',
    title: 'Las 13 Semillas',
    text: 'Madre creó 13 Semillas. 6 Fieles la sirven sin cuestionarla (Liania, transformación de la materia; Sezix, la muerte y el vacío; Tharlia, ordena los designios; Kroj, dominio desconocido; Goirme, el orden; Lerox, misterioso). 3 Neutrales tienen libre albedrío (Aquello que Brota, origen de los Jusaly; Aquello que Nace, creador de los Faerus; Berd, la información y la tecnología). 4 Perdidas desaparecieron tras conflictos con Madre, la más notable es Tarkor.',
    tags: ['semillas', 'liania', 'sezix', 'tharlia', 'kroj', 'goirme', 'berd'],
    sourceDoc: 'genesis.md',
  },
  {
    type: 'CULTURA',
    title: 'El arco de Tarkor (mito remoto, no participa en el presente)',
    text: 'Tarkor fue la Semilla más sabia y poderosa, la última en crearse y la que más tardó en desarrollarse. Con el tiempo, la Entidad Desconocida (cuya naturaleza ni Madre conoce) le sembró la duda de que Madre ocultaba algo a sus hijas. Tarkor le pidió la verdad; Madre, por miedo, se la negó. Tarkor se marchó, desapareció, y regresó transformado en un ser frío y oscuro cuyo poder dio origen a la magia salvaje y a los Orcos. Este arco pertenece a un pasado remoto, hoy más mito que historia — Tarkor no aparece como personaje activo en el presente narrativo.',
    tags: ['tarkor', 'magia', 'mito'],
    sourceDoc: 'genesis.md',
  },
  {
    type: 'CULTURA',
    title: 'El Estallido y el nacimiento de los Orcos',
    text: 'Las razas "diseñadas" (Kelife, Goirntes, Kalisar, Jusaly, Ilvenar) nacieron del trabajo deliberado de todas las Semillas. Cuando Tarkor regresó transformado, su magia salvaje se derramó sin control sobre Helek Sirik — de esa erupción nacieron los Orcos y otras razas y criaturas salvajes, que se multiplican con una facilidad que ninguna Semilla fiel había previsto.',
    tags: ['orcos', 'magia-salvaje', 'estallido'],
    sourceDoc: 'genesis.md',
  },

  // --- areas.md ---
  {
    type: 'REGION',
    title: 'Geografía global de Helek Sirik',
    text: 'Helek Sirik es un planeta cubierto en un 80% por océano. Dos continentes conocidos en el hemisferio ecuatorial: Vaelira (Kelife) y Berig (Goirntes), separados por un estrecho cubierto de niebla densa y fría permanente. No hay luna convencional: un cinturón de micro-cristales atmosféricos refleja la luz del sol de forma perlada y suave durante la noche.',
    tags: ['geografia', 'niebla', 'sin-luna', 'brillo-perlado'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'REGION',
    title: 'Idiomas de Helek Sirik',
    text: 'Nohade es exclusivo de los dioses. Geniha es la lengua común de Vaelira (oficializada por los Kelife). Kerost es la lengua común de Berig (oficializada por los Goirntes). Cada raza conserva además su propia lengua de clan para el ámbito privado y familiar.',
    tags: ['idiomas', 'geniha', 'kerost'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'REGION',
    title: 'Las Llanuras del Viento Rojo',
    text: 'Territorio orco en Berig: estepa infinita de tierra rojiza y arcillosa, volcanes activos a lo lejos, tormentas de arena magnética. Los clanes orcos pastorean y cazan aquí. Es la región de origen de Gorhorn, del Clan Maktor (aniquilado) y del Clan Serhu (vecino, sigue en pie).',
    tags: ['llanuras', 'gorhorn', 'orcos', 'berig'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'REGION',
    title: 'Cristal Helado',
    text: 'Territorio orco en Berig: zona helada de altas montañas y viento cortante, en gran parte inexplorada. Varias tribus orcas de zonas gélidas viven a los pies de la ladera (Clan Helsig). Condiciones duras, pero con acceso a recursos mineros raros como el hielo sílice, y complicaciones para conseguir comida. Gorhorn trabajó 3 meses en sus minas de joven y allí hizo amistad con un orco llamado Hagar.',
    tags: ['cristal-helado', 'helsig', 'hielo-silice', 'gorhorn', 'hagar'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'REGION',
    title: 'Ciénaga Troncal',
    text: 'Territorio orco en Berig: terreno húmedo, en gran parte inhabitable, con tres pequeñas zonas llanas de árboles oscuros (Trepadores Ocaso). Zona rica en alimento pero pobre en minerales. La habitan dos tribus pequeñas del Clan Goshg — sin conexión previa con Gorhorn.',
    tags: ['cienaga-troncal', 'goshg', 'trepadores-ocaso'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'REGION',
    title: 'Vaelira, el continente Kelife (resumen)',
    text: 'Continente húmedo y antiguo. La Cicatriz de Cristal (territorio Kelife, valle de prismas de cristal habitados). El Susurro de las Raíces (territorio Jusaly, bosque de árboles colosales con aldeas suspendidas). La Costa del Azabache (territorio Kalisar, acantilados y cuevas). Los Ilvenar no tienen reino propio, son archivistas errantes al servicio de las cortes Kelife.',
    tags: ['vaelira', 'kelife', 'jusaly', 'kalisar', 'ilvenar'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'REGION',
    title: 'Berig, el continente Goirntes (resumen)',
    text: 'Continente joven, violento, volcánico. La Meseta del Orden (territorio Goirntes, ciudades-fortaleza de piedra y hierro). El Margen Silencioso (territorio Nabieus/Faerus, selva y pantanos donde el sonido se apaga de forma antinatural). Además de las Llanuras del Viento Rojo, Cristal Helado y Ciénaga Troncal (territorio orco, ver fichas propias).',
    tags: ['berig', 'goirntes', 'nabieus', 'faerus', 'meseta-del-orden'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'FLORA',
    title: 'Flora de Vaelira',
    text: 'Árboles de Hebra Dorada (diseñada): árboles sagrados de savia dorada curativa, usada por los Jusaly en cataplasmas. Flor de Esquirla (salvaje, mutada por Tarkor): pétalos casi cristalizados que, al pisarse o cortarse sin cuidado, estallan liberando polvo cortante y una descarga mágica inestable que perturba los sentidos.',
    tags: ['flora', 'vaelira', 'hebra-dorada', 'flor-de-esquirla'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'FAUNA',
    title: 'Fauna de Vaelira',
    text: 'Susurradores de Cristal: insectoides pequeños que emiten un zumbido armónico calmante. Acechadores de la Bruma: grandes depredadores de pelaje semitranslúcido que cazan por calor y miedo, el mayor peligro entre ciudades Kelife y bosques Jusaly.',
    tags: ['fauna', 'vaelira'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'FLORA',
    title: 'Flora de Berig (incluye Llanuras del Viento Rojo)',
    text: 'Hierba del Hierro (diseñada): usada por los Goirntes para extraer aleaciones metálicas. Raíz de Fuego (salvaje, mutada): enredadera de zonas volcánicas orcas que libera gas inflamable, recolectada como explosivo/iniciador de fuego. Hielo Sílice: mineral de Cristal Helado usado para herramientas y cuchillos, como el de Gorhorn. Trepadores Ocaso: árboles de la Ciénaga Troncal.',
    tags: ['flora', 'berig', 'raiz-de-fuego', 'hielo-silice'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'FAUNA',
    title: 'Fauna de Berig y las Llanuras del Viento Rojo',
    text: 'Gargantúas de Ceniza: reptiles gigantes que las Terk\'ikar guían en migraciones estacionales. Las Sombras de Kroj: criaturas voladoras nocturnas del Margen Silencioso que imitan voces para atraer viajeros a trampas. Cornantes: alimento principal en la Ciénaga Troncal. Corredores de Cauce: manadas veloces de seis patas en las Llanuras del Viento Rojo, cazadas en carreras rituales de valor. Espina del Viento: criaturas venenosas enterradas en la arena roja que atacan durante las tormentas de arena magnética — el peligro cotidiano de viajar solo por las Llanuras.',
    tags: ['fauna', 'llanuras', 'espina-del-viento', 'corredores-de-cauce', 'gargantuas-de-ceniza'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'CLAN',
    title: 'Cultura y liderazgo de los clanes orcos',
    text: 'En la mayoría de los clanes orcos, la Terk\'ikar (Jefa, casi siempre hembra) gobierna el día a día — asentamientos, disputas, migraciones. El Kort\'ikar (Jefe de Guerra, casi siempre macho) lidera en combate. Es costumbre cultural asentada, no ley escrita; se puede llegar a Kort\'ikar por duelo de honor.',
    tags: ['clanes', 'terkikar', 'kortikar', 'liderazgo-orco'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'CLAN',
    title: 'Clan Maktor (el clan de Gorhorn)',
    text: 'Clan de las Llanuras del Viento Rojo, aniquilado por una incursión Goirnte orquestada para desprestigiar al Clan Serhu (que se quedó mirando sin intervenir). El padre de Gorhorn, cansado del yugo Serhu, lideraba una revuelta cuando ocurrió, y murió en ella. Gorhorn es, hasta donde él sabe, el único superviviente. Sin Terk\'ikar ni Kort\'ikar vivos, el nombre no tiene ya peso político ni militar — restaurarlo es una cuestión de honor personal para Gorhorn.',
    tags: ['clan-maktor', 'gorhorn'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'CLAN',
    title: 'Clan Serhu',
    text: 'Clan vecino y rival de los Maktor en las Llanuras del Viento Rojo, fundado generaciones atrás por el usurpador Ketg. Se quedaron mirando sin intervenir mientras los Goirntes aniquilaban lo que quedaba de los Maktor. Sigue en pie. Su relación con Gorhorn queda abierta: puede ser un puente hacia comunidad o una fuente de rencor, ahora con una razón concreta y reciente (la inacción durante la caída de los Maktor).',
    tags: ['clan-serhu', 'gorhorn'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'CLAN',
    title: 'Clan Helsig y Clan Goshg',
    text: 'Clan Helsig: tribus de Cristal Helado, expertas en trabajar el hielo sílice. Gorhorn trabajó 3 meses en sus minas y forjó amistad real con un orco llamado Hagar. Clan Goshg: las dos tribus de la Ciénaga Troncal, viven de los Trepadores Ocaso y los Cornantes — territorio completamente nuevo para Gorhorn.',
    tags: ['clan-helsig', 'clan-goshg', 'hagar', 'gorhorn'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'CULTURA',
    title: 'Tarkor en la cultura orca',
    text: 'Los orcos no adoran a Tarkor como dios ni lo temen como demonio — lo tratan como a un ancestro incómodo. Casi ningún orco conoce su arco completo. Corre de generación en generación una frase de cuna: "Con ira nos quemaron, con honor nos rebelamos, y aún así nadie domó nuestros caminos" — recuerda que su origen es caos sin diseño, y que lo que los distingue es lo que cada uno decide hacer con esa ira.',
    tags: ['tarkor', 'cultura-orca', 'frase-de-cuna'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'LOOT',
    title: 'Armamento orco típico',
    text: 'Hachas de guerra y mazas son el arma orca por excelencia — pesadas, directas. La de Gorhorn está rota y la usa como maza. Cuchillos de hielo sílice: filo mineral, típico de quien comercia con el Clan Helsig, como Gorhorn. Lanzas de hueso de Gargantúa: usadas en cacerías rituales y duelos de honor. Amuletos y abalorios de hueso (vértebras, colmillos, garras) son casi universales como trofeo o recuerdo — Gorhorn los lleva en sus trenzas.',
    tags: ['armas', 'orcos', 'hacha-de-guerra', 'cuchillo-hielo-silice'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'LOOT',
    title: 'Loot potencial en las Llanuras del Viento Rojo',
    text: 'Veneno de Espina del Viento (extraído con cuidado): alterador de percepción del dolor. Pieles de Corredor de Cauce: ligeras, resistentes al calor, usadas en ropa de viaje. Placas óseas de Gargantúa de Ceniza: material de construcción/armadura pesado. Restos de campamento de la Concordia de Hierro: raciones, correspondencia sellada, a veces armas Goirntes más refinadas que las orcas. Marcas y tótems de clan rotos: sin valor material pero gran peso narrativo.',
    tags: ['loot', 'llanuras', 'espina-del-viento', 'concordia'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'REGION',
    title: 'La Hondonada del Eco (Llanuras del Viento Rojo) — lugar seguro para acampar o descansar',
    text: 'Un buen lugar seguro para acampar, descansar o pasar la noche en las Llanuras del Viento Rojo: una depresión profunda en el terreno, con paredes de arcilla endurecida que cortan el viento y amortiguan el sonido (de ahí el nombre: la voz rebota dentro). Da refugio y protección real contra el viento y las tormentas de arena magnética. El único riesgo es que, al estar hundida, no se ve quién se acerca por arriba hasta que es tarde.',
    tags: ['llanuras', 'refugio', 'campamento', 'punto-de-interes'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'REGION',
    title: 'Los Pilares Rotos (Llanuras del Viento Rojo)',
    text: 'Restos de una formación rocosa antigua, hoy tres columnas erosionadas visibles desde lejos en la llanura abierta. Sirven de punto de referencia para orientarse, y su sombra da algo de resguardo del sol a mediodía. Terreno abierto, no defendible.',
    tags: ['llanuras', 'punto-de-interes', 'orientacion'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'REGION',
    title: 'El Pozo de Cauce Viejo (Llanuras del Viento Rojo)',
    text: 'Uno de los pocos puntos de agua permanentes de las Llanuras del Viento Rojo, alimentado por la misma corriente subterránea que siguen los Corredores de Cauce en sus migraciones. Punto de encuentro habitual entre quien viaja por la región, para bien o para mal.',
    tags: ['llanuras', 'agua', 'punto-de-interes'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'REGION',
    title: 'El Cruce de las Cenizas (Llanuras del Viento Rojo)',
    text: 'Punto donde el camino que viene de la Meseta del Orden se bifurca hacia el interior de las Llanuras del Viento Rojo. Zona de paso habitual de las patrullas de la Concordia de Hierro — no es lugar para quedarse quieto mucho tiempo.',
    tags: ['llanuras', 'concordia', 'camino', 'punto-de-interes'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'REGION',
    title: 'Los Restos de Maktor (Llanuras del Viento Rojo)',
    text: 'Ubicación aproximada del último asentamiento del Clan Maktor antes de su aniquilación — hoy poco más que cimientos quemados y arcilla removida. Gorhorn, único superviviente conocido del clan, no ha vuelto todavía.',
    tags: ['llanuras', 'clan-maktor', 'gorhorn', 'punto-de-interes'],
    sourceDoc: 'areas.md',
  },

  // --- historia.md ---
  {
    type: 'CONTRATO',
    title: 'Los Ciclos históricos de Helek Sirik',
    text: 'La Edad Dorada del Cristal (Vaelira) terminó en un cisma entre casas Kelife. El Yugo de Hierro (Berig) sometió a Orcos y persiguió a Nabieus, hasta la Purga Silenciosa que forzó autonomía parcial. La Guerra de la Isla Cambiante se libró por una isla de forma cambiante en el estrecho entre continentes, poblada por seres que nadie que los viera sobrevivía para describir; terminó en un tratado frágil de vigilancia conjunta. El patrón de fondo de la historia de Helek Sirik es: prosperidad, fractura interna, represión, guerra, tregua.',
    tags: ['historia', 'isla-cambiante', 'purga-silenciosa'],
    sourceDoc: 'historia.md',
  },
  {
    type: 'CONTRATO',
    title: 'El presente: la guerra entre Vaelira y Berig',
    text: 'Tras la Paz Templada, una facción radical Goirntes fuerza un asalto a la Isla Cambiante; sale mal, y la isla desaparece, apareciendo un continente nuevo al norte oculto tras un muro de obsidiana. Cada bando culpa al otro. Estalla la guerra: la Alianza de la Rama Blanca (Vaelira: Kelife, Jusaly, Kalisar, Ilvenar divididos) contra la Concordia de Hierro (Berig: facción radical Goirntes, Orcos y Nabieus integrados de grado o por presión). Del nuevo continente emergen seres elementales tipo colmena cuyo único propósito parece ser "purgar" — nadie sabe por qué, solo que es parte del "plan" de Madre.',
    tags: ['guerra', 'alianza-rama-blanca', 'concordia-de-hierro', 'presente'],
    sourceDoc: 'historia.md',
  },

  // --- razas.md ---
  {
    type: 'PERSONAJE',
    title: 'Las 8 razas jugables de Helek Sirik',
    text: 'Kelife (Vaelira, Semilla Liania): piel cristalina, cercanos a lo humano. Goirntes (Berig, Semilla Goirme): piel gris, fríos y calculadores. Kalisar (Vaelira, Semilla Sezix): piel azabache, sufren la luz, afables pese a fama de asesinos. Jusaly (Vaelira, "Aquello que Brota"): elementos vegetales, agrarios y longevos. Orcos (Berig, Tarkor/magia salvaje): corpulentos, honor y fuerza, clanes con Terk\'ikar y Kort\'ikar. Nabieus (Berig, Semilla Kroj): ausencia hecha carne, sigilo absoluto. Faerus (Berig, "Aquello que Nace"): bípedos/cuadrúpedos, instintivos pero muy inteligentes. Ilvenar (Vaelira, Semilla Berd): archivistas de memoria perfecta, neutrales.',
    tags: ['razas', 'kelife', 'goirntes', 'kalisar', 'jusaly', 'orcos', 'nabieus', 'faerus', 'ilvenar'],
    sourceDoc: 'razas.md',
  },

  // --- personajes.md ---
  {
    type: 'PERSONAJE',
    title: 'Gorhorn, guerrero del Clan Maktor (personaje de pruebas)',
    text: 'Orco de las Llanuras del Viento Rojo, único superviviente conocido del Clan Maktor tras ser usados como carne de cañón por el mando Goirntes. Orgulloso pero no arrogante, sorprendentemente afable para un orco, aunque con poca paciencia una vez la pierde. Fuerza física colosal, instinto de combate a corta distancia, alta resistencia al dolor, y comunión especial con la naturaleza (puede domar criaturas poderosas de su territorio). Mide 1,98m, colmillos medios (uno con prótesis de hielo sílice), pelo negro con trenzas de apliques azules, perilla en dos trenzas con enganches de hueso, tres cicatrices de latigazos en la espalda de sus años de trabajo forzado. Inventario: hacha de guerra rota usada como maza, cuchillo de hielo sílice, raciones para 5 días, arnés de cuero, capa de piel de gargantúa, y un tótem de madera de ciénaga del Clan Maktor — su objeto más importante. Ahora lucha de forma independiente para que la muerte de su clan no sea en vano.',
    tags: ['gorhorn', 'orcos', 'clan-maktor', 'personaje-principal'],
    sourceDoc: 'personajes.md',
  },
  {
    type: 'PERSONAJE',
    title: 'Los otros 7 personajes pregenerados (presente)',
    text: 'Sael Vhorn (Kelife): tallador de cristal que lee tensiones estructurales, prudente y observador. Dessa Kaltrenn (Goirntes): desertora de la guardia, percibe el orden de las cosas, instinto táctico. Ithren Vosk (Kalisar): espía criado para la vulnerabilidad de su reino, sigilo extraordinario, sufre la luz directa. Amonir Thess (Jusaly): agricultor con vínculo vegetal y curación, perdió su tierra a la magia salvaje. Yerin Slaad (Nabieus): mensajero de movimiento insonoro, atormentado por haber sido cómplice involuntario del sabotaje que desató la guerra. Riko (Faerus): cazador de la Manada Rota, cambia entre postura bípeda y cuadrúpeda, busca a los suyos. Cassia Von-Thair (Ilvenar): archivista con psicometría táctil y memoria perfecta, censurada por descubrir una tercera presencia en el sello roto. Ninguno se conoce entre sí al comienzo.',
    tags: ['sael-vhorn', 'dessa-kaltrenn', 'ithren-vosk', 'amonir-thess', 'yerin-slaad', 'riko', 'cassia-von-thair'],
    sourceDoc: 'personajes.md',
  },
  // --- npcs.md ---
  {
    type: 'NPC',
    title: 'NPCs del presente (Berig)',
    text: 'General Vrask Ombra: mando militar de la Concordia, sospecha en privado que la versión oficial es mentira. Jefe de Guerra Torgash: líder orco que busca sacar a su pueblo de una guerra que no les pertenece. Kael Dorn: exmiembro de la facción radical que ayudó a romper el sello, vive escondido por la culpa. Archimagistrada Yovenne Tal: facción moderada Goirntes, intenta frenar a los radicales.',
    tags: ['npcs', 'berig', 'torgash', 'vrask-ombra'],
    sourceDoc: 'npcs.md',
  },
  {
    type: 'NPC',
    title: 'NPCs del presente (Vaelira y neutrales)',
    text: 'Lady Ilsevar Kron: cabeza de una gran casa Kelife, manipula la Alianza de la Rama Blanca. Sanadora Meva Ist: atiende refugiados Jusaly, detecta patrones anómalos en cómo la magia salvaje altera los cuerpos. Cronista Perel Vantha: compañera de Cassia, decidió callar para salvar su vida. Old Marek: pescador que fue el primero en avistar luces anómalas en el fondo marino, nadie le cree. Brann el Cambista: contrabandista neutral del estrecho. Sella Marn (Nabieus): traficante de información sin lealtades, conocida de Yerin.',
    tags: ['npcs', 'vaelira', 'ilsevar-kron', 'meva-ist'],
    sourceDoc: 'npcs.md',
  },

  // --- 07-mundo-helek-sirik.md (contrato) ---
  {
    type: 'CONTRATO',
    title: 'Contrato de mundo: tono, letalidad, magia, tecnología',
    text: 'Tono épico y trágico: pueblos que se creen en lo correcto libran una guerra sobre una verdad que nadie tiene completa, en un mundo tan pequeño (máximo ~6.000 habitantes en la mayor civilización) que cada muerte deja cicatriz. Letalidad media: la muerte de un personaje con nombre es rara y con peso, nunca casual. Magia (arcano y otras 5 escuelas: elementos, oscura, purificadora, naturaleza, dominio) siempre conlleva un pequeño riesgo narrativo incluso en éxito. Tecnología medieval-fantástica, sin pólvora; Berig con metalurgia algo más avanzada.',
    tags: ['contrato', 'tono', 'letalidad', 'magia', 'tecnologia'],
    sourceDoc: '07-mundo-helek-sirik.md',
  },

  // --- personajes.md § Ganchos de aventura (Gorhorn) — añadido 2026-07-18 a petición de la
  // usuaria de seguir ampliando contexto para que el Narrador tenga más material concreto con
  // el que resolver encuentros y sucesos, no solo entorno pasivo. Redactados con vocabulario que
  // un jugador realmente escribiría (patrullas, rastro, tormenta, campamento...), no solo
  // descripción enciclopédica — lección de la investigación de calidad del RAG (2026-07-18).
  {
    type: 'GANCHO',
    title: 'Encontrarse una patrulla de la Concordia buscando desertores',
    text: 'Si Gorhorn se cruza con una patrulla armada en las Llanuras del Viento Rojo, lo más probable es que sean Goirntes o de otro clan orco alistado, buscando desertores o rezagados del frente. Gorhorn encaja en esa descripción a ojos de cualquiera que no conozca su historia — puede intentar evitarlos, enfrentarse a ellos, o intentar convencerlos de que no es lo que buscan.',
    tags: ['gancho', 'llanuras', 'patrulla', 'concordia', 'desertores'],
    sourceDoc: 'personajes.md',
  },
  {
    type: 'GANCHO',
    title: 'Toparse con jóvenes orcos cazando en una carrera ritual',
    text: 'Un grupo de jóvenes de algún clan (probablemente Serhu) puede estar cazando Corredores de Cauce en una prueba de valor ritual. Sería el primer contacto de Gorhorn con orcos vivos desde la aniquilación de su clan Maktor — puede acercarse a observar, unirse a la carrera, o mantenerse alejado.',
    tags: ['gancho', 'llanuras', 'clan-serhu', 'corredores-de-cauce', 'caceria-ritual'],
    sourceDoc: 'personajes.md',
  },
  {
    type: 'GANCHO',
    title: 'Toparse con un nido de Espina del Viento',
    text: 'Un nido de Espina del Viento es un peligro puro del terreno, sin ninguna intención detrás — pone a prueba el sigilo o la percepción de quien se acerca antes que la fuerza. Puede aparecer mientras Gorhorn viaja, acampa o busca refugio en las Llanuras del Viento Rojo.',
    tags: ['gancho', 'llanuras', 'espina-del-viento', 'peligro-ambiental'],
    sourceDoc: 'personajes.md',
  },
  {
    type: 'GANCHO',
    title: 'Rastro o indicio de otro superviviente del Clan Maktor',
    text: 'Un rumor, un tótem roto, o una marca de clan reconocible pueden sugerir que Gorhorn no es el único superviviente del Clan Maktor. Es un gancho de largo recorrido, no algo que se resuelva en una sola conversación o acción — puede aparecer como algo que Gorhorn encuentra, escucha mencionar, o le cuentan de pasada.',
    tags: ['gancho', 'clan-maktor', 'superviviente', 'rastro'],
    sourceDoc: 'personajes.md',
  },
  {
    type: 'GANCHO',
    title: 'Tormenta de arena magnética durante un viaje',
    text: 'Las tormentas de arena magnética de las Llanuras del Viento Rojo son un obstáculo de viaje real — dificultan orientarse, exigen resistencia, y pueden obligar a buscar refugio con poco margen de tiempo. No hace falta que aparezca ningún personaje nuevo para que sea una amenaza seria.',
    tags: ['gancho', 'llanuras', 'tormenta-de-arena', 'clima', 'viaje'],
    sourceDoc: 'personajes.md',
  },
  {
    type: 'GANCHO',
    title: 'Un Kort\'ikar de otro clan en apuros',
    text: 'Gorhorn puede encontrarse con un jefe de guerra (Kort\'ikar) de otro clan orco, posiblemente del Clan Serhu, en una situación comprometida — herido, emboscado, o en desventaja. Decidir ayudarlo, negociar con él, o pasar de largo tiene consecuencias reales para la reputación de Gorhorn entre los clanes orcos.',
    tags: ['gancho', 'kortikar', 'clan-serhu', 'reputacion'],
    sourceDoc: 'personajes.md',
  },

  // --- docs/12-mundo-estructurado.md: contenido nuevo (Torgash concretado, Ulkha, Hagar
  // ampliado, Campamento Serhu, 4 especies nuevas) — SIN números: los stats y el equipo llegan
  // siempre por Npc/NpcItem (vía determinista), nunca por RAG, para que nunca puedan desincronizarse.
  {
    type: 'NPC',
    title: "Kort'ikar Torgash, del Clan Serhu",
    text: 'Torgash es el Kort\'ikar (Jefe de Guerra) del Clan Serhu, vecino y rival histórico del extinto Clan Maktor de Gorhorn. Veterano de las escaramuzas fronterizas, ascendió al puesto cuando su predecesor murió en el frente. Carga en silencio con el peso de la incursión Goirnte que aniquiló al Clan Maktor mientras su propio clan se quedaba mirando sin intervenir — no fue decisión suya, era joven y sin mando entonces. Busca, en silencio y contra la costumbre, unificar a los clanes orcos para retirarlos de la guerra de la Concordia de Hierro: los Serhu vieron de cerca lo que la Concordia hizo con los Maktor y no quieren ser los siguientes. Es grave, económico con las palabras, y pragmático hasta rozar la herejía cultural — prefiere pactar a duelar. Detesta a la Concordia en silencio. Se le encuentra en el Campamento del Clan Serhu, o en ruta si algo lo saca de allí.',
    tags: ['torgash', 'kortikar', 'clan-serhu', 'npc-principal'],
    sourceDoc: 'npcs.md',
  },
  {
    type: 'NPC',
    title: "Terk'ikar Ulkha, del Clan Serhu",
    text: 'Ulkha es la Terk\'ikar (Jefa) del Clan Serhu — gobierna el asentamiento, el pastoreo y las migraciones. Fue ella quien decidió no acoger a los supervivientes del Clan Maktor tras su aniquilación: no por crueldad, sino por cálculo de supervivencia — acogerlos habría puesto una diana sobre su propio clan, con la Concordia todavía buscando rezagados. Que Gorhorn siga vivo la enfrenta de nuevo a esa decisión. Es fría en el cálculo y cálida en el trato, en ese orden; comulga con las Gargantúas de Ceniza durante las migraciones, como es costumbre entre las Terk\'ikar. Se le encuentra en el Campamento del Clan Serhu.',
    tags: ['ulkha', 'terkikar', 'clan-serhu', 'npc-principal'],
    sourceDoc: 'npcs.md',
  },
  {
    type: 'NPC',
    title: 'Hagar, del Clan Helsig (amigo de Gorhorn)',
    text: 'Hagar es un orco del Clan Helsig, de Cristal Helado, minero de hielo sílice. Gorhorn trabajó tres meses codo con codo con él en las minas y forjaron una amistad real — Hagar es leal, ruidoso y de risa fácil, el opuesto exacto del Gorhorn callado de aquellos años, y por eso encajaron. Vive lejos de las Llanuras del Viento Rojo, en Cristal Helado, pero sigue siendo el vínculo personal vivo de Gorhorn: un mensaje, un viaje o un rumor pueden traerlo de vuelta a la historia en cualquier momento.',
    tags: ['hagar', 'clan-helsig', 'gorhorn', 'npc-principal'],
    sourceDoc: 'npcs.md',
  },
  {
    type: 'REGION',
    title: 'Campamento del Clan Serhu (Llanuras del Viento Rojo)',
    text: 'Asentamiento del Clan Serhu, situado cerca del Pozo de Cauce Viejo del que dependen para el agua permanente — un clan que pastorea y caza necesita esa fuente, y explica por qué el Pozo es punto de encuentro entre clanes "para bien o para mal". Hogar de la Terk\'ikar Ulkha y el Kort\'ikar Torgash. Sus vigías vigilan la senda de acceso desde lejos: quien se acerca, se acerca visto.',
    tags: ['campamento-serhu', 'clan-serhu', 'punto-de-interes', 'torgash', 'ulkha'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'FAUNA',
    title: 'Corretolvas (Llanuras del Viento Rojo)',
    text: 'Criaturas corredoras incapaces de volar, de tamaño pequeño, que se mueven en bandadas entre la hierba rojiza de la llanura. Se cazan con trampa sencilla o lanza corta — son la caza menor más accesible de la región, buena fuente de carne fresca sin necesidad de perseguir presas grandes o peligrosas.',
    tags: ['corretolvas', 'fauna', 'llanuras', 'caza-menor'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'FLORA',
    title: 'Salvia del Polvo (Llanuras del Viento Rojo)',
    text: 'Mata baja de hojas grises y aroma amargo que crece en hondonadas y zonas de sombra de las Llanuras. Machacada, corta hemorragias y limpia heridas — cualquier orco de las Llanuras la reconoce desde niño, no hace falta ser sanador para identificarla y usarla en un apuro.',
    tags: ['salvia-del-polvo', 'flora', 'medicinal', 'llanuras'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'FLORA',
    title: 'Espiga Roja (Llanuras del Viento Rojo)',
    text: 'Cereal silvestre de la estepa, del mismo color que la tierra rojiza que lo rodea. Su grano es comestible tostado, y también sirve como forraje. Recolectarlo lleva su tiempo — cuanto más rato se dedique a la espiga, más grano se junta.',
    tags: ['espiga-roja', 'flora', 'alimento', 'llanuras'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'FLORA',
    title: 'Matorral de Cuerno (Llanuras del Viento Rojo)',
    text: 'Arbusto de madera densa y retorcida que arde lento y caliente — la única leña real de la llanura abierta de las Llanuras del Viento Rojo. Cortarlo es la fuente de leña de la región, útil para cualquiera que necesite fuego para pasar la noche o cocinar.',
    tags: ['matorral-de-cuerno', 'flora', 'leña', 'llanuras'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'GANCHO',
    title: 'Acercarse al Campamento del Clan Serhu',
    text: 'El Campamento del Clan Serhu se ve venir desde lejos por sus propios vigías — nadie llega sin ser visto primero. Presentarse abiertamente, intentar acercarse sin ser notado, o esperar a ver quién sale a su encuentro son formas muy distintas de empezar el contacto con Torgash o Ulkha, con consecuencias distintas para cómo lo reciben.',
    tags: ['gancho', 'campamento-serhu', 'clan-serhu', 'torgash', 'ulkha'],
    sourceDoc: 'areas.md',
  },
];
