# Ronda de correcciones — 2026-08-28

Checklist consolidado de TODOS los hallazgos pendientes reunidos hoy: sesión de pruebas en vivo
(`docs/checklist-pruebas-juego.md`) + análisis de cierre en 5 fases (`docs/revisar-partida-hallazgos.md`,
entrada `## 2026-08-28`) + memorias de diseño pedidas explícitamente por la usuaria. Orden de
prioridad: bloqueante real (deja al jugador atascado) → bug de datos/mecánica real → cambio de
diseño pedido explícitamente → prosa/vocabulario (bajo impacto, alta frecuencia).

## Prioridad 1 — Bloqueante real (deja la partida sin salida)

- [x] **P1.1 — Tarjeta Convaleciente atasca el combate del todo tras recargar.** FIJADO. Nueva
  tarjeta PERSISTENTE en `LogPanel.tsx` calculada directamente de `combatNpcsDisplay` (estado real
  de combate, ya viene de `GET /saves/:id`, sobrevive a F5) en vez de depender de
  `entry.convalecienteOffers` (efímero). `capturable` propagado a `CombatNpcDisplay`/
  `npcInSceneToCombatDisplay` (se perdía en la conversión). La tarjeta ligada al log ahora solo
  muestra el registro histórico "Resuelto." una vez decidido, sin duplicar botones activos.
  Verificado: `tsc -b` limpio, frontend 107/107 (test actualizado para el campo nuevo).

## Prioridad 2 — Bug de datos/mecánica real (rompe estado persistido, no solo narración)

- [x] **P2.1 — Saqueo optimista sin reconciliar.** FIJADO. `handleSaquearSeleccion` ahora guarda
  el estado previo (`yaSaqueado`/`lootedItemNames`) de cada NPC antes de mutarlo optimísticamente,
  y lo revierte si `submitCombatAction` devuelve `false` — mismo patrón que
  `handleDecapitarSeleccion`. 2 tests nuevos (éxito + reversión por fallo). Verificado: `tsc -b`
  limpio, frontend 109/109.
- [x] **P2.2 — Misión "Acabar con el Orco Enfurecido" se salta los botones Aceptar/Cancelar.**
  FIJADO. El bloque de `turnResolution.ts:5232` ya no crea la Quest — solo detecta la aceptación
  verbal y rellena `newQuestOfferInfo` (igual que el camino genérico). La lógica especial
  (objetivo/recompensa fija, caso "ya resuelto antes de aceptar") se movió a
  `POST /saves/:id/quests/aceptar` (`quests.ts`), reconocida por título exacto. 2 tests de
  integración actualizados para el nuevo flujo (ofrece → `/quests/aceptar` → verificar). No se
  encontraron más NPCs con el mismo patrón legado (búsqueda de `detectsVerbalAcceptanceIntent` en
  el archivo — solo este uso). Verificado: `tsc -b` limpio, backend 1665/1665.
- [x] **P2.3 — Oferta de modo dinámico ("Interactuar") no sobrevive a una recarga.** FIJADO.
  Campo nuevo `Save.pendingDynamicModeOffer` (migración `20260828154527`, aplicada) persiste la
  oferta cuando se calcula (`turnResolution.ts`); se limpia al Interactuar (pasa a
  `pendingDynamicMode` real) o Ignorar (`dynamicMode.ts`); expuesto en `GET /saves/:id`
  (`detail.ts`). Frontend reconstruye `dynamicModeOffer` colgándolo de la última `LogEntry` tras
  `syncFromSave`, reutilizando toda la infraestructura de `LogPanel.tsx` que ya existía. 2 tests
  nuevos en `detail.test.ts`. Verificado: `tsc -b` limpio (back+front), backend 1667/1667,
  frontend 109/109.
- [x] **P2.4 — Dar un objeto a un NPC no lo retira del inventario del jugador.** MITIGADO (no
  arreglado del todo — ver nota). Nuevo guard de honestidad `hasFalseItemGivenAway`
  (`narrador.ts`) — mismo patrón que `hasFalseEquipmentChangeClaim`: si la narración usa vocabulario
  de entrega ("entrega"/"le da"/"le pasa"/"le ofrece"/"le tiende") junto al nombre de un objeto real
  del jugador en la misma frase, se descarta y se reintenta — evita que la narración PROMETA una
  entrega que la mecánica no puede cumplir. **Nota**: esto es un guard de honestidad narrativa, NO
  una mecánica real de "entregar objetos" (eso seguiría sin existir) — evita la contradicción
  futura (el objeto ya no reaparecerá describiéndose como entregado), pero no construye el flujo
  determinista de verdad quitar el `InventoryItem`. 5 tests nuevos. Verificado: `tsc -b` limpio,
  backend 1672/1672.

## Prioridad 3 — Cambios de diseño pedidos explícitamente, sin aplicar

- [x] **P3.1 — Ajustar energía de Defenderse/Esquivar.** FIJADO. `genericCombatAbilities.ts`:
  Defenderse `energyRegen` 10→5; Esquivar `energyRegen: 5`→`energyCost: 5` (invierte el signo).
  **Hallazgo de paso**: el lado del NPC (`npcCombatAbilities.ts`) YA tenía estos mismos valores
  desde antes (comentario propio decía "mismos números que el lado del jugador", desactualizado) —
  jugador y NPC llevaban desincronizados desde 2026-07-31, ahora vuelven a coincidir. Comentario
  corregido. Test nuevo `genericCombatAbilities.test.ts` (no existía cobertura dedicada del lado
  del jugador). Verificado: `tsc -b` limpio, backend 1674/1674.
- [x] **P3.2 — Huir DENTRO de combate debe tener riesgo real.** FIJADO. Nuevo endpoint
  `POST /saves/:id/combat/huir-en-curso` (`session.ts`), mismo patrón que `combat/flee`
  (pre-combate): tirada real de destreza (`rollCheck`+`contraataqueDifficultyFor`), candado
  `SELECT ... FOR UPDATE` sobre `pendingCombatNpcSlugs` contra condiciones de carrera. Éxito limpia
  `pendingCombatNpcSlugs` (combate resuelto); fallo aplica `oneStepWorseThan(condicionFisica)` — un
  golpe directo real, SIN tirada de defensa — y deja el combate abierto. Bloqueado con 409 si el
  jugador ya está CONVALECIENTE/MUERTO (sin salida real ante un fallo). `handleCombatHuir`
  (`useCombatFlow.ts`) ya no usa `submitCombatAction` fire-and-forget — llama al endpoint nuevo,
  espera la respuesta, actualiza `condicionFisica` real y solo cierra el popup si escapó. 5 tests
  de integración nuevos (éxito, fallo con golpe, bloqueo CONVALECIENTE, sin combate activo,
  condición de carrera) + 2 tests de frontend actualizados (reemplazan el test viejo del
  comportamiento fire-and-forget). Verificado: `tsc -b` limpio (back+front), backend 1679/1679,
  frontend 110/110.
- [x] **P3.3 — Retomar un viaje interrumpido por un evento resuelto con éxito.** FIJADO. Campo
  nuevo `Save.pendingTravelResumeDestinationId` (migración `20260828170000`, aplicada): `turn.ts`
  lo rellena con el `Location.id` ORIGINAL en el momento exacto de truncar
  (`pickTravelInterruption` ya recorta `effectiveTravel` a la parada intermedia). Tras cualquier
  turno que resuelva sin dejar combate activo y con el jugador vivo (`turnResolution.ts`, mismo
  punto donde ya vive el enganche de modo dinámico), si hay un destino pendiente se calcula la ruta
  real desde la ubicación actual (`resolveTravelToLocationId`, nuevo en `travel.ts` — mismo
  Dijkstra que `resolveTravel`, pero por id conocido, sin re-matchear texto) y se dispara un
  `CharacterTransit` nuevo hacia el destino original, con narración determinista ("retoma el camino
  hacia X") y el mismo mecanismo de resolución diferida de siempre
  (`startEagerTransitResolution`). `travelResumed` nuevo en la respuesta de `/turn/narrate`
  (informativo). **Bug real encontrado testeando**: el `zoneContext` del tránsito de reanudación no
  incluía `classification` — `resolveClaimedTransit` (worldTick.ts) la necesita para calcular
  `minutosDeEsteTurno`/banda, y sin ella el tránsito se quedaba parado para siempre sin narrar
  nunca (fallo silencioso). Corregido construyendo el mismo `classification` sintético sin tirada
  que `turn.ts` ya usa para cualquier viaje conocido por el grafo. 3 tests de integración nuevos en
  `turn.integration.test.ts` (destino se persiste al truncar, se limpia y dispara `travelResumed`
  al resolver sin combate, y el tránsito nuevo llega de verdad al destino original — este último
  sondea el estado en vez de asumir, porque usa el mecanismo real de producción con `busyUntil`
  real, acotado a 5s solo en este describe vía `env.transitMaxRealMinutes`). Verificado: `tsc -b`
  limpio (back+front), backend 1680/1680, frontend 110/110.

## Prioridad 4 — Sospecha sin confirmar (investigar antes de decidir si hay fix)

- [x] **P4.1 — Kirelon Arenoso sobrerrepresentado en interrupciones.** INVESTIGADO, NO HAY BUG DE
  PESO. El algoritmo de sorteo ponderado (`pickAmbientEncounterCandidate`, `npcScene.ts`) es
  correcto — sin sesgo. `regionWeight` (filtrado pero no multiplicado tras pasar el filtro) tampoco
  es un bug real: en todo el catálogo sembrado hoy, cada fila de `WorldPopulation` tiene
  `distribucion` 100% concentrada en una sola región, así que ignorarlo no cambia ningún resultado.
  **El marco original del hallazgo estaba mal planteado**: Kirelon Arenoso tiene
  `homeLocationSlug: 'hondonada-del-eco'` (NO es itinerante puro), así que `pickTravelInterruption`
  (que exige `homeLocationSlug: null`) nunca puede elegirlo — el mecanismo real detrás de lo
  observado es `pickStationaryInterruption` (acciones largas SIN viaje), que en La Hondonada del
  Eco solo tiene 2 candidatos FAUNA sembrados: Kirelon (población 154) y Gesgurio (~2000-2146) — una
  competición BINARIA de ~6.7% por tirada, no "154 contra 2146-5387" como sugería el hallazgo.
  Ganar 5-6 veces seguidas con ~6.7% sigue siendo estadísticamente muy improbable (1 en cientos de
  miles a millones) pero no imposible en una sesión larga con muchas tiradas acumuladas en la misma
  zona — no se encontró ningún defecto de código que lo explique mejor. Sin cambios de código.
- [x] **P4.2 — Seguimiento del fix de descanso: un caso posterior no curó.** INVESTIGADO, NO ES
  BUG. `healCeilingFor` (`death.ts`): sin descansar en una construcción PROPIA activa
  (`restInValidLocation`), el techo de curación de "cualquier sitio" (`restAttempted`) es `GRAVE`
  como mucho — nunca mejor. El caso reportado fue el intento INMEDIATAMENTE posterior al fix ya
  cerrado, que dejó a Gorhorn en `GRAVE` de verdad (confirmado en el propio hallazgo: "Gorhorn pasó
  de CONVALECIENTE a GRAVE"); volver a descansar desde `GRAVE` sin refugio no puede curar más,
  `Math.min(currentIdx, ceilingIdx)` con `current === ceiling === GRAVE` da `GRAVE` sin cambios —
  comportamiento correcto y esperado del diseño (solo un refugio/asentamiento real rompe ese tope
  hasta `HERIDO`), no una regresión. `lastRestLocationId` vacío es coherente con lo mismo: solo se
  actualiza si hay una construcción propia activa en esa ubicación, y no la había.

## Prioridad 5 — Vocabulario/prosa (bajo impacto individual, alta recurrencia acumulada)

- [x] **P5.1 — Palabras en inglés coladas en narración española.** FIJADO. Ya existía
  `hasEnglishLeak`/`ENGLISH_LEAK_REGEX` (`narrador.ts`, desde 2026-07-31) enganchado como guard de
  reintento, pero su lista (`own|the|and|was|with|from`) no cubría NINGUNO de los 3 casos reales
  reportados. Ampliada con `small|clearing|several|lullaby|nearby|forest|shadow|whisper|silence|
  darkness|distant` — mismo criterio conservador (solo palabras función/comunes sin homónimo
  español real). 3 tests nuevos con los casos reales exactos. Verificado: `tsc -b` limpio, backend
  182/182 en `narrador.test.ts`.
- [ ] **P5.2 — El texto de la acción del jugador se filtra casi literal en la narración.** Caso
  aislado (1 vez en 18 turnos), con mayúsculas de énfasis y comillas de sintaxis interna incluidas.
  Sin guard — se mantiene sin corrector genérico a propósito (mismo criterio que
  `docs/revisar-partida-hallazgos.md`: sin patrón repetible claro, un detector de similitud
  narración-vs-acción sería sobredimensionado para un caso puntual).
- [x] **P5.3 — "orcos del Clan Maktor" como amenaza externa.** FIJADO (mitigado con guard, mismo
  criterio que P2.4). Nuevo guard `hasFalseMaktorThreatClaim` (`narrador.ts`) — `protectedFactsFor`
  YA instruye que el Clan Maktor fue aniquilado y Gorhorn es el único superviviente, pero el modelo
  lo ignoró; detecta "Clan Maktor" junto a vocabulario de amenaza/pluralidad ("más", "otros",
  "ejército", "supervivientes"...) en la misma frase y fuerza reintento, sin disparar con menciones
  correctas (origen, historia, honor). "Goirsentres" (palabra inventada, correcta "Goirntes") NO
  recibe guard propio — caso aislado de una sola alucinación de nombre puntual, sin patrón
  recurrente que justifique una regex dedicada. 3 tests nuevos. Verificado: `tsc -b` limpio,
  backend 185/185 en `narrador.test.ts`.

## Prioridad 6 — Peticiones nuevas anotadas durante la ronda, sin desarrollar todavía

- [ ] **P6.0 — Falta un botón para tirar/descartar objetos del Inventario.** Petición explícita de
  la usuaria (2026-08-28, durante esta misma ronda de correcciones: "solo anótalo de momento, no lo
  desarrolles"). Confirmado revisando `InventarioPanel.tsx`: "Soltar" (`postSoltarCaptura`) SOLO
  existe para capturas en tránsito (fauna/NPC atados), no hay ningún botón de "Tirar"/"Descartar"
  para un objeto normal del inventario — hoy la única forma de reducir el inventario es
  usar/equipar/consumir, sin ningún camino para deshacerse de algo simplemente porque sobra.

## Prioridad 6.5 — Balance/diseño abierto, sin decisión tomada ("ya lo valoraremos")

- [ ] **P6.1 — Balance del combate tutorial (Orco Enfurecido).** No se siente "asequible" para
  nivel 1. Sin decisión tomada explícitamente — la usuaria dijo "ya lo valoraremos", no incluir en
  esta ronda salvo que se pida.

---

**Cierre de la ronda (2026-08-28)**: P1-P5 completas — 12 de 14 ítems cerrados con fix real
(P1.1, P2.1-P2.4, P3.1-P3.3, P4.1-P4.2 investigados sin bug real, P5.1, P5.3), 1 dejado a propósito
sin corrector genérico (P5.2, caso aislado), P6.0 anotado sin desarrollar por petición explícita,
P6.1 fuera de esta ronda por decisión de la usuaria ("ya lo valoraremos"). Verificación final
conjunta: `tsc -b` limpio en backend y frontend, backend 1686/1686, frontend 110/110 (el patrón de
12 fallos 409/timeout en `turn.integration.test.ts` bajo carga en paralelo es contención de
Postgres ya documentada — confirmado falso positivo corriendo ese archivo en solitario: 95/95).
