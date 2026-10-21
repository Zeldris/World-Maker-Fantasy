# Solo se carga con `source` (no se ejecuta): si el host no trae psql, pg_dump o pg_restore (la Deck), añade al final del
# PATH los envoltorios de esta carpeta, que van por `podman exec` al contenedor tarkor-postgres. Con los tres, no toca nada.
_DECK_PATH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for _c in psql pg_dump pg_restore; do
  if ! command -v "$_c" >/dev/null 2>&1; then export PATH="$PATH:$_DECK_PATH_DIR"; break; fi
done
unset _c _DECK_PATH_DIR
