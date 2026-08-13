# Puntos de código a tocar al añadir/editar contenido

**Qué es:** el mapa completo de "si edito o añado un X, ¿qué archivos tengo que tocar?" para las 6
categorías de contenido del juego (objeto, NPC/personaje, fauna, flora, habilidad, ubicación).
Complementa a `docs/nuevo-elemento-catalogo.md` (que se centra en QUÉ CAMPOS rellenar del catálogo
y por qué) — este archivo se centra en QUÉ ARCHIVOS del código, más allá del propio catálogo, hay
que revisar o modificar. Todas las rutas son relativas a la raíz del repo.

Generado auditando el código real (2026-08-01), no solo la documentación existente — donde la
documentación anterior estaba desactualizada (referencias a Supabase, comandos de verificación
incorrectos), se corrige aquí y se señala explícitamente.

---

## 1. Objeto nuevo

**Datos:** `backend/src/scripts/worldCatalog.ts`, interfaz `ItemCatalogInput` (línea 1640), array
`items` (línea 1704). Modelo Prisma `ItemCatalog` (`schema.prisma:1142`). *(Números de línea
verificados 2026-08-13 — `worldCatalog.ts` ha crecido mucho desde el 2026-08-01 original por las
sucesivas ampliaciones de lore, así que estas referencias se desactualizan rápido; si vuelven a
quedar desfasadas, un `grep -n` del nombre exacto es más fiable que confiar en el número.)

| Campo | Para qué sirve de verdad (dónde se consume) |
|---|---|
| `name` | Nombre de Enciclopedia + clave de detección por defecto (`entityDiscovery.ts:44`, `enciclopediaIndex.ts:60`) |
| `aliases?` | Mismo detector que `name`, vía `.includes()` **sin ningún filtro de longitud** (`entityDiscovery.ts:69`) — riesgo real de colisión, ver sección de alias más abajo |
| `category` | Texto libre, pero DEBE estar en el vocabulario de `itemTaxonomy.ts:9` (`CATEGORY_VOCAB_BY_TIPO`) — `assertValidCategory` **aborta `seed-catalog` si no coincide**. Copia cosmética en frontend: `enciclopediaTargets.ts:29-88` (si se omite ahí, solo afecta al agrupado visual, no rompe nada) |
| `tipo` | Enum Prisma `ItemTipo` (`RECURSO/MATERIAL/EQUIPABLE/CONSUMIBLE/NARRATIVO`) — orden/etiqueta en frontend: `enciclopediaTargets.ts:93-100` |
| `equipSlot?` | Solo relevante si `tipo:EQUIPABLE` — familia de ranura en `equipment.ts:78` (`equipSlotFamily`), **copia duplicada a mano** (no comparten tipo) en `frontend/src/lib/equipSlots.ts:31` |
| `description` | **Llega al Narrador de verdad** — vía `equipment.ts` `equippedItemsSummary()` (si se equipa) o `npcScene.ts` `itemsLine()` (si lo lleva un NPC) |
| `statBonuses?` | Mapa `{atributo: valor}` (2026-08-03, sustituye al par `statBonusAttribute`/`statBonusAmount` — varios bonus a la vez en un solo objeto), ver `StatBonusMap` (`equipment.ts:14`). `equipment.ts:34` `effectiveAttributes()` (los 7 atributos jugables) o `equipment.ts:51` `effectiveDefense()` (clave especial `'defensa'`) — un mismo objeto puede dar de las dos cosas a la vez |
| `dimensiones?`/`lugarOrigen?` | Solo alimentan el prompt de generación de imagen (`imagePromptContext.ts:76-77`); `lugarOrigen` ADEMÁS lo lee `discovery.ts:53` (`coreRegionOf`) para filtrar descubrimientos por región — si menciona una región, debe ser una de `REGION_CORE_NAMES` (ver §6) |
| `tier?`/`requisitos?` | Solo gate de equipar en el backend, nunca una tirada |
| `curaHasta?` | Solo si `category:'medicinal'` — `death.ts` `healCeilingFor` |
| `tipoArma?` | Solo si `category:'arma'` — genera habilidades de combate solo, ver §5 (deep-dive de categoría de arma) |
| `curaEnergia?` | Sistema de fatiga, sin más cableado |

**Tras editar `worldCatalog.ts`:**
```
cd backend
npm run seed-catalog   # upsert contra el Postgres LOCAL (podman) — SÍ actualiza partidas en curso
```
`seed-catalog` es **solo upsert, nunca borra**: renombrar/quitar un `slug` en `worldCatalog.ts`
deja la fila huérfana en Postgres para siempre (no existe script de limpieza).

**Imágenes** (opcional): `backend/uploads/images/item/<slug>-thumbnail.<ext>`/`<slug>-banner.<ext>`
— basta con que el archivo exista (`imageAssets.ts:13-21`), no hace falta fila en la DB. El texto
del prompt de imagen sí es opcional pre-sembrar (`npm run seed-image-prompts`, paso explícitamente
opcional en `docs/15-instalacion.md`).

**Tests:** `itemReference.test.ts`, `equipment.test.ts`, `weaponAbilities.test.ts`.

---

## 2. NPC de historia y personaje jugable

**NPC de historia — datos:** `worldCatalog.ts`, interfaz `NpcInput` (línea 833), array `npcs`
(línea 1164). Modelo `Npc` (`schema.prisma:924`), enums `NpcKind`/`Temperamento`.

| Campo | Para qué sirve de verdad |
|---|---|
| `aliases` | **Obligatorio, no opcional.** `npcScene.ts:109` `matchNpcAliases` — mismo `.includes()` sin filtro de longitud que items (riesgo real, ver §7) |
| `articulo?` | Solo para NPCs cuyo `name` sea un sustantivo descriptivo que el modelo pueda confundir de género (ver comentario en `schema.prisma:872`, caso real "orca enfurecida") |
| `bio`/`personality` | Van al bloque "PERSONAJE EN ESCENA" del Narrador (`npcScene.ts`) |
| `homeLocationSlug?` | Debe ser un slug real de `locations` — decide región para `detectNpcsInScene` (`npcScene.ts:195-203`) y descubrimientos (`discovery.ts`) |
| `raza?`/`clase?` | Solo humanoides. `raza` debe existir en `BERIG_RAZAS` (berigLore.ts), `clase` debe ser `'Guerrero'`/`'Cazador'` (classAbilities.ts) — decide qué habilidades de combate muestra su ficha |
| `ataqueNatural?`/`habilidadesRaciales?` | Alternativa a `raza`/`clase`, solo fauna (máx. 6) |
| `temperamento?` | Default `CAUTELOSO` — decide `shouldForceCombat` (turnResolution.ts): AGRESIVO/ENEMIGO fuerzan combate, INOFENSIVO/AMIGABLE nunca |
| `comerciablePct`/`reclutablePct`/`domesticablePct`/`capturablePct`/`cortejablePct` | Solo datos hoy, sin mecánica real todavía (comentario explícito en `schema.prisma:933-939`) — se puede omitir sin problema |
| `loadout` | El objeto debe existir ya en `items`, o `seed-catalog.ts:119` lanza error |

**Personaje jugable pregenerado — dos sistemas SEPARADOS, hay que tocar los dos:**

1. **Solo ficha de lore** (sin jugarlo): `berigLore.ts`, `BERIG_PERSONAJES` (líneas 278-347) — usado
   por `enciclopediaIndex.ts:73-80` (Gorhorn se excluye ahí a propósito, demasiado ruidoso).
2. **Jugable de verdad** (hoy solo Gorhorn) — condicionado por `characterName === 'Gorhorn'` a mano
   en: `berigLore.ts:353` (`razaFor`), `startingAbilities.ts:79`, `startingInventory.ts:103`,
   `startingSecondaryAttributes.ts:20`, `startingQuests.ts:38`, `protectedFacts.ts:8`,
   `travel.ts:265` (`initialLocationSlugFor`) — **hacer jugable a alguien nuevo exige tocar los 7**,
   más:
   - `frontend/src/data/mock.ts:27` `pregeneratedCharacters` — array aparte a mano, con
     `introCharacterText`/`introWorldText` (hoy solo rellenos para Gorhorn).
   - `frontend/src/pages/CharacterSelect.tsx:27` `PLAYABLE_CHARACTER_IDS` — un `Set` que oculta a
     todos los demás personajes pregenerados de la UI (decisión explícita: "por ahora que solo
     salga Gorhorn") — hay que añadir el id nuevo aquí.

**Seeding:** mismo `seed-catalog.ts` (`npcs`+`fauna` juntos, línea 80) — upsert, mismo riesgo de
fila huérfana que items.

**Tests:** `npcScene.test.ts`, `npcCombatAbilities.test.ts`, `dynamicAbilities.test.ts`.

---

## 3. Fauna

Se modela como filas de `Npc` con `kind:'PLANTILLA'`, en el array `fauna` (`worldCatalog.ts:889`),
con el MISMO slug que su `HarvestYield.sourceSlug` (reutilizado a propósito, comentario en la línea
466-474, para que combate/`NpcState`/detección funcionen sin tocar nada más). `loadout: []` siempre
— el botín sale de `HarvestYield`, no de `NpcItem`.

Todo el §2 aplica igual, **más la capa de cosecha/botín**:

- `HarvestYieldInput` (`worldCatalog.ts:3221`), array `harvestYields` (3233) — una fila por
  `{sourceSlug, itemSlug}`. **Invariante que hace abortar `seed-catalog.ts:129-141`**: todas las
  filas del mismo `sourceSlug` deben compartir `metodoObtencion`.
- `harvestSourceAliases` (línea 3769) — usado por `harvest.ts:38`, `entityDiscovery.ts:53`, y el
  endpoint de Enciclopedia (`world.ts:115`). **Importante**: este diccionario (y `harvestSourceRegion`
  línea 3835, `harvestSourceDescriptions` línea 3857) se lee directo del módulo TS en cada petición
  — **`seed-catalog.ts` NUNCA los escribe en Postgres** — editarlos surte efecto al momento, sin
  reseeding.
- `harvestYields` es la ÚNICA excepción a "upsert, nunca borra": `seed-catalog.ts:145` hace
  `deleteMany({worldId})` y recrea TODAS las filas del mundo en cada ejecución — quitar una entrada
  del TS sí se refleja al reseeder (al revés que items/npcs/locations).
- Opcional: `worldPopulations` (`worldPopulation.ts`) — solo interno, create-if-missing
  (`seed-catalog.ts:167`, nunca sobreescribe una `poblacion` ya jugada).

**Icono en frontend** (`enciclopediaTargets.ts:113-121`): 🐾 vs 🌿 depende de `entry.esFauna`,
calculado en el backend como `npcSlugs.has(sourceSlug) || harvestSourcesThatAreFaunaWithoutNpc.has(sourceSlug)`
(`world.ts:122`) — una especie animal SIN fila `Npc` (peligro ambiental, sin stats de combate) debe
añadirse a `harvestSourcesThatAreFaunaWithoutNpc` (`worldCatalog.ts:3827`) o se categoriza mal como
"Flora/material" (bug ya documentado en el propio comentario del código, línea 2443-2447).

---

## 4. Flora / mineral

**No existe un array `flora` separado** — pese al nombre de las categorías, una fuente de
flora/mineral es solo un `HarvestYield` (§3) **sin** fila `Npc` correspondiente. En concreto, para
una planta/mineral nuevo se toca solo:

- `harvestYields` (filas de botín)
- `harvestSourceAliases` (detector)
- `harvestSourceRegion` (agrupado por región en Enciclopedia, línea 3835)
- `harvestSourceDescriptions` (descripción visual/lore, línea 3857 — se creó el 2026-07-22 porque
  antes 14 fuentes no tenían NINGÚN texto descriptivo en ningún sitio)
- **Nunca** `harvestSourcesThatAreFaunaWithoutNpc` (ese set es solo para animales sin stats)
- **Nuevo requisito (rediseño de profesiones, 2026-08-07)**: si el recurso debe poder recolectarse
  desde el pop-up de "Minar"/"Talar" (`metodoObtencion: 'MINERIA'` o `'TALA'`, no `'EXTRACCION'`),
  hace falta TAMBIÉN una fila en `worldPopulation.ts` con `targetType: 'RECURSO'` y
  `targetSlug === sourceSlug` — sin ella, `candidateSourcesFor` (`recolectar.ts`) nunca lo ofrece
  ni en "ya localizado" ni en "Explorar", aunque el `HarvestYield` exista y esté bien formado (ver
  `docs/16-poblacion-dinamica.md` § 3.5).

Mismos matices de seed/alias/región que §3.

---

## 5. Habilidad (arma / clase / racial / genérica)

Cuatro sistemas paralelos, todos convergiendo en la misma forma de fila `SavedAction`:

- **De arma** — `weaponAbilities.ts`. Ver deep-dive de categoría más abajo.
- **De clase** — `classAbilities.ts:23` `CLASS_ABILITIES`, `Clase = 'Guerrero'|'Cazador'`.
  `classAbilityUnlocksFor` (línea 86) tiene `characterName !== 'Gorhorn'` a mano — un segundo
  personaje jugable con una clase distinta necesitaría tocar esta función (ya señalado como hueco
  futuro en el propio comentario del código, línea 82-85).
- **Racial** — dos mecanismos DISTINTOS: `berigLore.ts` `BERIG_RAZAS[].habilidadesRaciales.{ataque,defensa}`
  (2 fijas) para humanoides; `Npc.habilidadesRaciales` (hasta 6) para fauna — no son lo mismo.
- **Genérica** — `genericCombatAbilities.ts:16` (`Defenderse`/`Esquivar`) + "Ataque Básico" de
  `weaponAbilities.ts` (armado/desarmado, generado dinámicamente, no una lista estática).

Las cuatro se ensamblan por partida en `dynamicAbilities.ts:54` (`dynamicCombatAbilitiesFor`) y se
persisten en `SavedAction` (`isDynamic:true`) — se recalcula al crear partida, al equipar/desequipar,
y al cruzar nivel 20.

Campos comunes (`name`, `icon`, `description` [3ª persona, tooltip], `promptText` [1ª persona, al
Narrador], `preferredAttribute`, `effect`):

- **`effect: AbilityEffect`** (`ATAQUE|ATURDIMIENTO|REMATE|INTIMIDACION|AGUANTE`) — se gestiona con
  comparaciones `===` sueltas en `turnResolution.ts` (`resolveCombatExchangePhase`, líneas 546-559,
  `AGUANTE` aparte en la línea 760), **no un `switch` exhaustivo**. ⚠️ **Un valor nuevo de
  `AbilityEffect` compila perfectamente aunque nadie le añada gestión en `turnResolution.ts`** — se
  comportaría como un `ATAQUE` normal en silencio, sin avisar de nada. Es el hueco más importante de
  todo este documento: añadir un `effect` nuevo al enum de Prisma NO basta, hay que ir a
  `turnResolution.ts` a mano.
- `energyCost`/`energyRegen` — sistema de fatiga (`energy.ts`), constantes fijas.

**Tests:** `dynamicAbilities.test.ts`, `weaponAbilities.test.ts`, `npcCombatAbilities.test.ts`,
`turn.classify.test.ts`.

### Deep-dive: categoría de arma nueva (`WeaponCategory`)

Enum en `schema.prisma:623` (`HACHA MAZA GARROTE PICA LANZA CUCHILLO DAGA ESPADA ESCUDO`).

**Arma nueva de una categoría YA existente**: solo la fila de `ItemCatalogInput` con
`tipoArma:'HACHA'` (etc.) — nada más que tocar, el contenido de habilidad es compartido por
categoría.

**Categoría nueva de verdad** (p. ej. `BALLESTA`) — TODO esto:

1. `schema.prisma:623-635` — añadir el valor al enum. Migración a mano, p. ej.
   `ALTER TYPE "WeaponCategory" ADD VALUE 'BALLESTA';` (sintaxis confirmada contra migraciones
   reales ya aplicadas: `20260729130000_temperamento_5_escalones`, `20260730210000_equip_slot_consumibles`).
2. `weaponAbilities.ts:11` `WEAPON_CATEGORY_ATTRIBUTE` — **esta SÍ falla en tiempo de compilación**
   (`npx tsc --noEmit`) si falta, porque está tipado contra el `WeaponCategory` real de
   `@prisma/client` (regenerado por `prisma generate`). Red de seguridad real.
3. `weaponAbilities.ts:124` `WEAPON_REAL_ATAQUE_CONTENT` — ⚠️ **NO falla en compilación** (está
   tipado contra una unión literal copiada a mano, no contra `WeaponCategory`). Si se olvida: nada
   avisa al compilar, pero en cuanto un jugador se equipe esa arma, `weaponAbilitiesFor()`
   (línea 250/281/285) hace un cast inseguro y un spread de `undefined` →
   **`TypeError: Cannot convert undefined or null to object` en pleno turno de juego**. El gotcha
   más peligroso de todo este documento — nada lo detecta antes de que alguien lo sufra jugando.
4. `weaponAbilities.ts:182` `weaponCategoryForRealAbilityName()` — camino inverso ya usado por
   `turnResolution.ts` para nombrar el arma exacta en narración; se cubre solo en cuanto el punto 3
   está bien hecho, no hace falta tocarlo aparte.
5. `WEAPON_ABILITY_AVANZADA_CONTENT` (línea 100) — está indexado por GRUPO DE ATRIBUTO
   (`'fuerza'|'destreza'`), no por categoría — solo hay que tocarlo si la categoría nueva usa un
   atributo distinto de esos dos (hoy no hay ninguna categoría de ataque con otro atributo).
6. `weaponRoleFor()` (línea 28) — solo `ESCUDO` es especial (`'defensa'`); cualquier categoría
   nueva es `'ataque'` por defecto, sin tocar nada salvo que también deba ser defensiva.
7. **El frontend no tiene ninguna copia de `WeaponCategory`** (confirmado por grep, cero resultados
   en `frontend/src`) — solo renderiza las `SavedAction` ya resueltas por el backend. Nada que tocar
   ahí para una categoría nueva.

---

## 6. Ubicación nueva

**Datos:** `worldCatalog.ts`, `LocationInput` (línea 11), array `locations` (20). Modelo `Location`
(`schema.prisma:232`).

- `aliases` obligatorio — `travel.ts:85` (`matchDestination`), mismo `.includes()` sin filtro que
  NPCs (ver §7).
- `description` — va al Narrador al llegar/estar ahí (`turnResolution.ts`).
- `region` — texto libre, pero para que la maquinaria consciente de región la reconozca debe
  coincidir EXACTAMENTE con una de estas dos listas, mantenidas por separado:
  - `discovery.ts:44` `REGION_CORE_NAMES` (`Llanuras del Viento Rojo`, `Cristal Helado`, `Ciénaga
    Troncal`, `Margen Silencioso`, `Meseta del Orden`) — filtra descubrimientos y el agrupado de
    fauna/flora "zona de origen" en la Enciclopedia (`world.ts:392`).
  - `narrationLint.ts:10` `KNOWN_REGIONS` — alimenta `lintRegionMismatch`, el detector de "la
    narración menciona una región donde el jugador no está" (`docs/revisar-partida.md`).
  Una región COMPLETAMENTE nueva (ninguna de esas 5) necesita las dos listas actualizadas, o el
  filtrado de descubrimientos/el lint de región simplemente no la reconocen — sin avisar de nada.
- **La conectividad no es automática**: hace falta al menos una fila en `locationLinks`
  (`worldCatalog.ts:508`, `LocationLinkInput`) o la ubicación queda huérfana, inalcanzable por
  `travel.ts` (`shortestPath`) — nada falla, simplemente nunca aparece como destino de viaje.
- **Mapa del frontend**: `frontend/src/data/map.ts:76` `llanurasNodePositions` — tabla de
  coordenadas x/y mantenida a mano, por slug. `MapaPanel.tsx:52` filtra
  `locations.filter(l => l.slug in llanurasNodePositions)` — ⚠️ **una ubicación que falte aquí
  desaparece en silencio del mapa visual**, sin error, aunque funcione perfectamente en Enciclopedia
  y viajes. Si además es una región nueva, `beriRegions` (`map.ts:26`) también necesita entrada.

---

## 7. Colisión de alias — el mecanismo exacto (backend y frontend, unificado 2026-08-11)

**Actualizado 2026-08-11**: hasta esta fecha, backend y frontend usaban dos mecanismos de matching
distintos con riesgo muy diferente. Se unificó el criterio: `matchesAliasBoundary` (nueva,
`travel.ts`) porta al backend el mismo límite de palabra real (`\p{L}\p{N}`, no `\b` de JS — `\b`
trata letras acentuadas como "no palabra" y rompe con nombres propios de este mundo) y la misma
longitud mínima (4 caracteres, `MIN_ALIAS_MATCH_LENGTH`) que ya usaba el frontend
(`enciclopediaIndex.ts` § `MIN_PATTERN_LENGTH`) — solo para aliases de una sola palabra; un alias
multi-palabra ya es específico de sobra y no tiene mínimo propio. Tests de regresión en
`travel.test.ts` (`matchesAliasBoundary`, `matchDestination`) y `npcScene.test.ts`
(`matchNpcAliases`), incluida la reproducción exacta del bug histórico "res"/"presas"/"brasas".

**Dónde se aplica ahora:**
- `npcScene.ts` (`matchNpcAliases`) — la comparación literal (antes `.includes()` puro) ahora pasa
  por `matchesAliasBoundary`. El respaldo con tolerancia a erratas (Levenshtein ≤2, alias de una
  palabra de 5+ letras) es un mecanismo APARTE, sin tocar — sigue teniendo su propio riesgo, ver
  nota de abajo.
- `entityDiscovery.ts` — los 3 puntos de detección (NPC, fauna, objeto — antes `.includes()` sin
  filtro) usan `matchesAliasBoundary` igual.
- `travel.ts` (`matchDestination`) — mismo cambio; sigue ordenando por alias más largo primero
  cuando hay varios candidatos.

**Mecanismo aparte, también revisado en esta pasada**: la tolerancia a erratas por Levenshtein de
`matchNpcAliases` (rama separada de `matchesAliasBoundary`, alias de una sola palabra de 5+
letras) puede dar falsos positivos genuinos entre una palabra común y un alias corto sin relación
semántica. Encontrado escribiendo los tests de esta pasada: `Levenshtein("cazar", "hagar") = 2` —
"cazar" es un verbo muy frecuente en este juego (caza/recolección) y detectaba a Hagar en escena
sin que el jugador lo mencionara. Un barrido sistemático contra ~150 verbos de acción típicos del
juego confirmó que no era un choque aislado: "hagar" (patrón X-a-X-a-r) está a distancia ≤2 de toda
una familia de verbos en "-ar" de la misma longitud — sanar, talar, nadar, matar, apagar, bajar,
pagar, negar, además de los ya documentados lugar/remato-remata/hablar. **Arreglado** añadiendo los
9 verbos nuevos a `NPC_ALIAS_FUZZY_EXCLUSIONS` (mismo mecanismo ya usado para los anteriores — ver
comentario en `npcScene.ts`), con test de regresión para cada uno en `npcScene.test.ts`. El resto
de aliases del catálogo (Torgash, Ulkha, Gistera, Múrgol...) no mostró ningún choque en el mismo
barrido — el problema es específico de "hagar" por su longitud y forma silábica, no genérico de la
rama fuzzy.

**Texto clicable del frontend** (`enciclopediaIndex.ts:35,91`) — sin cambios, ya tenía este
criterio antes: `MIN_PATTERN_LENGTH = 4`, límite de palabra real, orden por longitud descendente.

No existe ningún script permanente de comprobación de colisiones (el `_checkItemAliases.ts` de un
solo uso mencionado en `nuevo-elemento-catalogo.md` se borró tras usarlo, confirmado que ya no está
en `backend/src/scripts/`).

---

## 8. Flujo de migración/seed — correcciones sobre la documentación anterior

`docs/15-instalacion.md` (actualizado 2026-07-30) es la fuente de verdad actual y **contradice**
en un punto material a `docs/nuevo-elemento-catalogo.md`:

- **Desactualizado en `nuevo-elemento-catalogo.md`** (líneas 40 y 91-92): sigue diciendo "upsert
  real contra Supabase" — el proyecto migró a **Postgres local vía podman** el 2026-07-30
  (`docs/15-instalacion.md:5,43-67`) como opción por defecto; Supabase queda solo como alternativa
  documentada. *(Corregido en ese archivo como parte de este mismo cambio.)*
- **Confirmado correcto en ambos**: nunca `prisma migrate dev` (crea una shadow DB sin la
  extensión `pgvector`, falla contra `LoreChunk.embedding vector(768)` — reproducible contra la
  migración `20260717200323_add_lore_chunk_rag`). Flujo real: escribir a mano
  `prisma/migrations/<timestamp>_<nombre>/migration.sql`, luego
  `npx prisma migrate deploy && npx prisma generate`.
- ⚠️ **`backend/package.json` todavía define `"prisma:migrate": "prisma migrate dev"`** — script
  muerto/peligroso que sigue ahí. Si algún día se ejecuta `npm run prisma:migrate` por costumbre,
  falla exactamente por el motivo de arriba.
- **Comportamiento exacto de `seed-catalog`**: `locations`/`items`/`npcs`(+`fauna`)/loadouts son
  upsert de verdad (crea o actualiza por clave única, nunca borra). `harvestYields` es la única
  excepción — borra y recrea TODO el mundo en cada ejecución (línea 145). `worldPopulations` es
  create-if-missing (nunca sobreescribe una `poblacion` ya jugada, línea 163-166). Nada de esto
  borra filas quitadas de `worldCatalog.ts` para locations/items/npcs — hay que limpiarlas a mano
  si hace falta.
- **Comandos de verificación**: además de `tsc`/`vitest`, la CI (`.github/workflows/ci.yml`) corre
  `npm run lint` (oxlint) en los dos paquetes — no lo olvides al verificar en local. El frontend usa
  `npx tsc -b` (project references), nunca `tsc --noEmit -p tsconfig.json`.

---

## 9. Tests — dónde viven los patrones por categoría

| Categoría | Archivos de test de referencia |
|---|---|
| Arma/habilidad | `weaponAbilities.test.ts`, `dynamicAbilities.test.ts`, `npcCombatAbilities.test.ts` |
| NPC/alias | `npcScene.test.ts` (`entityDiscovery.ts` no tiene test dedicado — hueco conocido) |
| Viaje/ubicación | `travel.test.ts` |
| Lint de región | `narrationLint.test.ts` |
| Cosecha/flora | `harvest.test.ts` |
| Equipo/ranuras | `equipment.test.ts` |
| Integración de turno completo | `turn.integration.test.ts`, `saves/creation.integration.test.ts` |

---

## Verificación final antes de dar por cerrado

```
cd backend  && npm run lint && npx tsc --noEmit && npx vitest run
cd frontend && npm run lint && npx tsc -b        && npx vitest run
```

Si se tocó `schema.prisma` o `worldCatalog.ts`: escribir la migración a mano si aplica (nunca
`prisma migrate dev`) y correr `npm run seed-catalog` — editar solo el `.ts` no basta, hay que
sembrarlo contra el Postgres local.
