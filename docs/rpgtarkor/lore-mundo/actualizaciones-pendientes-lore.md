# Actualizaciones pendientes de lore

Lista viva de huecos de lore y desajustes código↔lore. Origen: 2 auditorías paralelas de la sesión
2026-09-05 — (1) huecos de "QUÉ sin CÓMO/POR QUÉ" dentro del lore en sí, (2) coherencia entre
código/BD y los `.md` de `docs/rpgtarkor/`, en ambas direcciones. No incluye misterios narrativos
deliberados (la Entidad Desconocida, qué encontró Tarkor, el Sello de contención, etc.) — esos son
diseño, no huecos.

**Estado general al cierre de esta sesión (2026-09-05, noche)**: la mayoría de los desajustes de
ALTO impacto ya están **CERRADOS**. Quedan pendientes los de mayor envergadura (requieren decisiones
de diseño o trabajo de catálogo extenso) — ver checklist de estado al final.

---

## PARTE 1 — Huecos de lore ("QUÉ sin POR QUÉ/CÓMO")

### 1. La arena magnética — **CERRADO** (2026-09-06, ver `genesis.md` § "Por qué la arena de las Llanuras es magnética")
**Archivos**: `areas.md:62`, `:143`, `:162`, `:189`; `flora-fauna.md:56`, `:127-131`;
`clima-tormentas.md` entero.

El clima de la única región jugable (40 días/año de tormenta) gira alrededor de un fenómeno nunca
explicado: de dónde sale el metal, por qué la arena está imantada, por qué se comporta como limadura
fina en suspensión. Anclaje causal disponible y sin usar: `areas.md:189` (El Vientre del Engaño) ya
dice que el viento nació del castigo de las Semillas al Reino Nabierus (pueblo minero-excavador, con
metal en profundidad) — la conexión "el viento arrancó y pulverizó el metal del reino enterrado" está
a un párrafo y nadie la ha escrito.

Sub-huecos del mismo racimo:
- **Rocas que flotan** (`flora-fauna.md:129`, Imanio/Arena Imán): sin mecanismo de levitación.
- **La Hondonada del Eco** (`areas.md:143`, punto de ARRANQUE): el texto admite *"de manera
  misteriosa"* por qué las tormentas la esquivan.
- **La aurora de la Hondonada** (misma línea): ya se puede atar sola al cinturón de micro-cristales
  de "El cielo sin luna" (genesis.md, resuelto esta sesión) — solo falta escribirlo.
- **El Cardo Brújula** (`flora-fauna.md:52`): aguja imantada natural sin explicar cómo funciona en
  una zona que desorienta a todo lo demás.

**Recomendación pendiente**: sección tipo "El cielo sin luna" atada a Semillas (Liania = composición
del metal, Sezix/el castigo de Madre = el viento que lo pulverizó, Goirme como contraste irónico).
Cierra ~5 huecos de golpe. **No se aborda hoy porque requiere una decisión de mecanismo físico como
la que se tomó para la luna — mejor con la usuaria presente.**

### 2. El "don de comunión" de las Terk'ikar — **CERRADO** (2026-09-06, quitado del lore, no explicado)
**Archivos**: `flora-fauna.md:28`, `npcs.md:19` (Ulkha Ketg), `razas.md:50`, `clases.md:1238` (ya
marcado ahí como "hueco real sin cubrir hasta ahora").

Nunca se dice qué es: ¿magia, rito aprendido? ¿toda hembra orca o solo la Terk'ikar? ¿se hereda o se
enseña? Choca con `razas.md:52-60` (los orcos nunca canalizan magia sin tótem/runa) — ¿usa un foco?
Impacto directo: Ulkha Ketg (NPC con ficha completa) y el propio Gorhorn tienen una versión similar
sin definir. Requiere decidir el mecanismo antes de escribir — no abordado hoy.

### 3. El Margen Silencioso — **CERRADO** (2026-09-06, resuelto junto al #4)
El sonido se apaga sin eco ni rebote: el dominio de Kroj sobre el territorio, no un misterio sin
causa (`areas.md`, `razas.md`, remiten a `genesis.md § "El dominio de Kroj"`).

### 4. Kroj — **CERRADO** (2026-09-06, ver genesis.md § "El dominio de Kroj")
Nuevo mecanismo unificado: Kroj gobierna la ausencia de señal que escapa de un cuerpo (luz y sonido
son la misma clase de fenómeno para ella). Resuelve de un tirón: piel Nabieus (atrapa la luz, no la
refleja ni la absorbe como calor), Margen Silencioso (mismo principio a escala de territorio) y
Sombras de Kroj (acumulan sonido ajeno y lo devuelven distorsionado, no lo imitan). Además, ampliado
a petición de la usuaria para darle un papel más activo en la Formación: co-partícipe (no autora) de
flora y fauna nocturnas allí donde su dominio cruzó la obra de Florial y Ferios — mismo patrón que
Goirme sobre la Meseta del Orden. Atado retroactivamente a fichas ya existentes sin inventar
criaturas nuevas: Rondador de Brasas, Nuente y Miruina, además de las propias Sombras de Kroj
(`flora-fauna.md`).

### 4bis. Las 13 Semillas — **CERRADO** (2026-09-06, ronda completa de ampliación)
A petición de la usuaria, se dio a las 9 Semillas restantes (fuera de las 4 Perdidas, ya
desarrolladas) el mismo tratamiento que a Kroj: participación activa en la Formación, no solo un
dominio abstracto de tabla. Todo en `genesis.md`, con referencias cruzadas desde `areas.md`,
`razas.md` y `flora-fauna.md` donde aplica:
- **Liania** — "de la fantasía a la ciencia": es quien convierte la intención de cualquier otra
  Semilla en mecanismo físico real y consistente (el cristal del cielo sin luna, el metal de la
  arena magnética, la piel Nabieus). Principio que retroactivamente explica el estilo de todo lo
  cerrado en esta sesión y la anterior.
- **Sezix** — dominio unificado (el límite entre algo y su ausencia: muerte y vacío como una sola
  idea); mecanismo de la Niebla del Estrecho (borra el límite entre "algo" y "nada"); fauna marcada
  por su firma sin ser carroñera (el Quio, que no caza ni compite — disuelve); explica por fin por
  qué los Kalisar son afables pese a su origen: Sezix admira la vida precisamente por vivir tan
  cerca de su fin.
- **Tharlia y Berd** — diferenciados con precisión (antes se solapaban): Tharlia es memoria cruda sin
  filtrar, autora también de la inteligencia/memoria/sueños de los seres pensantes; Berd no archiva
  hechos, los interpreta y produce la doctrina oficial de qué es "correcto". El registro compartido
  de Tharlia recibe nombre propio: **Ladusa Tabia** ("Conocimiento Eterno"). Introduce el segundo
  registro secreto de Tharlia (los hechos sin los borrados de Madre) — pieza que **resuelve el
  mecanismo** (no el contenido) de qué encontró Tarkor en su desaparición: la nota de cabecera de
  este documento sobre "misterios deliberados" queda desactualizada en ese punto concreto, ver el
  arco de Tarkor reescrito en `genesis.md`.
- **Goirme** — revelación mayor: su poder real no es "orden" sino control del tiempo sobre materia y
  conciencia (puede rebobinar cualquier cosa a un estado anterior, incluida la memoria), algo que ni
  ella misma reconoce como tal — cree sinceramente estar "restaurando el orden". Es el instrumento
  con el que Madre borró de las demás Semillas el recuerdo de haber ejecutado el engaño contra el
  Reino Nabierus. Explica el autoritarismo Goirnte desde la raíz (juzga el mérito ajeno por si encaja
  en el patrón, no por su valor) y su conflicto de origen con Tarkor.
- **Lerox** — deja de ser "la que no participó": es quien más veces intervino, analizando el patrón
  de cada error ajeno y corrigiendo el concepto de partida del siguiente intento (nunca lo ya hecho —
  diferenciado explícitamente del poder de Goirme, que sí deshace lo existente). En secreto, siente
  fascinación por el error y el caos que corrige, y archiva cada resultado fallido sin decírselo a
  nadie — gancho narrativo plantado para un continente futuro, fuera del roadmap actual.
- **Florial y Ferios** — historia de origen real de su alianza (Ferios prueba una hoja de la flora de
  Florial, inventa el concepto de herbívoro, reconciliación tras el enfado inicial de Florial).
  Explica el desequilibrio flora/fauna ya existente en el catálogo (el triple de flora que de fauna:
  Florial se refugió en su obra tras la caída de Tarkor). Ambas fueron testigos tempranos de las
  discrepancias del Ladusa Tabia, antes que nadie más.

### 5. "Magia ambiental" — **PENDIENTE** (vocabulario central de la clase Chamán)
`razas.md:56-57`, `clases.md` (Chamán). ¿Es la magia salvaje del Estallido dispersa en el terreno?
¿se agota? ¿por qué el tótem hace de puente? Relacionado: `flora-fauna.md:13` (Flor de Esquirla,
yacimientos que "absorbieron magia salvaje") ya sugiere la base sin que nadie una los conceptos.
Máxima frecuencia de aparición — el narrador lo describe cada vez que Gorhorn usa una habilidad de
Chamán. No abordado hoy.

### 5. "Magia ambiental" — **CERRADO** (2026-09-06, ver razas.md § "Los orcos y la Magia" y clases.md § Chamán)
Mecanismo completo: Tarkor selló en los orcos el canalizador de magia en crudo que toda raza tiene de
serie —no la magia interior en sí, que sigue siendo la más fuerte de Helek Sirik por nacer sin
Semilla creadora—, inspirado en el respeto de Ferios por la libertad de su propia creación (mismo
motivo que su alejamiento de las Semillas fieles, ver `genesis.md § "Florial y Ferios"`). Los orcos
encontraron un canalizador sustituto: piedras (runas) y madera/hueso (tótems) que absorbieron la
misma magia salvaje del Estallido — solo ellos entran en comunión con esos materiales. Los tótems
encierran a los **Hyanios** ("Ancestros"), representación cultural orca de cada elemento, sin
voluntad propia (magia elemental almacenada, no espíritus). La Flor de Esquirla (`flora-fauna.md:13`)
queda conectada como el mismo fenómeno sin trabajar ni encauzar.

### 6. Hielo Sílice — **CERRADO** (2026-09-06, reclasificado en flora-fauna.md)
No era un hueco de mecanismo, era un error de clasificación: es un mineral, listado por error bajo
"Flora:" del bloque Berig. Movido a una categoría "Minerales:" propia, junto a Hierba del Hierro y
Trepadores Ocaso (que sí son flora real).

### 7. Hierba del Hierro — **CERRADO** (2026-09-06, ver flora-fauna.md)
Mecanismo con Liania: no crea metal, bioacumula el mineral ya disperso en la piedra gris de la
Meseta del Orden en sus propios tejidos, mismo principio de "convertir la fantasía en ciencia" que el
resto de la sesión — solo que aplicado a una planta en vez de a un fenómeno geológico o climático.

### 8. Piel Kelife que cambia con la emoción — **CERRADO** (2026-09-06, ver razas.md § Kelife)
Mecanismo con Liania: no es telepatía ni magia — el cristal, de estructura extremadamente fina y
regular (misma autoría que el cristal del cielo sin luna), amplifica en refracción visible
micro-cambios corporales reales (temperatura de piel, tensión muscular, pulso). Las facetas/vetas que
gana con los años son microfracturas reales de envejecimiento del propio mineral.

### 9. Brújulas de vacío Nabieus — **CERRADO** (2026-09-06, ver areas.md § "La Niebla del Estrecho")
No son magnéticas: miden el gradiente materia/vacío que Sezix borra dentro de la niebla, orientándose
hacia donde ese gradiente vuelve a ser nítido (tierra firme). Solo los Nabieus tienen la sensibilidad
artesanal para tallarlas. El origen concreto de la que lleva Brann el Cambista sigue deliberadamente
sin explicar (ni él mismo lo cuenta) — no es un hueco, es su propio misterio de personaje.

### 10. Resina de Trepadores Ocaso — **CERRADO** (2026-09-06, ver areas.md § Clan Goshg)
No era un hueco de mecanismo cósmico, solo una frase mal cerrada: "sella y conserva" ahora dice
explícitamente qué conserva (la madera, impermeabilizándola contra la humedad estancada de la
ciénaga) — barniz natural corriente, sin necesitar ninguna Semilla.

### 11. Los Pilares Rotos sin origen — **CERRADO** (2026-09-06, ver areas.md § "Los Pilares Rotos")
Son restos del Reino Nabierus, demasiado grandes para que el engaño de Madre los derribara del todo —
el nombre "Rotos" describe lo que sobrevivió de algo mayor, no su forma. Estandartes y puentes
colgantes son obra orca posterior, adaptada sobre lo ya en pie.

### 12. Imanio — **CERRADO por herencia** (verificado 2026-09-06, no requirió trabajo nuevo)
Dependía del #1 (arena magnética), ya cerrado desde el inicio de esta sesión: el mecanismo de
`genesis.md` (polaridad opuesta, mismo principio que dos imanes iguales repeliéndose) ya cubre por
qué el Imanio puede recolectar rocas flotantes como armadura sin necesitar nada adicional.

### 13. Árboles de Hebra Dorada — **CERRADO** (2026-09-06, ver flora-fauna.md § Vaelira)
Mecanosíntesis en vez de fotosíntesis (no necesitan luz, viven bajo dosel denso): convierten
vibración de la tierra en energía química, mismo principio que organismos reales sin luz. Raíces
filtran agua por el mismo mecanismo de bioacumulación que la Hierba del Hierro (limpiando en vez de
concentrar metal). La savia curativa es subproducto directo del proceso, no un don aparte.

### 14. Acechadores de la Bruma ("cazan por miedo") — **CERRADO** (2026-09-06, ver flora-fauna.md § Vaelira)
Calor y miedo son una sola cadena: detectan el calor corporal real de una presa asustada y liberan un
gas alucinógeno propio que sobrecarga su sistema sensorial, amplificando el miedo hasta el pánico —
más fácil de cazar así. Pelaje semitranslúcido y ojos blancos: efecto colateral de su propia
resistencia al gas.

**Bloque 6-17 completo.** Los descartados como misterio deliberado (Isla Cambiante, Sello de
contención, Tundra Negra Refleja, Pico Ocaso Negro) siguen descartados a propósito, no son huecos.

---

## PARTE 2 — Coherencia código/BD ↔ lore (auditoría del agente 1, 2026-09-05)

### Dirección A — existe en código, falta en el lore .md

| # | Hallazgo | Estado |
|---|---|---|
| A1 | Taxonomía completa de fauna/flora (13 categorías de fauna + 13 de flora = 26 en total, no 26 de cada — corregido; `GUELISES`, `CORVENES`, `VELDRIAS`, etc.) con reparto cosmológico por Semilla, invisible en el lore. Máximo impacto — base de habilidades de cada animal. | **CERRADO** (2026-09-06) — decisión: sí es canon narrativo (un cazador/herborista experto la reconocería en la ficción). Sección nueva completa en `flora-fauna.md § "Las 26 familias"`, con las 13+13 familias traducidas a prosa, organizadas por Semilla creadora y enlazadas a los dominios ya desarrollados hoy en `genesis.md` (Ferios/Florial/Goirme/Kroj/Tarkor). Sin tocar código — puro sabor narrativo, confirmado en el propio comentario fuente. |
| A2 | Interior de Karot Veku / Ketg'lukar, nodo jugable real (`campamento-serhu-interior` en `worldCatalog.ts`) sin mención en `areas.md` — corregido: no son "4 construcciones" como Location propia, es 1 sola Location de interior con los talleres de oficio ubicados en el mapa de Zona (ZonePoint), no en el grafo de viaje. | **CERRADO** (2026-09-06) — descripción ya existente en `worldCatalog.ts` traducida a prosa en `areas.md § Clan Serhu`, sin inventar nada nuevo. |
| A3 | Veta de hierro real en Los Pilares Rotos — el resumen de este documento decía "los Serhu no tienen metal propio", pero `areas.md` nunca afirmó eso (dice "herrería mediocre y mal orientada", compatible con tener metal malo). | **CERRADO** (2026-09-06) — aclarado en `areas.md § "Los Pilares Rotos"`: es el hierro corriente de toda la llanura, el peor de Helek Sirik, sin relación con las ruinas Nabierus del mismo lugar (cerradas hoy en el punto #11 de la Parte 1) — da un mínimo de equipamiento propio, explica la herrería mediocre sin contradecir nada. Ampliado con jerarquía real de acceso: Yerreo casi en exclusiva para altos rangos/casta Ketg (por el riesgo de conseguirlo); otros metales que los Serhu no saben trabajar se venden en crudo a la Concordia a cambio de equipo mejor, que termina igual concentrado en Kort'ikar/Terk'ikar — el metal como instrumento más del control interno de Ketg. |
| A4 | Nombres Kektira de estaciones/clima, se muestran en pantalla constantemente, ausentes del lore de idiomas. | **CERRADO** — chunk RAG nuevo añadido y reindexado (`loreChunks.ts`, "Kektira — nombres orcos de estaciones y tormentas") y las 8 palabras añadidas también a `areas.md` § Idiomas, en la entrada del propio Kektira. |
| A5 | "Origen Azul" (nombre del planeta) usado en la esquirla-celeste-caída como si fuera un fenómeno del cielo. | **CERRADO** — descripción reescrita en `worldCatalog.ts`, conecta con el cinturón de micro-cristales real. |
| A6 | Pico de minero en el inventario inicial de Gorhorn, ausente de su ficha canónica. | **CERRADO** — resuelto junto con B9 (ver abajo): `personajes.md` actualizado con el inventario real completo (pico + cataplasma incluidos). |
| A7 | 12 Maestros de oficio reales en catálogo, `areas.md` decía 11 (sin contar Pescador). | **CERRADO** — recuento y lista corregidos en `areas.md`. |
| A8 | Coordenadas de El Vergel de Kegi (y=-175) / La Grieta Cantora (y=-100) muy fuera del rango del resto del núcleo de Las Llanuras (~-42 a 54) — probable error de escala/tecleo. | **CERRADO, verificar en partida** (2026-09-06) — recalculadas en `worldCatalog.ts`: Grieta Cantora → y=-64 (da exactamente los "46 unidades reales" que su propio comentario de `locationLinks` ya afirmaba, coherente con `minutosBase: 320`); Vergel de Kegi → y=-60 (por proporción a su `minutosBase: 300`, sin cifra exacta documentada). La usuaria revisará ambas posiciones jugando en vivo y las ajustará si no encajan del todo. |
| A9 | La Espina del Viento no tiene `Npc` combatible — solo genera texto de riesgo. | **CERRADO** (2026-09-06) — no era un hueco, era una decisión de diseño ya tomada y documentada desde 2026-07-22 (`harvestSourcesThatAreFaunaWithoutNpc` en `worldCatalog.ts`: "peligro ambiental puro... sin ficha de combate ni Npc propio", deliberado). Confirmado con la usuaria: tampoco es "el mayor peligro" de la región como decía este mismo documento — es una fauna más. `flora-fauna.md` corregido: quitada la hipérbole, añadida la aclaración explícita de que es deliberadamente sin combate. |

### Dirección B — el lore lo establece, el código no lo respeta

| # | Hallazgo | Estado |
|---|---|---|
| B1 | `imagePromptContext.ts` instruía "iluminada por luna/estrellas" en prompts de imagen nocturna. | **CERRADO** — reescrito sin mención de luna, describe el cinturón de micro-cristales. Test actualizado. |
| B2 | El guard `hasWrongCelestialReference` solo rechazaba "luna" DE DÍA, dejándola pasar de noche (el caso más frecuente). | **CERRADO** — nuevo guard `hasFalseMoonReference` (narrador.ts) rechaza "luna/lunar" en CUALQUIER momento, salvo la expresión canónica "brillo de luna". Enganchado a la cascada de `narrateAction`. Tests nuevos + verificación rigurosa (revertido/confirmado que falla sin el fix). |
| B3 | `entorno.ts` describía la noche de las Llanuras "sin ninguna luz que las opaque" — justo lo contrario del cinturón real. | **CERRADO** — reescrito para mencionar el brillo perlado difuso. Test actualizado. |
| B4 | La pasiva racial orca "Sangre del Estallido" (TODOS los orcos, no solo Chamán) narraba magia despertando sola, sin tótem/runa — viola la regla dura de `razas.md`. | **CERRADO** — reescrita como efecto fisiológico latente ("herencia del Estallido... no es magia"), nunca canalización mágica. |
| B5 | Ningún guard de narrador.ts verifica NINGUNA regla de lore del corpus (magia sin foco, tabúes orcos, idioma nohade, etc.) — solo mecánica de combate/viaje. | **CERRADO** (2026-09-06) — familia de guards "vs. lore" en `narrador.ts`, mismo patrón que `hasFalseMoonReference`. Primera tanda (4): `hasMortalSpeakingNohade`, `hasOrcWorshippingTarkor`, `hasUnpunishedOrcTabooBreak`, `hasNonSerhuDenyingFuneralRite`. Segunda tanda tras auditoría de `loreChunks.ts`/guards (5 más): `hasRawOrcMagicWithoutFocus` (magia orca sin tótem/runa), `hasMercifulSigneran` (Signeran resuelto con clemencia), `hasUnpunishedIlvenarFalsify` (tabú Ilvenar de falsear registro), `hasUnpunishedFaerusAbandon` (tabú Faerus de abandonar herido), `hasNieblaCrossingWithoutTech` (cruzar la Niebla sin cristal Kelife/brújula Nabieus). **Verificado de verdad esta vez** (`tsc -b` limpio, `vitest run narrador.test.ts` 292/292 en verde) — a diferencia del cierre anterior de este mismo punto, esta vez sí se consiguió acceso a `node`/`nvm` en el entorno (vía la misma ruta que usa `actualizar-mundo.sh`). |
| B6 | `loreChunks.ts` (índice RAG del narrador) desfasado ~2 semanas: 8 zonas jugables y fauna reciente invisibles para el narrador. | **PARCIALMENTE CERRADO** — añadidos y reindexados 3 chunks nuevos (Zense Ceniza + Kirelon-arenoso en el chunk de fauna existente, Kektira, 4 puntos de interés nuevos + Pescador, El cielo sin luna). `npm run reindex-lore` corrido con éxito, confirmado en Postgres. **Sigue pendiente**: Ketg'lukar/interior del campamento, la taxonomía de fauna (A1, si se decide que es canon), la veta de hierro (A3), y cualquier otro contenido de zonas fuera de las Llanuras. |
| B7 | Población del Clan Serhu: 600 en código vs 800 en el lore (y el propio comentario del código decía 800). | **CERRADO** — corregido a 800 en `worldPopulation.ts`, comentario actualizado. |
| B8 | "Buitres Cenizos" (nombre obsoleto) vivía en 3 sitios pese al renombrado a "Zense Ceniza". | **CERRADO** — corregido en `worldCatalog.ts` (texto de riesgo + comentario de renombrado roto) y en `areas.md`/`flora-fauna.md`. El alias `worldCatalog.ts:7744` con el nombre viejo se mantiene intacto a propósito (permite que el jugador lo siga nombrando así). |
| B9 | La capa de piel de gargantúa de Gorhorn está en `personajes.md`/RAG pero no existe en su inventario real (`startingInventory.ts`). | **CERRADO** — decisión explícita de la usuaria: se quita la mención de la capa de `personajes.md` y `loreChunks.ts` (el inventario real de `startingInventory.ts` es la fuente de verdad); no se creó ningún ítem cosmético nuevo. De paso se completó la ficha con el pico de minero y la cataplasma, que sí existen y no estaban mencionados (A6). |
| B10 | "Pez luna" usado como comparación de forma en la bio del Toluh (código y `.md`) — "luna" no es válida en ningún texto de este mundo. | **CERRADO** — reescrito en ambos sitios sin la palabra. |
| B11 | `narrationLint.KNOWN_REGIONS` solo conocía las 5 regiones de Berig, nunca detectaría un salto narrativo a Vaelira. | **CERRADO** — añadidas las 3 regiones de Vaelira. |
| B12 | Ulkha Ketg Chamán/Rúnico vs. recomendación vieja de `clases.md` (Totémico). | **Descartado, no es desajuste real** — `clases.md` ya declara esa tabla vieja superada por una pasada posterior. Sin acción. |

## PARTE 3 — Ampliación de lore Helek (auditoría 2026-09-13)

Álvaro amplió a mano `worldCatalog.ts`/`lenguas-helek.md` con nombres nativos, interiores nuevos
para Helsig/Goshg/Keseg Prisilke, tropa/Maestros nuevos y rebalanceos. Auditoría de coherencia sobre
esos cambios — solo los bugs de datos objetivos, no las decisiones de contenido pendientes.

| # | Hallazgo | Estado |
|---|---|---|
| C1 | `Lukar`/`Sedsar` (`lenguas-helek.md`: Hogar/Salón) usados con sentidos invertidos entre clanes — el caso Serhu tenía el `FactionBuilding` del salón llamado `Ketg'lukar` (debía ser `Ketg'sedsar`), mientras Helsig/Goshg sí nacieron con `Xsedsar` para su salón. | **CERRADO** (2026-09-13) — confirmado con Álvaro: Lukar = recinto/Hogar entero (la Location interior), Sedsar = el edificio del salón dentro de él. Renombrado `ketg-lukar`→`ketg-sedsar` (`FactionBuilding`+`ZonePoint`+`loreChunks.ts`), y creados `helsig-sedsar`/`goshg-sedsar` (antes solo existían como Location, sin ningún edificio jugable real). |
| C2 | `campamento-helsig-interior`/`campamento-goshg-interior`: `region` copiada del bloque de Serhu sin actualizar (ambas decían "Las Llanuras del Viento Rojo"), y la descripción de Goshg-interior decía literalmente "Helske Tugh" (campamento de Helsig, no de Goshg). | **CERRADO** (2026-09-13) — región corregida a Cristal Helado/Ciénaga Troncal respectivamente; descripciones reescritas sin la copia-pega. |
| C3 | `conclave-keseg-prisilke-interior`/`campamento-feg-tusha-interior`: `kind: 'asentamiento'` en vez de `'interior'` (duplican su exterior como asentamiento propio del mapa de mundo). `campamento-feg-tusha-interior` además conservaba los alias huérfanos del slug viejo que sustituyó (`kegi`). | **CERRADO** (2026-09-13) — `kind` corregido a `'interior'` en ambos; alias de `campamento-feg-tusha-interior` actualizados a `['jakut tusha', 'trono madre']`. |
| C4 | Lienzo interior de Helsig sin sembrar del todo — los 6 Maestros de oficio ya tenían `homeLocationSlug: 'campamento-helsig-interior'`, pero no existía ningún `FactionBuilding`/`ZonePoint` real donde posicionarlos (invisibles en el mapa de Zona pese a tener ficha completa). | **CERRADO** (2026-09-13) — sembrados los 6 `FactionBuilding` de oficio (Herrería/Peletería/Cocina/Mina/Herboristería/Alquimia) + sus `ZonePoint`, mismo patrón que Karot Veku. Goshg se deja solo con el salón — ningún NPC del clan tiene `homeLocationSlug` ahí todavía. |
| C5 | Errata en `lenguas-helek.md`: `Veku` traducido como "Comillo" en vez de "Colmillo" (rompe la composición de "Karot Veku" = "Colmillo Ceniza", el nombre público ya usado en todo el lore). | **CERRADO** (2026-09-13). |
| C6 | Erratas de redacción en las descripciones nuevas de `jakut-ger-interior`/`campamento-feg-tusha-interior`/`marismas-lodo-negro` ("econtrar", "calaverás", "guerros", "espsesa", tildes faltantes). | **CERRADO** (2026-09-13) — corregidas en los 2 interiores; `marismas-lodo-negro` pendiente (no tocada en esta ronda, ver checklist). |
| C7 | `areas.md` documenta líderes del Clan Helsig (Terk'ikar Brenka / Kort'ikar Solgra) sin ficha `Npc` real en `worldCatalog.ts` — lore sin sustento mecánico, previo a esta ampliación. | **CERRADO** (2026-09-13) — fichas `Npc` reales creadas (`brenka`/`solgra`, `kind: PRINCIPAL`, protegidas), con `ZonePoint` en `campamento-helsig-interior` junto al salón. `areas.md` no necesitaba más cambios (la nota ya documentaba correctamente el hueco). |
| C8 | Diccionario `lenguas-helek.md`: Vaelira y sus 3 sub-lenguas (Kalisar/Jusaly/Ilvenar) 100% vacías (4 entradas `` - `` sin traducir); Faerus/Naebius sin nombre de lengua propio asignado; "Jeyselet" (interior nuevo de Keseg Prisilke) sin ningún morfema en el diccionario Naebius, y con doble grafía (resuelta el 2026-09-29: Álvaro fija **Jeyselt**). | **Abierto, contenido a completar** — fuera del alcance de esta ronda (fixes de datos objetivos), pendiente de una pasada de redacción dedicada. |
| C9 | 19 NPC nuevos con `bio: ''` vacía (tropa genérica Serhu, Ufag/Gisot Ketg, 5 de los 6 Maestros Helsig) y `personality` clonada casi literal entre los 6 Maestros Helsig; 8 regiones nuevas de Ciénaga Troncal con `description: ''` vacía. | **PARCIALMENTE CERRADO** (2026-09-13) — completados de paso `bio`/`personality` de Tirag Susig (estaban vacíos/con erratas) al corregir su `kind` para C10. El resto (tropa genérica Serhu, Ufag/Gisot Ketg, 5 Maestros Helsig, 8 regiones de Ciénaga Troncal) sigue pendiente de la misma pasada de redacción dedicada que C8. |
| C10 | "Gogorath" y "Gisoki" (compañeros de fauna con nombre propio) mencionados solo en bio, sin ficha `Npc` propia — lore sin sustento mecánico. Corrección sobre el hallazgo original: Gogorath es compañero de **Ulkha Ketg** (Terk'ikar del Clan Serhu), no de Doshka — confundido en la redacción inicial de este hallazgo. Rebalanceo de nivel de Doshka (→24) y Torgash Ketg (→20) sin comentario de auditoría que documente el motivo. | **CERRADO** (2026-09-13) — fichas `Npc` reales creadas (`gogorath`/`gisoki`, `kind: PRINCIPAL`, protegidas, mismo shape que cualquier fila de fauna del catálogo). Campo nuevo `Npc.companionOfNpcSlug` (schema.prisma, migración `npc_companion_of_npc_slug`) vincula cada companion a su dueño — decisión de diseño de Álvaro: "se mueven como 1", así que el companion NUNCA tiene `ZonePoint` propio; el backend (`zona.ts`) lo cuelga del punto del dueño y el frontend (`ZonaPanel.tsx`) pinta un anillo punteado extra ("icono de grupo") que abre `ZoneGroupDetailModal.tsx` con el desglose de ambas entidades. `tirag-susig` corregido de `kind: PLANTILLA` a `PRINCIPAL` (personaje con nombre propio, bug objetivo) y sembrado con `ZonePoint` real (no tenía ninguno). 2 tests de integración nuevos contra Postgres real (`zonaCompanion.integration.test.ts`), verificación rigurosa (filtro desactivado, confirmado que el test lo detecta, restaurado). Rebalanceo de Doshka/Torgash Ketg sigue sin documentar — no tocado en esta pieza, fuera de su alcance. **Pendiente aparte, fuera de esta pieza**: que Gogorath/Gisoki luchen de verdad junto a su dueño en combate (piden forzar el motor de combate múltiple `CombatEncounter`, hoy usado solo por caza en grupo — el combate 1v1 normal contra NPC humanoide nunca lo toca); y el sistema genérico de "Grupo" (hasta 4 NPC que combaten juntos, ya existe como motor de combate múltiple) + "Grupo de Guerra" (agrupación de hasta 8 grupos, un raid — pieza de diseño nueva, nombre por decidir) que Álvaro planteó a mitad de esta ronda como el concepto más amplio en el que este caso concreto debería encajar. |
| C11 | `lenguas-helek.md`: `Tert'ikar` en el diccionario Kektira, contradiciendo el uso consistente de `Terk'ikar` en TODO el resto del catálogo (`areas.md`, `worldCatalog.ts`, incluidas las fichas de Ulkha Ketg, Brenka, Doshka). Detectado al revisar `git status` de cierre de esta ronda. | **CERRADO** (2026-09-14) — errata corregida, mismo criterio que C5 (errata de "Veku"). |

---

## Checklist de estado

- [x] Auditoría inicial de huecos de lore (2026-09-05).
- [x] Auditoría de coherencia código/BD ↔ MD (agente 1) — completa, reportó Dirección A y B.
- [x] Revisión y aplicación manual de los hallazgos de mayor impacto y menor complejidad del agente 1
      (B1, B2, B3, B4, B7, B8, B9, B10, B11, A4, A5, A6, A7) — todos verificados con `tsc -b` limpio
      y suite de tests en verde (backend 2117/2118 reales, frontend 206/206; único fallo real
      restante es el flake de Múrgol ya conocido de sesiones anteriores, sin relación).
- [x] Reindexado real de `loreChunks.ts` (`npm run reindex-lore`) tras los cambios — confirmado en
      Postgres.
- [x] **Ronda punto-por-punto completa (2026-09-06)** — Parte 1 (14/14 huecos de lore, incluida la
      ronda extra de las 13 Semillas pedida a mitad de sesión) y Parte 2 completas: Dirección A
      9/9 cerrados, Dirección B 11/12 cerrados + 1 descartado (B12, no era desajuste real). Único
      resto: B6 sigue **PARCIALMENTE CERRADO** (RAG de `loreChunks.ts` desfasado en contenido de
      zonas fuera de Las Llanuras, fuera del alcance de esta ronda).
- [x] **`npm run seed-catalog` + `npm run reindex-lore`** ejecutados con éxito (2026-09-06, vía
      `actualizar-mundo.sh`) — catálogo sembrado (cambio de clase de Ulkha Ketg, coordenadas
      corregidas de A8) y lore RAG reindexado: 4 chunks nuevos (arena magnética, "El dominio de
      Kroj", "Por qué los orcos son Chamanes y no Magos", "Las 26 familias de fauna y flora") + 4
      actualizados ("Las 13 Semillas", "El arco de Tarkor", flora/fauna de Berig) — de 59 a 63
      fragmentos totales en `loreChunks.ts`.
- [ ] **Verificar en partida** (la usuaria, jugando en vivo): posición de El Vergel de Kegi/La
      Grieta Cantora tras el ajuste de A8 (ver nota en esa fila); suite de tests de los 4 guards
      nuevos de B5 (`hasMortalSpeakingNohade`, `hasOrcWorshippingTarkor`,
      `hasUnpunishedOrcTabooBreak`, `hasNonSerhuDenyingFuneralRite`) — verificados a mano en esta
      sesión (sin `node` disponible en el entorno), no ejecutados de verdad con `vitest`.
- [x] **Segunda auditoría de huecos de lore (agente 2)** — lanzada y completada (2026-09-06).
      Confirma que la ronda fue exhaustiva: sin huecos nuevos, sin contradicciones de fondo entre
      los nuevos dominios de Semillas y el resto del corpus, y los ganchos abiertos a propósito
      (continente futuro de Lerox, más fauna de la firma de Sezix) correctamente marcados como
      tales, no como huecos olvidados. Dos hallazgos menores, ambos **CERRADOS**: (1) la tabla
      histórica de `clases.md` seguía diciendo "comunión con las Gargántuas... hueco real sin
      cubrir hasta ahora" en la fila de Ulkha Ketg — corregido a nota de obsolescencia explícita;
      (2) la palabra "comunión" se reutilizaba para el mecanismo nuevo de runas/tótems, mismo
      término que el "don de comunión" ya eliminado — sustituida por "resonar/vínculo" en
      `razas.md`, `clases.md`, `loreChunks.ts` y dos residuos sueltos en `personajes.md` (ficha de
      atributos y razonamiento de stats de Gorhorn) que el propio agente no llegó a señalar pero
      salieron al verificar el resto de apariciones del término.
- [ ] Commit y push de todo el trabajo de esta ronda (Semillas + Parte 1 + Parte 2 + guards B5) —
      no pedido aún explícitamente para este bloque.

## Nota para retomar esta lista

Toda la ronda punto-por-punto que dio origen a esta nota está cerrada (2026-09-06). Si aparecen
huecos nuevos en el futuro (de la segunda auditoría de huecos, o de partidas jugadas), seguir el
mismo proceso que ya demostró funcionar en toda esta sesión: diseñar un mecanismo físicamente
plausible, atarlo a la autoría de una o varias Semillas concretas cuando aplique, confirmarlo con la
usuaria ANTES de escribir el texto final en el `.md`, y solo entonces propagarlo a `loreChunks.ts` +
reindexar. Para cambios de código (guards, catálogo), verificar siempre con `tsc -b` limpio y la
suite de tests real en verde — este documento señala en varios puntos de hoy dónde esa verificación
quedó pendiente por falta de `node` en el entorno de esta sesión.

## Bug real jugando en vivo — "Bulco de Arena" narrado atacando (2026-09-06)

Jugando en vivo: al aceptar la misión de Gistera Koh ("Acabar con el Orco Enfurecido") y escribir
"Bsuco al perseguidor" (typo de "Busco"), el narrador combatió contra el **Bulco de Arena** —un ítem
de `HarvestYield` (marisco de Playa de Ceniza Blanca, ni fauna ni NPC combatible, `ataqueNatural: 'No
ataca.'`, `temperamento: 'INOFENSIVO'`)— en vez del Orco Enfurecido real de la misión, con prosa de
ataque activo ("lanza un rugido agudo... golpea con fuerza"). Cadena causal completa investigada por
agente dedicado: (A) el typo rompía `detectsSearchIntent` (regex literal sin fuzzy-match, a
diferencia de `detectsAttackIntent`) → el mecanismo que inyecta al Orco Enfurecido en escena
(`turnResolution.ts` § "Búsqueda del perseguidor de Gistera Koh") nunca se disparaba; (B) con el Orco
Enfurecido ausente, el fallback de objetivo de combate caía en el único NPC-fauna detectado por
fuzzy-match de alias, aunque fuera "bulco" (ítem de cocina) enganchado por el mismo typo; (C) aunque
el daño mecánico real sí se bloqueaba (`ataqueNatural: 'No ataca.'` ya tenía guard desde 2026-08-23),
ningún guard comprobaba la PROSA generada contra ese mismo dato.

**CERRADO — A y B (2026-09-06)**:
- `hasInoffensiveNpcNarratedAttacking` (`narrador.ts`), nuevo guard "vs. mecánica": compara la
  narración contra `npcAttackerIsInoffensive` (mismo criterio exacto que ya bloqueaba el daño —
  `ataqueNatural` empieza por "No ataca" — deliberadamente NO solo `temperamento: INOFENSIVO`, para
  no bloquear en falso a NPCs inofensivos con ataque débil real como Gargantúa de Ceniza/Corretolvas/
  Múrgol). Propagado como campo nuevo en `CombatExchangePhaseResult`/`NarradorContext`.
- `detectsSearchIntent` (`discovery.ts`) gana tolerancia a erratas vía Levenshtein ≤2 (mismo
  mecanismo centralizado que ya usa `detectsAttackIntent`) — "Bsuco" ahora sí activa la inyección
  determinista del Orco Enfurecido. Bonus: también arregla el caso ya documentado de "Recojo" (yo
  recojo) que antes rompía el stem por el cambio ortográfico g→j de la conjugación española.
- Verificado con `tsc -b` limpio, 306/306 tests en verde, y verificación rigurosa de ambos fixes
  (revertido → confirmado que el test falla → restaurado → confirmado que pasa).

**PENDIENTE — causa C, estructural, decidido explícitamente dejar para otra sesión**: el fuzzy-match
general de `detectNpcsInScene`/`matchNpcAliases` puede enganchar el alias de un ítem de
`HarvestYield` (no fauna/NPC real) como si fuera un candidato de combate válido, cuando ninguna otra
entidad mejor está en escena. Con la causa B ya cerrada, el Orco Enfurecido debería entrar en escena
correctamente la próxima vez que se repita ese typo, así que este bug concreto no debería repetirse
de inmediato — pero el endurecimiento de fondo (que el fallback de objetivo de combate nunca elija un
slug que solo existe como ítem de recolección) sigue sin hacerse. Retomar cuando se repita un caso
similar o se quiera cerrar la familia completa.
