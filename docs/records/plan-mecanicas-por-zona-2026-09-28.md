# Plan — lo que funciona por zona se hace desde la zona (2026-09-28)

Origen: hallazgos B25/B26 de `pruebas-nube-2026-09-28-hallazgos.md`. Petición de Álvaro: "lo que
funciona por zona no necesita habilidades, sino que funcione desde zona — no mezclar mecánicas".

Reparto: plan escrito por Opus; cada fase la implementa un subagente Sonnet; Opus revisa el diff,
corre tests, verifica en vivo con Playwright y hace el commit en `claude/wonderful-volta-662qt8`.

## Estado de partida (medido)

- Botones Cazar / Minar / Talar / Recolectar hierbas / Recoger → `cazar/*` y `recolectar/*` →
  `candidateFaunaFor` / `candidateSourcesFor`: **población regional**, sin mirar `ZonePoint` ni la
  posición del jugador. El gate de cercanía `zonePointMasCercano` (zonaPosicion.ts) no lo usa nadie.
- Zona: `/zona/mover` → colisión con `ZonePoint` FAUNA/NPC/RECURSO → oferta Interactuar. RECURSO ya
  recolecta de verdad (`dynamicModeRecurso.ts` → `resolverRecoleccion`, mismas reglas que el botón).
- Grupos: `repartirEnGrupos` (zonaPosicion.ts) sin ningún caller; cada especie es UN punto topado a
  ×20 (`CANTIDAD_MAX_POR_PUNTO`, zonePoints.ts).
- Cobertura del mapa en Las Llanuras del Viento Rojo (núcleo jugable, 29/30 Locations con puntos):
  sin ningún punto en la región — CAZA: aullador-rojo, canizor, celubia-palida, corredor-de-cauce,
  gargantua-de-ceniza, terkash, tura-jusha, zense-ceniza · TALA: telda-atardecer, telda-comun ·
  MINERIA: roca-luclara, rovalnica · EXTRACCION: espiga-roja, junba-verde-resina-fuente,
  resina-lucre-blanco-fuente, resina-telda-atardecer-fuente, resina-telda-fuente · PESCA:
  jashil-rojo, jashil-verde, negueo-solar, negueo-turquesa, toluh · BUSQUEDA: bulco-de-arena.
  (Otras regiones — Ciénaga, Cristal Helado, Margen, Meseta — casi sin puntos: fuera del núcleo
  jugable actual, NO entran en este plan.)

## Fase 1 — Grupos de fauna reales en el mapa (B26)

**Objetivo:** cada especie de fauna de una Location se ve como varios puntos (grupos de 1-4) cuya
suma es la cantidad de esa especie, no un único ×20.

- `zonePoints.ts` § `recalcularZonePointsDeLocation`: para FAUNA, reconciliar por
  (locationId, targetSlug): total actual = suma de `cantidad` de sus filas; objetivo y ajuste
  gradual igual que hoy (`proximaCantidadPara` aplicada al total). Si el total sube → añadir grupos
  nuevos con `repartirEnGrupos(diferencia)`; si baja → restar primero de los grupos más pequeños y
  borrar filas que queden a 0 (la fila "ancla" curada de catálogo — la de `label` no nulo o la más
  antigua — nunca se borra, se deja `activo:false`). Primer reparto (ninguna fila con
  `lastUpdatedAtMinutes`): `repartirEnGrupos(objetivo)` completo. RECURSO sin cambios (un punto con
  cantidad).
- Filas nuevas de grupo: mismo `targetSlug`/`tipo`/`plantillaEspecifica` que el ancla, `label`
  null, `origenX/Y` = celda libre cercana al origen del ancla (radio ≤2 celdas, determinista,
  sin pisar otro punto), `x/y` = ese origen.
- `GET /saves/:id/zona`: si algún punto FAUNA de la Location tiene `lastUpdatedAtMinutes` null,
  llamar a `recalcularZonePointsDeLocation` antes de responder (hoy solo corre al jugar un turno de
  texto, así que una partida nueva vería el ×20 hasta el primer turno).
- Encuentro (`zona.ts` § `detectarEncuentroEnCelda`): la oferta lleva `zonePointId` y `cantidad`
  del punto concreto; el texto del LogEntry dice "un grupo de N {nombre}" cuando N>1. Frontend:
  `MoverZonaResultado.dynamicModeOffer` y `LogEntry.dynamicModeOffer` con esos campos opcionales;
  título de la tarjeta "Un grupo de 3 Gesgurio" cuando cantidad>1.
- Tests: unit de la reconciliación (sube/baja/primer reparto/ancla nunca borrada); integración de
  `GET /zona` devolviendo varios puntos de la misma especie con suma correcta.

## Fase 2 — Cazar desde la tarjeta de encuentro (B25a)

**Objetivo:** al toparte con fauna, la tarjeta ofrece **Cazar** (además de Interactuar/Ignorar) y
caza a ESE grupo; un agresivo en grupo abre combate múltiple con todo el grupo.

- Extraer el núcleo de `POST /saves/:id/cazar/confirmar` (cazar.ts) a un servicio reutilizable
  `iniciarCaza({ save, npc, cantidadObjetivo, zonePointId? })`: caza limpia (1 presa débil) o
  combate — 1v1 (`pendingCombatNpcSlugs`) si 1 individuo, combate múltiple
  (`iniciarCombatEncounter`) si >1, mismas reglas actuales (`rollGroupEngagement`, compañeros del
  grupo 1, fragmentos autónomos, dispersión). Al empezar, el `ZonePoint` pierde los individuos
  enfrentados (`cantidad -= enfrentados`, `activo:false` si llega a 0).
- Ruta nueva `POST /saves/:id/zona/cazar` `{ zonePointId }`: exige que `pendingDynamicModeOffer`
  apunte a ese `zonePointId` (solo se caza lo que tienes al lado), limpia la oferta, llama a
  `iniciarCaza` con la `cantidad` del punto. Misma forma de respuesta que `cazar/confirmar`.
- Agresivo en grupo: `abrirCombateForzadoDesdeInteractuar` (dynamicMode.ts), con `cantidad>1`,
  usa `iniciarCaza` (combate múltiple con todo el grupo) en vez del 1v1.
- Frontend: `LogPanel.tsx` OfferCard FAUNA no forzada → acciones Interactuar / **Cazar** / Ignorar;
  `GameView.tsx` handler que reutiliza el mismo tratamiento de resultado que hoy tiene
  `HuntSelectionModal.onConfirm` (caza limpia → LogEntry; combate → `combat.openCombat`/turno).
- Tests de integración de la ruta nueva (sin oferta → 409; punto de 1 débil → caza limpia; grupo
  de 3 → CombatEncounter con 3 enemigos y ZonePoint descontado).

## Fase 3 — Cobertura del mapa en Las Llanuras (B25b, datos)

**Objetivo:** toda fuente cazable/recolectable presente en Las Llanuras tiene al menos un
`ZonePoint` en alguna Location de la región compatible con sus reglas.

- `worldCatalog.ts` § `zonePoints`: añadir las 23 fuentes de la lista de arriba, cada una en 1-2
  Locations de Las Llanuras que pasen el MISMO filtro que ya usa `candidateSourcesFor`/
  `candidateFaunaFor` (región + `locationTerrainTags`×`faunaTerrainTag`/`harvestSourceTerrainTag` +
  `harvestSourceHomeLocationSlug` + `homeLocationSlug` de Npc). Pesca/Búsqueda como `tipo: RECURSO`
  en zonas de agua (p.ej. `playa-de-ceniza-blanca`). Resinas junto al punto de su árbol. Coordenadas
  provisionales (marcadas igual que la ampliación 2026-08-31), sin pisar puntos existentes (≥60px).
- Test que haga cumplir la cobertura: para cada fuente con presencia en Las Llanuras
  (`WorldPopulation.distribucion` > 0), existe ≥1 `ZonePoint` en una Location de la región.
- NO tocar `docs/rpgtarkor/` (lore); solo datos de catálogo.

## Fase 4 — Retirar las habilidades que ya cubre el mapa

**Objetivo:** Cazar, Minar, Talar, Recolectar hierbas, Recoger, Pescar y Buscar dejan de existir
como botón; esas acciones solo se hacen desde la zona.

- Quitar esas habilidades del kit inicial (startingAbilities / harvestAbilities, lo que las siembre).
- Partidas existentes: ocultarlas en `HabilidadesPanel`/`SkillBarHud` (lista de nombres retirados,
  igual que `ABILITIES_REQUIEREN_MONTURA`), sin borrar filas.
- Frontend: quitar las entradas de `HARVEST_ABILITY_OFICIO`/`Cazar` en `handleAttachAbility`
  (GameView.tsx) y el montaje de `HuntSelectionModal`. `HarvestSelectionModal` se mantiene SOLO para
  Desollar (hasta la fase 5).
- Texto libre: el guard `harvestSuggestion` (turn.ts ~592) deja de ofrecer abrir el modal y pasa a
  "Busca {fuente} en el mapa de la zona" con botón que abre el modal de movimiento (🧭).
- Backend: `cazar/explorar`, `cazar/confirmar`, `recolectar/:oficio`, `recolectar/:oficio/explorar`
  quedan sin llamador → eliminarlos (y sus tests), conservando lo que use Desollar
  (`recolectar/confirmar` con oficio desollador). Revisar que ninguna otra pieza (worldTick,
  sugerencias) los llame.

## Fase 5 — Saquear y Desollar desde el mapa

**Objetivo:** los cadáveres con botín/despiece pendiente aparecen como pin en el mapa; al lado, el
pin ofrece Saquear/Desollar. Se retira el botón Saquear.

- Al morir un NPC/fauna en la Location actual (combate 1v1, múltiple o caza limpia), guardar la
  posición del cadáver (`NpcState.zonaPosX/Y` + `zonaLocationId`, ya existen) = posición del jugador.
- `GET /zona` → `cadaveres: { npcSlug, nombre, x, y, saqueable, desollable, alcanzable }[]`
  (mismos criterios que `saquear-zona` y `carcassCandidatesFor`).
- `ZonaPanel.tsx`: pin de cadáver (icono propio); clic → si alcanzable, modal con Saquear
  (reutiliza `SaquearZonaModal` filtrado a ese cadáver) y Desollar (reutiliza
  `HarvestSelectionModal` desollador filtrado); si no, camina hasta él (mismo patrón que salidas).
- Retirar el botón Saquear (misma lista de ocultos de la fase 4). El aviso de escena de Desollar
  se mantiene o apunta al pin.

## Fuera de este plan (decisiones pendientes de Álvaro)

- B1 posiciones de `ZonePoint` globales vs. por partida (los grupos heredan esa decisión).
- Viajar (deshabilitada, exige montura) — viaje largo desde el mapa de mundo.
- Cobertura del mapa fuera de Las Llanuras.
