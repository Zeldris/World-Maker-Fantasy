#!/bin/bash
# Prueba de la usuaria: genera la imagen de una entidad con su prompt de la enciclopedia (tabla ImagePrompt).
# Uso: probar.sh <tipo> <slug> <perfil> [semilla=42] [pasos=4] [args extra de sd-cli…]
# p. ej.: probar.sh fauna cuernahoja-macho banner 7
# Usa el prompt usado (CFG-38) si lo hay, si no el base. Tamaño por perfil, a la medida que aguanta la Deck
# (se escala después); W=… H=… lo cambian, y MUNDO=… el mundo (helek-sirik). Llama a generar.sh (protecciones
# de memoria) y deja todo por elemento en generated/<tipo>/<slug>/: intentos/, prompts/ y logs/ (<perfil>-s<semilla>-p<pasos>-<fecha>.*),
# registro.tsv (una fila por intento), notas.md (lo que le parece a la usuaria) y, al elegir en la interfaz,
# <slug>-<perfil>.png, con el nombre del juego (se copia a backend/uploads/images/<tipo>/).
# PROMPT_ARCHIVO=<archivo> usa ese prompt (pegado en la interfaz, CFG-43) en vez del de la base; el registro dice «pegado».
set -u
G=$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)   # image-generator/
[ $# -ge 3 ] || { sed -n 3,4p "$0"; exit 2; }
T=$1; S=$2; P=$3; SEED=${4:-42}; STEPS=${5:-4}; EXTRA=("${@:6}")
case $P in
  banner) DW=1280; DH=512 ;;
  thumbnail) DW=768; DH=768 ;;
  mapa) DW=832; DH=624 ;;
  icono) DW=512; DH=512 ;;
  *) echo "ABORTO: perfil desconocido: $P (banner, thumbnail, mapa, icono)"; exit 2 ;;
esac
W=${W:-$DW}; H=${H:-$DH}; MUNDO=${MUNDO:-helek-sirik}
# Van tal cual a la consulta: solo minúsculas, cifras y guiones.
for v in "$T" "$S" "$MUNDO"; do [[ $v =~ ^[A-Za-z0-9-]+$ ]] || { echo "ABORTO: «$v» no es un tipo, slug o mundo válido"; exit 2; }; done

if [ -n "${PROMPT_ARCHIVO:-}" ]; then
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
"$G/scripts/generar.sh" "$D" "$N" "$PF" "$W" "$H" "$SEED" "$STEPS" "${EXTRA[@]}"; RC=$?
[ -f "$D/registro.tsv" ] || printf 'fecha\tnombre\tperfil\tprompt\tsemilla\tpasos\ttamaño\textra\tsalida\tsegundos\n' > "$D/registro.tsv"
printf '%s\t%s\t%s\t%s\t%s\t%s\t%sx%s\t%s\t%s\t%s\n' "$(date -Iseconds)" "$N" "$P" "$FUENTE" \
  "$SEED" "$STEPS" "$W" "$H" "${EXTRA[*]}" "$RC" "$(( $(date +%s) - INI ))" >> "$D/registro.tsv"
[ -f "$D/notas.md" ] || printf '# Notas de %s/%s\n\nUna línea por intento: nombre (de registro.tsv) y qué te parece, qué sobra o qué falta.\n\n' "$T" "$S" > "$D/notas.md"
echo "imagen: $D/intentos/$N.png (prompt $FUENTE)"
exit $RC
