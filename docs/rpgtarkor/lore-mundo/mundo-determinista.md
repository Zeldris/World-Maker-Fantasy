# Helek Sirik — Mundo determinista: zonas, eventos y narración que solo narra

[← Volver al índice del mundo](07-mundo-helek-sirik.md)

*Diseño de sistema (2026-08-25, sesión conjunta autora/Claude) — **las 4 capas y los 5 hallazgos
independientes APLICADOS al motor el mismo día** (ver § "Estado y orden recomendado" al final; este
banner se quedó desactualizado diciendo "nada implementado todavía" pese a estar construido —
mismo tipo de desfase ya corregido en `combate-multiple.md`/`companeros-y-supervivencia.md`, ver
sus propios banners). Nace de una conversación sobre cómo conectar el turno de la jugadora a
[combate-multiple.md](../sistemas-combate/combate-multiple.md): al investigar cómo se dispara combate hoy, apareció un
problema más grande y más viejo — la narración libre (el LLM) tiene margen real para decidir cosas
que debería limitarse a narrar. Este documento generaliza el principio que ya rige el combate desde
hace un mes ("el modelo nunca decide, solo narra lo YA RESUELTO") a todo lo demás: aparición de
fauna/NPCs, eventos de mundo, misiones, objetos, compañeros y construcciones de Reino. Pendiente
real: generalizar la Capa 1 (zonas navegables) más allá de La Hondonada del Eco — ver el final del
documento.*

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

### Capa 1 — Zonas navegables (fundación) — PROTOTIPO CONSTRUIDO 2026-08-25 (commit `098a3cf`)

Cada `Location` relevante deja de ser un punto abstracto y pasa a tener un área real navegable, con
posiciones internas propias donde viven fauna/NPCs/recursos concretos — en vez de una tirada de
probabilidad sobre un pool plano de "todo lo que hay en la zona a la vez" (el problema real que
motivó esta capa: "en un campamento con muchos NPC, decidir al azar es ruidoso y no da lo que
buscas").

- [x] Posiciones nuevas, locales a la Location (no confundir con `Location.x/y`, que sigue siendo la
  posición GLOBAL para viajar entre zonas) — modelo `ZonePoint`, lienzo 800×600.
- [x] Imagen de zona generada con el pipeline de prompts ya existente (§6 del diagnóstico) — nuevo tipo
  de entidad `zona` + sizeProfile `mapa` (800×600, distinto de thumbnail/banner), mismo flujo manual
  de subida que el resto del catálogo visual.
- [x] Marcadores reales sobre esa imagen (fauna/NPC/recurso en su posición real) — `GET /saves/:id/zona`
  + pestaña "Zona" en el frontend (`ZonaPanel.tsx`), hace visible al jugador de forma estructurada lo
  que hoy solo puede saber si la prosa se lo cuenta bien.

**Alcance real del prototipo, confirmado con la usuaria** ("prototipo en 1 sola zona primero"): solo
La Hondonada del Eco tiene `ZonePoint` sembrados (3, los únicos elementos con `homeLocationSlug` real
ahí: yerreo/gesgurio/kirelon-arenoso) — el resto de zonas muestra el panel vacío hasta que se repita
el proceso. Posiciones x/y **provisionales** (sin PNG real generado todavía) — a recalibrar a mano
contra la imagen real en cuanto exista, mismo proceso que ya se usó para Cristal Helado ("un nodo a
la vez"). **Deliberadamente NO conectado todavía a cazar/recolectar/combate** — esta capa solo
representa DÓNDE vive algo; que la mecánica real LEA esa posición (en vez del pool por
región+terreno de hoy) es trabajo de las Capas 2-3 de abajo, construidas encima de esta base, no
parte de este prototipo.

**Pendiente para generalizar a las ~15 zonas restantes** (fuera de esta pasada): generar/subir el PNG
real de cada zona, poblar sus `ZonePoint` reales, y decidir si el criterio de selección (qué zonas
tienen prototipo) se amplía zona por zona o de golpe.

### Capa 2 — Cola de eventos por tiempo/posición — CONSTRUIDA 2026-08-25 (commit `cf57dca`)

Al investigar cómo construirla, apareció un mecanismo real ya existente y directamente
generalizable: la **interrupción de viaje** (`travelInterruption.ts`, 2026-08-05) — una tirada
determinista al INICIAR un viaje largo, por cada nodo intermedio de la ruta, que puede truncar el
viaje con un encuentro real ya materializado (`NpcState`), nunca un simple hint narrativo. El propio
código dejaba explícito que "acciones largas sin desplazamiento (construir, descansar) no entran" —
exactamente el hueco que rellena esta capa, generalizando la misma mecánica en vez de construir algo
nuevo desde cero.

- [x] **`pickStationaryInterruption`** (`stationaryInterruption.ts`) — mismo patrón que
  `pickTravelInterruption` pero sin ruta: tira una vez por cada bloque de 120 min de duración de la
  acción larga (más tiempo = más oportunidades, mismo espíritu que "más nodos intermedios = más
  tiradas"), contra los `ZonePoint` FAUNA/NPC reales de la Location actual (Capa 1).
- [x] Reutiliza casi todo el mecanismo de viaje: el mismo campo `zoneContext.travelInterruptionNpcId`
  (la inyección determinista del NPC en escena en `turnResolution.ts` ya caía a `currentLocationId`
  cuando no hay `travel`, sin necesitar ningún cambio) y el mismo patrón de aviso determinista al
  resolver, con texto propio (no hay destino que truncar en una acción estacionaria).
- [x] **Solo puede disparar en zonas con `ZonePoint` real** (hoy únicamente La Hondonada del Eco,
  Capa 1) — en cualquier otra zona, cero efecto, mismo criterio aditivo de toda la sesión.

**Riesgo real identificado y aceptado, no un descuido**: igual que la interrupción de viaje ya
existente, esto introduce una tirada real (`Math.random()`, sin mockear en tests) en turnos largos
de las pruebas de integración contra Postgres — mismo perfil de riesgo que el mecanismo de viaje que
lleva conviviendo con la suite desde 2026-08-05 sin problemas conocidos. Verificado con dos pasadas
limpias de `turn.integration.test.ts` antes de dar por bueno.

### Capa 3 — Determinismo de aparición en turno libre — CONSTRUIDA 2026-08-25 (commits `55a732d`/`85fa6fb`)

**Replanteada tras investigar a fondo** (dos rondas de grounding, con la usuaria pidiendo
explícitamente "investigar más antes de decidir"): quitar `sessionFacts` del todo de
`detectNpcsInScene` habría roto Desollar y las sugerencias de narración, que dependen de él al
100% (`action: ''`, sin ningún otro texto en el haystack). Se implementó en dos piezas más
quirúrgicas que lo que decía la versión original de este documento:

- [x] **Pieza A — persistir el `NpcState` real en el momento de inyectar un NPC de interrupción**
  (Capa 2). Hasta entonces solo se LEÍA (`findUnique`), nunca se creaba — si el turno no incluía
  golpe/saqueo real, la fila nunca llegaba a existir, y la única forma de que el NPC "siguiera en
  escena" turnos después era precisamente `sessionFacts` sin control. Ahora `upsert` a ILESO, mismo
  patrón ya probado en la caza en grupo (hoy `services/caza.ts`).
- [x] **Pieza B — guard nuevo `hasFalseNpcAppearance`** (mismo patrón sentence-matching que
  `hasResurrectedDeadNpc`): detecta si la narración (prosa o `newFacts`) "hace aparecer" con
  vocabulario de presencia activa a un NPC geográficamente plausible
  (`candidateNpcNamesNotInScene`, npcScene.ts — mismo filtro que usa `detectNpcsInScene`
  internamente) que NINGÚN mecanismo determinista puso en escena este turno.

**Lo que el diseño original preveía y NO se hizo, con motivo real**: `sessionFacts` NO dejó de ser
fuente de verdad para "quién está en escena" (seguiría rompiendo Desollar/sugerencias); el
encuentro ambiental de texto libre (`turnResolution.ts`, 25% opcional) tampoco se tocó — quedó
fuera de esta pasada, sigue siendo un hint que el modelo puede ignorar. El guard B es la pieza que
realmente cierra el riesgo (el modelo ya no puede sembrar una aparición futura sin que se detecte),
sin necesitar reestructurar el detector.

### Capa 4 — Disparo real de Combate múltiple

- [x] **CONSTRUIDA 2026-08-25** (commit `f85d7e7`). Cirugía completa dentro de
  `narrateAndPersistTurn` (`turnResolution.ts`), confirmada explícitamente con la usuaria vía
  AskUserQuestion ("ir a por la cirugía completa también", rechazando tanto "solo el disparador"
  como "parar aquí"): reutiliza la misma cascada ternaria determinista ya usada por
  Gistera/saqueo/construcción/cosecha/crafteo/curación (nunca llama a `narrateAction` cuando hay un
  `CombatEncounter` activo) en vez de construir infraestructura nueva. Detecta
  `activeCombatEncounter` (EN_CURSO + jugable) al principio del turno, resuelve
  `resolverTurnosAutonomosHastaJugadora` antes/después del turno de la jugadora
  (`resolverTurnoJugador`), narra con `narrarTurnoCombateMultiple` (motor ligero propio, no el
  Narrador clásico), y reconstruye `combateIniciado`/`pendingCombatNpcSlugs` desde
  `CombatParticipant` real en vez de `resolveCombatSlugsAndPersist`.
  - La caza en grupo (entonces `cazar.ts`, hoy `services/caza.ts`) ya no escribe `NpcState.groupSize` directo — llama a
    `iniciarCombatEncounter` dentro de `prisma.$transaction` solo cuando al menos una especie
    seleccionada tiene más de un avistado; si hay grupo real, TODAS las especies seleccionadas
    (incluidas las de un individuo) entran en el mismo encuentro, para no mezclar el sistema nuevo
    con el viejo en la misma escena.
  - Nuevo `caidos[]`/`ParticipanteCaidoInfo` (`combateMultipleOrquestacion.ts`) engancha XP de
    misión/reputación/población en cada muerte real dentro de un `CombatEncounter`, reutilizando
    `applyKillSideEffects` (mismo criterio que el 1v1 clásico).
  - **Huecos documentados a propósito, primer corte**: XP de la propia tirada de combate (el motor
    no expone el resultado del dado hacia fuera todavía, solo el resultado de misión); objetivo
    individual entre miembros de un mismo grupo (mecánicamente intercambiables hoy — mismo nombre
    de especie = mismo match, sin UI de frontend para distinguir individuos); sub-partición en >4v4
    (el límite `MAX_COMBATIENTES_POR_BANDO=4` de `combateMultiple.ts` no se ha probado en vivo con
    una caza de grupo grande todavía).
  - **Saqueo/desuello: CERRADO 2026-08-25** (commit `64b6911`, misma sesión). Decisión de diseño
    explícita tras valorarlo con la usuaria ("mismo mecanismo", "saquear al final del combate"): en
    vez de un pipeline nuevo (migración + rutas + frontend propios), al RESOLVERSE el encuentro se
    reutiliza el saqueo/desuello CLÁSICO tal cual (`carcassCandidatesFor`/`applyLootMode`,
    recolectar.ts, sin tocar su código) — se materializa `NpcState.groupSize`/`groupDefeated` para
    especies de grupo (los solitarios ya tenían `NpcState` real y correcto) y se añade un hecho de
    sesión nombrando a cada caído, para que `detectNpcsInScene` los siga encontrando sin depender
    de que la acción del turno los mencione. Nuevo campo `combatEncounterLootSummary` en la
    respuesta del turno. **Bug real cazado en el camino**: `avanzarYComprobarFin` comprobaba el fin
    del combate contra un snapshot de participantes cargado ANTES del golpe decisivo — para un
    miembro de grupo (condición solo en `CombatParticipant.condicionFisicaGrupo`, nunca releída de
    la DB) esto significaba que un grupo entero derrotado en la MISMA transacción que la baja
    decisiva podía quedarse `EN_CURSO` para siempre; corregido releyendo `CombatParticipant`
    fresco. **Desollar pasa de activa a pasiva** (petición explícita, alcance completo: también
    cadáveres narrativos fuera de combate) — ya no es un botón en Habilidades, un aviso nuevo en la
    escena (`GameView.tsx`) aparece solo cuando hay cadáveres reales pendientes y abre el mismo
    `HarvestSelectionModal` de siempre.

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

**Las 4 capas y los 5 hallazgos independientes: todos construidos y verificados (2026-08-25).**
**Combate múltiple**: avance real (Fases A-C + paridad completa de mecánicas + `resolverTurnoJugador`,
commits `5e63c27`/`419d7af`/`82793ab`/`d92df45`/`81e810c`) + disparo real en vivo (Capa 4, commit
`f85d7e7`) — YA conectado al juego en vivo, ciclo completo cerrado. **Capa 1 (zonas navegables):
prototipo construido** (commit `098a3cf`) en La Hondonada del Eco — generalizar al resto de zonas
sigue pendiente. **Capa 2 (cola de eventos): construida** (commit `cf57dca`). **Capa 3 (aparición
determinista): construida, replanteada tras investigar** (commits `55a732d`/`85fa6fb`) — dos piezas
quirúrgicas (persistencia real + guard de honestidad) en vez del rediseño completo del detector que
preveía la versión original. **Capa 4 (disparo real): construida** (commit `f85d7e7`) — ver huecos
documentados arriba.

**Pendiente real, fuera de esta pasada**: generalizar la Capa 1 más allá de La Hondonada del Eco;
enganchar XP de la propia tirada de combate; UI de frontend para elegir objetivo individual entre
miembros de un mismo grupo; probar en vivo una caza de grupo que dispare la sub-partición >4v4.
