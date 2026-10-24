# image-generator

Pruebas de generación de imágenes en local (Steam Deck) con
[stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp) y FLUX.2 klein 4B. El diseño, las decisiones
abiertas y las fuentes están en
[`01-generacion-imagenes-local.md`](../docs/arquitectura/reutilizables/01-generacion-imagenes-local.md); aquí solo
viven las herramientas y sus salidas. No es parte del juego todavía: no hay tarea con hito.

## Estructura

| Carpeta | Qué guarda | En git |
|---|---|---|
| `scripts/` | `generar.sh` (una imagen, con las protecciones de memoria), `demo.sh` (prompt sacado de la BD); `obsoleto/` lo que no se debe volver a lanzar | sí |
| `prompts/<tema>/` | prompts afinados a mano, versionados (`v1.txt`, `v2.txt`…), p. ej. `murgol/` | sí |
| `bin/` | `sd-cli` y sus bibliotecas (release `master-1000-95ff762`, Linux Vulkan) | no |
| `descargas/` | el zip original del binario | no |
| `modelos/diffusion/` | `flux-2-klein-4b-Q8_0.gguf`; para comparar, `flux-2-klein-base-4b-Q8_0.gguf` y `flux3-image-klein-Q8_0.gguf` (no arranca en la Deck) | no |
| `modelos/text/` | `Qwen3-4B-Q4_K_M.gguf` (codificador de texto); `Qwen3VL-4B-Instruct-Q4_K_M.gguf` (el de FLUX.3) | no |
| `modelos/upscale/` | `RealESRGAN_x4plus.pth` (ampliación, BSD-3) | no |
| `referencias/` | imágenes de referencia de estilo (`-r`), p. ej. el banner original del múrgol reducido | no |
| `modelos/vae/` | `full_encoder_small_decoder.safetensors` (FLUX.2-small-decoder, Apache 2.0) | no |
| `pruebas/<tanda>/` | `imagenes/`, `logs/` y `prompts/` de cada tanda | no |

## Lanzar la demo

Desde el host (en VS Code, que corre en un sandbox Flatpak, con `flatpak-spawn --host bash -lc '…'`), con Postgres
(`tarkor-postgres`) arrancado y Ollama sin modelos cargados:

```bash
image-generator/scripts/demo.sh <tipo> <slug> <perfil> <ancho> <alto>
# p. ej.: image-generator/scripts/demo.sh fauna mekiosi thumbnail 512 512
```

Saca el prompt real de la tabla `ImagePrompt` y deja la imagen, el log y el prompt en `pruebas/demo/`. Una imagen de
512×512 tarda ~60 s; un banner de 768×304, ~57 s.

## Generar con un prompt propio

```bash
image-generator/scripts/generar.sh <tanda> <nombre> <archivo-prompt> <ancho> <alto> [semilla=42] [pasos=4]
# p. ej.: image-generator/scripts/generar.sh murgol v5-1280x512 image-generator/prompts/murgol/v5.txt 1280 512
```

Un banner de 1280×512 tarda ~110 s; con `-r referencia.png` (args extra al final), ~200 s. Otro modelo: variables
`MODELO`, `LLM`, `CFG` y `TOPE`. Resultados de cada opción: «Banco del múrgol» en el documento del reutilizable. El prompt que funcione se guarda como «prompt usado» en la enciclopedia
(`CFG-38`), para que quede el exacto con el que se generó la imagen.

## Memoria: lo que no se toca

La Deck se bloqueó el 2026-10-24 por falta de memoria (la VRAM es RAM compartida y, sin memoria, se congela en vez
de matar el proceso). `generar.sh` (y `demo.sh`, que lo llama) lo evita con:

- `--params-backend disk --max-vram vulkan0=2`: pesos leídos del disco por segmentos y 2 GB de GPU a la vez. Sin
  esto, con la Deck recién reiniciada el gestor ve ~9 GB «libres» y duplica el modelo entero en RAM y GTT.
- Nunca subir `--max-vram` ni volver a `--offload-to-cpu` (`scripts/obsoleto/lote.sh` usa `vulkan0=6`: bloqueó la Deck).
- Un vigilante que mata el proceso si quedan menos de 1,5 GB libres o si el driver dice «0 MB libres». El tope del
  cgroup no basta: la memoria GTT no cuenta en él.
