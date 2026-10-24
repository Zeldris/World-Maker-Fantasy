#!/bin/bash
# Demo de FLUX.2 klein 4B en la Deck con prompts reales del juego (tabla ImagePrompt).
# Uso: demo.sh <tipo> <slug> <perfil> <ancho> <alto>
# Protecciones (2026-10-24, tras el bloqueo por memoria): memoria libre al empezar, Ollama vacío, vigilante de
# MemAvailable, tope de cgroup sin swap, aborto si el driver dice 0 MB libres, timeout.
set -u
G=$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)   # image-generator/
B=$G/bin; M=$G/modelos; D=$G/pruebas/demo
mkdir -p "$D/imagenes" "$D/logs" "$D/prompts"
T=$1; S=$2; P=$3; W=$4; H=$5; N="demo-$T-$S-$P-${W}x$H"
MIN_INICIO_MB=7000; MIN_VIGILA_MB=1500

disp() { awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo; }
[ "$(disp)" -ge $MIN_INICIO_MB ] || { echo "ABORTO: solo $(disp) MB libres (<$MIN_INICIO_MB). Cierra navegador/Steam/juego."; exit 3; }
if curl -s --max-time 2 localhost:11434/api/ps | grep -q '"name"'; then echo "ABORTO: Ollama tiene modelos cargados (ollama stop <modelo>)."; exit 3; fi

SQL="select prompt from \"ImagePrompt\" where \"entityType\"='$T' and \"entitySlug\"='$S' and \"sizeProfile\"='$P';"
PROMPT=$(podman exec -i tarkor-postgres psql -U tarkor -d tarkor -At -c "$SQL")
[ -n "$PROMPT" ] || { echo "ABORTO: sin prompt para $T/$S/$P"; exit 3; }
echo "$PROMPT" > "$D/prompts/$N.prompt.txt"

t0=$(date +%s)
systemd-run --user --scope -q -p MemoryMax=8G -p MemorySwapMax=0 \
  timeout 600 "$B/sd-cli" --diffusion-model "$M/diffusion/flux-2-klein-4b-Q8_0.gguf" --llm "$M/text/Qwen3-4B-Q4_K_M.gguf" \
  --vae "$M/vae/full_encoder_small_decoder.safetensors" -p "$PROMPT No text, no signature, no watermark." \
  --cfg-scale 1.0 --steps 4 --sampling-method euler -W "$W" -H "$H" --seed 42 \
  --flash-attn off,diffusion=on --vae-tiling --params-backend disk --max-vram vulkan0=2 -o "$D/imagenes/$N.png" -v > "$D/logs/$N.log" 2>&1 &
PID=$!
MIN=99999
while kill -0 $PID 2>/dev/null; do
  m=$(disp); [ "$m" -lt $MIN ] && MIN=$m
  if [ "$m" -lt $MIN_VIGILA_MB ]; then pkill -9 -f "$B/sd-cli"; echo "VIGILANTE: matado con $m MB libres"; break; fi
  if grep -q "reported free 0.00 MB" "$D/logs/$N.log"; then pkill -9 -f "$B/sd-cli"; echo "ABORTO: el driver dice 0 MB libres (ver logs/$N.log)"; break; fi
  sleep 1
done
wait $PID; rc=$?
echo "$N salida=$rc total=$(( $(date +%s) - t0 ))s min_libre=${MIN}MB $(grep -o 'sampling completed, taking [0-9.]*s' "$D/logs/$N.log") $(grep -o 'decode_first_stage completed, taking [0-9.]*s' "$D/logs/$N.log")"
