#!/usr/bin/env python3
"""QA-42 (retro de QA-27, 2026-10-12): cambia el estado de un hallazgo en el registro de una ronda.

Uso: python3 tools/qa/marca-hallazgo.py P<n> "<texto viejo>" "<texto nuevo>" [--registro <ruta>]

Busca la fila `| P<n> | ...` que contenga el texto viejo y lo sustituye. Falla si no hay exactamente
una, para no tocar otra fila por error. Registro por defecto: el del hito más alto
(`docs/registros/pruebas-<hito>-hallazgos.md`, p. ej. `pruebas-0.3-hallazgos.md`).
"""
import glob
import re
import sys


def registro_por_defecto() -> str:
    por_hito = {}
    for ruta in glob.glob('docs/registros/pruebas-*-hallazgos.md'):
        m = re.search(r'pruebas-(\d+)\.(\d+)-hallazgos\.md$', ruta)
        if m:
            por_hito[(int(m.group(1)), int(m.group(2)))] = ruta
    if not por_hito:
        sys.exit('No hay ningún docs/registros/pruebas-<hito>-hallazgos.md (¿estás en la raíz del repo?)')
    return por_hito[max(por_hito)]


def main(args: list[str]) -> None:
    registro = None
    if '--registro' in args:
        i = args.index('--registro')
        registro = args[i + 1]
        args = args[:i] + args[i + 2:]
    if len(args) != 3:
        sys.exit(__doc__)
    pid, viejo, nuevo = args
    ruta = registro or registro_por_defecto()
    lineas = open(ruta, encoding='utf-8').read().split('\n')
    filas = [i for i, l in enumerate(lineas) if l.startswith(f'| {pid} |') and viejo in l]
    if len(filas) != 1:
        sys.exit(f'{ruta}: {len(filas)} filas de {pid} con ese texto (hace falta exactamente una)')
    lineas[filas[0]] = lineas[filas[0]].replace(viejo, nuevo, 1)
    open(ruta, 'w', encoding='utf-8').write('\n'.join(lineas))
    print(f'{ruta}: {pid} actualizado')


if __name__ == '__main__':
    main(sys.argv[1:])
