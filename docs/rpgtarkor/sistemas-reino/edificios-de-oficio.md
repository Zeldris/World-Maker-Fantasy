# Edificios de oficio — un edificio por profesión, estilo X4 + Bellwright + D&D

[← Volver al índice](mundo-vivo-x4.md) · [Construcciones y economía de Reino](construcciones-reino.md)

**Estado:** diseño cerrado por Claude (2026-09-28), validado con Álvaro (agregado simple de
producción de facción, § 4) y **con código** — ver la lista de "Implementación" al final, cada
punto ya marcado. Obrador de piedra (Serhu) y Casa de curas (Helsig) quedan sin sembrar en el
catálogo: sus oficios existen pero no tienen Maestro real todavía.

---

## 1. Qué problema resuelve

El motor de Reino ya está hecho para producir. Tiene:
- `Building` compartido entre jugador y facción (`saveId` / `factionId`);
- `OrdenProduccion` con modo único o reponer, límite y prioridad 0-9;
- `Companion.buildingId` como trabajador asignado;
- el tope de almacén y el gate de nivel de oficio por trabajador (`kingdomProduction.ts`).

Pero **no hay edificios en los que producir**. Las únicas recetas de Reino son el Campamento, la
Choza, el Ayuntamiento, la Jaula, el Cuartel Avanzado y sus dos mejoras, y el Tótem Maktor.
`ConstructionRecipe.edificioTipo: 'produccion'` existe en el schema, pero ninguna receta lo usa.
Mientras tanto hay 13 oficios con Maestro, y las facciones tienen talleres descritos en el lore sin
edificio que los respalde.

Este documento define **un edificio por oficio**. Sirve igual para el Reino del jugador que para las
facciones, porque es el mismo modelo.

## 2. La lógica, pieza por pieza

### X4 Foundations: el edificio es un módulo de estación
- Cada edificio de oficio es un **módulo**: una pieza física que ocupa hueco y produce una línea
  concreta. Igual que en X4, hay tres clases, y es la misma estructura de datos, solo cambian los
  inputs:
  - **Extracción**: sin ingredientes; convierte trabajo + un recurso de la región en materia prima.
    Ejemplos: mina, embarcadero de pesca, huerto de hierbas.
  - **Procesado**: materia prima → material. Ejemplos: curtiduría, desolladero, carpintería,
    herrería (lingotes).
  - **Producción**: material → objeto final. Ejemplos: peletería, sastrería, alquimia, cocina,
    herrería (armas).
- **La estructura física manda** (decisión ya cerrada en § 7.4 de construcciones-reino.md): una
  facción produce lo que tiene construido, no un número abstracto. Si se destruye la herrería
  Serhu, deja de haber armas Serhu.
- **Cupos como los módulos de una estación**: cada edificio de oficio es `edificioTipo:
  'produccion'`.
  - En la Capital cuenta contra `reinoBuildingCapacity` (10/25/60 según el nivel del Ayuntamiento).
  - Dentro de un Cuartel Avanzado cuenta contra su cupo local. El Puesto Comercial da +10 de
    producción, que por fin tendrá algo que meter.

### Bellwright: estación, trabajador y orden
- Un edificio **no produce solo**: produce si tiene al menos un `Companion` asignado
  (`Companion.buildingId`) con el oficio necesario, y una `OrdenProduccion` activa.
- **Plazas de trabajador** por nivel del edificio: 1 / 2 / 4. En Bellwright una estación admite
  varios aldeanos, y más plazas es la recompensa natural de mejorarla.
- Las **recetas** que admite cada edificio salen de las `CraftingRecipe` ya existentes de su
  oficio. No se inventa un catálogo paralelo: el edificio solo declara qué oficio y qué tiers
  acepta.
- La **cadena** es la de Bellwright: extracción → procesado → producción. Un edificio de producción
  sin su procesado detrás se queda sin materia prima y el panel lo dice (`SIN_MATERIA_PRIMA`, que ya
  existe).

### D&D: tres escalones de juego
D&D reparte los niveles 1-20 en cuatro "tiers of play". Aquí se usa la misma idea con los 9 niveles
de oficio y los 3 niveles de edificio:

| Nivel del edificio | Nombre | Tiers de receta admitidos | Nivel de oficio del trabajador | Requiere |
|---|---|---|---|---|
| 1 | Taller | 1-3 | ≥ tier de la receta (gate ya existente) | Ayuntamiento pequeño |
| 2 | Obrador | 4-6 | ídem | Ayuntamiento mediano + oficio `constructor` nivel 3 |
| 3 | Gran obrador | 7-9 | ídem | Ayuntamiento grande + oficio `constructor` nivel 6 |

- Es el mismo patrón que el Ayuntamiento: mejorar **no crea** un edificio nuevo, hace `UPDATE` del
  `tier` del mismo `Building` (`upgradesRecipeKey`).
- **Doble llave**, como en D&D, donde hace falta a la vez el nivel y el conjuro: el edificio
  limita qué tier se puede producir ahí, y el trabajador limita qué tier sabe hacer. Si una
  receta de tier 5 se pone en un Taller de nivel 1, sale `NIVEL_EDIFICIO_INSUFICIENTE`, un resultado
  nuevo, informativo como los demás.
- **Maestro de oficio (bonus opcional, como un "rasgo")**: si el edificio está en el mismo
  asentamiento que el Maestro de su oficio (caso de las facciones), el trabajador cuenta con +1
  nivel efectivo, sin pasar nunca de 9. Es el aprendiz que trabaja junto a su maestro. No se aplica
  al Reino del jugador, salvo que algún día un Maestro sea reclutable.

## 3. Catálogo: un edificio por oficio

Las recetas de construcción son **por raza**, porque `ConstructionRecipe.raza` ya existe y la
cultura material cambia. El oficio también va por raza y región (`herrero-orcos-llanuras`…). Hoy
solo los orcos tienen oficios en el código, así que el catálogo es orco, con **tres variantes
regionales de aspecto** para el mismo edificio. La receta es una sola por raza; el aspecto regional
va en la descripción y la imagen, según la región donde se levante.

Materiales por variante (todos existen en el catálogo), sin tocar el Corredor de Cauce:
- **Llanuras (Serhu)**: Telda, Huesos de Gargantúa, Musgo Rojo, fibra de Enredadera, piel.
- **Cristal Helado (Helsig)**: piedra, bloques tallados, pieles gruesas, esquirlas de sílice.
- **Ciénaga (Goshg)**: madera y resina de Trepador Ocaso, pilotes, Chudos para el techado.

Coste orientativo del nivel 1, calibrado contra la Choza (10 pieles + 6 huesos largos + 4 cuerdas):
**unos 20-25 materiales básicos más 1 pieza propia del oficio**. Cada nivel siguiente cuesta
aproximadamente el doble y pide un material procesado, que obliga a tener la cadena montada.

| # | Edificio (`key` propuesta) | Oficio | Clase X4 | Qué hace | Pieza propia del oficio (nivel 1) |
|---|---|---|---|---|---|
| 1 | Herrería (`herreria`) | herrero | procesado + producción | lingotes (hierro, Yerreo, Hiyerro), reparar el hacha, armas y armaduras de metal | 1 piedra de afilar |
| 2 | Curtiduría (`curtiduria`) | curtidor | procesado | pieles crudas → cuero curtido; armaduras de piel pesada | 1 cuchillo de desuello |
| 3 | Peletería (`peleteria`) | peletero | producción | ropa y abrigo de piel (capas, capuchas, guantes) | 1 kit de costura de hueso |
| 4 | Desolladero (`desolladero`) | desollador | procesado | despieza las presas que entran al almacén: carne, piel, hueso, garra | 1 cuchillo de hielo sílice |
| 5 | Corrales (`corrales`) | domador | extracción (animal) | leche, lana y crías de los animales domados; aclimata capturas antes de la Jaula | 4 cuerdas de tendón |
| 6 | Carpintería (`carpinteria`) | carpintero | procesado | madera → vigas talladas y cordaje; mangos y astas | 1 hacha de mano orca |
| 7 | Sastrería (`sastreria`) | sastre | producción | tela y fieltro (lana de Múrgol, fibra), cosméticos, mochilas | 1 kit de costura de hueso |
| 8 | Herboristería (`herboristeria`) | herborista | extracción + procesado | huerto de hierbas de la región y secado (manojos de salvia…) | 5 fibras de Enredadera |
| 9 | Casa de curas (`casa-de-curas`) | primeros auxilios | producción + **servicio** | vendajes y cataplasmas; los compañeros heridos del reino se recuperan un estado más rápido | 3 manojos de salvia |
| 10 | Taller de alquimia (`taller-alquimia`) | alquimista | producción | pociones, contravenenos, filtros, el Ungüento de Espina | 1 glándula ígnea (el fuego lento) |
| 11 | Cocina común (`cocina`) | cocinero | producción | ahumados, pan, cuajada: **alimenta de verdad `KingdomStats.comida`** | 1 odre de agua |
| 12 | Embarcadero de pesca (`embarcadero-pesca`) | pescador | extracción | pesca y marisco. **Solo en región con costa o agua** | 1 caña de pescar |
| 13 | Obrador de piedra (`obrador-piedra`) | constructor | procesado | bloques de piedra tallada, columnas de hueso: los materiales de las mejoras | 1 pico de minero |
| 14 | Boca de mina (`boca-mina`) | minero | extracción | mena y mineral de la región (hielo sílice en Cristal Helado, hierro en las Llanuras). **Solo si la región tiene veta** | 1 pico de minero |

**Reglas de sitio**, las que hacen que el mapa importe:
- El Embarcadero de pesca y la Boca de mina llevan una condición de región: costa o agua para el
  primero, veta para la segunda. Se comprueba en `computeBuildBlockedReason`, igual que ya se
  comprueban la región y la distancia del Ayuntamiento.
- Los Corrales necesitan al menos una Jaula del reino (las capturas pasan de la Jaula al Corral).
- La Herboristería produce solo las hierbas que existen en su región (sus `HarvestYield` de región).

**Qué NO es edificio de oficio, a propósito:** la caza (es de clase, Cazador, no un oficio) y la
recolección genérica de madera, piedra y fibra. En Bellwright sí son estaciones propias ("Leñera",
"Cantera"); aquí se dejan como **extensión opcional** (§ 6), porque ningún oficio las respalda y el
jugador ya recolecta a mano.

## 4. Cómo lo usan las facciones (mismo motor que el jugador)

Cada facción siembra sus edificios de oficio como `Building.factionId`, en el interior de su
asentamiento, uno por cada oficio que **tiene hoy**, más su `ZonePoint` junto al Maestro. Esto
sustituye el goteo de edificios sueltos que hay ahora por una regla: *cada oficio con Maestro
tiene su edificio*.

| Facción | Oficios que tiene hoy | Edificios que ya existen | Faltan (a sembrar) |
|---|---|---|---|
| **Clan Serhu** (Karot Veku, Llanuras) | 12 + constructor | Ketg'sedsar, Herrería, Curtiduría, Cocina común | Peletería, Desolladero, Corrales, Carpintería, Sastrería, Herboristería, Casa de curas, Taller de alquimia, Obrador de piedra; y el Embarcadero de pesca, en El Embarcadero de Ceniza, no en el poblado (ya existe como lugar). El lore de 5 de ellos ya está escrito (A-09) |
| **Clan Helsig** (Helske Tugh, Cristal Helado) | herrero, peletero, cocinero, minero, herborista, alquimista, primeros auxilios | Helsig'sedsar, Herrería, Peletería, Cocina, Boca de mina, Herboristería, Taller de alquimia | Casa de curas (el oficio existe, pero ni Maestro ni edificio) |
| **Clan Goshg** (Silh Makut, Ciénaga) | solo primeros auxilios | Goshg'sedsar | Casa de curas. Los talleres del lore (astillero, resinería, ahumadero, talla de tótems, ver P-06) **no tienen oficio en código**: hacen falta `carpintero-orcos-cienaga`, `cocinero-orcos-cienaga` y un oficio de resina (§ 6) |
| **Concordia / Los del Obelisco** (Goirntes) | ninguno en código | — | Nada hasta que existan oficios Goirntes (§ 6) |
| **Feg Tusha, Feg Ger** (Faerus) | ninguno | — | Nada. Por lore, los Faerus apenas fabrican; Kegi sería la excepción (curtido fino, colmillo) |
| **Keseg Sael, Keseg Prisilke** (Nabieus) | ninguno | — | Nada todavía |

**Producción de facción: agregada, no objeto a objeto.** Las facciones no fabrican objetos reales
en su Almacén (`AlmacenItem.factionId` existe, pero solo se llena cuando el jugador les vende en el
mercado). Se hace lo que X4 con la economía de las IA, que se simula por agregados:
- cada edificio de facción `ACTIVO`, con su nivel, suma a `KingdomStats` de la facción (ya
  generalizado a `factionId`);
- la Cocina suma comida, y el resto suma riqueza o "producción" según su clase.

Así la guerra por estructuras de § 7.4 tiene consecuencia económica real (quemar la Cocina Serhu
les baja la comida) sin montar un almacén por facción. **Aprobado por Álvaro (2026-09-28).**
Problemas conocidos: se ejecuta en el turno de cada partida, sin consumo, y las facciones no tienen
stock que vender (referencia técnica, H-2 y H-6).

## 5. Nombres por raza y por asentamiento

La receta usa el nombre genérico (patrón `"[Oficio] del Clan [X]"` para las facciones, ya en uso).
Para el jugador orco, el nombre lleva la región igual que la Choza: *"Herrería Orca de las
Llanuras"*. Los salones siguen siendo `[Clan]'sedsar`. Nada de nombres Kektira nuevos: no hacen
falta y se evita inventar vocabulario.

## 6. Extensiones que este diseño deja preparadas (no incluidas)

- **Estaciones de recolección sin oficio** (Bellwright): Leñera (madera de Telda o Trepador),
  Cantera (Roca de Llanura Roja, Rovalnica), Fibrería (Enredaderas, Chudos). Receta sin
  ingredientes y trabajador sin gate de oficio. Solo si hace falta alimentar las cadenas sin que el
  jugador recolecte a mano.
- **Oficios de la Ciénaga** (para que los talleres Goshg del lore sean edificios de verdad):
  `carpintero-orcos-cienaga` (astillero de pilotes y canoas), `cocinero-orcos-cienaga` (ahumadero)
  y un oficio nuevo, **resinero**, para antorchas, calafate y el comercio de resina de la Senda del
  Sílice. Cada uno con su Maestro Goshg.
- **Oficios Goirntes**: fundidor (aleación de Hierba del Hierro), tallador de piedra (Las Canteras
  del Eje) y archivero (documentos). Esperan a que la Meseta sea jugable.
- **Edificios de defensa** (`edificioTipo: 'defensa'`): empalizada, torre de vigía y foso de estacas,
  para los Cuarteles de Guerra. Van en un diseño aparte, más cercano al combate.

## 7. Implementación (para la pasada de código)

**Receta y validación**
- [x] `construction.ts` (2026-09-28): 14 `ConstructionRecipe` de nivel 1 (`raza: 'orcos'`,
  `requiresAyuntamiento: true`) y 28 de mejora (niveles 2 y 3) con `upgradesRecipeKey`. Ajuste
  sobre el diseño original: el nivel 1 lleva el `oficio` PROPIO del edificio (herrero, curtidor…),
  no `constructor-orcos-llanuras`. Ese oficio no bloquea (solo `constructor` bloquea), solo da
  alivio de requisitos: cualquiera puede levantar un Taller;
  `constructor-orcos-llanuras` sí se exige en las 28 mejoras (Obrador/Gran obrador), coherente con
  que mejorar es una obra de construcción real. Añadidos a `ConstructionRecipe`:
  - `oficioProducido` (qué oficio trabaja dentro);
  - `condicionRegion?: 'costa' | 'veta'`;
  - `edificioOficioNivel`/`ayuntamientoNivelMinimo` (paralelos a `ayuntamientoNivel`, para el
    mismo mecanismo UPDATE-de-tier de las mejoras).
- [x] `computeBuildBlockedReason` (2026-09-28): condición de región ('costa' = TerrainTag
  costero/acuático, 'veta' = proxy 'rocoso' — no existe tag 'veta' propio), Jaula requerida para
  Corrales, y nivel mínimo de Ayuntamiento (`ayuntamientoNivelMinimo`) para las mejoras. El nivel
  de `constructor` mínimo se exige vía `requisitos`/`oficio` normales (mismo patrón que ya usa el
  propio Ayuntamiento mediano/grande), no un mecanismo de "nivel de oficio mínimo" nuevo.

**Motor de producción**
- [x] `kingdomProduction.ts` (2026-09-28): gate nuevo `NIVEL_EDIFICIO_INSUFICIENTE`
  (`nivelEdificioRequeridoParaTier`, construction.ts). Plazas de trabajador por nivel (1/2/4,
  `plazasTrabajadorParaTier`) aplicadas en la ruta de asignar `Companion.buildingId`
  (companeros.ts) — sin cambio en el motor puro, el tope vive en la ruta HTTP.
- [x] Casa de curas, servicio (2026-09-28): en el tick diario, TODOS los `Companion` de Reino
  (`rolReino` no null) heridos de la partida bajan un estado más, reutilizando `oneStepBetterThan`
  (death.ts) — no solo los que trabajan en la propia Casa de curas.
- [x] Cocina común (2026-09-28): su producción suma directo a `KingdomStats.comida` (turnResolution.ts,
  junto al depósito en Almacén) — `COMIDA_POR_TRABAJADOR` (kingdomTick.ts) se queda intacto para el
  Reino del jugador, sin tocar ese sistema aparte.
- [x] Facciones (2026-09-28, validado con Álvaro): agregado diario de los edificios de facción
  `ACTIVO` a su `KingdomStats` (`tickFactionProduction`, kingdomTick.ts) — recorre TODAS las
  facciones del mundo en cada turno que cruza un día, independiente del Reino del jugador.

**Catálogo y seed**
- [x] `worldCatalog.ts` (2026-09-28): sembrados los edificios de facción que faltaban con Maestro
  real — Serhu: Herboristería/Alquimia/Corrales/Desolladero/Carpintería (tanda A-09) +
  Peletería/Sastrería/Casa de curas/Embarcadero de pesca (esta tanda), con su `ZonePoint`. Helsig
  ya estaba completo salvo Casa de curas. **Aplazados**: Obrador de piedra (Serhu) y Casa de curas
  (Helsig) — sus oficios (`constructor-orcos-llanuras`, `primeros-auxilios-orcos-cristal`) no
  tienen ningún Maestro sembrado todavía. Goshg (P-06) sigue aplazado del todo.
- [x] Recetas de extracción (2026-09-28): 4 `CraftingRecipe` sin ingredientes (mena de hierro,
  pesca, hierbas, leche de Múrgol) con `requiresUnlock: true` sin desbloquear nunca — solo
  asignables desde el panel de Reino, nunca crafteables a mano.

**Frontend, imágenes y tests**
- [x] Parcelas `BASICA`: confirmado sin cambios — `candidateRecipesForBasica()` ya es genérico, los
  14 edificios de nivel 1 aparecen solos como candidatos (todos `requiresAyuntamiento`, sin
  `upgradesRecipeKey`, sin `isCuartelAvanzado`).
- [x] Prompts de imagen: confirmado sin cambios — el sistema genera el prompt bajo demanda a partir
  de `name`/`description` de la receta (`imagePromptGenerator.ts`), igual que cualquier otra
  `ConstructionRecipe` ya existente; no hace falta escribir nada a mano por edificio.
- [x] Tests (2026-09-28): unitarios en `construction.test.ts`/`kingdomProduction.test.ts`/
  `kingdomTick.test.ts` (receta por nivel, condición de región, gate de nivel de edificio, servicio
  de Casa de curas, agregado de facción) + integración contra Postgres real en
  `turn.integration.test.ts`/`companeros.integration.test.ts` (gate de nivel de edificio en un
  turno real, Casa de curas curando de verdad, plazas de trabajador, producción de facción real
  del Clan Serhu).

---

**Ver también:** [construcciones-reino.md](construcciones-reino.md) (§ 4.4-ter motor de producción, § 7.4 cupos y parcelas) · [17-reglas-construcciones-reino.md](../../mecanicas/17-reglas-construcciones-reino.md) · [Llanuras § Karot Veku](../lore-mundo/regiones/llanuras-del-viento-rojo.md#karot-veku-el-campamento-del-clan-serhu) · [Ciénaga](../lore-mundo/regiones/cienaga-troncal.md) · [propuestas-aprobadas.md](../../borradores-opencode/propuestas-aprobadas.md)
