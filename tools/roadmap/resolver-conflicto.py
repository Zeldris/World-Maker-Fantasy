#!/usr/bin/env python3
"""QA-343: resuelve los trozos SEGUROS de un conflicto de git en los roadmaps y deja el resto con sus marcadores.

Uso: python3 tools/roadmap/resolver-conflicto.py [<archivo>...]
Sin argumentos: los archivos en conflicto (`git diff --name-only --diff-filter=U`) de docs/producto/ y
docs/records/fallos-herramientas.md.

Trozos seguros (cada lado del conflicto es una lista de líneas):
  a) mismas líneas salvo marcas de cierre (`~~` y lo que va desde ` ✅`): gana por línea la más «cerrada»;
  b) filas añadidas por cada lado (lista o tabla): unión en orden, las de HEAD primero.
Una línea cambiada de verdad en los dos lados, o un conflicto en estilo diff3 (`|||||||`), no es seguro.
Salida: «N resueltos, M quedan» por archivo y la línea de cada uno que queda; código 1 si queda alguno.
"""
import difflib
import re
import subprocess
import sys

FILA = re.compile(r'^\s*(\||[-*+] |\d+[.)] )')


def norm(linea: str) -> str:
    """Sin `~~` ni marcas de cierre. En una línea de lista, el cierre (` ✅` y lo que sigue) se corta entero; en una
    fila de tabla solo se quita ` ✅` con su fecha, porque tras él sigue el resto de la celda y de la fila."""
    s = linea.replace('~~', '')
    if s.lstrip().startswith('|'):
        return re.sub(r' ✅(?: \d{4}-\d{2}-\d{2})?', '', s).strip()
    return s.split(' ✅')[0].strip()


def cerrada(linea: str) -> bool:
    return '✅' in linea or '~~' in linea


def elegir(ours: str, theirs: str) -> str:
    """Equivalentes según norm(): gana la más cerrada; con las dos cerradas, la más larga."""
    if cerrada(ours) != cerrada(theirs):
        return ours if cerrada(ours) else theirs
    return theirs if len(theirs) > len(ours) else ours


def resolver_trozo(ours: list, theirs: list):
    """Devuelve la lista de líneas resultante o None si el trozo no es seguro."""
    ko, kt = [norm(x) for x in ours], [norm(x) for x in theirs]
    resultado = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, ko, kt, autojunk=False).get_opcodes():
        a, b = ours[i1:i2], theirs[j1:j2]
        if op == 'equal':
            resultado += [elegir(x, y) for x, y in zip(a, b)]
        elif op in ('delete', 'insert'):
            resultado += a + b
        else:  # replace: solo si son filas distintas añadidas por cada lado, no una misma fila cambiada
            if not all(FILA.match(x) for x in a + b):
                return None
            for x in a:
                for y in b:
                    if difflib.SequenceMatcher(None, norm(x), norm(y)).ratio() >= 0.6:
                        return None
            resultado += a + b
    return resultado


def resolver_texto(texto: str):
    """Devuelve (texto nuevo, resueltos, [líneas (1-based) de los trozos que quedan])."""
    lineas = texto.split('\n')
    salida, quedan, resueltos = [], [], 0
    i = 0
    while i < len(lineas):
        if not lineas[i].startswith('<<<<<<< '):
            salida.append(lineas[i])
            i += 1
            continue
        ini, ours, theirs, lado, diff3, j = i, [], [], 0, False, i + 1
        while j < len(lineas) and not lineas[j].startswith('>>>>>>> '):
            if lineas[j].startswith('|||||||'):
                diff3, lado = True, 2
            elif lineas[j] == '=======':
                lado = 1
            elif lado == 0:
                ours.append(lineas[j])
            elif lado == 1:
                theirs.append(lineas[j])
            j += 1
        if j >= len(lineas):  # marcador sin cerrar: se deja tal cual
            quedan.append(ini + 1)
            salida += lineas[ini:]
            break
        nuevo = None if diff3 else resolver_trozo(ours, theirs)
        if nuevo is None:
            quedan.append(ini + 1)
            salida += lineas[ini:j + 1]
        else:
            resueltos += 1
            salida += nuevo
        i = j + 1
    return '\n'.join(salida), resueltos, quedan


def archivos_en_conflicto() -> list:
    r = subprocess.run(['git', 'diff', '--name-only', '--diff-filter=U'], capture_output=True, text=True)
    return [f for f in r.stdout.split()
            if f.startswith('docs/producto/') or f == 'docs/records/fallos-herramientas.md']


def main(argv: list) -> int:
    archivos = argv or archivos_en_conflicto()
    pendiente = False
    for ruta in archivos:
        with open(ruta, encoding='utf-8') as f:
            texto = f.read()
        nuevo, resueltos, quedan = resolver_texto(texto)
        if resueltos:
            with open(ruta, 'w', encoding='utf-8') as f:
                f.write(nuevo)
        print(f'{ruta}: {resueltos} resueltos, {len(quedan)} quedan')
        for n in quedan:
            print(f'  conflicto en la línea {n}')
        pendiente = pendiente or bool(quedan)
    return 1 if pendiente else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
