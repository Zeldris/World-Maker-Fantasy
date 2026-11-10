#!/bin/bash
# QA-88/QA-98/QA-35, adaptado a `relatedTests` de Galivelop-workflow (piloto, 2026-10-22): los tests de lo que
# cambia en el push. El `related-tests.sh` del flujo lo llama con los archivos cambiados que siguen existiendo.
#   unidad       `vitest related` de backend (solo el proyecto `unit`) y frontend, y el test de nombres de imágenes
#                si cambia algo en backend/uploads/images/ (QA-35)
#   integracion  los de BD real con el nombre de un archivo cambiado (`foo.ts` → `foo.integration.test.ts`)
# Cada log, en su archivo de mktemp (dos pushes a la vez no se pisan; retro del piloto, 2026-10-23), borrado en verde.
# En el sandbox Flatpak de la Deck no hay npx: vitest corre en el host (host.sh, QA-180).
# Uso: tests-vitest.sh unidad|integracion <archivos relativos a la raíz…>
set -uo pipefail
modo="${1:-}"; shift || true
cd "$(git rev-parse --show-toplevel)"
case "$modo" in unidad|integracion) ;; *) echo "uso: tests-vitest.sh unidad|integracion <archivos…>" >&2; exit 2 ;; esac

# correr_con_log <nombre> <patrón de grep> <mensaje en rojo> <orden…>: la orden, con su salida en un log de mktemp;
# en verde lo borra, en rojo enseña lo que casa con el patrón y la ruta del log.
correr_con_log() {
  local nombre="$1" patron="$2" mensaje="$3" log; shift 3
  log="$(mktemp "${TMPDIR:-/tmp}/pre-push-$nombre.XXXXXX")" \
    || { echo "pre-push: no se pudo crear el log de $nombre en ${TMPDIR:-/tmp}" >&2; exit 1; }
  if "$@" > "$log" 2>&1; then rm -f "$log"; return 0; fi
  grep -E "$patron" "$log" | head -30
  echo "pre-push: $mensaje (log completo en $log)"
  exit 1
}

if [ "$modo" = unidad ]; then
  for paquete in backend frontend; do
    archivos=()
    for f in "$@"; do
      case "$f" in "$paquete"/src/*.ts|"$paquete"/src/*.tsx) [ -f "$f" ] && archivos+=("${f#"$paquete"/}") ;; esac
    done
    [ ${#archivos[@]} -eq 0 ] && continue
    proyecto=()
    [ "$paquete" = backend ] && proyecto=(--project unit)
    echo "pre-push: tests relacionados de $paquete (${#archivos[@]} archivos cambiados)…"
    correr_con_log "related-$paquete" "FAIL|AssertionError|Error:|Test Files|Tests " "tests de $paquete en rojo" \
      bash tools/qa/host.sh bash -c 'cd "$1" && shift && npx vitest related --run "$@" --passWithNoTests' _ "$paquete" "${proyecto[@]}" "${archivos[@]}"
  done
  for f in "$@"; do
    case "$f" in backend/uploads/images/*)
      correr_con_log imagenes "Expected|\+ |archivo|mapa" "hay imágenes con un nombre que no es el de ningún lugar" \
        bash tools/qa/host.sh bash -c 'cd backend && npx vitest run src/scripts/imagenesZona.test.ts'
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
# Retro 2026-11-10 (mapas a main): sin nada en el 11434 todos caen en ECONNREFUSED; como ci-local.sh, se levanta
# el Ollama simulado (en el host, que es donde corre vitest). Con el Ollama real en marcha contesta él.
bash tools/qa/host.sh bash -c 'curl -s -o /dev/null localhost:11434 && exit 0
  setsid nohup node tools/ci/mock-ollama.mjs >"${TMPDIR:-/tmp}/mock-ollama.log" 2>&1 </dev/null &
  for _ in $(seq 1 20); do curl -s -o /dev/null localhost:11434 && { echo "pre-push: Ollama simulado levantado en el 11434"; exit 0; }; sleep 1; done
  echo "pre-push: no se pudo levantar el Ollama simulado (log en ${TMPDIR:-/tmp}/mock-ollama.log)" >&2'
echo "pre-push: tests de integración de lo que cambia (${#integracion[@]})…"
correr_con_log integracion "FAIL|AssertionError|Error:|Test Files|Tests " "tests de integración en rojo" \
  bash tools/qa/host.sh bash -c 'cd backend && npx vitest run --project bd-real "$@"' _ "${integracion[@]}"
exit 0
