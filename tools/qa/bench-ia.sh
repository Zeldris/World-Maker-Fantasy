#!/bin/bash
# QA-173 (retro del 2026-10-20): el bench de la IA local de `opt-ai` en una sola orden. Restaura el escenario
# `ia-gorhorn-dia42` (la partida de la ronda «IA y diálogos») en `tarkor_juego`, reindexa el lore (el índice del dump
# puede ser de otro código, QA-167), arranca el juego con IA_PERFIL=deck e IA_REGISTRO, espera el calentamiento, juega
# los turnos de `benchmark-turno` muestreando la RAM y `ollama ps`, y compara con `medir.py`.
#
#   bench-ia.sh <etiqueta> [--anterior <etiqueta>] [--turnos N]
#
# Deja backend/ia/registro-bench-<etiqueta>.jsonl, logs/bench-<etiqueta>.json y logs/ram-<etiqueta>.log; enseña solo
# el resumen del bench, la RAM libre mínima, los modelos cargados y la salida de medir.py. Tarda ~10 min con 8 turnos:
# lánzalo en segundo plano. Necesita el Postgres del juego y Ollama con los modelos.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
if [ -e /.flatpak-info ] || [ -n "${FLATPAK_ID:-}" ]; then exec bash tools/qa/host.sh bash tools/qa/bench-ia.sh "$@"; fi
[ -d logs/bin ] && PATH="$PWD/logs/bin:$PATH"

et="${1:?uso: bench-ia.sh <etiqueta> [--anterior <etiqueta>] [--turnos N]}"; shift
anterior=""; turnos=8
while [ $# -gt 0 ]; do
  case "$1" in
    --anterior) anterior="$2"; shift 2 ;;
    --turnos) turnos="$2"; shift 2 ;;
    *) echo "bench-ia.sh: opción desconocida $1" >&2; exit 2 ;;
  esac
done
ESCENARIO=tools/qa/escenarios/ia-gorhorn-dia42.dump
SAVE=cmvgnd5ke0001rivyqqjpdezo
URL=postgresql://tarkor:tarkor@localhost:5432/tarkor_juego
reg="$PWD/backend/ia/registro-bench-$et.jsonl"
ram="logs/ram-$et.log"
mkdir -p logs backend/ia
rm -f "$reg" "$ram"

bash tools/playwright-e2e/arrancar-juego.sh --parar > /dev/null
psql postgresql://tarkor:tarkor@localhost:5432/tarkor -Atq -c "DROP DATABASE IF EXISTS tarkor_juego WITH (FORCE)" -c "CREATE DATABASE tarkor_juego"
pg_restore --no-owner -d "$URL" "$ESCENARIO" 2> logs/escenario-restore.log || true
rm -f logs/catalogo-tarkor_juego.huella
(cd backend && DATABASE_URL=$URL DIRECT_URL=$URL npm run --silent reindex-lore > /dev/null)
IA_REGISTRO="$reg" IA_PERFIL=deck bash tools/playwright-e2e/arrancar-juego.sh > /dev/null
sleep 45  # el calentamiento del narrador al arrancar (~30 s) no entra en la medida

# Cada 20 s: hora, MB disponibles y los modelos cargados con su contexto.
(while true; do
  modelos=$(curl -s localhost:11434/api/ps | python3 -c 'import json,sys; print([(m["name"], m.get("context_length")) for m in json.load(sys.stdin).get("models", [])])' 2>/dev/null || echo '?')
  echo "$(date +%T) $(free -m | awk '/^Mem/ {print $7}')MB $modelos" >> "$ram"
  sleep 20
done) &
muestreo=$!
trap 'kill $muestreo 2>/dev/null || true' EXIT

(cd backend && npm run --silent benchmark-turno -- --save "$SAVE" --turnos "$turnos" --salida "../logs/bench-$et.json") 2>&1 | tail -16
kill $muestreo 2>/dev/null || true

echo "registro: $(wc -l < "$reg") líneas"
awk '{gsub("MB","",$2); if (min == "" || $2 + 0 < min) min = $2 + 0} END {print "RAM disponible mínima: " min " MB"}' "$ram"
echo "modelos cargados (último muestreo): $(tail -1 "$ram" | cut -d' ' -f3-)"
if [ -n "$anterior" ]; then
  python3 .claude/skills/opt-ai/medir.py "$reg" --anterior "backend/ia/registro-bench-$anterior.jsonl" --perfil deck
else
  python3 .claude/skills/opt-ai/medir.py "$reg" --perfil deck
fi
