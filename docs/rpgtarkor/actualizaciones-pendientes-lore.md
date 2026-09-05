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

### 1. La arena magnética — **PENDIENTE** (mayor envergadura, no abordado esta sesión)
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

### 2. El "don de comunión" de las Terk'ikar — **PENDIENTE** (requiere decisión de diseño)
**Archivos**: `flora-fauna.md:28`, `npcs.md:19` (Ulkha Ketg), `razas.md:50`, `clases.md:1238` (ya
marcado ahí como "hueco real sin cubrir hasta ahora").

Nunca se dice qué es: ¿magia, rito aprendido? ¿toda hembra orca o solo la Terk'ikar? ¿se hereda o se
enseña? Choca con `razas.md:52-60` (los orcos nunca canalizan magia sin tótem/runa) — ¿usa un foco?
Impacto directo: Ulkha Ketg (NPC con ficha completa) y el propio Gorhorn tienen una versión similar
sin definir. Requiere decidir el mecanismo antes de escribir — no abordado hoy.

### 3. El Margen Silencioso — **PENDIENTE** (depende del hueco #4, Kroj)
El sonido se apaga "de forma antinatural" sin decir por qué. Atribución obvia y sin usar: Nabieus son
de Kroj, cuyo dominio es *"la noche cerrada, el silencio, y lo que caza dentro de ambos"*
(`genesis.md`). Conectar, no inventar — pero depende de cerrar primero el hueco #4.

### 4. Kroj — **PENDIENTE** (dominio en blanco pese a tener obras repartidas)
`genesis.md` — *"Dominio en detalle aún desconocido."* Cuelgan de aquí el #3, la piel Nabieus ("no
refleja ni absorbe la luz" — físicamente imposible sin mecanismo) y las Sombras de Kroj ("imitan
susurros de voces mortales" sin decir cómo). Cerrar esto resuelve 3 huecos de un tirón — requiere
sesión de escritura dedicada, coherente con el patrón usado para el cielo sin luna.

### 5. "Magia ambiental" — **PENDIENTE** (vocabulario central de la clase Chamán)
`razas.md:56-57`, `clases.md` (Chamán). ¿Es la magia salvaje del Estallido dispersa en el terreno?
¿se agota? ¿por qué el tótem hace de puente? Relacionado: `flora-fauna.md:13` (Flor de Esquirla,
yacimientos que "absorbieron magia salvaje") ya sugiere la base sin que nadie una los conceptos.
Máxima frecuencia de aparición — el narrador lo describe cada vez que Gorhorn usa una habilidad de
Chamán. No abordado hoy.

### 6-17. Resto de huecos de impacto medio/bajo — **PENDIENTES, sin tocar esta sesión**
Ver detalle completo en el historial de este documento (recuperable por git) o volver a auditar:
Hielo sílice (mal clasificado como "Flora"), Hierba del Hierro (aleación sin mecanismo), piel Kelife
que cambia con la emoción, brújulas de vacío Nabieus, resina de Trepadores Ocaso ("conserva" ambiguo),
Pilares Rotos sin origen, Imanio (depende de #1), Árboles de Hebra Dorada, Acechadores de la Bruma
("cazan por miedo"). Los descartados como misterio deliberado (Isla Cambiante, Sello de contención,
Tundra Negra Refleja, Pico Ocaso Negro) siguen descartados.

---

## PARTE 2 — Coherencia código/BD ↔ lore (auditoría del agente 1, 2026-09-05)

### Dirección A — existe en código, falta en el lore .md

| # | Hallazgo | Estado |
|---|---|---|
| A1 | Taxonomía completa de fauna/flora (26 categorías: GUELISES, CORVENES, etc.) con reparto cosmológico por Semilla, invisible en el lore. Máximo impacto — base de habilidades de cada animal. | **PENDIENTE** — requiere decidir si son canon narrativo o solo claves internas antes de escribir nada; ~1-2 páginas de trabajo. |
| A2 | Interior de Karot Veku / Karot Vekhad + 4 construcciones del clan, nodo jugable real sin mención en `areas.md`. | **PENDIENTE** — requiere redactar la sección nueva del campamento. |
| A3 | Veta de hierro real en Los Pilares Rotos, contradice `razas.md:83` (los Serhu no tienen metal propio). | **PENDIENTE** — requiere decidir cómo encaja con el argumento económico existente. |
| A4 | Nombres Kektira de estaciones/clima, se muestran en pantalla constantemente, ausentes del lore de idiomas. | **CERRADO** — chunk RAG nuevo añadido y reindexado (`loreChunks.ts`, "Kektira — nombres orcos de estaciones y tormentas") y las 8 palabras añadidas también a `areas.md` § Idiomas, en la entrada del propio Kektira. |
| A5 | "Origen Azul" (nombre del planeta) usado en la esquirla-celeste-caída como si fuera un fenómeno del cielo. | **CERRADO** — descripción reescrita en `worldCatalog.ts`, conecta con el cinturón de micro-cristales real. |
| A6 | Pico de minero en el inventario inicial de Gorhorn, ausente de su ficha canónica. | **CERRADO** — resuelto junto con B9 (ver abajo): `personajes.md` actualizado con el inventario real completo (pico + cataplasma incluidos). |
| A7 | 12 Maestros de oficio reales en catálogo, `areas.md` decía 11 (sin contar Pescador). | **CERRADO** — recuento y lista corregidos en `areas.md`. |
| A8 | Coordenadas de El Vergel de Kegi / La Grieta Cantora fuera de rango regional. | **PENDIENTE** — bajo impacto, requiere revisar el grafo de coordenadas con cuidado. |
| A9 | La Espina del Viento (peligro nº1 declarado de la región) no tiene `Npc` combatible — solo genera texto de riesgo. | **PENDIENTE** — decisión de diseño (¿darle ficha de combate o dejarla puramente narrativa y decirlo explícitamente en el lore?). |

### Dirección B — el lore lo establece, el código no lo respeta

| # | Hallazgo | Estado |
|---|---|---|
| B1 | `imagePromptContext.ts` instruía "iluminada por luna/estrellas" en prompts de imagen nocturna. | **CERRADO** — reescrito sin mención de luna, describe el cinturón de micro-cristales. Test actualizado. |
| B2 | El guard `hasWrongCelestialReference` solo rechazaba "luna" DE DÍA, dejándola pasar de noche (el caso más frecuente). | **CERRADO** — nuevo guard `hasFalseMoonReference` (narrador.ts) rechaza "luna/lunar" en CUALQUIER momento, salvo la expresión canónica "brillo de luna". Enganchado a la cascada de `narrateAction`. Tests nuevos + verificación rigurosa (revertido/confirmado que falla sin el fix). |
| B3 | `entorno.ts` describía la noche de las Llanuras "sin ninguna luz que las opaque" — justo lo contrario del cinturón real. | **CERRADO** — reescrito para mencionar el brillo perlado difuso. Test actualizado. |
| B4 | La pasiva racial orca "Sangre del Estallido" (TODOS los orcos, no solo Chamán) narraba magia despertando sola, sin tótem/runa — viola la regla dura de `razas.md`. | **CERRADO** — reescrita como efecto fisiológico latente ("herencia del Estallido... no es magia"), nunca canalización mágica. |
| B5 | Ningún guard de narrador.ts verifica NINGUNA regla de lore del corpus (magia sin foco, tabúes orcos, idioma nohade, etc.) — solo mecánica de combate/viaje. | **PENDIENTE** — hueco estructural, más caro de cerrar (requeriría una familia nueva de guards "vs. lore" en vez de "vs. mecánica"). Candidatos ya identificados: "los orcos no adoran a Tarkor ni saben de su existencia", tabú de tocar tótem ajeno/interrumpir duelo, rito funerario solo entre Serhu, "ningún mortal habla nohade". |
| B6 | `loreChunks.ts` (índice RAG del narrador) desfasado ~2 semanas: 8 zonas jugables y fauna reciente invisibles para el narrador. | **PARCIALMENTE CERRADO** — añadidos y reindexados 3 chunks nuevos (Zense Ceniza + Kirelon-arenoso en el chunk de fauna existente, Kektira, 4 puntos de interés nuevos + Pescador, El cielo sin luna). `npm run reindex-lore` corrido con éxito, confirmado en Postgres. **Sigue pendiente**: Karot Vekhad/interior del campamento, la taxonomía de fauna (A1, si se decide que es canon), la veta de hierro (A3), y cualquier otro contenido de zonas fuera de las Llanuras. |
| B7 | Población del Clan Serhu: 600 en código vs 800 en el lore (y el propio comentario del código decía 800). | **CERRADO** — corregido a 800 en `worldPopulation.ts`, comentario actualizado. |
| B8 | "Buitres Cenizos" (nombre obsoleto) vivía en 3 sitios pese al renombrado a "Zense Ceniza". | **CERRADO** — corregido en `worldCatalog.ts` (texto de riesgo + comentario de renombrado roto) y en `areas.md`/`flora-fauna.md`. El alias `worldCatalog.ts:7744` con el nombre viejo se mantiene intacto a propósito (permite que el jugador lo siga nombrando así). |
| B9 | La capa de piel de gargantúa de Gorhorn está en `personajes.md`/RAG pero no existe en su inventario real (`startingInventory.ts`). | **CERRADO** — decisión explícita de la usuaria: se quita la mención de la capa de `personajes.md` y `loreChunks.ts` (el inventario real de `startingInventory.ts` es la fuente de verdad); no se creó ningún ítem cosmético nuevo. De paso se completó la ficha con el pico de minero y la cataplasma, que sí existen y no estaban mencionados (A6). |
| B10 | "Pez luna" usado como comparación de forma en la bio del Toluh (código y `.md`) — "luna" no es válida en ningún texto de este mundo. | **CERRADO** — reescrito en ambos sitios sin la palabra. |
| B11 | `narrationLint.KNOWN_REGIONS` solo conocía las 5 regiones de Berig, nunca detectaría un salto narrativo a Vaelira. | **CERRADO** — añadidas las 3 regiones de Vaelira. |
| B12 | Ulkha Ketg Chamán/Rúnico vs. recomendación vieja de `clases.md` (Totémico). | **Descartado, no es desajuste real** — `clases.md` ya declara esa tabla vieja superada por una pasada posterior. Sin acción. |

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
- [ ] **Segunda auditoría de huecos de lore (agente 2)** — NO lanzada esta sesión. Quedan
      pendientes de mayor envergadura (arena magnética, Kroj, magia ambiental, don de comunión,
      taxonomía de fauna A1, Karot Vekhad A2, veta de hierro A3, familia de guards "vs. lore" B5)
      que requieren decisiones de diseño con la usuaria presente, siguiendo el mismo patrón usado
      para "El cielo sin luna" (propuesta de mecanismo → confirmación → escritura). Retomar cuando
      la usuaria quiera continuar esta ronda.
- [ ] Propagar a chunks/catálogo lo que falta de A1/A2/A3 una vez decididos.

## Nota para retomar esta lista

El orden de trabajo sugerido original seguía siendo: arena magnética → Kroj → magia ambiental + don
de comunión → hielo sílice → resto por impacto. Ese orden sigue siendo válido para lo que queda
pendiente. Cada pieza grande (arena magnética, Kroj, magia ambiental) necesita el mismo proceso que
"El cielo sin luna": diseñar un mecanismo físicamente plausible, atarlo a la autoría de Semillas
concretas, confirmarlo con la usuaria ANTES de escribir el texto final en el `.md`, y solo entonces
propagarlo a `loreChunks.ts` + reindexar.
