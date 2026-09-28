# Un mundo con vida propia, estilo X4 Foundations — índice

[← Volver al índice del mundo](../lore-mundo/07-mundo-helek-sirik.md)

El Reino del jugador y las facciones NPC juegan con el **mismo motor de reglas**: construyen,
producen, comercian y se relacionan por eventos discretos. El motor decide; el LLM solo narra.
Referencias: X4 Foundations (economía y facciones), Bellwright (producción y trabajadores) y D&D
(escalones de nivel).

**Cómo funciona hoy, qué está roto y qué falta:**
[22-mundo-vivo-x4-tecnico.md](../../arquitectura/22-mundo-vivo-x4-tecnico.md). Es la referencia
técnica verificada contra el código; empieza por ahí.

## Documentos de diseño

Explican el porqué de cada pieza. Conservan la numeración de secciones del documento original
(2026-09-21), porque el código la cita (`mundo-vivo-x4.md § 7.4` y similares); la tabla de
correspondencias está en el [§ 13 de la referencia técnica](../../arquitectura/22-mundo-vivo-x4-tecnico.md#13-dónde-estaba-cada-sección-antigua).

| Documento | Qué cubre | Secciones |
|---|---|---|
| [Visión y fundamentos](mundo-vivo-x4-vision.md) | A qué se quiere llegar, inventario de lo que existía antes, lectura de conjunto | § 1-3 |
| [Construcciones y economía de Reino](construcciones-reino.md) | Modelo único jugador/facción, panel de Reino, órdenes de producción, Capital, Cuartel Avanzado y parcelas | § 4.2, 4.4-bis, 4.4-ter, 7.1, 7.4 |
| [Edificios de oficio](edificios-de-oficio.md) | Un edificio por oficio, 3 niveles, plazas de trabajador, qué tiene cada facción | — |
| [Facciones y diplomacia](facciones-diplomacia.md) | Relaciones entre facciones, diplomacia del jugador, mercado, líderes, facciones nuevas | § 4.3, 4.4, 7.2, 7.3 |
| [Expediciones y población](expediciones-poblacion.md) | Expediciones de facción (sin código), población de facción | § 4.5, 4.6 |
| [IA de combate y curvas dinámicas](../sistemas-combate/ia-combate-y-mundo.md) | Tramos de Inteligencia en combate, señales dinámicas pendientes | § 8, 9 |
| [Compañeros y supervivencia](companeros-y-supervivencia.md) | Captura, tameo, hambre y sed, equipo del Reino por plantilla | — |

---

## Decisiones cerradas

Los 13 puntos abiertos de la sesión de diseño del 2026-09-21 se cerraron con Álvaro uno a uno y se
revisaron juntos para comprobar que no se contradicen. Resumen en la
[referencia técnica § 11](../../arquitectura/22-mundo-vivo-x4-tecnico.md#11-decisiones-cerradas);
aquí queda el razonamiento.

### 5-bis. Los 13 puntos

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

**Coherencia entre puntos:** 3 y 4 se refuerzan (Reino por partida y atado al turno); 5 y 8
comparten principio (la Inteligencia del NPC decide); 6 respeta la distinción Companion/NPC; 7 se
invoca desde el turno y desde `worldTick.ts`; 13 fija orden de trabajo.

**Revisión 2026-09-28:**
- El punto 3 no se cumple del todo: las facciones de catálogo tienen `saveId` null, así que su
  `KingdomStats` y sus edificios son de mundo, compartidos por todas las partidas (referencia
  técnica, hueco H-6).
- El punto 12 choca con el canon: 3 de las 4 regiones "sin dueño" (Cicatriz de Cristal, Susurro de
  las Raíces, Costa del Azabache) son de Vaelira, fuera de juego. El Margen ya tiene dueñas
  (A-02/A-04). Pendiente de Álvaro (pregunta P-4).

### 5-ter. Puntos implementados el 2026-09-21

- **Punto 1:** `FactionBuilding` ya no existe ni en el esquema ni en Postgres; `factionBuildings`
  en `worldCatalog.ts` es solo el nombre de la lista de datos.
- **Punto 2:** `CHECK CONSTRAINT` real en `ProfessionProgress` (`saveId`/`companionId`) y, después,
  en `AlmacenItem` (`saveId`/`factionId`). Los pares antiguos siguen validados en servicio.
- **Punto 11:** `advanceCorpseAndRecoveryTimeouts` (`companionSupervivencia.ts`) en `worldTick`,
  conviviendo a propósito con `applyCondicionTimeouts` del turno.

### 5-cuater. Punto 13: clima en las 8 regiones

Mismo `climaFor` determinista para todas; cada región tiene su proporción de días extremos, su
desfase y su léxico en `climaNombreFor`. Tabla de proporciones en la
[referencia técnica § 5.9](../../arquitectura/22-mundo-vivo-x4-tecnico.md#59-clima-por-región--worldclockts).
[clima-tormentas.md](../lore-mundo/clima-tormentas.md) sigue siendo el diseño original (Llanuras);
las demás regiones solo viven en el código.

---

## Historial

### 4.1 Mapa de reutilización antes de empezar (2026-09-21)

Foto de partida: qué pieza existente se podía generalizar y a qué coste. Todo lo que dice "sin
`factionId`" o "no existe" ya se construyó; ver la referencia técnica.

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
