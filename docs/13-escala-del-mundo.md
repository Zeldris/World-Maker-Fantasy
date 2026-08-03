# Escala del mundo: dimensiones reales de Helek Sirik (diseño, 2026-07-18)

**Estado:** diseño cerrado para revisión — nada de esto está implementado ni afecta al motor.
**Qué es:** la capa cartográfica de referencia — kilómetros y proporciones reales de todo lo explorado de Helek Sirik, ancladas en los tiempos de viaje ya fijados en [12-mundo-estructurado.md](12-mundo-estructurado.md) § 1.3. Existe para que una futura imagen del mapa (pospuesta) tenga una base de datos geográfica exacta que leer, y para que cualquier ampliación futura del mundo sepa cuánto espacio tiene.
**Qué NO es:** un reemplazo del grafo de ubicaciones. El motor de juego sigue hablando en **tiempo** (minutos base por arista, Dijkstra en backend) — el modelo pequeño nunca ve un kilómetro. Esta capa es cartografía y consistencia editorial, no mecánica de turno.

**Regla de fuentes** usada en todo el documento (y en la tabla final):
- **MEDIDO** — se deriva aritméticamente del grafo de docs/12 § 1.3. Dato firme.
- **EXTRAPOLADO** — se deriva de un dato medido más un razonamiento explícito. Revisable, pero con ancla.
- **ESTIMADO** — solo hay descripción cualitativa en el lore. Orden de magnitud razonado, libre de cambiar hasta que algo lo mida.

---

## 1. Método y ancla: del grafo a los kilómetros

Convención de conversión (fijada aquí como canon de referencia):

- **Ritmo base de referencia: 5 km/h a pie** sobre los `minutosBase` de las aristas (el "base" de `timedActions.ts`, sin modificador de destreza). Los modificadores de personaje (Gorhorn ÷1,45) cambian el *tiempo*, nunca la *distancia* — la geografía es la misma para todos.
- Los km resultantes son **kilómetros de ruta** (lo que se camina), no línea recta. Para cartografía se asume una **sinuosidad media de 1,1** en estepa abierta: `distancia en línea recta ≈ km de ruta ÷ 1,1`. (En terreno más roto —Margen, Ciénaga, montaña— la sinuosidad real sería mayor, 1,3–1,6; se anota donde toca.)

Distancias de ruta del grafo v1 (MEDIDO — directo de docs/12 § 1.3 a 5 km/h):

| Ruta | Minutos base | Ruta (km) | Línea recta (km, ÷1,1) |
|---|---|---|---|
| Cruce de las Cenizas ↔ Pilares Rotos | 240 | 20 | ~18 |
| Cruce de las Cenizas ↔ Pozo de Cauce Viejo | 300 | 25 | ~23 |
| Pilares Rotos ↔ Hondonada del Eco | 120 | 10 | ~9 |
| Pilares Rotos ↔ Pozo de Cauce Viejo | 180 | 15 | ~14 |
| Hondonada del Eco ↔ Pozo de Cauce Viejo | 150 | 12,5 | ~11,5 |
| Pozo de Cauce Viejo ↔ Campamento Serhu | 120 | 10 | ~9 |
| Pilares Rotos ↔ Restos de Maktor | 300 | 25 | ~23 |
| Campamento Serhu ↔ Restos de Maktor | 360 | 30 | ~27,5 |

### 1.1 Coordenadas cartográficas de los 10 nodos (para la futura imagen)

Las 8 aristas originales **admiten una colocación 2D consistente** — esto no era obvio (8 restricciones sobre 6 puntos) y es la prueba de que el grafo de docs/12 es geométricamente sano. Coordenadas en km, origen en Los Pilares Rotos, **+x = este, +y = norte**:

| Nodo | x (km) | y (km) | Comprobación |
|---|---|---|---|
| Los Pilares Rotos | 0 | 0 | origen (hito visible — céntrico, como pide el lore) |
| El Pozo de Cauce Viejo | +13,5 | 0 | |
| El Cruce de las Cenizas | 0 | −18 | el nodo más al **sur** del núcleo — es la entrada del camino de la Meseta, y la Meseta queda al sur (§ 3). Esta distancia es la real de juego (tiempos de viaje); el dibujo en pantalla del Cruce usa una posición distinta, solo visual (ver nota 2026-08-03 más abajo) |
| La Hondonada del Eco | +5 | +7,5 | |
| Campamento del Clan Serhu | +21 | −5 | sureste del Pozo, sobre la senda de pastoreo |
| Los Restos de Maktor | +10 | +20,5 | el más profundo en la estepa, hacia el norte salvaje |

Las 8 distancias en línea recta que salen de estas coordenadas reproducen los km de ruta ÷ 1,1 con error < 3% en todas las aristas — dentro del margen de cualquier dibujo. Y las parejas **sin** arista quedan coherentes: Hondonada ↔ Cruce salen ~26 km en línea recta pero sin senda (por eso el grafo obliga a pasar por los Pilares), y Restos de Maktor queda lejos de todo salvo de sus dos rutas canónicas.

**Los 4 puntos de interés añadidos el 2026-07-20** (ver `worldCatalog.ts` `locationLinks`) triangulan igual, a partir de sus aristas nuevas sobre los 6 nodos ya fijados arriba:

| Nodo | x (km) | y (km) | Aristas usadas | Comprobación |
|---|---|---|---|---|
| El Osario de la Manada | +10,95 | +7,6 | Pilares Rotos (13,3 km), Restos de Maktor (12,9 km) | de las 2 soluciones de la intersección de círculos, la que queda ENTRE ambos nodos, no proyectada al otro lado |
| Las Agujas Imán | −7 | +8,3 | Pilares Rotos (10,8 km), único vecino — **EXTRAPOLADO** el ángulo (noroeste, hueco vacío del croquis), la distancia sí es MEDIDO |
| Los Manaderos | +18,1 | +2,8 | Pozo de Cauce Viejo (5,4 km), Campamento Serhu (8,3 km) | queda entre ambos nodos, coherente con "misma corriente" que los une |
| Los Túmulos del Honor | +6,2 | +5,6 | Pozo de Cauce Viejo (9,2 km), Restos de Maktor (15,4 km) | sobre la línea general Pozo→Maktor, sin riesgo anotado en el primer tramo (a diferencia del segundo) |

Mismo margen de error que los 6 originales en las aristas usadas para triangular; sin arista propia entre los 4 nuevos (no hay ruta directa Osario↔Agujas, etc. en el grafo v1), así que sus distancias mutuas son solo geométricas, no verificadas contra ningún tiempo de viaje.

**Qué es canon aquí y qué no:** las distancias relativas entre nodos son MEDIDO. La *orientación* (qué lado es el norte) es EXTRAPOLADO de una sola pieza de lore: el Cruce de las Cenizas conecta con la Meseta del Orden, y la Meseta está al sur del territorio orco (disposición ya fijada en `InteractiveMap.tsx` y en areas.md: el Margen separa la Meseta de "las tierras salvajes del **norte**"). El croquis ASCII de docs/12 § 1.3 es topológico, no orientado — no contradice esto.

Nota: los tiempos de docs/12 § 1.3 quedan intactos; esta tabla solo los proyecta.

**Actualización 2026-08-03 (auditoría "y el resto de zonas están bien?"), tres pasadas el mismo
día — la primera y la segunda quedaron superadas por la tercera, se dejan aquí porque cada una
enseñó algo real:**

**Primera pasada (solo documental, superada):** al calibrar contra el mapa real de Azgaar (burg612
"Campamento del Clan Serhu"), el núcleo entero proyectaba en la zona norte-central del polígono
real de Las Llanuras, lejos del borde dibujado de El Margen Silencioso. Se estimó el hueco en ~90 km
y se documentó sin tocar coordenadas, asumiendo que el Cruce de las Cenizas marcaba solo "el límite
de lo jugable", no el límite físico real.

**Segunda pasada (recalibración de bloque, también superada):** la usuaria, al ver que el Cruce
seguía en la misma posición visual tras la primera pasada, pidió medir contra el PNG real en vez de
asumir. Midiendo sobre los vértices reales del polígono (renderizando los 12 nodos con
`rsvg-convert`), el hueco real resultó de ~170 km, no ~90. Con eso medido, se desplazó
`LLANURAS_OFFSET_Y` para mover el núcleo ENTERO en bloque hacia el sur. Esto sí dejaba el Cruce
junto al borde real — pero arrastraba también a los otros 11 nodos, que ya estaban bien donde
estaban. La usuaria lo detectó de inmediato viendo el mapa: "las posiciones del resto de
localizaciones estaban bien pero las has bajado... el cruce cenizas el que había que bajar".

**Tercera pasada (la que queda) — separar lo visual de lo triangulado:** en vez de mover el bloque,
se revirtió `LLANURAS_OFFSET_Y` a su valor anclado al burg real de Campamento Serhu (los otros 11
nodos vuelven a su posición de siempre) y se movió SOLO la posición visual de
`cruce-de-las-cenizas` en `frontend/src/data/map.ts` (de -18 a -180 en el eje y), sin tocar esta
tabla ni las distancias MEDIDO de arriba. Decisión explícita de la usuaria: "olvídate de las
distancias de Azgaar, establezcamos nosotros las nuestras" — la posición en pantalla del Cruce ya
no representa la distancia triangulada real (que sigue siendo -18, la de esta tabla, la que rige
los tiempos de viaje reales vía `LocationLink`), es una posición puramente artística elegida para
que quede junto al borde real dibujado con El Margen Silencioso. El resto del núcleo no se ve
afectado por este desacople. Ver también [areas.md](rpgtarkor/areas.md), nota de escala del Cruce
de las Cenizas (también actualizada), y el comentario de `cruce-de-las-cenizas` en `map.ts`.

Aparte (de la primera pasada, sigue vigente): se corrigió un bug de signo real en
`LLANURAS_OFFSET_Y` — el núcleo se dibujaba 10 km más al sur de lo que la propia calibración
pretendía. Con la tercera pasada, el offset volvió a depender de ese mismo ancla ya corregida.

---

## 2. Las Llanuras del Viento Rojo

### 2.1 El núcleo jugable (grafo v1) — MEDIDO

El polígono que encierran los 6 nodos mide unos **39 km de eje mayor** (Cruce → Restos de Maktor en línea recta) por **~21 km de ancho** (Pilares → Campamento Serhu, transversal). Con un margen de un par de horas de marcha alrededor de los nodos exteriores (terreno que un jugador puede pisar sin salir "de la zona"), el núcleo jugable v1 es un área de aproximadamente **45 × 30 km ≈ 1.200–1.400 km²** — del orden de la isla de Gran Canaria.

Esto encaja de lleno con la escala ya validada en docs/12: cruzarlo entero son ~6 h de marcha dura para Gorhorn (banda extendida larga, nunca "larga" >24 h).

### 2.2 La región completa — MEDIDO (2026-07-22, mapa real de Azgaar; antes EXTRAPOLADO)

El núcleo v1 **no es toda la región: es su esquina suroccidental**, la que toca el camino de la Meseta *(matizado 2026-08-03 — al calibrar contra el mapa real de Azgaar, el núcleo de los 11 nodos triangulados cae en la zona norte-central de la región, no en la esquina suroeste exacta; solo el Cruce de las Cenizas se dibuja aparte, junto al borde real, como posición puramente visual — ver la actualización al final de § 1.1, tercera pasada)*. Tres piezas de canon obligan a que la región sea mayor que el núcleo:

1. Los clanes son **pastores nómadas con migraciones estacionales** a lomos de Gargantúas (areas.md) — un ciclo estacional necesita pastos de temporada fuera del territorio de asentamiento fijo.
2. Los Corredores de Cauce migran "siguiendo las escasas corrientes de agua subterránea" en manadas de decenas — el Pozo de Cauce Viejo es *un* punto de esa corriente, no su origen ni su final.
3. Los "volcanes activos **a lo lejos**" del horizonte no están dentro del núcleo (ningún nodo ni arista los toca): quedan en el borde norte/noreste de la región, hacia la transición con Cristal Helado.

**Superseded 2026-07-22**: la región completa ya no es una extrapolación cualitativa — se puede medir
sobre el polígono real del estado Llanuras del Viento Rojo en `docs/map/Helek_World.map` (fórmula
del área de Gauss/shoelace sobre sus vértices reales, no solo el rectángulo envolvente de § 3).
**Área real: ~19.900 km²** — bastante mayor de lo estimado en 2026-07-18 (~7.000–8.000 km²). El
núcleo v1 es así un **~6,5%** de la región (1.300 / 19.900), no el ~18% que se había supuesto:
sigue habiendo de sobra sitio para "a lo lejos" y las migraciones estacionales, con más margen del
que se pensaba. La densidad de población (dos clanes, 800–1.500 orcos en total) sale ahora más
baja, ~0,06–0,08 hab/km² — todavía coherente con pastoreo nómada de estepa, solo que más disperso.

**Jugable ahora vs. existe sin detallar:**
- *Jugable ahora:* el núcleo del grafo v1 (6 nodos, 8 aristas, ~1.300 km²).
- *Existe pero sin detallar:* el resto de la región (~18.600 km²) — pastos de temporada al este, la zona volcánica del norte/noreste, el tramo alto de la corriente subterránea. Sin nombres nuevos aquí (regla de este documento): cuando el juego los pise, se nombrarán por el pipeline editorial de siempre (facts → areas.md → catálogo).

### 2.2bis Primera ampliación del núcleo — MEDIDO (2026-07-22)

Checklist 2026-07-21/22, punto 6 ("Puerta 2" señalada en § 2.2): dos nodos nuevos, uno en cada
dirección que este documento ya reservaba sin nombrar.

| Nodo nuevo | x (km) | y (km) | Arista(s) | Minutos base |
|---|---|---|---|---|
| Los Pastos de la Deriva | +30 | −1 | Manaderos (12,5 km recta) | 165 |
| | | | Campamento Serhu (9,85 km recta) | 130 |
| El Filo de las Brasas | +16 | +31 | Restos de Maktor (12,1 km recta) | 160 |

Mismo método que § 1.1 (5 km/h, sinuosidad 1,1). Los Pastos quedan al este de Los Manaderos —
la dirección de "pastos de temporada" que § 2.2 reservaba para las migraciones estacionales de
Gargantúas/Corredores. El Filo queda al noreste de Los Restos de Maktor, hacia la "zona volcánica"
que § 2.2 también reservaba — primer punto del núcleo desde el que los volcanes "a lo lejos" de
`areas.md` se ven de cerca; territorio real asignado a la Salamandra de Escoria (antes sin
`homeLocationSlug`, solo avanzadilla ocasional).

El polígono del núcleo crece pero sigue siendo la MISMA región (Llanuras) — no es la reapertura de
Cristal Helado/Ciénaga (Puerta 1, sigue pausada). Sin recalcular aquí el % de la región completa
que representa el núcleo: dos nodos no cambian el orden de magnitud de § 2.2, y forzar una cifra
nueva sin más ampliaciones sería falsa precisión.

### 2.3 "Estepa infinita" — reconciliado, no es conflicto

`areas.md` llama a las Llanuras "estepa infinita". 110 km no es infinito — pero no hace falta tocar la prosa: es **hipérbole de quien la cruza a pie**, y el propio terreno la justifica. En llanura rasa el horizonte de una persona está a ~5 km; sin más referencia vertical que los Pilares Rotos, cada día de marcha ofrece el mismo círculo de tierra rojiza idéntica. Una travesía de la región entera son 2–3 jornadas viendo siempre lo mismo: para el caminante *es* infinita. La palabra describe una experiencia, no un dato — se queda como está.

---

## 3. Las 5 regiones de Berig, en proporción — MEDIDO (2026-07-22, mapa real de Azgaar)

Orden de magnitud relativo, respetando la disposición N–S ya fijada (`InteractiveMap.tsx`): Cristal Helado al norte, Llanuras y Ciénaga en la franja central, el Margen como cinturón, la Meseta al sur.

**Superseded 2026-07-22**: la usuaria recreó el continente de verdad en Azgaar
(`docs/map/Helek_World.map`) — ya no hace falta estimar, se puede medir directamente sobre los
paths de estado reales del propio archivo (escala 1 unidad del lienzo ≈ 1 km, confirmada por la
barra de escala nativa de Azgaar: 202 unidades ≈ 200 km). Lo que sigue son las dimensiones del
**rectángulo envolvente** de cada estado (`state17`–`state21` en el `.map`) — el máximo N-S/E-O
que ocupa, no el área real de la silueta irregular (que es menor, sobre todo en El Margen
Silencioso, cuya forma real es una franja serpenteante, no un bloque rectangular).

| Región | Dimensión MEDIDA (rectángulo envolvente) | Dimensión ESTIMADO previa (2026-07-18) | Nota |
|---|---|---|---|
| **Cristal Helado** | ~205 × 120 km | ~150 × 110 km | La estimación original se quedó corta en anchura E-O; el resto del razonamiento (zona habitada Helsig ≈2% de la región) se mantiene sin cambios, solo referido ahora a un envolvente algo mayor. |
| **Ciénaga Troncal** | ~160 × 178 km | ~110 × 85 km | Bastante más alta (N-S) de lo estimado — el terreno cenagal se extiende más hacia el sur de lo previsto. |
| **Las Llanuras del Viento Rojo** | ~126 × 249 km | ~110 × 70 km | Mucho más alargada N-S de lo estimado en § 2.2 — el núcleo jugable (§ 2.1, MEDIDO desde el grafo, sin cambios) sigue siendo solo una fracción pequeña de la región completa, ahora una fracción todavía menor de lo que § 2.2 asumía. |
| **La Meseta del Orden** | ~221 × 167 km | ~100 × 80 km | Bastante mayor en ambos ejes — coherente con ser "la civilización más poblada", ahora con más espacio real para las ciudades-fortaleza Goirntes. |
| **El Margen Silencioso** | ~215 × 103 km | ~260 × 35–50 km | Más ancho (N-S) y menos alargado (E-O) de lo estimado — sigue leyéndose como cinturón/franja en el mapa real, pero menos "delgado" de lo que se había imaginado. |

Las regiones estimadas el 2026-07-18 acertaron el orden de magnitud relativo entre ellas (Cristal
Helado y Meseta como las mayores, Llanuras entre las medianas) aunque no los valores absolutos —
razonable para una estimación cualitativa sin mapa de referencia. El resto del continente (§ 4)
son costas, piedemontes y transiciones sin región nombrada — espacio deliberado para futuras
ampliaciones sin retocar nada de esto.

**El camino Meseta ↔ Cruce de las Cenizas — decidido:** el camino de la Concordia **bordea** el Margen Silencioso por un corredor costero occidental en vez de atravesar el laberinto (confirmado por la usuaria, 2026-07-18). El cinturón se adelgaza hacia esa costa oeste, y el camino lo bordea por ahí — lo que explica de paso que las patrullas de la Concordia lleguen en columna y por una sola puerta: el Cruce. Distancia resultante borde de la Meseta → Cruce de las Cenizas: **~80 km de ruta, 2–3 jornadas** — coherente con que salir de la región sea banda "larga" (>24 h) y quede fuera del grafo v1, exactamente como docs/12 § 1.3 ya establece.

Coherencia de vínculo existente: Gorhorn trabajó de joven en las minas Helsig — borde norte de las Llanuras → franja habitada de Cristal Helado sale a ~120–170 km de ruta, **4–6 jornadas**. Un viaje serio pero normal para un orco joven buscando trabajo: encaja.

---

## 4. Berig, el continente — MEDIDO (2026-07-22, mapa real de Azgaar)

**Superseded 2026-07-22**: ya no hace falta apilar las 5 regiones a mano — el rectángulo
envolvente de las 5 juntas, medido directamente sobre el `.map` real, es **~250 km (E-O) × ~470 km
(N-S)**. Más estrecho y bastante más alargado N-S de lo que la extrapolación de 2026-07-18 había
supuesto (~300×400), pero del mismo orden de magnitud de superficie total.

**Berig ≈ 250 × 470 km ≈ 100.000–115.000 km² — sigue del orden de Portugal o Islandia.**

La comparación con Islandia es la buena para el tono: ~100.000 km² con población total de quizá 8.000–10.000 almas (Goirntes + 4 clanes orcos + Nabieus + Faerus) → **~0,1 hab/km²**. ¿Choca "continente del tamaño de Portugal" con "mundo pequeño e íntimo"? No, y el propio canon da la razón: la nota de escala de `personajes.md` dice que las poblaciones quedaron "**reducidas a mínimos históricos**" tras la Guerra de la Isla Cambiante. El continente no está dimensionado para los 6.000 de hoy — está dimensionado para los imperios que hubo (el Yugo de Hierro, la Purga Silenciosa exigen espacio histórico). Berig es un continente **a medio vaciar**: la intimidad no viene de que el mapa sea diminuto, sino de que casi todo él está en silencio. Eso es exactamente lo que el juego ya narra (los Restos de Maktor, regiones enteras inexploradas).

---

## 5. Vaelira — ESTIMADO, sin datos duros (extrapolación explícita)

No existe ni un solo tiempo de viaje medido en Vaelira: **todo lo que sigue es estimación cualitativa** y debe leerse como tal.

- Es el continente "antiguo, de relieve suave" frente al Berig "joven y violento": geológicamente, lo erosionado y estable suele ser más extenso y bajo que lo joven y montañoso.
- Tiene 3 regiones nombradas (Cicatriz de Cristal, Susurro de las Raíces, Costa del Azabache) frente a 5 de Berig, pero sus tres razas asentadas (Kelife, Jusaly, Kalisar) + Ilvenar errantes sostuvieron la primera gran civilización y una "Edad Dorada" de expansión — no es menor que Berig en peso histórico.

Propuesta: **Vaelira ≈ 1,0–1,25 × Berig ≈ 100.000–125.000 km²**, más ancha que alta (relieve suave = regiones extensas en horizontal), con la Costa del Azabache como fachada al estrecho (acantilados negros batidos por "oleaje furioso" — un mar de niebla agitado al lado encaja) y la Cicatriz de Cristal en el interior-centro. Sus 3 regiones serían proporcionalmente mayores que las de Berig (menos regiones repartiéndose un continente igual o mayor): del orden de 15.000–25.000 km² cada una, con enormes intersticios sin nombrar. Todo ello ESTIMADO y libre de cambiar el día que Vaelira entre en juego.

---

## 6. El estrecho, la disposición de los continentes y el planeta

**Disposición relativa — decidida:** Vaelira al **oeste**, Berig al **este** (confirmado por la usuaria, 2026-07-18), ambos dentro de la banda ecuatorial del planeta, separados por el estrecho de niebla con eje aproximado N–S. Lo que sí está anclado en el lore:

- **El estrecho** — canon: mar "estrecho", permanentemente cubierto de niebla, incruzable sin cristal Kelife o brújulas de vacío Nabieus; contuvo la Isla Cambiante y una guerra por ella. Propuesta: **~120–180 km en su punto más angosto**, abriéndose hacia el norte y el sur. La justificación de ambos extremos: lo bastante estrecho para que dos continentes se disputaran una isla en medio y se acusen mutuamente de sabotaje (hay tráfico, con la tecnología adecuada), lo bastante ancho para que "nadie lo ha explorado por completo" sea creíble incluso sin la niebla. Lo que impide cruzarlo es la niebla, no la distancia — 150 km de mar se cruzan en días de vela; con la niebla, no se cruzan nunca sin ayuda.
- **La Isla Cambiante** ya no está (historia.md, el Detonante) — el mapa presente no debe dibujarla; el mapa histórico sí podría, "en algún punto del estrecho", deliberadamente sin fijar.
- **Las tierras nuevas del norte** — tras el Detonante apareció "en el norte de **cada** continente una extensión de tierra nueva adherida al territorio", oculta tras el muro de obsidiana. **Sin dimensionar a propósito**: el canon las oculta (en Berig, además, queda detrás de lo inexplorado de Cristal Helado). Cualquier número aquí sería inventar lo que la historia quiere mantener en sombra. Para el mapa: un borde septentrional cortado por el muro, sin costa norte visible.
- **Cristal Helado en banda ecuatorial** — reconciliado: hielo permanente cerca del ecuador exige **altitud**, y el canon ya la da ("altas montañas"). Para la imagen: cumbres de 3.500 m o más, nieve por altura, no por latitud. Sin conflicto.
- **El planeta** — canon: 80% océano, todo lo demás inexplorado. **El radio del planeta queda sin fijar, deliberadamente.** Los ~200.000–235.000 km² de tierra conocida son compatibles con cualquier tamaño de planeta; fijar una circunferencia solo crearía deuda de consistencia sin comprar nada (nadie va a circunnavegar). Regla editorial: ninguna prosa futura debe citar el tamaño total del planeta. La frase final de historia.md ("quizá Helek Sirik es mucho más grande de lo que nadie ha imaginado") pide exactamente esta apertura.

---

## 7. Tabla resumen de referencia rápida

| Zona | Dimensión aprox. | Superficie aprox. | Fuente |
|---|---|---|---|
| Núcleo jugable Llanuras (grafo v1) | 45 × 30 km | ~1.200–1.400 km² | **MEDIDO** (grafo docs/12 § 1.3, 5 km/h, sinuosidad 1,1) |
| Coordenadas de los 6 nodos | tabla § 1.1 | — | **MEDIDO** (distancias) / EXTRAPOLADO (orientación N) |
| Llanuras del Viento Rojo (completa) | ~126 × 249 km (envolvente) | **~19.900 km²** (área real del polígono, fórmula shoelace) | **MEDIDO** (mapa real de Azgaar, 2026-07-22) |
| Meseta del Orden (rectángulo envolvente) | ~221 × 167 km | — (envolvente, no área real) | **MEDIDO** (mapa real de Azgaar, 2026-07-22) |
| Cristal Helado (rectángulo envolvente) | ~205 × 120 km | — (envolvente, no área real; habitado: ~300 km² ESTIMADO) | **MEDIDO** (mapa real de Azgaar, 2026-07-22) |
| Ciénaga Troncal (rectángulo envolvente) | ~160 × 178 km | — (envolvente, no área real; habitable: ~150–250 km² ESTIMADO) | **MEDIDO** (mapa real de Azgaar, 2026-07-22) |
| El Margen Silencioso (rectángulo envolvente) | ~215 × 103 km | — (envolvente, no área real) | **MEDIDO** (mapa real de Azgaar, 2026-07-22), cinturón |
| Camino Meseta ↔ Cruce de las Cenizas | ~80 km de ruta (2–3 jornadas) | — | EXTRAPOLADO |
| **Berig (continente)** | ~250 × 470 km | **~100.000–115.000 km²** (≈ Portugal/Islandia) | **MEDIDO** (rectángulo envolvente, mapa real de Azgaar, 2026-07-22) |
| **Vaelira (continente)** | más ancha que alta | **~100.000–125.000 km²** (1,0–1,25 × Berig) | ESTIMADO (sin ningún dato duro) |
| Estrecho de niebla | ~120–180 km en lo más angosto | — | ESTIMADO |
| Tierras nuevas del norte (×2) | sin dimensionar | sin dimensionar | canon las oculta — no estimar |
| Planeta | radio sin fijar (80% océano) | — | deliberadamente abierto — no citar nunca |

## 8. Conflictos y decisiones

**Reconciliados aquí (no requieren decisión):**
1. *"Estepa infinita" vs. ~110 km* — hipérbole experiencial del caminante, no dato (§ 2.3). La prosa se queda.
2. *"Continente" vs. mundo íntimo de 6.000 almas* — el canon ya lo resuelve: poblaciones en mínimos históricos tras la guerra; Berig es un continente a medio vaciar (§ 4).
3. *Hielo ecuatorial en Cristal Helado* — altitud, ya canónica ("altas montañas") (§ 6).
4. *"Nadie ha cruzado el estrecho" vs. guerra por la isla* — el propio canon exceptúa cristal Kelife y brújulas Nabieus; la barrera es la niebla, no los km (§ 6).

**Decididas por la usuaria (2026-07-18):**
1. **Corredor occidental del Margen** (§ 3): confirmado — el camino Meseta → Cruce de las Cenizas bordea el cinturón del Margen Silencioso por la costa oeste; no lo atraviesa.
2. **Vaelira al oeste, Berig al este** (§ 6): confirmado.

**Superseded, no conflicto (2026-07-22):** los tamaños ESTIMADO de las 5 regiones y de Berig (§ 3,
§ 4, ambos de 2026-07-18) quedan reemplazados por las dimensiones MEDIDAS sobre el mapa real que
la usuaria recreó en Azgaar (`docs/map/Helek_World.map`). No es una contradicción a resolver: eran
estimaciones cualitativas sin mapa de referencia, y acertaron el orden de magnitud relativo entre
regiones aunque no los valores exactos — exactamente la función que debían cumplir hasta que algo
las midiera. El núcleo jugable de Llanuras (§ 2.1) y sus coordenadas (§ 1.1) siguen intactos y
siendo MEDIDO por su propia vía (el grafo de docs/12), sin relación con esta actualización.

---

*Ninguna cifra de este documento entra en prompts ni en el motor: los `minutosBase` de docs/12 siguen siendo la única verdad mecánica. Si algún día un tiempo de viaje cambia, cambia allí — y esta capa se recalcula desde § 1, nunca al revés.*
