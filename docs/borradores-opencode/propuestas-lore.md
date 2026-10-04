# Propuestas de lore (OpenCode)

Registro de propuestas generadas por el agente `lore` de OpenCode (modelo local, Ollama).
Organizado por categoría; dentro de cada categoría, orden cronológico (más reciente al final).
Las propuestas ya revisadas salen de aquí: las aprobadas van a `propuestas-aprobadas.md` y las
descartadas, a `revision-lore.md`.
**Nunca se elimina contenido existente al añadir una entrada nueva** — solo se añade.

Formato de cada entrada:
[FECHA] — [tema tratado]
Estado: SIN REVISAR | APROBADA (...) | RECHAZADA (...)

[la propuesta completa, con el razonamiento, no solo la conclusión]

Archivos que tocaría si se aprueba: [lista de rutas en docs/rpgtarkor/]

Para revisar y trasladar una propuesta aprobada a `docs/rpgtarkor/`, sigue el proceso de
[docs/runbooks/ampliar-lore.md](../runbooks/ampliar-lore.md) (leer primero lo existente, detectar
contradicciones, verificar cronología, actualizar todos los .md afectados, registrar en el
checklist).

---


## Categoría: Facciones y diplomacia

2026-10-04 — Nombres de las facciones nacidas de una escisión (CR-11, hito 0.2)
Estado: SIN REVISAR

Origen: entrevista de diseño de CR-11 con la usuaria (decisiones Q9, Q12 y Q13). Cuando una
facción pierde a su líder y queda con cohesión media, el motor la parte en dos (escisión). La nueva
facción necesita un nombre con peso en el lore, no una etiqueta genérica. Se siguen las reglas que
cada pueblo ya usa para nombrarse (ver `lore-mundo/clanes-orcos.md`, `lore-mundo/lenguas-helek.md`,
`lore-mundo/razas.md`):

- **Orcos** — el clan toma el nombre de quien encabeza la escisión sin su vocal final y con la
  terminación de los dos clanes emigrados: Helsa → Hels**ig**, Gosha → Gos**hg**. *Varka* → Clan
  **Varkig**; si ya existe, Clan **Varkg**. (Corregido el mismo día: el primer borrador decía
  «Varkag», que no seguía el patrón.)
- **Nabieus** — **Keseg** + una palabra de su diccionario, nunca repetida (sus clanes son «el fin
  de algo»): Keseg **Tannis** (el fin de la mentira), Keseg **Karo** (el fin de la carta),
  Keseg **Tovh** (el fin de la mano abierta), Keseg **Vhurne** (el fin de la reunión).
- **Faerus** — **Feg** + una palabra concreta suya (como Feg Ger, «manada roja»): Feg **Sil**
  (manada del fuego), Feg **Kegi** (manada de la arena), Feg **Krul** (manada del colmillo),
  Feg **Nur** (manada de los heridos).
- Cada nombre lleva su traducción en la descripción de la facción.

**Pregunta abierta (Q13):** ¿cómo se nombraría una escisión **goirnte**? Para un goirnte no hay más
Imperio que el suyo (`Ord`, sin apellido); una escisión sería una ruptura con el Imperio. Mientras
no se decida, el motor no escinde la Concordia (solo puede caer o sostenerse).

El motor usa esta tabla como provisional (`backend/src/services/cronista/nombresFaccion.ts`) hasta
que se valide o se cambie.

Archivos que tocaría si se aprueba: `docs/rpgtarkor/lore-mundo/lenguas-helek.md` (las palabras
nuevas como nombres de clan), `docs/rpgtarkor/lore-mundo/clanes-orcos.md` (regla de nombre de los
clanes escindidos).

---

## Categoría: Razas y cultura

---

## Categoría: Idiomas

---

## Categoría: Construcciones y reino

2026-09-29 — Población y reproducción del Reino (F9-7, "sistema al estilo Medieval Dynasty")
Estado: SIN REVISAR

Qué se propone: que los súbditos del Reino no salgan solo de capturar compañeros, sino de un ciclo
de población con llegada, pareja, crías que crecen, vejez y muerte. Piezas:

1. **Llegada de pobladores.** Una vez por semana de ficción, si el Reino tiene vivienda libre, comida
   y agua en reserva y una felicidad mínima, llega un candidato de la población NEUTRA de la región
   (`WorldPopulation` de tipo RAZA, § 4.6 de `expediciones-poblacion.md`: el "pool" de fondo del que
   ya se dijo que podían salir facciones nuevas). Se descuenta del pool: el continente tiene
   8.000-10.000 almas y cada una cuenta. El jugador lo acepta o lo rechaza desde una tarjeta, como en
   Medieval Dynasty. Aceptado, es un súbdito más (`Companion` con `rolReino`, el camino ya hecho).
2. **Vivienda como límite.** Cada edificio de vivienda da plazas; sin plaza no llega nadie y una
   pareja no tiene crías. Es el mismo freno de Medieval Dynasty y encaja con los huecos de parcela.
3. **Parejas y crías.** Dos súbditos adultos de la misma raza, con vivienda y la felicidad alta,
   pueden formar pareja; cada año de ficción tienen una probabilidad de cría. Solo misma raza:
   el lore ya marca que los pueblos no se mezclan (A-03: Goshg y Prisilke "no se casan entre sí").
4. **Crecer y envejecer.** La cría no trabaja hasta adulta. Canon: los orcos son adultos a los 10 y
   viven 40-50 años. Con la vejez llega la muerte natural; también mueren de hambre, sed o combate.
5. **Salidas.** Con la felicidad muy baja, un súbdito puede irse y vuelve al pool de su raza.

Por qué: Álvaro pidió un sistema de reproducción al estilo Medieval Dynasty para que el Reino tenga
súbditos (F9-7). Reutiliza lo que ya existe (pool de RAZA, `Companion.rolReino`, `KingdomStats`,
felicidad) en vez de un sistema paralelo, y cumple "cada muerte cuenta": nadie aparece de la nada.

Lo que el lore NO fija y hay que decidir:
- Edad adulta y esperanza de vida de Goirntes, Nabieus y Faerus (solo están las de los orcos).
- ~~Escala de tiempo~~ **Decidido por Álvaro (2026-09-29): sin comprimir**, a tiempo real de
  juego. Una cría tarda lo que diga su raza en años de ficción (10 para un orco).
- Si un súbdito de otra raza puede vivir en el Reino (hoy los compañeros capturados sí).

Archivos que tocaría si se aprueba: `docs/rpgtarkor/sistemas-reino/expediciones-poblacion.md`
(sección nueva de población del Reino), `docs/rpgtarkor/sistemas-reino/construcciones-reino.md`
(vivienda y plazas), `docs/rpgtarkor/lore-mundo/razas.md` (edades y vida por raza).

2026-09-29 — Economía de supervivencia de facción (almacén por edificios, agua, comida y Goirnos)
Estado: SIN REVISAR

Qué se propone (respuesta de Álvaro a la pregunta 14): que una facción, NPC o el Reino del jugador,
solo funcione si cubre sus necesidades, y que esas necesidades sean lo que la hace actuar.

1. **Almacén con tope por edificios.** El tope ya no es "5 por objeto": cada edificio de almacén
   (granero, cisterna, leñera…) suma capacidad a una categoría (comida, bebida, materiales); el
   Ayuntamiento o Salón da una base. Es el `AlmacenLimite` que ya pensaba
   `construcciones-reino.md`, generalizado a facciones.
2. **Agua obligatoria.** Hoy las facciones tienen la bebida "dada por cubierta". Pasa a ser real:
   hace falta un edificio o una fuente que la dé (pozos, cisternas; en las Llanuras, Los Manaderos
   y el Cauce son las fuentes naturales). Sin agua, la reserva baja cada día.
3. **Comida y producción activa.** El consumo diario por población ya existe
   (`tickKingdomOneDay`); se le suma que la producción depende de trabajadores reales asignados.
4. **Goirnos como sueldo.** Soldados y trabajadores cuestan Goirnos por semana; entran por mercado,
   comercio y tributo. Sin Goirnos, primero cae la felicidad y luego desertan.
5. **Cascada de declive.** Falta de agua o comida → baja la felicidad → baja la producción → muere o
   se va gente (vuelve al pool de su raza) → menos soldados → sus regiones quedan disputables →
   con población 0, la facción **se extingue** (permanente: cada muerte cuenta).
6. **El motor que decide.** La IA de facción del Trimestre 2 (decidir según la Inteligencia del
   líder) usa estas carencias como disparadores: sin agua construye o conquista una fuente; sin
   comida manda expediciones o caza; sin Goirnos comercia o saquea. Así el dinamismo sale de
   necesidades reales, no de tiradas al azar.

Por qué: Álvaro lo define como "la base que activa el dinamismo y automatismo de facción... si no,
no hacen y acaban muriendo". Unifica la economía del Reino y la de facción en un solo modelo.

Lo que hay que decidir (números): capacidad por edificio y categoría, agua por persona y día,
sueldo por soldado y trabajador, umbrales de deserción y de muerte, y si una facción extinta puede
refundarse desde el pool de su raza.

Archivos que tocaría si se aprueba: `docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md` (necesidades
como motor de la IA de facción), `docs/rpgtarkor/sistemas-reino/construcciones-reino.md`
(edificios de almacén y de agua), `docs/rpgtarkor/sistemas-reino/expediciones-poblacion.md`
(declive y extinción).

2026-09-29 — Ganadería: oficio de ganadero y corrales por especie (estilo Bellwright)
Estado: SIN REVISAR

Qué se propone (respuesta de Álvaro a la pregunta 28):

1. **Oficio `ganadero`** con sus variantes por raza y región, como el resto de oficios
   (`ganadero-orcos-llanuras`, …). El "Ganadero del Clan Serhu" (hoy sin oficio porque no existía)
   pasa a tenerlo. Distinto del domador: el domador doma monturas y compañeros; el ganadero cría
   animales para sacar recursos.
2. **Un corral por especie.** Edificio con plazas para animales de UNA especie, que cada día
   produce lo que esa especie da y consume forraje y agua. Si se sacrifica un animal, da su
   cadáver (cadena del desollador).
3. **Especies candidatas**, sacadas del catálogo real (fauna con `domesticablePct` > 0 e
   inofensiva o cautelosa):
   - **Murgol** (90 %, INOFENSIVO): lana de murgol a diario, carne al sacrificar. La cuajada de
     murgol ya es una receta de comida, así que cierra su cadena.
   - **Corretolvas** (40 %, INOFENSIVO): plumas rojizas y carne.
   - **Canizor** (45 %, CAUTELOSO): piel y carne.
   - **Cuernahoja** (20 %, CAUTELOSO): piel, cuerno y carne; más difícil.
   - **Excluido el Corredor de Cauce**, aunque sea domesticable al 55 %: moratoria del canon, es presa
     sagrada.
4. **Conseguir los animales**: capturar o domesticar en la zona (las acciones ya existen), y
   después reproducción dentro del corral hasta llenar las plazas (misma lógica de reproducción
   de la propuesta de población).

Por qué: da al Reino y a las facciones una fuente estable de recursos animales sin cazar, y le da
sentido al Ganadero del Clan Serhu. Encaja con la economía de supervivencia (el corral consume agua
y forraje y alimenta el almacén).

Lo que hay que decidir: nombre visible del oficio por raza y región, plazas por corral, producción
diaria por especie, y si los clanes ya tienen corrales en su lore (¿Karot Veku cría murgol?).

Archivos que tocaría si se aprueba: `docs/rpgtarkor/sistemas-reino/construcciones-reino.md`
(corrales), `docs/rpgtarkor/items-y-catalogo/` (oficio ganadero y productos),
`docs/rpgtarkor/lore-mundo/regiones/llanuras-del-viento-rojo.md` (si Karot Veku tiene corrales).

---

## Categoría: Historia y cronología

---

## Categoría: Lugares y geografía

---

## Categoría: Items

---

## Categoría: Fauna y flora

2026-09-28 — Choque de nombres "Bolco" (árbol) / "Bulco" (caracol de arena)
Estado: SIN REVISAR

Qué se propone: renombrar UNO de los dos para que no difieran en una sola letra. Opción preferida:
mantener **Bolco** (árbol de las Marismas, Veldrias — tiene más peso en el lore: su resina forma la
capa de las Marismas de Lodo Negro) y renombrar el **Bulco de Arena** (NADANTES, nivel 1,
INOFENSIVO, Playa de Ceniza Blanca) a un nombre que no empiece por "B-lco" (el nombre concreto lo
decide Álvaro; debe seguir la fonética de las Llanuras y no ser una especie real).

Por qué: en las pruebas en la nube (hallazgo B18 de
`docs/registros/pruebas-nube-2026-09-28-hallazgos.md`) el reconocimiento de nombres del motor
tolera erratas de una letra (Levenshtein ≤1 en alias cortos), así que "bolco" y "bulco" se
confundían entre sí al escribir texto libre; hoy se esquiva con una exclusión en código
(`NPC_ALIAS_FUZZY_EXCLUSIONS`). Para el jugador también son casi indistinguibles leídos en el log.
Renombrar el caracol toca menos lore que renombrar el árbol (el árbol aparece en región, flora y
geografía de la Ciénaga; el caracol solo en el catálogo de fauna de las Llanuras).

Archivos que tocaría si se aprueba: `docs/rpgtarkor/lore-mundo/flora-fauna.md`,
`docs/rpgtarkor/lore-mundo/regiones/llanuras-del-viento-rojo.md`,
`docs/rpgtarkor/items-y-catalogo/items.md` (y, fuera de lore, el slug `bulco-de-arena` del
catálogo en `backend/src/scripts/worldCatalog.ts` y la exclusión de alias en código).

---

## Categoría: Personajes y NPCs

2026-09-29 — Dessa Kaltrenn, Yerin Slaad y Riko pasan de pregenerados a NPC (Fase 8, alcance pre-alpha)
Estado: SIN REVISAR

Qué se propone: decidir qué papel y dónde viven HOY los tres, para poder darlos de alta como `Npc`
en `backend/src/scripts/worldCatalog.ts`. Decisión del 2026-09-01: solo Gorhorn es jugable; los tres
salen de la selección de personaje (ya hecho en código). Se han dejado FUERA del catálogo de NPC
porque el lore no fija lo que un NPC necesita (ubicación, papel actual, nivel, facción operativa) y
no se ha inventado nada. Lo que sí está fijado (`docs/rpgtarkor/personajes/personajes.md` §§ 2, 6, 7;
`razas.md`; `npcs.md`; `margen-silencioso.md`; `cronologia.md`) y sirve como base de la ficha:

- **Dessa Kaltrenn** (Goirnte, mujer): soldado rasa de la guardia menor de Berig, escoltó el sello la
  noche de la ruptura y desertó esa misma noche; las patrullas de la Concordia llevan su descripción
  como desertora. Personalidad, facultad (percibe el "orden") y voz están en `personajes.md` § 2.
  `npcs.md` la enlaza con Vrask Ombra, Kael Dorn y Yovenne Tal (los tres necesitan lo que ella vio).
- **Yerin Slaad** (Nabieus): mensajero de bajo rango; una semana antes de la ruptura entregó, sin
  saberlo, la carta con las instrucciones del sabotaje. Personalidad, facultades (silencio, leer
  mentiras en las pausas) y voz en `personajes.md` § 6; Sella Marn quiere comprar lo que recuerda
  (`npcs.md`); Keseg Sael lo ve como testigo potencial (`propuestas-aprobadas.md`).
- **Riko** (Faerus, "de la Manada Rota"): cazador de las fronteras de Berig; su manada se reunía en El
  Claro de la Manada (Margen Silencioso), arrasado por la magia salvaje tras El Detonante
  (~4.006-4.008); viaja buscando rastro de los suyos. Personalidad, facultades y voz en
  `personajes.md` § 7.

Lo que NO fija el lore y hay que decidir (el motivo de que no se hayan creado):
1. **Dónde están en el momento de arranque (año 4.010)**: los tres son "errantes" o fugitivos sin
   sitio fijo (Dessa huye de las patrullas; Yerin es un "cabo suelto"; Riko "viaja"). `Npc` pide, para
   ser útil, una ubicación (`homeLocationSlug`) o al menos una región/ruta. Propuesta abierta: Dessa
   en algún punto de la Meseta del Orden o su frontera con el Margen; Yerin en el Margen oriental
   (zona Nabieus) o cerca de Sella Marn; Riko entre el Margen occidental y los alrededores del Claro
   de la Manada. Son sugerencias, no canon: Álvaro decide.
2. **Papel actual como NPC** (`role`, `interactionTypes`: ¿NPC_LORE, NPC_MISION?, ¿reclutables?):
   los ganchos de aventura de `personajes.md` están escritos para un jugador que los encarna, no para
   un NPC que el jugador encuentra.
3. **Nivel, clase y facción** (`level`, `clase`, `faction`): el lore no fija ninguno. Solo hay el
   bloque de atributos de cada pregenerado (`personajes.md`, tabla de atributos) y la raza. Dessa
   desertó de la Concordia y no se sabe si sigue contando como facción Goirnte.
4. **Si Gorhorn puede encontrarlos y cuándo** (respetando la cronología: nada después de 4.010 y sin
   resolver lo reservado — p. ej. qué sabe Tarsen Vold del Detonante, y sin tocar el destino de la
   verdad del sabotaje que estos tres poseen a medias).

Por qué: el catálogo de NPC exige campos de diseño (ubicación, nivel, papel) que en el lore de estos
tres solo existen como material de personaje jugable. Inventarlos rompería la regla de coherencia
del mundo; dejarlos sin NPC pierde tres personajes con conexiones ya escritas (Vrask, Kael, Yovenne,
Sella, Keseg Sael). Aprobada la ficha, el alta en código es rápida (la plantilla es Kael Dorn o
Sella Marn en `worldCatalog.ts`; `aliases`: 'dessa kaltrenn'/'dessa', 'yerin slaad'/'yerin', 'riko'
— ojo: "riko" es corto, comprobar colisiones fuzzy como en el hallazgo B18 de Bolco/Bulco).

Archivos que tocaría si se aprueba: `docs/rpgtarkor/personajes/npcs.md` (añadir las tres fichas de
NPC con ubicación y papel actual), `docs/rpgtarkor/personajes/personajes.md` (nota de que ya no son
pregenerados jugables), `docs/rpgtarkor/lore-mundo/razas.md` (las menciones a "pregenerado Riko/
Yerin" en Nabieus y Faerus), `docs/canon-opencode/catalogo/facciones-npcs.md` (marcarlos como NPC) y,
fuera de lore, `backend/src/scripts/worldCatalog.ts`.

---

## Categoría: Otros
