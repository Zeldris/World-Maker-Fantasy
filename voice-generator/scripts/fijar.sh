#!/bin/bash
# VOZ-3: fija una voz. Con una toma, primero la hace referencia (voces/<raza>/<voz>/referencia.wav, en git: es la
# fuente de verdad de la voz) y apunta su semilla en diseno.json; luego extrae con qwen-codec el .spk (timbre) y el
# .rvq (códigos) para el modelo Base que se vaya a usar, que no van a git: se vuelven a sacar del .wav.
# Uso: fijar.sh <raza> <voz> [toma.wav]        BASE=qwen-talker-1.7b-base-Q8_0.gguf para el nivel con GPU
# Deja generated/<raza>/<voz>/fijado/<modelo-base>/referencia.{wav,spk,rvq} (el codec los nombra junto al .wav).
set -u
. "$(dirname "$(readlink -f "$0")")/comun.sh"
[ $# -ge 2 ] || { sed -n 5p "$0"; exit 2; }
R=$1; V=$2; valido "$R" "$V"
VD=$G/voces/$R/$V
B=$(bin_dir)
requisitos "$VD/diseno.json" "$B/qwen-codec" "$M/$CODEC" "$M/$BASE"
if [ $# -ge 3 ]; then
  [ -s "$3" ] || { echo "ABORTO: no existe la toma $3"; exit 3; }
  cp "$3" "$VD/referencia.wav"
  python3 "$G/scripts/voces.py" texto "$VD/diseno.json" > "$VD/referencia.txt"
  s=$(basename "$3" | sed -n 's/^s\([0-9]*\)-.*/\1/p')
  [ -n "$s" ] && python3 "$G/scripts/voces.py" semilla "$VD/diseno.json" "$s" && echo "semilla $s apuntada en diseno.json"
fi
requisitos "$VD/referencia.wav" "$VD/referencia.txt"
D=$G/generated/$R/$V/fijado/${BASE%.gguf}; mkdir -p "$D" "$G/generated/$R/$V/logs"
cp "$VD/referencia.wav" "$VD/referencia.txt" "$D/"
una_a_la_vez; memoria_inicial
LOG=$G/generated/$R/$V/logs/fijar-${BASE%.gguf}-$(date +%Y%m%d-%H%M%S).log
lanzar "$LOG" "$B/qwen-codec" --model "$M/$CODEC" --talker "$M/$BASE" -i "$D/referencia.wav"; RC=$?
[ $RC = 0 ] && [ -s "$D/referencia.spk" ] && [ -s "$D/referencia.rvq" ] || { echo "ABORTO: el codec no dejó .spk/.rvq (salida=$RC, ver $LOG)"; exit 4; }
echo "fijada: $D/referencia.{spk,rvq} (min_libre=${MIN}MB). Siguiente: producir.sh $R $V"
