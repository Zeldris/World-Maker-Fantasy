#!/usr/bin/env python3
"""MAP-2: medidas del mapa propio (área, envolvente, distancias) y su comparación con el canon.

    python3 map-generator/medir.py            # tabla de medidas y comparación con canon.json
    python3 map-generator/medir.py --json     # las medidas en JSON

Sale con 1 si alguna medida se sale de la tolerancia de `canon.json`: lo que mueva el canon lo decide la usuaria.
Las entradas de `sinDecidir` se muestran, pero no hacen fallar.
"""
import argparse
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import geometria  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
MUNDO = os.path.join(AQUI, 'mundo', 'helek.json')
CANON = os.path.join(AQUI, 'canon.json')


def cargar(ruta=MUNDO):
    with open(ruta, encoding='utf-8') as f:
        return json.load(f)


def _poligonos(mundo, filtro):
    v_por_celda = [c['v'] for c in mundo['celdas']]
    miembros = [c['i'] for c in mundo['celdas'] if c['h'] >= 20 and filtro(c)]
    return geometria.poligonos(v_por_celda, mundo['vertices'], miembros)


def poligonos_de(mundo, entrada):
    if 'region' in entrada:
        i = next(r['i'] for r in mundo['regiones'] if r['nombre'] == entrada['region'])
        return _poligonos(mundo, lambda c: c['region'] == i)
    if 'continente' in entrada:
        i = next(r['i'] for r in mundo['continentes'] if r['nombre'] == entrada['continente'])
        return _poligonos(mundo, lambda c: c['continente'] == i)
    raise ValueError(f'no sé de qué medir: {entrada}')


def distancia(mundo, a, b):
    lugares = {lu['nombre']: lu for lu in mundo['lugares']}
    pa, pb = lugares[a], lugares[b]
    return math.dist((pa['x'], pa['y']), (pb['x'], pb['y'])) * mundo['fuente']['kmPorUnidad']


def medir(mundo, entrada):
    if entrada['que'] == 'distancia':
        return distancia(mundo, *entrada['lugares'])
    polis = poligonos_de(mundo, entrada)
    if entrada['que'] == 'area':
        return geometria.area(polis)
    if entrada['que'] == 'envolvente':
        return list(geometria.envolvente(polis))
    raise ValueError(f"medida desconocida: {entrada['que']}")


def _dentro(medido, entrada, tol):
    if 'rango' in entrada:
        lo, hi = entrada['rango']
        return lo * (1 - tol) <= medido <= hi * (1 + tol)
    esperado = entrada['valor']
    if isinstance(esperado, list):
        return all(abs(m - e) <= e * tol for m, e in zip(medido, esperado))
    return abs(medido - esperado) <= esperado * tol


def comprobar(mundo, canon):
    """Lista de (entrada, medido, dentro) para cada medida del canon."""
    tol = canon['tolerancia']
    return [(e, medir(mundo, e), _dentro(medir(mundo, e), e, tol)) for e in canon['medidas']]


def _medida(mundo, filtro):
    polis = _poligonos(mundo, filtro)
    pts = [q for p in polis for q in p[0]]
    caja = [min(q[0] for q in pts), min(q[1] for q in pts), max(q[0] for q in pts), max(q[1] for q in pts)] \
        if pts else None
    km = mundo['fuente']['kmPorUnidad']
    ancho, alto = geometria.envolvente(polis)
    return {'area': geometria.area(polis) * km * km, 'envolvente': [ancho * km, alto * km], 'caja': caja}


def medidas(mundo, canon):
    """Lo que el visor muestra al pasar el ratón, por id, y el canon con lo medido."""
    def por(clave, lista):
        return {str(e['i']): _medida(mundo, lambda c, i=e['i']: c[clave] == i) for e in lista}
    return {
        'regiones': por('region', mundo['regiones']),
        'provincias': por('provincia', mundo['provincias']),
        'continentes': por('continente', mundo['continentes']),
        'canon': [{**e, 'medido': m, 'dentro': ok} for e, m, ok in comprobar(mundo, canon)],
    }


def _sujeto(e):
    return e.get('region') or e.get('continente') or ' ↔ '.join(e['lugares'])


def _fmt(v):
    if isinstance(v, list):
        return ' × '.join(f'{x:.0f}' for x in v)
    return f'{v:,.0f}'.replace(',', '.')


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--mundo', default=MUNDO)
    ap.add_argument('--canon', default=CANON)
    ap.add_argument('--json', action='store_true')
    args = ap.parse_args(argv)
    mundo = cargar(args.mundo)
    with open(args.canon, encoding='utf-8') as f:
        canon = json.load(f)
    resultado = comprobar(mundo, canon)
    if args.json:
        print(json.dumps([{**e, 'medido': m, 'dentro': ok} for e, m, ok in resultado], ensure_ascii=False))
        return 0 if all(ok for _, _, ok in resultado) else 1
    for e, m, ok in resultado:
        esperado = _fmt(e['valor']) if 'valor' in e else '–'.join(_fmt(x) for x in e['rango'])
        print(f"{'ok ' if ok else 'MAL'} {e['que']:<10} {_sujeto(e):<62} {_fmt(m):>12}  canon {esperado}")
    for e in canon.get('sinDecidir', []):
        medida = ''
        if e['que'] in ('area', 'envolvente'):
            medida = _fmt(medir(mundo, e))
        print(f"?   {e['que']:<10} {_sujeto(e):<62} {medida:>12}  sin decidir: {e['nota']}")
    fuera = [e for e, _, ok in resultado if not ok]
    if fuera:
        print(f"\n{len(fuera)} medida(s) fuera de ±{canon['tolerancia']:.0%} del canon: lo decide la usuaria.",
              file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
