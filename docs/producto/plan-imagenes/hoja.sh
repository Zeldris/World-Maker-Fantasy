#!/bin/bash
# IMG-15 (opt-tokens): hoja de contactos de una ronda del banco. Cada imagen leída cuesta ~1,6k tokens y se arrastra hasta
# la siguiente compactación (66 en una sesión, 3,99M arrastrados); una hoja de 6 cuesta lo que una sola.
# Uso: bash docs/producto/plan-imagenes/hoja.sh <prefijo> [columnas=2]
#   junta los PNG de generated/banco/<prefijo>*/intentos/ en hojas de POR_HOJA (6) casillas de ANCHO px (640), en
#   generated/banco/hojas/<prefijo>-<n>.png, y escribe la leyenda (casilla → prueba/intento), en orden de lectura.
# La hoja sirve para descartar; la imagen finalista se abre entera, que a este tamaño se pierde el detalle fino.
# ffmpeg sin drawtext: las casillas no llevan rótulo, la leyenda va en la salida. BANCO_DIR cambia la carpeta (tests).
set -euo pipefail
R=$(cd "$(dirname "$0")/../../.." && pwd)
BANCO=${BANCO_DIR:-$R/image-generator/generated/banco}
PREFIJO=${1:?uso: hoja.sh <prefijo> [columnas]}; COLS=${2:-2}; W=${ANCHO:-640}; N=${POR_HOJA:-6}
mapfile -t imgs < <(compgen -G "$BANCO/$PREFIJO*/intentos/*.png" | sort)
[ ${#imgs[@]} -gt 0 ] || { echo "ABORTO: no hay imágenes en $BANCO/$PREFIJO*/intentos/"; exit 2; }
read -r w0 h0 < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${imgs[0]}" | tr , ' ')
H=$(( W * h0 / w0 / 2 * 2 ))
mkdir -p "$BANCO/hojas"
for ((ini = 0, hoja = 1; ini < ${#imgs[@]}; ini += N, hoja++)); do
  trozo=("${imgs[@]:ini:N}"); n=${#trozo[@]}; out="$BANCO/hojas/$PREFIJO-$hoja.png"
  entradas=(); filtro=''; capas=''; layout=''
  for ((i = 0; i < n; i++)); do
    entradas+=(-i "${trozo[i]}")
    filtro+="[$i:v]scale=$W:$H:force_original_aspect_ratio=decrease,pad=$W:$H:(ow-iw)/2:(oh-ih)/2[v$i];"
    capas+="[v$i]"; layout+="${layout:+|}$(( i % COLS * W ))_$(( i / COLS * H ))"
  done
  if [ "$n" -eq 1 ]; then filtro+="[v0]null[o]"; else filtro+="${capas}xstack=inputs=$n:layout=$layout:fill=black[o]"; fi
  ffmpeg -v error -y "${entradas[@]}" -filter_complex "$filtro" -map '[o]' -frames:v 1 "$out"
  echo "hoja: $out"
  for ((i = 0; i < n; i++)); do echo "  $(( i + 1 )) ${trozo[i]#"$BANCO"/}"; done
done
