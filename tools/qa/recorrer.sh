#!/bin/bash
# QA-103: pasa los recorridos de tools/playwright-e2e/recorridos/ (una línea por recorrido, ✓ o ✗). Con
# argumentos, solo los que tengan ese texto en el nombre. Necesita el juego en marcha (arrancar-juego.sh) o
# cada recorrido carga su escenario.
cd "$(git rev-parse --show-toplevel)/tools/playwright-e2e" && node recorrer.mjs "$@"
