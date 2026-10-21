#!/bin/bash
# ronda.sh: espera al narrador y juega 1 ronda de combate.
. "$(dirname "$0")/_raiz.sh"
for i in $(seq 1 40); do
 if "$DECK/o.sh" estado 2>&1 | grep -q "narrador escribe"; then sleep 5; else break; fi
done
sleep 3
"$DECK/o.sh" combate '{"rondas":1}' 2>&1 | head -4
sleep 4
"$DECK/o.sh" estado 2>&1 | head -3
