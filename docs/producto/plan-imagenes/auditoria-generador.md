# Auditoría del generador de imágenes de Tarkor

Raíz: `/home/deck/Desktop/Desarrollos/World-Maker-Fantasy` (R). Generador: `R/image-generator` (G). Solo lectura.
Estado: 14 intentos reales en `G/generated/fauna/` (murgol-macho 1, aullador-rojo-macho 11 filas de registro). La interfaz son ~1.175 líneas en total.

## 1. Arquitectura

**Stack.** Python 3 stdlib sin dependencias + una sola página HTML con JS vanilla (sin framework, sin build).
- `G/interfaz/servidor.py` (594 líneas): `ThreadingHTTPServer` en 127.0.0.1:7861 (`IMG_PUERTO`). Docstring con la API (líneas 1-27).
- `G/interfaz/index.html` (409 líneas): CSS inline + JS inline. Helper `h()` para crear DOM, `api()` con fetch, sondeo cada 1 s de `/api/estado`.
- `G/interfaz/resumen.py`: resumen en texto de la lista y el trabajo (QA-229/230).
- `G/abrir.sh`: cierra una interfaz anterior, `podman start tarkor-postgres`, copia `R/backend/uploads/images/` a `G/referencias/images/` (`cp -ru`), abre el navegador y lanza `servidor.py`.
- Tests: `R/tools/qa/tests/test_interfaz_imagenes.py` (35 casos según `R/docs/producto/roadmap-front.md`, entrada CFG-43).

**Cómo llama a sd-cli.** Cadena `servidor.py` (`class` de trabajo, `lanzar()`/`_correr()`, líneas ~365-430) -> `scripts/probar.sh <tipo> <slug> <perfil> <semilla> <pasos> [-r ref]` -> `scripts/generar.sh` -> `bin/sd-cli`.
- `generar.sh` (líneas ~30-57): `sd-cli --diffusion-model flux-2-klein-4b-Q8_0.gguf --llm Qwen3-4B-Q4_K_M.gguf --vae full_encoder_small_decoder.safetensors -p "$PROMPT" --cfg-scale 1.0 --steps N --sampling-method euler -W -H --seed --flash-attn off,diffusion=on --vae-tiling --params-backend disk --max-vram vulkan0=2 <extra> -o intentos/<nombre>.png -v`.
- Protecciones de memoria (no tocar): >=7000 MB libres al empezar, vigilante que mata a <1500 MB, aborto si el driver dice «0 MB libres», timeout 900 s, `LIBERAR_OLLAMA=1` descarga los modelos de Ollama (README de G, sección «Memoria»).
- El servidor admite **una sola generación a la vez** (cerrojo + `pgrep -x sd-cli`); el prompt pegado va por `PROMPT_ARCHIVO` (archivo temporal). No hay cola.
- La referencia es **una sola** imagen: `-r <referencias/images/<tipo>/<slug>-<perfil>.ext>` (`referencia_de()`, línea ~344; solo la imagen que el juego ya tiene del mismo elemento, la del perfil o, si no, la de otro). Con referencia ~200 s frente a ~105 s (FACTOR_REFERENCIA 1,9; `ESTIMADO_BASE` línea 45).

**Endpoints** (`servidor.py` docstring y `do_GET`/`do_POST`):
GET `/api/inicio`, `/api/elementos`, `/api/elemento?tipo&slug`, `/api/prompt?tipo&slug&perfil`, `/api/referencia?...`, `/api/estado`, `/img/<tipo>/<slug>/<nombre>.png`, `/elegida/<tipo>/<slug>/<perfil>.png`, `/ref/<tipo>/<slug>-<perfil>.<ext>`.
POST `/api/generar {tipo,slug,perfil,semilla,pasos,prompt|desdeBase,usarReferencia}`, `/api/nota`, `/api/elegir`. POST exige JSON y Origin = Host (anti-CSRF, línea ~560).

**Lectura de datos del backend.**
- Catálogo: `catalogo()` (línea 219) hace `GET http://127.0.0.1:3001/world/helek-sirik/enciclopedia` (`IMG_API`, `MUNDO`). Recorre `SECCIONES` (npcs, items, faunaFlora, locations, razas, personajes, constructionRecipes, craftingRecipes, factions, historia), variantes por sexo (`-macho`/`-hembra`), variantes de raza, el mapa `zona` de cada `location` y sus `variantesTiempo` (`<slug>-<momento>-<estacion>`), habilidades (`ability`, por `slugify` replicado de `R/backend/src/lib/slugify.ts`) y clases/especializaciones leyendo los enums de `R/backend/prisma/schema.prisma` (`enum_prisma`). ~2.550 elementos (QA-228).
- Prompts: **no usa la API HTTP**, hace SQL directo con `podman exec -i tarkor-postgres psql -U tarkor -d tarkor -At -c` sobre la tabla `ImagePrompt` (`entidades()`, `prompt_de()`, `consulta_json()`), clave (worldId, entityType, entitySlug, sizeProfile). Si falta BD o backend, la lista se degrada con un aviso (`elementos()`, línea 272).
- Imágenes del juego: copia local `referencias/images/` (no git), listada con `os.listdir`.

**Layout de `G/generated/<tipo>/<slug>/`** (fuera de git, `G/.gitignore`):
- `intentos/<perfil>-s<semilla>-p<pasos>-<AAAAMMDD-HHMMSS>.png`, `prompts/<mismo>.txt`, `logs/<mismo>.log`.
- `registro.tsv`, cabecera (`CABECERA_REGISTRO`, servidor.py línea 43; la escribe `probar.sh`): `fecha  nombre  perfil  prompt(usado|base|pegado)  semilla  pasos  tamaño(WxH)  extra(args de sd-cli, p. ej. "-r ruta")  salida(rc)  segundos`. Append-only, una fila por intento. Ejemplo: `generated/fauna/murgol-macho/registro.tsv`.
- `elegidas.tsv`: sin cabecera, 2 columnas `nombre<TAB>destino` (ej. `thumbnail-s42-p4-20261024-234209  generated/fauna/murgol-macho/murgol-macho-thumbnail.png`); append-only, vale la última por destino (`leer_elegidas`).
- `notas.md`: líneas `- <nombre>: <texto en una línea>` bajo una cabecera; se reescribe entero en cada nota (`guardar_nota`).
- `<slug>-<perfil>.png`: la elegida, con el nombre que busca el juego.

**Perfiles** (`PERFILES` línea 41; `probar.sh` líneas 17-23; `TAMANOS` en index.html):
| Perfil | Tamaño generado | Tiempo medido (README G) | Uso en el juego |
|---|---|---|---|
| banner | 1280x512 | ~110 s | detalle de la Enciclopedia (~3:1) |
| thumbnail | 768x768 | ~100 s | cuadrícula/EntryCard |
| mapa | 832x624 | ~110 s (est.) | fondo del panel Zona (solo tipo `zona`) |
| icono | 512x512 | ~80 s (est.) | emblema plano de asentamientos / clases |
Pasos: por defecto 4 (la UI permite 1-20; hay intentos con 6, 8 y 10 en aullador-rojo). Semilla 0..2^31-1. Sin selector de modelo/CFG/tamaño en la UI (solo variables de entorno `MODELO`, `CFG`, `W`, `H`).
Nota: los scripts y la ayuda del README a veces dicen «miniatura»; el perfil real se llama `thumbnail`.

## 2. Roadmap (con estado)

Fuente única de lo nuevo: `R/docs/producto/roadmap-imagenes.md` ("Fase I-A · Escenas compuestas con elementos ya generados", creado 2026-10-24 por la usuaria). Lo hecho: `R/docs/producto/roadmap-front.md` (CFG-38..CFG-43). Traspaso: `R/docs/registros/traspaso.md` (filas «Tarea en curso · claude/imagenes-local» y «claude/interfaz-imagenes», línea ~26-27; historial líneas ~157-163). Retros: `R/docs/registros/retro-2026-10-24-imagenes-local.md`, `retro-2026-10-25-interfaz-imagenes.md`; PRs: `R/docs/registros/pr/claude/imagenes-local.md`, `interfaz-imagenes.md`. Mapa de agente: `R/docs/mapa-agente.md` (sección «Imágenes»).

| Id | Qué | Estado |
|---|---|---|
| **IMG-1** (`roadmap-imagenes.md`) | El prompt de una escena enlaza las imágenes de sus elementos: detectar elementos del catálogo nombrados y pasar sus imágenes elegidas como `-r` (varias), con texto que diga qué es cada una. Antes, medir cuántas referencias aguanta klein 4B con `--max-vram 2` y el tiempo. Esfuerzo M, [A] | **Abierto**, sin empezar |
| **IMG-2** | Sin las imágenes de sus elementos, no se genera la escena: la interfaz bloquea y lista los que faltan con enlace para generar cada uno. Depende de IMG-1. S, [A] | **Abierto** |
| **IMG-3** | Script que resume `generated/*/*/registro.tsv` y logs para `/opt-ai`. S, [P] | **Abierto** |
| CFG-38 | Prompt de imagen usado editable (`promptUsado`, `promptUsadoAt`) | Hecho 2026-10-24 |
| CFG-39 / CFG-40 | Generador de prompts con reglas FLUX / RAG (región, paisaje, luz, 2 prompts usados de ejemplo) | Hecho 2026-10-24 |
| CFG-41 | LoRA de estilo | Abierto, tras CFG-42 |
| CFG-42 | Análisis por Claude de las pruebas de la usuaria (QA-223: subagente grande lee registro/notas/prompts/imágenes) | Abierto (proceso, bajo demanda) |
| CFG-43 | Interfaz local del generador | Hecho 2026-10-24 (+ QA-228..QA-233 retro 2026-10-25) |

Hallazgos:
- **No existe ningún ítem de favoritos, candidatos, papelera/descartar ni rediseño de UI** en ningún roadmap, QA ni traspaso (búsqueda `IMG-`, `CFG-4`, `favorit`, `candidat` en `R/docs`). Hay que crearlos (p. ej. IMG-4..).
- **La dependencia «zona primero, luego fauna con la zona de fondo» está cubierta a medias por IMG-1/IMG-2** (enlazar imágenes elegidas de elementos nombrados + bloquear si faltan), pero esos ítems están redactados para el caso «la escena nombra elementos» (zona -> fauna), es decir, al revés de lo que se quiere (fauna nativa -> zona de fondo). Hay que redactar un ítem nuevo o reformular IMG-1/IMG-2 para ambas direcciones.
- Medición de referencias múltiples: pendiente (IMG-1). FLUX.3 admite hasta 10 referencias pero «no arranca en la Deck» (README G, tabla de modelos); klein 4B con `-r` único mide ~200 s (`R/docs/arquitectura/reutilizables/01-generacion-imagenes-local.md` líneas ~237-258, `R/.claude/gw/opt-ai.md`).
- Documento de diseño del reutilizable: `R/docs/arquitectura/reutilizables/01-generacion-imagenes-local.md` (consistencia por referencia = «la palanca grande», líneas 246-258).

## 3. Funciones actuales de la UI y puntos débiles

**Funciones** (`G/interfaz/index.html`):
1. Columna izquierda: selector de categoría, filtro por texto, lista con miniatura del juego, nombre/slug, marcas «N intentos» y «✓ elegida», «+ Elemento nuevo» (tipo+slug manual).
2. Ficha: imagen actual del juego, botones de perfil (con tamaño y si hay prompt usado/base), textarea del prompt (con indicador de fuente y «Volver al de la enciclopedia»), semilla (+ dado), pasos, casilla «usar imagen del juego como referencia» con vista previa.
3. Generar (un botón), barra de progreso con paso y tiempo restante estimado por mediana; retoma el progreso al recargar (localStorage guarda último elemento/perfil, `guardar()`).
4. Galería del elemento: filtro por perfil, tarjeta «Actual del juego» (borde discontinuo), la elegida primero, lightbox con la del juego al lado, nota por imagen (autoguardada en `notas.md`), «Elegir esta», «Reutilizar prompt y semilla», `<details>` con el prompt.
5. Tema claro/oscuro automático (`prefers-color-scheme`), responsive a 900 px.

**Puntos débiles**
- Estética de formulario administrativo (paleta beige/marrón, tarjetas planas); dos columnas fijas: la galería queda **debajo** de la ficha larga, así que se genera y se mira en sitios distintos y hay que hacer scroll (`scrollIntoView` en «Reutilizar»). Sin vista de lienzo central + historial lateral tipo Leonardo.
- **Estado por intento = solo «elegida» y una nota.** No hay favorito, candidato, aprobado, descartado ni papelera; no se puede borrar un intento (ni el PNG ni el log); el almacén es append-only (`registro.tsv`, `elegidas.tsv`).
- «Elegir esta» es por (elemento, perfil) y sobrescribe el PNG anterior sin guardarlo (`elegir()` -> `shutil.copyfile`); no hay deshacer (solo queda la fila antigua en `elegidas.tsv`). Re-elegir no revierte.
- Una generación a la vez, sin cola ni lote; **no hay lote de semillas** (`probar.sh` es una imagen por llamada; `scripts/obsoleto/lote.sh` bloqueó la Deck por `--max-vram vulkan0=6`).
- Sin comparar dos intentos entre sí (solo intento vs. actual del juego, en el lightbox). Sin zoom/pan sincronizado.
- Sin historial de prompts: el prompt vive en el textarea, `prompts/*.txt` y la tarjeta; no hay deshacer/versiones ni diff, y se pierde al cambiar de elemento (`$('prompt').value = ''` si `cambia`).
- Filtros de la galería: solo perfil. Nada por estado, semilla, con/sin referencia, fecha ni nota. La lista de elementos filtra por categoría y texto, pero no por «sin imagen elegida / con intentos / pendiente».
- Sin ajustes de tamaño, CFG, modelo ni ESRGAN en la UI (solo variables de entorno); el ESRGAN 4x solo aparece en pruebas manuales (`G/pruebas/murgol`).
- Una sola referencia, y solo la imagen del juego del propio elemento; no se puede elegir una cualquiera (otro elemento, intento propio, zona). El servidor valida `usarReferencia` contra `referencias/images` (`lanzar()`).
- Depende de PostgreSQL por `podman exec psql` para leer prompts (frágil; el propio backend ya tiene `GET /world/:slug/image-prompt`, `R/backend/src/routes/world.ts:888`); catálogo cuesta una llamada de ~2.500 elementos.
- No mide ni muestra la memoria; el estimado de tiempo es una mediana global por perfil.
- Accesibilidad/teclado: la lista y las tarjetas son `div` clicables sin foco; `alt=""` en todas las imágenes.
- Tests de UI: no hay (los 35 son del servidor y del contrato); el HTML solo se comprobó a mano/captura.

## 4. «Elegir esta» y el juego

- `elegir()` (`servidor.py:182`) copia `intentos/<nombre>.png` a `G/generated/<tipo>/<slug>/<slug>-<perfil>.png` y añade `nombre\tdestino` a `elegidas.tsv`. **No toca el juego**: el aviso de la UI dice «cópiala a `backend/uploads/images/<tipo>/`» (index.html, botón Elegir).
- El juego lee `R/backend/uploads/images/<entityType>/<entitySlug>-<sizeProfile>.<ext>` (`png|jpg|jpeg|webp`), servido por `@fastify/static` bajo `/images/` (`R/backend/src/lib/imageAssets.ts:11-27`): `imageUrlsFor` (thumbnail, banner), `iconoUrlFor` (icono), `zoneMapImageUrl` (entityType `zona`, perfil `mapa`, con cascada `<slug>-<momento>-<estacion>` -> `-estacion` -> `-momento` -> base). El nombre generado coincide por construcción.
- Modelo `ImagePrompt` (`R/backend/prisma/schema.prisma:3449`): `worldId, entityType, entitySlug, sizeProfile, prompt, provider, promptUsado?, promptUsadoAt?`, único por (mundo, tipo, slug, perfil). **Guarda prompts, no estados de imagen ni rutas.** Rutas: `POST/GET /world/:slug/image-prompt`, `PUT .../image-prompt/usado` (`R/backend/src/routes/world.ts:817,888,913`). Generador: `R/backend/src/services/imagePromptGenerator.ts` (tipos `ImagePromptEntityType`: npc, item, fauna, ability, raza, personaje, location, construccion, faction, historia, crafteo, zona, clase, especializacion; perfiles thumbnail|banner|mapa|icono; `REGION_ESCENA` línea 162), contexto: `imagePromptContext.ts`.
- Frontend: `R/frontend/src/components/ImagePromptDisplay.tsx` (`ImagePromptSlot` con `ImagePromptSlotContenido`, `MediaSlot`, `ImageLightbox`) y `R/frontend/src/lib/api.ts` líneas ~2905-2990 (`ImagePromptEntityType`, `ImagePromptSizeProfile`, `requestImagePrompt`, `getImagePrompt`, `saveImagePromptUsado`). Muestra el prompt (usado si lo hay) con «Copiar», «Editar», «Regenerar base»; la imagen se pinta cuando `imageUrls` del backend trae la ruta.
- **Fauna y zona hoy**: la fauna solo conoce una **región** (cadena), no una zona: `harvestSourceRegion[baseSlug]` (`R/backend/src/scripts/worldCatalog.ts`), hogar del Npc o `lugarOrigen` del ítem (`imagePromptContext.ts:187-199`), que alimenta `REGION_ESCENA` (paisaje/luz por región). No hay tabla ni campo que diga «esta fauna es nativa de esta zona (Location)» para consumir la imagen de la zona. La zona (`entityType: 'zona'`) se llama como el slug de la `location`.

## 5. Qué habría que cambiar

Idea de diseño (sin implementar). Ahora el único dato de estado es `elegidas.tsv`; falta un modelo por intento.

**a) Estado por intento (favorito, candidato, aprobado, descartado/papelera).**
- Datos: nuevo archivo por elemento, p. ej. `generated/<tipo>/<slug>/estados.tsv` (`nombre<TAB>estado<TAB>fecha`, append-only, última fila gana, igual que `elegidas.tsv`) o `intentos.json` con un objeto por intento (más cómodo para añadir etiquetas y relaciones). Estados: `candidato` (por defecto), `favorito`, `aprobado` (sustituye a la «elegida»; uno por (elemento, perfil)), `descartado`. Migración: `elegidas.tsv` -> `aprobado`.
- Servidor: `POST /api/estado {tipo,slug,nombre,estado}`; `leer_elemento()` (línea 164) añade `estado`; `elegir()` pasa a ser «aprobar» y debería guardar copia de la anterior (`versiones/`) para poder deshacer.
- UI: botones/atajos en cada tarjeta, pestañas o chips de filtro por estado, y que la lista lateral muestre «aprobada / candidatas / sin nada».

**b) Papelera.** `descartado` mueve el PNG, log y prompt a `generated/<tipo>/<slug>/papelera/` (reversible) y deja la fila en `registro.tsv`; «Vaciar papelera» borra de verdad. Nunca borrar la aprobada ni la referenciada por otra (ver f). Hoy ninguna ruta borra nada.

**c) Comparar.** Seleccionar 2-4 tarjetas y abrir una vista dividida con zoom/pan sincronizado y, opcional, deslizador antes/después; ya existe el lightbox de dos imágenes (`ampliar(src, titulo, juego)`, index.html) que es el punto de partida. Solo front.

**d) Lote de semillas.** `POST /api/generar` acepta `semillas:[...]` o `cantidad:N`; el servidor encola y las ejecuta **de una en una** (el cerrojo y `pgrep` actuales son el límite de la Deck; no paralelizar, no subir `--max-vram`). Hace falta una cola en `TRABAJO` (hoy un único `estado`), progreso «3 de 6» y cancelar. Cada elemento del lote se registra como un intento normal. 6 imágenes de banner ~11 min: avisar del coste.

**e) Reutilizar ajustes y historial de prompts.** Hoy «Reutilizar prompt y semilla» ya restaura prompt/semilla/pasos/perfil (index.html, `reutilizar`). Falta guardar y restaurar `referencia` (`extra` del registro) y tamaño, y un historial por elemento: se puede derivar de `prompts/*.txt` + `registro.tsv` (sin base de datos), con lista desplegable de prompts distintos (hash) y marca del último usado; opcional diff entre dos. No cambiar el formato de `registro.tsv` (leído por QA/IMG-3); añadir columnas al final y que `filas_registro` tolere cabeceras viejas.

**f) Filtros.** Galería: por estado, perfil, semilla, con/sin referencia, texto de nota; lista: por «sin aprobada», «con candidatas», «tipo». Todo derivable de datos ya leídos en `leer_elemento()`; solo front + el campo `estado` nuevo.

**g) Dependencia zona -> fauna como fondo.**
- Falta el dato de la relación: hoy no existe fauna<->zona. Opciones: (1) tabla/campo en el backend (p. ej. zonas nativas por `sourceSlug` fauna, en `worldCatalog.ts`/`HarvestYield`); (2) un `dependencias.json` en el propio generador; (3) derivarla de la región (`harvestSourceRegion`) que ya existe -> varias zonas candidatas, elegida a mano. Recomendable (2) o (3) para el primer paso y no tocar el backend ni el schema (ojo: la regla de G es «otros repos solo se leen»; esto es el repo de Tarkor, se decide con la usuaria).
- Regla: elementos de tipo `fauna` (y flora) con zona nativa -> la UI exige que la zona (`tipo=zona`, perfil `mapa`) tenga imagen en estado `aprobado` antes de generar; si no, bloquea y enlaza para generarla primero (es IMG-2).
- Mecanismo: la imagen aprobada de la zona (`generated/zona/<slug>/<slug>-mapa.png`) pasa como `-r` y el prompt lleva una frase del tipo «place the animal in this scene». Hay que añadir a `probar.sh`/`servidor.py` una referencia arbitraria (hoy `referencia_de()` solo busca en `referencias/images/<tipo>/<slug>-...`): `usarReferencia` pasaría a `referencia: {tipo, slug, perfil | nombre}` validada contra `generated/`. Y, para varias (zona + estilo del propio animal), medir primero la memoria y el tiempo (IMG-1). Sin esa medición, una sola referencia.
- Caveat del formato: el mapa de zona es cenital (`ENTITY_TYPE_STYLE.zona`: «top-down aerial exploration map», `imagePromptGenerator.ts:68`), poco útil como fondo de un banner de fauna de perfil. Hay que decidir si el «fondo» es el mapa o un banner/paisaje de la zona (tipo `location`, perfil `banner`), que sí es una escena a nivel de suelo.
- Tests: ampliar `test_interfaz_imagenes.py` con casos de bloqueo y de `-r` correcto, comprobando el motivo del fallo (regla de `AGENTS.md` del repo).

**h) Rediseño de la UI (Leonardo-like).** Lienzo grande central con la última generación, tira/columna de historial a un lado con filtros y estados, panel de ajustes (perfil, semilla/lote, pasos, referencia) fijo, lista de elementos en un cajón. Se puede hacer sin dependencias (HTML/CSS/JS vanilla, como hoy) separando CSS y JS en archivos servidos por `servidor.py` (hoy solo sirve `index.html` y las imágenes). Las rutas API existentes se mantienen.

**Orden sugerido.** (1) Modelo de estados + papelera + migración de `elegidas.tsv` (sin UI nueva) con tests; (2) filtros y comparador; (3) rediseño; (4) cola/lote de semillas; (5) referencias arbitrarias y dependencia zona -> fauna (medir IMG-1 antes). Para la dependencia, antes hay que decidir con la usuaria de dónde sale la relación fauna<->zona y qué imagen de la zona hace de fondo.
