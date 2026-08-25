# Helek Sirik — Mundo determinista: zonas, eventos y narración que solo narra

[← Volver al índice del mundo](../07-mundo-helek-sirik.md)

*Diseño de sistema (2026-08-25, sesión conjunta autora/Claude). **Nada de esto está implementado en
el motor todavía** — documentación pura, mismo criterio que `clases.md`/`companeros-y-supervivencia.md`/
`combate-multiple.md`. Nace de una conversación sobre cómo conectar el turno de la jugadora a
[combate-multiple.md](combate-multiple.md): al investigar cómo se dispara combate hoy, apareció un
problema más grande y más viejo — la narración libre (el LLM) tiene margen real para decidir cosas
que debería limitarse a narrar. Este documento generaliza el principio que ya rige el combate desde
hace un mes ("el modelo nunca decide, solo narra lo YA RESUELTO") a todo lo demás: aparición de
fauna/NPCs, eventos de mundo, misiones, objetos, compañeros y construcciones de Reino.*

---

## Principio rector

> La narración nunca decide si algo pasa, ni cuándo, ni con quién. Solo lo viste en prosa una vez
> el motor ya lo ha resuelto.

Este principio ya existe y funciona de sobra en combate (`resolveExchange`, `combatExchange.ts`,
un mes de bugs reales encontrados y cerrados entre 2026-07-22 y 2026-08-22) y en los encuentros
guionizados (Gistera Koh, `turnResolution.ts`). El resto de este documento es, en esencia,
preguntar "¿por qué esto no rige en TODAS partes?" y encontrar la respuesta con grounding real.

---

## Diagnóstico — qué decide hoy la narración que no debería

Investigación completa 2026-08-25 (dos rondas de grounding, agentes en paralelo). Cita archivo:línea
real en cada punto.

### 1. Aparición de NPC/fauna en turno libre — el ciclo real

`detectNpcsInScene` (`npcScene.ts:344-417`) es puro alias-matching determinista — pero su haystack
es `[action, ...sessionFacts].join('\n')` (`npcScene.ts:402`): **no distingue una acción real del
jugador de un hecho que el propio modelo escribió libremente el turno anterior**. Y `sessionFacts`
se alimenta directamente de `narration.newFacts` (`turnResolution.ts:5079-5080`), texto libre del
LLM sin ningún guard que valide "¿este NPC debería estar aquí?" (los 16 guards de honestidad
existentes cubren golpes/muertes/viajes/objetos falsos — ninguno cubre aparición de NPC no
autorizada).

Ciclo real, verificado en código: el modelo menciona a un NPC agresivo real de catálogo en su
prosa → se persiste como `SessionFact` sin validar nada → el turno siguiente `detectNpcsInScene`
lo detecta y lo mete en `npcsInScene` → si el jugador usa un verbo hostil, `shouldForceCombat`
(`turnResolution.ts:1984-1991`) puede abrir combate real contra él — **sin comprobar población real,
terreno, ni ningún gatillo de juego en ningún punto de la cadena**.

El único control de población real de todo el pipeline es el "encuentro ambiental" (`turnResolution.ts:2718-2763`):
25% de probabilidad, ponderado por `WorldPopulation`, entregado como **sugerencia de texto opcional**
("úsala solo si encaja, ignórala si no") — el modelo puede ignorarlo sin consecuencia, y no es la
única vía de entrada a `npcsInScene` (la de `sessionFacts` la esquiva por completo).

`combateIniciado.npcSlugs` sí está protegido por grammar-constrained decoding (Ollama `format`, el
modelo no puede inventar un slug fuera de la lista, `narrador.ts:1075-1083`) y por un filtro de
temperamento real (`turnResolution.ts:1929-1935`) — pero ambos controles actúan **río abajo** del
punto donde el NPC ya entró en `npcsInScene` por la vía no controlada de arriba.

### 2. El contraejemplo que ya funciona bien: Gistera Koh

`turnResolution.ts:3115-3608`. Gatillo 100% de código (`playerActionCount === 1`, o
`quest.status === 'ACTIVA'` + regex sobre la acción) — el texto de su aparición/presentación/despedida
está **escrito a mano en TypeScript**, concatenado después de la narración del modelo, nunca
generado por él. Dos guards dedicados (`hasGisteraReencuentroSinNombrar`, `hasFalseGisteraNamedReturn`,
`narrador.ts:1711-1750`) rechazan cualquier intento de traerla de vuelta tras marcharse. Esto es
exactamente el patrón a generalizar.

### 3. Log de Mundo — no es ruido del modelo, es una tubería sin caño

El canal `WORLD` de `LogEntry` (`schema.prisma:48-53`) **ya es 100% determinista** — se reescribió
así en 2026-07-24 tras un bug real de alucinación (el modelo narró en chino a medio párrafo). Vive en
`entorno.ts` (`generateSurroundings`), plantillas de terreno/franja horaria, cero llamadas a Ollama.

El problema real: los sistemas de mundo que sí importan —`WorldPopulation` (depleciona/repuebla de
verdad) y `WorldState.agenda` (conflicto Serhu-Concordia, avanza por etapas cada 7 días, deplecia
población real)— mutan datos reales en `workers/worldTick.ts`/`worldAgenda.ts` **sin que ningún
código escriba nunca un `LogEntry` sobre ello, en ningún canal**. El jugador ve un panel ("El
mundo", `LogPanel`, actualizado cada 10 min reales vía `useSurroundingsPolling.ts`) con ambientación
reciclada, mientras los hechos de verdad interesantes pasan en silencio absoluto.

### 4. `newQuest`/`newItem`/`newCompanion`/`newTerritory`/`newSubject` — libertad real del modelo, sin catálogo

- **`newQuest`** (`narrador.ts:62`): cero validación de código. `turnResolution.ts:4511` crea una
  `Quest` real siempre que el campo no sea null — título y descripción son texto libre del LLM. No
  existe ningún catálogo de misiones predefinidas.
- **`newItem`** (`narrador.ts:46`): `turnResolution.ts:4285-4298` crea un `InventoryItem` sin
  `catalogSlug`, fuera del `ItemCatalog` que usa el resto del juego (recolección/combate/crafteo).
  El único guard existente (`hasFalseItemUse`) detecta CONSUMO falso, nunca CONCESIÓN falsa.
- **`newCompanion`** (`narrador.ts:50`): el único freno real es cupo de slots por construcción
  (`turnResolution.ts:4300-4326`) — no hay ningún umbral de reputación/relación con el NPC.
- **`newTerritory`/`newSubject`**: cero guard, se crean siempre que el campo no sea null.
- **`newBuilding`** es la excepción bien resuelta: la mayoría de casos pasan por `CONSTRUCTION_RECIPES`
  (determinista real, `turnResolution.ts:4374-4392`) y solo cae a texto libre cuando la acción no
  matchea ninguna receta reconocida — demuestra que el patrón correcto ya existe y funciona en el
  propio proyecto.

### 5. Coordenadas — no hay nada reutilizable para "posición dentro de una zona"

`Location.x`/`y` (`schema.prisma:282-286`) son coordenadas GLOBALES en km reales (origen Los Pilares
Rotos), usadas solo para que la Brújula calcule dirección cardinal entre Locations (`travel.ts:140-152`,
`compassNarration.ts`) — nunca para colocar algo DENTRO de una zona.

Los "12 nodos calibrados" del Mapa de Cristal Helado (que se recordaban como precedente reutilizable)
**no están en la base de datos** — son un objeto TypeScript hardcodeado en el frontend
(`frontend/src/data/map.ts:211-224`), en píxeles de un lienzo SVG de 800×600, calibrados a mano nodo
a nodo contra el PNG de fondo, sin ninguna relación con `Location.x/y`. Confirmado: **no existe hoy
ningún sistema de posición local dentro de una zona** — zonas navegables sería infraestructura
genuinamente nueva.

### 6. Generación de imágenes — no hay generador real, y eso es una buena noticia

No existe ninguna integración de generación de imágenes (ni local ni cloud) en el backend. Lo que sí
existe es un pipeline real de **generación de texto de prompt** (`imagePromptGenerator.ts`, LLM
cloud-con-fallback-a-Ollama, cacheado por entidad en la tabla `ImagePrompt`), que la autora copia a
mano a una herramienta externa y sube el PNG resultante a `uploads/images/<tipo>/<slug>-<sizeProfile>.png`
(`imageAssets.ts:5-9`). 11 tipos de entidad ya soportados (`npc`, `item`, `fauna`, `location`, etc.,
`imagePromptGenerator.ts:7-18`) — ninguno para "mapa de zona" todavía, pero el flujo entero (generar
prompt → copiar fuera → subir archivo) ya está probado y en uso.

---

## Diseño propuesto — 4 capas, en orden real de dependencia

Cada capa lee de la anterior. Construir en otro orden significa rehacer trabajo.

### Capa 1 — Zonas navegables (fundación)

Cada `Location` relevante deja de ser un punto abstracto y pasa a tener un área real navegable, con
posiciones internas propias donde viven fauna/NPCs/recursos concretos — en vez de una tirada de
probabilidad sobre un pool plano de "todo lo que hay en la zona a la vez" (el problema real que
motivó esta capa: "en un campamento con muchos NPC, decidir al azar es ruidoso y no da lo que
buscas").

- Posiciones nuevas, locales a la Location (no confundir con `Location.x/y`, que sigue siendo la
  posición GLOBAL para viajar entre zonas).
- Imagen de zona generada con el pipeline de prompts ya existente (§6 del diagnóstico) — nuevo tipo
  de entidad `zona`/`mapa-de-zona`, mismo flujo manual de subida que el resto del catálogo visual.
  Generada una sola vez por zona, reutilizada siempre (mismo criterio que el Mapa de Cristal Helado:
  calibrado una vez a mano, nunca regenerado cada turno).
- Marcadores reales sobre esa imagen (fauna/NPC/recurso en su posición real) — hace visible al
  jugador, de forma estructurada, lo que hoy solo puede saber si la prosa se lo cuenta bien.

### Capa 2 — Cola de eventos por tiempo/posición

Extiende el patrón YA real de `workers/worldTick.ts` (que hoy avanza población/agenda de mundo de
forma puramente determinista) a sucesos de escena: mientras el jugador ejecuta acciones deterministas
que consumen tiempo (curar, descansar, cazar, oficios...), el motor tira de antemano —según cuánto
tiempo lleva en esa posición, qué hay realmente ahí (Capa 1), estado de facciones/clima/estación—
qué sucede y cuándo, dejándolo resuelto en una cola. La narración solo dramatiza lo que la cola ya
decidió, nunca inventa una sorpresa de la nada.

### Capa 3 — Determinismo de aparición en turno libre

Con las Capas 1-2 ya dando datos reales de "qué hay aquí y cuándo pasa algo", se cierra el ciclo
del diagnóstico §1:

- `sessionFacts` deja de ser fuente de verdad para "quién está en escena" — sigue sirviendo para que
  el jugador se refiera a alguien ya establecido ("ataco a 'X'"), nunca para que la mera mención del
  modelo establezca su existencia.
- El encuentro ambiental deja de ser un hint opcional de texto y pasa a ser forzado, mismo patrón que
  Gistera Koh (§2 del diagnóstico): cuando la Capa 2 decide que algo aparece, el motor planta el
  `NpcState` real y pega una frase ya fijada (plantilla, nunca libre) a la narración.
- Un guard nuevo (mismo patrón que los 16 existentes) detecta si la narración menciona a un NPC de
  catálogo NO autorizado en `npcsInScene` esta vez.

### Capa 4 — Disparo real de Combate múltiple

Ese mismo instante determinista de la Capa 3 (un NPC/grupo "se planta" de verdad en la escena) es
el que dispara `iniciarCombatEncounter` (ya construido, ver [combate-multiple.md](combate-multiple.md))
si aplica — sustituyendo por completo a `combateIniciado.npcSlugs` (propuesta libre del modelo) como
mecanismo de apertura de combate. El turno de la jugadora contra ese `CombatEncounter` ya tiene
motor real (`resolverTurnoJugador`, `combateMultipleOrquestacion.ts`, 2026-08-25) — lo que faltaba
era un disparador limpio, y esa es exactamente la pieza que cierra esta capa.

---

## Hallazgos independientes — no dependen de las 4 capas, se pueden atajar por separado

Encontrados durante la misma investigación; cada uno es una unidad de trabajo propia, sin esperar al
resto del diseño. **Los 5 cerrados y APLICADOS al motor el mismo día (2026-08-25, commit `1902c29`)**:

1. [x] ~~**Log de Mundo → conectar a hechos reales.**~~ `advanceWorldAgenda` (`worldAgenda.ts`) ya
   escribe una `LogEntry` de canal WORLD por cada etapa cruzada — mismo texto ya escrito a mano
   (`STAGE_FACTS`) que antes solo alimentaba `sessionFacts`, cero coste de LLM añadido.
2. [x] ~~**`newQuest` necesita el mismo tratamiento que `newBuilding`.**~~ Versión acotada, no el
   catálogo completo de plantillas (fuera de alcance de esta pasada): exige al menos un anclaje real
   ya resuelto (NPC/Location/Item) antes de crear la `Quest` — una misión sin ninguna conexión con
   el mundo real ya no se crea.
3. [x] ~~**`newItem` en narración libre probablemente sobra del todo.**~~ Decidido no quitarlo del
   todo: exige coincidir con un `ItemCatalog` real del mundo — si coincide, hereda `equipSlot`/
   `effectKey`/`tipo` reales (antes siempre `null`); si no, se descarta sin crear nada.
4. [x] ~~**`newCompanion` debería usar el sistema de reputación de facción que ya existe.**~~ Exige
   NPC real en escena + `effectiveTemperamento` AMIGABLE o INOFENSIVO. AMIGABLE a secas se descartó
   al comprobar el catálogo real: 0 NPC nacen con ese temperamento — exigirlo solo habría hecho el
   reclutamiento libre imposible en la práctica.
5. [x] ~~**`newTerritory`/`newSubject` merecen la misma cura que `newBuilding`.**~~ `newTerritory` ya
   no confía en la región que escriba el modelo — siempre usa la región real de la Location actual
   (más fuerte que un guard: ni siquiera puede fallar la validación, la fuente de verdad cambió).
   `newSubject` exige un `Territory` real ya resuelto.

---

## Estado y orden recomendado

**Los 5 hallazgos independientes: cerrados** (ver arriba). **Combate múltiple**: avance real (Fases
A-C + paridad completa de mecánicas + `resolverTurnoJugador`, commits
`5e63c27`/`419d7af`/`82793ab`/`d92df45`/`81e810c`, 2026-08-25) — solo le falta el disparador de la
Capa 3-4 de este documento para conectarse al juego en vivo. **Las 4 capas: sin construir todavía**,
diseño completo arriba.

Orden recomendado para lo que queda: las 4 capas dependen entre sí en el orden dado — Capa 1 (zonas
navegables) es la fundación real, y construir la Capa 3 antes que la 1 significaría rehacer trabajo.
