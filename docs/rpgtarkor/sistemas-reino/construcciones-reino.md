# Construcciones y economía de Reino — estilo X4 + Bellwright

[← Volver al índice](mundo-vivo-x4.md)

**Estado (2026-09-28):** todo lo de este documento está implementado, backend y frontend (panel de
Reino, 2026-09-22). Documento de diseño: explica el porqué. Cómo funciona hoy y qué falta, en la
[referencia técnica](../../arquitectura/22-mundo-vivo-x4-tecnico.md).

---

### 4.2 Decisión de arquitectura tomada (2026-09-21): un solo modelo, no dos paralelos

Pregunta cerrada explícitamente por la autora: ¿`Building`/`KingdomStats`/`Territory` ganan un
`factionId` opcional (mismo modelo exacto para jugador y facción), o la facción tiene sus propias
tablas paralelas reutilizando solo las fórmulas puras?

**Decidido: el mismo modelo, `factionId` opcional.** Razonamiento (coherente con el mandato de la
autora de priorizar generalidad sobre coste): una fila de `Building`/`KingdomStats`/`Territory`
pasa a representar **"el reino de X"**, sea `X` el jugador (`saveId` relleno) o una facción NPC
(`factionId` relleno) — exactamente una entidad "tiene reino" rellena, la otra es null. Esto:

- Elimina duplicación de lógica futura para siempre — `tickKingdomOneDay`, `computeBuildBlockedReason`,
  la consolidación/rebelión de `Territory` sirven IDÉNTICAS para ambos casos, sin ninguna rama
  `if (esFaccion)` dispersa por el código.
- Es fiel a X4/Stellaris de verdad: ahí el jugador y las facciones NPC juegan con el MISMO motor de
  reglas, nunca con una versión simplificada aparte para la IA — es justamente lo que hace que se
  sienta "un mundo", no "el jugador + un simulador de fondo distinto".
- Tiene coste real de migración (ver § 5, riesgos) pero es el camino elegido a propósito, siguiendo
  el mandato explícito de la autora de no evitarlo por ser costoso.

Consecuencia directa en el schema (a validar con la autora antes de escribir la migración real):

- `Building.saveId` pasa de obligatorio a **opcional**, se añade `Building.factionId` opcional,
  con un `CHECK`/constraint de aplicación (a nivel de servicio, Prisma no tiene XOR nativo) de
  "exactamente uno de los dos debe estar relleno, nunca ambos, nunca ninguno".
- `KingdomStats.saveId` pierde su `@unique` estricto 1:1 y pasa al mismo patrón `saveId?`/
  `factionId?` — la unicidad se reexpresa como `@@unique([saveId])`/`@@unique([factionId])`
  parciales (o un índice único compuesto que trate null como comodín, a confirmar con Postgres real
  — Postgres SÍ permite múltiples `NULL` en una columna `UNIQUE`, así que esto es viable sin
  trucos raros).
- `Territory` sigue el mismo patrón.
- Todas las rutas HTTP actuales (`construction.ts`, `kingdomTick.ts` vía `turnResolution.ts`) que
  hoy reciben `saveId` como único identificador de "de quién es este reino" pasan a recibir un
  identificador más genérico (`{ tipo: 'save' | 'faccion', id: string }`, o dos campos opcionales
  en cada firma — a decidir el detalle en la sesión de implementación, no aquí).


---

### 4.4-bis Panel de Reino real — economía interna X4 + Bellwright + control de escuadrones (2026-09-21, sesión posterior)

Hallazgo de arranque (verificado con grounding real, no memoria): **ya existe la cadena completa
crudo→crafteo→consumible/material** — `HarvestYield` (cosecha) → `CraftingRecipe` (52 recetas
reales, `crafting.ts`) → `ItemCatalog` con `curaHambre`/`curaAgua` reales, y la misma cadena hacia
`ConstructionRecipe.requirements` para materiales de construcción. Pero **ningún `Building` produce
nada de forma recurrente** (confirmado: `AlmacenItem` dice explícitamente "sin producción
automática todavía", solo depósito manual) — `KingdomStats.comida`/`riqueza` es un número inventado
por `trabajadores` (`COMIDA_POR_TRABAJADOR = 2`), no la suma real de lo crafteado. Los dos motores
(crafteo individual del jugador, economía agregada de Reino) corren en paralelo sin ningún puente.

Clasificación real de las 52 `CraftingRecipe` por tipo de producto (grounding con agente,
2026-09-21) — base para decidir qué cadenas alimentan producción de Reino automática y cuáles
siguen siendo crafteo puntual del jugador:

| Categoría | Nº | Ejemplos |
|---|---|---|
| COMIDA | 6 | smokeMeat, boungoRoast, jushaSmokedMeat, scarletWheatBread, sweetHoneycomb, murgolCurd |
| BEBIDA | 3 | boiledLichenWater, recogerAgua, redSpikeInfusion |
| MATERIAL_CONSTRUCCION | 11 | ironIngot, stoneBlock, woodBeam, boneColumn, braidedCordage, yerreoIngot... |
| MEDICINA | 7 | antidote, firstAidBandage, basicPoultice, completePoultice, mossPoultice... |
| EQUIPO | 17 | armas/armaduras — crafteo puntual del jugador, no candidatas a producción automática |
| OTRO | 7 | brújula, antorchas, decorativo/trueque |
| Huérfana (deuda técnica real) | 1 | `carvedHorn` → `resultCatalogSlug: 'cuerno-caza-tallado'`, item retirado del catálogo 2026-09-02, la receta se quedó atrás sin actualizar — **bug real a corregir cuando se toque `crafting.ts`, no relacionado con este diseño** |

Referencia de diseño explícita, dos juegos distintos para dos problemas distintos dentro del MISMO
panel único de Reino (petición explícita de Álvaro, informado con `WebSearch` real sobre Bellwright
antes de proponer nada — fuentes:
[Bellwright Wiki — Population](https://bellwright.fandom.com/wiki/Population),
[Job Priorities](https://bellwright.fandom.com/wiki/Job_Priorities),
[Crafting](https://bellwright.fandom.com/wiki/Crafting),
[Advanced Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=3380034073)):

- **X4**: cómo evoluciona la economía/construcciones — la red de producción es una configuración
  FIJA que el jugador diseña una vez (qué produce cada `Building`), no algo que cambia solo.
- **Bellwright**: la UI de control fino DENTRO de esa red — cadenas de fabricación con modo
  **"único" o "reponer" + límite de cantidad** (mismo concepto que Bellwright: "queue en lotes
  controlados", nunca producción infinita ciega), el mismo concepto de límite aplicado también a
  **recolección** y al **Almacén de Reino** (tope configurable por recurso, **por defecto
  infinito** — decisión explícita de Álvaro), y **prioridad de profesión 0-9 por trabajador**
  (mismo Job Priorities de Bellwright: "qué hará este trabajador a continuación", el motor reparte
  automáticamente según disponibilidad y requisitos cumplidos, nunca asignación fija 1:1).
- **Control de escuadrones/tropas**: panel de órdenes dinámicas tipo RTS/4X (patrullar, explorar,
  escuadrones sobre escuadrones) — sistema aparte, más cercano a combate/movimiento en Zona que a
  economía, mismo panel único de Reino pero pestaña distinta.

**Pieza clave que cierra el sistema** (petición explícita de Álvaro, la que faltaba en la primera
propuesta): el tope de Almacén de Reino se CONECTA con las prioridades — si un recurso ya alcanzó
su cupo, el motor deja de gastar tiempo de trabajador en producirlo y ese trabajador libre pasa a
la siguiente prioridad disponible que sí tenga hueco. Sin esto, un trabajador seguiría produciendo
un recurso ya lleno indefinidamente, desperdiciando su tiempo — el propio concepto de "cupo" no
tendría efecto real sobre el reparto de trabajo si no re-dirige a nadie.

**Orden de trabajo decidido con Álvaro**: empezar por (A) cadenas de producción con
único/reponer+límite por `Building` y (B) límite de cantidad en recolección/Almacén de Reino —
es la base real de toda la economía (sin esto, la prioridad de profesión no tiene sobre qué
repartir) y reutiliza directamente las 52 `CraftingRecipe` ya clasificadas arriba. Luego (C)
prioridad de profesión 0-9 por `Companion` (necesita que (A)/(B) ya exista para tener efecto
real — mismo riesgo ya visto con el evento territorial, que quedó "escrito sin caller" hasta que
existió el Cuartel Avanzado). (D) control de escuadrones queda para el final, es un sistema
aparte más cercano a combate que a economía.

**Sin código todavía** — quedó en este punto de diseño (vocabulario y orden fijados, clasificación
completa de recetas hecha) al cierre de esta sesión de análisis. Antes de escribir schema falta
decidir en la próxima sesión: (1) modelo de datos de "orden de producción" por `Building`
(¿tabla `OrdenProduccion` propia, con `recipeKey`/`modo: 'unico'|'reponer'`/`limite`?), (2) cómo se
computa "trabajador libre" y "requisitos cumplidos" para la asignación automática por prioridad
(¿nivel de `ProfessionProgress` del Companion asignado a ese Building? ¿cómo se resuelve si varios
Building compiten por el mismo Companion libre, mismo problema que "Building Priorities" de
Bellwright?), (3) campo de tope en `AlmacenItem`/`WorldPopulation`/nuevo modelo para el límite de
Almacén de Reino, con default infinito.

### 4.4-ter Diseño cerrado de (A)+(B)+(C) fusionadas — sesión posterior (2026-09-21, misma fecha)

Las 3 preguntas de arriba se decidieron con Álvaro en una sola pasada — y el orden cambió: (C)
"prioridad de profesión 0-9" ya NO es una fase aparte, nace fusionada con (A) desde la primera
migración (petición explícita: "prioridades de 0-9 como en Bellwright" en la propia orden de
producción, no en un paso posterior). Grounding adicional hecho antes de fijar esto: hoy
`Companion.rolReino` (`'trabajador'`/`'guardia'`/`'productor'`) NO está ligado a ningún `Building`
concreto (solo dice "trabajador" en abstracto, sin `buildingId`) y `ProfessionProgress` es 1 fila
por `(saveId, professionId)` — del PERSONAJE, nunca de un `Companion` — así que ninguna de las dos
piezas de datos que hacen falta existe todavía. `git log` de esta misma sesión (`5da79e5`,
`e75bdb3`, `fcce871`, `6a735c8`, `e755c6b`, `eee3022`) confirma que nada de esto se ha tocado en
el ínterin — todo ese trabajo fue §4.2/§4.3/§4.6/§7.4 (facciones/territorio/población), terreno
distinto.

**Decisión explícita — el jugador NO cuenta como mano de obra de Reino** ("en el reino yo no
cuento, yo fabrico aparte y no influyo sobre eso... como en Bellwright"): el crafteo personal del
jugador (`crafting.ts`, `POST /turn/narrate`) y la producción automática de Reino son y siguen
siendo dos motores separados sin puente — el jugador nunca es candidato a "trabajador libre" del
reparto automático, solo los `Companion` con `rolReino` asignados a un `Building`.

Modelo de datos decidido (Prisma), 4 piezas nuevas/extendidas:

1. **`Companion.buildingId`** (nuevo, opcional, FK a `Building`, `onDelete: SetNull`) — en qué
   edificio trabaja este Companion, si tiene `rolReino` asignado. Pieza que faltaba y el documento
   original no mencionaba explícitamente: sin esto, "trabajador libre" no tiene forma de saber a
   qué `Building` está atado ni de competir por prioridad entre varios.
2. **`ProfessionProgress.companionId`** (nuevo, opcional, FK a `Companion`) — mismo patrón laxo
   "exactamente uno relleno" que `KingdomStats.saveId`/`factionId` (`assertExactlyOneOwner`,
   `reinoOwner.ts`), validado en servicio, nunca CHECK de SQL. Reutiliza tal cual
   `professionLevelForXp`/`xpForCraftSuccess`/`alivioForLevel` (professionProgress.ts) — un solo
   camino de código para subir de nivel de oficio, sea el del jugador o el de un trabajador de
   Reino. `@@unique` pasa a `[saveId, professionId]` OR `[companionId, professionId]` (dos
   `@@unique` parciales, Postgres permite múltiples NULL en columna UNIQUE — mismo truco ya usado
   por `KingdomStats.saveId`/`factionId`).
3. **`OrdenProduccion`** (nuevo modelo) — 1 fila por `(buildingId, recipeKey)`:
   - `recipeKey: String` — key de `CraftingRecipe` (crafting.ts), la jugadora/Álvaro la asigna a
     mano al `Building` desde el panel de Reino (nunca la propone el modelo/narrador).
   - `modo: 'unico' | 'reponer'` — 'unico' produce el lote y se desactiva sola; 'reponer' repite
     cada tick mientras haya hueco de límite y almacén.
   - `limite: Int?` — tope de unidades a producir por esta orden, null = sin tope propio (el único
     tope real en ese caso es el de `AlmacenLimite`, pieza 4).
   - `prioridad: Int` (0-9, default 5) — Bellwright "Job Priorities": menor número = se sirve
     antes al repartir trabajadores libres entre Buildings que compiten por el mismo Companion.
   - `cantidadProducidaAcumulada: Int` (default 0) — para saber cuándo una orden 'unico' con
     `limite` ya se completó y debe desactivarse sola.
   - `activa: Boolean` (default true).
   - `@@unique([buildingId, recipeKey])` — incluso en 'reponer' no tiene sentido declarar la misma
     receta dos veces en el mismo edificio; sí puede haber varias filas con `recipeKey` distinto en
     el mismo `Building` (un taller con varias cadenas activas a la vez), cada una con su propia
     prioridad.
4. **`AlmacenLimite`** (nuevo modelo) — tope configurable del Almacén de Reino, separado de
   `AlmacenItem` a propósito (`AlmacenItem` es una fila POR OBJETO depositado, no un contador —
   forzar un tope ahí exigiría agregar por `catalogSlug` en cada lectura, más frágil):
   - `saveId: String` — grounding real antes de escribir esto (`schema.prisma`,
     `companionSupervivencia.ts`): `AlmacenItem` hoy es 100% `saveId`, SIN `factionId`/`ownerKey` —
     a diferencia de `Building`/`KingdomStats` (generalizados a facción en §4.2), el Almacén de
     Reino nunca se generalizó a facciones NPC y nadie lo ha pedido todavía. `AlmacenLimite` sigue
     el mismo patrón real de `AlmacenItem` (`saveId` simple), no el de `KingdomStats`/`ownerKey` —
     generalizar a `ownerKey` aquí sería adelantar una pieza fuera de alcance (el propio §4.4-ter es
     sobre el Reino del JUGADOR: "yo fabrico aparte... como en Bellwright"). Si algún día una
     facción NPC necesita Almacén propio, se generaliza `AlmacenItem` y `AlmacenLimite` a la vez, no
     antes.
   - `catalogSlug: String` — a qué recurso del catálogo aplica el tope.
   - `limite: Int?` — null = sin tope (infinito), decisión explícita de Álvaro como default.
   - `@@unique([saveId, catalogSlug])`.

**Flujo del tick** (nueva función pura en `kingdomTick.ts` o archivo hermano, enganchada en
`turnResolution.ts` en el MISMO bloque `if (diasCruzados > 0)` que ya llama a `tickKingdom` —
`turnResolution.ts:5512-5522` — misma cadencia, un día de ficción cruzado):

1. Por cada `Building` ACTIVO del reino con al menos una `OrdenProduccion` activa, listar sus
   `Companion` con `rolReino` y `buildingId` apuntando a él (el "trabajador libre" real).
2. Ordenar las órdenes de ESE building por `prioridad` ascendente (0 primero).
3. Para cada orden, en ese orden: comprobar (a) si el recurso resultante ya está al tope de
   `AlmacenLimite` (si lo hay) — si está lleno, SALTAR esta orden sin gastar el trabajador, pasar a
   la siguiente prioridad con hueco (la pieza que cierra el sistema, ya fijada en la sesión
   anterior); (b) si algún `Companion` de la lista de trabajadores de ese Building tiene, vía su
   `ProfessionProgress` propio (`companionId`), nivel de oficio suficiente para el `tier`/`oficio`
   de la `CraftingRecipe` (mismo `alivioForLevel` que ya usa el crafteo del jugador). Si NINGÚN
   trabajador asignado tiene nivel suficiente, la orden no produce y se dejar constancia visible
   (mensaje en el panel de Reino, no un `LogEntry` de narración — es información de gestión, no un
   evento de ficción) — nunca un fallo silencioso.
4. Si (a) y (b) pasan: craftear (misma receta, mismo `resultCantidad`/`resultCatalogSlug` que ya
   usa `crafting.ts` para el jugador — un solo shape de `CraftingRecipe`, dos consumidores) los
   ingredientes desde el Almacén de Reino (no desde `InventoryItem` del jugador) hacia
   `AlmacenItem`, incrementar `cantidadProducidaAcumulada`, y si `modo: 'unico'` y se alcanzó
   `limite`, poner `activa: false`.
5. Un trabajador que ya produjo en este tick para una orden no vuelve a contarse para otra orden
   del mismo Building en el mismo tick (una asignación por trabajador por tick, igual que Bellwright
   nunca duplica un mismo Pal en dos tareas a la vez).

**De dónde sale la materia prima — verificado contra las dos referencias reales, no supuesto**
(pregunta de Álvaro: "revisa primero x4" + "y revisa también en x4foundations", dos `WebSearch`
reales antes de decidir):

- **Bellwright real**: una estación de recolección (ej. el Foraging Hut/Lumberjack Spot) NO es un
  sistema aparte de las estaciones de crafteo — es el MISMO tipo de edificio-con-trabajador-
  asignado, solo que su receta no consume nada, convierte tiempo de trabajador + un nodo del mapa
  en materia prima ("gathering stations collect raw resources... processing stations turn raw
  resources into usable crafting components... production stations turn those components into
  finished items" — misma cadena, mismo tipo de nodo en cada eslabón).
  [Crafting Guide — Bellwright Wiki](https://bellwright.fandom.com/wiki/Crafting_Guide),
  [Villager Jobs & Work Priorities](https://bellwright.xyz/wiki/bellwright-villager-jobs/).
- **X4 Foundations real**: un módulo Solid Miner/Gas Collector es estructuralmente el mismo tipo de
  `Module` de estación que un Refinery/Production Module — ambos con `Workforce` asignada, ambos
  parte de la "Logical Overview" de líneas de producción de la estación; la única diferencia es que
  el Miner no tiene inputs (extrae del sector) y el Refinery sí (consume lo que extrajo el Miner).
  [Modules — X4 Foundations Wiki](https://x4-foundations-wiki.fandom.com/wiki/Modules),
  [Station Modules List](https://www.ludo.guide/guide/x4-foundations/side-quests-activities/station-building-management/station-modules-list).

**Decisión confirmada por las dos referencias (no solo por simplicidad de nuestro lado)**: se
retira el recorte (A)/(B) separado del documento original — no hay dos sistemas, hay un solo
`OrdenProduccion` que cubre tanto "recolección" (receta con `ingredients: []`, consume solo tiempo
de trabajador + requiere estar en la `location`/`Building` correcto) como "crafteo" (receta con
`ingredients` reales) exactamente con el mismo modelo de datos, el mismo tick, el mismo reparto por
prioridad y el mismo gate de nivel de oficio ya diseñados arriba. Las `CraftingRecipe` de
`crafting.ts` que hoy consumen un recurso "recolectado a mano por el jugador" (agua, madera, fibra)
sirven de referencia de shape para las nuevas recetas de recolección de Reino — se decidirá recepta
por receta, al implementar, cuáles de las 52 existentes se reutilizan tal cual (si no exigen nada
que solo tenga sentido para el jugador, como una tirada de atributo) y cuáles necesitan una versión
"de Reino" nueva sin ingredientes.

**Implementado y verificado (2026-09-21, misma sesión)**: schema (`Companion.buildingId`,
`ProfessionProgress.companionId` con XOR laxo, `OrdenProduccion`, `AlmacenLimite`), migración
aplicada contra el sandbox real (`20260921140154_panel_reino_orden_produccion`), y el motor puro
del tick en `kingdomProduction.ts` (`nivelOficioDeTrabajador`, `trabajadorPuedeProducir`,
`almacenAlTope`, `tickOrdenesProduccion` — reparto por prioridad 0-9, gate de nivel de oficio por
`Companion` sin mirar atributos del jugador, y el tope de Almacén conectado al reparto). 20 tests
unitarios nuevos en verde, `tsc -b` limpio, suite completa del backend 2615/2615 sin regresión
(verificado en aislamiento — la corrida en paralelo con el resto de la suite tuvo 16 fallos de
contención/timing conocidos en `turn.integration.test.ts`, no relacionados con este cambio).

**Enganche real cerrado (2026-09-21, misma sesión, continuación)**: `tickOrdenesProduccion` ya
corre dentro de `turnResolution.ts`, en el mismo tramo `if (diasCruzados > 0)` que `tickKingdom` —
pero como bloque HERMANO de `if (kingdomStats)`, no anidado dentro (bug real encontrado escribiendo
el test de integración: un `Building` con trabajadores puede existir sin que el Reino tenga fila
`KingdomStats` todavía, son entidades separadas en el schema; anidado dentro, el tick de producción
nunca corría para una partida sin Territory fundado). Lee `Building`/`OrdenProduccion`/`Companion`/
`ProfessionProgress.companionId`/`AlmacenItem`/`AlmacenLimite`/`ItemCatalog` reales de Prisma,
aplica el resultado (consume ingredientes reales del Almacén con el mismo criterio FIFO simple del
motor puro, deposita el resultado igual que el depósito manual del jugador, sube XP de oficio del
trabajador, desactiva solas las órdenes 'unico' que completan su límite EN el mismo tick que las
completa, no solo en el siguiente). Sin `LogEntry` de narración para los resultados que no
producen (`SIN_TRABAJADOR_CON_NIVEL`/`SIN_MATERIA_PRIMA`/`ALMACEN_LLENO`/`RECETA_DESCONOCIDA`) —
decisión consciente: es información de gestión del panel, no un evento de ficción.

6 tests de integración nuevos contra Postgres real (`turn.integration.test.ts`, describe
`OrdenProduccion: tick real de producción de Reino`) cubren: producción con materia prima real,
sin materia prima, gate de nivel de oficio con tier alto (el jugador con nivel 9 del mismo oficio
NO cuenta, confirmado en vivo), modo único desactivándose solo, tope de Almacén saltando la orden
sin gastar trabajador, y el trabajador subiendo su propio `ProfessionProgress.companionId` sin
tocar el del jugador. Suite completa 2627/2627 en verde (aislado — 2 fallos en la corrida en
paralelo con el resto de la suite fueron contención/timing conocidos, reproducidos limpios
ejecutando esos 2 archivos juntos en aislamiento).

**Edificios en los que producir (2026-09-28):** implementados, ver
[edificios-de-oficio.md](edificios-de-oficio.md). Las 4 recetas de extracción (sin ingredientes)
también existen.

**Frontend (2026-09-22):** CRUD de órdenes, asignación de trabajador y topes de almacén en la
subpestaña Producción del panel de Reino. **Hueco:** ningún flujo de la interfaz da `rolReino` a un
súbdito, así que no se puede asignar trabajador jugando (referencia técnica, H-1).


---

### 7.1 §4.2 generalizado — CERRADO, verificado, en producción

- `Building`/`Territory`/`KingdomStats`: `saveId`/`factionId` opcionales (schema.prisma), validado
  con `assertExactlyOneOwner`/`ownerKeyFor` (`reinoOwner.ts`) — nunca CHECK de SQL (punto abierto
  #2: **servicio, no DB**, decisión de Álvaro).
- `KingdomStats.ownerKey` (`save:<id>`/`faction:<id>`) sustituye `saveId @unique` como clave real
  de `findUnique`/`update` — necesario porque Prisma exige unicidad simple en el lado que define
  una relación 1:1, y `saveId`/`factionId` ya no pueden serlo por separado.
- Punto abierto #3 (Save vs. World): **de `Save`**, cada partida diverge desde el turno 1 —
  asimetría deliberada frente a `WorldPopulation` (de `World`), decisión de Álvaro contra la
  recomendación de Claude.
- Punto abierto #1 (`FactionBuilding`): **retirado**, migrado a `Building.factionId`
  (`@@unique([factionId, recipeKey])` nuevo, hace el seed idempotente). Las 12 filas vigentes de
  catálogo migradas vía SQL directo; 2 huérfanas de un rename (`karot-vekhad`, `ketg-lukar`,
  duplicados exactos de `ketg-sedsar`) descartadas — mismo criterio que `orco-rezagado`
  (2026-09-09): "si no da valor, no se arrastra".
  `seed-catalog.ts` reescrito: siembra `Faction` → resuelve `factionSlug`/`locationSlug` → crea
  `Building.factionId` (ya no hay tabla `FactionBuilding`).
- `session.ts:100` reforzado con `saveId` explícito en el `deleteMany` (antes solo `id`+`status`).
- 2 migraciones Prisma aplicadas contra el sandbox real; `tsc -b --force` limpio; suite completa
  **2553/2554** (el único fallo, `session.flee.integration.test.ts`, es un test de condición de
  carrera dependiente de timing — pasa aislado, no es regresión).


---

### 7.4 Conquista territorial estilo X4 — BACKEND CERRADO (título corregido 2026-09-21 tarde: el
texto original decía "EN DISEÑO, sin cerrar, sin código todavía", desactualizado frente al propio
contenido de la sección, que ya documentaba piezas 1-5 y 7 como CERRADAS — ver resumen al final)

Al intentar enganchar el primer evento real (`EXPANSION_TERRITORIAL_AGRESIVA`), salió a la luz que
el modelo de control regional actual (`Territory.control`/`regionControlFor`, avance por tiempo)
no es fiel al patrón real de X4 que Álvaro quiere: en X4 el control de un sector lo decide qué
ESTRUCTURA FÍSICA real (estación/módulos) hay allí, no un número aparte. Álvaro pidió revisar cómo
lo hace X4 de verdad antes de seguir — hecho, y confirmado que el camino es "estructura física
real decide el control", no un contador ambiental.

Diseño construido en la conversación, en orden, y estado real de cada pieza:

1. **Jerarquía de 3 niveles de construcción de reino** (no 2 como hoy) — **CERRADO, código
   escrito y verificado**:
   - **Capital** (Ayuntamiento, ya existía — 1 por facción/jugador, límite estricto ya real).
   - **Cuartel Avanzado** (pieza NUEVA, "puesto avanzado" ya anticipado en el comentario de
     `AYUNTAMIENTO_PEQUENO_RECIPE` desde 2026-08-04) — `CUARTEL_AVANZADO_RECIPE` (construction.ts):
     1 por región, en región DISTINTA a la del Ayuntamiento (justo lo contrario de la Choza — para
     expandir DENTRO de la misma región ya está la Choza). Mejorable UNA VEZ a **Cuartel de
     Guerra** (`CUARTEL_DE_GUERRA_RECIPE`, +10 cupo de edificios defensivos) o **Puesto Comercial**
     (`PUESTO_COMERCIAL_RECIPE`, +10 cupo de producción) — bifurcación única, nunca ambas
     (`computeBuildBlockedReason` lo impone comprobando que ese Cuartel concreto no lleve ya la
     mejora contraria), mismo patrón que la especialización de clase del jugador.
   - Edificios sueltos (choza, taller...) — como hoy, cuelgan de Capital o Cuartel según su tipo
     (`ConstructionRecipe.edificioTipo: 'defensa' | 'produccion'`, campo ya definido en el schema
     de recetas, sin ninguna receta real que lo use todavía — "poca variedad de edificios",
     decisión explícita de dejarlo para cuando haga falta).
2. **Cupos confirmados** (cifra de partida, ajustable jugando, mismo criterio que el resto del
   proyecto) — **CERRADO**: Ayuntamiento pequeño/mediano/grande → 1/5/10 Cuarteles Avanzados
   posibles (`ConstructionRecipe.cuartelAvanzadoCapacity`, cupo NUEVO e independiente del cupo de
   edificios normales 10/25/60 que ya existía, `reinoBuildingCapacity`). Cada Cuartel tiene su
   propio cupo LOCAL de defensa/producción (`cuartelUpgradeBonus`, no agregado de partida — cada
   base física real tiene su propia capacidad, más fiel a X4 donde cada estación tiene sus propios
   módulos) — sin ningún edificio real todavía que consuma ese cupo local (mismo motivo que arriba).
   9 tests de integración reales contra Postgres (`cuartelAvanzado.integration.test.ts`), sin mocks.
3. **Zona-interior navegable propia** al fundar Capital — **CERRADO, verificado contra Postgres
   real**: primera vez que el motor crea una `Location` en TIEMPO DE PARTIDA (hasta ahora, 100%
   catálogo estático sembrado a mano). Enganchado en `POST /saves/:id/reino/fundar` (`reino.ts`,
   después de decidir junto a Álvaro que va DESPUÉS de fundar el reino, no al construir el
   Ayuntamiento en sí — el modal de fundación es obligatorio-o-cancelable, así que fundar es el
   evento real y único). Slug determinista `ayuntamiento-interior-<save.id>` (mismo patrón que
   `Faction.slug`), `region` heredada del Ayuntamiento, sin `x`/`y` propias (vive "dentro" del
   exterior, mismo criterio que `campamento-serhu-interior`), un solo `LocationLink` coste 0 basta
   (`buildAdjacency` ya trata cada tramo como bidireccional — confirmado con test real que la
   vuelta también es navegable sin fila explícita). Sin campo de imagen nuevo en el schema: el
   sistema de `ImagePrompt`/`entityType: 'location'|'zona'` ya resuelve por `slug`, no hacía falta
   tocar nada del modelo. 2 tests de integración reales (`reino.integration.test.ts`).
   - **Ampliado y CERRADO**: el Cuartel Avanzado TAMBIÉN genera su propia zona-interior, mismo
     patrón pero de menor escala ("base secundaria", decisión explícita de Álvaro: "mismo patrón
     pero menos tamaño... la capital reúne la gran mayoría de edificios y es superior a un
     cuartel") — slug `cuartel-avanzado-interior-<building.id>`, 1 parcela `AVANZADA` central ya
     ocupada por el propio Cuartel + 1 `BASICA` (la mitad que la Capital, cifra de partida que
     crecerá con más variedad de edificios). Enganchado en `turnResolution.ts`, mismo bloque que
     crea el `Building` real del Cuartel.
4. **Mejora de Ayuntamiento NO crea Location nueva** — **CERRADO, ya era así de antes de tocar
   nada** (`turnResolution.ts`, rama `buildRecipe.upgradesRecipeKey`): misma fila de siempre (mismo
   `id`/`slug`), solo cambia `tier` — coherente con lo decidido. El "cambia el fondo/PNG según
   nivel" es responsabilidad del frontend/generador de imagen (mismo slug, prompt por nivel),
   ningún cambio de schema hace falta para esto tampoco.
5. **Concepto de "parcela" estilo Travian/Tribal Wars — CERRADO, backend completo y verificado
   contra Postgres real.** Modelo `Parcela` propio (no `ZonePoint`: una parcela es un hueco PASIVO
   que existe antes de que haya nada construido, ciclo de vida "vacía → `buildingId` relleno",
   nunca se mueve ni se agota — mezclarlo con `ZonePoint` habría forzado campos sin sentido como
   `ruta`/`cantidad`/`activo`). Vive en la MISMA `Location`-interior dinámica de la pieza 3 (hereda
   su ámbito por-partida sin necesitar `saveId`/`factionId` propios):
   - `Parcela.tipo: 'BASICA' | 'AVANZADA'`, posición fija (`x`/`y`, mismo lienzo 800×600).
   - `BASICA`: repetible, sin `recipeKeyFijo` — el jugador elige entre las recetas candidatas que
     apliquen (hoy solo la Choza; genérico por diseño, `candidateRecipesForBasica()` no necesita
     tocarse cuando haya más variedad).
   - `AVANZADA`: `recipeKeyFijo` (directo a `ConstructionRecipe.key`, sin inventar catálogo
     paralelo) siempre relleno — el jugador NO elige, la posición ya decide qué se construye ahí.
   - `Parcela.buildingId` (único, `onDelete: SetNull`) enlaza el `Building` real una vez construido.
   - Al fundar el reino (`reino.ts`) se siembran 4 parcelas en la Capital: 1 `AVANZADA` en el centro
     (400,300) YA OCUPADA por el Ayuntamiento recién construido (nunca queda vacía, fundar es
     posterior a construir) + 3 `BASICA` vacías alrededor — primera pasada deliberadamente modesta
     (poca variedad de edificios todavía).
   - Flujo real cerrado con Álvaro: mover hasta 1 celda de la parcela → clic en su icono → modal
     con descripción + botón "Construir" (habilitado/deshabilitado según condiciones, motivo
     mostrado si no se cumplen). Construir es DIRECTO — sin `/turn/narrate`, sin LLM (mismo
     criterio que "Descansar en campamento": ya se sabe EXACTAMENTE qué y dónde) — con un
     `LogEntry` determinista rico en datos concretos (qué se construyó, en qué asentamiento, quién)
     en el canal `WORLD` (mismo canal que `worldAgenda.ts` para hechos de reino, no `CHARACTER`).
   - Backend: `GET /saves/:id/parcelas/:parcelaId` (estado + candidatas con su `blockedReason`
     real, reutilizando `constructionRecipeStatusFor` — extraída de `recipesStatus.ts` para
     compartir el mismo cálculo sin duplicar criterio) + `POST .../construir` (consumo real de
     materiales, crea `Building` en la posición exacta de la parcela, enlaza `buildingId`, narra el
     `LogEntry`). 7 tests de integración reales contra Postgres (`parcelas.integration.test.ts`),
     sin mocks — incluida la ruta feliz completa (consumo de inventario verificado exacto).
   - **Frontend hecho (2026-09-22):** icono de parcela en el mapa de Zona y `ParcelaDetailModal`.
6. **Imágenes/prompts** — reparto de trabajo cerrado explícitamente con Álvaro (ver memoria
   `tarkor_feedback_generacion_imagenes_es_cosa_del_usuario`): Claude SÍ escribe/actualiza el TEXTO
   de los prompts (trabajo de contenido normal); Álvaro genera la imagen real y la sube. **Sin
   tocar todavía** — ninguna pieza de backend de § 7.4 lo necesitó (el sistema de `ImagePrompt` ya
   resuelve por slug sin campo nuevo de schema). Cada nivel de Ayuntamiento/Cuartel necesitará su
   propio PNG con los huecos de parcela exactos ya compuestos para ese nivel — pendiente para
   cuando Álvaro lo pida.
7. **Enganchar el evento `EXPANSION_TERRITORIAL_AGRESIVA`** (§ 7.3) a la construcción real de un
   Cuartel Avanzado en región ajena a otra Faction — **CERRADO, verificado contra Postgres real.**
   `turnResolution.ts`, mismo bloque que crea el `Building` real del Cuartel: si `activeRegion`
   tiene una `Faction` dueña real (`REGION_OWNING_FACTIONS`) DISTINTA de la propia facción del
   jugador, dispara `recordFactionEvent(..., 'EXPANSION_TERRITORIAL_AGRESIVA')` — primer caller
   real de todo el motor de eventos de § 7.3, que hasta ahora estaba escrito y testeado pero sin
   ningún sitio que lo llamara en producción. Test de integración real
   (`cuartelAvanzadoTerritorial.integration.test.ts`, turno completo vía `/turn/classify` +
   `/turn/narrate`, LLM mockeado): construir en Cristal Helado (dueño real Clan Helsig) sube
   `FactionRelation.presion` de 50 (neutro) a 65, cruzando a banda `TENSION` con un solo evento.

**§ 7.4 completo** (piezas 1-5 y 7), con frontend desde el 2026-09-22. Queda la pieza 6 (prompts
de imagen por nivel, cuando Álvaro quiera generarlas) y un botón directo para el Cuartel Avanzado,
que hoy solo se construye por texto libre.

---

