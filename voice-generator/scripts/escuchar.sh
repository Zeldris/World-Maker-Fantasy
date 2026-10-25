#!/bin/bash
# VOZ-4: pone a un .wav la cadena de efectos de su raza (voces/<raza>/efectos.json) con SoX y lo reproduce.
# Uso: escuchar.sh <raza> <archivo.wav> [salida.wav]       REPRODUCIR=0: solo lo escribe
# Por defecto, <archivo>-<raza>.wav al lado. En el juego la misma cadena la aplicará Web Audio (VOZ-10); lo que SoX
# no hace (formantes, la capa de gruñido de los faerus) se avisa y se salta. Sin efectos.json (el narrador), suena tal cual.
set -u
G=$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)
[ $# -ge 2 ] || { sed -n 3p "$0"; exit 2; }
R=$1; IN=$2
[[ $R =~ ^[A-Za-z0-9_-]+$ ]] || { echo "ABORTO: «$R» no es una raza válida"; exit 2; }
[ -s "$IN" ] || { echo "ABORTO: no existe $IN"; exit 3; }
command -v sox > /dev/null || { echo "ABORTO: falta sox (apt install sox, en el distrobox)"; exit 3; }
EF=$G/voces/$R/efectos.json
if [ -f "$EF" ]; then
  # Con <(…) el fallo de voces.py se perdería: primero la salida y luego el array.
  SOX=$(python3 "$G/scripts/voces.py" sox "$EF") || exit 3; ARGS=(); [ -n "$SOX" ] && mapfile -t ARGS <<< "$SOX"
  OUT=${3:-${IN%.wav}-$R.wav}
  sox "$IN" "$OUT" "${ARGS[@]}" || { echo "ABORTO: sox falló con: ${ARGS[*]}"; exit 4; }
  echo "con efectos de $R: $OUT (sox ${ARGS[*]})"
else
  OUT=${3:-$IN}; [ "$OUT" = "$IN" ] || cp "$IN" "$OUT"; echo "$R no tiene efectos.json: suena tal cual ($OUT)"
fi
[ "${REPRODUCIR:-1}" = 1 ] && command -v play > /dev/null && play -q "$OUT"
exit 0
