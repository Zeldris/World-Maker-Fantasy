#!/bin/bash
set -euo pipefail
# IMG-18/IMG-24: genera los bocetos SVG de forma con plantilla.py y los rasteriza (`--init-img` del sujeto, ver
# docs/producto/plan-imagenes/plan-fotorreal.md).
# Uso: bocetos/rasterizar.sh [<ficha.json> | <plan> | <nombre> ...]
#   <ficha.json>  genera <slug>.svg con `boceto.plan` y sus números (plantilla.py <ficha>)
#   <plan>        uno de los planes de `plantilla.py --planes` con sus valores por defecto (<plan>.svg)
#   <nombre>      un <nombre>.svg que ya esté en esta carpeta
#   sin argumentos: todas las fichas de ../fichas/*/*.json que tengan `boceto.plan`; `--planes`, los seis planes.
# Salida junto al SVG (nada se versiona, ver image-generator/.gitignore): <nombre>-1280.png (1280x512, el sujeto a
# tamaño completo), <nombre>-1024.png (1024x384, el sujeto) y <nombre>-640.png (640x256, el borrador).
# 1024x384 es 2,667:1 y no 2,5:1: se RECORTAN 16 px de cielo arriba y 16 de suelo abajo del 1280x512 (1280x480) y se
# escala a 1024x384. No se encaja con bandas ni se estira: el sujeto queda entero y sin deformar (la plantilla deja
# esos 16 px libres a propósito). Necesita rsvg-convert y ffmpeg.
# Para el sujeto sobre verde de la cadena de planos (IMG-19c), <nombre>-verde-1024.png y <nombre>-verde-512.png
# (512x192): verde.css pinta de verde croma lo marcado class="fondo" y quita la sombra (class="sombra").
cd "$(dirname "$0")"
nombres=()
if [ $# -eq 0 ]; then
  for f in ../fichas/*/*.json; do
    python3 -c 'import json,sys; sys.exit(0 if isinstance(json.load(open(sys.argv[1])).get("boceto"), dict) and "plan" in json.load(open(sys.argv[1]))["boceto"] else 1)' "$f" || continue
    nombres+=("$(python3 plantilla.py "$f" | xargs -n1 basename | sed 's/\.svg$//')")
  done
elif [ "$1" = "--planes" ]; then
  for p in $(python3 plantilla.py --planes | sed -n 's/^\([a-z]*\):.*/\1/p'); do
    nombres+=("$(python3 plantilla.py --plan "$p" | xargs -n1 basename | sed 's/\.svg$//')")
  done
else
  for a in "$@"; do
    case "$a" in
      *.json) nombres+=("$(python3 plantilla.py "$a" | xargs -n1 basename | sed 's/\.svg$//')") ;;
      *) if python3 plantilla.py --planes | grep -q "^$a:"; then
           nombres+=("$(python3 plantilla.py --plan "$a" | xargs -n1 basename | sed 's/\.svg$//')")
         elif [ -f "$a.svg" ]; then nombres+=("$a")
         else echo "rasterizar.sh: «$a» no es una ficha, un plan ni un SVG de esta carpeta" >&2; exit 2; fi ;;
    esac
  done
fi
for n in "${nombres[@]}"; do
  rsvg-convert -w 1280 -h 512 "$n.svg" -o "$n-1280.png"
  rsvg-convert -w 640 -h 256 "$n.svg" -o "$n-640.png"
  ffmpeg -v error -y -i "$n-1280.png" -vf "crop=1280:480:0:16,scale=1024:384:flags=lanczos" "$n-1024.png"
  rsvg-convert -s verde.css -w 1280 -h 512 "$n.svg" | ffmpeg -v error -y -i - \
    -filter_complex "crop=1280:480:0:16,split[a][b];[a]scale=1024:384:flags=lanczos[g];[b]scale=512:192:flags=lanczos[p]" \
    -map "[g]" "$n-verde-1024.png" -map "[p]" "$n-verde-512.png"
  echo "$n: 1280x512, 1024x384 (recorte 16 px arriba y abajo), 640x256; sobre verde 1024x384 y 512x192"
done
