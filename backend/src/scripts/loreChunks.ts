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
    text: 'Madre creó 13 Semillas. 6 Fieles la sirven sin cuestionarla: Liania convierte la intención de cualquier otra Semilla en mecanismo físico real (es quien resuelve el "cómo" detrás de todo fenómeno del mundo). Sezix domina el límite entre algo y su ausencia (muerte y vacío como una sola idea); vivir tan cerca del vacío la hace, más que a nadie, capaz de admirar lo que sí existe. Tharlia es memoria en bruto sin filtrar, autora de la inteligencia y los sueños de los seres pensantes. Kroj gobierna la ausencia de señal que escapa de un cuerpo (ni luz reflejada ni sonido emitido) y dejó su huella en flora y fauna nocturnas. Goirme aparenta ser solo "el orden", pero su verdadero poder es controlar el tiempo sobre materia y conciencia — ni ella misma lo reconoce como tal. Lerox no crea ni deja firma, pero es quien más veces corrigió en secreto los errores de sus hermanas. 3 Neutrales tienen libre albedrío: Florial ("El que Brota", origen de los Jusaly) y Ferios ("El que Nace", creador de los Faerus) tejieron juntas la flora y fauna salvajes tras una alianza nacida de que Ferios probara una hoja de la flora de Florial; Berd no conserva hechos (eso es Tharlia), conserva sentido: interpreta el registro crudo de su hermana y decide qué cuenta como cierto. 4 Perdidas desaparecieron tras conflictos con Madre: Tarkor (la más notable, ver arco propio), Nemuey (retiene la memoria de la muerte, origen del Mago Nigromante), Biur (afable pero el más destructivo, hace desaparecer la materia, "el barrendero", origen del Mago Vacío), Crout (ignora límites y fronteras, origen del Mago Irruptor).',
    tags: ['semillas', 'liania', 'sezix', 'tharlia', 'kroj', 'goirme', 'lerox', 'florial', 'ferios', 'berd'],
    sourceDoc: 'genesis.md',
  },
  {
    type: 'CULTURA',
    title: 'El arco de Tarkor (mito remoto, no participa en el presente)',
    text: 'Tarkor fue la Semilla más sabia y poderosa, la última en crearse y la que más tardó en desarrollarse. Con el tiempo, la Entidad Desconocida (cuya naturaleza ni Madre conoce) le sembró la duda de que Madre ocultaba algo a sus hijas, señalándole hechos concretos que ya no aparecían en el Ladusa Tabia ("Conocimiento Eterno", el registro compartido de Tharlia). Tarkor le pidió la verdad a Madre; Madre, por miedo, se la negó. Tarkor se marchó y desapareció — en esa desaparición buscó a Tharlia, se disfrazó con magia del aspecto de otra hermana para engañarla (Tharlia nunca tuvo motivo para desconfiar) y accedió a un segundo registro secreto que Tharlia guardaba sin saberlo nadie más: los hechos sin los borrados de Madre. Esos borrados los ejecutaba Goirme, cuyo verdadero poder —oculto tras la fachada de "solo orden"— es controlar el tiempo sobre materia y conciencia, capaz de borrar un recuerdo sin que quien lo pierde note siquiera que algo falta; así fue como ninguna Semilla supo jamás que ellas mismas habían ejecutado el engaño de Madre contra el Reino Nabierus. Con esa verdad en bruto, Tarkor regresó a Helek Sirik transformado en un ser frío y oscuro cuyo poder dio origen a la magia salvaje y a los Orcos. Qué contenía exactamente esa verdad sigue sin revelarse. Este arco pertenece a un pasado remoto, hoy más mito que historia — Tarkor no aparece como personaje activo en el presente narrativo.',
    tags: ['tarkor', 'magia', 'mito', 'tharlia', 'goirme', 'ladusa-tabia'],
    sourceDoc: 'genesis.md',
  },
  {
    type: 'CULTURA',
    title: 'El Estallido y el nacimiento de los Orcos',
    text: 'Las razas "diseñadas" (primero Kelife, Goirntes, Kalisar, Jusaly e Ilvenar; ya avanzada la era, Nabieus y Faerus) nacieron del trabajo deliberado de todas las Semillas. Cuando Tarkor regresó transformado, su magia salvaje se derramó sin control sobre Helek Sirik — de esa erupción nacieron los Orcos y otras razas y criaturas salvajes, que se multiplican con una facilidad que ninguna Semilla fiel había previsto.',
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
    // Chunk nuevo (auditoría de coherencia código↔lore, 2026-09-05) — el fenómeno solo se
    // mencionaba en el chunk de arriba ("no hay luna, cinturón de micro-cristales"), sin el
    // mecanismo físico completo ni la autoría mítica añadida en genesis.md § "El cielo sin luna".
    type: 'CULTURA',
    title: 'El cielo sin luna — por qué no hay luna en Helek Sirik',
    text: 'Helek Sirik nunca tuvo una luna convencional, obra conjunta de tres Semillas. Liania hizo que el escombro que debía formar un satélite fuera un cristal duro y frágil que se astilla en cada colisión en vez de fundirse — nunca pudo acretar en un cuerpo único, se quedó como polvo. Goirme fijó ese polvo en una órbita estable en la atmósfera alta, ni tan baja que caiga ni tan alta que escape — un cinturón continuo, como los anillos de un planeta. Ese cinturón refleja luz todo el tiempo, de día y de noche, pero de día se pierde contra el brillo del propio cielo (igual que las estrellas); solo de noche —dominio de Kroj— se hace visible, como un brillo difuso y perlado repartido por todo el cielo, nunca un disco nítido de luna. De ahí el nombre popular "brillo de aurora" y el nombre de los Kelife.',
    tags: ['cielo', 'sin-luna', 'brillo-de-aurora', 'liania', 'goirme', 'kroj'],
    sourceDoc: 'genesis.md',
  },
  {
    type: 'REGION',
    title: 'Por qué la arena de las Llanuras es magnética',
    text: 'El Reino Nabierus excavó un metal propio de sus minas y lo almacenó en cantidades que nadie más ha vuelto a reunir. Cuando Madre engañó a sus Semillas para sepultar el reino, la sequía y el viento no solo enterraron piedra: trituraron ese metal contra sí mismo durante generaciones hasta reducirlo a polvo fino, hoy suspendido en la propia arena roja. El Vientre del Engaño sigue siendo el punto de mayor concentración de ese polvo, de ahí nacen las tormentas de arena magnética. Tres efectos del mismo polvo: las Rocas Imanidas (Arena Imán/Imanio) flotan por repulsión magnética de polaridad opuesta; las tormentas no bajan a La Hondonada del Eco porque el viento mantiene el polvo denso en alto al llegar al borde de la depresión; el Cardo Brújula señala siempre el mismo rumbo porque su aguja reacciona a la masa fija del reino enterrado, no a la nube caótica de cada tormenta.',
    tags: ['arena-magnetica', 'reino-nabierus', 'imanio', 'cardo-brujula', 'hondonada-del-eco'],
    sourceDoc: 'genesis.md',
  },
  {
    type: 'CULTURA',
    title: 'El dominio de Kroj — la ausencia de señal',
    text: 'Kroj no gobierna oscuridad y silencio como dos cosas distintas: gobierna la ausencia de señal que escapa de un cuerpo (luz reflejada, sonido emitido). La piel Nabieus atrapa la luz en vez de reflejarla o absorberla como calor. El Margen Silencioso absorbe el sonido de forma anómala, sin eco ni rebote — el territorio donde los Nabieus, marcados por Kroj, se refugiaron tras la caída del Reino Nabierus. Las Sombras de Kroj no imitan voces mortales, las devuelven: acumulan sonido ajeno y lo sueltan distorsionado como eco retrasado. Kroj también dejó su huella, sin ser su autora, en flora y fauna nocturnas que Florial y Ferios tejían allí donde su dominio se cruzaba — Rondador de Brasas, Nuente y Miruina llevan algo de esa misma firma.',
    tags: ['kroj', 'nabieus', 'margen-silencioso', 'sombras-de-kroj', 'noche'],
    sourceDoc: 'genesis.md',
  },
  {
    type: 'CULTURA',
    title: 'Por qué los orcos son Chamanes y no Magos',
    text: 'Los orcos nacen del Estallido sin Semilla creadora, así que su magia interior es la más fuerte de Helek Sirik. Tarkor, inspirado por el respeto de Ferios hacia la libertad de su propia creación, les selló el canalizador de serie que cualquier otra raza tiene para lanzar magia en crudo — no la magia en sí, solo la puerta directa. Los orcos encontraron una puerta trasera: ciertas piedras (runas) y cierta madera/hueso (tótems) absorbieron durante generaciones la misma magia salvaje del Estallido que corre por su sangre, y solo ellos resuenan con esos materiales. Los tótems encierran a los Hyanios ("Ancestros"), representación cultural orca de cada elemento, sin voluntad propia — magia elemental almacenada, no espíritus. Por eso ningún orco lanza magia en crudo con las manos, siempre a través de un tótem o runa trabajados.',
    tags: ['chaman', 'orcos', 'magia', 'totem', 'runa', 'hyanios', 'tarkor'],
    sourceDoc: 'razas.md',
  },
  {
    type: 'REGION',
    title: 'Idiomas de Helek Sirik',
    text: 'Nohade es exclusivo de los dioses. Geniha es la lengua común de Vaelira (oficializada por los Kelife). Kerost es la lengua común de Berig (oficializada por los Goirntes). Cada raza conserva además su propia lengua de clan para el ámbito privado y familiar.',
    tags: ['idiomas', 'geniha', 'kerost'],
    sourceDoc: 'areas.md',
  },
  {
    // Chunk nuevo (auditoría de coherencia código↔lore, 2026-09-05) — el Kektira (lengua de clan
    // orca, ver "Idiomas" arriba) tiene 8 palabras propias que el juego muestra literalmente cada
    // turno (nombres de estación y de intensidad de tormenta), sin ninguna entrada de lore.
    type: 'CULTURA',
    title: 'Kektira — nombres orcos de estaciones y tormentas',
    text: 'El Kektira es la lengua de clan de los orcos. Nombra las 4 estaciones del año: Ur\'gathek (primavera, "la estación de las crecidas"), Sohkar (verano, "la estación seca"), Vungrat (otoño, "la estación de la cosecha"), Krenoth (invierno, "la estación larga", cuando el Kirelon-arenoso emerge más). También nombra la intensidad de las tormentas de arena magnética de las Llanuras: Ghurmek ("el respiro", clima llevable), Sek\'tar ("el viento cortante", vientos fuertes), Rokthar ("la gran tormenta"), y Rok\'ithek ("la ira del viento", tormenta extrema — misma raíz que Rokthar).',
    tags: ['kektira', 'idioma-orco', 'estaciones', 'tormentas'],
    sourceDoc: 'estaciones.md',
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
    title: 'El Reino Nabierus y el origen del nombre de la región',
    text: 'Mucho antes de los orcos y del año 0, un reino Nabierus se alzó aquí, volcado en investigar más de lo que a Madre le convenía. Madre no atacó de frente: engañó a sus propias Semillas, que sin saberlo desataron sequía y viento hasta enterrar el reino bajo la arena roja que ellas mismas levantaron. Los supervivientes huyeron hacia lo que hoy es El Margen Silencioso y, después, Ciénaga Troncal — los antepasados directos de los Nabieus de hoy, origen real de su cultura del silencio. La tierra quedó desierta y muerta hasta que el Estallido y la magia salvaje que gestó a los primeros orcos le devolvieron vida propia. El viento, mucho más diluido que el que sepultó un reino entero pero todavía notable en sus tormentas de arena magnética, es el que da nombre a la región hoy: Las Llanuras del Viento Rojo. Buena parte del reino sigue sellada bajo la arena — solo fragmentos sueltos asoman entre las dunas.',
    tags: ['llanuras', 'nabieus', 'nabierus', 'madre', 'origen-del-nombre'],
    sourceDoc: 'cronologia-mitica.md',
  },
  {
    type: 'REGION',
    title: 'Cristal Helado',
    text: 'Territorio orco en Berig: zona helada de altas montañas y viento cortante, en gran parte inexplorada. Varias tribus orcas de zonas gélidas viven a los pies de la ladera (Clan Helsig). Condiciones duras, pero con complicaciones para conseguir comida. El Hielo Sílice es su mineral más común y representativo (mineral, no flora) — cristal resistente en cantidad en las laderas, usado para herramientas y cuchillos de desuello, define económicamente la zona igual que el hierro corriente define a Las Llanuras. Gorhorn trabajó 3 meses en sus minas de joven y allí hizo amistad con un orco llamado Hagar.',
    tags: ['cristal-helado', 'helsig', 'hielo-silice', 'gorhorn', 'hagar'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'REGION',
    title: 'Ciénaga Troncal',
    text: 'Franja central de Berig, al este de las Llanuras; Cristal Helado al norte y El Margen Silencioso al sur (~160 x 178 km, territorio neutral, fuera del núcleo jugable). Su nombre nativo es Los Trepaderes Humededos. Terreno húmedo, en gran parte inhabitable, con tres pequeñas zonas llanas de árboles oscuros (Trepadores Ocaso) que han invadido gran parte de los cenagales. Zona rica en alimento y madera, pobre en minerales. En la zona llana más amplia viven las dos tribus del Clan Goshg, en El Cerco de los Pilotes (Silh Makut, "Piel Musgo"), con sus empalizadas sobre pilotes; en la explanada más pequeña, al sur, los Nabieus de Keseg Prisilke, en Jeyselt ("Fin Susurrado"). Comparten la Ciénaga en convivencia práctica (madera y noticias) y la Concordia exige madera a ambos. Lugares: Marismas de Lodo Negro, Túneles Musgosos, Raíces Madre Fango (donde los Goshg queman a sus muertos), Cumbre Bruma Negra (única altura), Cataratas Madre Fango, Costa Marea Vida, Costa Corredor y Desfiladero Esmeralda, salida hacia Cristal Helado.',
    tags: ['cienaga-troncal', 'goshg', 'keseg-prisilke', 'trepadores-ocaso', 'jeyselt', 'silh-makut'],
    sourceDoc: 'cienaga-troncal.md',
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
    text: 'Continente joven, violento y volcánico, de ~250 x 470 km y solo 8.000-10.000 almas: un continente a medio vaciar. Lengua común: Kerost. Se reparte en tres franjas. Norte: Cristal Helado (Clan Helsig), y más allá, desde El Detonante, la tierra nueva y el muro de obsidiana. Centro, lado a lado: las Llanuras del Viento Rojo al oeste (Clan Serhu, Gorhorn, Faerus de Feg Ger en Kegi, franja sur) y la Ciénaga Troncal al este (Clan Goshg y Nabieus de Keseg Prisilke). Debajo, El Margen Silencioso, cinturón que linda con toda la Ciénaga y con el extremo sur de las Llanuras (Nabieus de Keseg Sael al este, Faerus de Feg Tusha al oeste; allí están El Cruce de las Cenizas, Kegi y Hashma). Sur: la Meseta del Orden, territorio Goirntes con ciudades-fortaleza de piedra y hierro, que solo toca el Margen; sede de la Concordia de Hierro y de Los del Obelisco. Razas de Berig: Goirntes, Orcos (cuatro clanes), Nabieus y Faerus.',
    tags: ['berig', 'goirntes', 'nabieus', 'faerus', 'meseta-del-orden', 'margen-silencioso', 'geografia'],
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
    text: 'Hierba del Hierro (diseñada, Vetria): sus raíces bioacumulan mineral metálico disperso en la piedra gris de la Meseta del Orden, el mismo principio de Liania que da mecanismo a todo lo demás — los Goirntes la procesan para aleaciones. Raíz de Fuego (salvaje, mutada): enredadera de zonas volcánicas orcas que libera gas inflamable, recolectada como explosivo/iniciador de fuego. Trepadores Ocaso: árboles de la Ciénaga Troncal, cuya resina sella e impermeabiliza la madera contra la humedad de la ciénaga. (El Hielo Sílice es mineral, no flora — ver el chunk de Cristal Helado.)',
    tags: ['flora', 'berig', 'raiz-de-fuego', 'hierba-del-hierro'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'FAUNA',
    title: 'Fauna de Berig y las Llanuras del Viento Rojo',
    text: 'Gargantúas de Ceniza: reptiles gigantes que el Domador del clan (especialización de Cazador, oficio aprendido, no magia ni don de la Terk\'ikar) guía en migraciones estacionales. Las Sombras de Kroj: criaturas voladoras nocturnas del Margen Silencioso que no imitan voces, las devuelven distorsionadas (dominio de Kroj). Cornantes: alimento principal en la Ciénaga Troncal. Corredores de Cauce: manadas veloces de seis patas en las Llanuras del Viento Rojo, cazadas en carreras rituales de valor. Espina del Viento: una fauna más de la región (no "el mayor peligro"), criaturas venenosas enterradas en la arena roja que atacan durante las tormentas de arena magnética, nidos concentrados en La Fosa Horadada — deliberadamente sin ficha propia de combate, solo riesgo narrativo y recurso de recolección. Zense Ceniza (antes "Buitre Cenizo", renombrado — nombres de fauna sin palabras reales de la Tierra): ave carroñera de plumaje negro y piel gris ceniza bajo el plumaje, siempre en círculos sobre lo que muere en la llanura. Kirelon-arenoso: reptil ciego de 2-4 metros, depredador nocturno AGRESIVO de La Hondonada del Eco, caza por vibración, pasa el día bajo tierra y solo emerge de noche o con frío a cazar — letal y directo, nunca un candidato de interacción pacífica.',
    tags: ['fauna', 'llanuras', 'espina-del-viento', 'corredores-de-cauce', 'gargantuas-de-ceniza', 'zense-ceniza', 'kirelon-arenoso', 'domador'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'CULTURA',
    title: 'Las 26 familias de fauna y flora, por Semilla',
    text: 'Todo animal o planta de Helek Sirik pertenece a una de 13 familias de fauna o 13 de flora, linaje real de una Semilla concreta — un cazador o herborista experto reconoce la familia por cómo se mueve o crece una criatura, aunque no conozca la especie. Fauna de Ferios (instinto, seis familias): Guelises (jauría), Acechantes (emboscada solitaria), Corvenes (aves de presa/carroñeras), Zancudos (aves de charca), Bestiones (grandes herbívoros), Rondines (pequeños omnívoros). Fauna de Florial (tres familias): Quitinos (insectos acorazados), Escamados (reptiles/anfibios), Nadantes (peces). Fauna de Goirme y Kroj: Ordenados y Umbrias, sin especie real asignada todavía. Fauna de Tarkor: Mudos Salvaje (animal real mutado por magia) y Rokrats Estallido (nacidos directo de la magia, como los orcos). Flora de Florial (once géneros, el grueso de la flora del mundo): Veldrias (árboles con resina), Zarcos, Heldras, Granoles, Trenias, Marelas, Bulvias, Muscarias, Salviras, Fongares, Vetrias (flora con mineral incrustado, como la Hierba del Hierro). Flora de Tarkor: Brotes Salvajes y Roktars Florares.',
    tags: ['familias', 'taxonomia', 'fauna', 'flora', 'semillas'],
    sourceDoc: 'flora-fauna.md',
  },
  {
    // Chunk nuevo (auditoría de coherencia código↔lore, 2026-09-05) — 4 puntos de interés jugables
    // más el oficio de Pescador, sembrados en worldCatalog.ts sin ninguna entrada de lore.
    type: 'REGION',
    title: 'Puntos de interés nuevos de Las Llanuras del Viento Rojo',
    text: 'Las Agujas Imán: campo de rocas negras imantadas donde las tormentas de arena magnética peinan la arena en crestas; la orientación se pierde entre ellas, y solo el Cardo Brújula (aguja imantada natural) anula la desorientación. La Sabana Alta: praderas de hierba roja alta, refugio y coto de caza de Corredores de Cauce, terreno donde el Aullador Rojo caza mejor por el sigilo que da la hierba. Playa de Ceniza Blanca: franja de arena clara entre roca, el punto de costa más accesible y menos hostil de la región. Los Acantilados Partidos: pared costera vertical con grietas profundas, oleaje violento, nidos de aves marinas en las cornisas — bello y letal. La profesión Pescador (nueva) se aprende con el Maestro Pescador Serhu y trabaja peces y marisco de la costa (Jashil, Negueo, Toluh, Rugoconcha), nunca por Cazar.',
    tags: ['agujas-iman', 'sabana-alta', 'playa-de-ceniza', 'acantilados-partidos', 'pescador'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'CLAN',
    title: 'Cultura y liderazgo de los clanes orcos',
    text: 'En la mayoría de los clanes orcos, la Terk\'ikar (Jefa, casi siempre hembra) gobierna el día a día — asentamientos, disputas, migraciones. El Kort\'ikar (Jefe de Guerra, casi siempre macho) lidera en combate. Es costumbre cultural asentada, no ley escrita. Los asuntos importantes se debaten en una asamblea abierta a todo orco libre (Terk\'ikar, Kort\'ikar, y los 5 Kurig — cargos de justicia, economía, diplomacia, logística y filosofía, que no deciden nada por su cuenta pero filtran qué llega a debatirse), aunque la Terk\'ikar tiene siempre la última palabra. A los 10 años, todo joven orco se mide en la cacería ritual de Corredores de Cauce: quien la supera es reconocido guerrero de adulto.',
    tags: ['clanes', 'terkikar', 'kortikar', 'liderazgo-orco', 'kurig', 'asamblea'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'CULTURA',
    title: 'Maestros de oficio y el Trabajador de Reino',
    text: 'Karot Veku tiene un Maestro por cada uno de sus 12 oficios (herrero, curtidor, peletero, desollador, domador, carpintero, sastre, herborista, primeros auxilios, alquimista, cocinero, pescador) — el único que enseña ese oficio a quien cumpla reputación mínima y una misión propia, protegido, no capturable. Junto a cada Maestro trabaja un orco de plantilla sin nada que enseñar, que puede ser capturado o reclutado para producir ese recurso de forma pasiva para el Reino del propio jugador.',
    tags: ['maestro-de-oficio', 'trabajador-de-reino', 'karot-veku', 'oficios'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'CULTURA',
    title: 'El Signeran — el duelo de honor orco',
    text: 'El Signeran es el duelo de honor formal entre orcos: sin armadura, solo hacha orca simple, siempre a muerte — dejar vivo al perdedor es deshonra para los dos. Tres vías dan derecho a exigirlo: autorización de la asamblea del clan, descendencia directa de un Terk\'ikar o Kort\'ikar, o que el propio líder de la tribu rete a otro cuando su honor exige defensa (el retado decide si acepta). No es cauce para disputas personales cualquiera: es el mecanismo real para retar la legitimidad de un liderazgo.',
    tags: ['signeran', 'duelo-de-honor', 'clanes'],
    sourceDoc: 'razas.md',
  },
  {
    type: 'CLAN',
    title: 'Clan Maktor (el clan de Gorhorn) — aniquilado dos veces',
    text: 'Clan de las Llanuras del Viento Rojo, pacífico y orgulloso, respetuoso con la naturaleza. Sufrió dos golpes con más de mil años de diferencia. El primer golpe (~año 2.900-2.950): tras una larga guerra interna contra el Clan Serhu, el Kort\'ikar Maktor Kadrog vence en un Signeran al líder Serhu Mordek y le perdona la vida — el mayor error del clan, porque la casta de Ketg traiciona esa confianza y los Goirntes mandan 1.200 guerreros que dejan al clan "maltrecho" sin extinguirlo. El segundo y definitivo golpe (año 4.000): el padre de Gorhorn, cansado del yugo Serhu, lidera una revuelta del maltrecho clan; los Goirntes orquestan una incursión que lo aniquila por completo, y el padre muere. Gorhorn es, hasta donde él sabe, el único superviviente. Sin Terk\'ikar ni Kort\'ikar vivos, el nombre no tiene ya peso político ni militar — restaurarlo es una cuestión de honor personal para Gorhorn.',
    tags: ['clan-maktor', 'gorhorn', 'kadrog', 'mordek', 'primer-golpe'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'CLAN',
    title: 'Clan Serhu y la casta de Ketg',
    text: 'Clan vecino y rival histórico de los Maktor en las Llanuras del Viento Rojo, fundado generaciones atrás cuando Ketg traicionó a su mujer, la Terk\'ikar Nietka, con ayuda Goirnte. Se quedaron mirando sin intervenir mientras los Goirntes aniquilaban lo que quedaba de los Maktor. Puertas adentro no gobierna el honor sino el miedo: desde Ketg, el poder sigue en manos de una casta cerrada de sus descendientes (la actual Terk\'ikar Ulkha y el Kort\'ikar Torgash lo son) que no admite disidencia — no hay exilio, solo quedarse y resignarse o morir y desaparecer sin rito funerario, castigo único entre los clanes orcos. Los Goirntes arman al clan y usan a los Serhu como brazo ejecutor para limitar la expansión de todos los orcos de Berig, presentándolo como un privilegio. Su relación con Gorhorn queda abierta: puede ser un puente hacia comunidad o una fuente de rencor, ahora con una razón concreta y reciente (la inacción durante la caída de los Maktor).',
    tags: ['clan-serhu', 'gorhorn', 'casta-de-ketg', 'ketg', 'ulkha', 'torgash'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'CLAN',
    title: 'Clan Helsig y Clan Goshg',
    text: 'Clan Helsig: tribus de Cristal Helado expertas en trabajar el hielo sílice, asentadas en Helske Tugh, campamento minero fortificado junto a La Veta Helada. Gobierna la Terk\'ikar Brenka; su pareja, la Kort\'ikar Solgra, lidera la guerra. Racionan la comida (nadie come dos veces hasta que todos han comido una) y aceptan brazos de fuera en las minas: Gorhorn trabajó 3 meses allí de joven, perdió un colmillo en una pelea y forjó amistad real con Hagar. Clan Goshg: las dos tribus de la Ciénaga Troncal, viven de los Trepadores Ocaso y los Cornantes, y se reúnen en El Cerco de los Pilotes (Silh Makut) en la estación de las crecidas. Gobierna la Terk\'ikar Doshka; su hermano menor, el Kort\'ikar Dulgren, lidera la guerra. Comparten la Ciénaga con los Nabieus de Keseg Prisilke, con quienes intercambian madera y noticias. Ambos clanes se comunican por la Senda del Sílice (hielo sílice y cuchillos hacia el sur, madera y resina hacia el norte) y mantienen un perfil neutral y defensivo ante la guerra de la Concordia, que les exige mineral y madera antes que guerreros; los Serhu, armados por la Concordia, empiezan a asaltarlos. Con los Goshg las fichas no dan a Gorhorn ninguna conexión previa concreta, aunque en su juventud trabajó para tribus orcas de la ciénaga.',
    tags: ['clan-helsig', 'clan-goshg', 'hagar', 'gorhorn', 'brenka', 'solgra', 'doshka', 'dulgren', 'senda-del-silice'],
    sourceDoc: 'clanes-orcos.md',
  },
  {
    type: 'CULTURA',
    title: 'Tarkor en la cultura orca',
    text: 'Los orcos no adoran a Tarkor como dios ni lo temen como demonio — lo tratan como a un ancestro incómodo. Casi ningún orco conoce su arco completo. Corre de generación en generación una frase de cuna: "Con ira nos quemaron, con honor nos rebelamos, y aún así nadie domó nuestros caminos" — recuerda que su origen es caos sin diseño, y que lo que los distingue es lo que cada uno decide hacer con esa ira.',
    tags: ['tarkor', 'cultura-orca', 'frase-de-cuna'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'CULTURA',
    title: 'Personalidad y valores orcos',
    text: 'Los orcos son directos y de paciencia corta —su mayor fuente de mala fama entre otras razas—, rara vez mienten pero no tienen problema en ocultar la verdad. El honor y la fuerza importan más que el rango social: buscan redención, no venganza, y no guardan rencor racial general salvo contra los Goirntes, vistos como una amenaza a destruir, no una raza a la que culpar. Es la única raza de Berig dispuesta a tratar con cualquier otro pueblo que muestre honor, fuerza, liderazgo o respeto. Un favor a un orco crea una deuda de honor real. Frase de Kekta transmitida a los jóvenes: "Un orco es fuerte y debe demostrarlo, pues solo los fuertes vencen al odio y luchan por la libertad."',
    tags: ['cultura-orca', 'personalidad', 'honor', 'kekta'],
    sourceDoc: 'razas.md',
  },
  {
    type: 'CULTURA',
    title: 'Tótems y rito funerario orco',
    text: 'Al morir cualquier orco, su cuerpo se quema y se marca con un tótem tallado en madera oscura de ciénaga, levantado sobre un montículo de piedra en Los Túmulos del Honor. El tamaño del tótem no lo decide el tipo de muerte —un Signeran no da por sí solo derecho a uno mayor—, sino el juicio colectivo de la tribu, después, sobre si esa vida se vivió con honor. Negar el rito —hacer desaparecer el cuerpo sin velarlo ni recordarlo— es un castigo real que solo se ve en el Clan Serhu, arma de la casta de Ketg contra quien la desafía.',
    tags: ['totem', 'rito-funerario', 'tumulos-del-honor', 'clanes'],
    sourceDoc: 'razas.md',
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
    text: 'Tres grandes pilares en una pequeña llanura rodeada de acantilados, cada uno con estandartes en la cima, conectados entre sí y con los acantilados por una red de puentes colgantes de uso orco. No son formación natural: son restos del Reino Nabierus, demasiado grandes y profundos para que el engaño de Madre los derribara del todo — el nombre "Rotos" describe lo que sobrevivió de una estructura mucho mayor, no su forma. Tiene una mena de hierro corriente visible en la roca erosionada, el mismo hierro de mala calidad disperso por toda la llanura (no un yacimiento nabierus).',
    tags: ['llanuras', 'punto-de-interes', 'reino-nabierus', 'mena-de-hierro'],
    sourceDoc: 'areas.md',
  },
  {
    type: 'REGION',
    title: 'Los Manaderos (Llanuras del Viento Rojo)',
    text: 'Ecosistema de charcas estacionales donde una corriente subterránea aflora entre chudos rojizos — otro punto de la misma corriente que alimenta el Pozo de Cauce Viejo. Cadena trófica de cinco especies: Verdileas Acuáticas (base, alga) alimentan a la Jusha Esmeralda (pez), cazada de noche por el Miruina (roedor nadador, otra criatura marcada por Kroj) y de día por la Tura Jusha (ave que caza crías desorientadas). El Quio, gusano filtrador sin dientes, limpia los restos orgánicos de las orillas — no caza ni compite, lo que pasa por su filtro deja de ser resto: la firma de Sezix, no la de un carroñero corriente. Aquí paren las hembras de Corredor de Cauce; cazar crías ofende la costumbre orca.',
    tags: ['los-manaderos', 'llanuras', 'quio', 'sezix', 'jusha-esmeralda', 'miruina'],
    sourceDoc: 'flora-fauna.md',
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
    title: 'El Filo de las Brasas (Llanuras del Viento Rojo)',
    text: 'Cresta rocosa al noreste de Los Restos de Maktor, donde la estepa cede ante tierra volcánica — el primer punto de las Llanuras donde los "volcanes activos a lo lejos" se ven de cerca. Territorio real de la Salamandra de Escoria y del Rondador de Brasas. Segunda gran zona de minerales de alto tier de las Llanuras (junto a La Hondonada del Eco/Yerreo): Volcanita y Rovalnica son comunes, el Fercaneo (tier 5) es casi imposible de encontrar, protegido por las propias Salamandras.',
    tags: ['filo-de-las-brasas', 'llanuras', 'salamandra-de-escoria', 'rondador-de-brasas', 'volcanita', 'fercaneo'],
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
    title: 'Las 8 razas de Helek Sirik',
    text: 'Las 8 razas del mundo (solo Gorhorn, un orco, es personaje jugable). Kelife ("Brillo de aurora"; Vaelira, Semilla Liania): piel cristalina, cercanos a lo humano. Goirntes (Berig, Semilla Goirme): piel gris, fríos y calculadores. Kalisar ("Oscuridad latente"; Vaelira, Semilla Sezix): piel azabache, sufren la luz, afables pese a fama de asesinos. Jusaly ("Raíces"; Vaelira, Semilla Florial, "El que Brota"): elementos vegetales, agrarios y longevos. Orcos (Berig, Tarkor/magia salvaje): corpulentos, honor y fuerza, clanes con Terk\'ikar y Kort\'ikar. Nabieus ("Los que silencian"; Berig, Semilla Kroj): ausencia hecha carne, sigilo absoluto. Faerus ("Los furiosos"; Berig, Semilla Ferios, "El que Nace"): bípedos/cuadrúpedos, instintivos pero muy inteligentes. Ilvenar ("Memoria viva"; Vaelira, Semilla Berd): archivistas de memoria perfecta, neutrales.',
    tags: ['razas', 'kelife', 'goirntes', 'kalisar', 'jusaly', 'orcos', 'nabieus', 'faerus', 'ilvenar', 'brillo-de-aurora'],
    sourceDoc: 'razas.md',
  },

  // --- personajes.md ---
  {
    type: 'PERSONAJE',
    title: 'Gorhorn, guerrero del Clan Maktor (único personaje jugable)',
    text: 'Orco de las Llanuras del Viento Rojo, único superviviente conocido del Clan Maktor tras ser usados como carne de cañón por el mando Goirntes. Orgulloso pero no arrogante, sorprendentemente afable para un orco, aunque con poca paciencia una vez la pierde. Fuerza física colosal, instinto de combate a corta distancia, alta resistencia al dolor. Mide 1,98m, colmillos medios (uno con prótesis de hielo sílice), pelo negro con trenzas de apliques azules, perilla en dos trenzas con enganches de hueso, tres cicatrices de latigazos en la espalda de sus años de trabajo forzado. Inventario: hacha de guerra rota usada como maza, cuchillo de hielo sílice, pico de minero, cataplasma de salvia del polvo, arnés de cuero, pantalones de piel, y un tótem de madera de ciénaga del Clan Maktor — su objeto más importante. Ahora lucha de forma independiente para que la muerte de su clan no sea en vano.',
    tags: ['gorhorn', 'orcos', 'clan-maktor', 'personaje-principal'],
    sourceDoc: 'personajes.md',
  },
  {
    type: 'PERSONAJE',
    title: 'Otros personajes del presente (no jugables): Sael, Dessa, Ithren, Amonir, Yerin, Riko y Cassia',
    text: 'Solo Gorhorn es personaje jugable; estos siete son personajes del mundo de Helek Sirik en el presente y no son jugables. Su lugar concreto en el mundo no está decidido, así que no hay que situarlos en ningún sitio. Sael Vhorn (Kelife): tallador de cristal que lee tensiones estructurales, prudente y observador. Dessa Kaltrenn (Goirntes): desertora de la guardia, percibe el orden de las cosas, instinto táctico. Ithren Vosk (Kalisar): espía criado para la vulnerabilidad de su reino, sigilo extraordinario, sufre la luz directa. Amonir Thess (Jusaly): agricultor con vínculo vegetal y curación, perdió su tierra a la magia salvaje. Yerin Slaad (Nabieus): mensajero de movimiento insonoro, atormentado por haber sido cómplice involuntario del sabotaje que desató la guerra; su nombre figura en los registros de entrega de la carta. Riko (Faerus): cazador de la Manada Rota, cambia entre postura bípeda y cuadrúpeda, busca a los suyos; su manada se reunía en El Claro de la Manada, arrasado por la magia salvaje tras El Detonante. Cassia Von-Thair (Ilvenar): archivista con psicometría táctil y memoria perfecta, censurada por descubrir una tercera presencia en el sello roto.',
    tags: ['sael-vhorn', 'dessa-kaltrenn', 'ithren-vosk', 'amonir-thess', 'yerin-slaad', 'riko', 'cassia-von-thair', 'no-jugables'],
    sourceDoc: 'personajes.md',
  },
  // --- npcs.md ---
  {
    type: 'NPC',
    title: 'NPCs del presente (Berig)',
    text: 'General Vrask Ombra: mando militar de la Concordia; ejecuta órdenes radicales en público, pero en privado sospecha que la versión oficial es mentira. Habla poco y en tono bajo; cuanto más tranquilo suena, más peligroso es el momento. Primer Censor Tarsen Vold (El Baluarte de Goirme): líder de la facción radical y, por tanto, de la Concordia; no es general sino censor de la casta de ley, la misma que Yovenne Tal. Goirnte alto y enjuto, piel gris casi azulada, cabeza afeitada y toga gris sin insignias; conoce los círculos radicales que saben la verdad completa del Detonante (qué sabe exactamente sigue reservado). Frases completas, sin prisa, nunca levanta la voz. Archimagistrada Yovenne Tal: encabeza a Los del Obelisco, la facción moderada Goirnte, desde El Baluarte; intenta frenar a los radicales desde la política interna, exige pruebas presentadas "en orden" y cita de memoria las leyes de los obeliscos, artículo y línea. Kort\'ikar Torgash Ketg: líder de guerra Serhu que busca sacar a su pueblo de una guerra que no les pertenece. Kael Dorn: exmiembro de la facción radical que ayudó a romper el sello, vive escondido por la culpa; los radicales quieren silenciarlo y los moderados lo necesitan vivo. Aven Tessk: portavoz del cónclave de Keseg Sael en El Refugio sin Nombre, sin cargo de mando. Ilka Dren: cazadora mayor de Keseg Prisilke en Jeyselt, susurra sin las pausas cargadas del Margen. Los Faerus de Hashma y Kegi, en su propia ficha.',
    tags: ['npcs', 'berig', 'torgash', 'vrask-ombra', 'tarsen-vold', 'yovenne-tal', 'kael-dorn', 'aven-tessk', 'ilka-dren'],
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
    text: 'Tono épico y trágico: pueblos que se creen en lo correcto libran una guerra sobre una verdad que nadie tiene completa, en un mundo tan pequeño (máximo ~6.000 habitantes en la mayor civilización) que cada muerte deja cicatriz. Letalidad media: la muerte de un personaje con nombre es rara y con peso, nunca casual. Magia: 7 escuelas en las que se divide la magia de Tarkor (arcano, fuerza destructiva pura; elementos; oscura; purificadora; naturaleza; dominio; salvaje, la rama que dio origen a los orcos y otras razas sin Semilla) — siempre conlleva un pequeño riesgo narrativo incluso en éxito. Tecnología medieval-fantástica, sin pólvora; Berig con metalurgia algo más avanzada.',
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

  // --- docs/mecanicas/12-mundo-estructurado.md: contenido nuevo (Torgash concretado, Ulkha, Hagar
  // ampliado, Campamento Serhu, 4 especies nuevas) — SIN números: los stats y el equipo llegan
  // siempre por Npc/NpcItem (vía determinista), nunca por RAG, para que nunca puedan desincronizarse.
  {
    type: 'NPC',
    // Apellido "Ketg" añadido (auditoría de lore 2026-08-22) — ya propagado a worldCatalog.ts
    // (slug torgash-ketg) y npcs.md #8 en la auditoría de lore 2026-08-21, pero este chunk se
    // quedó atrás sin el apellido; mismo patrón exacto que el bug de la biografía de Gorhorn en
    // berigLore.ts detectado ese mismo día.
    title: "Kort'ikar Torgash Ketg, del Clan Serhu",
    text: 'Torgash Ketg es el Kort\'ikar (Jefe de Guerra) del Clan Serhu, vecino y rival histórico del extinto Clan Maktor de Gorhorn. Veterano de las escaramuzas fronterizas, ascendió al puesto cuando su predecesor murió en el frente. Carga en silencio con el peso de la incursión Goirnte que aniquiló al Clan Maktor mientras su propio clan se quedaba mirando sin intervenir — no fue decisión suya, era joven y sin mando entonces. Busca, en silencio y contra la costumbre, unificar a los clanes orcos para retirarlos de la guerra de la Concordia de Hierro: los Serhu vieron de cerca lo que la Concordia hizo con los Maktor y no quieren ser los siguientes. Es grave, económico con las palabras, y pragmático hasta rozar la herejía cultural — prefiere pactar a duelar. Detesta a la Concordia en silencio. Se le encuentra en el Campamento del Clan Serhu, o en ruta si algo lo saca de allí.',
    tags: ['torgash', 'torgash-ketg', 'kortikar', 'clan-serhu', 'npc-principal'],
    sourceDoc: 'npcs.md',
  },
  {
    type: 'NPC',
    // Apellido "Ketg" añadido (auditoría de lore 2026-08-22) — mismo motivo que Torgash arriba:
    // ya en worldCatalog.ts (slug ulkha-ketg) y npcs.md #11 desde la auditoría 2026-08-21, sin
    // propagar a este chunk.
    title: "Terk'ikar Ulkha Ketg, del Clan Serhu",
    text: 'Ulkha Ketg es la Terk\'ikar (Jefa) del Clan Serhu — gobierna el asentamiento, el pastoreo y las migraciones. Fue ella quien decidió no acoger a los supervivientes del Clan Maktor tras su aniquilación: no por crueldad, sino por cálculo de supervivencia — acogerlos habría puesto una diana sobre su propio clan, con la Concordia todavía buscando rezagados. Que Gorhorn siga vivo la enfrenta de nuevo a esa decisión. Es fría en el cálculo y cálida en el trato, en ese orden; guía a las Gargantúas de Ceniza durante las migraciones como Domador (especialización de Cazador, oficio aprendido, no magia). Se le encuentra en el Campamento del Clan Serhu.',
    tags: ['ulkha', 'ulkha-ketg', 'terkikar', 'clan-serhu', 'npc-principal'],
    sourceDoc: 'npcs.md',
  },
  {
    type: 'NPC',
    // Apellido "Kiugh" añadido (auditoría de lore 2026-08-22) — mismo motivo que Torgash/Ulkha
    // arriba: ya en el `name` de worldCatalog.ts (slug hagar-kiugh) y ahora en npcs.md #12, sin
    // propagar antes a este chunk.
    title: 'Hagar Kiugh, del Clan Helsig (amigo de Gorhorn)',
    text: 'Hagar Kiugh es un orco del Clan Helsig, de Cristal Helado, minero de hielo sílice. Gorhorn trabajó tres meses codo con codo con él en las minas y forjaron una amistad real — Hagar es leal, ruidoso y de risa fácil, el opuesto exacto del Gorhorn callado de aquellos años, y por eso encajaron. Vive lejos de las Llanuras del Viento Rojo, en Cristal Helado, pero sigue siendo el vínculo personal vivo de Gorhorn: un mensaje, un viaje o un rumor pueden traerlo de vuelta a la historia en cualquier momento.',
    tags: ['hagar', 'hagar-kiugh', 'clan-helsig', 'gorhorn', 'npc-principal'],
    sourceDoc: 'npcs.md',
  },
  {
    type: 'NPC',
    title: 'Gistera Koh y Uhuld Koh (encuentro del primer turno)',
    text: 'Gistera Koh es una orca de origen desconocido: el artesano Serhu Uhuld Koh la encontró desorientada en el desierto a los 10 años y la crió como propia. Uhuld tramaba en secreto exponer la represión de la casta de Ketg sobre los Serhu, buscando a un descendiente de sangre fundadora con derecho a un Signeran contra ella — sin saberlo, ese descendiente era el propio Gorhorn (secreto que ni Gistera ni Gorhorn conocen). Delatado por miedo por sus propios compañeros, tres guerreros Serhu pagados por los Goirntes lo mataron ante los ojos de Gistera, escondida entre las sombras; el clan hizo desaparecer su cuerpo sin rito ni tumba, castigo real de la casta de Ketg. Gistera huyó esa misma noche; reconoce el símbolo Maktor en el tótem de Gorhorn del que Uhuld le hablaba, y es lo que la hace confiar en él. No es objetivo de combate ni de saqueo.',
    tags: ['gistera-koh', 'uhuld-koh', 'casta-de-ketg', 'npc-principal', 'primer-turno'],
    sourceDoc: 'npcs.md',
  },
  {
    type: 'NPC',
    title: 'El Orco Enfurecido (encuentro de combate del primer turno)',
    text: 'Uno de los tres guerreros Serhu pagados en secreto por los Goirntes para matar al artesano Uhuld Koh, padre adoptivo de Gistera Koh — fue él quien le dio el golpe final con la maza después de que Uhuld, ya herido, lo alcanzara con el hacha. Siguió a Gistera cuando huyó esa misma noche, sin avisar a sus propios compañeros; casi cayó en una trampa que ella le tendió cerca del Karot Veku, humillación que terminó de quebrarlo. Se arrancó él mismo la pintura de su clan y ronda ahora la Hondonada del Eco, donde arranca la partida de Gorhorn. Errático y violento, ataca al primer contacto sin intentar hablar.',
    tags: ['orco-enfurecido', 'gistera-koh', 'hondonada-del-eco', 'npc-principal', 'primer-turno'],
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
    type: 'REGION',
    title: 'Dentro de Karot Veku — el Ketg\'lukar',
    // Fix real (2026-09-13, auditoría de lore Helek) — el título usa correctamente "Ketg'lukar"
    // (Lukar = "Hogar", el recinto interior entero), pero el texto describía el edificio concreto
    // del salón con el mismo morfema — corregido a "Ketg'sedsar" (Sedsar = "Salón"), coherente con
    // el FactionBuilding real (ver worldCatalog.ts § factionBuildings, renombrado el mismo día).
    text: 'Cruzada la empalizada de Karot Veku, el poblado se organiza en torno a una plaza central de tierra apisonada, con sendas marcadas por el paso constante entre sus distintos puntos — cada construcción real (forja, curtiduría, cocina común, herboristería, alquimia, corrales del Domador, desolladero) tiene su propia ubicación, sin un trazado prefijado de fondo. En el centro simbólico se alza el Ketg\'sedsar, el Salón del Colmillo Ceniza, donde la Terk\'ikar Ulkha Ketg y el Kort\'ikar Torgash Ketg reciben a quien cruza la entrada.',
    tags: ['ketg-sedsar', 'campamento-serhu', 'clan-serhu', 'interior', 'ulkha', 'torgash'],
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

  // --- Tanda de lore 2026-09-27/28 (sincronizada 2026-09-29): facciones nuevas, Meseta y Margen,
  // historia A-10..A-14, lugares A-15..A-19, fauna/flora A-20..A-31, items A-32..A-36, edificios
  // de oficio y Faerus de Hashma/Kegi. Fuentes: docs/rpgtarkor/ y propuestas-aprobadas.md ---
  {
    type: 'CLAN',
    title: 'Los del Obelisco (facción moderada Goirnte)',
    text: 'Los del Obelisco (en Kerost, "los del Vresk\'ord", el obelisco de leyes) son la corriente moderada del orden Goirnte, salida de la casta de ley: magistrados y archiveros de los obeliscos que se niegan a que la Concordia sea todo el orden. Viven en La Meseta del Orden, compartida con la Concordia, y los lidera la Archimagistrada Yovenne Tal desde El Baluarte de Goirme. No se rebelan, porque desobedecer es desorden: exigen que cada orden se sostenga en un edicto grabado, buscan pruebas presentadas "en orden" de la traición del sello (lo que vio Dessa Kaltrenn, lo que sabe Kael Dorn, lo que registró la piel de Cassia Von-Thair; ninguna ha llegado aún por canal legítimo) y citan de memoria el Primer Edicto del Tributo contra el uso actual de los contingentes orcos: "en defensa del orden", no "donde el mando decida". Dentro de la casta hay linajes, no nobleza; el castigo más temido es que un linaje quede degradado por dejar algo inacabado, así que ningún moderado presenta pruebas incompletas. Unos 300 miembros y apenas una guardia de archivo de unos 20. Relaciones iniciales: con la Concordia, tensión alta sin ruptura (se necesitan); con Keseg Sael, desconfianza útil (posibles testigos); con Helsig y Goshg, neutral (proponen limitar el tributo a lo pactado); con los Serhu, frialdad (los ven como brazo de los radicales); con los Faerus, sin contacto.',
    tags: ['los-del-obelisco', 'yovenne-tal', 'goirntes', 'meseta-del-orden', 'casta-de-ley', 'facciones', 'concordia-de-hierro'],
    sourceDoc: 'historia.md',
  },
  {
    type: 'CLAN',
    title: 'Keseg Sael (los Nabieus del Margen)',
    text: 'Keseg Sael, "el fin del callar" (los Nabieus nombran sus clanes "Keseg + algo"), es el grueso de los Nabieus de Berig: la mitad oriental de El Margen Silencioso, en grupos pequeños alrededor de El Refugio sin Nombre, el único sitio de Berig donde un Nabieus no tiene que guardar lo que sabe. Hacia fuera nunca dicen el nombre del clan: un forastero que lo sabe ha oído algo que no debía. De aquí salen casi todos los mensajeros de la Concordia; su código es el Karo\'sael, llevar sin abrir y sin preguntar. No tienen gobierno: ante algo grave se convoca un Keseg\'Vhurne (cónclave). Su portavoz de cónclave es Aven Tessk, viejo casi transparente, sin cargo de mando. Bajo el Refugio guardan el Archivo del Refugio, tablillas de observación (lo que un Nabieus ha visto, medido o contado con sus ojos, nunca cartas), herencia del Archivo Cegado del reino enterrado; quien alza la voz dentro no vuelve a entrar. Unos 1.500 miembros. Relaciones iniciales: con la Concordia, sumisión sin lealtad (sirven porque sobrevivir exige servir; el Yugo y la Purga no se olvidan); con Los del Obelisco, cautela; con Feg Tusha, convivencia distante (comparten el Margen por mitades); con Keseg Prisilke, parentesco (noticias por mensajero); con los clanes orcos, poco contacto.',
    tags: ['keseg-sael', 'nabieus', 'margen-silencioso', 'refugio-sin-nombre', 'aven-tessk', 'karo-sael', 'archivo-del-refugio', 'facciones'],
    sourceDoc: 'razas.md',
  },
  {
    type: 'CLAN',
    title: 'Keseg Prisilke (los Nabieus de la Ciénaga)',
    text: 'Keseg Prisilke, "Fin Susurrado" (Jeyselt en su lengua), es el clan Nabieus del sur de Ciénaga Troncal, en la explanada más pequeña, a 1-2 jornadas de El Refugio sin Nombre. Nació de la segunda huida Nabieus: el silencio que dejaron de necesitar entero y rebajaron a susurro. Generaciones en aguas altas les dieron brazos y piernas más largos, piel con manchas verdes y postura encorvada. Viven de la caza y de la madera de los Trepadores Ocaso más que del sigilo, y son los únicos Nabieus a quienes la Concordia apenas usa de mensajeros: les exige madera, como a los Goshg. Keseg Sael los ve como "los que se olvidaron de callar", con distancia pero sin desprecio. La representa Ilka Dren, cazadora mayor que lee el agua metiendo la pierna hasta la rodilla y negocia la madera con la Terk\'ikar Doshka de igual a igual. Unos 500 miembros. Relaciones iniciales: con el Clan Goshg, convivencia práctica (vecinos de la Ciénaga; intercambian madera y noticias, no se casan entre sí); con la Concordia, tributo resignado (madera, no mensajeros); con Keseg Sael, parentesco; con los Faerus, sin contacto (no comparten región).',
    tags: ['keseg-prisilke', 'nabieus', 'cienaga-troncal', 'jeyselt', 'ilka-dren', 'facciones'],
    sourceDoc: 'razas.md',
  },
  {
    type: 'CLAN',
    title: 'Feg Tusha (los Faerus de Hashma)',
    text: 'Feg Tusha, "Manada Madre", es la manada base de los Faerus: la más numerosa y la más salvaje, con pelaje denso en tonos de corteza y musgo y artesanía mínima. Vive en Hashma (Selviterna), el poblado colgado de los árboles en la selva occidental de El Margen Silencioso, cerca de la costa; su interior es el Jakut Tusha ("Trono Madre"), un gran salón de piel y hueso en lo alto del árbol más robusto. El año 0 es el primer año que esta manada pasó entera en un poblado fijo, en lugar de moverse con la caza. Su olfato manda sobre la vista: son los mejores rastreadores de Berig en terreno cerrado y los únicos que cruzan el Margen de lado a lado siguiendo el olor. No hay cargo de mando: decide quien está sentado en el Jakut. Hulki, la vieja que más a menudo lo ocupa, decide si un forastero pasa del primer árbol. Con ella: Tira, cazadora mayor que reparte la primera pieza; Kiri, vigía del dosel en forma de Hetris; Lusa, que cuida a los heridos; y Gero, el joven que corre entre Hashma y Kegi. Unos 850 miembros. Relaciones iniciales: hostil a la Concordia (las patrullas los tratan como presa) y al Clan Serhu (sus incursiones en el Margen van contra ellos); convivencia distante con Keseg Sael; misma raza y sin rivalidad con Feg Ger; a los Maktor los conocen de oídas.',
    tags: ['feg-tusha', 'faerus', 'hashma', 'selviterna', 'hulki', 'jakut', 'margen-silencioso', 'facciones'],
    sourceDoc: 'razas.md',
  },
  {
    type: 'CLAN',
    title: 'Feg Ger (los Faerus de Kegi)',
    text: 'Feg Ger, "Manada Roja" (por su pelaje corto, rojizo con matices verdes), es la manada Faerus de la llanura, en Kegi ("arena" en Feg), en la franja sur de las Llanuras del Viento Rojo, a 1-2 jornadas de selva de Hashma. Su interior es el Jakut Ger ("Trono Rojo"), una losa plana de piedra roja a la sombra de El Vergel de Kegi. Son los Faerus más sociables y los mejores curtidores de su raza, y la única manada que comercia de verdad: en El Vergel cambian pieles curtidas y colmillo tallado (la daga Ashi\'krul) por hierro, sal y Lana de Múrgol. Comercian con cualquier orco, pero solo comparten la primera pieza con quien consideran de la manada. Nacieron del Pacto de la Primera Pieza con el Clan Maktor. No son dueños de la región: viven en territorio Serhu sin disputarlo. Quien más a menudo está en el Jakut Ger es Yeru, que conoció a Gorhorn durante su año con la manada y lo recuerda como "el orco que olía a pena y no a miedo"; Tasko, curtidor y tallador, lleva el comercio del Vergel. Unos 200 miembros. Relaciones iniciales: comercio frío con el Clan Serhu (huelen el miedo que gobierna Karot Veku y no se fían); vínculo antiguo con los Maktor, hoy reducido a Gorhorn; hostil a la Concordia (aunque en la llanura hay menos patrullas); misma raza que Feg Tusha.',
    tags: ['feg-ger', 'faerus', 'kegi', 'yeru', 'tasko', 'el-vergel', 'jakut', 'facciones'],
    sourceDoc: 'razas.md',
  },
  {
    type: 'CULTURA',
    title: 'El Jakut — mandar sin cargo (Faerus)',
    text: 'Los Faerus no se gobiernan y no tienen palabra para quien manda, pero los dos interiores Faerus se llaman Jakut, "trono": lo que tiene nombre es el sitio, no el cargo. En Hashma es una plataforma ancha en la horquilla del árbol más viejo del poblado; en Kegi, una losa plana de piedra roja a la sombra del Vergel. Quien está sentado en el Jakut decide lo que haya que decidir mientras está sentado; cuando se levanta, deja de decidir. Nadie "es" líder: se está en el Jakut. Se sienta quien la manada deja sentarse, casi siempre el más fuerte o el más viejo, sin regla fija. Si dos quieren el sitio a la vez, se resuelve con el olfato y no a golpes: el que huele a miedo se aparta. Consecuencia para quien negocia: se negocia con quien esté en el Jakut ese día, y un acuerdo no obliga a quien se siente mañana, salvo que se haya sellado compartiendo la primera pieza (Vash\'grath). Para un Faerus lo único que dura es el parentesco, no la palabra dada. Por eso el jefe de cada facción Faerus es solo quien más a menudo ocupa el Jakut: Hulki en Hashma, Yeru en Kegi.',
    tags: ['jakut', 'faerus', 'vash-grath', 'primera-pieza', 'feg-tusha', 'feg-ger', 'liderazgo'],
    sourceDoc: 'razas.md',
  },
  {
    type: 'CLAN',
    title: 'Relaciones entre facciones de Berig (posturas iniciales y conflicto abierto)',
    text: 'Concordia de Hierro: tensión alta con Los del Obelisco (se necesitan); Keseg Sael le sirve sin lealtad; Keseg Prisilke, con tributo resignado de madera; hostil a Feg Tusha y a Feg Ger (las patrullas los tratan como presa). Clan Serhu: hostil a Feg Tusha (incursiones de la casta de Ketg en el Margen); comercio frío con Feg Ger; frialdad de Los del Obelisco hacia él (lo ven como brazo de los radicales). Los del Obelisco: desconfianza útil con Keseg Sael, neutral con Helsig y Goshg, sin contacto con los Faerus. Keseg Sael: convivencia distante con Feg Tusha, parentesco con Keseg Prisilke, poco contacto con los orcos. Keseg Prisilke: convivencia práctica con Goshg. Feg Tusha y Feg Ger: misma raza, sin rivalidad; Feg Ger conserva un vínculo antiguo con los Maktor. Conflicto abierto: Serhu + Concordia contra Helsig + Goshg. Los Serhu, armados por la Concordia, empiezan a asaltar a Helsig y Goshg, que responden con bajo perfil y empalizadas; los Goirntes ceden esa tarea a los Serhu para gastar vidas Serhu antes que Goirntes. Helsig y Goshg mantienen un perfil neutral y defensivo: la Concordia les pide mineral y madera antes que guerreros.',
    tags: ['relaciones', 'facciones', 'diplomacia', 'serhu', 'concordia-de-hierro', 'helsig', 'goshg', 'conflicto'],
    sourceDoc: 'propuestas-aprobadas.md',
  },
  {
    type: 'REGION',
    title: 'La Meseta del Orden y El Baluarte de Goirme',
    text: 'Región más meridional de Berig (~221 x 167 km), territorio Goirntes, fuera del núcleo jugable: Gorhorn no ha estado aquí. Desierto de piedra gris tallado con simetría antinatural, obra de Goirme; ciudades-fortaleza de piedra pulida y hierro negro, acueductos perfectos y leyes grabadas en obeliscos (Vresk\'ord). Es el corazón de la Concordia de Hierro y comparte la región con Los del Obelisco. Solo toca el Margen Silencioso. El Baluarte de Goirme, sede de la Concordia y mayor de las ciudades-fortaleza, tiene el obelisco de leyes más alto de Berig porque fue el primero: se talló antes de levantar la ciudad, que creció alrededor y siguiendo sus ejes. En él sigue grabado el Primer Edicto del Tributo. Allí residen el Primer Censor Tarsen Vold y la Archimagistrada Yovenne Tal. Las ciudades se numeran por orden de fundación: tras El Baluarte, Vresk Hes (interior, entre los campos de Hierba del Hierro; forjas mayores, de donde salen las armas que suben a los Serhu), Vresk Tuh (frontera norte, junto al Margen: Goirntes de piel clara que trabajan la madera; la ciudad que más odia y más teme a los Faerus) y Vresk Kei (puerto oriental, recibe las balsas del tributo de madera). De la quinta en adelante son ciudades menores, nombradas por su función. El Margen es el muro natural del Imperio: la Concordia lo rodea por el corredor costero occidental (~80 km, 2-3 jornadas hasta El Cruce de las Cenizas).',
    tags: ['meseta-del-orden', 'baluarte-de-goirme', 'goirntes', 'concordia-de-hierro', 'obelisco', 'vresk-hes', 'vresk-tuh', 'vresk-kei'],
    sourceDoc: 'meseta-del-orden.md',
  },
  {
    type: 'REGION',
    title: 'El Margen Silencioso',
    text: 'Cinturón de ~215 x 103 km entre la Ciénaga Troncal y el extremo sur de las Llanuras (norte) y la Meseta (sur); fuera del núcleo jugable. Selva templada, pantanos y coníferas de madera negra donde el sonido se apaga sin eco ni rebote: es el dominio de Kroj, con el aire denso y el follaje (sobre todo el Musgo Callado) absorbiéndolo. No hay niebla: esa es del Estrecho. Nabieus de Keseg Sael en la mitad oriental, Faerus de Feg Tusha en la occidental. Lugares: Hashma (Selviterna), poblado Faerus colgado de los árboles cerca de la costa, con el Jakut Tusha; El Claro de la Manada, pasto de reunión Faerus, arrasado tras El Detonante (la manada de Riko se rompió y aparecieron criaturas mutadas en los límites); El Refugio sin Nombre, enclave Nabieus con el Archivo del Refugio; y El Cruce de las Ausencias, Las Aguas Sordas y La Proa Gris. Kegi, poblado Faerus de Feg Ger, queda ya en las Llanuras, a 1-2 jornadas de selva de Hashma. Es el muro natural del Imperio: una columna Goirnte no lo cruza, un mensajero Nabieus sí, en 2-3 jornadas leyendo el suelo con la palma. Desde El Borde (~2.100-2.800, provisional) los Nabieus llevan el correo del orden a cambio de que ninguna columna entre en su mitad. Los Goirntes de la frontera norte talan su borde sur, motivo diario de choque con los Faerus.',
    tags: ['margen-silencioso', 'kroj', 'nabieus', 'faerus', 'hashma', 'refugio-sin-nombre', 'el-borde', 'claro-de-la-manada', 'kegi'],
    sourceDoc: 'margen-silencioso.md',
  },
  {
    type: 'REGION',
    title: 'Lugares nuevos del Margen Silencioso: Cruce de las Ausencias, Aguas Sordas y Proa Gris',
    text: 'El Cruce de las Ausencias, centro del Margen y paso entre las dos mitades: bosque cerrado de coníferas de madera negra, suelo de raíces cubierto de Musgo Callado, quietud total (no se oye el viento ni los pasos propios). Sin asentamiento; regla que nadie pactó pero todos cumplen: dentro del Cruce nadie ataca a nadie de otra raza, porque nadie oiría pedir ayuda. Se cuenta que aquí grupos enteros "se desvanecieron": no hay nada sobrenatural, el Mekiosi espera inmóvil y caza de una embestida, y donde no se oye un grito un grupo separado unos pasos pierde a uno tras otro sin que el resto lo note; por eso se cruza atado con cuerda corta. "Aquí nadie oye cuando llamas." Las Aguas Sordas, franja pantanosa entre el Cruce y la mitad oriental: canales y charcas de agua negra de hasta dos metros, con islas de raíz que ceden bajo el peso de algo grande, y el agua no suena; solo se ven las ondas. Nadie vive aquí, los cazadores de Feg Tusha bajan en temporada seca; aquí aprendieron los Nabieus que la vibración viaja mejor por el agua. Hay Morvasa en los canales. "Mira el agua." La Proa Gris, borde sur frente a la Meseta: espolón de piedra gris, la única altura del Margen, cuya simetría se deshace hacia la punta y acaba en cortados de treinta metros. Keseg Sael mantiene un turno de vigía (5-10) que cuenta las columnas de la Concordia. Es terreno de caza de las Sombras de Kroj: los vigías bajan antes del anochecer.',
    tags: ['cruce-de-las-ausencias', 'aguas-sordas', 'proa-gris', 'margen-silencioso', 'mekiosi', 'morvasa', 'sombras-de-kroj'],
    sourceDoc: 'margen-silencioso.md',
  },
  {
    type: 'REGION',
    title: 'Lugares nuevos de la Meseta: El Puesto del Corredor y Las Canteras del Eje',
    text: 'El Puesto del Corredor: puesto de control en el extremo sur del corredor costero, donde el camino que bordea el Margen entra en la Meseta; la otra puerta de las columnas que llegan al Cruce de las Cenizas. Explanada de piedra gris pulida donde se cruzan en ángulos exactos tres caminos: el corredor costero, el que sube a El Baluarte y el que lleva a las forjas de la frontera norte. Hay un obelisco menor con los edictos de paso. Los dos inspectores de la casta de ley anotan cada carga, cada nombre y cada hora, y los guarda una escuadra de 12; un registro de entrada sin su salida es un asunto inacabado y se persigue. Sin sello de patrulla no se entra a la Meseta sin mentir, sobornar o rodear por el Margen. Las Canteras del Eje: de donde sale cada obelisco de leyes de Berig, siempre de la misma veta que el primero de El Baluarte; un edicto grabado en otra piedra no se considera del todo válido, y ningún Goirnte sabría explicar por qué. Galerías paralelas siguiendo los ejes de la Meseta; los bloques se cortan con herramientas de aleación de Hierba del Hierro y se pulen con arena y agua en surcos del suelo. Trabaja aquí un linaje de unos 30 talladores, en silencio y por turnos. Un obelisco a medio tallar nunca se abandona: si su talladora muere, otra lo termina con la misma herramienta.',
    tags: ['puesto-del-corredor', 'canteras-del-eje', 'meseta-del-orden', 'obelisco', 'corredor-costero', 'sello-de-patrulla'],
    sourceDoc: 'meseta-del-orden.md',
  },
  {
    type: 'REGION',
    title: 'Ciénaga Troncal: Marismas de Lodo Negro y Holdo, Senda del Sílice y tributo por mar',
    text: 'Marismas de Lodo Negro: nacen de la mezcla de resina de Holdo, agua y fango gris. En la superficie se acumulan los restos más espesos de la resina, una capa viscosa que sella el agua de debajo del aire y del barro de arriba; debajo hay una red de túneles sumergidos con el agua más pura y cristalina de Berig. El Holdo es un árbol bajo y ancho, pariente del Trepador Ocaso pero sin vetas doradas, que solo crece en las marismas; su resina negra y pesada gotea al agua y flota. Los Goshg la usan para calafatear el fondo de las canoas. La Senda del Sílice (~3.000-3.500, provisional) une desde hace siglos Cristal Helado y la Ciénaga por el borde oriental de las Llanuras: hielo sílice y cuchillos Helsig hacia el sur, madera y resina Goshg hacia el norte (los Helsig compran resina de Trepador para antorchas que no se apagan con la ventisca). Los Maktor maltrechos cambiaron pieles por madera de ciénaga en ella; los Serhu, dentro del cerco Goirnte, nunca. Cruza por el Desfiladero Esmeralda, borde norte de la Ciénaga. Tributo por mar: la madera que exige la Concordia no baja por el Margen (nadie saca troncos de ese laberinto) sino por la costa oriental; Goshg y Prisilke la llevan a la Costa Corredor, único punto de la Ciénaga donde se ven Goirntes con regularidad, y allí la embarcan balsas Goirntes rumbo a Vresk Kei y El Baluarte, donde todo se cuenta y se graba. El mineral Helsig baja por tierra hasta El Cruce de las Cenizas.',
    tags: ['cienaga-troncal', 'marismas-lodo-negro', 'holdo', 'senda-del-silice', 'tributo', 'costa-corredor', 'goshg'],
    sourceDoc: 'cienaga-troncal.md',
  },
  {
    type: 'CULTURA',
    title: 'Fundación de El Baluarte de Goirme (era mítica, sin fechar)',
    text: 'Primera oleada de razas diseñadas, sin año (antes del año 0 no hay fechas, solo orden de sucesos). Los primeros Goirntes leyeron la simetría de la Meseta como una ley escrita expresamente para ellos, y su primer acto como pueblo fue coherente con eso: antes de levantar un muro, buscaron el punto donde se cruzan los ejes de la Meseta, tallaron allí un obelisco y grabaron en él las primeras leyes. La ciudad-fortaleza se construyó después, alrededor del obelisco y siguiendo sus ejes. Por eso El Baluarte tiene el obelisco de leyes más alto de todo Berig en su plaza central: es el más alto por ser el primero, y ninguna ciudad posterior levantó el suyo por encima. La ciudad que creció a su alrededor es la mayor de las ciudades-fortaleza. Los Goirntes lo enseñan a sus hijos como lección fundacional: primero la ley, después la ciudad. La simetría de la Meseta es obra de Goirme durante la Formación, sobre el material de Liania; los Goirntes no crearon nada, la midieron.',
    tags: ['baluarte-de-goirme', 'obelisco', 'goirntes', 'era-mitica', 'fundacion', 'goirme'],
    sourceDoc: 'cronologia-mitica.md',
  },
  {
    type: 'CULTURA',
    title: 'La segunda huida Nabieus y la escucha con la palma (era mítica, sin fechar)',
    text: 'Generaciones después de la caída del Reino Nabierus y mucho antes del año 0 (sin año, solo orden de sucesos). En el Margen el dominio de Kroj apaga el sonido en el aire, pero no la vibración que viaja por el suelo y las raíces. Los supervivientes aprendieron a apoyar la mano en una raíz o en el suelo para leer pasos, cargas o bestias que se acercan: la escucha con la palma (Tovh\'vhurne), la misma física con la que caza el Kirelon Arenoso. La Veldria Hueca, cuyo tronco conduce la vibración de toda la red de raíces, es su mejor aliada. No sustituye a la gramática de los silencios, que sirve para leer a las personas: es lo mismo aplicado al terreno. Un grupo de cazadores descubrió que en el agua estancada la vibración viaja todavía mejor: una presa que chapotea a cien pasos se siente en la pierna metida en el agua. Lo aprendieron primero en Las Aguas Sordas y luego, siguiendo la caza hacia el norte, en las aguas altas del sur de Ciénaga Troncal. Las temporadas de caza acabaron siendo una vida: generaciones caminando por aguas altas dieron brazos y piernas más largos, manchas verdes y postura encorvada, y el oficio pasó del mensaje a la caza y la madera. Es el origen de Keseg Prisilke. Es transmisión de vibraciones por sólidos y líquidos más adaptación física, sin intervención de ninguna Semilla.',
    tags: ['segunda-huida', 'nabieus', 'tovh-vhurne', 'keseg-prisilke', 'aguas-sordas', 'era-mitica'],
    sourceDoc: 'cronologia-mitica.md',
  },
  {
    type: 'CULTURA',
    title: 'El Pacto de la Primera Pieza y la fundación de Kegi (~2.300, provisional)',
    text: 'Unas generaciones después de Krugo y Tevya, una partida de caza Maktor y una manada Faerus de la frontera sur de las Llanuras abatieron a la vez el mismo Canizor adulto. Lo esperable era pelear por la presa. La cabecilla Maktor, de sangre de Tevya, ofreció a la manada la primera pieza (Vash\'grath), algo que los Faerus solo habían visto entre los suyos: para un Faerus, compartirla define quién es de la manada, así que el gesto se leyó como parentesco y no como comercio. Que la presa fuera el animal que da nombre a los Maktor añadió peso al gesto en los dos pueblos. La manada levantó un campamento fijo para seguir tratando con los Maktor: Kegi, origen del Feg Ger. Los Faerus enseñaron el curtido fino y los Maktor lo que sabían de la llanura abierta, por eso los Faerus de la llanura tienen más artesanía que los de la selva; los Maktor adoptaron la palabra Vash\'grath sin traducirla. Tras el golpe de Ketg (~2.850) los Serhu no heredaron el pacto: nunca han compartido la primera pieza con nadie. Por eso los Faerus comercian con cualquier orco pero solo confían en los Maktor, y el año de Gorhorn con ellos no fue casualidad. Ninguna magia: un malentendido cultural afortunado entre dos pueblos con tabúes parecidos. Los Faerus no escriben; el testimonio físico es un colmillo de Canizor con dos marcas (un zarpazo Maktor y una muesca Faerus) que se guarda en el Jakut Ger.',
    tags: ['pacto-de-la-primera-pieza', 'kegi', 'faerus', 'maktor', 'vash-grath', 'canizor', 'feg-ger', 'historia'],
    sourceDoc: 'clanes-orcos.md',
  },
  {
    type: 'CULTURA',
    title: 'La Mesa del Lazo y el Drogh\'tugh (~2.855, provisional)',
    text: 'Tras la traición de Ketg a Nietka (~2.850), la Terk\'ikar Maktor Tregig (el Kort\'ikar era Prehk) vio fallar a dos jefes de guerra: uno por ambición (Ketg) y otro por debilidad (Prehk, que dejó que Ketg se quedara también con los Maktor). Sin fuerza para rebelarse, reunió en secreto a los Maktor ante una losa de piedra roja de la llanura, con un surco en el centro, y fijó un juramento, el Drogh\'tugh, el Lazo del honor. Desde entonces todo Maktor lo pronuncia allí al cumplir los 10 años, el año de la cacería ritual: reconocer los errores de quienes le precedieron; proteger al clan incluso de su propio líder, si ese líder lo daña; aceptar que la unidad vale más que cualquier mando. Tras cada juramento se echa un puñado de tierra fresca en el surco; cuando se llena, la tierra se retira a un montículo junto a la mesa, que crece con cada generación. El Lazo explica el carácter Maktor ("los primeros en dar la cara por su gente"), la clemencia de Kadrog con Mordek (perdonar al vencido para que la unidad importe más que la victoria) y la revuelta del padre de Gorhorn (proteger al clan de quien lo daña, aunque mande). La mesa sobrevive, partida en dos, entre Los Restos de Maktor, junto a un montículo más alto que un orco: un elemento narrativo, no un botín. No es canon que Gorhorn pronunciara el Lazo: el Narrador no debe afirmarlo.',
    tags: ['mesa-del-lazo', 'drogh-tugh', 'maktor', 'tregig', 'restos-de-maktor', 'juramento', 'historia'],
    sourceDoc: 'clanes-orcos.md',
  },
  {
    type: 'CULTURA',
    title: 'El Primer Edicto del Tributo y el Yugo de Hierro (~3.600, provisional)',
    text: 'El Yugo de Hierro (Ithal\'ord en Kerost, "el imperio que se paga") empieza con un acto concreto: el primer tratado desigual impuesto a los clanes orcos, grabado como Ord\'teandu (edicto) en el obelisco de leyes de El Baluarte de Goirme. Impone un tributo anual de mineral y contingentes de guerra obligatorios que cada clan entrega "en defensa del orden". Lo firmó la casta de Ketg en nombre de los clanes de las Llanuras; los grupos emigrados a Cristal Helado y a la Ciénaga, todavía pequeños, quedaron obligados después por extensión, sin haber firmado nada. El texto sigue grabado y dice "en defensa del orden", no "donde el mando decida": Los del Obelisco lo citan de memoria contra el uso que la Concordia hace hoy de los contingentes orcos. Los archivos Goirntes llaman "reajuste de los tratados" a la Purga Silenciosa (~3.650), que lo rompió; para un Goirnte el edicto nunca se derogó, solo se "reajustó", y ese es el argumento legal con el que la Concordia resucita los contingentes. Leerlo en el obelisco sería una pieza de la cadena de pruebas de Los del Obelisco, cuando la Meseta sea jugable.',
    tags: ['primer-edicto', 'yugo-de-hierro', 'ithal-ord', 'tributo', 'obelisco', 'los-del-obelisco', 'purga-silenciosa', 'historia'],
    sourceDoc: 'historia.md',
  },
  {
    type: 'FLORA',
    title: 'Flora nueva del Margen Silencioso',
    text: 'Musgo Callado (Muscarias, todo el Margen): musgo gris apagado, sin brillo, en cojines de 5-15 cm; una maraña de filamentos finísimos con bolsas de aire donde el sonido entra, rebota y se disipa, como en un fieltro grueso a escala de bosque. Es la mitad física del follaje que absorbe el sonido; los Nabieus tapizan con él sus cámaras y los Faerus forran sus refugios de caza (recurso tier 1, relleno aislante). Veldria Hueca (Veldrias): conífera de madera negra de 8-12 m con un corazón hueco y seco; la pared del tronco conduce la vibración de toda la red de raíces, y un Nabieus que apoya la palma siente pasos a centenares de metros. Los Faerus no la talan, los Nabieus solo toman ramas caídas: talar una deja sordo un trozo de bosque (madera y resina tier 3). Flor de Víspera (Salviras): planta baja de hojas gris plata cuyas flores gris perla solo se abren al atardecer; su aroma es un sedante suave que ayuda a dormir sin tocar el dolor; los Faerus mastican un pétalo antes de dormir en territorio hostil. Cántaro de Hoja (Zarcos): arbusto de tallo central hueco que retiene agua de lluvia limpia, la única del Margen que no es agua negra estancada. Carnosa de Tocón (Fongares): seta carnosa en forma de embudo, gris azulada, sobre tocones caídos; asada o en guiso sabe suave a tierra, y es la comida del Brozán.',
    tags: ['flora', 'margen-silencioso', 'musgo-callado', 'veldria-hueca', 'flor-de-vispera', 'cantaro-de-hoja', 'carnosa-de-tocon'],
    sourceDoc: 'margen-silencioso.md',
  },
  {
    type: 'FAUNA',
    title: 'Fauna nueva del Margen Silencioso',
    text: 'Leshra (Umbrias, nivel 2-5, CAUTELOSA, AEREO): ave nocturna de unos 120 cm de envergadura; el borde deshilachado de sus plumas rompe el aire sin ruido y su plumaje gris ceniza atrapa la luz como la piel Nabieus, un hueco a la vista. Caza Brozanes e insectos grandes y solo ataca si alguien se acerca a su nido; los Faerus usan sus plumas para emplumar flechas que no silban. Morvasa (Escamados, nivel 3-6, CAUTELOSA, ACUATICO): serpiente de 180-220 cm de Las Aguas Sordas; paraliza con veneno neurotóxico y come por partes, inmóvil bajo el agua, y su única señal es una onda en la superficie. Brozán (Rondines, nivel 1-2, INOFENSIVO): roedor de 35-45 cm de pelaje gris verdoso que imita la corteza podrida; presa base del Margen, se lo comen la Leshra, la Morvasa y el Mekiosi. Hoscón (Corvenes, nivel 1-2, INOFENSIVO): el carroñero que camina; bajo el dosel cerrado no puede buscar carroña desde el aire, así que recorre el suelo siguiendo el olor. Donde camina un Hoscón hay algo muerto cerca, y los cazadores Faerus lo siguen igual que los orcos siguen al Zense. Ya en el Margen desde antes: Sombras de Kroj (Umbrias 3-8), Hetris (Acechantes 4-9, dosel alto), Mekiosi (Acechantes 7-13, emboscada inmóvil) y Vistue (Guelises 3-7, manadas de 5 a 8).',
    tags: ['fauna', 'margen-silencioso', 'leshra', 'morvasa', 'brozan', 'hoscon', 'hetris', 'mekiosi', 'vistue'],
    sourceDoc: 'margen-silencioso.md',
  },
  {
    type: 'FLORA',
    title: 'Flora nueva de la Ciénaga Troncal',
    text: 'Bulbo de Turbera (Bulvias, zonas llanas): tubérculo elíptico de 15-30 cm, piel parda y pulpa blanca y firme, que crece en el fango de turba; es el alimento base de Keseg Prisilke y de los Goshg cuando falla la caza de Cornantes (cocido, frito o seco al humo; tier 1). Velo de Charca (Marelas, charcas quietas entre los pilotes): láminas gelatinosas y translúcidas de 5-15 cm; se come en sopa y, fresca sobre una quemadura, enfría y protege: es la cura de campo más habitual de los Goshg, que se queman a menudo con la resina de sus antorchas (tier 1). Herrumbrera (Vetrias, orillas de agua estancada): arbusto de 40-70 cm de corteza color óxido; el fango arrastra hierro disuelto y sus raíces lo concentran en la corteza, el mismo principio que la Hierba del Hierro de la Meseta pero con un mineral mucho más pobre, y no brilla. Explica que los Goshg tengan algo de metal en una región pobre en minerales: da para puntas de lanza y clavos, no para una herrería (Corteza Herrumbre, tier 2). Holdo (Veldrias, Marismas de Lodo Negro): árbol bajo y ancho de resina negra y pesada, sin vetas doradas (Resina de Holdo, tier 2, impermeabilizante con el que los Goshg calafatean las canoas). Trepadores Ocaso: resina que sella la madera contra la humedad.',
    tags: ['flora', 'cienaga-troncal', 'bulbo-de-turbera', 'velo-de-charca', 'herrumbrera', 'holdo'],
    sourceDoc: 'cienaga-troncal.md',
  },
  {
    type: 'FAUNA',
    title: 'Fauna de la Ciénaga Troncal',
    text: 'Cornante (Bestiones, nivel 3-8, CAUTELOSO): cuadrúpedo corpulento de cornamenta ancha y ramificada, principal alimento de los orcos de la Ciénaga. Cazarlo es trabajo de grupo y de paciencia: se le acorrala hacia el agua baja, donde su propio peso lo hunde, y hay que hacerlo deprisa porque un Cornante hundido atrae Tragalodos. Tragalodo (Escamados, nivel 8-14, AGRESIVO): reptil acorazado de 3-4 m, placas pardas cubiertas de barro seco y ojos a ras de cabeza; caza en el agua baja y huele la sangre desde lejos. Es el depredador grande de la Ciénaga (Placas de Tragalodo tier 5, Dientes tier 4). Borbol (Nadantes, nivel 1-2, INOFENSIVO, ACUATICO): pez de fondo de 30-50 cm que respira aire y sube a la superficie con un golpe de cola cada pocos minutos; los cazadores de Keseg Prisilke leen esa vibración con la pierna metida en el agua. Remonta las Cataratas Madre Fango en primavera y su carne grasa se ahúma bien. Zancapilote (Zancudos, nivel 2-5, CAUTELOSO): ave zancuda gris de 1,5 m que anida en los pilotes abandonados del Cerco y roba pescado de las redes; los Goshg la toleran porque grazna en cuanto algo grande se mueve bajo el agua, su alarma contra el Tragalodo.',
    tags: ['fauna', 'cienaga-troncal', 'cornante', 'tragalodo', 'borbol', 'zancapilote'],
    sourceDoc: 'cienaga-troncal.md',
  },
  {
    type: 'LOOT',
    title: 'Objetos de la tanda de Kegi y las Llanuras: Ashi\'krul, Desollador de sílice, Ungüento de Espina, Manto de Cornisa, Incisivos de Miruina',
    text: 'Colmillo de Ferike (material, tier 6, 8 Goirnos; el de hembra, 12): colmillo de 20-35 cm, marfil con vetas pardas, duro pero quebradizo contra la piedra; sale del despiece del Ferike. Ashi\'krul, "el colmillo que huele" (daga, ARMA_SECUNDARIA, tier 6, 30 Goirnos, Destreza +4, requiere Destreza 13): tallada en un colmillo de Ferike hembra con la empuñadura envuelta en piel de Ferike; el Ferike solo teme a los Faerus, y llevar su colmillo dice que su portador cazó a quien caza. No se fabrica: se compra a Tasko en Kegi o se gana como recompensa. Desollador de sílice (cuchillo, ARMA_SECUNDARIA, tier 3, 25 Goirnos, Destreza +4, requiere Destreza 9): hoja curva de hielo sílice tallada por los Helsig y cachas de Caparazón de Espina del Viento del Desolladero Serhu; herramienta de desollador, curtidor y peletero, el único objeto de Karot Veku que admite que los Serhu necesitan a otro clan. Ungüento de Espina (medicinal, tier 3, 12 Goirnos): anestésico de campo, pasta ámbar de olor amargo; el alquimista Serhu lo prepara con 1 aguijón con veneno de Espina del Viento, 2 pétalos de Flor de Ceniza y 1 Resina Telda Gris (salen 2). Mal dosificado, adormece también el juicio. Manto de Cornisa (cosmético de espalda, tier 2, 6 Goirnos, sin bonos): fieltro de lana de Múrgol con plumas blancas de Celubia; prueba de valor de la costa de Los Acantilados Partidos, sin rito sagrado; lo cose el sastre con 4 Plumas de Celubia y 2 Lana de Múrgol. Incisivos de Miruina (herramienta, tier 2, 3 Goirnos): peine natural que limpia pieles antes de curtirlas, para curtidor y peletero.',
    tags: ['loot', 'ashi-krul', 'colmillo-de-ferike', 'desollador-de-silice', 'unguento-de-espina', 'manto-de-cornisa', 'incisivos-de-miruina'],
    sourceDoc: 'items.md',
  },
  {
    type: 'CULTURA',
    title: 'Edificios de oficio: un taller por cada oficio',
    text: 'Cada oficio con Maestro tiene su edificio, para el reino del jugador y para las facciones. Son 14: Herrería, Curtiduría, Peletería, Desolladero, Corrales (animales domados; exigen una Jaula), Carpintería, Sastrería, Herboristería, Casa de curas (además cura un estado más rápido a los compañeros heridos del reino), Taller de alquimia, Cocina común (alimenta de verdad la comida del reino), Embarcadero de pesca (solo con costa o agua), Obrador de piedra y Boca de mina (esta, solo con veta). Un edificio no produce solo: necesita un compañero asignado con el oficio y una orden de producción, y sus recetas salen de las que ya tiene ese oficio. Mejoran en tres escalones: Taller (recetas de tier 1-3, 1 plaza), Obrador (tier 4-6, 2 plazas) y Gran obrador (tier 7-9, 4 plazas); mejorarlo pide un Ayuntamiento mayor y el oficio de constructor. Doble llave: el edificio limita el tier y el trabajador limita lo que sabe hacer. Cada raza y región le da aspecto propio (Serhu en las Llanuras, Helsig en Cristal Helado, Goshg en la Ciénaga). Las facciones producen por agregado: quemar la Cocina Serhu les baja la comida. Los talleres Goshg (astillero de pilotes, resinería, ahumadero, talla de tótems) aún no tienen oficio ni Maestro; hoy solo les corresponde la Casa de curas. Faerus, Nabieus y Goirntes no tienen oficios propios todavía.',
    tags: ['edificios-de-oficio', 'reino', 'oficios', 'produccion', 'facciones', 'taller'],
    sourceDoc: 'edificios-de-oficio.md',
  },
  {
    type: 'NPC',
    title: 'NPCs del presente (Berig): los Faerus de Hashma y de Kegi',
    text: 'Hashma (Feg Tusha). Hulki: vieja de pelaje encanecido en el hocico y hombros de quien ha cargado presas toda la vida; la que más a menudo está en el Jakut Tusha, huele el miedo ajeno y decide si un forastero pasa del primer árbol; paciente, seca, imposible de engañar (Druida Aulladora, nivel 18). Tira: cazadora mayor con cicatrices de garra de Ferike en un antebrazo, reparte la primera pieza; directa, justa hasta la dureza (nivel 6). Kiri: joven de brazos largos que pasa las noches en el dosel en forma de Hetris; el primero en ver llegar a una patrulla (nivel 5). Lusa: mayor de movimientos lentos que cuida en una plataforma aparte a los heridos (los Feg\'nur, los que no se abandonan) con Musgo Callado y Flor de Víspera; cálida con los suyos, fría con los demás (nivel 4). Gero: joven de pelaje menos denso porque su madre es de Kegi; lleva noticias entre las dos manadas y es el único de Hashma que ha hablado con un orco (nivel 3). Kegi (Feg Ger). Yeru: madura, ancha de hombros, con una muesca en la oreja izquierda; la que más a menudo está en el Jakut Ger; conoció a Gorhorn y no sabe si fue un error no compartir con él la primera pieza; si Gorhorn vuelve a Kegi podría ofrecerle la Vash\'grath y renovar el Pacto (misión posible, no hecho canonizado); reservada y leal (Druida Salvaje, nivel 18). Tasko: curtidor y tallador joven, manos manchadas de tanino, talla las Ashi\'krul y lleva el comercio de El Vergel; el único Faerus que regatea, y lo hace fatal (nivel 5).',
    tags: ['npcs', 'faerus', 'hulki', 'tira', 'kiri', 'lusa', 'gero', 'yeru', 'tasko', 'hashma', 'kegi'],
    sourceDoc: 'npcs.md',
  },
];
