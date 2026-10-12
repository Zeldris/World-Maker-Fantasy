#!/bin/bash
# QA-50: tras pasar `/code-review --max-findings all` sobre el diff contra main y arreglar lo que
# encuentre, marca el commit revisado. El gancho `.claude/hooks/revision-antes-de-main.sh` no deja
# crear ni fusionar un PR a main si la marca no es del mismo commit.
set -euo pipefail
raiz="$(git rev-parse --show-toplevel)"
if [ -n "$(git -C "$raiz" status --porcelain --untracked-files=no)" ]; then
  echo "Hay cambios sin commit: súbelos y vuelve a revisar antes de marcar." >&2
  exit 1
fi
git -C "$raiz" rev-parse HEAD > "$raiz/.claude/revision-main.sha"
echo "Revisado: $(cat "$raiz/.claude/revision-main.sha")"
