#!/bin/bash
# QA-150: SQL contra la base de juego. `sql.sh '<consulta>'` o, sin argumento, la consulta por la entrada estándar
# (el SQL con comillas va mejor así). Base: $TARKOR_DB_URL (por defecto tarkor_juego). Usa `psql` y, si el host no lo trae,
# el envoltorio de tools/qa/deck (`_path.sh`, que va por `podman exec`). Todo pasa por host.sh (en la Deck, por flatpak-spawn).
URL="${TARKOR_DB_URL:-postgresql://tarkor:tarkor@localhost:5432/tarkor_juego}"
QA="$(cd "$(dirname "$0")" && pwd)"
if [ $# -gt 0 ]; then CONSULTA="$*"; else CONSULTA="$(cat)"; fi
[ -n "$CONSULTA" ] || { echo "sql.sh: falta la consulta" >&2; exit 2; }
# La consulta viaja en base64: ninguna comilla se pierde por las capas de shell.
B64="$(printf '%s' "$CONSULTA" | base64 | tr -d '\n')"
PATH_SH="$QA/deck/_path.sh"  # psql por podman en la Deck; va como argumento, no pegado en el script (QA-198)
exec bash "$QA/host.sh" bash -c '
  C="$(printf %s "$1" | base64 -d)"
  . "$3"
  printf "%s\n" "$C" | psql "$2" -v ON_ERROR_STOP=1' _ "$B64" "$URL" "$PATH_SH"
