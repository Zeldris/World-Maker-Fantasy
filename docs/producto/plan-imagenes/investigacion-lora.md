# Investigación: LoRAs y estilo propio con FLUX.3 Image Klein (`IMG-15`)

Fecha: 2026-10-26. Búsqueda web y lectura de fuentes primarias (fichas de Hugging Face, documentación de BFL, repositorios
de sd.cpp, SimpleTuner y ai-toolkit). **No se lanzó ninguna generación ni descarga.** Lo que no tiene fuente primaria
lleva la marca **[sin fuente]**; lo que es inferencia mía, **[inferencia]**.

Contexto del banco: [`banco/resultados.md`](banco/resultados.md) (el estilo `cine2` es lo más cercano a los banners de
ChatGPT; el resultado de FLUX.3 «sale sobreprocesado», según `banco/prompts.py`).

## Resumen

1. **El modelo que usamos es FLUX.3 Image Klein (5,6 B), no FLUX.2 Klein.** Es otra arquitectura: los LoRAs de FLUX.2 Klein
   (4B/9B) **no deben servir** [inferencia, con la fuente de abajo], y los de FLUX.3 son pocos y ninguno es de estilo
   concept art/matte painting.
2. **Hay LoRAs de FLUX.3 Klein, pero en `diffusers`/PEFT**, y sd.cpp **no los aplicaba** hasta el 25-10-2026
   ([issue #2212](https://github.com/leejet/stable-diffusion.cpp/issues/2212): 0 de 516 tensores aplicados; cerrado como
   completado vía PR #2214, **no verificado** que lo arregle). Hay que volver a compilar sd.cpp con ese PR y probarlo.
3. **Entrenar en la Deck: descartado con las fuentes disponibles.** ai-toolkit pide GPU Nvidia con CUDA; SimpleTuner admite
   ROCm pero solo verificado en una 7900 XTX de 24 GB; la Deck es `gfx1033` (no soportada oficialmente por ROCm) con
   16 GB compartidos. Ninguna fuente documenta entrenamiento en CPU de esta familia.
4. **Fuera de la Deck es barato:** BFL/Hugging Face dan ~1 h y ~0,50 USD en una RTX 4090 para un LoRA de estilo de FLUX.2
   Klein 4B. Para FLUX.3 (5,6 B) no hay cifra publicada; es de esperar algo parecido [inferencia].
5. **Licencia:** FLUX.3 Image Klein va con la *FLUX Kommunity License* (comercial gratis por debajo de 5 M USD anuales). El
   texto completo está tras un login y **no se pudo leer**: no está confirmado qué dice de LoRAs y salidas. El texto de
   OpenAI dice que la usuaria **es dueña de las salidas**, con la prohibición de usarlas «para desarrollar modelos que
   compitan con OpenAI».

## 1. LoRAs ya publicados

Búsqueda hecha con la API de Hugging Face (`filter=lora`, ordenado por descargas) y las fichas. Civitai: la búsqueda web
no devolvió ningún LoRA de FLUX.3; solo una [receta de entrenamiento de FLUX.2 Klein](https://developer.civitai.com/orchestration/recipes/training-flux2-klein).
**No pude consultar Civitai directamente [sin fuente]**: puede haber más allí.

### FLUX.3 Image Klein (el que usamos)

| LoRA | Qué es | Base | Licencia (etiqueta) | ¿Lo carga sd.cpp? |
|---|---|---|---|---|
| [SimpleTuner/flux-3-klein-image-photo-aesthetics-distilled-assisted-1024-v2-kohaku-fa](https://huggingface.co/SimpleTuner/flux-3-klein-image-photo-aesthetics-distilled-assisted-1024-v2-kohaku-fa) (y variantes 512 y sin `v2`) | «estética fotográfica»; rango 32, 50 000 pasos, 29 760 imágenes; sin palabra disparadora; inferencia 16 pasos, CFG 1 | `black-forest-labs/flux-3-image-klein` (destilado) | `other`, sin términos en la ficha | PEFT/diffusers: igual que #2212, a probar tras PR #2214 |
| [akhaliq/flux-3-image-klein-angles-lora](https://huggingface.co/akhaliq/flux-3-image-klein-angles-lora) | ángulos de cámara (edición con `-r`) | `flux-3-image-klein-base` | `other` | Es el LoRA del [issue #2212](https://github.com/leejet/stable-diffusion.cpp/issues/2212); con claves renombradas 516/516 en modo edición |
| [AIImageStudio/RadianceChromeVoluptuous_Flux3Klein_v1.0](https://huggingface.co/AIImageStudio/RadianceChromeVoluptuous_Flux3Klein_v1.0) | estilo cromado (solo listado, ficha sin leer) | `flux-3-image-klein-base` | `other` | sin comprobar |
| [diffusers-modular/flux3-tarot-lora](https://huggingface.co/diffusers-modular/flux3-tarot-lora) | cartas de tarot (solo listado) | `flux-3-image-klein-base` | `other` | sin comprobar |
| [WAS/flux3_klein](https://huggingface.co/WAS/flux3_klein) | **no es de estilo**: la diferencia destilado - base, para que el base muestree como el destilado | `flux-3-image-klein` | FLUX Kommunity License | No: pide el nodo «Flux 3 Flow Map Patch» de ComfyUI; sin él salen franjas y tinte azul |

**No hay ningún LoRA de FLUX.3 de *matte painting*, *concept art* o cine** en lo que devolvió la API (a 2026-10-26). El
más cercano es el de «photo aesthetics» de SimpleTuner, que apunta a fotografía, no a pintura digital.

### FLUX.2 Klein (otro modelo; solo como dato)

| LoRA | Base | Licencia | Nota |
|---|---|---|---|
| [prithivMLmods/Flux2-Klein-Cinematic-FlatLog-Control](https://huggingface.co/prithivMLmods/Flux2-Klein-Cinematic-FlatLog-Control) | `FLUX.2-klein-base-9B` | `other` | cinematográfico (gradación plana tipo *log*), 9B |
| [Keltezaa/flux2_klein_9B_Realism_Engine_V2](https://huggingface.co/Keltezaa/flux2_klein_9B_Realism_Engine_V2) | `FLUX.2-klein-base-9B` | CC BY-NC-ND 4.0 (no comercial) | realismo, 9B |
| [adirik/pixel-art-lora-flux.2-klein-4B](https://huggingface.co/adirik/pixel-art-lora-flux.2-klein-4B) | `FLUX.2-klein-base-4B` | Apache 2.0 | pixel art, no es nuestro estilo |
| [margin2model/flux2-klein-4b-lora-test](https://huggingface.co/margin2model/flux2-klein-4b-lora-test) | `FLUX.2-klein-base-4B` | sin leer | prueba, formato diffusers |
| [noema-art/333flux-klein](https://huggingface.co/noema-art/333flux-klein) | 4B base | sin leer | estilo con palabra «333» |

Casi todos los LoRAs de FLUX.2 Klein son de 9B (licencia no comercial para los pesos, según la
[ayuda de BFL](https://help.bfl.ai/articles/7108141705-can-i-run-or-fine-tune-flux-2-klein-locally)); un LoRA de 9B no
sirve ni en 4B ni en FLUX.3 [inferencia: dimensiones distintas].

## 2. ¿Un LoRA de FLUX.2 Klein sirve en FLUX.3 Klein?

**Casi seguro que no** [inferencia con fuentes]:

- El [blog de Hugging Face sobre FLUX.3](https://huggingface.co/blog/flux-3) describe un transformador de 5 bloques por
  flujo (texto, imagen, referencias, pesos separados) y 28 bloques conjuntos, y lo contrasta con los bloques de doble
  flujo de FLUX.2. Solo comparten el VAE («la misma arquitectura de VAE que Flux.2»). Además, el codificador de texto es
  Qwen3-VL (4B según la [guía de ComfyUI](https://docs.comfy.org/tutorials/flux/flux-3-klein)); FLUX.2 Klein 4B usa Qwen3-4B
  ([banco, r2](banco/resultados.md)).
- El [issue #2212 de sd.cpp](https://github.com/leejet/stable-diffusion.cpp/issues/2212) muestra que los nombres de tensores
  de FLUX.3 (516 tensores en un LoRA) son propios; sd.cpp trata FLUX.3 en su propio
  [`docs/flux3.md`](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/flux3.md).
- Ninguna ficha (BFL, Hugging Face, ComfyUI) afirma compatibilidad entre los LoRAs de FLUX.2 y FLUX.3. **No hay fuente
  que la confirme ni que la niegue expresamente.**

Lo que sí es común: el VAE (por eso `flux2-vae.safetensors` nos sirve en los dos).

## 3. Entrenar un LoRA

### Requisitos publicados

| Herramienta | Modelos | Hardware que declara | Fuente |
|---|---|---|---|
| ostris/ai-toolkit | FLUX.2 klein base 4B/9B y FLUX.3 Image Klein base | «GPU Nvidia»; instala PyTorch con CUDA 13.0; ROCm y CPU no se mencionan; sin cifras de VRAM | [README](https://github.com/ostris/ai-toolkit) |
| Guía de BFL para Klein | FLUX.2 klein 4B base | **12 GB de VRAM Nvidia + 32 GB de RAM** (9B: 22 GB + 64 GB); LoRA en 1-3 h en GPU de consumo | [docs.bfl.ai](https://docs.bfl.ai/flux_2/flux2_klein_training) |
| Blog HF «LoRA en menos de 60 min» | FLUX.2 klein 4B | cabe en 24 GB; RTX 4090 «sweet spot»; L4 basta; ~1 h; ~0,50 USD | [blog](https://huggingface.co/blog/black-forest-labs/flux-2-klein-lora) |
| SimpleTuner | FLUX.2 (4B-32B); FLUX.3 en el LoRA publicado | NVIDIA, **ROCm verificado en 7900 XTX 24 GB y MI300X** («AMD usa más memoria que NVIDIA»); CPU: solo el paquete base, sin requisitos | [README](https://github.com/bghira/SimpleTuner) |
| diffusers | FLUX.3: guiones DreamBooth LoRA; sin cifras de VRAM (solo gradient checkpointing, caché de latentes y Adam de 8 bits como ahorros) | no declarado | [blog FLUX.3](https://huggingface.co/blog/flux-3) |
| kohya sd-scripts, OneTrainer | FLUX.2/FLUX.3: **no he encontrado fuente primaria** | — | [sin fuente] |

Parámetros recomendados para un LoRA de estilo (FLUX.2 Klein, [BFL](https://docs.bfl.ai/flux_2/flux2_klein_training) y
[blog HF](https://huggingface.co/blog/black-forest-labs/flux-2-klein-lora)): 15-40 imágenes de ≥1024 px por el lado largo,
LR 8e-5 a 1e-4, 1500-2500 pasos (el pico visual, entre 750 y 1500), entrenar sobre el **base**, subtítulos del contenido y
no del estilo, palabra disparadora inventada. FLUX.3 Image Klein: base de 50 pasos con CFG, destilado de 16 pasos ([blog HF](https://huggingface.co/blog/flux-3)).
Hacerlo sobre el base y usarlo en el destilado es lo que hacen los LoRAs de SimpleTuner [ficha](https://huggingface.co/SimpleTuner/flux-3-klein-image-photo-aesthetics-distilled-assisted-1024-v2-kohaku-fa)
(«assisted» en el nombre), pero la ficha no lo explica.

### ¿En la Deck (AMD Van Gogh, 16 GB compartidos)?

**No se puede confirmar, y con lo leído, no es realista:**

- ai-toolkit: solo Nvidia/CUDA ([README](https://github.com/ostris/ai-toolkit)).
- ROCm: la Deck es `gfx1033`, que ROCm 5.4.2 no soporta directamente; se fuerza con `HSA_OVERRIDE_GFX_VERSION=10.3.0` y
  se ejecutó un MNIST ([Element84](https://element84.com/machine-learning/running-rocm-5-4-2-onnx-and-pytorch-on-a-steamdeck/)).
  No hay fuente de entrenamiento de un modelo de difusión en la Deck. Nada de ROCm reciente sobre `gfx1033` **[sin fuente]**.
- Memoria: el mínimo oficial de Klein 4B es 12 GB de VRAM **dedicada** + 32 GB de RAM; la Deck tiene 16 GB en total
  compartidos con el sistema (y la ronda ya va justa). Con el generador de 5,6 B de FLUX.3 (pesos BF16 de 11,2 GB según
  [braindetox](https://braindetox.kr/en/posts/flux_3_image_klein_open_weights_2026.html), fuente secundaria) peor aún.
- CPU: ninguna fuente declara entrenar esta familia en CPU. **Tiempo [sin fuente]:** una estimación mía, a ojo, sería de
  decenas de horas o días por 1500 pasos (la generación ya tarda ~2,6 min por banner de inferencia con 6 pasos en klein 4B),
  y entrenar cuesta del orden de 3 veces una pasada de inferencia por paso, a 1024 px y sin ahorro de memoria. No lo doy
  por viable.

### Fuera de la Deck (solo como dato)

- FLUX.2 Klein 4B, ai-toolkit, 1800 pasos, RTX 4090: **~1 h, ~0,50 USD** ([blog HF](https://huggingface.co/blog/black-forest-labs/flux-2-klein-lora)). Con
  descarga de modelos, preparación y 2-3 pruebas de pasos, calculo (**[inferencia]**) 3-4 h de alquiler, es decir, unos 2-3 USD.
- FLUX.3 Klein base (5,6 B): sin cifras publicadas; el modelo cabe en 24 GB con ahorros de memoria **[inferencia]**; mismo orden de coste.
- Resultado: un `.safetensors` de LoRA (10-200 MB, [BFL](https://docs.bfl.ai/flux_2/flux2_klein_training)).
  **Riesgo:** el formato de diffusers/PEFT que sale de ai-toolkit/SimpleTuner hay que poder cargarlo en sd.cpp
  ([issue #2212](https://github.com/leejet/stable-diffusion.cpp/issues/2212)). Convendría comprobar el formato con un LoRA
  existente de FLUX.3 (el de `akhaliq`) **antes** de gastar nada en entrenar.

### Cómo carga sd.cpp los LoRAs

[`docs/lora.md`](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/lora.md): `--lora-model-dir <dir>` y
`<lora:nombre:peso>` en el prompt; `--lora-apply-mode` `immediately` o `at_runtime` (por defecto, `at_runtime` si el
modelo está cuantizado, como nuestro Q8_0). El README lista LoRA como función general
([README](https://github.com/leejet/stable-diffusion.cpp)). `docs/flux3.md` no menciona LoRA.

## 4. Licencia

### Modelo

| Modelo | Licencia | Fuente |
|---|---|---|
| FLUX.2 klein 4B | Apache 2.0 (uso comercial sin tasas; entrenar y distribuir LoRAs permitido) | [ayuda de BFL](https://help.bfl.ai/articles/7108141705-can-i-run-or-fine-tune-flux-2-klein-locally) |
| FLUX.2 klein 9B | Licencia no comercial de FLUX; el uso comercial de los pesos locales pide licencia | misma ayuda |
| **FLUX.3 Image Klein (5,6 B)** | **FLUX Kommunity License**: uso comercial gratis para personas y empresas con ingresos anuales **< 5 M USD**, más investigación y uso no comercial | [BFL](https://bfl.ai/blog/flux-3-image-klein) |

- El texto completo de la Kommunity License está en un repositorio cerrado de Hugging Face (acceso con login; el repositorio
  de ComfyUI también). **No pude leerlo**, así que **no está confirmado** qué dice de: entrenar LoRAs, distribuir los
  derivados, propiedad de las imágenes generadas, o cómo se cuentan los ingresos. [sin fuente]
- La [página de licencias de BFL](https://bfl.ai/licensing) (niveles Builder, Platform, Professional) dice que
  **incluyen derechos de fine-tuning y LoRA**, y no menciona la Kommunity License ni un tope de ingresos. Eso sugiere que, bajo
  la Kommunity License, el fine-tuning podría no estar cubierto, o simplemente que la página no se actualizó; **no se
  puede resolver con lo leído**. Hay que leer el texto antes de entrenar y publicar un LoRA para el juego.
- Los LoRAs de FLUX.3 en Hugging Face se etiquetan `other`; los LoRAs derivados de WAS declaran la Kommunity License.
- Entrenar *otros modelos* con las salidas de FLUX: la página de licencias solo lo trata en la oferta de datos sintéticos
  («derechos explícitos para entrenar con salidas»). Nuestro caso (entrenar con imágenes **de ChatGPT**, no de FLUX) no cae ahí.

### Imágenes de ChatGPT como datos de entrenamiento

Términos de uso de OpenAI (copia en [open.windriver.com](https://open.windriver.com/info/uni-license-list/licenses/openai-tou-20241211.html)
de la versión del 11-12-2024; **la página oficial devolvió 403, y la versión vigente en 2026 no la he podido comprobar**):

- «you (a) retain your ownership rights in Input and (b) own the Output», y «We hereby assign to you all our right,
  title, and interest, if any, in and to Output» (con la salvedad «to the extent permitted by applicable law»).
- Restricciones: no se puede «Use Output to develop models that compete with OpenAI».

Lectura **[inferencia, no es asesoría legal]**: la propiedad es nuestra; un LoRA de estilo para un videojuego no parece un
«modelo que compite con OpenAI», pero la cláusula no define «competir» y **no hay fuente que lo aclare para este caso**.
Además, las imágenes ya están en el juego. Otras cuestiones (derechos de autor de salidas de IA; términos específicos
de la generación de imágenes de ChatGPT) **[sin fuente]**.

## 5. Alternativas sin entrenar

| Opción | Estado en sd.cpp con FLUX.3 | Fuente |
|---|---|---|
| IP-Adapter | **No**: solo SD 1.5 y SDXL (incluido Plus) | [`ip_adapter.md`](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/ip_adapter.md) |
| Imágenes de referencia `-r` (hasta 10, repetible) | **Sí** en FLUX.3 y FLUX.2 Klein; preset `flux2`; la imagen se reescala (por defecto `vae_input_max_pixels` = 1 048 576) | [`flux3.md`](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/flux3.md), [`edit.md`](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/edit.md) |
| Prompt «cine2» + gradación | probado: lo más cercano hasta ahora | [`banco/resultados.md`](banco/resultados.md), r3 |

- `-r` está pensado para edición (BFL: «hasta 10 referencias»). **No hay fuente que lo recomiende como transferencia de
  estilo**; la medición de referencias múltiples sigue pendiente en `IMG-1` y, según el plan, FLUX.3 con `-r` «no arranca en
  la Deck» (README G). Probarlo con una banner de ChatGPT como referencia + «redibuja esta escena en el estilo de la
  referencia» es barato y no necesita entrenar, pero consume memoria.
- Otra vía sin entrenar: **posprocesado** (gradación de color de los banners, p. ej. con una curva LUT) para acercar la paleta,
  ya que el banco dice que el sobreprocesado de FLUX.3 es el problema. **[sin fuente, idea mía]**

## Recomendación

1. **Por ahora, no entrenar.** No se puede en la Deck, y alquilar no está en el plan. Seguir con `cine2`/`realista` y el
   ajuste del prompt (ya cercano según el banco).
2. **Barato y sin riesgo, cuando haya memoria:** actualizar sd.cpp a una versión con el PR #2214 y probar con el LoRA
   «photo aesthetics» de SimpleTuner (`--lora-model-dir` + `<lora:...:0.6>`, 16 pasos CFG 1) en un banner de prueba, para
   ver si el formato carga y si quita el sobreprocesado. Si carga, también servirá para validar cualquier LoRA propio.
3. **Probar `-r`** con un banner de ChatGPT como referencia de estilo en FLUX.3 (una sola imagen), midiendo tiempo y
   memoria (enlaza con `IMG-1`).
4. **Si la usuaria acaba aceptando alquilar una hora:** (a) leer el texto de la FLUX Kommunity License sobre LoRAs y
   salidas, (b) entrenar sobre **flux-3-image-klein-base** con 30-40 banners recortados a ≥1024 px (los de 1983×793 hay que
   recortarlos, no reescalarlos), subtítulos de contenido y palabra disparadora, 1500-2000 pasos, LR 1e-4 con ai-toolkit
   o SimpleTuner, y (c) comprobar *antes* que el `.safetensors` carga en sd.cpp. Coste esperado: del orden de 2-5 USD
   **[inferencia]**.
5. **No usar** LoRAs de FLUX.2 Klein en FLUX.3, ni los de 9B (licencia no comercial) en el juego.

## Lo que no se pudo confirmar

- Texto de la FLUX Kommunity License (gated).
- Si el PR #2214 de sd.cpp arregla los LoRAs de diffusers de FLUX.3 y si sd.cpp aplica bien LoRAs sobre Q8_0.
- Civitai (no accesible por la búsqueda); ficha de varios LoRAs listados solo por la API.
- Cifras de VRAM y tiempo de entrenamiento de FLUX.3 Image Klein; soporte de kohya/OneTrainer.
- Entrenamiento en CPU o en ROCm `gfx1033`.
- Términos vigentes de OpenAI en 2026 (solo la versión de 2024-12-11 en una copia).
