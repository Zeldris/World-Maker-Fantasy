#!/bin/bash
# QA-245: todo lo que el juego sabe de un slug, en una sola salida (catálogo, despiece, enciclopedia, población, recetas,
# chunks de lore y demás diccionarios de worldCatalog.ts), sin grep/sed sobre sus 12.000 líneas.
#   bash tools/qa/ficha.sh <slug>            # la ficha; con un slug que no existe, 5 parecidos y código 1
#   bash tools/qa/ficha.sh <slug> --canon    # además, dónde lo nombra el canon (docs/rpgtarkor y docs/canon-opencode)
#   bash tools/qa/ficha.sh --ayuda
# La salida acaba con «# Fuente»: archivo:línea de cada aparición del slug en el código (QA-260).
# La lógica está en backend/src/scripts/ficha.ts (ficha.test.ts); el script pasa por host.sh (npx en la Deck).
set -u
cd "$(git rev-parse --show-toplevel)"
SLUG=""; CANON=""
for a in "$@"; do
  case "$a" in
    --ayuda|-h|--help) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    --canon) CANON="--canon" ;;
    -*) echo "ficha.sh: opción desconocida: $a (ver --ayuda)" >&2; exit 2 ;;
    *) [ -z "$SLUG" ] || { echo "ficha.sh: un solo slug; sobra «$a» (ver --ayuda)" >&2; exit 2; }; SLUG="$a" ;;
  esac
done
[ -n "$SLUG" ] || { echo "ficha.sh: falta el slug (ver --ayuda)" >&2; exit 2; }
exec bash tools/qa/host.sh bash -c 'cd backend && npx tsx src/scripts/ficha.ts "$@"' _ "$SLUG" ${CANON:+"$CANON"}
