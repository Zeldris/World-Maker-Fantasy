#!/bin/bash
# IMG-15 r13: monta la cadena de planos con ffmpeg (investigacion-tecnicas-diseno.md §4, paso 3), sin pasadas del modelo.
# Uso: montar.sh <plancha.png> <sujeto-sobre-verde.png> <salida.png>
# El sujeto se recorta por el verde, se ajusta a su caja y se coloca; la manada son
# copias del mismo sujeto, pequeñas, oscurecidas y con bruma (la misma especie, que el modelo no repite solo: r12).
# Variables (px sobre la plancha):
#   HERO="x:pie:ancho" (por defecto 40:495:1200); MANADA="x:pie:ancho[:v] …" (v = volteada; por defecto tres);
#   SOMBRA=0.55 (opacidad de la sombra de contacto), CALIDO=0.04 (gradación cálida), GRANO=4,
#   UMBRAL=12 (es fondo el píxel cuyo verde pasa en más de UMBRAL al rojo y al azul)
set -euo pipefail
PL=$1; SU=$2; OUT=$3
HERO=${HERO:-40:495:1200}; MANADA=${MANADA:-90:300:200 360:290:150:v 980:305:230}
SOMBRA=${SOMBRA:-0.55}; CALIDO=${CALIDO:-0.04}; GRANO=${GRANO:-4}; UMBRAL=${UMBRAL:-12}
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
ff() { ffmpeg -hide_banner -loglevel error -y "$@"; }

# 1) Recorte por dominancia del verde, no por el color de la esquina: FLUX.3 pinta el «chroma-key green» apagado y
# en degradado (r14), y chromakey se lleva también el pelaje oscuro. Alfa abierto 1 px (quita el moteado) y suavizado.
ff -i "$SU" -filter_complex "[0:v]format=rgba,split[c][k];
  [k]geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(g(X,Y)-max(r(X,Y),b(X,Y)),$UMBRAL),255,0)',format=rgba,
  alphaextract,erosion,dilation,gblur=sigma=0.8[m];[c]despill=type=green[d];[d][m]alphamerge" "$T/recorte.png"
# 2) Caja del sujeto (bbox del alfa) y recorte ajustado.
# bbox escribe la caja en el registro de nivel info (ff lo calla)
read -r X1 X2 Y1 Y2 < <(ffmpeg -hide_banner -i "$T/recorte.png" -vf "alphaextract,lut=y='if(gt(val,128),255,0)',bbox=min_val=200" \
  -f null - 2>&1 | grep -o 'x1:[0-9]* x2:[0-9]* y1:[0-9]* y2:[0-9]*' | tail -1 | sed 's/[xy][12]://g' || true)
[ -n "${Y2:-}" ] || { echo "ABORTO: no se encontró el sujeto en $SU (¿todo pasa por verde? sube UMBRAL)"; exit 2; }
ff -i "$T/recorte.png" -vf "crop=$((X2-X1+1)):$((Y2-Y1+1)):$X1:$Y1" "$T/sujeto.png"
SW=$((X2-X1+1)); SH=$((Y2-Y1+1))
echo "sujeto: umbral=$UMBRAL caja=${SW}x${SH} en $X1,$Y1"

# 3) Capas: manada (lejos, oscura, con bruma), sombra de contacto, héroe; 4) gradación y grano comunes.
alto() { echo $(( $1 * SH / SW )); }
IN=(-i "$PL"); FG=""; ULT=0; n=1
for m in $MANADA; do
  IFS=: read -r mx mp mw mv <<< "$m"; mh=$(alto "$mw")
  IN+=(-i "$T/sujeto.png")
  FG+="[$n:v]scale=$mw:$mh$([ "${mv:-}" != v ] || echo ,hflip),eq=brightness=-0.12:saturation=0.45,"
  FG+="colorchannelmixer=rr=0.75:gg=0.55:bb=0.45:aa=0.8,gblur=sigma=1.2[p$n];"
  FG+="[v$ULT][p$n]overlay=$mx:$((mp - mh))[v$n];"; ULT=$n; n=$((n+1))
done
IFS=: read -r hx hp hw <<< "$HERO"; hh=$(alto "$hw"); sh=$(( hh / 7 + 8 ))
IN+=(-i "$T/sujeto.png" -i "$T/sujeto.png")
FG+="[$n:v]scale=$hw:$sh,geq=r=55:g=22:b=12:a='alpha(X,Y)*$SOMBRA',gblur=sigma=7[s];"
FG+="[v$ULT][s]overlay=$hx:$((hp - sh * 2 / 3))[vs];"
FG+="[$((n+1)):v]scale=$hw:$hh[h];[vs][h]overlay=$hx:$((hp - hh))[vh];"
FG+="[vh]colorbalance=rs=$CALIDO:bs=-$CALIDO:rm=$CALIDO:bm=-$CALIDO,eq=contrast=1.05,vignette=PI/6,noise=alls=$GRANO"
ff "${IN[@]}" -filter_complex "[0:v]format=rgba[v0];$FG" -frames:v 1 "$OUT"
echo "montaje: $OUT"
