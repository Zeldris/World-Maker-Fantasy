#!/bin/bash
# VOZ-3 (doc 02, «Producir»): frases con una voz fijada y el modelo Base del nivel (BASE, como en fijar.sh).
# Uso: producir.sh <raza> <voz> [frases.txt]      una frase por línea; por defecto, voces/frases-prueba.txt (10)
# EFECTOS=1 les pone además la cadena de la raza (escuchar.sh, sin reproducir).
# Deja generated/<raza>/<voz>/frases/<modelo-base>-<n>-<fecha>.wav, su log y una fila por frase en registro.tsv.
# Hecho cuando las 10 frases suenan a la misma persona (doc 02, paso 2): apúntalo en notas.md.
set -u
. "$(dirname "$(readlink -f "$0")")/comun.sh"
[ $# -ge 2 ] || { sed -n 3p "$0"; exit 2; }
R=$1; V=$2; valido "$R" "$V"
FR=${3:-$G/voces/frases-prueba.txt}
FD=$G/generated/$R/$V/fijado/${BASE%.gguf}
B=$(bin_dir)
requisitos "$FR" "$B/qwen-tts" "$M/$BASE" "$M/$CODEC" "$FD/referencia.spk" "$FD/referencia.rvq" "$FD/referencia.txt"
D=$G/generated/$R/$V; mkdir -p "$D/frases" "$D/logs"
TXT=$(mktemp); trap 'rm -f "$TXT"' EXIT
una_a_la_vez; memoria_inicial
FECHA=$(date +%Y%m%d-%H%M%S); n=0
while IFS= read -r frase || [ -n "$frase" ]; do
  [ -n "${frase// }" ] || continue
  n=$((n + 1)); N=${BASE%.gguf}-$n-$FECHA; INI=$(date +%s)
  printf '%s\n' "$frase" > "$TXT"
  lanzar "$D/logs/$N.log" "$B/qwen-tts" --model "$M/$BASE" --codec "$M/$CODEC" --device "$DISPOSITIVO" \
    --ref-spk "$FD/referencia.spk" --ref-rvq "$FD/referencia.rvq" --ref-text "$FD/referencia.txt" \
    --lang "$LANG_VOZ" --seed "${SEMILLA:-7}" -o "$D/frases/$N.wav" < "$TXT"; RC=$?
  RTF=$(grep -o 'RTF [0-9.]*' "$D/logs/$N.log" | tail -1)
  registrar "$D/registro.tsv" $'fecha\tnombre\tqué\tmodelo\tdispositivo\tsemilla\tsalida\tsegundos\tmin_libre_mb' \
    "$(date -Iseconds)"$'\t'"$N"$'\tfrase\t'"$BASE"$'\t'"$DISPOSITIVO"$'\t'"${SEMILLA:-7}"$'\t'"$RC"$'\t'"$(( $(date +%s) - INI ))"$'\t'"$MIN"
  echo "frase $n: $D/frases/$N.wav salida=$RC ${RTF:-sin RTF} min_libre=${MIN}MB"
  [ "${EFECTOS:-0}" = 1 ] && [ $RC = 0 ] && REPRODUCIR=0 "$G/scripts/escuchar.sh" "$R" "$D/frases/$N.wav" > /dev/null
done < "$FR"
echo "$n frases en $D/frases/"
