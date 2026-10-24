# image-generator

Pruebas de generación de imágenes en local (Steam Deck) con
[stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp) y FLUX.2 klein 4B. El diseño, las decisiones
abiertas y las fuentes están en
[`01-generacion-imagenes-local.md`](../docs/arquitectura/reutilizables/01-generacion-imagenes-local.md); aquí solo
viven las herramientas y sus salidas. No es parte del juego todavía: no hay tarea con hito.

## Estructura

| Carpeta | Qué guarda | En git |
|---|---|---|
| `scripts/` | `generar.sh` (una imagen, con las protecciones de memoria), `probar.sh` (prompt de la enciclopedia, para las pruebas de la usuaria; deja todo en `generated/<tipo>/<slug>/`); `obsoleto/` lo que no se debe volver a lanzar | sí |
| `interfaz/` | la interfaz de pruebas (`servidor.py` e `index.html`, sin dependencias), que abre `abrir.sh` (`CFG-43`) | sí |
| `prompts/<tema>/` | prompts afinados a mano, versionados (`v1.txt`, `v2.txt`…), p. ej. `murgol/` | sí |
| `bin/` | `sd-cli` y sus bibliotecas (release `master-1000-95ff762`, Linux Vulkan) | no |
| `descargas/` | el zip original del binario | no |
| `modelos/diffusion/` | `flux-2-klein-4b-Q8_0.gguf`; para comparar, `flux-2-klein-base-4b-Q8_0.gguf` y `flux3-image-klein-Q8_0.gguf` (no arranca en la Deck) | no |
| `modelos/text/` | `Qwen3-4B-Q4_K_M.gguf` (codificador de texto); `Qwen3VL-4B-Instruct-Q4_K_M.gguf` (el de FLUX.3) | no |
| `modelos/upscale/` | `RealESRGAN_x4plus.pth` (ampliación, BSD-3) | no |
| `referencias/` | imágenes de referencia (`-r`); `referencias/images/` es la copia de `backend/uploads/images/` que hace `abrir.sh` (solo las que falten) | no |
| `modelos/vae/` | `full_encoder_small_decoder.safetensors` (FLUX.2-small-decoder, Apache 2.0) | no |
| `generated/<tipo>/<slug>/` | todo lo generado por elemento (`CFG-43`): `<slug>-<perfil>.png` la elegida (nombre del juego), `intentos/`, `prompts/` y `logs/` (`<perfil>-s<semilla>-p<pasos>-<AAAAMMDD-HHMMSS>.*`), `registro.tsv`, `notas.md` y `elegidas.tsv` | no |

Lo anterior a este cambio (`pruebas/<tanda>/` y `salida/images/`) sigue donde estaba, sin migrar; la interfaz ya no lo lee.

## Probar prompts (la usuaria)

Con la interfaz (`CFG-43`). Desde la Konsole de la Deck, en la carpeta del repo, con Ollama sin modelos cargados
(la interfaz los descarga si hace falta):

```bash
image-generator/abrir.sh      # abre http://127.0.0.1:7861/ en el navegador; Ctrl+C la para
```

1. **Elegir el elemento.** A la izquierda, categoría y lista (con la miniatura de su imagen actual del juego y las
   marcas «N intentos» y «✓ elegida»), con filtro por texto; «Elemento nuevo» deja escribir tipo y slug a mano, para un
   prompt pegado. Su ficha enseña la imagen actual del juego y los perfiles como botones («prompt usado» o «prompt
   base» si la enciclopedia lo tiene, la tabla `ImagePrompt`; necesita `tarkor-postgres`, que `abrir.sh` arranca): al
   pulsar uno se carga su prompt (el usado y, si no, el base), y «Volver al de la enciclopedia» deshace tus retoques.
2. **Generar.** Semilla (🎲 al azar; repite la misma para ver solo el efecto del prompt) y pasos. Si el juego ya
   tiene imagen de ese elemento (en `referencias/images/<tipo>/`, la de su perfil o, si no, la de otro), sale la
   casilla «Usar la imagen actual del juego como referencia», con su vista previa. Una barra enseña el paso, el
   tiempo y lo que queda (estimado con la mediana de tus intentos anteriores del mismo perfil); una imagen a la vez.
   Si recargas la página, retoma el progreso. Al acabar avisa «Lista en N s» o el motivo del fallo, con el final del log.
3. **Galería del elemento.** Filtro por perfil; la primera tarjeta es la «Actual del juego», para comparar; la
   elegida va destacada. Clic en una imagen la amplía (con la del juego al lado). Debajo de cada una, escribe qué te
   parece, qué sobra o qué falta: se guarda sola en `generated/<tipo>/<slug>/notas.md`. «Reutilizar prompt y semilla»
   lo devuelve a la ficha para retocarlo.
4. **Elegir esta** copia la imagen a `generated/<tipo>/<slug>/<slug>-<perfil>.png`, el nombre que busca el juego; para
   verla en el juego, cópiala a `backend/uploads/images/<tipo>/`. Si te gusta el prompt, guárdalo como «prompt usado»
   en la enciclopedia: sirve de ejemplo al generador para las demás entidades del mismo tipo (`CFG-40`).
5. Para que Claude analice lo probado (`CFG-42`), pídeselo **en la Deck** («analiza lo generado de <tipo>/<slug>»):
   `generated/` no se sube a git, así que la sesión de la nube no lo ve.

Tamaños por perfil, a la medida que aguanta la Deck: banner 1280×512 ~110 s, miniatura 768×768 ~100 s, mapa
832×624, icono 512×512; con referencia de estilo, ~200 s. Cada intento queda en
`generated/<tipo>/<slug>/registro.tsv` (prompt usado, base o pegado, semilla, pasos, tiempo) y su prompt exacto en `prompts/`.

Sin interfaz, lo mismo desde la terminal (`W=… H=…` cambian el tamaño; `PROMPT_ARCHIVO=<archivo>` usa un prompt
pegado en vez del de la base):

```bash
image-generator/scripts/probar.sh <tipo> <slug> <perfil> [semilla=42] [pasos=4] [-r referencia.png]
# p. ej.: image-generator/scripts/probar.sh fauna cuernahoja-macho banner 7
```

## Generar con un prompt propio

```bash
image-generator/scripts/generar.sh <directorio-de-salida> <nombre> <archivo-prompt> <ancho> <alto> [semilla=42] [pasos=4]
# p. ej.: image-generator/scripts/generar.sh image-generator/generated/murgol/pruebas v5-1280x512 image-generator/prompts/murgol/v5.txt 1280 512
# deja la imagen en <directorio>/intentos/, el log en logs/ y el prompt en prompts/
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
