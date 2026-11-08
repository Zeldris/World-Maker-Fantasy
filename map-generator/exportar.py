#!/usr/bin/env python3
"""MAP-4: exporta del mapa propio lo que lee el juego.

    python3 map-generator/exportar.py               # escribe frontend/src/data/helekRegiones.ts
    python3 map-generator/exportar.py --comprobar   # sale con 1 si ese archivo no es lo que sale de helek.json

Hoy: el contorno de cada región (`d` de SVG, en las coordenadas del lienzo de FMG y de la imagen de fondo) y su
envolvente. Los nombres que muestra el juego y la posición de las etiquetas son del juego y siguen en
`InteractiveMap.tsx`. El fondo sigue siendo la imagen exportada de Azgaar hasta `MAP-13`.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import medir  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(os.path.dirname(AQUI), 'frontend', 'src', 'data', 'helekRegiones.ts')


def _num(v):
    return str(int(v)) if float(v).is_integer() else repr(round(v, 2))


def _d(polis):
    partes = []
    for pol in polis:
        for anillo in pol:
            pts = ' '.join(f'{_num(x)},{_num(y)}' for x, y in anillo)
            primero, resto = pts.split(' ', 1)
            partes.append(f'M{primero} L{resto} Z')
    return ' '.join(partes)


def regiones(mundo):
    salida = []
    for r in mundo['regiones']:
        polis = medir.poligonos_de(mundo, {'region': r['nombre']})
        pts = [q for p in polis for q in p[0]]
        xs, ys = [q[0] for q in pts], [q[1] for q in pts]
        salida.append({
            'id': r['i'],
            'nombre': r['nombre'],
            'd': _d(polis),
            'bbox': {'x0': min(xs), 'y0': min(ys), 'x1': max(xs), 'y1': max(ys)},
        })
    return salida


def generar(mundo):
    filas = ',\n'.join('  ' + json.dumps(r, ensure_ascii=False) for r in regiones(mundo))
    return (
        '// Generado por map-generator/exportar.py desde map-generator/mundo/helek.json (MAP-4). No se edita a mano:\n'
        '// se cambia el mapa y se vuelve a exportar (`python3 map-generator/exportar.py`).\n'
        '\n'
        'export interface RegionHelek {\n'
        '  /// Índice de la región en helek.json (el `state<id>` del .map de Azgaar).\n'
        '  id: number\n'
        '  nombre: string\n'
        '  /// Contorno en coordenadas del lienzo (800×600, 1 unidad ≈ 1 km), las mismas que la imagen de fondo.\n'
        '  d: string\n'
        '  bbox: { x0: number; y0: number; x1: number; y1: number }\n'
        '}\n'
        '\n'
        'export const REGIONES_HELEK: RegionHelek[] = [\n'
        f'{filas},\n'
        ']\n'
    )


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--comprobar', action='store_true', help='no escribe: falla si el archivo está desfasado')
    args = ap.parse_args(argv)
    texto = generar(medir.cargar())
    rel = os.path.relpath(SALIDA, os.path.dirname(AQUI))
    if args.comprobar:
        actual = open(SALIDA, encoding='utf-8').read() if os.path.exists(SALIDA) else None
        if actual != texto:
            print(f'{rel} no es lo que sale de helek.json: python3 map-generator/exportar.py', file=sys.stderr)
            return 1
        print(f'{rel} al día')
        return 0
    with open(SALIDA, 'w', encoding='utf-8') as f:
        f.write(texto)
    print(f'escrito {rel}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
