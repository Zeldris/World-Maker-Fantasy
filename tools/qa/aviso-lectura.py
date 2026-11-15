#!/usr/bin/env python3
"""QA-349 (retro del 2026-11-15): gancho PreToolUse de Bash y Read que avisa al leer enteros los registros que ya
tienen su herramienta.

En la ronda de la nube (tandas 131-133) la sesión principal leyó `plan-comprobacion-puerta.md` 21 veces,
`pruebas-0.3-hallazgos.md` 13, `traspaso.md` 14 y `rondas-de-pruebas.md` 3 (1,7 M de tokens arrastrados de 13,2 M),
aunque `plan.py`, `marca-hallazgo.py`, `recover.py --state` y `seccion.sh` dan la parte que hace falta.

Nunca bloquea: si la orden de Bash lee uno de esos archivos (cat, sed, head, tail, awk, grep, less, nl, python) sin
pasar por su herramienta, o un Read lo abre sin `offset`/`limit`, añade `additionalContext` con la orden que lee
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
LECTOR = re.compile(r'(^|[\s|;&(`])(cat|sed|head|tail|awk|grep|rg|less|more|nl|python3?)\b')


def avisos(evento: dict) -> list:
    herramienta = evento.get('tool_name')
    entrada = evento.get('tool_input') or {}
    salida = []
    if herramienta == 'Bash':
        orden = entrada.get('command') or ''
        if not LECTOR.search(orden):
            return []
        for ruta, (atajo, uso) in ARCHIVOS.items():
            if ruta in orden and atajo not in orden:
                salida.append(f'{ruta}: {atajo} ({uso})')
    elif herramienta == 'Read':
        if entrada.get('offset') or entrada.get('limit'):
            return []
        ruta_leida = (entrada.get('file_path') or '').replace('\\', '/')
        for ruta, (atajo, uso) in ARCHIVOS.items():
            if ruta_leida.endswith('/' + ruta) or ruta_leida == ruta:
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
