# Deuda técnica — hallazgos

Registro cronológico (más antiguo arriba, añadir SIEMPRE al final) de lo que se ha encontrado cada
vez que se ejecuta una auditoría de deuda técnica (código muerto, duplicación real, funciones/
archivos sobredimensionados, tests que faltan en lógica no trivial, tipado débil, manejo de errores
inconsistente) — distinta de `revisar-partida-hallazgos.md`, que registra síntomas de una partida
real en marcha. Antes de reportar algo como "nuevo", mirar aquí si ya se vio y qué se decidió.

Cada entrada: fecha, zona auditada, hallazgo, y estado.

---

## Estado verificado contra el código (2026-09-28, actualizado 2026-09-29)

Las entradas de abajo conservan su texto original. Esta tabla dice cómo está cada una hoy; las ✅ ya
están en `../archivo/deuda-tecnica-hallazgos-historico.md`.

| Entrada | Estado |
|---|---|
| `npcAttributesForLevel` nunca se llama | ✅ Resuelta: 4 llamadas |
| `ENERGY_RECOVER_*` sin uso | ✅ Resuelta: constantes retiradas (`energy.ts`) |
| `companionCountsAgainstBuildingSlots` sin uso | ✅ Resuelta: función retirada |
| Sin tests de supervivencia y `autoEquiparDesdeAlmacen` | ✅ Resuelta: `companionSupervivencia.test.ts` |
| Guard de `save.endedAt` duplicado | ✅ Resuelta: helper `rejectIfEnded` (22 ficheros) |
| `companeros.ts` sin tests de ruta | ✅ Resuelta: `companeros.integration.test.ts` |
| `pendingDeathResolution` solo en `/turn/*` | ✅ Resuelta: `rejectIfPendingDeath` (19 ficheros) |
| `/combat/matar` y compañeros sin guard de `endedAt` | ✅ Resuelta |
| `shared.ts` sin tests | ✅ Resuelta |
| `forcedGradosFor` sin tests | ✅ Resuelta |
| `mismaCelda` sin tests | ✅ Resuelta |
| Despedida de Gistera duplicada | ✅ Resuelta: `GISTERA_DESPEDIDA_NARRATION` compartida |
| `handleFundarReino` no limpiaba al fallar | ✅ Resuelta |
| `/turn/classify` sin `try/catch` | ✅ Resuelta: `catch` en el handler (`turn.ts`) |
| `setTimeout` de `applyTurnAwaitingDefense` sin cleanup | ✅ Resuelta: `clearTimeout` sobre `awaitingDefenseTimerRef` (`useCombatFlow.ts`) |
| `useCombatFlow.ts` sin tests | ✅ Resuelta: `useCombatFlow.test.tsx` |
| **Tamaño de `GameView.tsx`** | ⚠️ Bajando: 2.114 líneas (2.645 antes de la Fase 7; la 7 extrajo `useZonaAcciones` y la 12 `useInventarioAcciones`, `useModoDinamico`, `useHabilidadesAcciones` y `useMisionesAcciones`) |
| **Tamaño de `turnResolution.ts`** | ⚠️ Bajando: 7.125 líneas (7.907 antes de la Fase 7; la 7 extrajo `dailyTick.ts` y la 12 `turnLootKill.ts`) |
| **Tamaño de `useCombatFlow.ts`** | ❌ Abierta: 986 líneas (859 el 09-07); ya tiene test |
| **Tamaño de `combateMultipleOrquestacion.ts`** | ❌ Abierta: 2.327 líneas |
| **Modales sin `role="dialog"`, Escape ni foco atrapado** | ⚠️ Parcial: solo 2 ficheros con `role="dialog"` |
| `beforeunload` sin esperar la pausa | ⚪ Hueco aceptado, sin cambios |
| Resto (menores agrupados, 4 `findUnique` en inventario, 409 de `session.ts`, error de envío en 6 modales) | Sin reverificar |

Los tamaños están en el [roadmap](../producto/21-roadmap.md) (trimestre 1, deuda técnica).

## Índice

Las entradas ✅ resueltas o "confirmado sin hallazgo" se movieron (sin editar) el 2026-09-29 a
[../archivo/deuda-tecnica-hallazgos-historico.md](../archivo/deuda-tecnica-hallazgos-historico.md). Aquí queda lo abierto/parcial/sin reverificar:

- [2026-08-25 — Menores agrupados — services/](#2026-08-25--menores-agrupados--services)
- [2026-08-25 — session.ts rompe el propio patrón del guard de endedAt — falta el campo en la respuesta 409](#2026-08-25--sessionts-rompe-el-propio-patrón-del-guard-de-endedat--falta-el-campo-en-la-respuesta-409)
- [2026-08-25 — inventario.ts hace hasta 4 findUnique de Save distintos en una sola petición](#2026-08-25--inventariots-hace-hasta-4-findunique-de-save-distintos-en-una-sola-petición)
- [2026-08-25 — Menores agrupados — routes/](#2026-08-25--menores-agrupados--routes)
- [2026-08-25 — GameView.tsx ha vuelto a crecer desde la extracción de hooks de 2026-08-21](#2026-08-25--gameviewtsx-ha-vuelto-a-crecer-desde-la-extracción-de-hooks-de-2026-08-21)
- [2026-08-25 — Duplicación menor de manejo de error de envío en 6 modales de acción](#2026-08-25--duplicación-menor-de-manejo-de-error-de-envío-en-6-modales-de-acción)
- [2026-08-26 — combateMultipleOrquestacion.ts creció bastante más al enganchar el objetivo individual real](#2026-08-26--combatemultipleorquestacionts-creció-bastante-más-al-enganchar-el-objetivo-individual-real)
- [2026-09-07 — Ningún modal de la app usa role="dialog"/aria-modal ni cierra con Escape ni atrapa el foco](#2026-09-07--ningún-modal-de-la-app-usa-roledialogaria-modal-ni-cierra-con-escape-ni-atrapa-el-foco)
- [2026-09-07 — beforeunload dispara pauseSave sin esperar respuesta — puede perder la pausa si el navegador cierra la pestaña primero (hueco, no bug)](#2026-09-07--beforeunload-dispara-pausesave-sin-esperar-respuesta--puede-perder-la-pausa-si-el-navegador-cierra-la-pestaña-primero-hueco-no-bug)
- [2026-09-07 — useCombatFlow.ts sigue creciendo: 585→859 líneas (+47%) en 12 días, un único hook sin descomponer](#2026-09-07--usecombatflowts-sigue-creciendo-585859-líneas-47-en-12-días-un-único-hook-sin-descomponer)
- [2026-09-07 — Seguimiento de tamaño: turnResolution.ts (6922) y GameView.tsx (2277) siguen creciendo](#2026-09-07--seguimiento-de-tamaño-turnresolutionts-6922-y-gameviewtsx-2277-siguen-creciendo)
- [2026-09-15 — combateMultipleOrquestacion.ts vuelve a crecer con fuerza: 1681→2279 líneas (+36%) en esta ronda, ya el doble de cuando se cerró el hallazgo de 2026-08-26](#2026-09-15--combatemultipleorquestacionts-vuelve-a-crecer-con-fuerza-16812279-líneas-36-en-esta-ronda-ya-el-doble-de-cuando-se-cerró-el-hallazgo-de-2026-08-26)

---

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
