#!/usr/bin/env python3
"""QA-370: imprime la entrada de cada tarea en los roadmaps de WMF, sin leerlos enteros ni su diff.

Uso: python3 tools/roadmap/ver.py ID [ID…]   (p. ej. QA-353 UX-41)

Busca la viñeta que define la tarea (`- **ID · …**` o, cerrada, `- ~~**ID · …**~~ ✅ …`, con las líneas de
continuación más sangradas) en `docs/producto/roadmap*.md`, y la imprime con `archivo:línea`. Sale con 1 si alguna
no está definida. `roadmap.py show` del flujo no sirve aquí: busca filas de tabla con el id en la primera celda y la
misma tarea en cada archivo de `roadmapFiles` (un roadmap por idioma), y WMF tiene varios roadmaps en listas.
VER_RAIZ cambia la raíz del repo (los tests).
"""
import glob
import os
import re
import sys

RAIZ = os.environ.get('VER_RAIZ') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))


def entradas(ident):
    """[(ruta relativa, número de línea, texto)] de cada definición de `ident`."""
    abre = re.compile(rf'^(\s*)- (~~)?\*\*{re.escape(ident)}(?![\w-])')
    hallado = []
    for ruta in sorted(glob.glob(os.path.join(RAIZ, 'docs', 'producto', 'roadmap*.md'))):
        with open(ruta, encoding='utf-8') as f:
            lineas = f.read().split('\n')
        for i, linea in enumerate(lineas):
            m = abre.match(linea)
            if not m:
                continue
            fin = i
            while fin + 1 < len(lineas) and lineas[fin + 1].startswith(m.group(1) + '  ') and lineas[fin + 1].strip():
                fin += 1
            hallado.append((os.path.relpath(ruta, RAIZ), i + 1, '\n'.join(lineas[i:fin + 1])))
    return hallado


def main(argv):
    if not argv or any(a in ('-h', '--help') for a in argv):
        print(__doc__.strip())
        return 0 if argv else 2
    falta = False
    for ident in argv:
        hallado = entradas(ident)
        if not hallado:
            print(f'{ident}: no está definida en docs/producto/roadmap*.md', file=sys.stderr)
            falta = True
        for ruta, n, texto in hallado:
            print(f'{ruta}:{n}: {texto}')
    return 1 if falta else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
