#!/bin/bash
# QA-215 (usuaria, 2026-10-22): con la cuota de GitHub Actions agotada, el CI se pasa aquí y la rama se sube a main
# sin PR (CLAUDE.md, «Ramas y main»). Repite los tres jobs de .github/workflows/ci.yml sobre un checkout limpio,
# con una base de datos nueva (`tarkor_ci`, se borra y se crea) para no tocar la `tarkor` ni la de la ronda.
# Uso: tools/qa/ci-local.sh [checkout, por defecto la raíz del repo] [base del diff para `bitacora.py closed`]
# Sale con 1 si algún paso falla; los registros quedan en el directorio que imprime al final.
set -uo pipefail
raiz="$(git rev-parse --show-toplevel)"
. "$raiz/tools/qa/deck/_path.sh"  # psql de la Deck (QA-188)
dir="$(cd "${1:-$raiz}" && pwd)"
base="${2:-$(git -C "$dir" merge-base HEAD origin/main 2>/dev/null || true)}"
logs="$(mktemp -d)"
servidor="postgresql://tarkor:tarkor@localhost:5432"
export DATABASE_URL="$servidor/tarkor_ci" DIRECT_URL="$servidor/tarkor_ci" OLLAMA_BASE_URL="http://localhost:11434"
export PGOPTIONS="-c client_min_messages=warning"
fallos=0
n=0
paso() {  # paso <subdirectorio> <descripción> <comando…>
  local sub="$1" nombre="$2"; shift 2
  n=$((n + 1))
  if (cd "$dir/$sub" && eval "$@") >"$logs/$n.log" 2>&1; then
    echo "✓ $nombre"
  else
    echo "✗ $nombre (registro: $logs/$n.log)"; tail -15 "$logs/$n.log" | sed 's/^/    /'; fallos=1
  fi
}

echo "== roadmap"
paso . "cobertura del roadmap" python3 tools/roadmap/cobertura.py
paso . "matriz de pruebas" python3 tools/qa/matriz-pruebas.py --comprobar
paso . "bitácora" python3 .claude/gw/scripts/bitacora.py check
[ -n "$base" ] && paso . "bitácora: tareas cerradas desde la base" python3 .claude/gw/scripts/bitacora.py closed "$base" HEAD
[ -n "$base" ] && git -C "$dir" cat-file -e "$base:.githooks/pre-commit" 2>/dev/null && git -C "$dir" show "$base:.githooks/pre-commit" >"$logs/pre-commit-base" &&
  paso . "pre-commit de la base sobre la rama" bash "$logs/pre-commit-base" --rango "\$(git merge-base $base HEAD)..HEAD"
paso . "enlaces de los .md" python3 .claude/gw/scripts/enlaces-md.py
paso . "mapa del agente" python3 tools/qa/mapa-agente.py
paso . "sintaxis de las herramientas" "for f in \$(git ls-files '*.sh' .githooks); do bash -n \"\$f\" || exit 1; done
  for f in \$(git ls-files 'tools/**/*.mjs' | grep -v /historico/); do node --check \"\$f\" || exit 1; done
  for f in tools/playwright-e2e/mcp/*.js; do node -e \"new Function('return (' + require('fs').readFileSync('\$f', 'utf8') + ')')\" || { echo \"\$f\"; exit 1; }; done
  python3 -m py_compile \$(git ls-files 'tools/**/*.py' '.claude/skills/**/*.py' '.claude/gw/scripts/*.py')"
paso . "tests de tools/qa" python3 -m unittest discover -s tools/qa/tests
paso . "tests de opt-ai" python3 -m unittest discover -s .claude/skills/opt-ai/scripts
paso . "tests de scout-updates" python3 -m unittest discover -s .claude/skills/scout-updates/scripts
paso . "resumen de los registros de hallazgos" 'for r in docs/registros/pruebas-[0-9]*-hallazgos.md; do python3 tools/qa/marca-hallazgo.py --resumen --comprobar --registro "$r" || exit 1; done'

echo "== backend"
paso . "base tarkor_ci nueva con pgvector" "psql '$servidor/postgres' -qc 'DROP DATABASE IF EXISTS tarkor_ci' -c 'CREATE DATABASE tarkor_ci' && psql \"\$DATABASE_URL\" -qc 'CREATE EXTENSION IF NOT EXISTS vector'"
curl -s -o /dev/null localhost:11434 || { nohup node "$dir/tools/ci/mock-ollama.mjs" >"$logs/mock-ollama.out" 2>&1 & sleep 2; }
paso backend "npm ci" npm ci
paso backend "prisma generate" npx prisma generate
paso backend "lint" npm run lint
paso backend "tsc" npx tsc --noEmit
paso backend "migraciones" npx prisma migrate deploy
paso backend "esquema sin migración pendiente" 'npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code'
paso backend "reindex-lore" npm run reindex-lore
paso backend "seed-catalog" npm run seed-catalog
paso backend "tests" npm test
paso . "escenarios de pruebas" bash tools/qa/comprobar-escenarios.sh

echo "== frontend"
paso frontend "npm ci" npm ci
paso frontend "lint" npm run lint
paso frontend "build" npm run build
paso frontend "tests" npm test

echo "Registros: $logs"
[ "$fallos" = 0 ] && echo "CI local en verde ($(git -C "$dir" rev-parse --short HEAD))" || echo "CI local en ROJO"
exit "$fallos"
