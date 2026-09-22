# Un mundo con vida propia, estilo X4 Foundations — sin LLM decidiendo

[← Volver al índice del mundo](../lore-mundo/07-mundo-helek-sirik.md)

*Sesión de DISEÑO (2026-09-21, autora/Claude) — sin tocar código todavía. Documento vivo: se
amplía en próximas sesiones a medida que se cierran más piezas. Objetivo declarado por la autora:
"vamos a analizar con todo lo que tenemos construido qué posibilidades nos da... y si de verdad lo
podemos cumplir creo que el único modelo que vamos a necesitar añadir es el que modifica y crea
lore mientras juegas". Continúa el principio rector de [mundo-determinista.md](../lore-mundo/mundo-determinista.md)
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

