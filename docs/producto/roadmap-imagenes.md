# Roadmap del generador de imágenes — Tarkor

**Creado:** 2026-10-24 (usuaria). **Qué cubre:** el generador local de imágenes (`image-generator/`: `sd-cli` con
FLUX.2 klein en la Deck, su interfaz `abrir.sh` y los prompts que le llegan del juego). Lo ya hecho del generador
vive en `roadmap-front.md` (`CFG-38`…`CFG-43`); lo nuevo, aquí.
**Orden y hito:** los fija el [mapa de roadmaps](21-roadmap.md#mapa-de-roadmaps).

**Cómo se usa** (mismo convenio que [roadmap-front.md](roadmap-front.md)): al cerrar un punto se tacha con su
commit; **[A]** pedido por Álvaro, **[P]** propuesta de Claude; esfuerzo **S** (horas) · **M** (1-2 días) ·
**L** (varios días).

## Fase I-A · Escenas compuestas con elementos ya generados

Una imagen compuesta (un mapa, una llanura, una escena) nombra otros elementos del catálogo: «una llanura donde se
ven múrgoles y cuernahojas». Hoy el prompt los describe con palabras y el modelo los inventa de nuevo, distintos de
sus propias imágenes. Las imágenes por elemento ya viven en `image-generator/generated/<categoria>/<slug>/` y la
elegida en `generated/<categoria>/<slug>/<slug>-<perfil>.png` (`CFG-43`).

- **IMG-1 · El prompt de una escena enlaza las imágenes de sus elementos** [A] (usuaria, 2026-10-24): al preparar
  el prompt de una imagen compuesta, se detectan los elementos del catálogo que nombra (por slug o nombre de la
  enciclopedia) y se pasan sus imágenes elegidas como referencias (`-r` de `sd-cli`, varias a la vez), con el texto
  que dice qué es cada una. Antes, medir en la Deck cuántas referencias aguanta klein 4B con `--max-vram 2` y cuánto
  sube el tiempo (con una, ~200 s frente a ~105 s sin ella; ver `.claude/gw/opt-ai.md`). **M**
- **IMG-2 · Sin las imágenes de sus elementos, no se genera la escena** [A] (usuaria, 2026-10-24): si falta la
  imagen elegida de algún elemento que nombra la escena, la interfaz no deja generarla y lista los que faltan, con
  un enlace para generar cada uno primero. Depende de `IMG-1`. **S**
- **IMG-3 · Medir el generador con `/opt-ai`** [P] (usuaria, 2026-10-24): un script que resume
  `generated/*/*/registro.tsv` y los logs (segundos, perfil, pasos, con o sin referencia, memoria libre mínima) para
  que `/opt-ai` compare y proponga ajustes con números, sin leer los logs enteros. **S**

## Fase I-B · Datos visuales, panel de lore y generador moderno

Pedido por la usuaria el 2026-10-25, con su [plan](plan-imagenes/plan.md) (decisiones D1-D10 tomadas ese día). Las
imágenes tienen que salir con el toque del mundo **sin imagen de referencia**: lo dan los datos visuales de cada
elemento y un prompt montado desde ellos. `seed-catalog` y `reindex-lore` borran y reinsertan: nada que se edite
desde el panel vive en tablas que siembran.

- **IMG-4 · Guía visual del mundo y plantilla de prompt** [A] (usuaria, 2026-10-25): desde
  `plan-imagenes/borradores/`, con lo marcado «[propuesta]» pendiente de la usuaria. Fase 1 del plan. **S**
- ~~**IMG-5 · Script que monta el prompt desde la ficha**~~ ✅ 2026-10-25: `image-generator/scripts/prompt_ficha.py` (bloques B1-B9, variantes, `--fondo`, recorte por longitud, rechazo de vetadas, negaciones y nombre propio) y `tools/qa/tests/test_prompt_ficha.py` (40 tests). Pendiente: que lea `FichaVisual` (`IMG-9`). [A] (usuaria, 2026-10-25): determinista, sin LLM, con tests;
  rechaza las palabras que el modelo malinterpreta («moon», «crystal dust across the heavens», «scars»…). Depende de
  `IMG-4`. **M**
- **IMG-6 · Las 5 fichas piloto con semilla fija** [A] (usuaria, 2026-10-25): aullador macho y hembra, Cardo Brújula,
  Pastos de la Deriva y Hulki, sin `-r`; el aullador además en segunda pasada sobre su zona (`-r` de la zona). Las
  aprueba la usuaria. Depende de `IMG-5`. **S** 🚧 en curso: generadas el 2026-10-25 con `pilotos.sh 3 6` (semilla 3, 6 pasos, ~4,7 min cada una) en `image-generator/generated/<tipo>/<slug>/intentos/banner-s3-p6-20261025-14*.png` (sin subir). Primera lectura: Pastos y la segunda pasada del aullador sobre la zona, bien; las vetas minerales del aullador salen como cortes rosados; macho y hembra casi iguales; Hulki, simio de pelo blanco con barba; la fibra del Cardo, una aguja. Segunda tanda (fichas retocadas, `banner-s3-p6-20261025-15*.png`): Hulki ya lleva hocico largo, piel de hojas en los hombros y bosque cerrado, aunque con algo de barba; el Cardo tiene escala (grano de arena de hierro) y la fibra es un pelo; los picos de Pastos salen dentados y oscuros; el aullador sigue con motas rojas que parecen gotas, y la hembra apenas se distingue del macho; los Cuernahoja siguen pareciendo antílopes. Falta el veredicto de la usuaria.
- ~~**IMG-14 · Momento del día y estación como condiciones**~~ ✅ 2026-10-25: `prompt_ficha.py` con `--momento`, `--estacion`, `condiciones` en la ficha y regla 9 de coherencia (69 tests); luces y estaciones por región en `mundo.json`, marcadas [propuesta]. Pendiente: que la usuaria apruebe esos textos y generar las 5 condiciones de cada zona (`IMG-12`). [A] (usuaria, 2026-10-25): `--momento dia|atardecer|noche`
  y `--estacion primavera|verano|otono|invierno`, aparte de las variantes del sujeto (macho, hembra). `mundo.json`
  da a cada región una luz por momento y un paisaje por estación (de `docs/rpgtarkor/lore-mundo/estaciones.md`); la
  ficha de zona añade `condiciones` con lo que cambia en cada una; el script rechaza una luz o un paisaje que no case
  con el momento pedido. Por zona se aprueban la de día de cada estación y una de noche (5 imágenes), y lo nativo se
  pinta sobre la de su misma condición (`IMG-12`). Depende de `IMG-5`. **M**
- **IMG-15 · Calidad del generador local frente a ChatGPT** [A] (usuaria, 2026-10-25: «la calidad comparado con lo
  que genero desde chatgpt sigue siendo muy mala»): banco con el mismo prompt y semilla, una palanca cada vez
  (`docs/producto/plan-imagenes/calidad.sh`): más pasos, hires fix, Real-ESRGAN, `flux-2-klein-base-4b` con cfg real;
  después, lo que hay que descargar: el decodificador VAE completo (hoy `full_encoder_small_decoder`) y el codificador
  de texto en Q8 (hoy `Qwen3-4B-Q4_K_M`). Se compara contra una imagen de ChatGPT del mismo prompt y se fija el
  perfil por defecto con su coste en minutos. Si ni así se acerca, decidir con la usuaria una vía en la nube para las
  imágenes clave (zonas). Depende de `IMG-6`. **M** 🚧 en curso: primer banco el 2026-10-25 (Pastos, semilla 3, en `image-generator/generated/banco/calidad-*`). 12 pasos ≈ 6 (algo más de detalle, el doble de tiempo); hires fix, más blando y peor; Real-ESRGAN, la misma imagen a 5120x2048, más nítida pero sobreafilada (sirve para llegar a los 1983x793 del juego); `klein-base` con cfg 3,5 y 20 pasos, 15 min, sobresaturado y no mejor. **Lo que más acerca a ChatGPT es el texto de estilo** (`estilo-cine`: luz dorada dramática y gradación cálida en vez de «muted» y «ordinary daylight»), al mismo coste (~2,5 min). Sigue en `banco.sh` por rondas, con los resultados en [`banco/resultados.md`](plan-imagenes/banco/resultados.md): el VAE completo (Apache 2.0) y el codificador Q8 no aportan; Z-Image-Turbo (Apache 2.0) arranca en la Deck. Rondas 1-7 hechas (2026-10-25): **perfil ganador, klein Q8 + estilo `cine2` con polvo mate, euler, 6 pasos, VAE pequeño, ~2,5 min**; aguanta con otras semillas, que deciden detalles como los colmillos (generar 2-3 y elegir). Samplers, 9 pasos y Q6 no mejoran; Z-Image (Q4/Q6), más pictórico y fiel en fauna, ~6-7 min. 2026-10-26: pastos con Z-Image Q6 leídos: klein `cine2` gana también en zona (Z-Image, más plano y ~3 veces más lento; queda como `MODELO=` para fauna). El estilo ganador pasa a `estilo/mundo.json` separado por D8 (usuaria, 2026-10-26): el acabado de `cine2` en todo `banner` y el cielo encendido solo con `--momento atardecer`; polvo mate en la ficha del aullador y 6 pasos por defecto (`generar.sh`, `probar.sh`, interfaz). Puestas al lado de las de ChatGPT del juego, **no se parecen ni de lejos** (usuaria, 2026-10-26). Rondas 8 y 9 leídas: D8 arregla la luz pero no el aspecto (cielo azul plano, CGI de catálogo); el arte conceptual no cambia nada y un banner de ChatGPT como `-r` acerca la paleta, no la composición ni el detalle (~270 s). FLUX.3 Klein en la CPU (`--backend cpu`, r10, 2026-10-26) arranca: **62 min** por banner y el mayor salto de calidad del banco (textura, profundidad, colmillos del canon), cerca de ChatGPT en detalle aunque no en composición; vale para tandas de noche. Con `--backend diffusion=cpu -t 8`, 49 min. El estilo `realista` (r11) apenas mueve la imagen: manda la ficha. **Objetivo nuevo (usuaria, 2026-10-26): igualar las imágenes del juego, diseño incluido**, para después generar lo que falte sin referencia: fichas reescritas desde los banners de ChatGPT (`imagenJuego`; lo que choca con el canon, en `propuestas`) y plantilla «fotorreal» (r12; el aullador ya es el mismo animal, faltan proporción, cresta entera, manada y bruma roja). Siguientes palancas, en orden (usuaria, 2026-10-26: «como un diseñador, que va creando planos y luego los monta»): **cadena de planos** (plancha de fondo sin sujeto, sujeto aislado sobre verde, montaje con ffmpeg, armonización con img2img a 0,2-0,4; [investigación](plan-imagenes/investigacion-tecnicas-diseno.md)); después los **mandos del motor** (muestreador, planificador, *shift*, Qwen3VL Q8). Un LoRA entrenado con los 135 banners del juego sería la palanca más fuerte, pero entrenar no cabe en la Deck: apuntado por si hay GPU. Falta: afinarla hasta igualar, pasarla a `mundo.json` y a un perfil de `generar.sh`, y decidir con la usuaria si pasa a ser el modelo de las imágenes clave; repetir cardo, hulki y aullador de noche de `r8-guia`, que abortaron por memoria. Solo hay la Deck: sin Colab ni GPU alquilada. Leves del `/code-review` del 2026-10-25, pendientes (todo en el banco, que es contenido): la clave para saltar una prueba no incluye variables ni args; `banco.sh` con arrays vacíos y `set -u` no corre en bash 3.2; el estilo `cine` está copiado en `calidad.sh` y `banco/prompts.py`; los retoques `fantasia` y `polvo` no pasan las reglas de `prompt_ficha.py`; el hires de `calidad.sh` apunta 1280x512 en el registro; `spike/run*.sh` llevan rutas de la Deck.
  **Plan final (2026-10-26):** fase de diseño con 7 investigaciones (`plan-imagenes/investigacion-*.md`) y la
  usuaria delega el criterio; el plan, escrito con Fable y revisado, es [`plan-fotorreal.md`](plan-imagenes/plan-fotorreal.md)
  y sigue en `IMG-16`…`IMG-23`. `IMG-15` se cierra con `IMG-23`.
- ~~**IMG-16 · Prompt `fotorreal` que llega entero**~~ ✅ 2026-10-26 [A] ([plan](plan-imagenes/plan-fotorreal.md#img-16--prompt-fotorreal-en-prompt_fichapy-con-tests-p--s)):
  perfil `fotorreal` en `mundo.json` (sin preámbulo, `Style/Mood`, lente por tipo, tope 520, solo `B3b` recortable),
  `prompt_ficha.py` con su orden y los avisos P2-P5 (solo en `fotorreal`; el de pose, solo en fauna) y `--perfil`;
  4 fichas reescritas (aullador 356 palabras, cuernahoja 360, cardo 287, pastos 269; sin recortes ni avisos) y
  `banco/prompts/r14-*-fotorreal.txt`; 104 tests en `test_prompt_ficha.py`. Las dos fichas de fauna llevan ya el
  campo `boceto` de `IMG-18`. **Pendiente:** con `--momento noche`, aullador y cuernahoja rompen la regla 9 (su `luz`
  nombra el sol y en `fotorreal` B6 ya no se recorta); faltan condiciones `momento:noche`, en `IMG-23`. **S**
- **IMG-17 · Gradación y medida en ffmpeg** [A] (2026-10-26, [plan](plan-imagenes/plan-fotorreal.md#img-17--gradación-y-medida-en-ffmpeg-calibradas-contra-los-banners-de-gpt-p--s)):
  `gradar.sh` por momento calibrado contra los banners de GPT, `medir.sh` (signalstats + EMD) y rejilla; LUT 3D.
  Fase 0. **S** 🚧 2026-10-26: hechos `gradar.sh` (con `--hornear`), `medir.sh`, `medir/` (`stats.sh`, `emd.py`,
  `rejilla.sh`), `estilo/gradacion.json` y `test_gradar.py` (8). Calibración: atardecer (EMD Cb/Cr 5,1/6,4) y día
  (5,7/4,7) pasan sin alejar los GPT de control; noche sin validar (no hay generación nocturna). Las ventanas de
  YAVG/SATAVG de día y noche salen de sus referencias (las del plan solo valen para atardecer). **Falta:** el sí de la
  usuaria a los tres tintes en las rejillas (`generated/banco/r14-gradacion/`), hornear las LUT aceptadas y
  validar la noche con la primera imagen nocturna.
- **IMG-18 · Bocetos SVG de forma** [A] (2026-10-26, [plan](plan-imagenes/plan-fotorreal.md#img-18--bocetos-svg-de-forma-revisados-por-la-usuaria-p--s)):
  depredador y herbívoro con `rsvg-convert`, campo `boceto` en la ficha; sí/no de la usuaria. Fase 0. **S**
- **IMG-19 · Tanda de borradores** [A] (2026-10-26, [plan](plan-imagenes/plan-fotorreal.md#img-19--tanda-de-borradores-método-bocetos-planos-y-armonización-p--m)):
  640x256 a 8 pasos; valida el borrador, la fuerza del boceto y la armonización del montaje (`-i` frente a `-r`).
  Depende de `IMG-16`…`IMG-18`. **M**
- **IMG-20 · Codificador de texto Q8 (opcional)** [A] (2026-10-26): A/B con la misma semilla tras `IMG-23`, con
  permiso para descargar 4,3 GB. **S**
- **IMG-21 · Aullador y cuernahoja por planos** [A] (2026-10-26): candidato a 16 pasos, gradado y medido, que
  iguale su banner del juego. Depende de `IMG-19`. **M**
- **IMG-22 · Cardo brújula y Pastos de la Deriva** [A] (2026-10-26): txt2img con el prompt nuevo, gradado y
  medido. **S**
- **IMG-23 · Perfil `fotorreal` en `generar.sh`, `probar.sh` y `mundo.json`** [A] (2026-10-26): una orden
  reproduce el candidato de `IMG-21` dentro del umbral; docs y tests. Cierra `IMG-15`. **M**
- **IMG-7 · Modelo de datos: `Propuesta` y `FichaVisual`** [A] (usuaria, 2026-10-25): migración Prisma (puerta de un
  solo sentido), importador de los 3 `.md` de propuestas (~159), exportación de lo aprobado al formato de
  `propuestas-aprobadas.md`, fichas exportadas a JSON versionado, API Fastify con escritura solo desde `127.0.0.1` y
  token en `.env` (D1, D3, D4). Fase 2. **L**
- **IMG-8 · Panel admin de lore tipo CRM** [A] (usuaria, 2026-10-25): pestañas Propuestas y Fichas del
  [prototipo](plan-imagenes/prototipo/index.html) en el admin React: ver, filtrar, diff, editar y aprobar o rechazar
  en bloque las propuestas (de Claude y de OpenCode) y ver el lore ya volcado en la BD; un cambio a lore sembrado
  entra como propuesta, no se escribe en su tabla. Atajos de teclado. Depende de `IMG-7`. Fase 3. **L**
- **IMG-9 · Fichas visuales en bloque** [A] (usuaria, 2026-10-25): un LLM rellena borradores de ficha desde el canon
  (53 de fauna primero) como propuestas en la bandeja; el script de `IMG-5` lee `FichaVisual` en vez de `bio`.
  Depende de `IMG-8`. Fase 4. **L**
- **IMG-10 · Estados por intento y papelera** [A] (usuaria, 2026-10-25): favorita, candidata, descartada (y
  aprobada, que hereda de `elegidas.tsv`) en `estados.json` por elemento; las descartadas se pueden borrar
  (papelera como carpeta). D7. Fase 5. **M**
- **IMG-11 · Cola con tiempo estimado, lotes y ajustes reutilizables** [A] (usuaria, 2026-10-25): cola con ETA,
  lotes de semillas, reutilizar los ajustes de una imagen, plantillas de ajustes y comparar imágenes. Fase 5. **M**
- **IMG-12 · Zona aprobada como fondo de lo nativo** [A] (usuaria, 2026-10-25): primero se generan las zonas; la
  fauna, flora y demás elementos nativos de una zona sin imagen aprobada quedan bloqueados, y con zona aprobada se
  genera en segunda pasada con la zona como `-r` (una por pasada en la Deck, D10). Generaliza `IMG-1` e `IMG-2`.
  Fase 5. **M**
- **IMG-13 · Interfaz del generador en el admin** [A] (usuaria, 2026-10-25): pestaña Generador del prototipo en el
  admin React (`servidor.py` pasa a API, D6), con ideas de Leonardo y similares: galería, vista ampliada, revisión
  rápida con teclado y filtros. Hecho cuando se revisan 20 intentos solo con teclado. Fase 6. **L**
