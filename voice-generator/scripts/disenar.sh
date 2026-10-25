#!/bin/bash
# VOZ-3 (doc 02, «Tomas, elección y fijado»): tomas de una voz con VoiceDesign 1,7B a partir de su ficha.
# Uso: disenar.sh <raza> <voz>        p. ej.: disenar.sh orcos guerrero-1
# Lee voces/<raza>/<voz>/diseno.json (voces.py la comprueba: edad adulta, tono medio o grave, sin palabras de
# deriva infantil), la convierte en la frase del --instruct y dice su texto_prueba con cada semilla de SEMILLAS
# (11 22 33 44 55). Deja generated/<raza>/<voz>/: tomas/s<semilla>-<fecha>.wav, logs/, registro.tsv y notas.md.
# Después: escucha las tomas (escuchar.sh <raza> <toma> les pone los efectos de la raza), apunta en notas.md qué te
# parece cada una y fija la mejor con fijar.sh <raza> <voz> <toma>.
set -u
. "$(dirname "$(readlink -f "$0")")/comun.sh"
[ $# -ge 2 ] || { sed -n 3p "$0"; exit 2; }
R=$1; V=$2; valido "$R" "$V"
F=$G/voces/$R/$V/diseno.json
SEMILLAS=${SEMILLAS:-"11 22 33 44 55"}
B=$(bin_dir)
requisitos "$F" "$B/qwen-tts" "$M/$DISENO" "$M/$CODEC"
INS=$(python3 "$G/scripts/voces.py" instruct "$F") || exit 3
D=$G/generated/$R/$V; mkdir -p "$D/tomas" "$D/logs"
TXT=$(mktemp); trap 'rm -f "$TXT"' EXIT
python3 "$G/scripts/voces.py" texto "$F" > "$TXT"
echo "instruct: $INS"
una_a_la_vez; memoria_inicial
for s in $SEMILLAS; do
  [[ $s =~ ^[0-9]+$ ]] || { echo "ABORTO: semilla no numérica: $s"; exit 2; }
  N=s$s-$(date +%Y%m%d-%H%M%S); INI=$(date +%s)
  lanzar "$D/logs/$N.log" "$B/qwen-tts" --model "$M/$DISENO" --codec "$M/$CODEC" --device "$DISPOSITIVO" \
    --instruct "$INS" --lang "$LANG_VOZ" --seed "$s" -o "$D/tomas/$N.wav" < "$TXT"; RC=$?
  registrar "$D/registro.tsv" $'fecha\tnombre\tqué\tmodelo\tdispositivo\tsemilla\tsalida\tsegundos\tmin_libre_mb' \
    "$(date -Iseconds)"$'\t'"$N"$'\ttoma\t'"$DISENO"$'\t'"$DISPOSITIVO"$'\t'"$s"$'\t'"$RC"$'\t'"$(( $(date +%s) - INI ))"$'\t'"$MIN"
  echo "toma: $D/tomas/$N.wav salida=$RC $(( $(date +%s) - INI ))s min_libre=${MIN}MB"
done
[ -f "$D/notas.md" ] || printf '# Notas de %s/%s\n\nUna línea por toma: nombre (de registro.tsv) y qué te parece; marca la deriva infantil si la oyes.\n\n' "$R" "$V" > "$D/notas.md"
echo "Siguiente: escuchar.sh $R <toma> y fijar.sh $R $V <toma elegida>"
