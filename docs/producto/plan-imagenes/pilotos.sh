#!/bin/bash
# IMG-6: las 5 fichas piloto con semilla fija, en la Deck. Primero la zona (Pastos de la Deriva), luego el aullador
# (macho y hembra), el Cardo y Hulki sin -r y, al final, el aullador macho en segunda pasada con la zona como -r (D10).
# Uso: bash docs/producto/plan-imagenes/pilotos.sh [semilla=3] [pasos=6]
# Cada intento queda en image-generator/generated/<tipo>/<slug>/ (probar.sh); el resumen, en la salida.
set -euo pipefail
R=$(cd "$(dirname "$0")/../../.." && pwd)
SEED=${1:-3}; STEPS=${2:-6}
F=$R/image-generator/fichas; P=$R/image-generator/scripts/prompt_ficha.py
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export LIBERAR_OLLAMA=1

# genera <tipo> <slug> <ficha> [args de prompt_ficha.py…] [-- args de sd-cli…]; deja la ruta de la imagen en $IMAGEN
genera() {
  local tipo=$1 slug=$2 ficha=$3; shift 3
  local pargs=() extra=()
  while [ $# -gt 0 ] && [ "$1" != -- ]; do pargs+=("$1"); shift; done
  [ $# -gt 0 ] && { shift; extra=("$@"); }
  python3 "$P" "$F/$ficha" banner "${pargs[@]}" > "$T/$slug.txt"
  echo "== $tipo/$slug (${pargs[*]:-}) ${extra[*]:-}"
  local out; out=$(PROMPT_ARCHIVO="$T/$slug.txt" bash "$R/image-generator/scripts/probar.sh" "$tipo" "$slug" banner "$SEED" "$STEPS" "${extra[@]}" | tee /dev/stderr) || true   # si probar.sh falla, lo dice el [ -s ] de abajo (ABORTO, exit 3)
  IMAGEN=$(sed -n 's/^imagen: \([^ ]*\).*/\1/p' <<< "$out" | tail -1)
  [ -s "$IMAGEN" ] || { echo "ABORTO: $slug no dejó imagen"; exit 3; }
}

genera location pastos-de-la-deriva location/pastos-de-la-deriva.json; ZONA=$IMAGEN
genera fauna aullador-rojo-macho fauna/aullador-rojo.json --variante macho
genera fauna aullador-rojo-hembra fauna/aullador-rojo.json --variante hembra
genera flora cardo-brujula flora/cardo-brujula.json
genera npc hulki npc/hulki.json
genera fauna aullador-rojo-macho fauna/aullador-rojo.json --variante macho --fondo "$F/location/pastos-de-la-deriva.json" -- -r "$ZONA"
echo "Hecho. Zona usada como fondo: $ZONA"
