#!/bin/bash
# relanza.sh <partida>: mata solo el driver de ESTE checkout (node con driver.mjs de tools/playwright-e2e de esta raíz),
# espera a que salga y el puerto quede libre (tope 10 s, luego kill -9) y lo lanza de nuevo con lanza.sh. Salida a
# logs/deck/lanza.out. Es lento (~15-35 s): lanzarlo en segundo plano.
[ -n "${1:-}" ] || { echo "uso: relanza.sh <idPartida>" >&2; exit 2; }
. "$(dirname "$0")/_raiz.sh"
mkdir -p logs/deck
bash tools/qa/host.sh bash -c '
  dir="$1/tools/playwright-e2e"; puerto="$2"
  pids() {
    for p in $(pgrep -x node); do
      c="$(tr "\0" " " </proc/$p/cmdline 2>/dev/null)"
      case "$c" in *driver.mjs*) ;; *) continue ;; esac
      if [ "$(readlink /proc/$p/cwd 2>/dev/null)" = "$dir" ] || case "$c" in *"$dir/driver.mjs"*) true ;; *) false ;; esac; then echo $p; fi
    done
  }
  libre() { ! curl -s -o /dev/null -m 1 "127.0.0.1:$puerto/"; }
  v="$(pids)"; [ -n "$v" ] && kill $v
  for i in $(seq 1 10); do
    [ -z "$(pids)" ] && libre && exit 0
    sleep 1
  done
  v="$(pids)"; [ -n "$v" ] && kill -9 $v
  sleep 1
  libre || { echo "relanza.sh: el puerto $puerto sigue ocupado (otro proceso, no el driver de este checkout)" >&2; exit 1; }
' _ "$RAIZ" "${DRIVER_PORT:-9333}" || exit 1
"$DECK/lanza.sh" "$1" > logs/deck/lanza.out 2>&1
