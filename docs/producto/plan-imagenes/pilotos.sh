#!/bin/bash
# IMG-6: las 5 fichas piloto con semilla fija, en la Deck, con la cadena fotorreal (perfil fotorreal de probar.sh:
# FLUX.3 klein Q8 en CPU, LoRA de estilo de loras/ si está, gradación por momento). Primero la zona (Pastos de la
# Deriva), luego el aullador (macho y hembra), el Cardo y Hulki sin -r y, al final, el aullador macho en segunda
# pasada sobre la zona: prompt con --fondo y la zona (gradada, si la hay) como -r (D10).
# Uso: [FINAL=1] [LORA=<peso>] bash docs/producto/plan-imagenes/pilotos.sh [semilla=3]
# Borrador 640x256 y 8 pasos (~9 min cada una); FINAL=1, 1280x512 y 16 pasos (~50 min cada una: tanda de noche).
# Cada intento queda en image-generator/generated/<tipo>/<slug>/ (probar.sh); el resumen, al final de la salida.
set -euo pipefail
R=$(cd "$(dirname "$0")/../../.." && pwd)
SEED=${1:-3}
if [ "${FINAL:-0}" = 1 ]; then STEPS=16; else STEPS=8; fi   # los de probar.sh: el quinto argumento son los pasos
F=$R/image-generator/fichas; P=$R/image-generator/scripts/prompt_ficha.py
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export LIBERAR_OLLAMA=1
HECHAS=()

# genera <tipo> <slug> [variante] [-- args de sd-cli…]; deja la ruta de la imagen (la gradada, si la hay) en $IMAGEN.
# Con PROMPT_ARCHIVO en el entorno usa ese prompt en vez del de la ficha.
genera() {
  local tipo=$1 slug=$2 var=${3:-}; shift 2; [ $# -gt 0 ] && shift
  [ "${1:-}" = -- ] && shift
  echo "== $tipo/$slug ${var:+($var)} $*"
  # tee a un archivo, no a /dev/stderr: con la salida a un log, abrir /dev/stderr lo vacía en cada imagen.
  VARIANTE=$var bash "$R/image-generator/scripts/probar.sh" "$tipo" "$slug" fotorreal "$SEED" "$STEPS" "$@" | tee "$T/salida.txt" || true   # si probar.sh falla, lo dice el [ -s ] de abajo (ABORTO, exit 3)
  IMAGEN=$(sed -n 's/^imagen: \([^ ]*\).*/\1/p' "$T/salida.txt" | tail -1)
  [ -s "$IMAGEN" ] || { echo "ABORTO: $slug${var:+ ($var)} no dejó imagen"; exit 3; }
  local gradada; gradada=$(ls -t "${IMAGEN%.png}"-*.png 2>/dev/null | head -1 || true)
  [ -n "$gradada" ] && IMAGEN=$gradada
  HECHAS+=("$tipo/$slug${var:+ ($var)}: $IMAGEN")
}

genera location pastos-de-la-deriva; ZONA=$IMAGEN
genera fauna aullador-rojo macho
genera fauna aullador-rojo hembra
genera flora cardo-brujula
genera npc hulki
python3 "$P" "$F/fauna/aullador-rojo.json" --perfil fotorreal --variante macho --fondo "$F/location/pastos-de-la-deriva.json" > "$T/fondo.txt"
# Con PROMPT_ARCHIVO, probar.sh no lee el momento de la ficha: el de la zona, para que se grade igual que ella.
MZ=$(python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1])).get("momento") or "dia")' "$F/location/pastos-de-la-deriva.json")
MOMENTO=${MOMENTO:-$MZ} PROMPT_ARCHIVO="$T/fondo.txt" genera fauna aullador-rojo macho -- -r "$ZONA"
echo "Hecho (semilla $SEED${FINAL:+, FINAL=$FINAL}):"; printf '  %s\n' "${HECHAS[@]}"
