#!/usr/bin/env python3
"""QA-290 (retro del 2026-11-03): el siguiente número libre de una serie de tareas (`QA`, `CR`, `IMG`…).

Una rama larga numeraba sus tareas mirando solo su copia, y `main` ya había usado esos números: hubo que renumerar
dos veces (QA-259→263→268). Este script mira la copia de trabajo y todas las ramas remotas ya traídas
(`git fetch origin` antes), y dice el siguiente número tras el mayor de todas.

Uso: python3 tools/roadmap/siguiente-id.py QA [--sin-fetch]
"""
import re
import subprocess
import sys

RUTAS = ['docs', 'AGENTS.md', 'CLAUDE.md']


def git(*args, cwd=None):
    return subprocess.run(['git', *args], cwd=cwd, capture_output=True, text=True)


def mayor(texto, patron):
    return max((int(n) for n in patron.findall(texto)), default=0)


def main(argv):
    args = [a for a in argv if not a.startswith('--')]
    if len(args) != 1 or not re.fullmatch(r'[A-Z]+', args[0]):
        print('Uso: siguiente-id.py <SERIE> [--sin-fetch]   (p. ej. QA)', file=sys.stderr)
        return 2
    serie = args[0]
    patron = re.compile(rf'(?<![A-Za-z]){serie}-(\d+)\b')
    if '--sin-fetch' not in argv:
        git('fetch', '-q', 'origin')
    donde = {'copia de trabajo': mayor(git('grep', '--untracked', '-hE', rf'{serie}-[0-9]+', '--', *RUTAS).stdout, patron)}
    ramas = [r for r in git('for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin').stdout.split()
             if r != 'origin/HEAD' and r != 'origin']
    for rama in ramas:
        texto = git('grep', '-hE', rf'{serie}-[0-9]+', rama, '--', *RUTAS).stdout
        donde[rama] = mayor(texto, patron)
    tope = max(donde.values())
    print(f'{serie}-{tope + 1}')
    origen = [k for k, v in donde.items() if v == tope and tope]
    if origen and 'copia de trabajo' not in origen:
        print(f'Ojo: el {serie}-{tope} ya está en {", ".join(origen)}, no en esta copia.', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
