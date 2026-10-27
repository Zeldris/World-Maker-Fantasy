#!/bin/bash
# QA-10 (retro de la Fase D del 0.2): deja listo el entorno de pruebas al empezar una sesión en la
# nube, que es lo que se perdía en cada reinicio del contenedor: dependencias, Postgres 16 con
# pgvector y la base `tarkor` (migrada y, si está vacía, con lore y catálogo sembrados) y el Ollama
# simulado del repo. Idempotente: lo que ya está, no se toca.
# Piloto de Galivelop-workflow (2026-10-22): antes `session-start.sh`, renombrado para que `doctor.py` no lo tome
# por una copia vieja del suyo. `core.hooksPath` lo pone también el session-start del flujo; se repite aquí por si
# aquel falla antes de llegar (revisión antes de main, 2026-10-23). Las dependencias
# siguen aquí y no en `install` de gw.json: Claude Code lanza a la vez los dos hooks de inicio, y Postgres y las
# migraciones necesitan node_modules antes.
set -euo pipefail

git -C "${CLAUDE_PROJECT_DIR:-$(pwd)}" config core.hooksPath .githooks

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"
DB_URL="postgresql://tarkor:tarkor@localhost:5432/tarkor"

# Dependencias (npm install aprovecha la caché del contenedor).
(cd backend && npm install --no-audit --no-fund --loglevel=error)
(cd frontend && npm install --no-audit --no-fund --loglevel=error)
(cd backend && npx prisma generate >/dev/null)

# Postgres 16.
if ! pg_isready -h localhost -q 2>/dev/null; then
  pg_ctlcluster 16 main start >/dev/null 2>&1 || true
  for _ in $(seq 1 20); do pg_isready -h localhost -q 2>/dev/null && break; sleep 1; done
fi
su postgres -c "psql -tAc \"select 1 from pg_roles where rolname='tarkor'\"" | grep -q 1 \
  || su postgres -c "psql -c \"create user tarkor with password 'tarkor' superuser\"" >/dev/null
su postgres -c "psql -tAc \"select 1 from pg_database where datname='tarkor'\"" | grep -q 1 \
  || su postgres -c "psql -c 'create database tarkor owner tarkor'" >/dev/null
# QA-266 (retro de INS-34): el contenedor puede venir sin pgvector; sin él ni el pre-push ni ci-local.sh arrancan.
if [ ! -e /usr/share/postgresql/16/extension/vector.control ]; then
  apt-get update -qq >/dev/null && apt-get install -y -qq postgresql-16-pgvector >/dev/null
fi
su postgres -c "psql -d tarkor -c 'create extension if not exists vector'" >/dev/null

# Ollama simulado (lo necesitan reindex-lore y ~27 tests).
if ! curl -s -o /dev/null localhost:11434; then
  setsid nohup node tools/ci/mock-ollama.mjs >/tmp/mock-ollama.log 2>&1 < /dev/null &
  for _ in $(seq 1 20); do curl -s -o /dev/null localhost:11434 && break; sleep 1; done
fi

# Migraciones y, con la base vacía, lore y catálogo.
cd backend
export DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" OLLAMA_BASE_URL="http://localhost:11434"
npx prisma migrate deploy >/dev/null
if [ "$(psql "$DB_URL" -tAc 'select count(*) from "World"')" = "0" ]; then
  npm run reindex-lore >/dev/null
  npm run seed-catalog >/dev/null
fi
# QA-15: las variables para toda la sesión (si no, cada vitest necesita su export).
if [ -n "${CLAUDE_ENV_FILE:-}" ] && ! grep -q "DATABASE_URL=$DB_URL" "$CLAUDE_ENV_FILE" 2>/dev/null; then
  {
    echo "export DATABASE_URL=$DB_URL"
    echo "export DIRECT_URL=$DB_URL"
    echo "export OLLAMA_BASE_URL=http://localhost:11434"
  } >> "$CLAUDE_ENV_FILE"
fi
echo "Entorno listo: Postgres $(pg_isready -h localhost | cut -d' ' -f3-), Ollama simulado en 11434."
# QA-49: si había una ronda de pruebas (base del juego) y el juego no está levantado, avisar.
if [ "$(psql "$DB_URL" -tAc "select 1 from pg_database where datname='tarkor_juego'" 2>/dev/null)" = "1" ] \
  && ! curl -s -o /dev/null localhost:5173; then
  echo "Ronda de pruebas: la base tarkor_juego existe pero el juego no está levantado. Relanza: bash tools/playwright-e2e/arrancar-juego.sh"
fi
