#!/bin/bash
# IMG-15 r13 / IMG-19c r14: cadena de planos (investigacion-tecnicas-diseno.md §4) con el aullador y FLUX.3 en la CPU.
# Uso: [RONDA=r14] bash docs/producto/plan-imagenes/banco/planos.sh 1|2|3
#   1 → plancha + sujeto sobre verde y montaje (montar.sh)
#   2 → armonización del montaje con img2img (-i) a FUERZAS (0,5 / 0,7), con strength_as_noise_level: sin él, FLUX.3
#       trata cualquier fuerza casi como ruido total
#   3 → armonización con el montaje como referencia (-r) y el prompt <ronda>-armonia-ref.txt
# Entre las fases se mira el montaje y se ajusta HERO/MANADA (montar.sh) a la plancha. Lo que ya existe se salta.
# Prompts: banco/prompts/<ronda>-{plancha,sujeto,armonia,armonia-ref}.txt. Imágenes: generated/banco/<ronda>-<CARPETA>/
# (CARPETA=planos por defecto; el candidato a tamaño final de IMG-21 va en otra para no saltarse por el borrador).
# r13 va a 1280x512 / 16 pasos; r14 es borrador (640x256, sujeto 512x192, 8 pasos) y el sujeto parte del boceto verde
# (bocetos/rasterizar.sh) con FUERZA_BOCETO (0,97, IMG-19b). PW/PH, SW/SH, PASOS, BOCETO y TOPE lo cambian.
set -euo pipefail
R=$(cd "$(dirname "$0")/../../../.." && pwd); B=$R/docs/producto/plan-imagenes/banco
RONDA=${RONDA:-r13}; D=$R/image-generator/generated/banco/$RONDA-${CARPETA:-planos}; I=$D/intentos; P=$B/prompts/$RONDA
case $RONDA in
  r13) PW=${PW:-1280} PH=${PH:-512} SW=${SW:-1024} SH=${SH:-384} PASOS=${PASOS:-16} BOCETO=${BOCETO:-} ;;
  *) PW=${PW:-640} PH=${PH:-256} SW=${SW:-512} SH=${SH:-192} PASOS=${PASOS:-8}
     BOCETO=${BOCETO-$R/image-generator/bocetos/depredador-verde-512.png}
     export HERO=${HERO:-50:246:520} MANADA=${MANADA:-45:150:100 200:145:75:v 500:152:115} ;;
esac
export MODELO=flux3-image-klein-Q8_0.gguf LLM=Qwen3VL-4B-Instruct-Q4_K_M.gguf VAE=flux2-vae.safetensors
export TOPE=${TOPE:-10800} LIBERAR_OLLAMA=${LIBERAR_OLLAMA:-0}
X=(--backend diffusion=cpu -t 8); SEED=${SEED:-3}; NOISE=(--extra-sample-args strength_as_noise_level=true)
gen() { bash "$R/image-generator/scripts/generar.sh" "$D" "$@"; }
case ${1:-} in
  1) [ -s "$I/plancha.png" ] || gen plancha "$P-plancha.txt" "$PW" "$PH" "$SEED" "$PASOS" "${X[@]}"
     if [ ! -s "$I/sujeto.png" ]; then
       ini=(); [ -z "$BOCETO" ] || ini=(--init-img "$BOCETO" --strength "${FUERZA_BOCETO:-0.97}" "${NOISE[@]}")
       gen sujeto "$P-sujeto.txt" "$SW" "$SH" "$SEED" "$PASOS" "${X[@]}" "${ini[@]}"
     fi
     bash "$B/montar.sh" "$I/plancha.png" "$I/sujeto.png" "$I/montaje.png" ;;
  2) [ -s "$I/montaje.png" ] || { echo "ABORTO: falta $I/montaje.png (fase 1)"; exit 2; }
     for s in ${FUERZAS:-0.5 0.7}; do
       [ -s "$I/armonia-$s.png" ] || gen "armonia-$s" "$P-armonia.txt" "$PW" "$PH" "$SEED" "$PASOS" "${X[@]}" \
         --init-img "$I/montaje.png" --strength "$s" "${NOISE[@]}"
     done ;;
  3) [ -s "$I/montaje.png" ] || { echo "ABORTO: falta $I/montaje.png (fase 1)"; exit 2; }
     [ -s "$I/armonia-ref.png" ] || gen armonia-ref "$P-armonia-ref.txt" "$PW" "$PH" "$SEED" "$PASOS" "${X[@]}" \
       -r "$I/montaje.png" --ref-image-args vae_input_max_pixels=262144 ;;
  *) echo "uso: [RONDA=r14] planos.sh 1|2|3"; exit 2 ;;
esac
echo "Hecho: $RONDA planos fase $1"
