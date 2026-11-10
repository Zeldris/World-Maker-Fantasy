#!/usr/bin/env bash
# MAP-5: abre el visor local de helek.json (sin red). Argumentos: los de servir.py (p. ej. --puerto 9000).
set -euo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUERTO=8765
args=("$@")
for ((k = 0; k < ${#args[@]}; k++)); do
  [[ "${args[k]}" == --puerto ]] && PUERTO="${args[k + 1]:-$PUERTO}"
  [[ "${args[k]}" == --puerto=* ]] && PUERTO="${args[k]#--puerto=}"
done
if [[ "$PUERTO" != 0 ]] && command -v xdg-open >/dev/null 2>&1; then
  (sleep 1 && xdg-open "http://127.0.0.1:${PUERTO}/" >/dev/null 2>&1) &
fi
exec python3 "$AQUI/servir.py" "$@"
