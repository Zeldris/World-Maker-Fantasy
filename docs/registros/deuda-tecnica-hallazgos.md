# Deuda técnica — hallazgos

Registro cronológico (más antiguo arriba, añadir SIEMPRE al final) de lo que se ha encontrado cada
vez que se ejecuta una auditoría de deuda técnica (código muerto, duplicación real, funciones/
archivos sobredimensionados, tests que faltan en lógica no trivial, tipado débil, manejo de errores
inconsistente) — distinta de `revisar-partida-hallazgos.md`, que registra síntomas de una partida
real en marcha. Antes de reportar algo como "nuevo", mirar aquí si ya se vio y qué se decidió.

Cada entrada: fecha, zona auditada, hallazgo, y estado.

---

## Índice

**2026-08-25 — primera pasada con nombre propio a este archivo (auditoría de deuda técnica previa, 2026-08-13, no quedó registrada en ningún doc)**
- [Combate múltiple arma atributos de NPC sin escalar por nivel (npcAttributesForLevel nunca se llama)](#2026-08-25--combate-múltiple-arma-atributos-de-npc-sin-escalar-por-nivel-npcattributesforlevel-nunca-se-llama)
- [ENERGY_RECOVER_* declaradas como fuente de verdad pero sin ninguna referencia real](#2026-08-25--energy_recover_-declaradas-como-fuente-de-verdad-pero-sin-ninguna-referencia-real)
- [companionCountsAgainstBuildingSlots exportada como si dos sitios la usaran — ninguno la llama](#2026-08-25--companioncountsagainstbuildingslots-exportada-como-si-dos-sitios-la-usaran--ninguno-la-llama)
- [Sin tests: advanceCompanionSurvival/advancePlayerSurvival/autoEquiparDesdeAlmacen](#2026-08-25--sin-tests-advancecompanionsurvivaladvanceplayersurvivalautoequipardesdealmacen)
- [Menores agrupados — services/](#2026-08-25--menores-agrupados--services)
- [Guard de save.endedAt duplicado en 8+ archivos de routes/saves sin extraer a helper](#2026-08-25--guard-de-saveendedat-duplicado-en-8-archivos-de-routessaves-sin-extraer-a-helper)
- [session.ts rompe el propio patrón del guard de endedAt — falta el campo en la respuesta 409](#2026-08-25--sessionts-rompe-el-propio-patrón-del-guard-de-endedat--falta-el-campo-en-la-respuesta-409)
- [inventario.ts hace hasta 4 findUnique de Save distintos en una sola petición](#2026-08-25--inventariots-hace-hasta-4-findunique-de-save-distintos-en-una-sola-petición)
- [companeros.ts (409 líneas, el módulo más nuevo) sin ningún test de ruta](#2026-08-25--companerosts-409-líneas-el-módulo-más-nuevo-sin-ningún-test-de-ruta)
- [Menores agrupados — routes/](#2026-08-25--menores-agrupados--routes)
- [GameView.tsx ha vuelto a crecer desde la extracción de hooks de 2026-08-21](#2026-08-25--gameviewtsx-ha-vuelto-a-crecer-desde-la-extracción-de-hooks-de-2026-08-21)
- [useCombatFlow.ts (585 líneas, el hook con más lógica de decisión) sin ningún test — hooks/ entera sin cobertura](#2026-08-25--usecombatflowts-585-líneas-el-hook-con-más-lógica-de-decisión-sin-ningún-test--hooks-entera-sin-cobertura)
- [Duplicación menor de manejo de error de envío en 6 modales de acción](#2026-08-25--duplicación-menor-de-manejo-de-error-de-envío-en-6-modales-de-acción)

**2026-08-26**
- [combateMultipleOrquestacion.ts creció bastante más al enganchar el objetivo individual real](#2026-08-26--combatemultipleorquestacionts-creció-bastante-más-al-enganchar-el-objetivo-individual-real)

**2026-09-04**
- [/turn/classify sin try/catch dejaba la petición sin respuesta para siempre si Ollama se colgaba](#2026-09-04--turnclassify-sin-trycatch-dejaba-la-petición-sin-respuesta-para-siempre-si-ollama-se-colgaba)

**2026-09-07 — auditoría backend en paralelo (bugs funcionales)**
- [pendingDeathResolution solo bloquea /turn/*, no las 11+ rutas mutantes de companeros/recolectar/cazar/habilidades/inventario/reino](#2026-09-07--pendingdeathresolution-solo-bloquea-turn-no-las-11-rutas-mutantes-de-companerosrecolectarcazarhabilidadesinventarioreino)
- [/combat/matar/:npcSlug es el único de los 3 desenlaces desde CONVALECIENTE sin guard de save.endedAt](#2026-09-07--combatmatarnpcslug-es-el-único-de-los-3-desenlaces-desde-convaleciente-sin-guard-de-saveendedat)
- [companeros.ts: 9 endpoints de captura/almacén/plantillas sin guard de save.endedAt](#2026-09-07--companerosts-9-endpoints-de-capturaalmacénplantillas-sin-guard-de-saveendedat)

**2026-09-07 — auditoría de frontend (paralela a backend/deuda técnica/lore)**
- [setTimeout de applyTurnAwaitingDefense en useCombatFlow.ts sin cleanup — puede pisar el estado de un combate distinto](#2026-09-07--settimeout-de-applyturnawaitingdefense-en-usecombatflowts-sin-cleanup--puede-pisar-el-estado-de-un-combate-distinto)
- [Ningún modal de la app usa role="dialog"/aria-modal ni cierra con Escape ni atrapa el foco](#2026-09-07--ningún-modal-de-la-app-usa-roledialogaria-modal-ni-cierra-con-escape-ni-atrapa-el-foco)
- [handleFundarReino no limpia kingdomFoundedInfo si fundarReino falla — el modal se queda "colgado" en busy tras el error](#2026-09-07--handlefundarreino-no-limpia-kingdomfoundedinfo-si-fundarreino-falla--el-modal-se-queda-colgado-en-busy-tras-el-error)
- [beforeunload dispara pauseSave sin esperar respuesta — puede perder la pausa si el navegador cierra la pestaña primero (hueco, no bug)](#2026-09-07--beforeunload-dispara-pausesave-sin-esperar-respuesta--puede-perder-la-pausa-si-el-navegador-cierra-la-pestaña-primero-hueco-no-bug)

**2026-09-07 — auditoría de deuda técnica (código muerto, tests faltantes, tamaño de archivos)**
- [shared.ts (routes/saves) sin ningún test propio pese a contener restartSaveTransactionBody, el borrado+reconstrucción completo de "volver a Día 1"](#2026-09-07--sharedts-routessaves-sin-ningún-test-propio-pese-a-contener-restartsavetransactionbody-el-borradoreconstrucción-completo-de-volver-a-día-1)
- [forcedGradosFor (DiceRoll.tsx) — función pura recién extraída "para ser testeable", sin ningún test](#2026-09-07--forcedgradosfor-dicerolltsx--función-pura-recién-extraída-para-ser-testeable-sin-ningún-test)
- [useCombatFlow.ts sigue creciendo: 585→859 líneas (+47%) en 12 días, un único hook sin descomponer](#2026-09-07--usecombatflowts-sigue-creciendo-585859-líneas-47-en-12-días-un-único-hook-sin-descomponer)
- [Seguimiento de tamaño: turnResolution.ts (6922) y GameView.tsx (2277) siguen creciendo](#2026-09-07--seguimiento-de-tamaño-turnresolutionts-6922-y-gameviewtsx-2277-siguen-creciendo)
- [Confirmado sin hallazgo: patrón try/catch de routes/saves/ es consistente (catch-all global en server.ts), no repetir el caso de /turn/classify](#2026-09-07--confirmado-sin-hallazgo-patrón-trycatch-de-routessaves-es-consistente-catch-all-global-en-serverts-no-repetir-el-caso-de-turnclassify)
- [Confirmado sin hallazgo: POST /reino/fundar ya rechaza limpio un segundo intento sobre un reino ya fundado](#2026-09-07--confirmado-sin-hallazgo-post-reinofundar-ya-rechaza-limpio-un-segundo-intento-sobre-un-reino-ya-fundado)

**2026-09-15 — auditoría de deuda técnica tras ~8 días de desarrollo intenso (combate múltiple con compañeros + Interactuar/Zona)**
- [combateMultipleOrquestacion.ts vuelve a crecer con fuerza: 1681→2279 líneas (+36%) en esta ronda, ya el doble de cuando se cerró el hallazgo de 2026-08-26](#2026-09-15--combatemultipleorquestacionts-vuelve-a-crecer-con-fuerza-16812279-líneas-36-en-esta-ronda-ya-el-doble-de-cuando-se-cerró-el-hallazgo-de-2026-08-26)
- [Texto de despedida determinista de Gistera Koh duplicado byte a byte entre turnResolution.ts y quests.ts, sin constante compartida](#2026-09-15--texto-de-despedida-determinista-de-gistera-koh-duplicado-byte-a-byte-entre-turnresolutionts-y-queststs-sin-constante-compartida)
- [mismaCelda (zonaPosicion.ts) sin ningún test pese a decidir la colisión real de combate en Zona](#2026-09-15--mismacelda-zonaposicionts-sin-ningún-test-pese-a-decidir-la-colisión-real-de-combate-en-zona)
- [Confirmado sin hallazgo: playerActionValidation.ts (10 guards nuevos de hoy) ya comparte pickRandomLine/patrón "pool de 5, 1 cómica" — no hay duplicación real que extraer](#2026-09-15--confirmado-sin-hallazgo-playeractionvalidationts-10-guards-nuevos-de-hoy-ya-comparte-pickrandomlinepatrón-pool-de-5-1-cómica--no-hay-duplicación-real-que-extraer)
- [Confirmado sin hallazgo: datosVivosDe/escribirCondicionYEnergia son el núcleo único compartido por los flujos NPC y Companion — no hay resolución de combate múltiple duplicada entre ambos](#2026-09-15--confirmado-sin-hallazgo-datosvivosdeescribircondicionyenergia-son-el-núcleo-único-compartido-por-los-flujos-npc-y-companion--no-hay-resolución-de-combate-múltiple-duplicada-entre-ambos)
- [Confirmado sin hallazgo: dynamicModeRecurso.ts, zonaPosicion.ts/zonePoints.ts (salvo mismaCelda) y las 4 funciones Prisma de zonaPosicion.ts están limpias/bien cubiertas](#2026-09-15--confirmado-sin-hallazgo-dynamicmoderecursots-zonaposiciontszonepointsts-salvo-mismacelda-y-las-4-funciones-prisma-de-zonaposicionts-están-limpiasbien-cubiertas)
- [Confirmado sin hallazgo: CombatGroupsModal.tsx (drag&drop de grupos) sin test propio, pero consistente con el patrón ya establecido del frontend (solo 4/63 componentes tienen test directo)](#2026-09-15--confirmado-sin-hallazgo-combatgroupsmodaltsx-dragdrop-de-grupos-sin-test-propio-pero-consistente-con-el-patrón-ya-establecido-del-frontend-solo-463-componentes-tienen-test-directo)

---

## 2026-08-25 — Combate múltiple arma atributos de NPC sin escalar por nivel (npcAttributesForLevel nunca se llama)

**Hallazgo (auditoría de deuda técnica, agente en paralelo sobre `backend/src/services/`, no
reproducido en vivo todavía)**: el combate 1v1 clásico (`npcScene.ts:174`) proyecta los atributos de
catálogo (siempre nivel 1) al nivel real del NPC vía `npcAttributesForLevel(npc.attributes,
npc.level, npc.clase)` — hay un comentario fechado 2026-08-21 explicando por qué hace falta. El
motor de Combate múltiple (`combateMultipleOrquestacion.ts`), añadido después (2026-08-25), en las
4 rutas donde arma un `DatosCombatiente` (jugadora, NPC individual, NPC de grupo, compañero) hace
`npc.attributes as unknown as AttributeBlock` en crudo, sin pasar por `npcAttributesForLevel` en
ningún punto (líneas 166/185/195/224, confirmado por grep: cero referencias a esa función en el
archivo).

No es solo estilo: `INTELIGENCIA_TACTICA_UMBRAL` (`combateMultiple.ts`) decide el targeting
inteligente sobre ese mismo bloque de atributos, así que un NPC de nivel alto en Combate múltiple
lucha y decide con las stats de nivel 1 — más débil y más torpe de lo que debería.

**Estado**: FIJADO (commit `66fb663`, 2026-08-25) — las 3 ramas (NPC individual, NPC de grupo,
compañero) ya pasan por `npcAttributesForLevel`. Investigando esta rama se encontró un bug más
profundo: `Companion.attributes` nunca se rellenaba al confirmar un tameo/persuasión
(`routes/saves/companeros.ts`), así que `datosVivosDe` descartaba SIEMPRE a cualquier compañero de
un `CombatEncounter` — ningún compañero podía luchar nunca, no solo con stats de nivel 1. Arreglado
en el mismo commit (se guarda el bloque crudo del Npc origen al confirmar, se escala por su nivel en
el momento de combatir). Verificado: `tsc -b` limpio, 1318 tests unitarios + 4 archivos de
integración en verde.

## 2026-08-25 — ENERGY_RECOVER_* declaradas como fuente de verdad pero sin ninguna referencia real

**Hallazgo**: `ENERGY_RECOVER_BASICA/MEDIA/AVANZADA/EXPERTA` (`energy.ts:16-19`, valores 10/20/40/70)
no tienen ni una sola referencia en todo el repo fuera de su propia declaración. Los valores reales
de `energyRegen` que sí se usan en `classAbilities.ts` están todos hardcodeados como literales (`10`,
`15`...) — ninguno de los dos coincide de forma sistemática con las constantes "canónicas". Las
constantes que deberían documentar cuánto regenera cada tier de habilidad no están conectadas a
ningún sitio real.

**Estado**: FIJADO (commit `a7997b7`, 2026-08-25) — retiradas en vez de conectadas: los valores
reales de `classAbilities.ts` no siguen esa escala (mayoría `energyRegen: 15` fijo por habilidad
concreta, no por tramo), así que reconectarlas habría exigido cambiar el balance de ~15 habilidades
sin que nadie lo pidiera.

## 2026-08-25 — companionCountsAgainstBuildingSlots exportada como si dos sitios la usaran — ninguno la llama

**Hallazgo**: `companionSupervivencia.ts:154` exporta `companionCountsAgainstBuildingSlots` con un
comentario explícito ("Ver questResolution.ts/turnResolution.ts, ambos actualizados para excluir
`esSlotDomador: true` del recuento") que sugiere que ambos la llaman. En realidad ninguno la invoca:
`questResolution.ts:112` y `turnResolution.ts:4581` reimplementan la misma condición directamente
como filtro Prisma (`{ esSlotDomador: false }`). Es a la vez código muerto y duplicación de la misma
regla de negocio en 2 sitios, con un comentario que ahora induce a error sobre cuál es la fuente de
verdad real.

**Estado**: FIJADO (commit `373747d`, 2026-08-25) — función retirada (código muerto real, no tenía
sentido llamarla desde un filtro Prisma de nivel de query). Comentario corregido para señalar los 3
sitios reales donde vive la regla (`questResolution.ts`, `turnResolution.ts`,
`routes/saves/companeros.ts`, este último no mencionado en el hallazgo original).

## 2026-08-25 — Sin tests: advanceCompanionSurvival/advancePlayerSurvival/autoEquiparDesdeAlmacen

**Hallazgo**: tres funciones async de `companionSupervivencia.ts` sin ninguna cobertura de test
(confirmado por grep, ni unitario ni de integración). No es lógica trivial:
`advanceCompanionSurvival`/`advancePlayerSurvival` deciden el declive de Felicidad/Hambre/Sed por
tramo con varios umbrales (`UMBRAL_DESCUIDO_PCT`, `FELICIDAD_DESCUIDO_PASO`) y corren en producción
en CADA tick de mundo (`workers/worldTick.ts:251-252`); `autoEquiparDesdeAlmacen` decide qué
candidato del Almacén de Reino se auto-equipa y la llaman 4 handlers de rutas
(`routes/saves/companeros.ts`). El resto del archivo (funciones puras como
`condicionPorSupervivencia`/`resolverIntento`/`felicidadUmbralFor`) sí está bien cubierto — el hueco
es específico de estas 3.

**Estado**: FIJADO (commit `0a9d970`, 2026-08-25) — `companionSupervivencia.integration.test.ts`
nuevo, 5 tests contra Postgres real.

## 2026-08-25 — Menores agrupados — services/

**Hallazgos de prioridad baja** (auditoría de deuda técnica, `backend/src/services/`):
- `resolverTurnosAutonomosHastaJugadora` (`combateMultipleOrquestacion.ts:537`) no tiene test
  directo en su propio archivo de integración — solo se ejerce indirectamente vía
  `routes/turn.integration.test.ts`. Cubierta, pero no donde se esperaría. Sigue PENDIENTE,
  prioridad baja — cobertura desplazada, no hueco de riesgo real.
- ~~Dificultad de combate `15` como literal duplicado...~~ CERRADO 2026-09-08, commit `3b5a5b0`
  (`CHECK_OPUESTO_DIFICULTAD_RELLENO`).
- ~~`ejecutarIntercambioYAvanzar`... 12 parámetros posicionales...~~ CERRADO 2026-09-08, commit
  `36e8df3` — ya usaba objeto de opciones antes de esta ronda; las 12 funciones vecinas restantes
  con el mismo problema real (`datosVivosDe`, `calcularEnganchesRonda`, `avanzarSinAtacar`, etc.)
  se convirtieron en la misma pasada.
- Duplicación de texto (no de lógica) del hint narrativo "golpe letal... YA RESUELTO" entre
  `turnResolution.ts:1169` y `combateMultiple.ts` — decisión consciente ya documentada por quien lo
  escribió, no compartir cadena literal entre el motor legado y el nuevo. Sin acción, no es un
  hallazgo real.

**Estado**: PENDIENTE, prioridad baja — solo el primer punto (cobertura desplazada de
`resolverTurnosAutonomosHastaJugadora`) sigue sin resolver, el resto se cerró en esta ronda.

## 2026-08-25 — Guard de save.endedAt duplicado en 8+ archivos de routes/saves sin extraer a helper

**Hallazgo (auditoría de deuda técnica, agente en paralelo sobre `backend/src/routes/`)**: el mismo
bloque `if (save.endedAt) return reply.status(409).send({ error: 'Esta partida ha terminado',
endedAt: save.endedAt })` aparece calcado en `recolectar.ts:456,512`, `cazar.ts:220,245`,
`companeros.ts:71,171,203`, `habilidades.ts:32-34,86-88,114-116`, `inventario.ts:41-43`,
`progression.ts:39-41`, `reino.ts:29-31`. Cada copia lleva su propio comentario ("mismo guard que
turn.ts/combat/flee/cazar/recolectar/reino...") reconociendo la duplicación pero sin extraerla nunca
a un helper compartido (p.ej. `requireActiveSave(save)` en `shared.ts`).

**Estado**: FIJADO (commit `7104420`, 2026-08-25) — `rejectIfEnded(save, reply)` (`shared.ts`)
reemplaza las 14 copias en 8 archivos. No toca el `prisma.save.findUnique` de cada ruta (cada una
necesita su propio `select`/`include`), solo el guard en sí.

## 2026-08-25 — session.ts rompe el propio patrón del guard de endedAt — falta el campo en la respuesta 409

**Hallazgo**: `session.ts:126-128` (`/combat/flee`) es el único sitio de las 9 copias del guard de
arriba que omite el campo `endedAt` en la respuesta: `return reply.status(409).send({ error: 'Esta
partida ha terminado' })`, sin `endedAt: save.endedAt`. Si algún cliente/frontend depende de ese
campo para mostrar la fecha, `/combat/flee` se lo niega sin motivo real — inconsistencia real de
manejo de errores entre rutas equivalentes, no solo estilo.

**Estado**: FIJADO (commit `475ef52`, 2026-08-25) — arreglado de paso al resolver la condición de
carrera real de esta misma ruta (ver `revisar-partida-hallazgos.md`). El helper compartido
`requireActiveSave` en sí (para las otras 8 copias del guard) sigue sin extraer.

## 2026-08-25 — inventario.ts hace hasta 4 findUnique de Save distintos en una sola petición

**Hallazgo**: `PATCH /saves/:id/inventario/:itemId` hace hasta 4 `prisma.save.findUnique`
distintos en una sola petición — línea 40 (`saveForEndedAt`, solo `endedAt`), línea 52 (`save`
completo), línea 124 (`save` de nuevo, solo `raza/level/worldId`) — tres round-trips a DB para datos
que caben en una sola consulta inicial. `habilidades.ts` repite el mismo patrón (2 `findUnique` por
handler en DELETE/PATCH). No es solo estilo: son viajes de red reales contra Postgres evitables en
el camino caliente de una petición HTTP.

**Estado**: FIJADO (commit `92d9763`, 2026-08-25) — `inventario.ts` reducido a una sola fila de
`Save` completa, reutilizada en todo el handler. `habilidades.ts` revisado aparte: cada handler solo
hace 1 `findFirst` de `SavedAction` + 1 `findUnique` de `Save` (tablas distintas, ambos necesarios)
— no había redundancia real que consolidar ahí, el hallazgo original lo sobrestimó.

## 2026-08-25 — companeros.ts (409 líneas, el módulo más nuevo) sin ningún test de ruta

**Hallazgo**: `companeros.ts` (11 endpoints — Almacén de Reino, captura, tameo, plantillas) tiene
cero tests de ruta (confirmado por grep: ningún `.test.ts` referencia sus rutas `/capturables`,
`/tameo-pendientes/*`, `/almacen/*`, `/plantillas`, `/companeros/*/plantilla`). La lógica de
servicio subyacente (`companionSupervivencia.ts`) sí tiene tests unitarios, pero la capa de ruta —
con su propia lógica no trivial: búsqueda de jaula con hueco libre (`jaulaConHueco`, bucle async),
claim de `esSlotDomador`, gates de capacidad de compañeros, guards 400/404/409 combinados — no tiene
ninguna cobertura, a diferencia de `cazar.ts`/`recolectar.ts` (complejidad comparable, sí cubiertos).
Es el módulo más nuevo (2026-08-25) y el que menos red de seguridad tiene.

**Estado**: FIJADO (commit `ca71d4f`, 2026-08-25) — 3 describe nuevos en
`companeros.integration.test.ts`, camino feliz real de los 11 endpoints (12 tests contra Postgres).

## 2026-08-25 — Menores agrupados — routes/

**Hallazgos de prioridad baja** (auditoría de deuda técnica, `backend/src/routes/`):
- `recolectar.ts` (844 líneas: 3 rutas + agrupado por categoría, tiradas, caché congelada, guards de
  herramienta/estación/clima) está al límite de "un archivo, una responsabilidad" — bien documentado
  y probado, no urgente, pero una cuarta variante forzaría a dividirlo.
- ~~`world.ts:404` — construcción del filtro de facciones por `saveId`... sin ningún test~~ FALSO
  POSITIVO (confirmado 2026-09-08): `world.test.ts` ya tiene el `describe('sección "Facciones"')`
  con los 2 casos exactos ("con saveId, la query pide catálogo + la fundada en ESA partida" / "sin
  saveId, solo el catálogo") — existe desde el commit `ffce4c6` (2026-08-07), muy anterior a esta
  auditoría del 2026-08-25.
- ~~`progression.ts` captura errores de la transacción con un `catch` genérico que devuelve 500 sin
  loggear la causa real~~ FALSO POSITIVO (confirmado 2026-09-08): el `catch` de
  `/attribute-points` (línea 80-87) ya hace `console.error` con el `err` completo antes de devolver
  el 500 — el propio comentario del código dice explícitamente "deuda técnica cerrada, auditoría
  2026-09-01". Esta entrada del 2026-08-25 quedó desactualizada por ese fix posterior.
- **No se encontró código muerto real ni tipado débil sistémico** en `routes/` (cero `any`, `as
  unknown as` limitado a `Json` de Prisma, justificado).

**Estado**: PENDIENTE, prioridad baja — solo queda el tamaño de `recolectar.ts` sin resolver
(candidato a dividir la próxima vez que se toque, no urgente).

## 2026-08-25 — GameView.tsx ha vuelto a crecer desde la extracción de hooks de 2026-08-21

**Hallazgo (auditoría de deuda técnica, agente en paralelo sobre `frontend/src/`)**: `GameView.tsx`
pasó de 1574 a 1665 líneas desde la extracción de hooks del 2026-08-21 (commits
`0fc045f`/`2a454a8`), y sigue con 71 `useState` propios más `useEffect`/`useCallback`/`useMemo` (79
llamadas en total). Dos clusters claros y extraíbles con el mismo patrón que ya usó el proyecto
(`useCombatFlow`, `useTransitPolling`):
- **Estado de Reino** (líneas ~181-192): `kingdomName`, `kingdomFoundedInfo`, `territories`,
  `buildings`, `subjects`, `almacenItems`, `plantillasEquipo`, `factionsStatus`, `kingdomStats` — 9
  `useState` de un mismo dominio, candidato a `useKingdomState`.
- **Estado de modales de acción** (líneas ~154-176): `harvestModal`, `carcassPending`,
  `huntModalOpen`, `simpleModal`, `saquearZonaModalOpen`, `healModalOpen`, `postCombatTarget` —
  todo apertura/cierre de pop-ups de acción, candidato a un hook o reducer único de "modal activo".

**Estado**: FIJADO (commit `6303635`, 2026-08-25) — `useKingdomState`/`useActionModalsState` nuevos
(hooks/), mismo criterio de [[tarkor_extraccion_hooks_gameview_2026-08-21]]: ambos clusters tienen
escritores externos (`syncFromSave`/`handleSubmit`/`useCombatFlow`), así que los hooks agrupan las
16 declaraciones `useState` (valor+setter expuestos, mismos nombres reutilizados en `GameView.tsx`
sin tocar el resto del archivo) en vez de encapsular del todo la lógica de apertura/escritura.

## 2026-08-25 — useCombatFlow.ts (585 líneas, el hook con más lógica de decisión) sin ningún test — hooks/ entera sin cobertura

**Hallazgo**: `useCombatFlow.ts` (585 líneas, ~79 ramas if/switch/else — flujo de combate, ataques
de NPC, XP/saqueo) es el hook más grande y con más lógica de decisión real del proyecto, y la
carpeta `hooks/` entera no tiene NINGÚN archivo `.test.ts` — toda la cobertura de tests del frontend
vive en `lib/*.test.ts` (11 archivos: `slugify`, `combatDifficulty`, `enciclopediaIndex`,
`inventoryCapacity`, `gameViewHelpers`, `equipSlots`, `health`, `professionLevels`, `npcAbilities`,
`progression`, `attributeWheel`). Los demás hooks (`useEntityBanner`, `useReconnectionPolling`,
`useSurroundingsPolling`, `useTransitPolling`, `useEnciclopedia`, `useRecipesData`) tienen bastante
menos ramificación (4-7 condicionales cada uno) — menos urgentes, pero también sin cobertura.

**Estado**: FIJADO (commit `2da4bdd`, 2026-08-25) — decisión explícita de la usuaria: invertir en la
infraestructura real (`@testing-library/react` + `jsdom`, antes deliberadamente fuera de alcance)
en vez de solo extraer helpers puros. 15 tests nuevos sobre los flujos de mayor riesgo de
`useCombatFlow.ts`. El resto de `hooks/` (`useEntityBanner`/`useReconnectionPolling`/etc.) sigue sin
cobertura — menos urgente, la infraestructura ya existe para retomarlo cuando se decida.

## 2026-08-25 — Duplicación menor de manejo de error de envío en 6 modales de acción

**Hallazgo**: el patrón `err instanceof Error ? err.message : '<fallback>'` dentro de un try/catch
con `busy`/`error` locales está repetido byte a byte en 6 componentes:
`components/CompanionEquipModal.tsx:46`, `components/KingdomFoundingModal.tsx:39`,
`components/TameoModal.tsx:37,50`, `components/AbilityForm.tsx:38`, `components/CapturaModal.tsx:37`.
Es un patrón distinto (y no cubierto) del que ya resolvió `useAsyncModalData` (que unifica el
*fetch inicial* de 4+ modales de selección) — aquí falta el mismo tratamiento para la *acción de
envío*.

**Estado**: FIJADO (commit `32b95a0`, 2026-08-25) — `useSubmitError` nuevo (hooks/), deliberadamente
sin `busy` (los 6 sitios no comparten la misma forma de "ocupado" — `CapturaModal` necesita saber
qué candidato concreto, no solo un booleano). Cierra el Bloque 4 (deuda técnica frontend) del
checklist de cierre de las 3 auditorías.

**Sin hallazgos significativos, confirmado en esta ronda**: tipado (cero `any`/`as unknown as` en
todo `frontend/src`, solo 14 aserciones `!` justificadas), código muerto en frontend (ninguno),
componentes grandes ya descompuestos internamente (`EnciclopediaPanel.tsx`, `CombatPanel.tsx` — no
urgentes), retirada de DiscoveryReveal (limpia del todo, sin restos de código, solo dos menciones en
comentarios históricos).

## 2026-08-26 — combateMultipleOrquestacion.ts creció bastante más al enganchar el objetivo individual real

**Hallazgo (auto-observado implementando "objetivo individual", docs/producto/21-roadmap.md § Fase 3, no una
auditoría dedicada)**: el ítem "menor agrupado" de arriba (2026-08-25) ya señalaba
`ejecutarIntercambioYAvanzar` con 12 parámetros posicionales como candidato a objeto de opciones —
con el enganche por ronda añadido hoy, el patrón se repite y se agrava:
- `avanzarSinAtacar` pasó de 3 parámetros (`tx, encounterId, encounter`) a 6 (`prisma, worldId,
  saveId, encounterId, encounter, weaponNamesPorDefecto`) — necesario porque ahora reutiliza
  `avanzarYComprobarFin` en vez de solo avanzar `turnoActual` a ciegas (ver el propio bug real que
  motivó el cambio, corregido el mismo día), pero son 8 sitios de llamada con la misma firma larga
  repetida.
- `calcularEnganchesRonda` (nueva) y `ejecutarGolpeGratisYAvanzar` (nueva) sostienen el mismo patrón
  de 6-7 parámetros posicionales que ya tenían las funciones vecinas.
- ~~`retargetBando` (`combateMultiple.ts`) queda sin ningún caller real...~~ YA ELIMINADO (confirmado
  con la usuaria, 2026-09-03) — código muerto retirado, solo quedan menciones en comentarios
  históricos explicando por qué se sustituyó. Este punto concreto es un falso positivo por
  antigüedad si vuelve a aparecer en otra auditoría.

**Estado**: CERRADO (2026-09-08, commit `36e8df3`) — decisión de la usuaria: cierre total de la
ronda de auditorías, incluyendo este refactor sin bug detrás. 12 funciones internas del archivo
(`datosVivosDe`, `calcularEnganchesRonda`, `escribirCondicionYEnergia`, `avanzarSinAtacar`,
`avanzarYComprobarFin`, `objetivoControladoPara`, `ejecutarAtaqueTotemYAvanzar`,
`resolverTotemsPendientes`, y las 4 exportadas `resolverTurnoJugador`/`resolverTurnoAutonomo`/
`resolverTurnosAutonomosHastaJugadora`/`fijarEleccionRondaJugador`) convertidas a un único objeto
desestructurado con interfaz nombrada, incluidos los call-sites externos en `turnResolution.ts` y
`cazar.ts`. Refactor puramente mecánico, verificado: mismos 90 tests de combate múltiple pasando,
`tsc -b` limpio en todo el backend, verificación rigurosa adicional confirmando que invertir dos
campos `string` del mismo tipo ahora exige un error de escritura obvio en el objeto literal, ya no
un simple cambio de orden invisible.

## 2026-09-04 — /turn/classify sin try/catch dejaba la petición sin respuesta para siempre si Ollama se colgaba

**Hallazgo (jugando en vivo, ronda de pruebas continuas nocturna)**: reproducido en la partida
`cmtmk5wh8001uriduka9v86tp` (turno "Exploro con calma.", 06:13:48 UTC) — cruzando el log del backend
con el log de Ollama se confirmó que Ollama SÍ generó y devolvió la respuesta con éxito (7.3s,
`POST /api/generate` → `200`), pero el turno se quedó "colgado" en el frontend para siempre, sin
narración ni error.

Causa real: `resolveClassificationForTurn` (que engloba la llamada a `classifyAction`/Ollama) se
invocaba en el handler `/turn/classify` (`backend/src/routes/turn.ts`) sin ningún `try/catch` a su
alrededor — el único endpoint de turno sin esa protección (`/turn/narrate` sí la tenía). Cuando el
guard de cola de `ollamaQueue.ts` dispara (mecanismo de autorrecuperación ya documentado el
2026-08-31: si una tarea de Ollama queda "zombie" más allá de su timeout, la cola avanza igualmente
para no bloquear turnos siguientes, pero lanza un error hacia el caller), ese error no lo atrapaba
nada en este handler — la petición HTTP se quedaba sin `reply.send()` para siempre, sin logs de
error tampoco. El guard de cola SÍ cumplía su función (el resto del backend seguía sano para otras
partidas), pero esa petición concreta quedaba huérfana y sin ningún aviso al jugador.

**Estado**: FIJADO — `try/catch` añadido alrededor de `resolveClassificationForTurn`
(`turn.ts:641-673`), mismo patrón que ya usaba `/turn/narrate` (`request.log.error(err)` + 500
genérico "Error clasificando el turno" al cliente, sin filtrar detalles internos). No corrige la
causa de fondo (Ollama puede seguir colgándose alguna vez, ver
`docs/registros/checklist-pruebas-juego.md` § "Cuelgue de Ollama"), pero convierte un cuelgue silencioso e
indefinido en un error visible e inmediato que permite reintentar. Pendiente de `tsc -b` real tras
el próximo reinicio del backend (no se pudo compilar desde el sandbox de esta sesión, revisado a
mano con cuidado: tipos ya importados, patrón idéntico al ya validado en `/turn/narrate`).

## 2026-09-07 — pendingDeathResolution solo bloquea /turn/*, no las 11+ rutas mutantes de companeros/recolectar/cazar/habilidades/inventario/reino

**Hallazgo (auditoría de código backend, frente en paralelo — no en vivo, no reproducido jugando)**:
`Save.pendingDeathResolution` (muerte permanente, 2026-08-31 — el jugador acaba de morir y el
susurro de la Entidad ya se narró, pero todavía no ha pulsado Aceptar/Reintentar en
`POST /saves/:id/death/resolve`) solo se comprueba en 2 sitios de todo el backend:
`routes/turn.ts:514` y `routes/turn.ts:1076` (los dos endpoints principales de turno,
`/turn/classify` y `/turn/narrate`, ambos devuelven 409 "Tienes una muerte pendiente de resolver").
El frontend refleja exactamente esto: `GameView.tsx` bloquea el composer normal
(`pages/GameView.tsx:526`) mientras `pendingDeathResolution` es `true`, pero **ningún panel de
acción está gateado por el mismo flag** — confirmado por grep, cero referencias a
`pendingDeathResolution` fuera de ese bloqueo del composer en todo `frontend/src`. Los paneles
Inventario/Compañeros/Reino/Habilidades (`pages/GameView.tsx:2211-2270`) se renderizan solo en
función de `activePanel`, sin ninguna condición sobre muerte pendiente, y el botón rápido "Hay
presas caídas sin desollar" (`pages/GameView.tsx:1843-1851`, abre `HarvestSelectionModal`) solo
comprueba `anyModalOpen`, no `pendingDeathResolution` ni `endedAt`.

Del lado del backend, confirmado por grep (`grep -c pendingDeathResolution`) que ninguna de estas
rutas mutantes lo comprueba nunca: `recolectar.ts`, `cazar.ts`, `companeros.ts`, `habilidades.ts`,
`inventario.ts`, `progression.ts`, `reino.ts`, `entrega.ts`, `quests.ts`, `dynamicMode.ts`,
`aprenderOficio.ts`. Todas SÍ comprueban `save.endedAt` (vía `rejectIfEnded`, con las excepciones
documentadas en el hallazgo siguiente) — es decir, el guard de "la partida ha terminado del todo"
está bien propagado, pero el guard más estrecho de "hay una muerte pendiente sin resolver todavía"
solo se aplicó al camino principal del turno cuando se introdujo. Efecto reproducible: tras morir
(condición MUERTO, `pendingDeathResolution: true`, susurro de la Entidad ya narrado, composer
bloqueado), el jugador puede abrir el panel Inventario y equipar/desequipar objetos, abrir
Compañeros y depositar/retirar del Almacén o reasignar plantillas, abrir Reino, craftear una
habilidad nueva en Habilidades, o pulsar el botón de Desollar — todo mecánicamente activo mientras
el personaje está narrativamente muerto y a la espera de que se decida dónde reaparece.

**Estado**: CERRADO (2026-09-07/08, commits `b717171` + `2b90f6e`) — decisión confirmada con la
usuaria: bloquear TODO hasta Aceptar, sin distinguir casos. Backend: `rejectIfPendingDeath`
(`shared.ts`, hermana de `rejectIfEnded`) añadida en los 36 puntos donde ya existía `rejectIfEnded`
en los 11 archivos listados arriba. Frontend: los 4 paneles (Inventario/Compañeros/Reino/
Habilidades) quedan `disabled` de verdad vía `SideNav`, con cierre automático si ya estaban abiertos
al morir, más el botón de Desollar. Tests de integración nuevos con verificación rigurosa en ambos
commits.

## 2026-09-07 — /combat/matar/:npcSlug es el único de los 3 desenlaces desde CONVALECIENTE sin guard de save.endedAt

**Hallazgo (auditoría de código backend)**: desde que un enemigo queda CONVALECIENTE, la jugadora
tiene 3 desenlaces finales posibles — Matar (`POST /saves/:id/combat/matar/:npcSlug`,
`routes/saves/session.ts:349`), Capturar (`POST /saves/:id/capturar/:npcSlug`,
`routes/saves/companeros.ts:88`) y Clemente/Dejar vivir (`POST
/saves/:id/combat/dejar-vivir/:npcSlug`, `routes/saves/session.ts:376`) — los tres documentados
juntos como "las 3 decisiones finales posibles desde CONVALECIENTE" en el propio comentario de
`dejar-vivir` (session.ts:465-468). Capturar y Dejar-vivir llaman a `rejectIfEnded(save, reply)`
justo después de cargar el `save` (companeros.ts:91, session.ts:383) — Matar, su vecino inmediato en
el mismo archivo (349-365), carga el `save` con un `select` que ni siquiera trae `endedAt` y nunca
llama al guard. Mismo patrón recurrente ya documentado varias veces en este archivo (auditoría
2026-08-25: "guard de `save.endedAt` duplicado... sin extraerla nunca a un helper" — aquí el helper
sí existe y se usa en 2 de los 3 hermanos, pero se olvidó en el tercero al escribirlo).

Efecto: con una partida ya `endedAt` (terminada, por ejemplo tras un reinicio total pendiente de
confirmar u otro camino de cierre), `Matar` seguiría aceptando la petición y marcando
`targetedForKill: true` en el `NpcState` — un efecto de mutación real sobre una partida que el resto
del backend ya trata como cerrada en firme.

**Estado**: CERRADO (2026-09-07, commit `dbee84e`) — se añadió el mismo `rejectIfEnded` que ya
llevaban sus 2 hermanos. Test de integración nuevo (`session.matar.integration.test.ts`) con
verificación rigurosa: confirmado que sin el guard el test falla (400 en vez de 409 esperado).

## 2026-09-07 — companeros.ts: 9 endpoints de captura/almacén/plantillas sin guard de save.endedAt

**Hallazgo (auditoría de código backend, mismo archivo que el hallazgo anterior)**: de los 15
endpoints mutantes de `routes/saves/companeros.ts`, solo 4 llaman a `rejectIfEnded`
(`/capturar/:npcSlug`, `/tameo-pendientes/:npcSlug/intentar`, `/tameo-pendientes/:npcSlug/confirmar`
— nombre real de la 4ª ruta con guard, `Body: { name?, role?, notes? }` en la línea 375 — y ninguna
más). Los otros 9 no comprueban `save.endedAt` en absoluto, varios de ellos ni siquiera cargan
`Save` (verificado leyendo cada handler completo, no solo grep):

- `POST /saves/:id/capturas/:itemId/depositar` (línea 234) — carga `Save` solo para leer `worldId`,
  nunca `endedAt`.
- `POST /saves/:id/capturas/:itemId/soltar` (línea 281) — **no carga `Save` en absoluto**, borra
  directamente el `InventoryItem` de la captura.
- `POST /saves/:id/tameo-pendientes/:npcSlug/soltar` (línea 460) — carga `Save` solo para
  `worldId`.
- `PATCH /saves/:id/companeros/:companionId/equipo/:itemId` (línea 475) — nunca carga `Save` en la
  ruta principal (solo en una sub-rama condicional, para leer `worldId` del catálogo).
- `POST /saves/:id/almacen/depositar/:itemId` (línea 519) — no carga `Save`.
- `POST /saves/:id/almacen/retirar/:almacenItemId` (línea 534) — no carga `Save`.
- `POST /saves/:id/plantillas` (línea 546), `PATCH .../plantillas/:plantillaId` (línea 558),
  `DELETE .../plantillas/:plantillaId` (línea 579) — ninguna carga `Save`.
- `POST /saves/:id/companeros/:companionId/plantilla` (línea 588) y `POST
  /saves/:id/subjects/:subjectId/plantilla` (línea 603) — ninguna carga `Save`.

Mismo patrón que el resto de esta familia de hallazgos: `companeros.ts` es "el módulo más nuevo" del
proyecto (ya señalado en la auditoría de deuda técnica 2026-08-25, que en su momento encontró y
cerró el hueco de que el archivo entero no tenía tests) y ha seguido creciendo desde entonces
(tameo/almacén/plantillas son piezas posteriores, Trabajador de Reino fase 1, 2026-08-31) sin que el
guard de `endedAt` se propagara a los endpoints nuevos.

**Estado**: CERRADO (2026-09-07, commit `af44e7f`) — decisión confirmada con la usuaria: todos
igual, mismo guard estándar sin distinguir casos (incluido el Almacén de Reino). Los 9 endpoints
tienen ahora `rejectIfEnded`; los que no cargaban `Save` (`/capturas/:itemId/soltar`, `/almacen/
depositar`, `/almacen/retirar`, `POST/PATCH/DELETE /plantillas`, `/companeros/:id/plantilla`,
`/subjects/:id/plantilla`) ahora sí lo hacen. 9 tests de integración nuevos contra Postgres real
(uno por endpoint), verificación rigurosa confirmada quitando el guard de `/almacen/depositar` y
viendo el test fallar (404 en vez de 409 esperado) antes de restaurarlo.
## 2026-09-07 — setTimeout de applyTurnAwaitingDefense en useCombatFlow.ts sin cleanup — puede pisar el estado de un combate distinto

**Hallazgo (auditoría de frontend, `frontend/src/hooks/useCombatFlow.ts:759-775`, no reproducido
en vivo todavía)**: `handleCombatTurnResolved` — la función que aplica el resultado de CADA
intercambio de combate — retrasa deliberadamente `setCombatAwaitingDefense` cuando hay una tirada de
iniciativa real que animar (fix de HOY mismo, 2026-09-07, documentado en el propio comentario del
código: "el panel según es turno de ataque o defensa está cambiando antes de color de lo que la
tirada tarda en ejecutarse"):

```js
const applyTurnAwaitingDefense = () => setCombatAwaitingDefense(params.esperandoDefensaJugador)
if (params.nextInitiativeRoll && !params.finDePartida) {
  setTimeout(applyTurnAwaitingDefense, 2 * ROLL_DURATION_MS)  // 10000ms (ROLL_DURATION_MS = 5000)
} else {
  applyTurnAwaitingDefense()
}
```

Este `setTimeout` de 10 segundos no se cancela nunca — no hay ningún `clearTimeout` en todo el
archivo (confirmado por grep). Si, dentro de esos 10 segundos, la jugadora hace cualquiera de estas
cosas, el timer sigue en pie y aplica su valor "viejo" de `esperandoDefensaJugador` por encima del
estado real y ya actualizado:
- Pulsa "Salir" del resumen de combate (`closeCombat`, línea 820) tras ganar el intercambio rápido —
  el timer del turno anterior dispara 10s después sobre un combate que ya se cerró visualmente
  (`combatOpen` ya en `false`, pero `setCombatAwaitingDefense` no comprueba nada antes de escribir).
- Actúa de nuevo antes de que pasen los 10s (dos intercambios rápidos seguidos, p. ej. contra un
  enemigo débil sin iniciativa real que animar en el segundo turno) — el segundo
  `handleCombatTurnResolved` fija `combatAwaitingDefense` correctamente, pero el timer del PRIMER
  turno, todavía pendiente, lo sobrescribe con su valor obsoleto cuando por fin dispara.
- El combate entero termina por otra vía mientras el timer sigue vivo (huida con éxito,
  `handleCombatHuir`, o fin de partida narrado por otro turno en paralelo).

Es el mismo tipo de problema de fondo que ya motivó el fix de hoy en `DiceRoll.tsx`/
`useTurnFlow.ts` (estado visual que no refleja el estado real por un desfase de timing), pero en un
punto nuevo no cubierto por ese fix: aquí el riesgo no es la animación en sí, sino el propio
`setTimeout` sin `clearTimeout` ni guard de "sigo siendo el turno vigente" al disparar.

**Estado**: CERRADO (2026-09-07, commit `dba1ada`) — decisión confirmada con la usuaria: arreglarlo
ahora. `exchangeApplyTimerRef`/`awaitingDefenseTimerRef` (dos `useRef`, no `useState`, para no
disparar re-render) guardan el id de cada `setTimeout` (intercambio e iniciativa); cada uno se
cancela con `clearTimeout` antes de programar uno nuevo, y ambos se cancelan también en
`closeCombat`. `openCombat` NO se toca — ya resetea `combatAwaitingDefense` a propósito
(comentario existente, auditoría 2026-07-30) para no perder un turno de defensa real pendiente tras
una huida fallida; cancelar el timer ahí rompería ese fix. Test nuevo con verificación rigurosa
(`useCombatFlow.test.tsx`, "cerrar el combate mientras el timer del intercambio sigue pendiente..."):
confirmado que sin el `clearTimeout` el test falla reproduciendo el bug exacto (estado obsoleto
aplicado tras `closeCombat`), y pasa con el fix restaurado. Suite completa del frontend sin
regresiones (28 archivos, 219 tests).

## 2026-09-07 — Ningún modal de la app usa role="dialog"/aria-modal ni cierra con Escape ni atrapa el foco

**Hallazgo (auditoría de frontend, accesibilidad básica)**: los ~18 componentes de modal/overlay de
`frontend/src/components/` (`SelectionModalShell.tsx`, usado por los 11 modales de selección —
Cazar/Recolectar/Curar/Entregar/Saquear/campamento/viajar/etc. —, más `KingdomFoundingModal.tsx`,
`ClaseModal.tsx`, `EspecializacionModal.tsx`, `DynamicModeModal.tsx`, `DetailModal.tsx`,
`ConfirmModal.tsx`, `MapZoomModal.tsx` y otros) comparten el mismo patrón: un `<div>` con
`fixed inset-0 z-50` de overlay y un panel interior, sin ningún `role="dialog"` ni `aria-modal="true"`
en ninguno de los dos (confirmado por grep sobre todo `components/`: cero coincidencias). Ninguno
escucha la tecla Escape para cerrarse (cero `onKeyDown`/listener de `keydown` en los shells de
modal), y ninguno atrapa el foco con Tab dentro del panel — `SelectionModalShell.tsx:33-37` sí lleva
el foco inicial al contenedor al abrirse (fix ya documentado, 2026-08-31), pero nada impide que Tab
se escape del modal hacia botones de la página de detrás, que sigue siendo interactiva bajo el
overlay oscuro.

No es un hallazgo teórico de estilo: un lector de pantalla no anuncia estos overlays como diálogos
modales (el usuario no sabe que "salió" del flujo normal de la página), y cualquier persona que
navegue solo con teclado puede tabular fuera del modal hacia elementos tapados visualmente por el
overlay pero todavía enfocables/activables.

**Estado**: PARCIALMENTE CERRADO (2026-09-07, commit `e0c06d9`) — decisión confirmada con la
usuaria: empezar por `SelectionModalShell` (11/18 casos), foco atrapado a mano con `onKeyDown`, sin
librería. `role="dialog"`/`aria-modal="true"`/`aria-label`, cierre con Escape (respeta
`cancelDisabled`) y atrapado de foco Tab/Shift+Tab ya en el cascarón compartido. 5 tests nuevos con
verificación rigurosa (`SelectionModalShell.test.tsx`). PENDIENTE: los ~7 modales sueltos restantes
(`KingdomFoundingModal.tsx`, `ClaseModal.tsx`, `EspecializacionModal.tsx`, `DynamicModeModal.tsx`,
`DetailModal.tsx`, `ConfirmModal.tsx`, `MapZoomModal.tsx`) siguen sin el mismo tratamiento — queda
para una ronda siguiente, mismo patrón ya validado aquí.

## 2026-09-07 — handleFundarReino no limpia kingdomFoundedInfo si fundarReino falla — el modal se queda "colgado" en busy tras el error

**Hallazgo (auditoría de frontend, `frontend/src/pages/GameView.tsx:672-677` +
`components/KingdomFoundingModal.tsx:33-41`)**: `handleFundarReino` (GameView.tsx) es:

```js
async function handleFundarReino(name: string, description?: string) {
  if (!saveId) return
  const result = await fundarReino(saveId, name, description)
  setKingdomName(result.kingdomName)
  setKingdomFoundedInfo(null)
}
```

Sin `try/catch` propio. `KingdomFoundingModal.handleConfirm` sí envuelve la llamada con
`runCatchingError` (`useSubmitError`, línea 36-39) y muestra el mensaje de error en el propio modal
— hasta ahí, correcto y consistente con el resto de modales de acción. Pero el `finally` implícito
de `runCatchingError` solo baja `busy` a `false` en el MODAL; `kingdomFoundedInfo` (el estado que
decide si el modal existe en absoluto, en GameView.tsx) nunca se toca en la rama de error porque
`setKingdomFoundedInfo(null)` está DESPUÉS del `await fundarReino(...)` que lanzó la excepción — así
que, tras un fallo real (red, 409 si otra pestaña fundó el reino primero, etc.), el modal se queda
correctamente abierto y utilizable (el jugador puede reintentar) — este comportamiento en sí es el
esperado. El hallazgo real es más sutil: si `fundarReino` tiene éxito en el backend pero la
respuesta se pierde en tránsito (timeout del lado del cliente tras el 200 real), `handleFundarReino`
lanza igualmente, el modal muestra "No se pudo fundar el reino" y permite reintentar — un segundo
intento de fundar sobre un reino que el backend ya considera fundado. `handleReabrirFundacionReino`
(línea 686, ya documentado en el propio archivo como fix de 2026-08-04 para "cancelar/recargar
pierde la oportunidad de nombrar") reconstruye el popup desde `Building`/`Territory` persistidos,
pero solo se llama manualmente desde ReinoPanel — no se dispara automáticamente si un reintento tras
error deja el nombre real ya fijado por el primer intento exitoso, con el modal proponiendo
nombrarlo de nuevo.

**Estado**: CERRADO (2026-09-08, commit `8cedc4d`) — decisión confirmada con la usuaria: arreglarlo
ahora. Ya se había confirmado por separado que `/reino/fundar` rechaza limpio (409, "Ya has fundado
tu reino") un segundo intento — `handleFundarReino` ahora atrapa exactamente ese mensaje: en vez de
dejar que el modal muestre el error, refresca el estado real (`refreshSave`) y reabre el mismo popup
ya reconstruido desde lo persistido (`handleReabrirFundacionReino`, mismo mecanismo que el fix de
2026-08-04).

## 2026-09-07 — beforeunload dispara pauseSave sin esperar respuesta — puede perder la pausa si el navegador cierra la pestaña primero (hueco, no bug)

**Hallazgo (auditoría de frontend, `frontend/src/pages/GameView.tsx:1329-1342`)**:

```js
useEffect(() => {
  if (!saveId) return
  resumeSave(saveId).catch(() => {})
  const handleBeforeUnload = () => pauseSave(saveId)
  window.addEventListener('beforeunload', handleBeforeUnload)
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
    pauseSave(saveId)
  }
}, [saveId])
```

`pauseSave(saveId)` dentro de `handleBeforeUnload` es un `fetch` normal (sin `keepalive: true` ni
`navigator.sendBeacon`) disparado en el evento `beforeunload` — el navegador puede cerrar la pestaña
o navegar fuera antes de que esa petición HTTP llegue a completarse, especialmente si el backend
tarda (no hay timeout corto propio para esta llamada). El efecto NO es nuevo — coexiste con el
patrón ya documentado del roadmap 2026-07-20 ("quiero que la partida se pause si salgo de ella") —
pero ninguna auditoría previa señaló que el mecanismo de disparo es best-effort de verdad, sin
ninguna garantía del navegador de que la petición complete antes del cierre real.

**Impacto real si se pierde**: la partida queda "en curso" en el backend cuando en realidad se
cerró la pestaña — no se ha confirmado en este pase si eso tiene alguna consecuencia mecánica visible
(p. ej. el worldTick de fondo avanzando población/clima como si la jugadora siguiera activa) o es
puramente informativo. Se anota como HUECO (no como contradicción) porque el propio patrón ya asume
"best-effort" en su comentario de cabecera ("si falla, la partida sigue marcada 'en pausa' en el
backend pero la usuaria ya está jugando con normalidad — no hay ninguna acción real que ofrecerle
ante este fallo"), aunque ese comentario está pensado para el caso de error de red, no para el caso
de "la petición ni siquiera llegó a salir" que es más probable en `beforeunload` que en un `catch`
normal.

**Estado**: DESCARTADO (2026-09-08) — FALSO POSITIVO, confirmado leyendo `pauseSave` en
`frontend/src/lib/api.ts:684-691` (no solo el `useEffect` de `GameView.tsx` citado arriba, que en
efecto solo llama a `pauseSave(saveId)` sin más contexto): la propia función ya usa
`navigator.sendBeacon` cuando está disponible, con fallback a `fetch(..., { keepalive: true })` —
exactamente el candidato de fix que este hallazgo proponía. Confirmado con `git log -S
"sendBeacon"` que ya existía desde el commit `a0375a3` (2026-07-24), muy anterior a esta auditoría.
Decisión "arreglarlo ahora" de la usuaria ya estaba satisfecha antes de preguntar — no hacía falta
tocar código.

## 2026-09-07 — shared.ts (routes/saves) sin ningún test propio pese a contener restartSaveTransactionBody, el borrado+reconstrucción completo de "volver a Día 1"

**Hallazgo (auditoría de deuda técnica, ronda de seguimiento sobre los ~14 commits desde
2026-09-04)**: `backend/src/routes/saves/shared.ts` (289 líneas) es el módulo de helpers
compartidos de `routes/saves/` — `rejectIfEnded`, `lockRowForUpdate`, `toFrontendLogEntry`,
`withCatalogStatBonuses`, `buildStartingQuestsData` y, el más grande, `restartSaveTransactionBody`
(120 líneas: borra ~20 tablas relacionadas y reconstruye desde cero inventario/quests/profesiones/
habilidades/ubicación inicial de una partida) — y no tiene ningún `shared.test.ts` propio
(confirmado por `ls`). No es que esté sin ejercer: `restartSaveTransactionBody` la llaman
`POST /saves/:id/restart` (`creation.ts`) y `POST /saves/:id/death/resolve` (`death.ts`), y ambas
rutas sí tienen sus propios tests de integración que pasan por aquí indirectamente — pero ninguna
prueba fija el comportamiento del helper en sí (p.ej. qué pasa si `initialLocationSlugFor` no
resuelve, o si `withCatalogStatBonuses` no encuentra el `catalogSlug` en el catálogo). Incluso
`VALID_ATTRIBUTES` (la única fuente de verdad de los 7 atributos válidos, usada por 2 rutas
distintas de validación) depende de tests ajenos para quedar cubierta.

**Estado**: CERRADO (2026-09-08, commit `08af8b1`) — `shared.test.ts` nuevo, 8 tests contra
Postgres real: `VALID_ATTRIBUTES` (7 atributos exactos, sin duplicados), `withCatalogStatBonuses`
(copia del catálogo, no sobreescribe uno propio, item sin `catalogSlug`, `catalogSlug` inexistente,
lista vacía) y `restartSaveTransactionBody` (camino feliz con Gorhorn + caso borde de
`initialLocationSlugFor` sin resolver). Verificación rigurosa confirmada en el caso del
`catalogSlug` inexistente.

## 2026-09-07 — forcedGradosFor (DiceRoll.tsx) — función pura recién extraída "para ser testeable", sin ningún test

**Hallazgo**: `forcedGradosFor` (`frontend/src/components/DiceRoll.tsx:218-228`) decide qué lado
"gana" visualmente un check opuesto (iniciativa, Tameo) cuando no hay dificultad fija — con
empate exacto a favor del defensor (`right`), mismo criterio que `resolveExchange` en el backend.
El propio comentario que la introduce (commit `3dc2713`, 2026-09-06, "dos bugs de timing en la UI
de combate") dice explícitamente "Extraída como función pura (testeable sin montar el componente)"
— pero no se añadió ningún test para ella: ni en `DiceRoll.test.tsx` (no existe ese archivo) ni en
ningún otro `.test.tsx` del proyecto (confirmado por grep, cero referencias). Es lógica de decisión
real y no trivial (el caso de empate es fácil de invertir por error, y ya hubo un bug de esta
misma familia — "el número aterrizaba siempre en verde" — documentado en el propio comentario de
`DiceFace.forcedGrado` un poco más arriba en el mismo archivo).

**Estado**: DESCARTADO (2026-09-08) — FALSO POSITIVO por antigüedad: `DiceRoll.test.tsx` ya existe
con 4 tests cubriendo `forcedGradosFor` (showDifficulty true/false, empate exacto a favor del
defensor, caso real reproducido) desde el mismo día que se extrajo la función (2026-09-06). El
agente de auditoría de deuda técnica corrió en un worktree con checkout anterior a ese commit —
no vio el archivo. Confirmado con `grep` en esta ronda de cierre que el archivo existe de verdad.

## 2026-09-07 — useCombatFlow.ts sigue creciendo: 585→859 líneas (+47%) en 12 días, un único hook sin descomponer

**Hallazgo (seguimiento de tamaño)**: la auditoría de 2026-08-25 ya señalaba `useCombatFlow.ts`
(585 líneas entonces) como "el hook con más lógica de decisión del proyecto" y cerró el hallazgo
invirtiendo en infraestructura de test (`@testing-library/react`) en vez de descomponerlo. Desde
entonces (commits `9678192`, `4d2c41b`, `6ebc6b9`, `069c3f5`, `76c30cf`, `e44403d`, `3dc2713`, todos
del 2026-08-27 al 2026-09-06) el archivo ha crecido a 859 líneas — un solo `export function
useCombatFlow(...)` de ~775 líneas de cuerpo, sin ninguna función interna extraída a nivel de
módulo. Revisado el diff de cada commit: el crecimiento es lógica nueva legítima y bien
documentada (no duplicación), pero el hook ya reúne manejo de estado de combate múltiple, timing
de animaciones de dados, saqueo, XP, reputación y sincronización tras recarga — varios dominios
distintos en un único closure. Sigue teniendo test (`useCombatFlow.test.tsx`, actualizado en cada
commit relevante), así que no es un hueco de cobertura — es un candidato a extracción por tamaño/
responsabilidades mezcladas, igual que ya se hizo con `useKingdomState`/`useActionModalsState`
desde `GameView.tsx`.

**Estado**: EVALUADO Y DEJADO INTACTO (2026-09-08, decisión de la usuaria: cierre total, incluyendo
evaluar este punto) — leído el archivo completo (944 líneas a fecha de hoy): el timing de
animaciones (`awaitingExchangeApply`/`awaitingNextInitiative`, los `useRef` de timers cerrados en
`f717171`/`dba1ada`) vive dentro de `handleCombatTurnResolved` cerrando sobre casi todos los
setters del hook — separarlo no reduce acoplamiento real y arriesga el orden de aplicación que 3
bugs reales recientes (2026-09-06/07) acaban de fijar con precisión. Saqueo y XP/reputación están
igual de entrelazados con `submitCombatAction`. Ninguna extracción segura identificada — se deja
como deuda consciente de largo plazo, mismo criterio que `combateMultipleOrquestacion.ts`
(2026-08-26): el archivo funciona y está bien probado, no hay bug detrás.

## 2026-09-07 — Seguimiento de tamaño: turnResolution.ts (6922) y GameView.tsx (2277) siguen creciendo

**Hallazgo (seguimiento, sin acción)**: los dos archivos más grandes del proyecto, ya candidatos
conocidos, actualizados a fecha de hoy: `backend/src/services/turnResolution.ts` = 6922 líneas
(varios guards `has*`/validaciones de coherencia narración-mecánica añadidos estos 3 días, commits
`c86d6fc`/`8889cd5`/`f82198b`/`4d40261`); `frontend/src/pages/GameView.tsx` = 2277 líneas (creció
de 1665 en 2026-08-25 principalmente por el punto del jugador en el mapa, barras de habilidades
múltiples y el Diario en pestañas — ninguno de estos 3 días concretos lo tocó directamente). Ningún
patrón de duplicación nuevo detectado en el crecimiento reciente de `turnResolution.ts`: son
funciones `has*` nuevas del mismo patrón ya establecido en `narrador.ts` (una responsabilidad cada
una, todas con test), no bloques repetidos.

**Estado (actualización 2026-09-08, evaluación real solicitada por la usuaria)**: `turnResolution.ts`
(7257 líneas a fecha de hoy) — EVALUADO Y DEJADO INTACTO. Los guards `has*` mencionados en la
ronda anterior en realidad viven en otros archivos (`narrador.ts`, `crafting.ts`,
`dynamicModeNarracion.ts`, `npcScene.ts`, `skillBars.ts`), no aquí — este archivo es en un 95% la
función `narrateAndPersistTurn` (~4477 líneas), y ya pasó por una ronda de extracción de
sub-bloques autocontenidos el 2026-08-13 (`applyLootMode`, `applyCombatExchangeToNpcState`,
`applyHarvest`, `applyKillSideEffects`, `resolveCombatSlugsAndPersist`, `applyCondicionTimeouts`,
`applyCapturaEnInventarioTimeouts`). Lo que queda es orquestación secuencial de un único turno de
juego con variables que fluyen en cascada de principio a fin — partirlo en módulos por dominio
exigiría funciones con 15-20 parámetros cruzados, sin reducir acoplamiento real, solo trasladar
líneas con alto riesgo. `GameView.tsx` (2410 líneas antes de tocarlo) — PARCIALMENTE CERRADO,
commit `0f9913d`: extraído `useClaseEspecializacionState` (5 `useState` + 2 handlers completos,
único de los 3 candidatos evaluados —junto a barras de habilidades y viaje/tránsito, descartados
por mezclar estado compartido con otros hooks— que cumplía el criterio "¿quién más escribe este
estado?" con margen de seguridad). 2410→2398 líneas, `tsc -b` limpio, 224/224 tests sin regresión.

**Estado**: Sin acción — solo registro de la trayectoria de tamaño para la próxima auditoría, sin
hallazgo nuevo de fondo que motive tocarlos ahora.

## 2026-09-07 — Confirmado sin hallazgo: patrón try/catch de routes/saves/ es consistente (catch-all global en server.ts), no repetir el caso de /turn/classify

**Investigado y descartado**: se revisó si el hallazgo de 2026-09-04 (`/turn/classify` sin
try/catch) tenía hermanos sin arreglar. `backend/src/routes/saves/session.ts` (8 endpoints,
incluidos los 2 nuevos de esta ronda — `combat/cerrar` y `combat/matar/:npcSlug`) no tiene ningún
`try {` propio, pero esto NO es una inconsistencia: `server.ts:25` registra un
`app.setErrorHandler` global (documentado, auditoría 2026-07-22) que normaliza cualquier excepción
no capturada a `{ error: string }` con el código HTTP correcto. El caso de `/turn/classify` era
distinto de raíz: no era una excepción JS normal escapándose (el catch-all la habría cazado igual),
sino el guard de cola de `ollamaQueue.ts` dejando la petición sin `reply.send()` — un cuelgue, no
un error lanzado. Confirmado que el resto de `routes/saves/` sigue el mismo patrón deliberado (sin
try/catch local, delegan en el handler global) salvo los pocos casos que sí necesitan distinguir
errores concretos (p.ej. `P2025` de Prisma en `list.ts`/`progression.ts`/`recolectar.ts`/
`reino.ts`). No hay ningún endpoint nuevo con el mismo patrón de cuelgue silencioso de
`/turn/classify`.

**Estado**: Sin hallazgo — investigado a fondo, descartado explícitamente para no repetir la
pregunta en la próxima auditoría.

## 2026-09-07 — Confirmado sin hallazgo: POST /reino/fundar ya rechaza limpio un segundo intento sobre un reino ya fundado

**Investigado y descartado** (repaso de las dudas abiertas del punto 2 de la ronda de auditorías
del 2026-09-06/07): `backend/src/routes/saves/reino.ts:56-58` ya tiene un guard explícito por
`save.kingdomName` que devuelve 400 "Ya has fundado tu reino" en cuanto el campo no está vacío —
comentario propio documentando el motivo (auditoría 2026-08-21: fundar dos veces crearía dos filas
de `Faction` con el mismo slug determinista, chocando contra `@@unique([worldId, slug])`).
Además, un `catch` dedicado (líneas 102-113, auditoría 2026-08-07) atrapa la condición de carrera
del doble clic simultáneo (`Prisma.PrismaClientKnownRequestError` código `P2002`) y devuelve el
mismo 400 claro en vez de un 500 genérico. Test explícito ya existente
(`reino.test.ts:250-253`) cubre justo el caso "segundo intento sobre reino ya fundado → 400". No
hace falta tocar ni backend ni frontend.

**Estado**: Sin hallazgo — idempotencia ya cerrada desde 2026-08-07/21, confirmada de nuevo hoy.

## 2026-09-15 — combateMultipleOrquestacion.ts vuelve a crecer con fuerza: 1681→2279 líneas (+36%) en esta ronda, ya el doble de cuando se cerró el hallazgo de 2026-08-26

**Hallazgo (auditoría de deuda técnica, ronda de seguimiento sobre los ~8 días desde 2026-09-07,
`backend/src/services/combateMultipleOrquestacion.ts`)**: el hallazgo de 2026-08-26 ya señalaba
este archivo creciendo por parámetros posicionales, cerrado el 2026-09-08 (commit `36e8df3`) como
refactor puramente mecánico a objeto de opciones, sin dividir el archivo — 1655 líneas en ese
momento. Historial de tamaño por commit desde entonces (`git show <hash>:...  | wc -l`):

```
36e8df3  1655 líneas (refactor a objeto de opciones, 2026-09-08)
f90c91b  1681 líneas (motor AUMENTO-DEBILIDAD-CANALIZAR, 2026-09-09)
837e787  2279 líneas (PROVOCACION/CANALIZAR combate múltiple/MARCAR/AREA/Alfa de la Manada, HOY)
```

+598 líneas (+36%) en un solo commit de hoy, sumando 21 funciones en el archivo (9 exportadas o de
apoyo estructural, 12 internas) — el archivo ya dobla su tamaño de hace 9 días. A diferencia del
crecimiento de 2026-08-26 (mismo patrón repetido en funciones ya existentes), el de esta ronda es
mecánicas de combate genuinamente nuevas y no relacionadas entre sí a nivel de código (PROVOCACION,
CANALIZAR, MARCAR, 3 variantes de AREA, Alfa de la Manada) — cada una añade su propio bloque de
lectura/escritura de campos de `CombatParticipant`, la mayoría dentro de `calcularEnganchesRonda`
(ahora ~90 líneas solo para reunir `ocultosOExpulsados`/`provocaciones`/`marcas` antes de llamar a
`resolverEnganchesRonda`) y `ejecutarIntercambioYAvanzar` (ahora ~570 líneas, el mayor bloque único
del archivo).

No es duplicación (cada mecánica tiene su propio comentario fechado y su propia condición, sin
lógica repetida entre ellas) ni parámetros mal diseñados (el objeto de opciones del refactor previo
sigue aguantando bien) — es tamaño puro: un archivo de 2279 líneas con 21 funciones que combina
orquestación de transacciones, cálculo de enganches por ronda, y ejecución de intercambio, en el
mismo módulo. Mismo síntoma que motivó la partición histórica de `turnResolution.ts` (2026-08-13:
`applyLootMode`/`applyCombatExchangeToNpcState`/`applyHarvest`/etc. extraídas a sub-bloques
autocontenidos) — aquí `datosVivosDe`/`escribirCondicionYEnergia` (el núcleo compartido por los 4
tipos de combatiente, ver hallazgo de "sin duplicación NPC/Companion" más abajo) serían un candidato
natural a extraer a su propio archivo (`combateMultipleDatos.ts` o similar), separado de la
orquestación de ronda/intercambio — tienen la interfaz más limpia y menos acoplamiento cruzado de
todo el archivo.

**Estado**: PENDIENTE, prioridad baja — señalado para que la próxima auditoría lo revise de nuevo
sin necesidad de rehacer este análisis desde cero. No se propone partir el archivo en esta ronda:
sigue bien probado (2913 líneas de test de integración, mismo ratio test/código que el resto del
proyecto) y sin bug conocido detrás — mismo criterio que la usuaria ya aplicó a `turnResolution.ts`/
`useCombatFlow.ts` el 2026-09-08 ("el archivo funciona y está bien probado, no hay bug detrás").
Extraer `datosVivosDe`/`escribirCondicionYEnergia` (núcleo de lectura/escritura por tipo de
combatiente, ~330 líneas combinadas) a un archivo propio sería la extracción de menor riesgo si se
decide actuar, dado que no comparten estado mutable con el resto de funciones del archivo más allá
de los parámetros que ya reciben explícitos.

## 2026-09-15 — Texto de despedida determinista de Gistera Koh duplicado byte a byte entre turnResolution.ts y quests.ts, sin constante compartida

**Hallazgo (auditoría de deuda técnica, comparando el commit de hoy `837e787` — "guion determinista
de Gistera Koh" — contra `turnResolution.ts`)**: la frase de despedida determinista de Gistera Koh
("Gistera Koh asiente, aliviada, y sin perder ni un segundo más se aleja de la Hondonada del Eco,
perdiéndose pronto en el horizonte.") existía ya en `turnResolution.ts:5152` (camino de texto
libre, `gisteraAceptaEsteTurno`) y se ha vuelto a escribir literal, carácter a carácter, en
`backend/src/routes/saves/quests.ts:121` (la función `aceptarQuest`, extraída hoy de la ruta HTTP
para que el guion determinista de "Interactuar" con Gistera pueda aceptar la misión sin pasar por
un segundo botón de confirmación). Ninguna de las dos copias importa de la otra ni referencia una
constante común — es el mismo string litera-mente copiado y pegado en un archivo nuevo.

El propio comentario de `quests.ts:108` reconoce el origen ("este texto de despedida YA EXISTÍA en
turnResolution.ts... solo movido a este endpoint para el caso concreto de Gistera/Orco
Enfurecido"), y el efecto mecánico que acompaña a la frase (`npcsRetiredForever: { push:
'gistera-koh' }`) también está duplicado entre `turnResolution.ts:6988` y `quests.ts:173` — ahí
mismo, `quests.ts` reconoce en su comentario que antes ese efecto faltaba en este camino y lo
replica a mano. A diferencia del caso ya cerrado como "no es un hallazgo real" en la auditoría de
2026-08-25 (duplicación de texto del hint narrativo interno "golpe letal... YA RESUELTO" entre
`turnResolution.ts`/`combateMultiple.ts`, decisión consciente de no compartir cadena entre el motor
legado y el nuevo), aquí SÍ es el mismo camino narrativo (la despedida real de Gistera, visible al
jugador) resuelto por 2 disparadores distintos (texto libre vs. botón/guion determinista) que ahora
divergen en un detalle: `turnResolution.ts` además añade una entrada a `narration.newFacts` con el
destino real (Ciénaga Troncal, oculto al jugador) para que el guard "no vuelve a aparecer"
(`gisteraSeHaMarchado`) seguirla funcionando en turnos futuros de texto libre — `quests.ts` no
añade ningún equivalente, porque en su camino no hay `newFacts` de por medio (el guard funciona
igual porque `npcsRetiredForever` ya la excluye por otra vía), pero si algún día uno de los dos
textos se retoca (p. ej. para variar la frase, o corregir un matiz), es fácil olvidar el otro sitio
— no hay ningún test que compare ambas cadenas entre sí.

**Estado**: PENDIENTE, prioridad baja — funcionalmente correcto hoy (ambos caminos narran lo
mismo y ambos marcan `npcsRetiredForever`), pero es deuda real de mantenimiento: extraer la frase a
una constante compartida (p. ej. `GISTERA_DESPEDIDA_TEXT` en `npcScene.ts` o un módulo de textos
deterministas de Gistera) evitaría que ambos caminos diverjan sin querer la próxima vez que se
retoque. No se ha tocado código en esta auditoría (alcance: solo investigar).

## 2026-09-15 — mismaCelda (zonaPosicion.ts) sin ningún test pese a decidir la colisión real de combate en Zona

**Hallazgo (auditoría de deuda técnica, `backend/src/services/zonaPosicion.ts:204`)**: de las 18
funciones puras exportadas de `zonaPosicion.ts` (50 tests en `zonaPosicion.test.ts`, cobertura en
general sólida — confirmado contando referencias de cada función una a una), `mismaCelda` es la
única sin NINGUNA referencia en ningún archivo de test de todo el repo (confirmado por grep sobre
`**/*.test.ts`), pese a tener 3 call-sites en código de producción real y no trivial:

- `backend/src/services/turnResolution.ts:7147` — decide si el jugador comparte celda con fauna/
  NPC agresivo, el gate de colisión real que abre combate en Zona (Franja 3, ya con un bug propio
  cerrado el 2026-09-09 en la función hermana `calcularCamino` — "camino vacío sin evaluar
  colisión" — de la misma familia de funciones geométricas).
- `backend/src/routes/saves/zona.ts:418` — colisión contra un `ZonePoint` al llegar a una celda.
- `backend/src/routes/saves/zona.ts:432` — colisión contra un candidato de modo dinámico.
- `backend/src/routes/saves/zona.ts:532` — comprueba si el camino pendiente previo ya llegaba a la
  celda destino (el tipo exacto de caso borde — origen/destino coincidentes en una ruta ya en
  curso — que causó el bug real de `calcularCamino` cerrado el 2026-09-09).

Es una función trivial en apariencia (`a.x === b.x && a.y === b.y` esperable), pero el propio
historial reciente del archivo (el bug de `calcularCamino` del 2026-09-09, exactamente en esta
familia de funciones de colisión geométrica) ya demostró que "trivial" no ha sido garantía de
ausencia de bugs aquí — y es la única de las 18 sin ningún test, mientras sus vecinas directas
(`celdaDePixel`, `celdaAdyacenteOMisma`, `calcularCamino`) sí están cubiertas.

**Estado**: PENDIENTE — hallazgo de cobertura, no de bug reproducido (no se ha visto fallar en
vivo). Candidato de bajo riesgo/bajo esfuerzo para la próxima ronda: 2-3 casos (misma celda, celda
distinta, comparación con coordenadas negativas/fuera de rango si aplica) bastarían dado que es una
función pura de 3 líneas.

## 2026-09-15 — Confirmado sin hallazgo: playerActionValidation.ts (10 guards nuevos de hoy) ya comparte pickRandomLine/patrón "pool de 5, 1 cómica" — no hay duplicación real que extraer

**Investigado y descartado** (petición explícita de la auditoría: revisar si los nuevos guards de
`playerActionValidation.ts` comparten algún patrón que debería extraerse a un helper): el archivo
(619 líneas, 10 pares `detects*Claim`/`*NarrationFor` a fecha de hoy, incluidos los 2 más recientes
—`detectsBindingWithoutRopesClaim`/`detectsUnresolvedDialogueTargetClaim`, ambos de 2026-09-15— y
`detectsHarvestSkillMisuseClaim` de la ronda anterior) ya tiene el patrón compartido extraído desde
su creación: `pickRandomLine<T>(lines: T[])` (línea 28) centraliza la selección aleatoria uniforme
que usan los 10 pools de frases, y cada pool sigue la misma convención documentada ("pool de 5, 1
cómica menos frecuente") sin ninguna copia divergente. La única "duplicación" real es estructural
(cada guard es un par detector puro + narrador puro + pool de líneas, siempre en ese orden) pero es
la forma esperada de esta familia de validadores, ya establecida antes de esta ronda — no hay
lógica condicional repetida entre los 10 guards que un helper nuevo pudiera absorber (cada uno
consulta una fuente distinta: catálogo de NPCs, `harvestSourceAliases`, `CONSTRUCTION_RECIPES`,
inventario de cuerdas...). Tampoco hay tipado débil (cero `any`, los únicos `unknown`/casts del
archivo no existen — no usa Prisma `Json` directamente) ni manejo de errores inconsistente (ninguna
función async atrapa excepciones localmente, delegan en el mismo catch-all de siempre).

**Estado**: Sin hallazgo — el archivo está limpio y sigue su propio patrón de forma consistente.

## 2026-09-15 — Confirmado sin hallazgo: datosVivosDe/escribirCondicionYEnergia son el núcleo único compartido por los flujos NPC y Companion — no hay resolución de combate múltiple duplicada entre ambos

**Investigado y descartado** (petición explícita de la auditoría: revisar si hay lógica de
resolución de combate múltiple duplicada entre el flujo de NPC y el de Companion): leído
`combateMultipleOrquestacion.ts` completo — `datosVivosDe` (línea 292) y `escribirCondicionYEnergia`
(línea 544) son las DOS únicas funciones que leen/escriben el estado de un combatiente, y ambas
despachan por `participant.tipo` (`JUGADOR`/`NPC`/`INVOCACION`/`COMPANION`) dentro de la MISMA
función con un `if` por rama — no hay ninguna función paralela `datosVivosDeNpc`/
`datosVivosDeCompanion` que pudiera divergir con el tiempo. Todo el resto del archivo
(`calcularEnganchesRonda`, `ejecutarIntercambioYAvanzar`, `ejecutarGolpeGratisYAvanzar`, etc.) opera
sobre el resultado ya normalizado de `datosVivosDe` (`DatosCombatiente`), sin volver a distinguir
NPC de Companion salvo en las 2 funciones núcleo. Es exactamente el diseño que evitaría la
duplicación que se temía encontrar.

**Estado**: Sin hallazgo — arquitectura ya correcta, sin acción necesaria.

## 2026-09-15 — Confirmado sin hallazgo: dynamicModeRecurso.ts, zonaPosicion.ts/zonePoints.ts (salvo mismaCelda) y las 4 funciones Prisma de zonaPosicion.ts están limpias/bien cubiertas

**Investigado y descartado**: `backend/src/routes/saves/dynamicModeRecurso.ts` (94 líneas, 1 sola
ruta) reutiliza `resolverRecoleccion`/`candidateSourcesFor`/`gatheringRollFor` de `recolectar.ts`
sin ninguna lógica de recolección propia — exactamente lo que su propio comentario de cabecera
promete ("cero lógica nueva de recolección, solo un disparador distinto"), confirmado leyendo el
archivo completo. `zonePoints.ts` (296 líneas, 7 funciones exportadas) tiene las 7 cubiertas entre
`zonePoints.test.ts`/`zonePoints.integration.test.ts`/`zonePointsGate.integration.test.ts` — ninguna
sin referencia. De las 4 funciones de `zonaPosicion.ts` que tocan Prisma
(`moverJugadorA`/`fijarEntradaAZona`/`volverAEntrada`/`posicionDeObjetivo`, sin cobertura en el
archivo de test PURO por diseño — no pueden testearse sin BD), las 4 tienen call-sites reales en
`cazar.ts`/`recolectar.ts`/`turnResolution.ts`/`zona.ts`, todos con su propia batería de tests de
integración que las ejercitan indirectamente — no es un hueco real, es cobertura desplazada (mismo
criterio ya aceptado en la auditoría de 2026-08-25 para `resolverTurnosAutonomosHastaJugadora`).
Tipado: cero `any`, los `as unknown as Prisma.InputJsonValue`/`as unknown as <Tipo>` encontrados en
`zona.ts`/`dynamicMode.ts`/`npcScene.ts`/`combateMultipleOrquestacion.ts` de esta ronda son todos
el mismo patrón ya confirmado como justificado (2026-08-25): round-trip de campos `Json` de Prisma,
ninguno nuevo fuera de ese caso.

**Estado**: Sin hallazgo en estas zonas — limpias, bien probadas, siguiendo los patrones ya
establecidos del proyecto.

## 2026-09-15 — Confirmado sin hallazgo: CombatGroupsModal.tsx (drag&drop de grupos) sin test propio, pero consistente con el patrón ya establecido del frontend (solo 4/63 componentes tienen test directo)

**Investigado y descartado**: `CombatGroupsModal.tsx` (181 líneas, drag&drop HTML5 nativo entre
columnas de grupo, endpoints reales de `companeros.ts` ya cubiertos por 14 referencias en
`companeros.integration.test.ts`) no tiene ningún `CombatGroupsModal.test.tsx` — pero solo 4 de los
63 componentes de `frontend/src/components/` tienen test directo (confirmado por comparación
archivo a archivo), consistente con la decisión ya documentada el 2026-08-25: la inversión de test
del frontend se dirigió deliberadamente a `hooks/` (lógica de decisión, `useCombatFlow.test.tsx`) y
no a componentes de interacción pura — no es un hueco nuevo ni aislado de este componente concreto,
sino el mismo patrón ya aceptado en todo el árbol de `components/`.

**Estado**: Sin hallazgo — consistente con el patrón ya establecido, no amerita tratamiento
especial solo por ser reciente.
