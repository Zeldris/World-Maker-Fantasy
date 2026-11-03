# Investigación: LoRA en GPU gratis y referencia sin entrenar (2026-11-02, `IMG-29`)

Continúa [`investigacion-lora.md`](investigacion-lora.md) y [`investigacion-control-forma.md`](investigacion-control-forma.md)
(2026-10-26); no repite lo que dicen. Restricción de la usuaria (2026-11-02): GPU gratis sí, pagar no. **No se lanzó
ninguna generación ni descarga.**

**Convención.** **[V]** leí la fuente primaria (repo, PR, issue, ficha, documentación oficial); **[S]** solo secundaria,
buscador o resumen; **[E]** estimación mía sin fuente (hay que medirla). Una fuente que no se pudo leer lo dice.

## Resumen

1. **Pregunta 1: sí.** El PR #2214 de sd.cpp (fusionado el 25-10-2026, commit `bb6a0cc`) renombra las claves de LoRAs
   FLUX.3 en formato diffusers/PEFT; **no hace falta convertir**. Con `-r` aplica 516/516 tensores; en txt2img 456/516
   (los 60 restantes son de `image_cond` y no se evalúan sin referencia). Nuestro `sd-cli` (`95ff762`) es anterior: hay
   que recompilar.
2. **Pregunta 2: es viable gratis pero ajustado.** Hay scripts oficiales de diffusers (`train_dreambooth_lora_flux3_klein.py`),
   SimpleTuner y ai-toolkit para FLUX.3. Nadie publica cifras para una T4 de 16 GB; el único dato de poca VRAM es una
   conversión NF4 de la comunidad (5,7 GB a 1024², 3,9 s/paso en RTX 5080) y no es de BFL. Kaggle (P100/T4x2) es el candidato;
   ZeroGPU (5 min/día) y el entrenamiento en CPU quedan descartados.
3. **Pregunta 3: no hay adaptador de imagen.** IP-Adapter en sd.cpp es solo SD 1.5 y SDXL; no hay Redux ni ControlNet para
   FLUX.3. Lo único distinto de `-r` a secas es `--ref-image-args` (p. ej. `pass_to_vlm=true`, que en el preset `flux2`
   viene desactivado): **sin prueba ni fuente de que fije el sujeto**; es barato de probar.
4. **Recomendación: LoRA en Kaggle, tras una prueba previa de formato y de memoria** (detalle al final). Sigue valiendo la
   cadena de planos (`IMG-27`) como plan B.

## 1. ¿sd.cpp carga LoRAs de FLUX.3 Image Klein?

| Hallazgo | Fuente | Ver. |
|---|---|---|
| PR #2214 «feat: support FLUX.3 Diffusers LoRA tensor names», **fusionado en `master` el 25-10-2026**, commit `bb6a0cc`. Solo toca `src/name_conversion.cpp`; añade un conversor de nombres para FLUX.3. | [PR #2214](https://github.com/leejet/stable-diffusion.cpp/pull/2214), [commit](https://github.com/leejet/stable-diffusion.cpp/commit/bb6a0cc) | [V] |
| El PR cierra el [issue #2212](https://github.com/leejet/stable-diffusion.cpp/issues/2212) («0 / 516 tensores»). Cierra con «cerrado como completado». | issue #2212 | [V] |
| Formato que espera: **diffusers/PEFT**. Mapeo: `transformer.single_transformer_blocks.N.*` → `single_blocks.N.*`; `transformer.mode_blocks.{image,image_cond}.N.*` → `content_mode_blocks.{image,image_cond}.N.*`; `transformer.txt_mode_blocks.N.*` → `txt_mode_blocks.N.*`; `attn.to_q/k/v` → `q_proj/k_proj/v_proj`; `attn.to_out.0` → `attn_out`; `ff.linear_in/out` → `mlp_in/mlp_out`. Capas 1:1, sin QKV fusionado. | issue #2212 | [V] |
| Resultado del autor: txt2img **456/516** (los 60 restantes son `image_cond`, no se evalúan sin referencia); edición con `-r` **516/516**; con la misma semilla el LoRA cambia el ángulo de cámara. Probado en ROCm gfx906, con el LoRA `akhaliq/flux-3-image-klein-angles-lora`; **no se probó con un GGUF Q8_0 ni en CPU**. | issue #2212 | [V] |
| Pendiente del PR: CodeRabbit señaló que faltaba `transformer.txt_mode_blocks.` → `txt_mode_blocks.`; el issue lo lista como ya mapeado, pero la página del PR no confirma que se añadiera antes de fusionar. | PR #2214 | [V] (ambigüedad) |
| Qué sale de los trainers: diffusers/SimpleTuner guardan `pytorch_lora_weights.safetensors` (diffusers/PEFT) → **sirve sin convertir**. El trainer de AcademiaSD exporta `diffusion_model.<capa>.lora_A/lora_B` con nombres originales de BFL (valido en ComfyUI): **no sabemos si sd.cpp lo carga**; habría que probarlo o evitarlo. | [guía SimpleTuner](https://github.com/bghira/SimpleTuner/blob/main/documentation/quickstart/FLUX3_IMAGE.md), [ficha AcademiaSD](https://huggingface.co/AcademiaSD/FLUX.3-Image-Klein-NF4-for-LoRA-Training) | [V] |
| Uso: `--lora-model-dir <dir>` + `<lora:nombre:peso>` en el prompt; `at_runtime` por defecto con modelo cuantizado (ver `investigacion-lora.md`). `docs/flux3.md` sigue sin mencionar LoRA. | [flux3.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/flux3.md) | [V] |
| Releases: la última leída es `master-1039-290148d` (1-nov); `master-1024` es del 28-oct. **No pude localizar el tag exacto que contiene `bb6a0cc`** (las páginas de releases/tags solo mostraban desde `master-1024`; la API devolvió texto truncado). Vale cualquier `master` posterior al 25-10 (≥ ~`master-1015`, **[E]** por fecha). | [releases](https://github.com/leejet/stable-diffusion.cpp/releases) | [V] parcial |

**Respuesta:** sí, desde el 25-10-2026 y sin convertir, si el LoRA sale en diffusers/PEFT. Aplicar sobre Q8_0 en CPU sin probar.

## 2. Entrenar gratis un LoRA de estilo

### 2.1 Trainers

| Trainer | Soporte FLUX.3 Image Klein y datos de memoria | Fuente | Ver. |
|---|---|---|---|
| **diffusers** | Scripts `train_dreambooth_lora_flux3_klein.py` (texto→imagen) y `..._img2img.py` (edición). Recomienda entrenar sobre `flux-3-image-klein-base`. Ejemplo: 1024 px, buckets, batch 1, rank 16, alpha 16, LR 1e-4, 1500 pasos. Ahorros: `--gradient_checkpointing`, `--cache_latents`, `--use_8bit_adam`. **Sin tiempos ni VRAM mínima de entrenamiento.** Cargar con `BFLQuantizationConfig`: fp8r exige capacidad de cómputo ≥ 8.9 (T4 es 7.5: dequantiza en cada paso); nvfp4 solo Blackwell. | [blog HF FLUX.3](https://huggingface.co/blog/flux-3) | [V] |
| **SimpleTuner** | Guía `FLUX3_IMAGE.md`. Recetas `klein-base` PEFT-LoRA para **24, 32, 48, 80 y 144 GB** (la menor: 24 GB, batch 3 a 512 px); destilado: 24 GB a 768 px. Rank 32, LR 1e-4. **La guía no menciona cuantización ni offload.** Nada para 16 GB. | [guía](https://github.com/bghira/SimpleTuner/blob/main/documentation/quickstart/FLUX3_IMAGE.md) | [V] |
| **ai-toolkit** | `black-forest-labs/flux-3-image-klein-base` figura como soportado; el README solo pide «GPU Nvidia con suficiente RAM» y **no cita Colab, Kaggle, `low_vram` ni cuantización**; no encontré un YAML de ejemplo de FLUX.3 en `config/examples` (lista parcial, sin `flux3`). BFL dice que ai-toolkit y diffusers lo soportan «desde el día uno». | [README](https://github.com/ostris/ai-toolkit), [BFL](https://bfl.ai/blog/flux-3-image-klein) | [V] |
| **AcademiaSD NF4** (comunidad, no oficial) | Conversión NF4 del base «desde ~8 GB»; medido en RTX 5080, rank 16: **5,7 GB a 1024², 4,2 GB a 512²; 3,9 s/paso a 1024², 0,7 s/paso a 512²**. Solo con su trainer (LoRAlab Trainer Studio); el transformer no lo carga diffusers ni ComfyUI. La ficha enlaza notebooks de Colab y Kaggle pero **no dice que sirvan para este modelo**. | [ficha](https://huggingface.co/AcademiaSD/FLUX.3-Image-Klein-NF4-for-LoRA-Training) | [V] |
| kohya sd-scripts, OneTrainer | Sin fuente de FLUX.3 (no se buscó de nuevo; igual que el 26-10). | — | sin fuente |
| **CPU** | Ningún trainer lo documenta. **[E]** con 3,9 s/paso en una 5080 y la Deck sin GPU útil (≥100× más lenta): ≥ 100 h por 1000 pasos, es decir, inviable. | — | [E] |

### 2.2 ¿Cabe en la GPU gratis?

| Hallazgo | Fuente | Ver. |
|---|---|---|
| Kaggle: P100 (16 GB) o T4x2 (2×16 GB). Cuota semanal «de 30 h o más» (cuota flotante), reinicio semanal, sesión de hasta 12 h. **Las páginas oficiales (`/docs/notebooks`, `/docs/efficient-gpu-usage`, el anuncio de cuota flotante) no devolvieron texto útil al leerlas; las cifras vienen de resultados de búsqueda de foros y de documentos de Kaggle citados por terceros.** Hay que confirmarlas en el panel de Kaggle de la usuaria. | [efficient-gpu-usage](https://www.kaggle.com/docs/efficient-gpu-usage), [cuota flotante](https://www.kaggle.com/product-feedback/173129) | [S] |
| Colab gratis: sesión «como mucho 12 h según disponibilidad», desconexión por inactividad, **límites no publicados**, GPU «varía con el tiempo» (la FAQ no nombra la T4). | [FAQ de Colab](https://research.google.com/colaboratory/faq.html) | [V] |
| ZeroGPU: 5 min/día de GPU con cuenta gratuita (40 PRO), función de 60 s por defecto, solo Gradio, GPU RTX Pro 6000 Blackwell de 48 GB. **Sirve para inferencia, no para entrenar 2 h.** | [doc ZeroGPU](https://huggingface.co/docs/hub/spaces-zerogpu) | [V] |
| T4/P100 no tienen bf16 nativo (P100: cc 6.0; T4: 7.5); los scripts de FLUX.3 usan bf16. **[E]** el entrenamiento irá en fp16 o bf16 emulado y más lento; sin fuente de que funcione. | — | [E] |
| Estimación de tiempo en T4/P100 (**[E]**, a medir): 3,9 s/paso en una 5080 ×5-8 = ~20-30 s/paso a 1024² con NF4; a 1280×512 (el 62 % de los píxeles) ~12-20 s/paso. 1000-2000 pasos = **3-11 h**, repartidas en 1-2 sesiones con puntos de guardado. Si el modelo ni cabe en 16 GB, el entrenamiento no arranca. | cálculo propio | [E] |
| Datos: BFL pide 15-40 imágenes de ≥1024 px, 1500-2500 pasos y variedad de poses/ángulos; nosotros tenemos ~135 a 1280×512 (pocas de ≥1024 de alto: **se entrenaría en cubos de aspecto, no recortando**). | [BFL](https://docs.bfl.ai/flux_2/flux2_klein_training) (FLUX.2 Klein, extrapolado) | [V] |

**Exportar:** diffusers/SimpleTuner → `pytorch_lora_weights.safetensors` → `--lora-model-dir`. Entrenar sobre el **base** y usar sobre el
destilado (16 pasos, CFG 1) es lo que hacen los LoRAs de SimpleTuner ([laboratorio](https://huggingface.co/SimpleTuner/flux-3-klein-image-LoRA-experiments), [V]); el Klein destilado se puede afinar con LoRA aplicando el del base **[E]**, a medir.
**Licencia:** sigue sin leerse el texto de la FLUX Kommunity License (con login); BFL dice que la comercial gratuita llega hasta 5 M USD ([BFL](https://bfl.ai/blog/flux-3-image-klein), [V]).

## 3. La misma criatura en otra escena, sin entrenar

| Hallazgo | Fuente | Ver. |
|---|---|---|
| sd.cpp: `-r` repetible, hasta 10; preset `flux2` para FLUX.2 y FLUX.3 (sin VLM, RoPE `increase`). | [flux3.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/flux3.md), [edit.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/edit.md) | [V] |
| **Mando fino: `--ref-image-args "k=v,..."`**: `pass_to_vlm` (pasar la referencia al codificador de texto Qwen3-VL), `pass_to_dit`, `ref_index_mode` (`fixed`/`increase`/`decrease`), `resize_before_vae`, `vae_center_crop`, `vae_input_max_pixels` (1 048 576 por defecto), `vlm_*`. Hoy usamos el preset por defecto, que **no** pasa la referencia al VLM. Nada en la doc dice que `pass_to_vlm` mejore la fidelidad al sujeto; el codificador de FLUX.3 sí es un VLM, por lo que es candidato **[E]**. Un banner 1280×512 (655 k px) cabe en el presupuesto de VAE sin reescalar. | edit.md | [V] / [E] |
| `diffusers` (FLUX.3): referencias en el prompt como `<ref_image_0>`, `<ref_image_1>`…; se marcan como contexto (timestep 0). **El blog no mide fidelidad al sujeto ni al estilo.** Una referencia ~duplica el tiempo por paso (H100: 1,93 s → 3,87 s). | [blog HF](https://huggingface.co/blog/flux-3) | [V] |
| BFL: «hasta 10 imágenes de referencia»; **no detalla** consistencia de sujeto ni de estilo. | [BFL](https://bfl.ai/blog/flux-3-image-klein) | [V] |
| Reseña independiente: consistencia multi-referencia «real pero de techo desconocido»; «control rápido, preservación imperfecta»; sin banco controlado. | [AIREITER](https://aireiter.com/blog/flux-3-image-klein-review-tested) | [S] |
| IP-Adapter: **solo SD 1.5 y SDXL** en sd.cpp. No hay Redux ni ControlNet para FLUX.3 (ver `investigacion-control-forma.md`). | [ip_adapter.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/ip_adapter.md) | [V] |
| Proyecto: r8/r9 con un banner como `-r` acercaron la paleta, no composición ni detalle. | `banco/resultados.md` | (propio) |

**Respuesta:** no hay un modo documentado que fije el sujeto. Lo único sin probar: `pass_to_vlm=true` (los marcadores `<ref_image_N>` son de diffusers; la doc de sd.cpp leída no los menciona). Si no funciona, el sujeto solo
se fija entrenando.

## Qué cambió desde el 2026-10-26

| Antes | Ahora |
|---|---|
| sd.cpp no aplicaba LoRAs diffusers de FLUX.3 (0/516); PR #2214 «no verificado». | **Fusionado el 25-10 (`bb6a0cc`)**; 516/516 con `-r`, 456/516 en txt2img. Aún sin prueba en Q8_0/CPU. |
| Entrenamiento sin cifras de FLUX.3. | Scripts de diffusers y guía de SimpleTuner para FLUX.3 (24 GB mínimo); conversión NF4 de la comunidad con 5,7 GB a 1024². Colab/Kaggle: sin guía publicada. |
| `-r` visto solo como edición. | `--ref-image-args` documentado (`pass_to_vlm`, `ref_index_mode`, etc.). |
| (no consultado) | ZeroGPU: 5 min/día gratis, no sirve; Colab sin límites publicados. |
| Pendiente de leer: texto de la Kommunity License; Civitai. | **Sigue pendiente.** |

## Recomendación

**Vía elegida: LoRA en GPU gratis (Kaggle), en dos pasos con puerta.** No es seguro que funcione: se decide con el primer paso.

| Paso | Qué | Usuaria (a mano) | Deck (máquina) |
|---|---|---|---|
| 0. Gratis y rápido, en la Deck | Recompilar sd.cpp ≥ `bb6a0cc`; cargar el LoRA `akhaliq/...angles` con `-r` y mirar «516/516 aplicados» sobre el **Q8_0**; probar `pass_to_vlm=true` con un banner como referencia (una imagen). | ~1 h | ~1-2 h (compilar + 1-2 imágenes de prueba a pocos pasos) |
| 1. Prueba de arranque en Kaggle | Cuenta con teléfono verificado, notebook con P100, diffusers + el script de LoRA de FLUX.3, 20 pasos, `--gradient_checkpointing --cache_latents --use_8bit_adam`; ver si cabe en 16 GB y el s/paso real a 1280×512 o 1024×512. | 2-3 h | 0 |
| 2. Entrenar | ~135 imágenes con subtítulos de contenido y palabra disparadora, 1000-2000 pasos, en 1-2 sesiones con guardado cada 250 pasos. | 3-4 h (subtítulos y subida del conjunto, lanzar, bajar) | 0 (Deck: probar el LoRA, ~49 min por imagen, 3-4 imágenes) |

Total estimado **[E]**: 8-12 h de la usuaria y ~4-6 h de la Deck; 3-11 h de GPU gratuita (dentro de la cuota de ~30 h/semana si se confirma).

**Riesgos:** (1) 16 GB sin bf16 puede no bastar para el transformer de 5,6 B (sin cifras para T4/P100); si el paso 1 falla, la vía se cae sin gasto. (2) El LoRA se prueba en Q8_0/CPU sin precedentes. (3) La licencia sobre LoRAs sigue sin leerse. (4) 135 banners de ChatGPT como datos: términos de OpenAI sin verificar (ver `investigacion-lora.md`). (5) El LoRA de estilo arregla acabado y textura, pero **la criatura concreta solo mejora si el conjunto la incluye**: conviene entrenar con las criaturas nuevas que más fallan, o añadir un LoRA por especie, lo que multiplica el trabajo.

**Qué comprobar primero:** el paso 0 (carga y aplicación del LoRA sobre el Q8_0 y `pass_to_vlm`). Si `pass_to_vlm` ya fija bien la criatura, la vía «referencia sin entrenar» basta y se ahorra el resto. Si el paso 1 no arranca en Kaggle, quedamos con **la cadena de planos (`IMG-27`)**.

## No se pudo leer o confirmar

- Texto de la FLUX Kommunity License (login). Páginas oficiales de Kaggle (devolvieron solo el título): cuota, GPUs y sesión vienen de resultados de búsqueda [S].
- Tag exacto de sd.cpp que contiene `bb6a0cc`. Si el mapeo `txt_mode_blocks` quedó en el PR.
- Cualquier cifra de entrenamiento de FLUX.3 en T4/P100; notebook de Colab/Kaggle de AcademiaSD; YAML de ai-toolkit para FLUX.3.
- Civitai; términos vigentes de OpenAI en 2026.
