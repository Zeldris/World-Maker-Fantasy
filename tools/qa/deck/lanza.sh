#!/bin/bash
# lanza.sh <partida>: arranca el driver en segundo plano y abre la partida con el cajón Reino. Tarda ~28 s: lanzarlo
# en segundo plano y esperar.
. "$(dirname "$0")/_raiz.sh"
bash tools/qa/host.sh bash -c 'cd tools/playwright-e2e && setsid node driver.mjs < /dev/null > driver.log 2>&1 &'; sleep 6
"$DECK/j.sh" "await page.goto('http://127.0.0.1:5173/solitario/partida/$1'); await page.waitForTimeout(3000); await page.getByText('Reino',{exact:true}).first().click(); await page.waitForTimeout(1000); return 'ok'"
