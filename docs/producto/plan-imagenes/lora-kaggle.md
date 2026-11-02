# LoRA de estilo en Kaggle (`IMG-32`)

Pasos 1 y 2 de [`investigacion-lora-2.md`](investigacion-lora-2.md): entrenar con los banners GPT del juego un LoRA de
estilo de FLUX.3 Image Klein en una GPU gratis de Kaggle, y usarlo en la Deck con `sd-cli` (que ya aplica los LoRAs
de FLUX.3 enteros, 516/516 con `-r`: [`IMG-30`](../roadmap-imagenes.md)).

## Qué está hecho (Claude, en la Deck)

- **Conjunto:** `bash image-generator/lora/conjunto.sh` deja `image-generator/lora/conjunto/wmf-banners.zip`
  (134 banners a 1280×512, 191 MB; fuera del repo). La segunda versión `clan-serhu-banner2.png` se queda fuera.
- **Cuaderno:** [`image-generator/lora/entrenar.ipynb`](../../../image-generator/lora/entrenar.ipynb). Pone los
  textos con Qwen3-VL-2B (solo contenido, sin estilo, delante la palabra disparadora `wmfstyle`) y entrena con el
  script de diffusers 0.42.1 (`train_dreambooth_lora_flux3_klein.py`) sobre `flux-3-image-klein-base`: transformer en nf4
  calculando en fp32, VAE y Qwen3-VL en fp16 (la T4 no tiene bf16), cubos de 512×1280, lote 1, rank 16, LR 1e-4, guardado cada 250 pasos.

## Lo que hace la usuaria (una vez)

1. **Hugging Face:** con la sesión iniciada, abrir
   [`black-forest-labs/flux-3-image-klein-base`](https://huggingface.co/black-forest-labs/flux-3-image-klein-base),
   leer y aceptar la licencia (FLUX Kommunity License). En *Settings → Access Tokens*, crear un token de **lectura**.
2. **Kaggle:** cuenta en [kaggle.com](https://www.kaggle.com) y teléfono verificado (*Settings → Phone
   verification*; sin él no hay GPU ni Internet en el cuaderno).
3. **Dataset:** *Create → New Dataset*, subir `wmf-banners.zip`, privado. Nombre libre.
4. **Cuaderno:** *Create → New Notebook → File → Import Notebook*, subir `entrenar.ipynb`. En el panel derecho:
   *Accelerator* **GPU T4 x2**, *Internet* activado, *Add data* el dataset del paso 3, y *Add-ons → Secrets* un
   secreto `HF_TOKEN` con el token del paso 1 (y activarlo para este cuaderno).

## Paso 1: arranque (≈ 30-60 min)

Con `ARRANQUE = True`, *Run All*. Lo que importa sale en la última celda; **pásale a Claude ese texto**:

- **¿sin memoria?: True** → no cabe en 16 GB. La vía se cae sin gasto y se sigue con `IMG-27`.
- **pérdidas `nan`** → fp16 no aguanta. Claude ajusta el cuaderno (otra precisión o capas en fp32) antes de seguir.
- **s/paso**: con él se calcula el entrenamiento entero (1500 pasos × s/paso; si pasa de ~11 h, se baja a 1000 o
  se parte en dos sesiones).

## Paso 2: entrenamiento

`ARRANQUE = False` y **Save Version → Save & Run All (Commit)**: corre en segundo plano, sin el navegador abierto,
hasta 12 h. Al acabar, en la versión guardada → *Output* → `lora/pytorch_lora_weights.safetensors`: descargarlo y
dejarlo en `image-generator/loras/wmf-estilo.safetensors` (la carpeta no se sube al repo).

## Paso 3: en la Deck (Claude)

Con `bin-nuevo/sd-cli`, `--lora-model-dir image-generator/loras` y `<lora:wmf-estilo:1>` más `wmfstyle` en el prompt:
el aullador y una criatura nueva, con y sin LoRA, a la misma semilla; EMD con `medir.sh` y a ojo contra los banners.
Si mejora el acabado, el LoRA entra en el perfil fotorreal y se decide su peso.

## Riesgos que el arranque resuelve

- 16 GB: con todo en fp16, el arranque del 2026-11-02 cupo (6,6 s/paso). Con el transformer en fp32 falta medirlo.
- fp16: el transformer de FLUX.3 da `nan` desde el primer paso (DIAG del 2026-11-02: latentes y textos sanos, salida
  del transformer nan). El repo no trae `tokenizer/`: el cuaderno parchea el script para leerlo de `text_encoder/`.
- Licencia: la FLUX Kommunity License no se pudo leer sin sesión; se lee al aceptarla (paso 1). Términos de OpenAI
  sobre usar los banners como datos: ver [`investigacion-lora.md`](investigacion-lora.md).
- Cuota de Kaggle (~30 h/semana, sesión ≤ 12 h) sin confirmar en sus páginas: mirarla en el panel de la cuenta.
