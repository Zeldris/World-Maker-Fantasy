"""Geometría del mapa propio: contornos de un conjunto de celdas, áreas y envolventes.

Las celdas son polígonos de vértices compartidos (`helek.json`: `celdas[i].v` indexa `vertices`), todas con el
mismo sentido de giro, como las deja FMG.
"""


def area_con_signo(anillo):
    """Fórmula de Gauss (shoelace), la misma que d3.polygonArea."""
    a = 0.0
    for k in range(len(anillo)):
        x0, y0 = anillo[k - 1]
        x1, y1 = anillo[k]
        a += y0 * x1 - x0 * y1
    return a / 2


def anillos(v_por_celda, vertices, miembros):
    """Contornos cerrados (listas de [x, y], sin repetir el primero) del conjunto de celdas `miembros`.

    Una arista dirigida a→b de una celda es de contorno si su inversa b→a no es de otra celda del conjunto.
    """
    dirigidas = set()
    for i in miembros:
        vs = v_por_celda[i]
        for k in range(len(vs)):
            dirigidas.add((vs[k], vs[(k + 1) % len(vs)]))
    siguiente = {}
    for a, b in dirigidas:
        if (b, a) not in dirigidas and a != b:
            siguiente.setdefault(a, []).append(b)
    for salidas in siguiente.values():
        salidas.sort()
    resultado = []
    while siguiente:
        inicio = min(siguiente)
        anillo = [inicio]
        actual = inicio
        while True:
            salidas = siguiente.get(actual)
            if not salidas:
                break
            nxt = salidas.pop()
            if not salidas:
                del siguiente[actual]
            if nxt == inicio:
                break
            anillo.append(nxt)
            actual = nxt
        if len(anillo) >= 3:
            resultado.append([list(vertices[v]) for v in anillo])
    return resultado


def _dentro(p, anillo):
    x, y = p
    d = False
    for k in range(len(anillo)):
        x0, y0 = anillo[k - 1]
        x1, y1 = anillo[k]
        if (y1 > y) != (y0 > y) and x < (x0 - x1) * (y - y1) / (y0 - y1) + x1:
            d = not d
    return d


def poligonos(v_por_celda, vertices, miembros):
    """Lista de polígonos [exterior, hueco…] (anillos sin cerrar). Exterior: el mismo giro que las celdas."""
    miembros = list(miembros)
    if not miembros:
        return []
    giro = area_con_signo([vertices[v] for v in v_por_celda[miembros[0]]]) > 0
    exteriores, huecos = [], []
    for anillo in anillos(v_por_celda, vertices, miembros):
        (exteriores if (area_con_signo(anillo) > 0) == giro else huecos).append(anillo)
    exteriores.sort(key=lambda a: (min(a), len(a)))
    resultado = [[e] for e in exteriores]
    for h in huecos:
        for pol in resultado:
            if _dentro(h[0], pol[0]):
                pol.append(h)
                break
    return resultado


def area(polis):
    return sum(abs(area_con_signo(p[0])) - sum(abs(area_con_signo(h)) for h in p[1:]) for p in polis)


def envolvente(polis):
    """(ancho E-O, alto N-S) del rectángulo que encierra los exteriores."""
    pts = [q for p in polis for q in p[0]]
    if not pts:
        return 0, 0
    xs = [q[0] for q in pts]
    ys = [q[1] for q in pts]
    return max(xs) - min(xs), max(ys) - min(ys)


def localizador(mundo):
    """celda_en(x, y): la celda cuyo centro está más cerca del punto (las celdas son el Voronoi de sus centros)."""
    lado = 20
    cubos = {}
    for c in mundo['celdas']:
        cubos.setdefault((int(c['p'][0] // lado), int(c['p'][1] // lado)), []).append(c)

    def celda_en(x, y):
        bx, by, r, mejor = int(x // lado), int(y // lado), 0, None
        while True:
            for dx in range(-r, r + 1):
                for dy in range(-r, r + 1):
                    if max(abs(dx), abs(dy)) != r:
                        continue
                    for c in cubos.get((bx + dx, by + dy), ()):
                        d = ((c['p'][0] - x) ** 2 + (c['p'][1] - y) ** 2, c['i'])
                        if mejor is None or d < mejor:
                            mejor = d
            # Lo que queda fuera del anillo r está a más de r * lado del punto.
            if mejor is not None and mejor[0] <= (r * lado) ** 2:
                return mejor[1]
            r += 1
    return celda_en
