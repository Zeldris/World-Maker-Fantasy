# Roadmap activo — Tarkor

**Sustituye como fuente de verdad a [archivo/11-roadmap-historico.md](archivo/11-roadmap-historico.md)**
(archivado 2026-08-13, ya puro historial de 2026-07-16→2026-08-13) desde 2026-08-24. Este documento
es el que se mantiene vivo de aquí en adelante — se actualiza según se cierren o aparezcan puntos,
mismo criterio que tenía el anterior.

---

## Historial — cerrado en esta sesión (2026-08-23/24)

**Auditoría de elementos desconectados (23/08)** — listado de ~16 mecánicas/datos sembrados sin
efecto real en juego, resuelto en 3 grupos (ver memoria `tarkor_auditoria_elementos_desconectados_2026-08-23`
para el detalle completo):
- Bug real arreglado aparte: `esperandoDefensaJugador` no se leía en el turno de APERTURA de un
  combate — `GameView.tsx` ya llama `setCombatAwaitingDefense` también ahí.
- **Grupo 1 (rápidos)**: `WorldPopulation.poblacionMax` ahora es techo real; `characterArchetype`/
  `characterOrigin` visibles en `EstadisticasPanel.tsx`.
- **Grupo 2 (construir o quitar)**: `PregeneratedCharacter` y `World.factions` retirados (2
  migraciones aplicadas); `WorldState.agenda` restaurado y movido a Grupo 3.

**Auditoría de lore↔código (23/08)**: recolección/caza rota para ~40 especies de fauna desde el
2026-08-03 (sin `harvestSourceAliases`/`faunaTerrainTag`), arreglado. Tótem Maktor añadido al
catálogo, Filtro de Quio con `HarvestYield`, texto de Osario corregido, alias Makut Silh, 2 tags de
terreno, `loreChunks.ts`/`berigLore.ts` puestos al día (Florial/Ferios/7 escuelas/lore Chamán),
`EnciclopediaPanel.tsx` con la descripción Arcano/Magia corregida.

**Sistema de clases de combate** (`docs/rpgtarkor/clases.md`) — 9 clases/34 especializaciones
diseñadas, **fase de diseño dada por cerrada** (2026-08-24, incluye las 5 clases sin repasar a
fondo). NPCs existentes con stats reales asignados a clase (nueva sección en `clases.md`).

**Gorhorn deja de ser dual-clase — único cambio de código real de todo este bloque de diseño**:
`classAbilityUnlocksFor` ya filtra por `clase: 'Cazador'`, no da más las 4 habilidades de Guerrero.
Tests actualizados, `tsc -b` limpio.

**`HarvestYield.condicion` (2026-08-24) — cerrado, más pequeño de lo que parecía.** Al auditar las
40 filas con `condicion` de verdad, la mayoría ya estaba resuelta por trabajo previo de esta misma
sesión que no se había reflejado en el checklist: `sinTirada`/`requiereHerramienta` ya cubrían
reconocimiento trivial y minero; el gate de cuchillo/deshuello ya es un bloqueo de oficio entero
(`OFICIOS_CON_HERRAMIENTA_REQUERIDA`), no necesita flag por yield; "SOLO cadáver ya muerto" ya es
así por construcción (`metodoObtencion: 'CAZA'` en este sistema siempre es despiece de una presa ya
derrotada). Lo único que de verdad faltaba: 3 items con "extracción cuidadosa (destreza, Media 15)"
en texto (`veneno-espina`/`ascuas-raiz-fuego`/`glandula-ignea`) no tenían `tier` puesto — por
defecto caían en dificultad 11, no 15 — corregido a `tier: 5`. `esquirla-celeste-caida`
("extremadamente rara... nunca drop garantizado") tampoco tenía tier — ahora `tier: 9`, el más alto
del catálogo. **Requiere `npm run seed-catalog` contra tu Postgres real para que el cambio de tier
llegue a las filas ya sembradas** — no lo he corrido yo (no gestiono tu DB).

**Quedan 2 sub-casos de `HarvestYield.condicion` genuinamente bloqueados, sin construir**:
`punado-arena-iman`/`esquirla-celeste-caida` dependen de un evento de clima ("tras una tormenta de
arena magnética reciente") que no existe en el motor; `boungo` depende del sistema de estaciones
("crece en otoño"), ya en la cola de Grupo 3. Ninguno de los dos es solo "sistema de estaciones" —
clima puntual (tormentas) y estación (mes del año) son dos conceptos distintos, ambos sin diseñar.

**`WorldState.agenda` (2026-08-24) — construido desde cero, no había nada detrás.** Diseño cerrado
con la usuaria: el Clan Serhu, alineado en la sombra con la Concordia de Hierro, presiona a Helsig
y Goshg (que resisten) — hoy solo "pequeños conflictos", sin guerra abierta. `worldAgenda.ts` (4
funciones puras + 1 orquestadora) siembra este hito y lo avanza por etapas cada 7 días de ficción
si nadie interviene; cada etapa cruzada deplecia 20 población real de Helsig y de Goshg
(`WorldPopulation`, ya trackeada por clan) y añade un hecho narrativo que el Narrador puede citar.
Enganchado al mismo tick de fondo que ya hace crecer población (`worldTick.ts`). Se siembra solo
para la partida jugable real (`characterName: 'Gorhorn'`) — su partida en curso, con `agenda: []`
hoy, lo sembrará sola en el próximo tick tras reiniciar el backend. Tests: 11 nuevos en
`worldAgenda.test.ts`, `tsc -b` limpio.

---

## Pendiente — Grupo 3 (features nuevas, diseño cerrado, sin construir)

Cola acordada con la usuaria: features reales, una a una, cada una con su propio diseño ya resuelto
antes de tocar código. El detalle vivo de esta cola sigue en la memoria
`tarkor_auditoria_elementos_desconectados_2026-08-23` (se actualiza ahí primero); esta sección es el
resumen de trabajo real, agrupado por tamaño.

### Los 3 sistemas grandes diseñados esta sesión (documentación completa)

- [x] ~~**Sistema de clases y especializaciones** (8 de 9 clases)~~ — APLICADO al motor 2026-08-24
  en dos pasadas el mismo día. Primera pasada: Guerrero/Cazador/Chamán (las 3 con repaso a fondo en
  ese momento). Segunda pasada, tras cerrarse el diseño de las 9 clases ("aplícalo ya todo y ya lo
  cambiaremos en el futuro si hago cambios en las clases"): + Arquero/Caballero/Segador/Asesino/
  Druida — `classAbilities.ts` pasa de 33 a **136 huecos "✅ lista"**, verificados efecto a efecto
  contra el motor real (no solo Convocador/Opresor: Maestro Arquero/Maestro Ballestero también
  estaban mal marcados en el doc, "7/8" ahí vs. 1/8 real). MAGO se queda sin tocar — sigue siendo
  solo identidad narrativa, sin tronco ni tabla de niveles en clases.md. `Npc`/`Save` con `clase`/
  `especializacion` reales (enums, ya no texto libre). Construido de paso en la primera pasada, no
  estaba planeado: el "bonus de atributo fijo" de habilidad (`StartingAbility.attributeBonus`/
  `SavedAction.attributeBonus`, aplicado en `combatExchange.ts`) — sin él ninguna habilidad se
  diferenciaba mecánicamente de un Ataque Básico. `CONVERSION` dado de alta (se resuelve sin
  infraestructura de duración). Categoría de arma `VARA` + restricción de armas por clase aplicada
  al equipar (`weaponPoolFor`, weaponAbilities.ts) — **solo Guerrero/Cazador/Chamán**, el resto de
  clases sigue sin pool de armas diseñado en clases.md. Los 15 NPC humanoides del catálogo tienen
  clase/especialización real asignada (incluidos los "no combatientes" — instrucción explícita de
  cobertura total). Enciclopedia (`buildClassesSection`) muestra las 8 clases construidas.
  **Sigue pendiente**: toda la infraestructura de duración por turnos (`AUMENTO`/`DEBILIDAD`/
  `CANALIZAR`/`RETIRAR`/`CURAZION`/`REFLEJAR`/`REFRACTAR`/`PURIFICAR`/`PROVOCACION`/`CONTRA`) +
  combate multi-objetivo (`INVOCACION`/`CONTROL`/`MULTIPLE`/`OCULTACION`/`DESVIAR`/`COMPANERO`) +
  `MARCAR` (nuevo, solo Domador) + restricción de armadura por peso (documentada para las 9 clases,
  necesita infraestructura nueva — `PesoArmadura` enum + `ItemCatalog.pesoArmadura`, sin construir)
  + pool de armas para las 6 clases sin diseñar — ninguna de estas piezas se ha tocado, sigue
  bloqueando la mayoría de huecos de las 30 especializaciones ya construidas. Cambios futuros que
  ella haga en clases.md (edición en curso) se portarán al motor en una pasada aparte, no ahora.
- [ ] **Combate múltiple** (`docs/rpgtarkor/combate-multiple.md`) — iniciativa individual N-way, tope
  4v4 con sub-combates deterministas, modo autónomo/reporte, retira el truco `groupSize`. Desbloquea
  `MULTIPLE`/`INVOCACION`/`COMPANERO`/`CONTROL`/`EXPULSAR` de arriba.
- [ ] **Compañeros y supervivencia** (`docs/rpgtarkor/companeros-y-supervivencia.md`) — captura con
  cuerda, jaula, tameo con tirada opuesta, slot garantizado de Domador, Hambre/Sed del personaje,
  Almacén de Reino + plantillas de equipo. **Conecta directo con el punto de "trabajador de Reino"
  de abajo** — es probable que se resuelvan juntos.

### De la auditoría original (23/08)

- [x] ~~`HarvestYield.condicion`~~ — cerrado 2026-08-24 (ver Historial arriba), salvo 2 sub-casos que
  dependen de clima/estaciones, ahora en "Encontrado en esta revisión" de abajo.
- [x] ~~`WorldState.agenda`~~ — cerrado 2026-08-24 (ver Historial arriba): `worldAgenda.ts`, un
  hito real (conflicto Serhu-Concordia vs. Helsig/Goshg) que avanza por etapas cada 7 días de
  ficción y deplecia población real si nadie interviene.
- [x] ~~`Territory.control`~~ / ~~`Building.status`~~ / ~~`KingdomStats.felicidad`~~ — **corrección
  2026-08-24: ya estaban construidos**, hecho en la parte de esta misma sesión previa a la
  compactación de contexto que nunca llegó a reflejarse en este checklist. `kingdomTick.ts`
  (rachas `diasFelicidadAlta`/`diasFelicidadBaja`) + `turnResolution.ts` (bloque `diasCruzados`)
  ya conectan felicidad sostenida con `CONSOLIDADO`/`PERDIDO` de verdad, y perder un territorio ya
  pone sus edificios en `ABANDONADO`. `EN_CONSTRUCCION` real desde que construir lleva tiempo
  (`turn.ts`/`construction.ts`). Único hueco menor: `DANADO` se lee (respawn) pero nada lo
  produce todavía — no bloqueante, anotado por si se retoma.
- [x] ~~`reclutablePct`~~ — cerrado 2026-08-24 (documentación): conectado como la dificultad base de
  la tirada de persuasión de NPC en `companeros-y-supervivencia.md § 3` — mismo destino que
  `domesticablePct` para el tameo de fauna.
- [ ] `comerciablePct`/`cortejablePct` — sin sistema real detrás todavía (comerciar sigue siendo
  narrativo libre, cortejo no existe como mecánica); la usuaria confirmó que se quedan, pendientes
  de diseño propio, no se retiran.
- [ ] `Npc.levelMax` (rango de nivel para tiradas opuestas) y `percepcionPasivaFor` (percepción
  pasiva D&D-style, sin consumidor) — se quedan en cola, pendientes de diseño; `percepcionPasivaFor`
  tiene un hueco natural con detectar una emboscada antes de que ocurra, o con los efectos
  `OCULTACION`/`ATENCION` ya pendientes de `clases.md`.

### Encontrado en esta revisión (2026-08-24), repasando todos los .md activos

- [x] ~~**Magia de 7 escuelas**~~ — cerrado 2026-08-24: no era una pregunta abierta de verdad,
  `07-mundo-helek-sirik.md` tenía una nota "sigue pendiente" que se quedó desactualizada el mismo
  día que se cerró la decisión real (`clases.md § Atributo Magia`) — las 7 escuelas y las 12 ramas
  de Semilla ya tiran todas con el mismo atributo Magia, sin dado propio por escuela. Reconciliado.
- [x] ~~**Sistema de estaciones**~~ — cerrado 2026-08-24, APLICADO al motor. Calendario único y
  global (120 días/año, 30 por estación), diseño completo en
  [estaciones.md](rpgtarkor/estaciones.md): `estacionFor`/`estacionNombreFor` puras (`worldClock.ts`),
  enum `Estacion` + `HarvestYield.estacionRequerida` nuevo, filtrado antes de la tirada en
  `recolectar.ts`. Nombres Kektira (Ur'gathek/Sohkar/Vungrat/Krenoth) porque el personaje jugable
  es orco, con glosa en lengua común como fallback para otras razas. `boungo` ya exige Vungrat
  (Otoño) de verdad. **Pendiente de tu lado**: aplicar la migración nueva contra tu Postgres +
  reseed del catálogo. El Kirelon Arenoso ("largos inviernos") queda fuera — es tasa de aparición,
  no `HarvestYield.condicion`, sistema distinto sin tocar.
- [x] ~~**Eventos de clima puntuales**~~ — cerrado 2026-08-24, APLICADO al motor. Distinto de
  estaciones: diseño completo en [clima-tormentas.md](rpgtarkor/clima-tormentas.md). Hallazgo real
  al abrirlo: `arena-iman` ya tenía `WorldPopulation` sembrada, así que hoy aparecía SIEMPRE —
  la `condicion` de texto no bloqueaba nada. Se convirtió en la caracterización real del clima de
  Las Llanuras (petición explícita de la usuaria): de 120 días, 40 de gran tormenta (Rokthar), 40
  de vientos fuertes (Sek'tar), solo 40 llevables (Ghurmek) — "duro vivir aquí". 1 de cada 3 días
  de tormenta es Extrema (Rok'ithek), la única que además puede dar la esquirla. `climaFor`/
  `HarvestYield.climaRequerido` (umbral de severidad mínima, no igualdad exacta), por región desde
  el principio (hoy solo Las Llanuras tiene números reales). **Pendiente de tu lado**: aplicar la
  migración nueva + reseed del catálogo.
- [ ] **"Trabajador de Reino"** — bloquea hoy a los 22 NPC del Campamento Serhu y al oficio de
  agricultura de Las Llanuras (pensado para aprenderse por misión, no por NPC-maestro). Mismo
  bloque de diseño que el Almacén de Reino/roles guardia-trabajador-productor de
  `companeros-y-supervivencia.md` — candidato fuerte a resolverse junto con ese sistema.
- [ ] **Quién enseña un oficio nuevo** (`09-panel-personaje.md`) — aplazado a propósito hasta que
  haya un caso concreto, baja prioridad.
- [ ] **Miel Lebude / futura profesión de cocina por raza-región** (`flora-fauna.md`) — idea suelta,
  apenas especificada, prioridad muy baja.

### Ajuste de números, no features nuevas (pero sin cerrar)

- [x] ~~Campamento~~ — cerrado 2026-08-24 (APLICADO al motor): 6 leña + 8 piedra + 2 piel (antes
  20/10/5), `construction.ts`. Tests actualizados, `tsc -b` limpio.
- [x] ~~**Ayuntamiento pequeño**~~ — **APLICADO al motor** 2026-08-24 (`construction.ts`, 6
  categorías: 14 piedra + 6 leña + 6 hueso + 8 resina + 2 mena + 8 fibra, sin oficio exigido).
  Mediano/grande se quedan solo diseño a propósito ("código real solo el pequeño"). Resultó ser
  mucho más grande de lo que parecía. Al cerrar el pequeño, la usuaria señaló un problema de
  diseño real: los recursos base son fungibles sin región ("cualquier piedra vale"), y construir
  debería depender de materiales PROCESADOS (bloques, lingotes, columnas) por oficio regional, no
  de recursos crudos directamente. Diseño completo en
  [materiales-procesados-construccion.md](rpgtarkor/materiales-procesados-construccion.md)
  (encontró que parte ya existía sin conectar: `bloque-piedra-tallada`/`lingote-de-hierro`
  huérfanos desde 2026-07-29). Cifras cerradas: pequeño 100% crudo, mediano ~75% procesado/25%
  crudo, grande 100% procesado (salvo resina, sin versión procesada nunca) — "así es difícil de
  ampliar" a propósito, exige los 4 oficios de procesado a la vez.
  **Mediano/grande — APLICADO al motor 2026-08-24**: 3 items nuevos (viga de madera tallada,
  columna de hueso, cordaje trenzado), 3 `CraftingRecipe` nuevas, `bloque-piedra-tallada`/
  `lingote-de-hierro` conectados a construcción por primera vez, y
  `ConstructionRecipe.oficio` pasa de "solo alivio" a bloqueo real (`OFICIOS_CONSTRUCCION_REQUERIDOS`,
  mismo patrón que `OFICIOS_CON_HERRAMIENTA_REQUERIDA`) desde el mediano en adelante. Diseño
  completo en [materiales-procesados-construccion.md](rpgtarkor/materiales-procesados-construccion.md).
- [x] ~~8 items completamente huérfanos~~ — cerrado 2026-08-24, APLICADO al motor: 5 con
  `CraftingRecipe` nueva (herrero/curtidor orcos-llanuras), `trampa-de-lazo` conectada como la
  cuerda de captura de `companeros-y-supervivencia.md` (sin item nuevo), `marca-de-clan`/
  `silbato-hueso-caza` en loadout de NPC reales (Torgash Ketg/Cazadora Serhu). Ninguno se retiró.
  Tests nuevos en `crafting.test.ts`, `tsc -b` limpio, sin regresiones.
- [x] ~~65 de 79 RECURSO/MATERIAL sin ninguna receta que los use~~ — cifra desactualizada: la
  cifra REAL el 2026-08-24 era 27 de 82 (el trabajo de ayer/hoy ya había cerrado 38). Cerrado y
  APLICADO al motor el mismo día: 18 `CraftingRecipe` nuevas cubren 25 de los 27 (9 items
  equipables/consumibles/materiales nuevos + `leche-murgol`, que no tenía NINGUNA `HarvestYield` —
  nuevo `sourceSlug: 'murgoles-domados-campamento'`, PASIVO, en el propio Campamento del Clan
  Serhu, con su `WorldPopulation` propia). 2 quedan sin receta a propósito:
  `lingote-aleacion-goirntes` (ya tiene uso real como paga/soborno de un NPC goirnte) y
  `hierba-del-hierro` (su `HarvestYield.condicion` ya dice "fuera del núcleo jugable actual" —
  Meseta del Orden no es jugable hoy). Tests nuevos en `crafting.test.ts` (44 recetas en total),
  `tsc -b` limpio, sin regresiones.

### No es Grupo 3 — categorías aparte, para no confundir al leer esta lista

- **Bugs reales** (`recolectar.ts`/`rollGathering` 500, "profesiones tiran dado siempre", Cruzavientos
  nunca narrado) — viven en sus propias memorias/`revisar-partida-hallazgos.md`, no compiten por
  prioridad con las features de arriba.
- **Huecos de lore puro** (Riko sin desarrollar, Kael Dorn↔Ithren sin cerrar del todo, Kalisar sin
  NPC propio) — trabajo de escritura, no de código; ya trackeados en
  `ampliar-lore-checklist.md § Pendiente de diseño`.
- **Modo Multijugador** (`02-decisiones.md`, 12 preguntas P0-P3) — explícitamente pausado hasta que
  el modo en solitario esté maduro, ni siquiera diseñado todavía.
- **Benchmark de latencia real** (`06-decisiones-mecanicas.md` punto 5) — medición de rendimiento
  pendiente, no una feature.
