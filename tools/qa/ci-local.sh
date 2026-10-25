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
# La copia de la base va dentro de .githooks/: el gancho saca la raíz del repo de su propia ruta.
# Si no se puede escribir, el paso falla (no se salta en silencio). Ignorada en .gitignore y borrada al salir.
copia="$dir/.githooks/.pre-commit-base"
trap 'rm -f "$copia"' EXIT
if [ -n "$base" ] && git -C "$dir" cat-file -e "$base:.githooks/pre-commit" 2>/dev/null; then
  paso . "pre-commit de la base sobre la rama" "git show $base:.githooks/pre-commit >\"$copia\" &&
    bash \"$copia\" --rango \"\$(git merge-base $base HEAD)..HEAD\""
  rm -f "$copia"
fi
paso . "enlaces de los .md" python3 .claude/gw/scripts/enlaces-md.py
paso . "mapa del agente" python3 tools/qa/mapa-agente.py
paso . "tests de las skills en el CI" python3 tools/qa/skills-con-tests.py
paso . "sintaxis de las herramientas" "for f in \$(git ls-files '*.sh' .githooks); do bash -n \"\$f\" || exit 1; done
  for f in \$(git ls-files 'tools/**/*.mjs' | grep -v /historico/); do node --check \"\$f\" || exit 1; done
  for f in tools/playwright-e2e/mcp/*.js; do node -e \"new Function('return (' + require('fs').readFileSync('\$f', 'utf8') + ')')\" || { echo \"\$f\"; exit 1; }; done
  python3 -m py_compile \$(git ls-files 'tools/**/*.py' '.claude/skills/**/*.py' '.claude/gw/scripts/*.py')"
# QA-219: Playwright para el test de navegador de pulsar.js/mover.js (sin Chromium en la máquina, el test se salta).
paso tools/playwright-e2e "Playwright para el test de navegador" "npm ci --silent && npx playwright install chromium"
paso . "tests de tools/qa" python3 -m unittest discover -s tools/qa/tests
paso . "tests de opt-ai" python3 -m unittest discover -s .claude/skills/opt-ai/scripts
paso . "tests de scout-updates" python3 -m unittest discover -s .claude/skills/scout-updates/scripts
paso . "tests de gw-media-content" python3 -m unittest discover -s .claude/skills/gw-media-content/scripts
paso . "resumen de los registros de hallazgos" 'for r in docs/registros/pruebas-[0-9]*-hallazgos.md; do python3 tools/qa/marca-hallazgo.py --resumen --comprobar --registro "$r" || exit 1; done'

echo "== backend"
paso . "base tarkor_ci nueva con pgvector" "psql '$servidor/postgres' -qc 'DROP DATABASE IF EXISTS tarkor_ci' -c 'CREATE DATABASE tarkor_ci' && psql \"\$DATABASE_URL\" -qc 'CREATE EXTENSION IF NOT EXISTS vector'"
curl -s -o /dev/null localhost:11434 || { nohup node "$dir/tools/ci/mock-ollama.mjs" >"$logs/mock-ollama.out" 2>&1 & sleep 2; }
# QA-239: en un worktree, host.sh (desde los tests de tools/qa) deja node_modules y .env como enlaces a la copia
# principal: `npm ci` vaciaría su node_modules a través del enlace, y su .env metería su configuración (el CI de
# GitHub no tiene). Se quitan los enlaces y se instala aquí.
sin_enlaces='for e in node_modules .env; do [ ! -L "$e" ] || rm "$e" || exit 1; done'
paso backend "npm ci" "$sin_enlaces && npm ci"
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
paso frontend "npm ci" "$sin_enlaces && npm ci"
paso frontend "lint" npm run lint
paso frontend "build" npm run build
paso frontend "tests" npm test

echo "Registros: $logs"
[ "$fallos" = 0 ] && echo "CI local en verde ($(git -C "$dir" rev-parse --short HEAD))" || echo "CI local en ROJO"
exit "$fallos"
