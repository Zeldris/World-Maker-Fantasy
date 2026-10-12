#!/bin/bash
# QA-50 (retro del 2026-10-12): no se crea ni se fusiona un PR a main sin `/code-review
# --max-findings all` del mismo commit (paso 6 de docs/runbooks/skills-y-modelos.md). Se saltó en el
# PR #43 y casi en el #44. La marca la deja `tools/qa/revisado.sh` tras la revisión.
entrada="$(cat)"
raiz="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
python3 - "$raiz" "$entrada" <<'PY'
import json, subprocess, sys
raiz, entrada = sys.argv[1], json.loads(sys.argv[2])
herramienta = entrada.get('tool_name', '')
datos = entrada.get('tool_input', {}) or {}
if herramienta.endswith('create_pull_request'):
    if datos.get('base') != 'main':
        sys.exit(0)
    cabeza = subprocess.run(['git', '-C', raiz, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()
else:
    # Fusionar: la base y la cabeza son las del PR, no las de este checkout. Si no se pueden
    # consultar, se bloquea (mejor un falso bloqueo que un PR sin revisar en main).
    pr = subprocess.run(
        ['gh', 'api', f"repos/{datos.get('owner')}/{datos.get('repo')}/pulls/{datos.get('pullNumber')}"],
        capture_output=True, text=True,
    )
    try:
        info = json.loads(pr.stdout)
        if info['base']['ref'] != 'main':
            sys.exit(0)
        cabeza = info['head']['sha']
    except (ValueError, KeyError, TypeError):
        cabeza = '(no se pudo consultar el PR)'
try:
    marca = open(f'{raiz}/.claude/revision-main.sha').read().strip()
except OSError:
    marca = ''
if marca and marca == cabeza:
    sys.exit(0)
print(
    f'Bloqueado (QA-50): antes de un PR a main, `/code-review --max-findings all` del diff contra main, '
    f'arreglar lo que encuentre, subirlo y marcar con `bash tools/qa/revisado.sh` (marca: {marca or "ninguna"}, '
    f'commit: {cabeza}). La descripción, con la skill `pr`.',
    file=sys.stderr,
)
sys.exit(2)
PY
