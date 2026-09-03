# Roadmap activo — Tarkor

**Sustituye como fuente de verdad a [archivo/21-roadmap-historico.md](archivo/21-roadmap-historico.md)**
(archivado 2026-09-03, cubre 2026-08-24→2026-09-03 — a su vez sucesor de
[archivo/11-roadmap-historico.md](archivo/11-roadmap-historico.md), archivado 2026-08-13, historial
de 2026-07-16→2026-08-13) desde 2026-09-03. Este documento arranca limpio, solo con lo vigente a
esta fecha — se actualiza según se cierren o aparezcan puntos, mismo criterio que tenía el anterior.

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
  `docs/checklist-pruebas-juego.md` y `docs/archivo/revisar-partida-hallazgos-historico.md` también
  actualizados en los mismos puntos.

**Verificación en vivo de la Pieza 5 + `questSlug` estructurado cerrado (2026-09-03, continuación de
sesión)** — reverificando Gistera Koh en una partida real (aceptando la misión vía el botón, no solo
texto libre) se encontró un bug real adicional: `POST /saves/:id/quests/aceptar`
(`routes/saves/quests.ts`) narraba la despedida de Gistera pero nunca aplicaba
`npcsRetiredForever: { push: 'gistera-koh' } }` — solo el camino de texto libre
(`gisteraAceptaEsteTurno`, `turnResolution.ts:6002`) lo hacía. Sin síntoma visible (un filtro
redundante por `Quest` activa ya la excluía de escena), pero el mecanismo GENERAL que consultan
`detectNpcsInScene`/`filterFarewellFacts` quedaba sin aplicar en el camino recomendado desde
2026-08-26. Corregido (commit `16eba78`) con test de integración nuevo. En el mismo endpoint se
aprovechó para cerrar el punto de roadmap `questSlug` estructurado: `Quest.questSlug` nuevo
(migración `20260903195622_add_quest_slug`), el caso especial de Orco Enfurecido/Gistera ya no se
persiste ni se busca por título narrativo exacto — el título sigue siendo lo único que ve la
jugadora, `questSlug: 'orco-enfurecido-hondonada-gistera'` es la clave mecánica real, incluida la
idempotencia del botón "Aceptar". Backend 2016 tests en verde (1 flake preexistente sin relación,
ya documentado), `tsc -b` limpio en backend y frontend.

### Genuinamente pendiente a día de hoy (verificado DOS veces — auditoría inicial + reverificación
contra código real con 3 agentes en paralelo, tras encontrar que la primera pasada también tenía
errores: 6 de los 25 ítems del primer checklist ya estaban cerrados o llevaban matices importantes)

**Diseño con alcance ya definido, solo falta implementar** (2, no 4 — "Matar" ya se cayó de esta
lista, y `questSlug` se cerró hoy, ver abajo):
- **Balance del primer combate (Orco Enfurecido/misión Gistera)** — tras 8 turnos de intercambio en
  un combate real, ni asegura victoria ni se siente "asequible" para un tutorial de facto de nivel
  1. Sin tocar desde 2026-08-28 (`git log -G` sobre el bloque del NPC solo muestra el rebalanceo
  original de 2026-07-29 y el rename cosmético Arcano→Magia). Ver `docs/checklist-pruebas-juego.md`
  punto 1.5.
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
  nativo), sin `onClick` ni modal (`tarkor_idea_modal_zonepoint_2026-09-02`, solo idea anotada).
- `Save.saveName` para nombrar partidas guardadas — confirmado, el campo no existe en
  `schema.prisma` ni en ningún sitio del repo, solo idea.
- `BERIG_PERSONAJES` (Dessa/Yerin/Riko) sin convertir a NPC de `worldCatalog.ts` — confirmado, solo
  mencionados en bios de otros NPCs, sin entrada propia de catálogo. Decisión de alcance pre-alpha
  ya tomada (`tarkor_decision_alcance_prealpha_y_personajes_2026-09-01`).
- `ZonePoint` sin sembrar fuera de Las Llanuras del Viento Rojo, y punto del jugador en el mapa —
  confirmado con el propio comentario del código ("la única zona con ZonePoint sembrado hoy").
  Cristal Helado será la siguiente región a poblar (decisión ya comunicada por la usuaria).
- PNG real de banners de clase/especialización — confirmado, solo se genera el texto del prompt,
  sin proveedor de imagen conectado para esta categoría.
- Modo Multijugador — confirmado, `/multijugador` enruta a un placeholder `<ComingSoon />`, sin
  ningún código de backend relacionado. Pausado hasta que el modo en solitario esté maduro.
- Miel Lebude / futura profesión de cocina por raza-región — idea suelta, prioridad muy baja.
- Benchmark de latencia real — medición pendiente, no una feature.
