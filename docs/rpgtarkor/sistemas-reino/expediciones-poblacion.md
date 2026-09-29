# Expediciones y población de facción

[← Volver al índice](mundo-vivo-x4.md)

**Estado (2026-09-28):** § 4.5 diseñado, sin código (ni siquiera se siembran
`NpcProfessionPotential`/`NpcProfessionProgress`). § 4.6 implementado; desde la tanda A-01..A-05 son
9 facciones con población, no 4. Ver la [referencia técnica](../../arquitectura/22-mundo-vivo-x4-tecnico.md).

---

### 4.5 Expediciones de recolección/exploración de facción — DISEÑO CERRADO (2026-09-21, sesión
posterior), sin código todavía

Las dos preguntas originales quedaron resueltas:

**Pregunta 1 (inputs sintéticos) — CERRADA**: las expediciones se resuelven a nivel de un `Npc`
concreto de la facción, nunca un agregado. Con eso, grounding real Bannerlord (`WebSearch`:
"some companions start out with high stats and little room to grow; others are blank slates with
lots of potential... learning_limit = (attribute-1)*10 + skill_focus*30") llevó a una pieza nueva
que el documento original no anticipaba — petición explícita de Álvaro: "un guerrero nato nunca
será buen minero por mucha XP que acumule, otros que son mejores trabajadores que otros... quiero
que tengan XP tanto de nivel como de profesión". Dos modelos nuevos junto a `Npc` (ya
**implementados**, ver schema.prisma):

- **`NpcProfessionPotential`** (`npcId`, `professionId`, `nivelMaximo` 1-9) — el TOPE real de ese
  Npc en ese oficio, sembrado a mano en `worldCatalog.ts` (mismo criterio que
  `Npc.teachesProfession`). Sin fila = no puede ejercer ese oficio en absoluto.
- **`NpcProfessionProgress`** (`npcId`, `professionId`, `nivel`, `xp`) — progreso real, mismo
  shape/fórmulas que `ProfessionProgress` (`professionLevelForXp`/`xpForCraftSuccess` reutilizados
  tal cual), pero modelo PROPIO — decisión explícita: "una cosa son companions... y otra es
  NPC/fauna de facción, van por separado", nunca una tercera vía del XOR de `ProfessionProgress`.
  `nivel` acotado en servicio (no CHECK de SQL) por `NpcProfessionPotential.nivelMaximo`.

**Pregunta 2 (concepto de "grupo/expedición") — CERRADA, más rica de lo previsto**: no es un grupo
simple de recolectores (candidato original del documento) — petición explícita de Álvaro,
grounding real X4 (`WebSearch`: escoltas con orden "Defend" responden SOLO a ataques contra el
convoy que protegen; el trader tiene política ante amenaza — atacar/ceder/huir; facciones
piratas/hostiles pueden interceptar un convoy indefenso en tránsito): "grupos que se podrán
combinar con guardias para defenderlos, ya que es posible que otras facciones ataquen estos
cargamentos si pasas por una zona hostil".

Modelo de datos propuesto (sin código todavía):

- **`Expedicion`**: `factionId`, `buildingId` de origen (de dónde salen los Npc), `destinoLocationId`
  (Location real a recolectar), `status` (`EN_TRANSITO`/`RECOLECTANDO`/`RETORNANDO`/`COMPLETADA`/
  `INTERCEPTADA`), `busyUntil` (mismo patrón que `CharacterTransit`, pero SIN `@@unique([saveId])`
  — varias expediciones de la MISMA facción corren en paralelo, a diferencia del tránsito único del
  jugador).
- **`ExpedicionMember`**: `expedicionId`, `npcId`, `rol` (`'recolector'` | `'guardia'`) — mismo
  criterio de texto libre que `Companion.rolReino`. Los `recolector` aportan la tirada de
  recolección (mismo `gatheringRollFor`-equivalente, usando `NpcProfessionProgress`); los `guardia`
  solo participan si la expedición es interceptada, nunca en la tirada de recolección.
- **Riesgo de intercepción**: se calcula al iniciar la expedición (o al cruzar cada tramo, a
  decidir en implementación) a partir de `FactionRelation` entre la `Faction` dueña y cualquier
  otra `Faction` con `REGION_OWNING_FACTIONS` en la región atravesada — región de una facción en
  `GUERRA`/`TENSION` con la propia = riesgo real; `NEUTRAL`/`TRATADO_COMERCIAL`/`ALIANZA` = sin
  riesgo. Reutiliza `FactionRelation.presion` ya construido, no una tabla de riesgo nueva.
- **Resolución de intercepción**: si se dispara, los `guardia` de la expedición (con sus propios
  `attributes`/nivel) se enfrentan a un `Npc` real de la facción hostil de esa región — mismo motor
  de resolución de combate ya existente (`resolveExchange`/`combateMultipleOrquestacion.ts`,
  reutilizado, no un sistema de combate nuevo), pero corriendo en `worldTick.ts` (tiempo de
  servidor, sin jugador de por medio) en vez de en el turno síncrono. Sin `guardia` asignado, la
  expedición se pierde automáticamente si el riesgo se dispara (mismo criterio "sin escolta, el
  trader es vulnerable" de X4).
- **Al completarse sin intercepción**: los recolectores aplican su tirada contra
  `candidateSourcesFor`/`HarvestYield` de la `Location` destino (reutilizado tal cual, ya puro), el
  resultado se deposita en `AlmacenItem.factionId` de la facción dueña — mismo Almacén que ya
  alimenta `OrdenProduccion`/mercado regulado, cerrando el círculo completo de la economía de
  facción construida hoy.

**Implementado (2026-09-29, Fase 13 del plan):** potencial y progreso de oficio de 30 NPC (empiezan
en nivel 1), ciclo de expedición en `worldTick` (`services/factionExpeditions.ts`, días de ficción),
recolección con la misma tirada que el jugador, botín al Almacén de la facción, intercepción con
`resolveExchange` por rondas y bajas del 3 % para quien cae, con muerte de mundo
(`Npc.muertoEnMundo`). Los valores por defecto están en las preguntas del roadmap.

~~**Sin código todavía**~~ — pieza grande, nueva del todo (primer combate-en-tránsito de facción del
proyecto), diseño completo dejado aquí para implementar en la siguiente sesión dedicada. No bloquea
el resto de piezas cerradas hoy.

### 4.6 Reproducción poblacional — CERRADO e implementado (2026-09-21, sesión posterior a § 7)

Decisión tomada: **RAZA y FACCION son dos conceptos distintos, no un duplicado** — hallazgo real al
diseñar esto (`orcos-llanuras`/`orcos-cristal-helado`/`orcos-cienaga`, ya sembradas como `RAZA`,
YA se usaban de facto como "población de Serhu/Helsig/Goshg" en `worldAgenda.ts`, pero mezclaban
dos ideas). Aclarado con Álvaro: `RAZA` es la población NEUTRA de fondo de toda la región (el
"pool" del que en el futuro pueden emerger candidatos a fundar facciones menores o nuevas, concepto
X4) — `FACCION` es el SUBCONJUNTO de esa misma raza que ya está organizado bajo un poder real
concreto, nunca el total. Serhu/Helsig/Goshg no absorben a todo su clan orco regional; Concordia
(alianza militar, no todo el pueblo goirnte) ni de lejos absorbe a todos los `goirntes` de la
Meseta — deja margen real para que emerjan más facciones goirntes después (p. ej. la propia
facción moderada de Yovenne Tal, hoy sin `Faction` propia).

Respuesta a la pregunta abierta (militar/civil/ambas): **ninguna de las tres tal cual** — se
reutilizan las 4 categorías que `KingdomStats` YA tiene (generalizado a `Faction` en § 4.2):
`poblacion`/`soldados`/`trabajadores`/`visitantes`, no solo 2. 4 filas `WorldPopulation` nuevas por
facción (`<slug>-poblacion`/`-soldados`/`-trabajadores`/`-visitantes`, `worldPopulation.ts`),
repartidas por LORE real de cada una, no una proporción plana (petición explícita: "las
reparticiones hazlas lógicas según el lore"):
- **Serhu** (720 de 800 `orcos-llanuras`): elite militarizada al servicio de los Ketg, casta baja
  casi esclavizada, "gobierna por miedo, no por honor" — la más `soldados` (500), poca `poblacion`
  no combatiente (70), `trabajadores` intermedio (150, la casta sometida).
- **Helsig** (360 de 400): mineros/artesanos, "perfil neutral y defensivo" — mayoría
  `trabajadores` (250), poca milicia (`soldados`: 60, solo defensa).
- **Goshg** (540 de 600): cazadoras de dos tribus, "perfil neutral y defensivo" — similar a Helsig
  (`trabajadores`: 350, `soldados`: 80), algo más `poblacion` general (110, dos tribus).
- **Concordia de Hierro** (1600 de 4000 `goirntes`): "alianza militar formada tras El Detonante" —
  la más militarizada en proporción (`soldados`: 900), pero solo una fracción del pueblo goirnte.
- `visitantes: 0` en las 4 (sin mecánica de visitantes NPC todavía, no se inventa un número).

Código: `population.ts` § `syncFactionPopulationToKingdomStats` — puente nuevo entre
`WorldPopulation` (crece con `growAllPopulations`, ya existía) y el `KingdomStats` real de cada
`Faction` (§ 4.2), enganchado en el mismo tick de `worldTick.ts`. `seed-catalog.ts` siembra el
`KingdomStats` inicial de las 4 facciones a partir de estas mismas filas (sin duplicar números en
dos sitios). 5 tests unitarios + 1 test de integración real contra Postgres (flujo completo de dos
pasos: crecer → sincronizar, verificado con delta relativo por la naturaleza compartida de
`WorldPopulation`, no un valor fijo). Suite completa **2596/2596 en verde**, sin ningún flake.

---

