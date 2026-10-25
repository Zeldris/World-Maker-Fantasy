#!/usr/bin/env python3
"""QA-236 (retro de la difusión, 2026-10-25): los tests de una skill, al lado de sus scripts, los corre el CI.

Que cada script de skill tenga su test ya lo pide test_herramientas_con_test.py (QA-113), que también está en el
check. Esto mira la otra mitad: una `.claude/skills/<skill>/scripts/` con algún `test_*.py` aparece en
.github/workflows/ci.yml y en tools/qa/ci-local.sh como `discover -s .claude/skills/<skill>/scripts`.
Sale con 1 y una línea por fallo, con lo que hay que hacer. Uso: skills-con-tests.py [raíz del repo]
"""
import glob
import os
import sys
from pathlib import Path


def fallos(raiz: str) -> list[str]:
    ci = {r: Path(raiz, r).read_text(encoding='utf-8') for r in ('.github/workflows/ci.yml', 'tools/qa/ci-local.sh')}
    salida = []
    for carpeta in sorted(glob.glob(os.path.join(raiz, '.claude', 'skills', '*', 'scripts'))):
        if not glob.glob(os.path.join(carpeta, 'test_*.py')):
            continue
        skill = os.path.basename(os.path.dirname(carpeta))
        orden = f'discover -s .claude/skills/{skill}/scripts'
        salida += [f'{ruta} no corre los tests de {skill}: añade un paso con `python3 -m unittest {orden}`'
                   for ruta, texto in ci.items() if orden not in texto]
    return salida


if __name__ == '__main__':
    lista = fallos(os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..')))
    for linea in lista:
        print(f'skills-con-tests: {linea}', file=sys.stderr)
    sys.exit(1 if lista else 0)
