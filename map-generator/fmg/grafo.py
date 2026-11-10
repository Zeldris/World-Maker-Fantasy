"""Reconstrucción de las celdas de FMG: `calculateVoronoi` (src/utils/graphUtils.ts), la clase `Voronoi`
(src/generators/voronoi.ts) y `reGraph` (public/main.js) de FMG 1.137.6, portados tal cual.

El `.map` no guarda la forma de las celdas «pack» (las del mapa político): solo la rejilla y sus alturas. FMG las
rehace al cargar, y los arrays por celda del `.map` (bioma, estado, provincia…) siguen ese orden. Si este port se
separa del original, los índices dejan de cuadrar: el test del importador lo detecta comparando el área de cada
estado con la que guardó FMG.
"""
import math

from .delaunator import Delaunator


def _siguiente(e):
    return e - 2 if e % 3 == 2 else e + 1


def _circuncentro(a, b, c):
    ax, ay = a
    bx, by = b
    cx, cy = c
    ad = ax * ax + ay * ay
    bd = bx * bx + by * by
    cd = cx * cx + cy * cy
    d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    return [math.floor((1 / d) * (ad * (by - cy) + bd * (cy - ay) + cd * (ay - by))),
            math.floor((1 / d) * (ad * (cx - bx) + bd * (ax - cx) + cd * (bx - ax)))]


def voronoi(puntos, frontera):
    """Celdas (v: vértices, c: vecinas, b: toca el borde) y vértices (p: coordenadas), como en FMG."""
    todos = list(puntos) + list(frontera)
    n = len(puntos)
    dl = Delaunator(todos)
    tri, half = dl.triangles, dl.halfedges
    celdas_v = [None] * n
    celdas_c = [None] * n
    celdas_b = [0] * n
    vertices = {}
    for e in range(len(tri)):
        p = tri[_siguiente(e)]
        if p < n and celdas_c[p] is None:
            aristas = []
            entrante = e
            while True:
                aristas.append(entrante)
                entrante = half[_siguiente(entrante)]
                if entrante == -1 or entrante == e or len(aristas) >= 20:
                    break
            celdas_v[p] = [a // 3 for a in aristas]
            celdas_c[p] = [tri[a] for a in aristas if tri[a] < n]
            celdas_b[p] = 1 if len(aristas) > len(celdas_c[p]) else 0
        t = e // 3
        if t not in vertices:
            vertices[t] = _circuncentro(todos[tri[3 * t]], todos[tri[3 * t + 1]], todos[tri[3 * t + 2]])
    return {'v': celdas_v, 'c': celdas_c, 'b': celdas_b}, vertices


def _rn(v, d=0):
    # Math.round de JS (redondea .5 hacia +∞), no el redondeo bancario de Python.
    m = 10 ** d
    return math.floor(v * m + 0.5) / m


def area_poligono(puntos):
    """d3.polygonArea: área con signo por la fórmula de Gauss (shoelace)."""
    a = 0.0
    n = len(puntos)
    for i in range(n):
        x0, y0 = puntos[i - 1]
        x1, y1 = puntos[i]
        a += y0 * x1 - x0 * y1
    return a / 2


def regraph(grid, alturas, tipos, f_grid):
    """Puntos de las celdas pack desde la rejilla, en el mismo orden que FMG (`reGraph`)."""
    celdas_grid, _ = voronoi(grid['points'], grid['boundary'])
    puntos = grid['points']
    espaciado2 = grid['spacing'] ** 2
    nuevos_p, nuevos_g, nuevos_h = [], [], []
    for i in range(len(puntos)):
        h = alturas[i]
        t = tipos[i]
        if h < 20 and t != -1 and t != -2:
            continue
        if t == -2 and (i % 4 == 0 or grid['features'][f_grid[i]]['type'] == 'lake'):
            continue
        x, y = puntos[i]
        nuevos_p.append([x, y])
        nuevos_g.append(i)
        nuevos_h.append(h)
        if t == 1 or t == -1:
            if celdas_grid['b'][i]:
                continue
            for e in celdas_grid['c'][i]:
                if i > e:
                    continue
                if tipos[e] == t:
                    d2 = (y - puntos[e][1]) ** 2 + (x - puntos[e][0]) ** 2
                    if d2 < espaciado2:
                        continue
                    nuevos_p.append([_rn((x + puntos[e][0]) / 2, 1), _rn((y + puntos[e][1]) / 2, 1)])
                    nuevos_g.append(i)
                    nuevos_h.append(h)
    celdas, vertices = voronoi(nuevos_p, grid['boundary'])
    celdas['p'] = nuevos_p
    celdas['g'] = nuevos_g
    celdas['h'] = nuevos_h
    # Uint16Array en FMG: el área se trunca a entero.
    celdas['area'] = [int(min(abs(area_poligono([vertices[v] for v in vs])), 65535)) for vs in celdas['v']]
    return celdas, vertices
