#!/usr/bin/env python3
"""QA-42 (retro de QA-27, 2026-10-12): cambia el estado de un hallazgo en el registro de una ronda.

Uso: python3 tools/qa/marca-hallazgo.py P<n> "<texto viejo>" "<texto nuevo>" [--registro <ruta>]
     python3 tools/qa/marca-hallazgo.py --nuevo "<hallazgo>" "<estado>" [--registro <ruta>]

La primera forma busca la fila `| P<n> | ...` cuyo estado (la última columna) contenga el texto viejo y
lo sustituye solo ahí; falla si no hay exactamente una, para no tocar otra fila por error. La segunda (`QA-47`) añade una fila nueva
detrás de la última, con el siguiente número; `QA-55`: el número sale por encima del más alto de la copia
local, de `origin/main` y de todas las ramas `origin/claude/*` (hace `git fetch` antes), para que dos
cuentas que anotan a la vez no repitan número. Registro por defecto: el del hito más alto
(`docs/registros/pruebas-<hito>-hallazgos.md`, p. ej. `pruebas-0.3-hallazgos.md`).
"""
import glob
import os
import re
import subprocess
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


def numeros_en_ramas(ruta: str) -> list[int]:
    """QA-55: los P<n> del registro en `origin/main` y en cada rama `origin/claude/*`, tras un `git fetch`.

    Sin red, se queda con lo que ya hubiera traído el último fetch (y lo avisa)."""
    if subprocess.run(['git', 'fetch', '--quiet', 'origin'], capture_output=True).returncode != 0:
        print('marca-hallazgo: sin git fetch (¿sin red?); numero con las ramas que ya había', file=sys.stderr)
    raiz = subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True).stdout.strip()
    rel = os.path.relpath(os.path.abspath(ruta), raiz) if raiz else ruta
    ramas = subprocess.run(['git', 'for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/claude/'],
                           capture_output=True, text=True).stdout.split()
    numeros = []
    for rama in ['origin/main', *ramas]:
        r = subprocess.run(['git', 'show', f'{rama}:{rel}'], capture_output=True, text=True)
        if r.returncode == 0:
            numeros += [int(n) for n in re.findall(r'^\| P(\d+) \|', r.stdout, re.M)]
    return numeros


def main(args: list[str]) -> None:
    registro = None
    if '--registro' in args:
        i = args.index('--registro')
        registro = args[i + 1]
        args = args[:i] + args[i + 2:]
    ruta = registro or registro_por_defecto()
    lineas = open(ruta, encoding='utf-8').read().split('\n')
    if args[:1] == ['--nuevo']:
        if len(args) != 3:
            sys.exit(__doc__)
        filas = [i for i, l in enumerate(lineas) if re.match(r'^\| P\d+ \|', l)]
        if not filas:
            sys.exit(f'{ruta}: no hay ninguna fila `| P<n> |` detrás de la que añadir')
        locales = [int(re.match(r'^\| P(\d+) ', lineas[i]).group(1)) for i in filas]
        numero = max(locales + numeros_en_ramas(ruta)) + 1
        hallazgo, estado = (t.replace('|', '\\|') for t in args[1:])
        lineas.insert(filas[-1] + 1, f'| P{numero} | {hallazgo} | {estado} |')
        open(ruta, 'w', encoding='utf-8').write('\n'.join(lineas))
        print(f'{ruta}: P{numero} añadido')
        return
    if len(args) != 3:
        sys.exit(__doc__)
    pid, viejo, nuevo = args
    viejo, nuevo = viejo.replace('|', '\\|'), nuevo.replace('|', '\\|')

    def estado(linea: str) -> tuple[str, str]:
        # La última columna (Estado): lo que va detrás del último ` | ` sin escapar.
        cuerpo = linea.rstrip()[:-1].rstrip()  # sin la `|` final
        corte = max(i for i in range(len(cuerpo) - 2) if cuerpo[i:i + 3] == ' | ' and cuerpo[i - 1] != '\\')
        return cuerpo[:corte + 3], cuerpo[corte + 3:]

    filas = [i for i, l in enumerate(lineas) if l.startswith(f'| {pid} |') and viejo in estado(l)[1]]
    if len(filas) != 1:
        sys.exit(f'{ruta}: {len(filas)} filas de {pid} con ese texto en el estado (hace falta exactamente una)')
    antes, texto = estado(lineas[filas[0]])
    lineas[filas[0]] = f'{antes}{texto.replace(viejo, nuevo, 1)} |'
    open(ruta, 'w', encoding='utf-8').write('\n'.join(lineas))
    print(f'{ruta}: {pid} actualizado')


if __name__ == '__main__':
    main(sys.argv[1:])
