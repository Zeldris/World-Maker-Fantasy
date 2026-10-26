#!/bin/bash
# IMG-17: gradación de una imagen ya generada, solo ffmpeg (~0,3 s): cadena base común (A) + tinte del momento.
# Uso: gradar.sh <entrada> <salida> <momento> [region]     momento: dia | atardecer | noche
#      gradar.sh --hornear <momento> [archivo.cube] [region]   guarda el color de la orden como LUT 3D
# Las órdenes viven en estilo/gradacion.json. Si existe estilo/lut/<momento>.cube (región: <region>-<momento>.cube),
# el color sale de esa LUT (lut3d) en vez de las curvas; el acabado (afilado, viñeta, grano) es siempre el mismo.
# Orden: color primero, grano al final (el grano no pasa por el afilado). Escala a 1280x512 y escribe PNG sin pérdida.
set -euo pipefail
G=$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)   # image-generator/
JSON=$G/estilo/gradacion.json

# Imprime «color» (curvas base + tinte) y «acabado» de la orden, en dos líneas.
orden() {
  python3 -I - "$JSON" "$1" "${2:-}" <<'PY'
import json, sys
ruta, momento, region = sys.argv[1:]
j = json.load(open(ruta))
o = j.get('regiones', {}).get(region, {}).get(momento) if region else None
o = o or j['momentos'].get(momento)
if o is None:
    sys.exit(f'ABORTO: momento desconocido: {momento} (dia, atardecer, noche)')
print(','.join(x for x in (j['base']['color'], o['tinte']) if x))
print(j['base']['acabado'])
PY
}
momento_valido() { [[ $1 =~ ^[a-z0-9-]+$ ]] || { echo "ABORTO: «$1» no es un momento o región válido"; exit 2; }; }

if [ "${1:-}" = "--hornear" ]; then
  [ $# -ge 2 ] || { sed -n 4p "$0"; exit 2; }
  MOM=$2; momento_valido "$MOM"; REG=${4:-}; [ -z "$REG" ] || momento_valido "$REG"
  LUT=${3:-$G/estilo/lut/${REG:+$REG-}$MOM.cube}
  mapfile -t O < <(orden "$MOM" "$REG")
  T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
  # Una malla neutra (haldclut nivel 6: 36x36x36 colores, ~1 MB por LUT) pasa por las curvas y se vuelca a .cube (rojo varía más rápido).
  ffmpeg -y -v error -f lavfi -i haldclutsrc=6 -vf "format=gbrp,${O[0]},format=rgb24" -frames:v 1 "$T/hald.png"
  ffmpeg -y -v error -i "$T/hald.png" -f rawvideo -pix_fmt rgb24 "$T/hald.raw"
  mkdir -p "$(dirname "$LUT")"
  python3 -I - "$T/hald.raw" "$LUT" "$MOM" <<'PY'
import sys
crudo = open(sys.argv[1], 'rb').read()
n = 36
assert len(crudo) == n ** 3 * 3, len(crudo)
with open(sys.argv[2], 'w') as f:
    f.write(f'TITLE "gradacion {sys.argv[3]}"\nLUT_3D_SIZE {n}\n')
    for i in range(n ** 3):
        r, g, b = crudo[i * 3:i * 3 + 3]
        f.write(f'{r / 255:.4f} {g / 255:.4f} {b / 255:.4f}\n')
PY
  echo "LUT escrita: $LUT"
  exit 0
fi

[ $# -ge 3 ] || { sed -n 3p "$0"; exit 2; }
ENT=$1; SAL=$2; MOM=$3; REG=${4:-}
momento_valido "$MOM"; [ -z "$REG" ] || momento_valido "$REG"
[ -f "$ENT" ] || { echo "ABORTO: no existe $ENT"; exit 2; }
mapfile -t O < <(orden "$MOM" "$REG")
LUT=$G/estilo/lut/${REG:+$REG-}$MOM.cube
[ -n "$REG" ] && [ ! -f "$LUT" ] && LUT=$G/estilo/lut/$MOM.cube
COLOR=${O[0]}; [ ! -f "$LUT" ] || COLOR="lut3d=file=$LUT"
ffmpeg -y -v error -i "$ENT" -vf "scale=1280:512:flags=lanczos,format=gbrp,${COLOR},${O[1]},format=rgb24" -frames:v 1 "$SAL"
