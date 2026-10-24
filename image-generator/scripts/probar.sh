#!/bin/bash
# Prueba de la usuaria: genera la imagen de una entidad con su prompt de la enciclopedia (tabla ImagePrompt).
# Uso: probar.sh <tanda> <tipo> <slug> <perfil> [semilla=42] [pasos=4] [args extra de sd-cli…]
# p. ej.: probar.sh 2026-10-25 fauna cuernahoja-macho banner 7
# Usa el prompt usado (CFG-38) si lo hay, si no el base. Tamaño por perfil, a la medida que aguanta la Deck
# (se escala después); W=… H=… lo cambian. Llama a generar.sh (protecciones de memoria) y apunta cada imagen en
# pruebas/<tanda>/registro.tsv; lo que le parece a la usuaria va en pruebas/<tanda>/notas.md. Con los dos se
# analiza la tanda después.
set -u
G=$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)   # image-generator/
[ $# -ge 4 ] || { sed -n 3,4p "$0"; exit 2; }
TANDA=$1; T=$2; S=$3; P=$4; SEED=${5:-42}; STEPS=${6:-4}; EXTRA=("${@:7}")
case $P in
  banner) DW=1280; DH=512 ;;
  thumbnail) DW=768; DH=768 ;;
  mapa) DW=832; DH=624 ;;
  icono) DW=512; DH=512 ;;
  *) echo "ABORTO: perfil desconocido: $P (banner, thumbnail, mapa, icono)"; exit 2 ;;
esac
W=${W:-$DW}; H=${H:-$DH}

psql_() { podman exec -i tarkor-postgres psql -U tarkor -d tarkor -At -c "$1"; }
WHERE="\"entityType\"='$T' and \"entitySlug\"='$S' and \"sizeProfile\"='$P'"
PROMPT=$(psql_ "select \"promptUsado\" from \"ImagePrompt\" where $WHERE;"); FUENTE=usado
[ -n "$PROMPT" ] || { PROMPT=$(psql_ "select prompt from \"ImagePrompt\" where $WHERE;"); FUENTE=base; }
[ -n "$PROMPT" ] || { echo "ABORTO: sin prompt para $T/$S/$P (genéralo en la enciclopedia)"; exit 3; }

D=$G/pruebas/$TANDA; mkdir -p "$D"
N="$T-$S-$P-s$SEED-p$STEPS-$(date +%H%M%S)"
PF=$(mktemp); trap 'rm -f "$PF"' EXIT
printf '%s\n' "$PROMPT" > "$PF"
INI=$(date +%s)
"$G/scripts/generar.sh" "$TANDA" "$N" "$PF" "$W" "$H" "$SEED" "$STEPS" "${EXTRA[@]}"; RC=$?
[ -f "$D/registro.tsv" ] || printf 'fecha\tnombre\ttipo\tslug\tperfil\tprompt\tsemilla\tpasos\ttamaño\textra\tsalida\tsegundos\n' > "$D/registro.tsv"
printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%sx%s\t%s\t%s\t%s\n' "$(date -Iseconds)" "$N" "$T" "$S" "$P" "$FUENTE" \
  "$SEED" "$STEPS" "$W" "$H" "${EXTRA[*]}" "$RC" "$(( $(date +%s) - INI ))" >> "$D/registro.tsv"
[ -f "$D/notas.md" ] || printf '# Notas de la tanda %s\n\nUna línea por imagen: nombre (de registro.tsv) y qué te parece, qué sobra o qué falta.\n\n' "$TANDA" > "$D/notas.md"
echo "imagen: $D/imagenes/$N.png (prompt $FUENTE)"
exit $RC
