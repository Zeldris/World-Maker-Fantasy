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
- [Combate múltiple arma atributos de NPC sin escalar por nivel (npcAttributesForLevel nunca se llama)](#2026-08-25-combate-múltiple-arma-atributos-de-npc-sin-escalar-por-nivel-npcattributesforlevel-nunca-se-llama)
- [ENERGY_RECOVER_* declaradas como fuente de verdad pero sin ninguna referencia real](#2026-08-25-energy_recover_-declaradas-como-fuente-de-verdad-pero-sin-ninguna-referencia-real)
- [companionCountsAgainstBuildingSlots exportada como si dos sitios la usaran — ninguno la llama](#2026-08-25-companioncountsagainstbuildingslots-exportada-como-si-dos-sitios-la-usaran--ninguno-la-llama)
- [Sin tests: advanceCompanionSurvival/advancePlayerSurvival/autoEquiparDesdeAlmacen](#2026-08-25-sin-tests-advancecompanionsurvivaladvanceplayersurvivalautoequipardesdealmacen)
- [Menores agrupados — services/](#2026-08-25-menores-agrupados--services)
- [Guard de save.endedAt duplicado en 8+ archivos de routes/saves sin extraer a helper](#2026-08-25-guard-de-saveendedat-duplicado-en-8-archivos-de-routessaves-sin-extraer-a-helper)
- [session.ts rompe el propio patrón del guard de endedAt — falta el campo en la respuesta 409](#2026-08-25-sessionts-rompe-el-propio-patrón-del-guard-de-endedat--falta-el-campo-en-la-respuesta-409)
- [inventario.ts hace hasta 4 findUnique de Save distintos en una sola petición](#2026-08-25-inventariots-hace-hasta-4-finduniques-de-save-distintos-en-una-sola-petición)
- [companeros.ts (409 líneas, el módulo más nuevo) sin ningún test de ruta](#2026-08-25-companerosts-409-líneas-el-módulo-más-nuevo-sin-ningún-test-de-ruta)
- [Menores agrupados — routes/](#2026-08-25-menores-agrupados--routes)
- [GameView.tsx ha vuelto a crecer desde la extracción de hooks de 2026-08-21](#2026-08-25-gameviewtsx-ha-vuelto-a-crecer-desde-la-extracción-de-hooks-de-2026-08-21)
- [useCombatFlow.ts (585 líneas, el hook con más lógica de decisión) sin ningún test — hooks/ entera sin cobertura](#2026-08-25-usecombatflowts-585-líneas-el-hook-con-más-lógica-de-decisión-sin-ningún-test--hooks-entera-sin-cobertura)
- [Duplicación menor de manejo de error de envío en 6 modales de acción](#2026-08-25-duplicación-menor-de-manejo-de-error-de-envío-en-6-modales-de-acción)

**2026-08-26**
- [combateMultipleOrquestacion.ts creció bastante más al enganchar el objetivo individual real](#2026-08-26-combatemultipleorquestacionts-creció-bastante-más-al-enganchar-el-objetivo-individual-real)

**2026-09-04**
- [/turn/classify sin try/catch dejaba la petición sin respuesta para siempre si Ollama se colgaba](#2026-09-04-turnclassify-sin-trycatch-dejaba-la-petición-sin-respuesta-para-siempre-si-ollama-se-colgaba)

**2026-09-07 — auditoría backend en paralelo (bugs funcionales)**
- [pendingDeathResolution solo bloquea /turn/*, no las 11+ rutas mutantes de companeros/recolectar/cazar/habilidades/inventario/reino](#2026-09-07-pendingdeathresolution-solo-bloquea-turn-no-las-11-rutas-mutantes-de-companerosrecolectarcazarhabilidadesinventarioreino)
- [/combat/matar/:npcSlug es el único de los 3 desenlaces desde CONVALECIENTE sin guard de save.endedAt](#2026-09-07-combatmatarnpcslug-es-el-único-de-los-3-desenlaces-desde-convaleciente-sin-guard-de-saveendedat)
- [companeros.ts: 9 endpoints de captura/almacén/plantillas sin guard de save.endedAt](#2026-09-07-companerosts-9-endpoints-de-capturaalmacénplantillas-sin-guard-de-saveendedat)

**2026-09-07 — auditoría de frontend (paralela a backend/deuda técnica/lore)**
- [setTimeout de applyTurnAwaitingDefense en useCombatFlow.ts sin cleanup — puede pisar el estado de un combate distinto](#2026-09-07-settimeout-de-applyturnawaitingdefense-en-usecombatflowts-sin-cleanup--puede-pisar-el-estado-de-un-combate-distinto)
- [Ningún modal de la app usa role="dialog"/aria-modal ni cierra con Escape ni atrapa el foco](#2026-09-07-ningún-modal-de-la-app-usa-roledialogaria-modal-ni-cierra-con-escape-ni-atrapa-el-foco)
- [handleFundarReino no limpia kingdomFoundedInfo si fundarReino falla — el modal se queda "colgado" en busy tras el error](#2026-09-07-handlefundarreino-no-limpia-kingdomfoundedinfo-si-fundarreino-falla--el-modal-se-queda-colgado-en-busy-tras-el-error)
- [beforeunload dispara pauseSave sin esperar respuesta — puede perder la pausa si el navegador cierra la pestaña primero (hueco, no bug)](#2026-09-07-beforeunload-dispara-pausesave-sin-esperar-respuesta--puede-perder-la-pausa-si-el-navegador-cierra-la-pestaña-primero-hueco-no-bug)

**2026-09-07 — auditoría de deuda técnica (código muerto, tests faltantes, tamaño de archivos)**
- [shared.ts (routes/saves) sin ningún test propio pese a contener restartSaveTransactionBody, el borrado+reconstrucción completo de "volver a Día 1"](#2026-09-07-sharedts-routessaves-sin-ningún-test-propio-pese-a-contener-restartsavetransactionbody-el-borradoreconstrucción-completo-de-volver-a-día-1)
- [forcedGradosFor (DiceRoll.tsx) — función pura recién extraída "para ser testeable", sin ningún test](#2026-09-07-forcedgradosfor-dicerolltsx--función-pura-recién-extraída-para-ser-testeable-sin-ningún-test)
- [useCombatFlow.ts sigue creciendo: 585→859 líneas (+47%) en 12 días, un único hook sin descomponer](#2026-09-07-usecombatflowts-sigue-creciendo-585859-líneas-47-en-12-días-un-único-hook-sin-descomponer)
- [Seguimiento de tamaño: turnResolution.ts (6922) y GameView.tsx (2277) siguen creciendo](#2026-09-07-seguimiento-de-tamaño-turnresolutionts-6922-y-gameviewtsx-2277-siguen-creciendo)
- [Confirmado sin hallazgo: patrón try/catch de routes/saves/ es consistente (catch-all global en server.ts), no repetir el caso de /turn/classify](#2026-09-07-confirmado-sin-hallazgo-patrón-trycatch-de-routessaves-es-consistente-catch-all-global-en-serverts-no-repetir-el-caso-de-turnclassify)

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
  `routes/turn.integration.test.ts`. Cubierta, pero no donde se esperaría.
- Dificultad de combate `15` como literal duplicado dos veces en la misma llamada
  (`combateMultipleOrquestacion.ts:339-347`, atacante/defensor), sin constante nombrada en el
  dominio de combate.
- `ejecutarIntercambioYAvanzar` (`combateMultipleOrquestacion.ts:318`) tiene 12 parámetros
  posicionales, varios del mismo tipo (`ParticipantRef`, `string[]`) — riesgo de orden equivocado al
  llamar; candidato a objeto de opciones si se vuelve a tocar.
- Duplicación de texto (no de lógica) del hint narrativo "golpe letal... YA RESUELTO" entre
  `turnResolution.ts:1169` y `combateMultiple.ts` — decisión consciente ya documentada por quien lo
  escribió, no compartir cadena literal entre el motor legado y el nuevo.

**Estado**: PENDIENTE, prioridad baja.

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
- `world.ts:404` — construcción del filtro de facciones por `saveId` documenta un bug ya evitado
  (`{ saveId: saveId ?? undefined }` filtraría mal en Prisma) pero sin ningún test que fije ese
  comportamiento (que una partida sin `saveId` no vea facciones de otras partidas).
- `progression.ts` captura errores de la transacción con un `catch` genérico que devuelve 500 sin
  loggear la causa real — dificulta depurar en producción.
- **No se encontró código muerto real ni tipado débil sistémico** en `routes/` (cero `any`, `as
  unknown as` limitado a `Json` de Prisma, justificado).

**Estado**: PENDIENTE, prioridad baja.

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

**Hallazgo (auto-observado implementando "objetivo individual", docs/21-roadmap.md § Fase 3, no una
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
- `retargetBando` (`combateMultiple.ts`) queda sin ningún caller real en `combateMultipleOrquestacion.ts`
  (sustituido por `resolverEnganchesRonda`) — sigue exportada y con su propia cobertura de test, pero
  es candidata a "código que ya no se usa en producción, solo en tests" si nadie la retoma.

**Estado**: PENDIENTE, prioridad baja consciente — el archivo entero ya funciona y está probado a
fondo (24 tests unitarios + 3 de integración nuevos solo de esta pasada, ver roadmap), refactorizar
la firma de estas funciones a un objeto de opciones es limpieza pura, sin bug detrás. Buen candidato
para la próxima vez que se toque este archivo por otro motivo (mismo criterio que el resto de esta
lista: no se refactoriza en frío, solo se señala).

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
`docs/checklist-pruebas-juego.md` § "Cuelgue de Ollama"), pero convierte un cuelgue silencioso e
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

**Estado**: PENDIENTE — requiere decisión de la usuaria. No está claro si el diseño pretendido es
"bloquear TODO menos el propio POST /death/resolve mientras hay una muerte pendiente" (mismo
espíritu que `save.endedAt`, pero para un estado transitorio en vez de definitivo) o si algunas de
estas acciones (p.ej. reorganizar el propio inventario) se consideran inocuas de dejar pasar incluso
con una muerte sin resolver. No se ha tocado código de producción.

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

**Estado**: PENDIENTE. Bug real, no ambiguo: es una inconsistencia entre 3 endpoints gemelos donde 2
de 3 ya tienen el guard correcto — no hay decisión de diseño que tomar, solo falta añadir la misma
línea que ya llevan sus 2 hermanos. Se deja registrado sin tocar código de producción (esta
auditoría es solo de investigación).

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

**Estado**: PENDIENTE — no ambiguo en el fondo (el guard ya es el estándar bien establecido del
resto del proyecto para "no mutar una partida ya terminada"), pero son 9 sitios distintos y alguno
de ellos (`/capturas/:itemId/soltar`, por ejemplo) hoy ni siquiera hace la consulta de `Save`
necesaria para poder comprobar `endedAt` sin añadir una query nueva — no se ha decidido aquí si
conviene agruparlos en un solo fix o revisar caso por caso qué operaciones son real y
mecánicamente relevantes tras `endedAt` (el Almacén de Reino, por ejemplo, ¿debería seguir
operativo en una partida que ya terminó?). No se ha tocado código de producción.
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

**Estado**: PENDIENTE — no reproducido en vivo (la ventana de 10s exige acciones rápidas
encadenadas), pero el código confirma el hueco: cualquier `setTimeout` que escribe estado de React
sin un `clearTimeout` de contrapartida (en un `useEffect` con cleanup, o comprobando una bandera de
"sigo vigente" al disparar) es una fuente clásica de estado fantasma. Requiere decisión de diseño
menor (guardar el id del timer en un ref y cancelarlo en `openCombat`/`closeCombat`/al iniciar un
nuevo `submitCombatAction`) antes de tocar el archivo — no se ha tocado código de producción en esta
auditoría.

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

**Estado**: PENDIENTE — requiere decisión de la usuaria (alcance: ¿se aplica solo a
`SelectionModalShell` como punto único que cubre 11 de los ~18 casos, o a cada modal suelto por
separado? ¿foco atrapado con una librería o a mano con `onKeyDown` comprobando los bordes del
`Tab`/`Shift+Tab`?). No es una contradicción de ningún comentario existente — es un hueco de
accesibilidad nunca abordado, ninguna auditoría previa lo menciona.

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

**Estado**: PENDIENTE — requiere decisión de la usuaria (bajo riesgo real: la ventana exacta es
"éxito en backend + fallo de red en la respuesta al cliente", no muy frecuente, y el peor caso
observable es un segundo POST a `/reino/fundar` que el backend debería rechazar por reino ya
existente — no se ha comprobado si esa ruta ya es idempotente/devuelve 409 limpio en ese caso o si
duplica algo. No es una contradicción de diseño clara, más bien un hueco de manejo de reintento no
cubierto).

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

**Estado**: PENDIENTE, prioridad baja — candidato sencillo a `navigator.sendBeacon` o
`fetch(..., { keepalive: true })` si se decide que de verdad importa que la pausa llegue siempre;
requiere confirmar primero si el worldTick trata una partida "sin pausar por error" de forma
distinta a una realmente activa, antes de decidir si merece la pena el cambio.
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

**Estado**: PENDIENTE, prioridad baja — el riesgo real está mitigado por la cobertura indirecta
(2 rutas con tests de integración que ejercen el camino feliz), pero un test directo de
`shared.test.ts` fijaría los casos borde de `restartSaveTransactionBody`/`withCatalogStatBonuses`
sin depender de montar una partida completa en cada ruta que lo use.

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

**Estado**: PENDIENTE, prioridad baja — función pequeña y ya extraída con la intención explícita de
ser testeada; falta dar el último paso.

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

**Estado**: PENDIENTE, prioridad baja consciente — mismo criterio que
`combateMultipleOrquestacion.ts` (2026-08-26): el archivo funciona y está bien probado, no hay bug
detrás, es limpieza de tamaño para la próxima vez que se toque por otro motivo.

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
