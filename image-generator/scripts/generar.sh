#!/bin/bash
# Genera una imagen con FLUX.2 klein 4B en la Deck a partir de un archivo de prompt.
# Uso: generar.sh <directorio-de-salida> <nombre> <archivo-prompt> <ancho> <alto> [semilla] [pasos] [args extra de sd-cli…]
# p. ej. args extra: -r referencia.png (imagen de referencia de estilo)
# Otro modelo, por variables: MODELO=<gguf de modelos/diffusion> LLM=<gguf de modelos/text> VAE=<de modelos/vae>
# CFG=<escala> TOPE=<s>
# Deja imagen, log y copia del prompt en <directorio-de-salida>/{intentos,logs,prompts}/<nombre>.* (probar.sh le pasa
# generated/<tipo>/<slug>); a mano, p. ej.: generar.sh image-generator/generated/murgol/pruebas v5 prompt.txt 1280 512
# LIBERAR_OLLAMA=1: descarga los modelos de Ollama en vez de abortar (CFG-43).
# Protecciones (2026-10-24, tras el bloqueo por memoria): memoria libre al empezar, Ollama vacío, vigilante de
# MemAvailable, aborto si el driver dice 0 MB libres, timeout. Pesos leídos del disco con 2 GB de GPU: no subirlo.
# sin pipefail: lanza sd-cli en segundo plano, vigila MemAvailable y mata procesos (kill/wait/grep toleran fallos a propósito); no se prueba sin los modelos de la Deck
set -u
G=$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)   # image-generator/
B=$G/bin; M=$G/modelos
D=$1; N=$2; PF=$3; W=$4; H=$5; SEED=${6:-42}; STEPS=${7:-4}; EXTRA=("${@:8}")
mkdir -p "$D/intentos" "$D/logs" "$D/prompts"
# MIN_INICIO_MB: klein baja la memoria libre ~2,2 GB y Z-Image ~3,5 GB (IMG-15); el vigilante mata con menos de 1500.
MIN_INICIO_MB=${MIN_INICIO_MB:-7000}; MIN_VIGILA_MB=1500
MODELO=${MODELO:-flux-2-klein-4b-Q8_0.gguf}; LLM=${LLM:-Qwen3-4B-Q4_K_M.gguf}; CFG=${CFG:-1.0}; TOPE=${TOPE:-900}
VAE=${VAE:-full_encoder_small_decoder.safetensors}

disp() { awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo; }
[ "$(disp)" -ge $MIN_INICIO_MB ] || { echo "ABORTO: solo $(disp) MB libres (<$MIN_INICIO_MB). Cierra navegador/Steam/juego."; exit 3; }
# Solo cuentan los que ocupan memoria (size, que Ollama siempre manda): el Ollama simulado de los tests ya no lista
# ninguno en /api/ps, pero uno arrancado antes de ese cambio sí, sin size.
cargados() { curl -s --max-time 2 localhost:11434/api/ps | python3 -c 'import json,sys; [print(m["name"]) for m in json.load(sys.stdin).get("models", []) if m.get("size", 0) > 0]' 2>/dev/null; }
# CFG-43: LIBERAR_OLLAMA=1 (lo pone la interfaz) descarga los modelos en vez de abortar; keep_alive 0 los saca de memoria.
if [ "${LIBERAR_OLLAMA:-0}" = 1 ]; then
  # El de embeddings no acepta /api/generate: se descarga con /api/embed. La descarga es asíncrona: hasta 15 s.
  for m in $(cargados); do
    echo "Ollama: descargando $m"
    curl -s --max-time 10 localhost:11434/api/generate -d "{\"model\":\"$m\",\"keep_alive\":0}" > /dev/null
    curl -s --max-time 10 localhost:11434/api/embed -d "{\"model\":\"$m\",\"input\":\"\",\"keep_alive\":0}" > /dev/null
  done
  for _ in $(seq 15); do [ -z "$(cargados)" ] && break; sleep 1; done
fi
[ -z "$(cargados)" ] || { echo "ABORTO: Ollama tiene modelos cargados (ollama stop <modelo>)."; exit 3; }
# QA-226: el tercer argumento es una ruta; con el texto del prompt, el mensaje lo dice sin repetir el texto entero.
[ -s "$PF" ] || { echo "ABORTO: el tercer argumento es la ruta de un archivo de prompt, y «${PF:0:60}» no existe o está vacío"; exit 3; }
PROMPT=$(cat "$PF")
cp "$PF" "$D/prompts/$N.txt"
LOG=$D/logs/$N.log

t0=$(date +%s)
# CFG-43: sd-cli con sus librerías ggml; las de Ollama (LD_LIBRARY_PATH del host) le quitan la GPU: «No devices found».
LD_LIBRARY_PATH="$B" timeout "$TOPE" "$B/sd-cli" --diffusion-model "$M/diffusion/$MODELO" --llm "$M/text/$LLM" \
  --vae "$M/vae/$VAE" -p "$PROMPT" \
  --cfg-scale "$CFG" --steps "$STEPS" --sampling-method euler -W "$W" -H "$H" --seed "$SEED" \
  --flash-attn off,diffusion=on --vae-tiling --params-backend disk --max-vram vulkan0=2 "${EXTRA[@]}" -o "$D/intentos/$N.png" -v > "$LOG" 2>&1 &
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
