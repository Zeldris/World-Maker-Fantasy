#!/usr/bin/env python3
"""QA-349 (retro del 2026-11-15): gancho PreToolUse de Bash y Read que avisa al leer enteros los registros que ya
tienen su herramienta.

En la ronda de la nube (tandas 131-133) la sesión principal leyó `plan-comprobacion-puerta.md` 21 veces,
`pruebas-0.3-hallazgos.md` 13, `traspaso.md` 14 y `rondas-de-pruebas.md` 3 (1,7 M de tokens arrastrados de 13,2 M),
aunque `plan.py`, `marca-hallazgo.py`, `recover.py --state` y `seccion.sh` dan la parte que hace falta.

Nunca bloquea: si un tramo de la orden de Bash lee uno de esos archivos (cat, sed, head, tail, awk, grep, less, nl,
python, bash) sin pasar por su herramienta, o un Read abre el runbook sin `offset`/`limit` (los registros ya los vigila
`whole-read.py`), añade `additionalContext` con la orden que lee
menos. En cualquier otro caso (y ante una entrada que no entiende) no escribe nada y sale con 0.
"""
import json
import re
import sys

ARCHIVOS = {
    'docs/records/plan-comprobacion-puerta.md': (
        'python3 tools/qa/plan.py',
        'la tanda siguiente y cada lote; `--tanda N` o `--lote X` para una fila entera (QA-320)'),
    'docs/records/pruebas-0.3-hallazgos.md': (
        'python3 tools/qa/marca-hallazgo.py',
        '`--lista <grupo>` para los de un estado (QA-322) o `--ver P<n>` para uno'),
    'docs/records/traspaso.md': (
        'python3 .claude/gw/scripts/recover.py',
        '`--state` para tu fila y los últimos commits (QA-261)'),
    'docs/runbooks/rondas-de-pruebas.md': (
        'tools/qa/seccion.sh',
        '`bash tools/qa/seccion.sh docs/runbooks/rondas-de-pruebas.md "<sección>"`, una sección (QA-311, QA-323)'),
}
# El cuerpo de un heredoc que escribe (un mensaje de commit, `cat > archivo`, `tee`) es texto, no una lectura; el de
# uno que se ejecuta (`python3 - <<EOF`, `bash <<EOF`) sí se mira. Se quita solo el cuerpo: la línea que abre sigue.
HEREDOC = re.compile(r"^([^\n]*)<<-?\s*(['\"]?)(\w+)\2([^\n]*)\n.*?^\s*\3\s*$", re.S | re.M)
ESCRIBE = re.compile(r'git\s+(commit|tag)|>|\btee\b')
LECTOR = re.compile(r'(^|[\s(`])(cat|sed|head|tail|awk|grep|rg|less|more|nl|python3?|bash|sh)\b')
TRAMOS = re.compile(r'&&|\|\||[;|\n]')
# QA-366 (`/gw-opt-tokens` de UX-41): el diff de un roadmap entero (5,6k en un tramo, 325k arrastrados) en vez de la
# entrada de cada tarea, como ya pedía QA-334. `--stat`, `--name-only`… dan poco y no avisan.
DIFF_ROADMAP = re.compile(r'\bgit\s+(diff|show|log\s+-p)\b(?!.*--(stat|name-only|name-status|shortstat|numstat)).*roadmap[\w.-]*\.md')
AVISO_ROADMAP = ('roadmap*.md: python3 .claude/gw/scripts/roadmap.py show <id> (la entrada de cada tarea tocada, '
                 'no el diff del roadmap; QA-334, QA-366)')


def heredocs_en_su_tramo(orden: str) -> str:
    def quitar(m):
        abre = m.group(1) + m.group(4)
        if ESCRIBE.search(abre):
            return abre
        # El heredoc que se ejecuta va con su línea en un solo tramo: el lector (`python3 -`) está en la línea que abre.
        return re.sub(r'&&|\|\||[;|\n]', ' ', m.group(0))
    return HEREDOC.sub(quitar, orden)


def avisos(evento: dict) -> list:
    herramienta = evento.get('tool_name')
    entrada = evento.get('tool_input')
    if not isinstance(entrada, dict):
        return []
    salida = []
    if herramienta == 'Bash':
        orden = entrada.get('command')
        if not isinstance(orden, str):
            return []
        # Por tramos (`;`, `&&`, `|`…): el tramo que lee y nombra el archivo, sin su herramienta en ese tramo. Por el
        # nombre del archivo, no la ruta, para pillar también `cd docs/records && cat traspaso.md`.
        for tramo in TRAMOS.split(heredocs_en_su_tramo(orden)):
            if DIFF_ROADMAP.search(tramo) and AVISO_ROADMAP not in salida:
                salida.append(AVISO_ROADMAP)
            if not LECTOR.search(tramo):
                continue
            for ruta, (atajo, uso) in ARCHIVOS.items():
                aviso = f'{ruta}: {atajo} ({uso})'
                if ruta.rsplit('/', 1)[1] in tramo and atajo not in tramo and aviso not in salida:
                    salida.append(aviso)
    elif herramienta == 'Read':
        # Los registros de docs/records ya los vigila whole-read.py del flujo; aquí, solo el runbook.
        if entrada.get('offset') or entrada.get('limit'):
            return []
        ruta_leida = str(entrada.get('file_path') or '').replace('\\', '/')
        ruta = 'docs/runbooks/rondas-de-pruebas.md'
        if ruta_leida == ruta or ruta_leida.endswith('/' + ruta):
            atajo, uso = ARCHIVOS[ruta]
            salida.append(f'{ruta}: {atajo} ({uso})')
    return salida


def main() -> int:
    try:
        evento = json.load(sys.stdin)
    except (ValueError, OSError):
        return 0
    if not isinstance(evento, dict):
        return 0
    lista = avisos(evento)
    if lista:
        texto = ('QA-349: este registro tiene su herramienta, que da solo la parte que hace falta (leerlo entero '
                 'arrastra miles de tokens en cada llamada): ' + '; '.join(lista) + '.')
        print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'additionalContext': texto}},
                         ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main())
