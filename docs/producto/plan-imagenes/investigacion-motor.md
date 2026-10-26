# Investigación del motor: mandos de sd-cli y de FLUX.3 Image Klein (2026-10-26)

Objetivo: qué se puede tocar del propio motor (sd.cpp, `sd-cli`) para mejorar las imágenes sin entrenar nada.
Modelo del banco: `flux3-image-klein-Q8_0.gguf` + `Qwen3VL-4B-Instruct-Q4_K_M.gguf` + `flux2-vae.safetensors`,
euler, cfg 1, 16 pasos, 1280x512, `--backend diffusion=cpu -t 8` (~49 min: ~180 s por paso, VAE 40 s).
Lo ya probado (VAE, sampler, estilos, Z-Image, `-r` con klein 4B, hires y ESRGAN con klein 4B) está en
[`banco/resultados.md`](banco/resultados.md) y no se repite salvo donde se dice.

**Convención de fuentes.** `[P]` = fuente primaria (código o documentación de sd.cpp, BFL, Hugging Face de BFL,
diffusers). `[S]` = secundaria (ComfyUI, prensa). `[E]` = estimación o deducción nuestra, **sin fuente**: hay que
medirla. Código leído en `master` de sd.cpp (2026-10-26); la compilación local es el commit `95ff762`. Se ha
comprobado con `strings` que contiene `strength_as_noise_level`, `ref_index_mode`, el modo «Flux.3 FLOW» y el
hires fix; el resto de banderas salen del `--help` real.

## Resumen

1. **FLUX.3 no se comporta como el klein 4B de antes.** Es un modelo de 5,6 B con su propio planificador (desplazamiento
   fijo 6,93), codificador Qwen3-VL-4B leyendo 8 capas intermedias y hasta 4096 tokens de prompt, y está **destilado a
   16 pasos con guía fija 1** ([flux3.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/flux3.md) [P],
   [ficha HF](https://huggingface.co/black-forest-labs/flux-3-image-klein) [P]). Los ajustes que no ayudaron con klein
   4B (sampler, VAE) probablemente seguirán igual; los que no se habían podido probar (forma del prompt, `img2img` barato,
   pasos, relación de aspecto) son los prometedores.
2. **BFL dice que el modelo necesita descripciones de escena completas y que «no se use sin el *prompt upsampler*»**
   ([ficha HF](https://huggingface.co/black-forest-labs/flux-3-image-klein) [P]). Nuestras fichas ya son largas (264-319
   palabras), pero están escritas como ficha de criatura, no como pie de foto (tipo de imagen, plano y luz primero). Es la
   palanca más barata de probar y la menos explorada.
3. **El `img2img` de FLUX.3 en sd.cpp es muy barato y muy controlable con `strength_as_noise_level=true`**: con el
   planificador desplazado 6,93, la fuerza «normal» de 0,5 equivale a ruido casi total (sigma 0,87) y destruye la
   composición, mientras que como nivel de ruido 0,5 son solo ~2 de 16 pasos (~6-9 min). Sirve para retocar color y
   atmósfera de una imagen buena sin perder la composición (cálculo `[E]` a partir del código, ver §2).
4. **Pasos: 4-16 son válidos** ([ComfyUI](https://docs.comfy.org/tutorials/flux/flux-3-klein) [S]); el modelo recibe el
   sigma destino como condicionamiento (`diffusion_engine.cpp`), lo que casa con un destilado de pasos variables. A
   180 s/paso, 8 pasos son ~25 min y 4 pasos ~13 min: un borrador para elegir semilla/composición antes de gastar 49 min.
5. **Lo que no hay que esperar:** un Qwen más grande como codificador (FLUX.3 está entrenado con Qwen3-VL-4B; no hay
   fuente que permita cambiarlo), ADetailer sin un detector de criaturas (los YOLOv8 oficiales detectan clases COCO) ni
   `negative_prompt` ([BFL](https://docs.bfl.ml/guides/prompting_unified_technical.md) [P]: el modelo no lo tiene).

## 1. Muestreador, planificador, *flow shift* y guía

| Mando | Qué hace | Valor recomendado | Fuente | Cómo se pasa | Coste |
|---|---|---|---|---|---|
| `--sampling-method` | Integrador | `euler` | sd.cpp: «The distilled model uses 16 steps and CFG 1.0 … `--sampling-method euler`» ([flux3.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/flux3.md)) [P] | ya en `generar.sh` | igual |
| `--cfg-scale` | Guía | `1.0` en el destilado (a >1 no ayuda: «raising cfg does not help») | [ComfyUI](https://docs.comfy.org/tutorials/flux/flux-3-klein) [S]; la ficha HF dice «Guidance: none» ([HF](https://huggingface.co/black-forest-labs/flux-3-image-klein)) [P] | `CFG=1` | cfg>1 duplicaría el coste (rama sin condición) |
| `--guidance` | Guía destilada (defecto 3.5) | **no tocar**: FLUX.3 no la usa | ficha HF [P]; `--help` | – | – |
| `--steps` | Pasos | 16 (documentado); 4-16 admitidos | sd.cpp 16 [P]; «4–16, default 16» ComfyUI [S] | columna *pasos* del TSV | **lineal: 180 s por paso** |
| `--scheduler` | Sigmas | dejar `discrete` (defecto del modelo) | `Flux3FlowDenoiser::get_sigmas` en [`denoiser.hpp`](https://github.com/leejet/stable-diffusion.cpp/blob/master/src/runtime/denoiser.hpp): con `discrete` usa `sigma = s·u / (1 + (s-1)·u)`; con cualquier otro cae al generador genérico [P] | `--scheduler X` | igual |
| `--flow-shift` | Desplazamiento *s* (defecto **6,93**, fijo, no depende de la resolución) | 6,93 por defecto; «Use `--flow-shift` to override it» | [flux3.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/flux3.md) [P] | `--flow-shift 4` | igual |
| `--extra-sample-args` | Parámetros de planificador (`base_shift`, `max_shift` son de FLUX.1, no se usan en FLUX.3) | – | `--help` [P] | – | – |

Notas:

- **BFL no publica un muestreador/planificador/shift propio para FLUX.3**: la ficha solo da «16 pasos, sin guía» y
  se remite a su código; el 6,93 sale de sd.cpp ([flux3.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/flux3.md)).
  Para FLUX.2 klein, diffusers usa `FlowMatchEulerDiscreteScheduler` con sigmas lineales y un `mu` empírico que
  depende de la longitud de la imagen y los pasos ([`pipeline_flux2_klein.py`](https://github.com/huggingface/diffusers/blob/main/src/diffusers/pipelines/flux2/pipeline_flux2_klein.py)) [P].
- `--scheduler flux2` usa ese mismo `mu` empírico ([`Flux2Scheduler`](https://github.com/leejet/stable-diffusion.cpp/blob/master/src/runtime/denoiser.hpp)).
  Para 1280x512 y 16 pasos da *mu* ≈ 2,08, es decir un shift efectivo ≈ 8,0 `[E]` (cálculo propio con las
  constantes del código), muy cerca de 6,93: **no se prueba aparte**, queda cubierto por la prueba de *shift*.
- El modelo recibe como entrada el **sigma del paso destino** (`flux3_target_timestep` en
  [`diffusion_engine.cpp`](https://github.com/leejet/stable-diffusion.cpp/blob/master/src/pipeline/diffusion_engine.cpp)) [P].
  Consecuencia `[E]`: samplers de varias evaluaciones por paso (heun) y las cachés de pasos (§6) pueden desajustarse;
  y cambiar el *shift* cambia ruta y destino a la vez, pero el modelo se destiló con 6,93: es una prueba, no una
  recomendación. **Ninguna fuente primaria recomienda otro shift.**
- Ya probado con klein 4B (no repetir): dpm++2m / res_multistep ≈ euler; er_sde cambia la composición (r6).

## 2. img2img, máscara y edición con referencias

**img2img** (`-i`/`--init-img` + `--strength`). Funciona con FLUX.3 (es genérico en `image.cpp`) `[P]`
([fuente](https://github.com/leejet/stable-diffusion.cpp/blob/master/src/pipeline/image.cpp)). Detalle clave:

- Por defecto, `--strength s` salta el primer `(1-s)` de los pasos (`t_enc = pasos·s`). Con el planificador desplazado
  eso significa mucho ruido: con 16 pasos, `s=0,75` arranca en sigma ≈ 0,95; `s=0,5` en ≈ 0,87; `s=0,25` en ≈ 0,70
  `[E]` (fórmula de `Flux3FlowDenoiser` aplicada a mano). Con `s≥0,5` la composición original casi no sobrevive.
- La opción `--extra-sample-args strength_as_noise_level=true` interpreta `--strength` como **nivel de ruido
  real** (sigma); además `force_first_sigma=true` fuerza el primer sigma exacto ([`image.cpp` L158-215](https://github.com/leejet/stable-diffusion.cpp/blob/master/src/pipeline/image.cpp)) [P].
  No está documentada en `--help` ni en la carpeta `docs/` de sd.cpp; la compilación local la contiene.
- Pasos que se ejecutan, con sigma = nivel de ruido (16 pasos, shift 6,93) `[E]`: 0,50 → ~2 pasos (~6-9 min con la
  codificación VAE); 0,70 → ~4 pasos (~12-15 min); 0,85 → ~7 pasos (~23 min).
- Uso previsto: partir de una imagen de r12 (composición buena) y cambiar color/bruma/luz con un prompt retocado, o
  rematar detalle. Límite: es un *rehacer desde ruido parcial*, no una edición localizada.

**Máscara** (`--mask`, blanco = regenera). Con FLUX.3 no hay modelo de *inpainting* dedicado: sd.cpp usa `denoise_mask`
(mezcla en el espacio latente en cada paso; ramas `sd_version_is_inpaint` solo para modelos de inpaint) `[P]`
([`image.cpp`](https://github.com/leejet/stable-diffusion.cpp/blob/master/src/pipeline/image.cpp)). Funcionará como
*img2img* acotado a la zona; **no hay fuente ni prueba de calidad de costuras con FLUX.3**. Va con `-i` y
`strength_as_noise_level`. Aplicación posible: rehacer solo la manada del fondo (el fallo de r12) con un prompt sobre la
manada.

**Referencias** (`-r`, hasta 10; `--ref-image-args`; `--increase-ref-index`).
- FLUX.3 Image Klein y Klein Base están en la lista de modelos de edición de sd.cpp
  ([edit.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/edit.md)) [P]. `--img-cfg-scale` es para
  modelos de inpaint/edición con rama de imagen sin condición; **no figura en `edit.md` ni hay fuente de que FLUX.3 lo
  use** (en el destilado la guía es 1): no se prueba.
- `--ref-image-args` (pares clave=valor; sin él se autodetecta el preajuste por el modelo): claves `ref_index_mode`
  (`fixed`/`increase`/`decrease`), `resize_before_vae`, `vae_input_max_pixels` (defecto 1048576 = 1 MP), `vlm_max_size`…
  ([edit.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/edit.md)) [P]. Se puede reducir el coste de
  cada referencia con `--ref-image-args vae_input_max_pixels=262144`.
- **Coste** `[E]`: la referencia entra al transformer y se atiende en cada paso; una de 1 MP añade ~4000 tokens a los 2560
  de la imagen (el doc de sd.cpp avisa de que las referencias «se atienden en cada paso»,
  [edit.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/edit.md)). Con klein 4B la referencia duplicó
  el tiempo (r9, ~270 s frente a ~150 s).
- **Límite documentado por BFL**: «reference images anchor content, they do not lock structure»
  ([HF](https://huggingface.co/black-forest-labs/flux-3-image-klein)) [P]. Coincide con lo visto en r9 (paleta sí,
  composición no). Para citar la referencia en el prompt, la guía de ComfyUI usa «`<ref_image_0>`» y repetirla en el
  negativo ([ComfyUI](https://docs.comfy.org/tutorials/flux/flux-3-klein)) [S]; **no está comprobado que sd.cpp
  interprete esa etiqueta**: en el código leído no hay tratamiento de `<ref_image_N>`; la API de BFL se refiere a las
  imágenes por posición («image 1») ([BFL](https://docs.bfl.ml/guides/prompting_summary.md)) [P].
- Opciones de preprocesado (`--image-preprocess "target=ref,index=0,mode=fit-pad,width=…"`) en
  [image_preprocessing.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/image_preprocessing.md) [P].

## 3. Codificador de texto

- **Qué es**: Qwen3-VL-4B-Instruct, aparte del transformer de 5,6 B ([HF](https://huggingface.co/black-forest-labs/flux-3-image-klein)) [P].
  sd.cpp toma 8 capas intermedias (4, 8 … 32), no la última (`out_layers` en
  [`conditioner.hpp`](https://github.com/leejet/stable-diffusion.cpp/blob/master/src/conditioning/conditioner.hpp)) [P].
- **Longitud**: en sd.cpp, `max_length = 4096` tokens para FLUX.3 (klein 4B: 512 mínimo, relleno, sin tope duro en
  el código leído; diffusers lo corta a 512). Lo que pase de 4096 se **recorta por el final** del texto del usuario
  y se conserva el marcador de turno del asistente ([`conditioner.hpp`](https://github.com/leejet/stable-diffusion.cpp/blob/master/src/conditioning/conditioner.hpp)) [P].
  La ficha HF no da límite; el *upsampler* genera hasta `max_new_tokens=3584` ([HF pup](https://huggingface.co/black-forest-labs/flux-3-image-klein-pup)) [P].
  Nuestros 264-319 palabras (~400-500 tokens `[E]`) caben de sobra. **Hipótesis `[E]`**: la pérdida de B6 con el
  estilo `fantasia` de r3 (>300 palabras) era del klein 4B, que diffusers corta a 512 tokens; con FLUX.3 no aplica.
- **Q8 frente a Q4_K_M**: no hay fuente. FLUX.3 lee 8 capas, así que el error de cuantización se acumula más que en
  klein; ComfyUI distribuye el codificador en int8 ([ComfyUI](https://docs.comfy.org/tutorials/flux/flux-3-klein)) [S]
  y las GGUF de `Qwen3-VL-4B-Instruct` tienen Q8_0. r2 comparó Qwen3-4B Q8/Q4 **con klein 4B** (neutro). Falta el
  fichero (no está en `image-generator/modelos/text/`). Coste: ~4,3 GB frente a ~2,5 GB de RAM; igual tiempo.
- **Un Qwen más grande**: sin fuente y probablemente imposible. Cada variante de klein usa «su» Qwen (4B → Qwen3-4B,
  9B → Qwen3-8B según [flux2.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/flux2.md) [P]) porque
  el transformer se entrenó con sus características; FLUX.3 está atado a Qwen3-VL-4B. **No se prueba.**
- **Qué sí hace el *upsampler*** (otro LLM, Qwen3.5-9B de 18,8 GB, `flux-3-image-klein-pup`): convierte una petición corta
  en un pie de foto de ~220 palabras que empieza por el tipo de imagen y la luz («Full-color outdoor photograph,
  eye-level medium-wide shot in late afternoon sunlight.») ([HF pup](https://huggingface.co/black-forest-labs/flux-3-image-klein-pup)) [P].
  Los *system prompts* (`system_prompts.json`) están en un repo **con acceso restringido (HTTP 401)**: no se han podido
  leer. No cabe con ese tamaño junto a FLUX.3 en la Deck; el equivalente local es **escribir las fichas ya como pie de
  foto** (§5), sin LLM extra.

## 4. Hires fix, ESRGAN, ADetailer

**Hires fix** (`--hires`, `--hires-scale`/`--hires-width`/`--hires-height`, `--hires-steps`,
`--hires-denoising-strength` defecto 0,7, `--hires-upscaler`). No tiene documento propio en `docs/`; lo que sigue sale
del código ([`image.cpp`](https://github.com/leejet/stable-diffusion.cpp/blob/master/src/pipeline/image.cpp),
[`request.cpp`](https://github.com/leejet/stable-diffusion.cpp/blob/master/src/pipeline/request.cpp)) [P]:
genera a tamaño base, **amplía** (latente — `Latent`, bicúbico, etc. —, o `Lanczos`/`Nearest`, o un modelo ESRGAN de
`--hires-upscalers-dir`) y hace una segunda pasada de *img2img* con `hires-steps` pasos efectivos
(`scheduler_steps = hires-steps / denoising`, se ejecutan los últimos `hires-steps`). El sigma de la segunda pasada se
calcula con el planificador y la longitud de la imagen ampliada, y la máscara latente se reescala.
- **Coste** `[E]`: 1,5x en cada lado = 2,25x tokens (5760 frente a 2560) y la atención crece más que lineal; un paso a
  1920x768 ≈ 2,5-3 x 180 s ≈ 450-540 s. Con `--hires-steps 6` son +45-55 min sobre los 49 de base. Con klein 4B ya salió
  peor (calidad.sh, resultados.md); **con FLUX.3 no se ha probado y es la prueba más cara de la lista**.
- Valor razonable `[E]`: `--hires --hires-scale 1.5 --hires-steps 4 --hires-denoising-strength 0.35 --hires-upscaler Lanczos`.
  El `Latent` por defecto suele dar artefactos con modelos modernos; Lanczos es seguro.

**ESRGAN** (`--upscale-model RealESRGAN_x4plus.pth`, `--upscale-repeats`, `--upscale-tile-size`). Amplía 4x al final,
sin difusión ([esrgan.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/esrgan.md)) [P]. Ya probado con
klein: sirve para el tamaño final (5120x2048), **no añade detalle** (resultados.md). Con FLUX.3 igual. Coste: segundos.
La doc nombra también modelos MoSR (p. ej. 4xNomos2_hq_mosr) por si se quiere probar otro ampliador `[P]`.

**ADetailer** (`-M adetailer`, o `--ad-model` en una generación normal; luego `--ad-prompt`, `--extra-ad-args`).
Detecta con un **YOLOv8 de detección** convertido a safetensors y rehace cada región como *inpaint* (recorte 512x512,
`denoising_strength` 0,4 tras generar) ([adetailer.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/adetailer.md)) [P].
Solo YOLOv8 de detección (no segmentación). El conversor necesita `ultralytics`, `torch` y `safetensors`, y un `.pt`
es un pickle: solo de fuente de confianza.
- **Límite que importa**: los YOLOv8 estándar son de COCO (persona, perro, caballo, vaca, oveja…) o de caras/manos;
  **ninguno conoce nuestras criaturas**, y las claves de `--extra-ad-args` no incluyen filtro por clase
  (`confidence`, `mask_k_largest`, `sort_by`…) `[P]`. Habría que dejar que COCO acierte «perro/caballo» por parecido.
  Sin fuente de que sirva con FLUX.3 y con 8 hilos en CPU cada región son unos 6 pasos de 512x512: ~6-9 min `[E]`.
  **Prioridad baja**; solo si una prueba posterior muestra detalle fino malo en un sujeto pequeño.

## 5. Guía de prompts de BFL (FLUX.3 / FLUX.2 / Klein)

Fuentes: [Building a good prompt](https://docs.bfl.ml/guides/prompting_unified_building.md),
[Style, aesthetics & text](https://docs.bfl.ml/guides/prompting_unified_style.md),
[Technical parameters](https://docs.bfl.ml/guides/prompting_unified_technical.md),
[Layout prompts](https://docs.bfl.ml/guides/prompting_layout.md),
[Prompt Reference](https://docs.bfl.ml/guides/prompting_unified_reference.md), guía FLUX.2
([docs.bfl.ai](https://docs.bfl.ai/guides/prompting_guide_flux2)) [P]. No existe una guía separada «de FLUX.3 Image
Klein» para las pesas abiertas: las páginas anteriores son las de «FLUX 3 Image» (API) y la ficha HF.

- **Orden** («un hábito, no una regla»): tipo de imagen y medio → sujeto y acción → entorno → luz → encuadre y detalle
  (plano, ángulo, lente, profundidad de campo). Lo más importante, primero. FLUX.2 «presta más atención a lo que viene
  antes». **Hoy nuestras fichas empiezan por la criatura (la descripción de la ficha) y dejan estilo y luz al final**;
  r11 ya notó que «el párrafo de estilo del final apenas pesa».
- **Longitud**: «una estructura clara importa más que la longitud»; se empieza con una frase y se añade tras ver el
  resultado; 30-80 palabras «ideal para la mayoría», 80+ para escenas complejas (FLUX.2). Ejemplo de BFL: 16 palabras →
  186 palabras con una función por frase. **Evitar «highly detailed», «masterpiece»**: «añaden poco».
- **Cámara y lente** (para el aspecto fotográfico): 24 mm gran angular; 35 mm documental; 50 mm a la altura del ojo;
  85 mm retrato; 135 mm+ teleobjetivo con compresión de fondo; f/1,4-2,8 fondo borroso, f/8-16 todo nítido; «Nombra la
  cámara, la lente o la película en vez de “foto profesional”» («Shot on Hasselblad X2D, 80mm lens, f/2.8, natural
  lighting»). Para paisaje con manada al fondo: lente larga comprime la manada, f/8+ la deja nítida `[E]`.
- **Luz**: fuente, dirección, calidad y temperatura («soft window light from the left»); hora dorada, hora azul,
  contraluz/borde de luz.
- **Estilo y acabado**: nombrar película y grano («shot on Kodak Portra 400, natural grain»), y para klein añadir al
  final `Style: [estilo]. Mood: [ambiente].` ([Prompt Reference](https://docs.bfl.ml/guides/prompting_unified_reference.md)) [P].
  La guía **no trata el aspecto «CGI/plástico»**; lo más cercano es cámara, lente, luz y grano concretos.
- **Colores**: códigos hex ligados a un objeto concreto («#e01075» en un pájaro) [P]. Útil para fijar el rojo del pelaje
  y el cielo sin que se contagien.
- **Sin prompt negativo**: «describe lo que quieres»; se sustituye «sin gente» por «desierto, solitario» y «sin
  desorden» por «fondo liso de un color» ([Technical](https://docs.bfl.ml/guides/prompting_unified_technical.md)) [P].
  Útil para «la manada no son hienas»: describir la manada como «más de la misma criatura» (ya en r12).
- **Aspecto/resolución**: el API ofrece 15 relaciones de 21:9 a 9:21 y «el prompt debe casar con el encuadre; en
  formatos anchos, describir contenido que llene el ancho». **1280x512 (2,5:1) no está en la lista**; las más
  cercanas son 21:9 (2,33) y 2:1 `[P]`. Que el modelo rinda peor a 2,5:1 es hipótesis `[E]`. Además «cambiar la
  resolución genera otra imagen» (composición distinta) [P].
- **Varias criaturas iguales**: la guía de prompts **no dice nada** de sujetos idénticos repetidos (sí describe
  mantener la descripción de un personaje entre viñetas y referirse a las imágenes por posición). La única herramienta
  documentada son los **prompts de maquetación** (*layout*): un pie de foto con `<id>` junto a cada elemento y una lista
  JSON `{"id","bbox","desc"}` con cajas `[arriba, izquierda, abajo, derecha]` en una rejilla 0-1000, un id por
  individuo (`animal_1`, `animal_2`…) y una sola caja para un grupo lejano
  ([Layout](https://docs.bfl.ml/guides/prompting_layout.md)) [P]. La ficha HF dice que sirve con las pesas
  abiertas («add a JSON list of elements with `[top, left, bottom, right]` boxes»), pero también que «las cajas fijan
  posición y escala, no son máscara dura» y que «los elementos pequeños pueden no aparecer»
  ([HF](https://huggingface.co/black-forest-labs/flux-3-image-klein)) [P]. **La página de BFL no muestra cómo se unen
  el texto y el JSON en un único prompt** (los *system prompts* del upsampler están tras acceso restringido); el
  formato de más abajo es nuestra mejor suposición `[E]`. Además, cuanto más lejos, más pequeña la criatura: el
  mismo fallo de r12 (manada = hienas) apunta a que el modelo no copia la especie en miniatura.

## 6. Velocidad (para poder probar más)

Con 49 min por imagen, el número de pruebas manda. Mandos que bajan el coste de *probar*:

| Mando | Qué hace | Fuente | Cómo | Coste/riesgo |
|---|---|---|---|---|
| menos pasos | 4-8 pasos como borrador | [ComfyUI](https://docs.comfy.org/tutorials/flux/flux-3-klein) [S] | columna *pasos* | 13 / 25 min; la composición con pocos pasos puede no coincidir con la de 16 `[E]` |
| `--preview proj --preview-interval 1 --preview-path <png>` | Imagen de previsualización barata en cada paso; permite ver la composición hacia el paso 3-4 y matar la tirada | `--help` [P]; hay proyección `flux2_latent_rgb_proj` de 32 canales ([`latent-preview.h`](https://github.com/leejet/stable-diffusion.cpp/blob/master/src/runtime/latent-preview.h)) [P] | args del TSV | casi gratis; **no verificado que FLUX.3 tenga proyección** (si no, no hace nada) |
| `--cache-mode easycache --cache-option threshold=0.2` | Reutiliza salidas entre pasos parecidos | [caching.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/caching.md) [P] (DiT) | args | Con 16 pasos hay poco que reutilizar y el modelo recibe el sigma destino: riesgo de artefactos `[E]` |
| resolución 1152x512 o 1024x512 | Menos tokens (2304 / 2048 frente a 2560) | – | `W=1152,H=512` | -10 % / -20 % de tiempo `[E]`; cambia la imagen |
| `--conditioning-cache-size 4` | Cachea el codificador de texto | [caching.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/caching.md) [P] | arg | solo ayuda con varios `-b` en un mismo proceso; en `banco.sh` cada fila es un proceso: **sin efecto** |

## Lista ordenada de pruebas para una ronda del banco

Formato de `banco.sh`: `nombre<TAB>pasos<TAB>prompt<TAB>variables<TAB>args`. Todas con FLUX.3 en la CPU y semilla 3
(la del banco), y el prompt base `prompts/aullador-fotorreal.txt` (r12, 48 min) salvo donde se dice. Comparar siempre
con `r12-fotorreal-aullador-fotorreal`. Variables comunes `V=` abreviadas aquí; en el TSV van completas:

`V = MODELO=flux3-image-klein-Q8_0.gguf,LLM=Qwen3VL-4B-Instruct-Q4_K_M.gguf,VAE=flux2-vae.safetensors,TOPE=10800`
`B = --backend diffusion=cpu -t 8`

Orden de prioridad = (probabilidad de mejora) / (coste). Las tres primeras se hacen en ~1,5 h y deciden el rumbo.

| # | nombre | pasos | prompt | variables | args | Qué se mira | Tiempo `[E]` | Fuente |
|---|---|---|---|---|---|---|---|---|
| 1 | `pie-de-foto` | 16 | `prompts/aullador-pie.txt` (nuevo) | V | `B` | ¿mejor atmósfera/aspecto de cine frente a r12? Misma ficha, reordenada como pie de foto (ver abajo) | 48 min | §5 [P] |
| 2 | `pasos-8` | 8 | `prompts/aullador-fotorreal.txt` | V | `B` | ¿se parece a r12 (16 pasos)? Si sí, el borrador de 25 min vale | 25 min | §1 [S] |
| 3 | `pasos-4` | 4 | `prompts/aullador-fotorreal.txt` | V | `B` | ídem: ¿composición estable a 13 min? | 13 min | §1 [S] |
| 4 | `shift-4-p8` | 8 | `prompts/aullador-fotorreal.txt` | V | `B --flow-shift 4` | frente a #2: más detalle fino / menos composición | 25 min | §1 [P: opción existe; efecto `E`] |
| 5 | `shift-10-p8` | 8 | `prompts/aullador-fotorreal.txt` | V | `B --flow-shift 10` | frente a #2: composición más firme, menos textura | 25 min | ídem |
| 6 | `refino-050` | 16 | `prompts/aullador-refino.txt` (nuevo) | V | `B -i $G/generated/banco/r12-fotorreal-aullador-fotorreal/intentos/banner-s3-p16-20261026-153036.png --strength 0.5 --extra-sample-args strength_as_noise_level=true` | ¿conserva la composición y cambia solo color/bruma? | ~8 min | §2 [P: opción; pasos `E`] |
| 7 | `refino-070` | 16 | `prompts/aullador-refino.txt` | V | igual con `--strength 0.7` | frente a #6: hasta dónde llega a rehacer sin perder la composición | ~14 min | §2 |
| 8 | `formato-2a1` | 16 | `prompts/aullador-pie.txt` | V + `W=1024,H=512` | `B` | ¿mejor relación de aspecto de BFL (2:1)? Compara con #1 | ~40 min | §5 [P: lista; efecto `E`] |
| 9 | `maquetacion-manada` | 16 | `prompts/aullador-maqueta.txt` (nuevo) | V | `B` | ¿la manada sale con la misma silueta? | 48 min | §5 [P/E] |
| 10 | `ref-chatgpt-small` | 16 | `prompts/aullador-pie.txt` | V | `B -r $G/../backend/uploads/images/<banner-chatgpt.png> --ref-image-args vae_input_max_pixels=262144` | ¿la referencia da paleta/rojo teñido sin costar el doble? | ~75 min | §2 [P/E] |
| 11 | `enc-q8` | 16 | `prompts/aullador-pie.txt` | V con `LLM=Qwen3VL-4B-Instruct-Q8_0.gguf` | `B` | frente a #1: adherencia al prompt (hay que bajar el fichero) | 48 min | §3 `[E]` |
| 12 | `preview-cache` | 8 | `prompts/aullador-fotorreal.txt` | V | `B --preview proj --preview-interval 1 --preview-path $G/generated/preview.png --cache-mode easycache --cache-option threshold=0.2` | ¿hay previsualización? ¿cuánto tiempo gana la caché y a qué coste de calidad? Frente a #2 | ≤25 min | §6 [P/E] |
| 13 | `hires-15` | 16 | `prompts/aullador-pie.txt` | V | `B --hires --hires-scale 1.5 --hires-steps 4 --hires-denoising-strength 0.35 --hires-upscaler Lanczos` | ¿textura mejor que ESRGAN? (con klein 4B salió peor) | ~100 min | §4 `[E]` |

Notas de uso:
- #6 y #7 usan el prompt `aullador-refino.txt`: el de #1 con una sola variación (p. ej. la bruma roja y el contraluz
  que pide r12); sin cambiar el prompt, el refinado casi no cambia nada.
- `$G` lo sustituye `banco.sh` por `image-generator/`; la ruta de la imagen de r12 es la de resultados.md.
- Los #4-#5 comparan con #2 (mismos 8 pasos) y no con r12, para no mezclar pasos y *shift*.
- #8 pide 2:1; el banner final del juego sigue siendo 2,5:1 (hay que decidir si se recorta; ver §5, hipótesis).
- #11 requiere descargar `Qwen3-VL-4B-Instruct-Q8_0.gguf` (repo `Qwen/Qwen3-VL-4B-Instruct-GGUF`, el mismo del que sale
  la Q4_K_M; [flux3.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/flux3.md) enlaza ese repo) [P].

### Contenido de los prompts nuevos (no se crean aquí)

**`aullador-pie.txt`** (mismos hechos que `aullador-fotorreal.txt`, otro orden; ~220-260 palabras):

```text
Full-color cinematic wildlife photograph in the style of a feature-film still, wide low-angle shot at sunset with a
long lens (85mm, f/8) so the pack in the distance stays sharp and compressed. In the foreground a long, low-slung pack
hunter … [ficha: cabeza de zorro, colmillos de sable, cresta de placas negras con púas rojas de la nuca a la punta
de la cola, cola anillada, tres veces más largo que un zorro] … Behind it, the rest of the pack: more of the same
creature, same long bodies, same armoured crest, same pale fangs, in silhouette. Setting: cracked red earth, swirling red
dust … Light: low red-orange sun behind the animal, strong rim light on fur and crest plates, dense rust-red haze
tinting the ground (#b5391f) and the sky. Style: cinematic concept art rendered as a photograph, natural film grain.
Mood: tense, arid.
```

(Estructura: tipo de imagen → sujeto → entorno → luz → encuadre, con «Style:/Mood:» al final y un hex ligado al
objeto, como pide la guía; sin «highly detailed».)

**`aullador-maqueta.txt`**: el pie anterior con un `<animal_1>` (el sujeto), `<animal_2>`, `<animal_3>`, `<animal_4>`
para la manada, más una lista JSON `[{"id":"animal_1","bbox":[…],"desc":"…"}, …]` con cajas en la rejilla 0-1000
(sujeto abajo-izquierda grande; manada más pequeña, arriba y a la derecha) y `desc` **idéntica** para los cuatro salvo la
pose. Unir texto y JSON en un solo `-p` separados por una línea en blanco (suposición `[E]`).

**`aullador-refino.txt`**: igual que `aullador-pie.txt` pero con más bruma roja y contraluz (lo que r12 señala como
faltante); es el texto del que parte el *img2img*.

## Lo que se descarta (y por qué)

- **Un Qwen mayor** como codificador (sin fuente; atado al Qwen3-VL-4B). **Prompt negativo** (el modelo no lo tiene). **`--img-cfg-scale`** (no documentado para FLUX.3,
  guía 1). **Samplers** distintos de euler (r6 con klein 4B no mejoró; en FLUX.3 hay sigma-destino y riesgo `[E]`).
  **VAE** (r1: no es el cuello). **FLUX.3 Base** (no está en `modelos/diffusion/`; según [flux3.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/flux3.md)
  son 20 pasos con cfg 3,5 → ~2,5x el tiempo, ~2 h por imagen `[E]`; permitiría prompt negativo, pero ninguna fuente
  lo recomienda para pulir; solo si todo lo anterior se agota).
- **Upsampler oficial** (`flux-3-image-klein-pup`, Qwen3.5-9B de 18,8 GB): no cabe junto a FLUX.3 en la Deck; se imita
  escribiendo la ficha como pie de foto (#1).

## Lo que no tiene fuente primaria

- Cualquier valor recomendado de *shift* distinto de 6,93, y el efecto de cambiarlo.
- El formato exacto del prompt de maquetación con las pesas abiertas (los *system prompts* están tras acceso restringido).
- El comportamiento de `<ref_image_N>` en sd.cpp.
- Las estimaciones de tiempo con `[E]`, el reparto de pasos de `strength_as_noise_level`, el efecto de Q8 en el
  codificador y de `easycache` con FLUX.3, y que los pasos 4-8 conserven la composición de 16.
- Que `--preview proj` tenga proyección para FLUX.3.
- El «rendimiento» a 2,5:1.
- Los pasos «4-16» son de ComfyUI `[S]`; BFL (ficha HF) solo da 16.
