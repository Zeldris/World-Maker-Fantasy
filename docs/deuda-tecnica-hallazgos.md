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

**Estado**: PENDIENTE. Es el hallazgo con más riesgo funcional real de toda esta ronda (bug de
balance silencioso, no solo deuda de mantenibilidad) — buen candidato a subir de prioridad respecto
al resto de esta lista si se decide arreglar algo pronto.

## 2026-08-25 — ENERGY_RECOVER_* declaradas como fuente de verdad pero sin ninguna referencia real

**Hallazgo**: `ENERGY_RECOVER_BASICA/MEDIA/AVANZADA/EXPERTA` (`energy.ts:16-19`, valores 10/20/40/70)
no tienen ni una sola referencia en todo el repo fuera de su propia declaración. Los valores reales
de `energyRegen` que sí se usan en `classAbilities.ts` están todos hardcodeados como literales (`10`,
`15`...) — ninguno de los dos coincide de forma sistemática con las constantes "canónicas". Las
constantes que deberían documentar cuánto regenera cada tier de habilidad no están conectadas a
ningún sitio real.

**Estado**: PENDIENTE. Dos caminos: conectar `classAbilities.ts` a estas constantes (si los números
"canónicos" siguen siendo los correctos), o borrarlas si ya quedaron obsoletas.

## 2026-08-25 — companionCountsAgainstBuildingSlots exportada como si dos sitios la usaran — ninguno la llama

**Hallazgo**: `companionSupervivencia.ts:154` exporta `companionCountsAgainstBuildingSlots` con un
comentario explícito ("Ver questResolution.ts/turnResolution.ts, ambos actualizados para excluir
`esSlotDomador: true` del recuento") que sugiere que ambos la llaman. En realidad ninguno la invoca:
`questResolution.ts:112` y `turnResolution.ts:4581` reimplementan la misma condición directamente
como filtro Prisma (`{ esSlotDomador: false }`). Es a la vez código muerto y duplicación de la misma
regla de negocio en 2 sitios, con un comentario que ahora induce a error sobre cuál es la fuente de
verdad real.

**Estado**: PENDIENTE. Arreglo natural: hacer que los dos sitios llamen de verdad a la función
exportada, o borrarla si se prefiere mantener el filtro Prisma inline en ambos.

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

**Estado**: PENDIENTE.

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

**Estado**: PENDIENTE.

## 2026-08-25 — session.ts rompe el propio patrón del guard de endedAt — falta el campo en la respuesta 409

**Hallazgo**: `session.ts:126-128` (`/combat/flee`) es el único sitio de las 9 copias del guard de
arriba que omite el campo `endedAt` en la respuesta: `return reply.status(409).send({ error: 'Esta
partida ha terminado' })`, sin `endedAt: save.endedAt`. Si algún cliente/frontend depende de ese
campo para mostrar la fecha, `/combat/flee` se lo niega sin motivo real — inconsistencia real de
manejo de errores entre rutas equivalentes, no solo estilo.

**Estado**: PENDIENTE. Se resolvería solo si se extrae el helper del hallazgo anterior.

## 2026-08-25 — inventario.ts hace hasta 4 findUnique de Save distintos en una sola petición

**Hallazgo**: `PATCH /saves/:id/inventario/:itemId` hace hasta 4 `prisma.save.findUnique`
distintos en una sola petición — línea 40 (`saveForEndedAt`, solo `endedAt`), línea 52 (`save`
completo), línea 124 (`save` de nuevo, solo `raza/level/worldId`) — tres round-trips a DB para datos
que caben en una sola consulta inicial. `habilidades.ts` repite el mismo patrón (2 `findUnique` por
handler en DELETE/PATCH). No es solo estilo: son viajes de red reales contra Postgres evitables en
el camino caliente de una petición HTTP.

**Estado**: PENDIENTE.

## 2026-08-25 — companeros.ts (409 líneas, el módulo más nuevo) sin ningún test de ruta

**Hallazgo**: `companeros.ts` (11 endpoints — Almacén de Reino, captura, tameo, plantillas) tiene
cero tests de ruta (confirmado por grep: ningún `.test.ts` referencia sus rutas `/capturables`,
`/tameo-pendientes/*`, `/almacen/*`, `/plantillas`, `/companeros/*/plantilla`). La lógica de
servicio subyacente (`companionSupervivencia.ts`) sí tiene tests unitarios, pero la capa de ruta —
con su propia lógica no trivial: búsqueda de jaula con hueco libre (`jaulaConHueco`, bucle async),
claim de `esSlotDomador`, gates de capacidad de compañeros, guards 400/404/409 combinados — no tiene
ninguna cobertura, a diferencia de `cazar.ts`/`recolectar.ts` (complejidad comparable, sí cubiertos).
Es el módulo más nuevo (2026-08-25) y el que menos red de seguridad tiene.

**Estado**: PENDIENTE.

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

**Estado**: PENDIENTE. Ver [[tarkor_extraccion_hooks_gameview_2026-08-21]] (memoria) para el
criterio ya validado de cuándo vale la pena extraer ("quién más escribe el estado", no solo el
recuento de líneas) — aplica igual de bien a estos dos clusters nuevos.

## 2026-08-25 — useCombatFlow.ts (585 líneas, el hook con más lógica de decisión) sin ningún test — hooks/ entera sin cobertura

**Hallazgo**: `useCombatFlow.ts` (585 líneas, ~79 ramas if/switch/else — flujo de combate, ataques
de NPC, XP/saqueo) es el hook más grande y con más lógica de decisión real del proyecto, y la
carpeta `hooks/` entera no tiene NINGÚN archivo `.test.ts` — toda la cobertura de tests del frontend
vive en `lib/*.test.ts` (11 archivos: `slugify`, `combatDifficulty`, `enciclopediaIndex`,
`inventoryCapacity`, `gameViewHelpers`, `equipSlots`, `health`, `professionLevels`, `npcAbilities`,
`progression`, `attributeWheel`). Los demás hooks (`useEntityBanner`, `useReconnectionPolling`,
`useSurroundingsPolling`, `useTransitPolling`, `useEnciclopedia`, `useRecipesData`) tienen bastante
menos ramificación (4-7 condicionales cada uno) — menos urgentes, pero también sin cobertura.

**Estado**: PENDIENTE. `useCombatFlow.ts` es el candidato claro a cubrir primero si se decide
invertir en tests de hooks.

## 2026-08-25 — Duplicación menor de manejo de error de envío en 6 modales de acción

**Hallazgo**: el patrón `err instanceof Error ? err.message : '<fallback>'` dentro de un try/catch
con `busy`/`error` locales está repetido byte a byte en 6 componentes:
`components/CompanionEquipModal.tsx:46`, `components/KingdomFoundingModal.tsx:39`,
`components/TameoModal.tsx:37,50`, `components/AbilityForm.tsx:38`, `components/CapturaModal.tsx:37`.
Es un patrón distinto (y no cubierto) del que ya resolvió `useAsyncModalData` (que unifica el
*fetch inicial* de 4+ modales de selección) — aquí falta el mismo tratamiento para la *acción de
envío*.

**Estado**: PENDIENTE, prioridad baja.

**Sin hallazgos significativos, confirmado en esta ronda**: tipado (cero `any`/`as unknown as` en
todo `frontend/src`, solo 14 aserciones `!` justificadas), código muerto en frontend (ninguno),
componentes grandes ya descompuestos internamente (`EnciclopediaPanel.tsx`, `CombatPanel.tsx` — no
urgentes), retirada de DiscoveryReveal (limpia del todo, sin restos de código, solo dos menciones en
comentarios históricos).
