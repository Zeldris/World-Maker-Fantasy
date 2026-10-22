#!/bin/bash
# QA-88/QA-98/QA-35, adaptado a `relatedTests` de Galivelop-workflow (piloto, 2026-10-22): los tests de lo que
# cambia en el push. El `tests-relacionados.sh` del flujo lo llama con los archivos cambiados que siguen existiendo.
#   unidad       `vitest related` de backend (solo el proyecto `unit`) y frontend, y el test de nombres de imágenes
#                si cambia algo en backend/uploads/images/ (QA-35)
#   integracion  los de BD real con el nombre de un archivo cambiado (`foo.ts` → `foo.integration.test.ts`)
# En el sandbox Flatpak de la Deck no hay npx: vitest corre en el host (host.sh, QA-180).
# Uso: tests-vitest.sh unidad|integracion <archivos relativos a la raíz…>
set -uo pipefail
modo="${1:-}"; shift || true
cd "$(git rev-parse --show-toplevel)"
case "$modo" in unidad|integracion) ;; *) echo "uso: tests-vitest.sh unidad|integracion <archivos…>" >&2; exit 2 ;; esac

if [ "$modo" = unidad ]; then
  for paquete in backend frontend; do
    archivos=()
    for f in "$@"; do
      case "$f" in "$paquete"/src/*.ts|"$paquete"/src/*.tsx) [ -f "$f" ] && archivos+=("${f#"$paquete"/}") ;; esac
    done
    [ ${#archivos[@]} -eq 0 ] && continue
    proyecto=()
    [ "$paquete" = backend ] && proyecto=(--project unit)
    log="/tmp/pre-push-related-$paquete.log"
    echo "pre-push: tests relacionados de $paquete (${#archivos[@]} archivos cambiados)…"
    bash tools/qa/host.sh bash -c 'cd "$1" && shift && npx vitest related --run "$@" --passWithNoTests' _ "$paquete" "${proyecto[@]}" "${archivos[@]}" > "$log" 2>&1 \
      || { grep -E "FAIL|AssertionError|Error:|Test Files|Tests " "$log" | head -30; echo "pre-push: tests de $paquete en rojo (log completo en $log)"; exit 1; }
  done
  for f in "$@"; do
    case "$f" in backend/uploads/images/*)
      bash tools/qa/host.sh bash -c 'cd backend && npx vitest run src/scripts/imagenesZona.test.ts' > /tmp/pre-push-imagenes.log 2>&1 \
        || { grep -E "Expected|\+ |archivo|mapa" /tmp/pre-push-imagenes.log | head -20; echo "pre-push: hay imágenes con un nombre que no es el de ningún lugar"; exit 1; }
      break ;;
    esac
  done
  exit 0
fi

integracion=()
for f in "$@"; do
  case "$f" in
    backend/src/*.integration.test.ts) integracion+=("${f#backend/}") ;;
    backend/src/*.ts) t="${f%.ts}.integration.test.ts"; [ -f "$t" ] && integracion+=("${t#backend/}") ;;
  esac
done
[ ${#integracion[@]} -eq 0 ] && exit 0
mapfile -t integracion < <(printf '%s\n' "${integracion[@]}" | sort -u)
log_bd="/tmp/pre-push-integracion.log"
echo "pre-push: tests de integración de lo que cambia (${#integracion[@]})…"
bash tools/qa/host.sh bash -c 'cd backend && npx vitest run --project bd-real "$@"' _ "${integracion[@]}" > "$log_bd" 2>&1 \
  || { grep -E "FAIL|AssertionError|Error:|Test Files|Tests " "$log_bd" | head -30; echo "pre-push: tests de integración en rojo (log completo en $log_bd)"; exit 1; }
exit 0
