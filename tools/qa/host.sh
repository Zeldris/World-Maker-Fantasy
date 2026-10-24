#!/bin/bash
# QA-150: ejecuta una orden en el host, desde la raíz del repo. En el sandbox Flatpak de la Deck (/.flatpak-info o
# FLATPAK_ID; solo HOST_SH_SANDBOX=1 lo fuerza, para los tests) pasa por `flatpak-spawn --host --directory=<raíz> bash -lic`
# (con -lic carga el ~/.bashrc del host); fuera, ejecuta la orden tal cual. Uso: host.sh <orden y argumentos…>
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
[ $# -gt 0 ] || { echo "uso: host.sh <orden…>" >&2; exit 2; }
# Piloto de Galivelop-workflow (revisión antes de main, 2026-10-23): en un worktree enlazado (el temporal del pre-push
# del flujo, el de un subagente) faltan las dependencias, que no están en git; se enlazan las de la copia principal.
COMUN="$(git -C "$RAIZ" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"
if [ -n "$COMUN" ] && [ "$COMUN" != "$(git -C "$RAIZ" rev-parse --path-format=absolute --git-dir 2>/dev/null)" ]; then
  PRINCIPAL="$(dirname "$COMUN")"
  for f in backend/node_modules frontend/node_modules backend/.env frontend/.env; do
    if [ -e "$PRINCIPAL/$f" ] && [ -d "$RAIZ/${f%/*}" ] && [ ! -e "$RAIZ/$f" ] && [ ! -L "$RAIZ/$f" ]; then ln -s "$PRINCIPAL/$f" "$RAIZ/$f"; fi
  done
fi
if [ "$HOST_SH_SANDBOX" = 1 ] || [ -e /.flatpak-info ] || [ -n "$FLATPAK_ID" ]; then
  # El /tmp del sandbox no lo ve el host: un worktree fuera de la copia principal (el del pre-push) se rehace, en el
  # mismo commit, en logs/ de la copia (ignorada), y la orden corre allí. Nunca dentro de .git/: Vite 8 niega
  # `**/.git/**` y vitest no encuentra ni su setupFiles (QA-227).
  if [ -n "$PRINCIPAL" ] && [ "${RAIZ#"$PRINCIPAL"/}" = "$RAIZ" ]; then
    if [ -n "$(git -C "$RAIZ" status --porcelain --untracked-files=no)" ]; then
      echo "host.sh: $RAIZ no lo ve el host y tiene cambios sin commit; haz commit o córrelo desde la copia principal" >&2
      exit 1
    fi
    mkdir -p "$PRINCIPAL/logs" && VISIBLE="$(mktemp -d "$PRINCIPAL/logs/host-sh-wt.XXXXXX")" && rmdir "$VISIBLE" \
      && git -C "$RAIZ" worktree add -q --detach "$VISIBLE" HEAD >/dev/null 2>&1 \
      || { echo "host.sh: no se pudo crear un worktree visible desde el host en $PRINCIPAL/logs; prueba: git worktree prune" >&2; exit 1; }
    bash "$VISIBLE/tools/qa/host.sh" "$@"
    estado=$?
    git -C "$PRINCIPAL" worktree remove --force "$VISIBLE" >/dev/null 2>&1; rm -rf "$VISIBLE"
    exit $estado
  fi
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
