#!/usr/bin/env python3
"""MAP-3: reglas del lore que el mapa propio tiene que cumplir (orden, fronteras, corredor, continentes).

    python3 map-generator/comprobar.py          # cada regla de lore.json sobre mundo/helek.json
    python3 map-generator/comprobar.py --json   # el resultado en JSON

Sale con 1 si alguna regla falla: lo que mueva el lore lo decide la usuaria. Las de `sinDecidir` se muestran con
`?` y no hacen fallar. Un `tipo` desconocido es un error (ValueError), nunca un fallo silencioso.
"""
import argparse
import heapq
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

AQUI = os.path.dirname(os.path.abspath(__file__))
MUNDO = os.path.join(AQUI, 'mundo', 'helek.json')
LORE = os.path.join(AQUI, 'lore.json')
TIERRA = 20  # h >= 20 es tierra, h < 20 es mar


def cargar(ruta=MUNDO):
    with open(ruta, encoding='utf-8') as f:
        return json.load(f)


def _tierra(c):
    return c['h'] >= TIERRA


def _indice(mundo, tabla, nombre):
    for e in mundo[tabla]:
        if e['nombre'] == nombre:
            return e['i']
    raise ValueError(f"{tabla}: no existe «{nombre}»")


def _celdas_de(mundo, ref):
    """Celdas de tierra de una región (nombre) o de un continente (`{"continente": nombre}`)."""
    if isinstance(ref, dict):
        i = _indice(mundo, 'continentes', ref['continente'])
        return [c for c in mundo['celdas'] if _tierra(c) and c['continente'] == i]
    i = _indice(mundo, 'regiones', ref)
    return [c for c in mundo['celdas'] if _tierra(c) and c['region'] == i]


def _centro(celdas):
    if not celdas:
        raise ValueError('grupo sin celdas de tierra')
    return (sum(c['p'][0] for c in celdas) / len(celdas), sum(c['p'][1] for c in celdas) / len(celdas))


def _tiene_mar(mundo, c):
    return any(not _tierra(mundo['celdas'][j]) for j in c['c'])


def _orden(mundo, r):
    if r.get('eje') != 'norte-sur':
        raise ValueError(f"orden: eje desconocido {r.get('eje')}")
    ys = [sum(_centro(_celdas_de(mundo, n))[1] for n in g) / len(g) for g in r['grupos']]
    return all(a < b for a, b in zip(ys, ys[1:])), 'y de los centros: ' + ' < '.join(f'{y:.0f}' for y in ys)


def _oeste_de(mundo, r):
    xa, xb = _centro(_celdas_de(mundo, r['a']))[0], _centro(_celdas_de(mundo, r['b']))[0]
    return xa < xb, f'x del centro: {xa:.0f} y {xb:.0f}'


def _frontera(mundo, r):
    ia, ib = _indice(mundo, 'regiones', r['a']), _indice(mundo, 'regiones', r['b'])
    celdas = mundo['celdas']
    puntos = set()
    for c in celdas:
        if _tierra(c) and c['region'] == ia:
            vecinas = [j for j in c['c'] if _tierra(celdas[j]) and celdas[j]['region'] == ib]
            if vecinas:
                puntos.add(c['i'])
                puntos.update(vecinas)
    if not puntos:
        return False, 'las regiones no lindan'
    xs = [celdas[i]['p'][0] for i in puntos]
    ys = [celdas[i]['p'][1] for i in puntos]
    ex, ey = max(xs) - min(xs), max(ys) - min(ys)
    if r['orientacion'] == 'norte-sur':
        ok = ey > ex
    elif r['orientacion'] == 'este-oeste':
        ok = ex > ey
    else:
        raise ValueError(f"frontera: orientación desconocida {r['orientacion']}")
    return ok, f'extensión N-S {ey:.0f} km, E-O {ex:.0f} km'


def _costa_a_costa(mundo, r):
    celdas = _celdas_de(mundo, r['region'])
    xs = [c['p'][0] for c in celdas]
    x0, x1 = min(xs), max(xs)
    centro = _centro(celdas)[0]
    costeras = [c['p'][0] for c in celdas if _tiene_mar(mundo, c)]
    if not costeras:
        return False, 'sin celdas costeras'
    oeste, este = min(costeras), max(costeras)
    umbral = 0.15 * (x1 - x0)
    ok = oeste < centro < este and oeste <= x0 + umbral and este >= x1 - umbral
    return ok, f'costa de x {oeste:.0f} a {este:.0f} (región {x0:.0f}-{x1:.0f}, centro {centro:.0f})'


def _solo_linda(mundo, r):
    i = _indice(mundo, 'regiones', r['region'])
    permitidas = {_indice(mundo, 'regiones', n) for n in r['con']}
    celdas = mundo['celdas']
    otras = {celdas[j]['region'] for c in celdas if _tierra(c) and c['region'] == i
             for j in c['c'] if _tierra(celdas[j]) and celdas[j]['region'] not in (0, i)}
    sobran = sorted(otras - permitidas)
    nombres = {e['i']: e['nombre'] for e in mundo['regiones']}
    return not sobran, ('linda solo con lo permitido' if not sobran
                        else 'sobran: ' + ', '.join(nombres.get(s, str(s)) for s in sobran))


def _lindan(mundo, r):
    ia, ib = _indice(mundo, 'regiones', r['a']), _indice(mundo, 'regiones', r['b'])
    celdas = mundo['celdas']
    n = sum(1 for c in celdas if _tierra(c) and c['region'] == ia
            for j in c['c'] if _tierra(celdas[j]) and celdas[j]['region'] == ib)
    return n > 0, f'{n} pares de celdas vecinas'


def _mas_al_sur(p, q):
    """q está más al sur que al lado de p (dy > |dx|): la frontera oeste en diagonal no cuenta como borde sur."""
    return q[1] - p[1] > abs(q[0] - p[0])


def _cierra_por(mundo, r):
    if r.get('borde') != 'sur':
        raise ValueError(f"cierra-por: borde desconocido {r.get('borde')}")
    i = _indice(mundo, 'regiones', r['region'])
    por = _indice(mundo, 'regiones', r['por'])
    celdas = mundo['celdas']
    # Borde sur: la celda más al sur de la región en cada columna de 10 km; así el dentado de la frontera
    # oeste (Llanuras ↔ Ciénaga) no cuenta como borde sur.
    sur = {}
    for c in celdas:
        if _tierra(c) and c['region'] == i:
            k = int(c['p'][0] // 10)
            if k not in sur or c['p'][1] > sur[k]['p'][1]:
                sur[k] = c
    borde = list(sur.values())
    pares = [celdas[j]['region'] for c in borde
             for j in c['c']
             if _tierra(celdas[j]) and celdas[j]['region'] not in (0, i) and _mas_al_sur(c['p'], celdas[j]['p'])]
    if not pares:
        return False, 'sin frontera sur'
    fraccion = sum(1 for x in pares if x == por) / len(pares)
    return fraccion >= r['minimo'], f"{fraccion:.0%} de {len(pares)} pares (mínimo {r['minimo']:.0%})"


def _adelgaza(mundo, r):
    if r.get('hacia') != 'oeste':
        raise ValueError(f"adelgaza: dirección desconocida {r.get('hacia')}")
    region = _celdas_de(mundo, r['region'])
    lados = [[c['p'] for n in nombres for c in _celdas_de(mundo, n)] for nombres in (r['entre'], r['y'])]
    if not all(lados):
        raise ValueError('adelgaza: un lado sin celdas')

    def minima(p, puntos):
        return min(math.hypot(p[0] - q[0], p[1] - q[1]) for q in puntos)

    x0 = min(c['p'][0] for c in region)
    ancho = (max(c['p'][0] for c in region) - x0) / 4
    cuartos = [[], [], [], []]
    for c in region:
        k = min(3, int((c['p'][0] - x0) / ancho)) if ancho else 0
        cuartos[k].append(minima(c['p'], lados[0]) + minima(c['p'], lados[1]))
    if not all(cuartos):
        return False, 'un cuarto sin celdas'
    medias = [sum(q) / len(q) for q in cuartos]
    centrales = cuartos[1] + cuartos[2]
    centro = sum(centrales) / len(centrales)
    if not centro:
        return False, 'los cuartos centrales no tienen grosor (0 km): no se puede medir oeste/centro'
    return medias[0] <= r['maximo'] * centro, (
        'grosor por cuartos O→E: ' + ', '.join(f'{m:.0f}' for m in medias)
        + f' km; oeste/centro = {medias[0] / centro:.2f} (máximo {r["maximo"]})')


def _corredor(mundo, r):
    celdas = mundo['celdas']
    prov = _indice(mundo, 'provincias', r['desde']['provincia'])
    inicio = [c for c in celdas if c['provincia'] == prov and _tierra(c)]
    if not inicio:
        raise ValueError('corredor: la provincia no tiene tierra')
    reg_prov = inicio[0]['region']
    hasta = _indice(mundo, 'regiones', r['hasta'])
    bordea_i = _indice(mundo, 'regiones', r['bordea'])
    x_bordea = _centro(_celdas_de(mundo, r['bordea']))[0]
    if r.get('lado') != 'oeste':
        raise ValueError(f"corredor: lado desconocido {r.get('lado')}")

    def pisable(c):
        if not _tierra(c):
            return False
        if c['region'] in (reg_prov, hasta):
            return True
        return c['region'] == bordea_i and _tiene_mar(mundo, c) and c['p'][0] < x_bordea

    dist = {c['i']: 0.0 for c in inicio if pisable(c)}
    cola = [(0.0, i) for i in dist]
    heapq.heapify(cola)
    while cola:
        d, i = heapq.heappop(cola)
        if d > dist.get(i, math.inf):
            continue
        c = celdas[i]
        if c['region'] == hasta:
            return True, f'camino de {d:.0f} km'
        for j in c['c']:
            v = celdas[j]
            if pisable(v):
                nd = d + math.dist(c['p'], v['p'])
                if nd < dist.get(j, math.inf):
                    dist[j] = nd
                    heapq.heappush(cola, (nd, j))
    return False, 'sin camino por tierra'


def _dentro_de(mundo, r):
    cont = _indice(mundo, 'continentes', r['continente'])
    fuera = [c['i'] for n in r['regiones'] for c in _celdas_de(mundo, n) if c['continente'] != cont]
    return not fuera, f'{len(fuera)} celdas de tierra fuera de {r["continente"]}'


def _sin_tierra_fuera(mundo, r):
    permitidos = {_indice(mundo, 'continentes', n) for n in r['continentes']}
    fuera = [c['i'] for c in mundo['celdas'] if _tierra(c) and c['continente'] not in permitidos]
    lugares = [lu['nombre'] for lu in mundo['lugares'] if r['nombre'] in lu['nombre']]
    return not fuera and not lugares, f'{len(fuera)} celdas de tierra fuera, {len(lugares)} lugares «{r["nombre"]}»'


TIPOS = {
    'orden': _orden, 'oeste-de': _oeste_de, 'frontera': _frontera, 'costa-a-costa': _costa_a_costa,
    'solo-linda': _solo_linda, 'lindan': _lindan, 'cierra-por': _cierra_por, 'adelgaza': _adelgaza,
    'corredor': _corredor, 'dentro-de': _dentro_de, 'sin-tierra-fuera': _sin_tierra_fuera,
}


def comprobar(mundo, reglas):
    """Lista de (regla, ok, detalle) para cada regla de `reglas['reglas']`."""
    resultado = []
    for r in reglas['reglas']:
        if r['tipo'] not in TIPOS:
            raise ValueError(f"tipo de regla desconocido: {r['tipo']} (regla {r.get('id')})")
        ok, detalle = TIPOS[r['tipo']](mundo, r)
        resultado.append((r, ok, detalle))
    return resultado


def informar(mundo, regla):
    """Detalle de una entrada de `sinDecidir`: solo informa, no juzga."""
    if regla['tipo'] != 'borde-norte':
        raise ValueError(f"tipo de regla desconocido: {regla['tipo']} (regla {regla.get('id')})")
    ys = [c['p'][1] for c in _celdas_de(mundo, {'continente': regla['continente']})]
    return f"y mínima de la tierra de {regla['continente']}: {min(ys):.0f} km"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--mundo', default=MUNDO)
    ap.add_argument('--lore', default=LORE)
    ap.add_argument('--json', action='store_true')
    args = ap.parse_args(argv)
    mundo = cargar(args.mundo)
    with open(args.lore, encoding='utf-8') as f:
        lore = json.load(f)
    resultado = comprobar(mundo, lore)
    sin_decidir = [(r, informar(mundo, r)) for r in lore.get('sinDecidir', [])]
    fallan = [r for r, ok, _ in resultado if not ok]
    if args.json:
        print(json.dumps([{'id': r['id'], 'tipo': r['tipo'], 'ok': ok, 'detalle': d} for r, ok, d in resultado]
                         + [{'id': r['id'], 'tipo': r['tipo'], 'ok': None, 'detalle': d} for r, d in sin_decidir],
                         ensure_ascii=False))
        return 1 if fallan else 0
    for r, ok, d in resultado:
        print(f"{'ok ' if ok else 'MAL'} {r['id']:<28} {d}")
    for r, d in sin_decidir:
        print(f"?   {r['id']:<28} {d}  sin decidir: {r['nota']}")
    if fallan:
        print(f"\n{len(fallan)} regla(s) del lore sin cumplir: lo decide la usuaria.", file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
