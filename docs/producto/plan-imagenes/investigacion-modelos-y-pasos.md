# Investigación: modelos de edición por pasos, LoRAs y flujos de la comunidad (2026-11-07)

Encargo: qué modelo, LoRA y técnica mejoran el flujo «fondo → sujeto → equipo → rasgos → Final» con `-r` en sd-cli, en la Deck
(16 GB unificados, `--params-backend disk --max-vram vulkan0=2`, 44 GB libres). No se descargó ni se generó nada.
No repite `investigacion-motor.md`, `investigacion-comunidad.md` ni `investigacion-control-forma.md`.

**Fuentes:** [P] primaria (README/docs de sd.cpp, fichas y árboles de Hugging Face leídos por API el 2026-11-07), [C] comunidad
(workflows y guías de terceros), [E] estimación mía, sin fuente, a medir. Reddit no se pudo leer con las herramientas de la sesión:
**no hay hilos de r/StableDiffusion ni r/comfyui citados**; lo de comunidad sale de RunComfy, Civitai, Stable Diffusion Art y fichas HF.

## Resumen

1. sd.cpp master (README, 2026-11-07) admite como modelos de **edición**: FLUX.1-Kontext-dev, Qwen Image Edit (original, 2509, 2511),
   FLUX.2/FLUX.3 klein (con `-r`), LongCat Image Edit, Boogu Image Edit, Mage-Flow-Edit, LLaDA-Image, Fibo 2.0 Edit Turbo [P:
   https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/edit.md]. **No** aparecen OmniGen, HiDream-E1 ni Z-Image-Edit.
2. **Z-Image-Edit**: Alibaba lo anunció (paper y boletín de nov-2025), pero no encontré repo de pesos publicado y sd.cpp no lo lista [C, sin
   confirmar]. No es candidato.
3. **El salto más barato y probable es klein 9B** (mismo motor `flux2`, mismos flags): Q4_0 = 5,62 GB, Q8_0 = 9,98 GB; texto Qwen3-8B
   (Q4_K_M 5,03 GB) [P]. Licencia no comercial (la 4B es Apache-2.0) [P].
4. **Qwen-Image-Edit-2511** es el que mejor conserva identidad según su ficha, pero pesa 7,7-22 GB más un Qwen2.5-VL-7B de 4-8 GB: en 16 GB
   solo cabe cuantizado a Q3/Q4 y va a ser lento [E]. Requiere `--model-args qwen_image_zero_cond_t=true` [P].
5. **Kontext dev** (12B, Q4_K_M 6,93 GB) funciona con `-r` pero necesita T5-XXL + CLIP-L y es más viejo que klein; licencia no comercial.
6. LoRAs reales y compatibles en formato con klein 9B: **Consistency** (dx8152, 0,33 GB, Apache-2.0), **Delight** (relight neutro), **RefControl**
   pose/depth. Para Qwen: **Multiple-Angles** (fal, 0,3 GB) y **Lightning 4/8 pasos** (0,85 GB). Ninguno probado en sd.cpp por mí.
7. sd-cli tiene `--ref-image-args` (presets por modelo), `--image-preprocess` por `ref`/`mask`/`init`, y `--cache-mode easycache|dbcache|taylorseer|
   cache-dit|spectrum` para DiT [P].
8. La comunidad ataca la deriva con: ancla fija (siempre la referencia original, no solo el paso anterior), LoRA de consistencia,
   FaceDetailer tardío y de baja fuerza, y hoja de personaje [C]. Las ediciones encadenadas degradan la calidad [C].
9. Para la Final: no hay un «refinador» estándar documentado para edición; lo aplicable es hires/`img2img` con `strength_as_noise_level`
   (ya en `investigacion-motor.md`) y RealESRGAN.
10. Todo tamaño de abajo es de fichero; la **memoria pico es [E]**.

## 1. Modelos candidatos

Estado en sd.cpp: cada doc enlazado es [P] (rama master). Versión en la que entró cada modelo: **no verificada** (no leí el historial de PR).
Nuestro binario es `95ff762`/`290148d`; el `--help` del binario manda sobre este documento.

### 1.1 FLUX.2 klein 9B (y base 9B)
- sd.cpp: sí, [flux2.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/flux2.md) [P]. Edición con `-r`, euler, 4 pasos, cfg 1 (distilada); base: cfg 4, 20 pasos [P].
- GGUF: [leejet/FLUX.2-klein-9B-GGUF](https://huggingface.co/leejet/FLUX.2-klein-9B-GGUF) Q4_0 5,62 GB, Q8_0 9,98 GB [P]. Más cuantizaciones en
  [unsloth/FLUX.2-klein-9B-GGUF](https://huggingface.co/unsloth/FLUX.2-klein-9B-GGUF): Q2_K 3,40, Q3_K_M 4,77, Q4_K_M 5,67, Q4_K_S 5,83, Q5_K_M 7,02, BF16 18,16 GB [P].
  Base: [leejet/FLUX.2-klein-base-9B-GGUF](https://huggingface.co/leejet/FLUX.2-klein-base-9B-GGUF) (Q4_0 5,62, Q8_0 9,98).
- Texto: **Qwen3-8B** (no el 4B) con `--llm`: [unsloth/Qwen3-8B-GGUF](https://huggingface.co/unsloth/Qwen3-8B-GGUF) Q4_K_M 5,03, Q5_K_M 5,85, Q8_0 8,71 GB [P].
  VAE: el de FLUX.2 (`flux2-vae`, ya descargado) [P].
- Memoria pico [E]: Q4_0 + Qwen3-8B Q4_K_M ≈ 10,7 GB de pesos, más activaciones; entra en los 16 GB con `--params-backend disk`.
  Tiempo: ≈2-2,5 veces el de la 4B por parámetros [E].
- Identidad/composición: la 9B es la que usan los workflows de consistencia de la comunidad [C]; el autor de un workflow de ángulos dice que la 9B es
  «más consistente» que la 4B [C: https://civitai.com/models/2642426/flux-klein-4b9b-multiple-angles].
- Licencia: **FLUX non-commercial** (9B) [P: ficha HF `black-forest-labs/FLUX.2-klein-9B`]. La 4B es Apache-2.0 [P].
- Variante KV: [QuantStack/FLUX.2-Klein-9B-KV-GGUF](https://huggingface.co/QuantStack/FLUX.2-Klein-9B-KV-GGUF); **sd.cpp no la menciona** en flux2.md [P]: no la recomiendo sin probar.

### 1.2 Qwen-Image-Edit 2511 (y 2509)
- sd.cpp: sí, [qwen_image_edit.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/qwen_image_edit.md) [P]. cfg 2.5, euler, `--flow-shift 3`; 2509 añade `--llm_vision` (mmproj); **2511: `--model-args qwen_image_zero_cond_t=true`** («sin él la calidad cae mucho») [P].
- GGUF 2511: [unsloth/Qwen-Image-Edit-2511-GGUF](https://huggingface.co/unsloth/Qwen-Image-Edit-2511-GGUF): Q2_K 7,74; Q3_K_S 9,27; Q3_K_M 9,92; Q4_0 11,85; Q4_K_S 12,47; Q4_K_M 12,84; Q5_K_M 15,40; Q6_K 17,95; Q8_0 22,35 GB [P].
- GGUF 2509: [QuantStack/Qwen-Image-Edit-2509-GGUF](https://huggingface.co/QuantStack/Qwen-Image-Edit-2509-GGUF): Q2_K 7,15; Q3_K_S 9,04; Q4_0 11,93; Q4_K_S 12,20; Q4_K_M 13,07 GB [P].
- Texto: **Qwen2.5-VL-7B** [mradermacher/Qwen2.5-VL-7B-Instruct-GGUF](https://huggingface.co/mradermacher/Qwen2.5-VL-7B-Instruct-GGUF): Q4_K_M 4,68; Q8_0 8,10; mmproj-Q8_0 0,85 GB [P].
  VAE: [Comfy-Org/Qwen-Image_ComfyUI](https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/tree/main/split_files/vae) (≈0,25 GB [E]) [P].
- Memoria pico [E]: Q3_K_S + VL Q4_K_M ≈ 14 GB de pesos: en el límite de los 16 GB; Q4 ≈ 17 GB, no cabe sin disco. Será el más lento (20B) [E].
- Fortalezas: ficha dice mejor consistencia de identidad en 2511 [C: https://docs.comfy.org/tutorials/image/qwen/qwen-image-edit-2511]. Entiende texto y tiene LoRAs de ángulos.
- Licencia: Apache-2.0 [P: ficha HF `Qwen/Qwen-Image-Edit-2511`].

### 1.3 FLUX.1 Kontext dev
- sd.cpp: sí, [kontext.md](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/kontext.md) [P]. cfg 1, euler, `-r`.
- GGUF: [QuantStack/FLUX.1-Kontext-dev-GGUF](https://huggingface.co/QuantStack/FLUX.1-Kontext-dev-GGUF): Q3_K_M 5,37; Q4_K_M 6,93; Q5_K_M 8,42; Q6_K 9,85; Q8_0 12,71 GB [P].
- Texto: `clip_l` + `t5xxl_fp16` ([comfyanonymous/flux_text_encoders](https://huggingface.co/comfyanonymous/flux_text_encoders), T5 fp16 ≈ 9-10 GB [E]; una T5 GGUF Q8 ≈ 5 GB [E, sin verificar]). VAE: `ae.safetensors` de FLUX.1-dev (distinto del de FLUX.2) [P].
- Fortalezas: edición «de texto/objeto» robusta, muchas LoRAs (relight, turnaround) [C]. Debilidad: los encadenados largos degradan [C]. Licencia: FLUX.1-dev non-commercial [P].

### 1.4 Otros del README de sd.cpp que editan
- **LongCat Image Edit** [P: docs/longcat_image.md]: [stduhpf/LongCat-Image-Edit-gguf](https://huggingface.co/stduhpf/LongCat-Image-Edit-gguf) Q4_K_M 3,74 GB, Q8_0 6,79 GB, Apache-2.0 [P]. El más pequeño; texto Qwen2.5-VL [E]. Sin comparativas de identidad: [E] vale una prueba.
- **Boogu Image Edit** (Apache-2.0, preset `z_image_omni`, arquitectura cercana a Z-Image) [P: edit.md]: GGUF en [realrebelai/Boogu-Image-Edit_GGUFs](https://huggingface.co/realrebelai/Boogu-Image-Edit_GGUFs); tamaños no verificados. Es lo más cercano a un «Z-Image Edit» que corre en sd.cpp.
- **Mage-Flow-Edit**, **LLaDA-Image Edit**, **Fibo 2.0 Edit Turbo**: listados [P]; sin datos de calidad ni tamaño míos.
- **Chroma**: solo texto→imagen en la lista de sd.cpp [P]. **OmniGen2**, **HiDream-E1**: ausentes del README [P]; no sirven. (Existe «HiDream-O1-Image» en sd.cpp, no es E1.)
- Z-Image Turbo no edita; el uso de `-r` con él no está documentado [P].

### 1.5 Tabla final (máx. 4)

| # | Modelo | Ficheros | GB | URL |
|---|---|---|---|---|
| 1 | **klein 9B Q4_0** (primera prueba) | modelo + Qwen3-8B Q4_K_M | 5,62 + 5,03 = **10,65** (+0,33 LoRA Consistency) | https://huggingface.co/leejet/FLUX.2-klein-9B-GGUF · https://huggingface.co/unsloth/Qwen3-8B-GGUF |
| 1b | klein 9B Q8_0 (si el Q4 pierde detalle) | solo modelo | 9,98 | mismo repo |
| 2 | **Qwen-Image-Edit-2511 Q3_K_S** (si hay RAM) | modelo + Qwen2.5-VL Q4_K_M + VAE | 9,27 + 4,68 + ≈0,25 = **≈14,2** | https://huggingface.co/unsloth/Qwen-Image-Edit-2511-GGUF · https://huggingface.co/mradermacher/Qwen2.5-VL-7B-Instruct-GGUF |
| 3 | **LongCat Image Edit Q4_K_M** (sonda barata) | modelo (+ texto Qwen2.5-VL ya bajado en 2) | 3,74 | https://huggingface.co/stduhpf/LongCat-Image-Edit-gguf |
| 4 | Kontext dev Q4_K_M (solo si 1 y 2 fallan) | modelo + CLIP-L + T5 + VAE FLUX.1 | 6,93 + ≈5-10 | https://huggingface.co/QuantStack/FLUX.1-Kontext-dev-GGUF |

Total de 1+2+3 ≈ **28,6 GB** de 44 libres (tras sumar LoRAs ≈ 29,5). Recomiendo bajar solo el 1 primero (10,65 GB): comparte motor y flags con lo que ya funciona.

## 2. LoRAs

sd.cpp carga LoRA con `<lora:nombre:peso>` en el prompt y `--lora-model-dir`; con modelos cuantizados usa `at_runtime` (más lento, más compatible); se puede forzar con `--lora-apply-mode` [P: docs/lora.md].
El doc **no** dice qué LoRAs de klein/Qwen son compatibles: toda compatibilidad de abajo es **[E] hasta probarla**.

| LoRA | Para | Tamaño | Licencia | URL |
|---|---|---|---|---|
| Flux2-Klein-9B-Consistency V2 (dx8152) | conservar identidad/estilo al editar, sin palabras clave [C] | 0,33 GB | Apache-2.0 | https://huggingface.co/dx8152/Flux2-Klein-9B-Consistency |
| Flux2-Klein-Delight (linoyts) | relight neutro (quita luz existente) | 0,13 GB (v2) | «other» | https://huggingface.co/linoyts/Flux2-Klein-Delight-LoRA |
| refcontrol klein 9B pose / depth; 4B depth (thedeoxen) | pose/profundidad desde una imagen de referencia (entrenados sobre base) | 0,17 / 0,09 GB | Apache-2.0 | https://huggingface.co/thedeoxen/refcontrol-FLUX.2-klein-9B-reference-pose-lora |
| Qwen-Image-Edit-2511-Multiple-Angles (fal) | 96 poses de cámara (4 elevaciones × 8 azimuts × 3 distancias) | 0,30 GB | Apache-2.0 | https://huggingface.co/fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA |
| Qwen-Image-Edit-2511-Lightning 4/8 pasos (lightx2v) | acelera ≈10× (4 pasos) | 0,85 GB bf16 | Apache-2.0 | https://huggingface.co/lightx2v/Qwen-Image-Edit-2511-Lightning |
| Kontext relighting v3 | relight en Kontext | no medido | no verificada | https://huggingface.co/kontext-community/relighting-kontext-dev-lora-v3 |

- «Next scene», sin fuente concreta: **no encontré** un LoRA «next scene» verificable para estos modelos.
- Los «multiangle» de klein son un workflow, no un LoRA [C: Civitai 2642426]. Los LoRA entrenados sobre **base** (refcontrol, Delight) pueden rendir distinto sobre la klein destilada [E].
- Entrenar uno propio: BFL recomienda los Base para fine-tuning, 1500-3000 pasos para personaje [C: https://docs.bfl.ml/flux_2/flux2_klein_training].
- Aviso: el 4B y el 9B no comparten LoRAs (distinta dimensión) [E]; nuestro LoRA propio es de estilo para la 4B y no valdrá para la 9B [E].

## 3. Flujos por pasos de la comunidad

Lo que encontré son guías y workflows de pago o de RunComfy, no repos con código. Nada se leyó de Reddit.
- **Consistent Character Creator 4.0** (RunComfy): una referencia → 24 tomas con klein 9B FP8 + LoRA de consistencia + «latent-space identity guidance»; variante con upscaler y FaceDetailer [C: https://www.runcomfy.com/comfyui-workflows/consistent-character-creator-4-0-comfyui-flux-2-dataset].
- **Pila clásica** (adaptador de identidad + ControlNet de pose + FaceDetailer tras la generación): el adaptador sesga hacia la referencia pero no garantiza; deriva en ángulos y expresiones difíciles [C: https://flick.art/blog/img2img-consistent-character/comfyui].
- **Kontext encadenado**: se descompone en ediciones pequeñas, pero «demasiadas ediciones seguidas» meten artefactos [C: https://huggingface.co/blog/MonsterMMORPG/flux-kontext-dev-detailed-local-windows-tutorial].
- **FLUX.2 multi-referencia** (hasta 10) reduce la necesidad de cadenas largas [P/C: https://docs.comfy.org/tutorials/flux/flux2-dev].

### Técnicas de deriva aplicables con sd-cli [E de adaptación]
1. **Ancla fija**: pasar al paso N dos `-r`: la salida del paso N-1 *y* la imagen de identidad (retrato del sujeto del paso «rasgos»), nombradas en el prompt («Image 1 is the scene; image 2 defines the face and tusks»). klein admite multi-referencia [P: `-r` repetible en edit.md; límite exacto no verificado].
2. **Inpaint de cara/rasgos** con `--mask` + `-r`: editar solo el recorte, y pegar. La técnica «rellenar con color y pegar con máscara» ya está en `investigacion-comunidad.md`. Pega el recorte con ffmpeg, no se re-renderiza el resto.
3. **Recorte-y-edición a mayor resolución**: recortar la cabeza, editarla a 768 px, reducir y pegar (el equivalente manual de FaceDetailer). `--image-preprocess "target=ref,index=0,mode=fit-pad,..."` ayuda a fijar tamaño de las referencias [P].
4. **Semilla barata**: antes del paso caro, 3-4 semillas del paso «rasgos» a 480x192 y elegir; la identidad depende de la semilla, y eso cuesta 20-45 s cada una.
5. **LoRA de consistencia** (§2) sin palabras clave, como red de seguridad en todos los pasos [C].
6. **Pase final**: sin refinador documentado. Opciones: Final corta (ya la tenéis), `img2img` con `strength_as_noise_level` bajo (motor.md) y RealESRGAN. Un segundo modelo refinador no tiene fuente.

## 4. Opciones recientes de sd-cli

- `--ref-image-args "preset=...,clave=valor"` [P: edit.md]. Presets: `flux_kontext`, `longcat`, `flux2`, `fibo2`, `qwen`, `qwen_layered`, `z_image_omni`, `krea2_ostris_edit`, `mage_flow`, `krea2_edit`, `cosmos_reference`, `default`; si se omite se elige por arquitectura. Claves: `ref_index_mode` (`fixed|increase|decrease`, la posición RoPE de cada referencia), `pass_to_vlm`, `pass_to_dit`, `vlm_use_vae_input`, `vae_input_max_pixels` (por defecto 1024×1024), `resize_before_vae`, `vae_center_crop`, `vlm_max_size`…
  Útil [E]: `ref_index_mode=increase` con varias `-r` para que no se confundan; `vae_input_max_pixels` baja para ahorrar memoria/tiempo en referencias grandes.
- `--image-preprocess` repetible, objetivos `init|end|mask|control|ref|ip-adapter|id`, modos `crop|crop-resize|fit-pad|stretch`, `filter`, `pad_color`, `canny=true` [P: docs/image_preprocessing.md]. Esto sustituye al ffmpeg previo para recortar/rellenar las `-r`. El doc **no** cubre máscaras con modelos de edición: probar `--mask` con `-r` en klein es [E].
- **Caché** [P: docs/caching.md]: `--cache-mode easycache|dbcache|taylorseer|cache-dit|spectrum` (DiT) con `--cache-option "k=v"`; ejemplos: `easycache` threshold 0,3; `dbcache` threshold 0,25, warmup 4. El doc **no da aceleraciones medidas** y dice que más pasos = más oportunidades de caché; con 4 pasos de klein distilada probablemente ganan poco [E]. Pueden probarse en la Final (16 pasos en FLUX.3). `--conditioning-cache-size 4` cachea el condicionamiento del prompt (por defecto 0 en `sd-cli`): útil al repetir el mismo prompt con semillas [P].
- `--flash-attn`, `--conv-direct`, `--disable-image-metadata` y la guía `--linear-scale`/`--attn-scale` para NaN/negro [P: examples/cli/README.md].
- `--lora-apply-mode immediately|at_runtime` [P]. `--offload-to-cpu` en todos los ejemplos [P].
- Control para Flux: solo FLUX.1 Canny/Depth-dev y Flex.2 (control_image) (control-forma.md); ControlNet general solo SD1.5 [P: README].

## 5. Qué no se pudo comprobar
- Versión de sd.cpp en que entró cada modelo; si nuestros commits `95ff762`/`290148d` admiten `--ref-image-args` y 2511 (se comprueba con `sd-cli -h`).
- Multi-referencia: número máximo de `-r` y su efecto en la memoria de la Deck.
- Memorias pico y tiempos de 9B/Qwen/Kontext en la Deck: todo [E].
- Cualquier hilo de Reddit; la existencia real de Z-Image-Edit.
