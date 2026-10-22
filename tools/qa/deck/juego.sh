#!/bin/bash
# juego.sh [--rehacer|--parar]: arrancar-juego.sh con IA_PERFIL=deck e IA_REGISTRO=<raíz>/logs/ia/<fecha>.jsonl
# (absoluto) salvo que ya vengan puestas, para que /opt-ai tenga el registro de la tanda (QA-141). Por host.sh:
#   bash tools/qa/host.sh bash tools/qa/deck/juego.sh
. "$(dirname "$0")/_raiz.sh"
export IA_PERFIL="${IA_PERFIL:-deck}"
if [ -z "${IA_REGISTRO:-}" ]; then
  mkdir -p "$RAIZ/logs/ia"
  export IA_REGISTRO="$RAIZ/logs/ia/$(date +%F).jsonl"
fi
exec bash tools/playwright-e2e/arrancar-juego.sh "$@"
