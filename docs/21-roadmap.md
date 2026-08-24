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

---

## Pendiente — Grupo 3 (features nuevas, diseño cerrado, sin construir)

Cola acordada con la usuaria: features reales, una a una, cada una con su propio diseño ya resuelto
antes de tocar código. El detalle vivo de esta cola sigue en la memoria
`tarkor_auditoria_elementos_desconectados_2026-08-23` (se actualiza ahí primero); esta sección es el
resumen de trabajo real, agrupado por tamaño.

### Los 3 sistemas grandes diseñados esta sesión (documentación completa)

- [ ] **Sistema de clases y especializaciones** (`docs/rpgtarkor/clases.md`). Incluye: infraestructura
  de duración por turnos (`AUMENTO`/`DEBILIDAD`/`CANALIZAR`/`RETIRAR`/`CURAZION`/`REFLEJAR`/
  `REFRACTAR`/`PURIFICAR`/`ATENCION`/`OCULTACION`/`CONTRA`/`DESVIAR`); dar de alta 3 efectos nuevos
  (`PROVOCACION`/`CONVERSION`/`MARCAR`); restricción de armas por clase (categoría nueva `VARA`);
  restricción de armadura por peso (ligero/medio/pesado, campo nuevo en `ItemCatalog`).
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
- [ ] `WorldState.agenda` — eventos de mundo que avanzan solos con el tiempo.
- [ ] Sin triar aún construir/quitar: `comerciablePct`/`reclutablePct`/`cortejablePct` (nota:
  `domesticablePct` ya tiene destino claro, es la pieza central del tameo de arriba), `Npc.levelMax`,
  `percepcionPasivaFor`, `Territory.control`, `Building.status`, `KingdomStats.felicidad`.

### Encontrado en esta revisión (2026-08-24), repasando todos los .md activos

- [ ] **Magia de 7 escuelas — ¿atributos independientes o sabores narrativos de un único `arcano`/
  Magia?** (`07-mundo-helek-sirik.md`) — decisión técnica sin cerrar, directamente ligada al
  renombrado Arcano→Magia ya documentado en `clases.md`.
- [ ] **Sistema de estaciones por mes/región** (`ampliar-lore-checklist.md`) — el motor ya tiene
  franjas día/noche pero ningún concepto de estación ni temperatura; hace falta decidir el diseño
  (calendario único vs. desfasado por región) antes de que tenga sentido cualquier condición "solo
  en invierno" (bloquea `boungo`, "crece en otoño").
- [ ] **Eventos de clima puntuales** (encontrado cerrando `HarvestYield.condicion`, 2026-08-24) —
  distinto de estaciones: `punado-arena-iman`/`esquirla-celeste-caida` solo deberían aparecer "tras
  una tormenta de arena magnética reciente", y no existe ningún concepto de evento climático
  puntual en el motor, solo franjas día/noche. Sin diseñar todavía.
- [ ] **"Trabajador de Reino"** — bloquea hoy a los 22 NPC del Campamento Serhu y al oficio de
  agricultura de Las Llanuras (pensado para aprenderse por misión, no por NPC-maestro). Mismo
  bloque de diseño que el Almacén de Reino/roles guardia-trabajador-productor de
  `companeros-y-supervivencia.md` — candidato fuerte a resolverse junto con ese sistema.
- [ ] **Quién enseña un oficio nuevo** (`09-panel-personaje.md`) — aplazado a propósito hasta que
  haya un caso concreto, baja prioridad.
- [ ] **Miel Lebude / futura profesión de cocina por raza-región** (`flora-fauna.md`) — idea suelta,
  apenas especificada, prioridad muy baja.

### Ajuste de números, no features nuevas (pero sin cerrar)

- [ ] Rebalanceo de coste de Campamento/Ayuntamiento — deferido a "mañana" el 23/08, sin retomar.
- [ ] 8 items completamente huérfanos + 65 de 79 RECURSO/MATERIAL sin receta que los use — decidir
  darles uso o retirarlos (`ampliar-lore-checklist.md § Pendiente de diseño`).

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
