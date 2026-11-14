"""Triangulación de Delaunay: port fiel de Delaunator 5.0.1 (mapbox, licencia ISC).

FMG 1.137.6 rehace las celdas del mapa al cargarlo con esta misma biblioteca. Para que las celdas reconstruidas
coincidan índice a índice con los arrays guardados en el `.map`, el orden de los triángulos tiene que ser el mismo
que en el navegador: por eso se porta el algoritmo tal cual (ordenación, hash del casco, legalización), no se usa
otra triangulación. `orient2d` usa solo la vía rápida del predicado robusto; en este mapa no hay casos degenerados
que la distingan (lo comprueba el test del importador al cuadrar las áreas de cada región con las de FMG).

Original: https://github.com/mapbox/delaunator (ISC © Mapbox).
"""
import math

EPSILON = 2.0 ** -52


def _orient2d(ax, ay, bx, by, cx, cy):
    return (ay - cy) * (bx - cx) - (ax - cx) * (by - cy)


def _dist(ax, ay, bx, by):
    dx = ax - bx
    dy = ay - by
    return dx * dx + dy * dy


def _in_circle(ax, ay, bx, by, cx, cy, px, py):
    dx = ax - px
    dy = ay - py
    ex = bx - px
    ey = by - py
    fx = cx - px
    fy = cy - py
    ap = dx * dx + dy * dy
    bp = ex * ex + ey * ey
    cp = fx * fx + fy * fy
    return dx * (ey * cp - bp * fy) - dy * (ex * cp - bp * fx) + ap * (ex * fy - ey * fx) < 0


def _circumradius(ax, ay, bx, by, cx, cy):
    dx = bx - ax
    dy = by - ay
    ex = cx - ax
    ey = cy - ay
    bl = dx * dx + dy * dy
    cl = ex * ex + ey * ey
    den = dx * ey - dy * ex
    if den == 0:
        return math.inf
    d = 0.5 / den
    x = (ey * bl - dy * cl) * d
    y = (dx * cl - ex * bl) * d
    return x * x + y * y


def _circumcenter(ax, ay, bx, by, cx, cy):
    dx = bx - ax
    dy = by - ay
    ex = cx - ax
    ey = cy - ay
    bl = dx * dx + dy * dy
    cl = ex * ex + ey * ey
    d = 0.5 / (dx * ey - dy * ex)
    return ax + (ey * bl - dy * cl) * d, ay + (dx * cl - ex * bl) * d


def _pseudo_angle(dx, dy):
    p = dx / (abs(dx) + abs(dy))
    return (3 - p if dy > 0 else 1 + p) / 4


def _quicksort(ids, dists, left, right):
    # Iterativo por la pila de Python, pero con el mismo orden de particiones que el original.
    pila = [(left, right)]
    while pila:
        left, right = pila.pop()
        if right - left <= 20:
            for i in range(left + 1, right + 1):
                temp = ids[i]
                temp_dist = dists[temp]
                j = i - 1
                while j >= left and dists[ids[j]] > temp_dist:
                    ids[j + 1] = ids[j]
                    j -= 1
                ids[j + 1] = temp
            continue
        median = (left + right) >> 1
        i = left + 1
        j = right
        ids[median], ids[i] = ids[i], ids[median]
        if dists[ids[left]] > dists[ids[right]]:
            ids[left], ids[right] = ids[right], ids[left]
        if dists[ids[i]] > dists[ids[right]]:
            ids[i], ids[right] = ids[right], ids[i]
        if dists[ids[left]] > dists[ids[i]]:
            ids[left], ids[i] = ids[i], ids[left]
        temp = ids[i]
        temp_dist = dists[temp]
        while True:
            i += 1
            while dists[ids[i]] < temp_dist:
                i += 1
            j -= 1
            while dists[ids[j]] > temp_dist:
                j -= 1
            if j < i:
                break
            ids[i], ids[j] = ids[j], ids[i]
        ids[left + 1] = ids[j]
        ids[j] = temp
        # El original recurre primero en una mitad y luego en la otra; con pila, se apila al revés.
        if right - i + 1 >= j - left:
            pila.append((left, j - 1))
            pila.append((i, right))
        else:
            pila.append((i, right))
            pila.append((left, j - 1))


class Delaunator:
    """`triangles` y `halfedges` como en Delaunator: el triángulo t son las aristas 3t, 3t+1 y 3t+2."""

    def __init__(self, puntos):
        n = len(puntos)
        coords = []
        for x, y in puntos:
            coords.append(float(x))
            coords.append(float(y))
        self.coords = coords
        max_triangles = max(2 * n - 5, 0)
        self._triangles = [0] * (max_triangles * 3)
        self._halfedges = [0] * (max_triangles * 3)
        self._hash_size = math.ceil(math.sqrt(n))
        self._hull_prev = [0] * n
        self._hull_next = [0] * n
        self._hull_tri = [0] * n
        self._hull_hash = [-1] * self._hash_size
        self._ids = list(range(n))
        self._dists = [0.0] * n
        self._edge_stack = [0] * 512
        self._update(n)

    def _update(self, n):
        coords = self.coords
        hull_prev, hull_next, hull_tri, hull_hash = self._hull_prev, self._hull_next, self._hull_tri, self._hull_hash
        min_x = min_y = math.inf
        max_x = max_y = -math.inf
        for i in range(n):
            x = coords[2 * i]
            y = coords[2 * i + 1]
            if x < min_x:
                min_x = x
            if y < min_y:
                min_y = y
            if x > max_x:
                max_x = x
            if y > max_y:
                max_y = y
        cx = (min_x + max_x) / 2
        cy = (min_y + max_y) / 2

        i0 = i1 = i2 = None
        min_dist = math.inf
        for i in range(n):
            d = _dist(cx, cy, coords[2 * i], coords[2 * i + 1])
            if d < min_dist:
                i0 = i
                min_dist = d
        i0x = coords[2 * i0]
        i0y = coords[2 * i0 + 1]

        min_dist = math.inf
        for i in range(n):
            if i == i0:
                continue
            d = _dist(i0x, i0y, coords[2 * i], coords[2 * i + 1])
            if d < min_dist and d > 0:
                i1 = i
                min_dist = d
        i1x = coords[2 * i1]
        i1y = coords[2 * i1 + 1]

        min_radius = math.inf
        for i in range(n):
            if i == i0 or i == i1:
                continue
            r = _circumradius(i0x, i0y, i1x, i1y, coords[2 * i], coords[2 * i + 1])
            if r < min_radius:
                i2 = i
                min_radius = r
        if min_radius == math.inf:
            raise ValueError('todos los puntos son colineales: no hay triangulación')
        i2x = coords[2 * i2]
        i2y = coords[2 * i2 + 1]

        if _orient2d(i0x, i0y, i1x, i1y, i2x, i2y) < 0:
            i1, i2 = i2, i1
            i1x, i2x = i2x, i1x
            i1y, i2y = i2y, i1y

        self._cx, self._cy = _circumcenter(i0x, i0y, i1x, i1y, i2x, i2y)
        dists = self._dists
        for i in range(n):
            dists[i] = _dist(coords[2 * i], coords[2 * i + 1], self._cx, self._cy)
        _quicksort(self._ids, dists, 0, n - 1)

        self._hull_start = i0
        hull_size = 3
        hull_next[i0] = hull_prev[i2] = i1
        hull_next[i1] = hull_prev[i0] = i2
        hull_next[i2] = hull_prev[i1] = i0
        hull_tri[i0] = 0
        hull_tri[i1] = 1
        hull_tri[i2] = 2
        hull_hash[self._hash_key(i0x, i0y)] = i0
        hull_hash[self._hash_key(i1x, i1y)] = i1
        hull_hash[self._hash_key(i2x, i2y)] = i2

        self.triangles_len = 0
        self._add_triangle(i0, i1, i2, -1, -1, -1)

        xp = yp = None
        for k, i in enumerate(self._ids):
            x = coords[2 * i]
            y = coords[2 * i + 1]
            if k > 0 and abs(x - xp) <= EPSILON and abs(y - yp) <= EPSILON:
                continue
            xp = x
            yp = y
            if i == i0 or i == i1 or i == i2:
                continue

            start = 0
            key = self._hash_key(x, y)
            for j in range(self._hash_size):
                start = hull_hash[(key + j) % self._hash_size]
                if start != -1 and start != hull_next[start]:
                    break

            start = hull_prev[start]
            e = start
            while True:
                q = hull_next[e]
                if not _orient2d(x, y, coords[2 * e], coords[2 * e + 1], coords[2 * q], coords[2 * q + 1]) >= 0:
                    break
                e = q
                if e == start:
                    e = -1
                    break
            if e == -1:
                continue

            t = self._add_triangle(e, i, hull_next[e], -1, -1, hull_tri[e])
            hull_tri[i] = self._legalize(t + 2)
            hull_tri[e] = t
            hull_size += 1

            nn = hull_next[e]
            while True:
                q = hull_next[nn]
                if not _orient2d(x, y, coords[2 * nn], coords[2 * nn + 1], coords[2 * q], coords[2 * q + 1]) < 0:
                    break
                t = self._add_triangle(nn, i, q, hull_tri[i], -1, hull_tri[nn])
                hull_tri[i] = self._legalize(t + 2)
                hull_next[nn] = nn
                hull_size -= 1
                nn = q

            if e == start:
                while True:
                    q = hull_prev[e]
                    if not _orient2d(x, y, coords[2 * q], coords[2 * q + 1], coords[2 * e], coords[2 * e + 1]) < 0:
                        break
                    t = self._add_triangle(q, i, e, -1, hull_tri[e], hull_tri[q])
                    self._legalize(t + 2)
                    hull_tri[q] = t
                    hull_next[e] = e
                    hull_size -= 1
                    e = q

            self._hull_start = hull_prev[i] = e
            hull_next[e] = hull_prev[nn] = i
            hull_next[i] = nn
            hull_hash[self._hash_key(x, y)] = i
            hull_hash[self._hash_key(coords[2 * e], coords[2 * e + 1])] = e

        self.hull = []
        e = self._hull_start
        for _ in range(hull_size):
            self.hull.append(e)
            e = hull_next[e]
        self.triangles = self._triangles[:self.triangles_len]
        self.halfedges = self._halfedges[:self.triangles_len]

    def _hash_key(self, x, y):
        return math.floor(_pseudo_angle(x - self._cx, y - self._cy) * self._hash_size) % self._hash_size

    def _legalize(self, a):
        triangles, halfedges, coords, stack = self._triangles, self._halfedges, self.coords, self._edge_stack
        i = 0
        ar = 0
        while True:
            b = halfedges[a]
            a0 = a - a % 3
            ar = a0 + (a + 2) % 3
            if b == -1:
                if i == 0:
                    break
                i -= 1
                a = stack[i]
                continue
            b0 = b - b % 3
            al = a0 + (a + 1) % 3
            bl = b0 + (b + 2) % 3
            p0 = triangles[ar]
            pr = triangles[a]
            pl = triangles[al]
            p1 = triangles[bl]
            illegal = _in_circle(coords[2 * p0], coords[2 * p0 + 1], coords[2 * pr], coords[2 * pr + 1],
                                 coords[2 * pl], coords[2 * pl + 1], coords[2 * p1], coords[2 * p1 + 1])
            if illegal:
                triangles[a] = p1
                triangles[b] = p0
                hbl = halfedges[bl]
                if hbl == -1:
                    e = self._hull_start
                    while True:
                        if self._hull_tri[e] == bl:
                            self._hull_tri[e] = a
                            break
                        e = self._hull_prev[e]
                        if e == self._hull_start:
                            break
                self._link(a, hbl)
                self._link(b, halfedges[ar])
                self._link(ar, bl)
                br = b0 + (b + 1) % 3
                if i < len(stack):
                    stack[i] = br
                    i += 1
            else:
                if i == 0:
                    break
                i -= 1
                a = stack[i]
        return ar

    def _link(self, a, b):
        self._halfedges[a] = b
        if b != -1:
            self._halfedges[b] = a

    def _add_triangle(self, i0, i1, i2, a, b, c):
        t = self.triangles_len
        self._triangles[t] = i0
        self._triangles[t + 1] = i1
        self._triangles[t + 2] = i2
        self._link(t, a)
        self._link(t + 1, b)
        self._link(t + 2, c)
        self.triangles_len += 3
        return t
