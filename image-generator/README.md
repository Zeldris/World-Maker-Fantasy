# image-generator

Pruebas de generación de imágenes en local (Steam Deck) con
[stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp) y FLUX.2 klein 4B. El diseño, las decisiones
abiertas y las fuentes están en
[`01-generacion-imagenes-local.md`](../docs/arquitectura/reutilizables/01-generacion-imagenes-local.md); aquí solo
viven las herramientas y sus salidas. No es parte del juego todavía: no hay tarea con hito.

## Estructura

| Carpeta | Qué guarda | En git |
|---|---|---|
| `scripts/` | `generar.sh` (una imagen, con las protecciones de memoria), `probar.sh` (prompt de la enciclopedia, para las pruebas de la usuaria); `obsoleto/` lo que no se debe volver a lanzar | sí |
| `prompts/<tema>/` | prompts afinados a mano, versionados (`v1.txt`, `v2.txt`…), p. ej. `murgol/` | sí |
| `bin/` | `sd-cli` y sus bibliotecas (release `master-1000-95ff762`, Linux Vulkan) | no |
| `descargas/` | el zip original del binario | no |
| `modelos/diffusion/` | `flux-2-klein-4b-Q8_0.gguf`; para comparar, `flux-2-klein-base-4b-Q8_0.gguf` y `flux3-image-klein-Q8_0.gguf` (no arranca en la Deck) | no |
| `modelos/text/` | `Qwen3-4B-Q4_K_M.gguf` (codificador de texto); `Qwen3VL-4B-Instruct-Q4_K_M.gguf` (el de FLUX.3) | no |
| `modelos/upscale/` | `RealESRGAN_x4plus.pth` (ampliación, BSD-3) | no |
| `referencias/` | imágenes de referencia de estilo (`-r`), p. ej. el banner original del múrgol reducido | no |
| `modelos/vae/` | `full_encoder_small_decoder.safetensors` (FLUX.2-small-decoder, Apache 2.0) | no |
| `pruebas/<tanda>/` | `imagenes/`, `logs/` y `prompts/` de cada tanda | no |

## Probar prompts (la usuaria)

Desde una terminal de la Deck (Konsole; desde el sandbox de VS Code, con `flatpak-spawn --host bash -lc '…'`), en la
carpeta del repo, con Postgres (`tarkor-postgres`) y el juego arrancados y Ollama sin modelos cargados:

1. En la enciclopedia, con las herramientas de admin, abre la entidad y genera su prompt (el base).
2. Mejóralo en «prompt usado» y guárdalo. Lo que guardes ahí sirve también de ejemplo al generador para las demás
   entidades del mismo tipo (`CFG-40`): cuanto mejores sean, mejores saldrán los siguientes.
3. Genera la imagen con ese prompt:

```bash
image-generator/scripts/probar.sh <tanda> <tipo> <slug> <perfil> [semilla=42] [pasos=4]
# p. ej.: image-generator/scripts/probar.sh 2026-10-25 fauna cuernahoja-macho banner 7
```

4. Mira la imagen (`pruebas/<tanda>/imagenes/`) y apunta en `pruebas/<tanda>/notas.md` qué te parece, con el nombre
   que da el script. Para ver solo el efecto del prompt, repite la misma semilla.
5. Al acabar, pide a Claude **en la Deck** «analiza la tanda <tanda>» (`CFG-42`): `pruebas/` no se sube a git, así que
   la sesión de la nube no la ve.

Usa el prompt usado si lo hay, si no el base, y el tamaño del perfil a la medida que aguanta la Deck (banner 1280×512
~110 s, miniatura 768×768 ~100 s, mapa 832×624, icono 512×512; `W=… H=…` lo cambian). Cada imagen queda en
`pruebas/<tanda>/registro.tsv` (prompt usado o base, semilla, pasos, tiempo) y su prompt exacto en
`pruebas/<tanda>/prompts/`. Con referencia de estilo: `… banner 7 4 -r image-generator/referencias/murgol-original-1024.png` (~200 s).

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
de matar el proceso). `generar.sh` (y `probar.sh`, que lo llama) lo evita con:

- `--params-backend disk --max-vram vulkan0=2`: pesos leídos del disco por segmentos y 2 GB de GPU a la vez. Sin
  esto, con la Deck recién reiniciada el gestor ve ~9 GB «libres» y duplica el modelo entero en RAM y GTT.
- Nunca subir `--max-vram` ni volver a `--offload-to-cpu` (`scripts/obsoleto/lote.sh` usa `vulkan0=6`: bloqueó la Deck).
- Un vigilante que mata el proceso si quedan menos de 1,5 GB libres o si el driver dice «0 MB libres». El tope del
  cgroup no basta: la memoria GTT no cuenta en él.
