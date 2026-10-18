# Tarkor — contenido para la página del proyecto

Fuente para rehacer <https://zeldris.github.io/Portal-Galivelop/proyectos/tarkor/> (datos en
`Portal-Galivelop/src/data/proyectos/tarkor.json`). Todo lo de aquí está comprobado contra el código y
los documentos del repositorio a fecha **2026-10-18**. Las cifras salen del catálogo
(`backend/src/scripts/worldCatalog.ts`), del esquema (`backend/prisma/schema.prisma`) y del canon
(`docs/canon-opencode/`).

**Marcas:** ✅ jugable hoy · 🛠️ en desarrollo · 🗺️ lore o hito futuro (no prometer como jugable).

**Estructura de la página:** se ha contrastado con lo que muestran las páginas y wikis de juegos parecidos
(Caves of Qud, Wildermyth, RimWorld, Dwarf Fortress, Medieval Dynasty, Baldur's Gate 3). Suelen llevar:
- ficha rápida;
- gancho en una frase;
- pilares con cifras concretas («más de 70 facciones», «más de 300 objetos»);
- cómo se juega;
- mundo, razas, clases, bestiario, oficios y construcción;
- hoja de ruta, requisitos, capturas, preguntas frecuentes y contacto o prensa.

Este documento sigue ese orden.

---

## 1. Ficha rápida

| | |
|---|---|
| Género | RPG narrativo por texto con simulación de mundo vivo y gestión de reino |
| Inspiración | Mesa de rol con máster (D&D 5e), mundo vivo de X4: Foundations, supervivencia y dinastía de Medieval Dynasty, Bellwright y Manor Lords |
| Jugadores | Un jugador |
| Plataformas | Windows y Linux, con la Steam Deck como objetivo de rendimiento |
| Conexión | Ninguna durante la partida: toda la IA corre en el equipo |
| Idioma | Español |
| Estado | Alpha. Hito 0.3 «Reino profundo» en curso; las Llanuras del Viento Rojo son la región jugable |
| Creador | Álvaro García Graña (diseño del juego y del mundo, y desarrollo) |
| Colaboración | Abierta |

## 2. Textos de presentación

- **Lema:** Un RPG narrativo donde el mundo sigue adelante aunque tú te detengas.
- **Una línea:** Juego de rol por texto con una IA local como directora de juego, en un mundo de bolsillo
  donde las facciones, la fauna y tu reino viven por su cuenta.
- **Párrafo:** Escribes lo que hace tu personaje, como en una mesa de rol. El motor decide con tiradas
  visibles qué ocurre, y un narrador con modelos de lenguaje locales lo cuenta. Mientras tanto, el
  mundo sigue:
  - las facciones comercian, cazan y hacen la guerra;
  - los rumores viajan de región en región;
  - los personajes recuerdan lo que les hiciste;
  - tu reino crece generación tras generación.

  Juegas a Gorhorn, el último superviviente del Clan Maktor, en un continente con menos de diez mil
  almas, donde cada muerte deja cicatriz.

## 3. Pilares (con cifras)

1. **Un mundo que vive solo.** Hay 9 facciones con población, economía, expediciones, caravanas y
   ejércitos. Deciden según su propio estado, nunca por temporizadores. ✅
2. **Todo deja rastro.** Cada suceso se apunta con su causa en el Libro de Sucesos. De ahí nacen:
   - los rumores, que se propagan entre regiones;
   - las leyendas;
   - las consecuencias que llegan días después: venganzas, refugiados, sucesiones. ✅
3. **Personajes que recuerdan.** Los NPC guardan recuerdos de lo que les hiciste y te aprueban o no según
   los valores de su pueblo. Un enemigo que sobrevive puede volver cambiado. ✅
4. **Un reino por generaciones.** Tus súbditos tienen nombre, forman pareja, tienen hijos y dejan linaje.
   El reino tiene ganadería, comida por tareas, defensa y guerra. ✅
5. **El motor decide, la IA narra.** Las tiradas, el daño, la experiencia y la economía son reglas
   deterministas que se pueden probar. El narrador solo cuenta lo que ya pasó, y el sistema corta lo que
   invente. ✅
6. **Rol de mesa de verdad.**
   - Un d20 visible, con checks opuestos como en D&D 5e.
   - 9 clases, con especialización a nivel 10.
   - Combate de grupo, con iniciativa individual y hasta 4 combatientes por bando.
   - Caza, desuello y 12 oficios. ✅
7. **Exploración con niebla de guerra.** Mapa de zona por casillas: lo que aún no conoces aparece como
   «???». La fauna es de día o de noche y hay tormentas de arena magnética. ✅
8. **Privado por diseño.** Sin cuentas, sin telemetría y sin conexión. ✅

## 4. Cómo se juega (el turno)

1. **Escribes** en lenguaje natural: «sigo las huellas hacia el norte».
2. **El motor la interpreta.** Comprueba que la acción encaja con el mundo (validación contra el lore).
   Si hace falta, un modelo pequeño decide qué atributo se pone a prueba, con qué dificultad y cuánto
   tiempo lleva.
3. **Se tiran los dados.** La tirada se ve en pantalla y el resultado lo fija el motor: daño, botín,
   experiencia, inventario.
4. **El narrador lo cuenta**, con el tono del mundo. El sistema valida su texto antes de aplicarlo.
5. **El mundo sigue.** El reloj de ficción avanza: las facciones deciden, el reino produce y el Libro de
   Sucesos lo apunta todo.

Además de escribir, hay acciones con botón:
- moverse por el mapa de zona;
- interactuar con lo que encuentras: hablar, cazar, recolectar, huir;
- abrir menús fijos de cada NPC: charlar, aprender un oficio, pedir trabajo, preguntar qué se cuenta,
  proponerle que se una.

## 5. El mundo: Helek Sirik

- **Fantasía con base científica.** Todo fenómeno tiene causa física: bioacumulación, magnetismo,
  vibración, adaptación. Nada es «magia» sin mecanismo.
- **Tono:** épico y trágico.
- **Dos continentes:**
  - **Berig**, donde se juega;
  - **Vaelira**, al otro lado de la Niebla del Estrecho. 🗺️ Primera gran expansión.
- **Escala:** en todo Berig viven unas 8.000-10.000 almas, un continente a medio vaciar. La moneda es el
  Goirno.
- **Las Semillas:** las razas nacieron de las Semillas que crearon el mundo, salvo los orcos, que
  nacieron de la magia salvaje del Estallido (hacia el año 1.000).
- **Cronología** (sin años antes del 0):
  - 0: los Faerus se asientan en Hashma;
  - ~1.000: el Estallido;
  - 2.000: nacen los cuatro primeros orcos;
  - 2.800: guerra Goirnte contra los orcos;
  - ~3.600: el Yugo de Hierro y la Purga Silenciosa;
  - 4.000: la aniquilación del Clan Maktor;
  - ~4.005: El Detonante;
  - **4.010: empieza la partida.**
- **Protagonista:** Gorhorn, de 20 años, el último Maktor. Su clan fue aniquilado mientras los Serhu
  miraban. Su motivación es restaurar el nombre de los Maktor. Clase de partida: Cazador.
- **Misterios** (el juego no los resuelve todavía): el Reino Nabierus enterrado bajo la arena magnética,
  Tarkor y su regreso, la Ciudad Hundida, la Entidad Desconocida.

### Regiones de Berig

| Región | Paisaje | Hito jugable |
|---|---|---|
| Llanuras del Viento Rojo | Estepa roja y arcillosa, sabanas, volcanes y costa; tormentas de arena magnética. Unos 126 × 249 km | 0.1 ✅ |
| Cristal Helado | Tundra y picos de hielo bajo la aurora; minerales únicos | 0.4 🗺️ |
| Ciénaga Troncal | Pantano de pilotes, turba y bruma | 0.5 🗺️ |
| Margen Silencioso | Selva de madera negra donde el sonido entra y no vuelve | 0.6 🗺️ |
| Meseta del Orden | Ciudades goirntes, la mejor metalurgia del mundo | 0.6 🗺️ |
| Vaelira | Segundo continente, otras cuatro razas | 1.0 🗺️ |

### Lugares de las Llanuras (jugables)

- **Karot Veku («Colmillo Ceniza»):** asentamiento del Clan Serhu. Tiene el salón Ketg'sedsar y los 12
  Maestros de oficio.
- **La Hondonada del Eco:** cuevas, refugio contra tormentas. El Kirelon Arenoso caza de noche.
- **Los Pilares Rotos:** torres de roca roja, restos Nabierus, unidas por puentes colgantes.
- **El Pozo de Cauce Viejo:** agua permanente.
- **Los Manaderos:** charcas donde nacen los Corredores de Cauce; cazar crías ofende.
- **Las Agujas Imán:** rocas imantadas que desorientan.
- **El Osario de la Manada:** esqueleto de Gargantúa.
- **El Cruce de las Cenizas:** la única puerta al Margen.
- **Los Restos de Maktor:** tu aldea arrasada.
- **Kegi:** los Faerus del Feg Ger.
- **Otros:** la Playa de Ceniza Blanca, los Acantilados Partidos, la Sabana Alta y los Pastos de la
  Deriva.

En total, el catálogo tiene **72 lugares** unidos por **35 rutas**.

## 6. Razas

En Berig no hay humanos.

| Raza | Origen y hogar | Rasgos | Clase exclusiva |
|---|---|---|---|
| **Orcos** (4 clanes: Maktor, Serhu, Helsig, Goshg) | Nacidos del Estallido. Llanuras, Cristal Helado, Ciénaga | Honor y fuerza; no mienten, pero callan. Gobierna una Terk'ikar (casi siempre hembra) y dirige la guerra un Kort'ikar. No lanzan magia en crudo: la canalizan por tótems y runas. Duelo Signeran a muerte | Chamán (nunca Mago) |
| **Goirntes** | Semilla Goirme. Meseta del Orden | Piel gris casi mineral que brilla al concentrarse. Castas de función, leyes grabadas en obeliscos. Tabú: lo inacabado | Caballero |
| **Nabieus** | Semilla Kroj. Margen oriental y sur de la Ciénaga | Piel que atrapa la luz, voz casi inaudible; los silencios tienen gramática. Tabú: levantar la voz. Deciden en cónclave con la palma en el suelo | Segador |
| **Faerus** | Semilla Ferios. Margen occidental y Kegi | «Pelo» de hojas finas, postura a dos o cuatro patas, olfato que lee el miedo. La manada es la única institución; sin escritura ni títulos. Tabú: abandonar a un herido | Druida |
| Kelife, Jusaly, Kalisar, Ilvenar | Vaelira 🗺️ | Piel cristalina, vegetal, de azabache y de pergamino que registra | — |

## 7. Facciones y personajes

| Facción | Raza y región | Quién manda | Población |
|---|---|---|---|
| Concordia de Hierro | Goirntes radicales, Meseta | Primer Censor Tarsen Vold y General Vrask Ombra | ~1.600 |
| Los del Obelisco | Goirntes moderados, Meseta | Archimagistrada Yovenne Tal | ~300 |
| Clan Serhu | Orcos, Llanuras (Karot Veku) | Ulkha Ketg y Torgash Ketg | ~800 |
| Clan Helsig | Orcos, Cristal Helado | Brenka y Solgra | ~400 |
| Clan Goshg | Orcos, Ciénaga | Doshka y Dulgren | ~600 |
| Keseg Sael | Nabieus, Margen | Aven Tessk, portavoz del cónclave | ~1.500 |
| Keseg Prisilke | Nabieus, Ciénaga | Ilka Dren, cazadora mayor | ~500 |
| Feg Tusha | Faerus, Margen (Hashma) | Quien ocupa el Jakut (Hulki) | ~850 |
| Feg Ger | Faerus, sur de las Llanuras (Kegi) | Quien ocupa el Jakut (Yeru) | ~200 |
| Clan Maktor | Orcos | Aniquilado; solo queda Gorhorn | 1 |

**Tensiones:**
- La Concordia arma a los Serhu contra los demás clanes y los Faerus.
- Los Serhu traicionaron dos veces a los Maktor.
- El Pacto de la Primera Pieza une a los Faerus con los Maktor.
- Berig está en guerra con Vaelira desde El Detonante.

**Personajes destacados:**
- **Gistera Koh:** una de las primeras personas que encuentras.
- **El Orco Enfurecido de la Hondonada:** el objetivo de una de las primeras misiones.
- **Los Maestros de oficio** de Karot Veku.

El catálogo tiene **75 NPC**.

## 8. Clases y personaje

**7 atributos:** Fuerza, Destreza, Constitución, Inteligencia, Voluntad, Carisma y Magia, en una escala
de 4 a 16 para lo común. Hay además atributos secundarios: moral, resistencia al frío, resistencia al
calor, suerte (que da ventaja) y honor.

**9 clases y 31 especializaciones** (la especialización se elige a nivel 10):

| Clase | Razas | Especializaciones | Identidad |
|---|---|---|---|
| Guerrero | Todas | Berserker, Guardián, Lancero, Especialista | Cuerpo a cuerpo, tanque o bruiser |
| Cazador | Todas | Domador, Supervivencia, Tirador, Instintivo | Superviviente; el Domador controla bestias |
| Arquero | Todas | Maestro arquero, Maestro ballestero | Tirador |
| Asesino | Todas | Maestro asesino, Tóxico, Danzante, Selecto | Precisión, veneno, movilidad |
| Chamán | Solo orcos | Totémico, Rúnico, Convocador, Opresor | Magia a través de tótems y runas |
| Caballero | Solo Goirntes | Del Orden, Del Valor, Del Dolor | Disciplina militar, defensa |
| Segador | Solo Nabieus | Parca, Maldito, Ilustrado, Transmutador | Succión de vida, debilidades, remates |
| Druida | Solo Faerus | Cambiaformas, Aullador, Salvaje, Adaptado | Se transforma en fauna del Margen; el Aullador invoca a Vaeth |
| Mago | No orcos | Poder de la magia, Poder de la Semilla | 7 escuelas y 12 ramas de Semilla 🛠️ (sin habilidades jugables todavía: hoy son **8 clases jugables**) |

**Equipo:**
- **Armas:** 22 tipos. Cada una pone a prueba un atributo:
  - Fuerza: hachas, mazas, picas;
  - Destreza: dagas, espadas, arcos, ballestas, hondas, redes;
  - Constitución: el escudo;
  - Voluntad: la vara;
  - Magia: báculos y grimorios.
- **Armadura** por peso: ligera (Magia e Inteligencia), media (Destreza y Voluntad) y pesada (Fuerza y
  Constitución).
- **24 ranuras de equipo**, incluidas las cosméticas.
- **245 objetos** en el catálogo, con tiers de rareza del 1 al 9. La economía es pequeña: nada pasa de
  80 Goirnos.

**Progresión:**
- Niveles del **1 al 40**. La experiencia sigue la tabla exacta de D&D 5e hasta el nivel 20 y una curva
  propia después.
- Puntos de atributo en los niveles 4, 8, 12, 16 y 19, y luego cada 4.
- Hay experiencia por éxitos en tiradas, por hitos, por misiones y por el reino.
- Los oficios suben de nivel por separado.

## 9. Reglas y combate

- **Tirada:** d20 + la mitad del atributo + el bono del oficio. Hay ventaja y desventaja (por suerte o
  por raza).
- **Combate:** check opuesto, como en D&D: atacante contra defensor y gana quien saca más. Un margen
  de 10 o más es un golpe pleno, o un contragolpe si gana el defensor.
- **Rueda de atributos:** ventajas de tipo entre atributos (el atacante con ventaja multiplica su valor).
- **Condición física:** Ileso → Herido → Grave → Convaleciente → Muerto. Cada escalón resta a las tiradas.
- **Dificultad** (límite de muertes): Novato sin límite, Medio 4 y Avanzado 2. Al llegar al límite, la
  partida termina. Cada vez que mueres, la Entidad Desconocida te devuelve a un punto de descanso.
- **Combate 1 contra 1 o de grupo**, hasta 4 por bando:
  - cada combatiente tira su iniciativa;
  - los emparejamientos («enganches») se fijan por ronda;
  - quien te ataca sin ser tu duelo tira con ventaja (flanqueo), como mucho 2 por ronda;
  - una ronda que empiezas Ileso no te deja peor que Convaleciente.
- **Golpe de gracia:** rematar a un enemigo convaleciente acierta siempre, como el crítico automático
  contra un inconsciente en D&D 5e y BG3.
- **17 efectos de habilidad:** Ataque, Aturdimiento, Intimidación, Aguante, Análisis, Invocación,
  Debilidad, Aumento, Limpiar, Canalizar, Curación, Reflejar, Expulsar, Control, Múltiple, Letal y
  Desviar.
- **Después del combate:**
  - con un enemigo convaleciente: matar, capturar o dejar vivir con clemencia;
  - con los cuerpos: saquear y desollar;
  - y siempre se puede intentar huir.

## 10. Exploración y supervivencia

- **Mapa de zona por casillas:**
  - las fichas de fauna, NPC y recursos se mueven a cada paso tuyo;
  - el encuentro salta en tu casilla o en una vecina;
  - una tirada de Destreza decide quién ve a quién primero;
  - los agresivos te cortan el paso y te persiguen.
- **Niebla de guerra:** lo que no has descubierto sale como «???». La Enciclopedia se desbloquea por
  fases (citado, descubierto, conocido).
- **Seguridad:** junto a cada entrada de zona hay un radio sin fauna hostil. Los asentamientos amistosos
  no te interrumpen.
- **Viajes reales** entre lugares, con tiempo de camino (la Destreza lo acorta). Con montura, «Viajar»
  lleva directo.
- **Tiempo y entorno:**
  - un reloj de ficción con día y noche, y fauna diurna y nocturna;
  - 4 estaciones;
  - 4 estados del clima, de llevable a tormenta extrema;
  - tormentas de arena magnética: Ghurmek, Sek'tar, Rokthar y Rok'ithek.
- **Supervivencia:**
  - hambre, sed y energía; la energía se gasta en habilidades y se recupera comiendo y descansando;
  - curación con objetos;
  - para beber hace falta un odre o un punto de agua.

## 11. Oficios, recolección y construcción

- **12 oficios en las Llanuras**, que enseñan los Maestros Serhu: herrero, curtidor, peletero,
  desollador, domador, carpintero, sastre, herborista, primeros auxilios, alquimista, cocinero y
  pescador. Además existe el constructor, ligado al reino. Cristal Helado añade el minero 🗺️.
- **7 formas de obtener recursos:** caza, tala, minería, extracción, pesca, búsqueda y producción
  pasiva. Hay **161 fuentes de recurso**. El tier exige nivel de oficio y herramienta.
- **Edificios de oficio** (Taller → Obrador → Gran obrador, con trabajadores) 🛠️.

## 12. Bestiario y flora

- **Fauna:**
  - **13 familias:** Guelises, Acechantes, Corvenes, Zancudos, Bestiones, Rondines, Quitinos,
    Escamados, Nadantes, Ordenados, Umbrías, Mudos salvajes y Rokrats del Estallido.
  - **53 especies** en el catálogo (37 en las Llanuras jugables), además de las del lore de otras
    regiones.
  - **5 temperamentos:** amigable, inofensivo, cauteloso, agresivo y enemigo.
  - Niveles de 1 a 16. Cada especie tiene de 1 a 3 habilidades raciales.
  - La fauna vive en grupos con población real, que se agota y se repone.
- **Flora:** 13 familias, entre ellas Veldrias (árboles), Salviras (medicinales), Granoles, Trenias,
  Muscarias y Brotes salvajes.

| Especie destacada | Familia | Nivel | Carácter |
|---|---|---|---|
| Gargantúa de Ceniza | Bestiones | 6-12 | Agresivo; reptil herbívoro del tamaño de una casa, con placas óseas volcánicas |
| Kirelon Arenoso | Mudos salvajes | 8-14 | Agresivo y nocturno; acecha en la Hondonada del Eco |
| Ferike | Guelises | 10-16 | Agresivo; el mayor peligro conocido, en el borde de la selva |
| Cruzavientos | Corvenes | 5-10 | Agresivo; anida en las cumbres de los Pilares Rotos |
| Rondador de Brasas | Acechantes | 2-6 | Carroñero nocturno de ojos dorados |
| Towrgu | Acechantes | 4-12 | Depredador de la Sabana Alta |
| Salamandra de Escoria | Mudos salvajes | 3-4 | Escamas de escoria con vetas de lava |
| Múrgol | Bestiones | 1-5 | Ganado lanudo de los clanes, de cornamenta ramificada |
| Cuernahoja | Bestiones | 2-5 | Manadas de gacelas de cuernos largos |
| Corredor de Cauce | Bestiones | 1-2 | Presa sagrada de los orcos |
| Negueo Turquesa | Nadantes | 1-2 | Pez carroñero con dientes de piraña |
| Espina del Viento | — | — | Peligro ambiental: se entierra y ataca en las tormentas |

| Planta destacada | Para qué sirve |
|---|---|
| Cardo Brújula | Su fibra imantada señala siempre el mismo rumbo |
| Raíz de Fuego | Acumula calor y libera gas inflamable: explosivo e iniciador de fuego |
| Flor de Ceniza | Adormece el dolor |
| Salvia del Polvo | Corta hemorragias |
| Telda | La madera básica |
| Lucre Blanco | Madera noble de las cumbres (tier 6) |

## 13. El reino

- **Fundar:**
  - se empieza con un campamento base;
  - el Ayuntamiento tiene tres niveles y para fundarlo solo hacen falta materiales;
  - el permiso del dueño de la tierra, por reputación, está diseñado 🛠️.
- **Construcciones:** choza, jaulas (tres niveles) para la fauna capturada, Cuartel Avanzado (que se
  convierte en Cuartel de Guerra o en Puesto Comercial) y el Tótem del Clan Maktor.
- **Súbditos:** llegan, forman pareja, tienen hijos y trabajan en su oficio, con su linaje. Comen según
  la tarea que hacen.
- **Ganadería** y **compañeros:** puedes domar o reclutar compañeros, que te aprueban o no según sus
  valores.
- **Defensa:** empalizada, torre de vigía y milicia frente a campamentos de bandidos que crecen.
- **Guerra:** las facciones mandan ejércitos contra tu reino. Puedes pagar tributo o contraatacar.

## 14. El mundo vivo

- **Facciones:** cada una tiene economía, población y expediciones de recolección y caza. Sus decisiones
  avanzan por pasos.
- **Movimiento real:** caravanas, viajeros y partidas de caza recorren rutas reales del mapa, y se pueden
  interceptar.
- **Libro de Sucesos:** todo hecho importante con su causa. Lo cuentan las Leyendas, una crónica por días.
- **Rumores:** viajan de región en región. Un NPC te cuenta «qué se dice».
- **Consecuencias diferidas:** venganzas, refugiados, sucesiones.
- **Reputación y memoria:** reputación con cada facción, y NPC con recuerdos, rencores y títulos ganados.
- **Misiones:** las de historia y las secundarias, que genera el motor a partir de plantillas (nunca
  inventadas por la IA), con plazos y recompensas de experiencia, Goirnos y reputación.
- **Regulación:** nada se apaga del todo. Las poblaciones, las economías y las guerras se equilibran solas.

## 15. Cifras para la página

| Cifra | Valor |
|---|---|
| Razas | 8 (4 jugables en Berig y 4 en Vaelira) |
| Regiones de Berig | 5 (1 jugable hoy) |
| Clases y especializaciones | 9 y 31 (8 clases jugables) |
| Facciones | 9 vivas y 1 aniquilada |
| Especies de fauna en el catálogo | 53 |
| Familias de fauna y flora | 26 |
| Objetos | 245 |
| Lugares y rutas | 72 y 35 |
| Oficios | 12 en las Llanuras |
| Efectos de habilidad | 17 |
| Niveles | 1-40 |
| Tests automáticos | Unos 4.200 (3.599 de backend y 643 de frontend) |
| IA en tu equipo | 100 % |

## 16. Hoja de ruta

| Hito | Nombre | Estado |
|---|---|---|
| 0.0 | Alpha 0: reino, zona, caza, oficios, tiradas visibles, economía y expediciones | ✅ |
| 0.1 | Llanuras estable | 🛠️ Casi cerrado: falta el rendimiento en la Steam Deck y la pasada final |
| 0.2 | Facciones vivas: Libro de Sucesos, mundo por partida, rumores y leyendas | 🛠️ Lo principal hecho |
| 0.3 | Reino profundo: memoria, generaciones, economía, ganadería y conflicto | 🛠️ En curso. Ronda de pruebas jugando antes de seguir |
| 0.4 | Cristal Helado | 🗺️ |
| 0.5 | Ciénaga Troncal | 🗺️ |
| 0.6 | Margen Silencioso y Meseta del Orden | 🗺️ |
| 0.7 | Personaje propio, de cualquier raza | 🗺️ |
| 0.8 | Beta de Berig: instalador público, rendimiento en la Steam Deck, narrador afinado | 🗺️ |
| 1.0 | Vaelira | 🗺️ |

---

## 17. Detalles técnicos

### Arquitectura

```
Frontend (React SPA) ──REST + sondeo──► Backend (Fastify)       ──HTTP local──► Ollama (modelos locales)
                                          rutas · servicios puros
                                          cola de IA · worldTick
                                                 │ Prisma
                                          PostgreSQL + pgvector
```

Todo corre en el equipo del jugador. Sin login, con un único usuario implícito.

| Capa | Tecnología |
|---|---|
| Interfaz | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Motor | Node.js, Fastify 5, TypeScript, Prisma 6 (67 modelos, 237 migraciones) |
| Datos | PostgreSQL con pgvector (embeddings) |
| IA | Ollama, con modelos locales |
| Instalador | Tauri v2 (Rust): NSIS para Windows y AppImage para Linux |
| Calidad | Vitest, Testing Library, Playwright (pruebas jugando de verdad), oxlint, GitHub Actions |

### Modelos de IA y su papel

| Papel | Modelo | Qué hace |
|---|---|---|
| Narrador | Llama 3.1 8B (`tarkor-narrador-llama31`, contexto de 16k, temperatura 0,15) | Cuenta el resultado ya fijado del turno |
| Cronista y clasificador | Qwen 2.5 1.5B instruct | Decide atributo, dificultad y duración de una acción libre; redacta sucesos del mundo |
| Sugerencias | Qwen 3.5 4B | Propone tres acciones posibles |
| Embeddings | nomic-embed-text | Búsqueda semántica (RAG) en el lore y en los hechos de la partida |

- **Una sola cola de generación:** dos generaciones nunca compiten por el procesador.
- **Salidas en JSON validadas:** si una no cumple, se reintenta o se cae a un texto determinista.
- **Sin IA no se rompe nada:** cada tarea de la IA tiene una alternativa con plantillas.
- **Memoria del narrador:** elige qué recordar por importancia, relevancia y lo reciente que es. Los
  hechos de sesión se recuperan por similitud.
- **Narrador propio afinado** 🛠️: hay un conjunto de destilación (317 ejemplos de entrenamiento y 57 de
  evaluación) para un ajuste fino con Unsloth en Colab, exportado a GGUF para Ollama.
- **Imágenes:** los retratos y paisajes se generan aparte. La redacción de sus prompts puede usar
  proveedores en la nube (opcional), pero nunca durante la partida.
- **Perfiles según el equipo:** el instalador mide memoria, procesador y gráfica, y propone un perfil
  (de Mínimo a Ultra), para que el juego vaya fluido desde una Steam Deck hasta un PC potente.

### Simulación

- **El motor decide, el LLM narra.** La lógica de reglas son funciones puras y deterministas: tiradas,
  daño, experiencia, economía, relaciones. Si el modelo afirma algo que el motor no hizo, el backend lo
  corta.
- **Reloj de ficción:** el `worldTick` corre cada 2 minutos reales con el juego encendido. Resuelve:
  - los viajes;
  - el crecimiento de la población;
  - la agenda de facciones;
  - el hambre y la sed;
  - las convalecencias.

  Con el juego apagado, el mundo se pausa.
- **Un mundo por partida:** cada partida tiene su propia copia del mundo vivo (población, puntos del
  mapa), sin multiplicar el coste del catálogo.
- **Nada en bucle fijo:** cada suceso nace del estado del mundo, no de un temporizador.

### Forma de trabajar

- Desarrollo asistido por agentes de IA (Claude Code) en dos cuentas que se relevan.
- Antes de cada PR, revisión de código automática y retrospectiva. Integración continua en GitHub
  Actions.
- Rondas de pruebas jugando con el navegador automatizado. Cada fallo se apunta y se corrige con un test
  que demuestra que fallaba sin el arreglo.

## 18. Decisiones de diseño (el porqué)

- **IA local, no una API de pago:** sin coste por partida, sin terceros y sin que tus partidas salgan de
  casa.
- **El mundo en reglas, la IA en la narración:** así el juego es justo, coherente y comprobable.
- **Nada en bucle fijo:** un mundo pequeño que se regula solo.
- **Sin IA no se rompe nada:** plantillas de respaldo para todo.
- **Diseño contrastado con referentes:** X4: Foundations marca el camino del mundo vivo. D&D 5e y BG3
  para las reglas; Medieval Dynasty, Bellwright y Manor Lords para el reino y la supervivencia.

## 19. Lo que aprendimos

- Separar simulación y narración: la IA cuenta la historia, pero los números los deciden reglas que se
  pueden probar.
- Dar memoria al narrador sin saturarlo.
- Regular un mundo de bolsillo para que nada se apague ni se desborde.
- Dar a cada partida su propia copia del mundo sin multiplicar el coste.
- Conseguir que modelos locales respondan con fluidez en una Steam Deck.

---

## 20. Para la web: correcciones y añadidos

**Correcciones a lo publicado:**
- **«Ocho clases»:** son 9 clases con 31 especializaciones, y 8 de ellas jugables (el Mago aún no tiene
  habilidades).
- **«+3.900 tests»:** hoy son unos 4.200.
- **Fase:** el hito 0.3 está en una ronda de pruebas jugando; hasta cerrarla no se añade roadmap nuevo.

**Secciones nuevas que suelen tener las páginas de juegos parecidos:**
- bestiario con imagen y nivel;
- tabla de clases;
- razas;
- requisitos del sistema por perfil;
- preguntas frecuentes: ¿necesita conexión?, ¿qué equipo hace falta?, ¿en qué idioma está?;
- prensa: capturas sin interfaz, logo y descripción corta y larga.

**Imágenes disponibles** en `Portal-Galivelop/public/proyectos/tarkor/`: portada, 16 de galería (fauna,
flora, razas, personajes) y 5 capturas (combate, mapas de zona, habilidades de reino).
