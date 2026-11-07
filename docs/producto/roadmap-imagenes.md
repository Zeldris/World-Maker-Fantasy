# Roadmap del generador de imágenes — Tarkor

**Creado:** 2026-10-24 (usuaria). **Qué cubre:** el generador local de imágenes (`image-generator/`: `sd-cli` con
FLUX.2 klein en la Deck, su interfaz `abrir.sh` y los prompts que le llegan del juego). Lo ya hecho del generador
vive en `roadmap-front.md` (`CFG-38`…`CFG-43`); lo nuevo, aquí.
**Orden y hito:** los fija el [mapa de roadmaps](21-roadmap.md#mapa-de-roadmaps).
**A `main` por bloque** (usuaria, 2026-11-03, `QA-281`): la rama se lleva a `main` al cerrar cada bloque de tareas
(p. ej. receta, montaje, LoRA), no al final: `claude/plan-imagenes` juntó 90 commits y 8 días.

**Cómo se usa** (mismo convenio que [roadmap-front.md](roadmap-front.md)): al cerrar un punto se tacha con su
commit; **[A]** pedido por Álvaro, **[P]** propuesta de Claude; esfuerzo **S** (horas) · **M** (1-2 días) ·
**L** (varios días).

## Plan por fases (usuaria, 2026-11-06): manda sobre lo anterior

Cada elemento se crea **suelto** (fondos, flora, fauna y todos los demás). Se escribe un prompt, que genera un boceto;
cada fase siguiente parte de ese prompt y de la imagen aceptada en la fase anterior. Avanzar acepta y guarda; si no vale,
se edita el prompt y la fase lo reintenta; también se puede volver atrás. El bucle no tiene límite.

`F0 Boceto → F1 Forma → F2 Detalle → F3 Recorte (no en fondos) → F4 Final (tanda de noche) → ★ Marcada`

Lo guardado se borra desde el elemento o se reutiliza para variantes. Lo marcado ★ se combina con otras imágenes ★;
publicar en el juego es un paso aparte. Detalle en
[`diseno-interfaz-continua.md`](plan-imagenes/diseno-interfaz-continua.md).

**Cuándo:** el bloque A se adelanta a las pruebas de juego por decisión de la usuaria (2026-11-06); los bloques siguientes se deciden al cerrarlo. Cada generación sigue pidiendo su sí y la pregunta de memoria.
Prioridad de tipos: los que tienen banner, para poder comparar.

| Bloque | Objetivo | Tareas, en orden |
|---|---|---|
| **A. Receta** | Saber qué hace cada fase y cuánto cuesta, antes de construir | `IMG-35`, `IMG-34`, `IMG-36`, `IMG-46`, `IMG-37`, `IMG-38` |
| **B. Prototipo** | Probar la pantalla antes de construirla | `IMG-39` |
| **C. Motor e interfaz base** | Una orden por fase y lo guardado por elemento | `IMG-40`, `IMG-41`, `IMG-3`, `IMG-11` |
| **D. Pantalla del elemento** | El flujo completo, con variantes y ★ | `IMG-25`, `IMG-42`, `IMG-6` |
| **E. Combinar** | Escenas con piezas ya aprobadas | `IMG-43`, `IMG-1`, `IMG-2` |
| **F. Producción** | Crear el catálogo y llevarlo al juego | `IMG-9`, `IMG-44`, `IMG-45` |
| **H. Sin GPT** | Biblioteca propia en FLUX que sustituye a los banners GPT como referencia | `IMG-47`, `IMG-48`, `IMG-49` |
| **G. Con GVIG** | Compartir lo aprendido | `IMG-26` |

Lo de lore (`IMG-7`, `IMG-8`) pasa a [`roadmap-lore.md`](roadmap-lore.md).

### Bloque A · Receta por fases

- ~~**IMG-35 · F0: boceto desde el prompt** [A] (usuaria, 2026-11-06)~~ ✅ 2026-11-06: r23, 20 imágenes. Receta: FLUX.2 en
  GPU, 512x192, 4 pasos, línea `Style` de masas planas; ~36 s, legible en los cinco tipos (`pautas.md` §12). **Pendiente, en
  otras tareas:** si F1 recupera la forma rara que F0 pierde (`IMG-34`) y el fondo liso para recortar (`IMG-37`). **M**
- ~~**IMG-36 · F2 Detalle y F4 Final desde la imagen aceptada**~~ [A] (usuaria, 2026-11-06): ✅ 2026-11-07. F2 a 960x384,
  0,50 y 16 pasos, ~5 min; Final a 1280x512 en ~7,6 min frente a 49, así que puede salir de día; agrandar con lanczos;
  cadena a proporción 2,5 (`pautas.md` §14, r26 y r27). Comparada con el banner GPT como `-r`: salto grande de forma en
  el aullador, medio en choza y cuchillo, nulo en el cardo; ninguna alcanza su textura. **Queda:** bicúbico sin medir, y
  sin decidir si el `-r` entra en la receta, porque un elemento nuevo no tiene banner. **M**
- ~~**IMG-46 · El mejor camino con referencia**~~ [A] (usuaria, 2026-11-07): ✅ 2026-11-07. r28-r31, `pautas.md` §15: la
  Final sale de FLUX.2 a 1280x512 y 4 pasos, con el boceto aceptado como `-r`, en ~160 s; conserva el boceto y trae la
  textura que la cadena de FLUX.3 no daba. Sin banner, así que sirve para un elemento nuevo. **Queda:** decidir con la
  usuaria si F1 y F2 salen del diseño; la forma rara sigue dependiendo de F0, y la luz lavada, de la gradación. **M**
- **IMG-37 · F3 Recorte con transparencia** [A] (usuaria, 2026-11-06): guardar el recorte que hoy `montar.sh` deja en un
  temporal, como PNG con alfa, y comparar el recorte por color con `rembg`. La pieza que se combina usa una máscara
  recalculada sobre la Final; el recorte de F3 sirve para aprobarlo antes de gastar la noche. **S**
- **IMG-38 · Variantes desde una fase guardada** [A] (usuaria, 2026-11-06): medir desde qué fase sale cada variante sin
  perder la identidad: macho, hembra y cría; lugar por estación, día y noche; construcción entera, destruida y
  ardiendo. Hipótesis en el diseño, §1.3b. Deja la tabla en `pautas.md`. **Solo con el sí de la usuaria.** **M**

### Bloque B · Prototipo

- **IMG-39 · Prototipo de la pantalla del elemento** [A] (usuaria, 2026-11-06): maqueta desechable con la skill
  `prototype`, con imágenes ya generadas y sin motor, para que la usuaria pruebe avanzar, regenerar, atrás, variantes y
  ★ antes de construirlo. **S**

### Bloque C · Motor e interfaz base

- **IMG-40 · Motor por fases y registro del elemento** [A] (usuaria, 2026-11-06): una orden por fase que recibe el
  prompt y la imagen aceptada (hoy `planos.sh` corre la cadena de punta a punta), y `camino.json` por elemento con
  variantes, fases aceptadas, prompt, semilla y origen. Al avanzar se borra la imagen de los intentos no aceptados y
  quedan su prompt y su semilla. Sustituye a la entrega E1 y a `IMG-10`. **L**
- **IMG-41 · Base de interfaz con lo rescatado de GVIG** [A] (usuaria, 2026-11-06): test de navegador sin Playwright,
  API con simulador `?mock=1`, cola, atajos, trampa de foco y chip de medida de `galivelop-image-generator`, adaptados a
  la hoja de estilos de Tarkor, sobre `servidor.py` e `index.html`. Se copia aquí y se conserva su licencia MIT; ese repo
  no se toca. **M**

### Bloque D · Pantalla del elemento

- **IMG-42 · Variantes y biblioteca ★** [A] (usuaria, 2026-11-06): «crear variante desde aquí» en cualquier fase
  guardada, con el prompt editable; varias imágenes ★ por elemento; biblioteca filtrable de todo lo marcado. Marcar es
  distinto de publicar. Depende de `IMG-25` e `IMG-38`. **M**

### Bloque E · Combinar

- **IMG-43 · Montaje de varias capas y armonización protegida** [A] (usuaria, 2026-11-06): generalizar `montar.sh`, que
  hoy admite un fondo, un sujeto y copias de ese sujeto, a piezas distintas con posición, tamaño y volteo; luz coherente
  entre ellas; y comprobar si `--mask` protege las piezas aprobadas al armonizar. **M**

### Bloque H · Sin GPT

Propuesta aceptada por la usuaria (2026-11-07): no depender de ChatGPT. La referencia ajena aporta poco (`pautas.md` E3),
así que el estilo pasa a un LoRA y la forma sale del boceto propio. Solo lo marcado ★ entra en la biblioteca; los banners
GPT quedan como canon fijo para medir la deriva.

- **IMG-47 · Catálogo regenerado en FLUX** [A] (usuaria, 2026-11-07): cada banner GPT, como su propio `-r`, con FLUX.2 a
  1280x512 (~3,7 min, r28). Primero unos 20 de dos tipos; las ~210, en tandas de noche, solo si la prueba sale bien. La
  usuaria marca ★ las que valen. **M**
- **IMG-48 · LoRA de estilo para FLUX.2** [A] (usuaria, 2026-11-07): ver si se puede entrenar como `wmf-estilo` (Kaggle,
  `lora-kaggle.md`) y entrenarlo con lo ★ de `IMG-47`. **M**
- **IMG-49 · Elemento nuevo sin GPT** [A] (usuaria, 2026-11-07): boceto propio + LoRA de `IMG-48` + Final directa;
  comparar con un elemento que no tenga banner. Lo ★ nuevo entra en la biblioteca y en el siguiente LoRA. **M**

### Bloque F · Producción

- **IMG-44 · Tanda de noche** [A] (usuaria, 2026-11-06): `tanda.sh` con las Final en cola, regla de memoria con pregunta,
  tope de hora, gradar y medir al terminar y revisión por la mañana, para aceptar o volver a una fase. Entrega E3. **M**
- **IMG-45 · Publicar en el juego** [A] (usuaria, 2026-11-06): copia de las referencias de GPT a `referencias/images/`
  antes de nada, y Publicar/Despublicar con una imagen ★. Entrega E5. **S**

## Fase I-A · Escenas compuestas con elementos ya generados (reescrita: bloques C y E)

Una imagen compuesta (un mapa, una llanura, una escena) nombra otros elementos del catálogo: «una llanura donde se
ven múrgoles y cuernahojas». Hoy el prompt los describe con palabras y el modelo los inventa de nuevo, distintos de
sus propias imágenes. Las imágenes por elemento ya viven en `image-generator/generated/<categoria>/<slug>/` y la
elegida en `generated/<categoria>/<slug>/<slug>-<perfil>.png` (`CFG-43`).

- **IMG-1 · Combinar: colocar piezas marcadas sobre un fondo marcado** [A] (usuaria, 2026-10-24; reescrita el
  2026-11-06): pantalla con la biblioteca de imágenes ★: se elige un fondo y sus piezas, y se coloca cada una (tamaño,
  posición, volteo, orden). Base: el editor de cajas de GVIG (`layout-editor.js`) con la hoja de estilos de Tarkor.
  Sustituye a pasar referencias `-r`, que hacía al modelo reinventar el elemento. Depende de `IMG-25` e `IMG-43`. **M**
- **IMG-2 · Una escena avisa de las piezas que le faltan** [A] (usuaria, 2026-10-24; reescrita el 2026-11-06): si una
  escena nombra un elemento del catálogo sin imagen ★, la pantalla de combinar lo lista con un enlace para crearlo.
  Avisa, no bloquea: se puede combinar con lo que ya haya. Depende de `IMG-1`. **S**
- **IMG-3 · Medir el generador con `/gw-opt-ai`** [P] (usuaria, 2026-10-24): un script que resume
  `generated/*/*/registro.tsv` y los logs (segundos, perfil, pasos, con o sin referencia, memoria libre mínima) para
  que `/gw-opt-ai` compare y proponga ajustes con números, sin leer los logs enteros. **S**
  Entra en el bloque C: el registro incluye la fase y si el intento se aceptó (`IMG-40`).

## Fase I-B · Datos visuales, panel de lore y generador moderno

Pedido por la usuaria el 2026-10-25, con su [plan](plan-imagenes/plan.md) (decisiones D1-D10 tomadas ese día). Las
imágenes tienen que salir con el toque del mundo **sin imagen de referencia**: lo dan los datos visuales de cada
elemento y un prompt montado desde ellos. `seed-catalog` y `reindex-lore` borran y reinsertan: nada que se edite
desde el panel vive en tablas que siembran.

- ~~**IMG-4 · Guía visual del mundo y plantilla de prompt**~~ [A] (usuaria, 2026-10-25): desde
  `plan-imagenes/borradores/`, con lo marcado «[propuesta]» pendiente de la usuaria. Fase 1 del plan. **S** ✅ 2026-11-03:
  aprobada por la usuaria. Las reglas de la plantilla ya las aplica `prompt_ficha.py` desde `IMG-5`, y los rasgos
  inferidos que usan las fichas se dan por buenos: flor del Cardo Brújula gris metálico con matiz morado (opción A,
  solo imagen; el catálogo no se toca), hembra del aullador a medio muslo de orco, hocico alargado del aullador y
  hocico gris plata de Hulki.
- ~~**IMG-5 · Script que monta el prompt desde la ficha**~~ ✅ 2026-10-25: `image-generator/scripts/prompt_ficha.py` (bloques B1-B9, variantes, `--fondo`, recorte por longitud, rechazo de vetadas, negaciones y nombre propio) y `tools/qa/tests/test_prompt_ficha.py` (40 tests). Pendiente: que lea `FichaVisual` (`IMG-9`). [A] (usuaria, 2026-10-25): determinista, sin LLM, con tests;
  rechaza las palabras que el modelo malinterpreta («moon», «crystal dust across the heavens», «scars»…). Depende de
  `IMG-4`. **M**
- **IMG-6 · Las 5 fichas piloto con semilla fija** [A] (usuaria, 2026-10-25): aullador macho y hembra, Cardo Brújula,
  Pastos de la Deriva y Hulki, sin `-r`; el aullador además en segunda pasada sobre su zona (`-r` de la zona). Las
  aprueba la usuaria. Depende de `IMG-5`. **S** 🚧 en curso: generadas el 2026-10-25 con `pilotos.sh 3 6` (semilla 3, 6 pasos, ~4,7 min cada una) en `image-generator/generated/<tipo>/<slug>/intentos/banner-s3-p6-20261025-14*.png` (sin subir). Primera lectura: Pastos y la segunda pasada del aullador sobre la zona, bien; las vetas minerales del aullador salen como cortes rosados; macho y hembra casi iguales; Hulki, simio de pelo blanco con barba; la fibra del Cardo, una aguja. Segunda tanda (fichas retocadas, `banner-s3-p6-20261025-15*.png`): Hulki ya lleva hocico largo, piel de hojas en los hombros y bosque cerrado, aunque con algo de barba; el Cardo tiene escala (grano de arena de hierro) y la fibra es un pelo; los picos de Pastos salen dentados y oscuros; el aullador sigue con motas rojas que parecen gotas, y la hembra apenas se distingue del macho; los Cuernahoja siguen pareciendo antílopes. Falta el veredicto de la usuaria. **2026-11-03 (usuaria):** esos pilotos son de antes de la cadena fotorreal y del LoRA; se rehacen los 5 con la cadena de hoy (`PERFIL=fotorreal`, LoRA de estilo) en una tanda de noche cuando `claude/plan-imagenes` esté en `main`, y el veredicto se da sobre esos.
  **2026-11-06 (usuaria):** pasa a ser la prueba real del flujo por fases: los 5 pilotos recorren las fases en la
  pantalla de `IMG-25`, en vez de salir de una tanda de noche directa. Depende de `IMG-25`.
- ~~**IMG-14 · Momento del día y estación como condiciones**~~ ✅ 2026-10-25: `prompt_ficha.py` con `--momento`, `--estacion`, `condiciones` en la ficha y regla 9 de coherencia (69 tests); luces y estaciones por región en `mundo.json`, marcadas [propuesta]. Pendiente: que la usuaria apruebe esos textos y generar las 5 condiciones de cada zona (`IMG-12`). [A] (usuaria, 2026-10-25): `--momento dia|atardecer|noche`
  y `--estacion primavera|verano|otono|invierno`, aparte de las variantes del sujeto (macho, hembra). `mundo.json`
  da a cada región una luz por momento y un paisaje por estación (de `docs/rpgtarkor/lore-mundo/estaciones.md`); la
  ficha de zona añade `condiciones` con lo que cambia en cada una; el script rechaza una luz o un paisaje que no case
  con el momento pedido. Por zona se aprueban la de día de cada estación y una de noche (5 imágenes), y lo nativo se
  pinta sobre la de su misma condición (`IMG-12`). Depende de `IMG-5`. **M**
- ~~**IMG-15 · Calidad del generador local frente a ChatGPT**~~ ✅ 2026-11-02, con `IMG-23` [A] (usuaria, 2026-10-25: «la calidad comparado con lo
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
- ~~**IMG-17 · Gradación y medida en ffmpeg**~~ ✅ 2026-10-26 [A] ([plan](plan-imagenes/plan-fotorreal.md#img-17--gradación-y-medida-en-ffmpeg-calibradas-contra-los-banners-de-gpt-p--s)):
  `gradar.sh` (con `--hornear`), `medir.sh`, `medir/` (`stats.sh`, `emd.py`, `rejilla.sh`), `estilo/gradacion.json`
  y `test_gradar.py` (8). Calibración: atardecer (EMD Cb/Cr 5,1/6,4) y día (5,7/4,7) pasan sin alejar los GPT de
  control; las ventanas de YAVG/SATAVG de día y noche salen de sus referencias. La usuaria dio el sí a los tres tintes;
  LUT horneadas en `estilo/lut/` (36³, ~1 MB cada una; a 43 dB de PSNR de la orden de curvas). **Pendiente:** validar
  la noche con la primera imagen nocturna (`IMG-23`). **S**
- ~~**IMG-18 · Bocetos SVG de forma**~~ ✅ 2026-10-26 [A] ([plan](plan-imagenes/plan-fotorreal.md#img-18--bocetos-svg-de-forma-revisados-por-la-usuaria-p--s)):
  `bocetos/depredador.svg` y `herbivoro.svg` (vuelta 1 de 2, con el sí de la usuaria), `bocetos/rasterizar.sh`
  (1280, 1024x384 y 640; los PNG no se versionan), campo `boceto` en aullador y cuernahoja, `test_bocetos.py` (4);
  `rsvg-convert` corre dentro de `host.sh` (2.62.3). El lomo del herbívoro queda al ~48 % de la altura (el plan decía
  55-60 %); se mira en los borradores de `IMG-19`. **S**
- ~~**IMG-19 · Tanda de borradores**~~ ✅ 2026-10-26 [A] (2026-10-26, [plan](plan-imagenes/plan-fotorreal.md#img-19--tanda-de-borradores-método-bocetos-planos-y-armonización-p--m)):
  640x256 a 8 pasos; valida el borrador, la fuerza del boceto y la armonización del montaje (`-i` frente a `-r`).
  Depende de `IMG-16`…`IMG-18`. **M** ✅ 2026-10-26: **19a ✅** el borrador de 640x256 / 8 pasos (9 min) anticipa la
  composición del de 1280x512 / 16 (49,5 min) y `--preview proj` se lee desde el paso 2 ([resultados r14](plan-imagenes/banco/resultados.md));
  `planos.sh` armoniza con `strength_as_noise_level`. **19b ✅** el boceto manda a 0,95-0,97 (por debajo sale plano
  como el SVG); tres cuartos no, porque los bocetos tienen la cabeza de perfil. **19c ✅** la cadena de planos en borrador cuesta
  ~25 min; `montar.sh` recorta por dominancia del verde (FLUX.3 no pinta verde croma) y la armonización gana con
  `-i` a 0,5 (72 s, menor EMD, silueta intacta); `-r` arranca pero tarda ×9 y vira a azul desaturado. Lo que quedaba
  de la usuaria se decidió con guías de diseño y los banners GPT (2026-10-27): cuerpo de perfil y cabeza a tres
  cuartos (bocetos v2) y cuernos color hueso a 0,95.
- ~~**IMG-20 · Codificador de texto Q8 (opcional)**~~ ❌ descartada (usuaria, 2026-11-06) [A] (2026-10-26): A/B con la misma semilla tras `IMG-23`, con
  permiso para descargar 4,3 GB. **S**
- ~~**IMG-21 · Pautas con la fauna**~~ ✅ 2026-10-27 [A] (2026-10-26; reorientada por la usuaria el 2026-10-27: «el objetivo es juntar
  pautas y estándares para que mediante prompt seamos capaces de conseguir los resultados más cercanos a las imágenes
  de ref… no que estemos enfrascados en sacar imágenes ya finales»): borradores baratos en 6-8 especies con banner de
  planes corporales distintos, con prompts escritos por un agente desde [`pautas.md`](plan-imagenes/pautas.md) sin
  retoque a mano, y nota de forma y EMD junto al banner; cada fallo repetido, una pauta o un aviso de
  `prompt_ficha.py` ([plan](plan-imagenes/plan-fotorreal.md#img-21--pautas-con-la-fauna-a--m)). **M** 🚧 2026-10-27:
  aullador y cuernahoja en borrador (bocetos v2, sujetos v3 cotejados con GPT) y primera versión de `pautas.md`;
  r15, 8 planes corporales con prompts de un agente: solo el ave corredora se lee como su banner; pautas nuevas
  F6b-F9 (ancla por silueta, partes y materiales sin comparar, sin cuentas) y P6-P8 (fondo magenta para lo verde,
  lienzo alto, dirección por volteo) y pose por plan corporal ([resultados](plan-imagenes/banco/resultados.md)).
  r16, los remedios en las seis que fallaron: ninguna se lee como su banner (gargantúa, a medias); funcionan P6
  (magenta y azul) y P7 (lienzo alto); pautas nuevas F6c, F7b, F10 (colores y proporción medidos en el banner) y R1
  (dos semillas). r17, F10 y dos semillas en las seis: guchapo, morvasa y espina se leen como su banner (la vista del
  banner, los grosores medidos y el color sin la luz: F10b, F10c); jusha mejora sin llegar; gargantúa y cruzavientos
  repiten r16 y pasan al boceto por plan (`IMG-24`, R2). r18, solo jusha (R2): con la cabeza medida y un ancla de
  cabeza roma se lee como su banner (la s7, con la dorsal del ancla). **Cerrada con cuatro de seis** (R3);
  `pautas.md` v4 es la entrega. Queda fuera del banco: gargantúa y cruzavientos (`IMG-24`) y el acabado de las
  cuatro (`IMG-25`, receta final).
- ~~**IMG-22 · Pautas con flora, lugar, objeto y raza**~~ ✅ 2026-11-02 [A] (2026-10-26, reorientada el 2026-10-27): dos
  elementos por tipo (cardo brújula y salvia del polvo; Pastos de la Deriva y Cataratas de la Madre Fango; cuchillo de hielo
  sílice y odre; orco de las Llanuras y faerus del Margen) medidos en su banner, prompts y razonamiento en
  [`banco/r20-tipos.md`](plan-imagenes/banco/r20-tipos.md). Ronda r20 (640x256): **seis de ocho se leen como su banner**
  a la primera, con el mismo veredicto en las semillas 3 y 7 (R1); salvia y faerus, a medias solo por la luz. r20b mostró
  que quitar la luz de la línea `Style` no la cambia: el modelo pinta la escena luminosa por defecto (T1). Veredicto en
  [`resultados.md`](plan-imagenes/banco/resultados.md) (r20, r20b y semilla 7) y `pautas.md` v5.1 con las secciones
  7-11 (flora, lugar, objeto, raza, común). Queda, en `IMG-23`: la palanca de la luz fría u oscura (T1) y el acabado
  `porTipo.item` (O6). Las pautas de un solo elemento siguen 🔬. **M**
- ~~**IMG-23 · Perfil `fotorreal` en `generar.sh`, `probar.sh` y `mundo.json`**~~ ✅ 2026-11-02 [A] (2026-10-26; la usuaria da el sí a la receta: oscuridad dicha al principio del prompt, gradación por momento y cadena de planos para el sujeto; lo que falla, en `IMG-27` e `IMG-28`): una orden
  saca el borrador de cualquier ficha con la receta de `pautas.md`, y una sola imagen final a 1280 comprueba que
  escala; docs y tests. También: condiciones `momento:noche` en las
  fichas de fauna (de `IMG-16`) y validar el tinte de noche con la primera imagen nocturna (de `IMG-17`); la palanca de la luz fría u oscura
  (T1 de `pautas.md`, de `IMG-22`) y el acabado `porTipo.item` (O6). Cierra
  `IMG-15`. **M**
  Hecho: condiciones `momento:noche` en las fichas del aullador y el cuernahoja (luz de estrellas y brillo perlado, sin
  sol; `test_prompt_ficha` prueba ya los tres momentos). La gradación de noche sobre r20 acerca el brillo de salvia y
  faerus al banner pero apaga el color. r21 (T1, T5): decir la escena oscura al principio del prompt quita el sol,
  aunque queda más clara que el banner; la clave baja se termina con `gradar.sh`. Perfil en `generar.sh`/`probar.sh`
  (`PERFIL=fotorreal`, `BOCETO`, `MOMENTO`, gradación al final) con `test_generar_perfil.py` (20; rojo sin el perfil).
  `porTipo.item` a 50 mm en `mundo.json`. Cadena de planos: `scripts/planos.sh` (plancha, sujeto con boceto, montaje,
  armonización a 0.5 y 0.7) y `PLANOS=<dir>` en `probar.sh` fotorreal; `montar.sh` pasa a `scripts/`. **Noche
  validada** (`MOMENTO=noche probar.sh fauna aullador-rojo fotorreal`, 526 s): cruda, cielo estrellado pero suelo
  iluminado como de día (T1); gradada, frente a los banners de noche de GPT la mediana EMD pasa de Y 35,8 / Cb 10,6 /
  Cr 11,4 a 8,3 / 4,4 / 5,8, y las púas rojas se leen aunque el color baje (SATAVG 4,7, T5). **Planos con el boceto
  de la ficha** (`PLANOS=` con los prompts de r14, aullador, 886 s): la cadena va de punta a punta; el sujeto toma el
  cuerpo de cinta del boceto, más cerca del banner que la imagen sola. Las armonías gradadas a atardecer dan mediana
  EMD Y 13,4 / 11,7 (0.5 / 0.7); la de 0.7 integra mejor el recorte. Fallo: con las posiciones de r14 el héroe ocupa
  ~80 % del ancho y tapa la manada; `HERO`/`MANADA` tendrían que salir del encuadre de la ficha. **Imagen final**
  (`FINAL=1 probar.sh fauna aullador-rojo fotorreal`, 1280x512, 16 pasos): 2944 s (49 min) con 5,8 GB libres como
  mínimo; escala sin defectos, manada y humo de fondo, mira a la izquierda como pide la ficha; gradada a atardecer,
  mediana EMD Y 22,2 / Cb 6,3 / Cr 8,0. Fallan el disco del sol en cuadro (L3) y el cuerpo: patas largas de zorro, no
  la cinta baja del banner, que sí da la cadena de planos. Falta: el sí de la usuaria a la receta.
- ~~**IMG-24 · Plantillas de boceto por plan corporal**~~ ✅ 2026-10-27 [P] (2026-10-27): seis planes paramétricos
  (depredador, herbívoro, reptil, ave, alargado, artrópodo) en `image-generator/bocetos/plantilla.py`, sin
  dependencias: la ficha pasa de `boceto.archivo` a `boceto.plan` y sus números (largo, patas, cuello, cola, cresta,
  cuernos, color…), todo relativo a la unidad del plan y escalado al lienzo; cuerpo de perfil y cabeza a tres cuartos
  (P1), las cuentas en el boceto (F9), un valor fuera de rango para con el motivo. `rasterizar.sh` genera desde las
  fichas; fuera los SVG a mano de `IMG-18`. Fichas nuevas de gargantúa de ceniza y cruzavientos con su plan (las que
  `IMG-21` dejó aquí). `test_bocetos.py` (12). Depende de `IMG-18`; la usa `IMG-21`. **M** r19 (gargantúa y cruzavientos con
  su boceto, [`resultados.md`](plan-imagenes/banco/resultados.md)): el gargantúa pasa a leerse como su banner con el
  mismo prompt de r17; el cruzavientos no cambia (lo que le falta es acabado, `IMG-25`). Cinco de seis.
- ~~**IMG-27 · Encuadre del sujeto en la cadena de planos desde la ficha**~~ ✅ 2026-11-02 [A] (usuaria, 2026-11-02, de `IMG-23`):
  `HERO` y `MANADA` de `montar.sh` salen del encuadre de la ficha (tamaño y lado del sujeto, número y distancia de la
  manada) y escalan con el ancho, en vez de las posiciones fijas de r14, con las que el aullador ocupa ~80 % del ancho
  y tapa la manada. Tests en `test_generar_perfil.py` y un borrador del aullador para comprobarlo. **S** Hecho:
  campo `encuadre` de la ficha (horizonte; lado, ancho y pie del sujeto; número, distancia y volteo de la manada, en
  fracciones del lienzo) y `scripts/encuadre.py`, que lo pasa a `HERO`/`MANADA` con perspectiva de suelo plano (cada
  copia mide, respecto al sujeto, lo que su pie dista del horizonte; menguan de una en una, F9, y la mayor va al lado
  libre). `planos.sh` lo usa con la `FICHA` que le pasa `probar.sh` (sin ficha, el encuadre por defecto; dado a mano,
  manda); fuera las posiciones fijas de r14; `MANADA=` vacía en `montar.sh` es sin manada. Tests: `test_encuadre.py`
  (12) y cuatro en `test_generar_perfil.py`. Borrador: el aullador con su encuadre (izquierda, 0,62 del ancho, seis
  copias a media distancia) sobre la plancha y el sujeto de `planos-20261102-010503`, solo `montar.sh`
  (`generated/fauna/aullador-rojo/encuadre-img27.png`, no versionado): la manada se ve entera, menguando hacia el sujeto.
  Queda de `IMG-25`/`IMG-32`: el sujeto que sale del modelo es alto y agazapado, no la cinta larga del banner.
- ~~**IMG-28 · El sol fuera de cuadro**~~ ✅ 2026-11-02 [A] (usuaria, 2026-11-02, de `IMG-23`): L3 de `pautas.md` (dirección ✅, sin
  disco 🔬): el modelo pinta el disco del sol aunque la ficha lo ponga fuera de cuadro (pastos, cardo y la final del
  aullador). Ronda del banco con palancas (no nombrar el sol, cielo sin fuente, recorte del cielo en el montaje) y lo
  que gane, a las fichas o a `prompt_ficha.py`. **S** 🚧 2026-11-02: ronda r22 preparada
  ([`r22-sol.tsv`](plan-imagenes/banco/r22-sol.tsv)): pastos y cardo de r20 con (a) la luz por dirección sin nombrar
  el sol y (b) además el cielo como degradado sin fuente. Resultado: sin la palabra *sun* no hay disco y la luz llega del
  mismo lado; (b) no añade (L3 ✅ en `pautas.md`). Fichas, banner a banner: sin *sun* la `luz` de pastos (verano) y
  cuernahoja (sin disco en el banner) y la de hulki (sin banner; la copa tapa el cielo). Se quedan con el sol aullador,
  gargantúa y cruzavientos, cuyo banner enseña el disco, y el `momento:atardecer` de pastos, que lo pide a propósito
  (sin banner con el que comparar). Tests de fichas y prompt (152) en verde.
- ~~**IMG-29 · Scout: condicionar con los banners del juego (LoRA y referencia)**~~ ✅ 2026-11-02 [A] (usuaria, 2026-11-02; [`investigacion-lora-2.md`](plan-imagenes/investigacion-lora-2.md): `sd.cpp` carga LoRAs diffusers de FLUX.3 desde `bb6a0cc` (25-10, nuestro `sd-cli` es anterior); entrenar en Kaggle es viable pero sin cifras de nadie en 16 GB; sin modo que fije el sujeto, solo `pass_to_vlm=true` por medir. Recomienda LoRA en GPU gratis con puerta: paso 0 en la Deck (recompilar, LoRA sobre Q8_0, `pass_to_vlm`), paso 1 arranque en Kaggle, paso 2 entrenar; decisión de la usuaria pendiente): tras
  `IMG-23`, lo que más se aleja de ChatGPT es la criatura en sí y el acabado (usuaria), y el prompt está cerca de su
  techo. Investigación corta sobre lo que `investigacion-lora.md` dejó bloqueado: (1) si `sd.cpp` carga ya LoRAs de
  FLUX.3 Image Klein; (2) el camino gratis para entrenar un LoRA de estilo con los ~135 banners (Kaggle, Colab
  gratuito, ZeroGPU: trainer, VRAM, horas, formato que cargue `sd.cpp`); (3) generar la misma criatura del banner en
  otra escena (edición con referencia de FLUX.3 Klein, adaptadores de imagen en `sd.cpp`). GPU gratis sí, pagar no
  (usuaria, 2026-11-02). Sale con una recomendación: LoRA, referencia, o seguir con planos. **S**
- ~~**IMG-30 · Paso 0 del LoRA: `sd.cpp` con LoRAs de FLUX.3 en la Deck**~~ ✅ 2026-11-02 [A] (usuaria, 2026-11-02, de `IMG-29`):
  recompilar `sd-cli` a un commit ≥ `bb6a0cc` (hoy `95ff762`), comprobar que un LoRA diffusers de FLUX.3 Klein
  (`akhaliq/flux-3-image-klein-angles-lora`) se aplica sobre `flux3-image-klein-Q8_0.gguf` en CPU («516/516» con
  `-r`), y medir `--ref-image-args pass_to_vlm=true` con un banner como referencia (¿fija la criatura?). Sin horas de
  la usuaria. Si sale, siguen los pasos 1 y 2 de `investigacion-lora-2.md` (Kaggle); si no, `IMG-27`. **S**
  Hecho (2026-11-02): sin compilar, la release `master-1039-290148d` (trae `bb6a0cc`) en `image-generator/bin-nuevo/`.
  El LoRA se aplica en CPU sobre Q8_0 (`at_runtime`): 456/516 tensores en texto a imagen y **516/516 con `-r`**
  (búfer 316→772 y 359→875), y cambia la imagen como debe (misma semilla). `-r` con el banner del aullador ya acerca la
  criatura (cuerpo largo y bajo, cola anillada, cresta, tono rojo); sin púas ni colmillos. 512 px a 4 pasos: 4-5 min,
  9 min con `-r`. **`-r` sola en otra escena** (amanecer frío, roca gris) conserva la criatura del banner: cuerpo, cola
  anillada, cresta, colmillos. **`pass_to_vlm=true` no cambia nada** (sin tokens de visión en el log: pediría el `mmproj`
  de Qwen3VL). Imágenes y logs en `generated/banco/img30/`. Queda abierto: la referencia solo existe para lo que ya tiene
  banner; para una criatura nueva habría que probar un banner de otra como referencia de acabado.
- ~~**IMG-31 · Banner ajeno como referencia de acabado**~~ ✅ 2026-11-02 [A] (usuaria, 2026-11-02, de `IMG-30`): con `-r`,
  el banner GPT de **otra** criatura (cuernahoja) y el prompt de la ficha del aullador, a 640×256 y 8 pasos, frente al
  mismo prompt sin referencia; también con «la referencia solo para el acabado» delante. Se mira si trae el acabado
  sin arrastrar su criatura (EMD con `medir.sh` y a ojo contra el banner del aullador). Si sale, la referencia de
  acabado entra en la receta y el LoRA de Kaggle pasa a ser opcional; si arrastra la criatura, Kaggle o `IMG-27`. Solo
  horas de la Deck. **S** Prueba 1 (2026-11-02): **no arrastra la cuernahoja** (ni cuello ni cuernos) y da más atmósfera
  y profundidad (polvo, montes velados, manada difusa); EMD 21.3 → 18.6 (20.0 con la instrucción de acabado). **No arregla
  la criatura** (patas largas en las tres) y cuesta +60 % (508 → 810 s). Prueba 2: en la armonización de planos (0.5 y
  0.7) `-r` ajeno casi no cambia nada (EMD 15.7/15.3 → 15.8/14.9). **Veredicto:** la referencia ajena no da el acabado
  GPT ni la criatura; no entra en la receta. Para criaturas nuevas, la palanca que queda es el LoRA de estilo (pasos 1 y 2
  de `investigacion-lora-2.md`). Pruebas en `generated/banco/img31/`.
- ~~**IMG-32 · LoRA de estilo en Kaggle**~~ ✅ 2026-11-03 [A] (usuaria, 2026-11-02, de `IMG-31`; pasos 1 y 2 de
  [`investigacion-lora-2.md`](plan-imagenes/investigacion-lora-2.md)): conjunto de los 134 banners GPT a
  1280×512 (`image-generator/lora/conjunto.sh`), cuaderno de Kaggle que pone los textos con un modelo de visión y entrena
  el LoRA con diffusers sobre el Klein base (arranque de 20 pasos y luego 1000-2000 con guardados), y prueba del LoRA en
  la Deck sobre el Q8_0. La usuaria: cuenta de Kaggle, subir el zip, lanzar y bajar el LoRA. Puerta: si no cabe en 16 GB,
  se cae sin gasto y se sigue con `IMG-27`. **M**
  Hecho (2026-11-02): conjunto (134 banners, zip de 191 MB), cuaderno `image-generator/lora/entrenar.ipynb` (argumentos
  comprobados contra el script de diffusers 0.42.1) y guía [`lora-kaggle.md`](plan-imagenes/lora-kaggle.md). Dos
  arranques en Kaggle: cabe en la T4 a 6,6 s/paso, pero el transformer en fp16 da pérdida `nan` (latentes y textos
  sanos); con el transformer en fp32 sigue `nan` (7 s/paso), así que no es desbordamiento: el diagnóstico por capas da
  `context_embedder` en nf4 (entrada sana); sin cuantizar sigue `nan`, porque `accelerator.prepare()` envuelve el
  transformer en autocast fp16 y todo corría en fp16; el cuaderno quita ese envoltorio. Sexto arranque (fp32 de
  verdad): sin `nan` (pérdida 0,66-0,88), sin falta de memoria, ~30 s/paso, LoRA de 161 MB; el entrenamiento baja a
  1000 pasos (~8,5 h) para caber en una sesión. Entrenamiento (2026-11-02/03): 1000/1000 pasos en 9 h 32 min, sin
  `nan` (pérdida ~0,5-1,2, picos sueltos de hasta 2,75), LoRA de 161 MB (rank 16) en `image-generator/loras/wmf-estilo.safetensors`
  (fuera del repo). Prueba en la Deck, tanda 1 (2026-11-03; `generated/banco/img32/`, 640×256, 8 pasos, semilla 42,
  peso 1): se aplica en CPU sobre Q8_0 (456/516 tensores, como el de `IMG-30`) y cuesta +7-8 % (508 → 546 s). **Aullador**
  (está en el conjunto): mucho más cerca del banner GPT, con neblina roja densa, remolinos de polvo y una manada con cresta. EMD Y
  21.3 → **13.8**. Las patas siguen largas. **Criatura nueva** (inventada, valle gris con niebla): casi igual que sin LoRA,
  EMD 13.9 → 14.0. Tanda 2, la criatura nueva a peso 1.5 y 2: más niebla y detalle, y las antenas salen plumosas
  como pide el prompt. EMD 12.9 y 12.7. Aparecen fallos: filamentos colgando de la boca y, a peso 2, patas finas de
  más. Tanda 3, criatura nueva en escena cálida como los banners (pradera dorada al atardecer): EMD Y 47.2 → **30.7**
  (peso 1) y 29.6 (1.5). A ojo, luz y neblina más de banner, la vela de púas como pide el prompt y mesetas al fondo;
  las bandas del pelaje salen como correas, más marcadas a 1.5. **Veredicto (2026-11-03, la usuaria lo deja en manos
  de Claude):** el LoRA sirve para criaturas nuevas en escenas como las del juego. Entra en el perfil fotorreal a
  **peso 1**: 1.5 apenas mejora y trae más fallos. No arregla la forma de la criatura. Integración en `IMG-33`.
- ~~**IMG-33 · El LoRA de estilo en el perfil fotorreal**~~ [A] (de `IMG-32`, 2026-11-03): `PERFIL=fotorreal` pasa a
  `bin-nuevo/sd-cli` (release `master-1039`, la que aplica LoRAs de FLUX.3) con `--lora-model-dir image-generator/loras`,
  y el prompt de la ficha lleva `wmfstyle` delante y `<lora:wmf-estilo:1>` detrás; `LORA=0` lo quita y sin el
  archivo avisa y sigue sin él. Tests de `generar.sh`/`prompt_ficha.py` con el `sd-cli` falso; después, una imagen
  del montaje con planos para ver que el binario nuevo no rompe la cadena. **S** ✅ 2026-11-03: hecho en
  `generar.sh` (por ahí pasan ficha, `PROMPT_ARCHIVO` y planos), 5 tests en `test_generar_perfil.py` (`LoraDeEstilo`), README.
  Prueba real (`probar.sh fauna aullador-rojo fotorreal 42`): carga `bin-nuevo`, aplica el LoRA y grada; 563 s, mínimo
  5,4 GB libres. La cadena de planos no se corrió entera: su img2img con `bin-nuevo` ya se probó en `IMG-31`.
- ~~**IMG-34 · F1 Forma: fuerza que respeta el boceto** [A] (usuaria, 2026-11-03, de `IMG-6`; bloque A desde el
  2026-11-06)~~ ✅ 2026-11-06: r24 y r25, 16 imágenes. Fuerza de F1: 0,88 con 8 pasos a 640x240, ~5 min, confirmada en
  cuatro tipos y dos semillas (`pautas.md` §13). La fuerza es el sigma de arranque, leído en sd.cpp. F1 da acabado, no
  forma. **Pendiente:** el cuerpo de cinta del aullador no sale en ninguna prueba; lo más cercano es F0 con FLUX.3. Sin medir:
  `-r` y más semillas. El repaso a 0,40 pasa a `IMG-36`. **M**
- **IMG-25 · Pantalla del elemento: avanzar, regenerar, atrás** [A] (usuaria, 2026-10-27; reescrita el 2026-11-06):
  se abre un elemento, se escribe o edita el prompt (la ficha lo propone si existe) y cada fase enseña su imagen junto
  a la referencia y a la fase anterior. **Avanzar** acepta y guarda; **Regenerar** repite la fase con el prompt editado
  (si no cambia, con otra semilla); **Atrás** reabre la fase anterior. Renombrar, ver los pasos de cada imagen, borrar
  lo guardado y marcar ★. Sustituye a las entregas E2 y E2b. Depende de `IMG-39`, `IMG-40` e `IMG-41`. **L** Diseño:
  [`diseno-interfaz-continua.md`](plan-imagenes/diseno-interfaz-continua.md). Se conservan Publicar/Despublicar (`IMG-45`).
- **IMG-26 · Conocimiento compartido con GVIG y variante para juegos** [A] (usuaria, 2026-10-27; reescrita el
  2026-11-06): WMF Tarkor y `galivelop-image-generator` son dos productos con procesos distintos (fases y bocetos
  frente a rondas y montaje) y no se migra uno al otro. Se intercambian diseño, interfaz, procesos y lo aprendido, sin
  llevar la receta tal cual. Sigue abierta la variante para juegos sin relación con Tarkor; su forma se decide al llegar
  aquí. Nada se modifica en ese repo desde este. **L**
- **IMG-9 · Fichas visuales en bloque** [A] (usuaria, 2026-10-25): un LLM rellena borradores de ficha desde el canon
  (53 de fauna primero), que proponen el prompt inicial de F0 en la pantalla de `IMG-25`. Siguen en JSON
  (`image-generator/fichas/`): deja de depender de `IMG-8` (2026-11-06). **L**
  🚧 2026-11-03 (usuaria: «una descripción lo más completa posible» de cada elemento, guiada por su banner): piloto de
  10 fichas desde los banners del juego (Hulki desde el de las Faerus del Margen, Cardo, Múrgol, Corredor de Cauce,
  Orcos de las Llanuras, Goirntes de la Meseta, Manaderos, Agujas Imán, cuchillo de hielo sílice, choza orca); el canon
  manda salvo en lo visual que no describe, y los choques van en `propuestas`. Falta: el visto bueno de la usuaria, las
  ~125 con banner que quedan y luego las demás por tipo; `porTipo` de `raza`/`construccion` en `estilo/mundo.json`.
- ~~**IMG-10 · Estados por intento y papelera**~~ ❌ sustituida por `IMG-40` (usuaria, 2026-11-06) [A] (usuaria, 2026-10-25): favorita, candidata, descartada (y
  aprobada, que hereda de `elegidas.tsv`) en `estados.json` por elemento; las descartadas se pueden borrar
  (papelera como carpeta). D7. Fase 5. **M**
- **IMG-11 · Cola con tiempo estimado y bandeja de decisiones** [A] (usuaria, 2026-10-25; reescrita el 2026-11-06):
  una generación a la vez, con tiempo estimado, vista previa y cancelar; una bandeja con las fases que esperan tu
  decisión, para trabajar en varios elementos mientras otro genera. Depende de `IMG-40`. **M**
- ~~**IMG-12 · Zona aprobada como fondo de lo nativo**~~ ❌ sustituida (usuaria, 2026-11-06: cada elemento se crea suelto, sin bloqueo por zona; una zona ★ se usa como fondo en `IMG-1`) [A] (usuaria, 2026-10-25): primero se generan las zonas; la
  fauna, flora y demás elementos nativos de una zona sin imagen aprobada quedan bloqueados, y con zona aprobada se
  genera en segunda pasada con la zona como `-r` (una por pasada en la Deck, D10). Generaliza `IMG-1` e `IMG-2`.
  Fase 5. **M**
- ~~**IMG-13 · Interfaz del generador en el admin**~~ ❌ descartada (usuaria, 2026-11-06: se queda la interfaz local) [A] (usuaria, 2026-10-25): pestaña Generador del prototipo en el
  admin React (`servidor.py` pasa a API, D6), con ideas de Leonardo y similares: galería, vista ampliada, revisión
  rápida con teclado y filtros. Hecho cuando se revisan 20 intentos solo con teclado. Fase 6. **L**
