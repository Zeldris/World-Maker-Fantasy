# Roadmap activo — Tarkor

**Sustituye como fuente de verdad a [archivo/11-roadmap-historico.md](archivo/11-roadmap-historico.md)**
(archivado 2026-08-13, ya puro historial de 2026-07-16→2026-08-13) desde 2026-08-24. Este documento
es el que se mantiene vivo de aquí en adelante — se actualiza según se cierren o aparezcan puntos,
mismo criterio que tenía el anterior.

---

## Estado a fecha 2026-09-03 (orientación rápida para retomar la sesión)

Sesión larga con tres bloques de trabajo: (1) ronda de juego real con Playwright hasta acumular
hallazgos, (2) cierre del backlog "mundo determinista, el narrador solo narra" (Piezas 5 y 6a-6d),
(3) auditoría completa de comentarios de código y memoria persistente para no dejar nada
desactualizado, con esta sección como consolidación final de lo que queda genuinamente pendiente.

**"Mundo determinista, el narrador solo narra" — CERRADO COMPLETO (Piezas 5 + 6a-6d)**, 5 commits:
- **Pieza 5** (`17f2ee2`): Gistera Koh (y cualquier NPC) dejaba de desaparecer de la escena tras
  despedirse explícitamente y viajar — `filterFarewellFacts`/`detectsFarewellIntent`
  (`npcScene.ts`) filtran hechos de despedida del haystack de `detectNpcsInScene`.
- **Pieza 6a/6b** (`908a18c`): crafteo/construcción por texto libre que menciona verbo+receta real
  pero no se puede lanzar (sin materiales/ubicación/oficio) ya no cae al narrador libre a inventar
  un objeto/edificio fabricado nunca persistido — mensaje determinista fijo
  (`deterministicActionUnavailableNarrationFor`).
- **Pieza 6c** (`219ef88`): viaje declarado hacia un destino que no existe en el mundo, mismo
  criterio — `detectsUnknownDestinationClaim`, con exclusiones cuidadosas (movimiento vago,
  dirección cardinal suelta — decisión explícita: las cardinales son para moverse dentro de
  zona/interior, no entre ubicaciones del mapa —, intención de ataque/búsqueda hostil).
- **Pieza 6d** (`9bdb1b7`): la más grande — "Mino Yerreo" por texto libre NO caía al narrador
  libre, se RESOLVÍA de verdad pero por una vía paralela y más fácil que el modal oficial
  (`recolectar.ts`): tirada genérica del LLM sin tier/oficio/herramienta, sin depletar
  `WorldPopulation`. Cortada esa vía para MINERIA/TALA/EXTRACCION/PESCA/BUSQUEDA (CAZA intacta) con
  mensaje determinista + botón real en el log (`entry.harvestSuggestion`, `OfferCard`) que abre el
  modal correcto con la fuente citada priorizada arriba de la lista.

Backend 114 archivos/2014 tests en verde, frontend 26 archivos/190 tests en verde, `tsc -b` limpio
en ambos. **Necesita reinicio manual de backend y frontend** para reflejarse en la partida real (la
usuaria gestiona sus propios servidores).

**Auditoría de comentarios de código y memoria desactualizada (2026-09-03)** — a petición explícita
("haz una auditoría para no dejar comentarios sin actualizar, ni .md"), 2 agentes en paralelo
peinaron ~200 archivos de memoria y los servicios/rutas más grandes del backend. Resultado:
- **3 comentarios de código corregidos** (afirmaban "sin construir todavía" algo que ya estaba
  hecho más abajo en el mismo archivo o en otro módulo): `construction.ts` (materiales procesados
  de Ayuntamiento mediano/grande, ya construidos el mismo día que se anotó el comentario viejo),
  `turnResolution.ts` (CONTROL real con redirección SÍ está construido, solo no en el camino 1v1
  independiente), `classAbilities.ts` (aclarada la redacción ambigua "Domador 0/8" — se refiere a
  la especialización DOMADOR con sus 8 niveles propios, no al tronco común de Cazador, que sí tiene
  un hueco real).
- **6 archivos de memoria desactualizados corregidos** (declaraban "pendiente/sin arreglar" algo ya
  cerrado, algunos el mismo día en que se anotaron): defensa-a-ciegas-tras-recarga e
  iniciativa-ausente (ambos cerrados, quedaron enterrados sin memoria dedicada o con resumen de
  índice desactualizado), energía Defenderse/Esquivar (cerrada el mismo día, commit `c5297cc`),
  misión Orco Enfurecido saltándose botones (cerrada el mismo día), sub-partición de combate >4v4
  (cerrada horas después el mismo día en que se reabrió, commit `8535c85`, con test de integración
  real — quedó enterrada dentro de un commit de título ajeno "Renombra el atributo Arcano a Magia").
  `docs/checklist-pruebas-juego.md` y `docs/revisar-partida-hallazgos.md` también actualizados en
  los mismos puntos.

### Genuinamente pendiente a día de hoy (verificado DOS veces — auditoría inicial + reverificación
contra código real con 3 agentes en paralelo, tras encontrar que la primera pasada también tenía
errores: 6 de los 25 ítems del primer checklist ya estaban cerrados o llevaban matices importantes)

**Diseño con alcance ya definido, solo falta implementar** (3, no 4 — "Matar" se cayó de esta lista,
ver abajo):
- **Balance del primer combate (Orco Enfurecido/misión Gistera)** — tras 8 turnos de intercambio en
  un combate real, ni asegura victoria ni se siente "asequible" para un tutorial de facto de nivel
  1. Sin tocar desde 2026-08-28 (`git log -G` sobre el bloque del NPC solo muestra el rebalanceo
  original de 2026-07-29 y el rename cosmético Arcano→Magia). Ver `docs/checklist-pruebas-juego.md`
  punto 1.5.
- **`questSlug` estructurado en `Quest`** — `quests.ts:18 § ORCO_ENFURECIDO_QUEST_TITLE` sigue
  hardcodeado por título exacto, sin ningún campo `questSlug` en `schema.prisma` (decisión
  consciente, arreglarlo de raíz exige migración). Ver `tarkor_auditoria_6_agentes_2026-09-01`.
- **Sub-combates fragmentados (>4v4) con fallo de servidor a mitad** — confirmado con precisión:
  `cazar.ts:493-515` crea TODOS los `CombatEncounter` (incluidos los fragmentos autónomos) dentro de
  una única transacción, pero `resolverTurnosAutonomosHastaJugadora` (línea 525-529) los resuelve
  DESPUÉS, fuera de esa transacción — si el proceso muere entre medias, esos `CombatEncounter`
  quedan huérfanos para siempre. Las únicas 2 consultas que leen por `estado: 'EN_CURSO'`
  (`detail.ts:118`, `turnResolution.ts:2614`) filtran `jugable: true` a propósito, ignorando los
  fragmentos. Ningún worker/cron los recupera. Requiere interrumpir el backend a propósito para
  reproducirlo en vivo, nunca autorizado. Decidir si merece forzarlo o construir la recuperación a
  ciegas.

**CERRADO, se cae de la lista de pendientes** (verificación 2026-09-03, tarde — este checklist
había heredado el error de una memoria desactualizada): **Rediseño "Matar"** — el remate
determinista SIN tirada ya no existe. Confirmado en `turnResolution.ts:2313-2319` (comentario
explícito citando el rediseño 2026-08-30) y `postCombatInteraction.ts:9-11` — Matar sobre
CONVALECIENTE ya fuerza un intercambio real con riesgo (malus de condición), desde el mismo día en
que se diseñó. `tarkor_rediseno_matar_combate_real_2026-08-30` corregida.

**Bugs/huecos menores, verificados uno a uno (2026-09-03) — 4 de los 7 originales ya estaban
cerrados**:
- ❌ **Sigue pendiente**: "Cargando partida..." infinito al crear partida nueva. Causa raíz
  encontrada: `createNewSave()` (`GameView.tsx:1144`) retorna en silencio si
  `selectedWorld`/`selectedCharacter` (estado en memoria, `SessionContext.tsx`, sin persistencia)
  están vacíos — pasa si se recarga o se navega directo sin pasar por la selección en esa pestaña.
  Sin guard de ruta que redirija.
- ✅ **CERRADO** (commit `899003b`, 2026-08-30): misión mostraba "Interactuar" en vez de
  Aceptar/Cancelar — `turnResolution.ts:6386-6387` ya tiene exclusión mutua explícita entre
  `dynamicModeOffer` y `newQuestOfferInfo`.
- ✅ **CERRADO** (commit `899003b`): tooltip del toggle de la barra de habilidades cortado —
  `TooltipAnchor.tsx` ya usa `createPortal` + alineación dinámica según espacio de viewport.
- ✅ **CERRADO** (commit `899003b`): descripciones de habilidad en la Ficha del Rival sin desglose
  mecánico — `CombatPanel.tsx:278-329` ya muestra `attributeBonus`/chips de `effects`/atributo
  preferido, no solo el texto de lore.
- ❌ **Sigue pendiente, sin evidencia de bug real**: Kirelon Arenoso "sobrerrepresentado" —
  verificado el peso de selección real (`pickAmbientEncounterCandidate`, weighted-random correcto
  sobre `WorldPopulation`): Kirelon tiene población **150**, muy por debajo del resto de fauna de
  su región (corretolvas 4500, ruptidar 5000...) — sin sesgo estructural encontrado en código.
  Podría ser percepción de sesión, no bug — dejar anotado pero de baja prioridad.
- ❌ **Sigue pendiente, matiz importante**: auto-contradicción de Gistera en `generateNpcReply` — el
  commit `7c19db4` (2026-09-03, HOY) cerró un caso DISTINTO (fuga de meta-pregunta de asistente,
  `hasMetaInstructionLeak`). El caso original de esta memoria (negación de conocimiento del Clan
  Serhu autocontradiciéndose) sigue sin guard — `tarkor_bug_autocontradiccion_gistera_generatenpcreply_2026-09-03`
  corregida para no confundir ambos casos.
- ⚠️ **No verificable en este entorno**: flake `ANALIZAR RIVAL` — sin Node/vitest disponible para
  reproducirlo, y sin rastro en `git log` de que se haya diagnosticado o cerrado nunca. El análisis
  estático del test no muestra el patrón de condición de carrera descrito (narración mockeada
  síncrona, orden de turno fijado, scopes únicos) — puede que ya no sea reproducible, o que el
  patrón viva en otro punto no identificado. Reproducir en vivo si vuelve a aparecer.
- Nombre de NPC "pegado" gramaticalmente como aposición de un lugar en la narración (sin verificar
  en esta ronda — muestra de 1 turno, `docs/checklist-pruebas-juego.md` § 1).

**Aparcado a propósito por decisión de diseño (no bugs, no urgente)** — verificado, 12/14 exactos,
2 con matiz menor encontrado:
- `comerciablePct`/`cortejablePct` — matiz: SÍ se usan ya para avisos narrativos de umbral
  (`npcScene.ts:976,979`), pero ninguna tirada real de éxito/fracaso los consume todavía. La
  usuaria confirmó que se quedan, pendientes de diseño propio de la tirada.
- `Npc.levelMax` — **matiz: YA tiene un consumidor real** (`cazar.ts:457`, gatea si una presa
  agresiva es cazable según el nivel del jugador) — solo `percepcionPasivaFor` sigue huérfana, sin
  ningún caller real.
- Postura de compañero en combate (Agresivo/Defensivo/Capturador/Clemente) — confirmado sin campo
  ni lógica real, espera a que exista combate autónomo de compañero sin la jugadora presente.
- Clemencia de enemigo / duelos de honor — el concepto de "duelo de honor" SÍ existe como LORE
  orco (`berigLore.ts`), pero sin ninguna IA de combate conectada. Sistema espejo del anterior, sin
  diseñar.
- Fase 4 de clases (`RETIRAR`, filas de `AUMENTO`/`DEBILIDAD`/`CURAZION` sin cifra) — confirmado sin
  ninguna habilidad real que use `RETIRAR` todavía. Espera a que la usuaria rellene números en
  `clases.md` a su ritmo.
- Báculo tier 7/dagas tier 3/Arco tier 5/Armadura tier 5/receta de Lanza/`vela-cera-lebude` —
  confirmados los 6 con comentario explícito "PENDIENTE DE IMPLEMENTAR" en `worldCatalog.ts`, sin
  receta de crafteo real para ninguno.
- `saquito-arena-iman` — matiz: **el crafteo YA está implementado** (`SAND_POUCH_RECIPE`,
  `crafting.ts`, confirmado el comentario propio del código lo dice) — lo que sigue faltando es
  solo el `effectKey` protector y la lógica de pérdida en Las Agujas Imán.
- `silbato-hueso-caza`/profesión "ganadería" — confirmados aparcados, sin ningún archivo real de esa
  profesión.
- Modal propio al pulsar un pin de `ZonaPanel.tsx` — confirmado, hoy solo `<title>` (tooltip
  nativo), sin `onClick` ni modal.
- `Save.saveName` para nombrar partidas guardadas — confirmado, el campo no existe en
  `schema.prisma` ni en ningún sitio del repo.
- `BERIG_PERSONAJES` (Dessa/Yerin/Riko) sin convertir a NPC de `worldCatalog.ts` — confirmado, solo
  mencionados en bios de otros NPCs, sin entrada propia de catálogo.
- `ZonePoint` sin sembrar fuera de Las Llanuras del Viento Rojo — confirmado con el propio
  comentario del código ("la única zona con ZonePoint sembrado hoy").
- PNG real de banners de clase/especialización — confirmado, solo se genera el texto del prompt,
  sin proveedor de imagen conectado para esta categoría.
- Modo Multijugador — confirmado, `/multijugador` enruta a un placeholder `<ComingSoon />`, sin
  ningún código de backend relacionado.
- Modal propio al pulsar un pin de `ZonaPanel.tsx` (hoy solo `<title>`, sin `onClick`) —
  `tarkor_idea_modal_zonepoint_2026-09-02`, solo idea anotada.
- `Save.saveName` para nombrar partidas guardadas — campo no existe en `schema.prisma`, solo idea.
- `BERIG_PERSONAJES` (Dessa/Yerin/Riko) sin convertir a NPC de `worldCatalog.ts` — decisión de
  alcance pre-alpha ya tomada, sin implementar (`tarkor_decision_alcance_prealpha_y_personajes_2026-09-01`).
- Sembrado de `ZonePoint` fuera de Las Llanuras del Viento Rojo, y punto del jugador en el mapa —
  Cristal Helado será la siguiente región a poblar (decisión ya comunicada por la usuaria).
- PNG real de banners de clase/especialización — solo el texto del prompt se genera, sin proveedor
  de imagen conectado todavía.
- Miel Lebude / futura profesión de cocina por raza-región — idea suelta, prioridad muy baja.
- Modo Multijugador — pausado hasta que el modo en solitario esté maduro.
- Benchmark de latencia real — medición pendiente, no una feature.

---

## Estado a fecha 2026-08-27 (orientación rápida para retomar la sesión)

Este documento crece añadiendo secciones nuevas al final de cada bloque cerrado — para no tener que
leerlo entero, esto es lo que pasó en la sesión más reciente (2026-08-27/26), de más a menos
reciente:

- **Dinamismo del mundo — las 5 piezas APLICADAS (2026-08-27)**: la
  usuaria planteó una preocupación de fondo tras cerrar Fase 3 — "el 99% del juego depende de que yo
  actúe, el juego está parado si no hago nada". Investigación confirmó que hoy NADA pasa sin acción
  del jugador (`fictionalMinutes` solo avanza dentro de un turno; `worldTick.ts` cada 2 min reales
  da la ILUSIÓN de background real pero lee ese mismo contador congelado). Auditoría completa de
  narración (2 agentes en paralelo) confirmó 4 huecos de contexto reales: clima/estación nunca
  llegan al narrador, inventario del jugador nunca se pasa como contexto (causa raíz más repetida de
  toda la familia de guards `hasFalse*`), hora sin traducir a sensación ambiental, y `ZonePoint`
  totalmente desconectado del narrador. **Piezas 1 (clima/estación) y 2 (inventario) — APLICADAS**:
  `entornoTemporalFor` (ya existía) conectado a `characterSummaryFor`; nueva `inventorySummaryFor`
  (`ingredients.ts`) conectada a `contextBlocks` (`turnResolution.ts`). **Pieza 3 (`ZonePoint` como
  instancia viva) — APLICADA**: `ZonePoint` gana `cantidad`/`activo`/`factionSlug`/
  `lastUpdatedAtMinutes` (migración `20260827170000_zonepoint_instancia_viva`, además `EDIFICIO`
  nuevo en `ZonePointTipo`). Nuevo servicio `zonePoints.ts`: `proximaCantidadPara` (puro, ajuste
  proporcional al tiempo de ficción transcurrido, tope `AJUSTE_MAXIMO_POR_DIA=3`/día, recorte a
  `CANTIDAD_MAX_POR_PUNTO=20`), `recalcularZonePointsDeLocation` (lee `WorldPopulation` real por
  región vía `distribucion`, solo FAUNA/RECURSO — NPC/EDIFICIO fuera del recalculo a propósito) y
  `zonePointsSummaryFor` (nuevo bloque de contexto para el narrador). Enganchado en
  `narrateAndPersistTurn` (`turnResolution.ts`, mismo punto que Pieza 2) usando `regionLocationId`/
  `regionLocation.region` — el criterio YA establecido en el archivo para "dónde está el jugador
  ahora" (contempla viaje en curso). `GET /saves/:id/zona` ahora filtra por `activo` y expone
  `cantidad`/`color` (`zonePointColorFor`, banda de reputación 0-5000 de `reputation.ts` recortada a
  3 colores + `SIN_FACCION`). Frontend `ZonaPanel.tsx`: 4 formas SVG (círculo/triángulo/cuadrado/
  rombo) + color por reputación + contador "×N" sobre el pin. 14 tests nuevos (9 unitarios puros +
  5 de integración real contra Postgres), suite 1585/1585, `tsc -b` limpio backend+frontend.
  **Pieza 5 (control regional) — APLICADA**: nueva `regionControlFor` (`worldAgenda.ts`, puro, sin
  Prisma) deriva neutra/en-disputa/conquistada de la etapa real de `conflicto-serhu-concordia-vs-
  helsig-goshg` para Cristal Helado/Ciénaga Troncal (`stage` 0-1 dueño original, 2-3 en disputa, 4
  conquistada) — Las Llanuras del Viento Rojo (región del propio agresor) siempre dueño original,
  excepción explícita; Meseta del Orden (sin conflicto sembrado) fija con su dueño de
  `REGION_OWNING_FACTIONS` (ahora exportada desde `reputation.ts`). Sin migración de schema — se
  deriva en caliente de `WorldState.agenda` ya persistida. Expuesto en `GET /saves/:id/zona` como
  `regionControl`; frontend `ZonaPanel.tsx` con placeholder de texto ("Territorio de X"/"En disputa:
  X vs Y"), logo real pendiente de generación de imagen en otra pasada. 9 tests unitarios nuevos.
  **Pieza 4 ("modo dinámico") — APLICADA, la más grande con diferencia** (estado de conversación
  multi-turno, nunca antes construido en el motor): `Save.pendingDynamicMode Json?` (migración
  `20260827180000_save_pending_dynamic_mode`) guarda `{tipo, targetSlug, targetName, vuelta,
  iniciadoAtMinutes}` mientras dura la interacción. Motor determinista nuevo `dynamicMode.ts`:
  `decideOfertaModoDinamico` (puro, `random` inyectable — probabilidad `PROBABILIDAD_OFERTA=0.35`
  por turno con candidato disponible, mismo criterio que el resto de cifras de partida del
  proyecto) elige entre `ZonePoint` NPC/FAUNA activos ya recalculados por la Pieza 3 —
  RECURSO/EDIFICIO quedan fuera (no inician nada por sí mismos). Decidido en
  `narrateAndPersistTurn` DESPUÉS de conocer `combateIniciado` (nunca se ofrece si el turno terminó
  en combate) y solo si `pendingDynamicMode` está vacío — expuesto como `dynamicModeOffer` en el
  `done` de `/turn/narrate`, mismo molde que `newQuestOfferInfo`. Narración de cada vuelta
  deliberadamente separada del pipeline principal (`dynamicModeNarracion.ts`, mismo criterio de
  "primer corte" que `combateMultipleNarracion.ts`): prompt acotado, LLM devuelve narración +
  2-3 opciones deterministas (nunca texto libre dentro del modo) + `cierra`, con fallback
  determinista si Ollama falla 2 veces. 3 endpoints dedicados nuevos (`saves/dynamicMode.ts`,
  mismo molde que `quests/aceptar`): `POST /saves/:id/modo-dinamico/interactuar` (primera vuelta),
  `/responder` (vueltas siguientes), `/ignorar` (descarta la oferta sin tocar BD). Avance de
  `MINUTOS_POR_VUELTA_MODO_DINAMICO=2` minutos por vuelta (decisión explícita de la usuaria: "debe
  sentirse fluido"), tope `MAX_VUELTAS_MODO_DINAMICO=4`. Frontend: tarjeta inline en `LogPanel.tsx`
  (`entry.dynamicModeOffer`, mismo patrón visual que la oferta de misión) + nuevo
  `DynamicModeModal.tsx` para las vueltas (mismo molde que `PostCombatInteractionModal.tsx`).
  **Bug real cazado por el propio test end-to-end nuevo** (no en el código de producción): un
  fixture de prueba creaba un `ZonePoint` con `cantidad: 5` pero sin fila `WorldPopulation` real —
  la Pieza 3 lo recalculaba a 0 en el mismo turno (comportamiento correcto), así que la oferta
  nunca aparecía hasta añadir la población real al fixture — confirma que Piezas 3 y 4 interactúan
  como estaba diseñado. 8 tests nuevos (5 unitarios de `decideOfertaModoDinamico` + 6 de integración
  de los 3 endpoints + 3 de integración end-to-end del enganche en `/turn/narrate`, con probabilidad
  real no forzada). Diseño completo en `/home/deck/.claude/plans/spicy-questing-brook.md`. Suite
  completa backend: 1610/1610, `tsc -b` limpio backend+frontend. **Pendiente: jugarlo en vivo** (no
  probado en el navegador esta sesión).
- **Identificador de combatientes duplicados — APLICADO 2026-08-27** (bug real jugando: "ataqué a
  los dos buitres a la vez"): `CombatParticipant.id` real expuesto al frontend como
  `participantId`/`instanceNumber` ("#1"/"#2", solo cuando hace falta desambiguar) —
  `turnResolution.ts` § `combateIniciado`, `saves/detail.ts` § recarga de partida (antes
  reconstruía solo por `pendingCombatNpcSlugs`, sin saber del `CombatEncounter` real), y todo
  `useCombatFlow.ts`/`CombatPanel.tsx` (bug de fondo: un `Map` por `slug` colapsaba dos buitres
  iguales al mismo estado local). Nueva `resolverObjetivoPorTexto` (combateMultiple.ts) acepta
  "Buitre #2" en el texto citado, extraída de `turnResolution.ts` tras un test de integración
  end-to-end flaky real (~1/5 corridas) — el turno completo atraviesa DOS sistemas de detección de
  objetivo en paralelo (el `CombatEncounter` nuevo y el `npcsInScene` viejo, que nunca reconoce
  "#N") y competían de forma no controlable desde el test; solución real: extraer a función pura y
  probarla con un test unitario 100% determinista en vez de arrastrar el turno HTTP entero.
  **Hueco arquitectónico real descubierto y documentado, sin tocar**: Capturar/Clemente (y el
  propio modal de saqueo) actúan sobre `NpcState` por especie, nunca por individuo de grupo — la
  "materialización" del `CombatEncounter` al terminar ya pierde la distinción CONVALECIENTE/MUERTO
  antes de que esas rutas puedan actuar (`groupDefeated` suma ambos sin diferenciarlos). Arreglarlo
  de verdad exige rediseñar esa materialización, no solo cablear 2 rutas — aparcado como pieza
  propia. **"Analizar Rival" real en combate múltiple — APLICADO misma sesión**: el resultado
  (`analizarRivalExito`) se calculaba y se descartaba, a diferencia del motor 1v1 (que sí lo
  persiste en `NpcState.analizado`) — el NIVEL del rival ya se veía gratis gracias al fix de arriba,
  solo faltaba desbloquear la pestaña "Análisis" (stats/atributo recomendado). Nueva columna
  `CombatParticipant.analizadoGrupo` (mismo patrón que `condicionFisicaGrupo`): analizar a UN
  individuo de un grupo cazado nunca desbloquea la ficha del resto del grupo — decisión explícita de
  construir el soporte de grupo YA (sin fila real de `clases.md` que combine ANALISIS+MULTIPLE hoy,
  pero la usuaria lo pidió como puerta de entrada futura). Límite ya existente sin tocar: solo el
  atacante puede disparar el análisis, nunca el defensor (sin rama simétrica en el código base).
  Suite backend 1564/1564, frontend 93/93, `tsc -b` limpio en ambos.
- **Fase 3 completa (§ 3a-3e) de combate multi-objetivo — CERRADA Y APLICADA (2026-08-27)**: 3a cierra
  el hueco real que dejó Fase 2 (el motor multi no leía `activeEffects`) + hace CONTROL redirigir de
  verdad; 3b hace que MULTIPLE golpee a un objetivo extra real (Punta Doble/Golpe Gemelo); 3c añade
  DESVIAR (redirige el golpe a un tercero) y OCULTACION (excluido de ser elegido como objetivo,
  salvo ser el único vivo del bando — Comunión Salvaje/Camuflaje), con un bug real cazado en
  integración (un oculto sin alternativa podía quedarse "oculto" para siempre pese a combatir,
  corregido); 3d añade INVOCACION real (tótems, `CombatParticipantTipo.INVOCACION` nuevo) — Tótem de
  Guerra (Chamán/Convocador 12) invoca un tercer participante que aguanta 1 golpe, ataca 2 rondas
  fuera de `ordenIniciativa` y desaparece, con ficha `Npc` de catálogo propia (reconocible en la
  Enciclopedia, se descubre sola por mención en narración, igual que fauna) — bug real de orden
  cazado en integración (el tótem expiraba por rondas-agotadas ANTES de que le tocara atacar su
  último turno, corregido: expira DESPUÉS de golpear); 3e añade EXPULSAR real (Embate de Escudo,
  Guerrero/Guardián 28) — margen decisivo expulsa 2 rondas, mismo mecanismo de exclusión que
  OCULTACION (columna separada, `expulsadoPorRondas`), simplificado a un único desenlace sin el
  tramo "no vuelve nunca" de la ficha real (decisión explícita de la usuaria) — cierra las 5 piezas
  en que se dividió Fase 3, con la usuaria delegando el orden desde el principio ("vamos con todo,
  en el orden que prefieras, a tu elección"). Ver detalle completo en "Fase 3" más abajo.
- **Cierre de las 2 auditorías (backend↔frontend + diseño/UX) — 12/13 hallazgos APLICADOS
  (2026-08-27)**: "todo, de arriba a abajo" — indicador de `activeEffects` en combate (chip +
  tooltip), badge de estación/clima (Mapa + header), enlace Reputación↔Facciones, flash de cambio
  en Reputación, Zona plegada dentro de Mapa, tracker de `WorldState.agenda`, ficha de compañero de
  Reino unificada, transición de entrada en el aviso de Hambre/Sed, pop en subida de nivel de
  profesión, `ResourceBar` compartido (dedupe Hambre/Sed jugador↔compañero), confirmación visual al
  cambiar plantilla de equipo, enlace "Ver historial completo" del log en vivo al Diario. Único
  pendiente: `Save.clase`/`especializacion` — **corrección 2026-08-31**: el endpoint backend
  (`PATCH /saves/:id/clase`, `progression.ts`) ya existe desde el 2026-08-29, pero ningún componente
  frontend lo invoca todavía — sigue sin flujo de creación/asignación real de cara al jugador, el
  hueco real es de frontend, no de backend. `tsc -b` limpio backend y
  frontend, suite completa backend 1518/1518 (retry aislado tras el flake conocido de
  `turnLock` bajo carga paralela), frontend 93/93.
- **Auditoría + mejora del sistema de imágenes/prompts — CERRADO Y APLICADO (2026-08-27)**: bug real
  encontrado y arreglado (el estilo/tono/encuadre calculado en `imagePromptGenerator.ts` nunca
  llegaba al LLM que escribe el prompt final — se calculaba y se descartaba) + variantes de día/
  noche/estación para Location/Zona (mismo mecanismo de sufijo de slug que las variantes por sexo,
  header de pestañas de estación + toggle de día/noche en la Enciclopedia, auto-selección por reloj
  real en la vista Zona en vivo). Ver detalle completo en
  [imagenes-prompts.md](rpgtarkor/imagenes-prompts.md).
- **2 auditorías en paralelo (2026-08-27)**: backend sin conectar a frontend, y diseño/UX del
  frontend (ejecutada después y con los hallazgos de la primera como contexto) — ambas cerradas
  poco después, ver banner "todo, de arriba a abajo" un poco más abajo (documentos originales
  borrados 2026-08-31 al limpiar checklists ya 100% resueltos, contenido absorbido aquí). Hallazgo
  más citado en las dos: los `activeEffects` de Fase 2 (justo abajo) no tenían ningún indicador
  visual en combate.
- **Fase 2 de efectos de clase (AUMENTO/DEBILIDAD) — CERRADO Y APLICADO** (el mismo día que el
  diseño, autorizado explícitamente por la usuaria: "dale a todo"): duración real por turnos sobre
  el motor 1v1 clásico (`turnResolution.ts`), infraestructura nueva en `activeEffects.ts`, 2
  habilidades reales sembradas (Golpe Runa de Cólera/Golpe Envenenado), 14 tests nuevos. Ver detalle
  completo en "Fase 2" más abajo.
- **Objetivo individual en combate múltiple — CERRADO Y APLICADO** (el ítem más grande de la
  sesión): sistema de "enganche" por ronda (duelo mutuo real vs. golpe gratis sin oposición),
  diseñado con la usuaria jugando en vivo contra 2 cuervos y enganchado de verdad al motor
  (`combateMultipleOrquestacion.ts`, migración nueva `esperandoEleccionJugadora`). Ver detalle en
  "Fase 3" más abajo y en [combate-multiple.md](rpgtarkor/combate-multiple.md) § 2.
- **5 puntos rápidos del checklist de la usuaria, todos CERRADOS**: sistema Matar/Capturar/Clemente
  (ya estaba hecho de una sesión previa, el checklist estaba desactualizado — corregido, y de paso
  se cerró un bug real del botón "Capturar" apareciendo aunque el NPC no fuera capturable); botones
  de imagen de Zona reubicados a Enciclopedia > Localización; prompt de imagen de Zona reforzado
  contra texto incrustado; habilidades de arma reales/avanzadas dan +2 de atributo al ejecutarlas;
  96 partidas de prueba huérfanas borradas de Postgres + causa raíz arreglada (cleanup de test
  movido a `afterEach`).
- **Backend corriendo con `tsx src/server.ts` (sin watch)** — cualquier cambio de código de hoy
  necesita que se reinicie a mano para surtir efecto; el arranque/parada de backend/frontend/Postgres
  lo hace siempre la propia usuaria, nunca Claude.
- Sesiones anteriores (2026-08-23/25) cerraron el grueso del "Grupo 3" de abajo — ver el resto del
  documento para el detalle punto por punto, y `docs/deuda-tecnica-hallazgos.md`/
  `docs/revisar-partida-hallazgos.md`/`docs/checklist-cierre-auditorias-2026-08-25.md` para las 3
  auditorías previas, ya cerradas del todo (22/22).

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
  quedarse `EN_CURSO` para siempre). **Sub-partición >4v4: enganchada al motor real (2026-09-01)**
  — existía desde 2026-08-28 (`particionarEnSubCombates`) pero nunca se invocaba desde ningún
  caller; hallazgo real jugando en vivo (checklist), fix en `cazar.ts` (fragmentos ≤4, el que
  incluye a la jugadora `jugable`, el resto resuelto de una sentada con
  `resolverTurnosAutonomosHastaJugadora`, narración muda + resumen determinista). Huecos que siguen
  documentados a propósito: XP de la propia tirada de combate, objetivo individual entre miembros
  de un mismo grupo (mecánicamente intercambiables hoy).
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
- [x] ~~**"Trabajador de Reino", fase 1**~~ — **APLICADO al motor (2026-08-31)**. Ampliado por la
  usuaria en vivo a un sistema mucho más grande y reutilizable: edificio de facción por profesión
  (mejorable pequeño/mediano/grande = 1/3/6 trabajadores), vista de interior de asentamiento,
  moneda Goirno (valor real en los 184 items del catálogo), sistema de idiomas por raza. Piezas
  nuevas: `FactionBuilding` (catálogo de mundo, `worldId`-scoped, deliberadamente distinto de
  `Building` del jugador), `Location` interior (`campamento-serhu-interior`, entrada instantánea vía
  `LocationLink` normal), `Npc.teachesProfession`, endpoint determinista
  `POST /saves/:id/npc/:npcSlug/aprender-oficio` (reputación + coste en Goirnos). Solo Karot Veku,
  solo 2 de los 11 oficios (Herrero/Curtidor) como prueba end-to-end — **detalle completo y huecos
  pendientes en** `tarkor_trabajador_reino_fase1_2026-08-31` (memoria de sesión): faltan los 9
  oficios restantes + sus NPC trabajador, producción pasiva de recursos (sin roles de Reino
  formalizados todavía), efectos activos reales del edificio, y extender a otras facciones. Sin
  probar en vivo jugando todavía. **Ampliado (2026-09-01, ronda de consolidación)**: Maestro Cocinero
  Serhu añadido y verificado en vivo (checklist, 2026-08-31), y Maestro Carpintero Serhu + Maestra
  Sastre Serhu añadidos (mismo patrón exacto, sin test dedicado — el motor ya está probado de forma
  genérica) — 5 de los 11 oficios con Maestro real ese día. **Completado (2026-09-01, mismo día,
  segunda pasada)**: los 6 Maestros restantes añadidos (Herborista/Alquimista/Domador/Desollador/
  Peletero/Primeros Auxilios Serhu) — **los 11 oficios base ya tienen Maestro real** en Karot Veku,
  mismo patrón exacto de datos (nivel 5, `comerciablePct: 30`, `reclutablePct: 0`,
  `capturablePct: 0`). Confirmado por consulta directa a Postgres (`teachesProfession` de los 11
  slugs correctos), `tsc -b` limpio, 1869/1869 tests en verde — sin verificación en vivo jugando
  para estos 6 (decisión explícita: el motor genérico ya se confirmó en pantalla con
  Carpintero/Sastre, mismo patrón byte a byte, sin nada específico por NPC que pudiera romperse).
- [x] ~~**Quién enseña un oficio nuevo**~~ — resuelto de paso por lo de arriba: el Maestro de cada
  profesión (`Npc.teachesProfession`) es la respuesta real, ya no aplazado.
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
- [x] ~~**Corrección de sitio: botones de imagen de Zona solo en Enciclopedia**~~ — cerrado
  2026-08-26, APLICADO al motor. Los 3 botones (`ImagePromptSlot`) se retiraron de `ZonaPanel.tsx`
  (que sigue leyendo/mostrando la imagen 'mapa' de fondo igual que antes, solo sin botón propio) y
  "Mapa" se añadió a la ficha de Localización de la Enciclopedia (`DetailModal.tsx`, junto a
  banner/miniatura que ya estaban ahí), reutilizando `entityType:'zona'`/`sizeProfile:'mapa'` — un
  solo generador, no dos. `GET /saves/:id/zona` (zona.ts) recortado de vuelta: ya no devuelve
  `imageUrls`/`imagePrompts` (nadie los consume ya), solo el `imageUrl` del mapa que sí se pinta de
  fondo. `tsc -b` limpio en ambos lados, 2807 tests backend + 92 frontend en verde.
- [x] ~~**Calidad real de imágenes de Zona: reforzar el prompt**~~ — cerrado 2026-08-26, APLICADO
  al motor. La primera imagen de prueba (Hondonada del Eco) traía texto incrustado — título y
  leyenda ("Redsun Hollow", "Cave Mouth/Camp/Fire Pit/Magnetic Sand Trail"), **en inglés**, pese a
  que el prompt ya pedía "no text or labels" (`imagePromptGenerator.ts § ENTITY_TYPE_STYLE.zona`) —
  una sola cláusula al final, fácil de perder entre el resto de la descripción para la herramienta
  externa de generación. Reforzado: prohibición repetida, explícita y en mayúsculas donde más pesa
  ("ABSOLUTELY NO TEXT ANYWHERE... no title, no legend, no cartouche, no compass rose, no scale
  bar..."). `generateImagePrompt` ya instruye al LLM de refinado a "copiar" el estilo literal (no
  resumirlo), así que la prohibición sobrevive ese paso — confirmado leyendo el propio system
  prompt, no solo asumido. **Pendiente de tu lado**: generar una imagen de prueba nueva y confirmar
  si la herramienta externa por fin lo respeta — si sigue sin hacerlo, el problema está del todo en
  esa herramienta, no en el prompt que le mandamos.
  **Pendiente de hablar con calma, sin tocar nada todavía**: qué imagen sirve para qué en cada tipo
  de entidad (NPC/ítem/ubicación/zona/facción/...) — hoy "banner" y "miniatura" significan cosas
  algo distintas según dónde se usen (tarjeta de Enciclopedia vs ficha de detalle vs fondo de un
  panel de juego), y no hay un criterio único escrito de "esta imagen es para esto, aparece aquí,
  así". Repasarlo por tipo de entidad antes de seguir añadiendo más generadores sueltos.
- [x] ~~**Habilidades de arma: bonus de atributo al ejecutarlas**~~ — cerrado 2026-08-26, APLICADO
  al motor. `WeaponAbility.attributeBonus` nuevo (weaponAbilities.ts): +2 fijo del atributo base
  para toda habilidad `tier: 'real'`/`'avanzada'` (Tajo Horizontal, Golpe Devastador, Ráfaga de
  Cortes, Muro Inquebrantable, Puño Demoledor...), 0 para `tier: 'basica'` ("Ataque Básico" y
  "Cobertura de Escudo" — decisión cerrada: el genérico va con el stat base tal cual). Enhebrado
  hasta `SavedAction.attributeBonus` (`dynamicAbilities.ts § syncDynamicCombatAbilities`), la MISMA
  columna que ya usan las habilidades de clase y que `turnResolution.ts` ya lee para calcular el
  intercambio (`selectedAbilityData.attributeBonus` → `abilityAttributeBonus`) — sin tocar el motor
  de combate en sí, solo se le empezó a dar un valor real a un campo que las habilidades de arma
  nunca habían poblado. Raciales se quedan en 0 (fuera de alcance, la petición era solo sobre
  habilidades de ARMA). Tests nuevos en `weaponAbilities.test.ts`/`dynamicAbilities.test.ts`, `tsc
  -b` limpio, 2817 tests backend en verde.
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
- [x] **Fase 2 — AUMENTO/DEBILIDAD CERRADO Y APLICADO 2026-08-26** (mismo día que el diseño, tras
  autorización explícita de la usuaria: "todo, ya que vamos a tener 2 cuentas de claude durante un
  tiempo dale a todo"). `CANALIZAR`/`CURAZION`/`REFLEJAR`/`PROVOCACION`/`PURIFICAR` siguen SIN
  construir — cada uno es su propia mecánica encima de esta base (cancelar-si-te-golpean, curar,
  capturar-y-devolver, forzar-objetivo, limpiar efectos), fuera de alcance de esta pasada.

  **Infraestructura construida** (`backend/src/services/activeEffects.ts`, nuevo):
  `ActiveEffect { attribute, magnitude (con signo), turnsRemaining, sourceAbility }`,
  `effectiveAttributesConDuracion(base, activeEffects)` (suma con signo, varios efectos sobre el
  mismo atributo se APILAN), `pushActiveEffect`, `decrementActiveEffects`, `parseActiveEffects`
  (lectura defensiva del `Json`). `Save.activeEffects`/`NpcState.activeEffects` (`Json @default
  ("[]")`, migración `20260826210000_fase2_efectos_duracion`) — reset a `[]` en el MISMO punto
  donde ya se resetea `abilityUsesThisEncounter` (vuelta real a ILESO desde un estado peor —
  **bug real evitado en el propio diseño**: comparar solo "condición final es ILESO" resetearía
  siempre que el jugador siga ileso sin haber sido tocado, el caso más común; hace falta la
  transición real desde un estado peor). `SavedAction.durationEffectMagnitude/Turns` (`Int?`, ya
  existían del diseño previo) + `StartingAbility` con los mismos 2 campos, sincronizados al crear
  la `SavedAction` de un desbloqueo de clase. El atributo afectado por el efecto es SIEMPRE el
  mismo que `preferredAttribute` de la habilidad (decisión de diseño ya tomada al escribir el
  comentario de la columna, sin campo nuevo) — limita qué filas de `clases.md` encajan sin
  reinterpretar (ver habilidades sembradas, abajo).

  **Aplicado en `turnResolution.ts` § `resolveCombatExchangePhase`, SOLO el camino no-independiente
  (`resolveExchange`, CASO ATAQUE del jugador) — el resto queda deliberadamente sin cablear**: ni
  el camino independiente (utilidad) ni el lado NPC-atacante tienen hoy ninguna habilidad real que
  lleve AUMENTO/DEBILIDAD, así que no se construyó ese enganche todavía (documentado, no un
  descuido). Mismo margen decisivo ±10 que ya usan CONTRA/REFRACTAR (`golpe_pleno`), no el umbral
  propio de cada habilidad. Los "atributos efectivos" (base + `activeEffects`) se calculan UNA vez
  por intercambio y sustituyen a `attributes`/`npcParaIntercambio.attributes` crudos en los 4 sitios
  donde se construye un `ExchangeParticipant`, más `rollInitiative` del próximo intercambio.
  **Cuidado real con el orden del decremento**: los efectos nuevos de ESTE turno viajan aparte
  (`nuevosJugador/NpcActiveEffects`) hasta el final — empujarlos directo sobre el array que luego
  se decrementa los habría envejecido en el MISMO turno en que nacen, y un efecto de 1 turno
  ("se mantiene para el siguiente turno") habría expirado antes de que ese turno siguiente llegara
  a leerlo. `combateMultipleOrquestacion.ts` (motor multi-combate) sigue sin leer/aplicar
  `activeEffects` — deferred, documentado también en `classAbilities.ts`.

  **2 habilidades reales sembradas** (las únicas encontradas en `clases.md` con cifra propia Y
  roll-attribute = atributo afectado, condición que el diseño de arriba exige): **Golpe Runa de
  Cólera** (Chamán/Rúnico 28, AUMENTO — el umbral de la propia fila, diferencia 10, ya coincidía
  con el margen decisivo del motor sin reinterpretar nada) y **Golpe Envenenado** (Cazador/
  Supervivencia 12, DEBILIDAD — solo el tramo alto de sus dos umbrales propios, 4/8, mismo criterio
  de simplificación que CONTRA/REFRACTAR). Rúnico pasa de 2 a 3 de 8, Supervivencia de 1 a 2 de 8 —
  141 huecos reales en total ahora (antes 139).

  **Verificación**: 12 tests unitarios nuevos (`activeEffects.test.ts`, funciones puras) + 2 tests
  de integración nuevos contra Postgres real (`turn.integration.test.ts`, uno por efecto — prueban
  el ciclo completo: golpe decisivo → efecto empujado y persistido → turno siguiente → decrementado/
  expirado) + recuento actualizado en `classAbilities.test.ts` (139→141). `tsc -b` limpio, suite
  completa 2984 tests (solo 4 fallos en `recolectar.integration.test.ts` bajo ejecución paralela,
  confirmados pre-existentes y no relacionados — pasan limpio en aislamiento).
- [x] ~~**Fase 3 — combate multi-objetivo de verdad**~~ — **CERRADA Y APLICADA COMPLETA 2026-08-27**
  (las 5 piezas § 3a-3e, ver detalle completo debajo de cada una). Alcance real construido, más
  simple que el diseño original que sigue documentado a continuación por su valor de contexto:
  `MULTIPLE`/`DESVIAR`/`CONTROL`/`OCULTACION`/`EXPULSAR` con segundo objetivo real, e `INVOCACION`
  (tótems como tercer participante, solo el modo `ATAQUE` construido — Tótem de Guerra). `EXPULSAR`
  se simplificó a un único desenlace sin tocar `npcScene.ts`/presencia en zona (decisión explícita
  de la usuaria: sin la tirada de "no vuelve nunca", el expulsado siempre acaba volviendo dentro
  del propio `CombatEncounter`, nunca sale de la zona).

  **§ 3a — `activeEffects` en combate múltiple + `CONTROL` real — CERRADO Y APLICADO 2026-08-27**
  (primera pieza de las 5 en que se dividió la Fase 3, "todo, en el orden que prefieras, a tu
  elección"): `combateMultipleOrquestacion.ts` no leía ni aplicaba `activeEffects` en absoluto
  hasta ahora (hueco real de Fase 2, que solo enganchó el motor 1v1) — `datosVivosDe` ahora aplica
  `effectiveAttributesConDuracion` a los 3 tipos de combatiente (JUGADOR/NPC/COMPANION, migración
  `Companion.activeEffects` nueva), y `ejecutarIntercambioYAvanzar`/`ejecutarGolpeGratisYAvanzar`
  decrementan/empujan igual que el motor 1v1 (mismo cuidado de orden: lo nuevo de este turno no se
  decrementa este mismo turno). AUMENTO/DEBILIDAD sigue con el mismo alcance exacto que Fase 2
  (solo el camino NO independiente, `resolveExchange`/margen decisivo — nunca el camino de
  utilidad). `CONTROL` real: cuando la utilidad que lo dispara reacciona a un ataque entrante con
  ≥2 enemigos vivos en el bando del controlado, el controlado ataca a un aliado propio 2 rondas
  (`CombatParticipant.controladoPorRondas`, nueva) en vez de robar la iniciativa (el fallback de
  Fase 1 se mantiene solo cuando no hay a quién redirigir) — Opresión Mental (ya sembrada) pasa a
  hacer lo que dice de verdad. **Control Rúnico NO se sembró** (hallazgo real durante la
  implementación, corrige el plan original): combina CONTROL (camino independiente/utilidad) +
  DEBILIDAD (camino no independiente/margen decisivo) en una sola habilidad — como `rol` es un
  campo único por habilidad, ningún camino de resolución cubre los dos efectos a la vez sin
  reinterpretar la fila; se queda `⚠️ bloqueada`. 6 tests unitarios nuevos
  (`combateMultiple.test.ts`, `resolverIntercambioCompleto`) + 3 de integración contra Postgres
  real (`combateMultipleOrquestacion.integration.test.ts`, repetidos 5 veces sin fallos), `tsc -b`
  limpio, suite completa backend en verde (retry aislado tras el flake conocido de `turnLock`).

  **§ 3b — `MULTIPLE` real — CERRADO Y APLICADO 2026-08-27**: cuando una habilidad `ATAQUE`+
  `MULTIPLE` golpea con margen decisivo, el mismo golpe también alcanza a un objetivo extra
  aleatorio del mismo bando que el defensor principal (`objetivoExtraFor`, `combateMultiple.ts`),
  golpe directo sin tirada de defensa propia (mismo mecanismo que un golpe gratis) — si la
  habilidad también lleva `DEBILIDAD`, el mismo `ActiveEffect` se aplica a los dos objetivos (la
  ficha real, Zancada Perforante, describe la debilidad "propagándose a todos los enemigos", no una
  copia distinta por cada uno). **Deliberadamente sin construir**: `AUMENTO`/`AGUANTE`+`MULTIPLE`
  (buff a aliados en vez de golpe a un enemigo extra — Valor Compartido, Postura Inquebrantable,
  Grito Improvisado, Llamada de la Manada) depende de que AUMENTO funcione en el camino de utilidad,
  que ni Fase 2 ni 3a engancharon nunca — 4 filas reales se quedan `⚠️ bloqueada` a propósito, no un
  descuido. 2 habilidades reales sembradas: **Punta Doble** (Guerrero/Lancero 24 — su propio umbral,
  diferencia 12, se aproxima al margen decisivo del motor ±10, mismo criterio que Golpe Envenenado)
  y **Golpe Gemelo** (Cazador/Supervivencia 32 — reinterpretación consciente: la fila describe
  "ataca a dos objetivos" SIN ninguna condición de margen, se gatea igual que el resto por
  consistencia con el motor, documentado explícitamente, no un descuido). Lancero pasa de 2 a 3 de
  8, Supervivencia de 2 a 3 de 8 — 143 huecos reales en total ahora (antes 141). 6 tests unitarios
  nuevos (`objetivoExtraFor`, `multipleTriggered`) + 1 de integración contra Postgres real (2
  enemigos, el que no fue objetivo principal también queda golpeado — imposible sin MULTIPLE),
  repetidos 5 veces sin fallos. `tsc -b` limpio, suite completa backend en verde.

  **§ 3c — `DESVIAR`+`OCULTACION` reales — CERRADO Y APLICADO 2026-08-27**: `DESVIAR` — cuando la
  defensora gana por margen decisivo (`defensor_contragolpea`, mismo umbral que CONTRA/REFRACTAR) y
  su habilidad de defensa lleva `DESVIAR`, el golpe entrante (que de todos modos ya iba a fallar) se
  redirige a un objetivo aleatorio del bando del ATACANTE original en vez de simplemente fallar —
  mismo mecanismo de golpe directo que MULTIPLE, solo que el objetivo extra sale del bando contrario,
  no del propio. `OCULTACION` — `CombatParticipant.ocultoPorRondas` (columna nueva) excluye a quien
  la tiene de ser ELEGIDO como objetivo en `resolverEnganchesRonda` (nuevo parámetro `ocultos:
  Set<string>`, calculado en `calcularEnganchesRonda`), salvo que sea el único vivo de su bando — se
  rompe de inmediato si el propio oculto ataca. Ambas reutilizan el camino ya construido en 3a/3b
  (independiente para OCULTACION, no-independiente para DESVIAR) sin infraestructura nueva más allá
  de la columna. **Sin cifra para la `DEBILIDAD` combinada de Comunión Salvaje** (la fila nunca
  describe qué atributo, cuánto ni cuántos turnos — a diferencia de Golpe Envenenado, que sí tenía
  "tramo alto" con números propios) ni para el `AUMENTO` de Camuflaje (mismo motivo que MULTIPLE+
  AUMENTO: depende del camino de utilidad, sin construir) — documentado, no un descuido. 2
  habilidades reales sembradas: **Comunión Salvaje** (Cazador/Supervivencia 40, su umbral propio de
  8 se aproxima al margen decisivo ±10) y **Camuflaje** (Cazador/Supervivencia 19, tramo alto de la
  fila, 2 turnos). Supervivencia pasa de 3 a 5 de 8 — 145 huecos reales en total ahora (antes 143).

  **Bug real cazado en integración** (no solo en el diseño, igual que el de `avanzarSinAtacar` de
  objetivo individual): un oculto sin ningún otro candidato posible que su propio hider (p. ej. un
  único enemigo real) SIGUE PUDIENDO reclamarlo de vuelta con su propia elección (nada le impide
  elegir su objetivo con normalidad, solo se le excluye de ser el CHOSEN por otros) — y por la regla
  de reciprocidad ya existente de "objetivo individual" (ser reclamado cancela tu propia elección),
  ese reclamo del propio oculto puede formar un duelo mutuo real que termina resolviéndose desde el
  turno del OTRO combatiente (quien tenga más iniciativa) — la ruptura de ocultación solo miraba al
  atacante de turno, nunca al defensor de un duelo mutuo real, así que el oculto se quedaba "oculto"
  para siempre en la base de datos pese a haber elegido combatir. Corregido: `ejecutarIntercambioYAvanzar`
  rompe la ocultación de AMBOS lados de un duelo mutuo (esta función SOLO se llama para duelos
  mutuos reales, nunca golpes gratis — el defensor también "atacó" con su propia elección de ronda).

  Verificación: 12 tests unitarios nuevos (`combateMultiple.test.ts` — exclusión de
  `resolverEnganchesRonda` con `elegirObjetivoPara` mockeado a mano, `desviarTriggered`,
  `atacanteOcultacionDisparada`/`defensorOcultacionDisparada`) + 2 de integración contra Postgres
  real, repetidos 5 veces sin fallos — el de OCULTACION verifica justo el bug de arriba (la
  ocultación SIEMPRE acaba rompiéndose, nunca se queda colgada). `tsc -b` limpio, suite completa
  backend 1544/1544 (retry aislado tras el flake conocido de `turnLock`).

  **§ 3d — `INVOCACION` real (tótems) — CERRADO Y APLICADO 2026-08-27**: la pieza estructuralmente
  más grande de las 5 — nuevo `CombatParticipantTipo.INVOCACION` (tercer tipo de participante junto
  a JUGADOR/NPC/COMPANION, migración con `ALTER TYPE ... ADD VALUE`) + 3 columnas nuevas en
  `CombatParticipant` (`invocacionVidaRestante`, `invocacionRondasRestantes`,
  `invocacionInvocadorId`). Solo se sembró **Tótem de Guerra** (Chamán/Convocador 12, único
  `INVOCACION` de `clases.md` sin combinar con ningún otro efecto sin construir) — ficha literal de
  la fila: "aguanta 1 golpe, ataca durante 2 turnos y desaparece, no se puede invocar más de uno de
  este tipo a la vez".

  **Decisiones de diseño explícitas** (discutidas con la usuaria antes de implementar, no asumidas):
  - **El tótem NO se inserta en `ordenIniciativa`** — reordenar ese array en caliente (tocar la
    aritmética de `turnoActual % length` en pleno combate) se descartó por invasivo frente al
    beneficio. En vez de eso, actúa FUERA de la cola: ataca una vez al cruzar cada ronda mientras le
    queden `invocacionRondasRestantes`, en el mismo punto donde ya se decrementan
    `controladoPorRondas`/`ocultoPorRondas` (`avanzarYComprobarFin`).
  - **Invocar consume el turno entero del invocador** — sin golpe propio ese mismo turno (decisión
    explícita: más simple y coherente con "aguanta 1 golpe, ataca 2 turnos" contados desde que el
    tótem empieza a existir, en vez de mezclar dos resultados en el mismo intercambio).
  - **El golpe del tótem SÍ se narra** (Ollama, fuera de transacción, mismo patrón de seguridad que
    el resto del motor) — solo el "housekeeping" de decidir qué tótems tienen turno pendiente
    (`avanzarYComprobarFin`) se queda silencioso, igual que ya lo era para CONTROL/OCULTACION.
  - **Reconocible en la Enciclopedia** (petición explícita de la usuaria: "que sea reconocible así
    como npc, aunque sea temporal") — Tótem de Guerra tiene una ficha `Npc` de catálogo NORMAL
    (`worldCatalog.ts`, `kind: 'PLANTILLA'`, sin `raza`/`clase`), se descubre sola por mención en la
    narración de combate (mismo mecanismo automático que cualquier NPC/fauna,
    `entityDiscovery.ts`) y queda permanentemente en la pestaña NPCs de la Enciclopedia, aunque el
    tótem individual solo dure 1-2 turnos en un combate concreto — sin inventar ningún campo de
    "temporalidad" nuevo en el modelo de Enciclopedia. La idea de una categoría propia
    "humanoide civilizado / no-inteligente estilo murloc" (para separar invocaciones de NPCs
    civilizados) se planteó y se dejó aparte a propósito, como pieza de diseño de mundo/lore
    independiente — ver memoria de sesión 2026-08-27.

  **Bug real cazado en integración** (segundo de la Fase 3, mismo patrón que el de OCULTACION en
  3c: el trace de diseño no coincidía con el comportamiento observado): el decremento de
  `invocacionRondasRestantes` y la expiración por agotar rondas (`invocacionVidaRestante: 0`) vivían
  juntos, DENTRO de `avanzarYComprobarFin` (transacción pura, sin narrar) — así que un tótem que
  agotaba su duración justo en el cruce de ronda quedaba "ya destruido" ANTES de que
  `resolverTotemsPendientes` (que corre DESPUÉS, fuera de la transacción) llegara a resolver su
  último golpe, y nunca atacaba en el turno en que expiraba. Corregido: `avanzarYComprobarFin` solo
  decrementa `invocacionRondasRestantes` (sigue sin narrar); la expiración por rondas-agotadas se
  decide DESPUÉS de resolver el golpe, dentro de `resolverTotemsPendientes`.

  Verificación: 3 tests de integración nuevos contra Postgres real (invocar crea el
  `CombatParticipant` correcto y consume el turno entero; el tótem ataca al cruzar de ronda y
  desaparece al agotar vida/rondas — el que atrapó el bug de arriba; el candado de "no más de uno
  del mismo tipo a la vez"), repetidos 5 veces sin fallos. `tsc -b` limpio, suite completa backend
  1547/1547 (retry aislado tras el flake conocido de `turnLock`, 93/93 en solitario). Sin cambios de
  frontend (mismo patrón que el resto de Fase 2/3).

  **Deliberadamente sin construir**: los otros 7 tótems de `clases.md` (Tótem de Protección,
  Elementos, Clan, Temblor, Ancestral, Elementales, Runa Ilusoria, Llamada/Eco de la Manada/
  Invocación del Ancestro) — todos combinan INVOCACION con `PROVOCACION`/`CONTRA`/`AGUANTE`/
  `MULTIPLE`/`AUMENTO`/`LIMITADO` o describen mecánicas propias (mitad de stats del invocador,
  varios tótems a la vez, elegir modo ataque/aguante) fuera del alcance de esta pasada — Tótem de
  Guerra era el único que encajaba sin reinterpretar la fila.

  **§ 3e — `EXPULSAR` real — CERRADO Y APLICADO 2026-08-27, cierra la Fase 3 completa**: única fila
  real de `clases.md` con este efecto (Embate de Escudo, Guerrero/Guardián 28, "ataque normal a no
  ser que saques 8 de diferencia... entonces lo expulsa del combate 2 turnos y hay un 50% de
  posibilidades de que vuelva, si la diferencia es +14 lo retira y no vuelve"). Discutido con la
  usuaria antes de implementar (2 rondas de preguntas):

  - **Un único margen decisivo** (±10, mismo umbral que el resto de Fase 2/3) en vez de los dos
    tramos propios de la fila (8 y 14) — decisión explícita: "vamos con que expulse directamente y
    punto, sin complicarnos".
  - **Sin tirada de 50% de volver ni caso "nunca vuelve"** — margen decisivo dispara siempre
    "expulsa 2 rondas, vuelve solo al cumplirlas o antes si su bando se queda sin nadie más vivo".
    La usuaria fijó explícitamente la regla del "antes": "si mato a todos los presentes, el
    expulsado vuelve — no se expulsa nunca indefinidamente".
  - Con esa regla, EXPULSAR queda **mecánicamente idéntico a OCULTACION** (misma exclusión de
    `resolverEnganchesRonda`, misma excepción de "único vivo del bando") — se decidió reutilizar la
    lógica pero con una **columna separada** (`CombatParticipant.expulsadoPorRondas`, no
    `ocultoPorRondas`): conceptualmente son cosas distintas (uno se esconde, al otro lo empujan
    fuera a la fuerza) aunque el mecanismo de exclusión sea idéntico letra por letra.

  Sin mitad "fuera de combate" (nunca toca `npcScene.ts`/presencia en zona) — al eliminar el caso
  "no vuelve nunca", el expulsado siempre termina volviendo dentro del propio `CombatEncounter`, así
  que esa mitad de la ficha original queda sin construir a propósito, no un descuido.

  Verificación: 3 tests unitarios nuevos (`expulsarTriggered`, mismo gate que MULTIPLE) + 2 de
  integración contra Postgres real (Embate de Escudo marca `expulsadoPorRondas` sobre el defensor
  golpeado y se decrementa al cruzar de ronda; el expulsado único-vivo-del-bando sigue siendo
  enganchado con normalidad, nunca deja el combate sin objetivo), repetidos 5 veces sin fallos.
  `tsc -b` limpio, suite completa backend 1552/1552 (retry aislado tras el flake conocido de
  `turnLock`, 93/93 en solitario). Sin cambios de frontend.

  **Objetivo individual real — CERRADO Y APLICADO 2026-08-26**, diseño + algoritmo + enganche al
  motor en vivo, de punta a punta. Petición explícita jugando contra 2 cuervos: "no puedo elegir
  objetivo... cuando ataco debería ser yo vs mi objetivo y el otro enemigo tiene ataque gratis".
  Detalle completo (con ejemplos jugados) en
  [combate-multiple.md](rpgtarkor/combate-multiple.md) § 2 — resumen aquí:

  **La regla** — sistema de "enganche" por ronda, no "ataca a quien elijas":
  1. Todos (jugador, compañeros, enemigos) tiran iniciativa cada ronda.
  2. En ese orden, quien TODAVÍA no sea objetivo de nadie elige a quién atacar; el primer reclamo
     sobre un objetivo dado gana.
  3. Ser elegido como objetivo cancela tu propia elección anterior (si la había) — pasas a defender
     un duelo real contra quien te reclamó. Dentro de la pareja, golpea primero quien tenga más
     iniciativa, sin importar quién eligió a quién. Esto puede encadenarse (si tu reclamante es
     reclamado a su vez por alguien más, ambos os quedáis sin nadie esa ronda) — verificado con test
     dedicado, no un caso especial.
  4. Quien no acaba en duelo mutuo (nadie lo reclamó y su objetivo ya estaba ocupado, o sobra en un
     grupo impar) mete un **golpe gratis**: impacto garantizado, sin tirada de defensa del objetivo
     — `AGUANTE`+`MULTIPLE` es la única forma real de defenderse de uno de estos.
  - Compañeros siguen la misma IA automática que un NPC — su propia postura de combate
    (Agresivo/Defensivo/Capturador/Clemente) sigue aparcada, sin diseñar.

  **Implementación** — `resolverEnganchesRonda`/`esDueloMutuo`/`golpeaPrimeroEnDuelo`
  (`combateMultiple.ts § 2b`) es el algoritmo puro; `combateMultipleOrquestacion.ts` lo engancha al
  motor real vía `CombatEncounter.esperandoEleccionJugadora` (columna nueva, migración
  `20260826200000_combate_multiple_espera_eleccion_jugadora`) — bloquea CUALQUIER intercambio de la
  ronda (no solo el de la jugadora) hasta que `fijarEleccionRondaJugador` fija su objetivo, porque
  la cancelación de la regla 3 puede "alcanzar hacia atrás" a alguien que ya habría actuado.
  `calcularEnganchesRonda` sustituye a `retargetBando` por completo (que queda exportado sin
  ningún caller real en producción). **Sin cambio de flujo visible para la jugadora**: su turno real
  ya resolvía la ronda entera de una sentada dentro de la misma llamada HTTP, así que solo cambió
  el ORDEN interno en que se calcula el reparto, confirmado explícitamente con ella antes de tocar
  el código ("¿te encaja elegir objetivo al empezar la ronda?" → "sí, adelante").

  **Bug real cazado en integración** (no solo en el diseño): `avanzarSinAtacar` (la mitad "ya
  resuelta por su pareja" de cada duelo) solo avanzaba `turnoActual` sin pasar por
  `avanzarYComprobarFin` — con el enganche por ronda esto se dispara muy a menudo, así que el
  combate podía quedarse con el reparto de una ronda vieja para siempre. Corregido: reutiliza el
  mismo camino que un intercambio real.

  **Verificación**: 24 tests unitarios (`combateMultiple.test.ts`) + 3 de integración contra
  Postgres real (`combateMultipleOrquestacion.integration.test.ts`), suite de integración completa
  (122 tests, 9 archivos) repetida 3 veces sin fallos ni partidas huérfanas nuevas, `tsc -b` limpio
  en backend y frontend (el frontend no necesitó ningún cambio).
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
  `17-reglas-construcciones-reino.md § Materiales procesados y oficios regionales`
  (fusionado ahí 2026-08-31; encontró que parte ya existía sin conectar: `bloque-piedra-tallada`/`lingote-de-hierro`
  huérfanos desde 2026-07-29). Cifras cerradas: pequeño 100% crudo, mediano ~75% procesado/25%
  crudo, grande 100% procesado (salvo resina, sin versión procesada nunca) — "así es difícil de
  ampliar" a propósito, exige los 4 oficios de procesado a la vez.
  **Mediano/grande — APLICADO al motor 2026-08-24**: 3 items nuevos (viga de madera tallada,
  columna de hueso, cordaje trenzado), 3 `CraftingRecipe` nuevas, `bloque-piedra-tallada`/
  `lingote-de-hierro` conectados a construcción por primera vez, y
  `ConstructionRecipe.oficio` pasa de "solo alivio" a bloqueo real (`OFICIOS_CONSTRUCCION_REQUERIDOS`,
  mismo patrón que `OFICIOS_CON_HERRAMIENTA_REQUERIDA`) desde el mediano en adelante. Diseño
  completo en `17-reglas-construcciones-reino.md § Materiales procesados y oficios regionales`.
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

- **Tanda de hallazgos 2026-08-30, sin investigar todavía** — sesión de juego real (Gorhorn):
  rediseño de "Matar" (P3.2) incompleto (no reabre elección real, ejecuta Ataque Básico solo),
  reputación de facción al matar sin confirmar si dispara, aviso Matar/Clemente repetido cada turno
  mientras el NPC siga CONVALECIENTE, barra de habilidades generales sin efecto al pulsar (debería
  escribir en el composer, no ejecutar), Cazar rechazado sin motivo aparente, combate abierto contra
  un NPC distinto al que narra la acción (posible reapertura de un bug ya cerrado), Huir sin
  narración única por intento (3 líneas idénticas seguidas), diseño de muerte permanente sin/con
  punto de guardado (pendiente de diseñar, marcado como "lo complicado"), Agua hervida de liquen
  debería ser crafteable no recurso (+ revisar más casos similares), Hagar duplicado en la
  Enciclopedia, fauna/flora mezcladas en `uploads/images/fauna/`, banner de Kirelon subido a mano
  sin efecto, género macho/hembra ausente por defecto en mucha fauna, "La Sábana Alta" duplicada en
  la selección de viaje y sin conectar en el mapa de región, scroll/foco no bajan solos tras cada
  turno, narración de viaje debería cubrir cada tramo intermedio. Detalle completo de cada uno en
  `revisar-partida-hallazgos.md § 2026-08-30` y en el checklist de pruebas (§§ 7, 10).
- **Bugs reales** ("profesiones tiran dado siempre" sin confirmar, Cruzavientos nunca narrado) —
  viven en sus propias memorias/`revisar-partida-hallazgos.md`, no compiten por prioridad con las
  features de arriba. **Cruzavientos — causa raíz ya diagnosticada, sin fix (trasladado aquí
  2026-08-31 al limpiar checklists obsoletos)**: al huir de un combate, la narración no nombra al
  atacante real — confirmado en código que `combatRealTargetName`/`otherNpcNamesInScene`
  (`turnResolution.ts:3940-3941`) solo se calculan si `exchangeHappened`, sin cubrir el caso de
  `detectsFleeIntent`. `recolectar.ts`/`rollGathering` 500 — **cerrado 2026-08-25**: eran 4
  migraciones sin aplicar contra Postgres real, no un bug de código; de paso, correr los 3 archivos
  de integración contra DB real por primera vez destapó una regresión de test genuina en "Ayuntamiento
  mediano" (fixture sin `ProfessionProgress`, invisible en el sandbox sin DB) — arreglada.
- **Huecos de lore puro** (Riko sin desarrollar, Kael Dorn↔Ithren sin cerrar del todo, Kalisar sin
  NPC propio) — trabajo de escritura, no de código; ya trackeados en
  `ampliar-lore-checklist.md § Pendiente de diseño`.
- **Deuda técnica de frontend, sin dueño en ningún otro doc** (trasladado aquí 2026-08-31 al limpiar
  checklists obsoletos de auditorías de UX cerradas): `GameView.tsx` con 63 `useState` sueltos sin
  agrupar en hooks (mismo criterio de extracción ya aplicado a otras piezas del archivo, ver
  [[tarkor_extraccion_hooks_gameview_2026-08-21]]) — deuda, no bug; `EnciclopediaPanel.tsx` (1337
  líneas) y otros paneles grandes sin dividir en archivos más pequeños — bajo valor real, cosmético.
- **Modo Multijugador** (`02-decisiones.md`, 12 preguntas P0-P3) — explícitamente pausado hasta que
  el modo en solitario esté maduro, ni siquiera diseñado todavía.
- **Benchmark de latencia real** (`06-decisiones-mecanicas.md` punto 5) — medición de rendimiento
  pendiente, no una feature.
- **Hallazgo real 2026-08-26, causa confirmada**: los 26/91 fallos de `turn.integration.test.ts`
  contra Postgres real eran puro Ollama caído (`ECONNREFUSED 127.0.0.1:11434` desde
  `embeddings.ts` — `retrieveLore` llama a Ollama de verdad en cualquier turno con `enCombate:
  false`, aunque `narrateAction`/`classifyAction` estén mockeados). Con Ollama arriba, el archivo
  completo pasa 91/91 — confirmado reejecutando tras levantarlo.
- **Partidas de prueba huérfanas contaminando la partida real de la usuaria — cerrado 2026-08-26**:
  96 de las 97 filas de `Save` en Postgres eran restos de tests ("Gorhorn de prueba (...)"),
  visibles en su propia lista real de partidas — arquitectura local-first, un solo Postgres
  compartido entre tests y partida en vivo. Causa raíz: 2 tests de `turn.integration.test.ts`
  (describe "perseguidor de Gistera Koh") creaban su propia Save extra y la borraban con una línea
  SUELTA al final del cuerpo del test — si cualquier `expect` anterior fallaba (y con Ollama caído
  fallaban a menudo, ver punto de arriba), esa línea nunca se ejecutaba, dejando la fila huérfana
  para siempre; acumulado desde 2026-08-11. Arreglado: cleanup movido a `afterEach` (sí se ejecuta
  aunque el test falle). Verificado corriendo el archivo completo dos veces contra Postgres real
  tras el fix — 91/91, cero filas nuevas huérfanas en ambos casos. Las 96 filas viejas, borradas.
