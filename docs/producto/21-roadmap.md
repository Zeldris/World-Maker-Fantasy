# Roadmap activo — Tarkor

**Sustituye como fuente de verdad a [archivo/21-roadmap-historico.md](../archivo/21-roadmap-historico.md)**
(archivado 2026-09-03, cubre 2026-08-24→2026-09-03 — a su vez sucesor de
[archivo/11-roadmap-historico.md](../archivo/11-roadmap-historico.md), archivado 2026-08-13, historial
de 2026-07-16→2026-08-13) desde 2026-09-03. Este documento arranca limpio, solo con lo vigente a
esta fecha — se actualiza según se cierren o aparezcan puntos, mismo criterio que tenía el anterior.

---

## "Interactuar" como motor unificado de eventos de escena (2026-09-08, en curso)

Rediseño grande a petición explícita de la usuaria: "Interactuar" (hoy un mini-diálogo cosmético
sin consecuencia mecánica, ver `docs/rpgtarkor/mundo-determinista.md` § Pieza 4) pasa a ser el
contenedor único de toda oferta/interrupción de escena — sustituyendo mecanismos redundantes en vez
de acumular código paralelo con el mismo objetivo. Plan completo con contexto de diseño en
`/home/deck/.claude/plans/spicy-questing-brook.md` (histórico de la sesión, no en el repo).

**Franja 0 — Persistencia del log — CERRADO.** Bug real cerrado: la conversación de Interactuar se
perdía por completo al cerrarse (nunca se copiaba a `LogEntry` antes de borrar
`pendingDynamicMode`). Ahora vuelca todas las vueltas concatenadas en las 3 vías de cierre (agotar
vueltas / `cierra:true` del LLM / "Salir"). 5 tests nuevos, verificación rigurosa.

**Franja 1b — Interrupción de viaje ofrece Interactuar — CERRADO.** El aviso ámbar de texto fijo
("El camino se corta...") ahora también arma `pendingDynamicModeOffer` con el candidato real de la
interrupción, si su temperamento efectivo no es AGRESIVO/ENEMIGO (si lo es, sigue forzando combate
real exactamente como antes — filtro nuevo, bug detectado y cerrado ANTES de jugarlo en vivo
gracias al test de combate forzado ya existente). 2 describes de test de integración nuevos.

**Franja 1a — "Ver qué hay en la zona" — CERRADO completo, 4 piezas**:
- **Gate A (proximidad posicional)**: `zonePointMasCercano`/`RADIO_INTERACCION_PX`
  (`zonaPosicion.ts`) — `Math.hypot` sobre `Save.zonaPosX/Y` vs `ZonePoint.x/y`, umbral 100px
  calibrado contra las 76 `ZonePoint` reales del catálogo, "el más cercano gana" como desempate.
- **Gate B (alcanzabilidad por medio)**: nuevo enum `MedioMovimiento` (`Npc.medio`, **array**, no
  valor único — un anfibio real declara `['TERRESTRE', 'ACUATICO']`). Reglas precisas tras
  corrección de la usuaria: AEREO nunca bloquea Cazar ("se posa para combatir"), ACUATICO puro
  SIEMPRE bloquea Cazar (narrativo/pesca-desuello únicamente). 2 migraciones (una para convertir el
  campo existente de escalar a array sin perder los 71 valores ya sembrados).
- **Tipo RECURSO en Interactuar**: `DynamicModeTipo` ahora `'NPC' | 'FAUNA' | 'RECURSO'`. Nueva
  ruta `dynamicModeRecurso.ts` — a diferencia de NPC/FAUNA (conversación de vueltas), resuelve
  narración+tirada+recolección real de una sola llamada, reutilizando `resolverRecoleccion`
  (extraída de `/recolectar/confirmar` sin cambiar una línea de lógica, solo movida) +
  `gatheringRollFor`/`applyGatheringRoll` ya exportadas.
- Backend+frontend conectados end-to-end (`LogPanel.tsx` distingue el tipo con icono/botón propio,
  `GameView.tsx` resuelve sin abrir un segundo modal). Suite completa relacionada: 322/324 (2 flakes
  de línea base ya documentados, ajenos a esta pieza). `tsc -b --force` limpio backend y frontend.

**Franja 2 — Fusionar los 3 "pending*Offer" — CERRADO ACOTADO.** Investigado a fondo: los 3
disparadores (`dynamicModeOffer`/`newQuestOfferInfo`/`npcInteractionOffer`) son estructuralmente
distintos en quién decide el candidato (motor/LLM/jugador respectivamente) — forzar un servicio
común de "decidir candidato" habría sido una abstracción artificial, decisión explícita de no
hacerlo. Solo se extrajo la duplicación real: `clearPendingOffer` (`shared.ts`), aplicado en los 2
puntos que eran escrituras aisladas (`npcInteraction.ts`, `quests.ts` § `/cancelar`); los otros 4
puntos viven dentro de transacciones combinadas y correctamente no se tocaron. Hallazgo relevante a
futuro: si se construye el sistema de misiones "secundarias" (motor determinista, ver más abajo),
`newQuestOfferInfo` para ese caso sí encajaría en el mismo patrón que `dynamicModeOffer` — momento
real de revisitar la fusión.

**Franja 3 — Fauna agresiva con preámbulo — CERRADA (2026-09-08).** Un agresivo/enemigo detectado
por TEXTO ya no fuerza combate real por sí solo: se filtra de `npcsInSceneVivos` (variable derivada,
sin tocar la original usada en 6+ sitios más) salvo que su `ZonePoint` real esté en la MISMA celda
que el jugador (sistema de movimiento por cuadrícula, ver punto siguiente). "Todo agresivo, incluido
el ataque explícito, exige colisión de celda real" y "sin ZonePoint real, nunca fuerza combate"
(tratarlo como lejos, no un fallback permisivo) — decisiones explícitas de la usuaria. Dos
excepciones: sin posición conocida del jugador (fallback seguro, sin cambios) y el candidato de
INTERRUPCIÓN DE VIAJE (nunca se filtra — "el viaje no implica ninguna zona").

Sembrados los `ZonePoint` que faltaban para no romper casos guionizados: Orco Enfurecido y Gistera
Koh (Hondonada del Eco) + 11 Maestros de oficio del Clan Serhu — 12 puntos nuevos, 90 `ZonePoint`
totales tras `seed-catalog`. Corrección de diseño de la usuaria en el camino: "todo debe tener
ZonePoint... sino ¿cómo interactúas?" — no es solo requisito del gate de combate, cualquier NPC
relevante en escena necesita posición real para ser objetivo de Interactuar. 5 NPC sin
`homeLocationSlug` (regiones aún no sembradas) se dejaron sin ZonePoint a propósito, anotado en
memoria. Bug real corregido en el propio test: `recalcularZonePointsDeLocation` (ya existente, cada
turno) desactiva cualquier `ZonePoint` FAUNA/RECURSO sin `WorldPopulation` real asociada — el
fixture de test necesitaba esa fila, igual que cualquier `ZonePoint` de producción. 4 tests de
integración nuevos, verificación rigurosa (filtro desactivado, confirmado que 2/4 tests lo detectan,
restaurado), suite completa sin regresión, `tsc -b --force` limpio.

**Sistema de movimiento por cuadrícula en Zona/Interior — CERRADO completo (2026-09-08, misma
sesión).** Referencia de diseño explícita: "estilo Mount & Blade" — cada entidad en su celda,
cuando el jugador se mueve el mundo también avanza un paso, encuentro por colisión de celda.
Cuadrícula 16×12 (celdas de 50px) sobre el lienzo 800×600. Movimiento por clic en el lienzo (nunca
coordenadas escritas), camino calculado por el motor (Bresenham). Doble umbral: misma celda =
colisión real/inevitable, celda adyacente = solo aviso previo de Interactuar. Fauna/NPC con ruta
artesanal definida (`ZonePoint.ruta`, nuevo campo) la recorren en bucle; sin ruta, fallback de
paseo aleatorio acotado a su territorio de catálogo (`origenX/Y`, nuevo campo) — nunca
completamente estático. Grupos de tamaño variado por especie/Location vía fórmula de reparto en
capas descendentes (4→3→2→1), validada con los propios números que pidió la usuaria.

Backend: 3 migraciones (`ZonePoint.ruta`/`pasoRuta`/`origenX/Y`, `Save.zonaCaminoPendiente`),
núcleo puro en `zonaPosicion.ts` (50 tests, 2 bugs reales detectados/corregidos por los propios
tests), `avanzarZonePointsUnPaso` (`zonePoints.ts`), endpoint `POST /saves/:id/zona/mover` (5 tests
de integración real, usando un NPC AGRESIVO real como el ejemplo original de la usuaria — "cueva de
Kirelon"). Frontend: clic real en `ZonaPanel.tsx` (conversión de coordenadas SVG vía
`getScreenCTM`), animación paso a paso con cancelación por token, mensaje simple de colisión/aviso
(placeholder consciente, "acabaremos metiendo una animación"). Verificado en vivo con Playwright
contra una partida real: el marcador se desplaza visiblemente y aterriza en el centro exacto de una
celda.

Conectado con Franja 3 (ver punto anterior) — el gate de colisión de celda para combate real ya usa
este sistema, cerrando el último eslabón pendiente del plan "Interactuar" de esta sesión.

**Franja 4 — Charlar con NPC enriquecido (lore, reclutar/interrogar tras Clemente) — aparte,
mapeado no implementado**, decisión ya tomada explícitamente por la usuaria antes de empezar la
implementación de esta ronda.

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

**Diseño con alcance ya definido, solo falta implementar** (1, no 4 — "Matar" ya se cayó de esta
lista, `questSlug` se cerró el 2026-09-03, y el balance del primer combate se cerró hoy, ver abajo):
- ✅ **CERRADO (2026-09-04) — Balance del primer combate (Orco Enfurecido/misión Gistera)**: tras 8
  turnos de intercambio en un combate real, ni aseguraba victoria ni se sentía "asequible" para un
  tutorial de facto de nivel 1. Investigado a fondo el motor de combate 1v1: usa tramos puros por
  golpe conectado (Ileso→Herido→Grave→Convaleciente→Muerto, sin daño variable) sobre un check
  opuesto d20 con margen amplio de "sin efecto" — con stats parejas, el combate se alarga de forma
  matemáticamente esperable (no había ningún bug de código, el único mando de diseño real es
  stats/equipo del NPC). De paso se detectó un efecto colateral no intencionado: la recalibración
  de `amuleto-hueso` del 2026-09-02 (por motivos de lore, nada que ver con este combate) le dio al
  orco +1 voluntad efectiva que no tenía cuando se decidió el nerf original de 2026-07-29. **Fix**:
  `worldCatalog.ts` — fuerza/constitución bajadas -2 cada una (6/5, las que de verdad pesan en su
  tirada), `amuleto-hueso` retirado del `loadout` y del saqueo (petición explícita: "se supone que
  la maza y el amuleto se consiguen porque lo vences" — quitarlo de equipo sin quitarlo también del
  loot habría sido incoherente), sustituido por `vendaje-improvisado-orcos-llanuras` +
  `racion-carne-ahumada` (curativo + comida, coherente con "guerrero de campaña real", no solo
  trofeos). Ver la fórmula general de loot de NPC anotada en `docs/ampliar-lore.md` § equipo/loot,
  aplicada aquí por primera vez. Pendiente de reverificar en vivo el combate completo tras el
  próximo reinicio.
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
