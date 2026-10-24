#!/bin/bash
# Genera una imagen con FLUX.2 klein 4B en la Deck a partir de un archivo de prompt.
# Uso: generar.sh <tanda> <nombre> <archivo-prompt> <ancho> <alto> [semilla] [pasos] [args extra de sd-cli…]
# p. ej. args extra: -r referencia.png (imagen de referencia de estilo)
# Otro modelo, por variables: MODELO=<gguf de modelos/diffusion> LLM=<gguf de modelos/text> CFG=<escala> TOPE=<s>
# Deja imagen, log y copia del prompt en pruebas/<tanda>/{imagenes,logs,prompts}/<nombre>.*
# Protecciones (2026-10-24, tras el bloqueo por memoria): memoria libre al empezar, Ollama vacío, vigilante de
# MemAvailable, aborto si el driver dice 0 MB libres, timeout. Pesos leídos del disco con 2 GB de GPU: no subirlo.
set -u
G=$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)   # image-generator/
B=$G/bin; M=$G/modelos
TANDA=$1; N=$2; PF=$3; W=$4; H=$5; SEED=${6:-42}; STEPS=${7:-4}; EXTRA=("${@:8}")
D=$G/pruebas/$TANDA
mkdir -p "$D/imagenes" "$D/logs" "$D/prompts"
MIN_INICIO_MB=7000; MIN_VIGILA_MB=1500
MODELO=${MODELO:-flux-2-klein-4b-Q8_0.gguf}; LLM=${LLM:-Qwen3-4B-Q4_K_M.gguf}; CFG=${CFG:-1.0}; TOPE=${TOPE:-900}

disp() { awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo; }
[ "$(disp)" -ge $MIN_INICIO_MB ] || { echo "ABORTO: solo $(disp) MB libres (<$MIN_INICIO_MB). Cierra navegador/Steam/juego."; exit 3; }
if curl -s --max-time 2 localhost:11434/api/ps | grep -q '"name"'; then echo "ABORTO: Ollama tiene modelos cargados (ollama stop <modelo>)."; exit 3; fi
[ -s "$PF" ] || { echo "ABORTO: prompt vacío o inexistente: $PF"; exit 3; }
PROMPT=$(cat "$PF")
cp "$PF" "$D/prompts/$N.txt"
LOG=$D/logs/$N.log

t0=$(date +%s)
timeout "$TOPE" "$B/sd-cli" --diffusion-model "$M/diffusion/$MODELO" --llm "$M/text/$LLM" \
  --vae "$M/vae/full_encoder_small_decoder.safetensors" -p "$PROMPT" \
  --cfg-scale "$CFG" --steps "$STEPS" --sampling-method euler -W "$W" -H "$H" --seed "$SEED" \
  --flash-attn off,diffusion=on --vae-tiling --params-backend disk --max-vram vulkan0=2 "${EXTRA[@]}" -o "$D/imagenes/$N.png" -v > "$LOG" 2>&1 &
PID=$!
# $PID es el de `timeout`: un SIGKILL a él no llega a sd-cli, que seguiría con la memoria. Primero el hijo.
matar() { pkill -9 -P $PID; kill -9 $PID; }
MIN=99999
while kill -0 $PID 2>/dev/null; do
  m=$(disp); [ "$m" -lt $MIN ] && MIN=$m
  if [ "$m" -lt $MIN_VIGILA_MB ]; then matar; echo "VIGILANTE: matado con $m MB libres"; break; fi
  if grep -q "reported free 0.00 MB" "$LOG"; then matar; echo "ABORTO: el driver dice 0 MB libres (ver $LOG)"; break; fi
  sleep 1
done
wait $PID; rc=$?
echo "$N salida=$rc total=$(( $(date +%s) - t0 ))s min_libre=${MIN}MB $(grep -o 'sampling completed, taking [0-9.]*s' "$LOG") $(grep -o 'decode_first_stage completed, taking [0-9.]*s' "$LOG")"
exit $rc
