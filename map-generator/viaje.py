#!/usr/bin/env python3
"""MAP-14: km y tiempos de viaje a pie de las rutas del mapa, con las reglas de `viaje.json`.

    python3 map-generator/viaje.py                # una línea por ruta (--grupo roads|trails|searoutes, --json)

Un camino o una senda se recorren a pie: km del trazo (1 unidad ≈ 1 km, las coordenadas ya están en km) × rodeo = km a
pie; horas = km a pie / velocidad; jornadas = horas / horas de jornada. El rodeo de la ruta es la media de sus tramos
ponderada por su longitud; el de un tramo es el de su bioma (`viaje.json`) o el de montaña (altura h >= 50) si es
mayor, mirando la celda del punto medio del tramo (si cae en mar, la de su punto más cercano que sea tierra; sin
tierra, 1). Una ruta marítima da solo km: el canon no fija velocidad por mar (tiempo null, con su motivo).
Las reglas las cambia solo la usuaria; lo derivado se marca en el propio `viaje.json`.
"""
import argparse
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import geometria  # noqa: E402
import medir  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
REGLAS = os.path.join(AQUI, 'viaje.json')
TIERRA = 20


class ReglasDeViaje(ValueError):
    """viaje.json no vale; el mensaje dice por qué."""


def cargar(ruta=REGLAS):
    with open(ruta, encoding='utf-8') as f:
        return json.load(f)


def _bioma_rodeo(mundo, reglas):
    """bioma i -> rodeo; falla si a un bioma de tierra de helek.json le falta regla."""
    por = reglas['rodeo']['porBioma']
    salida = {}
    for b in mundo['biomas']:
        if b['i'] == 0:  # Marine
            continue
        if b['nombre'] not in por:
            raise ReglasDeViaje(f"viaje.json no da rodeo para el bioma {b['nombre']}")
        salida[b['i']] = por[b['nombre']]
    return salida


def _rodeo_celda(c, por_bioma, montana):
    r = por_bioma.get(c['bioma'], 1.0)
    return max(r, montana['valor']) if c['h'] >= montana['alturaMinima'] else r


def tiempos(mundo, reglas=None):
    """Una fila por ruta: {i, grupo, km, rodeo, kmAPie, horas, jornadas, motivo}. En las rutas marítimas, rodeo, kmAPie,
    horas y jornadas son None y `motivo` dice por qué; en las demás, `motivo` es None."""
    reglas = reglas or cargar()
    por_bioma = _bioma_rodeo(mundo, reglas)
    montana = reglas['rodeo']['montana']
    v, jornada = reglas['velocidadKmH']['valor'], reglas['jornadaHoras']['valor']
    km_u = mundo['fuente']['kmPorUnidad']
    celda_en = geometria.localizador(mundo)
    celdas = mundo['celdas']
    salida = []
    for r in mundo['rutas']:
        pts = r['puntos']
        largos = [math.dist(a, b) * km_u for a, b in zip(pts, pts[1:])]
        km = sum(largos)
        fila = {'i': r['i'], 'grupo': r['grupo'], 'km': round(km, 1), 'rodeo': None, 'kmAPie': None, 'horas': None,
                'jornadas': None, 'motivo': reglas['mar']['nota'] if r['grupo'] == 'searoutes' else None}
        if r['grupo'] != 'searoutes':
            suma = 0.0
            for (a, b), largo in zip(zip(pts, pts[1:]), largos):
                medio = celdas[celda_en((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)]
                if medio['h'] < TIERRA:
                    cand = [celdas[celda_en(*p)] for p in (a, b)]
                    medio = next((c for c in cand if c['h'] >= TIERRA), None)
                suma += largo * (_rodeo_celda(medio, por_bioma, montana) if medio else 1.0)
            rodeo = suma / km if km else 1.0
            a_pie = km * rodeo
            horas = a_pie / v
            fila.update(rodeo=round(rodeo, 3), kmAPie=round(a_pie, 1), horas=round(horas, 1),
                        jornadas=round(horas / jornada, 1))
        salida.append(fila)
    return salida


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--mundo', default=medir.MUNDO)
    ap.add_argument('--grupo', choices=('roads', 'trails', 'searoutes'))
    ap.add_argument('--json', action='store_true')
    args = ap.parse_args(argv)
    filas = [f for f in tiempos(medir.cargar(args.mundo)) if not args.grupo or f['grupo'] == args.grupo]
    if args.json:
        print(json.dumps(filas, ensure_ascii=False))
        return 0
    for f in filas:
        t = (f"rodeo {f['rodeo']:.2f} · {f['kmAPie']:g} km a pie · {f['horas']:g} h · {f['jornadas']:g} jornadas"
             if f['horas'] is not None else 'sin tiempo (por mar)')
        print(f"{f['i']:>4} {f['grupo']:<9} {f['km']:>7g} km · {t}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
