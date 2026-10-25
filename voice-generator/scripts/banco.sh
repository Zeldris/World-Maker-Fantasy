#!/bin/bash
# VOZ-2 (paso 1 del doc 02): banco de pruebas en la Deck. Mide cuánto tarda cada modelo en cada dispositivo y si el
# español funciona, con la voz del narrador (voces/narrador/principal).
# Uso: banco.sh [rondas=1]
# 1. Una referencia con VoiceDesign 1,7B (la ficha del narrador, su semilla) → generated/banco/<fecha>/referencia.wav.
# 2. Con ella, cada modelo Base (0,6B y 1,7B) × dispositivo (Vulkan0 y CPU) dice una frase corta y una larga.
# Deja generated/banco/<fecha>/: los .wav para escucharlos, logs/ y banco.tsv (modelo, dispositivo, frase, segundos
# de audio, ms totales, RTF = segundos de cálculo por segundo de audio, memoria libre mínima, salida). Al final,
# la tabla. «español: no» si el modelo no conoce LANG_VOZ (Spanish); si lo conoce, escuchar si suena a español.
set -u
. "$(dirname "$(readlink -f "$0")")/comun.sh"
RONDAS=${1:-1}
F=$G/voces/narrador/principal/diseno.json
D=$G/generated/banco/$(date +%Y%m%d-%H%M%S); mkdir -p "$D/logs"
CORTA="El viento trae olor a ceniza desde el norte."
LARGA="Cuando la última caravana cruzó el puente de piedra, los vigías ya habían encendido las hogueras, y nadie en la aldea se atrevió a preguntar qué habían visto en la llanura."
TSV=$D/banco.tsv
CAB=$'modelo\tdispositivo\tfrase\tronda\taudio_s\ttotal_ms\trtf\tmin_libre_mb\tespañol\tsalida'

una_a_la_vez; memoria_inicial
requisitos "$M/$DISENO" "$M/$CODEC" "$F"

fila() {   # fila <modelo> <dispositivo> <frase> <ronda> <log> <rc>
  local perf; perf=$(grep -o '\[Perf\] Total.*' "$5" | tail -1)
  local ms; ms=$(sed -n 's/.*Total \([0-9.]*\) ms.*/\1/p' <<< "$perf")
  local au; au=$(sed -n 's/.*audio \([0-9.]*\) s.*/\1/p' <<< "$perf")
  local rtf; rtf=$(sed -n 's/.*RTF \([0-9.]*\).*/\1/p' <<< "$perf")
  local es=sí; grep -q "unknown language" "$5" && es=no
  registrar "$TSV" "$CAB" "$1"$'\t'"$2"$'\t'"$3"$'\t'"$4"$'\t'"${au:--}"$'\t'"${ms:--}"$'\t'"${rtf:--}"$'\t'"$MIN"$'\t'"$es"$'\t'"$6"
  echo "$1 $2 $3 r$4: audio=${au:--}s total=${ms:--}ms RTF=${rtf:--} min_libre=${MIN}MB español=$es salida=$6"
}

INS=$(python3 "$G/scripts/voces.py" instruct "$F") || exit 3
python3 "$G/scripts/voces.py" texto "$F" > "$D/referencia.txt"
SEM=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["semilla"])' "$F")
DISPOSITIVOS=${DISPOSITIVOS:-"Vulkan0 CPU"}
for DISPOSITIVO in $DISPOSITIVOS; do
  B=$(bin_dir); [ -x "$B/qwen-tts" ] || { echo "sin $B/qwen-tts: se salta $DISPOSITIVO"; continue; }
  # VoiceDesign también se mide: es el que diseña las voces (en desarrollo, no en la máquina del jugador).
  lanzar "$D/logs/voicedesign-$DISPOSITIVO.log" "$B/qwen-tts" --model "$M/$DISENO" --codec "$M/$CODEC" \
    --device "$DISPOSITIVO" --instruct "$INS" --lang "$LANG_VOZ" --seed "$SEM" -o "$D/voicedesign-$DISPOSITIVO.wav" < "$D/referencia.txt"
  fila "1.7b-voicedesign" "$DISPOSITIVO" referencia 1 "$D/logs/voicedesign-$DISPOSITIVO.log" $?
  [ -s "$D/referencia.wav" ] || cp "$D/voicedesign-$DISPOSITIVO.wav" "$D/referencia.wav" 2>/dev/null
done
[ -s "$D/referencia.wav" ] || { echo "ABORTO: VoiceDesign no dio la referencia (ver $D/logs/)"; exit 4; }

for MOD in qwen-talker-0.6b-base-Q8_0.gguf qwen-talker-1.7b-base-Q8_0.gguf; do
  [ -s "$M/$MOD" ] || { echo "sin $MOD: se salta"; continue; }
  corto=$(sed 's/qwen-talker-\(.*\)-Q8_0.gguf/\1/' <<< "$MOD")
  for DISPOSITIVO in $DISPOSITIVOS; do
    B=$(bin_dir); [ -x "$B/qwen-tts" ] || continue
    for r in $(seq "$RONDAS"); do
      for frase in corta larga; do
        [ $frase = corta ] && printf '%s\n' "$CORTA" > "$D/frase.txt" || printf '%s\n' "$LARGA" > "$D/frase.txt"
        n=$corto-$DISPOSITIVO-$frase-r$r
        lanzar "$D/logs/$n.log" "$B/qwen-tts" --model "$M/$MOD" --codec "$M/$CODEC" --device "$DISPOSITIVO" \
          --ref-wav "$D/referencia.wav" --ref-text "$D/referencia.txt" --lang "$LANG_VOZ" --seed 7 -o "$D/$n.wav" < "$D/frase.txt"
        fila "$corto" "$DISPOSITIVO" $frase "$r" "$D/logs/$n.log" $?
      done
    done
  done
done
echo; column -t -s $'\t' "$TSV"; echo; echo "banco: $TSV (escucha los .wav de $D)"
