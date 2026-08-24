# Helek Sirik — Materiales procesados y oficios regionales de construcción — APLICADO al motor

[← Volver al índice del mundo](../07-mundo-helek-sirik.md)

*Diseño de sistema (2026-08-24, sesión conjunta autora/Claude) — surgió al intentar cerrar el
rebalanceo de coste de Campamento/Ayuntamiento: la usuaria señaló que pedir recursos base
fungibles ("cualquier piedra vale") está mal — un edificio debería depender de qué oficio
REGIONAL tienes aprendido, y de materiales PROCESADOS (bloques, lingotes, columnas...), no de
recursos crudos directos, cada vez más según sube el tier del edificio. Diseño cerrado el mismo
día; el mediano/grande del Ayuntamiento se aplicó al motor en una pasada posterior, ver
§ "Aplicado al motor" más abajo.*

---

## Grounding — esto NO es tan nuevo como parecía

Al investigar antes de diseñar, se encontró que la idea ya se había planteado y parcialmente
construido el 2026-07-29 ("petición explícita, ejemplo dado por la usuaria: 'transformar piedra
en bloques de construcción'"), pero nunca se conectó con nada:

- **`STONE_BLOCK_RECIPE`** (`crafting.ts`) ya existe: 5 Piedra → 1 "Bloque de piedra tallada"
  (`bloque-piedra-tallada`, `category: 'bloque'`), gateada por `oficio: 'constructor-orcos-llanuras'`.
  **Ningún `ConstructionRecipe` consume este bloque hoy** — Campamento/Choza/Ayuntamiento siguen
  pidiendo Piedra en bruto directamente. Huérfano, exactamente el mismo patrón que los 8 items
  huérfanos ya encontrados en la auditoría de items.
- **Los oficios ya son regionales por su propio nombre** — `herrero-orco-llanuras`,
  `curtidor-orcos-llanuras`, `carpintero-orcos-llanuras`, `constructor-orcos-llanuras`,
  `desollador-orcos-llanuras` (`startingProfessions.ts`, comentario de cabecera: "professions.ts
  ahora escala cada oficio por raza+región"). Un personaje que aprendió
  `constructor-orcos-llanuras` solo sabe construir con las técnicas/materiales de esa cultura —
  el "candado regional" no necesita ninguna etiqueta nueva en los objetos, ya vive en qué oficio
  aprendiste.
- **`ConstructionRecipe.oficio` ya existe y ya se usa** (`construction.ts:512`,
  `alivioForLevel(oficioNivelById.get(buildRecipe.oficio) ?? 1)`) — pero **solo da un alivio de
  requisito si tienes el oficio, nunca bloquea si no lo tienes** (sin el oficio, se trata como si
  estuvieras a nivel 1, no como "no puedes intentarlo"). Gap real: hoy nada impide construir un
  Ayuntamiento orco de las Llanuras sin haber aprendido `constructor-orcos-llanuras` en absoluto.
  Ninguna receta de construcción existente declara `oficio` hoy tampoco (ni Campamento ni
  Ayuntamiento) — el campo está ahí, sin usar.
- **`lingote-de-hierro`** (`crafting.ts`, oficio `herrero-orco-llanuras`) es el otro precedente de
  "recurso crudo → material procesado" que ya existe, aunque con `category: 'metal'` (no
  `'bloque'` como el de piedra) — inconsistencia de categoría entre los dos únicos precedentes,
  ver § Categorías abajo.

---

## Diseño cerrado con la usuaria

**Dos candados regionales en cascada, no uno**:
1. **El oficio de construcción en sí es regional** (`constructor-orcos-llanuras`, o el equivalente
   de cada raza+región cuando se diseñen) — determina QUÉ construcciones puedes intentar en
   absoluto. Sin el oficio de esa región, ni te lo planteas.
2. **Los materiales que esas construcciones piden vienen de oficios de PROCESADO igual de
   regionales** (herrero/curtidor/carpintero/constructor, cada uno con su propia receta de
   crafteo que convierte recurso crudo → material procesado). El oficio de construcción no
   fabrica él mismo todo — puede necesitar que TÚ (u otro con el oficio correspondiente) hayas
   procesado antes la piedra en bloques, la mena en lingotes, el hueso en columnas.

**Escalado por tier — menos crudo, más procesado cuanto más grande el edificio**:
- **Campamento / tier más bajo**: mayormente recursos base directos (coherente con su propia
  descripción — "un cerco improvisado y rápido de levantar", nadie procesa nada para pasar la
  noche).
- **Ayuntamiento pequeño**: todavía mayormente crudo, primer contacto con algo procesado.
- **Ayuntamiento mediano/grande**: la proporción de materiales procesados crece con cada nivel —
  la "capital de verdad" no se levanta con piedras sueltas, se levanta con bloques ya tallados,
  lingotes ya fundidos, vigas ya trabajadas.

**Gap a cerrar cuando se implemente** (no solo diseño, es un cambio de comportamiento real):
`ConstructionRecipe.oficio` debe pasar de "solo da alivio" a **bloquear de verdad** si el
personaje no tiene el oficio aprendido — mismo criterio que `OFICIOS_CON_HERRAMIENTA_REQUERIDA`
ya usa para herramientas de crafteo (una lista explícita de qué oficios de construcción SÍ
exigen tenerlo, en vez de cambiar el comportamiento por defecto de golpe para todas las recetas
existentes).

---

## Categorías: crudo → procesado, una por recurso

Repasado el catálogo real antes de proponer nombres — las categorías crudas ya existen todas
(`piedra`, `madera`, `hueso`, `mena`/`metal`, `resina`, `fibras`). Para las procesadas, sigo el
precedente real de `bloque-piedra-tallada` (categoría `bloque`, nueva y propia, no reutiliza
`piedra`) en vez del precedente de `lingote-de-hierro` (categoría `metal`, reutiliza la del
crudo) — más consistente para poder pedir "procesado" como su propio requisito, separado del
crudo, en cualquier receta futura:

| Recurso crudo (categoría) | Material procesado (propuesto) | Categoría procesada | Oficio que lo produce | Ratio crudo→procesado |
|---|---|---|---|---|
| Piedra (`piedra`) | Bloque de piedra tallada | `bloque` | `constructor-orcos-llanuras` **(ya existe)** | 5:1 **(ya existe, `STONE_BLOCK_RECIPE`)** |
| Leña (`madera`) | Viga de madera tallada *(nueva)* | `viga` | `carpintero-orcos-llanuras` | 4:1 *(propuesto)* |
| Hueso (`hueso`) | Columna de hueso *(nueva)* | `columna` | `constructor-orcos-llanuras` | 3:1 *(propuesto)* |
| Mena (`mena`) | Lingote de hierro (`lingote-de-hierro`, **ya existe**) | `metal` *(inconsistente, ver arriba — no tocado a propósito, es un item ya en uso)* | `herrero-orco-llanuras` | 4:1 **(ya existe)** |
| Resina (`resina`) | Sin material procesado — se queda cruda incluso en tiers altos (una resina no se "talla", se usa tal cual como sellante/adhesivo) | — | — | — |
| Fibra (`fibras`) | Cordaje trenzado *(nueva)* | `cordaje` | `curtidor-orcos-llanuras` | 4:1 *(propuesto)* |

*(Resina sin procesado es una decisión de esta pasada, no una limitación técnica — si más
adelante se le encuentra un uso procesado real, se añade igual que el resto.)*

---

## Ayuntamiento — números de partida (2026-08-24)

**Pequeño — APLICADO al motor** (`AYUNTAMIENTO_PEQUENO_RECIPE`, `construction.ts`; tests
actualizados en `construction.test.ts`/`turn.integration.test.ts`). Cifras dadas por la usuaria,
100% crudo, sin oficio de construcción exigido (nivel de entrada, cualquiera con la Carisma que ya
pide puede intentarlo). Mediano y grande de abajo siguen siendo solo diseño.

| Recurso | Cantidad |
|---|---|
| Madera (leña) | 6 |
| Hueso | 6 |
| Resina | 8 |
| Metal (mena) | 2 |
| Fibra | 8 |
| Piedra | 14 |

**Mediano y grande — cerrado (2026-08-24).** Regla dada por la usuaria: mediano ≈75% procesado /
25% crudo por categoría procesable; grande 100% procesado en todo lo procesable — "así es difícil
de ampliar" (a propósito: el grande exige tener los 4 oficios de procesado — constructor/herrero/
carpintero/curtidor — a buen nivel A LA VEZ, no solo más cantidad de lo mismo). La resina nunca
tiene versión procesada (ver tabla de arriba), así que se queda fuera de la regla 75/25 — sigue
siendo 100% crudo en los tres niveles, solo crece en cantidad.

| Categoría | Pequeño (100% crudo) | Mediano (~75% procesado / 25% crudo) | Grande (100% procesado) |
|---|---|---|---|
| Piedra | 14 | 3 Bloques + 5 Piedra cruda | 8 Bloques |
| Metal (mena) | 2 | 1 Lingote + 1 Mena cruda | 4 Lingotes |
| Madera | 6 | 2 Vigas + 3 Leña cruda | 5 Vigas |
| Hueso | 6 | 2 Columnas + 2 Hueso crudo | 5 Columnas |
| Fibra | 8 | 2 Cordajes + 3 Fibra cruda | 5 Cordajes |
| Resina | 8 | 12 (crudo, siempre) | 20 (crudo, siempre) |

`oficio: 'constructor-orcos-llanuras'` se exige (bloqueo real, no solo alivio — ver § gap arriba)
desde el mediano en adelante; el pequeño se queda accesible sin oficio, coherente con ser "nada
imponente todavía".

---

## Aplicado al motor (2026-08-24)

- 3 items nuevos en `ItemCatalog` (`worldCatalog.ts`): Viga de madera tallada (`viga`), Columna de
  hueso (`columna`), Cordaje trenzado (`cordaje`).
- 3 `CraftingRecipe` nuevas (`crafting.ts`): `WOOD_BEAM_RECIPE` (4 madera → 1 viga, oficio
  `carpintero-orcos-llanuras`), `BONE_COLUMN_RECIPE` (3 hueso → 1 columna, oficio
  `constructor-orcos-llanuras`), `BRAIDED_CORDAGE_RECIPE` (4 fibra → 1 cordaje, oficio
  `curtidor-orcos-llanuras` — este SÍ exige también la herramienta de curtidor,
  `OFICIOS_CON_HERRAMIENTA_REQUERIDA` ya lo incluía). Mismo patrón que `STONE_BLOCK_RECIPE`:
  ingrediente por categoría (cualquier leña/hueso/fibra sirve), `location: null`.
- `bloque-piedra-tallada` y `lingote-de-hierro` conectados a construcción real por primera vez —
  ambos consumidos ahora por el Ayuntamiento mediano/grande.
- `ConstructionRecipe.oficio` pasa de "solo alivio" a bloqueo real: `OFICIOS_CONSTRUCCION_REQUERIDOS`
  nuevo en `construction.ts` (hoy solo `['constructor']`), `checkRecipe` gana un 7º parámetro
  `tieneOficio` (default `true`, no rompe callers existentes) que añade un `RequirementShortfall`
  binario ("el oficio de X") si la receta lo exige y el personaje no lo ha aprendido en absoluto —
  distingue "nivel 1 por no tenerlo" de "no lo tiene". Hilado por `turnResolution.ts`
  (`tieneOficioFor`, mismo patrón que `alivioFor`) y `construction.ts` (`planDeterministicBuild`).
- `AYUNTAMIENTO_MEDIANO_RECIPE`/`AYUNTAMIENTO_GRANDE_RECIPE` actualizadas con las cifras cerradas de
  la tabla de arriba, ambas con `oficio: 'constructor-orcos-llanuras'` (bloqueo real desde mediano
  en adelante; el pequeño se queda sin exigirlo).
- Tests: `construction.test.ts` (mediano/grande con la mezcla nueva + describe dedicado del
  bloqueo de oficio), `crafting.test.ts` (3 recetas nuevas, 26 en total),
  `turn.integration.test.ts` (giveMaterials del test "mejora a mediano" actualizado). `tsc -b`
  limpio, sin regresiones nuevas.

**Pendiente de tu lado** (no gestiono tu Postgres): aplicar la migración de `Estacion`/`EstadoClima`
no aplica aquí (esta pasada no toca el schema), pero SÍ hace falta `npm run seed-catalog` para que
los 3 items/3 recetas nuevas lleguen a tu mundo ya sembrado.

Cuando se diseñen construcciones de otras razas/regiones (Goirntes/Meseta, Nabieus/Margen,
Faerus/Bosque...), cada una necesitará sus propios oficios regionales y quizá sus propios
materiales procesados — este documento solo cierra el caso orco/Llanuras, el patrón general queda
documentado para repetirlo.
