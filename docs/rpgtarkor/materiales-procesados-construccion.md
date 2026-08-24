# Helek Sirik — Materiales procesados y oficios regionales de construcción

[← Volver al índice del mundo](../07-mundo-helek-sirik.md)

*Diseño de sistema (2026-08-24, sesión conjunta autora/Claude) — surgió al intentar cerrar el
rebalanceo de coste de Campamento/Ayuntamiento: la usuaria señaló que pedir recursos base
fungibles ("cualquier piedra vale") está mal — un edificio debería depender de qué oficio
REGIONAL tienes aprendido, y de materiales PROCESADOS (bloques, lingotes, columnas...), no de
recursos crudos directos, cada vez más según sube el tier del edificio. **Documentación de
diseño — parte ya existía sin conectar, el resto está sin implementar todavía.***

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

| Recurso crudo (categoría) | Material procesado (propuesto) | Categoría procesada | Oficio que lo produce |
|---|---|---|---|
| Piedra (`piedra`) | Bloque de piedra tallada | `bloque` | `constructor-orcos-llanuras` **(ya existe)** |
| Leña (`madera`) | Viga de madera tallada *(nueva)* | `viga` | `carpintero-orcos-llanuras` |
| Hueso (`hueso`) | Columna de hueso *(nueva)* | `columna` | `constructor-orcos-llanuras` |
| Mena (`mena`) | Lingote de hierro (`lingote-de-hierro`, **ya existe**) | `metal` *(inconsistente, ver arriba — no tocado a propósito, es un item ya en uso)* | `herrero-orco-llanuras` |
| Resina (`resina`) | Sin material procesado — se queda cruda incluso en tiers altos (una resina no se "tal la", se usa tal cual como sellante/adhesivo) | — | — |
| Fibra (`fibras`) | Cordaje trenzado *(nueva)* | `cordaje` | `curtidor-orcos-llanuras` |

*(Resina sin procesado es una decisión de esta pasada, no una limitación técnica — si más
adelante se le encuentra un uso procesado real, se añade igual que el resto.)*

---

## Ayuntamiento — números de partida (2026-08-24)

**Pequeño** — cifras dadas por la usuaria, mayormente crudo, sin oficio de construcción exigido
todavía (nivel de entrada, cualquiera con la Carisma que ya pide puede intentarlo):

| Recurso | Cantidad |
|---|---|
| Madera (leña) | 6 |
| Hueso | 6 |
| Resina | 8 |
| Metal (mena) | 2 |
| Fibra | 8 |
| Piedra | 14 |

**Mediano y grande — sin cifras cerradas todavía.** Necesitan, además de la cantidad, decidir la
MEZCLA cruda/procesada real (ej. "mediano: mitad de la piedra en Bloques ya tallados, mitad
cruda; grande: toda la piedra en Bloques, nada crudo") — **a afinar en la siguiente pasada**,
cifra de partida como el resto de números pendientes del proyecto. `oficio:
'constructor-orcos-llanuras'` sí debería exigirse ya desde el mediano en adelante (el pequeño se
queda accesible sin oficio, coherente con ser "nada imponente todavía").

---

## Infraestructura nueva necesaria (resumen)

- 3 items nuevos en `ItemCatalog`: Viga de madera tallada (`viga`), Columna de hueso (`columna`),
  Cordaje trenzado (`cordaje`).
- 3 `CraftingRecipe` nuevas (crudo → procesado), cada una gateada por su oficio regional real.
- Conectar `bloque-piedra-tallada` (ya existe) y `lingote-de-hierro` (ya existe) a las recetas de
  construcción reales por primera vez — hoy ninguna construcción los pide.
- `ConstructionRecipe.oficio` necesita pasar de "solo alivio" a bloqueo real para las recetas que
  lo declaren — lista explícita nueva, mismo patrón que `OFICIOS_CON_HERRAMIENTA_REQUERIDA`.
- Cifras exactas de mediano/grande (cantidad + mezcla crudo/procesado) sin cerrar.
- Cuando se diseñen construcciones de otras razas/regiones (Goirntes/Meseta, Nabieus/Margen,
  Faerus/Bosque...), cada una necesitará sus propios oficios regionales y quizá sus propios
  materiales procesados — este documento solo cierra el caso orco/Llanuras, el patrón general
  queda documentado para repetirlo.
