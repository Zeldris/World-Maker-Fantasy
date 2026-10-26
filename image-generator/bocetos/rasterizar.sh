#!/bin/bash
# IMG-18: rasteriza los bocetos SVG de forma (`--init-img` del sujeto, ver docs/producto/plan-imagenes/plan-fotorreal.md).
# Uso: bocetos/rasterizar.sh [nombre ...]   (sin argumentos: todos los .svg de esta carpeta)
# Salida junto al SVG (no se versiona, ver image-generator/.gitignore): <nombre>-1280.png (1280x512, el sujeto a tamaño
# completo), <nombre>-1024.png (1024x384, el sujeto) y <nombre>-640.png (640x256, el borrador).
# 1024x384 es 2,667:1 y no 2,5:1: se RECORTAN 16 px de cielo arriba y 16 de suelo abajo del 1280x512 (1280x480) y se
# escala a 1024x384. No se encaja con bandas ni se estira: el sujeto queda entero y sin deformar (los bocetos dejan
# esos 16 px libres a propósito). Necesita rsvg-convert y ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"
nombres=("$@")
if [ ${#nombres[@]} -eq 0 ]; then
  for f in *.svg; do nombres+=("${f%.svg}"); done
fi
for n in "${nombres[@]}"; do
  rsvg-convert -w 1280 -h 512 "$n.svg" -o "$n-1280.png"
  rsvg-convert -w 640 -h 256 "$n.svg" -o "$n-640.png"
  ffmpeg -v error -y -i "$n-1280.png" -vf "crop=1280:480:0:16,scale=1024:384:flags=lanczos" "$n-1024.png"
  echo "$n: 1280x512, 1024x384 (recorte 16 px arriba y abajo), 640x256"
done
