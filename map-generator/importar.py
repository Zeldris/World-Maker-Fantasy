#!/usr/bin/env python3
"""MAP-1: importador de solo lectura del `.map` de Azgaar (FMG 1.137.6) al formato propio del mapa.

    python3 map-generator/importar.py [--map docs/map/Helek_World.map] [--salida map-generator/mundo]

Escribe en la salida:
- `helek.json`: la fuente del mapa desde ahora (celdas con altura, bioma, región, provincia y continente; vértices;
  regiones, provincias, continentes, rutas, ríos y lugares con nombre). Una entrada por línea y en orden fijo, para
  que el diff de git se lea.
- `helek.geojson`: costas de cada continente, regiones, provincias, rutas y lugares, en coordenadas del lienzo
  (1 unidad ≈ 1 km; la y crece hacia el sur, como en el SVG de Azgaar).
- `revisar.json`: lo que Azgaar generó solo y no entra en el mapa (los marcadores con nombres automáticos), para que
  la usuaria decida si algo pasa al lore.

Nunca escribe en el `.map` (ver `fmg/archivo.py`). Antes de escribir, comprueba que las celdas reconstruidas cuadran
con lo que guardó FMG (área de cada región y celdas de cada continente); si no, falla sin tocar nada.
"""
import argparse
import collections
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fmg import archivo as A  # noqa: E402
from fmg import grafo as G  # noqa: E402
import geometria  # noqa: E402

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
MAPA = os.path.join(RAIZ, 'docs', 'map', 'Helek_World.map')
SALIDA = os.path.join(RAIZ, 'map-generator', 'mundo')
FORMATO = 1

# Nombre de cada continente: Berig es el que tiene las cinco regiones; Vaelira, el del oeste
# (13-escala-del-mundo.md § 6: «Vaelira al oeste, Berig al este»).
REGION_DE_BERIG = 17  # Cristal Helado


class Descuadre(Exception):
    pass


def _texto(s):
    """Texto de Azgaar sin surrogates sueltos (algún nombre automático trae medio emoji)."""
    if s is None:
        return None
    return s.encode('utf-16', 'surrogatepass').decode('utf-16', 'replace')


def _r(v, d=2):
    return round(v, d)


def _continentes(celdas, features):
    """Asigna a cada celda de tierra su continente (feature de FMG) por inundación desde su `firstCell`."""
    n = len(celdas['p'])
    cont = [0] * n
    for f in features:
        if not f or not f.get('land'):
            continue
        pila = [f['firstCell']]
        cont[f['firstCell']] = f['i']
        while pila:
            i = pila.pop()
            for j in celdas['c'][i]:
                if not cont[j] and celdas['h'][j] >= 20:
                    cont[j] = f['i']
                    pila.append(j)
    return cont


def importar(ruta_mapa):
    d = A.leer(ruta_mapa)
    params = d[A.PARAMS].split('|')
    grid = A.js(d[A.GRID])
    celdas, vertices = G.regraph(grid, A.enteros(d[A.GRID_H]), A.enteros(d[A.GRID_T]), A.enteros(d[A.GRID_F]))
    n = len(celdas['p'])

    por_celda = {
        'bioma': A.enteros(d[A.C_BIOMA]),
        'region': A.enteros(d[A.C_ESTADO]),
        'provincia': A.enteros(d[A.C_PROVINCIA]),
        'rio': A.enteros(d[A.C_RIO]),
    }
    for clave, valores in por_celda.items():
        if len(valores) != n:
            raise Descuadre(f'{clave}: el .map guarda {len(valores)} celdas y se han reconstruido {n}')

    estados = [s for s in A.js(d[A.ESTADOS]) if s and s.get('i') and not s.get('removed')]
    area_reg = collections.Counter()
    for i in range(n):
        if celdas['h'][i] >= 20:
            area_reg[por_celda['region'][i]] += celdas['area'][i]
    for s in estados:
        if area_reg[s['i']] != s['area']:
            raise Descuadre(f"{s['name']}: FMG guardó {s['area']} km² y las celdas reconstruidas suman "
                            f"{area_reg[s['i']]}: el port de reGraph/Delaunator se ha separado del de FMG")

    features = A.js(d[A.FEATURES])
    cont = _continentes(celdas, features)
    cuenta = collections.Counter(cont)
    for f in features:
        if f and f.get('land') and cuenta[f['i']] != f['cells']:
            raise Descuadre(f"continente {f['i']}: FMG guardó {f['cells']} celdas y salen {cuenta[f['i']]}")

    burgs = [b for b in A.js(d[A.BURGS]) if b and not b.get('removed')]
    reg_berig = next(b['feature'] for b in burgs if b['state'] == REGION_DE_BERIG)
    nombres_cont = {}
    for f in features:
        if f and f.get('land'):
            nombres_cont[f['i']] = 'Berig' if f['i'] == reg_berig else 'Vaelira'
    if sorted(nombres_cont.values()) != ['Berig', 'Vaelira']:
        raise Descuadre(f'se esperaban dos continentes (Berig y Vaelira) y hay {nombres_cont}')

    colores, habitabilidad, nombres_bioma = (s.split(',') for s in d[A.BIOMAS].split('|'))
    biomas = [{'i': i, 'nombre': nombres_bioma[i], 'color': colores[i]} for i in range(len(nombres_bioma))]

    regiones = [{'i': s['i'], 'nombre': s['name'], 'color': s['color'],
                 'capital': s.get('capital') or None, 'areaFmg': s['area']} for s in estados]
    provincias = [{'i': p['i'], 'nombre': p['name'], 'region': p['state'], 'color': p['color'],
                   'centro': p['center'], 'areaFmg': p['area']}
                  for p in A.js(d[A.PROVINCIAS], [0]) if p and not p.get('removed')]
    continentes = [{'i': f['i'], 'nombre': nombres_cont[f['i']], 'celdas': f['cells'], 'areaFmg': f['area']}
                   for f in features if f and f.get('land')]
    lugares = [{'i': b['i'], 'nombre': b['name'], 'x': _r(b['x']), 'y': _r(b['y']), 'celda': b['cell'],
                'region': b['state'], 'tipo': b['type'], 'capital': bool(b.get('capital'))} for b in burgs]
    rutas = [{'i': r['i'], 'grupo': r['group'], 'continente': nombres_cont.get(r.get('feature')),
              'puntos': [[_r(p[0]), _r(p[1])] for p in r['points']]} for r in A.js(d[A.RUTAS], [])]
    rios = [{'i': r['i'], 'nombre': r.get('name'), 'celdas': r.get('cells')} for r in A.js(d[A.RIOS], [])]

    lista_vertices = [vertices[t] for t in range(len(vertices))]
    lista_celdas = []
    for i in range(n):
        lista_celdas.append({
            'i': i, 'p': [_r(celdas['p'][i][0], 1), _r(celdas['p'][i][1], 1)], 'v': celdas['v'][i],
            'c': celdas['c'][i], 'h': celdas['h'][i], 'bioma': por_celda['bioma'][i],
            'region': por_celda['region'][i], 'provincia': por_celda['provincia'][i], 'continente': cont[i],
        })

    mundo = {
        'formato': FORMATO,
        'fuente': {'archivo': 'docs/map/Helek_World.map', 'fmg': params[0], 'fecha': params[2],
                   'semilla': params[3], 'ancho': int(params[4]), 'alto': int(params[5]), 'kmPorUnidad': 1},
        'biomas': biomas,
        'continentes': continentes,
        'regiones': regiones,
        'provincias': provincias,
        'lugares': lugares,
        'rutas': rutas,
        'rios': rios,
        'vertices': lista_vertices,
        'celdas': lista_celdas,
    }

    notas = {x['id']: x for x in A.js(d[A.NOTAS], [])}
    revisar = {
        'nota': ('Generado por Azgaar y no importado: marcadores con nombre automático (en inglés). '
                 'Si alguno debe existir en el mundo, se crea como lugar con su nombre de lore.'),
        'burgsBorradosEnAzgaar': sum(1 for b in A.js(d[A.BURGS]) if b and b.get('removed')),
        'marcadores': [{'i': m['i'], 'tipo': m['type'], 'x': _r(m['x']), 'y': _r(m['y']), 'celda': m['cell'],
                        'nombre': _texto(notas.get(f"marker{m['i']}", {}).get('name')),
                        'leyenda': _texto(notas.get(f"marker{m['i']}", {}).get('legend'))}
                       for m in A.js(d[A.MARCADORES], [])],
    }
    return mundo, celdas, vertices, revisar


def geojson(mundo, celdas, vertices):
    feats = []
    por = collections.defaultdict(set)
    for c in mundo['celdas']:
        if c['h'] >= 20:
            por[('continente', c['continente'])].add(c['i'])
            if c['region']:
                por[('region', c['region'])].add(c['i'])
            if c['provincia']:
                por[('provincia', c['provincia'])].add(c['i'])
    for capa, lista in (('continente', mundo['continentes']), ('region', mundo['regiones']),
                        ('provincia', mundo['provincias'])):
        for x in lista:
            feats.append({'type': 'Feature', 'properties': {'capa': capa, 'i': x['i'], 'nombre': x['nombre']},
                          'geometry': {'type': 'MultiPolygon', 'coordinates': [
                              [anillo + [anillo[0]] for anillo in pol]
                              for pol in geometria.poligonos(celdas['v'], vertices, sorted(por[(capa, x['i'])]))]}})
    for r in mundo['rutas']:
        feats.append({'type': 'Feature', 'properties': {'capa': 'ruta', 'i': r['i'], 'grupo': r['grupo']},
                      'geometry': {'type': 'LineString', 'coordinates': r['puntos']}})
    for r in mundo['rios']:
        if r.get('puntos'):
            feats.append({'type': 'Feature', 'properties': {'capa': 'rio', 'i': r['i'], 'nombre': r.get('nombre')},
                          'geometry': {'type': 'LineString', 'coordinates': r['puntos']}})
    for lu in mundo['lugares']:
        feats.append({'type': 'Feature', 'properties': {'capa': 'lugar', 'i': lu['i'], 'nombre': lu['nombre'],
                                                        **({'slug': lu['slug']} if lu.get('slug') else {})},
                      'geometry': {'type': 'Point', 'coordinates': [lu['x'], lu['y']]}})
    return {'type': 'FeatureCollection', 'features': feats}


def volcar(datos):
    """JSON con orden fijo: listas de objetos, un elemento por línea (diff de git legible)."""
    lineas = ['{']
    claves = list(datos)
    for k, clave in enumerate(claves):
        valor = datos[clave]
        coma = ',' if k < len(claves) - 1 else ''
        if isinstance(valor, list) and valor:
            lineas.append(f'  {json.dumps(clave)}: [')
            for j, el in enumerate(valor):
                fin = ',' if j < len(valor) - 1 else ''
                lineas.append('    ' + json.dumps(el, ensure_ascii=False, separators=(',', ':')) + fin)
            lineas.append('  ]' + coma)
        else:
            lineas.append(f'  {json.dumps(clave)}: ' + json.dumps(valor, ensure_ascii=False,
                                                                    separators=(',', ':')) + coma)
    lineas.append('}')
    return '\n'.join(lineas) + '\n'


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--map', default=MAPA)
    ap.add_argument('--salida', default=SALIDA)
    ap.add_argument('--sobrescribir', action='store_true',
                    help='reimporta aunque helek.json tenga cambios del editor (MAP-6), que se pierden')
    args = ap.parse_args(argv)
    try:
        mundo, celdas, vertices, revisar = importar(args.map)
    except (A.ErrorDeMapa, Descuadre) as e:
        print(f'importar.py: {e}', file=sys.stderr)
        return 1
    destino = os.path.join(args.salida, 'helek.json')
    texto = volcar(mundo)
    if os.path.exists(destino) and not args.sobrescribir:
        with open(destino, encoding='utf-8') as f:
            if f.read() != texto:
                print(f'importar.py: {destino} no es lo que sale del .map: tiene cambios del editor (MAP-6) y '
                      'reimportar los borraría. Con --sobrescribir se pierden.', file=sys.stderr)
                return 1
    os.makedirs(args.salida, exist_ok=True)
    with open(destino, 'w', encoding='utf-8') as f:
        f.write(texto)
    geo = geojson(mundo, celdas, vertices)
    with open(os.path.join(args.salida, 'helek.geojson'), 'w', encoding='utf-8') as f:
        f.write(volcar({'type': geo['type'], 'features': geo['features']}))
    with open(os.path.join(args.salida, 'revisar.json'), 'w', encoding='utf-8') as f:
        f.write(volcar(revisar))
    print(f"importado: {len(mundo['celdas'])} celdas, {len(mundo['regiones'])} regiones, "
          f"{len(mundo['provincias'])} provincias, {len(mundo['lugares'])} lugares, {len(mundo['rutas'])} rutas, "
          f"{len(mundo['rios'])} ríos; {len(revisar['marcadores'])} marcadores a revisar")
    return 0


if __name__ == '__main__':
    sys.exit(main())
