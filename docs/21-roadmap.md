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
- [x] ~~**Combate múltiple**~~ (`docs/rpgtarkor/combate-multiple.md`) — iniciativa individual N-way,
  tope 4v4 con sub-combates deterministas, modo autónomo/reporte, retira el truco `groupSize`.
  Desbloquea `MULTIPLE`/`INVOCACION`/`COMPANERO`/`CONTROL`/`EXPULSAR` de arriba. Fases A-C
  construidas y commiteadas (`5e63c27`/`419d7af`/`82793ab`) — iniciativa/retargeting/partición puros,
  narración ligera por LLM, orquestación con estado real (`CombatEncounter`/`CombatParticipant`)
  probada aislada contra Postgres. `condicionFisicaGrupo` (`d92df45`) da a cada individuo real de un
  grupo cazado su propia condición sin tocar el modelo de escena compartido.
  `resolverIntercambioCompleto`/`resolverTurnoJugador` (`81e810c`) dan paridad completa de mecánicas
  (utilidades/doble arma/LETAL). **Disparo real APLICADO al juego en vivo 2026-08-25** (commit
  `f85d7e7`, Capa 4 de [mundo-determinista.md](rpgtarkor/mundo-determinista.md)): `cazar.ts` (caza en
  grupo) y `narrateAndPersistTurn` ya crean/resuelven un `CombatEncounter` real en vez del viejo
  `combateIniciado.npcSlugs`. **Saqueo/desuello: CERRADO el mismo día** (commit `64b6911`) —
  reutiliza el saqueo/desuello clásico tal cual (materializa `NpcState.groupSize`/`groupDefeated` +
  hecho de sesión al resolverse), sin migración ni rutas nuevas; de paso cazó un bug real
  (`avanzarYComprobarFin` comprobaba el fin del combate contra un snapshot de participantes
  desactualizado — un grupo entero derrotado en la misma transacción del golpe decisivo podía
  quedarse `EN_CURSO` para siempre). Huecos documentados a propósito: XP de la propia tirada de
  combate, objetivo individual entre miembros de un mismo grupo (mecánicamente intercambiables
  hoy), y sub-partición >4v4 sin probar en vivo todavía.
- [x] ~~**Mundo determinista: zonas, eventos y narración que solo narra**~~
  (`docs/rpgtarkor/mundo-determinista.md`, diseño 2026-08-25) — generaliza "el modelo nunca decide,
  solo narra" (ya probado en combate) a aparición de NPC/fauna, eventos de mundo y creación de
  misiones/objetos/compañeros/territorios. 4 capas en orden de dependencia: zonas navegables con
  posición real (fundación — no hay nada reutilizable hoy, ni siquiera el Mapa de Cristal Helado,
  que resultó ser solo píxeles hardcodeados en el frontend) → cola de eventos por tiempo/posición
  (extiende `worldTick.ts`) → determinismo de aparición en turno libre (rompe el ciclo real
  `newFacts`→`sessionFacts`→`npcsInScene` sin ningún control de población) → disparo real de
  Combate múltiple vía `iniciarCombatEncounter`. **Capa 1 (zonas navegables): prototipo construido
  el mismo día** (commit `098a3cf`) en La Hondonada del Eco — modelo `ZonePoint`, pipeline de imagen
  extendido (entityType `zona`/sizeProfile `mapa`), endpoint `GET /saves/:id/zona`, pestaña "Zona"
  en el frontend; solo en esa zona, posiciones provisionales sin PNG real todavía. **Capa 2 (cola de
  eventos): construida el mismo día** (commit `cf57dca`) — `pickStationaryInterruption` generaliza
  la interrupción de viaje ya existente (`travelInterruption.ts`, 2026-08-05) a descansar/construir/
  crafteo, reutilizando casi todo su mecanismo (mismo campo de `zoneContext`, misma inyección
  determinista de NPC en escena); solo dispara donde hay `ZonePoint` real (hoy solo Hondonada del
  Eco). **Capa 3 (aparición determinista) construida el mismo día** (commits `55a732d`/`85fa6fb`) —
  replanteada tras investigar: quitar `sessionFacts` del detector habría roto Desollar/sugerencias
  (dependen de él al 100%), así que se cerró con 2 piezas quirúrgicas en vez del rediseño completo
  original: persistir `NpcState` real al inyectar un NPC de interrupción (antes solo se leía, nunca
  se creaba) + guard `hasFalseNpcAppearance` (mismo patrón sentence-matching que
  `hasResurrectedDeadNpc`) contra que la narración "haga aparecer" a alguien no autorizado. **Capa 4
  (disparo real) construida 2026-08-25** (commit `f85d7e7`) — cirugía completa dentro de
  `narrateAndPersistTurn`, ver detalle y huecos documentados en la entrada de Combate múltiple arriba
  y en [mundo-determinista.md](rpgtarkor/mundo-determinista.md). Pendiente real fuera de esta pasada:
  generalizar la Capa 1 más allá de La Hondonada del Eco.
  **Los 5 hallazgos independientes: cerrados el mismo día** (commit `1902c29`, ver
  [mundo-determinista.md](rpgtarkor/mundo-determinista.md) para el detalle) — Log de Mundo conectado
  a los hechos reales de `worldAgenda.ts` (LogEntry de canal WORLD por etapa cruzada, cero coste de
  LLM); `newQuest` exige un anclaje real (NPC/Location/Item); `newItem` exige coincidir con
  `ItemCatalog` real (hereda equipSlot/tipo reales); `newCompanion` exige NPC real en escena +
  `effectiveTemperamento` AMIGABLE/INOFENSIVO; `newTerritory` ya no confía en la región que escriba
  el modelo (siempre la real de la Location actual); `newSubject` exige un Territory real.
- [x] ~~**Compañeros y supervivencia**~~ — backend completo APLICADO al motor 2026-08-25 (alcance
  íntegro, incluido Almacén de Reino, confirmado explícitamente: "todo, incluido Almacén de
  Reino"). `Companion`/`Subject` con Felicidad/Comida/Agua/plantilla reales; `NpcState.capturado`/
  `capturaFelicidad`/`capturaJaulaBuildingId` para el proceso de atar+tamear/persuadir;
  `Npc.atributoResistencia` calibrado a mano en los 27 NPC/fauna con domesticablePct/reclutablePct
  reales; `rollOpposed` nuevo en dice.ts; 3 recetas de Jaula; `AlmacenItem`/`PlantillaEquipo` +
  auto-equipo por prioridad; Hambre/Sed del personaje topada en CONVALECIENTE vía worldTick (la
  muerte real por inanición se deja fuera a propósito — exige el mismo pipeline de respawn/
  deathCount que hoy solo vive dentro de un turno real, no de un tick de fondo, no se improvisa un
  segundo camino a medio verificar). Migración aplicada y probada contra Postgres real, suite
  completa sin regresiones (destapó de paso una regresión real en el test de Ayuntamiento mediano).
  **Frontend, 2026-08-25 en tres pasadas — completo**: lo pasivo (Hambre/Sed, Felicidad/Comida/
  Agua), la UI activa de capturar/tamear-persuadir (`CapturaModal`/`TameoModal`), y por último
  equipo de compañero (`CompanionEquipModal`) + Almacén de Reino/Plantillas de equipo (ReinoPanel).
  Las 7 secciones del doc tienen backend Y frontend reales. **Conecta con "trabajador de Reino" de
  abajo** solo en la parte de roles/plantillas (ya construida y con UI) — los 22 NPC nuevos que ese
  punto necesita siguen siendo trabajo de contenido aparte, no mecánico.

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
- [x] ~~**Botones "Aceptar"/"Cancelar" cuando un NPC ofrece una misión**~~ — cerrado 2026-08-26,
  APLICADO al motor (commit `f5ccb8b`). `narration.newQuest` genérico ya no crea la `Quest` en el
  propio turno — solo la ofrece (`newQuestOfferInfo`); nuevo `POST /saves/:id/quests/aceptar`
  materializa de verdad, determinista, con anclaje resuelto contra todo el mundo (no contra
  `npcsInScene` del turno original). "Cancelar" solo limpia la tarjeta, sin backend. La misión
  determinista de Gistera Koh/Orco Enfurecido sigue exactamente igual, sin tocar.
- [x] ~~**NPCs que aparecen en escena por narración no se marcan en la pestaña "Zona"**~~ — cerrado
  2026-08-26, APLICADO al motor (commit `1ef1806`). `GET /saves/:id/zona` reutiliza
  `detectNpcsInScene` (mismo mecanismo que `npcsInScene` en cada turno) para devolver una lista
  `dinamicos` aparte de los `ZonePoint` fijos, deduplicada y sin MUERTO. Sin posición curada en el
  mapa (a diferencia de `ZonePoint`), listados bajo "Presentes ahora" en vez de como pin — honesto
  sobre qué dato existe de verdad. De paso, una ubicación sin `ZonePoint` sembrado (fuera del
  prototipo de Hondonada del Eco) ya puede marcarse "disponible" si tiene algún NPC dinámico.
- [x] ~~**CONVALECIENTE deja de significar "victoria automática" del combate**~~ — cerrado
  2026-08-26, APLICADO al motor (commits `1aa94f3`/`e608a2b`/`d26e80c`). Checklist desactualizado:
  quedó marcado `[ ]` pese a estar commiteado — corregido tras confirmar en el código real
  (`session.ts` § `dejar-vivir`, `companeros.ts` § `cuerdas`, working tree limpio, sin cambios sin
  commitear). **Jugado en vivo y confirmado bueno (2026-08-26)** — de paso, probando "Capturar" se
  encontró y cerró un bug real aparte: el botón se mostraba siempre aunque el NPC no tuviera
  `atributoResistencia` (no capturable), el backend rechazaba en silencio y el frontend tragaba el
  error sin avisar ("le doy al botón y no hace nada") — `capturable` añadido de punta a punta
  (`npcScene.ts`/`turnResolution.ts`/`detail.ts` → `types.ts`/`useCombatFlow.ts`/`LogPanel.tsx`), el
  botón ya no aparece si no aplica. Tests en verde (1343 backend + 92 frontend), `tsc -b` limpio en
  ambos.
  - Combate termina solo cuando todos los NPC están MUERTO o ya resueltos (Matar/Capturar/
    Clemente) — un CONVALECIENTE solo ya no cierra nada por sí mismo.
  - Sobre cada NPC CONVALECIENTE se ofrecen 3 opciones en una **tarjeta en el propio log de
    combate** (mismo patrón que la tarjeta Aceptar/Cancelar misión), no botones fijos en la ficha:
    **Matar**, **Capturar**, **Clemente** (nombre mejorado de "Perdonar"/"Dejarlo vivir").
  - Mientras haya una o más tarjetas sin resolver, el composer de combate se bloquea del todo
    (texto libre + botón Actuar deshabilitados) — no se puede seguir combatiendo hasta responder
    todas.
  - **Capturar**: nuevo ítem "cuerdas" (material consumible, 2 fibra, recetas para
    `carpintero-orcos-llanuras` y `constructor-orcos-llanuras`) sustituye a `trampa-de-lazo` como
    requisito del endpoint `POST /capturar/:npcSlug` — ahora sí se consume 1 unidad al atar con
    éxito (antes `trampa-de-lazo` era reutilizable). `trampa-de-lazo` queda sin uso por ahora.
  - **Clemente**: nuevo endpoint (ya construido y con 3 tests en verde,
    `POST /saves/:id/combat/dejar-vivir/:npcSlug`) saca al NPC de `pendingCombatNpcSlugs` sin
    tocar `condicionFisica` — sigue CONVALECIENTE de verdad, recupera solo con las horas.
  - **Saqueo/desuello**: se quita `CONVALECIENTE` de las dos listas de elegibilidad
    (`saquear-zona` en `panels.ts` y `carcassCandidatesFor` en `recolectar.ts`) — solo `MUERTO`
    (y `groupDefeated`, sin tocar) podrá saquearse/desollarse. Antes se podía saquear/desollar a
    alguien vivo, decisión consciente de cerrar ese hueco.
  - Fuera de esta pasada, aparcado para diseñar después (ver ítems siguientes): rematar más tarde
    a un CONVALECIENTE en un encuentro nuevo (hoy 4 puntos de `npcScene.ts`/`turnResolution.ts` lo
    bloquean a propósito), postura de compañero, y clemencia de enemigo.

- [ ] **Postura de compañero en combate (Agresivo/Defensivo/Capturador/Clemente)** — solo tiene
  sentido una vez exista combate autónomo de compañero sin la jugadora presente (hoy no existe:
  los compañeros solo luchan dentro de la propia sesión de combate de la jugadora vía
  `combateMultipleOrquestacion.ts`, nunca en solitario — sin patrullas/guarniciones/expediciones).
  Mientras tanto, si un compañero deja CONVALECIENTE a un rival dentro de tu propio combate, la
  tarjeta de decisión (ver ítem anterior) te la sigue mostrando a ti igual, da igual quién dio el
  golpe — ya cubierto sin nada nuevo. Cuando se diseñe el motor de combate en solitario del
  compañero: dos ejes independientes en vez de 4 presets fijos (gasto de energía
  agresivo/reservista × decisión Matar/Capturar/Clemente), "Capturador" reutiliza el mismo chequeo
  de cuerdas+jaula que el manual.
- [ ] **Clemencia de enemigo / duelos de honor** — hoy no existe ninguna IA que decida "rematar o
  no": el combate simplemente sigue la progresión normal golpe a golpe hasta que termina por el
  motivo que sea. Un enemigo que de verdad elige no rematar a la jugadora (duelo de honor) sería
  un sistema aparte, espejo del anterior — `Npc.temperamento`/`personality` como gancho natural.
  Aparcado, sin diseñar.
- [x] ~~**Botón de imagen (banner/miniatura/mapa) en el panel Zona**~~ — cerrado 2026-08-26,
  APLICADO al motor. Decisión: juego de imágenes PROPIO de Zona (banner+miniatura+mapa), no
  reutiliza el banner/miniatura fotorrealista que la ubicación ya tiene en la Enciclopedia —
  petición explícita: "uno genera banner, otro icono y otro una zona a modo de mapa dibujado...
  pintada y clara, no realista". El estilo cartográfico pintado a mano YA estaba bien construido
  en backend (`imagePromptGenerator.ts § ENTITY_TYPE_STYLE.zona`) desde el prototipo de zonas
  navegables, y `entityType:'zona'` nunca estuvo restringido a `sizeProfile:'mapa'` — solo faltaba
  exponerlo. `GET /saves/:id/zona` (zona.ts) ahora también devuelve `imageUrls`/`imagePrompts`
  (thumbnail/banner, más `imagePrompts.mapa`); `ZonaPanel.tsx` monta 3 `ImagePromptSlot` (mismo
  componente que la Enciclopedia). Hallazgo real: el frontend tenía sus propios
  `ImagePromptEntityType`/`ImagePromptSizeProfile` duplicados en `api.ts` sin `'zona'`/`'mapa'` —
  corregido, causa real de por qué nunca aparecía nada.
- [ ] **Seguimiento de imágenes de Zona (2026-08-26)** — dos cosas encontradas jugando en vivo con
  el resultado ya generado:
  1. **Corrección de sitio**: los 3 botones deben vivir SOLO en la ficha de Localización de la
     Enciclopedia (banner/miniatura ya estaban ahí; falta añadir "Mapa" reutilizando
     `entityType:'zona'`/`sizeProfile:'mapa'`, ya construido) — se retiran los 3 botones que se
     añadieron hoy en `ZonaPanel.tsx`. El panel Zona sigue leyendo/mostrando la imagen 'mapa' de
     fondo igual que ahora, solo sin botón propio ahí — genera lo que ya muestra, no duplica
     generador.
  2. **Calidad real del "mapa" generado**: la primera imagen de prueba (Hondonada del Eco) trae
     texto incrustado en la propia imagen — título y leyenda ("Redsun Hollow", "Cave Mouth/Camp/
     Fire Pit/Magnetic Sand Trail"), **en inglés**, pese a que el prompt YA pide explícitamente "no
     text or labels" (`imagePromptGenerator.ts § ENTITY_TYPE_STYLE.zona`) — probablemente la
     herramienta externa usada para generarla añade cartucho/leyenda por defecto sea cual sea el
     prompt (habitual en generadores de "mapa de fantasía"). Un texto/leyenda incrustado además
     **compite de verdad con los pines reales** que la app ya pinta encima (`ZonePoint`) — nunca
     van a coincidir. Reforzar el prompt (prohibición más explícita/insistente de cualquier
     texto/título/leyenda/cartucho/brújula/escala) y probar de nuevo antes de dar la Fase 1 de
     imágenes por buena de verdad.
  **Pendiente de hablar con calma, sin tocar nada todavía**: qué imagen sirve para qué en cada tipo
  de entidad (NPC/ítem/ubicación/zona/facción/...) — hoy "banner" y "miniatura" significan cosas
  algo distintas según dónde se usen (tarjeta de Enciclopedia vs ficha de detalle vs fondo de un
  panel de juego), y no hay un criterio único escrito de "esta imagen es para esto, aparece aquí,
  así". Repasarlo por tipo de entidad antes de seguir añadiendo más generadores sueltos.
- [ ] **Habilidades de arma: bonus de atributo al ejecutarlas** (petición explícita, 2026-08-26).
  `dynamicCombatAbilitiesFor` (dynamicAbilities.ts) ya da `effects: ['ATAQUE']` a TODAS las
  habilidades de arma reales (línea `effects: [w.rol === 'defensa' ? 'AGUANTE' : 'ATAQUE']`) — ese
  punto ya estaba cerrado, no hace falta tocarlo. Lo que falta de verdad: ninguna lleva
  `attributeBonus` hoy (a diferencia de las habilidades de clase, que sí lo tienen desde
  clases.md) — hay que darle a cada habilidad de arma (`weaponAbilitiesFor`, weaponAbilities.ts)
  un +2 fijo del atributo en el que está basada (`WeaponAbility.attribute`) al ejecutarla. Decisión
  ya cerrada: "Ataque Básico" (`tier: 'basica'`, genérica) se queda SIN bonus, va con el stat base
  tal cual — el +2 es solo para las reales/avanzadas por categoría de arma (Tajo Horizontal, Golpe
  Devastador, Ráfaga de Cortes, etc., `tier: 'real'`/`'avanzada'`).
- [x] ~~**Fase 1 — CONTRA/REFRACTAR/CONTROL/COMPANERO**~~ — cerrado 2026-08-26, APLICADO al motor
  (commit `889b7e3`). `LETAL` en realidad ya estaba implementado pese a estar marcado `PENDIENTE`
  en el schema (corregido). CONTRA/REFRACTAR: contragolpe en el margen decisivo ya existente
  (±10, no un umbral propio por habilidad — mismo criterio de simplificación que ya usaba LETAL),
  gateado por el atributo Arcano como proxy de físico/mágico. CONTROL en 1vs1: se simplifica a
  robar la iniciativa (mismo mecanismo que ATURDIMIENTO), sin los "2 turnos" reales — no hay
  combate multi-objetivo al que redirigir "controla al rival para que ataque a sus aliados".
  COMPANERO: pasiva, reutiliza `esSlotDomador` (companeros.ts), ya construido de antes — esta
  pasada solo la hace visible como habilidad real. 3 habilidades reales sembradas cuyo efecto no
  dependía de duración/multi-objetivo: Vórtice Menor (Chamán/Convocador 32), Opresión Mental
  (Chamán/Opresor 16), Compañero cazador (Cazador/Domador 12) — 139 huecos reales en total ahora.
  3 tests de integración nuevos contra Postgres real. **Hallazgo real**: `MULTIPLE`/`DESVIAR` NO
  se pudieron sembrar del todo pese a estar "sin infraestructura nueva" en el plan original — cada
  fila real de `clases.md` que los usa depende de verdad de un segundo objetivo real (combate
  multi-objetivo), así que quedan con la mecánica de fallback construida pero sin ninguna
  habilidad real enganchada todavía (ver Fase 3 más abajo). `REFLEJAR`/`PROVOCACION` también se
  reclasificaron a Fase 2 (si necesitan duración de verdad, contra lo que decía el plan original).
- [ ] **Fase 2 — necesitan duración por turnos primero** (infraestructura compartida, construir
  una vez): `AUMENTO`, `DEBILIDAD`, `CANALIZAR` (turnos variables según nivel de la habilidad;
  cualquier golpe recibido mientras se canaliza cancela el efecto antes de completarse — pensado
  para gestión de agro en grupo), `CURAZION`, `REFLEJAR` (su única habilidad real, "Espejo
  Maldito", devuelve un efecto negativo que a su vez necesita durar — no es tan simple como
  parecía en el plan original), `PROVOCACION` ("obliga a atacarte 2 turnos" — también reclasificado
  desde el plan original, que lo daba por listo sin serlo), `PURIFICAR` (elimina efectos
  negativos, depende de que exista duración para tener qué purificar).
- [ ] **Fase 3 — combate multi-objetivo de verdad** (no solo el fallback de 1vs1, ya construido en
  la Fase 1): `MULTIPLE`/`DESVIAR`/`CONTROL` con segundo objetivo real requieren tocar el motor
  `CombatEncounter` (`combateMultiple.ts`/`combateMultipleOrquestacion.ts`), que hoy tampoco tiene
  ese enganche construido en el punto exacto donde se resuelve un golpe — más trabajo del que
  parecía. `INVOCACION` (el tótem actúa según el efecto combinado: `INVOCACION`+`ATAQUE` = ataca
  cada turno sin defenderse; `INVOCACION`+`AGUANTE` = defiende sin atacar) y `OCULTACION` también
  viven aquí. `EXPULSAR` además toca fuera de combate: no es solo un contador de turnos — una
  tirada a los 2 turnos decide si vuelve dentro del combate (y se va de la zona), otra tirada
  aparte decide si no vuelve a aparecer nunca al terminar el combate; si vuelve, solo reaparece en
  su posición de la zona cuando la jugadora viaja fuera y regresa — toca `npcScene.ts`/presencia
  en zona, no solo `turnResolution.ts`.
  **Diseño de objetivo individual real, cerrado con la usuaria** (2026-08-26, jugando en vivo
  contra 2 cuervos — "no puedo elegir objetivo... cuando ataco debería ser yo vs mi objetivo y el
  otro enemigo tiene ataque gratis"). Sistema de "enganche" por ronda, no solo "ataca a quien
  elijas":
  1. Todos (jugador, compañeros si aplican, todos los enemigos) tiran iniciativa cada ronda.
  2. En ese orden, quien TODAVÍA no sea objetivo de nadie elige a quién atacar.
  3. En cuanto alguien es elegido como objetivo, su propia elección (si ya la había hecho) se
     cancela — cuando le toque actuar, su turno pasa a ser defenderse de quien lo eligió, un duelo
     real entre los dos. Dentro de esa pareja, quien tenga más iniciativa golpea primero — da igual
     quién "eligió" a quién (un enemigo con menos iniciativa puede enganchar a alguien con más, que
     aun así golpea primero dentro de ese duelo).
  4. Quien NO acaba en un duelo mutuo — porque a nadie le tocó elegirlo y él tampoco pudo enganchar
     a nadie (su objetivo ya estaba ocupado en otro duelo), o porque es el que sobra en un grupo
     impar — mete un golpe gratis, sin oposición real, contra quien quiera. Misma regla exacta que
     "el otro enemigo tiene ataque gratis porque no es mi objetivo": no es un caso aparte, es la
     consecuencia general de no estar en un duelo. `AGUANTE`+`MULTIPLE` es la única forma de
     defenderse de verdad de un golpe gratis de este tipo.
  Sin cerrar del todo, decidir cuando toque implementarlo (no bloquean el diseño de arriba): si se
  puede enganchar a alguien que YA resolvió su turno esa misma ronda, o si los compañeros siguen
  esta misma lógica de elección automática o esperan a su propia postura de combate (aparcada
  aparte). Cierra el mismo hueco que ya tenía anotado el roadmap ("Combate múltiple — huecos: XP de
  tirada, objetivo individual").
- [ ] **Fase 4 — esperan que la usuaria rellene cifras a su ritmo**, quedan `⚠️ bloqueada` en
  `clases.md` mientras tanto (no frena el resto): `RETIRAR` (ninguna de sus 2 filas tiene cifra) y
  las filas sueltas de `AUMENTO`/`DEBILIDAD`/`CURAZION` sin número (sobre todo Segador/Asesino).
  Parte del trabajo de cada efecto también es desbloquear esas filas en `clases.md` y darlas de
  alta como `ClassAbilityUnlock` reales, no solo construir el motor.

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
  **Bug real cerrado 2026-08-25**: los 3 items nuevos (`category: 'viga'/'columna'/'cordaje'`)
  nunca se dieron de alta en `itemTaxonomy.ts` § `CATEGORY_VOCAB_BY_TIPO.MATERIAL` — `seed-catalog`
  llevaba roto desde esta misma pasada, sin haberse vuelto a correr hasta que se corrió de verdad
  el 2026-08-25 (Grupo 3 § Compañeros y supervivencia). Arreglado, catálogo sembrado limpio.
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

- **Bugs reales** ("profesiones tiran dado siempre" sin confirmar, Cruzavientos nunca narrado) —
  viven en sus propias memorias/`revisar-partida-hallazgos.md`, no compiten por prioridad con las
  features de arriba. `recolectar.ts`/`rollGathering` 500 — **cerrado 2026-08-25**: eran 4
  migraciones sin aplicar contra Postgres real, no un bug de código; de paso, correr los 3 archivos
  de integración contra DB real por primera vez destapó una regresión de test genuina en "Ayuntamiento
  mediano" (fixture sin `ProfessionProgress`, invisible en el sandbox sin DB) — arreglada.
- **Huecos de lore puro** (Riko sin desarrollar, Kael Dorn↔Ithren sin cerrar del todo, Kalisar sin
  NPC propio) — trabajo de escritura, no de código; ya trackeados en
  `ampliar-lore-checklist.md § Pendiente de diseño`.
- **Modo Multijugador** (`02-decisiones.md`, 12 preguntas P0-P3) — explícitamente pausado hasta que
  el modo en solitario esté maduro, ni siquiera diseñado todavía.
- **Benchmark de latencia real** (`06-decisiones-mecanicas.md` punto 5) — medición de rendimiento
  pendiente, no una feature.
- **Hallazgo real 2026-08-26, sin investigar a fondo**: `turn.integration.test.ts` (26/91) y
  `recolectar.integration.test.ts` (2/2, el describe de cooldown) fallan contra Postgres real,
  reproducible incluso en el ÚLTIMO COMMIT antes de esta sesión (confirmado con `git stash` +
  reejecutar) — no es una regresión de nada tocado hoy. No investigado más a fondo (fuera de
  alcance de esta pasada); posible degradación del contenedor tras una sesión muy larga, o datos
  reales de partida que ya no encajan con lo que esos tests asumen. El resto de archivos de
  integración (companeros, session, zona, combate múltiple, creación) siguen en verde.
