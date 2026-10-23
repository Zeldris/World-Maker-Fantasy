#!/bin/bash
# o.sh <ayuda> '<json>': una ayuda de orden.sh (estado, combate…) por host.sh.
# Atajos de texto (QA-218): `o.sh viajar-a <lugar>` = `viajar-a '{"lugar":"<lugar>"}'`; `o.sh combate leer` = solo mirar.
. "$(dirname "$0")/_raiz.sh"
AYUDA="$1"; shift
case "$AYUDA:$1" in
  viajar-a:[!{]*) set -- "$(python3 -c 'import json,sys; print(json.dumps({"lugar": " ".join(sys.argv[1:])}))' "$@")" ;;
  combate:leer) set -- '{"leer":true}' ;;
esac
exec bash tools/qa/host.sh bash tools/playwright-e2e/orden.sh --ayuda "$AYUDA" "$@"
