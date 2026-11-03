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

# Toda la copia salvo lo que no es del proyecto: un id puede nacer en un script de tools/ o en .claude/ antes que en docs/.
RUTAS = ['.', ':!**/node_modules/**', ':!**/*.dump']


def git(*args, cwd=None):
    return subprocess.run(['git', *args], cwd=cwd, capture_output=True, text=True)


def mayor(texto, patron):
    return max((int(n) for n in patron.findall(texto)), default=0)


def main(argv):
    args = [a for a in argv if not a.startswith('--')]
    opciones = [a for a in argv if a.startswith('--')]
    if any(o != '--sin-fetch' for o in opciones) or len(args) != 1 or not re.fullmatch(r'[A-Z]+', args[0]):
        print('Uso: siguiente-id.py <SERIE> [--sin-fetch]   (p. ej. QA)', file=sys.stderr)
        return 2
    serie = args[0]
    patron = re.compile(rf'(?<![A-Za-z]){serie}-(\d+)\b')
    if '--sin-fetch' not in argv:
        r = git('fetch', '-q', 'origin')
        if r.returncode:
            print(f'Ojo: git fetch falló; las ramas remotas pueden estar viejas ({r.stderr.strip()[:200]})', file=sys.stderr)
    if git('rev-parse', '--git-dir').returncode:
        print('siguiente-id.py: no es un repositorio de git', file=sys.stderr)
        return 2
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
