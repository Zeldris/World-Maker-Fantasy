#!/bin/bash
# IMG-17: mide una imagen frente a los 5 banners de GPT de su tipo y momento (lista en estilo/gradacion.json):
# EMD de Y/Cb/Cr frente a cada uno, la mediana y las stats. Solo ffmpeg, segundos.
# Uso: medir.sh <imagen> <tipo> <momento>   (IMAGENES=<carpeta> cambia dónde están los banners de GPT)
set -euo pipefail
G=$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)   # image-generator/
RAIZ=$(cd "$G/.." && pwd)
[ $# -eq 3 ] || { sed -n 4,5p "$0"; exit 2; }
IMG=$1; TIPO=$2; MOM=$3
[ -f "$IMG" ] || { echo "ABORTO: no existe $IMG"; exit 2; }
IMAGENES=${IMAGENES:-$RAIZ/backend/uploads/images}
mapfile -t REFS < <(python3 -I - "$G/estilo/gradacion.json" "$TIPO" "$MOM" <<'PY'
import json, sys
ruta, tipo, mom = sys.argv[1:]
try:
    for a in json.load(open(ruta))['referencias'][tipo][mom]['archivos']:
        print(a)
except KeyError:
    sys.exit(f'ABORTO: gradacion.json no tiene referencias para {tipo}/{mom}')
PY
)
[ ${#REFS[@]} -gt 0 ] || exit 2
RUTAS=(); for r in "${REFS[@]}"; do RUTAS+=("$IMAGENES/$r"); done
echo "# $IMG  ($TIPO, $MOM) frente a ${#RUTAS[@]} banners de GPT"
python3 -I "$G/scripts/medir/emd.py" "$IMG" "${RUTAS[@]}"
echo "STATS $("$G/scripts/medir/stats.sh" "$IMG")"
