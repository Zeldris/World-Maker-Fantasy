#!/bin/bash
# QA-237 (retro de la difusión, 2026-10-25): la comprobación de la bitácora del pre-push, en el check, para que falle
# antes del commit y no al subir (un amend menos). Sobre la copia de trabajo (con lo no añadido, salvo lo ignorado):
# filas bien formadas; ninguna fila de otra rama ni compartida tocada desde el último commit (BITACORA_COMPARTIDA=1
# la permite, como en el pre-push); y, frente a la rama remota (la misma base que el pre-push: desde main pediría
# tareas que ya salieron de «Hecho recientemente»), cada tarea tachada en el plan también está en «Hecho recientemente».
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
bita() { python3 .claude/gw/scripts/bitacora.py "$@"; }
bita check || exit 1
rama="$(git branch --show-current)"
# Foto de la copia de trabajo: un commit hijo de HEAD con un índice temporal (git stash create no ve lo no añadido).
indice="$(mktemp)"
trap 'rm -f "$indice"' EXIT
# -p: con la hora del índice de verdad; una copia más nueva hace que git dé por limpio un archivo cambiado en su mismo
# segundo y con el mismo tamaño (racy git) y la foto no lo ve (CI local, 2026-10-26: 3 fallos en 40).
cp -p "$(git rev-parse --git-path index)" "$indice" 2>/dev/null || rm -f "$indice"  # sin índice, git parte de cero
foto="$(GIT_INDEX_FILE="$indice" git add -A && GIT_INDEX_FILE="$indice" git write-tree)" &&
  foto="$(git commit-tree "$foto" -p HEAD -m bitacora-check)" ||
  { echo "bitacora-check: no se pudo tomar la foto de la copia de trabajo" >&2; exit 1; }
[ -z "$rama" ] || bita own-row "$foto" "$rama" || exit 1
base="$(git rev-parse -q --verify "refs/remotes/origin/$rama" 2>/dev/null)" || exit 0  # rama sin subir: no hay base
bita closed "$base" "$foto"
