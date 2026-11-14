#!/usr/bin/env python3
"""QA-343: resuelve los trozos SEGUROS de un conflicto de git en los roadmaps y deja el resto con sus marcadores.

Uso: python3 tools/roadmap/resolver-conflicto.py [<archivo>...]
Sin argumentos: los archivos en conflicto (`git diff --name-only --diff-filter=U`) de docs/producto/ y
docs/records/fallos-herramientas.md. Hace falta la base: el bloque `|||||||` (diff3) o las etapas 1-3 del índice;
sin base no se resuelve nada.

Trozos seguros (cada lado, comparado con la base; las filas se emparejan por id de tarea):
  a) una línea que un lado cambia solo en marcas de cierre (`~~` y lo que va desde ` ✅`): gana la «cerrada»;
  b) filas (lista o tabla) añadidas por un lado: unión en orden, las de HEAD primero.
Un borrado, un reorden, prosa o encabezados cambiados, una misma fila cambiada de verdad o con notas distintas
tras el ✅, no es seguro y queda marcado.
Salida: «N resueltos, M quedan» por archivo y la línea de cada uno que queda; código 1 si queda alguno.
"""
import os
import re
import subprocess
import sys
import tempfile

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


ID = re.compile(r'\b[A-Z]{2,5}-\d+\b')


def nota(linea: str):
    """Lo que va tras ` ✅` en una línea que no es tabla (None si no hay)."""
    if linea.lstrip().startswith('|') or ' ✅' not in linea:
        return None
    return linea.split(' ✅', 1)[1].strip() or None


def clave(linea: str) -> str:
    """Una fila se identifica por su id de tarea; sin id, por su texto normalizado."""
    m = ID.search(linea)
    return m.group(0) if m else norm(linea)


def indexar(lineas: list):
    """Lista de (clave, n-ésima aparición) -> línea, en orden."""
    cuenta, orden, mapa = {}, [], {}
    for x in lineas:
        k = clave(x)
        cuenta[k] = cuenta.get(k, 0) + 1
        kk = (k, cuenta[k])
        orden.append(kk)
        mapa[kk] = x
    return orden, mapa


def fusionar(o: str, t: str, b):
    """Versión de una misma fila (misma clave) en los dos lados, o None si no es seguro."""
    if o == t:
        return o
    if b is not None and o == b and norm(t) == norm(b):
        return t
    if b is not None and t == b and norm(o) == norm(b):
        return o
    if norm(o) != norm(t):
        return None
    no, nt = nota(o), nota(t)
    if no and nt and no != nt:
        return None
    return elegir(o, t)


def resolver_trozo(ours: list, theirs: list, base=None):
    """Devuelve la lista de líneas resultante o None si el trozo no es seguro. Sin base, nunca es seguro."""
    if base is None:
        return None
    oo, mo = indexar(ours)
    ot, mt = indexar(theirs)
    ob, mb = indexar(base)
    comunes = [k for k in oo if k in mt]
    if comunes != [k for k in ot if k in mo]:
        return None  # reordenado
    for k in oo:
        if k not in mt and (k in mb or not FILA.match(mo[k])):
            return None  # borrado por el otro lado, o añadida que no es fila
    for k in ot:
        if k not in mo and (k in mb or not FILA.match(mt[k])):
            return None
    resultado = []
    io = it = 0
    for c in comunes + [None]:
        while io < len(oo) and oo[io] != c:
            resultado.append(mo[oo[io]])
            io += 1
        while it < len(ot) and ot[it] != c:
            resultado.append(mt[ot[it]])
            it += 1
        if c is None:
            break
        fila = fusionar(mo[c], mt[c], mb.get(c))
        if fila is None:
            return None
        resultado.append(fila)
        io += 1
        it += 1
    return resultado


def resolver_texto(texto: str):
    """Devuelve (texto nuevo, resueltos, [líneas (1-based) del texto nuevo de los trozos que quedan]).
    Solo se resuelven conflictos en estilo diff3 (con su base)."""
    lineas = texto.split('\n')
    salida, quedan, resueltos = [], [], 0
    i = 0
    while i < len(lineas):
        if not lineas[i].startswith('<<<<<<< '):
            salida.append(lineas[i])
            i += 1
            continue
        ini, ours, theirs, base, lado, diff3, j = i, [], [], [], 0, False, i + 1
        while j < len(lineas) and not lineas[j].startswith('>>>>>>> '):
            if lineas[j].startswith('|||||||'):
                diff3, lado = True, 2
            elif lineas[j] == '=======':
                lado = 1
            elif lado == 0:
                ours.append(lineas[j])
            elif lado == 1:
                theirs.append(lineas[j])
            else:
                base.append(lineas[j])
            j += 1
        if j >= len(lineas):  # marcador sin cerrar: se deja tal cual
            quedan.append(len(salida) + 1)
            salida += lineas[ini:]
            break
        nuevo = resolver_trozo(ours, theirs, base if diff3 else None)
        if nuevo is None:
            quedan.append(len(salida) + 1)
            salida += lineas[ini:j + 1]
        else:
            resueltos += 1
            salida += nuevo
        i = j + 1
    return '\n'.join(salida), resueltos, quedan


def raiz_repo() -> str:
    r = subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError('git rev-parse --show-toplevel falló: ' + r.stderr.strip())
    return r.stdout.strip()


def archivos_en_conflicto() -> list:
    """Rutas absolutas de los archivos en conflicto de docs/producto/ y fallos-herramientas.md."""
    raiz = raiz_repo()
    r = subprocess.run(['git', 'diff', '--name-only', '--diff-filter=U', '-z'], cwd=raiz, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError('git diff falló: ' + r.stderr.strip())
    return [os.path.join(raiz, f) for f in r.stdout.split('\0')
            if f.startswith('docs/producto/') or f == 'docs/records/fallos-herramientas.md']


def sin_etiquetas(texto: str) -> str:
    """El texto con los marcadores sin su etiqueta (`<<<<<<< HEAD` -> `<<<<<<<`), para comparar."""
    return re.sub(r'^(<{7}|>{7}) .*$', r'\1', texto, flags=re.M)


def con_base(ruta: str, texto: str) -> str:
    """Si el conflicto no trae base (`|||||||`), la rehace en estilo diff3 con las etapas 1, 2 y 3 del índice.
    Sin etapas, sin git o con el archivo ya tocado a mano, devuelve el texto tal cual (nada se resolverá)."""
    if '|||||||' in texto or '<<<<<<< ' not in texto:
        return texto
    try:
        raiz = raiz_repo()
        rel = os.path.relpath(os.path.abspath(ruta), raiz)
        with tempfile.TemporaryDirectory() as d:
            rutas = []
            for etapa in '213':
                r = subprocess.run(['git', 'show', f':{etapa}:{rel}'], cwd=raiz, capture_output=True, text=True)
                if r.returncode != 0:
                    return texto
                rutas.append(os.path.join(d, etapa))
                with open(rutas[-1], 'w', encoding='utf-8') as f:
                    f.write(r.stdout)
            sin = subprocess.run(['git', 'merge-file', '-p', '-L', 'HEAD', '-L', 'base', '-L', 'origin/main', *rutas],
                                 capture_output=True, text=True)
            if sin_etiquetas(sin.stdout) != sin_etiquetas(texto):
                return texto  # ya tocado a mano: rehacerlo perdería esas resoluciones
            m = subprocess.run(['git', 'merge-file', '-p', '--diff3', '-L', 'HEAD', '-L', 'base', '-L', 'origin/main', *rutas],
                               capture_output=True, text=True)
            return m.stdout if m.returncode > 0 else texto
    except (RuntimeError, OSError):
        return texto


def main(argv: list) -> int:
    try:
        archivos = argv or archivos_en_conflicto()
    except (RuntimeError, OSError) as e:
        print(f'error: {e}', file=sys.stderr)
        return 2
    pendiente = False
    for ruta in archivos:
        with open(ruta, encoding='utf-8') as f:
            texto = f.read()
        nuevo, resueltos, quedan = resolver_texto(con_base(ruta, texto))
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
