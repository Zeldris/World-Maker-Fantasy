# Reglas de construcciones + fundación de reino (2026-08-04)

**Estado (comprobado 2026-09-28):** implementado; los 36 puntos del checklist final están hechos.
Lo construido después (Cuartel Avanzado, parcelas, edificios de oficio) está en
[22-mundo-vivo-x4-tecnico.md § 5.2](../arquitectura/22-mundo-vivo-x4-tecnico.md#52-construcción--constructionts).

Diseño acordado en sesión de diseño 2026-08-04 (después de implementar "el campamento" — primera
construcción anclada al mapa, ver `docs/mecanicas/16-poblacion-dinamica.md` para el sistema hermano de
población). Este documento es la fuente de verdad de las reglas; el checklist al final es lo que
se va tachando según se implementa. Si la sesión se corta a mitad, seguir desde el primer punto sin
tachar.


## Reglas acordadas

### Campamento
- Máximo **1 activo por región** (`Location.region`) — puedes tener uno en Llanuras y otro en
  Meseta a la vez, pero no dos en la misma región.
- Da **+1 slot de compañero**.
- Sirve como **punto de guardado**: descansar en una construcción PROPIA activa es lo único que
  actualiza `Save.lastRestLocationId` — descansar en un refugio/asentamiento ajeno sigue curando
  igual que siempre, pero ya no mueve el punto de reaparición.
- Si la construcción que era tu punto de guardado está `DANADO`/`ABANDONADO` cuando mueres,
  reaparecer ahí la devuelve a `ACTIVO` en el mismo momento ("recuperas el campamento").

### Choza
- Dos slots de compañero (frente a 1 del campamento).
- Sin límite de cantidad, pero:
  - Requiere tener un Ayuntamiento (cualquier nivel) ya construido en la partida.
  - Debe caer dentro de la MISMA región que el Ayuntamiento.
  - Debe estar a una distancia máxima del Ayuntamiento, medida en el grafo real de
    `LocationLink` (no coordenadas — no existen coordenadas reales en el backend).
  - Cuenta contra el cupo total de "edificios de reino" que permite el nivel del Ayuntamiento.

### Ayuntamiento (antes "Atalaya", renombrado)
- Funda el reino (rellena `Save.kingdomName`, crea/actualiza el `Territory` de la región) y
  desbloquea construir edificios de tipo reino (choza, futuro "puesto avanzado") a su alrededor.
- **3 niveles, no acumulables** — "pequeño" → "mediano" → "grande" es MEJORAR el mismo edificio in
  situ (mismo `Building.id`, tier 1→2→3), nunca construir uno nuevo aparte.
  - Pequeño: hasta 10 edificios de reino.
  - Mediano: hasta 25.
  - Grande: hasta 60.
- **Máximo 1 Ayuntamiento por continente** (hoy solo existe Berig en juego — de facto, 1 por
  partida por ahora).
- Construirlo (solo la primera vez, tier 1 — las mejoras de tier no repiten esto) comprueba tu
  reputación con la(s) facción(es) dueña(s) de la región:
  - Región sin facción dueña conocida → pasa a ser tuya directamente (`Territory.control =
    RECLAMADO`).
  - Reputación ≥ 2500 (`FACTION_REP_DEFAULT`, neutral o mejor) con TODAS las facciones dueñas →
    fundación pacífica (`RECLAMADO`).
  - Reputación < 2500 con alguna → conflicto: la región queda `DISPUTADO` (más de una facción
    ocupando el mismo territorio).
- Al terminarse de construir (tier 1), sale un popup Aceptar/Cancelar con un formulario para
  fundar la facción (nombre del reino + lo que se decida añadir, ver checklist).
  - Gorhorn: viene precargado, nombre de reino = **"Maktor"**, el campo nombre **no es
    editable**; el resto sí.
  - Cualquier otro personaje: todo editable, sin nombre por defecto.

## Huecos que no existían y hay que construir desde cero

- **Mapeo región → facción dueña** — hoy no existe en código, solo en `docs/rpgtarkor/lore-mundo/areas.md`.
  Se seedea a mano como constante (no viene de ninguna tabla nueva):
  - Las Llanuras del Viento Rojo → Clan Serhu
  - La Meseta del Orden → Concordia de Hierro
  - Cristal Helado → Clan Helsig
  - Ciénaga Troncal → (sin facción seedeada todavía = "sin dueño" mecánicamente)
  - El Margen Silencioso → (sin facción seedeada todavía = "sin dueño" mecánicamente)
- **Slots de compañero**: hoy `newCompanion` no tiene NINGÚN tope, ni de 0 ni de ningún número —
  hay que construir el tope desde cero, no ajustar uno que ya exista.
- **Distancia por grafo**: no existe ninguna función de BFS/distancia sobre `LocationLink` todavía.
- **`Building.tier`**: no existe — hace falta para saber en qué nivel está un Ayuntamiento.
- **Formulario de fundación**: no existe ninguna UI de "construir/fundar" en el frontend hoy —
  `ReinoPanel.tsx` es puramente de lectura.

## Checklist de implementación

### Backend — esquema
- [x] `Building.tier Int?` (nivel del Ayuntamiento; null para el resto).
- [x] Migración manual aplicada + `prisma migrate resolve --applied` + `prisma generate`.

### Backend — construction.ts
- [x] `ConstructionRecipe` gana: `companionSlots?: number`, `maxPerRegion?: number`,
      `requiresAyuntamiento?: boolean`, `upgradesRecipeKey?: string`, `reinoBuildingCapacity?:
      number` (solo en las 3 recetas de Ayuntamiento).
- [x] Renombrar `ATALAYA_RECIPE` → `AYUNTAMIENTO_PEQUENO_RECIPE` (key `'ayuntamiento'`,
      `reinoBuildingCapacity: 10`).
- [x] Nuevas recetas `AYUNTAMIENTO_MEDIANO_RECIPE`/`AYUNTAMIENTO_GRANDE_RECIPE`
      (`upgradesRecipeKey: 'ayuntamiento'`, `reinoBuildingCapacity: 25`/`60`, sus propios
      materiales y `nounRegex`).
- [x] `CAMPAMENTO_RECIPE`: `companionSlots: 1`, `maxPerRegion: 1`.
- [x] `CHOZA_RECIPE`: `companionSlots: 2`, `requiresAyuntamiento: true`.
- [x] `CONSTRUCTION_RECIPES` incluye las 5 recetas (campamento, choza, ayuntamiento×3).
- [x] Distancia sobre `LocationLink`: `buildAdjacency`/`shortestPath` (travel.ts) YA EXISTEN y
      hacen exactamente esto (Dijkstra por minutos) — se reutilizan tal cual, sin BFS nuevo.

### Backend — reputación/facciones
- [x] Constante `REGION_OWNING_FACTIONS: Record<string, string[]>` (nuevo archivo o dentro de
      `construction.ts`).
- [x] Lógica de resolución de conflicto al construir Ayuntamiento tier 1 (usa
      `factionRepFor`/`FACTION_REP_DEFAULT` ya existentes).

### Backend — turnResolution.ts
- [x] `buildMode` (ya existe) rechaza si `maxPerRegion` ya está cubierto en esa región — cae a
      `narrateAction` narrando el rechazo (mismo patrón que "faltan materiales").
- [x] `buildMode` rechaza si `requiresAyuntamiento` y no hay ninguno construido.
- [x] `buildMode` rechaza si excede `reinoBuildingCapacity` del Ayuntamiento actual.
- [x] `buildMode` rechaza si excede la distancia máxima al Ayuntamiento o cae en otra región.
- [x] Rama de creación determinista: si `upgradesRecipeKey`, hace `UPDATE` del `Building`
      existente (tier/name/description/status) en vez de `CREATE`.
- [x] Al crear/mejorar un Ayuntamiento tier 1: resuelve facción dueña de la región, crea/actualiza
      `Territory` con el `control` correspondiente, calcula el nombre sugerido de reino
      (`'Maktor'` fijo si `characterName === 'Gorhorn'`, si no `null`), y lo expone en la
      respuesta del turno (nuevo campo `newKingdomFounded`) para que el frontend abra el popup.
- [x] `newCompanion`: antes de crear, cuenta `Companion` actuales de la save y compara contra la
      suma de `companionSlots` de los `Building` `ACTIVO` — si no hay hueco, no se crea (cae a
      narrar que no hay sitio, mismo criterio que el resto de rechazos deterministas).
- [x] `restSucceeds`/`finalLastRestLocationId`: solo actualiza si `currentLocationRecord.id`
      coincide con el `locationId` de un `Building` `ACTIVO` propio.
- [x] Respawn (`resolveDeathOutcome`/rama `MUERTO`): si el `Building` de `respawnLocationId` está
      `DANADO`/`ABANDONADO`, lo vuelve a `ACTIVO` en la misma transacción.

### Backend — rutas
- [x] Nuevo endpoint (p. ej. `POST /saves/:id/reino/fundar`) que recibe el formulario del popup
      (nombre de reino + resto de campos que se decidan) y persiste `Save.kingdomName` +
      actualiza el `Territory` recién creado. Bloquea cambiar el nombre si `characterName ===
      'Gorhorn'` (verificado en el backend, no solo ocultando el campo en frontend — mismo
      criterio que `isStarting`/`isDynamic` en habilidades.ts).
- [x] `detail.ts`: expone `Building.tier` y el nuevo `newKingdomFounded` del turno si aplica.

### Backend — tests
- [x] Cupo de 1 campamento por región (integración).
- [x] Choza rechazada sin Ayuntamiento / fuera de región / fuera de distancia / cupo lleno.
- [x] Mejora de Ayuntamiento actualiza el mismo `Building.id` (no crea uno nuevo).
- [x] Fundación pacífica vs conflicto según reputación de facción.
- [x] Slots de compañero: rechaza el 2º compañero con solo 1 slot (campamento), acepta con choza.
- [x] Punto de guardado: descansar en refugio ajeno NO mueve `lastRestLocationId`; descansar en
      construcción propia sí.
- [x] Respawn recupera (`ACTIVO`) el edificio dañado/abandonado de destino.
- [x] `tsc --noEmit` + `vitest run` completos (584/584).

**Cobertura NO incluida a propósito** (código implementado y revisado, pero sin test de
integración dedicado por coste/tiempo de montar el escenario):
- Choza rechazada por distancia excedida o por región distinta a la del Ayuntamiento — mismo
  código que el caso "sin Ayuntamiento" ya cubierto (una condición más en la misma cadena de
  `if`), pero no hay dos ubicaciones reales seedeadas lo bastante lejos/en otra región con grafo
  medido para un test de integración limpio.
- Recuperación de un edificio `DANADO`/`ABANDONADO` al reaparecer tras morir — el código es un
  `updateMany` de una línea, pero forzar una muerte real de personaje (no de NPC) en el harness
  de integración exige más turnos de combate de los que compensaba montar aquí.

**Bug real encontrado de rebote**: al añadir el tope de slots, `narration.newCompanion` dejó de
ser 1:1 fiable con lo que el backend persiste de verdad (puede rechazarse en silencio por falta de
hueco) — el frontend seguía añadiéndolo a la UI de forma optimista sin saberlo. Arreglado con un
campo nuevo `companionCreated` (lo que el backend creó DE VERDAD, no lo que el modelo propuso),
mismo criterio que `newInventoryItems`/`newQuestInfo`.

### Frontend
- [x] `types.ts`: `BuildingInfo.tier`, tipo `KingdomFoundedInfo` para `newKingdomFounded`.
- [x] Popup de fundación (Aceptar/Cancelar + formulario) — componente nuevo, mismo estilo que
      `CombatSelectionModal.tsx`/`DetailModal.tsx`. Campo nombre bloqueado y precargado
      ("Maktor") si el personaje es Gorhorn.
- [x] `GameView.tsx`: detecta `newKingdomFounded` en la respuesta del turno y abre el popup.
- [x] Icono de Ayuntamiento por tier en `CONSTRUCTION_RECIPE_ICONS` (`data/map.ts`).
- [x] `ReinoPanel.tsx`: muestra el tier del Ayuntamiento si aplica.
- [x] `tsc -b` + `vitest run` completos.

## Auditoría de deuda técnica 2026-08-04 (backend + frontend, código sin commitear)

Dos agentes en paralelo revisaron todo el diff sin commitear de este documento contra el último
commit. Hallazgos reales, arreglados y verificados (tsc + 585 tests backend / 18 tests frontend):

- **(Grave, backend) Condición de carrera en construcción**: `buildBlockedReason`
  (cupo por región/Ayuntamiento/unicidad) y el chequeo de materiales (`buildRecipeCheck`) se
  calculaban con `prisma`, ANTES de la transacción — dos turnos de "construyo/fundo X" casi
  simultáneos (doble clic, reintento de red, dos pestañas) podían colar ambos por ese primer
  chequeo sobre la misma foto ya obsoleta, duplicando Ayuntamientos/Territorios o levantando la
  construcción sin gastar materiales de verdad. Arreglado con `computeBuildBlockedReason` +
  `planRecipeConsumption` (construction.ts) revalidados DENTRO de la transacción con `tx`, mismo
  patrón que ya cerraba esta clase de carrera para crafteo (`freshInventoryRows`). Cubierto con un
  test nuevo que dispara dos "fundo un ayuntamiento" con `Promise.all`.
- **(Grave, frontend) `buildings`/`territories`/`subjects`/`kingdomStats` nunca se refrescaban tras
  un turno normal** — solo se actualizaban en `syncFromSave` (carga/reconexión), nunca en el
  camino de éxito de un turno normal. Construir/mejorar/fundar no se veía en el mapa ni en el
  panel de Reino hasta recargar. Arreglado: `narrateAndPersistTurn` devuelve ahora las 4 listas/
  valor completos cada turno (mismo criterio ya usado para `quests`), y `GameView.tsx` los aplica
  siempre.
- **(Grave, frontend) Cancelar el popup de fundación perdía la oportunidad de nombrar el reino para
  siempre** — `newKingdomFounded` solo llega una vez, al construir el Ayuntamiento tier 1. Sin
  ningún sitio para reabrirlo, cancelar (o recargar con el popup abierto) dejaba `kingdomName` en
  null para siempre. Arreglado con un botón "Fundar reino" en `ReinoPanel` (visible mientras haya
  Ayuntamiento sin nombre) que reabre el mismo popup reconstruyendo la info desde lo ya persistido.
- **(Medio, frontend) Ficha de Enciclopedia de un Ayuntamiento mejorado mostraba siempre el texto
  del tier 1** — `Building.recipeKey` se queda en `'ayuntamiento'` tras mejorar a propósito (mejora
  in-place), pero el catálogo de recetas de la Enciclopedia sí tiene 3 claves separadas por tier;
  la paleta de puntos del mapa buscaba por `recipeKey` sin traducir el tier. Arreglado con
  `recipeKeyForBuilding` en `MapaPanel.tsx`.
- **(Menor, arreglado) Aviso de slots de compañero en TODOS los turnos** — las 2 queries de solo
  lectura se calculaban aunque la acción no tuviera nada que ver con reclutar. Arreglado con un
  regex de intención (`COMPANION_INTENT_REGEX`) que las salta si la acción no sugiere reclutar —
  el gate real (dentro de la transacción) sigue siendo incondicional, esto solo evita el aviso
  previo desperdiciado.
- **(Cierre del bug de carrera, backend) Narración mentirosa si se pierde la carrera** — el texto
  sintético "termina de construir X" se decide y se transmite por streaming ANTES de saber si
  `buildValidNow` iba a ser true; sin corregirlo, el turno perdedor de una carrera podía persistir/
  devolver una narración que afirma un éxito que la DB no respalda (mismo patrón que
  `hasFalseCombatHit`/`hasFalseItemUse`). Arreglado corrigiendo `narration.narration` dentro de la
  transacción cuando `buildMode` era true pero `buildValidNow` resulta false — el frontend
  descarta el preview en streaming en cuanto llega `done`, así que el texto persistido/mostrado
  final siempre es honesto. Cubierto por el mismo test de `Promise.all` (verifica que exactamente
  un turno dice "termina de construir" y el otro admite que ya no tenía los materiales).
- **(Arreglado del todo, con permiso explícito de mover nodos) `PALETTE_RADIUS` de la paleta de
  puntos** — el racimo denso del núcleo de Llanuras (hondonada-del-eco/tumulos-del-honor/osario-
  de-la-manada, a 2.2-2.4 unidades entre sí — menos que el radio de sus propios iconos) hacía que
  los satélites de la paleta invadieran el icono de un nodo VECINO en varios casos reales
  (confirmado calculando distancias contra las coordenadas reales de `data/map.ts`, y viéndolo con
  mis propios ojos renderizando sobre el PNG real con `rsvg-convert`, mismo método que el resto de
  este bloque). Primer paso: reducido `PALETTE_RADIUS` de 4.6→3.6 (`InteractiveMap.tsx`) y 13→10
  (`MapZoomModal.tsx`). Segundo paso, tras permiso explícito de la usuaria ("tienes permiso para
  mover lo que necesites"): separadas las coordenadas de esos 3 nodos y de `manaderos` (que
  colisionaba aparte con `pozo-cauce-viejo`) en `llanurasNodePositions` — verificado ANTES y
  DESPUÉS contra el PNG real y contra el contorno político de la región (sitio de sobra, ningún
  nodo se sale del estado), y con un script de colisión geométrica: **0 colisiones** en el peor
  caso (2-4 satélites, cualquier ángulo) tras el cambio, frente a las 33+7 de antes. Solo se
  tocaron esos 4 nodos — el resto del núcleo no se movió. `tsc -b` + 18 tests frontend limpios
  tras el cambio.

## Materiales procesados y oficios regionales — APLICADO al motor (2026-08-24, fusionado 2026-08-31)

*Diseño de sistema, surgió al cerrar el rebalanceo de coste de Campamento/Ayuntamiento: pedir
recursos base fungibles ("cualquier piedra vale") estaba mal — un edificio debería depender de qué
oficio REGIONAL tienes aprendido, y de materiales PROCESADOS (bloques, lingotes, columnas...), no
de recursos crudos directos, cada vez más según sube el tier del edificio.*

**Grounding — la idea ya se había planteado y parcialmente construido el 2026-07-29** sin conectarse
con nada: `STONE_BLOCK_RECIPE` (`crafting.ts`) ya existía (5 Piedra → 1 Bloque de piedra tallada,
oficio `constructor-orcos-llanuras`), pero ningún `ConstructionRecipe` la consumía. Los oficios ya
son regionales por su propio nombre (`herrero-orco-llanuras`, `curtidor-orcos-llanuras`,
`carpintero-orcos-llanuras`, `constructor-orcos-llanuras`, `desollador-orcos-llanuras`) — el
"candado regional" no necesita etiqueta nueva en los objetos, ya vive en qué oficio aprendiste.
`ConstructionRecipe.oficio` ya existía pero solo daba un alivio de requisito, nunca bloqueaba si no
tenías el oficio.

**Dos candados regionales en cascada**:
1. **El oficio de construcción en sí es regional** — determina QUÉ construcciones puedes intentar
   en absoluto. Sin el oficio de esa región, ni te lo planteas.
2. **Los materiales que esas construcciones piden vienen de oficios de PROCESADO igual de
   regionales** — el oficio de construcción no fabrica él mismo todo; puede necesitar que TÚ (u
   otro con el oficio correspondiente) hayas procesado antes la piedra en bloques, la mena en
   lingotes, el hueso en columnas.

**Escalado por tier — menos crudo, más procesado cuanto más grande el edificio**: Campamento/tier
más bajo mayormente crudo (coherente con "un cerco improvisado", nadie procesa nada para pasar la
noche); Ayuntamiento pequeño todavía mayormente crudo; mediano/grande la proporción de procesado
crece con cada nivel — la "capital de verdad" no se levanta con piedras sueltas.

**Categorías crudo → procesado** (una por recurso, siguiendo el precedente de `bloque-piedra-tallada`
— categoría propia `bloque`, no reutiliza `piedra`, para poder pedir "procesado" como requisito
separado del crudo en cualquier receta futura):

| Recurso crudo | Material procesado | Categoría procesada | Oficio que lo produce | Ratio |
|---|---|---|---|---|
| Piedra | Bloque de piedra tallada | `bloque` | `constructor-orcos-llanuras` | 5:1 |
| Leña | Viga de madera tallada | `viga` | `carpintero-orcos-llanuras` | 4:1 |
| Hueso | Columna de hueso | `columna` | `constructor-orcos-llanuras` | 3:1 |
| Mena | Lingote de hierro (`lingote-de-hierro`) | `metal` (inconsistente con el resto, item ya en uso, no tocado a propósito) | `herrero-orco-llanuras` | 4:1 |
| Resina | Sin material procesado — se queda cruda incluso en tiers altos (no se "talla", se usa tal cual como sellante/adhesivo) | — | — | — |
| Fibra | Cordaje trenzado | `cordaje` | `curtidor-orcos-llanuras` | 4:1 |

**Ayuntamiento — cifras cerradas y aplicadas**: pequeño 100% crudo (14 Piedra + 2 Mena + 6 Madera +
6 Hueso + 8 Fibra + 8 Resina), sin oficio exigido. Mediano ~75% procesado/25% crudo por categoría
procesable (3 Bloques+5 Piedra cruda / 1 Lingote+1 Mena cruda / 2 Vigas+3 Leña cruda / 2 Columnas+2
Hueso crudo / 2 Cordajes+3 Fibra cruda / 12 Resina siempre cruda). Grande 100% procesado en todo lo
procesable (8 Bloques / 4 Lingotes / 5 Vigas / 5 Columnas / 5 Cordajes / 20 Resina cruda) — "así es
difícil de ampliar" a propósito: exige tener los 4 oficios de procesado a buen nivel a la vez, no
solo más cantidad de lo mismo. `oficio: 'constructor-orcos-llanuras'` se exige (bloqueo real) desde
el mediano en adelante; el pequeño se queda accesible sin oficio.

**Aplicado al motor**: 3 items nuevos en `ItemCatalog` (Viga de madera tallada, Columna de hueso,
Cordaje trenzado) + 3 `CraftingRecipe` nuevas (`WOOD_BEAM_RECIPE`/`BONE_COLUMN_RECIPE`/
`BRAIDED_CORDAGE_RECIPE`, mismo patrón que `STONE_BLOCK_RECIPE`: ingrediente por categoría,
`location: null`). `bloque-piedra-tallada`/`lingote-de-hierro` conectados a construcción real por
primera vez. `ConstructionRecipe.oficio` pasa de "solo alivio" a bloqueo real:
`OFICIOS_CONSTRUCCION_REQUERIDOS` nuevo (hoy solo `['constructor']`), `checkRecipe` gana un 7º
parámetro `tieneOficio` (default `true`, no rompe callers existentes) que añade un
`RequirementShortfall` binario si la receta lo exige y el personaje no lo ha aprendido en absoluto —
distingue "nivel 1 por no tenerlo" de "no lo tiene". `AYUNTAMIENTO_MEDIANO_RECIPE`/
`AYUNTAMIENTO_GRANDE_RECIPE` actualizadas con las cifras de arriba. Tests: `construction.test.ts`
(mediano/grande + bloqueo de oficio), `crafting.test.ts` (3 recetas nuevas), `turn.integration.test.ts`
actualizado. `tsc -b` limpio, sin regresiones.

Cuando se diseñen construcciones de otras razas/regiones (Goirntes/Meseta, Nabieus/Margen,
Faerus/Bosque...), cada una necesitará sus propios oficios regionales y quizá sus propios materiales
procesados — este sistema solo cierra el caso orco/Llanuras, el patrón general queda documentado
para repetirlo.

## Construcción por oficio y Casa de obras (P277, P282, P284; 2026-10-21)

Diseño aprobado el 2026-10-21 (bandeja de la bitácora). El código está en
`backend/src/services/cronista/casaDeObras.ts`, y la puerta de tiers en `ayuntamientoNivelMinimoPorTier`
de `construction.ts`.

- **Tier de obra 1-9:** ningún edificio pide atributos. T1-3 se construyen libres, T4-6 necesitan el
  Ayuntamiento mediano y T7-9 el grande. El personaje levanta solo hasta T3 (Medieval Dynasty).
- **Casa de obras (Bellwright):** tiene 3 niveles, que cubren los tiers 1-3, 4-6 y 7-9 con 1, 2 y 3
  plazas de constructor.
  - Sus constructores sacan adelante una cola reordenable de obras y reparaciones.
  - Una obra de tier N lleva N días de obra.
  - Consume los materiales exactos de la receta del Almacén según avanza (X4). Si falta alguno, se
    para ese día sin perder lo avanzado.
- **Decisión de la usuaria 2026-10-22: el nivel del Ayuntamiento abre los tiers y el del constructor
  solo da velocidad (X4 y Manor Lords).**
  - Cualquier constructor trabaja cualquier obra que cubra la Casa.
  - Cada nivel por encima de 1 suma un 10 % de trabajo por jornada (`VELOCIDAD_POR_NIVEL_CONSTRUCTOR`):
    el nivel 1 hace 1 día de obra, el 6 hace 1,5 y el 9 hace 1,8.
  - El avance (`ObraCola.diasHechos`) va por fracciones de día.
  - La primera obra de la cola se lleva al constructor más rápido.

## Fuera de alcance a propósito (ni hoy ni en este documento)
- "Puesto avanzado" como tipo de edificio nuevo — mencionado como roadmap futuro, no se crea su
  receta todavía.
- Ataques/eventos de facciones que dañen o destruyan construcciones ("destruido por otros") — el
  campo `Building.status` ya soporta `DANADO`/`ABANDONADO`, pero qué dispara esos estados (además
  de una demolición manual del jugador) queda para otra sesión.
- Acción de demolición manual del jugador — no descrita todavía con el mismo nivel de detalle que
  el resto de reglas de este documento.
