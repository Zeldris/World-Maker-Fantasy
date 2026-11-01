#!/bin/bash
# Prueba de la usuaria: genera la imagen de una entidad con su prompt de la enciclopedia (tabla ImagePrompt).
# Uso: probar.sh <tipo> <slug> <perfil> [semilla=42] [pasos=6] [args extra de sd-cli…]
# p. ej.: probar.sh fauna cuernahoja-macho banner 7
# Usa el prompt usado (CFG-38) si lo hay, si no el base. Tamaño por perfil, a la medida que aguanta la Deck
# (se escala después); W=… H=… lo cambian, y MUNDO=… el mundo (helek-sirik). Llama a generar.sh (protecciones
# de memoria) y deja todo por elemento en generated/<tipo>/<slug>/: intentos/, prompts/ y logs/ (<perfil>-s<semilla>-p<pasos>-<fecha>.*),
# registro.tsv (una fila por intento), notas.md (lo que le parece a la usuaria) y, al elegir en la interfaz,
# <slug>-<perfil>.png, con el nombre del juego (se copia a backend/uploads/images/<tipo>/).
# PROMPT_ARCHIVO=<archivo> usa ese prompt (pegado en la interfaz, CFG-43) en vez del de la base; el registro dice «pegado».
# IMG-23: perfil fotorreal (FLUX.3 klein en CPU, ver «Perfil fotorreal» del README): prompt de la ficha
# image-generator/fichas/<tipo>/<slug>.json (FICHAS=<carpeta> la cambia) con prompt_ficha.py, o PROMPT_ARCHIVO; sin Postgres.
# PLANOS=<carpeta con plancha.txt, sujeto.txt y armonia.txt>: en vez de una imagen, la cadena de planos (planos.sh) en
# <slug>/planos-<fecha>/; el boceto sale de BOCETO o de la ficha (plantilla.py + rasterizar.sh).
# Borrador 640x256 y 8 pasos; FINAL=1, 1280x512 y 16. MOMENTO=dia|atardecer|noche (por defecto el de la ficha), BOCETO, GRADAR, REGION.
# sin pipefail: depende del código de salida de generar.sh (RC=$?) tras vigilar y matar sd-cli; no se prueba sin los modelos de la Deck
set -u
G=$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)   # image-generator/
[ $# -ge 3 ] || { sed -n 3,4p "$0"; exit 2; }
T=$1; S=$2; P=$3; SEED=${4:-42}; STEPS=${5:-6}; EXTRA=("${@:6}")
case $P in
  banner) DW=1280; DH=512 ;;
  thumbnail) DW=768; DH=768 ;;
  mapa) DW=832; DH=624 ;;
  icono) DW=512; DH=512 ;;
  fotorreal) if [ "${FINAL:-0}" = 1 ]; then DW=1280; DH=512; DS=16; else DW=640; DH=256; DS=8; fi
    [ $# -ge 5 ] || STEPS=$DS ;;
  *) echo "ABORTO: perfil desconocido: $P (banner, thumbnail, mapa, icono, fotorreal)"; exit 2 ;;
esac
W=${W:-$DW}; H=${H:-$DH}; MUNDO=${MUNDO:-helek-sirik}
# Van tal cual a la consulta: solo minúsculas, cifras y guiones.
for v in "$T" "$S" "$MUNDO"; do [[ $v =~ ^[A-Za-z0-9_-]+$ ]] || { echo "ABORTO: «$v» no es un tipo, slug o mundo válido"; exit 2; }; done

MOMENTO=${MOMENTO:-}; RECETA=
FICHA=${FICHAS:-$G/fichas}/$T/$S.json
PLANOS=${PLANOS:-}
if [ "$P" = fotorreal ] && [ -n "$PLANOS" ]; then
  [ -d "$PLANOS" ] || { echo "ABORTO: PLANOS no es una carpeta: $PLANOS"; exit 3; }
  PROMPT=planos; FUENTE=planos
  if [ -f "$FICHA" ] && [ -z "$MOMENTO" ]; then
    MOMENTO=$(python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1])).get("momento") or "dia")' "$FICHA") \
      || { echo "ABORTO: no se pudo leer la ficha $FICHA"; exit 3; }
  fi
elif [ "$P" = fotorreal ] && [ -z "${PROMPT_ARCHIVO:-}" ]; then
  [ -f "$FICHA" ] || { echo "ABORTO: fotorreal no usa los prompts de la base (no son de esa plantilla): escribe la ficha $FICHA o pasa PROMPT_ARCHIVO"; exit 3; }
  [ -n "$MOMENTO" ] || MOMENTO=$(python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1])).get("momento") or "dia")' "$FICHA") \
    || { echo "ABORTO: no se pudo leer la ficha $FICHA"; exit 3; }
  AF=(--perfil fotorreal --momento "$MOMENTO"); [ -z "${VARIANTE:-}" ] || AF+=(--variante "$VARIANTE"); [ -z "${ESTACION:-}" ] || AF+=(--estacion "$ESTACION")
  PROMPT=$(python3 "$G/scripts/prompt_ficha.py" "$FICHA" "${AF[@]}") || { echo "ABORTO: prompt_ficha.py falló con $FICHA (ver arriba)"; exit 3; }
  [ -n "$PROMPT" ] || { echo "ABORTO: prompt_ficha.py no devolvió prompt para $FICHA"; exit 3; }
  FUENTE=ficha
elif [ -n "${PROMPT_ARCHIVO:-}" ]; then
  PROMPT=$(cat "$PROMPT_ARCHIVO" 2>/dev/null); FUENTE=pegado
  [ -n "$PROMPT" ] || { echo "ABORTO: PROMPT_ARCHIVO vacío o inexistente: $PROMPT_ARCHIVO"; exit 3; }
else
  psql_() { podman exec -i tarkor-postgres psql -U tarkor -d tarkor -At -c "$1"; }
  WHERE="\"worldId\"=(select id from \"World\" where slug='$MUNDO') and \"entityType\"='$T' and \"entitySlug\"='$S' and \"sizeProfile\"='$P'"
  PROMPT=$(psql_ "select \"promptUsado\" from \"ImagePrompt\" where $WHERE;"); FUENTE=usado
  [ -n "$PROMPT" ] || { PROMPT=$(psql_ "select prompt from \"ImagePrompt\" where $WHERE;"); FUENTE=base; }
  [ -n "$PROMPT" ] || { echo "ABORTO: sin prompt para $T/$S/$P (genéralo en la enciclopedia)"; exit 3; }
fi

D=$G/generated/$T/$S; mkdir -p "$D"
N="$P-s$SEED-p$STEPS-$(date +%Y%m%d-%H%M%S)"
PF=$(mktemp); trap 'rm -f "$PF"' EXIT
printf '%s\n' "$PROMPT" > "$PF"
INI=$(date +%s)
REGISTRO_EXTRA="${EXTRA[*]}"
if [ "$P" = fotorreal ] && [ -n "$PLANOS" ]; then
  BOC=${BOCETO:-}
  if [ -z "$BOC" ]; then
    [ -f "$FICHA" ] || { echo "ABORTO: PLANOS necesita BOCETO o la ficha $FICHA (de ahí sale el boceto)"; exit 3; }
    if [ "${FINAL:-0}" = 1 ]; then TB=1024; else TB=512; fi
    SVG=$(python3 "$G/bocetos/plantilla.py" "$FICHA") && bash "$G/bocetos/rasterizar.sh" "$FICHA" > /dev/null \
      || { echo "ABORTO: no se pudo hacer el boceto de $FICHA (¿tiene boceto.plan?)"; exit 3; }
    BOC=$(dirname "$SVG")/$(basename "$SVG" .svg)-verde-$TB.png
  fi
  if [ "${FINAL:-0}" = 1 ]; then SWP=1024 SHP=384; else SWP=512 SHP=192; fi
  PD=$D/planos-$(date +%Y%m%d-%H%M%S)
  REGISTRO_EXTRA="fotorreal momento=${MOMENTO:--} boceto=$(basename "$BOC") planos=$PD ${EXTRA[*]}"
  FUERZAS=${FUERZAS:-0.5 0.7}; PW=$W PH=$H FUERZAS="$FUERZAS" SW=${SW:-$SWP} SH=${SH:-$SHP} PASOS=$STEPS SEED=$SEED MOMENTO=$MOMENTO \
    "$G/scripts/planos.sh" "$PLANOS" "$BOC" "$PD"; RC=$?
  RES=$PD/intentos/armonia-${FUERZAS%% *}.png   # el registro y las notas van en la carpeta del elemento
elif [ "$P" = fotorreal ]; then
  # Con PROMPT_ARCHIVO y sin MOMENTO no se grada.
  RECETA="fotorreal momento=${MOMENTO:--} boceto=$([ -n "${BOCETO:-}" ] && basename "$BOCETO" || echo -) "
  REGISTRO_EXTRA="$RECETA${EXTRA[*]}"
  PERFIL=fotorreal MOMENTO=$MOMENTO "$G/scripts/generar.sh" "$D" "$N" "$PF" "$W" "$H" "$SEED" "$STEPS" "${EXTRA[@]}"; RC=$?
else
  "$G/scripts/generar.sh" "$D" "$N" "$PF" "$W" "$H" "$SEED" "$STEPS" "${EXTRA[@]}"; RC=$?
fi
[ -f "$D/registro.tsv" ] || printf 'fecha\tnombre\tperfil\tprompt\tsemilla\tpasos\ttamaño\textra\tsalida\tsegundos\n' > "$D/registro.tsv"
printf '%s\t%s\t%s\t%s\t%s\t%s\t%sx%s\t%s\t%s\t%s\n' "$(date -Iseconds)" "$N" "$P" "$FUENTE" \
  "$SEED" "$STEPS" "$W" "$H" "$REGISTRO_EXTRA" "$RC" "$(( $(date +%s) - INI ))" >> "$D/registro.tsv"
[ -f "$D/notas.md" ] || printf '# Notas de %s/%s\n\nUna línea por intento: nombre (de registro.tsv) y qué te parece, qué sobra o qué falta.\n\n' "$T" "$S" > "$D/notas.md"
echo "imagen: ${RES:-$D/intentos/$N.png} (prompt $FUENTE)"
exit $RC
