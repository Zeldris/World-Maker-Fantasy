# Un mundo con vida propia, estilo X4 Foundations — índice

[← Volver al índice del mundo](../07-mundo-helek-sirik.md)

*Documento reorganizado el 2026-09-22 en varios archivos por sistema/tema — el contenido original
(sesión de diseño 2026-09-21) no se ha reescrito, solo repartido para que cada pieza se pueda leer
sin cargar las 1300 líneas del documento único original. Ver también
[ampliar-lore.md](../ampliar-lore.md) para el runbook general de sesiones de lore.*

**Los documentos del sistema, por tema:**

- [Visión y fundamentos](mundo-vivo-x4-vision.md) — a qué se quiere llegar (referencia X4/Stellaris),
  inventario real de lo que ya existía antes de tocar nada (§ 1-2), lectura de conjunto (§ 3).
- [Facciones y diplomacia](facciones-diplomacia.md) — motor de disputas (`FactionRelation`),
  diplomacia del jugador, mercado regulado, líder de facción.
- [Construcciones y economía de Reino](construcciones-reino.md) — arquitectura `Building`/
  `factionId`, panel de Reino (`OrdenProduccion`/`AlmacenLimite`), jerarquía Capital/Cuartel
  Avanzado/Parcelas.
- [Expediciones y población de facción](expediciones-poblacion.md) — recolección/exploración con
  escoltas, reproducción poblacional de facción.
- [IA de combate y curvas dinámicas de mundo](ia-combate-y-mundo.md) — tramos de Inteligencia en
  combate NPC, señales dinámicas pendientes de diseño (movimiento en Zona, profesiones/energía).

---

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

### 5-bis. Los 13 puntos — CERRADOS (2026-09-21, sesión posterior, con grounding real X4/Bellwright)

Decididos uno a uno con Álvaro, revisados en conjunto al final para confirmar que no se
contradicen entre sí (petición explícita: "revisa bien que los 13 puntos se cumplan o que las
decisiones encajen").

1. **`FactionBuilding` se retira del todo** — confirmar que no queda ningún caller real (el seed ya
   migró a `Building.factionId` en `5da79e5`) y borrar modelo+tabla en la próxima migración.
2. **XOR `saveId`/`factionId`: CHECK constraint real en Postgres, pero SOLO para los modelos nuevos
   de esta sesión** (`OrdenProduccion`, `AlmacenLimite`, `ProfessionProgress.companionId`) — los ya
   existentes (`KingdomStats`, `Building`, `ZonePoint`, `Npc.faction`) se quedan en su convención
   actual de solo-servicio, decisión consciente de dos criterios conviviendo (documentado aquí para
   que no se confunda con inconsistencia accidental).
3. **`Building`/`KingdomStats`/`OrdenProduccion` de facción son por `Save`**, no por `World` — ya es
   así en el código real (saveId/factionId opcionales desde 4.2), no cambia nada. Coherente con el
   punto 4: si el Reino sigue atado al turno de una partida concreta, tiene que vivir en esa partida.
4. **El Reino del JUGADOR se queda atado al turno, tal como está hoy — NO se mueve a
   `worldTick.ts`.** Grounding real (`WebSearch` X4/Bellwright): ninguno de los dos juegos simula
   offline — X4 se pausa al minimizar, Bellwright avanza mientras el juego está abierto y en
   marcha, no en segundo plano indefinido. El proyecto real YA sigue ese mismo criterio en casi
   todo (viajes, combate, narración solo avanzan cuando el jugador actúa) — `worldTick.ts` (tiempo
   real cada 2 min) es la excepción minoritaria (población de mundo, agenda), no la regla. Mover el
   Reino del jugador ahí lo habría desalineado del resto del proyecto, no acercado a la referencia.
   `worldTick.ts` queda reservado para lo que de verdad no tiene turno propio: población de mundo,
   agenda, y el futuro motor de facciones NPC (nunca el Reino del jugador).
5. **Inteligencia/autonomía de una facción = la de su líder** (`Faction.liderNpcId`, ya construido
   en `5da79e5`) — grounding real X4: el skill del capitán de flota decide la calidad de las
   decisiones tácticas autónomas de su escuadrón, mismo principio aplicable aquí. Se reutilizará
   para un futuro "capitán" de escuadrón (control de escuadrones, § 4.4-bis) cuando ese sistema
   exista — mismo mecanismo, dos aplicaciones.
6. **Diplomacia = acción puntual del jugador contra cualquier facción, sin exigir nada de la
   facción destino** — grounding real X4 (Agentes del jugador, HQ, acciones de
   Negociación/Espionaje/Interferencia contra cualquier facción amiga u hostil) descartó primero la
   idea de "embajador sostenido" tipo Bannerlord (presencia continuada en territorio rival,
   mejorando relación con el tiempo) por el motivo que señaló Álvaro: exigiría poblar TODAS las
   facciones con NPC/Inteligencia propios para responder de forma creíble, mucho más alcance de
   contenido. La versión X4 no tiene ese requisito — el destino es siempre pasivo. Diseño final:
   `Companion`/`Subject` DEL JUGADOR (nunca `Npc` de facción — distinción explícita de Álvaro: "una
   cosa son companions, elementos del RPG que te acompañan, y otra es NPC/fauna de facción, van por
   separado") con `rolReino:'diplomatico'` y su propio `ProfessionProgress.companionId` en un
   oficio de diplomacia, mismo gate de nivel ya construido para `OrdenProduccion`, ejecuta una
   acción puntual (mismo patrón que crafteo/producción, no presencia sostenida) que dispara un
   evento real en `FactionRelation` (ya construido en 7.3) contra cualquier `Faction` sembrada. Cero
   requisito nuevo de poblar NPC en las facciones destino.
7. **Motor de eventos unificado** (lore en vivo § 1 + misiones secundarias § 2.9 + eventos de
   facción § 4.3): una sola pieza, tal como ya apuntaba el documento — eventos discretos reales
   (guerra que termina, alianza firmada, territorio disputado) alimentan lore/misiones/facciones, y
   el LLM solo narra, nunca decide. **Matiz cerrado en la revisión cruzada**: tiene que ser una
   función PURA invocable desde DOS disparadores distintos — `worldTick.ts` (facciones NPC actuando
   solas, tiempo real) Y `turnResolution.ts` (acciones del propio jugador, incluida la diplomacia
   del punto 6) — mismo criterio que ya usa todo el proyecto (`tickKingdomOneDay`,
   `tickOrdenesProduccion`, `recordFactionEvent`: lógica en `services/`, sin saber quién la llama).
   Sin este criterio el motor quedaría partido en dos implementaciones que divergen.
8. **IA de combate NPC — diseñar ahora, mismo principio del punto 5**: la Inteligencia del `Npc`
   concreto decide su propio tramo táctico. Tramos: **&lt;10** = solo Ataque Básico, sin
   retirada/coordinación; **10-20** = habilidades reactivas básicas (ya cubierto hoy por
   `INTELIGENCIA_TACTICA_UMBRAL = 12`, dentro de este tramo, sin cambios); **20+** = decisiones de
   retirada/cambio de objetivo/coordinación con otros NPC del mismo grupo (combate múltiple) — pieza
   nueva real a construir, sin código todavía.
9. **Movimiento en Zona / Profesiones-talento-nivel-energía — diseñar dentro de esta ronda**: señal
   dinámica real que falta en ambos: qué variable de estado alimenta cada curva hoy plana. Sin
   diseño concreto todavía — pendiente de una pasada de grounding dedicada antes de escribir nada
   (no se improvisa aquí, mismo criterio de "grounding antes de proponer" del resto del documento).
10. **"Muerte permanente A→F" — CERRADO, era ruido de memoria.** No existió ninguna escala de
    letras: la memoria confundía "muerte permanente **CON/SIN** punto de guardado", diseñada e
    implementada por completo el 2026-08-31 (`tarkor_muerte_permanente_2026-08-31`, confirmado
    cerrado en `checklist-pruebas-juego.md`). El sistema de 5 estados
    (`ILESO→HERIDO→GRAVE→CONVALECIENTE→MUERTO`) + flujo con/sin punto de guardado ya está completo,
    sin ninguna pieza pendiente.
11. **Descomposición de cadáver (48h) y recuperación de CONVALECIENTE (6h) se mueven a
    `worldTick.ts`** — mismo patrón ya real de `advancePlayerSurvival`/`growAllPopulations` (cálculo
    DERIVADO de un timestamp, no acumulativo como `tickKingdomOneDay`, encaja sin cambiar de
    semántica): un cadáver se descompone y un NPC se recupera aunque el jugador no vuelva a esa
    Location, mismo criterio "el mundo sigue" que ya aplica a población. Sin código todavía.
12. **Las 4 regiones sin dueño mecánico se abren a disputa de facciones NPC** — se mantienen como
    `SIN_DUEÑO` en el estado inicial, pero el motor de disputas (§ 4.3, ya construido) puede
    incluirlas como candidatas cuando una facción decida expandirse, en igualdad con las demás.
    Fiel a X4 (cualquier territorio puede disputarse). Sin código todavía — depende de que el motor
    de disputas tenga caller real primero.
13. **Clima: ampliar a las 8 regiones ANTES de construir § 4.5** — a diferencia del resto de puntos,
    este SÍ bloquea orden de trabajo: el motor de expediciones de facción no se diseña para
    funcionar con clima ausente, se hace la ampliación de contenido primero. Trabajo de
    lore/contenido, no de arquitectura.

**Los 13 puntos son coherentes entre sí** (revisión cruzada explícita): 3 y 4 se refuerzan (Reino
por Save + atado al turno, ambos hablan de "una partida concreta"); 5 y 8 comparten el mismo
principio (Inteligencia del NPC que decide, aplicado a facción y a combate); 6 respeta la
distinción Companion-vs-Npc fijada en la propia discusión del punto 6; 7 necesita ser invocable
tanto desde el disparador de 4 (turno) como desde el de 11/12 (worldTick.ts) — sin conflicto, es
una función pura consumida por ambos; 13 fija orden de trabajo respecto a 4.5, no una decisión de
diseño en sí misma.

### 5-ter. Puntos 1, 2 y 11 — CERRADOS e IMPLEMENTADOS (2026-09-21, sesión posterior)

- **Punto 1** (`FactionBuilding`): confirmado que ya no queda ningún caller real (`grep` limpio,
  el modelo Prisma ya no existe en `schema.prisma` desde `5da79e5`, y la tabla tampoco existe en
  Postgres real) — el punto ya estaba de facto cerrado, solo quedaban comentarios/nombres de
  variables de datos (`factionBuildings` en `worldCatalog.ts`) como referencia histórica del
  catálogo, que no es el modelo viejo.
- **Punto 2** (CHECK constraint): `ProfessionProgress.saveId`/`companionId` es el ÚNICO par XOR
  real entre los modelos nuevos de esta sesión (`OrdenProduccion`/`AlmacenLimite` no tienen XOR,
  solo `buildingId`/`saveId` obligatorios sin alternativa) — `CHECK CONSTRAINT` real en Postgres
  añadido vía SQL crudo en la migración (Prisma no expresa `CHECK` en el DSL declarativo),
  verificado rechazando de verdad una fila con ambos campos nulos. Los pares XOR ya existentes
  (`KingdomStats`/`Building`/`ZonePoint`/`Npc.faction`) se quedan en el criterio solo-servicio de
  siempre, documentado en el propio modelo para que no se lea como inconsistencia accidental.
- **Punto 11** (cadáver/recuperación a `worldTick.ts`): nueva `advanceCorpseAndRecoveryTimeouts`
  (`companionSupervivencia.ts`, mismo vecindario que `advancePlayerSurvival`) — coexiste a
  propósito con `applyCondicionTimeouts` (turnResolution.ts, dentro del turno síncrono, decisión
  explícita de Álvaro: "la más completa y profesional"): el turno sigue aplicándolo al resolverse
  (cero riesgo de regresión) Y el tick de fondo cubre el hueco real (el mundo sigue aunque el
  jugador no actúe). 3 tests de integración nuevos contra Postgres real.

Verificado: `tsc -b` limpio, suite completa 2630/2630 en verde (sin ningún fallo de contención esta
vez, corrida completa en un solo intento).

### 5-cuater. Punto 13 — CERRADO e IMPLEMENTADO (2026-09-21, sesión posterior): clima en las 8 regiones

Bloqueaba § 4.5 (expediciones de facción). Decisión de Álvaro: "utilizar lo que hay si se puede,
pero respetar el lore de cada zona" — mismo mecanismo determinista de `climaFor`/`EstadoClima`/
`climaSeveridadAlMenos` reutilizado tal cual (sin ampliar el enum de 4 valores), pero cada región
tiene su propia proporción de severidad (`extremaCada`, coherente con su geografía real de
`areas.md`) y su propio léxico en `climaNombreFor` (nueva firma con `region` opcional) — el mismo
`TORMENTA_GRANDE` mecánico se narra "la ventisca" en Cristal Helado, "la crecida" en Ciénaga
Troncal, "la marea brava" en Costa del Azabache, nunca el genérico "gran tormenta" fuera de
Llanuras. Offset de fase propio por región (para que dos regiones vecinas no compartan el mismo
día de tormenta exacto).

Proporciones decididas por lore: Cristal Helado y Costa del Azabache (1 de cada 2 extrema — el
propio lore de adaptación física de los Helsig y el oleaje furioso de los Kalisar son la norma, no
la excepción); Llanuras y Susurro de las Raíces (1 de cada 3, sin cambios); Ciénaga Troncal (1 de
cada 3, el peligro real es el terreno, no el clima); Margen Silencioso (1 de cada 4, el peligro
real es el laberinto y Kroj); Meseta del Orden (1 de cada 5, orden Goirnte impuesto hasta al
propio territorio); Cicatriz de Cristal (1 de cada 6, la formación geológica protege la región).

Verificado: `tsc -b` limpio, 44/44 tests de `worldClock.test.ts` (incluye Llanuras exactamente
igual que antes del cambio — cero regresión en el diseño original), suite completa 2634/2634 en
verde. `docs/rpgtarkor/clima-tormentas.md` sigue siendo la referencia de diseño original
(Llanuras); las 7 regiones nuevas viven solo en el código, sin doc propio todavía — pendiente de
lore si Álvaro quiere expandir cada una con el mismo detalle narrativo que Llanuras.

**§ 5 y sus ampliaciones (5-bis/5-ter/5-cuater) quedan CERRADOS por completo** — los 13 puntos
originales tienen decisión y, donde aplicaba código inmediato (1, 2, 11, 13), están implementados
y verificados. Quedan como diseño puro, sin código todavía: 5 (aplicado dentro de 4.4/7.4 cuando se
construyan), 6 (aplicado dentro de 4.4), 7 (motor de eventos unificado, aplicado dentro de 4.4/8/9),
8 (IA de combate NPC), 9 (curvas dinámicas), 12 (aplicado dentro de 7.4).

---


---

## 6. Estado de este documento

**Actualizado 2026-09-21, cierre completo de la ronda "cerrar todo el backend del documento"**
(mandato explícito de Álvaro: "cerremos todo primero para así cuando nos pongamos con front tener
todo para ir diseñándolo y probándolo").

**BACKEND COMPLETO Y CERRADO**: § 4.2, § 4.3 (motor de eventos base), § 4.4 (diplomacia del
jugador + mercado regulado jugador↔Faction), § 4.6 (reproducción poblacional de facción), § 5 (los
13 puntos originales, con código donde aplicaba: FactionBuilding retirado, CHECK constraints
reales, timeouts de cadáver/recuperación en `worldTick.ts`, clima real en las 8 regiones), y § 7.4
piezas 1-5 y 7 (jerarquía Capital/Cuartel Avanzado con cupos, zona-interior dinámica de AMBOS,
parcelas estilo Travian, evento territorial enganchado a producción) — todo implementado y
verificado contra el sandbox real, suite completa **2657/2657 en verde**, sin ningún flake real en
la última pasada completa (los pocos fallos vistos durante la sesión en corridas EN PARALELO con
el resto de la suite grande fueron siempre contención/timing, reproducidos limpios en aislamiento).

**DISEÑADO A FONDO, SIN CÓDIGO TODAVÍA** (decisión explícita: piezas grandes y nuevas del todo,
mismo criterio en las tres — dejar el diseño completo y cerrado para implementar en sesión propia
en vez de comprimirlas en esta misma ronda): § 4.4 comercio de volumen Reino↔Faction
(`KingdomStats.riqueza`, la otra mitad del mercado regulado), § 4.5 completo (expediciones de
recolección/exploración de facción con escoltas e intercepción estilo X4 — los dos modelos de
soporte, `NpcProfessionPotential`/`NpcProfessionProgress`, SÍ están ya implementados), § 8 IA de
combate NPC por tramos de Inteligencia (los tramos &lt;10 y 10-20 ya estaban cubiertos por el
motor existente sin cambios; 20+ retirada/coordinación es la pieza nueva real).

**SIN DISEÑAR, PENDIENTE DE GROUNDING DEDICADO**: § 9 (Movimiento en Zona / Profesiones-talento-
nivel-energía) — la única pieza de todo el documento que no se tocó en esta ronda, tal como el
propio § 5-bis punto 9 ya pedía explícitamente no improvisar sin una pasada de grounding propia.

**Frontend de TODA la sesión sigue sin tocar a propósito** — mandato explícito de Álvaro: cerrar
TODO el backend primero (cumplido) antes de abrir una pasada dedicada de frontend viendo qué
información es útil mostrar, dónde, qué animaciones dan vida a esto y qué vistas ya existentes
conviene refactorizar (panel de Reino completo — Building/OrdenProduccion/AlmacenLimite/
diplomacia/mercado —, icono de parcela en el mapa de Zona, modal de Construir, estado de Cuartel
Avanzado/mejoras/cupos, etc.). Siguiente paso real del proyecto: esa pasada de frontend.
