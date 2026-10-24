# Roadmap del generador de imágenes — Tarkor

**Creado:** 2026-10-24 (usuaria). **Qué cubre:** el generador local de imágenes (`image-generator/`: `sd-cli` con
FLUX.2 klein en la Deck, su interfaz `abrir.sh` y los prompts que le llegan del juego). Lo ya hecho del generador
vive en `roadmap-front.md` (`CFG-38`…`CFG-43`); lo nuevo, aquí.
**Orden y hito:** los fija el [mapa de roadmaps](21-roadmap.md#mapa-de-roadmaps).

**Cómo se usa** (mismo convenio que [roadmap-front.md](roadmap-front.md)): al cerrar un punto se tacha con su
commit; **[A]** pedido por Álvaro, **[P]** propuesta de Claude; esfuerzo **S** (horas) · **M** (1-2 días) ·
**L** (varios días).

## Fase I-A · Escenas compuestas con elementos ya generados

Una imagen compuesta (un mapa, una llanura, una escena) nombra otros elementos del catálogo: «una llanura donde se
ven múrgoles y cuernahojas». Hoy el prompt los describe con palabras y el modelo los inventa de nuevo, distintos de
sus propias imágenes. Las imágenes por elemento ya viven en `image-generator/generated/<categoria>/<slug>/` y la
elegida en `generated/<categoria>/<slug>/<slug>-<perfil>.png` (`CFG-43`).

- **IMG-1 · El prompt de una escena enlaza las imágenes de sus elementos** [A] (usuaria, 2026-10-24): al preparar
  el prompt de una imagen compuesta, se detectan los elementos del catálogo que nombra (por slug o nombre de la
  enciclopedia) y se pasan sus imágenes elegidas como referencias (`-r` de `sd-cli`, varias a la vez), con el texto
  que dice qué es cada una. Antes, medir en la Deck cuántas referencias aguanta klein 4B con `--max-vram 2` y cuánto
  sube el tiempo (con una, ~200 s frente a ~105 s sin ella; ver `.claude/gw/opt-ai.md`). **M**
- **IMG-2 · Sin las imágenes de sus elementos, no se genera la escena** [A] (usuaria, 2026-10-24): si falta la
  imagen elegida de algún elemento que nombra la escena, la interfaz no deja generarla y lista los que faltan, con
  un enlace para generar cada uno primero. Depende de `IMG-1`. **S**
- **IMG-3 · Medir el generador con `/opt-ai`** [P] (usuaria, 2026-10-24): un script que resume
  `generated/*/*/registro.tsv` y los logs (segundos, perfil, pasos, con o sin referencia, memoria libre mínima) para
  que `/opt-ai` compare y proponga ajustes con números, sin leer los logs enteros. **S**
