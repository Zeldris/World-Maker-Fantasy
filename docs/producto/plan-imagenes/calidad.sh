#!/bin/bash
# IMG-15: banco de calidad del generador local con lo que ya hay en la Deck. El mismo prompt (Pastos de la Deriva,
# banner, semilla 3) con cada palanca por separado; se comparan a ojo contra la referencia de ChatGPT.
# Uso: bash docs/producto/plan-imagenes/calidad.sh [semilla=3]
# Cada intento queda en image-generator/generated/location/calidad-<palanca>/ (probar.sh).
set -eu
R=$(cd "$(dirname "$0")/../../.." && pwd)
SEED=${1:-3}; G=$R/image-generator
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export LIBERAR_OLLAMA=1 PROMPT_ARCHIVO=$T/prompt.txt
python3 "$G/scripts/prompt_ficha.py" "$G/fichas/location/pastos-de-la-deriva.json" banner > "$PROMPT_ARCHIVO"

prueba() { local slug=$1 pasos=$2; shift 2; echo "== $slug (${MODELO:-klein-4b} cfg ${CFG:-1.0}, $pasos pasos) $*"
  bash "$G/scripts/probar.sh" location "calidad-$slug" banner "$SEED" "$pasos" "$@" | tail -1; }

prueba pasos6 6                                   # lo de hoy, de referencia
prueba pasos12 12                                 # más pasos con el modelo destilado
prueba hires 6 -W 960 -H 384 --hires --hires-width 1280 --hires-height 512 --hires-denoising-strength 0.5
prueba esrgan 6 --upscale-model "$G/modelos/upscale/RealESRGAN_x4plus.pth"
MODELO=flux-2-klein-base-4b-Q8_0.gguf CFG=3.5 TOPE=3000 prueba base-cfg 20   # modelo sin destilar, con cfg real
echo "Hecho."
