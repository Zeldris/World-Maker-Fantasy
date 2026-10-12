#!/bin/bash
# QA-58 (retro de la tercera tanda de QA-27, 2026-10-12): comprueba que un test nuevo falla sin el
# arreglo que cubre. Aparta los cambios sin commit de los archivos del arreglo, corre ese test por su
# nombre exacto (un -t que no casa con nada «pasa» sin ejecutar el test), exige que falle y lo deja todo
# como estaba. Después corre el test con el arreglo y exige que pase.
#
# Uso (desde la raíz del repo, con el arreglo sin commit):
#   bash tools/qa/rojo-sin-arreglo.sh <backend|frontend> <archivo de test> "<nombre exacto del test>" <archivo del arreglo>...
# Ejemplo:
#   bash tools/qa/rojo-sin-arreglo.sh backend src/routes/turn.integration.test.ts \
#     "la misión se completa, el objeto se crea de verdad y hay un LogEntry anunciando la recompensa" \
#     backend/src/services/turnResolution.ts
set -u
[ $# -ge 4 ] || { sed -n '2,12p' "$0"; exit 2; }
paquete="$1"; test="$2"; nombre="$3"; shift 3
raiz="$(git rev-parse --show-toplevel)"
cd "$raiz" || exit 2
for f in "$@"; do
  git diff --quiet -- "$f" && { echo "rojo-sin-arreglo: $f no tiene cambios sin commit (¿es el archivo del arreglo?)"; exit 2; }
done
correr() { (cd "$raiz/$paquete" && npx vitest run "$test" -t "$nombre" 2>&1); }
# La línea «Tests»; si el archivo ni carga (p. ej. sin el arreglo falta una exportación), la de «Test Files».
cuenta() { local t; t="$(cat)"; echo "$t" | grep -E "^ *Tests +" | tail -1 | grep . || echo "$t" | grep -E "^ *Test Files +" | tail -1; }

git stash push --quiet -- "$@" || exit 2
trap 'git stash pop --quiet' EXIT
sin="$(correr)"
resumen_sin="$(echo "$sin" | cuenta)"
git stash pop --quiet; trap - EXIT
con="$(correr)"
resumen_con="$(echo "$con" | cuenta)"

echo "Sin el arreglo: $resumen_sin"
echo "Con el arreglo: $resumen_con"
if ! echo "$resumen_con" | grep -qE "[1-9][0-9]* passed" || echo "$resumen_con" | grep -q "failed"; then
  echo "rojo-sin-arreglo: con el arreglo no pasa (o no se ejecutó ningún test: revisa el nombre)"; exit 1
fi
if ! echo "$resumen_sin" | grep -q "failed"; then
  echo "rojo-sin-arreglo: sin el arreglo el test también pasa: no cubre el fallo"; exit 1
fi
echo "rojo-sin-arreglo: bien, el test falla sin el arreglo y pasa con él"
