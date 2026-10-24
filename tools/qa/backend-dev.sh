#!/bin/bash
# QA-224 (retro de claude/imagenes-local, 2026-10-24): reinicia el backend de desarrollo (base `tarkor` del .env, la
# de la enciclopedia) y espera a que responda. `tsx watch` no ve los cambios hechos desde el sandbox de VS Code: tras
# editar el backend, se relanza con esto. Para jugar con la base de juego, `tools/playwright-e2e/arrancar-juego.sh`.
#   bash tools/qa/backend-dev.sh            # para el de :3001, arranca `npm run dev` y espera a /health
#   bash tools/qa/backend-dev.sh --parar    # solo lo para
# Registro: logs/backend-dev.log.
set -u
cd "$(git rev-parse --show-toplevel)"
mkdir -p logs
# Se para por el puerto (npx deja hijos: el que escucha es el que cuenta), nunca con `pkill -f` (QA-34).
bash tools/qa/host.sh bash -c 'fuser -k 3001/tcp > /dev/null 2>&1; true'
if [ "${1:-}" = "--parar" ]; then echo "Backend :3001 parado."; exit 0; fi
sleep 1
bash tools/qa/host.sh bash -c 'cd backend && { setsid nohup npm run dev > ../logs/backend-dev.log 2>&1 < /dev/null & } > /dev/null 2>&1'
for _ in $(seq 1 60); do
  if curl -sf --max-time 3 localhost:3001/health | grep -q '"database":"ok"'; then
    echo "Backend :3001 listo (registro: logs/backend-dev.log)."; exit 0
  fi
  sleep 1
done
echo "El backend no responde en 60 s; final de logs/backend-dev.log:" >&2
tail -20 logs/backend-dev.log >&2
exit 1
