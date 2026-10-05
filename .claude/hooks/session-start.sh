#!/bin/bash
# QA-10 (retro de la Fase D del 0.2): deja listo el entorno de pruebas al empezar una sesión en la
# nube, que es lo que se perdía en cada reinicio del contenedor: dependencias, Postgres 16 con
# pgvector y la base `tarkor` (migrada y, si está vacía, con lore y catálogo sembrados) y el Ollama
# simulado del repo. Idempotente: lo que ya está, no se toca.
set -euo pipefail

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
echo "Entorno listo: Postgres $(pg_isready -h localhost | cut -d' ' -f3-), Ollama simulado en 11434."
