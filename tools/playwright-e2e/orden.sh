#!/bin/bash
# QA-41: manda una orden (JS) a driver.mjs. Sin argumento, la lee de la entrada estándar.
PUERTO="${DRIVER_PORT:-9333}"
# QA-57: `orden.sh --ayuda <archivo> '<tk en JSON>'` lanza una ayuda de mcp/ (las mismas que con el MCP),
# con sus parámetros en window.tk. P. ej.: orden.sh --ayuda combate '{"ataque":"Estocada Veloz","rondas":3}'
if [ "$1" = "--ayuda" ]; then
  AYUDA="$(cd "$(dirname "$0")" && pwd)/mcp/${2%.js}.js"
  [ -f "$AYUDA" ] || { echo "No existe $AYUDA"; exit 1; }
  set -- "await page.evaluate((tk) => { window.tk = tk }, ${3:-{\}}); const fs = await import('node:fs'); const ayuda = eval(fs.readFileSync('$AYUDA', 'utf8')); return await ayuda(page);"
fi
CLAVE="$(cat "$(dirname "$0")/driver.token" 2>/dev/null)"
if [ -n "$1" ]; then
  curl -s -X POST -H "X-Driver-Token: $CLAVE" --data-binary "$1" "localhost:$PUERTO/"
else
  curl -s -X POST -H "X-Driver-Token: $CLAVE" --data-binary @- "localhost:$PUERTO/"
fi
echo
