#!/bin/bash
# QA-41: manda una orden (JS) a driver.mjs. Sin argumento, la lee de la entrada estándar.
PUERTO="${DRIVER_PORT:-9333}"
CLAVE="$(cat "$(dirname "$0")/driver.token" 2>/dev/null)"
if [ -n "$1" ]; then
  curl -s -X POST -H "X-Driver-Token: $CLAVE" --data-binary "$1" "localhost:$PUERTO/"
else
  curl -s -X POST -H "X-Driver-Token: $CLAVE" --data-binary @- "localhost:$PUERTO/"
fi
echo
