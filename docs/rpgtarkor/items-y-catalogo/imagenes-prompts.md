# Helek Sirik — Imágenes y prompts de la Enciclopedia — APLICADO al motor

[← Volver al índice del mundo](../lore-mundo/07-mundo-helek-sirik.md)

*Auditoría + mejora del sistema de generación de prompts de imagen (2026-08-27, petición explícita:
"ajustar las descripciones de todo... para que los resultados de los prompts sean mejores y mas
precisos" + "añadir el concepto de las imagenes de dia, de noche y en las diferentes estaciones del
año"). Dos piezas cerradas y **APLICADAS**: (1) un bug real que dejaba todo el motor de
estilo/tono/encuadre desconectado del LLM que de verdad escribe el prompt final, y (2) variantes de
día/noche/estación para Location/Zona, reutilizando el mismo mecanismo de sufijo de slug que ya
usaban las variantes por sexo.*

---

## Cómo funciona el sistema (grounding)

La generación de imágenes de este proyecto es **manual, no automática**: el backend solo genera el
TEXTO del prompt (en inglés) bajo demanda (`POST /world/:slug/image-prompt`,
`imagePromptGenerator.ts` + `imagePromptContext.ts`), cacheado por siempre en `ImagePrompt`
(`@@unique([worldId, entityType, entitySlug, sizeProfile])`). La usuaria copia ese prompt a un
generador de imágenes externo y sube el resultado a mano a
`uploads/images/<entityType>/<entitySlug>-<sizeProfile>.<ext>` (`imageAssets.ts`), servido por
`@fastify/static`. Ningún proveedor de imágenes real está integrado — solo el texto.

`loreContextFor` (`imagePromptContext.ts`) construye nombre + contexto de lore por tipo de entidad
leyendo el catálogo real (Prisma o contenido estático en código); `generateImagePrompt`
(`imagePromptGenerator.ts`) lo traduce a un prompt en inglés vía LLM, con una capa de sanitización
de contenido explícito (`sanitizePrompt`) que se aplica siempre, tanto al borrador propio como a lo
que devuelva el modelo.

## 1. Bug real: el estilo/tono/encuadre nunca llegaba al LLM

`generateImagePrompt` calculaba un `structuredPrompt` completo (`buildPrompt`: hint por tipo de
entidad, `ENTITY_TYPE_STYLE` — estilo de arte real por tipo, `inferToneFromLore` — tono narrativo
inferido de palabras clave del lore, instrucción de encuadre/headroom por perfil de tamaño,
dimensiones exactas en píxeles) — pero el `userContent` que de verdad viajaba al LLM solo mandaba
`Type`/`Name`/`Lore (Spanish)`/`Profile` en bruto. El propio comentario del código decía "usar el
LLM para refinar... con la estructura como base", pero `structuredPrompt` nunca se usaba: quedaba
calculado y descartado. El `systemPrompt` le pedía al modelo "usa el tono inferido del lore" y
"copia el estilo apropiado para el tipo de entidad" **sin decirle en ningún sitio cuáles eran** —
el modelo tenía que adivinarlos de cero a partir del hint de una frase corta (`ENTITY_TYPE_HINT`),
perdiendo toda la especificidad de estilo/tono/encuadre que el resto del archivo sí calculaba bien.

**Fix**: el `structuredPrompt` completo viaja ahora dentro de `userContent`, como "Structured
draft" explícito a pulir — el `systemPrompt` se reescribió para decir "usa el tono YA DADO en el
borrador" / "copia el estilo YA DADO en el borrador, palabra por palabra" en vez de "infiere"/
"apropiado". 3 tests nuevos en `imagePromptGenerator.test.ts` comprueban que el estilo real de un
tipo de entidad, el tono inferido y las dimensiones exactas llegan de verdad dentro de
`userContent`, no solo en las 4 líneas sueltas de siempre.

**De paso**, `inferToneFromLore` ganó 4 buckets de tono nuevos (ceniza/volcánico, desierto/árido,
helado/nieve, sagrado/prohibido) — vocabulario grepeado contra `worldCatalog.ts` real (ceniza
aparece 12 veces, volcánico 5, helada 4, desierto 2, sagrado 2) y verificado antes de añadirlo, no
inventado; antes caía siempre al tono neutro sin ninguna razón real.

## 2. Día/noche/estación (Location y Zona)

**Alcance decidido con la usuaria** (cruce completo, hasta 8 imágenes por sitio; solo Location y
Zona — el resto de tipos de entidad son retratos/objetos aislados donde la hora del día no tiene
sentido visual propio):

- **Sin contenido curado por entidad** (a diferencia de las variantes por sexo, que sí necesitan
  rasgo físico/medidas escritos a mano por especie): la luz y la estación son genéricas, así que
  `MOMENTO_TEXT`/`ESTACION_TEXT` (`imagePromptContext.ts`) son bloques de texto reutilizables,
  válidos para cualquier Location sin escribir nada nuevo por sitio.
- **Mismo mecanismo de sufijo de slug** que ya usaban las variantes por sexo
  (`stripSexoSuffix`/`-macho`/`-hembra`): `stripLocationTimeVariant` despoja
  `-<momento>-<estacion>` del `entitySlug` (p.ej. `hondonada-del-eco-noche-invierno`) ANTES de
  consultar Prisma — la fila real sigue viviendo bajo el slug base, cada combinación es solo un
  `ImagePrompt`/archivo de imagen propio con esa clave. Cada eje es independiente y opcional
  (`-noche` sola, o `-invierno` sola, también son válidas) — no hace falta generar las 8
  combinaciones para que algo se vea.
- **`momentoDelDiaFor`** (`worldClock.ts`, nuevo) — eje binario día/noche (corte 6:00/20:00),
  deliberadamente MÁS simple que las 6 franjas horarias de `entorno.ts` (pensadas para prosa
  ambiental, no para elegir entre 2 imágenes). `estacionFor` ya existía (sistema de estaciones,
  2026-08-24).

### Enciclopedia (navegación fuera de partida)

`buildLocationsSection` (`world.ts`) expone `variantesTiempo: VarianteTiempoOut[]` — las 8
combinaciones siempre listadas igual para cualquier Location, cada una con sus propios
`imagePrompts`/`imageUrls` (thumbnail/banner, entityType `location`) y `mapaImagePrompt`/
`mapaImageUrl` (el mapa de Zona de esa misma combinación, entityType `zona`, sizeProfile `mapa`,
expuesto junto porque comparte selector en el modal).

**UI** (`DetailModal.tsx`, petición explícita: "añade un header a modo de tab para poder elegir
estacion y luego un togle para dia y noche... que eso muestre la opcion que marques en vez de
todos de golpe"): header de 4 pestañas de estación (🌸☀️🍂❄️) + un toggle de día/noche (☀️/🌙) DEBAJO,
mismo patrón visual que ya usaban las pestañas de variante regional/sexo — siempre una combinación
seleccionada (Primavera+Día por defecto, se resetea al abrir otra entrada), nunca los 8 prompts
listados a la vez. Los 3 botones de generar (Miniatura/Banner/Mapa) reflejan la combinación activa,
incluido el checkmark "ya cargada ✓" cuando esa combinación concreta ya tiene imagen real subida.

### Vista Zona en vivo (durante una partida)

`GET /saves/:id/zona` (`zona.ts`) **elige sola** qué variante mostrar, a partir del reloj real de
la partida (`WorldState.fictionalMinutes` → `momentoDelDiaFor`/`estacionFor`) — nunca un selector
manual, que solo tiene sentido navegando la Enciclopedia fuera de una partida concreta.
`zoneMapImageUrl` (`imageAssets.ts`) degrada en cascada de lo más específico a lo más genérico:
cruce completo → solo estación → solo momento → imagen base sin sufijo — así que subir solo
`-invierno` (sin las 8 combinaciones) ya cubre día y noche de esa estación, nunca hace falta
rellenar el cruce entero para que la vista en vivo muestre algo.

## Verificación

12 tests nuevos en `imagePromptContext.test.ts` (`stripLocationTimeVariant` + variantes en
location/zona), 6 en `worldClock.test.ts` (`momentoDelDiaFor`), 9 en `imageAssets.test.ts` (nuevo —
cascada de fallback de `zoneMapImageUrl`, sin fallback en `imageUrlsFor`), 3 en
`imagePromptGenerator.test.ts` (fix del bug de arriba). `tsc -b` limpio backend y frontend, suite
completa backend 1515/1515, frontend 92/92.

## 3. Location ya no tiene imagen genérica sin estación (2026-08-30)

**Decisión explícita de la usuaria** ("ya no existen imágenes generales que no sean de estaciones en
locations"): las 12 imágenes de `location/*-banner.png` que existían SIN sufijo de tiempo (todas de
primavera, subidas antes de que existiera el sistema de día/noche/estación) se renombraron todas a
`<slug>-dia-primavera-banner.png` — mismo convenio de sufijo que ya usaban las 8 variantes
(`variantesTiempoFor`, § 2 de arriba). Confirmado con la usuaria que esto deja verano/otoño/invierno
SIN imagen en la Enciclopedia hasta que se generen esas variantes nuevas (36 = 12 locations × 3
estaciones restantes) — asumido a propósito, no es un hueco accidental.

`imageUrlsFor('location', slug)` SIN sufijo ahora devuelve siempre `null` para las 12 locations
existentes (era el comportamiento correcto de `imageAssets.ts` ya de antes — nunca tuvo cascada de
fallback, a diferencia de `zoneMapImageUrl`, que sí la tiene; el "fallback" real hasta ahora vivía
solo en que el archivo sin sufijo coincidía con el nombre buscado). No hace falta ningún cambio de
código: `DetailModal.tsx` ya arranca con `selectedEstacion: 'primavera'`/`selectedMomento: 'dia'` por
defecto, así que la ficha sigue mostrando la imagen correcta de entrada sin tocar nada en frontend.
El único campo que queda "muerto" es `EnciclopediaLocationInfo.imageUrls` (el genérico de nivel
superior, usado también por el grafo del mapa de mundo en `WorldLocationInfo`) — confirmado que el
frontend no lo consume en ningún sitio hoy (`MapaPanel.tsx` no pinta imagen de nodo), así que
queda `null` sin ningún efecto visible; no se ha retirado el campo en sí, decisión de no tocar más
superficie de la necesaria en esta pasada.

## Pendiente / fuera de alcance de esta pasada

- **Revisar prompts de `entityType: 'faction'` (2026-08-30)**: la usuaria generó
  `clan-serhu-banner.png` y, comparándolo contra su propio prompt guardado ("bold flat icon
  illustration, simple clean shapes, minimal flat color palette" — pensado como emblema
  heráldico/icono plano), el resultado real es una escena narrativa completa (orcos, volcán,
  sombras, profundidad) — visualmente buena pero no lo que el prompt pedía. Candidato: el
  `ENTITY_TYPE_STYLE`/hint de `imagePromptGenerator.ts` para `faction` puede no estar transmitiendo
  bien "icono plano" al LLM que redacta el prompt final (mismo tipo de bug ya cerrado en la § 1 de
  arriba, donde el estilo se calculaba pero no llegaba al `userContent`) — sin investigar todavía,
  la usuaria pidió aparcarlo ("olvidalo por ahora") y solo dejarlo anotado.
- Generar/subir las imágenes reales día/noche/estación de cada Location — trabajo manual de la
  usuaria, sin plazo.
- Construcción (`entityType: 'construccion'`, Campamento/Ayuntamiento) no lleva día/noche/estación
  — decisión explícita de alcance ("Location y Zona"), candidato si se quiere ampliar más adelante,
  mismo mecanismo reutilizable sin cambios de diseño.
- El resto de mejoras de calidad de prompt más allá del bug de arriba (p.ej. seguir ampliando
  `inferToneFromLore`, revisar el `systemPrompt` con generaciones reales una vez la usuaria las
  pruebe) queda abierto — esta pasada corrigió el hallazgo concreto más importante, no fue una
  reescritura completa del prompt engineering.
