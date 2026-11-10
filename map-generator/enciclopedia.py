#!/usr/bin/env python3
"""MAP-8: los lugares de la enciclopedia del juego (slug, nombre, región y tipo), para enlazarlos desde el mapa.

    python3 map-generator/enciclopedia.py          # la lista, una línea por lugar (--json: en JSON)

Se leen de `export const locations` de `backend/src/scripts/worldCatalog.ts`, la misma lista que siembra la tabla
`Location` y que la enciclopedia del juego muestra por su slug. Solo se leen; el catálogo lo cambia el backend. Si el
formato del archivo cambia y no se reconoce un lugar, falla con su motivo en vez de devolver una lista a medias.
"""
import argparse
import json
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
CATALOGO = os.path.join(os.path.dirname(AQUI), 'backend', 'src', 'scripts', 'worldCatalog.ts')
INICIO = 'export const locations: LocationInput[] = ['
CAMPO = re.compile(r"""^ {4}(slug|name|region|kind): (['"])((?:\\.|(?!\2).)*)\2,\s*$""")


def _texto(s):
    return re.sub(r'\\(.)', r'\1', s)


def lugares(ruta=CATALOGO):
    """[{slug, nombre, region, tipo}] en el orden del catálogo."""
    with open(ruta, encoding='utf-8') as f:
        lineas = f.read().split('\n')
    try:
        k = lineas.index(INICIO)
    except ValueError:
        raise ValueError(f'{ruta}: no está «{INICIO}»') from None
    salida, actual = [], None
    for n, linea in enumerate(lineas[k + 1:], k + 2):
        if linea == '];':
            break
        if linea == '  {':
            actual = {}
        elif linea in ('  },', '  }'):
            if actual is None or set(actual) != {'slug', 'name', 'region', 'kind'}:
                raise ValueError(f'{ruta}:{n}: lugar sin slug, name, region o kind en una línea propia: {actual!r}')
            salida.append({'slug': actual['slug'], 'nombre': actual['name'], 'region': actual['region'],
                           'tipo': actual['kind']})
            actual = None
        elif actual is not None:
            m = CAMPO.match(linea)
            if m and m.group(1) not in actual:
                actual[m.group(1)] = _texto(m.group(3))
    else:
        raise ValueError(f'{ruta}: la lista de lugares no se cierra con «];»')
    return salida


def main(argv=None):
    ap = argparse.ArgumentParser(description='Los lugares de la enciclopedia (worldCatalog.ts) que se pueden enlazar.')
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--catalogo', default=CATALOGO)
    args = ap.parse_args(argv)
    lista = lugares(args.catalogo)
    if args.json:
        print(json.dumps(lista, ensure_ascii=False))
    else:
        for e in lista:
            print(f"{e['slug']}\t{e['nombre']}\t{e['region']}\t{e['tipo']}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
