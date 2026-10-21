#!/bin/bash
# lanza.sh <partida>: arranca el driver en segundo plano, espera a que responda (el driver tarda 12-28 s; tope 60 s) y abre
# la partida con el cajón Reino. En total ~15-35 s: en primer plano puede pasar de 30 s, mejor en segundo plano.
# Si ya hay un driver escuchando en el puerto (DRIVER_PORT, 9333), avisa y sale: usa relanza.sh.
[ -n "${1:-}" ] || { echo "uso: lanza.sh <idPartida>" >&2; exit 2; }
case "$1" in *[!A-Za-z0-9_-]*) echo "lanza.sh: id de partida no válido" >&2; exit 2 ;; esac
. "$(dirname "$0")/_raiz.sh"
PUERTO="${DRIVER_PORT:-9333}"
escucha() { bash tools/qa/host.sh curl -s -o /dev/null -m 2 "127.0.0.1:$PUERTO/"; }
if escucha; then
  echo "lanza.sh: ya hay un driver escuchando en el puerto $PUERTO; usa tools/qa/deck/relanza.sh $1 (mata el de este checkout y lanza de nuevo)" >&2
  exit 1
fi
bash tools/qa/host.sh bash -c 'cd tools/playwright-e2e && setsid node "$PWD/driver.mjs" < /dev/null > driver.log 2>&1 &'
for i in $(seq 1 60); do
  escucha && break
  sleep 1
  if [ "$i" = 60 ]; then
    echo "lanza.sh: el driver no responde tras 60 s en el puerto $PUERTO; mira tools/playwright-e2e/driver.log" >&2
    exit 1
  fi
done
"$DECK/j.sh" "await page.goto('http://127.0.0.1:5173/solitario/partida/$1'); await page.waitForTimeout(3000); await page.getByText('Reino',{exact:true}).first().click(); await page.waitForTimeout(1000); return 'ok'"
