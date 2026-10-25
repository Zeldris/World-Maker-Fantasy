# Lore — hallazgos

Registro cronológico (más antiguo arriba, añadir SIEMPRE al final) de desfases entre `docs/rpgtarkor/*.md`
y el catálogo técnico real (`worldCatalog.ts`, servicios de backend) encontrados en una auditoría de
lore — distinto de `revisar-partida-hallazgos.md` (síntomas de partida en marcha) y de
`deuda-tecnica-hallazgos.md` (calidad de código). Regla del proyecto: un HUECO simple (el `.md` no
menciona algo que el código ya tiene) se anota sin más; una CONTRADICCIÓN real (el `.md` afirma X, el
código hace Y, incompatibles) nunca se decide en silencio — se pregunta a la usuaria y se registra su
respuesta aquí.

Cada entrada: fecha, zona auditada, hallazgo, y estado.

---

## Estado verificado (2026-09-28)

| Entrada | Estado |
|---|---|
| Banners "nada implementado" de `combate-multiple.md` y `companeros-y-supervivencia.md` | ✅ Corregidos |
| `reclutablePct` sin usar en la persuasión | ✅ Enganchado (`companionSupervivencia.ts`) |
| Plantillas básicas no editables | ✅ Existen (`PLANTILLAS_BASICAS`, `personalizada: false`, `reino.ts`) |
| `personajes.md` con Arcano como atributo | ✅ Corregido: Arcano es una escuela de Magia |
| `clases.md`: CANALIZAR y tablas desincronizadas | ✅ Corregido el 09-15; cabecera revisada el 09-28 (232 habilidades) |
| Sistema de cuadrícula, colisión e Interactuar sin documento propio | ✅ [20-zona-cuadricula-interactuar.md](../mecanicas/20-zona-cuadricula-interactuar.md) |
| `Faction.description` estática | Decidido: se queda así |
| Muerte por inanición tapada en CONVALECIENTE | Decidido: a propósito |

## Índice

**2026-10-25 — `QA-240`, asentar el lore de la enciclopedia**
- [Bloque 1: NPC, razas y personajes](#2026-10-25--qa-240-bloque-1-npc-razas-y-personajes-de-la-enciclopedia)

**2026-09-15 — auditoría de lore de los sistemas nuevos post-2026-09-07 (combate múltiple con
compañeros, cuadrícula/Interactuar, Cazadora Serhu, MedioMovimiento)**
- [combate-multiple.md confirmado sin discrepancias, muy bien mantenido](#combate-multiplemd--confirmado-sin-discrepancias-muy-bien-mantenido)
- [clases.md: CANALIZAR — autocontradicción real dentro del propio documento](#clasesmd--canalizar-autocontradicción-real-dentro-del-propio-documento-staleness-no)
- [clases.md: cabeceras de sección y tabla-resumen final desincronizadas de sus propias tablas detalladas](#clasesmd--cabeceras-de-sección-y-tabla-resumen-final-desincronizadas-de-sus-propias-tablas)
- [Sistema de cuadrícula/colisión "Interactuar" — hueco de documentación completo](#sistema-de-cuadrículacolisión-interactuar-zonaposicionts--hueco-de-documentación-completo)
- [MedioMovimiento — solo 2 fichas marcadas, coherentes con su prosa](#mediomovimiento--solo-2-fichas-marcadas-ambas-coherentes-con-su-prosa-existente)
- [ZonePoint "Cazadora Serhu" — hueco simple, sin contradicción](#zonepoint-cazadora-serhu--campamento-serhu-sembrado-2026-09-15--hueco-simple-sin)

**2026-09-15 (segunda ronda) — barrido de zonas menos auditadas (items.md, razas.md, personajes.md,
npcs.md)**
- [personajes.md: tabla de atributos jugables y nota "no aplicada al motor todavía" desactualizadas frente al rename Arcano→Magia del 2026-09-01](#personajesmd--tabla-de-atributos-jugables-y-nota-no-aplicada-al-motor-todavía-desactualizadas)
- [items.md, razas.md, npcs.md — confirmados sin discrepancias tras verificación puntual](#itemsmd-razasmd-npcsmd--confirmados-sin-discrepancias-tras-verificación-puntual)

**2026-09-07 — auditoría de lore post-2026-08-25 (frente paralelo de la ronda de 4 agentes)**
- [clases.md: tabla-resumen y secciones detalladas de Guerrero/Cazador/Chamán/Arquero vuelven a desactualizarse tras la siembra de 22 habilidades del 2026-08-31](#2026-09-07--clasesmd-tabla-resumen-y-secciones-detalladas-de-guerrerocazadorchamánarquero-vuelven-a-desactualizarse-tras-la-siembra-de-22-habilidades-del-2026-08-31)
- [Confirmado sin discrepancias — mundo determinista/agenda, Faction.description estática, banners, actualizaciones-pendientes-lore.md ya cubrió fauna/flora/vocabulario](#2026-09-07--confirmado-sin-discrepancias--mundo-deterministaagenda-factiondescription-estática-banners-actualizaciones-pendientes-loremd-ya-cubrió-faunafloravocabulario)

**2026-08-25 — primera auditoría de lore centrada en sistemas nuevos post-2026-08-23 (3 agentes en paralelo)**
- [combate-multiple.md sigue con el banner "nada implementado" pese a estar construido e integrado](#2026-08-25--combate-multiplemd-sigue-con-el-banner-nada-implementado-pese-a-estar-construido-e-integrado)
- [combate-multiple.md dice que NpcState.groupSize/groupDefeated se retiran — el código los mantiene a propósito](#2026-08-25--combate-multiplemd-dice-que-npcstategroupsizegroupdefeated-se-retiran--el-código-los-mantiene-a-propósito)
- [Faction.description de Helsig/Goshg estática pese a que worldAgenda puede escalar el conflicto — DECIDIDO: se queda estática](#2026-08-25--factiondescription-de-helsiggoshg-estática-pese-a-que-worldagenda-puede-escalar-el-conflicto--decidido-se-queda-estática)
- [clases.md: tabla-resumen final y 3 especializaciones desactualizadas frente al código real](#2026-08-25--clasesmd-tabla-resumen-final-y-3-especializaciones-desactualizadas-frente-al-código-real)
- [companeros-y-supervivencia.md sigue con el banner "nada implementado" pese a estar aplicado de punta a punta](#2026-08-25--companeros-y-supervivenciamd-sigue-con-el-banner-nada-implementado-pese-a-estar-aplicado-de-punta-a-punta)
- [companeros-y-supervivencia.md describe muerte real por inanición — el código la tapa a propósito en CONVALECIENTE](#2026-08-25--companeros-y-supervivenciamd-describe-muerte-real-por-inanición--el-código-la-tapa-a-propósito-en-convaleciente)
- [reclutablePct nunca se usa en la tirada de persuasión pese a que el .md lo promete como dificultad base — DECIDIDO: hay que engancharlo](#2026-08-25--reclutablepct-nunca-se-usa-en-la-tirada-de-persuasión-pese-a-que-el-md-lo-promete-como-dificultad-base--decidido-hay-que-engancharlo)
- [Plantillas de equipo "básicas, no editables" prometidas por el .md no existen — toda plantilla es personalizada hoy](#2026-08-25--plantillas-de-equipo-básicas-no-editables-prometidas-por-el-md-no-existen--toda-plantilla-es-personalizada-hoy)
- [Menores agrupados — clima/estaciones, sin acción](#2026-08-25--menores-agrupados--climaestaciones-sin-acción)

---

## 2026-08-25 — combate-multiple.md sigue con el banner "nada implementado" pese a estar construido e integrado

**Hallazgo (auditoría de lore, agente en paralelo, staleness — no requiere decisión de canon)**: el
encabezado de `docs/rpgtarkor/sistemas-combate/combate-multiple.md` (fechado 2026-08-24) afirma literalmente "**Nada
de esto está implementado en el motor todavía** — documentación pura". El sistema está construido e
integrado de verdad desde el día siguiente (2026-08-25): modelos `CombatEncounter`/
`CombatParticipant` reales, iniciativa N-way, emparejamiento por Inteligencia
(`INTELIGENCIA_TACTICA_UMBRAL=12`, coincide con lo que describe el propio `.md`), partición 4v4,
resolución del turno de la jugadora con paridad completa, disparo real desde `cazar.ts`, hasta un
bug de timeout de transacción ya cazado y arreglado en producción (ver
[[tarkor_prisma_timeout_combate_multiple_fijado_2026-08-25]]). El `.md` nunca se actualizó tras esa
pasada de código — a diferencia de `materiales-procesados-construccion.md`, que sí lleva una sección
final "APLICADO al motor" describiendo con precisión lo que hay realmente.

**Estado**: FIJADO (commit `57d7042`, 2026-08-25) — título y banner actualizados a "APLICADO al
motor", con el estado real de cada pieza construida.

## 2026-08-25 — combate-multiple.md dice que NpcState.groupSize/groupDefeated se retiran — el código los mantiene a propósito

**Hallazgo**: `combate-multiple.md` (§ "Qué existe hoy" y § 5) da por hecho que
`NpcState.groupSize`/`groupDefeated` "se retira[n]" una vez construido el motor nuevo. El código
real hace justo lo contrario A PROPÓSITO: `turnResolution.ts` (~líneas 4225-4263) materializa el
resultado de un `CombatEncounter` de grupo DENTRO de esos mismos campos al resolverse el encuentro,
con comentario explícito citando una decisión ya tomada con la usuaria: reutilizar el pipeline de
saqueo/desuello clásico tal cual, en vez de un mecanismo nuevo. Estos campos siguen vivos y en uso
real en `recolectar.ts`/`harvest.ts`/`npcScene.ts`. Confirma lo que ya documentaba
[[tarkor_combate_multiple_2026-08-24]] — el `.md` simplemente no se actualizó tras esa decisión.

**Estado**: FIJADO (commit `57d7042`, 2026-08-25) — corregido en "Qué existe hoy" y reescrita § 5
entera con el estado APLICADO real de cada punto, incluida esta corrección explícita.

## 2026-08-25 — Faction.description de Helsig/Goshg estática pese a que worldAgenda puede escalar el conflicto — DECIDIDO: se queda estática

**Hallazgo (contradicción real, pregunta abierta resuelta con la usuaria en esta sesión)**:
`Faction.description` de Clan Helsig y Clan Goshg (`worldCatalog.ts:4925-4932`) afirma en presente
estático "Mantienen un perfil neutral y defensivo ante los Goirntes, evitando la confrontación
abierta" (decisión de lore de 2026-08-05). `worldAgenda.ts` (2026-08-24/25) construye un sistema que,
sin intervención de la jugadora, puede escalar ese mismo conflicto hasta su etapa final: "guerra
abierta, con bajas reales en ambos bandos cada semana" (`STAGE_FACTS[4]`). Ningún mecanismo actualiza
`Faction.description` cuando la agenda avanza de etapa — si la partida llega a esa etapa, la
Enciclopedia seguiría mostrando "evitan la confrontación abierta" mientras el canal WORLD y los
`sessionFacts` ya narran guerra abierta.

**Decisión de la usuaria (2026-08-25)**: **foto fija, a propósito.** `Faction.description` es lore de
fondo/identidad, no un parte de guerra en vivo — la escalada real del conflicto se cuenta
narrativamente (hechos de sesión, canal WORLD), no en la ficha de Enciclopedia. No hace falta ningún
mecanismo de sincronización.

**Estado**: RESUELTO — NO ES BUG, decisión de diseño confirmada. No requiere ninguna acción de código
ni de doc.

## 2026-08-25 — clases.md: tabla-resumen final y 3 especializaciones desactualizadas frente al código real

**Hallazgo**: la tabla-resumen final de `clases.md` (§ "Las 9 clases, resumen final de bloqueo",
líneas ~1163-1183) no coincide ni con las secciones detalladas del mismo documento ni con
`classAbilities.ts`, para Guerrero y Cazador — da una imagen más optimista que la real:

| Especialización | Tabla resumen dice | Real (código + secciones detalladas) |
|---|---|---|
| Berserker | 5/8 | 1/8 |
| Guardián | 5/8 | 1/8 |
| Lancero | 8/8 | 2/8 |
| Especialista | 8/8 | 4/8 |
| Domador | 2/8 | 0/8 |
| Supervivencia | 5/8 | 1/8 |
| Tirador | 8/8 | 5/8 |
| Instintivo | 8/8 | 4/8 |

Además, 3 especializaciones más (líneas 723-777) tienen sus PROPIAS secciones detalladas
desactualizadas frente al código, sin relación con la tabla resumen de arriba:
- **Rúnico**: el `.md` dice "4 de 8 listas (19/24/36/40)"; el código real solo tiene 2/8 (24 y 40) —
  la propia fila 19 ya está marcada "⚠️ bloqueada" en su propia tabla, contradiciendo la
  frase-resumen que la cuenta como lista.
- **Convocador**: el `.md` dice "6 de 8 listas"; el código real solo tiene 1/8 (nivel 28, Puño
  Ígneo).
- **Opresor**: el `.md` dice "3 de 8 listas (12/24/32)"; el código real solo tiene 2/8 (12/24 — el
  nivel 32 "Runa de Sujeción", marcado ✅ en la tabla, no está en el código).

**Estado**: FIJADO (commit `f1bf8bb`, 2026-08-25) — tabla-resumen corregida para Guerrero/Cazador;
Rúnico/Convocador/Opresor con nota de corrección explícita (recuento real 2/8, 1/8, 2/8) y el error
de datos real de la fila 36 de Rúnico (✅/⚠️ mezclados) arreglado. Cierra el checklist de las 3
auditorías (22/22).

## 2026-08-25 — companeros-y-supervivencia.md sigue con el banner "nada implementado" pese a estar aplicado de punta a punta

**Hallazgo**: el banner superior de `companeros-y-supervivencia.md` (líneas 5-12) dice literalmente
"Nada de esto está implementado en el motor todavía: documentación pura, mismo criterio que
clases.md". Esto ya no es cierto — `companionSupervivencia.ts`/`companeros.ts` implementan de punta
a punta captura, jaulas, tameo/persuasión con tirada opuesta, Felicidad, slot garantizado del
Domador, comida/agua de compañero y de jugadora, equipo de compañero, Almacén de Reino y plantillas
(ver [[tarkor_companeros_supervivencia_aplicado_2026-08-25]]). Como consecuencia directa, toda la
sección "§ 7 Infraestructura nueva necesaria" (que enmarca cada pieza como "nada de esto existe hoy")
también está obsoleta — cada ítem de esa lista ya está construido.

**Estado**: FIJADO (commit `5a38692`, 2026-08-25) — título y banner actualizados a "APLICADO al
motor", § 7 reescrita entera con el estado real de cada punto.

## 2026-08-25 — companeros-y-supervivencia.md describe muerte real por inanición — el código la tapa a propósito en CONVALECIENTE

**Hallazgo**: § 5 del `.md` dice "si Comida y Agua están ambas a 0%... la vida sigue bajando sin
suelo, hasta la muerte real si se ignora del todo". El código (`condicionPorSupervivencia`,
`companionSupervivencia.ts` líneas 126-146) topa explícitamente en CONVALECIENTE incluso con ambas
carencias a la vez — la muerte por inanición se deja fuera a propósito (comentario propio del código:
falta enganchar el pipeline real de muerte/respawn). Coincide con lo ya documentado en
[[tarkor_companeros_supervivencia_aplicado_2026-08-25]] ("solo falta muerte por inanición, fuera a
propósito") — el `.md` simplemente no avisa de esta excepción temporal.

**Estado**: FIJADO (commit `5a38692`, 2026-08-25) — nota de excepción añadida en § 5, marcada como
la única pieza de todo el documento que sigue siendo solo diseño.

## 2026-08-25 — reclutablePct nunca se usa en la tirada de persuasión pese a que el .md lo promete como dificultad base — DECIDIDO: hay que engancharlo

**Hallazgo (contradicción real, pregunta abierta resuelta con la usuaria en esta sesión)**: § 3 de
`companeros-y-supervivencia.md` afirma explícitamente que `Npc.reclutablePct` es la dificultad base
de la tirada de persuasión de NPCs (ejemplo citado: Torgash Ketg, `reclutablePct: 5`, "casi nunca
cede por persuasión sola"). El código real (`resolverIntento`, llamado igual para persuasión que para
tameo de fauna) nunca lee `reclutablePct` en ningún punto de `companionSupervivencia.ts` ni
`companeros.ts` — es tirada opuesta pura atributo-contra-atributo, sin ningún ajuste por ese campo.
Con el código tal cual está, Torgash Ketg es hoy igual de persuadible que un NPC con
`reclutablePct: 95`, siempre que los atributos cuadren.

**Decisión de la usuaria (2026-08-25)**: **hay que engancharlo.** Es el diseño original y da sentido
real a por qué un NPC con `reclutablePct` bajo debería resistirse a la persuasión aunque sus
atributos cuadren — no es una simplificación deliberada, es un hueco de implementación real.

**Estado**: FIJADO (commit `a59f4e3`, 2026-08-25) — `resolverIntento` (companionSupervivencia.ts)
añade una resistencia extra derivada del % (100 = sin penalización, cada 10 puntos por debajo suman
+1 de resistencia efectiva) sin tocar `rollOpposed`/dice.ts. Aplicado también a `domesticablePct`
(fauna), mismo bug simétrico en la misma función compartida. Tests nuevos prueban el caso real
citado por el doc: con `reclutablePct: 5`, una tirada que con atributos puros habría ganado, pierde.

## 2026-08-25 — Plantillas de equipo "básicas, no editables" prometidas por el .md no existen — toda plantilla es personalizada hoy

**Hallazgo (hueco, no contradicción)**: § 6 de `companeros-y-supervivencia.md` distingue plantillas
"Básicas, no editables: vienen ya hechas por rol... listas para usar sin configurar nada" de las
"Personalizadas, creadas por ti". En el código, `POST /saves/:id/plantillas` exige siempre
`name`/`rol`/`slots` manuales y no hay ningún seed de plantillas básicas por rol en ningún sitio
(`creation.ts` solo hace `deleteMany` de plantillas al crear partida). Tampoco
`PATCH /plantillas/:plantillaId` restringe la edición según un campo `personalizada`. Hoy toda
plantilla se comporta como "personalizada" — la promesa de básicas "listas sin configurar nada" no
está entregada.

**Estado**: FIJADO como documentación primero (commit `5a38692`, 2026-08-25) — decisión inicial de
la usuaria (item 22 del checklist): marcar explícitamente el hueco en el `.md` en vez de
implementar el seed real. **Implementado de verdad al día siguiente (2026-08-26)** — seed real de
plantillas básicas por rol en `reino/fundar` + guard de no-editable en backend y frontend, ver
`checklist-cierre-auditorias-2026-08-25.md` item 22 y `companeros-y-supervivencia.md` § 6.

## 2026-08-25 — Menores agrupados — clima/estaciones, sin acción

**Hallazgos cosméticos** (auditoría de lore, zona mundo determinista/estaciones/clima — sin
discrepancias sustantivas encontradas en esas 2 zonas, solo estas notas menores):
- `clima-tormentas.md` es internamente inconsistente consigo mismo: su tabla dice "Tormenta Grande
  ~27 días / Tormenta Extrema ~13 días" pero el cálculo real sobre el código da 26/14 exactos — el
  propio texto de grounding más arriba en el mismo documento ya dice correctamente "~14 días/año"
  para Extrema. No es desfase con el código, es un desfase del documento consigo mismo.
- La cita de línea que da `clima-tormentas.md` para "Las Agujas Imán está en Las Llanuras del Viento
  Rojo" (`worldCatalog.ts:3535`) ya no apunta ahí por crecimiento del archivo — las líneas reales son
  2765/3778/3897. Contenido correcto, solo la cita de línea desactualizada.

**Confirmado sin discrepancias**: mundo determinista (cadencia de 7 días, nombres/bandos de
Faction), estaciones (nombres Kektira, calendario 120 días, `estacionRequerida` solo en boungo),
clima (`climaRequerido` solo en arena-imán/esquirla, ciclo 40/40/40 confirmado matemáticamente).

**Estado**: NO ES BUG / cosmético, sin acción necesaria.

## 2026-09-07 — clases.md: tabla-resumen y secciones detalladas de Guerrero/Cazador/Chamán/Arquero vuelven a desactualizarse tras la siembra de 22 habilidades del 2026-08-31

**Contexto**: esta auditoría (frente de lore de una ronda de 4 agentes en paralelo, backend/
frontend/deuda técnica/lore) parte de la última entrada real de este archivo (2026-08-25). En el
intervalo hubo una ronda de auditoría de lore muy exhaustiva el 2026-09-05/06 (ver
`docs/rpgtarkor/lore-mundo/actualizaciones-pendientes-lore.md`, 14/14 huecos de diseño + 9/9 + 11/12 hallazgos
código↔doc cerrados) que cubrió a fondo mecanismos físicos, fauna/flora, geografía y vocabulario —
pero no volvió a re-auditar el conteo de habilidades de clase, porque su foco fue otro. Este
hallazgo llena ese hueco concreto.

**Hallazgo (staleness, no contradicción de diseño — mismo patrón ya corregido el 2026-08-25)**: la
misma tabla-resumen de `clases.md` (§ "Las 9 clases, resumen final de bloqueo") que ya se corrigió
el 2026-08-25 (commit `f1bf8bb`) volvió a desincronizarse, porque el código avanzó después de esa
corrección y el `.md` nunca se volvió a tocar. Concretamente:
- **Auditoría 2026-08-31** (`classAbilities.ts`, comentario de cabecera): sembró 22 habilidades de
  golpe en Guerrero/Cazador/Chamán ("el bloqueo real que quedaba en la mayoría de ellas era una
  asunción incorrecta — AUMENTO/DEBILIDAD solo funcionan en ataque — no falta de infraestructura").
  Esa auditoría corrigió su propio recuento en el comentario del código, pero nunca se propagó de
  vuelta a `clases.md`: la tabla-resumen y las secciones detalladas de Berserker/Guardián/Lancero/
  Especialista/Domador/Supervivencia/Tirador/Instintivo/Totémico/Rúnico/Convocador/Opresor seguían
  marcando como "⚠️ bloqueada... sin sembrar" o "sembrable YA" filas que el código real ya tenía
  sembradas desde esa misma pasada — 19 filas en total corregidas en esta auditoría, verificadas una
  a una contra `classAbilities.ts` (no solo contra el comentario del propio código, que también
  tenía un pequeño desfase: contaba Domador en 1/8 cuando el recuento real es 2/8).
- **Maestro Arquero/Maestro Ballestero — el caso más grave, previo incluso al 2026-08-25**: la
  sección de Arquero llevaba "7 de 8 listas — la especialización menos bloqueada de toda la sesión"
  desde antes del 2026-08-24, pese a que el propio `classAbilities.ts` documenta en un comentario
  fechado ese mismo día: *"Corrección frente al doc (2026-08-24): clases.md marcaba Maestro Arquero/
  Maestro Ballestero como '7/8 listas'... pero 12/24/28 usan DEBILIDAD, 19 usa CONTRA, 24 también
  AUMENTO y 32 usa MULTIPLE — ninguno implementado. Solo el nivel 16 es real hoy en cada rama."* Es
  decir: el código ya sabía, documentado en su propio comentario, que el `.md` estaba mal — y nadie
  volvió a corregir el `.md` en las 2 semanas siguientes, ni en la auditoría del 2026-08-25 (que sí
  corrigió Guerrero/Cazador/Rúnico/Convocador/Opresor pero no llegó a Arquero) ni en la del
  2026-09-06.

Recuento real verificado contra `classAbilities.ts` (grep de `especializacion:` por clase), antes/
después de esta corrección:

| Especialización | `.md` decía | Real (código) |
|---|---|---|
| Berserker | 1/8 | 3/8 |
| Guardián | 1/8 | 4/8 |
| Lancero | 2/8 | 6/8 |
| Especialista | 4/8 | 5/8 |
| Domador | 0/8 | 1/8 |
| Supervivencia | 1/8 | 7/8 |
| Tirador | 5/8 | 6/8 |
| Instintivo | 4/8 | 6/8 |
| Totémico | 3/8 | 1/8 *(el `.md` sobre-contaba: la fila 12 sembrada real es distinta de las 3 que el doc daba por hechas)* |
| Rúnico | 2/8 | 6/8 |
| Convocador | 1/8 | 6/8 |
| Opresor | 2/8 | 4/8 |
| Maestro Arquero | 7/8 | 1/8 |
| Maestro Ballestero | 7/8 | 1/8 |

Caballero/Segador/Asesino/Druida se verificaron también fila a fila y coinciden exactamente con el
`.md` — sin discrepancia, no tocados.

**Estado**: FIJADO en esta misma sesión (2026-09-07) — corregido directamente por ser un HUECO de
staleness, mismo criterio que la corrección del 2026-08-25 (commit `f1bf8bb`): tabla-resumen final
reescrita con los 14 valores reales, más las ~19 filas individuales de estado (⚠️→✅) corregidas en
las secciones detalladas de Berserker, Guardián, Lancero, Especialista, Supervivencia, Tirador,
Instintivo, Totémico, Rúnico, Convocador, Opresor, Maestro Arquero y Maestro Ballestero, cada una
con nota explícita de cuándo se sembró de verdad. Sin tocar código — solo documentación.

## 2026-09-07 — Confirmado sin discrepancias — mundo determinista/agenda, Faction.description estática, banners, actualizaciones-pendientes-lore.md ya cubrió fauna/flora/vocabulario

**Verificado, sin hallazgos nuevos**:
- `mundo-determinista.md`: banner ya corregido a "APLICADO al motor" (no es el mismo desfase que
  `combate-multiple.md`/`companeros-y-supervivencia.md`, ya lo arregló la propia auditoría del
  2026-08-25 el mismo día que se escribió el documento).
- `worldAgenda.ts` no ha cambiado desde 2026-08-27; `Faction.description` de Clan Helsig/Clan Goshg
  (`worldCatalog.ts:6403`) sigue textualmente igual a como se verificó el 2026-08-25 — la decisión
  "foto fija, a propósito" sigue vigente, no había que volver a preguntarla.
- Ningún `.md` de `docs/rpgtarkor/` conserva un banner "nada implementado todavía"/"documentación
  pura" que contradiga código real ya construido — los 2 patrones históricos de este tipo
  (`combate-multiple.md`, `companeros-y-supervivencia.md`) siguen corregidos, y las menciones
  restantes de "documentación pura"/"sin aplicar" en `clases.md` (tabla de reasignación de clase a
  NPCs, líneas ~1264-1270) están correctamente marcadas como recomendación sin aplicar, no como
  desfase real.
- Fichas de fauna/flora/NPC y vocabulario: la ronda de auditoría del 2026-09-05/06 (documentada en
  `docs/rpgtarkor/lore-mundo/actualizaciones-pendientes-lore.md`) ya cubrió esta área de forma extremadamente
  exhaustiva — 14/14 huecos de mecanismo físico, 9/9 hallazgos "código→lore" y 11/12 "lore→código"
  cerrados, incluida una segunda auditoría de verificación (2026-09-06) que confirmó no quedaban
  huecos nuevos. No se encontró ningún caso adicional no cubierto por esa ronda al revisar
  `worldCatalog.ts` contra `areas.md`/`flora-fauna.md`/`razas.md`/`npcs.md`.

**Estado**: NO ES BUG, sin acción necesaria — confirma que la ronda del 2026-09-05/06 sigue vigente
y no dejó huecos nuevos en estas áreas; el único hallazgo real de esta sesión fue el de clases.md
de arriba.

---

## 2026-09-15 — auditoría de lore de los sistemas nuevos post-2026-09-07 (combate múltiple con
compañeros, cuadrícula/Interactuar, Cazadora Serhu, MedioMovimiento)

**Contexto**: ~8 días de desarrollo intenso desde la última auditoría (2026-09-07) sin volver a
lanzarla. En ese intervalo se cerraron 8 piezas de combate múltiple con compañeros (PROVOCACION,
CANALIZAR en combate múltiple, MARCAR, AREA en 3 variantes, Maestro Arquero/Ballestero 7/8,
`durationEffectTarget:'both'`, Alfa de la Manada, AUMENTO desde utilidad — cierre 2026-09-15) y todo
el sistema de movimiento por cuadrícula/colisión de "Interactuar" (2026-09-08/09). Esta ronda
verifica si esa prosa de diseño quedó al día.

### combate-multiple.md — confirmado sin discrepancias, muy bien mantenido

Las 8 piezas (PROVOCACION, CANALIZAR en combate múltiple, MARCAR, AREA en 3 variantes, `AUMENTO`/
`DEBILIDAD` desde utilidad, `durationEffectTarget:'both'`, Alfa de la Manada) están descritas con
precisión en `combate-multiple.md`, con nombres de función/columna exactos y coincidiendo con el
código real (`combateMultipleOrquestacion.ts`, `combateMultiple.ts`, `companionSupervivencia.ts`,
`npcCombatAbilities.ts`, `classAbilities.ts`). El documento incluso va más allá del cierre del
2026-09-15 documentado en memoria. Maestro Arquero/Maestro Ballestero están correctamente en 7/8
(solo el nivel 40, `CANALIZAR`+`LETAL` combinado, sigue bloqueado) — el conteo coincide con el
código verificado por grep de `especializacion:`.

**Estado**: NO ES BUG, sin acción necesaria.

### clases.md — CANALIZAR: autocontradicción real dentro del propio documento (staleness, no
contradicción de diseño)

**Hallazgo**: desde el cierre del 2026-09-14/15, varias fichas de `clases.md` afirman correctamente
que `CANALIZAR` "ya tiene motor real" (Domador 36 línea 606, Maestro Arquero/Ballestero 36 línea
849, y el párrafo-resumen final tras la tabla de bloqueo, línea ~1224: *"`PROVOCACION`... `MARCAR`...
y `AREA`... tienen motor real desde 2026-09-14"*). Pero **otras 4 filas del mismo documento, no
tocadas en esa pasada, siguen afirmando literalmente que `CANALIZAR` "sigue sin ningún comportamiento
real"**:
- Berserker 28 (Grito Desgarrador, línea 485) y Berserker 40 (Golpe Devastador, línea 488)
- Tirador 24 (Tensar al Límite, línea 648)
- Convocador 40 (Furia de los Elementos, línea 791)

El caso de **Tirador 24 es el más grave**: no es solo staleness de esta ronda, sino un hueco que
lleva abierto desde antes incluso del alcance de esta auditoría. El propio comentario de cabecera de
`classAbilities.ts` (línea 92-93) fecha el cierre de `CANALIZAR` el **2026-09-09** ("cerrar 2 huecos
de motor... CANALIZAR real"), y el comentario específico sobre la ficha (líneas 1215-1220,
inmediatamente encima de la definición de "Tensar al Límite", `effects: ['ATAQUE', 'CANALIZAR',
'LETAL']`) dice explícitamente: *"CANALIZAR real (2026-09-09, cierre de hueco de motor...)"* — la
propia ficha que `clases.md` línea 648 marca como bloqueada por `CANALIZAR` es la que el código cita
como ejemplo de que `CANALIZAR` ya funciona, desde hace una semana.

No es una contradicción de diseño que requiera decisión de canon — el propio código ya deja claro
cuál es el estado real (`CANALIZAR` funciona desde 2026-09-09 en 1v1 y desde 2026-09-14 en combate
múltiple); es que la pasada de actualización del 2026-09-14/15 tocó unas filas y no otras, dejando
el documento contradiciéndose a sí mismo sobre el estado del mismo token de efecto.

**Estado**: PENDIENTE de fijar en `clases.md` (no tocado por esta auditoría, solo investigación) —
corregir las 4 filas (Berserker 28/40, Tirador 24, Convocador 40) para que dejen de decir que
`CANALIZAR` no tiene motor, y en su lugar describan cuál es el bloqueo específico real de cada ficha
si lo sigue habiendo (p.ej. Berserker 40 y Convocador 40 combinan `CANALIZAR`+`LETAL`, que sigue sin
mecanismo propio según Maestro Arquero/Ballestero 40 — igual que Tirador 24 si combina los tres a la
vez; hay que revisar ficha a ficha, no asumir que las 4 quedan desbloqueadas solo por tener motor de
`CANALIZAR`).

### clases.md — cabeceras de sección y tabla-resumen final desincronizadas de sus propias tablas
detalladas

**Hallazgo (staleness interna, mismo patrón que el 2026-08-25/09-07 pero esta vez el documento no
coincide ni consigo mismo)**:
- Cabecera de Berserker (línea 474) dice "6 de 8 listas", pero el propio texto bajo la tabla de esa
  misma sección (línea 500) dice "3 de 8 huecos sembrados".
- Cabecera de Guardián (línea 495) dice "4 de 8 listas", pero el texto bajo su tabla (línea 537) dice
  "7 de 8 huecos sembrados".
- La tabla-resumen final ("Las 9 clases, resumen final de bloqueo", líneas ~1213-1222) sigue
  mostrando cifras de antes de la ola 2026-09-14/15 (Tirador 6, Maestro Arquero 1, Maestro Ballestero
  1, Guardián 4, Especialista 5, etc.) mientras que el párrafo justo debajo de esa misma tabla (línea
  ~1224) ya reconoce en prosa que PROVOCACION/MARCAR/AREA "tienen motor real desde 2026-09-14" —
  dato que, de aplicarse a la tabla, cambiaría varias de esas cifras (Maestro Arquero/Ballestero
  deberían ser 7, no 1, según su propia sección detallada verificada arriba).

**Estado**: PENDIENTE de fijar en `clases.md` — no es contradicción de diseño, es que la pasada de
actualización del 2026-09-14/15 corrigió las tablas detalladas pero no propagó los números hacia
arriba (cabeceras de sección) ni hacia el resumen final, mismo patrón exacto ya corregido dos veces
antes (2026-08-25, 2026-09-07). Recomendación: al cerrar una ronda de siembra de habilidades, revisar
también cabecera de sección + tabla-resumen final en la misma pasada, no solo la tabla detallada.

### Sistema de cuadrícula/colisión "Interactuar" (zonaPosicion.ts) — hueco de documentación completo,
no contradicción

**Hallazgo**: el sistema de movimiento por cuadrícula construido 2026-09-08/09 (`CELL_SIZE_PX = 50`,
grid 16×12 sobre el lienzo 800×600 ya documentado; colisión por celda-misma/celda-adyacente;
cálculo de camino por Bresenham en `calcularCamino`; rutas artesanales vía `ZonePoint.ruta`; paseo
aleatorio de fallback acotado a 2 celdas cuando no hay ruta artesanal; avance de FAUNA/NPC un paso
por cada celda que se mueve la jugadora; radio de Interactuar de 100px) **no tiene ninguna mención en
ningún `.md` de `docs/rpgtarkor/`** — ni el tamaño de celda, ni el algoritmo de colisión, ni las
rutas artesanales, ni el paseo aleatorio. `mundo-determinista.md` documenta el lienzo 800×600 y el
modelo `ZonePoint` a nivel de infraestructura de imágenes/posición (Pieza 3, fechada 2026-08-27) pero
es anterior a toda esta mecánica y no la cubre. Es un hueco íntegro de documentación técnica — el
diseño "estilo Mount & Blade" (confirmado con la usuaria según el propio comentario de cabecera de
`zonaPosicion.ts`) vive solo en comentarios de código y en `schema.prisma`, nunca se trasladó a
prosa. `MedioMovimiento` (TERRESTRE/AEREO/ACUATICO) tampoco tiene ninguna mención en `docs/rpgtarkor/
*.md`.

**Estado**: HUECO documentado, sin acción de código. No hay ningún `.md` de diseño técnico/sistemas
en `docs/rpgtarkor/` donde encajaría de forma natural (todos son prosa de lore/mundo) — queda a
criterio de la usuaria decidir si merece una sección nueva o si este sistema se considera
correctamente "solo código" al ser mecánica de UI/motor sin contenido narrativo propio.

### MedioMovimiento — solo 2 fichas marcadas, ambas coherentes con su prosa existente

**Confirmado sin discrepancias**: grep exhaustivo de `medio: ['AEREO'` / `medio: ['ACUATICO'` en
`worldCatalog.ts` da exactamente 2 resultados, ninguno más — `cruzavientos` (AEREO,
`worldCatalog.ts:1543`) y `benusa-pesquera` (ACUATICO, `worldCatalog.ts:2364`). Ambas bios de
catálogo coinciden casi textualmente con sus fichas en `flora-fauna.md` (ave planeadora que anida en
Los Pilares Rotos; ave migratoria tipo cigüeña "principalmente acuática", presa favorita el Jashil).
Sin contradicción.

### ZonePoint "Cazadora Serhu" / campamento-serhu (sembrado 2026-09-15) — hueco simple, sin
contradicción

**Confirmado, hueco no contradicción**: el `Npc` "Cazadora Serhu" (`kind: 'PLANTILLA'`, plantilla
genérica reutilizable como "Guerrero serhu"/"Guardia serhu", no personaje único con nombre propio;
`homeLocationSlug: 'campamento-serhu'`; `raza: 'orcos'`, `clase: 'CAZADOR'`, `especializacion:
'INSTINTIVO'`, `temperamento: 'CAUTELOSO'`) no tenía ninguna mención previa en `docs/rpgtarkor/
npcs.md`, `personajes.md` ni `areas.md` — ni bio, ni rol, ni ubicación que pudiera chocar. El
ZonePoint `campamento-serhu` en sí (Karot Veku / Colmillo Ceniza, Las Llanuras del Viento Rojo) ya
existía desde antes, no es nuevo; lo nuevo hoy es solo la ficha de Npc y su punto en el mapa de zona
(exterior de la empalizada, coherente con "vigías" que ya describe `areas.md:160-161` para el
campamento del Clan Serhu). Su rol de cazadora/vigía en el exterior es coherente con la prosa
existente del Clan Serhu. Ningún otro NPC o lugar usa "Serhu" en un contexto que choque.

**Estado**: HUECO simple, sin acción de código — la ficha de código es prosa de diseño nueva que aún
no se trasladó a los `.md`, sin contradecir nada existente.

---

## 2026-09-15 (segunda ronda) — barrido de zonas menos auditadas (items.md, razas.md,
personajes.md, npcs.md)

**Contexto**: segunda auditoría de lore lanzada el mismo día, tras la ronda de arriba (commit
`1585371`, que ya corrigió las 3 fichas de CANALIZAR y las 6 cabeceras de `clases.md`). Sin
desarrollo de código nuevo entre ambas rondas, así que esta pasada amplía el barrido a documentos
con menos auditoría reciente según el propio índice de este archivo: `items.md` y `npcs.md` nunca
habían sido objeto de una entrada propia; `razas.md`/`personajes.md` solo se habían tocado de forma
tangencial (Serhu, Signeran, Kessa Vael).

### personajes.md — tabla de atributos jugables y nota "no aplicada al motor todavía" desactualizadas
frente al rename Arcano→Magia del 2026-09-01

**Hallazgo (staleness, no contradicción de diseño — ya hay decisión de canon tomada y aplicada,
solo falta propagarla a este documento)**: `personajes.md` § "Poderes más allá de la magia" (línea
102) afirma literalmente: *"Pendiente de retirada (decisión 2026-08-23, ver clases.md § Atributo
Magia)... decisión cerrada, documentada, **no aplicada al motor todavía** — esta sección se queda
tal cual hasta entonces."* Eso ya no es cierto: el commit `8535c85` (2026-09-01, *"Renombra el
atributo Arcano a Magia y retira los secundarios narrativos"*) aplicó la decisión al motor de
verdad, con migración de datos reales de Postgres incluida. `docs/rpgtarkor/sistemas-combate/clases.md` (línea 157,
§ "Atributo Magia") sí quedó correctamente actualizado ese mismo día ("decisión cerrada — **APLICADA
al motor (2026-09-01)**"), pero `personajes.md` nunca se volvió a tocar tras esa pasada.

Verificado contra el código real: `backend/src/services/dice.ts:13` define hoy
`Attribute = 'fuerza' | 'destreza' | 'constitucion' | 'inteligencia' | 'voluntad' | 'carisma' |
'magia'` (7 atributos primarios, confirmado también por `attributeWheel.ts:18`,
`ATTRIBUTE_RING`) y `secondaryAttributes.ts:38` define `SECONDARY_ATTRIBUTES = ['moral',
'resistenciaFrio', 'resistenciaCalor', 'suerte', 'honor']` — ni `arcano` ni `sigilo` existen ya en
ningún sitio del motor. La tabla de "Atributos jugables" de `personajes.md` (líneas 121-130), en
cambio, sigue usando el esquema viejo íntegro: 6 columnas jugables **Fuerza/Destreza/Sigilo/
Voluntad/Carisma/Arcano** (sin `Constitución`, sin `Inteligencia` como jugable) más 9 columnas
"narrativas" (Inteligencia, Magia, Poder de semilla, Moral, y 4 Resistencias separadas por tipo:
física/mágica/semilla/frío/calor) que tampoco coinciden con las 5 `SECONDARY_ATTRIBUTES` reales de
hoy. Confirmado con un ejemplo real del propio catálogo: la ficha de Hagar Kiugh
(`worldCatalog.ts:3783`, NPC con stats jugables reales) usa exactamente el esquema moderno de 7 —
`attributes: { fuerza, destreza, constitucion, inteligencia, voluntad, carisma, magia }` — sin
`sigilo` ni `arcano`.

No es una contradicción de diseño: la decisión de canon ya está tomada, cerrada y aplicada desde
hace dos semanas — es que la pasada de actualización del 2026-09-01 corrigió `clases.md` pero no
`personajes.md`, mismo patrón de staleness ya visto varias veces en `clases.md` mismo (2026-08-25,
2026-09-07, hoy).

**Estado**: **CERRADO parcialmente (2026-09-15, por pedido explícito de Álvaro de cerrar toda la
ronda)** — corregida la nota de línea 102 a "APLICADA al motor (2026-09-01)" y añadida una nota
nueva marcando la tabla de atributos (líneas 106-136) como desactualizada frente al esquema real
de 7 jugables (`fuerza, destreza, constitucion, inteligencia, voluntad, carisma, magia`) + 5
secundarios (`moral, resistenciaFrio, resistenciaCalor, suerte, honor`), verificado contra
Hagar Kiugh (`worldCatalog.ts`) como referencia real. La tabla en sí (los 8 personajes con sus 15
columnas del esquema viejo) **NO se reescribió** — sigue pendiente de verdad, porque exige decidir
un valor de `constitucion` para los 7 pregenerados (Sael/Dessa/Ithren/Amonir/Yerin/Riko/Cassia,
ninguno lo tiene todavía en ningún sitio), decisión de diseño que una auditoría de documentación no
debe tomar por su cuenta.

### items.md, razas.md, npcs.md — confirmados sin discrepancias tras verificación puntual

**Verificado, sin hallazgos nuevos** (más allá del hallazgo de `personajes.md` de arriba):
- `items.md`: todas las afirmaciones técnicas puntuales comprobadas contra el código coinciden
  exactamente — `SMOKE_MEAT_RECIPE` (crafting.ts) sigue sin campo `oficio`, ninguna receta de
  `cocinero-orco-llanuras` produce `racion-viaje` (solo existe como ítem suelto de inventario/
  recompensa), `punado-arena-iman` y `saquito-arena-iman` existen como objetos mecánicamente
  distintos tal como describe el doc, y `totem-maktor` (`worldCatalog.ts:7172`) sigue sin
  `statBonuses` (cosmético puro, coincide con "se encontró y quitó un +1 voluntad... por error").
- `razas.md`: contenido casi enteramente narrativo (cultura, tabúes, biología por clan/raza), sin
  mecánica numérica que verificar más allá de lo ya cruzado en `personajes.md` arriba. Sin
  discrepancias con `areas.md`/`genesis.md`/`historia.md` en la relectura.
- `npcs.md`: la única afirmación técnica puntual del documento (Hagar Kiugh "con stats jugables ya
  en `worldCatalog.ts` — slug `hagar-kiugh`, nivel 2... marcado `nucleoJugable: false`") se
  confirmó exacta contra `worldCatalog.ts:3772-3786`, incluido el nivel y el flag.
- Confirmación indirecta de la decisión ya registrada en memoria ("pre-alpha = solo Gorhorn"):
  `backend/src/routes/saves/creation.ts` no tiene ninguna referencia a Sael/Dessa/Ithren/Amonir/
  Yerin/Riko/Cassia — de los 8 pregenerados que describen `personajes.md`/`razas.md`, solo Gorhorn
  es seleccionable de verdad hoy. No es un hallazgo nuevo, ya estaba decidido y documentado.

**Estado**: NO ES BUG en items.md/razas.md/npcs.md, sin acción necesaria. Único hallazgo real de
esta ronda: `personajes.md` arriba.

---

## 2026-10-25 — `QA-240`, bloque 1: NPC, razas y personajes de la enciclopedia

Auditoría de la enciclopedia contra el canon (rama `claude/lore-enciclopedia`). Cada arreglo, con el sí de la usuaria.

**Aplicado (solo juego, `worldCatalog.ts` y `berigLore.ts`):**
- `hagar-kiugh`: el rol decía «amigo de infancia de Gorhorn»; el canon dice que se conocieron en las minas
  (`personajes.md:60`). Rol nuevo: «el amigo que Gorhorn hizo en las minas»; la bio pierde la frase repetida.
- `aven-tessk`: Inteligencia 18 → 20, como `npcs.md` #24.
- Spoilers fuera de la enciclopedia (mismo criterio que las bios recortadas el 2026-09-15). Aven Tessk ya no
  cuenta lo de la carta del sabotaje y Yerin; el rol de Gistera ya no dice quién mató a su padre ni de quién
  huye. El detalle queda en un comentario del código y en `npcs.md`.
- `gisot-ketg`: macho; el rol pasa de «encargada» a «encargado».
- `jorer-susig`: la muerte de su padre pasa de «Torgash Ketg» a «los Ketg», como la bio de Tirag. El canon no
  se la atribuye a Torgash.
- Erratas de rol y bio: Ufag («única chamana»), Jorer («perdió», «acabó», «sucesión», «guerreros», «pasado»),
  guerrero y guerrera Serhu («que patrulla»), guardia Serhu y guardiana Helsig (sin el guion suelto).
- Yerin (ficha de personaje): «ya no trabaja para nadie» → «no ha vuelto a entregar nada sellado», porque su
  NPC sigue siendo mensajero de Keseg Sael.

**Pendiente de decidir en este bloque:** Ufag, Gisot y Jorer son `PLANTILLA` siendo individuos únicos;
«domar a las criaturas más poderosas» en la ficha de Gorhorn; Constitución 32 de Torgash (techo ~30); NPC
del canon que faltan (Brann el Cambista); NPC del juego sin ficha en `npcs.md`; erratas de `razas.md`.

## 2026-10-25 — `QA-240`, bloque 2: fichas de combate y sistemas de la enciclopedia

Las fichas contaban reglas que el motor ya no aplica. Reescritas con el sí de la usuaria, cada regla contrastada con el código:
- `las-tiradas`: decía tres resultados (fallo, éxito con coste, éxito claro). Desde el 2026-09-07 son dos (`dice.ts:23`, `gradoExitoFor`).
- `la-dificultad`: decía que la dificultad decide el combate. En el intercambio no decide el resultado (`combatExchange.ts:208`, `outcomeForMargin`); cuenta para las habilidades de apoyo, la huida y la experiencia.
- `el-intercambio`: decía «dos tiradas independientes» contra dificultades propias. Ahora es tirada contra tirada: el empate lo gana quien defiende; un margen de 10 o más da golpe pleno o contragolpe (`DECISIVE_MARGIN`).
- `condicion-fisica`: «respawnea» → «se repone».
- `rematar-y-saquear`: decía que el golpe de gracia no tira. Sí tira, pero el resultado se fuerza a golpe pleno (`conGolpeDeGracia`, `combatExchange.ts:232`).
- `la-reputacion`: cinco escalones de reputación y su efecto real en el temperamento (`reputation.ts`, `effectiveTemperamento`).
- `reputacion-y-territorio`: basta estar por debajo del punto neutro con una de las facciones dueñas para que la región quede en disputa (`resolveFoundingOutcome`).
- `lengua-de-los-orcos`: «Los tres títulos» → «Los cuatro títulos».
- `crafteo`: sin tirada ni riesgo de estropear el objeto (`canCraft`); el nivel de oficio rebaja los mínimos; el «tier» solo marca la duración (`CRAFT_TIER_DURATION_SECONDS`); algunas recetas se desbloquean con un encargo. Fuera lo del Maestro y lo de «margen de que salga mal».
- `construcciones`: ninguna obra pide atributos. Del tier 4 en adelante hacen falta la Casa de obras y un Ayuntamiento mediano o grande (`construction.ts`, `TIER_MAXIMO_PERSONAJE`, `ayuntamientoNivelMinimoPorTier`).

**Pendiente de este bloque:**
- Canon: recuentos de `clases.md` y § 8 de `ia-combate-y-mundo.md` (CR-44/CR-45 aplicados).
- Nombres nuevos para habilidades repetidas («Golpe Certero», «Instinto Asesino» y otras).
- Ficha nueva: «Los enemigos también huyen».
- Coste de huir.
- MAGO en la sección de clases.
- `domador` frente a `ganadero`.
