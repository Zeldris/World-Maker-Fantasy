#!/bin/bash
# IMG-15 (opt-tokens): hoja de contactos de una ronda del banco. Cada imagen leída cuesta ~1,6k tokens y se arrastra hasta
# la siguiente compactación (66 en una sesión, 3,99M arrastrados); una hoja de 6 cuesta lo que una sola.
# Uso: bash docs/producto/plan-imagenes/hoja.sh <prefijo> [columnas=2]
#      bash docs/producto/plan-imagenes/hoja.sh --archivos <nombre> <png>… (QA-283: banners sueltos, p. ej. de
#      backend/uploads/, en hojas/sueltas-<nombre>-<n>.png; COLUMNAS=2 cambia las columnas)
#   junta los PNG de generated/banco/<prefijo>/ y <prefijo>-*/intentos/ (r1 no coge r10) en hojas de POR_HOJA (6) casillas de ANCHO px (640), en
#   generated/banco/hojas/<prefijo>-<n>.png, y escribe la leyenda (casilla → prueba/intento), en orden de lectura.
# La hoja sirve para descartar; la imagen finalista se abre entera, que a este tamaño se pierde el detalle fino.
# ffmpeg sin drawtext: las casillas no llevan rótulo, la leyenda va en la salida. BANCO_DIR cambia la carpeta (tests).
set -euo pipefail
R=$(cd "$(dirname "$0")/../../.." && pwd)
BANCO=${BANCO_DIR:-$R/image-generator/generated/banco}
W=${ANCHO:-640}; N=${POR_HOJA:-6}
if [ "${1:-}" = --archivos ]; then
  [ $# -ge 3 ] || { echo "uso: hoja.sh --archivos <nombre> <png>…"; exit 2; }
  [[ $2 =~ ^[A-Za-z0-9._-]+$ ]] || { echo "ABORTO: «$2» no vale como nombre de hoja (letras, cifras, . _ -)"; exit 2; }
  PREFIJO=sueltas-$2; COLS=${COLUMNAS:-2}; shift 2; imgs=("$@")  # sueltas-: nunca pisa las hojas de una ronda
  for f in "${imgs[@]}"; do [ -f "$f" ] || { echo "ABORTO: no existe $f"; exit 2; }; done
else
  PREFIJO=${1:?uso: hoja.sh <prefijo> [columnas]}; COLS=${2:-2}
  mapfile -t imgs < <({ compgen -G "$BANCO/$PREFIJO/intentos/*.png" || true; compgen -G "$BANCO/$PREFIJO-*/intentos/*.png" || true; } | sort)
  [ ${#imgs[@]} -gt 0 ] || { echo "ABORTO: no hay imágenes en $BANCO/$PREFIJO{,-*}/intentos/"; exit 2; }
fi
# ffmpeg lee «:» como protocolo, «%» como secuencia y «-» como opción: entra por enlaces numerados; antes de borrar
# nada, cada uno tiene que ser una imagen legible.
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
ent=()
for ((k = 0; k < ${#imgs[@]}; k++)); do
  ln -s "$(realpath "${imgs[k]}")" "$T/$k.png"; ent+=("$T/$k.png")
  tam=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$T/$k.png" | tr , ' ') \
    && [[ $tam =~ ^[1-9][0-9]*\ [1-9][0-9]*$ ]] || { echo "ABORTO: ffprobe no lee ${imgs[k]} (¿no es imagen, o a medio escribir?)"; exit 1; }
  [ "$k" -gt 0 ] || read -r w0 h0 <<< "$tam"
done
H=$(( W * h0 / w0 / 2 * 2 ))
mkdir -p "$BANCO/hojas"
for f in "$BANCO/hojas/$PREFIJO"-*.png; do  # las de una pasada anterior parecerían de esta; solo <prefijo>-<n>.png
  n=${f##*/}; n=${n#"$PREFIJO"-}; [[ ${n%.png} =~ ^[0-9]+$ ]] && rm -f "$f"
done
for ((ini = 0, hoja = 1; ini < ${#imgs[@]}; ini += N, hoja++)); do
  trozo=("${imgs[@]:ini:N}"); tent=("${ent[@]:ini:N}"); n=${#trozo[@]}; out="$BANCO/hojas/$PREFIJO-$hoja.png"
  entradas=(); filtro=''; capas=''; layout=''
  for ((i = 0; i < n; i++)); do
    entradas+=(-i "${tent[i]}")
    filtro+="[$i:v]scale=$W:$H:force_original_aspect_ratio=decrease,pad=$W:$H:(ow-iw)/2:(oh-ih)/2,format=rgb24[v$i];"  # xstack pide un solo formato (rgba y rgb24 no casan)
    capas+="[v$i]"; layout+="${layout:+|}$(( i % COLS * W ))_$(( i / COLS * H ))"
  done
  if [ "$n" -eq 1 ]; then filtro+="[v0]null[o]"; else filtro+="${capas}xstack=inputs=$n:layout=$layout:fill=black[o]"; fi
  ffmpeg -v error -y "${entradas[@]}" -filter_complex "$filtro" -map '[o]' -frames:v 1 "$out"
  echo "hoja: $out"
  for ((i = 0; i < n; i++)); do echo "  $(( i + 1 )) ${trozo[i]#"$BANCO"/}"; done
done
