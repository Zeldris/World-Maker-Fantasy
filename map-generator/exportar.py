#!/usr/bin/env python3
"""MAP-4: exporta del mapa propio lo que lee el juego.

    python3 map-generator/exportar.py               # escribe frontend/src/data/helekRegiones.ts y helekCapas.ts
    python3 map-generator/exportar.py --comprobar   # sale con 1 si alguno de los dos no es lo que sale de helek.json

Hoy: el contorno de cada región (`d` de SVG, en las coordenadas del lienzo de FMG y de la imagen de fondo) y su
envolvente. Los nombres que muestra el juego y la posición de las etiquetas son del juego y siguen en
`InteractiveMap.tsx`. El fondo sigue siendo la imagen exportada de Azgaar hasta `MAP-13`.
MAP-14: `helekCapas.ts` lleva las capas del juego: las zonas (tormenta, peligro, clan) con su contorno y las rutas con
km, km a pie, horas y jornadas (`viaje.py`, reglas de `viaje.json`).
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import medir  # noqa: E402
import viaje  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(os.path.dirname(AQUI), 'frontend', 'src', 'data', 'helekRegiones.ts')

NOMBRE_CAPAS = 'helekCapas.ts'


def ruta_capas(ruta_regiones=SALIDA):
    """Dónde va helekCapas.ts: junto al archivo de regiones (así una copia de prueba lleva los dos)."""
    return os.path.join(os.path.dirname(ruta_regiones), NOMBRE_CAPAS)


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


class RegionSinCeldas(ValueError):
    pass


def regiones(mundo):
    salida = []
    for r in mundo['regiones']:
        polis = medir.poligonos_de(mundo, {'region': r['nombre']})
        pts = [q for p in polis for q in p[0]]
        if not pts:
            raise RegionSinCeldas(f"la región {r['nombre']} se queda sin celdas: no se puede exportar (devuélvele alguna)")
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


def zonas(mundo):
    salida = []
    for z in mundo.get('zonas', []):
        salida.append({
            'i': z['i'], 'tipo': z['tipo'], 'nombre': z['nombre'], 'nivel': z['nivel'], 'clan': z.get('clan'),
            'canon': z['canon'], 'nota': z['nota'], 'd': _d(medir.poligonos_celdas(mundo, z['celdas'])),
        })
    return salida


def rutas(mundo):
    return [{'i': f['i'], 'grupo': f['grupo'], 'km': f['km'], 'kmAPie': f['kmAPie'], 'horas': f['horas'],
             'jornadas': f['jornadas']} for f in viaje.tiempos(mundo)]


def _filas(lista):
    if not lista:
        return '[]\n'
    return '[\n' + ',\n'.join('  ' + json.dumps(r, ensure_ascii=False) for r in lista) + ',\n]\n'


def generar_capas(mundo):
    reglas = viaje.cargar()
    v = {'velocidadKmH': reglas['velocidadKmH']['valor'], 'jornadaHoras': reglas['jornadaHoras']['valor']}
    return (
        '// Generado por map-generator/exportar.py desde map-generator/mundo/helek.json y map-generator/viaje.json (MAP-14). No se edita a mano:\n'
        '// se cambia el mapa y se vuelve a exportar (`python3 map-generator/exportar.py`).\n'
        '\n'
        'export interface ZonaHelek {\n'
        '  /// Índice de la zona en helek.json (`zonas`).\n'
        '  i: number\n'
        "  tipo: 'tormenta' | 'peligro' | 'clan'\n"
        '  nombre: string\n'
        '  /// Tormenta: intensidad máxima (0 Ghurmek, refugio; 1 Sek\'tar; 2 Rokthar; 3 Rok\'ithek). Peligro: 1 bajo, 2 medio, 3 alto. Clan: 0.\n'
        '  nivel: number\n'
        '  /// Nombre del clan (solo tipo clan).\n'
        '  clan: string | null\n'
        '  /// false = propuesta sin canon (la decide Álvaro).\n'
        '  canon: boolean\n'
        '  nota: string\n'
        '  /// Contorno en coordenadas del lienzo (800×600, 1 unidad ≈ 1 km), como el de las regiones.\n'
        '  d: string\n'
        '}\n'
        '\n'
        'export interface RutaHelek {\n'
        '  /// Índice de la ruta en helek.json (`rutas`).\n'
        '  i: number\n'
        "  grupo: 'roads' | 'trails' | 'searoutes'\n"
        '  /// Longitud del trazo en km.\n'
        '  km: number\n'
        '  /// km × rodeo del terreno (null por mar: el canon no fija velocidad por mar).\n'
        '  kmAPie: number | null\n'
        '  horas: number | null\n'
        '  jornadas: number | null\n'
        '}\n'
        '\n'
        '/// Reglas de viaje a pie (viaje.json): la jornada de 8 h es derivada, no canon literal.\n'
        'export const VIAJE_HELEK = ' + json.dumps(v) + '\n'
        '\n'
        'export const ZONAS_HELEK: ZonaHelek[] = ' + _filas(zonas(mundo)) +
        '\n'
        'export const RUTAS_HELEK: RutaHelek[] = ' + _filas(rutas(mundo))
    )


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--comprobar', action='store_true', help='no escribe: falla si el archivo está desfasado')
    args = ap.parse_args(argv)
    mundo = medir.cargar()
    archivos = [(SALIDA, generar(mundo)), (ruta_capas(), generar_capas(mundo))]
    if args.comprobar:
        mal = False
        for ruta, texto in archivos:
            rel = os.path.relpath(ruta, os.path.dirname(AQUI))
            actual = open(ruta, encoding='utf-8').read() if os.path.exists(ruta) else None
            if actual != texto:
                print(f'{rel} no es lo que sale de helek.json: python3 map-generator/exportar.py', file=sys.stderr)
                mal = True
            else:
                print(f'{rel} al día')
        return 1 if mal else 0
    for ruta, texto in archivos:
        with open(ruta, 'w', encoding='utf-8') as f:
            f.write(texto)
        print(f'escrito {os.path.relpath(ruta, os.path.dirname(AQUI))}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
