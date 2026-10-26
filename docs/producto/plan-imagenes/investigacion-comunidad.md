# Investigación: qué hace la comunidad con estos mismos problemas (FLUX Klein, sd.cpp, composición)

Fecha: 2026-10-26. Encargo: ver cómo resuelve hoy la comunidad (Reddit, GitHub de sd.cpp y ComfyUI, workflows, blogs) los
problemas del banner con criatura: fondo que se degrada, composición sujeto + fondo, panorámicas, manadas y Klein en
hardware modesto. **No se lanzó ninguna generación ni se tocó otro archivo.** Lo ya investigado (técnicas de diseño, motor,
LoRA, prompts de criaturas, control de forma) no se repite; se cita solo para enlazar.

**Convención de fuentes.**
- `[P]` = documentación o ficha primaria (BFL, sd.cpp, ComfyUI).
- `[N]` = medida con números publicados por quien la hizo (indico dónde y con qué hardware).
- `[A]` = anécdota u opinión de un usuario; sin comparación ni imágenes que yo pudiera comprobar.
- `[E]` = estimación nuestra, a medir en la Deck.
- No pude **ver las imágenes** de ningún hilo: «demostrado» aquí significa «con números o con configuración reproducible»,
  nunca «lo vi».

**Límites de esta búsqueda (importante).**
- Reddit está bloqueado para las herramientas de esta sesión (WebFetch y WebSearch lo rechazan). Lo de Reddit viene de
  **instantáneas en un espejo** (`reddit.sentinel-team.org`) que salieron en las búsquedas: son pocos hilos, de enero a mayo de
  2026, con solo las primeras respuestas. **r/LocalLLaMA no se pudo leer** y no salió nada de r/StableDiffusion por
  buscador. Lo que falte aquí puede estar en esos foros.
- Civitai y OpenArt: solo aparecieron fichas sueltas en búsquedas; no se leyó ningún workflow desde ahí. Los workflows leídos son
  de ComfyUI (plantillas oficiales), RunComfy y Floyo.
- Casi todo lo de la comunidad es de **GPU** (RTX 3060 a 5070 Ti, H100). No hay un solo informe de FLUX.2/3 Klein en CPU ni en
  Steam Deck. Los tiempos no se trasladan.

## 1. Resumen

1. **La comunidad no resuelve «sujeto + fondo en una pasada» con prompts mejores: lo parte en pasos.** Lo habitual con Klein es
   editar por regiones con una **marca de color** (rellenar la zona con rojo o verde, pedir «sustituye la zona roja por X, deja el
   resto igual») y **pegar el resultado en el original con la máscara** (hilo de r/StableDiffusion, §2.1). Eso encaja con
   `--init-img`/`-r` y ffmpeg, sin necesitar `--mask`.
2. **Klein es mejor editando que generando desde cero**, según varios usuarios (hilo de anatomía y hilo de inpaint, §2.1 y §6).
   Un usuario lo resume: «mal modelo t2i, excelente modelo de edición», con el flujo «base con otro modelo, Klein para luz y estilo».
   Es opinión, pero casa con la cadena de planos que ya proponía `investigacion-tecnicas-diseno.md`.
3. **Manadas: nadie cuenta una receta de texto puro con Klein.** Lo que hay es componer en dos pasadas («quita a la protagonista,
   luego añade el grupo sobre el fondo limpio»), la caja de maquetación de BFL (ya recogida en `investigacion-motor.md`) y
   referencias descritas por **quién es cada una**, no por «imagen 1/2» (§4).
4. **Panorámicas:** BFL lista 21:9 (2048x864) como formato de «panoramas»; nuestro 1280x512 (2,5:1, 0,66 MP) no está fuera de lo
   documentado. Los problemas que se citan con formatos anchos son de **suavidad si el prompt no describe planos**, no de
   corrupción. Para ampliar a los lados, las plantillas de la comunidad usan relleno gris + «sustituye el gris» + borde
   difuminado de 50 px, con tope de ~2x de ancho por pasada (§3).
5. **Hallazgo nuevo y barato sobre nuestro montaje:** la ficha de GGUF de AtomicChat mide que el **codificador de texto en
   Q4_K se aleja bastante de la referencia** y recomienda Q8_0. Nuestro banco usa `Qwen3VL-4B-Instruct-Q4_K_M` (ver
   `investigacion-motor.md`, cabecera). Cambiarlo a Q8_0 son 4,28 GB y no añade pasos (§5).
6. **Armonizar con IC-Light o LayerDiffuse no es viable aquí** (§7): son extensiones de ComfyUI para otras familias de modelos; en
   sd.cpp no existen. Lo que sí hace la comunidad con Klein para igualar luz es una **edición por referencia** («misma escena con
   luz X») y, para el borde, la mezcla con máscara difuminada.

## 2. Sujeto y fondo en la misma imagen

### 2.1 Editar una zona con marca de color y pegar con la máscara

- Hilo en r/StableDiffusion pidiendo el mejor inpainting «con máscara» en marzo de 2026. Respuesta de un usuario que ya usa
  Klein: 1) enmascara la zona, 2) **rellénala de un color liso (rojo)**, 3) pide al modelo que sustituya la zona coloreada y
  deje el resto, 4) **pega la zona editada en el original con la máscara original**; un contorno rojo en lugar de relleno puede ir mejor
  si hay que ver el fondo a través (una valla). Sin cifras de pasos ni denoise. [A]
  [Instantánea](https://reddit.sentinel-team.org/posts/1rqfvrc/snapshots/2026-03-13T21%3A28%3A18.36706Z).
- En el mismo hilo, otro usuario dice que para **insertar algo de una referencia** hay que usar un modelo de edición (Qwen Edit o
  Flux 2) y no uno de inpainting puro, porque el sujeto debe integrarse, no solo describirse; y que Crop & Stitch encaja mal
  porque los modelos de edición ya localizan un sujeto sobre fondo liso. [A]
- La misma convención aparece en una plantilla de ComfyUI (ejemplo «remove the green part») y en el LoRA de panoramas de nomadoor
  (prompt «Fill the green spaces according to the image»): en Klein, **pintar la zona a rellenar de verde en la imagen de
  referencia** es la forma común de decir «aquí». [P]/[A]
  ([plantilla Image Extend](https://comfy.org/workflows/templates_doc_workbox_klein_9b_image_extend-a8d874e28508/),
  [LoRA 360](https://huggingface.co/nomadoor/flux-2-klein-9B-360-erp-outpaint-lora)).
- Hay una plantilla de inpainting con máscara real para Klein 9B (4 pasos): la máscara debe ser **un poco más grande** que el
  objetivo; crecimiento 10 y desenfoque 20 por defecto, 0 y 0 para bordes duros; 1,7 MP por defecto, «Klein aguanta hasta ~2 MP»;
  sube CFG y sale «quemado». [A]
  ([Floyo](https://www.floyo.ai/workflows/partial-modification-reference-image-j2ma4bdo4fbb)).
- **BFL avisa de que las ediciones «pueden cambiar contenido fuera de la región pedida»** y de que las cajas «no son máscaras
  duras» [P] ([ficha FLUX.3 Image Klein](https://huggingface.co/black-forest-labs/flux-3-image-klein)). Por eso pegar con máscara
  al final no es un lujo: es la única garantía de que el fondo bueno sigue intacto.
- Un usuario que prueba inpaint, outpaint y quitar objetos con Klein 9B en una RTX 3060 dice que va bien, pero que con un LoRA
  personal activo una máscara que roza a una segunda persona le **cambia la cara**, y que **no consigue inpaint y outpaint en una
  misma pasada** (la máscara no se transfiere). [A]
  ([instantánea](https://reddit.sentinel-team.org/posts/1rrkt3c/snapshots/2026-03-13T21%3A28%3A18.36706Z)).

**Qué dice sd.cpp sobre máscaras:** `--mask` con FLUX.3 no tiene modelo de inpainting dedicado (mezcla en latente, ver
`investigacion-motor.md` §2) y en el repositorio no hay un solo hilo de Klein con máscara; sí un issue abierto de que «el sdapi
server ignora la máscara» ([#1406](https://github.com/leejet/stable-diffusion.cpp/issues/1406)) y una petición abierta para portar
**LanPaint** (inpainting por dinámica de Langevin, sin modelo especial)
([#1954](https://github.com/leejet/stable-diffusion.cpp/issues/1954)). La marca de color con `-r` + pegado en ffmpeg esquiva todo
eso.

### 2.2 Cambiar solo la luz o el estilo del conjunto

- Usuario que aplica la **luz de una imagen a otra** con Klein 9B (2 imágenes, 8 pasos, 34 s en una RTX 5060 Ti): «no cambies
  nada más, mantén la cara de la imagen 1». Otro comentario dice que supera a Qwen-Image-Edit al combinar dos imágenes o en
  inpainting parcial, que codificar el prompt tarda más que inferir y que 4 pasos también valen. [A]
  ([instantánea](https://reddit.sentinel-team.org/posts/1qemjpc/snapshots/2026-01-16T21%3A31%3A50.56662Z)).
- Hilo de anatomía: un comentarista aconseja «generar la base con un modelo fuerte (Qwen Image) y usar Klein solo para estilo y
  luz». [A]
  ([instantánea](https://reddit.sentinel-team.org/posts/1rrpxtn/snapshots/2026-03-13T00%3A55%3A36.4695Z)).
- Plantilla de Klein 9B «Image Extend» de ComfyUI: añade **ComfyUI-Color-Matcher** tras el relleno para que el color de lo nuevo no se
  desvíe del original; la plantilla de inpaint/outpaint de RunComfy hace lo mismo con `ColorMatch` «tras grandes outpaints» y avisa
  de que si no, hay **deriva de tono**. [P]/[A]
  ([RunComfy](https://www.runcomfy.com/comfyui-workflows/flux-klein-unified-image-editing-inpaint-remove-outpaint-in-comfyui-advanced-image-restoration)).
  En nuestro flujo equivale a igualar histograma por canal con ffmpeg (0 pasadas).
- Guía de Klein de Apatero: «mismo escenario con [luz], [temperatura de color], [atmósfera]» y denoise 0,3-0,4 para luz. **Sin
  medición** y de una empresa con producto competidor; no se toma como cifra [A]
  ([guía](https://apatero.com/blog/flux-2-klein-image-editing-guide)).

### 2.3 El ciclo clásico de pegar y relighting (con IC-Light)

- El workflow de MyAIForce (FLUX.1 + ControlNet) recorta el sujeto, genera el fondo, **relumbra el sujeto con IC-Light** para igualar
  el fondo, repone el fondo original encima, devuelve el color original y repinta con SDXL Lightning en 3 pasos. Hay fallos
  reconocidos: el relighting a veces empeora, hay que borrar los contornos de relleno y los bordes con halo blanco necesitan
  `Mask Grow -1`. Sin números de denoise. [A]
  ([MyAIForce](https://myaiforce.com/flux-replace-background/)). Es la receta humana de «paste + relight + color + repaint», que es
  la misma cadena que ya describe `investigacion-tecnicas-diseno.md`. No es ejecutable en sd.cpp (§7).
- Guía de Kontext: «iguala la luz ambiente nueva con la del sujeto para que el borde se mezcle sin contorno de recorte» y fija
  qué debe quedar igual. Es consejo de prompt, no resultado medido [A]
  ([lista de prompts](https://academy.techpresso.co/prompts/flux-kontext-prompts)).

## 3. Panorámicas y formatos anchos

- **BFL** (guía de FLUX.2): 21:9 para «panoramas, escenas anchas», ejemplo 2048x864; las dimensiones deben ser múltiplos de 16 y se
  recomienda ≤ ~2 MP [P] ([guía](https://docs.bfl.ai/guides/prompting_guide_flux2)). Nuestro 1280x512 es 0,66 MP y múltiplo de 16.
  La ficha de FLUX.3 Image Klein **no da resoluciones** (solo 1024x1024 en la tabla de memoria) [P].
- Guía de Scenario sobre FLUX borroso (resumen de búsqueda; no leí la página): los formatos anchos o altos sin descripción espacial
  tienden a rellenar con suavidad; el remedio es **describir primer plano y fondo** o usar formato cuadrado [A]
  ([artículo](https://help.scenario.com/en/articles/how-to-fix-blurry-outputs-in-flux-prompting-tips-model-behavior)). Hilo de
  FLUX.1-dev en HF: «todo enfocado» no sirve contra el desenfoque de campo, que se atribuye a los datos de entrenamiento [A]
  ([discusión](https://huggingface.co/spaces/black-forest-labs/FLUX.1-dev/discussions/9)).
- **Hilo de anatomía de Klein** a 1920x1072: algunos usuarios ven fallos hacia ~2 MP y recomiendan probar 1,0-1,8 MP o resoluciones
  de entrenamiento; uno dice que cambiar Euler por `res_2s` redujo los fallos de anatomía [A]
  ([instantánea](https://reddit.sentinel-team.org/posts/1rrpxtn/snapshots/2026-03-13T00%3A55%3A36.4695Z)).
  No aplica a 0,66 MP y `res_2s` no está en nuestro `--sampling-method` documentado.
- **Ampliar a los lados (outpainting):**
  - Floyo «Klein Outpaint»: escala la entrada a 1024 px de lado largo, añade **1000 px grises a cada lado** (triplica el ancho),
    pide «sustituye el gris y extiende la escena», **borde difuminado de 50 px** (más si hay degradado de luz duro en el borde) y
    4 pasos; advierte que sale más blando si el sujeto queda cortado en el borde, hay distorsión de lente, el borde es muy oscuro o
    la ampliación **supera ~2x el ancho original en una pasada**; funciona mejor con cielo, suelo o follaje en el borde [A]
    ([Floyo](https://www.floyo.ai/workflows/flux-2-klein-outpaint-image-expansio-fksdvk54ud3e)).
  - RunComfy: empezar con extensiones modestas y crecer la máscara por iteraciones; `ColorMatch` después [A].
  - LoRA 360 de nomadoor (equirrectangular 2:1): **«los modelos destilados no dan buenos resultados en la mayoría de los casos»**, hay
    que usar el base; las costuras «siguen siendo difíciles»; a 2K sale basto y pide ampliar [P]
    ([ficha](https://huggingface.co/nomadoor/flux-2-klein-9B-360-erp-outpaint-lora)). Es un LoRA de Klein 9B, no vale para FLUX.3 ni
    para 2,5:1; sirve solo como aviso de que el relleno de bordes con destilado y LoRA es frágil.
- Para tamaños grandes con tejas: nodo de ampliación por teselas con Klein (Ultimate SD Upscale) con **ajuste de histograma por
  tesela** y pasos adaptativos (cielos y paredes a la mitad de pasos); el autor dice que el VAE estándar de Flux.2 **deja
  diferencias de color entre teselas** y que un 4x tardó más de 10 min en una RTX 3090 [A]
  ([instantánea](https://reddit.sentinel-team.org/posts/1tkmj0q/snapshots/2026-05-22T22%3A42%3A24.48386Z)). En CPU no es asumible.
- sd.cpp: #2192 (Vulkan, Radeon 840M) da salida **desordenada por encima de 768²** con FLUX.3 Klein; se aisló al **VAE en
  Vulkan** (`--backend vae=cpu` o `--vae-tiling` lo arreglan) [N]
  ([issue](https://github.com/leejet/stable-diffusion.cpp/issues/2192)). **No afecta a nuestra CPU**, pero explica por qué un
  tamaño «fuera de lo entrenado» puede parecer un fallo del modelo cuando es del backend.

## 4. Grupos de la misma especie

- **No hay receta publicada de manada para Klein.** La búsqueda de hilos con «manada», «multitud» o «rebaño» solo devolvió
  investigación académica sobre conteo (los modelos de difusión fallan al contar y duplican o funden instancias, y el error nace
  pronto en el denoise; p. ej. [arXiv 2408.11721](https://arxiv.org/html/2408.11721v2)). Es coherente con lo que ya hay en
  `investigacion-prompts-criaturas.md` §P3.
- **Dos pasadas mejor que una:** en el hilo del usuario que no logra sustituir a una persona por un grupo, un comentarista dice
  que «en un paso es probable que falle»; mejor **quitar primero y añadir después el grupo sobre el fondo limpio**, aunque se
  pierda la escala y posición originales [A]
  ([instantánea](https://reddit.sentinel-team.org/posts/1rrkt3c/snapshots/2026-03-13T21%3A28%3A18.36706Z)).
- **Las referencias se citan por lo que son:** en ese mismo hilo, referirse a «imagen 1/2» o «la primera foto» **suele fallar**;
  describir quién es cada sujeto en la escena de destino funciona mejor [A]. En sd.cpp pasa lo mismo: en la discusión
  [#1755](https://github.com/leejet/stable-diffusion.cpp/discussions/1755), con dos `-r`, la salida se parecía a la segunda
  imagen; los mantenedores dicen que «no es un fallo del motor, es el modelo» y que «usa la segunda imagen como referencia» es
  vago (¿composición, estilo, luz?); proponen decir qué se toma de cada una, y aun así el autor no lo logró [N/A].
  Para una manada: `-r` del protagonista con un prompt que **describa a los animales** («the same long, low hunters from the
  reference, six of them, small and misty in the distance»), no «image 1».
- **Hoja de personaje como referencia:** varios usuarios mantienen la identidad con **una hoja con vistas de frente, trasera y tres
  cuartos** como `-r`; uno dice que Klein 9B genera la hoja desde 1-3 referencias; otro sostiene que un LoRA sigue siendo lo más
  fiable [A]
  ([instantánea](https://reddit.sentinel-team.org/posts/1rsrafa/snapshots/2026-03-13T21%3A28%3A18.36706Z)). Útil si una criatura debe
  salir igual en varios banners; cada `-r` suma coste (§5).
- **Cajas de maquetación de BFL** (un id por individuo, una caja para un grupo lejano): ya en `investigacion-motor.md`. La ficha
  repite que son guía de colocación, no máscaras: elementos pueden salirse y «los pequeños pueden no aparecer» [P].
- **Cadena de varias referencias con vínculo de latentes** (ComfyUI): cada imagen añadida cuesta VRAM según su tamaño; «cinco
  imágenes de 1500x1500 pueden pasarse de 8 GB» [A]
  ([instantánea](https://reddit.sentinel-team.org/posts/1qemjpc/snapshots/2026-01-16T21%3A31%3A50.56662Z)). En la CPU de la Deck lo
  que se paga es tiempo, ver §5.

## 5. Klein en hardware modesto: lo que se sabe y lo que no

- **Cuantización** (ficha de AtomicChat, FLUX.3 Image Klein GGUF; medido en H100 con 48 pies de foto x 2 semillas contra BF16, así
  que es calidad, no velocidad) [N]
  ([ficha](https://huggingface.co/AtomicChat/FLUX-3-Image-Klein-GGUF)):

  | Archivo | Tamaño | LPIPS (menor, mejor) | SSIM | PSNR |
  |---|---|---|---|---|
  | Q8_0 | 5,99 GB | 0,014 | 0,982 | 34,4 dB |
  | AD-Q5_K | 4,44 GB | 0,038 | 0,954 | 28,8 dB |
  | AD-Q4_K | 3,65 GB | 0,081 | 0,903 | 24,4 dB |

  La misma ficha recomienda el **codificador de texto en Q8_0 (4,28 GB)**; AD-Q6_K «pérdida moderada», AD-Q4_K «la mayor pérdida», y
  el Q4_K_M de Qwen «mueve la imagen más que AD-Q4_K». Usamos Q8_0 en el modelo de difusión (bien) y **Q4_K_M en el codificador**
  (el punto débil según esta ficha). Receta de la ficha: 16 pasos, cfg 1, euler, «usa un pie de foto, no un prompt corto».
- **Q8 vs Q4 en velocidad:** en un Ryzen 5 7645HX con una tarjeta de 6 GB, Q8_0 2,37 s/paso y Q4_K 2,28 s/paso a 1024² (Q8_0 hubo
  que partirlo en 39 segmentos) [N] ([sd.cpp #2219](https://github.com/leejet/stable-diffusion.cpp/issues/2219)). Un usuario de GPU
  (RTX 3060) ve los GGUF **2-3 veces más lentos que fp8** sin explicación [A]. Ninguno es CPU. Un autor japonés conjetura, sin
  probarlo, que los cuantizados por debajo de q8 pagan decodificación en CPU [A]
  ([Zenn](https://zenn.dev/syoyo/articles/a2779def150fbb)). **Mantener Q8_0.**
- **Medida de CPU más cercana:** FLUX.1 schnell q8 con sd.cpp en un Ryzen 9 3900X (12 hilos) tarda ~75,6 s/paso a 512x512; 20 pasos,
  ~25 min; 24 GB de memoria [N] ([Zenn](https://zenn.dev/syoyo/articles/a2779def150fbb)). Nuestros ~180 s/paso a 1280x512 son del
  mismo orden de magnitud por píxel; no hay nada publicado que lo mejore en CPU.
- **Pasos:** ComfyUI da 4-16 pasos para el destilado (CFG fijo 1) [P]
  ([docs](https://docs.comfy.org/tutorials/flux/flux-3-klein)). La plantilla de Floyo advierte que «subir pasos rara vez ayuda y
  puede empeorar» [A]. En la discusión
  [#1516](https://github.com/leejet/stable-diffusion.cpp/discussions/1516) (Klein 9B en sd.cpp), con `--strength` sobre `-i`, el
  mantenedor `wbruna` recomienda subir pasos a ~6 cuando se baja la fuerza a ~0,5 (la fuerza reduce los pasos reales) y probar
  `euler_a` (que inyecta ruido) con `-i` [A].
- **`--strength` solo actúa con `-i`, no con `-r`** (esa misma discusión, y explica por qué un usuario veía igual salida para 0 y 1).
  `-r` es una referencia limpia que el modelo lee; `-i` es un punto de partida con ruido. Un usuario encontró que `-r` daba mejor
  img2img que `-i`, y otro dice que `-i` con Klein «solía salir con mala calidad» [A]. Combinar `-i` + `-r` «es posible, calidad
  sin probar» [A]. En la #1755, el consejo es bajar la fuerza hasta que cambie algo y avisa de que **por debajo de 0,5 «probablemente
  no hará nada»** (con el modo de pasos saltados, no con `strength_as_noise_level`; ver `investigacion-motor.md` §2) [A].
- **La edición exige llevar la resolución de salida a mano:** `sd-cli` en modo edición usaba 512x512 por defecto
  ([#1201](https://github.com/leejet/stable-diffusion.cpp/issues/1201), abierto) y ComfyUI pone la referencia a ~1 MP. Pasar
  `-W/-H` explícitos [P/A].
- **Coste de las referencias:** sd.cpp avisa de que «las latentes de referencia se atienden en cada paso» y de que
  `ref_image_size=max` puede ser varias veces más lento [P] ([edit.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/edit.md));
  el PR de FLUX.2 pide una caché KV de referencias ([#1341](https://github.com/leejet/stable-diffusion.cpp/issues/1341), abierto)
  justo por eso. Existe `vae_input_max_pixels` para bajar el coste.
- **Plástico y sobreprocesado:** guía de BFL (nombrar cámara, lente y película, p. ej. «Kodak Portra 400 con grano natural»)
  [P] ([estilo](https://docs.bfl.ai/guides/prompting_unified_style)); un nodo de ComfyUI para añadir grano usa 0,5 de peso en
  fotorrealismo y 0,1-0,2 para «romper el brillo» sin grano visible [A]
  ([nodo](https://comfy.icu/node/Image-Grain-Add)). Un solo creador propone un LoRA «Enhanced Details» contra el plástico de Klein
  9B [A]; no aplica.
- **Licencia 9B:** el 9B tiene licencia no comercial y menos permisiva que el 4B (lo dice `wbruna` en #1755 y la ficha de Floyo); no
  es nuestro modelo, pero conviene saberlo si alguien propone «pasar al 9B».
- **Prompt largo:** la ficha de BFL y de AtomicChat insisten en pie de foto completo («los prompts cortos dan resultado genérico»);
  ComfyUI añade que las versiones bf16 siguen mejor los prompts largos que las int8 [P]. Ya cubierto por
  `investigacion-motor.md` y `investigacion-prompts-criaturas.md`.

## 6. Otros hilos útiles, por qué importan

- [sd.cpp #2152 / discusión #2161](https://github.com/leejet/stable-diffusion.cpp/issues/2152) («style transfer flux3»): un usuario
  hace transferencia de estilo con **`-r` + `--strength 0,95`, 4 pasos y 240x160** y se queja del resultado. Sin respuesta. Es
  justo el uso erróneo que describe #1516: `--strength` no actúa con `-r`, y 240x160 está lejos de lo entrenado. Moraleja: no
  copiar sus parámetros.
- [sd.cpp PR #1738](https://github.com/leejet/stable-diffusion.cpp/pull/1738) (fusionado el 5 de julio): origen de
  `strength_as_noise_level`/`force_first_sigma`; el autor justifica que «strength» por pasos saltados no equivale a nivel de ruido y
  varía mucho con el planificador. Confirma la lectura de `investigacion-motor.md` [P]; no incluye números sobre FLUX.
- [sd.cpp #1665](https://github.com/leejet/stable-diffusion.cpp/issues/1665): img2img con FLUX.2 Klein en Vulkan devuelve imagen
  blanca; **en CPU sale bien**. Otro motivo para quedarse en CPU para esas pasadas [N].

## 7. Lo que se descarta, y por qué

| Cosa | Motivo |
|---|---|
| **IC-Light** (relighting) | En los workflows leídos corre dentro de ComfyUI sobre SDXL/FLUX.1 con ControlNets; no existe en sd.cpp y la receta mezcla 4 modelos. No se halló ningún uso en CPU ni con Klein. |
| **LayerDiffuse para Flux** (fondo transparente) | Solo hay una extensión comunitaria de ComfyUI para FLUX.1 (`ComfyUI_FluxLayerDiffuse`, ~20 estrellas, última actualización marzo de 2025 según un listado de terceros) [A]. Nada para Klein ni FLUX.3 y su VAE es otro. |
| **Qwen-Image-Layered** (sujeto en capas RGBA) | sd.cpp lo soporta como modelo de edición (`qwen_layered`, [edit.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/edit.md)), pero una guía cita **picos de 45 GB** y 120 s por imagen de 1024 px en una RTX Pro 6000 de 96 GB [A]. Imposible en la Deck. |
| **Prompting regional / atención por regiones** (`ComfyUI-FluxRegionAttention`, Fluxtapoz, CoupleMask) | Son nodos de ComfyUI para FLUX.1 que tocan la atención; el propio autor avisa de fuga de memoria y resultados variables [A]. No están en sd.cpp. Lo equivalente que sí tenemos es la caja de maquetación de BFL. |
| **LanPaint** | Petición abierta (#1954) sin implementación; es un muestreador con bucles internos (más coste, no medido) [A]. |
| **LoRA de panorama 360 de Klein** | Es de Klein 9B base, 2:1 equirrectangular; su autor dice que el destilado «no da buenos resultados». Y pide 2K. |
| **Ampliación por teselas con Klein / SeedVR2 7B** | La comunidad lo usa en GPU (un 4x tarda >10 min en una 3090); con ~180 s/paso por 1280x512 no sale a cuenta. |
| **Cambiar a Klein 9B / 9B KV** | Otro modelo, licencia más restrictiva, más memoria y el 9B en CPU «tardó una hora y devolvió la referencia» en #1755. |
| **`--img-cfg-scale` y subir CFG** | Un usuario de #1516 duda de que aplique a modelos de edición; Floyo y ComfyUI dicen que CFG>1 «quema» el destilado. Ya descartado en `investigacion-motor.md`. |
| **Método académico de manadas** (ConsiStory, 1Prompt1Story, Bounded Attention) | Tocan la atención interna; no están en sd-cli (ya anotado en `investigacion-prompts-criaturas.md` §P3). |
| **Cualquier cifra de «denoise para armonizar» de la comunidad** | Las que hay (0,2-0,4 luz, 0,4-0,6 fondos, 0,5 de partida) son de una guía comercial sin medidas y sin sd.cpp. Valen como **escalera de prueba**, no como dato. |

## 8. Prácticas aplicables

Notación de coste: línea base **16 pasos, 1280x512, ~49 min** (~180 s/paso + VAE 40 s). Las demás cifras son `[E]` a medir.
Con `-r` el coste sube ×1,5-2 (r9 con klein 4B casi lo duplicó); recortar la zona editada o bajar a 8 pasos lo reduce.

| # | Práctica | Fuente | Qué hace falta en nuestro flujo | Coste en la Deck |
|---|---|---|---|---|
| **1** | **Codificador de texto en Q8_0** (en vez de Q4_K_M) | [Ficha AtomicChat](https://huggingface.co/AtomicChat/FLUX-3-Image-Klein-GGUF) [N] | Descargar `Qwen3-VL-4B-Instruct-Q8_0` (4,28 GB) y cambiar `--llm`. Comparar con la misma semilla y prompt que una imagen buena de r12. | +1,3-1,8 GB de RAM; sin pasos extra. La codificación del prompt se hace una vez; el tiempo por paso no cambia (`[E]`). |
| **2** | **Pegado final con máscara** tras cualquier pasada de edición | [Instantánea r/StableDiffusion](https://reddit.sentinel-team.org/posts/1rqfvrc/snapshots/2026-03-13T21%3A28%3A18.36706Z) [A] + [ficha BFL](https://huggingface.co/black-forest-labs/flux-3-image-klein) [P] | Máscara del sujeto (alfa de la pasada de croma) dilatada y difuminada; ffmpeg `alphamerge`/`overlay` para devolver sobre la plancha original los píxeles que no debían cambiar. | 0 pasadas; segundos. |
| **3** | **Edición con marca de color + `-r`** para colocar sujeto, manada o sombra en la plancha: lienzo = plancha con la zona pintada de verde/rojo, prompt «sustituye la zona verde por…, deja el resto igual» | [Instantánea](https://reddit.sentinel-team.org/posts/1rqfvrc/snapshots/2026-03-13T21%3A28%3A18.36706Z), [plantilla ComfyUI](https://comfy.org/workflows/templates_doc_workbox_klein_9b_image_extend-a8d874e28508/) [A]/[P] | ffmpeg `drawbox`/máscara para pintar la zona; `-r lienzo.png -W 1280 -H 512`; prompt describiendo la criatura (no «imagen 1»); después #2. Probar 8 y 16 pasos. | 1 pasada con `-r`: ~25-50 min (8 pasos) o ~50-100 min (16) `[E]`. Menos si se edita solo un recorte (p. ej. 640x512 ≈ la mitad de píxeles). |
| **4** | **Manada en dos pasadas:** fondo limpio (plancha) + protagonista; luego el grupo como edición sobre la plancha con la zona marcada y pie de foto que describa a los animales; el grupo lejano, pequeño y con bruma, una sola vez | [Instantánea](https://reddit.sentinel-team.org/posts/1rrkt3c/snapshots/2026-03-13T21%3A28%3A18.36706Z) [A], [BFL layout](https://huggingface.co/black-forest-labs/flux-3-image-klein) [P] | Ficha `manada` ya prevista (`investigacion-prompts-criaturas.md` §P3); opcional: caja de maquetación con un solo id para el grupo. Alternativa a coste 0: recorte reducido y repetido en ffmpeg (ya propuesto en r13). | 1 pasada de edición (como #3) por banner con manada. La alternativa ffmpeg, 0. |
| **5** | **Armonizar por referencia, no por ruido:** `-r montaje.png` con «misma escena, [luz concreta], deja la composición» en lugar de `-i` con `--strength` bajo; alternativa `-i` + `strength_as_noise_level` con ~6 pasos si hay que bajar la fuerza | [#1516](https://github.com/leejet/stable-diffusion.cpp/discussions/1516), [#1755](https://github.com/leejet/stable-diffusion.cpp/discussions/1755) [A], [PR #1738](https://github.com/leejet/stable-diffusion.cpp/pull/1738) [P] | Comparar las dos vías sobre el mismo montaje con 3 semillas. Después #2 para recuperar los píxeles del sujeto. Ya hay una escalera de fuerzas en `investigacion-motor.md`. | `-r`: ~25-100 min `[E]`. `-i` a nivel de ruido 0,5: ~6-9 min (cálculo de `investigacion-motor.md`). |
| **6** | **Igualar color y grano en ffmpeg** (equivalente de `ColorMatch` + grano común) | [RunComfy](https://www.runcomfy.com/comfyui-workflows/flux-klein-unified-image-editing-inpaint-remove-outpaint-in-comfyui-advanced-image-restoration), [nodo de grano](https://comfy.icu/node/Image-Grain-Add) [A] | Ajuste de curvas/`colorbalance` por canal contra la plancha; `noise` leve temporal sobre todo el montaje (0,1-0,2 del efecto «romper el brillo»). Ya previsto como #11-12 en `investigacion-tecnicas-diseno.md`. | 0 pasadas. |
| **7** | **Ampliar a los lados con relleno gris + «sustituye el gris»** (si se parte de una plancha 1024 de ancho) | [Floyo Klein Outpaint](https://www.floyo.ai/workflows/flux-2-klein-outpaint-image-expansio-fksdvk54ud3e) [A] | Lienzo 1280x512 con la plancha pegada y el resto gris; borde de 50 px; ≤ 2x el ancho original por pasada; después #2 y #6. Solo si generar a 1280x512 directo no da buenos laterales. | 1 pasada del tamaño final (~25-49 min según pasos) `[E]`. |
| **8** | **Pie de foto con planos explícitos** (primer plano, plano medio, fondo, dónde está la luz) para evitar la suavidad en formatos anchos | [Scenario](https://help.scenario.com/en/articles/how-to-fix-blurry-outputs-in-flux-prompting-tips-model-behavior) [A] | Ya implica la «plantilla de pie de foto» de `investigacion-motor.md`; añadir un campo `planos` a la ficha de plancha. | 0 (solo prompt). |
| **9** | **Borrador a 4-8 pasos para elegir semilla** antes de gastar 49 min | [ComfyUI docs](https://docs.comfy.org/tutorials/flux/flux-3-klein) [P], Floyo [A] | Ya propuesto (`investigacion-motor.md` §Resumen 4); la comunidad lo confirma como rango válido, no que la composición se conserve. | 13-25 min por borrador `[E]`. |

**Orden sugerido para la próxima ronda del banco:** #1 (un solo cambio de archivo, comparable con una imagen ya generada), luego #3 y #2
juntos sobre una plancha existente, y #5 comparando `-r` con `-i`. #4 se decide según lo que dé #3.

## 9. Lo que sigue sin tener respuesta

- Cómo se comporta **`--mask` de sd.cpp con FLUX.3**: nadie lo ha publicado (cero hilos).
- Si `-r` con una **marca de color** funciona igual en FLUX.3 Image Klein (5,6 B) que en FLUX.2 Klein (4B/9B); todos los relatos son del segundo.
- Cuánto cuesta realmente `-r` en CPU con FLUX.3 a 1280x512 (solo tenemos «casi el doble» con klein 4B).
- Cifras de **denoise o `strength` para armonizar** con FLUX: ninguna medida con método.
- Experiencias de **Klein en CPU o en Steam Deck**: no apareció ninguna.
- r/LocalLLaMA y el resto de Reddit por buscador: inaccesibles desde esta sesión; conviene que una sesión con acceso busque
  «klein inpaint», «klein outpaint», «sd.cpp flux2 cpu» y «klein multi reference» directamente.
