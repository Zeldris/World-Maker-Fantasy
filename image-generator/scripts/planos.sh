#!/bin/bash
# IMG-23: cadena de planos con el perfil fotorreal (docs/producto/plan-imagenes/investigacion-tecnicas-diseno.md §4).
# Uso: planos.sh <prompts> <boceto.png> <salida>
#   <prompts>  carpeta con plancha.txt (fondo), sujeto.txt (sujeto sobre verde) y armonia.txt (img2img del montaje)
#   <boceto>   boceto del sujeto sobre verde (bocetos/rasterizar.sh: <nombre>-verde-512.png o -1024.png)
#   <salida>   carpeta de generar.sh: intentos/{plancha,sujeto,montaje,armonia-<fuerza>}.png (+ logs/ y prompts/)
# Fase 1: plancha + sujeto guiado por el boceto (FUERZA_BOCETO, 0.97) y montaje con montar.sh (HERO y MANADA, ver montar.sh).
# Fase 2: armonización img2img del montaje a FUERZAS (0.5 0.7) con strength_as_noise_level. Lo que ya existe se salta.
# Variables: SEED=3 PASOS=8 PW=640 PH=256 SW=512 SH=192 (FINAL: 1280x512, 1024x384, 16 pasos las pone probar.sh),
# MOMENTO (gradúa solo las armonizaciones: armonia-<fuerza>-<momento>.png), SDCLI, MONTAR=<ruta> (los tests lo sustituyen),
# FICHA (su `encuadre` da HERO y MANADA, ver encuadre.py).
# Siempre pasa por generar.sh con PERFIL=fotorreal. Salidas: 1 falló alguna gradación; 2 falta un txt o argumentos;
# 3 falta el boceto; el resto, el de generar.sh.
set -euo pipefail
G=$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)   # image-generator/
[ $# -eq 3 ] || { sed -n 3,4p "$0"; exit 2; }
P=$1; BOC=$2; D=$3
for t in plancha sujeto armonia; do
  [ -s "$P/$t.txt" ] || { echo "ABORTO: falta el prompt $P/$t.txt"; exit 2; }
done
[ -f "$BOC" ] || { echo "ABORTO: el boceto no existe: $BOC"; exit 3; }
PW=${PW:-640}; PH=${PH:-256}; SW=${SW:-512}; SH=${SH:-192}; PASOS=${PASOS:-8}; SEED=${SEED:-3}
MOM=${MOMENTO:-}; I=$D/intentos
export PERFIL=fotorreal
# HERO y MANADA los lee montar.sh; si no vienen, salen del encuadre de FICHA (o el de por defecto) a la medida de la plancha (IMG-27)
ENC=$(python3 "$G/scripts/encuadre.py" "${FICHA:--}" "$PW" "$PH") || { echo "ABORTO: encuadre de ${FICHA:--} (ver arriba)"; exit 2; }
export HERO="${HERO-$(eval "$ENC"; echo "$HERO")}" MANADA="${MANADA-$(eval "$ENC"; echo "$MANADA")}"
NOISE=(--extra-sample-args strength_as_noise_level=true)
gen() { local n=$1 m=$2 b=$3; shift 3; BOCETO=$b MOMENTO=$m GRADAR=${GRADAR:-1} bash "$G/scripts/generar.sh" "$D" "$n" "$@"; }

[ -s "$I/plancha.png" ] || gen plancha "" "" "$P/plancha.txt" "$PW" "$PH" "$SEED" "$PASOS"
[ -s "$I/sujeto.png" ] || gen sujeto "" "$BOC" "$P/sujeto.txt" "$SW" "$SH" "$SEED" "$PASOS"
bash "${MONTAR:-$G/scripts/montar.sh}" "$I/plancha.png" "$I/sujeto.png" "$I/montaje.png"
# La gradación va aparte de generar.sh: si falla, la cadena sigue y al relanzar se grada lo que quedó sin gradar.
MAL=0
for s in ${FUERZAS:-0.5 0.7}; do
  A=$I/armonia-$s.png
  [ -s "$A" ] || gen "armonia-$s" "" "" "$P/armonia.txt" "$PW" "$PH" "$SEED" "$PASOS" \
    --init-img "$I/montaje.png" --strength "$s" "${NOISE[@]}"
  if [ -n "$MOM" ] && [ "${GRADAR:-1}" != 0 ] && [ ! -s "$I/armonia-$s-$MOM.png" ]; then
    "${GRADAR_SH:-$G/scripts/gradar.sh}" "$A" "$I/armonia-$s-$MOM.png" "$MOM" ${REGION:+"$REGION"} \
      || { MAL=1; echo "ERROR: gradar.sh falló con $A; queda sin gradar (relanzar planos.sh lo reintenta)"; }
  fi
done
[ $MAL = 0 ] || exit 1
echo "Hecho: planos en $D"
