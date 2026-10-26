#!/bin/bash
# IMG-15 r13: cadena de planos (investigacion-tecnicas-diseno.md §4) con el aullador y FLUX.3 en la CPU.
# Uso: bash docs/producto/plan-imagenes/banco/planos.sh 1   → plancha + sujeto (dos pasadas, ~49 + ~30 min) y montaje
#      bash docs/producto/plan-imagenes/banco/planos.sh 2   → armonización del montaje con img2img a 0,5 / 0,7
# (con strength_as_noise_level: sin él, FLUX.3 trata cualquier fuerza casi como ruido total; IMG-19c).
# Entre las dos fases se mira el montaje y se ajusta HERO/MANADA (montar.sh) a la plancha. Lo que ya existe se salta.
set -euo pipefail
R=$(cd "$(dirname "$0")/../../../.." && pwd); B=$R/docs/producto/plan-imagenes/banco
D=$R/image-generator/generated/banco/r13-planos; I=$D/intentos
export MODELO=flux3-image-klein-Q8_0.gguf LLM=Qwen3VL-4B-Instruct-Q4_K_M.gguf VAE=flux2-vae.safetensors TOPE=10800
export LIBERAR_OLLAMA=${LIBERAR_OLLAMA:-0}
X=(--backend diffusion=cpu -t 8); SEED=${SEED:-3}
gen() { bash "$R/image-generator/scripts/generar.sh" "$D" "$@"; }
case ${1:-} in
  1) [ -s "$I/plancha.png" ] || gen plancha "$B/prompts/r13-plancha.txt" 1280 512 "$SEED" 16 "${X[@]}"
     [ -s "$I/sujeto.png" ] || gen sujeto "$B/prompts/r13-sujeto.txt" 1024 384 "$SEED" 16 "${X[@]}"
     bash "$B/montar.sh" "$I/plancha.png" "$I/sujeto.png" "$I/montaje.png" ;;
  2) [ -s "$I/montaje.png" ] || { echo "ABORTO: falta $I/montaje.png (fase 1)"; exit 2; }
     for s in ${FUERZAS:-0.5 0.7}; do
       [ -s "$I/armonia-$s.png" ] || gen "armonia-$s" "$B/prompts/r13-armonia.txt" 1280 512 "$SEED" 16 "${X[@]}" \
         --init-img "$I/montaje.png" --strength "$s" --extra-sample-args strength_as_noise_level=true
     done ;;
  *) echo "uso: planos.sh 1|2"; exit 2 ;;
esac
echo "Hecho: planos fase $1"
