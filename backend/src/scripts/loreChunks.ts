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
    text: 'Helek Sirik nunca tuvo una luna convencional, obra conjunta de tres Semillas. Liania hizo que el escombro que debía formar un satélite fuera un cristal duro y frágil que se astilla en cada colisión en vez de fundirse — nunca pudo acretar en un cuerpo único, se quedó como polvo. Goirme fijó ese polvo en una órbita estable en la atmósfera alta, ni tan baja que caiga ni tan alta que escape — un cinturón continuo, como los anillos de un planeta. Ese cinturón refleja luz todo el tiempo, de día y de noche, pero de día se pierde contra el brillo del propio cielo (igual que las estrellas); solo de noche —dominio de Kroj— se hace visible, como un brillo difuso y perlado repartido por todo el cielo, nunca un disco nítido de luna. De ahí el nombre popular "brillo de luna" y el nombre de los Kelife.',
    tags: ['cielo', 'sin-luna', 'brillo-de-luna', 'liania', 'goirme', 'kroj'],
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
    text: 'Los orcos nacen del Estallido sin Semilla creadora, así que su magia interior es la más fuerte de Helek Sirik. Tarkor, inspirado por el respeto de Ferios hacia la libertad de su propia creación, les selló el canalizador de serie que cualquier otra raza tiene para lanzar magia en crudo — no la magia en sí, solo la puerta directa. Los orcos encontraron una puerta trasera: ciertas piedras (runas) y cierta madera/hueso (tótems) absorbieron durante generaciones la misma magia salvaje del Estallido que corre por su sangre, y solo ellos entran en comunión con esos materiales. Los tótems encierran a los Hyanios ("Ancestros"), representación cultural orca de cada elemento, sin voluntad propia — magia elemental almacenada, no espíritus. Por eso ningún orco lanza magia en crudo con las manos, siempre a través de un tótem o runa trabajados.',
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
    text: 'Hierba del Hierro (diseñada, Vetria): sus raíces bioacumulan mineral metálico disperso en la piedra gris de la Meseta del Orden, el mismo principio de Liania que da mecanismo a todo lo demás — los Goirntes la procesan para aleaciones. Raíz de Fuego (salvaje, mutada): enredadera de zonas volcánicas orcas que libera gas inflamable, recolectada como explosivo/iniciador de fuego. Hielo Sílice: mineral (no flora) de Cristal Helado usado para herramientas y cuchillos, como el de Gorhorn. Trepadores Ocaso: árboles de la Ciénaga Troncal, cuya resina sella e impermeabiliza la madera contra la humedad de la ciénaga.',
    tags: ['flora', 'berig', 'raiz-de-fuego', 'hielo-silice', 'hierba-del-hierro'],
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
    text: 'Las Agujas Imán: campo de rocas negras imantadas donde las tormentas de arena magnética peinan la arena en crestas; la orientación se pierde entre ellas, y solo el Cardo Brújula (aguja imantada natural) anula la desorientación. La Sabana Alta: praderas de hierba roja alta, refugio y coto de caza de Corredores de Cauce, terreno donde el Aullador Rojo caza mejor por el sigilo que da la hierba. Playa de Ceniza Blanca: franja de arena clara entre roca, el punto de costa más accesible y menos hostil de la región. Los Acantilados Partidos: pared costera vertical con grietas profundas, oleaje violento, nidos de aves marinas en las cornisas — bello y letal. La profesión Pescador (nueva) se aprende con el Maestro Pescador Serhu y trabaja peces y marisco de la costa (Jashil, Negueo, Toluh, Bulco de Arena), nunca por Cazar.',
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
    text: 'Clan Helsig: tribus de Cristal Helado, expertas en trabajar el hielo sílice, asentadas en La Veta Helada. Gobierna la Terk\'ikar Brenka; su pareja, la Kort\'ikar Solgra, lidera la guerra. Gorhorn trabajó 3 meses en sus minas y forjó amistad real con un orco llamado Hagar. Clan Goshg: las dos tribus de la Ciénaga Troncal, viven de los Trepadores Ocaso y los Cornantes, reunidas en El Cerco de los Pilotes. Gobierna la Terk\'ikar Doshka; su hermano menor, el Kort\'ikar Dulgren, lidera la guerra. Ambos clanes mantienen un perfil neutral y defensivo ante la guerra de la Concordia — territorio completamente nuevo para Gorhorn.',
    tags: ['clan-helsig', 'clan-goshg', 'hagar', 'gorhorn', 'brenka', 'solgra', 'doshka', 'dulgren'],
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
    text: 'Kelife (Vaelira, Semilla Liania): piel cristalina, cercanos a lo humano. Goirntes (Berig, Semilla Goirme): piel gris, fríos y calculadores. Kalisar (Vaelira, Semilla Sezix): piel azabache, sufren la luz, afables pese a fama de asesinos. Jusaly (Vaelira, Semilla Florial, "El que Brota"): elementos vegetales, agrarios y longevos. Orcos (Berig, Tarkor/magia salvaje): corpulentos, honor y fuerza, clanes con Terk\'ikar y Kort\'ikar. Nabieus (Berig, Semilla Kroj): ausencia hecha carne, sigilo absoluto. Faerus (Berig, Semilla Ferios, "El que Nace"): bípedos/cuadrúpedos, instintivos pero muy inteligentes. Ilvenar (Vaelira, Semilla Berd): archivistas de memoria perfecta, neutrales.',
    tags: ['razas', 'kelife', 'goirntes', 'kalisar', 'jusaly', 'orcos', 'nabieus', 'faerus', 'ilvenar'],
    sourceDoc: 'razas.md',
  },

  // --- personajes.md ---
  {
    type: 'PERSONAJE',
    title: 'Gorhorn, guerrero del Clan Maktor (personaje de pruebas)',
    text: 'Orco de las Llanuras del Viento Rojo, único superviviente conocido del Clan Maktor tras ser usados como carne de cañón por el mando Goirntes. Orgulloso pero no arrogante, sorprendentemente afable para un orco, aunque con poca paciencia una vez la pierde. Fuerza física colosal, instinto de combate a corta distancia, alta resistencia al dolor. Mide 1,98m, colmillos medios (uno con prótesis de hielo sílice), pelo negro con trenzas de apliques azules, perilla en dos trenzas con enganches de hueso, tres cicatrices de latigazos en la espalda de sus años de trabajo forzado. Inventario: hacha de guerra rota usada como maza, cuchillo de hielo sílice, pico de minero, cataplasma de salvia del polvo, arnés de cuero, pantalones de piel, y un tótem de madera de ciénaga del Clan Maktor — su objeto más importante. Ahora lucha de forma independiente para que la muerte de su clan no sea en vano.',
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

  // --- docs/12-mundo-estructurado.md: contenido nuevo (Torgash concretado, Ulkha, Hagar
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
