#!/usr/bin/env python3
"""Retro del 2026-11-02 (R1): comprueba cada pieza de `docs/media` con `check.py` de gw-media-content.

Desde v0.5.0, `check.py` pide las piezas como argumento; esta orden las busca (`<dir>/AAAA-MM-DD/NN-<tema>`) y
le pasa los prefijos de tarea (los de `taskId` de `.claude/gw.json`, más IMG, INS y P) y `--web-languages es,gl,en`. Las
normas de Reddit sin pegar («Normas leídas: pendiente», sin bloque de normas) no paran el check (las pega la
usuaria, la nube no lee reddit.com): salen como aviso. Cualquier otro error, una carpeta con otro nombre o un fallo
del propio script sí lo paran. Filtrar el texto de `check.py` es frágil: P7 de `docs/records/propuestas-flujo.md`.

Uso: python3 tools/qa/difusion.py [--dir docs/media]
"""
import glob
import os
import re
import subprocess
import sys

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
COMPROBAR = os.path.join(RAIZ, '.claude', 'skills', 'gw-media-content', 'scripts', 'check.py')
CONFIG = os.path.join(RAIZ, '.claude', 'gw', 'scripts', 'config.py')
EXTRA = ['IMG', 'INS', 'P']  # prefijos de WMF que `taskId` no lista
# Los dos errores que dependen de que la usuaria pegue las normas del subreddit.
NORMAS = re.compile(r'«Rules read:» «pendiente» has no valid YYYY-MM-DD date|no rules block for r/')
FECHA = re.compile(r'\d{4}-\d{2}-\d{2}$')
PIEZA = re.compile(r'\d{2}-.+$')


def prefijos() -> str:
    r = subprocess.run([sys.executable, CONFIG, '--root', RAIZ, 'get', 'taskId'], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f'difusion: no se lee taskId de .claude/gw.json: {r.stderr.strip()}')
    vistos = re.findall(r'[A-Z]{2,}', r.stdout)
    return ','.join(dict.fromkeys(vistos + EXTRA))


def main(argv: list[str]) -> int:
    carpeta = 'docs/media'
    if argv[:1] == ['--dir'] and len(argv) == 2:
        carpeta = argv[1]
    elif argv:
        print('difusion: uso: python3 tools/qa/difusion.py [--dir <carpeta>]', file=sys.stderr)
        return 2
    base = os.path.abspath(carpeta) if argv else os.path.join(RAIZ, carpeta)
    if not os.path.isdir(base):
        print(f'difusion: no existe la carpeta {base}', file=sys.stderr)
        return 1
    piezas, raras = [], []
    for dia in sorted(glob.glob(os.path.join(base, '[0-9]*'))):
        if not os.path.isdir(dia):
            continue
        if not FECHA.match(os.path.basename(dia)):
            raras.append(dia)
            continue
        for p in sorted(os.listdir(dia)):
            ruta = os.path.join(dia, p)
            if os.path.isdir(ruta):
                (piezas if PIEZA.match(p) else raras).append(ruta)
    if raras:
        print('\n'.join(f'difusion: {r}: no sigue <dir>/AAAA-MM-DD/NN-<tema>; renómbrala' for r in raras), file=sys.stderr)
        return 1
    if not piezas:
        return 0
    r = subprocess.run([sys.executable, COMPROBAR, '--task-prefixes', prefijos(), '--web-languages', 'es,gl,en', *piezas],
                       capture_output=True, text=True)
    lineas = [l for l in (r.stdout + r.stderr).splitlines() if l.strip()]
    errores = [l for l in lineas if not NORMAS.search(l)]
    avisos = len(lineas) - len(errores)
    if r.returncode not in (0, 1) or (r.returncode == 1 and errores):
        print('\n'.join(errores) or f'difusion: check.py salió con {r.returncode}', file=sys.stderr)
        print('difusion: arregla la pieza y repite: python3 tools/qa/difusion.py', file=sys.stderr)
        return 1
    if avisos:
        print(f'difusion: AVISO: {avisos} avisos de normas de Reddit sin pegar (sheet.md, «## Reddit»); las pega la usuaria',
              file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
