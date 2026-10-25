#!/bin/bash
# QA-245: todo lo que el juego sabe de un slug, en una sola salida (catálogo, despiece, enciclopedia, población, recetas,
# chunks de lore y demás diccionarios de worldCatalog.ts), sin grep/sed sobre sus 12.000 líneas.
#   bash tools/qa/ficha.sh <slug>            # la ficha; con un slug que no existe, 5 parecidos y código 1
#   bash tools/qa/ficha.sh <slug> --canon    # además, dónde lo nombra el canon (docs/rpgtarkor y docs/canon-opencode)
#   bash tools/qa/ficha.sh --ayuda
# La lógica está en backend/src/scripts/ficha.ts (ficha.test.ts); el script pasa por host.sh (npx en la Deck).
set -u
cd "$(git rev-parse --show-toplevel)"
SLUG=""; CANON=0
for a in "$@"; do
  case "$a" in
    --ayuda|-h|--help) sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    --canon) CANON=1 ;;
    -*) echo "ficha.sh: opción desconocida: $a (ver --ayuda)" >&2; exit 2 ;;
    *) SLUG="$a" ;;
  esac
done
[ -n "$SLUG" ] || { echo "ficha.sh: falta el slug (ver --ayuda)" >&2; exit 2; }
bash tools/qa/host.sh bash -c 'cd backend && npx tsx src/scripts/ficha.ts "$1"' _ "$SLUG"
ESTADO=$?
if [ "$CANON" = 1 ]; then
  NOMBRE="$(bash tools/qa/host.sh bash -c 'cd backend && npx tsx src/scripts/ficha.ts "$1" --nombre' _ "$SLUG" 2>/dev/null)"
  echo "# Canon (docs/rpgtarkor, docs/canon-opencode)"
  { grep -rnF -- "$SLUG" docs/rpgtarkor docs/canon-opencode 2>/dev/null
    [ -n "$NOMBRE" ] && grep -rniF -- "$NOMBRE" docs/rpgtarkor docs/canon-opencode 2>/dev/null
  } | awk '!visto[$0]++' | head -20 | cut -c1-160
fi
exit $ESTADO
