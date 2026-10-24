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
| `interfaz/` | la interfaz de pruebas (`servidor.py` e `index.html`, sin dependencias), que abre `abrir.sh` (`CFG-43`) | sí |
| `prompts/<tema>/` | prompts afinados a mano, versionados (`v1.txt`, `v2.txt`…), p. ej. `murgol/` | sí |
| `bin/` | `sd-cli` y sus bibliotecas (release `master-1000-95ff762`, Linux Vulkan) | no |
| `descargas/` | el zip original del binario | no |
| `modelos/diffusion/` | `flux-2-klein-4b-Q8_0.gguf`; para comparar, `flux-2-klein-base-4b-Q8_0.gguf` y `flux3-image-klein-Q8_0.gguf` (no arranca en la Deck) | no |
| `modelos/text/` | `Qwen3-4B-Q4_K_M.gguf` (codificador de texto); `Qwen3VL-4B-Instruct-Q4_K_M.gguf` (el de FLUX.3) | no |
| `modelos/upscale/` | `RealESRGAN_x4plus.pth` (ampliación, BSD-3) | no |
| `referencias/` | imágenes de referencia de estilo (`-r`), p. ej. el banner original del múrgol reducido | no |
| `modelos/vae/` | `full_encoder_small_decoder.safetensors` (FLUX.2-small-decoder, Apache 2.0) | no |
| `pruebas/<tanda>/` | `imagenes/`, `logs/` y `prompts/` de cada tanda, más `registro.tsv`, `notas.md` y `elegidas.tsv` | no |
| `salida/images/<tipo>/` | las elegidas, como `<slug>-<perfil>.png`: la estructura de `backend/uploads/images/` | no |

## Probar prompts (la usuaria)

Con la interfaz (`CFG-43`). Desde la Konsole de la Deck, en la carpeta del repo, con Ollama sin modelos cargados
(la interfaz los descarga si hace falta):

```bash
image-generator/abrir.sh      # abre http://127.0.0.1:7861/ en el navegador; Ctrl+C la para
```

1. **Prompt.** Pega uno (el que copiaste de la enciclopedia o uno tuyo) o busca la entidad («fauna nievon») y la
   interfaz trae su prompt usado, o el base si no hay (la tabla `ImagePrompt`; necesita `tarkor-postgres`, que
   `abrir.sh` arranca; el juego no hace falta). Pon tipo, slug y perfil: deciden el tamaño y dónde acabará la imagen.
2. **Generar.** Semilla (🎲 al azar; repite la misma para ver solo el efecto del prompt), pasos, referencia de estilo
   y tanda (por defecto, la fecha de hoy). Se ve el paso del muestreo mientras genera; una imagen a la vez.
3. **Tanda.** Debajo de cada imagen, escribe qué te parece, qué sobra o qué falta: se guarda sola en
   `pruebas/<tanda>/notas.md`. «Usar este prompt» lo devuelve al formulario para retocarlo.
4. **Elegir esta** copia la imagen a `salida/images/<tipo>/<slug>-<perfil>.png`, el nombre que busca el juego; para
   verla en el juego, cópiala a `backend/uploads/images/<tipo>/`. Si te gusta el prompt, guárdalo como «prompt usado»
   en la enciclopedia: sirve de ejemplo al generador para las demás entidades del mismo tipo (`CFG-40`).
5. Al acabar, pide a Claude **en la Deck** «analiza la tanda <tanda>» (`CFG-42`): `pruebas/` no se sube a git, así que
   la sesión de la nube no la ve.

Tamaños por perfil, a la medida que aguanta la Deck: banner 1280×512 ~110 s, miniatura 768×768 ~100 s, mapa
832×624, icono 512×512; con referencia de estilo, ~200 s. Cada imagen queda en `pruebas/<tanda>/registro.tsv`
(prompt usado, base o pegado, semilla, pasos, tiempo) y su prompt exacto en `pruebas/<tanda>/prompts/`.

Sin interfaz, lo mismo desde la terminal (`W=… H=…` cambian el tamaño; `PROMPT_ARCHIVO=<archivo>` usa un prompt
pegado en vez del de la base):

```bash
image-generator/scripts/probar.sh <tanda> <tipo> <slug> <perfil> [semilla=42] [pasos=4] [-r referencia.png]
# p. ej.: image-generator/scripts/probar.sh 2026-10-25 fauna cuernahoja-macho banner 7
```

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
