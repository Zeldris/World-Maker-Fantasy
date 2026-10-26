#!/bin/bash
# IMG-17: percentiles de luma, saturación y detalle de alta frecuencia (HF) de una imagen, a 1280x512.
# Uso: stats.sh <imagen>   ->   YMIN=… YLOW=… YAVG=… YHIGH=… YMAX=… SATAVG=… HUEMED=… HF=…
set -euo pipefail
f=${1:?uso: stats.sh <imagen>}
[ -f "$f" ] || { echo "ABORTO: no existe $f"; exit 2; }
s=$(ffmpeg -v error -i "$f" -vf "scale=1280:512:flags=lanczos,format=yuv444p,signalstats,metadata=print:file=-" \
  -frames:v 1 -f null - 2>/dev/null | grep -aoE "signalstats\.(YMIN|YLOW|YAVG|YHIGH|YMAX|SATAVG|HUEMED)=[0-9.]+" | sed 's/lavfi.signalstats.//; s/signalstats.//' | tr '\n' ' ')
hf=$(ffmpeg -v error -i "$f" -filter_complex "[0:v]scale=1280:512:flags=lanczos,format=gray,split[a][b];[b]gblur=sigma=2[c];[a][c]blend=all_mode=difference,signalstats,metadata=print:file=-" \
  -frames:v 1 -f null - 2>/dev/null | grep -aoE "YAVG=[0-9.]+" | sed 's/.*=//')
echo "${s}HF=${hf}"
