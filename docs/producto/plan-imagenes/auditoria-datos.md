# Auditoría de datos de Tarkor para generar imágenes sin referencia

Repo auditado (solo lectura): `/home/deck/Desktop/Desarrollos/World-Maker-Fantasy` (abreviado `WMF/`).
Los recuentos de BD salen de contar objetos en el código sembrado (`worldCatalog.ts`), porque no se arrancó la BD ni ningún servidor. Son aproximados (regex sobre el TypeScript): ±2 por tipo. No sé cuántas filas hay hoy en `ImagePrompt`.

## 1. Dónde vive cada dato y cuál es la fuente de verdad

**Cadena real:** Markdown (humanos) -> `backend/src/scripts/worldCatalog.ts` (12.520 líneas, datos curados a mano) -> `seed-catalog.ts` (upsert idempotente a Postgres) -> endpoint `/world/:slug/enciclopedia` (`backend/src/routes/world.ts:541`) -> generador de prompts -> tabla `ImagePrompt`.

| Capa | Ruta | Papel |
|---|---|---|
| Lore en Markdown | `WMF/docs/rpgtarkor/lore-mundo/` (incl. `regiones/*.md`, `flora-fauna.md`, `genesis.md`, `razas.md`, `areas.md`), `docs/rpgtarkor/personajes/npcs.md` | Prosa larga para humanos. Las fichas de fauna/flora viven dentro del fichero de su región (`regiones/llanuras-del-viento-rojo.md`: 94 fichas «Catálogo:» de las ~116 totales). |
| Canon resumido | `WMF/docs/canon-opencode/` (`00-nucleo.md`, `regiones/*.md`, `catalogo/fauna.md`...) | Reglas duras y tabla breve (p. ej. `catalogo/fauna.md:8`: «Aullador Rojo / GUELISES / 1-4 / CAUTELOSO»). Sin descripción visual. |
| Catálogo en código | `WMF/backend/src/scripts/worldCatalog.ts` | **Fuente de verdad operativa** (lo que siembra la BD): `locations` (l.41), `fauna` (1463), `npcs` (3015), `items` (5362), `factions` (9027), `historiaEntries` (9186), `harvestYields` (9286), `harvestSourceDescriptions` (11469), `faunaTerrainTag` (11700), `faunaMomentoDelDia` (11763), `zonePoints` (11814). |
| Contenido estático en código (sin BD) | `backend/src/services/berigLore.ts` (`BERIG_RAZAS`, `BERIG_PERSONAJES`), `construction.ts` (`CONSTRUCTION_RECIPES`), `crafting.ts` (`CRAFTING_RECIPES`), `classAbilities.ts`, `startingAbilities.ts`, `sexDimorphism.ts` | Razas, personajes, construcciones, crafteo, habilidades y variantes de sexo. |
| BD (Prisma) | `backend/prisma/schema.prisma`: `Location` (l.502), `Npc` (2542, también para fauna: `kind` PLANTILLA), `Faction` (2775), `HistoriaEntry` (2896), `ItemCatalog` (3107), `HarvestYield` (3257), `ImagePrompt` (3449), `LoreChunk` (1493) | `Npc.bio` es la descripción física de la fauna. `HarvestYield` no tiene columna de descripción (flora/mineral) -> se saca de `harvestSourceDescriptions`. |
| `LoreChunk` | `backend/src/scripts/loreChunks.ts` -> `reindex-lore.ts` (embeddings) | Es RAG para el Narrador, **no** alimenta los prompts de imagen. El propio fichero dice que son resúmenes «condensados» curados a mano. |
| Frontend | `frontend/src/data/map.ts` (posiciones del mapa), `mock.ts`, `professions.ts`, `reinoRecipes.ts` | Nada de apariencia de elementos. |
| Imágenes existentes | `WMF/backend/uploads/images/<tipo>/` (copiadas a `image-generator/referencias/images/`) | Sirven hoy de referencia (`-r`). |

Cómo llega el lore a la BD: **no se lee el Markdown**; se copia a mano al `.ts` y `npm run seed-catalog` lo siembra. `loreChunks.ts` lleva el aviso «cada vez que el lore cambie en los .md, actualizar aquí». Hay riesgo de deriva .md <-> .ts (la nota `docs/rpgtarkor/lore-mundo/actualizaciones-pendientes-lore.md` y `docs/borradores-opencode/` lo reflejan).

## 2. Cobertura por tipo (campos visuales)

Entradas = filas sembradas en `worldCatalog.ts`. «Descripción usable» = texto con al menos rasgos de aspecto (revisado por regex de color/superficie + lectura de muestras).

| Tipo (`entityType`) | Origen | Nº | Campo visual | Con descripción visual usable | Zona/bioma nativo enlazado | Imágenes en `uploads/images/` |
|---|---|---|---|---|---|---|
| fauna | `fauna[]` (53) + 3 animales sin ficha (`harvestSourcesThatAreFaunaWithoutNpc`) | 53-56 | `Npc.bio` (mediana 421 car., 49/53 >=250) | **45/53** nombran color/pelaje/piel; 44/53 dan alguna pista de tamaño. Variantes de sexo con `medidaCm` solo para unas pocas (`sexDimorphism.ts`). | región: 30/53 (`harvestSourceRegion`); hogar (`homeLocationSlug`): 30/53; tag de terreno (`faunaTerrainTag`): 23/53; hora del día (`faunaMomentoDelDia`): 6/53; punto en una zona (`zonePoints` tipo FAUNA): 24/53 | 60 |
| flora (planta) | `harvestYields` sourceCategory planta | 42 | `harvestSourceDescriptions` | **31/42** con descripción propia (los 11 restantes solo heredan el `description` del ítem que dan) | región 31/42; hogar 23/42; tag de terreno 27/42 (+`harvestSourceFloraCategoria`); `zonePoints` de flora: **0** (la flora no se coloca en mapas de zona; solo `RECURSO`) | 8 (flora = planta + mineral) |
| flora (mineral) | idem categoría mineral | 9 | idem | 9/9 | región 9/9; hogar 6/9; terreno 8/9 | (en las 8 de arriba) |
| location | `locations[]` | 72 (5 regiones núcleo: Llanuras 30, Ciénaga 14, Cristal Helado 13, Margen 8, Meseta 7) | `Location.description` + `kind` (20 valores libres) + `locationTerrainTags` (solo Llanuras) | mediana 287 car.; 46/72 >=250; solo 3 <150. ~35/55 muestreadas con vocabulario visual (el resto es social/mecánico) | `region` siempre (campo obligatorio); `terrainTags` solo Llanuras; 5 `REGION_ESCENA` (paisaje+luz) en `imagePromptGenerator.ts` | 61 (+35 mapas `zona`) |
| zona (mapa) | `Location` + `ZonePoint` | 72 | `zonePoints` (146 en total: RECURSO 65, NPC 28, FAUNA 25, EDIFICIO 23) con etiqueta y x/y | depende de la location | idem | 35 |
| npc | `npcs[]` | 75 (PRINCIPAL 58, PLANTILLA 17) | `bio` (mediana 243; 35/75 >=250; 5 <150) mezcla aspecto + historia + comportamiento | **~50/75** estimados con aspecto físico (sin verificar uno a uno); `genero` solo donde hubo bug | `homeLocationSlug`: 56/75; `faction` no nula: 63/75 | 2 |
| item | `items[]` | 230 | `description` (mediana 110; **47 <80**; solo 13 >=250) + `dimensiones` (228/230) + `lugarOrigen` (132/230) | ~60 % útiles (descripciones cortas, muchas son de uso/mecánica) | `lugarOrigen` 132/230 | 23 |
| faction | `factions[]` | 9 | `description` (mediana 513; 9/9 >=250) | 9/9, con arquitectura y símbolos (p. ej. «empalizada de estacas... tótem Gargantúa de Ceniza») | `raza` dominante; sede por texto | 2 |
| raza / personaje | `BERIG_RAZAS` / `BERIG_PERSONAJES` (`berigLore.ts`) | 4 razas + variantes regionales + personajes | `rasgoFisico` + `rasgoCaracter` + `description` por raza y por variante | **Sí, bien diseñado** (campo `rasgoFisico` explícito) | variantes regionales | 18 |
| construccion | `CONSTRUCTION_RECIPES` | ~75 | `description` «física real de la construcción terminada» (comentario de `construction.ts:33`) | alta (campo creado para imágenes) | `raza` opcional | 2 |
| crafteo | `CRAFTING_RECIPES` | ~60 | `resultDescription` | media | no | 0 |
| ability / clase / especializacion | `classAbilities.ts`, `startingAbilities.ts` | ~233 menciones de `name:` | `description` + `promptText` (texto mecánico/narrativo) | baja (son acciones, no objetos con forma) | no | 0 |
| historia | `historiaEntries` | 7 | `text` (mediana 389) | 6/7 largas, narrativas | no | 0 |

Observaciones:
- Los tipos con campo visual explícito de verdad son: **raza** (`rasgoFisico`), **construccion** (descripción física), **item** (`dimensiones`, `lugarOrigen`) y **sexDimorphism** (`rasgoFisico`, `medidaCm`).
- Fauna, flora y NPC tienen **un único texto libre** (`bio`/descripción) que mezcla aspecto, comportamiento y lore; no hay campos separados de silueta, paleta, tamaño, textura o hábitat.
- El enlace a zona/bioma está **repartido en 5 diccionarios sueltos** de `worldCatalog.ts` (`harvestSourceRegion`, `harvestSourceHomeLocationSlug`, `faunaTerrainTag`, `harvestSourceTerrainTag`, `faunaMomentoDelDia`), no en la ficha de la entidad. Cubren entre el 40 % y el 60 %.

## 3. Guía visual del mundo: no existe como documento

No hay paleta, dirección de arte ni «qué hace que Tarkor parezca Tarkor». Lo más cercano:

- `WMF/backend/src/services/imagePromptGenerator.ts`: `ENTITY_TYPE_STYLE` (estilo/acabado/luz **por tipo**, p. ej. fauna = «Cinematic wildlife photograph... low sun just above the horizon, dramatic sunset clouds»), y `REGION_ESCENA` (paisaje + luz **por región**, 5 regiones, en inglés, `l.~110-135`). Es la única guía visual de región y vive en código, no en doc.
- `WMF/backend/src/services/imagePromptContext.ts`: `MOMENTO_TEXT` / `ESTACION_TEXT` (día/noche/estaciones) y la corrección «sin luna: cinturón de micro-cristales» (de `docs/rpgtarkor/lore-mundo/genesis.md`, «El cielo sin luna»).
- `WMF/docs/arquitectura/reutilizables/01-generacion-imagenes-local.md` l.217-219: «**El estilo lo decide el prompt, no el modelo.** Los prompts guardados no fijan un estilo común... hace falta un prefijo de estilo único para todo el juego (punto 3 de “Consistencia”)». l.344-345 y 380-401 proponen un `estilo.json` (preámbulo + LoRA + peso) que **no existe aún**.
- `WMF/docs/canon-opencode/00-nucleo.md`, «Tono prohibido»: sin luna, sin pólvora, sin humanos, Faerus sin túnica ni sandalias. Es lista de vetos, no estilo.
- `genesis.md` l.174 y 181 aportan ideas visuales muy útiles (fauna de Sezix «fea, colores apagados»; piel Nabieus que «atrapa la luz», sin tonalidad) pero dispersas.
- `WMF/docs/rpgtarkor/items-y-catalogo/imagenes-prompts.md`: documenta el motor (tono inferido, día/noche), no el estilo.
- Las imágenes reales subidas (fauna 60, location 61...) fueron «hechas fuera» (banner múrgol 1983x793), y son hoy la única definición real de estilo.

Conclusión: el «sabor» de Tarkor hoy viene de (a) las imágenes de referencia y (b) 5 párrafos de escena por región; **no de datos**.

## 4. Caso «Aullador Rojo» (fauna)

Todo lo que dice el repo:

| Dato | Valor | Ruta |
|---|---|---|
| Familia / nivel / temperamento | Guelises, 1-4, CAUTELOSO | `worldCatalog.ts:1463-1500`, `canon-opencode/catalogo/fauna.md:8` |
| Apariencia (bio) | «flaca, cuatro patas, pelaje rojizo rasposo, mechones negros en tobillos, patas desproporcionadamente largas, pelaje enredado con parches de arena fosilizada que brillan como vetas minerales rojas, hilera de púas oscuras erizadas en el lomo, colmillos curvos amarillentos exagerados, costillas marcadas, cola negra tupida que borra sus huellas» | `worldCatalog.ts:1479` y `docs/rpgtarkor/lore-mundo/regiones/llanuras-del-viento-rojo.md:84-93` (versión algo más corta) |
| Comportamiento | jaurías de 4-6, cobarde solo / osado en grupo, sigue a los Corredores de Cauce en migración, caza rezagados, rodea antes de atacar | misma bio + `personality` |
| Zona | Región Llanuras del Viento Rojo (`harvestSourceRegion`, l.11269); hogar `pastos-de-la-deriva` (l.11238); terreno `vegetacion` (l.11707); `zonePoint` en Pastos de la Deriva x660,y420 «acechando entre el pasto alto» (l.12158) | `worldCatalog.ts` |
| Variantes de sexo | macho 90 cm, gola de pelo erizada, cicatrices; hembra 80 cm, sin gola, patas más largas | `sexDimorphism.ts:99` |
| Población / hábitat | 1.400-3.200 en las Llanuras | `worldPopulation.ts:148` |
| Hora del día | **no definida** (no está en `faunaMomentoDelDia`) | l.11763 |
| Materiales | carne, hueso ligero, colmillo | `worldCatalog.ts:9318-9340` |
| Alias | aullador, perro salvaje, jauría | `worldCatalog.ts:10929` |

Lo que **falta** para un buen prompt sin referencia:
1. **Altura/longitud estructurada.** Solo hay 90/80 cm en las variantes de sexo (¿a la cruz? ¿largo?). El modelo no sabe que es del tamaño de un lobo o de un perro grande.
2. **Colores precisos.** «rojizo rasposo» no dice si es herrumbre, teja o sangre seca; las «vetas de arena fosilizada» no tienen color ni dónde se ponen. Sin paleta de cuerpo/ojos/hocico/almohadillas.
3. **Especie análoga permitida.** El canon prohíbe nombres reales («araña, corzo»), pero el generador necesita una silueta: «canido flaco tipo galgo/hiena, pero con...» no está.
4. **Pose/acción típica** (acechando entre pasto alto, en jauría) y **entorno**: hay `REGION_ESCENA` genérico de Llanuras, pero no el hábitat concreto del Pastos de la Deriva (pasto alto seco naranja, polvo rojo, cielo).
5. **Ojos, iris, expresión**, sin dato.
6. **Escala narrativa:** cuántos en cuadro (jauría vs individuo).
7. **Hora/luz propia**: el estilo de fauna fuerza «atardecer dramático» para TODA la fauna (`ENTITY_TYPE_STYLE.fauna.luz`), por una prueba con el múrgol.

Otros ejemplos:
- **Flora, Cardo Brújula** (`worldCatalog.ts:11483`): «Cardo espinoso de tallo rígido y flor cerrada de un gris metálico apagado, con una única fibra central imantada...». El ítem (`l.6925`) dice flor «morado apagado», **contradice** al texto de la fuente (gris metálico). Tallo 25 cm. Región Llanuras, hogar Agujas Imán, terreno `arido`. Faltan altura de la planta completa, hojas, densidad/agrupación y suelo.
- **Location, Los Pastos de la Deriva** (`l.180`): «Praderas abiertas al este de Los Manaderos, donde la hierba dura más tiempo... Sin asentamiento fijo». **Casi todo es social/migratorio**: no dice color de hierba, altura, relieve, cielo ni paleta. El visual lo ponen `REGION_ESCENA` y el `zonePoint`. Terreno `vegetacion`.
- **NPC, Hulki** (`l.4984`): faerus vieja, «pelaje encanecido en el hocico, delgada, hombros de quien ha cargado presas, piel de hojas finas que susurra, pelaje denso en tonos de corteza y musgo». Buena base; faltan altura/edad numérica, ropa (los Faerus no llevan túnica), adornos y, sobre todo, **una imagen mental de la raza Faerus** (la tiene `BERIG_RAZAS.rasgoFisico`, pero `loreContextFor('npc')` no la mezcla: usa solo `role + faction + bio + personality`, `imagePromptContext.ts` rama `npc`).

## 5. Cómo se producen los prompts hoy

1. **Entrada de datos:** `loreContextFor(worldId, entityType, slug)` (`imagePromptContext.ts`) lee BD/código y construye `{name, loreContext, region, conMomento}` por tipo. Para fauna/flora: `Npc.bio` o `harvestSourceDescriptions` + región + alias; para location/zona: región + `kind` + descripción (+ puntos de zona).
2. **Borrador estructurado:** `buildPrompt` (`imagePromptGenerator.ts`): estilo del tipo -> sujeto+lore -> encuadre (`FRAMING` por perfil thumbnail/banner/mapa/icono) -> escenario (`REGION_ESCENA`) -> luz + tono inferido por palabras clave (`inferToneFromLore`) -> acabado -> «No text, no signature, no watermark.».
3. **LLM:** `generateImagePrompt` reescribe el borrador en inglés (90-160 palabras) vía `completeWithFallback` (Cerebras, luego Ollama). La regla del sistema le dice que **«invente símiles concretos de la naturaleza»** (ver cuernahoja: «cuello como un trozo de piedra»): es decir, **la forma del animal la inventa el LLM**, no sale de datos.
4. **Caché:** tabla `ImagePrompt` (`@@unique[worldId, entityType, entitySlug, sizeProfile]`): `prompt` (base), `promptUsado` (CFG-38, editado a mano y nunca pisado), `provider`. CFG-40 pasa hasta 2 `promptUsado` de otras entidades del mismo tipo como ejemplos (`ejemplosDePromptsUsados`).
5. **Endpoints:** `POST /world/:slug/image-prompt` (generar), `.../image-prompt/usado` (guardar), `routes/world.ts:817-913`. Hay scripts por lotes `seedImagePrompts.ts` y `exportImagePrompts.ts` (-> `backend/output/image-prompts.md`).
6. **Prompts afinados a mano:** `WMF/image-generator/prompts/murgol/v1..v8-cfg39.txt` y `prompts/cuernahoja/v0-bd.txt, v0-bd-ref.txt, v1-cfg40.txt`. Solo 2 especies; el resto está solo en BD.
7. **Interfaz del generador** (`image-generator/interfaz/servidor.py`, puerto 7861):
   - Lista de elementos: `GET http://127.0.0.1:3001/world/helek-sirik/enciclopedia` (`servidor.py:223`, mapa `SECCIONES` l.195: npcs, items, faunaFlora, locations, razas, personajes, constructionRecipes, craftingRecipes, factions, historia; variantes de sexo, regionales y de tiempo; mapas de zona; habilidades; clases y especializaciones desde `schema.prisma`).
   - Prompt: **directo de Postgres** vía `podman exec -i tarkor-postgres psql ... from "ImagePrompt"` (`servidor.py:35, 96-102`), no del backend. Ofrece `promptUsado` y si no `prompt`.
   - Referencia de imagen: `image-generator/referencias/images/<tipo>/` (copia de `backend/uploads/images/`).
   - El motor de generación es FLUX.2 klein 4B local (`sd-cli`, `scripts/probar.sh`, `generar.sh`).

Diagnóstico del banco de pruebas: el propio doc (`01-generacion-imagenes-local.md` ~l.238) concluye que *«La referencia de estilo sirve si el prompt describe una escena y una luz parecidas»* y que con otro animal solo trae «suelo y bruma; no la paleta». O sea: **sin referencia el resultado depende de lo que el LLM invente**, y el estilo/paleta no está en ningún dato.

## 6. Lagunas (priorizadas)

1. **No hay guía visual del mundo** (paleta por región, materiales, arquitectura por raza, lenguaje de formas, luz, qué NO se ve). Solo 5 párrafos en código y la prohibición de luna.
2. **Un solo texto libre por entidad**, sin campos de silueta, paleta, tamaño, textura, rasgo distintivo, ojos, postura. El LLM rellena los huecos con símiles inventados.
3. **Sin especie análoga/ancla de silueta** para fauna (no se pueden nombrar animales reales en canon, pero el generador sí los necesita internamente).
4. **Hábitat disperso en 5 diccionarios**, cobertura 40-60 %; flora sin posición en zonas; `faunaMomentoDelDia` 6/53.
5. **Contradicciones**: Cardo Brújula gris metálico vs morado apagado (ítem). Hay que reconciliar y declarar una fuente.
6. **Tamaño**: ítems tienen `dimensiones` (228/230) pero fauna/flora/NPC no (solo 5-10 especies con `medidaCm`).
7. **NPC no hereda `rasgoFisico` de su raza** al construir el contexto.
8. **Items cortos**: 47/230 con descripción <80 caracteres; 170/230 <150.
9. **Sin versión para facciones** de emblema concreto (solo texto), ni de ability (acciones sin objeto visual); estos tipos no tienen imagen y su base de datos visual es débil.
10. **Deriva** entre `docs/rpgtarkor/*.md` y `worldCatalog.ts` (copiado a mano) y las dos versiones del Aullador (bio más rica en `.ts` que en `.md`).
11. **Estilo fotográfico fijo por tipo** (fauna siempre al atardecer) en lugar de salir de la región/especie.

## 7. Propuesta: «ficha visual» por tipo (campos)

Convención: todos los campos en **español**, enumerados o frases cortas; el generador los compone y el LLM solo redacta, no inventa.
Campos comunes a todos: `id/slug`, `nombre`, `descripcionCanonica` (la actual), `analogoDeSiluetaInterno` (solo para el generador, no se publica), `prohibido` (vetos canon: sin luna, sin túnica Faerus...), `estiloRef` (ancla de estilo/perfil), `fuenteDeVerdad` (ruta).

| Tipo | Campos visuales propuestos |
|---|---|
| Fauna | `tamano` (alzada cm + longitud cm + peso), `clasificacionSilueta` (cuadrúpedo ágil, ave planeadora...), `anclaSiluetaInterna`, `cuerpo` (complexión, proporciones), `cabeza` (hocico, orejas, cuernos), `extremidades`, `cola`, `coberturaTipo` (pelo/pluma/escama/piel), `coberturaTextura`, `paleta` (cuerpo, vientre, extremidades, marcas, ojos, hocico, boca) en nombres de color + tono, `rasgoDistintivo` (1-3), `dimorfismo` (macho/hembra: solo diferencias), `edades` (cría/adulto/viejo), `postura/pose típica`, `comportamientoVisible` (jauría, vuela en círculos...), `unidadesEnEscena`, `habitat` (zona slug + bioma + terreno), `horaActiva`, `entornoTipico` (suelo, vegetación, cielo), `estacionalidad`, `luzCaracteristica`, `escalaDeReferencia` (junto a un orco adulto), `rastros` (huellas, nidos) |
| Flora / mineral | `forma`, `altura`/`anchura` cm, `habito` (hierba, arbusto, árbol, liquen, cristal), `partes` (tallo, hoja, flor, fruto, raíz con color y forma), `paleta` por parte, `textura`, `densidadYAgrupacion`, `rasgoDistintivo` (p. ej. fibra imantada), `ciclo estacional` (aspecto en cada estación), `sustrato`/`suelo`, `bioma/zona`, `iluminacionTipica`, `fenomeno asociado` (magnetismo, ceniza), `escalaReferencia` |
| Location / zona | `kind`, `bioma`, `relieve` (llano, cañon, ladera), `vegetacionDominante`, `paletaDominante` (3-5 colores), `materialesTipicos` (arcilla roja, basalto negro), `cielo/clima` (polvo rojo, humedad), `agua`, `escalaYPunto de vista` (panorámica, dron), `estructurasCaracteristicas` (hitos con forma), `huellaHumana`, `fauna/floraVisible` (slugs), `luzPorMomento` (día/noche/estación), `atmosfera` (3 palabras), `hitosNavegables` (para mapa de zona), `viñetas` (cosas que NO deben aparecer) |
| NPC | `raza` (hereda `rasgoFisico`), `sexo`, `edadAparenteAnios`, `alturaCm/complexion`, `pielOPelaje` (color, textura), `cabello/pelo`, `ojos`, `rasgosFaciales`, `marcasCicatrices`, `ropaYEquipo` (materiales, colores, estado), `ornamentosYSimbolos` (clan), `postura/expresion`, `oficio` visible (herramientas), `entornoHabitual` (location slug), `paleta` de conjunto, `luz` |
| Item | `categoria`, `formaPrincipal`, `dimensiones` (ya existe), `materiales` (con acabado), `colores`, `desgaste`, `marcas/decoracion`, `origenFactura` (qué raza/oficio lo hace), `usoVisible`, `contexto de uso` (sobre mesa, en la mano), `estadoPorCalidad` |
| Facción | `razaDominante`, `emblema` (forma, animal/objeto, colores), `paletaHeraldica`, `materialesDeSede`, `arquitecturaCaracteristica`, `uniformeOVestimenta`, `armas tipicas`, `tono` (belicoso, mercantil), `sede (location slug)` |
| Construcción | `razaOEstilo`, `plantaYVolumen` (dimensiones m), `materiales` y acabado, `techo/estructura`, `elementos distintivos`, `estadoDesgaste`, `entorno`, `actividad visible` (humo, vigías), `escalaHumana` |
| Habilidad / clase / especialización | `efectoVisual` (forma del efecto, color, partículas), `fuenteDeEnergia` (magia, cuerpo, arma), `ejecutor tipo`, `entorno/escena`, `iconografiaBase` (blasón), `paleta`. Para iconos de clase: `símbolo`, `animal/objeto`, `colores` |
| Historia | `escenaVisualizable` (qué se ve), `época`, `personajes presentes`, `lugar (slug)`, `objetos/documentos`, `luz y clima`, `tono`, `qué NO mostrar` |
| Raza | ya existe: `rasgoFisico`, `rasgoCaracter`, `variantes`; añadir `paleta de piel/pelo`, `rangos de altura`, `vestimenta tipica`, `proporciones` |

## 8. Propuesta: «ficha visual del mundo» (Helek Sirik / Tarkor)

Un documento único (`docs/rpgtarkor/lore-mundo/guia-visual.md`) + fichero de datos (`estilo.json` ya propuesto en `01-generacion-imagenes-local.md` l.380) con:

1. **Principios**: «fantasía con base científica» (`00-nucleo.md`), todo fenómeno con causa física visible; lista de lo imposible visualmente (sin luna, sin humanos, sin pólvora, sin inglés en rótulos).
2. **Cielo y luz**: cinturón de micro-cristales (brillo perlado difuso), sin disco lunar; luz por franja y por estación; polvo rojo y bruma magnética.
3. **Paleta por región** (5 + Vaelira prohibida): 4-6 colores nombrados con rol (suelo, vegetación, cielo, roca, acento) para Llanuras, Ciénaga, Cristal Helado, Margen, Meseta; hoy solo hay frases sueltas en `REGION_ESCENA`.
4. **Materiales y minerales emblemáticos** con color y brillo (arcilla roja, arena imán, Roca Luclara, madera de Telda, obsidiana, cristal).
5. **Paleta y lenguaje de formas por raza** (Goirntes: piel casi mineral, líneas ordenadas; Orcos: troncos, pieles, estacas; Nabieus: piel que atrapa la luz; Faerus: pelaje corteza/musgo, sin ropa de tela), ya parcial en `berigLore.ts`.
6. **Arquitectura por cultura** (campamentos circulares con empalizada de Telda, simetría de la Meseta...).
7. **Fauna/flora**: reglas de familia (26 familias de `flora-fauna.md`: cada familia comparte rasgos visuales de su Semilla: fauna de Sezix «fea y mansa», Kroj «brillos dorados nocturnos...»); lista de siluetas permitidas.
8. **Estilo de imagen por tipo**: medio (óleo para paisaje, fotografía cinematográfica para criaturas, plano para emblemas), temperatura de color, grano, composición por perfil. Un único preámbulo de estilo + (si se usa) LoRA y peso.
9. **Vetos y errores conocidos** (texto en imagen, luna, humanos, túnica Faerus; Corredor de Cauce con materiales extra).
10. **Anclas de referencia**: 1 imagen de estilo aprobada por tipo de escena (fauna al atardecer, interior, objeto), con su ruta.
11. **Escala de referencia**: altura de orco adulto, goirnte, faerus, nabieus para dar tamaños en cm consistentes.

Siguiente paso recomendado: (a) crear la guía de mundo con los datos ya existentes en `REGION_ESCENA`, `ENTITY_TYPE_STYLE`, `genesis.md` y `berigLore.ts`; (b) añadir a `NpcInput`/`worldCatalog.ts` un bloque `visual: {...}` para fauna (53) con los campos de arriba, empezando por Aullador Rojo como piloto; (c) unificar los 5 diccionarios de hábitat dentro de la ficha; (d) hacer que `loreContextFor` use la ficha estructurada en vez de `bio` libre, para que el LLM redacte y no invente.
