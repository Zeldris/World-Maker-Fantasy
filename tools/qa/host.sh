#!/bin/bash
# QA-150: ejecuta una orden en el host, desde la raíz del repo. En el sandbox Flatpak de la Deck (/.flatpak-info o
# FLATPAK_ID; solo HOST_SH_SANDBOX=1 lo fuerza, para los tests) pasa por `flatpak-spawn --host --directory=<raíz> bash -lic`
# (con -lic carga el ~/.bashrc del host); fuera, ejecuta la orden tal cual. Uso: host.sh <orden y argumentos…>
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
[ $# -gt 0 ] || { echo "uso: host.sh <orden…>" >&2; exit 2; }
if [ "$HOST_SH_SANDBOX" = 1 ] || [ -e /.flatpak-info ] || [ -n "$FLATPAK_ID" ]; then
  ORDEN=""
  for a in "$@"; do ORDEN+="$(printf '%q' "$a") "; done
  # -i (los ~/.bashrc salen pronto sin él) sin TTY avisa de que no hay control de trabajos, en inglés o en español
  # según el locale, y el nvm del ~/.bashrc de la Deck se queja del .npmrc (QA-180): se filtran solo esas líneas de stderr.
  flatpak-spawn --host --directory="$RAIZ" bash -lic "$ORDEN" 2> >(grep -v -F \
    -e 'cannot set terminal process group' -e 'no job control in this shell' \
    -e 'no se puede establecer el grupo de proceso de terminal' -e 'no hay control de trabajos en este shell' \
    -e "Your user’s .npmrc file (\${HOME}/.npmrc)" -e 'has a `globalconfig` and/or a `prefix` setting, which are incompatible with nvm.' \
    -e 'Run `nvm use --delete-prefix ' >&2)
  estado=$?
  wait
  exit $estado
fi
cd "$RAIZ" && exec "$@"
