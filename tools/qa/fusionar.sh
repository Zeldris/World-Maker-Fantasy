#!/bin/bash
# QA-135: fusiona una rama de subagente en la actual y comprueba el resultado en una salida corta.
# Uso: tools/qa/fusionar.sh <rama> "<mensaje del merge>" [--revisada]
#  - `git merge --no-ff`; si el único conflicto es docs/registros/pruebas-0.3-hallazgos.md, lo resuelve
#    quedándose, hallazgo a hallazgo, con el lado cuyo estado no es «pendiente» (resolver_hallazgos.py).
#    Con otro conflicto, para y lo lista (el merge queda abierto).
#  - pasa los tests del paquete tocado (vitest de los archivos cambiados y los que los importan; frontend, y `tsc -b`).
#    Con tests en rojo el merge YA está hecho: dice cómo deshacerlo y sale con 1.
#  - `--revisada` = la principal ya hizo revisar el diff (paso 3 de orchestrate-dealer); sin él, lo recuerda.
set -uo pipefail
[ $# -ge 2 ] && [ $# -le 3 ] && { [ $# -eq 2 ] || [ "$3" = "--revisada" ]; } || { echo "Uso: $0 <rama> \"<mensaje>\" [--revisada]" >&2; exit 2; }
rama="$1"; mensaje="$2"; revisada="${3:-}"
raiz="$(git rev-parse --show-toplevel)"; cd "$raiz"
HALLAZGOS="docs/registros/pruebas-0.3-hallazgos.md"
logs="$(mktemp -d)"

git rev-parse --verify --quiet "$rama^{commit}" >/dev/null || { echo "No existe la rama $rama" >&2; exit 2; }
antes="$(git rev-parse HEAD)"
if ! git merge --no-ff "$rama" -m "$mensaje" >"$logs/merge.log" 2>&1; then
  conflictos="$(git diff --name-only --diff-filter=U)"
  if [ "$conflictos" = "$HALLAZGOS" ]; then
    if python3 "$raiz/tools/qa/resolver_hallazgos.py" "$HALLAZGOS" && ! grep -q '^<<<<<<<' "$HALLAZGOS"; then
      git add "$HALLAZGOS" && git commit --no-edit -q || { echo "FALLO: no pude cerrar el merge (sigue abierto)"; exit 1; }
      echo "Conflicto en $HALLAZGOS resuelto (se queda el estado no pendiente)."
    else
      echo "FALLO: no pude resolver $HALLAZGOS (registro intacto, con marcas de conflicto); el merge queda abierto: resuélvelo o git merge --abort."
      exit 1
    fi
  else
    echo "CONFLICTO (merge abierto: resuélvelo o git merge --abort):"
    echo "${conflictos:-$(tail -5 "$logs/merge.log")}" | sed 's/^/  /'
    exit 1
  fi
fi

if [ "$(git rev-parse HEAD)" = "$antes" ]; then
  echo "Nada que fusionar: $rama ya está en la rama actual."
  exit 0
fi

echo "Commit $(git rev-parse --short HEAD) · $(git log -1 --format=%s)"
cambiados="$(git diff --name-only HEAD^1 HEAD)"
for paquete in backend frontend; do
  n="$(grep -c "^$paquete/" <<<"$cambiados")"
  [ "$n" -gt 0 ] && echo "  $paquete: $n archivos"
done
otros="$(grep -vE '^(backend|frontend)/' <<<"$cambiados" | grep -c .)"
[ "$otros" -gt 0 ] && echo "  resto: $otros archivos"

fallo=0
for paquete in backend frontend; do
  grep -q "^$paquete/" <<<"$cambiados" || continue
  archivos=()
  while read -r f; do
    [ -f "$f" ] && archivos+=("${f#"$paquete"/}")
  done < <(grep -E "^$paquete/.*\.(ts|tsx)$" <<<"$cambiados")
  resultado="OK"
  if [ ${#archivos[@]} -gt 0 ]; then
    proyecto=(); [ "$paquete" = backend ] && proyecto=(--project unit)
    (cd "$paquete" && npx vitest related --run ${proyecto[@]+"${proyecto[@]}"} --passWithNoTests "${archivos[@]}" >"$logs/$paquete.log" 2>&1) \
      || resultado="FAIL (log en $logs/$paquete.log)"
  fi
  if [ "$paquete" = frontend ] && [ "$resultado" = OK ]; then
    (cd frontend && npx tsc -b >"$logs/tsc.log" 2>&1) || resultado="FAIL tsc (log en $logs/tsc.log)"
  fi
  echo "  tests $paquete: $resultado"
  [ "$resultado" = OK ] || fallo=1
done

[ "$revisada" = "--revisada" ] || echo "Sin --revisada: confirma el /code-review del diff (paso 3 de orchestrate-dealer)."
if [ "$fallo" -ne 0 ]; then
  echo "TESTS EN ROJO: el merge YA está hecho en la rama actual. Para deshacerlo: git reset --hard HEAD^1"
  exit 1
fi
exit 0
