#!/bin/bash
# QA-150: ejecuta una orden en el host, desde la raíz del repo. En el sandbox Flatpak de la Deck (/.flatpak-info o
# FLATPAK_ID; solo HOST_SH_SANDBOX=1 lo fuerza, para los tests) pasa por `flatpak-spawn --host --directory=<raíz> bash -lic`
# (con -lic carga el ~/.bashrc del host); fuera, ejecuta la orden tal cual. Uso: host.sh <orden y argumentos…>
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
[ $# -gt 0 ] || { echo "uso: host.sh <orden…>" >&2; exit 2; }
if [ "$HOST_SH_SANDBOX" = 1 ] || [ -e /.flatpak-info ] || [ -n "$FLATPAK_ID" ]; then
  ORDEN=""
  for a in "$@"; do ORDEN+="$(printf '%q' "$a") "; done
  # -i (los ~/.bashrc salen pronto sin él) sin TTY avisa «no job control in this shell»: solo se filtra esa línea de stderr.
  flatpak-spawn --host --directory="$RAIZ" bash -lic "$ORDEN" 2> >(grep -v -e 'cannot set terminal process group' -e 'no job control in this shell' >&2)
  estado=$?
  wait
  exit $estado
fi
cd "$RAIZ" && exec "$@"
