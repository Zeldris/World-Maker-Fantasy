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

## Índice

**2026-08-25 — primera auditoría de lore centrada en sistemas nuevos post-2026-08-23 (3 agentes en paralelo)**
- [combate-multiple.md sigue con el banner "nada implementado" pese a estar construido e integrado](#2026-08-25-combate-multiplemd-sigue-con-el-banner-nada-implementado-pese-a-estar-construido-e-integrado)
- [combate-multiple.md dice que NpcState.groupSize/groupDefeated se retiran — el código los mantiene a propósito](#2026-08-25-combate-multiplemd-dice-que-npcstategroupsizegroupdefeated-se-retiran--el-código-los-mantiene-a-propósito)
- [Faction.description de Helsig/Goshg estática pese a que worldAgenda puede escalar el conflicto — DECIDIDO: se queda estática](#2026-08-25-factiondescription-de-helsiggoshg-estática-pese-a-que-worldagenda-puede-escalar-el-conflicto--decidido-se-queda-estática)
- [clases.md: tabla-resumen final y 3 especializaciones desactualizadas frente al código real](#2026-08-25-clasesmd-tabla-resumen-final-y-3-especializaciones-desactualizadas-frente-al-código-real)
- [companeros-y-supervivencia.md sigue con el banner "nada implementado" pese a estar aplicado de punta a punta](#2026-08-25-companeros-y-supervivenciamd-sigue-con-el-banner-nada-implementado-pese-a-estar-aplicado-de-punta-a-punta)
- [companeros-y-supervivencia.md describe muerte real por inanición — el código la tapa a propósito en CONVALECIENTE](#2026-08-25-companeros-y-supervivenciamd-describe-muerte-real-por-inanición--el-código-la-tapa-a-propósito-en-convaleciente)
- [reclutablePct nunca se usa en la tirada de persuasión pese a que el .md lo promete como dificultad base — DECIDIDO: hay que engancharlo](#2026-08-25-reclutablepct-nunca-se-usa-en-la-tirada-de-persuasión-pese-a-que-el-md-lo-promete-como-dificultad-base--decidido-hay-que-engancharlo)
- [Plantillas de equipo "básicas, no editables" prometidas por el .md no existen — toda plantilla es personalizada hoy](#2026-08-25-plantillas-de-equipo-básicas-no-editables-prometidas-por-el-md-no-existen--toda-plantilla-es-personalizada-hoy)
- [Menores agrupados — clima/estaciones, sin acción](#2026-08-25-menores-agrupados--climaestaciones-sin-acción)

---

## 2026-08-25 — combate-multiple.md sigue con el banner "nada implementado" pese a estar construido e integrado

**Hallazgo (auditoría de lore, agente en paralelo, staleness — no requiere decisión de canon)**: el
encabezado de `docs/rpgtarkor/combate-multiple.md` (fechado 2026-08-24) afirma literalmente "**Nada
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

**Estado**: FIJADO como documentación (commit `5a38692`, 2026-08-25) — decisión de la usuaria (item
22 del checklist): marcar explícitamente el hueco en el `.md` en vez de implementar el seed real.
Nota añadida en § 6 aclarando que esta mitad no se construyó.

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
