#!/bin/bash
# QA-72 (retro del PR #50, 2026-10-13): lo que `.githooks/pre-push` mira de cada rama que se sube, aparte
# para poder probarlo (`tools/qa/tests/test_prepush_ramas.py`). Lee de la entrada lo que git le pasa al
# gancho («ref local, sha local, ref remota, sha remota» por rama) y:
#   - escribe en $1 los archivos que cambian (QA-35: imágenes);
#   - escribe en $2 los commits nuevos, uno por línea (QA-66);
#   - comprueba la bitácora de cada commit que se sube (QA-69) y sale con 1 si no cumple.
# La bitácora se lee con BITACORA_PY (por defecto, la de este repo), para poder probarlo en otro.
set -uo pipefail
cambiados="$1"
subidos="$2"
bitacora_py="${BITACORA_PY:-$(dirname "$0")/bitacora.py}"
: > "$cambiados"
: > "$subidos"
CERO=0000000000000000000000000000000000000000
while read -r _ sha_local _ sha_remoto; do
  [ "$sha_local" = "$CERO" ] && continue
  # Desde dónde mirar los cambios: lo que ya tiene la rama remota si ese commit está aquí; si no (rama
  # nueva, o la otra cuenta subió y no se ha traído), desde donde se separó de main.
  if [ "$sha_remoto" != "$CERO" ] && git cat-file -e "$sha_remoto^{commit}" 2>/dev/null; then
    base="$sha_remoto"
  else
    base=$(git merge-base "$sha_local" origin/main 2>/dev/null || echo "")
  fi
  [ -n "$base" ] && git diff --name-only "$base" "$sha_local" >> "$cambiados" 2>/dev/null
  # Commits nuevos de verdad: los que no están en ninguna rama remota conocida.
  git log --format='  %h %s' "$sha_local" --not --remotes >> "$subidos" 2>/dev/null
  # QA-69: la bitácora tal como va en el commit que se sube, no la del directorio de trabajo.
  if git cat-file -e "$sha_local:docs/registros/traspaso.md" 2>/dev/null; then
    tmp=$(mktemp)
    git show "$sha_local:docs/registros/traspaso.md" > "$tmp"
    python3 "$bitacora_py" "$tmp" || { rm -f "$tmp"; exit 1; }
    rm -f "$tmp"
  fi
done
exit 0
