#!/bin/bash
# QA-29/QA-30 (retro del 2026-10-09): arranca el juego para una ronda de pruebas jugando, con su
# PROPIA base (`tarkor_juego`), aparte de la que usan los tests (`tarkor`): así lo que se ve jugando
# no se mezcla con las partidas, Capitales y lugares que dejan los tests. Viajes acortados.
#
#   bash tools/playwright-e2e/arrancar-juego.sh              # base, backend :3001 y frontend :5173
#   bash tools/playwright-e2e/arrancar-juego.sh --rehacer    # además, borra la base y la siembra de cero
#   bash tools/playwright-e2e/arrancar-juego.sh --parar      # para backend, frontend y driver (QA-65)
#
# Viajes: TRAVEL_SEGUNDOS_PRIMER_TRAMO / _POR_TRAMO_EXTRA / _MAXIMOS (por defecto 5 / 3 / 20).
# Registros: logs/backend.log y logs/frontend.log. Narraciones: las del Ollama simulado, que meten
# trozos del prompt en el texto (no es un fallo del juego; la calidad narrativa se prueba con
# Ollama real).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
BASE=tarkor_juego
URL="postgresql://tarkor:tarkor@localhost:5432/$BASE"
export DATABASE_URL="$URL" DIRECT_URL="$URL" OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
export TRAVEL_SEGUNDOS_PRIMER_TRAMO="${TRAVEL_SEGUNDOS_PRIMER_TRAMO:-5}"
export TRAVEL_SEGUNDOS_POR_TRAMO_EXTRA="${TRAVEL_SEGUNDOS_POR_TRAMO_EXTRA:-3}"
export TRAVEL_SEGUNDOS_MAXIMOS="${TRAVEL_SEGUNDOS_MAXIMOS:-20}"
# QA-141: con IA real (`IA_PERFIL`), el registro va con ruta absoluta (el servidor corre en `backend/`).
# shellcheck source=tools/playwright-e2e/ia-comprobaciones.sh
. tools/playwright-e2e/ia-comprobaciones.sh
if [ -n "${IA_PERFIL:-}" ]; then
  if [ -n "${IA_REGISTRO:-}" ]; then export IA_REGISTRO="$(ia_registro_absoluto "$PWD" "$IA_REGISTRO")"; fi
  OLLAMA_LOG_OFFSET="$(ia_tamano_log logs/ollama.log)"  # el log es append: solo cuenta lo escrito desde aquí
fi
PSQL="psql postgresql://tarkor:tarkor@localhost:5432/tarkor -Atq"

# QA-65 (retro del 2026-10-12): la suite con base real, con el juego y el driver en marcha, sumaba
# fallos por tiempo límite. `--parar` lo libera todo antes de pasarla.
if [ "${1:-}" = "--parar" ]; then
  if [ -s logs/backend.pid ]; then kill "$(cat logs/backend.pid)" 2>/dev/null || true; rm -f logs/backend.pid; fi
  fuser -k 3001/tcp 5173/tcp "${DRIVER_PORT:-9333}/tcp" > /dev/null 2>&1 || true
  echo "Juego parado (backend :3001, frontend :5173, driver :${DRIVER_PORT:-9333})."
  exit 0
fi

if [ "${1:-}" = "--rehacer" ]; then $PSQL -c "DROP DATABASE IF EXISTS $BASE WITH (FORCE)"; fi
nueva=0
if [ -z "$($PSQL -c "select 1 from pg_database where datname='$BASE'")" ]; then
  $PSQL -c "CREATE DATABASE $BASE"
  nueva=1
fi
psql "$URL" -q -c 'create extension if not exists vector'
(cd backend && npx prisma migrate deploy >/dev/null)
mkdir -p logs
# QA-82 (retro del 2026-10-14): el catálogo se vuelve a sembrar cuando cambia, no solo al crear la base;
# si no, la ronda prueba los arreglos de catálogo con datos viejos (P174). La huella cubre seed-catalog y
# todo lo que importa (`huella-catalogo.py`; se pasa de largo, pero sembrar tarda unos 7 s). `seed-catalog` se puede
# repetir: actualiza o crea cada fila y solo borra filas de catálogo, nunca las de una partida.
HUELLA_CATALOGO="$(python3 tools/playwright-e2e/huella-catalogo.py)"
ARCHIVO_HUELLA="logs/catalogo-$BASE.huella"
if [ "$nueva" = 1 ]; then
  echo "Sembrando lore y catálogo en $BASE (unos minutos)…"
  (cd backend && npm run --silent reindex-lore >/dev/null && npm run --silent seed-catalog >/dev/null)
  echo "$HUELLA_CATALOGO" > "$ARCHIVO_HUELLA"
elif [ "$(cat "$ARCHIVO_HUELLA" 2>/dev/null)" != "$HUELLA_CATALOGO" ]; then
  echo "El catálogo cambió desde la última siembra: sembrándolo de nuevo en $BASE…"
  (cd backend && npm run --silent seed-catalog >/dev/null)
  echo "$HUELLA_CATALOGO" > "$ARCHIVO_HUELLA"
fi

# QA-34: se para el backend anterior por su PID (o por el puerto 3001), nunca con `pkill -f`: ese
# patrón también casa con la orden de quien lanza este script si lleva el texto, y se mata a sí mismo.
if [ -s logs/backend.pid ]; then kill "$(cat logs/backend.pid)" 2>/dev/null || true; fi
fuser -k 3001/tcp > /dev/null 2>&1 || true  # npx deja hijos: el que escucha en el puerto es el que cuenta
sleep 1
(cd backend && { setsid nohup npx tsx src/server.ts > ../logs/backend.log 2>&1 < /dev/null & echo $! > ../logs/backend.pid; }) > /dev/null 2>&1
if ! curl -s --max-time 3 -o /dev/null localhost:5173; then
  (cd frontend && setsid nohup npx vite --port 5173 --host 127.0.0.1 > ../logs/frontend.log 2>&1 < /dev/null &) > /dev/null 2>&1
fi
# QA-53: listo es que el backend responda con la base conectada (/health) y el frontend sirva; antes
# valía cualquier respuesta, y tras reiniciar el contenedor la partida salía «No se encuentra».
listo=0
for i in $(seq 1 90); do
  if curl -sf --max-time 3 localhost:3001/health | grep -q '"database":"ok"' && curl -sf --max-time 3 -o /dev/null localhost:5173; then listo=1; break; fi
  sleep 1
done
if [ "$listo" != 1 ]; then
  echo "El juego no ha arrancado en 90 s: mira logs/backend.log y logs/frontend.log" >&2
  exit 1
fi
# QA-141: con IA real, se comprueba antes de jugar lo que en la ronda del 2026-10-20 costó horas: GPU y RAG.
if [ -n "${IA_PERFIL:-}" ]; then
  if [ "$IA_PERFIL" = deck ]; then ia_comprobar_log_gpu logs/ollama.log "$OLLAMA_LOG_OFFSET" || exit 1; fi
  (cd backend && npm run --silent rag-eval) && rc=0 || rc=$?
  if [ "$rc" = 1 ]; then
    echo "rag-eval: fallan casos obligatorios; reindexa el lore con 'npm run reindex-lore' en backend/ (con la DATABASE_URL de $BASE) y arranca de nuevo (QA-141)" >&2
    exit 1
  elif [ "$rc" != 0 ]; then
    echo "rag-eval acabó con código $rc (error de uso o JSON inválido, no de recall): mira su salida (QA-141)" >&2
    exit 1
  fi
  # rag-eval ya cargó el modelo de embeddings: ahora /api/ps lista algo (recién arrancado salía vacío).
  if [ "$IA_PERFIL" = deck ]; then
    ia_comprobar_gpu_api "$(curl -sf --max-time 5 "$OLLAMA_BASE_URL/api/ps" 2>/dev/null || true)" && rc=0 || rc=$?
    if [ "$rc" = 1 ]; then exit 1; fi  # 2 = nada cargado: solo aviso
  fi
fi
echo "Juego listo: http://127.0.0.1:5173 (base $BASE, viajes $TRAVEL_SEGUNDOS_PRIMER_TRAMO/$TRAVEL_SEGUNDOS_POR_TRAMO_EXTRA/$TRAVEL_SEGUNDOS_MAXIMOS s)"
