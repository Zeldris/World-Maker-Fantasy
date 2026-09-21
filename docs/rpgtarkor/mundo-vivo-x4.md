# Un mundo con vida propia, estilo X4 Foundations — sin LLM decidiendo

[← Volver al índice del mundo](../07-mundo-helek-sirik.md)

*Sesión de DISEÑO (2026-09-21, autora/Claude) — sin tocar código todavía. Documento vivo: se
amplía en próximas sesiones a medida que se cierran más piezas. Objetivo declarado por la autora:
"vamos a analizar con todo lo que tenemos construido qué posibilidades nos da... y si de verdad lo
podemos cumplir creo que el único modelo que vamos a necesitar añadir es el que modifica y crea
lore mientras juegas". Continúa el principio rector de [mundo-determinista.md](mundo-determinista.md)
("el LLM narra, nunca decide") llevándolo un paso más allá: no solo que el LLM no decida, sino que
el propio MOTOR determinista tenga capas de reglas suficientes para sentirse vivo sin necesitar
ningún modelo en el bucle de decisión. Tres rondas de grounding con agentes (§ 2.1-2.8 inicial,
§ 2.9 auditoría de completitud) — todo lo citado en este documento está verificado contra el
código real, con archivo:línea, no contra memoria del proyecto. **Mandato explícito de la autora
para el criterio de diseño de este documento: priorizar fidelidad al modelo X4/generalidad sobre
coste de migración — si hay que tocar código de producción para llegar a un resultado más
correcto/completo, se hace; solo se respeta el diseño actual sin tocarlo cuando ESO TAMBIÉN llega
al mismo resultado.** No cerrar ni empezar a implementar hasta resolver o nombrar explícitamente
todo punto abierto (§ 5) — instrucción explícita de la autora.*

---

## 1. A qué queremos llegar

**Referencia de diseño explícita: X4 Foundations / Stellaris**, no como inspiración vaga sino como
prueba de que esto se puede hacer entero sin LLM. En esos juegos, la sensación de que las
facciones/NPC "tienen vida" y "deciden" no viene de que algo razone en lenguaje natural — viene de
tres piezas puramente mecánicas:

1. **Volumen y variedad de reglas, no inteligencia de la regla.** Muchas reglas pequeñas
   evaluándose constantemente (`if condición → acción`), no una IA "pensando". Con suficientes
   reglas encadenadas, el resultado observado parece intención.
2. **El "cuándo" también es una regla.** Cada tipo de decisión tiene su propio cooldown/prioridad
   de reevaluación — el *timing* está tan determinado como el *qué*, nunca es un reloj libre.
3. **Ruido pseudoaleatorio con semilla, no juicio**, para romper empates — indistinguible de
   "capricho" desde fuera, pero reproducible y auditable.

**La única pieza que SÍ sería un modelo nuevo**: un generador de lore que amplíe el mundo (NPC,
sitios, hilos narrativos) mientras se juega, apoyado en el lore ya construido — para que cada
partida diverja de verdad y el mundo "siga creciendo" más allá de lo sembrado a mano. Todo lo demás
(facciones, economía, combate, movimiento, progresión) se plantea como generalización de reglas
deterministas ya existentes en el proyecto, nunca como decisión de un LLM.

---

## 2. Inventario real de lo que ya existe (2026-09-21, dos rondas de grounding con agentes)

Sin opinar todavía sobre qué falta — solo qué hay, con archivo:línea real.

### 2.1 Facciones, diplomacia, territorio

- `Faction` es un modelo Prisma real (`schema.prisma:2292-2304`): `worldId`, `saveId?` (null =
  catálogo de mundo; relleno = facción fundada en esa partida al construir Ayuntamiento tier 1),
  `slug`, `name`, `raza`, `description`. **Sin FK con `Npc.faction`** — el enganche es por igualdad
  exacta de `name`, a propósito (mismo criterio laxo que `Npc.raza`).
- Reputación: `WorldState.factionsStatus` (`schema.prisma:737`, Json facción→valor 0-5000, 2500
  neutro). `reputation.ts` — deltas asimétricos por evento (atacar -150, paz +30, capturar -100,
  clemencia -50, líneas 15-29). `effectiveTemperamento()` (líneas 71-79) desplaza el temperamento
  de catálogo del NPC según la banda de reputación de su facción.
- Territorio: `REGION_OWNING_FACTIONS` (`reputation.ts:89-97`) — mapa FIJO hardcodeado de
  región→facción(es) dueña(s), "no existe ninguna tabla real de región→facción en BD" (comentario
  explícito). `regionControlFor()` (`worldAgenda.ts:105-117`) calcula el estado
  (`NEUTRAL_O_DUENO_ORIGINAL`/`EN_DISPUTA`/`CONQUISTADA`) **en caliente cada vez, nunca persistido**
  — solo 2 regiones tienen "defensor" real definido (`REGION_DEFENSOR`, líneas 93-96: Cristal
  Helado→Clan Helsig, Ciénaga Troncal→Clan Goshg).
- Guerra: `worldAgenda.ts` completo es UN SOLO conflicto hardcodeado
  (`CONFLICTO_ID = 'conflicto-serhu-concordia-vs-helsig-goshg'`, línea 44) — Clan Serhu + Concordia
  de Hierro vs. Clan Helsig + Clan Goshg, 5 etapas fijas (`STAGE_FACTS`, líneas 49-55), avanza sola
  cada 7 días de ficción si nadie interviene (`advanceWorldAgenda()`, líneas 159-218), depleciona
  población real de los bandos perdedores (`POBLACION_PERDIDA_POR_ETAPA = 20`, línea 39). **Es la
  prueba de concepto de que "guerra entre facciones" es viable aquí — hoy solo hay una, no un
  sistema genérico que cualquier par de facciones pueda disparar.**
- `FactionBuilding` (`schema.prisma:2314+`) — edificio de facción NPC, catálogo estático puro
  (siempre `worldId`, nunca `saveId`), el jugador solo lo visita, nunca produce ni consume nada.

### 2.2 Economía / población

- `WorldPopulation` (`schema.prisma:2754-2809`) — `targetType` (enum: FAUNA/RAZA/RECURSO/FLORA/
  **FACCION**), `poblacion`, `poblacionMax`, `distribucion` (Json, pesos por región), cooldowns de
  caza/recolección. Es del `World`, no de la `Save` — compartida entre partidas del mismo mundo.
- `growAllPopulations()` (`population.ts:114-145`) — crecimiento prorrateado por tiempo real desde
  `updatedAt`, tasa por tipo (`GROWTH_RATE_PER_DAY`, líneas 17-30). **`FACCION` tiene tasa definida
  (0.003/día) pero el propio comentario dice "todavía sin ninguna fila sembrada"** — pieza a medio
  construir, no inventada de cero.
- No existe ningún comercio/flujo de recursos entre regiones o facciones. `Building`/`KingdomStats`/
  `Territory` son exclusivamente del reino del JUGADOR (`kingdomTick.ts`) — es el único sistema
  económico real con producción/consumo; las facciones NPC no producen nada.

### 2.3 Compañeros / NPC con agencia propia

- `Companion` (`schema.prisma:985-1062`) — combate, Felicidad/Hambre/Sed, rol de Reino
  (`rolReino: 'guardia'|'trabajador'|'productor'`, string libre), slot de grupo. Enteramente
  reactivo a acción del jugador o al tick de fondo (Hambre/Sed pasivas) — no decide nada por sí
  mismo.
- `NpcState` (`schema.prisma:2369-2494`) — condición física, energía, saqueo, captura, posición en
  Zona, ausencia temporal. Estado reactivo persistido, no motor de decisión.
- **Ningún NPC/compañero/facción decide nada de forma autónoma** fuera del guion fijo del único
  conflicto de `worldAgenda.ts`. Todo lo demás requiere que el jugador actúe primero.

### 2.4 El tick de mundo (ya hay un "reloj de reglas" real)

Dos mecanismos desacoplados:

- **A) `workers/worldTick.ts`** — cron real (`setInterval`, líneas 276-278), corre sin que el
  jugador haga nada mientras el backend esté vivo (sin recuperación al reiniciar). `tick()` (líneas
  250-264): resuelve tránsitos vencidos → `growAllPopulations` → `advanceWorldAgenda` →
  `advanceCompanionSurvival` → `advancePlayerSurvival`.
- **B) Dentro de `turnResolution.ts`** (ligado al turno del jugador) — al cruzar medianoche de
  ficción: `tickKingdomOneDay()` (economía del Reino) y `territoryPopulationDelta()` (consolidación/
  rebelión de `Territory` tras 7 días en banda alta/baja de Felicidad).
- No se recalcula automáticamente: posición de NPC en Zona fuera de movimiento por turno del
  jugador. **Corrección tras tercera ronda de auditoría (2026-09-21):** clima/estación NO son
  puramente descriptivos — ver § 2.9, sí tienen efecto mecánico real (gating de recolección/
  crafteo), aunque no corren solos en ningún tick, se recalculan bajo demanda por minuto de ficción.

### 2.5 Sistema de lore / RAG

- `SessionFact` (`worldFacts.ts`) — RAG de hechos de LA PARTIDA EN CURSO, embeddings 768d, mezcla
  recencia + similitud semántica. Corre en tiempo real, cada turno. **No es lore de mundo nuevo,
  es memoria de lo que ya pasó en esta partida.**
- `LoreChunk` (`schema.prisma:1335+`) — lore de mundo ESTÁTICO, escrito a mano en
  `scripts/loreChunks.ts` (543 líneas), reindexado con `npm run reindex-lore`. **Corre en tiempo de
  diseño/setup, nunca durante la partida.**
- No existe ningún comando/script que genere lore nuevo con LLM y lo persista de forma reutilizable
  entre partidas. `worldCatalog.ts` (10087 líneas) es también catálogo sembrado a mano, tiempo de
  diseño. **Este es el hueco real y genuino — la única pieza que de verdad no existe todavía.**

### 2.6 IA de combate NPC

- **Elección de OBJETIVO** (`combateMultiple.ts`) — `INTELIGENCIA_TACTICA_UMBRAL = 12` (línea 78).
  `elegirObjetivo()` (líneas 138-148): INT < 12 → objetivo aleatorio; INT ≥ 12 → siempre el más
  herido (por `ORDEN_CONDICION`). **Única rama real ligada a Inteligencia en todo el motor de
  combate.** Objetivos secundarios de efectos MULTIPLE/AREA (`objetivoExtraFor`/`objetivosExtraFor`)
  son SIEMPRE aleatorios, nunca miran Inteligencia (comentario explícito línea 153).
- **Elección de HABILIDAD** (`npcCombatAbilities.ts`, `chooseNpcAbility`, líneas 254-294) — **no usa
  Inteligencia en absoluto**. Defendiendo: 70% rol defensa/utilidad, 30% azar puro sobre todo el
  roster. Atacando: solo rol ataque, con fallback que ignora coste de energía si nada es asequible.
  Todo `Math.random()` sin ningún peso por atributo, nivel, o daño esperado.
- No hay curación en combate (el efecto `RECUPERACION` de habilidades regenera energía, no vida —
  y su elección sigue el mismo azar 70/30, no una lógica de "estoy herido").
- No hay uso de objetos/consumibles por parte de NPC en combate — no existe ningún camino de código
  para ello.
- No hay huida de NPC — las únicas menciones de "huir" en todo el motor de combate son sobre el
  jugador, nunca un NPC decidiendo escapar.
- AUMENTO/DEBILIDAD/CANALIZAR ya existen como mecánica real (`classAbilityUnlocksForClase`,
  `combateMultipleOrquestacion.ts`), pero qué habilidad los dispara la decide el mismo azar 70/30 —
  ningún NPC "combina" efectos con criterio.

### 2.7 Movimiento en Zona

- Más rico de lo esperado: `movementTemplates.ts` — `siguienteCeldaDeZonePoint()` (líneas 348-379)
  resuelve por prioridad: (1) persecución si AGRESIVO/ENEMIGO con jugador a ≤2 celdas Chebyshev; (2)
  plantilla ESPECÍFICA curada a mano (3 entradas hoy); (3) plantilla GENERAL inferida de
  `faunaCategoria`/`role`/`temperamento`/`medio` — 5 plantillas: `ESTATICO` (Maestros/jefes),
  `TERRITORIO_CORTO` (default), `MANADA_AMPLIA` (radio 3), `PATRULLA_BREVE` (ida-vuelta, role
  matchea "guardia/patrulla/centinela"), `ORBITA_AEREA` (medio AEREO).
- La elección de plantilla es una función PURA de datos de catálogo (categoría/rol/temperamento/
  medio) — fija por NPC/especie, **nunca mira estado dinámico** (vida, hambre, hora del día más
  allá del filtro de fauna nocturna ya existente). La única señal dinámica real es la persecución
  por proximidad.

### 2.8 Profesiones, talento/clases, nivel, energía

Patrón repetido en los 4: tablas de umbral fijas o fórmulas lineales de un solo input, sin ninguna
rama condicional sobre estado de juego más allá de "¿superó el umbral?".

- **Profesiones** (`ProfessionProgress`, `professionProgress.ts`, 48 líneas) — tabla fija de 9
  umbrales de XP (`PROFESSION_LEVEL_THRESHOLDS`), XP por craftear según tier de receta
  (`XP_BY_TIER`). Sin concepto de especialización/rama dentro de un oficio ya aprendido — cada
  combo raza+región+oficio es un `professionId` distinto elegido AL CREAR el personaje, no una
  ramificación en vivo.
- **Clases/talento** (`classAbilities.ts`, 4529 líneas) — 9 clases, tronco común (niveles 1-8
  automático) + 4 especializaciones por clase con huecos reales (12/16/19/24/28/32/36/40). SÍ hay
  elección real del jugador (`PATCH /saves/:id/especializacion`, una sola vez, no respec libre). Un
  NPC de catálogo SÍ puede tener clase+especialización (mismo roster que el jugador), pero viene
  precargado de catálogo — no hay NPC "subiendo de nivel y eligiendo especialización en vivo". Un
  `Companion` NO tiene clase/especialización/nivel propios en absoluto.
- **Nivel** (`progression.ts`) — tabla D&D 5e literal para niveles 1-20 (`DND_LEVEL_THRESHOLDS`),
  extensión lineal creciente propia del proyecto más allá del 20. `MAX_LEVEL = 40` (objetivo
  declarado 100). `maxCombatAbilitiesFor(level)` es una fórmula de 2 tramos fija.
  `attributeCapForLevel` tope base 18 +1 por ASI extra.
- **Energía** (`energy.ts`, 98 líneas, completo) — `energiaMaxFor(CON) = 50 + CON*3`, fórmula
  lineal de UN solo atributo. Costes fijos por tramo de habilidad, restauración de descanso fija
  (30). Todo aditivo/clamp, "puro, sin IA" (comentario explícito del propio archivo). Documentado
  que hoy solo aplica de verdad al jugador — los NPC no tienen fórmula de tope de energía propia
  confirmada.

### 2.9 Tercera ronda de auditoría (2026-09-21) — completitud, qué se había quedado fuera

Petición explícita de la autora: "revisa bien que el doc es completo con el código que tenemos, que
no falten más cosas que ya tengamos". Hallazgos nuevos, no cubiertos en las dos rondas anteriores:

**Clima y estación — SÍ tienen efecto mecánico real, corrección sobre § 2.4.** `worldClock.ts`:
`estacionFor()`/`climaFor()` alimentan gating real de qué se puede recolectar/craftear
(`recolectar.ts`, `pasaFiltroEstacion`/`pasaFiltroClima`), no son solo prosa. `climaFor` solo tiene
datos reales para UNA región (Las Llanuras del Viento Rojo) — el resto del mundo nunca tiene clima
que bloquee nada. Ciclo de 3 días (Tormenta/Viento/Calma), 1 de cada 3 tormentas es Extrema.
**Confirmado que clima/estación NO alimentan `growAllPopulations()`** — población es indiferente al
clima hoy, aunque mecánicamente el clima ya existe y ya bloquea/habilita otras cosas.

**Misiones secundarias — hueco real, simétrico al del lore, y hoy contradice el principio rector.**
La idea de memoria "misiones principales escritas a mano vs. secundarias generadas por el motor
según condiciones de mundo" **no tiene ningún código construido**. Hoy toda misión no-inicial nace
porque el LLM propone el campo `newQuest` en su turno (`turnResolution.ts:6398-6460`) — hay
validación determinista de que el campo no esté vacío/inventado, pero la DECISIÓN de "aquí hay una
misión" la toma el modelo cada turno, no una regla de mundo evaluando condiciones (población alta →
misión de caza, exceso de recurso → misión de entrega, conflicto → misión de reputación, tal como
ya se había perfilado en sesiones previas). El único acercamiento determinista es el "gancho de
sesión" (`turnResolution.ts:4336-4350`): siempre el MISMO `LoreChunk` tipo `GANCHO` mientras no haya
misión activa, sin rotación ni condición de mundo. **Este es un segundo hueco genuino, de la misma
naturaleza que el generador de lore de § 1** — ambos son sitios donde hoy el LLM decide en vez de
narrar algo ya resuelto por el motor.

**Captura/domesticación — más rica de lo que sugería el resumen previo.** `companionSupervivencia.ts`
(`resolverIntento()`, líneas 56-90): tirada OPUESTA real (atributo del jugador vs.
`Npc.atributoResistencia`), con `reclutablePct`/`domesticablePct` de catálogo traducido a
resistencia extra (+1 por cada 10 puntos por debajo de 100% de disposición — un NPC con 5% de
disposición añade +9, "casi nunca cede por persuasión sola"). Acumula en
`NpcState.capturaFelicidad` (+15 éxito/-10 fallo), umbral 80 general o 40 si el jugador es Domador.
Precondición dura: el objetivo debe estar GRAVE/CONVALECIENTE. No depende de nada dinámico
adicional (hambre, hora del día) — solo disposición de catálogo + condición física.

**Muerte permanente — la "escala A→F" de memoria no existe en el código.** La escala real es
`CONDICION_ORDER = [ILESO, HERIDO, GRAVE, CONVALECIENTE, MUERTO]` (`death.ts:7`), 5 estados
nombrados, nunca letras — **a confirmar con la autora si "A→F" era una idea de diseño nunca
implementada o una imprecisión de memoria**, antes de asumir que hay algo más que buscar. Sí hay
descomposición real: `npcCorpseShouldDespawn()` (`death.ts:46-53`) borra el `NpcState` de un
cadáver 48h de ficción después de morir (deja de ser saqueable). Recuperación temporal:
`npcRecoversFromConvaleciente()` (líneas 39-44) — CONVALECIENTE sin decapitar 6h → vuelve a HERIDO.
**Ninguna de las dos corre en `worldTick.ts`** — solo se recalculan cuando el jugador actúa
(`turnResolution.ts:2062-2067`), así que un cadáver no desaparece "solo" mientras el jugador está
inactivo; esto es relevante para § 4.3-4.6 (si el motor de facciones debe correr en tiempo de
ficción o tiempo real, la respuesta probablemente debería ser LA MISMA para este sistema).
`limiteMuertes(dificultad)`: NOVATO sin límite, MEDIO 4, AVANZADO 2, antes de fin de partida real.

**Control regional — números exactos que faltaban.** El mundo tiene **8 regiones** en total
(`narrationLint.ts:15-24`: Ciénaga Troncal, Cristal Helado, La Meseta del Orden, El Margen
Silencioso, Las Llanuras del Viento Rojo, La Cicatriz de Cristal, El Susurro de las Raíces, La
Costa del Azabache). `REGION_OWNING_FACTIONS` tiene **4 entradas** (Llanuras→Serhu, Meseta→
Concordia, Cristal Helado→Helsig, Ciénaga Troncal→Goshg), pero solo **2 de esas 4** tienen conflicto
dinámico real vía `REGION_DEFENSOR`/`advanceWorldAgenda` (Cristal Helado, Ciénaga Troncal) — Llanuras
y Meseta quedan FIJAS con su dueño, nunca en disputa. **Las 4 regiones restantes (Margen Silencioso,
Cicatriz de Cristal, Susurro de las Raíces, Costa del Azabache) no tienen ninguna facción dueña
mecánica** — se tratan como `SIN_DUENO` siempre, el jugador puede fundar Ayuntamiento ahí sin ningún
conflicto. **Esto es relevante para § 4.3**: un motor de disputas generalizado tendría, de partida,
4 regiones completamente "libres" sin ningún actor NPC que las dispute — habrá que decidir si eso
se queda así (zonas de frontera/expansión libre para el jugador) o si el motor de facciones debería
eventualmente poder reclamar también esas 4.

**Reputación individual de NPC — no existe, confirmado.** No hay ningún campo de "este NPC concreto
recuerda/confía en ti" separado de su facción, más allá de `capturaFelicidad` (que es parte del
flujo de captura, no una relación general).

**Ningún otro tick/worker — `worldTick.ts` es de verdad el único.** Búsqueda exhaustiva de
`setInterval`/cron/workers confirma que no hay ningún otro proceso de fondo en todo el backend.

**Generación de imágenes — 100% estático, confirmado sin matices.** El pipeline es: script offline
genera solo TEXTO de prompt (vía LLM) → alguien lo usa manualmente en un generador externo → sube
el PNG a mano a `uploads/images/`. No hay ningún servicio de generación de imagen conectado, ni
ningún camino de código que produzca una imagen nueva durante la partida. Coherente con § 2.5 — es
otra pieza de contenido 100% pre-producción, igual que el lore.

---

## 3. Lectura de conjunto (sin decidir nada todavía)

- El "motor de facciones al estilo X4" **no es un proyecto nuevo** — es generalizar el patrón que
  `worldAgenda.ts` ya probó con un solo conflicto: convertirlo de "un guion hardcodeado" a "una
  máquina de reglas que cualquier par de facciones puede disparar", apoyada en el `Faction`/
  `WorldPopulation.FACCION` que ya existen pero están a medio sembrar.
- El generador de lore en vivo **sí sería la pieza genuinamente nueva** del proyecto — hoy el lore
  es 100% estático, escrito a mano antes de jugar.
- **Tercera ronda (§ 2.9) reveló un segundo hueco de la misma naturaleza: misiones secundarias.**
  Hoy toda misión no-inicial nace porque el LLM propone `newQuest` en su turno — no hay ningún
  motor de reglas de mundo decidiendo "aquí corresponde una misión". Es simétrico al hueco del lore
  y probablemente debería diseñarse junto a él (ambos son sitios donde el LLM decide hoy en vez de
  narrar algo ya resuelto — ver punto 7 de § 5).
- De los 5 frentes de "hacerlo más inteligente" que añadió la autora (combate NPC, movimiento en
  Zona, profesiones, talento/nivel, energía), **combate NPC tiene el hueco más grande** (una sola
  rama de decisión real, sin curación/objetos/huida/combos) y además **ya tiene un umbral de
  Inteligencia parcialmente construido** (`INTELIGENCIA_TACTICA_UMBRAL = 12`) — candidato natural
  para diseñar primero a fondo cuando se retome esta sesión.
- Movimiento en Zona es más maduro de lo esperado (5 plantillas reales) — el margen de mejora es
  más acotado: añadir señales dinámicas (vida, hambre) encima de las plantillas ya elegidas, no
  reescribirlas.
- Profesiones/talento/nivel/energía comparten el mismo patrón de curvas deterministas de un solo
  input — la "vida" ahí no vendría de más lógica de decisión (no hay decisión que tomar, son curvas
  de progreso), sino de que esas curvas reaccionen a más variables de estado real.

---

## 4. Ampliación de alcance (2026-09-21, misma sesión) — el kit completo estilo X4 para facciones

La autora amplió explícitamente la petición inicial de "facciones" a: construcciones, calidad de
vida, consumo de alimentos/objetos, partidas de recolección, partidas de exploración, diplomacia
comercial, diplomacia coordinada de guerra, alianzas, mercado regulado, sistema de reproducción.

Mandato explícito de la autora para este documento: **"logrando el resultado más generalista y
modulable posible, respetando el diseño actual solo si eso también llega al resultado — pero si
hay que extraer o paralelizar algo para que sea más correcto y más completo y más cercano a la idea
de X4 Foundations, aunque sea costoso o toque cosas de producción, quiero que lo hagas. No busques
el camino fácil."** Es decir: el criterio de diseño de abajo prioriza fidelidad al modelo/
generalidad sobre coste de migración — cuando un patrón ya existente (atado 1:1 al jugador) y un
patrón generalizado (reutilizable por jugador Y facción) compiten, se elige el generalizado.

### 4.1 Mapa de reutilización real, pieza por pieza (grounding 2026-09-21, segunda ronda)

| Pieza pedida | Gemelo real hoy | Estado de acoplamiento a `Save` | Coste de generalizar |
|---|---|---|---|
| Construcciones | `Building`+`ConstructionRecipe` (`construction.ts`) | `Building.saveId` obligatorio, sin `factionId` | Migración de schema real |
| Calidad de vida/consumo | `KingdomStats`+`tickKingdomOneDay` (`kingdomTick.ts:66-88`) | `KingdomStats.saveId` **único** (1:1 estricto) | Migración de schema real — el `@unique` en sí mismo asume "un reino por Save" |
| Territorio | `Territory` (`TerritoryControl` enum) | Atado a `Save` vía `Building`/relación | Migración de schema real |
| Recolección (expediciones) | `candidateSourcesFor` (`recolectar.ts:241`) | **Ya es pura** — no depende de `Save`, solo de `worldId`/región/estación/clima/nivel de oficio numérico | Bajo — reutilizable casi tal cual |
| Recolección (tirada real) | `gatheringRollFor` (`recolectar.ts:440-448`) | Exige `attributes`/`secondaryAttributesJson`/`inventoryItems`/`professionProgress` de un `Save` | Medio — hace falta sintetizar estos 4 inputs para una facción sin personaje real |
| Exploración | `resolveTravel`/`resolveTravelPath` (`travel.ts:353`) | Exige `attributes` de un personaje; sin concepto de "grupo/expedición" en absoluto | Medio-alto — pieza nueva de "grupo viajando", no solo generalizar |
| Comercio | Prácticamente nada — `valorGoirnosBaseFor` (`economia.ts:77-94`) es la única fórmula de precio, fija por tabla, sin oferta/demanda; única transacción real es aprender oficio (`learnProfession.ts`) | N/A | Alto — no hay compraventa que generalizar, hay que construirla |
| Diplomacia/alianzas | Solo `factionsStatus` numérico (jugador↔facción) + el conflicto hardcodeado de `worldAgenda.ts` sin estructura de datos | `Faction` no tiene ningún campo de relación con otra `Faction` | Alto — no existe modelo `FactionRelation`, hay que crearlo desde cero |
| Reproducción poblacional | `growAllPopulations()` (`population.ts:114-146`), agregado, ya corre en `worldTick.ts` cada 2 min reales | Ya vive en `World`, no en `Save` — no necesita generalizarse, ya es "de facción" en potencia | Bajo — falta sembrar filas `FACCION` y decidir qué representan |

Hallazgo transversal importante: **`FactionBuilding` (`schema.prisma:2314+`) ya nació pensado para
facciones NPC, pero es el patrón CONTRARIO al que queremos** — catálogo estático puro, nunca
produce/consume, el jugador solo lo visita. No es una base para "vida" de facción, es decoración de
mapa. Se puede reconsiderar su rol una vez exista `Building.factionId` (ver 4.2) — probablemente
`FactionBuilding` queda como estaba (edificios ambientales sembrados a mano, sin lógica) y la
economía real de facción vive en `Building`/`KingdomStats` generalizados, o bien `FactionBuilding`
se retira en favor del modelo único generalizado. **Punto abierto, ver § 5.**

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

### 4.3 Generalización de `worldAgenda.ts` — de un conflicto hardcodeado a un motor de disputas

Hoy: un único `CONFLICTO_ID` fijo, con 5 `STAGE_FACTS` de texto escritos a mano, bandos fijos
(Serhu+Concordia vs. Helsig+Goshg), que avanza por tiempo puro sin ninguna condición de disparo
real (siempre está "en marcha" desde el principio de cualquier partida).

Propuesta de generalización (a validar en sesión de implementación, aquí solo se deja planteada la
forma):

- Nuevo modelo `FactionRelation` (o `FactionConflict`, nombre a decidir) — par de facciones
  (`factionAId`, `factionBId`), tipo de relación (`NEUTRAL`/`TENSION`/`GUERRA`/`ALIANZA`/
  `TRATADO_COMERCIAL`), un valor numérico de "presión" (equivalente a `factionsStatus` pero entre
  dos facciones NPC, no jugador↔facción), y opcionalmente una etapa (mismo concepto que
  `STAGE_FACTS` hoy, pero generado por plantilla en vez de 5 líneas fijas por conflicto).
- Condiciones de disparo de un conflicto NUEVO (no el único ya existente) — candidatas a decidir en
  implementación: choque de expansión territorial (dos facciones reclamando la misma región vía el
  `Territory` ya generalizado en 4.2), presión acumulada por reputación cruzada, o ambas a la vez
  con pesos.
- El conflicto Serhu/Concordia vs. Helsig/Goshg actual se convierte en la PRIMERA fila real de este
  sistema genérico (dato, no código especial) — su texto narrativo curado a mano se conserva como
  contenido, pero el motor que lo avanza deja de ser una función dedicada a ese único caso.

### 4.4 Diplomacia comercial / mercado regulado — la pieza más vacía, la que más hay que construir

No hay nada que generalizar aquí — es la única pieza de las 10 citadas por la autora que no tiene
ningún gemelo real, ni siquiera parcial. Puntos a diseñar en la sesión de implementación:

- ¿Precio dinámico real (oferta/demanda por región, alimentado por `WorldPopulation`/producción de
  facción) o un rango fijo con variación pseudoaleatoria con semilla (más barato de simular, más
  cercano al resto del proyecto que ya usa este patrón para combate)?
- ¿El jugador puede comerciar directamente con una facción (comprar/vender en su mercado), o el
  "mercado regulado" es puramente entre facciones NPC (economía de fondo, el jugador nunca lo ve
  directamente salvo por sus efectos)?
- Relación con `valorGoirnosBaseFor` (`economia.ts`) — ¿se reutiliza como precio BASE sobre el que
  el mercado regulado aplica su fluctuación, o el mercado tiene su propia tabla independiente?

### 4.5 Expediciones de recolección/exploración de facción

Reutilizando el mapa de 4.1: la mitad recolectora (`candidateSourcesFor`) ya es pura y reutilizable
sin cambios. La tirada real (`gatheringRollFor`) y el viaje (`resolveTravel`) exigen datos de un
`Save` real (atributos, inventario, nivel de oficio) que una facción no tiene por definición — hace
falta decidir cómo una facción "tiene" estos inputs sintéticos:

- ¿Cada facción tiene un `attributes`/nivel de oficio AGREGADO propio (un solo número que
  representa "la habilidad recolectora media de la facción"), o las expediciones se resuelven a
  nivel de un `Npc` concreto de esa facción (reutilizando 100% el mismo camino que ya usa el
  jugador, con un NPC real en vez de `Save`)?
- El concepto de "grupo/expedición" no existe en absoluto hoy (ni para jugador ni para NPC) — es
  pieza nueva sin importar la decisión anterior. Candidato de diseño: mismo patrón que ya existe
  para combate múltiple (`CombatParticipant`/grupos, `companeros.ts`) pero aplicado a viaje/
  recolección en vez de combate.

### 4.6 Reproducción poblacional — el más barato de cerrar

`growAllPopulations()` ya corre en tiempo real, agregado, sin depender de `Save`. Lo único que
falta es decidir qué CAMPO de una facción usa esta población — no es solo "sembrar `FACCION`
como tipo", como decía el punto 3 original, sino decidir su semántica: ¿población militar
(alimenta cuántos "soldados" puede poner una facción en un conflicto vía `FactionRelation`),
población civil (alimenta `KingdomStats.poblacion` del reino de esa facción, si 4.2 se implementa),
o ambas como campos separados de la misma fila `WorldPopulation`?

---

## 5. Puntos abiertos — a resolver ANTES de cerrar el documento e implementar

Mandato explícito de la autora: si algo queda abierto o merece hablarse, incluirlo aquí y discutirlo
antes de cerrar. Lista completa, sin resolver todavía:

1. **`FactionBuilding` vs. `Building.factionId` generalizado** — ¿coexisten con roles distintos
   (uno decorativo/catálogo, el otro con lógica real), o `FactionBuilding` se retira una vez exista
   el modelo generalizado? Si coexisten, hay que decidir la regla de qué hace que un edificio de
   facción sea uno u otro tipo (¿todo edificio de facción sembrado a mano en catálogo es
   `FactionBuilding`, y solo los que "nacen" en vivo por decisión del motor de facción son
   `Building.factionId`?).
2. **Constraint XOR de `saveId`/`factionId`** — Prisma no expresa "exactamente uno de dos campos
   opcionales" de forma nativa. Hay que decidir si se aplica solo a nivel de servicio (como ya se
   hace con otras invariantes del proyecto, ej. `ZonePoint`/`FactionBuilding` "string libre en vez
   de FK, a propósito") o si merece una migración SQL con `CHECK constraint` explícito — más
   seguro, pero el proyecto no usa `CHECK` constraints hoy en ningún otro sitio (a confirmar).
3. **`WorldPopulation` es de `World`, no de `Save`** — ya compartida entre partidas del mismo
   mundo, con una limitación ya documentada en el código ("el diseño asume una sola partida activa
   real", `characterName: 'Gorhorn'` hardcodeado en varios sitios). Si las facciones ahora tienen
   `Building`/`KingdomStats` reales, ¿esos también son de `World` (compartidos entre partidas,
   como `WorldPopulation`) o de `Save` (cada partida tiene su propia versión del mundo de
   facciones, divergiendo desde el turno 1)? Esto es una decisión de fondo sobre qué significa
   "partida" en este proyecto, no un detalle técnico — cambia radicalmente el alcance.
4. **Frecuencia del tick de facción** — `worldTick.ts` corre cada 2 minutos REALES (no de ficción),
   pensado para población/agenda/supervivencia, procesos baratos. Un motor de facción completo
   (construcción, comercio, diplomacia, expediciones) por cada facción del mundo cada 2 minutos
   reales puede ser mucho más caro computacionalmente — ¿mismo tick, un tick propio más lento, o
   trasladar TODO (incluido lo que hoy vive dentro del turno del jugador, `tickKingdomOneDay`) a
   avanzar por tiempo de FICCIÓN cruzado en vez de tiempo real, unificando el criterio?
5. **Qué NPC representa a una facción para efectos de Inteligencia/autonomía** — se estableció que
   "cuanto más alta la Inteligencia, más autónoma la entidad", aplicado tanto a un NPC individual en
   combate como a una facción entera decidiendo construir/comerciar/declarar guerra. Falta decidir
   qué Inteligencia usa una facción: ¿la de su líder/consejo (un `Npc` concreto con `kind:
   'PRINCIPAL'`), un promedio de sus NPC conocidos, o un valor propio de `Faction` desacoplado de
   cualquier NPC individual?
6. **Alcance de "diplomacia comercial" vs. "mercado regulado"** — la autora los citó como dos
   conceptos separados. ¿Diplomacia comercial es el ACUERDO entre dos facciones (tratado, vía
   `FactionRelation`) y mercado regulado es la EJECUCIÓN de ese acuerdo (flujo real de bienes/
   precio), o son dos sistemas independientes que no necesariamente se tocan?
7. **Relación entre este sistema, el generador de lore en vivo (§ 1) Y el motor de misiones
   secundarias (§ 2.9)** — los tres comparten la misma naturaleza: hoy el LLM decide libremente
   (qué lore contar, qué misión ofrecer), y en ambos casos la generalización correcta sería que el
   MOTOR decida (a partir de eventos discretos del mundo — guerra que termina, alianza firmada,
   exceso de población, conflicto territorial) y el LLM solo narre el resultado. Probablemente los
   tres deberían diseñarse como una sola pieza ("motor de eventos de mundo con nombre, que tanto el
   lore como las misiones consumen"), no tres sistemas independientes — a decidir explícitamente en
   la sesión de implementación, no aquí.
8. **IA de combate NPC (heredado de la sesión anterior, sigue abierto)** — los 3 tramos de
   Inteligencia propuestos (< 10 / 10-20 / 20+) y cómo encajan con el `INTELIGENCIA_TACTICA_UMBRAL
   = 12` ya existente. No se ha tocado en esta ronda de ampliación — sigue pendiente de diseñar a
   fondo.
9. **Movimiento en Zona, Profesiones/talento/nivel/energía (heredado)** — señales dinámicas que
   faltan y qué variable de estado real alimentaría cada curva hoy plana. Tampoco se ha tocado en
   esta ronda — sigue pendiente.
10. **"Muerte permanente A→F" de memoria del proyecto no tiene ningún rastro en el código** — la
    escala real son 5 estados nombrados (`ILESO→HERIDO→GRAVE→CONVALECIENTE→MUERTO`), nunca letras.
    **Confirmar con la autora** si era una idea de diseño nunca implementada (y en ese caso, qué
    representaba — quizás una escala de severidad de herida más granular) o una imprecisión de
    memoria, antes de dar el sistema de muerte por completamente inventariado.
11. **Descomposición de cadáver (`npcCorpseShouldDespawn`, 48h) y recuperación de CONVALECIENTE
    (6h) solo se recalculan cuando el jugador actúa, nunca en `worldTick.ts`** — mismo tipo de
    pregunta que el punto 4 (frecuencia del tick de facción): si el motor de facciones pasa a vivir
    en tiempo de ficción real e independiente del jugador, ¿estos dos sistemas de muerte/
    recuperación deberían unificarse al mismo criterio (mover a `worldTick.ts`), o se quedan como
    están porque no son parte del "mundo vivo" en el mismo sentido (son estado de UN NPC concreto
    ya resuelto, no una entidad tomando decisiones nuevas)?
12. **4 de las 8 regiones del mundo no tienen ninguna facción dueña mecánica** (El Margen
    Silencioso, La Cicatriz de Cristal, El Susurro de las Raíces, La Costa del Azabache — siempre
    `SIN_DUENO`, el jugador puede fundar ahí sin conflicto). Si se generaliza `worldAgenda.ts` a un
    motor de disputas real (§ 4.3), ¿esas 4 regiones deberían poder entrar en juego para las
    facciones NPC también (dándoles sitio para expandirse de verdad, más fiel a X4 donde CUALQUIER
    territorio puede disputarse), o se mantienen deliberadamente como "frontera libre" reservada
    para el jugador?
13. **Clima solo tiene datos reales para 1 de las 8 regiones** (Las Llanuras del Viento Rojo) — si
    el motor de facciones/expediciones (§ 4.5) empieza a depender de clima/estación para decidir
    cuándo una facción puede recolectar/comerciar, ¿hace falta ampliar `climaFor` a más regiones
    primero, o el motor de facciones se diseña para funcionar igual de bien con clima ausente
    (`null`) en la mayoría del mundo?

---

## 7. Sesión de IMPLEMENTACIÓN (2026-09-21, misma fecha, continuación) — §4.2 y §4.3 cerrados, §4.3-bis en diseño

Retomada la misma tarde con mandato explícito de Álvaro: "lee mundo-vivo-x4 y vamos con esa
implementación". Puntos abiertos de § 5 resueltos uno a uno según se necesitaban (no todos de
golpe) — quedan registrados abajo en el orden real en que se cerraron.

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

### 7.2 Líder de facción — CERRADO

Punto abierto #5 (Inteligencia de facción): **la de su líder de GOBIERNO** (Terk'ikar/equivalente,
no el de guerra — decisión explícita de Álvaro, contra la recomendación de Claude de un campo
propio desacoplado). `Faction.liderNpcId` (FK real a `Npc`, a diferencia de `Npc.faction`/
`FactionBuilding.factionSlug` que son string libre — aquí sí hay una referencia estable real,
ambos catálogo del mismo `World`).

Hallazgo real: cada facción tiene DOS líderes de lore (gobierno + guerra) y **Clan Goshg no tenía
ningún NPC real sembrado** (solo prosa en `Location`/`Faction.description`). Resuelto sembrando
`doshka`/`dulgren` en `worldCatalog.ts` (mismo shape que Brenka/Solgra de Helsig, `nucleoJugable:
false` — fuera del núcleo jugable actual, coherente con su región). Líderes reales sembrados:
Serhu→Ulkha Ketg (Int 20), Helsig→Brenka (16), Goshg→Doshka (15), Concordia→Yovenne Tal (15).

### 7.3 Motor de eventos de `FactionRelation` — CERRADO (diseño + código base), sin enganchar a eventos reales todavía

Punto abierto #6 (disparo de disputas): **reemplaza** el avance automático por tiempo puro del
`CONFLICTO_ID` original (decisión explícita de Álvaro). Forma final, cerrada tras contrastar con
el modelo real de X4 (Claude verificó cómo funciona X4 de verdad antes de proponer números):
**híbrido X4 + reputación estilo WoW**, no ambiente continuo:

- `FactionRelation` (nuevo modelo, DIRIGIDA a propósito — `sourceFactionId`→`targetFactionId`,
  nunca simétrica; decisión de Álvaro: "lo más completo y genérico para ampliar", against la
  opción simétrica más simple que Claude recomendó primero).
- `presion` 0-100 (50 = neutro) sube/baja por EVENTOS DISCRETOS con peso propio (estilo X4 real:
  sucesos puntuales, nunca "¿comparten región ahora mismo?" evaluado en cada tick) — bandas con
  nombre deciden `type` (0-19 ALIANZA / 20-39 TRATADO_COMERCIAL / 40-59 NEUTRAL / 60-79 TENSION /
  80-100 GUERRA), mismo espíritu que `reputation.ts` (bandas de 1000 sobre 0-5000).
- Decaimiento pasivo -1/semana de ficción sin eventos nuevos, hacia el neutro (nunca cruza de
  golpe, se detiene en 50).
- Código: `src/services/factionRelations.ts` (funciones puras: `typeForPresion`, `stageForPresion`,
  `applyFactionEvent`, `decayPresion`, `stageFactFor` — plantilla de texto por banda, generado con
  nombres de ambas facciones en vez de las 5 líneas fijas por conflicto del `STAGE_FACTS`
  original) + `recordFactionEvent`/`ensureFactionRelation` (wrapper Prisma). 16 tests unitarios en
  verde (`factionRelations.test.ts`).
- **Pendiente real, sin cerrar**: NINGÚN caller en producción todavía dispara
  `recordFactionEvent` — los 2 eventos definidos (`EXPANSION_TERRITORIAL_AGRESIVA`,
  `BAJA_DE_GUERRA`) están tipados pero sin enganchar. El enganche real quedó bloqueado por la
  pieza de conquista territorial de § 7.4 (más abajo) — decidir juntos en la próxima sesión cómo
  se conectan.
- `worldAgenda.ts` (el conflicto original Serhu+Concordia vs. Helsig+Goshg) **todavía no se ha
  tocado ni retirado** — sigue funcionando en paralelo, sin migrar a `FactionRelation` todavía.
  Migrar su única fila real a la primera fila de este sistema genérico (tal como proponía § 4.3)
  queda pendiente.

### 7.4 Conquista territorial estilo X4 — EN DISEÑO, sin cerrar, sin código todavía

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
   - **Pendiente real, sin cerrar**: el Cuartel Avanzado NO genera su propia zona-interior
     todavía — solo la Capital. Decidir en la próxima sesión si el Cuartel también necesita una
     (más fiel a "cada base física real es un lugar navegable propio") o si comparte alguna otra
     solución más barata.
4. **Mejora de Ayuntamiento NO crea Location nueva** — **CERRADO, ya era así de antes de tocar
   nada** (`turnResolution.ts`, rama `buildRecipe.upgradesRecipeKey`): misma fila de siempre (mismo
   `id`/`slug`), solo cambia `tier` — coherente con lo decidido. El "cambia el fondo/PNG según
   nivel" es responsabilidad del frontend/generador de imagen (mismo slug, prompt por nivel),
   ningún cambio de schema hace falta para esto tampoco.
5. **Concepto de "parcela" estilo Travian/Tribal Wars — SIN CERRAR, sin código todavía.** El PNG de
   cada zona-interior ya trae sus huecos de construcción MARCADOS de antemano como icono en el
   mapa de Zona, no espacio libre donde el jugador coloca a mano:
   - **Parcela básica vacía**: repetible, ahí van los edificios de producción/vivienda/
     fabricación — el jugador SÍ elige qué construir en ese hueco concreto.
   - **Parcela avanzada**: única por posición — a diferencia de la básica, **cada posición del PNG
     ya tiene predeterminado A PRIORI qué edificio único va exactamente ahí** (el Ayuntamiento
     siempre en el centro, la empalizada siempre alrededor, el futuro salón de diplomacia siempre
     en su hueco fijo...) — el jugador NO elige entre opciones en una parcela avanzada, solo
     construye lo que esa posición concreta ya define. Reservada para edificios que dan pasivas de
     reino/efectos concretos (hoy hay poca variedad todavía, así que de momento las Location siguen
     como están — el frontend expondrá el icono de parcela en el mapa de Zona, clic abre modal de
     detalle con opción "construir", ficha "Parcela básica vacía"/"Parcela avanzada vacía").
   - Interacción: clic en el icono de parcela en el mapa de Zona → modal de detalle → opción
     "construir" (para básica, elige receta; para avanzada, ya sabe cuál construir ahí).
   - **Sigue pendiente de decidir**: modelo de datos real (¿tabla `Parcela` propia con
     `locationId`/`x`/`y`/`tipo`/`edificioFijo`, o reutilizar `ZonePoint` con un `tipo` nuevo?).
6. **Imágenes/prompts** — reparto de trabajo cerrado explícitamente con Álvaro (ver memoria
   `tarkor_feedback_generacion_imagenes_es_cosa_del_usuario`): Claude SÍ escribe/actualiza el TEXTO
   de los prompts (trabajo de contenido normal); Álvaro genera la imagen real y la sube. **Sin
   tocar todavía** — no se ha escrito ningún prompt nuevo ni actualizado los de Serhu/Helsig/Goshg
   en esta sesión (piezas 1-4 no lo necesitaban: el sistema de imagen ya resuelve por slug sin
   campo nuevo de schema). Cada nivel de Ayuntamiento/Cuartel necesitará su propio PNG con los
   huecos exactos ya compuestos para ese nivel cuando se cierre la pieza 5 (parcelas).
7. **Enganchar el evento `EXPANSION_TERRITORIAL_AGRESIVA`** (§ 7.3) a la construcción real de un
   Cuartel Avanzado en región ajena a otra Faction — **sin cerrar, sin código todavía.** Ahora que
   el Cuartel Avanzado (pieza 1) ya existe de verdad, esto es la pieza que falta para que
   `recordFactionEvent` tenga por fin un caller real en producción.

**Retomar en sesión nueva por, en este orden**: (a) modelo de "parcela" (pieza 5), (b) si el
Cuartel Avanzado necesita su propia zona-interior (pendiente de la pieza 3), (c) enganchar el
evento territorial (pieza 7), (d) prompts de imagen por nivel (pieza 6, cuando (a) esté decidido).

---

## 6. Estado de este documento

**§ 4.2, § 4.3 (motor de eventos base) y § 7.4 piezas 1-4 (jerarquía Capital/Cuartel Avanzado con
cupos + zona-interior dinámica de Capital) CERRADOS e implementados, verificados contra el
sandbox real** (schema aplicado, seed corriendo, suite completa en verde salvo 2 flakes de
concurrencia ya conocidos y sin relación con estos cambios — confirmado reejecutando cada uno
aislado). § 7.4 piezas 5-7 (parcelas estilo Travian, zona-interior de Cuartel, enganche del evento
territorial) y prompts de imagen quedan en diseño avanzado pero sin código — ver § 7.4 para
retomar exactamente en el orden señalado ahí. El resto de § 4 (4.4 comercio, 4.5 expediciones, 4.6
reproducción) sigue sin tocar, tal como estaba.
