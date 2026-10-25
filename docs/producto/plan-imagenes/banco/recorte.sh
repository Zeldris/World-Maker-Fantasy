#!/bin/bash
# IMG-15: recorta la misma zona (al 100 %) de varias imágenes y las apila en vertical, para comparar el detalle fino.
# Uso: recorte.sh <salida.png> <x> <y> <ancho> <alto> <imagen>...   (en el orden de las imágenes, de arriba abajo)
set -eu
OUT=$1 X=$2 Y=$3 W=$4 H=$5; shift 5
in=(); f=""; i=0
for img in "$@"; do in+=(-i "$img"); f+="[$i:v]crop=$W:$H:$X:$Y[c$i];"; i=$((i+1)); done
pila=""; for ((j=0; j<i; j++)); do pila+="[c$j]"; done
ffmpeg -loglevel error -y "${in[@]}" -filter_complex "${f}${pila}vstack=inputs=$i" "$OUT"
echo "$OUT"
