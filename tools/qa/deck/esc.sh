#!/bin/bash
# esc.sh <orden…>: escenario.sh con los envoltorios de esta carpeta delante en el PATH. (escenario.sh ya los añade
# solo si falta psql, pg_dump o pg_restore; esto los fuerza.) Uso: bash tools/qa/host.sh bash tools/qa/deck/esc.sh cargar <nombre>
. "$(dirname "$0")/_raiz.sh"
export PATH="$DECK:$PATH"
exec bash tools/qa/escenario.sh "$@"
