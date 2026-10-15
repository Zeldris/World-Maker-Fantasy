#!/bin/bash
# QA-88 (retro antes del PR de los hallazgos de QA-27, 2026-10-15): los tests de lo que cambia, en el
# push. P160 rompió 13 tests de `recolectar.test.ts` (su `tx` simulado no tenía `save.findUnique`) y no se
# vio hasta pasar la suite completa: el pre-push solo tipaba y pasaba el lint. `vitest related` corre los
# tests que importan, directa o indirectamente, los archivos cambiados. En el backend, solo el proyecto
# `unit` (los de BD real son lentos y van en serie; los pasa la suite completa y la CI).
# Uso: tests-relacionados.sh <archivo con los cambiados, uno por línea, relativos a la raíz>
set -uo pipefail
cambiados="$1"
cd "$(git rev-parse --show-toplevel)"
for paquete in backend frontend; do
  archivos=()
  while read -r f; do
    [ -f "$f" ] && archivos+=("${f#"$paquete"/}")
  done < <(grep -E "^$paquete/src/.*\.(ts|tsx)$" "$cambiados" | sort -u)
  [ ${#archivos[@]} -eq 0 ] && continue
  proyecto=()
  [ "$paquete" = backend ] && proyecto=(--project unit)
  log="/tmp/pre-push-related-$paquete.log"
  echo "pre-push: tests relacionados de $paquete (${#archivos[@]} archivos cambiados)…"
  (cd "$paquete" && npx vitest related --run "${proyecto[@]}" --passWithNoTests "${archivos[@]}" > "$log" 2>&1) \
    || { grep -E "FAIL|AssertionError|Error:|Test Files|Tests " "$log" | head -30; echo "pre-push: tests de $paquete en rojo (log completo en $log)"; exit 1; }
done
exit 0
