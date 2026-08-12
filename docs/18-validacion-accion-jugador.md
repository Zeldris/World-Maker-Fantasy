# Validación de "grounding" de la acción del jugador contra el lore real

**Estado:** documento vivo. Fase 0 (mecanismo) + Fase 1 completa (arma que no llevas, NPC/fauna
real de catálogo con el que interactúas pero que no está en esta escena) **implementadas y
verificadas (2026-08-13)** — ver `backend/src/services/playerActionValidation.ts`. Pendiente
jugarlo en vivo antes de confiar del todo en ello — es el primer mecanismo de su tipo (cortar un
turno antes de llegar a la IA).

**Límite real descubierto implementando el chequeo de NPC/fauna** (documentado aquí para no
redescubrirlo): NO puede cazar "NPC `PRINCIPAL` mencionado por texto pero no realmente presente" —
`detectNpcsInScene` incluye SIEMPRE a los `PRINCIPAL` como candidatos sin importar ubicación
(diseño correcto, son personajes de trama que pueden aparecer en cualquier sitio), así que si el
texto los menciona, `detectNpcsInScene` los da por "en escena" por el mismo motivo que este
chequeo los encontraría — mismo signal, mismo resultado, nunca puede haber discrepancia para
`PRINCIPAL`. Donde SÍ funciona de verdad: fauna/NPCs `PLANTILLA` de OTRA región, nunca antes
encontrados y sin misión que los señale — esos quedan fuera de la lista de candidatos de
`detectNpcsInScene` aunque el texto los nombre, así que este chequeo es la ÚNICA red que los cierra.
Alcance más estrecho que "cualquier NPC", pero real y verificado (test de integración con una
fauna de Ciénaga Troncal mencionada estando en Los Pilares Rotos).

**Fase 1 completada del todo** con el tercer chequeo (anacronismo en el texto del jugador,
`detectsPlayerAnachronism`) — reutiliza `ANACHRONISM_REGEX` (narrador.ts), ampliado con "nave
espacial"/coche/avión/robot (el ejemplo real de la propia sesión de diseño). **Bug real
encontrado implementando este chequeo, corregido en el mismo commit**: `turn.classify.test.ts`
mockeaba `narrador.js` con un reemplazo COMPLETO del módulo (no `importOriginal`), así que
cualquier otro export real de ese archivo (como `ANACHRONISM_REGEX`) se volvía `undefined` en
silencio dentro de ese archivo de test en cuanto algo más lo importaba — rompía los 7 tests de
ese archivo con un error que ni siquiera apuntaba a la causa real. Corregido al mismo patrón
`importOriginal` que ya usaba correctamente `turn.integration.test.ts`.

## Implementado (2026-08-13)

- `backend/src/services/playerActionValidation.ts` — `detectsUnequippedWeaponClaim(action,
  equippedWeaponNames)`: vocabulario cerrado de 9 sustantivos de categoría de arma (mismo enum
  `WeaponCategory` de Prisma) + verbo de uso/ataque en la misma frase (mismo criterio que
  `hasFalseItemUse`) — sin verbo, no dispara (evita bloquear una mención/recuerdo legítimo).
  `wrongWeaponNarrationFor(armaReal)`: pool de 5 frases en la voz de Gorhorn (borrador de la
  sesión de diseño), selección aleatoria simple (anti-repetición consecutiva estricta queda como
  refinamiento futuro, no bloqueante).
- Cableado en `POST /turn/classify` (`turn.ts`), justo después del guard de tránsito ocupado y
  antes de cualquier llamada a IA — usa `save.inventoryItems` ya disponible, sin consulta nueva.
  Si dispara, persiste la acción + la respuesta como `LogEntry` reales y devuelve
  `{ blocked: { narration } }` en vez de `{ classification, ... }`.
- `ClassifyResponse.blocked` nuevo (frontend `api.ts`) — `GameView.tsx` lo comprueba en los dos
  sitios que llaman a `/turn/classify` (turno normal y turno de combate) y, si está presente, se
  salta `/turn/narrate` por completo y recarga la partida (mismo patrón ya usado para `transit`).
- Alcance conocido de esta primera versión: solo dispara si el jugador lleva AL MENOS un arma
  equipada (ir desarmado y reclamar un arma es un caso distinto, fuera de alcance); sin "lanz\*" en
  el regex de verbos (colisiona con el propio sustantivo "lanza") — se prefiere un falso negativo
  raro a arriesgar bloquear una acción legítima.
- `detectsAbsentSceneNpcClaim(action, worldId, npcsInSceneSlugs)`: reutiliza `matchNpcAliases`
  (npcScene.ts, mismo motor boundary+fuzzy que ya usa `detectNpcsInScene`) contra el catálogo
  COMPLETO del mundo, filtrado por intención real de interacción (`detectsAttackIntent`/
  `detectsDialogueIntent`/`detectsHostileSearchIntent`, ya existentes) — sin lista propia que
  desincronizarse del catálogo. `absentSceneNpcNarrationFor(nombre)`: mismo patrón de 5 frases.
  Requiere una llamada extra a `detectNpcsInScene` al principio de `/turn/classify` (antes de
  `resolveClassificationForTurn`, que la recalcula igual más abajo) — coste de una consulta extra
  a DB, nunca de IA, para poder cortar antes de la primera llamada a Ollama.
- Tests: `playerActionValidation.test.ts` (13, unitarios puros) + `turn.classify.test.ts` (3 nuevos,
  con Prisma mockeado) — confirman que `classifyAction` (la llamada a IA) nunca se invoca cuando
  dispara, y que el camino normal sigue igual cuando el arma sí coincide.

## Contexto

La familia de detectores "narración-vs-mecánica" (`narrador.ts`: `hasFalseCombatHit`,
`hasFalseItemUse`, `hasResurrectedDeadNpc`, `hasFalseTravelClaim`, `hasFalsePhantomTravel`,
`hasFalseInventoryReview`, `hasGisteraReencuentroSinNombrar`, `hasAnachronism`) ya garantiza que el
NARRADOR nunca invente NPCs, objetos, viajes o golpes que no respalda el estado real de la
partida. Falta el lado simétrico: el JUGADOR tampoco debería poder "salirse del dibujo" —
escribir una acción que reclama un arma que no lleva, un personaje/edificio/animal/planta que no
existe en el catálogo, o un anacronismo ("me monto en mi nave espacial"), y que el motor lo trate
como si fuera real solo porque nadie lo comprobó antes de narrar.

**Idea complementaria descartada**: corregir ortografía/puntuación del texto del jugador antes de
usarlo. El motor de coincidencia ya tolera erratas donde importa de verdad
(`matchesAliasBoundary` + fuzzy Levenshtein, `travel.ts`), así que el beneficio real sería solo
cosmético (mejor lectura del diario), con un coste de latencia genuino (una corrección con sentido
de puntuación en español informal necesita otra llamada a IA, y cada turno ya tarda 30-90s+ en
CPU). Si se retoma alguna vez, tiene que ser **solo cosmético al renderizar el diario, nunca
tocando el texto real que se envía al narrador** — nunca una segunda llamada a IA por turno.

## Restricción de diseño que lo condiciona todo

El mundo (Helek Sirik) está solo al ~1% de lore completo — apenas Las Llanuras del Viento Rojo
está terminada; Berig (el resto del segundo continente) se ampliará en sesiones futuras de
"ampliar lore". Consecuencia directa: **el validador nunca puede tener una lista de entidades
"quemada" en el código** — tiene que leer siempre el catálogo real en vivo (`worldCatalog.ts` y las
tablas de la BD), para que cada NPC/fauna/ubicación/receta nueva añadida más adelante quede
cubierta automáticamente, sin tocar el validador nunca.

Aclaración importante de diseño: crecer el lore **no añade más restricciones** — el criterio
("¿existe de verdad?") es el mismo siempre; lo que crece es el conjunto de cosas que cuentan como
"real", así que el sistema se vuelve **más permisivo** con el tiempo, nunca más estricto. Diseñado
así desde el día 1, es aditivo puro con el lore — cero mantenimiento por contenido nuevo.

## Hallazgos de la exploración (2026-08-12)

- **El modelo YA se llama dentro de `POST /turn/classify`**, no solo en `/turn/narrate`
  (`classifyAction`, `narrador.ts:295-304`, invocado desde `turn.ts:238`) — cualquier validación
  que quiera ahorrarse la llamada a IA tiene que ir ANTES de `resolveClassificationForTurn`, al
  principio del handler `POST /turn/classify` (`turn.ts`, antes de la línea ~439). Es el punto más
  temprano posible del pipeline real.
- **Patrón ya establecido a seguir**: 14 funciones `detectsXxx(action): boolean` ya corren sobre el
  texto crudo del jugador antes de cualquier IA — `detectsAttackIntent`/`detectsHostileSearchIntent`
  (`npcScene.ts`), `detectsTravelIntent`/`detectsVagueMovementIntent` (`travel.ts`),
  `detectsRestIntent` (`timedActions.ts`), `detectsBuildIntent` (`construction.ts`),
  `detectsCraftIntent` (`crafting.ts`), `detectsLootIntent`/`detectsExecuteIntent`/
  `detectsInventoryReviewIntent` (`turnResolution.ts`), etc. — regex + `normalizeText`, cero IA,
  cero coste. La nueva capa sigue exactamente este molde, no inventa un mecanismo nuevo.
- **No existe ningún precedente de "cortar el turno antes de narrar" basado en el texto del
  jugador** — los únicos cortes hoy son de estado de sesión (partida terminada, tránsito ocupado,
  candado de turno — `turn.ts:409-420,609-616`), nunca de validez de la propia acción. Esta sería
  la primera pieza de su tipo.
- **Piezas reutilizables ya existentes** (nada de esto se reinventa):
  - `equippedWeaponNames` (`equipment.ts:93`) + `inventoryRows.find(i => i.slot === 'ARMA_PRINCIPAL'/'ARMA_SECUNDARIA')`
    (patrón ya usado en `turnResolution.ts`) — arma real llevada.
  - `detectNpcsInScene` (`npcScene.ts:263`) — ya calcula la lista definitiva de NPCs/fauna
    REALMENTE presentes esta escena (candidatos por región/misión/ya-vistos + alias). Cualquier
    nombre de NPC en el texto que no esté en esa lista es o inventado o "existe pero no está aquí".
  - `entityDiscovery.ts` — mismo patrón (`matchesAliasBoundary` contra TODO el catálogo: npc,
    fauna, item) pero para otro fin (marcar descubrimientos); reutilizable tal cual para
    "¿existe esto en algún sitio del mundo?".
  - `harvestSourceAliases` (`worldCatalog.ts`) — flora/minerales (no hay array `flora` separado,
    viven aquí, ya con alias).
  - `CONSTRUCTION_RECIPES` (`construction.ts:271`) — lista cerrada de 4 tipos de edificio, ya con
    `detectsBuildIntent`/`nounRegex` para matchear.
  - `matchesAliasBoundary`/`normalizeText` (`travel.ts`) — primitiva de coincidencia compartida por
    todo lo anterior.
- **No existe todavía** ninguna función única "qué entidades nombra este texto" — cada sitio hace
  su propio barrido con las piezas de arriba. Para esto sí hace falta una función nueva, pero
  COMPUESTA de piezas existentes, no escrita desde cero.

## Plan por fases

**Fase 0 — cimiento.** Nueva capa determinista `validatePlayerAction(action, ctx): Violation | null`,
llamada al principio de `POST /turn/classify` (antes de la primera llamada a IA). Si detecta una
violación clara, el turno NUNCA llega a `classifyAction`/`narrateAction` — se responde directo con
una `LogEntry` real (persistida, como cualquier turno) usando una frase de la voz de Gorhorn, sin
gastar ni un segundo de generación. Mismo criterio de "nunca decide el modelo, decide el código"
que ya rige todo el motor de turnos.

**Fase 1 — bajo riesgo, ya con piezas hechas.**
- Arma que no llevas (`equippedWeaponNames` + slot real).
- NPC/fauna ya vista/no vista EN ESCENA (`detectNpcsInScene` ya da la lista real).
- Anacronismo en el propio texto del jugador (la lista de términos ya vive en el Modelfile — se
  reutiliza, no se duplica).

**Fase 2.** Flora/minerales inventados (`harvestSourceAliases`) y tipos de construcción inventados
(`CONSTRUCTION_RECIPES`).

**Fase 3 — aparcada, la difícil de verdad.** "Cualquier NPC/edificio/fauna/flora en TODO el
mundo, exista o no, esté aquí o no". El obstáculo no es técnico, es lingüístico: distinguir "lo
menciono/pienso en él" (legítimo) de "afirmo que está aquí ahora" (violación) en texto libre es un
problema de verdad difícil de acertar sin falsos positivos que penalicen escritura legítima. Aquí
es donde más ayuda crecer el lore: cuantas más entidades reales existan, menos casos límite habrá.

**Cada fase, además:**
- Pool de 4-5 frases por categoría en la voz de Gorhorn — épico-trágico (tono fijado en el
  Modelfile) con 1 variante cómica más rara que el resto (~1 de cada 6-8, no 1 de cada 5, para no
  desinflar el tono por defecto), formato narración + comillas (mismo patrón que ya usa el resto
  del juego para diálogo).
- Sin repetir dos veces seguidas — mismo patrón que `isTooSimilarToLast`.
- Wireado también en `runDetectors`/`distillationValidation.ts` si en algún momento se generan
  ejemplos de entrenamiento que ejerciten este comportamiento.
- Límite explícito conocido: las frases están escritas para Gorhorn en concreto, no de forma
  genérica — si algún día hay más de un personaje jugable, hay que decidir si se reescriben por
  personaje o se convierten en plantilla con hueco de nombre/raza/tono.

## Borrador de frases (Fase 1)

**Anacronismo** (5, 1 cómica):
- "Gorhorn frunce el ceño ante su propia idea, como si tratara de masticar algo que no existe. No
  hay ningún camino a lo que describe, ni en Helek Sirik ni en ningún sitio que él conozca."
- "Gorhorn se detiene en seco. Sea lo que sea eso, no tiene nombre en ninguna lengua que hable un
  orco — y él ya ha viajado bastante como para saberlo."
- "El pensamiento se disuelve antes de convertirse en acción, como humo que no encuentra madera
  que quemar. Gorhorn ni siquiera sabría por dónde empezar."
- "Gorhorn sacude la cabeza, casi con lástima por sí mismo. Lo que acaba de pensar no tiene sitio
  en este mundo, y una parte de él lo sabe antes de intentarlo."
- *(cómica)* "Gorhorn se palpa la cabeza, extrañado. «Será el calor, será el viento, será que llevo
  ya demasiado tiempo hablando solo con cadáveres... porque juraría que acabo de pensar en algo que
  no existe.» Sacude la cabeza y vuelve a lo suyo."

**Arma equivocada** (5, 1 cómica — `{armaReal}` se rellena con el nombre real del catálogo):
- "Gorhorn baja la vista a sus manos. Lo que empuña de verdad es {armaReal}, no lo que acaba de
  nombrar. Actúa con lo que de verdad lleva encima."
- "Un instante de confusión le cruza el rostro: no lleva lo que acaba de decir. {armaReal}, eso es
  lo que tiene, y con eso golpea."
- "Gorhorn nota el peso equivocado en la mente antes que en la mano — lo que lleva de verdad es
  {armaReal}."
- "El arma que Gorhorn describe no es la que pesa en su mano ahora mismo. Se corrige él solo antes
  de moverse."
- *(cómica)* "Gorhorn mira su mano, luego otra vez, como si el arma fuera a cambiar de opinión.
  «¿Lanza? ¿Qué lanza? Llevo {armaReal} desde esta mañana, orco de piedra que soy...» Menea la
  cabeza y sigue con lo que de verdad tiene."

## Pendiente de decidir contigo

- Cuándo empezar la Fase 0/1 frente a otras líneas de trabajo abiertas ahora mismo.
- Si las frases de arriba sirven tal cual o quieres una pasada de revisión de tono antes de
  implementarlas.
