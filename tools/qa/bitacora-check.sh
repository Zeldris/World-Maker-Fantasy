#!/bin/bash
# QA-237 (retro de la difusión, 2026-10-25): la comprobación de la bitácora del pre-push, en el check, para que falle
# antes del commit y no al subir (un amend menos). Filas bien formadas y, frente a la rama remota (la misma base que el
# pre-push: desde main pediría tareas que ya salieron de «Hecho recientemente»), cada tarea tachada en el plan también
# está en «Hecho recientemente». Mira la copia de trabajo (`git stash create`), no solo el último commit.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
python3 .claude/gw/scripts/bitacora.py check || exit 1
rama="$(git branch --show-current)"
base="$(git rev-parse -q --verify "refs/remotes/origin/$rama" 2>/dev/null)" || exit 0  # rama sin subir: no hay base
sha="$(git stash create 2>/dev/null)"
python3 .claude/gw/scripts/bitacora.py closed "$base" "${sha:-HEAD}"
