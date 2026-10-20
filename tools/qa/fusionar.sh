#!/bin/bash
# QA-135: fusiona una rama de subagente en la actual y comprueba el resultado en una salida corta.
# Uso: tools/qa/fusionar.sh <rama> "<mensaje del merge>"
#  - `git merge --no-ff`; si el único conflicto es docs/registros/pruebas-0.3-hallazgos.md, lo resuelve
#    quedándose, hallazgo a hallazgo, con el lado cuyo estado no es «pendiente» (resolver_hallazgos.py).
#    Con otro conflicto, para y lo lista (el merge queda abierto).
#  - pasa los tests del paquete tocado (vitest de los archivos cambiados y los que los importan; frontend, y `tsc -b`).
#  - avisa, sin bloquear, si el último commit de la rama no lleva la marca de revisión (`revisado.sh`, QA-50).
set -uo pipefail
[ $# -eq 2 ] || { echo "Uso: $0 <rama> \"<mensaje>\"" >&2; exit 2; }
rama="$1"; mensaje="$2"
raiz="$(git rev-parse --show-toplevel)"; cd "$raiz"
HALLAZGOS="docs/registros/pruebas-0.3-hallazgos.md"

sha_rama="$(git rev-parse "$rama")" || exit 2
if ! git merge --no-ff "$rama" -m "$mensaje" >/tmp/fusionar-merge.log 2>&1; then
  conflictos="$(git diff --name-only --diff-filter=U)"
  if [ "$conflictos" = "$HALLAZGOS" ]; then
    if python3 "$raiz/tools/qa/resolver_hallazgos.py" "$HALLAZGOS" && ! grep -q '^<<<<<<<' "$HALLAZGOS"; then
      git add "$HALLAZGOS" && git commit --no-edit -q || { echo "FALLO: no pude cerrar el merge"; exit 1; }
      echo "Conflicto en $HALLAZGOS resuelto (se queda el estado no pendiente)."
    else
      echo "FALLO: no pude resolver $HALLAZGOS; el merge queda abierto."; exit 1
    fi
  else
    echo "CONFLICTO (merge abierto: resuélvelo o git merge --abort):"
    echo "${conflictos:-$(tail -5 /tmp/fusionar-merge.log)}" | sed 's/^/  /'
    exit 1
  fi
fi

echo "Commit $(git rev-parse --short HEAD) · $(git log -1 --format=%s)"
cambiados="$(git diff --name-only HEAD^1 HEAD)"
for paquete in backend frontend; do
  n="$(grep -c "^$paquete/" <<<"$cambiados")"
  [ "$n" -gt 0 ] && echo "  $paquete: $n archivos"
done
otros="$(grep -vcE '^(backend|frontend)/' <<<"$cambiados")"
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
    (cd "$paquete" && npx vitest related --run "${proyecto[@]}" --passWithNoTests "${archivos[@]}" >"/tmp/fusionar-$paquete.log" 2>&1) \
      || resultado="FAIL (log en /tmp/fusionar-$paquete.log)"
  fi
  if [ "$paquete" = frontend ] && [ "$resultado" = OK ]; then
    (cd frontend && npx tsc -b >/tmp/fusionar-tsc.log 2>&1) || resultado="FAIL tsc (log en /tmp/fusionar-tsc.log)"
  fi
  echo "  tests $paquete: $resultado"
  [ "$resultado" = OK ] || fallo=1
done

# Marca de revisión (QA-50): `.claude/revision-main.sha` guarda el HEAD revisado; si no es el último commit de la
# rama fusionada, se avisa (sin bloquear).
marca=""; [ -f ".claude/revision-main.sha" ] && marca="$(cat .claude/revision-main.sha)"
if [ "$marca" != "$sha_rama" ]; then
  echo "AVISO: el último commit de $rama (${sha_rama:0:8}) no lleva marca de revisión; recuerda el paso 3 de orchestrate-dealer (/code-review del diff)."
fi
exit $fallo
