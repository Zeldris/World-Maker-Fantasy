/// Variantes por sexo (petición explícita, 2026-07-22: "para fauna, npcs... con los símbolos de
/// macho y hembra... para ver la descripción independiente de como es en macho y como en hembra")
/// — mismo patrón que `RazaVariante` en berigLore.ts (sin modelo nuevo en Prisma): un mapa estático
/// keyed por el slug base de la entidad (el mismo `Npc.slug`/`harvestSource` sourceSlug ya usado en
/// todo el motor), con la descripción física combinándose con la general de la entidad en el
/// frontend, nunca sustituyéndola (mismo criterio que las variantes regionales de Orcos).
///
/// Alcance (decisión explícita de la usuaria): solo fauna de verdad (nunca flora/mineral, que no
/// tiene sexo) y NPCs de tipo PLANTILLA genéricos/repetibles (nunca individuos únicos con nombre
/// propio como Torgash o Gorhorn, que ya tienen un sexo fijo en su propio lore).
///
/// Sesgo hembra intencional (petición explícita, 2026-07-22): "intuyendo que para mí las hembras
/// en general son superiores... si te fijas en el lore MADRE y todas las Semillas son de sexo
/// hembra... quiero que al menos tengan un detalle que las haga especiales o mejores en el
/// atributo que más las define" (ver docs/rpgtarkor/lore-mundo/genesis.md — Madre y las 13 Semillas son
/// explícitamente femeninas, pese a que el género no está realmente definido entre los dioses).
/// Aplicado con matiz explícito de la propia usuaria — "no quiero que sea nada exagerado ni dar a
/// entender que todas las hembras de todas las razas son superiores": cada hembra gana UN detalle
/// concreto ligado al atributo/rasgo que de verdad define a esa especie/raza/rol (velocidad,
/// fuerza, sigilo, mando...), nunca una superioridad genérica de "mejor en todo". El macho conserva
/// su propio rasgo distintivo — distinto, no inferior en general, solo no el más marcado en ESE
/// atributo concreto. Los atributos de referencia son los ya fijados en `worldCatalog.ts` (`fauna`)
/// para cada especie/NPC con Npc propio.
export interface SexoVarianteInfo {
  rasgoFisico: string;
  description: string;
  /// Medida corporal aproximada en cm — altura de pie para bípedos, altura de cruz para
  /// cuadrúpedos, longitud total para reptiles/insectoides, envergadura de ala para aves (la
  /// propia `rasgoFisico`/`description` aclara cuál cuando no es obvia). Petición explícita
  /// (2026-07-22, "no tienen contexto de las otras cosas que hemos generado... que indique casi
  /// medidas exactas tanto en el macho como en la hembra"): cada imagen se genera SOLA, sin ver la
  /// del otro sexo, así que "misma complexión que el macho" no significa nada para el generador —
  /// hace falta una cifra absoluta en cada entrada, nunca una comparación con la otra.
  medidaCm: number;
  /// Esperanza de vida máxima aproximada, en años.
  edadMaxima: number;
}

export interface SexoVariantesEntry {
  macho: SexoVarianteInfo;
  hembra: SexoVarianteInfo;
}

// Defining attribute por especie (de worldCatalog.ts, `fauna`): corredor-de-cauce → destreza,
// gargantua-de-ceniza → fuerza, corretolvas → destreza, aullador-rojo → destreza, murgol → (sin
// combate, valor/utilidad), cruzavientos → destreza, rondador-de-brasas → sigilo (empate con
// fuerza, se elige sigilo por coherencia de "carroñero nocturno"), salamandra-de-escoria → fuerza,
// zense-ceniza → destreza, kirelon-arenoso → fuerza (ciego, caza por vibración/olfato, ver bio en
// worldCatalog.ts). Espina del Viento/Cornante/Sombra de Kroj no tienen Npc/atributos — se usa su
// rasgo narrativo ya establecido (veneno, adaptación al barro, sigilo).
//
// Medidas y edades (2026-07-22, "que indique casi medidas exactas tanto en el macho como en la
// hembra... siguiendo un poco la lógica de lore y de descripción de cada elemento"): cifras
// absolutas por especie/sexo, sin ninguna comparación textual entre ambos — cada imagen se genera
// sin ver la del otro sexo, así que "más grande que el macho" no aporta nada al generador.
export const FAUNA_SEXO_VARIANTES: Record<string, SexoVariantesEntry> = {
  'corredor-de-cauce': {
    macho: {
      rasgoFisico: 'Cuerpo esbelto de corredor de llanura, pelaje rojizo con marcas oscuras a lo largo del lomo, patas largas hechas para el trote sostenido.',
      description: 'Encabeza la manada marcando el paso largo de la migración, más aguante que chispa.',
      medidaCm: 145,
      edadMaxima: 12,
    },
    hembra: {
      rasgoFisico: 'Cuerpo esbelto de corredor de llanura, pelaje rojizo claro y uniforme, patas largas y finas hechas para el sprint corto.',
      description: 'Es quien de verdad decide cuándo la manada echa a correr — su instinto para el peligro llega antes que el de ningún macho.',
      medidaCm: 135,
      edadMaxima: 14,
    },
  },
  'salamandra-de-escoria': {
    macho: {
      rasgoFisico: 'Salamandra volcánica de complexión robusta y baja, escamas de un gris oscuro veteado de rojo ceniza, garganta que se hincha visiblemente antes de cargar.',
      description: 'Defiende un territorio amplio en el borde volcánico, aunque avisa antes de atacar de verdad.',
      medidaCm: 120,
      edadMaxima: 20,
    },
    hembra: {
      rasgoFisico: 'Salamandra volcánica de cuerpo grande y pesado, escamas de un gris ceniza uniforme sin veteado, sin hinchazón de garganta previa a la carga.',
      description: 'Permanece cerca de un mismo punto de calor, donde entierra sus huevos, y no avisa antes de defenderlos.',
      medidaCm: 130,
      edadMaxima: 22,
    },
  },
  corretolvas: {
    macho: {
      rasgoFisico: 'Ave terrestre pequeña, cresta escamosa alta y plumas rojas de la punta largas y vistosas, patas cortas.',
      description: 'Se posiciona en el borde de la bandada, más expuesto, alerta a cualquier amenaza mientras el resto escarba.',
      medidaCm: 42,
      edadMaxima: 6,
    },
    hembra: {
      rasgoFisico: 'Ave terrestre pequeña, cresta baja y plumaje apagado en tonos tierra, patas notablemente largas para su tamaño.',
      description: 'Pasa más tiempo cerca del centro de la bandada, junto a las crías, y es quien de verdad marca cuándo hay que echar a correr.',
      medidaCm: 38,
      edadMaxima: 7,
    },
  },
  'aullador-rojo': {
    macho: {
      rasgoFisico: 'Cánido grande de la jauría, pelaje del cuello espeso y erizado casi como una gola, marcado por cicatrices de peleas de rango.',
      description: 'Defiende el territorio de la jauría frente a otros grupos rivales — el músculo de la manada, no su ingenio.',
      medidaCm: 90,
      edadMaxima: 10,
    },
    hembra: {
      rasgoFisico: 'Cánido de la jauría sin gola de pelaje en el cuello, patas notablemente largas en proporción al cuerpo.',
      description: 'Lidera siempre la persecución real de los Corredores rezagados — la jauría caza donde ella marca el ritmo, nunca al revés.',
      medidaCm: 80,
      edadMaxima: 11,
    },
  },
  murgol: {
    macho: {
      rasgoFisico: 'Rumiante de rebaño, cuernos largos y gruesos enroscados varias vueltas en la punta, pecho ancho y pesado.',
      description: 'Los clanes lo mantienen sobre todo por la carne y para liderar al rebaño en la migración.',
      medidaCm: 105,
      edadMaxima: 14,
    },
    hembra: {
      rasgoFisico: 'Rumiante de rebaño, cuernos cortos y casi rectos, cuerpo compacto, ubre visible.',
      description: 'Los clanes cuidan a las hembras reproductoras por encima de cualquier macho — dan la lana y la leche de mejor calidad de todo el rebaño.',
      medidaCm: 95,
      edadMaxima: 16,
    },
  },
  'rondador-de-brasas': {
    macho: {
      rasgoFisico: 'Carroñero nocturno de mandíbula pesada y prominente, cuerpo macizo.',
      description: 'Ronda solo territorios amplios en busca de cadáveres grandes; se le oye acercarse antes de verlo.',
      medidaCm: 78,
      edadMaxima: 12,
    },
    hembra: {
      rasgoFisico: 'Carroñero nocturno de complexión rápida y ligera, mandíbula proporcionalmente menor.',
      description: 'Llega primero a cualquier cadáver reciente sin que nadie la note hasta que ya está allí; ni el fuego más vivo delata su acercamiento.',
      medidaCm: 70,
      edadMaxima: 13,
    },
  },
  cruzavientos: {
    macho: {
      rasgoFisico: 'Ave grande de acantilado, envergadura amplia, plumas de la punta de un gris oscuro casi negro.',
      description: 'Vuela los frentes de tormenta más altos y arriesgados, marcando territorio de anidada.',
      medidaCm: 290,
      edadMaxima: 25,
    },
    hembra: {
      rasgoFisico: 'Ave de acantilado muy maniobrable, plumaje de la punta de un gris claro.',
      description: 'Es quien elige y defiende el saliente concreto donde anidan en Los Pilares Rotos; ningún macho vuela ese tramo mejor que ella.',
      medidaCm: 270,
      edadMaxima: 27,
    },
  },
  'zense-ceniza': {
    macho: {
      rasgoFisico: 'Ave carroñera de la llanura, plumaje del cuello revuelto y oscuro, pico grande.',
      description: 'Vigila en círculos amplios, cubriendo más terreno de la llanura, aunque tarda más en detectar el primer indicio.',
      medidaCm: 255,
      edadMaxima: 20,
    },
    hembra: {
      rasgoFisico: 'Ave carroñera de cuerpo grande, plumaje uniforme, vista muy aguda.',
      description: 'Baja primero sobre lo que encuentra, casi siempre la primera en localizar un cadáver desde el aire, mientras el macho sigue vigilando desde arriba.',
      medidaCm: 260,
      edadMaxima: 22,
    },
  },
  'gargantua-de-ceniza': {
    macho: {
      rasgoFisico: 'Cuadrúpedo acorazado de gran tamaño, placas óseas del lomo con crestas vistosas usadas en pugnas de dominancia.',
      description: 'Anda casi siempre solo, y sus pugnas de dominancia son más ruido que daño de verdad.',
      medidaCm: 230,
      edadMaxima: 45,
    },
    hembra: {
      rasgoFisico: 'Cuadrúpedo acorazado de gran tamaño, placas óseas gruesas y compactas por todo el cuerpo, no solo el lomo.',
      description: 'Es ella quien de verdad defiende a las crías si algo se acerca — el macho se retira antes que arriesgarse a un golpe suyo.',
      medidaCm: 235,
      edadMaxima: 48,
    },
  },
  'espina-del-viento': {
    macho: {
      rasgoFisico: 'Arácnido excavador de gran tamaño, cola segmentada larga y delgada, aguijón moderado.',
      description: 'Se entierra en zonas amplias y expuestas, cubriendo más terreno de caza.',
      medidaCm: 85,
      edadMaxima: 15,
    },
    hembra: {
      rasgoFisico: 'Arácnido excavador de cuerpo grande y pesado, caparazón grueso, veneno del aguijón muy concentrado.',
      description: 'Permanece enterrada cerca de un mismo punto, junto a su propio nido, y es la más peligrosa de encontrarse por sorpresa.',
      medidaCm: 95,
      edadMaxima: 18,
    },
  },
  'kirelon-arenoso': {
    macho: {
      rasgoFisico: 'Reptil ciego de escama negra, cabeza y hocico proporcionalmente más grandes que el resto del cuerpo, membranas entre las extremidades más amplias.',
      description: 'Cubre un territorio de caza más extenso bajo la arena, siguiendo el rastro de vibración más débil hasta encontrarlo.',
      medidaCm: 380,
      edadMaxima: 40,
    },
    hembra: {
      rasgoFisico: 'Reptil ciego de escama negra, cuerpo más macizo y compacto, garras de Yerreo notablemente más gruesas.',
      description: 'Excava madrigueras más profundas y permanece enterrada más tiempo antes de emerger — cuando por fin ataca, ninguna presa logra desprenderse de su mordida.',
      medidaCm: 340,
      edadMaxima: 45,
    },
  },
  cornante: {
    macho: {
      rasgoFisico: 'Bóvido de ciénaga de cornamenta ancha y muy ramificada, cuerpo pesado.',
      description: 'Las pugnas entre machos por dominancia son la causa más común de las pisadas dobles que a veces se ven junto al barro removido.',
      medidaCm: 145,
      edadMaxima: 18,
    },
    hembra: {
      rasgoFisico: 'Bóvido de ciénaga sin cornamenta o con una versión muy pequeña, cuerpo compacto y pisada firme, capaz de moverse por barro profundo sin hundirse.',
      description: 'Se mueve en grupos pequeños con las crías, y es quien elige las rutas seguras de la ciénaga — los machos, mucho más torpes en el barro, tienden a seguirlas.',
      medidaCm: 130,
      edadMaxima: 20,
    },
  },
  'sombra-de-kroj': {
    macho: {
      rasgoFisico: 'Criatura voladora nocturna de plumaje oscuro.',
      description: 'Caza en los límites del grupo, más expuesto, y su vuelo delata algo más de ruido que el del resto.',
      medidaCm: 115,
      edadMaxima: 15,
    },
    hembra: {
      rasgoFisico: 'Criatura voladora nocturna de cuerpo grande, vuelo silencioso.',
      description: 'Es quien imita las voces humanas con más precisión, y suele ir en el centro del grupo de caza dirigiéndolo.',
      medidaCm: 122,
      edadMaxima: 17,
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 16 especies añadidas 2026-08-31 (mismo criterio de las 13 anteriores, ver comentario de
  // cabecera del archivo) — defining attribute por especie (de worldCatalog.ts, `fauna`):
  // canizor → destreza (aunque la propia bio ya trae dimorfismo: hembras más corpulentas y de
  // pelaje abundante, machos más finos y de pelo corto), gesgurio → destreza (sigilo de
  // emboscada), ruptidar → sin combate real (inofensivo total, se usa su único rasgo narrativo:
  // el desgaste/disolución de la coraza), ferike → destreza/fuerza (bio ya trae dimorfismo:
  // hembras sin cola pero alfas cazadoras con dientes/garras más fuertes), guchapo →
  // constitucion, lebude → destreza (coordinación de colmena), escorante → constitucion,
  // jusha-esmeralda → destreza (esquiva, población escasa), miruina → destreza (caza nocturna en
  // manada), quio → sin combate real (inofensivo total, filtrador), tura-jusha → destreza,
  // cuernahoja → destreza/fuerza (bio ya trae dimorfismo: hembras más rojas, cuernos más anchos,
  // defienden la manada), imanio → constitucion (coraza de rocas), nuente → destreza/magia
  // (vuelo nocturno errático + visión de magnetismo), towrgu → destreza (emboscador solitario),
  // coracelo → constitucion/inteligencia (madriguera fortificada, uso de herramientas).
  'canizor': {
    macho: {
      rasgoFisico: 'Fiera de cabeza y mandíbula de tigre sobre porte lobuno, pelaje corto y de tonos claros, complexión más fina y estilizada que la del resto de la especie.',
      description: 'Marca territorio en solitario con aullidos largos al caer la noche, y es quien con más frecuencia doman los altos cargos del Clan Maktor.',
      medidaCm: 95,
      edadMaxima: 16,
    },
    hembra: {
      rasgoFisico: 'Fiera de cabeza y mandíbula de tigre sobre porte lobuno, pelaje abundante y largo que le da una silueta más corpulenta, garras delanteras notablemente más gruesas.',
      description: 'Es ella quien de verdad sostiene un territorio de caza frente a cualquier otro Canizor rival — ningún macho lo defiende con la misma ferocidad.',
      medidaCm: 100,
      edadMaxima: 18,
    },
  },
  gesgurio: {
    macho: {
      rasgoFisico: 'Insecto de caparazón quitinoso color arcilla roja con púas más oscuras, patas dentadas bajo el caparazón, silueta algo más alargada.',
      description: 'Sigue de lejos cualquier señal de vida moribunda, esperando paciente a que perezca antes de acercarse.',
      medidaCm: 16,
      edadMaxima: 5,
    },
    hembra: {
      rasgoFisico: 'Insecto de caparazón quitinoso más compacto y de púas más numerosas y apretadas, tono arcilla roja algo más oscuro que se funde mejor con la roca de la Hondonada.',
      description: 'Es ella quien se acerca más cerca de la presa sin ser detectada — el camuflaje contra la piedra se le da mejor que a ningún macho de la especie.',
      medidaCm: 14,
      edadMaxima: 6,
    },
  },
  ruptidar: {
    macho: {
      rasgoFisico: 'Reptil serpentiforme de cuerpo seco y duro como piedra, coraza inerte de tono arenoso uniforme.',
      description: 'Se desliza bajo la arena filtrando materia orgánica, indiferente a cualquier presencia a su alrededor.',
      medidaCm: 48,
      edadMaxima: 4,
    },
    hembra: {
      rasgoFisico: 'Reptil serpentiforme de cuerpo algo más largo y grueso, coraza de un tono arenoso más pálido, casi blanquecino en la zona ventral.',
      description: 'Filtra tramos de arena más amplios que cualquier macho antes de que su coraza termine deshaciéndose al morir.',
      medidaCm: 55,
      edadMaxima: 4,
    },
  },
  ferike: {
    macho: {
      rasgoFisico: 'Bestia de pelaje espeso con raíz negra y rastas verde oscuro que arrastran por el suelo, ojos violeta oscuro brillantes, dientes largos que no dejan cerrar la boca del todo, cola terminada en espigas de pelo negro que puede apretar como una maza.',
      description: 'Usa la cola-maza tanto para golpear en barridos como en el ritual de cortejo, aunque no es quien encabeza la caza real de la manada.',
      medidaCm: 105,
      edadMaxima: 18,
    },
    hembra: {
      rasgoFisico: 'Bestia de pelaje espeso con raíz negra y rastas verde oscuro que arrastran por el suelo, ojos violeta oscuro brillantes, sin cola, dientes y garras notablemente más largos y afilados que los del macho.',
      description: 'Es la cazadora y alfa real de la manada — el gruñido bajo que avisa antes de cargar casi siempre sale de ella primero.',
      medidaCm: 110,
      edadMaxima: 20,
    },
  },
  guchapo: {
    macho: {
      rasgoFisico: 'Sapo redondo y gordo de piel tersa por el agua acumulada, lengua trifurcada larga, coloración parda apagada, frente corta e hinchada llena de verrugas.',
      description: 'Muy asustadizo, se sumerge en la charca más profunda ante el menor sobresalto.',
      medidaCm: 150,
      edadMaxima: 14,
    },
    hembra: {
      rasgoFisico: 'Sapo redondo de piel tersa aún más hinchada por el agua retenida, coloración verdosa algo más intensa, verrugas frontales más marcadas.',
      description: 'Aguanta mucho más tiempo sumergida sin salir a respirar que cualquier macho, lo que la hace casi imposible de localizar en una charca profunda.',
      medidaCm: 155,
      edadMaxima: 16,
    },
  },
  lebude: {
    macho: {
      rasgoFisico: 'Híbrido luciérnaga-avispa negro con rayas gris ceniza, ojos blancos de libélula, aguijón grande, luminiscencia abdominal intensa.',
      description: 'Tímido en solitario, coordinado y agresivo solo cuando caza junto al resto de la colmena.',
      medidaCm: 11,
      edadMaxima: 2,
    },
    hembra: {
      rasgoFisico: 'Híbrido luciérnaga-avispa de abdomen más ancho y aguijón proporcionalmente mayor, rayas gris ceniza más marcadas, luminiscencia más tenue y constante.',
      description: 'Es quien de verdad coordina el ataque en manada contra un Escorante — la colmena entera sigue el rumbo que marca ella.',
      medidaCm: 12,
      edadMaxima: 3,
    },
  },
  escorante: {
    macho: {
      rasgoFisico: 'Escarabajo de caparazón oscuro y amarillo con detalles arcillosos y rojos, cuerno frontal en forma de pala, pinchos diminutos por todo el caparazón.',
      description: 'Prefiere enterrarse en zonas húmedas antes que enfrentarse a un depredador, saliendo solo a alimentarse del Musgo Arcilla.',
      medidaCm: 48,
      edadMaxima: 10,
    },
    hembra: {
      rasgoFisico: 'Escarabajo de caparazón más grueso y compacto, cuerno frontal algo más corto y romo, pinchos que segregan una mayor cantidad del líquido repelente.',
      description: 'Resiste mucho mejor el asedio de una manada de Lebudes sin necesidad de enterrarse — su caparazón aguanta lo que ningún macho soporta a la intemperie.',
      medidaCm: 52,
      edadMaxima: 12,
    },
  },
  'jusha-esmeralda': {
    macho: {
      rasgoFisico: 'Pez de escamas verde musgo con brillos azul oscuro, aleta dorsal espinosa sin membrana, cola amplia, hocico redondo con dientes planos.',
      description: 'Se mantiene esquivo en las charcas más profundas, saliendo poco a la superficie.',
      medidaCm: 24,
      edadMaxima: 6,
    },
    hembra: {
      rasgoFisico: 'Pez de escamas verde musgo algo más pálidas, cola más ancha y potente, aleta dorsal de espinas más cortas.',
      description: 'Es la primera en saltar de charca en charca cuando la sequía aprieta — ningún macho arriesga el salto por barro con la misma decisión.',
      medidaCm: 22,
      edadMaxima: 7,
    },
  },
  miruina: {
    macho: {
      rasgoFisico: 'Roedor nocturno de escamas de las que brota pelo, negro con mechas blancas, incisivos orientados en varias direcciones, ojos diminutos casi ciegos de día.',
      description: 'Amplía la madriguera bajo el agua durante el día y se une a la manada al caer la noche para cazar.',
      medidaCm: 108,
      edadMaxima: 9,
    },
    hembra: {
      rasgoFisico: 'Roedor nocturno de pelaje impermeable más denso, mechas blancas más extendidas por el lomo, incisivos algo más largos.',
      description: 'Es quien marca el rumbo de la manada durante la caza nocturna — ningún macho localiza antes que ella un banco de Jusha en la oscuridad del agua.',
      medidaCm: 104,
      edadMaxima: 10,
    },
  },
  quio: {
    macho: {
      rasgoFisico: 'Gusano tipo oruga blanco con manchas marronas, boca de filtro sin dientes, cuerpo blando y alargado.',
      description: 'Vive en el fango de las orillas filtrando restos orgánicos, indiferente a cualquier presencia.',
      medidaCm: 14,
      edadMaxima: 3,
    },
    hembra: {
      rasgoFisico: 'Gusano tipo oruga de manchas marronas más numerosas y oscuras, boca de filtro algo más ancha.',
      description: 'Filtra una franja de fango más amplia que cualquier macho antes de desplazarse a otra orilla.',
      medidaCm: 16,
      edadMaxima: 3,
    },
  },
  'tura-jusha': {
    macho: {
      rasgoFisico: 'Ave sin vuelo de patas larguísimas ensanchadas hacia el pie, garra tipo dinosaurio de uñas retráctiles negras, escamas grises, plumaje alborotado, pico ancho que almacena agua.',
      description: 'Caza de día crías de Jusha desorientadas, planeando de charca en charca de forma discreta.',
      medidaCm: 92,
      edadMaxima: 10,
    },
    hembra: {
      rasgoFisico: 'Ave sin vuelo de patas aún más largas en proporción al cuerpo, garra retráctil de mayor tamaño, plumaje algo más oscuro en el dorso.',
      description: 'Es quien localiza antes que nadie a las crías de Jusha desorientadas, casi siempre la primera en saltar a por ellas.',
      medidaCm: 96,
      edadMaxima: 11,
    },
  },
  cuernahoja: {
    macho: {
      rasgoFisico: 'Gacela de cuernos finos y largos casi sin espiral, cuello ancho, pelaje muy corto con menos rojo que la hembra y vientre blanco.',
      description: 'Se mueve con la manada aportando el grueso de su fuerza, aunque no es quien se planta primero ante una amenaza.',
      medidaCm: 150,
      edadMaxima: 13,
    },
    hembra: {
      rasgoFisico: 'Gacela de pelaje con más rojo que el macho por todo el lomo, cuernos notablemente más anchos, cuello igual de ancho.',
      description: 'Es ella quien se interpone entre la manada y cualquier amenaza real, embistiendo con los cuernos más anchos de toda la especie.',
      medidaCm: 155,
      edadMaxima: 14,
    },
  },
  imanio: {
    macho: {
      rasgoFisico: 'Insecto tipo bicho palo de quitina blanca con tonos azules, cuerpo largo y fino bajo la armadura de rocas imantadas que va acumulando.',
      description: 'Vaga lento por Las Agujas Imán buscando Arena Imán, defensivo solo cuando no le queda otra salida.',
      medidaCm: 130,
      edadMaxima: 22,
    },
    hembra: {
      rasgoFisico: 'Insecto tipo bicho palo de quitina blanca y azul algo más gruesa, cuerpo más macizo capaz de sostener una armadura de rocas de mayor volumen.',
      description: 'Acumula una coraza de rocas imantadas más pesada que la de cualquier macho, absorbiendo golpes que a otro Imanio lo dejarían expuesto.',
      medidaCm: 140,
      edadMaxima: 25,
    },
  },
  nuente: {
    macho: {
      rasgoFisico: 'Bestia nocturna de cuerpo de rana y alas de murciélago, cabeza tipo golem con forma de búho, halos en los ojos, pelaje blanco con mechas azul marino.',
      description: 'Caza en solitario por las noches de Las Agujas Imán, silencioso y calculador con quien no lo busca.',
      medidaCm: 98,
      edadMaxima: 16,
    },
    hembra: {
      rasgoFisico: 'Bestia nocturna de la misma mezcla de rana y murciélago, halos oculares más marcados, mechas azul marino más extendidas por las alas.',
      description: 'Es quien "ve" el magnetismo con más precisión en la oscuridad total — ningún macho localiza a un Imanio escondido tan rápido como ella.',
      medidaCm: 102,
      edadMaxima: 18,
    },
  },
  towrgu: {
    macho: {
      rasgoFisico: 'Bestia de pelaje rojo con manchas, corto y erizado, ojos ámbar, garras curvas para trepar y desgarrar, boca extremadamente grande, cola larga negra rematada en mechón rojo.',
      description: 'Caza en solitario desde la cobertura del Pasto de Sangre, atacando sin previo aviso.',
      medidaCm: 140,
      edadMaxima: 15,
    },
    hembra: {
      rasgoFisico: 'Bestia de pelaje rojo con manchas más densas, garras curvas notablemente más largas, cola rematada en un mechón rojo más frondoso.',
      description: 'Es quien tiende la emboscada más certera desde la hierba alta — ningún macho de la especie iguala su sigilo antes del zarpazo.',
      medidaCm: 135,
      edadMaxima: 17,
    },
  },
  coracelo: {
    macho: {
      rasgoFisico: 'Roedor de pelaje espeso y largo ceniza claro que arrastra por el suelo, manos muy desarrolladas, zarpas traseras grandes con garras, dos colmillos inferiores cuadrados, cola rematada en bulto de escamas duras.',
      description: 'Usa piedras y madera para levantar su propia madriguera fortificada, huyendo a ella antes que enfrentarse a nada.',
      medidaCm: 65,
      edadMaxima: 11,
    },
    hembra: {
      rasgoFisico: 'Roedor de pelaje espeso marrón claro, manos igual de hábiles, bulto de escamas de la cola algo mayor y de resistencia aún más marcada.',
      description: 'Construye madrigueras más profundas y mejor reforzadas que las de cualquier macho — es a ella a quien se le atribuyen los refugios más difíciles de forzar de La Sabana Alta.',
      medidaCm: 62,
      edadMaxima: 13,
    },
  },
};

/// Razas (2026-07-22, "nos dejamos las razas también para el macho/hembra") — a nivel de RAZA
/// GENERAL, independiente de las variantes regionales que ya tiene Orcos (Llanuras/Cristal Helado/
/// Ciénaga Troncal, ver berigLore.ts): el sexo no cruza con la región, son dos ejes de pestañas
/// independientes en el frontend que se combinan en la descripción (general + región si aplica +
/// sexo). Las otras 4 razas de Vaelira quedan fuera, igual que en el resto de berigLore.ts.
// Vacío a propósito (2026-07-22): las 4 razas de Berig ya tienen variantes regionales, así que su
// sexo vive cruzado con región en RAZA_VARIANTE_SEXO_VARIANTES de abajo, no aquí — Goirntes,
// Nabieus y Faerus se sacaron de este mapa el mismo día que Orcos ("nunca los lances tú..." no,
// esto es de otra petición: "actualiza los nombres de las imágenes para que encajen con su sexo y
// zona" — mismo criterio ya aplicado a Orcos, extendido a las otras 3 razas). Se deja el mapa
// vacío (en vez de borrarlo) para que una futura raza SIN variantes regionales tenga dónde vivir.
export const RAZA_SEXO_VARIANTES: Record<string, SexoVariantesEntry> = {};

/// Sexo POR VARIANTE REGIONAL de las 4 razas de Berig (2026-07-22) — keyed por el slug de la
/// variante regional, no por la raza. Cada clan/región ya tiene su propio cuerpo (ver `variantes`
/// en berigLore.ts) — el sexo se combina con ESE cuerpo regional, no con uno genérico en abstracto.
///
/// Corrección de complexión y medidas (2026-07-22, dos peticiones seguidas: primero "me las hace
/// siempre muy finas y muy simples... que las hembras sean similares a las medidas de los machos",
/// y después "no tienen contexto de las otras cosas que hemos generado... indica casi medidas
/// exactas... hacer símiles no me sirve"): un primer intento usó frases como "misma complexión que
/// el macho" para corregir el sesgo de "hembra delgada", pero cada imagen se genera SOLA — el
/// generador nunca ve la imagen del otro sexo, así que una comparación con él no significa nada.
/// Ahora cada entrada (macho Y hembra) lleva su propia descripción física completa y autocontenida
/// más una cifra concreta de altura y edad máxima, sin ninguna referencia al otro sexo.
export const RAZA_VARIANTE_SEXO_VARIANTES: Record<string, SexoVariantesEntry> = {
  'orcos-llanuras': {
    // Macho basado en imagen de referencia real subida por la usuaria (`orcos-llanuras-macho.txt`).
    macho: {
      rasgoFisico:
        'Cuerpo imponente, ancho de hombros y de musculatura fibrosa hecha para correr largas distancias, piel color arcilla curtida por el sol y el viento de la estepa, trenzas negras atadas con tiras de cuero crudo, barba corta veteada de canas, colmillos largos marcados con patrones tribales rojos, cicatrices rituales en pecho y brazos.',
      description:
        'Corre las cacerías rituales igual que cualquiera del clan, aunque rara vez es quien marca el ritmo real de la persecución; viste solo un taparrabos curtido, un chaleco de cuero negro que deja el pecho al descubierto y una capa de plumas cenicientas atada a la cintura, va descalzo salvo por tiras de cuero envueltas en los pies, y combate con un hacha de guerra a dos manos forjada en hierro negro.',
      medidaCm: 196,
      edadMaxima: 75,
    },
    // Hembra basada en imagen de referencia real subida por la usuaria (`orco-llanura-hembra.txt`).
    hembra: {
      rasgoFisico:
        'Cuerpo ancho y poderoso, musculatura larga y marcada, colmillos anchos y largos, piel color arcilla brillante de sudor, cabello negro veteado de rojo trenzado con cuentas de hueso, ojos ámbar muy separados, cicatrices rituales visibles en los hombros.',
      description:
        'Es quien de verdad marca el ritmo en las cacerías rituales de los Corredores de Cauce — las cicatrices de sus hombros son la prueba de cuántas veces lo ha demostrado.',
      medidaCm: 190,
      edadMaxima: 78,
    },
  },
  'orcos-cristal-helado': {
    macho: {
      rasgoFisico: 'Cuerpo recio y compacto, manos y dedos gruesos curtidos por las minas de hielo sílice.',
      description: 'Trabaja las minas igual que cualquiera del Clan Helsig.',
      medidaCm: 188,
      edadMaxima: 78,
    },
    hembra: {
      rasgoFisico: 'Cuerpo recio y compacto, con una capa de grasa notablemente gruesa bajo la piel — la mejor adaptada al frío extremo de todo el clan.',
      description: 'Aguanta jornadas enteras en el hielo que ningún macho resiste sin relevo — el Clan Helsig confía en ellas las guardias más largas de las minas.',
      medidaCm: 183,
      edadMaxima: 80,
    },
  },
  'orcos-cienaga-troncal': {
    // Macho basado en imagen de referencia real subida por la usuaria (`orco-cienaga-macho.txt`).
    macho: {
      rasgoFisico:
        'Cuerpo musculoso e imponente, piel de un verde musgo intenso veteada de rojo pálido —camuflaje real entre el follaje de la ciénaga—, pies y manos anchos que no se hunden en el barro, cicatrices rituales y piercings de hueso.',
      description:
        'Se mueve por la ciénaga igual que cualquiera del Clan Goshg, cubierto solo con un taparrabos de cuero curtido, armado con una espada-hacha híbrida y un morral tejido donde guarda Raíz de Fuego recogida al paso.',
      medidaCm: 193,
      edadMaxima: 72,
    },
    hembra: {
      rasgoFisico:
        'Cuerpo musculoso e imponente, piel de un verde musgo muy intenso veteada de rojo pálido, el color más oscuro y uniforme de todo el Clan Goshg.',
      description: 'Es quien se adentra más profundo en la ciénaga sin ser vista — el Clan Goshg le confía el rastreo silencioso que ningún macho iguala.',
      medidaCm: 190,
      edadMaxima: 75,
    },
  },
  'goirntes-meseta': {
    macho: {
      rasgoFisico: 'Complexión ancha y pesada; la piel se le tensa de forma visible, con un brillo metálico marcado cuando se concentra.',
      description: 'Ocupa con más frecuencia las castas de fuerza física — forja, patrulla, ejecución — aunque nada en la ley lo exige.',
      medidaCm: 178,
      edadMaxima: 130,
    },
    hembra: {
      rasgoFisico: 'Complexión ancha; la piel se le tensa con un brillo metálico sutil, casi imperceptible, al concentrarse.',
      description:
        'Ocupa con más frecuencia las castas de cálculo y administración — leyes, archivo, magistratura — y dentro de la Meseta del Orden se reconoce, sin decirlo abiertamente, que ninguna mente calcula el orden de las cosas con más precisión que la de una Goirnte.',
      medidaCm: 172,
      edadMaxima: 135,
    },
  },
  'goirntes-frontera-norte': {
    // Hembra corregida (2026-07-22, mismo hueco que faerus-frontera-norte: "ágil y ligera" sin
    // ningún adjetivo de anchura dejaba la complexión completamente implícita, a diferencia del
    // macho) — mantiene la misma agilidad como rasgo distintivo, pero ahora sobre una complexión
    // ancha explícita, igual que el macho.
    macho: {
      rasgoFisico: 'Complexión ancha, curtida por el trabajo de forja con madera propio de esta frontera.',
      description: 'Ocupa con más frecuencia los talleres de forja con madera, aunque nada en la ley lo exige.',
      medidaCm: 176,
      edadMaxima: 125,
    },
    hembra: {
      rasgoFisico:
        'Complexión ancha, con una agilidad de movimiento fuera de lo común para su tamaño — la más adaptada de toda la raza a moverse entre la espesura del Margen Silencioso.',
      description: 'Suele ser quien se interna más profundo en busca de maderas raras — ninguna Goirnte calcula mejor una ruta segura entre la selva.',
      medidaCm: 168,
      edadMaxima: 128,
    },
  },
  'nabieus-margen': {
    macho: {
      rasgoFisico:
        'Complexión alta y desgarbada, de estructura andrógina, mejillas hundidas y dedos alargados — parece flotar levemente al moverse, casi sin peso.',
      description: 'Suele ser quien se adelanta a explorar un espacio nuevo antes de que el resto del grupo entre.',
      medidaCm: 190,
      edadMaxima: 95,
    },
    hembra: {
      rasgoFisico:
        'Complexión alta y desgarbada, de estructura andrógina, mejillas hundidas y dedos alargados, con un paso extremadamente silencioso — el silencio de los Nabieus, en su forma más pura, se encuentra en ellas.',
      description: 'Suele ser quien porta los mensajes de mayor confianza — su silencio se lee como el más fiable de todos, incluso entre los suyos.',
      medidaCm: 188,
      edadMaxima: 98,
    },
  },
  'nabieus-cienaga-troncal': {
    // Extremidades desproporcionadamente largas (2026-07-23, a partir de imagen de referencia
    // real de la hembra, `nabieus-cienaga-troncal-hembra.txt`) — a diferencia de los Nabieus del
    // Margen Silencioso, que NO tienen esta adaptación: es exclusiva de esta rama, para poder
    // cruzar a pie lagunas y aguas altas de la ciénaga sin hundirse. Colores y medidas exactas se
    // quedan solo en la hembra (la única con referencia real); el macho recibe la MISMA
    // adaptación funcional, en versión moderada, no sus cifras concretas.
    macho: {
      rasgoFisico:
        'Extremidades notablemente más largas que las del resto de los Nabieus —piernas y brazos alargados, adaptación real de esta rama para cruzar a pie las lagunas y aguas altas de la ciénaga sin hundirse—, con una postura algo encorvada al caminar. Manchas de un verde oscuro extendidas por el cuerpo, de bordes irregulares como musgo o corteza.',
      description: 'Se dedica más al trabajo bruto de la madera de los Trepadores Ocaso que a la caza fina.',
      medidaCm: 192,
      edadMaxima: 90,
    },
    hembra: {
      rasgoFisico:
        'La misma adaptación de esta rama de la ciénaga llevada al extremo: extremidades desproporcionadamente largas —los brazos le cuelgan más abajo de las rodillas—, que le permiten cruzar hasta las lagunas más profundas sin esfuerzo, a costa de una postura permanentemente encorvada, casi insectoide. Costillas y caderas marcadas bajo la piel, mejillas hundidas y cuencas oculares profundas. Piel de un gris pálido mate con grandes manchas de un verde oscuro de bordes irregulares, como musgo o corteza podrida, y dedos largos y nudosos rematados en garras oscuras.',
      description: 'Es quien de verdad rastrea y caza con más acierto en el borde de la ciénaga — el instinto de caza de esta rama se afina más en ellas.',
      medidaCm: 189,
      edadMaxima: 93,
    },
  },
  'faerus-margen': {
    // Hocico ancho/amenazante y envolturas de cuero en antebrazos y espinillas — incorporados a
    // las 4 entradas de Faerus (2026-07-22) a partir de una imagen de referencia real confirmada
    // por la usuaria para `faerus-frontera-norte` hembra (`faerus-llanura-hembra.txt`, "lo
    // conseguí con este... funciona"), que sí lleva la maza tosca de piedra y espinas descrita en
    // ese momento. Armas y ojos AJUSTADOS (2026-07-24, "actualiza las descripciones para que se
    // ajusten a lo que ves" — revisión de las imágenes reales ya subidas para esta entrada
    // concreta): ni el macho ni la hembra de `faerus-margen` llevan la maza de piedra en su
    // imagen real, cada uno con un arma de hoja distinta; la hembra tiene los ojos violeta, no
    // ámbar. `faerus-frontera-norte` (aparte, sin tocar) sigue con la maza — es la entrada que
    // generó la referencia original y su imagen sí la muestra.
    macho: {
      rasgoFisico:
        'Cuerpo denso de pelaje moteado en tonos de corteza y musgo, con crestas dérmicas en forma de hoja a lo largo del lomo y las extremidades, hocico ancho y cicatrizado de aspecto amenazante, colmillos largos, ojos ámbar de pupila rasgada y mirada calculadora, antebrazos y espinillas envueltos en tiras de cuero. Pasa más tiempo apoyado en las cuatro patas que en postura bípeda.',
      description: 'Encabeza la caza real de la manada, el primero en cargar contra la presa — fuerza antes que cálculo; combate con un par de hojas curvas y ganchudas, una en cada mano.',
      medidaCm: 170,
      edadMaxima: 30,
    },
    hembra: {
      rasgoFisico:
        'Cuerpo denso de pelaje moteado en tonos de corteza y musgo, con crestas dérmicas en forma de hoja a lo largo del lomo y las extremidades, hocico ancho y cicatrizado de aspecto amenazante, colmillos largos, ojos violeta de pupila rasgada y mirada calculadora, antebrazos y espinillas envueltos en tiras de cuero — alterna con naturalidad entre dos y cuatro patas.',
      description:
        'Decide el rumbo de la manada día a día — el instinto colectivo Faerus, esa inteligencia fría bajo la apariencia bestial, se apoya siempre más en su criterio que en el de ningún macho; combate con un par de hojas largas y estrechas, una en cada mano.',
      medidaCm: 168,
      edadMaxima: 32,
    },
  },
  'faerus-frontera-norte': {
    // Ambos sexos reescritos (2026-07-22, "me salen cosas similares a lobos... sin parecerse al
    // concepto de los faerus del margen silencioso"): llevan las mismas marcas identificativas de
    // `faerus-margen` (crestas dérmicas en forma de hoja, hocico cicatrizado, ojos ámbar de pupila
    // rasgada), solo decoloradas/adaptadas al calor seco de las Llanuras en vez de perderse.
    //
    // Corrección real (2026-07-22, "con las hembras tiende a que si le pides rasgos no humanos
    // convertirlas en animales... no tengo claro como evitar este sesgo sexista"): la primera
    // versión de esta entrada dejaba "Cuerpo robusto" solo en el macho — la hembra se quedaba SIN
    // ningún adjetivo de complexión (un hueco real, no una decisión de diseño), y el modelo que
    // traduce a inglés lo rellenó por su cuenta con "lean-muscled", justo el estereotipo de fauna
    // esbelta que no queríamos. Ambos sexos llevan ahora "cuerpo robusto" explícito y la misma
    // "mirada calculadora" (la inteligencia fría que el lore general de Faerus ya le atribuye a
    // toda la manada, no solo a los machos) — nunca dejar la complexión o el rasgo de inteligencia
    // implícitos en un sexo y explícitos en el otro.
    // Hembra actualizada (2026-07-22) a partir de imagen de referencia real confirmada por la
    // usuaria (`faerus-llanura-hembra.txt`, "lo conseguí con este... funciona"): postura bípeda
    // erguida como norma (no alternancia), hocico ancho de aspecto amenazante, envolturas de cuero
    // en antebrazos/espinillas, y una maza tosca de piedra y espinas como arma — la imagen
    // resultante ya no se leía como un animal salvaje genérico. La postura bípeda queda como rasgo
    // distintivo SOLO de esta hembra (coherente con "es la más humana de su manada" / su rol de
    // liderazgo) — el macho de esta misma región sigue con más peso en las cuatro patas.
    macho: {
      rasgoFisico:
        'Cuerpo robusto de pelaje corto y raído por el calor seco de las Llanuras, en tonos rojizos apagados con crestas dérmicas en forma de hoja, apenas verdes, a lo largo del lomo y las extremidades, hocico ancho y cicatrizado de aspecto amenazante, colmillos largos, ojos ámbar de pupila rasgada y mirada calculadora, antebrazos y espinillas envueltos en tiras de cuero.',
      description: 'Encabeza la caza real de la manada en el terreno abierto de la frontera, el primero en cargar — fuerza antes que cálculo, templado por la caza a campo abierto; combate con una tosca maza de piedra oscura rematada en espinas.',
      medidaCm: 172,
      edadMaxima: 30,
    },
    hembra: {
      rasgoFisico:
        'Cuerpo robusto y de musculatura ancha, pelaje corto de un rojizo vivo e intenso, con crestas dérmicas en forma de hoja a lo largo del lomo, hocico ancho y cicatrizado de aspecto amenazante, colmillos largos y curvos, ojos ámbar de pupila rasgada y mirada fría y calculadora, antebrazos y espinillas envueltos en tiras de cuero — adopta casi siempre una postura bípeda erguida, la más humana de toda su manada.',
      description:
        'Decide el rumbo de la manada en su empuje hacia las Llanuras — el instinto de la frontera se apoya siempre más en ella, igual que en cualquier manada Faerus es la hembra quien de verdad marca el rumbo colectivo; combate con una tosca maza de piedra oscura rematada en espinas.',
      medidaCm: 169,
      edadMaxima: 33,
    },
  },
};

// Defining attribute por NPC PLANTILLA (de worldCatalog.ts): orco-expulsado → fuerza, cazador-serhu
// → destreza, soldado/oficial-concordia → voluntad (disciplina), peregrino-de-los-tumulos →
// voluntad (aguante del duelo), mercader-de-paso → carisma. Todos son Orcos salvo soldado/oficial
// de la Concordia, que son Goirntes de la Meseta del Orden (ver bio en worldCatalog.ts).
export const NPC_SEXO_VARIANTES: Record<string, SexoVariantesEntry> = {
  'soldado-concordia': {
    macho: {
      rasgoFisico: 'Complexión ancha de hombros, propia de la disciplina física exigida a su casta.',
      description: 'Mismo rango y trato que cualquier soldado de la patrulla — la Concordia de Hierro no distingue por sexo.',
      medidaCm: 180,
      edadMaxima: 125,
    },
    hembra: {
      rasgoFisico: 'Complexión ancha de hombros, propia de la disciplina física exigida a su casta, igual de resistente a la marcha y la carga.',
      description:
        'Mismo rango y trato que cualquier soldado de la patrulla — aunque entre la propia tropa se dice, medio en broma medio en serio, que ninguna guardia larga vence antes a una soldado que a un soldado.',
      medidaCm: 174,
      edadMaxima: 130,
    },
  },
  'oficial-concordia': {
    macho: {
      rasgoFisico: 'Piel gris tensa, complexión ancha propia de su casta, porte rígido.',
      description: 'El mando se gana por mérito y antigüedad, no por sexo.',
      medidaCm: 181,
      edadMaxima: 128,
    },
    hembra: {
      rasgoFisico: 'Piel gris tensa, complexión ancha propia de su casta, porte rígido.',
      description:
        'El mando se gana por mérito y antigüedad, no por sexo — aunque la disciplina Goirnte reconoce, sin hacerlo oficial, que las oficiales llevan la voz de mando con un temple algo más frío todavía.',
      medidaCm: 175,
      edadMaxima: 132,
    },
  },
  // Clave corregida (2026-09-09, mismo bug de rename huérfano ya arreglado en worldPopulation.ts/
  // worldCatalog.ts § harvestSourceAliases): el Npc se renombró a `orco-expulsado`, esta entrada
  // seguía apuntando al slug viejo y nunca se aplicaba al NPC real.
  'orco-expulsado': {
    macho: {
      rasgoFisico: 'Complexión corpulenta, colmillos algo más largos y marcados por la mala vida.',
      description: 'Sin clan y a la defensiva — la desgracia no distingue, pero es más fácil que ceda ante un farol que ante ella.',
      medidaCm: 194,
      edadMaxima: 70,
    },
    hembra: {
      rasgoFisico: 'Complexión corpulenta y curtida, fuerza bruta evidente en los brazos y el torso.',
      description: 'Sin clan y a la defensiva, igual que cualquier rezagado — pero suele ser la última en ceder en un enfrentamiento directo.',
      medidaCm: 189,
      edadMaxima: 73,
    },
  },
  'cazador-serhu': {
    macho: {
      rasgoFisico: 'Colmillos ya marcados para su corta edad, complexión ancha propia del clan.',
      description: 'Suele ser quien se ofrece primero a rastrear cuando sale el grupo de caza, aunque no siempre el más certero.',
      medidaCm: 175,
      edadMaxima: 72,
    },
    hembra: {
      rasgoFisico: 'Complexión ancha propia del clan para su corta edad, marca de clan reciente en el antebrazo.',
      description: 'Suele ser ella quien de verdad rastrea con más acierto — el Clan Serhu confía el rumbo de la cacería a las jóvenes cazadoras antes que a los jóvenes cazadores.',
      medidaCm: 172,
      edadMaxima: 74,
    },
  },
  'peregrino-de-los-tumulos': {
    macho: {
      rasgoFisico: 'Complexión corpulenta de orco, la tira de luto anudada al brazo derecho.',
      description: 'El duelo no distingue entre quien lo porta.',
      medidaCm: 190,
      edadMaxima: 70,
    },
    hembra: {
      rasgoFisico: 'Complexión corpulenta de orco, la tira de luto anudada al brazo izquierdo.',
      description:
        'El duelo no distingue entre quien lo porta — aunque se dice que una peregrina aguanta el camino en silencio más días que cualquier peregrino antes de necesitar compañía.',
      medidaCm: 186,
      edadMaxima: 72,
    },
  },
  'mercader-de-paso': {
    macho: {
      rasgoFisico: 'Complexión delgada, manos encallecidas más por cargar mercancía que por empuñar arma.',
      description: 'Igual de bueno o malo en el trueque, hombre o mujer.',
      medidaCm: 178,
      edadMaxima: 68,
    },
    hembra: {
      rasgoFisico: 'Complexión delgada y ágil, la misma piel curtida por soles de media docena de regiones.',
      description:
        'Fama bien ganada entre los clanes: una mercader rara vez sale perdiendo en un trueque — el instinto para el precio justo se le da mejor que a la mayoría de sus colegas.',
      medidaCm: 170,
      edadMaxima: 70,
    },
  },
};
