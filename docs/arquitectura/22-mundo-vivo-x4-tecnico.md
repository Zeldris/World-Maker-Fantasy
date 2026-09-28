# Mundo vivo estilo X4 — referencia técnica

**Qué es:** la descripción de cómo funciona **hoy** en el código el mundo vivo: Reino del jugador,
facciones NPC, relaciones, diplomacia, mercado, producción, construcción por parcelas, población y
clima. También recoge qué está roto y qué está diseñado pero sin código.
**Qué no es:** el razonamiento de diseño. El porqué de cada decisión está en los documentos de
[`docs/rpgtarkor/sistemas-reino/`](../rpgtarkor/sistemas-reino/mundo-vivo-x4.md), que se enlazan en
cada apartado.
**Verificado contra el código:** 2026-09-28 (commit `15fe8b7`). Si algo de aquí choca con el
código, manda el código y este documento está desactualizado.

---

## 1. Estado de un vistazo

| Subsistema | Backend | Frontend | Tests | Estado real en partida |
|---|---|---|---|---|
| Modelo único jugador/facción (`saveId`/`factionId`) | ✅ | — | ✅ | Funciona |
| Tick diario del Reino del jugador (`tickKingdom`) | ✅ | ✅ Visión general | ✅ | Funciona |
| Construcción por parcelas (Capital) | ✅ | ✅ Modal de parcela | ✅ | Funciona |
| Cuartel Avanzado y sus mejoras | ✅ | ⚠️ solo por texto libre | ✅ | Funciona vía `/turn/narrate` |
| Edificios de oficio (14 × 3 niveles) | ✅ | ✅ vía parcelas | ✅ | Funciona |
| Órdenes de producción (`OrdenProduccion`) | ✅ | ✅ Producción | ✅ | **Inalcanzable**: nadie puede tener `rolReino` (§ 9, H-1) |
| Tope de almacén (`AlmacenLimite`) | ✅ | ✅ Producción | ✅ | Funciona, sin efecto hasta que haya producción |
| Relaciones entre facciones (`FactionRelation`) | ✅ | ✅ Mapa de relaciones | ✅ | Solo se mueven por el jugador (§ 9, H-3/H-4) |
| Diplomacia del jugador | ✅ | ✅ Diplomacia | ✅ | **Inalcanzable** (H-1) y sin progresión (H-5) |
| Mercado regulado jugador↔facción | ✅ | ✅ Mercado | ✅ | Vender sí; comprar casi nunca (H-2) |
| Población de facción (`WorldPopulation` → `KingdomStats`) | ✅ | — | ✅ | Funciona |
| Producción agregada de facción | ✅ | — | ✅ | Suma de más (H-6) |
| Clima por región (8 regiones) | ✅ | ✅ | ✅ | Funciona |
| Agenda de mundo (`worldAgenda.ts`, conflicto fijo) | ✅ legado | ✅ Panel Mundo | ✅ | Funciona, sin migrar a `FactionRelation` |
| Expediciones de facción | ❌ | ❌ | ❌ | Diseñado (§ 10) |
| IA de combate NPC, tramo 20+ | ❌ | — | ❌ | Diseñado (§ 10) |
| Comercio de volumen Reino↔facción | ❌ | ❌ | ❌ | Sin diseñar |
| Curvas dinámicas (zona, oficios, energía) | ❌ | — | ❌ | Sin diseñar |

---

## 2. Principios de arquitectura

1. **El motor decide, el LLM narra.** Ningún número de este sistema lo fija el modelo. Los
   eventos generan hechos de texto (`stageFactFor`, `LogEntry` del canal `WORLD`) que el narrador
   solo cuenta.
2. **Un solo modelo para jugador y facción.** `Building`, `Territory`, `KingdomStats` y
   `AlmacenItem` llevan `saveId?` y `factionId?`; exactamente uno relleno. No hay ramas
   `if (esFaccion)` en las fórmulas puras.
3. **Funciones puras en `services/`, efectos en el llamador.** `tickKingdomOneDay`,
   `tickOrdenesProduccion`, `applyFactionEvent`, `precioDinamico`… no saben quién las llama. La
   ruta HTTP o el bloque del turno leen de Prisma, llaman a la función pura y escriben.
4. **Dos relojes, con reparto fijo** (§ 4). El Reino del jugador avanza con el turno; lo que no
   tiene turno propio avanza en `worldTick`.
5. **Estructura física manda.** Una facción produce lo que tiene construido (`Building` `ACTIVO`),
   no un número abstracto. Quemar un edificio corta su aportación.
6. **XOR de propietario: dos criterios, a propósito.**
   - Modelos antiguos (`Building`, `Territory`, `KingdomStats`, `ZonePoint`): validado en servicio
     con `assertExactlyOneOwner` / `ownerKeyFor` (`reinoOwner.ts`).
   - `ProfessionProgress` (`saveId`/`companionId`) y `AlmacenItem` (`saveId`/`factionId`): además
     `CHECK CONSTRAINT` real en Postgres, añadido con SQL crudo en su migración.

---

## 3. Modelo de datos

Solo los campos que importan para entender el sistema. El esquema completo está en
`backend/prisma/schema.prisma`.

| Modelo | Propietario | Campos clave | Invariantes |
|---|---|---|---|
| `Faction` | `worldId`; `saveId?` | `slug`, `name`, `raza`, `liderNpcId?` | `saveId` null = facción de catálogo, compartida por todas las partidas del mundo. `saveId` relleno = facción del jugador, creada al fundar el Reino. `@@unique([worldId, slug])` |
| `FactionRelation` | `worldId` | `sourceFactionId` → `targetFactionId`, `presion` 0-100, `type`, `stage` 0-4 | **Dirigida**: A→B y B→A son filas distintas. `type` y `stage` se derivan siempre de `presion`. `@@unique([sourceFactionId, targetFactionId])` |
| `KingdomStats` | `saveId?` / `factionId?` | `ownerKey` (`save:<id>` / `faction:<id>`), `poblacion`, `felicidad`, `comida`, `bebida`, `riqueza`, `soldados`, `trabajadores`, `visitantes`, rachas de felicidad | `ownerKey` es la clave operativa (`findUnique`/`update`). Una fila por propietario |
| `Territory` | `saveId?` / `factionId?` | `region`, `control` (`TerritoryControl`), `population` | Consolida o se pierde por rachas de felicidad (§ 5.1) |
| `Building` | `saveId?` / `factionId?` | `recipeKey`, `tier`, `status`, `locationId`, `territoryId`, `x`/`y` | `tier` = nivel de Ayuntamiento o de edificio de oficio (`buildingTierFor`). Mejorar hace `UPDATE` del `tier`, nunca crea fila. `@@unique([factionId, recipeKey])` |
| `Parcela` | vía `locationId` (zona interior de la partida) | `tipo` (`BASICA`/`AVANZADA`), `x`/`y`, `recipeKeyFijo?`, `buildingId?` | `AVANZADA` siempre con `recipeKeyFijo`. `buildingId` único |
| `OrdenProduccion` | vía `buildingId` | `recipeKey` (de `CRAFTING_RECIPES`), `modo` (`unico`/`reponer`), `limite?`, `prioridad` 0-9, `cantidadProducidaAcumulada`, `activa` | `@@unique([buildingId, recipeKey])`. Nunca se borra desde la UI: se desactiva |
| `AlmacenItem` | `saveId?` / `factionId?` | `catalogSlug`, `name` | Una fila por unidad (no es un contador). XOR con `CHECK` |
| `AlmacenLimite` | `saveId` | `catalogSlug`, `limite?` | `null` = sin tope. Solo del jugador |
| `Companion` | `saveId` | `rolReino?`, `buildingId?`, `plantillaEquipoId?` | Trabaja en un edificio solo si `rolReino` no es null. Plazas por edificio: 1/2/4 según `tier` |
| `ProfessionProgress` | `saveId?` / `companionId?` | `professionId`, `nivel`, `xp` | XOR con `CHECK`. El jugador y sus trabajadores suben de oficio por el mismo camino |
| `NpcProfessionPotential` / `NpcProfessionProgress` | `npcId` | `nivelMaximo` 1-9 / `nivel`, `xp` | Para expediciones de facción. **Existen pero no se siembran ni se usan** (H-8) |
| `WorldPopulation` | `worldId` | `targetType` (`RAZA`/`FACCION`/…), `targetSlug`, `poblacion`, `poblacionMax` | Compartida por todas las partidas del mundo. 4 filas por facción: `-poblacion`, `-soldados`, `-trabajadores`, `-visitantes` |

**Asimetría conocida:** la decisión cerrada fue "el Reino de facción es por partida" (§ 11, D-3),
pero las facciones de catálogo tienen `saveId` null y su `KingdomStats`/`Building` son **de
mundo**. En la práctica, el estado económico de las facciones NPC lo comparten todas las partidas.
Ver H-6.

---

## 4. Relojes: qué avanza y cuándo

### 4.1 Con el turno del jugador (`turnResolution.ts`, bloque `if (diasCruzados > 0)`)

`diasCruzados = daysCrossed(minutosAntes, minutosDespués)` (días de ficción completos, 1440 min).
Solo corre cuando el turno cruza medianoche de ficción. En este orden:

1. `tickKingdom(stats, dias)`: economía del Reino del jugador (§ 5.1). Solo si existe su
   `KingdomStats`.
2. Consolidación, rebelión y población de cada `Territory` del jugador según las rachas.
3. **Producción agregada de todas las facciones** (`tickFactionProduction`, § 5.8).
4. `tickOrdenesProduccion` sobre los `Building` del jugador con órdenes activas (§ 5.3). Un tick
   por edificio y turno, no uno por día cruzado.
5. Servicio de la Casa de curas: si hay una activa, cada `Companion` con `rolReino` herido mejora
   un estado (`companionesQueCuraCasaDeCuras`).

Además, fuera de ese bloque y en el mismo turno:
- Construir un **Cuartel Avanzado** en una región con dueño distinto de la facción del jugador
  dispara `EXPANSION_TERRITORIAL_AGRESIVA` (§ 5.4).
- `applyCondicionTimeouts`: recuperación de convalecientes y desaparición de cadáveres (también en
  `worldTick`, a propósito).

### 4.2 En segundo plano (`workers/worldTick.ts`, cada `WORLD_TICK_INTERVAL_MINUTES`, 2 min reales)

En este orden:
1. `resolveDueTransits`: viajes y acciones largas vencidas.
2. `growAllPopulations`: crecimiento de `WorldPopulation`.
3. `syncFactionPopulationToKingdomStats`: copia las 4 filas `FACCION` de cada facción a su
   `KingdomStats`.
4. `advanceWorldAgenda`: el conflicto fijo legado (§ 5.10).
5. `advanceCompanionSurvival` y `advancePlayerSurvival`: hambre y sed.
6. `advanceCorpseAndRecoveryTimeouts`: cadáveres (48 h) y convalecencia (6 h).

**Regla** (decisión D-4): el Reino del jugador nunca va a `worldTick`. Ahí solo va lo que no tiene
turno propio. El futuro motor de facciones NPC también irá ahí.

---

## 5. Subsistemas

### 5.1 Economía del Reino del jugador — `kingdomTick.ts`

`tickKingdomOneDay`, por día:
- `bocas = poblacion + soldados + visitantes`
- `comida += trabajadores × 2 − bocas × 1`
- `bebida −= bocas × 1` (nadie produce bebida en este agregado)
- `riqueza += trabajadores × 1 − soldados × 1`
- Déficit de comida o bebida: felicidad −5. Superávit de ambas (más que `bocas`): +2. Todo se
  recorta a 0; felicidad a 0-100.
- Rachas: felicidad ≥ 70 suma a `diasFelicidadAlta`; ≤ 20 suma a `diasFelicidadBaja`. Salir de la
  banda las pone a 0.
- 7 días seguidos en banda alta consolida `Territory`; 7 en banda baja provoca rebelión. Población
  de territorio: +2/día en banda alta, −3/día en banda baja.

La Cocina común suma además su producción real a `comida` (turnResolution, § 5.3).

### 5.2 Construcción — `construction.ts`

**Jerarquía** (diseño en [construcciones-reino.md § 7.4](../rpgtarkor/sistemas-reino/construcciones-reino.md#74-conquista-territorial-estilo-x4--backend-cerrado-título-corregido-2026-09-21-tarde-el)):

| Nivel | Receta | Cupo que da |
|---|---|---|
| Capital | `ayuntamiento-pequeno` / `-mediano` / `-grande` | `reinoBuildingCapacity` 10 / 25 / 60 edificios; `cuartelAvanzadoCapacity` 1 / 5 / 10 Cuarteles |
| Cuartel Avanzado | `cuartel-avanzado` (1 por región, en región distinta a la de la Capital) | Cupo local propio |
| Mejora de Cuartel (una de dos) | `cuartel-de-guerra` (+10 defensa) o `puesto-comercial` (+10 producción) | — |
| Edificios sueltos | Choza, Jaula, Campamento, Tótem, edificios de oficio… | Cuentan contra la Capital o el Cuartel según `edificioTipo` |

**Zona interior dinámica.** Al fundar el Reino (`POST /reino/fundar`) se crea en tiempo de partida
una `Location` `ayuntamiento-interior-<saveId>`, enlazada con coste 0. Tiene 4 parcelas: 1
`AVANZADA` en el centro (400,300), ya ocupada por el Ayuntamiento, y 3 `BASICA`. Cada Cuartel
Avanzado crea `cuartel-avanzado-interior-<buildingId>`, con 1 `AVANZADA` (el propio Cuartel) y 1
`BASICA`. Es la única parte del juego que crea `Location` en tiempo de partida.

**Construir en parcela** (`POST /parcelas/:id/construir`) es directo: sin LLM, consume materiales,
crea el `Building` en la posición de la parcela, guarda `tier` y escribe un `LogEntry` `WORLD`.
Las candidatas de una `BASICA` salen de `candidateRecipesForBasica()`: toda receta con
`requiresAyuntamiento`, sin `upgradesRecipeKey` y sin `isCuartelAvanzado`.

**Edificios de oficio** (diseño en [edificios-de-oficio.md](../rpgtarkor/sistemas-reino/edificios-de-oficio.md)):
14 recetas de nivel 1 (Taller), 14 de nivel 2 (Obrador) y 14 de nivel 3 (Gran obrador), todas
`raza: 'orcos'`.
- `oficioProducido`: qué oficio trabaja dentro. Nivel del edificio =
  `nivelEdificioRequeridoParaTier(tierReceta) = ceil(tier / 3)`.
- Mejoras: `upgradesRecipeKey` apunta a la **receta base**; el Gran obrador también apunta a la
  base, no al Obrador. Exigen `constructor-orcos-llanuras` y `ayuntamientoNivelMinimo`.
- `condicionRegion`: `'costa'` (Embarcadero) = TerrainTag costero o acuático; `'veta'` (Boca de
  mina) = tag `rocoso`, a falta de uno propio. Los Corrales exigen una Jaula.

**Gate de oficio al construir.** `checkRecipe` solo **bloquea** por oficio si este empieza por
`constructor` (`OFICIOS_CONSTRUCCION_REQUERIDOS`). Para cualquier otro oficio (herrero, curtidor…),
tenerlo solo da `alivio` sobre los requisitos de atributo. Por eso un Taller de nivel 1 lo puede
levantar cualquiera que reúna materiales y atributos.

### 5.3 Producción del Reino — `kingdomProduction.ts`

`tickOrdenesProduccion`, por edificio `ACTIVO` con órdenes activas:
1. Candidatos a trabajador: los `Companion` con `rolReino` no null y `buildingId` igual a ese
   edificio. El jugador **nunca** cuenta como mano de obra (decisión D-9).
2. Órdenes ordenadas por `prioridad` ascendente (0 primero).
3. Por orden, en este orden de comprobaciones:
   - `RECETA_DESCONOCIDA`: `recipeKey` no está en `CRAFTING_RECIPES`.
   - `NIVEL_EDIFICIO_INSUFICIENTE`: `nivelEdificioRequeridoParaTier(receta.tier) > building.tier`.
   - `ALMACEN_LLENO`: el resultado ya llegó a su `AlmacenLimite`. Se salta la orden **sin gastar
     trabajador**; ese trabajador sigue libre para la siguiente prioridad.
   - `SIN_TRABAJADOR_CON_NIVEL`: ningún trabajador libre tiene nivel de oficio suficiente (su
     propio `ProfessionProgress.companionId`, nunca el del jugador).
   - `SIN_MATERIA_PRIMA`: faltan ingredientes en `AlmacenItem` del jugador.
4. Si todo pasa: consume ingredientes del Almacén (FIFO), deposita el resultado, suma XP de oficio
   al trabajador y lo marca ocupado para el resto del tick. Una orden `unico` que alcanza su
   `limite` se desactiva en ese mismo tick.

Los resultados que no producen no generan `LogEntry`: son información de gestión para el panel.

**Recetas de extracción:** 4 `CraftingRecipe` sin ingredientes (mena de hierro, pesca, hierbas,
leche de Múrgol) con `requiresUnlock: true` que nunca se desbloquea. Solo se pueden asignar como
orden, no craftear a mano.

**Sin filtro por oficio:** una orden acepta cualquier receta en cualquier edificio. El único freno
es el nivel del edificio y el del trabajador (pregunta P-3, § 12).

### 5.4 Relaciones entre facciones — `factionRelations.ts`

| `presion` | `type` | `stage` |
|---|---|---|
| 0-19 | `ALIANZA` | 0 |
| 20-39 | `TRATADO_COMERCIAL` | 0 |
| 40-59 | `NEUTRAL` | 0 |
| 60-79 | `TENSION` | 0-1 |
| 80-100 | `GUERRA` | 2-4 |

`stage = min(4, floor((presion − 60) / 10))` a partir de 60.

**Eventos y pesos** (`FACTION_EVENT_WEIGHTS`):

| Evento | Peso | Quién lo dispara hoy |
|---|---|---|
| `EXPANSION_TERRITORIAL_AGRESIVA` | +15 | El jugador, al construir un Cuartel Avanzado en región con otro dueño |
| `BAJA_DE_GUERRA` | +8 | **Nadie** (H-3) |
| `TRATADO_CUMPLIDO` | −10 | **Nadie** (H-3) |
| `NEGOCIACION_TREGUA` | −12 | Diplomacia del jugador, acción `negociar` |
| `SABOTAJE_DIPLOMATICO` | +10 | Diplomacia del jugador, acción `sabotear` |

`recordFactionEvent` hace upsert de la relación (nace en 50, neutra), aplica el peso, recalcula
`type` y `stage`, y si cambia la banda devuelve un hecho de mundo con `stageFactFor`.

`decayPresion` (−1 por semana de ficción hacia 50) **existe pero no la llama nadie** (H-4).

### 5.5 Diplomacia del jugador — `POST /saves/:id/reino/diplomacia`

- Requiere un Reino fundado (la `Faction` con `saveId` del jugador) y un `Companion` propio con
  `rolReino: 'diplomatico'`.
- Acciones: `negociar` (`NEGOCIACION_TREGUA`), `sabotear` (`SABOTAJE_DIPLOMATICO`) y `espiar`, que
  devuelve el estado de la relación sin moverla.
- Gate: `nivelDiplomaticoRequerido(presion) = min(9, 1 + floor(|presion − 50| / 10))`. Pasa si
  `nivelExigido ≤ max(1, alivioForLevel(nivel) + 1)`, con el nivel del oficio `diplomatico` del
  propio Companion.

### 5.6 Mercado regulado — `economia.ts`, `reino.ts`

- `GET /reino/mercado/:faccion` lista el `AlmacenItem` de esa facción agrupado por `catalogSlug`.
  Solo si hay `TRATADO_COMERCIAL` o `ALIANZA` en la relación jugador→facción.
- Precio: `precioDinamico(valorGoirnos, stock) = valorGoirnos × factorPrecioPorStock(stock)`. El
  factor va de 2 (stock 0) a 1 (stock 10, `STOCK_NORMAL`) y a 0,5 (stock ≥ 20), interpolado. No hay
  tick de oferta y demanda: se calcula en cada operación.
- `comprar` mueve `Save.goirnos` y pasa el `AlmacenItem` de `factionId` a `saveId`. `vender` hace
  lo contrario.
- Moneda: `Save.goirnos` (dinero personal). `KingdomStats.riqueza` no interviene (el comercio de
  volumen está sin diseñar).

### 5.7 Población de facción — `population.ts`, `scripts/worldPopulation.ts`

Las 9 facciones de catálogo tienen 4 filas `WorldPopulation` `FACCION` cada una, con repartos
decididos por lore (ver [expediciones-poblacion.md § 4.6](../rpgtarkor/sistemas-reino/expediciones-poblacion.md#46-reproducción-poblacional--cerrado-e-implementado-2026-09-21-sesión-posterior-a--7)).
`RAZA` es la población de fondo de la región; `FACCION` es el subconjunto organizado.
`growAllPopulations` las hace crecer y `syncFactionPopulationToKingdomStats` copia
`poblacion`/`soldados`/`trabajadores`/`visitantes` a su `KingdomStats`. `seed-catalog.ts` crea ese
`KingdomStats` inicial a partir de las mismas filas.

### 5.8 Producción agregada de facción — `kingdomTick.ts`

`tickFactionProduction(buildings)`, por día: cada `Building` de la facción en `ACTIVO` suma 3 de
`comida` si es una cocina y 2 de `riqueza` si es otro edificio de oficio. Los salones (`*-sedsar`)
no suman. No hay consumo: `comida` y `riqueza` de facción solo crecen (H-6).

### 5.9 Clima por región — `worldClock.ts`

`climaFor` es determinista por día y región. Cada región tiene su proporción de días extremos
(`extremaCada`) y un desfase propio. `climaNombreFor(estado, region)` da el léxico regional: la
ventisca en Cristal Helado, la crecida en la Ciénaga, la marea brava en la Costa del Azabache.

| Región | Extrema cada |
|---|---|
| Cristal Helado, Costa del Azabache | 2 días |
| Llanuras, Susurro de las Raíces, Ciénaga Troncal | 3 |
| Margen Silencioso | 4 |
| Meseta del Orden | 5 |
| Cicatriz de Cristal | 6 |

Cubre 8 regiones: las 5 de Berig y 3 de Vaelira (Cicatriz de Cristal, Susurro de las Raíces, Costa
del Azabache), que es continente fuera de juego. Tener clima para Vaelira no hace daño, pero ver P-4.

### 5.10 Agenda de mundo legada — `worldAgenda.ts`

Un único conflicto fijo, `conflicto-serhu-concordia-vs-helsig-goshg`, con 5 hechos de etapa
escritos a mano, que avanza por tiempo real. Convive con `FactionRelation` sin tocarlo. La decisión
es convertirlo en la primera fila de `FactionRelation` (pendiente, § 10).

---

## 6. API HTTP

| Método y ruta | Fichero | Qué hace |
|---|---|---|
| `POST /saves/:id/reino/fundar` | `routes/saves/reino.ts` | Funda el Reino: `Faction` propia, `Territory`, `KingdomStats`, zona interior y parcelas |
| `POST /saves/:id/reino/diplomacia` | `reino.ts` | `negociar` / `sabotear` / `espiar` |
| `GET /saves/:id/reino/mercado/:targetFactionSlug` | `reino.ts` | Stock y precios de una facción |
| `POST /saves/:id/reino/mercado/comprar` · `/vender` | `reino.ts` | Compraventa con `Save.goirnos` |
| `GET /saves/:id/parcelas/:parcelaId` | `routes/saves/parcelas.ts` | Estado de la parcela y recetas candidatas con su `blockedReason` |
| `POST /saves/:id/parcelas/:parcelaId/construir` | `parcelas.ts` | Construcción directa |
| `GET` · `POST /saves/:id/edificios/:buildingId/ordenes` | `routes/saves/ordenesProduccion.ts` | Listar y crear (o reactivar) órdenes |
| `PATCH` · `DELETE /saves/:id/ordenes/:ordenId` | `ordenesProduccion.ts` | Editar prioridad, límite y activa; desactivar |
| `GET` · `POST /saves/:id/almacen-limites` | `routes/saves/almacenLimite.ts` | Topes del Almacén |
| `POST /saves/:id/almacen/depositar/:itemId` · `/retirar/:almacenItemId` | `routes/saves/companeros.ts` | Depósito manual del jugador |
| `POST /saves/:id/companeros/:companionId/asignar-edificio` | `companeros.ts` | `Companion.buildingId`, con tope de plazas 1/2/4 |
| `POST /saves/:id/companeros/:companionId/plantilla` | `companeros.ts` | Plantilla de equipo; acepta `rolReino` opcional (el frontend no lo envía, H-1) |
| `GET /world/:slug/faction-relations` | `routes/factionRelations.ts` | Todas las relaciones del mundo, para el mapa |

El Cuartel Avanzado y sus mejoras no tienen ruta directa: se construyen con texto libre por
`/turn/classify` + `/turn/narrate`.

---

## 7. Frontend

Rediseño del 2026-09-22 (`49bc1c5`). `ReinoPanel` tiene 5 subpestañas en
`frontend/src/components/panels/reino/`:

| Subpestaña | Componente | Qué muestra o permite |
|---|---|---|
| Visión general | `VisionGeneralSection.tsx` | `KingdomStats`, territorios, leyenda de estados |
| Edificios | `EdificiosParcelasSection.tsx` | Edificios del Reino. TODO: no hay botón de Cuartel Avanzado |
| Producción | `ProduccionSection.tsx` | Asignar trabajador a edificio, crear, editar y desactivar órdenes, topes de almacén |
| Súbditos | `SubditosSection.tsx` | Plantillas de equipo (el campo `rol` se guarda en la plantilla, no en el Companion) |
| Diplomacia | `DiplomaciaMercadoSection.tsx` | Negociar, sabotear, espiar y mercado |

Fuera del panel:
- `ParcelaDetailModal.tsx`: se abre desde el icono de parcela en `ZonaPanel.tsx`.
- `RelacionesFaccionesModal.tsx`: mapa de relaciones, colgado de Reputación.
- `razaTheme.ts`: paleta por raza, con ámbito local.

---

## 8. Tests

| Área | Unitarios | Integración (Postgres real) |
|---|---|---|
| Economía de Reino y producción de facción | `kingdomTick.test.ts` | `turn.integration.test.ts` |
| Órdenes de producción | `kingdomProduction.test.ts` | `turn.integration.test.ts` (describe `OrdenProduccion…`), `ordenesProduccion.integration.test.ts`, `companeros.integration.test.ts` |
| Construcción y edificios de oficio | `construction.test.ts` | `parcelas.integration.test.ts`, `zonaParcelas.integration.test.ts`, `cuartelAvanzado.integration.test.ts` |
| Relaciones, diplomacia y mercado | `factionRelations.test.ts`, `economia.test.ts`, `reino.test.ts` | `factionRelations.integration.test.ts`, `reino.integration.test.ts`, `cuartelAvanzadoTerritorial.integration.test.ts` |
| Población | `population.test.ts` | `worldTick.test.ts` |
| Supervivencia y timeouts | `companionSupervivencia.test.ts` | `companionSupervivencia.integration.test.ts` |
| Tope de almacén | — | `almacenLimite.integration.test.ts` |

Los integración usan Ollama para embeddings: con Ollama parado fallan con `fetch failed`, no por
regresión.

---

## 9. Huecos verificados en el código

Severidad: 🔴 rompe una mecánica en partida real · 🟡 incoherencia o deuda que no rompe · ⚪ menor.

| ID | Sev. | Hueco | Dónde | Arreglo propuesto |
|---|---|---|---|---|
| H-1 | ✅ `0e47115` | ~~**Nadie puede tener `rolReino`.**~~ Resuelto: la plantilla lo propone (guardia/trabajador/productor) y Súbditos tiene selector (`POST …/rol-reino`). Solo lo escribe `POST …/plantilla` si el body trae `rolReino`, y el frontend nunca lo envía. Sin `rolReino` no se puede asignar trabajador a un edificio ni hacer diplomacia: producción y diplomacia son inalcanzables jugando | `companeros.ts:709`, `api.ts:asignarPlantillaCompanion` | Al asignar plantilla, tomar `rolReino = plantilla.rol` si el body no lo trae, o dar un selector de rol en Súbditos. **Decide Álvaro** (P-1) |
| H-2 | 🔴 | Las facciones no tienen stock propio: ningún código crea `AlmacenItem` con `factionId` salvo cuando el jugador vende. Comprar a una facción solo es posible después de haberle vendido | `reino.ts` (mercado) | Sembrar stock inicial por facción, o que `tickFactionProduction` deposite objetos reales. Choca con la decisión "agregado, no objeto a objeto" (P-2) |
| H-3 | 🟡 | `BAJA_DE_GUERRA` y `TRATADO_CUMPLIDO` están tipados y pesados pero nada los dispara | `factionRelations.ts` | `BAJA_DE_GUERRA` al matar a un NPC de otra facción dentro de su región; `TRATADO_CUMPLIDO` cuando exista comercio de volumen |
| H-4 | 🟡 | `decayPresion` no tiene llamador: una relación movida por el jugador nunca vuelve sola hacia 50 | `factionRelations.ts` | Llamarla en `worldTick` por semanas de ficción cruzadas, o en el bloque de días del turno |
| H-5 | 🔴 | El diplomático no puede subir de nivel: ninguna acción da XP de `diplomatico`. Con nivel 1, el gate solo deja actuar si \|presión − 50\| < 10. Tras una negociación (50 → 38) ya exige nivel 2 y se bloquea para siempre | `reino.ts:212-228` | Dar XP por acción diplomática con `xpForCraftSuccess`, o que el Maestro enseñe `diplomatico` |
| H-6 | 🔴 | `tickFactionProduction` corre **en el turno de cada partida** y sobre todas las `KingdomStats` de facción, **sin filtrar por mundo**. Con dos partidas activas, las facciones producen el doble. Además `comida` y `riqueza` de facción nunca se consumen: crecen sin límite | `turnResolution.ts:5604-5613` | Moverlo a `worldTick` por días de ficción del mundo (encaja con D-4) y añadir consumo por bocas como `tickKingdomOneDay`. **Decide Álvaro** (P-2) |
| H-7 | 🟡 | No se siembra ninguna `FactionRelation` inicial. La A-01 fijó Concordia ↔ Los del Obelisco en 65 (`TENSION`); el resto de fichas solo da relaciones cualitativas | `seed-catalog.ts` | Sembrar las filas con números. **Faltan los números** (P-5) |
| H-8 | 🟡 | `NpcProfessionPotential` y `NpcProfessionProgress` existen en el esquema sin semilla ni uso | `schema.prisma` | Sembrarlos al implementar expediciones (§ 10) |
| H-9 | ⚪ | `FactionRelation.presion` tiene `@default(0)` (sería `ALIANZA`), aunque el código siempre crea con 50 | `schema.prisma` | Migración nueva con `@default(50)` |
| H-10 | ✅ `cd96e9e` | ~~Slugs de oficio incoherentes~~ (resuelto: fuente única `backend/src/data/professions.ts`, frontend generado con `npm run sync-professions`, migración de datos) entre catálogo y frontend: `herrero-orco-llanuras` frente a `curtidor-orcos-llanuras`; los Maestros de Cristal Helado enseñan `herrero-orcos-cristal`, `minero-orcos-cristal`, `cocinero-orcos-cristal` y `alquimista-orcos-cristal`, que no están en `frontend/src/data/professions.ts` (allí son `herrero-orco-cristal`, `minero-cristal`, `cocinero-orco-cristal`, y no hay alquimista de Cristal); la raza aparece como `nabierus` en vez de `nabieus` | `worldCatalog.ts`, `professions.ts` | Unificar en un solo fichero compartido y migrar `ProfessionProgress.professionId` existentes |
| H-11 | ⚪ | Plazas de trabajador por `tier` también se aplican al Ayuntamiento (su `tier` es su nivel) | `companeros.ts` (asignar-edificio) | Decidir si el Ayuntamiento admite trabajadores |
| H-12 | ⚪ | Cuartel Avanzado sin botón directo en el frontend: solo por texto libre | `EdificiosParcelasSection.tsx` | Parcela `AVANZADA` con `recipeKeyFijo: 'cuartel-avanzado'` en la zona exterior, o botón propio |

Arreglado en esta revisión: el Cuartel de Guerra pedía el oficio inexistente
`herrero-orcos-llanuras` (`15fe8b7`), y el `tier` de los edificios de oficio no se guardaba
(`484a0cf`).

---

## 10. Diseñado, sin código

| Pieza | Diseño | Dependencias |
|---|---|---|
| **Expediciones de facción**: modelos `Expedicion` y `ExpedicionMember` (recolector o guardia), riesgo de intercepción según `FactionRelation` de las regiones atravesadas, combate en `worldTick` con el motor existente, botín a `AlmacenItem.factionId` | [expediciones-poblacion.md § 4.5](../rpgtarkor/sistemas-reino/expediciones-poblacion.md#45-expediciones-de-recolecciónexploración-de-facción--diseño-cerrado-2026-09-21-sesión) | H-8 (semillas de potencial), H-6 (dónde vive el motor de facciones) |
| **Motor de facciones NPC**: la facción decide construir, expandirse o declarar guerra según la Inteligencia de su líder (`liderNpcId`) | Decisiones D-5, D-7 y D-12 | H-6 |
| **Motor de eventos de mundo unificado**: eventos discretos que alimentan lore, misiones y facciones; función pura llamada desde el turno y desde `worldTick` | Decisión D-7 | Motor de facciones |
| **IA de combate NPC, tramo Inteligencia 20+**: retirada, concentrar ataques, órdenes de un capitán | [ia-combate-y-mundo.md § 8](../rpgtarkor/sistemas-combate/ia-combate-y-mundo.md#8-ia-de-combate-npc-por-tramos-de-inteligencia--diseño-cerrado-2026-09-21-sesión-posterior) | Ninguna |
| **Migrar `worldAgenda`** a la primera fila de `FactionRelation` | [facciones-diplomacia.md § 4.3](../rpgtarkor/sistemas-reino/facciones-diplomacia.md#43-generalización-de-worldagendats--de-un-conflicto-hardcodeado-a-un-motor-de-disputas) | H-7 |
| **Regiones sin dueño abiertas a facciones NPC** | Decisión D-12 | Motor de facciones |
| **Oficios de la Ciénaga y Goirntes**, estaciones de recolección sin oficio, edificios de defensa | [edificios-de-oficio.md § 6](../rpgtarkor/sistemas-reino/edificios-de-oficio.md#6-extensiones-que-este-diseño-deja-preparadas-no-incluidas) | Lore |
| **Control de escuadrones** (patrullar, explorar) | [construcciones-reino.md § 4.4-bis](../rpgtarkor/sistemas-reino/construcciones-reino.md#44-bis-panel-de-reino-real--economía-interna-x4--bellwright--control-de-escuadrones-2026-09-21-sesión-posterior) | Ninguna, pero es grande |
| Sin diseñar: comercio de volumen Reino↔facción con `riqueza`; curvas dinámicas de movimiento en zona, oficios y energía | [ia-combate-y-mundo.md § 9](../rpgtarkor/sistemas-combate/ia-combate-y-mundo.md#9-movimiento-en-zona--profesiones-talento-nivel-energía--señales-dinámicas-diseño-pendiente) | — |

---

## 11. Decisiones cerradas

Resumen. El razonamiento completo está en
[mundo-vivo-x4.md](../rpgtarkor/sistemas-reino/mundo-vivo-x4.md#decisiones-cerradas) y en cada
documento de diseño.

| ID | Decisión |
|---|---|
| D-1 | `FactionBuilding` retirado; los edificios de facción son `Building.factionId` |
| D-2 | XOR de propietario: `CHECK` en Postgres solo en los modelos nuevos; los antiguos, en servicio |
| D-3 | Reino y edificios de facción "por partida". En la práctica las facciones de catálogo son de mundo (ver § 3) |
| D-4 | El Reino del jugador avanza con el turno; `worldTick` queda para lo que no tiene turno propio y para el futuro motor de facciones |
| D-5 | La Inteligencia de una facción es la de su líder de gobierno (`liderNpcId`) |
| D-6 | Diplomacia = acción puntual de un Companion del jugador, estilo agente de X4; la facción destino no necesita NPC |
| D-7 | Un solo motor de eventos de mundo, función pura invocable desde el turno y desde `worldTick` |
| D-8 | IA de combate por tramos de Inteligencia: < 10, 10-20 (umbral 12 ya existente), 20+ nuevo |
| D-9 | El jugador no es mano de obra del Reino; su crafteo personal va aparte |
| D-10 | "Muerte permanente A→F" no existió: era ruido de memoria |
| D-11 | Cadáveres y convalecencia se resuelven también en `worldTick` |
| D-12 | Las regiones sin dueño podrán disputarlas las facciones NPC. **Choca con el canon**: 3 de esas 4 regiones son de Vaelira, fuera de juego (P-4). El Margen ya tiene dueñas (A-02/A-04) |
| D-13 | Clima en las 8 regiones antes de las expediciones (hecho) |
| D-14 | Relación dirigida (A→B ≠ B→A), presión 0-100 con bandas y eventos discretos, sin ambiente continuo |
| D-15 | Precio de mercado derivado del stock, sin simulación de oferta y demanda |
| D-16 | Un solo `OrdenProduccion` para recolección (receta sin ingredientes) y fabricación |
| D-17 | Producción de facción agregada en `KingdomStats`, no objeto a objeto |
| D-18 | Edificios de oficio: 1 por oficio, 3 niveles, plazas 1/2/4, doble llave nivel de edificio + nivel de trabajador |

---

## 12. Preguntas abiertas para Álvaro

| ID | Pregunta | Por qué importa |
|---|---|---|
| P-1 | ¿Cómo recibe un súbdito su `rolReino`: de su plantilla, con un selector propio, o de otra forma? | Desbloquea H-1: sin esto, producción y diplomacia no se pueden jugar |
| P-2 | ¿Dónde vive la economía de facción y qué consume? ¿La pasamos a `worldTick` con consumo por bocas? ¿Y cómo tienen stock que vender, si la producción es agregada? | H-6 y H-2. Es una decisión de modelo, no de código |
| P-3 | ¿Filtramos las órdenes por el `oficioProducido` del edificio? El 2026-09-21 se decidió que no; el diseño de edificios de oficio sugiere que sí | Hoy una Cocina puede forjar espadas si el trabajador sabe |
| P-4 | La decisión D-12 abre a disputa "las 4 regiones sin dueño", pero 3 son de Vaelira (Cicatriz de Cristal, Susurro de las Raíces, Costa del Azabache) y el canon dice que nada cruza la Niebla. ¿Restringimos D-12 a Berig? | Evita que una facción orca "se expanda" a otro continente |
| P-5 | Números de presión inicial para las relaciones entre las 9 facciones (solo existe Concordia ↔ Obelisco = 65) | H-7 |
| P-6 | ¿Cómo sube de nivel el diplomático? | H-5 |

---

## 13. Dónde estaba cada sección antigua

El código cita `mundo-vivo-x4.md § X`. Esas secciones se repartieron el 2026-09-22 en varios
ficheros y conservan su numeración:

| Cita en el código | Dónde está ahora |
|---|---|
| § 1-3 (visión, inventario, lectura de conjunto) | [mundo-vivo-x4-vision.md](../rpgtarkor/sistemas-reino/mundo-vivo-x4-vision.md) |
| § 4.1 (mapa de reutilización) | [mundo-vivo-x4.md](../rpgtarkor/sistemas-reino/mundo-vivo-x4.md) (historial) |
| § 4.2, § 4.4-bis, § 4.4-ter, § 7.1, § 7.4 | [construcciones-reino.md](../rpgtarkor/sistemas-reino/construcciones-reino.md) |
| § 4.3, § 4.4, § 7.2, § 7.2-bis, § 7.3 | [facciones-diplomacia.md](../rpgtarkor/sistemas-reino/facciones-diplomacia.md) |
| § 4.5, § 4.6 | [expediciones-poblacion.md](../rpgtarkor/sistemas-reino/expediciones-poblacion.md) |
| § 5, § 5-bis, § 5-ter, § 5-cuater | [mundo-vivo-x4.md](../rpgtarkor/sistemas-reino/mundo-vivo-x4.md#decisiones-cerradas) |
| § 8, § 9 | [ia-combate-y-mundo.md](../rpgtarkor/sistemas-combate/ia-combate-y-mundo.md) |
