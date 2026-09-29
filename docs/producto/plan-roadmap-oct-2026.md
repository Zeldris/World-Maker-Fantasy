# Plan de implementación — roadmap de octubre 2026 (bloque "Ahora" + Trimestre 1)

**Fecha:** 2026-09-28. **Origen:** [21-roadmap.md](21-roadmap.md) (Ahora y Trimestre 1) con las
decisiones de Álvaro de este mismo día. **Reparto:** plan escrito por Opus; cada fase la implementa
UN subagente Sonnet, una detrás de otra (nunca en paralelo); Opus revisa el diff, corre tests y hace
commit + push en `claude/wonderful-volta-662qt8` al cerrar cada fase, y tacha el punto en el roadmap.

## Decisiones de Álvaro (2026-09-28)

| Punto | Decisión |
|---|---|
| H-1 `rolReino` | **Ambos**: al asignar plantilla, `rolReino` se toma de la plantilla si es un rol válido; además, selector de rol en Súbditos para cambiarlo |
| H-6 / H-2 economía de facción | **A `worldTick` con consumo y stock real** |
| B1 | **`ZonePoint` por partida** |
| H-5 diplomático | **Abierto** — "¿para qué la experiencia? ¿implica una profesión aprendible?" Hay que darle vueltas. No se toca |

## Reglas comunes para cada agente

- Leer `AGENTS.md`, este plan (solo su fase) y `docs/README.md` si necesita ubicar algo.
- Austeridad: localizar con `grep`/`sed -n`, no leer archivos enormes enteros (`turnResolution.ts`
  tiene ~7.900 líneas, `GameView.tsx` ~2.600).
- Nunca editar `docs/rpgtarkor/` ni lore existente; si una fase necesita lore nuevo, propuesta en
  `docs/borradores-opencode/propuestas-lore.md` (formato de `AGENTS.md`).
- Migraciones Prisma nuevas en `backend/prisma/migrations/<timestamp>_<nombre>/migration.sql` y
  aplicarlas con `npx prisma migrate deploy` (Postgres en localhost:5432, BD de `backend/.env`).
- Verificación obligatoria: `npx tsc --noEmit -p .` (backend), `npx tsc -b --noEmit` + `npx oxlint
  src` (frontend), y los tests de lo tocado (`npx vitest run <archivos>`). Tests nuevos para toda
  lógica nueva. **No** correr la suite completa (lo hace Opus al integrar). Tests contra Postgres real
  = sufijo `.integration.test.ts` (corren en serie, proyecto `bd-real` de vitest).
- Sin commit ni push. Informe final corto: archivos, decisiones tomadas, tests, lo que no se cerró.

---

## Fase 1 — Arreglos pequeños verificados (#7, H-9, H-12, H-3)

1. **#7 "Cargando partida…" infinito** — `frontend/src/pages/GameView.tsx` § `createNewSave`
   (~línea 1544) vuelve sin avisar si falta el mundo o el personaje en memoria (recarga en mitad de
   la creación). Arreglo: en vez de `return` silencioso, redirigir a la pantalla de partidas
   (`navigate` a la ruta de selección, mismo patrón que el resto de GameView) o mostrar el error con
   botón de volver. Test del hook/componente si existe uno cercano.
2. **H-9** — migración `FactionRelation.presion @default(50)` (hoy `@default(0)` = ALIANZA).
3. **H-12 Cuartel Avanzado sin botón** — `frontend/src/components/panels/reino/EdificiosParcelasSection.tsx`:
   botón directo para construir `cuartel-avanzado` y sus mejoras (hoy solo por texto libre). Mirar
   cómo construye el resto de edificios (receta `recipeKey`, ruta de construcción real en
   `backend/src/routes/saves/reino.ts`/`construction.ts`) y reutilizar ese camino; mismas condiciones
   que el texto libre (dónde se puede, coste).
4. **H-3 `BAJA_DE_GUERRA`** — `backend/src/services/factionRelations.ts` tiene el evento tipado y
   pesado pero sin disparador. Dispararlo (con `recordFactionEvent`) cuando el jugador con Reino
   fundado MATA a un NPC de otra facción dentro de una región de esa facción (camino de muerte de NPC
   en `turnResolution.ts`, el mismo que ya resta reputación/población al quedar MUERTO; también el
   combate múltiple). Sin Reino fundado no hay `source` → no se dispara. Test de integración.

## Fase 2 — `rolReino` para súbditos (H-1)

- Backend `backend/src/routes/saves/companeros.ts` (~709, `POST …/plantilla`): si el body no trae
  `rolReino` y la plantilla asignada tiene un `rol` que es un `rolReino` válido, usarlo. Averiguar la
  lista real de valores válidos de `rolReino` (grep en backend: `'diplomatico'`, `'trabajador'`…) y
  la de `PlantillaEquipo.rol` (`'guardia' | 'trabajador' | 'productor'`) y mapear solo los que
  coincidan; documentar el mapeo en un comentario.
- Ruta nueva (o ampliar la existente) para fijar `rolReino` directamente, validando el valor.
- Frontend `components/panels/reino/SubditosSection.tsx`: selector de rol por súbdito integrado en
  el Reino, que llame a esa ruta y refresque. `lib/api.ts` con la función nueva.
- Tests: integración de ambas vías; que asignar trabajador a un edificio funcione tras fijar rol.

## Fase 3 — Slugs de oficio unificados (H-10)

- Hoy: `backend/src/scripts/worldCatalog.ts` y `frontend/src/data/professions.ts` no coinciden
  (`herrero-orco-llanuras` vs `curtidor-orcos-llanuras`; Maestros de Cristal Helado enseñan
  `herrero-orcos-cristal`, `minero-orcos-cristal`, `cocinero-orcos-cristal`,
  `alquimista-orcos-cristal`, que el frontend llama distinto o no tiene; `nabierus` en vez de
  `nabieus`). Ver la tabla H-10 en `docs/arquitectura/22-mundo-vivo-x4-tecnico.md § 9`.
- Elegir UNA convención (la mayoritaria del backend: `<oficio>-<raza en plural>-<región>`) y crear
  un único fichero fuente de verdad compartido que consuman backend y frontend (p. ej. un módulo en
  `backend/src/data/` que el frontend importe vía la misma técnica que ya use el repo para compartir
  tipos; si no hay mecanismo compartido, generar `frontend/src/data/professions.ts` desde el backend
  con un script y un test que falle si divergen).
- Migración de datos: `UPDATE "ProfessionProgress" SET "professionId" = <nuevo> WHERE ... = <viejo>`
  para cada renombre; lo mismo en cualquier otra columna que guarde slugs de oficio (grep
  `professionId`, `oficio`, `herramientaParaOficio`, recetas, Maestros).
- Test que recorra todos los slugs usados por Maestros, recetas y edificios y exija que existan en
  la fuente única.

## Fase 4 — Economía de facción en `worldTick` con consumo y stock real (H-6, H-2, H-4)

- Hoy `tickFactionProduction` (`backend/src/services/kingdomTick.ts:139`) se llama en
  `turnResolution.ts` (~5604-5613) en el turno de CADA partida y sobre todas las `KingdomStats` de
  facción sin filtrar mundo → producción duplicada; `comida`/`riqueza` nunca se consumen.
- Nuevo: sacarlo del turno y llamarlo desde `tick()` de `backend/src/workers/worldTick.ts`, una vez
  por mundo. El reloj de ficción vive por partida (`WorldState.fictionalMinutes`): el día de ficción
  de un mundo = el máximo de sus partidas activas. Campo nuevo en `KingdomStats` (p. ej.
  `ultimoDiaProducido Int?`) para que cada día solo se procese una vez (idempotente aunque haya
  varias partidas o varios ticks).
- Consumo por bocas: mismo criterio que `tickKingdomOneDay` (mirar cómo consume el Reino del
  jugador) aplicado a la población de la facción; sin comida, no crece riqueza / baja moral o lo que
  ya haga el Reino del jugador en ese caso — reutilizar, no inventar.
- **Stock real (H-2):** cada día producido, los edificios de oficio de la facción depositan objetos
  reales en su Almacén (`AlmacenItem` con `factionId`): 1 unidad por edificio y día de un producto
  de su oficio (tomado de las recetas reales de ese oficio en el catálogo), con un tope por
  `catalogSlug` y facción (constante nombrada, p. ej. 5) para no crecer sin límite. Así
  `GET …/reino/mercado/:faccion` tiene stock que comprar sin haberles vendido antes.
- **H-4 `decayPresion`**: en el mismo paso de `worldTick`, por cada semana de ficción cruzada
  (mismo marcador idempotente), aplicar `decayPresion` a las `FactionRelation` del mundo.
- Tests: unit de las funciones puras (días cruzados, consumo, tope de stock) e integración del tick
  con dos partidas del mismo mundo (no duplica) y del mercado con stock tras un día.

## Fase 5 — `ZonePoint` por partida (B1)

**Diseño (cerrado):**
- `ZonePoint.saveId String?` + relación a `Save` con `onDelete: Cascade`, índice
  `@@index([saveId, locationId])`. Filas con `saveId = null` = **plantilla de catálogo** (las que
  siembra `seed-catalog`); filas con `saveId` = estado vivo de esa partida.
- Helper único en `backend/src/services/zonePoints.ts`:
  `asegurarZonePointsDePartida(tx, saveId, locationId)` — si la partida no tiene filas en esa
  Location, clona las plantillas activas (mismos campos, `saveId` puesto, `lastUpdatedAtMinutes`
  null para que el primer reparto de grupos corra) y las devuelve. Llamarlo al entrar en una
  Location / en `GET /saves/:id/zona` / antes de cualquier lectura por partida.
- **Todas** las lecturas y escrituras de juego pasan a filtrar por `saveId` (nunca plantillas):
  `caza.ts`, `turnResolution.ts`, `construction.ts`, `zonaPosicion.ts`, `zonePoints.ts`
  (`recalcularZonePointsDeLocation`, `avanzarZonePointsUnPaso`, resúmenes),
  `stationaryInterruption.ts`, `routes/saves/dynamicMode.ts`, `routes/saves/zona.ts` (13 escrituras
  hoy — grep `zonePoint\.` en `backend/src`).
- `seed-catalog.ts` solo toca filas `saveId: null` (nunca borra las de partida).
- Reiniciar partida (`routes/saves/shared.ts`, restart): borrar sus `ZonePoint` de partida.
- Tests: integración de dos partidas en la misma Location — mover/cazar en una no cambia la otra;
  la plantilla nunca cambia; el seed no borra filas de partida. Ajustar los tests existentes de zona
  (`zona*.integration.test.ts`, `zonePoints*.test.ts`) al nuevo filtro.

## Fase 6 — Contenido del mapa de zona en Las Llanuras

- **Pescar y Buscar** sin puntos: añadir `ZonePoint` `tipo: RECURSO` para las fuentes de PESCA y
  BUSQUEDA que ya existen en el catálogo de Las Llanuras (jashil-rojo, jashil-verde, negueo-solar,
  negueo-turquesa, toluh, bulco-de-arena…) en Locations de agua compatibles con sus reglas
  (`harvestSourceTerrainTag`/`harvestSourceHomeLocationSlug`, mismo filtro que `candidateSourcesFor`)
  — la Fase 3 del plan anterior ya añadió algunos; completar los que falten y confirmar que la
  interacción (`dynamicModeRecurso.ts` → `resolverRecoleccion`) funciona para PESCA/BUSQUEDA.
- **Locations de Las Llanuras sin ningún `ZonePoint`**: listar (script o test) y darles puntos con
  la fauna/recursos que el catálogo YA sitúa allí; sin inventar especies ni lore. Coordenadas
  provisionales marcadas como en la ampliación 2026-08-31, sin pisar puntos (≥60 px).
- Ampliar `backend/src/scripts/zonePointsCobertura.test.ts` para exigir ≥1 punto en cada Location
  de Las Llanuras (salvo interiores/listas de excepción justificadas).

## Fase 7 — Deuda técnica que frena

- **`turnResolution.ts` → `services/dailyTick.ts`**: extraer el bloque de días cruzados (Reino,
  producción del jugador, consolidación…; la de facción ya salió en la Fase 4) a funciones de
  `dailyTick.ts` con la misma firma de datos, sin cambiar comportamiento. Los tests existentes deben
  pasar sin tocarlos (salvo imports).
- **`GameView.tsx`**: extraer a hooks al menos los bloques de estado+handlers de zona/caza/cadáveres
  (`zonaModalOpen`, `saquearSoloNpcSlug`, `handleCazarEnZona`, `handleHuntResolved`…) y de
  Reino/mercado si están en GameView, siguiendo el patrón de `hooks/useCombatFlow.ts`.
- **Registros**: en `docs/registros/deuda-tecnica-hallazgos.md` marcar como resueltas las entradas
  que el código ya resolvió (guards de `endedAt` en compañeros, `npcAttributesForLevel`, y
  cualquier otra que se compruebe con grep), y mover las cerradas de `revisar-partida-hallazgos.md`,
  `checklist-pruebas-juego.md` y `deuda-tecnica-hallazgos.md` a `docs/archivo/` (convención
  "estado arriba, historial abajo").

## Fase 8 — Alcance pre-alpha: solo Gorhorn jugable

- Decisión del 2026-09-01: Dessa Kaltrenn, Yerin Slaad y Riko pasan a NPC. Frontend: quitarlos de
  la selección de personaje (`frontend/src/data/mock.ts` y la pantalla de selección), dejando solo
  a Gorhorn; la creación de partida backend debe rechazar otro nombre con un 400 claro.
- Como NPC: crear sus entradas de `Npc` en `worldCatalog.ts` **solo con lo que ya dice el lore**
  (`docs/rpgtarkor/personajes/personajes.md`, `razas.md`…). Si el lore no fija dónde viven o qué
  papel tienen hoy, **no inventarlo**: escribir una propuesta en `propuestas-lore.md` y dejar el NPC
  fuera del catálogo hasta que Álvaro la apruebe.

## Fase 9 — Verificación en vivo (Opus, con Playwright)

Partida real con Gorhorn Cazador/Domador tras integrar las fases 1-8: recorrido de la tanda B1-B32
(cazar desde la tarjeta, cadáveres, reloj y energía al caminar, especialización al subir de nivel,
Goirnos al saquear, Vender), comprobar la reaparición tras Huir, y el Reino de punta a punta (fundar,
Taller, asignar trabajador con rol, producir, comprar a una facción con stock propio, vender).
Hallazgos al registro de pruebas; los bloqueantes se arreglan en el momento.

## Fase 10 — Todas las tiradas visibles (decisión de Álvaro, 2026-09-29)

"Todas las tiradas deben verse: dan efecto y una explicación visual al jugador." Principio: **toda
tirada que decide un resultado para el jugador devuelve sus datos en la respuesta HTTP y el frontend
la anima con los componentes que ya existen** (`DiceRollReveal`, `DiceRollSingle`,
`GatheringDiceReveal`, `RollBadge`, `CombatExchangeBadge`; ver cuál encaja mejor en cada caso). Si el
evento deja `LogEntry`, la tirada se guarda en `LogEntry.roll` (o el campo equivalente ya existente)
para que sobreviva a una recarga, mismo criterio que la huida (`routes/saves/session.ts`).

Tiradas hoy ocultas (inventario de Opus, verificado con grep):
1. **Recolectar desde el mapa** — `routes/saves/dynamicModeRecurso.ts`: `gatheringRollFor` +
   `applyGatheringRoll` se calculan y solo vuelve la narración. Devolver el `roll` (misma forma que
   `GET /recolectar/:oficio` para Desollar) y animarlo con `GatheringDiceReveal` antes de mostrar lo
   obtenido (y en el fallo: "no consigue nada" con el dado visible).
2. **Segunda tirada de tier alto** — `recolectar.ts § pasaSegundaTirada` (tier ≥ 6): se descarta el
   `roll`. Devolverlo por objeto afectado (tanto en `POST /recolectar/confirmar` como en la
   recolección desde el mapa) y mostrarlo.
3. **"¿Quién ve a quién primero?"** — `zonaPosicion.ts § quienIniciaEncuentro` (d20 + Destreza/2 por
   lado): devolver ambas tiradas en la oferta del encuentro (`dynamicModeOffer`, `zona.ts`) y
   pintarlas en la tarjeta de encuentro (LogPanel) como tirada opuesta.
4. **Cuántos del grupo entran al combate** — `caza.ts § rollGroupEngagement`: devolver la tirada
   (valor, delta, elegidos vs. reales) por especie y mostrarla junto al texto de varianza.
5. **Caza sigilosa** — `caza.ts § intentarCazaLimpia` (`Math.random() * 100 < chance`): convertirla
   en una tirada visible (d100 contra la probabilidad, o mejor el patrón de dados del proyecto si
   encaja sin cambiar la probabilidad real) y mostrarla en el resultado de la caza.
6. **Iniciativa del combate múltiple** — `combateMultiple.ts` (`rollAttributeCheck` por
   participante): comprobar si llega al frontend como en el 1v1 (`InitiativeRollInfo`); si no, que
   llegue.

Tests: cada ruta afectada devuelve la tirada con su forma; tests de componente donde haya uno cerca.
No cambiar probabilidades ni reglas: solo exponer y mostrar lo que ya se tira.

## Fase 11 — Hallazgos de la verificación en vivo (F9-2, F9-3, F9-4, B29)

1. **F9-2 — hora de la cabecera al caminar:** `POST /saves/:id/zona/mover` ya avanza el reloj (B2,
   `MINUTOS_POR_PASO_ZONA`) pero la respuesta no lo dice y el frontend sigue mostrando la hora vieja
   hasta el siguiente turno. Devolver `fictionalDateLabel` (y `fictionalMinutes` si hace falta) en la
   respuesta y actualizar el estado de hora del frontend (el mismo que pinta la cabecera, ver cómo lo
   actualiza un turno normal en `useTurnFlow`/`GameView`) en cada paso (`ZonaPanel` → callback).
2. **F9-3 — "TU ACCIÓN" con la hora vieja:** la entrada optimista de la acción (`useTurnFlow`,
   `handleSubmit`) usa el estado de hora; tras 1 debería salir bien. Comprobar el camino de caza
   (`useZonaAcciones.handleCazarEnZona` → `handleSubmit`) y añadir test.
3. **F9-4 — tiradas que no persisten:** el fallo de recolección desde el mapa
   (`routes/saves/dynamicModeRecurso.ts`) y el fallo de la caza sigilosa (`services/caza.ts §
   intentarCazaLimpia`) no crean `LogEntry`, así que su dado solo se ve en vivo. Crear un `LogEntry` de
   sistema con el texto que ya se narra y la tirada en `LogEntry.roll` (mismos `kind` de la fase 10),
   y que el frontend use esa entrada en vez de la local (sin duplicar el dado).
4. **B29 — atacar por texto a fauna pacífica:** "Ataco al Gesgurio" con el Gesgurio adyacente da una
   tirada y nada más (hallazgo B29 del registro de pruebas). Diseño: si la acción de texto libre tiene
   intención de ataque (`detectsAttackIntent`) y nombra a una fauna con `ZonePoint` de ESTA partida en
   la celda del jugador o adyacente (mismo criterio que la colisión, `celdaAdyacenteOMisma`), se
   resuelve igual que "Cazar" en la tarjeta (`services/caza.ts § iniciarCaza` con ese punto), en vez
   del narrador libre. Localizar dónde se decide hoy (`shouldForceCombat`, `turn.ts`/
   `turnResolution.ts`) y engancharlo ahí; si la fauna nombrada no está cerca, comportamiento actual.
   Tests de integración de ambos casos.

## Fase 12 — Deuda técnica, segundo corte

- **`GameView.tsx`** (~2.600 líneas): extraer a hooks los bloques que quedaron (equipar/desequipar,
  tirar/recoger, modo dinámico/Interactuar, muerte/reinicio), siguiendo `hooks/useZonaAcciones.ts` y
  `hooks/useCombatFlow.ts`. Si un bloque exige pasar demasiados parámetros, agruparlos en un objeto
  de contexto en vez de forzarlo, o dejarlo y justificarlo.
- **`turnResolution.ts`** (~7.700 líneas): siguiente corte natural sin cambiar comportamiento (p. ej.
  el bloque de combate múltiple `if (activeCombatEncounter)` o el de saqueo) a un servicio propio.
- Refactor puro: los tests existentes pasan sin tocarlos salvo imports.

## Fuera de este plan (🧭 pendientes de Álvaro)

- **H-5 diplomático**: cómo gana nivel (y si "diplomatico" pasa a ser una profesión aprendible). Hoy
  el código ya lo trata como oficio (`ProfessionProgress` con `professionId: 'diplomatico'`) pero
  nadie lo enseña ni da XP, así que el gate de `nivelDiplomaticoRequerido` lo bloquea tras una
  negociación.
- **Franja 4 "Charlar con NPC" enriquecido** (lore, reclutar, interrogar tras Clemente): solo está
  "mapeada"; falta una especificación (qué opciones, qué efectos mecánicos) antes de implementar.
- Presiones iniciales entre las 9 facciones (H-7), filtrar órdenes por oficio del edificio (P-3),
  viaje largo desde el mapa de mundo, D-12 a Berig, y el resto de preguntas del roadmap.
