#!/bin/bash
# IMG-32: conjunto de entrenamiento del LoRA de estilo con los banners GPT del juego (backend/uploads/images/*/*-banner.png).
# Uso: conjunto.sh [salida]   (por defecto lora/conjunto/)
# Deja <salida>/imagenes/<tipo>__<slug>.png a 1280x512 y <salida>/wmf-banners.zip para subirlo a Kaggle como dataset.
# Los textos de cada imagen los pone el cuaderno (lora/entrenar.ipynb) con un modelo de visión.
set -euo pipefail
G=$(cd "$(dirname "$0")/.." && pwd); IMG=$G/../backend/uploads/images
O=${1:-$G/lora/conjunto}
rm -rf "$O/imagenes" "$O/wmf-banners.zip"; mkdir -p "$O/imagenes"
n=0
for f in "$IMG"/*/*-banner.png; do
  t=$(basename "$(dirname "$f")"); s=$(basename "$f" -banner.png)
  ffmpeg -loglevel error -y -i "$f" -vf scale=1280:512:flags=lanczos "$O/imagenes/${t}__${s}.png"
  n=$((n+1))
done
(cd "$O" && zip -qr wmf-banners.zip imagenes)
echo "$n imágenes en $O/imagenes; zip: $O/wmf-banners.zip ($(du -h "$O/wmf-banners.zip" | cut -f1))"
