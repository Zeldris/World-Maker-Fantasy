#!/bin/bash
# QA-107 (2026-10-19): los escenarios de `escenario.sh` (QA-102) siguen valiendo. Cada instantánea de
# tools/qa/escenarios/ tiene su fila en el README (y al revés), se restaura en una base aparte y acepta las
# migraciones de ahora: una migración nueva que rompa las partidas guardadas se ve aquí, no en la ronda.
# Uso: comprobar-escenarios.sh [URL de Postgres sin base, por defecto la local]
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
. tools/qa/deck/_path.sh
export PGOPTIONS="-c client_min_messages=warning"
SERVIDOR="${1:-postgresql://tarkor:tarkor@localhost:5432}"
DIR=tools/qa/escenarios
fallos=0
for d in "$DIR"/*.dump; do
  [ -e "$d" ] || continue
  n=$(basename "$d" .dump)
  grep -q "^| \`$n\` |" "$DIR/README.md" || { echo "✗ $n: sin fila en $DIR/README.md"; fallos=1; }
done
while read -r n; do
  [ -f "$DIR/$n.dump" ] || { echo "✗ $n: en el README pero sin $DIR/$n.dump"; fallos=1; }
done < <(sed -n 's/^| `\([a-z0-9-]*\)` |.*/\1/p' "$DIR/README.md")
for d in "$DIR"/*.dump; do
  [ -e "$d" ] || continue
  n=$(basename "$d" .dump)
  base="escenario_prueba_${n//-/_}"
  psql "$SERVIDOR/postgres" -Atq -c "DROP DATABASE IF EXISTS $base WITH (FORCE)" -c "CREATE DATABASE $base" >/dev/null
  if ! pg_restore --no-owner -d "$SERVIDOR/$base" "$d" > /tmp/escenario-$n.log 2>&1; then
    echo "✗ $n: no se restaura (/tmp/escenario-$n.log)"; fallos=1
  elif ! (cd backend && DATABASE_URL="$SERVIDOR/$base" DIRECT_URL="$SERVIDOR/$base" npx prisma migrate deploy >> /tmp/escenario-$n.log 2>&1); then
    echo "✗ $n: las migraciones de ahora no se aplican sobre él (/tmp/escenario-$n.log)"; fallos=1
  else
    echo "✓ $n"
  fi
  psql "$SERVIDOR/postgres" -Atq -c "DROP DATABASE IF EXISTS $base WITH (FORCE)" >/dev/null
done
exit $fallos
