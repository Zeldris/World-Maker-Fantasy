#!/bin/bash
# IMG-17: apila N imágenes en vertical, a 960x384 cada una, para compararlas a ojo; la que no es 2,5:1 se encaja sin
# deformar, con bandas negras (r16: un sujeto de lienzo alto, P7).
# Uso: rejilla.sh <salida.png> <imagen>...   (por convención: el candidato primero y sus banners de GPT detrás)
set -euo pipefail
[ $# -ge 2 ] || { sed -n 2,3p "$0"; exit 2; }
out=$1; shift; n=$#; args=(); fc=""; ins=""; i=0
for f in "$@"; do
  [ -f "$f" ] || { echo "ABORTO: no existe $f"; exit 2; }
  args+=(-i "$f"); fc+="[$i:v]scale=960:384:flags=lanczos:force_original_aspect_ratio=decrease,pad=960:384:(ow-iw)/2:(oh-ih)/2,setsar=1[v$i];"; ins+="[v$i]"; i=$((i+1))
done
ffmpeg -y -v error "${args[@]}" -filter_complex "${fc}${ins}vstack=inputs=$n" -frames:v 1 "$out"
