#!/bin/bash
# Retro 2026-11-10 (mapas a main): corre una orden con el Ollama simulado (tools/ci/mock-ollama.mjs) en el 11434.
# Si algo contesta ya en el 11434 (el Ollama real, otro simulado), la orden va tal cual. Si no, lo levanta, corre
# la orden y lo para al acabar: no se queda ocupando el puerto del Ollama real. Si no arranca, sale en rojo sin
# correr la orden (los tests de bd-real caerían todos en ECONNREFUSED tras minutos).
# Uso: con-mock-ollama.sh <orden y argumentos…>   (desde la raíz del repo; en la Deck, dentro de host.sh)
set -uo pipefail
contesta() { curl -s -o /dev/null --max-time 2 localhost:11434; }
contesta && exec "$@"
node tools/ci/mock-ollama.mjs &
mock=$!
for _ in $(seq 1 20); do contesta && break; sleep 1; done
if ! contesta; then
  kill "$mock" 2>/dev/null
  echo "con-mock-ollama: el Ollama simulado no contesta en el 11434 tras 20 s; no se corren los tests" >&2
  exit 1
fi
"$@"; rc=$?
kill "$mock" 2>/dev/null; wait "$mock" 2>/dev/null
exit $rc
