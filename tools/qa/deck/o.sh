#!/bin/bash
# o.sh <ayuda> '<json>': una ayuda de orden.sh (estado, combate…) por host.sh.
. "$(dirname "$0")/_raiz.sh"
exec bash tools/qa/host.sh bash tools/playwright-e2e/orden.sh --ayuda "$@"
