#!/bin/bash
# relanza.sh <partida>: mata el driver viejo (por PID de node) y lo lanza de nuevo. La salida va a logs/deck/lanza.out.
. "$(dirname "$0")/_raiz.sh"
bash tools/qa/host.sh bash -c 'for p in $(pgrep -x node); do tr "\0" " " </proc/$p/cmdline | grep -q driver.mjs && kill $p; done; true'
sleep 1
mkdir -p logs/deck
"$DECK/lanza.sh" "$1" > logs/deck/lanza.out 2>&1
