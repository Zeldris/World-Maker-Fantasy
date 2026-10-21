#!/bin/bash
# j.sh '<js>': ejecuta JS en el driver de Playwright (por host.sh).
. "$(dirname "$0")/_raiz.sh"
printf '%s' "$1" | bash tools/qa/host.sh bash tools/playwright-e2e/orden.sh
