#!/usr/bin/env python3
"""IMG-24: plantillas de boceto por plan corporal (docs/producto/plan-imagenes/plan-fotorreal.md).

Escribe un SVG de 1280x512 (2,5:1) con el sujeto en color plano a partir de un plan corporal y unos pocos números de
la ficha, todos relativos a la unidad del plan (`--planes` la dice). El cuerpo va de perfil mirando a la izquierda
(la dirección se voltea en el montaje, P8) y la cabeza a tres cuartos con los dos ojos (P1 de pautas.md). Las cuentas
que importan (púas, losas, ojos, patas) van en el boceto y no en el prompt (F9). El cielo y el suelo llevan
class="fondo" y la sombra class="sombra": verde.css los pinta de verde croma para el sujeto sobre verde (IMG-19c).
Los 16 px de arriba y de abajo quedan libres: rasterizar.sh los recorta para el 1024x384.

Uso:
  plantilla.py <ficha.json> [-o <salida.svg>]     lee ficha["boceto"] (`plan` y sus parámetros); sale bocetos/<slug>.svg
  plantilla.py --plan <plan> [-p clave=valor ...] [-o <salida.svg>]   valores por defecto del plan; sale bocetos/<plan>.svg
  plantilla.py --planes                           lista los planes, su unidad y los parámetros con sus valores
Un valor fuera de rango o un parámetro que el plan no tiene para con código 2 y el motivo en stderr. Sin dependencias.
"""
import argparse
import json
import math
import os
import sys

ANCHO, ALTO = 1280, 512
MARGEN = 16            # libres a cada lado
Y_MIN, Y_PIES = 40, 452  # el sujeto cabe entre estas dos alturas (16 px de recorte arriba y abajo, y aire)
CARPETA = os.path.dirname(os.path.abspath(__file__))

CIELOS = {  # degradado de arriba a abajo y color del suelo por momento
    'dia': ('#8fb8d8', '#d8c8a8', '#8e3d24'),
    'amanecer': ('#b89cc8', '#f0c890', '#8e3d24'),
    'atardecer': ('#c9661f', '#f3b04e', '#8e3d24'),
    'noche': ('#141a33', '#3a3f5c', '#4a2a1c'),
}


class ErrorPlantilla(ValueError):
    """Un parámetro que no vale: el mensaje dice cuál y por qué."""


# ----------------------------------------------------------------------------- geometría


def n(x: float) -> str:
    s = f'{x:.3f}'.rstrip('0').rstrip('.')
    return '0' if s in ('', '-0') else s


def tono(color: str, factor: float) -> str:
    """El mismo color más claro (factor > 1) o más oscuro."""
    return '#%02x%02x%02x' % tuple(max(0, min(255, round(int(color[i:i + 2], 16) * factor))) for i in (1, 3, 5))


def bezier(p0, p1, p2, p3, pasos=16):
    pts = []
    for i in range(pasos + 1):
        t = i / pasos
        u = 1 - t
        pts.append((u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
                    u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]))
    return pts


def bordes(centro, anchos):
    """Los dos bordes de una cinta alrededor de una línea central, con el ancho total en cada punto."""
    a, b = [], []
    for i, (x, y) in enumerate(centro):
        xa, ya = centro[max(i - 1, 0)]
        xb, yb = centro[min(i + 1, len(centro) - 1)]
        dx, dy = xb - xa, yb - ya
        l = math.hypot(dx, dy) or 1
        nx, ny, w = -dy / l, dx / l, anchos[i] / 2
        a.append((x + nx * w, y + ny * w))
        b.append((x - nx * w, y - ny * w))
    return a, b


def cinta(centro, anchos):
    a, b = bordes(centro, anchos)
    return a + b[::-1]


def borde_superior(centro, anchos):
    a, b = bordes(centro, anchos)
    return a if sum(y for _, y in a) <= sum(y for _, y in b) else b


def girar(x, y, grados):
    r = math.radians(grados)
    return x * math.cos(r) - y * math.sin(r), x * math.sin(r) + y * math.cos(r)


def a_lo_largo(linea, paso, margen=0.0):
    """Puntos cada `paso` de longitud sobre una polilínea, con la tangente unitaria en cada uno."""
    tramos = []
    for (x0, y0), (x1, y1) in zip(linea, linea[1:]):
        l = math.hypot(x1 - x0, y1 - y0)
        if l > 1e-9:
            tramos.append(((x0, y0), (x1, y1), l))
    total = sum(t[2] for t in tramos)
    salida, s = [], margen
    while s <= total - margen and tramos:
        acum = 0
        for (x0, y0), (x1, y1), l in tramos:
            if acum + l >= s:
                t = (s - acum) / l
                salida.append(((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t), ((x1 - x0) / l, (y1 - y0) / l)))
                break
            acum += l
        s += paso
    return salida


class Lienzo:
    """Elementos SVG en las coordenadas del plan (unidad = 1) y la caja que ocupan; componer() los escala."""

    def __init__(self):
        self.svg = []
        self.puntos = []

    def poligono(self, pts, color, **attrs):
        self.puntos.extend(pts)
        self.svg.append(f'<path d="M{" L".join(n(x) + " " + n(y) for x, y in pts)}Z" fill="{color}"{self._attrs(attrs)}/>')

    def elipse(self, cx, cy, rx, ry, color, rot=0.0, **attrs):
        self.puntos.extend(((cx - rx, cy - ry), (cx + rx, cy + ry)))
        t = f' transform="rotate({n(rot)} {n(cx)} {n(cy)})"' if rot else ''
        self.svg.append(f'<ellipse cx="{n(cx)}" cy="{n(cy)}" rx="{n(rx)}" ry="{n(ry)}" fill="{color}"{t}{self._attrs(attrs)}/>')

    def linea(self, pts, color, ancho, **attrs):
        for x, y in pts:
            self.puntos.extend(((x - ancho / 2, y - ancho / 2), (x + ancho / 2, y + ancho / 2)))
        d = 'M' + ' L'.join(n(x) + ' ' + n(y) for x, y in pts)
        self.svg.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{n(ancho)}" stroke-linecap="round" '
                        f'stroke-linejoin="round"{self._attrs(attrs)}/>')

    def capsula(self, x, y, w, h, color, **attrs):
        """Rectángulo de esquinas totalmente redondas (un cuerpo o un lazo)."""
        self.puntos.extend(((x, y), (x + w, y + h)))
        r = min(w, h) / 2
        self.svg.append(f'<rect x="{n(x)}" y="{n(y)}" width="{n(w)}" height="{n(h)}" rx="{n(r)}" ry="{n(r)}" fill="{color}"'
                        f'{self._attrs(attrs)}/>')

    def cinta(self, centro, anchos, color, **attrs):
        self.poligono(cinta(centro, anchos), color, **attrs)

    def comentario(self, texto):
        self.svg.append(f'<!-- {texto} -->')

    @staticmethod
    def _attrs(attrs):
        return ''.join(f' {k.replace("_", "-")}="{v}"' for k, v in attrs.items())


# ----------------------------------------------------------------------------- piezas comunes


def ojos(z, cerca, lejos, tam, iris='#e8c04a'):
    """Los dos ojos de la cabeza a tres cuartos: el cercano mayor que el lejano."""
    for (x, y), r in ((lejos, tam * 0.75), (cerca, tam)):
        z.elipse(x, y, r * 1.4, r, iris, rot=-12)
        z.elipse(x, y, r * 0.4, r * 0.9, '#1a1410')


def garras(z, pie, hacia, largo, color='#1c120c', cuantas=3):
    """Triángulos oscuros en la punta del pie; `hacia` es -1 (adelante, hacia la cabeza) o +1."""
    x, y = pie
    for i in range(cuantas):
        bx = x + hacia * i * largo * 0.6
        z.poligono([(bx, y - largo * 0.3), (bx + hacia * largo, y + largo * 0.15), (bx, y + largo * 0.3)], color)


def pata(z, x, y0, P, g, tipo, flexion, lado, color, paso=0.0, escala=1.0):
    """Una pata colgada de la cadera (x, y0) hasta el pie a y0 + P. `paso` desplaza el pie (negativo = adelante,
    hacia la cabeza); el pie cercano delantero va adelante y el trasero atrás (zancada, P1)."""
    P *= escala
    yp = y0 + P
    k = math.sin(math.radians(flexion)) * 0.5 * P
    if tipo == 'carnivoro':
        rodilla = (x + (k if lado == 'trasera' else -k * 0.5) + paso * 0.4, y0 + P * 0.55)
        pie = (x + paso, yp)
        z.linea([(x, y0), rodilla], color, g)
        z.linea([rodilla, pie], color, g * 0.6)
        z.linea([pie, (pie[0] - 0.3 - 0.3 * g, yp)], color, g * 0.5)
        garras(z, (pie[0] - 0.3 - 0.3 * g - 0.04, yp), -1, 0.14)
    elif tipo == 'ave':
        rodilla = (x - 0.08 + paso * 0.2, y0 + P * 0.15)
        corvejon = (x + 0.25 + paso * 0.5, y0 + P * 0.55)
        pie = (x + paso, yp)
        z.linea([(x, y0), rodilla, corvejon, pie], color, g * 0.55)
        for dx, dy in ((-0.45, 0.1), (0.05, 0.16), (0.4, 0.08)):
            z.linea([pie, (pie[0] + dx, yp + dy)], color, g * 0.45)
            z.linea([(pie[0] + dx, yp + dy), (pie[0] + dx * 1.25, yp + dy + 0.03)], '#2d241a', g * 0.3)
    elif tipo == 'columna':
        pie = (x + paso * 0.5, yp)
        z.linea([(x, y0), pie], color, g)
        z.elipse(pie[0], yp - 0.05, 0.12 + 0.4 * g, 0.08, tono(color, 0.85))
    elif tipo == 'reptil':
        d = -1 if lado == 'delantera' else 1
        codo = (x + d * 0.45 * P + paso, y0 + 0.25 * P)
        pie = (x + d * 0.55 * P + paso, yp)
        z.linea([(x, y0), codo], color, g)
        z.linea([codo, pie], color, g * 0.7)
        for ang in (-150, -175, 160, 135):
            r = math.radians(ang)
            z.linea([pie, (pie[0] + 0.32 * math.cos(r), yp + 0.12 * abs(math.sin(r)))], color, g * 0.35)
    return yp


def cuernos(z, lista, cab, Hl, color):
    """Cuernos desde la cabeza a tres cuartos: cada uno con largo (en la unidad del plan), direccion y forma; se
    pintan los dos lados (cercano y lejano) salvo en la nariz."""
    cx, cy, rx, ry = cab['cx'], cab['cy'], cab['rx'], cab['ry']
    mx, my, mrx, mry = cab['mx'], cab['my'], cab['mrx'], cab['mry']
    for c in lista:
        l, forma = c['largo'], c.get('forma', 'punta')
        d = c['direccion']
        if d == 'lado':
            pares = (((cx - 0.12 * Hl, cy - ry * 0.9), (-0.95, -0.3)), ((cx + 0.2 * Hl, cy - ry * 0.95), (0.9, -0.42)))
        elif d == 'arriba':
            pares = (((cx - 0.1 * Hl, cy - ry * 0.95), (-0.2, -0.98)), ((cx + 0.18 * Hl, cy - ry), (0.15, -0.99)))
        elif d == 'adelante':
            pares = (((cx - 0.15 * Hl, cy - ry * 0.9), (-0.8, -0.6)), ((cx + 0.15 * Hl, cy - ry), (-0.6, -0.8)))
        elif d == 'nariz':
            pares = (((mx - mrx * 0.55, my - mry * 0.8), (-0.35, -0.94)),)
        elif d == 'mandibula':
            pares = (((mx + mrx * 0.3, my + mry * 0.8), (-0.55, 0.83)), ((mx + mrx * 0.9, my + mry * 0.4), (0.75, 0.66)))
        else:  # abajo: de la barbilla
            pares = (((mx + mrx * 0.2, my + mry), (-0.15, 0.99)),)
        for i, ((bx, by), (dx, dy)) in enumerate(pares):
            col = color if i == 0 or len(pares) == 1 else tono(color, 0.85)
            fin = (bx + dx * l, by + dy * l)
            if forma == 'hoja':
                centro = [(bx + dx * l * t, by + dy * l * t) for t in (0, 0.25, 0.5, 0.75, 1)]
                anchos = [0.25 * l, 0.5 * l, 0.5 * l, 0.3 * l, 0.02]
                z.cinta(centro, anchos, col)
                z.linea([(bx, by), fin], tono(color, 0.7), 0.03 * l + 0.01)
            else:
                base = min(0.22 * l, 0.3 * Hl)
                z.poligono([(bx + dy * base / 2, by - dx * base / 2), fin, (bx - dy * base / 2, by + dx * base / 2)], col)


def cabeza_tres_cuartos(z, H, Hl, hocico, orejas, color, colmillos=False):
    """Cabeza girada hacia quien mira: lado lejano oscuro detrás, cráneo, hocico escorzado hacia abajo-izquierda,
    dos orejas, dos ojos (P1) y nariz. H es el punto de unión con el cuello; Hl, el largo de la cabeza."""
    claro, oscuro = tono(color, 1.35), tono(color, 0.65)
    cx, cy = H[0] - 0.28 * Hl, H[1] - 0.06 * Hl
    rx, ry = 0.42 * Hl, 0.36 * Hl
    z.elipse(cx + 0.14 * Hl, cy - 0.03 * Hl, rx, ry, oscuro)
    if orejas:
        o = orejas * Hl
        z.poligono([(cx + 0.12 * Hl, cy - ry * 0.8), (cx + 0.3 * Hl, cy - ry - o), (cx + 0.38 * Hl, cy - ry * 0.6)], oscuro)
    z.elipse(cx, cy, rx, ry, color)
    mx, my = cx - (0.12 + 0.5 * hocico) * Hl, cy + 0.17 * Hl
    mrx, mry = (0.5 * hocico + 0.12) * Hl, 0.24 * Hl
    z.elipse(mx, my, mrx, mry, color, rot=-14)
    z.elipse(mx, my + 0.1 * Hl, mrx * 0.9, mry * 0.5, claro, rot=-14)
    if orejas:
        o = orejas * Hl
        z.poligono([(cx - 0.3 * Hl, cy - ry * 0.7), (cx - 0.32 * Hl, cy - ry - o), (cx - 0.05 * Hl, cy - ry * 0.85)], color)
        z.poligono([(cx - 0.27 * Hl, cy - ry * 0.75), (cx - 0.29 * Hl, cy - ry - o * 0.75), (cx - 0.12 * Hl, cy - ry * 0.85)],
                   oscuro)
    ojos(z, (cx - 0.12 * Hl, cy - 0.05 * Hl), (cx + 0.22 * Hl, cy - 0.1 * Hl), 0.07 * Hl)
    nx, ny = mx - mrx * 0.85, my - mry * 0.15
    z.elipse(nx, ny, 0.07 * Hl, 0.055 * Hl, '#1a1410')
    if colmillos:
        for dx in (0.15, 0.4):
            bx = mx - mrx * 0.7 + dx * Hl
            z.poligono([(bx - 0.04 * Hl, my + mry * 0.5), (bx - 0.02 * Hl, my + mry * 0.5 + 0.3 * Hl), (bx + 0.05 * Hl, my + mry * 0.5)],
                       '#f2ead2')
    return dict(cx=cx, cy=cy, rx=rx, ry=ry, mx=mx, my=my, mrx=mrx, mry=mry)


def cresta(z, c, linea, cab, Hl, color_defecto):
    """Cresta sobre la línea superior nuca→lomo(→cola): púas, losas de canto o banda continua; opcionalmente
    también sobre la cabeza (lámina acampanada con losas, púas con púas)."""
    forma, alto = c['forma'], c['alto']
    color, puntas = c.get('color', color_defecto), c.get('puntas')
    if forma == 'banda':
        arriba = [(x - tx * 0, y) for (x, y), (tx, ty) in a_lo_largo(linea, 0.12)]
        encima = [(x + ty * alto, y - tx * alto) for (x, y), (tx, ty) in a_lo_largo(linea, 0.12)]
        z.poligono(arriba + encima[::-1], color)
    else:
        paso, base = (0.46, 0.36) if forma == 'losas' else (0.24, 0.13)
        for (x, y), (tx, ty) in a_lo_largo(linea, paso, margen=0.1):
            nx, ny = ty, -tx  # normal hacia arriba
            if forma == 'losas':
                z.poligono([(x - tx * base / 2, y - ty * base / 2), (x + nx * alto - tx * base * 0.25 + tx * 0.05, y + ny * alto - ty * base * 0.25),
                            (x + nx * alto + tx * base * 0.25 + tx * 0.05, y + ny * alto + ty * base * 0.25),
                            (x + tx * base / 2, y + ty * base / 2)], color)
            else:
                z.poligono([(x - tx * base / 2, y - ty * base / 2), (x + nx * alto, y + ny * alto), (x + tx * base / 2, y + ty * base / 2)],
                           color)
                if puntas:
                    z.poligono([(x + nx * alto * 0.6 - tx * base * 0.2, y + ny * alto * 0.6 - ty * base * 0.2), (x + nx * alto, y + ny * alto),
                                (x + nx * alto * 0.6 + tx * base * 0.2, y + ny * alto * 0.6 + ty * base * 0.2)], puntas)
    if c.get('cabeza'):
        cx, cy, rx, ry = cab['cx'], cab['cy'], cab['rx'], cab['ry']
        if forma == 'losas':  # lámina acampanada: sube de la frente y se abre arriba
            z.poligono([(cx - 0.2 * Hl, cy - ry * 0.9), (cx - 0.35 * Hl, cy - ry - alto), (cx + 0.5 * Hl, cy - ry - alto * 0.9),
                        (cx + 0.35 * Hl, cy - ry * 0.95)], color)
        elif forma == 'puas':
            for i in range(3):
                bx = cx - 0.2 * Hl + i * 0.2 * Hl
                z.poligono([(bx - 0.06 * Hl, cy - ry * 0.95), (bx + 0.05 * Hl, cy - ry - alto), (bx + 0.07 * Hl, cy - ry * 0.95)], color)
        else:
            z.poligono([(cx - 0.3 * Hl, cy - ry * 0.9), (cx - 0.1 * Hl, cy - ry - alto), (cx + 0.45 * Hl, cy - ry - alto * 0.8),
                        (cx + 0.45 * Hl, cy - ry * 0.95)], color)


# ----------------------------------------------------------------------------- planes


def cuadrupedo(z, p):
    """Depredador, herbívoro y reptil: torso de perfil (largo L, profundidad 1), cuatro patas, cola, cuello y cabeza
    a tres cuartos; cresta y cuernos opcionales. Devuelve la y del horizonte en unidades."""
    L, P, g = p['largo'], p['patas'], p['grosorPatas']
    col = p['color']
    claro, lejos = tono(col, 1.35), tono(col, 1.2)
    tipo, flex = p['tipoPatas'], p['flexion']
    xf, xr = 0.45, L - 0.5
    z.comentario('patas lejanas: más claras, algo más cortas, zancada contraria')
    pata(z, xf + 0.18, 0.2, P, g, tipo, flex, 'delantera', lejos, paso=0.18 * P, escala=0.94)
    pata(z, xr + 0.18, 0.2, P, g, tipo, flex, 'trasera', lejos, paso=-0.12 * P, escala=0.94)
    z.comentario('cola')
    C, gc, ang = p['cola'], p['grosorCola'], math.radians(p['anguloCola'])
    p0 = (L - 0.25, -0.15)
    fin = (p0[0] + C * math.cos(ang), min(p0[1] + C * math.sin(ang), 0.5 + P - 0.05))
    centro = bezier(p0, (p0[0] + 0.4 * C, p0[1] - 0.12 * C), (p0[0] + 0.8 * C * math.cos(ang), fin[1] - 0.08 * C), fin, 20)
    anchos_cola = [gc * (1 - i / 20) + 0.04 for i in range(21)]
    z.cinta(centro, anchos_cola, col)
    if p['cola'] > 0.3 and p.get('colaPuas'):
        z.poligono([(fin[0] - 0.1, fin[1] - 0.05), (fin[0] + 0.35, fin[1] - 0.3), (fin[0] + 0.1, fin[1]), (fin[0] + 0.35, fin[1] + 0.25),
                    (fin[0] - 0.1, fin[1] + 0.05)], p.get('colorCresta', '#0c0c0c'))
    z.comentario('torso y barriga')
    z.capsula(0, -0.5, L, 1, col)
    z.capsula(0.25, 0.22, L - 0.5, 0.24, claro)
    z.comentario('cuello y cabeza a tres cuartos (dos ojos, dos orejas)')
    N, an, gn = p['cuello'], math.radians(p['anguloCuello']), p['grosorCuello']
    S = (0.22, -0.25)
    H = (S[0] - N * math.cos(an), S[1] - N * math.sin(an))
    c_cuello = bezier(S, (S[0] - 0.35 * N * math.cos(an - 0.35), S[1] - 0.35 * N * math.sin(an - 0.35)),
                      (S[0] - 0.75 * N * math.cos(an + 0.2), S[1] - 0.75 * N * math.sin(an + 0.2)), H, 12)
    anchos_cuello = [gn * (1 - 0.35 * i / 12) for i in range(13)]
    z.cinta(c_cuello, anchos_cuello, col)
    cab = cabeza_tres_cuartos(z, H, p['cabeza'], p['hocico'], p['orejas'], col, p['colmillos'])
    if p['cuernos']:
        cuernos(z, p['cuernos'], cab, p['cabeza'], p['colorCuernos'])
    if p['cresta']:
        linea = borde_superior(c_cuello, anchos_cuello)[::-1] + [(0.3, -0.5), (L - 0.3, -0.5)]
        if p['cresta'].get('hasta', 'cola') == 'cola':
            linea += borde_superior(centro, anchos_cola)
        cresta(z, p['cresta'], linea, cab, p['cabeza'], p['colorCresta'])
    z.comentario('patas cercanas')
    pata(z, xf, 0.2, P, g, tipo, flex, 'delantera', tono(col, 0.8), paso=-0.22 * P)
    pata(z, xr, 0.2, P, g, tipo, flex, 'trasera', tono(col, 0.8), paso=0.15 * P)
    return 0.0


def ave(z, p):
    """Ave en vuelo, de tres cuartos: cuerpo corto inclinado, alas abiertas y levantadas en V, cola en abanico,
    patas colgando adelante, cabeza con pico; cresta opcional en la nuca. Unidad: el largo del torso."""
    col = p['color']
    lejos, claro = tono(col, 1.25), tono(col, 1.4)
    inc, h = p['inclinacion'], p['hondo']

    def R(x, y):
        return girar(x, y, -inc)

    E, cuerda, alas = p['envergadura'], p['cuerdaAla'], math.radians(p['alas'])

    def ala(raiz, direccion, largo, color):
        dx, dy = direccion
        px, py = -dy, dx  # perpendicular hacia abajo/atrás: el borde de salida con las plumas
        if py < 0:
            px, py = -px, -py
        punta = (raiz[0] + dx * largo, raiz[1] + dy * largo)
        pts = [raiz, punta]
        plumas = int(p['plumas'])
        for i in range(plumas * 2 + 1):
            t = 1 - 0.55 * i / (plumas * 2)
            c = cuerda * (0.3 + 0.7 * (1 - t)) + (0 if i % 2 else cuerda * 0.3)
            pts.append((raiz[0] + dx * largo * t + px * c, raiz[1] + dy * largo * t + py * c))
        pts.append((raiz[0] + px * cuerda, raiz[1] + py * cuerda))
        z.poligono(pts, color)
        z.linea([raiz, punta], tono(color, 0.8), 0.04)

    z.comentario('ala lejana')
    a2 = alas + math.radians(12)
    ala(R(0.08, -0.08), (-math.cos(a2), -math.sin(a2)), E / 2 * 0.88, lejos)
    z.comentario('cola en abanico')
    C = p['cola']
    z.poligono([R(0.42, -0.07), R(0.42 + C, -0.26), R(0.42 + C * 1.08, -0.1), R(0.42 + C * 1.06, 0.08), R(0.42 + C * 0.96, 0.26),
                R(0.42, 0.08)], tono(col, 0.9))
    z.comentario('cuerpo')
    z.elipse(0, 0, 0.5, h / 2, col, rot=-inc)
    bx, by = R(-0.05, h * 0.18)
    z.elipse(bx, by, 0.36, h * 0.3, claro, rot=-inc)
    z.comentario('patas colgando adelante, con garras')
    P = p['patas']
    for dx, color in ((0.14, lejos), (0.0, tono(col, 0.75))):
        r = R(-0.02 + dx, h * 0.3)
        pie = (r[0] - 0.4 * P, r[1] + 0.85 * P)
        z.linea([r, pie], color, 0.08)
        for ang in (-150, -110, -70):
            rr = math.radians(ang)
            fin = (pie[0] + 0.16 * P * math.cos(rr), pie[1] - 0.16 * P * math.sin(rr))
            z.linea([pie, fin], color, 0.05)
            z.linea([fin, (fin[0] + 0.05 * P * math.cos(rr), fin[1] - 0.05 * P * math.sin(rr))], '#1c120c', 0.04)
    z.comentario('ala cercana')
    ala(R(0.0, -0.1), (math.cos(alas), -math.sin(alas)), E / 2, col)
    z.comentario('cabeza a tres cuartos con pico')
    Hl = p['cabeza']
    hx, hy = R(-0.5, -0.02)
    cx, cy = hx - 0.22 * Hl, hy - 0.08 * Hl
    rx, ry = 0.32 * Hl, 0.3 * Hl
    z.elipse(cx + 0.1 * Hl, cy - 0.02 * Hl, rx, ry, tono(col, 0.65))
    z.elipse(cx, cy, rx, ry, col)
    pico = '#cfc3a0'
    if p['pico'] == 'gancho':
        z.poligono([(cx - 0.22 * Hl, cy - 0.17 * Hl), (cx - 0.72 * Hl, cy - 0.06 * Hl), (cx - 0.66 * Hl, cy + 0.26 * Hl),
                    (cx - 0.5 * Hl, cy + 0.08 * Hl), (cx - 0.22 * Hl, cy + 0.2 * Hl)], pico)
    else:
        z.poligono([(cx - 0.22 * Hl, cy - 0.14 * Hl), (cx - 0.8 * Hl, cy + 0.04 * Hl), (cx - 0.22 * Hl, cy + 0.2 * Hl)], pico)
    ojos(z, (cx - 0.1 * Hl, cy - 0.06 * Hl), (cx + 0.2 * Hl, cy - 0.1 * Hl), 0.07 * Hl)
    if p['cresta']:
        c = p['cresta']
        alto = c['alto']
        for i in range(4):
            bx = cx + 0.05 * Hl + i * 0.09 * Hl
            z.poligono([(bx - 0.05 * Hl, cy - ry * 0.9 + i * 0.03 * Hl), (bx + 0.12 * Hl + alto * 0.5, cy - ry - alto + i * 0.08 * Hl),
                        (bx + 0.06 * Hl, cy - ry * 0.85 + i * 0.04 * Hl)], c.get('color', p['colorCresta']))
    return 0.9


def alargado(z, p):
    """Serpiente: pila de lazos de perfil y el tercio delantero alzado en S con la cabeza a tres cuartos; cola que
    sale de abajo. Unidad: el grosor del cuerpo."""
    col = p['color']
    claro, oscuro = tono(col, 1.3), tono(col, 0.75)
    lazos, largo, cola, Hl = int(p['lazos']), p['largo'], p['cola'], p['cabeza']
    alz = p['alzada'] * largo
    W = max(2.5, (largo - alz - cola) / (2 * lazos))
    z.comentario('cola, que asoma por detrás de la pila')
    c_cola = bezier((W / 2 - 0.6, -0.5), (W / 2 + 0.4 * cola, -0.5), (W / 2 + 0.7 * cola, -0.1), (W / 2 + cola, -0.08), 14)
    z.cinta(c_cola, [1 - 0.88 * i / 14 for i in range(15)], col)
    z.comentario('pila de lazos (cada uno un poco más estrecho)')
    for i in range(lazos):
        w = W * 0.88 ** i
        y = -1 - i * 0.92
        z.capsula(-w / 2, y, w, 1, col if i % 2 == 0 else tono(col, 0.92))
        z.capsula(-w / 2 + 0.4, y + 0.1, w - 0.8, 0.3, claro)
    z.comentario('tercio delantero alzado en S')
    wt = W * 0.88 ** (lazos - 1)
    x0, y0 = -wt / 2 + 0.6, -1 - (lazos - 1) * 0.92 + 0.5
    c_s = bezier((x0, y0), (x0 - 1.6, y0 - 0.3 * alz), (x0 + 2.2, y0 - 0.7 * alz), (x0 + 0.2, y0 - alz), 20)
    anchos = [1 - 0.28 * i / 20 for i in range(21)]
    z.cinta(c_s, anchos, col)
    z.comentario('cabeza a tres cuartos, dos ojos, lengua')
    hx, hy = c_s[-1]
    cx, cy = hx - 0.35 * Hl, hy - 0.12 * Hl
    rx, ry = 0.6 * Hl, 0.42 * Hl
    z.elipse(cx + 0.15 * Hl, cy - 0.02 * Hl, rx, ry, oscuro, rot=-18)
    z.elipse(cx, cy, rx, ry, col, rot=-18)
    z.elipse(cx - 0.05 * Hl, cy + 0.15 * Hl, rx * 0.85, ry * 0.45, claro, rot=-18)
    ojos(z, (cx - 0.22 * Hl, cy - 0.12 * Hl), (cx + 0.2 * Hl, cy - 0.22 * Hl), 0.08 * Hl)
    if p['lengua']:
        bx, by = cx - rx * 0.95, cy + 0.1 * Hl
        z.linea([(bx, by), (bx - 0.45 * Hl, by + 0.05 * Hl)], '#8e2a3a', 0.06 * Hl)
        z.linea([(bx - 0.45 * Hl, by + 0.05 * Hl), (bx - 0.62 * Hl, by - 0.08 * Hl)], '#8e2a3a', 0.05 * Hl)
        z.linea([(bx - 0.45 * Hl, by + 0.05 * Hl), (bx - 0.6 * Hl, by + 0.18 * Hl)], '#8e2a3a', 0.05 * Hl)
    if p['cresta']:
        linea = [(x, y) for x, y in borde_superior(c_s, anchos)]
        cresta(z, p['cresta'], linea, dict(cx=cx, cy=cy, rx=rx, ry=ry), Hl, p['colorCresta'])
    return -1 - (lazos - 1) * 0.92 + 0.5


def artropodo(z, p):
    """Artrópodo de perfil bajo: cefalotórax, abdomen por segmentos, patas articuladas con la rodilla por encima del
    cuerpo, pinzas, cola arqueada con aguijón y la fila de ojos. Unidad: el largo del cefalotórax."""
    col = p['color']
    lejos, oscuro, claro = tono(col, 1.3), tono(col, 0.7), tono(col, 1.25)
    segs, abd, npatas = int(p['segmentos']), p['abdomen'], int(p['patas'])
    P, g = p['largoPatas'], p['grosorPatas']
    xe = 0.4 + abd

    def patas(lado, color, dy):
        por_lado = npatas // 2
        for i in range(por_lado):
            t = i / max(por_lado - 1, 1)
            x = -0.3 + t * (0.6 + abd * 0.35)
            d = -1 + 2 * t  # delanteras hacia delante, traseras hacia atrás
            rodilla = (x + d * 0.35 * P + (0.15 if lado == 'lejos' else -0.05), -0.28 - 0.35 * P + dy)
            pie = (x + d * 0.6 * P + 0.25 * P * (1 if d >= 0 else -1), 0.55 + dy)
            z.linea([(x, 0.05), rodilla, pie], color, g)
            z.linea([pie, (pie[0] + d * 0.15 + 0.1, 0.55 + dy)], '#1c120c', g * 0.6)

    z.comentario('patas lejanas')
    patas('lejos', lejos, -0.08)
    z.comentario('abdomen por segmentos')
    for i in range(segs):
        t = i / max(segs - 1, 1)
        x = 0.42 + t * (abd - abd / segs)
        z.elipse(x + abd / segs * 0.5, 0.02 + 0.05 * t, abd / segs * 0.62, 0.27 - 0.12 * t, col if i % 2 == 0 else tono(col, 0.9))
    z.comentario('cefalotórax y fila de ojos')
    z.elipse(0, 0, 0.5, 0.29, col)
    z.elipse(-0.02, 0.12, 0.42, 0.12, claro)
    for i in range(int(p['ojos'])):
        t = i / max(int(p['ojos']) - 1, 1)
        z.elipse(-0.4 + 0.3 * t, -0.17 + 0.06 * math.sin(t * math.pi), 0.045 - 0.01 * t, 0.045 - 0.01 * t, '#1a1410')
    if p['antenas']:
        for dx in (0, 0.1):
            z.linea([(-0.45 + dx, -0.18), (-0.9 + dx, -0.5), (-1.3 + dx, -0.55)], oscuro, 0.03)
    if p['pinzas']:
        z.comentario('pinzas')
        for dx, dy, color in ((0.12, -0.14, lejos), (0, 0, col)):
            z.linea([(-0.35 + dx, 0.0 + dy), (-0.9 + dx, 0.05 + dy)], color, 0.2)
            z.elipse(-1.25 + dx, 0.05 + dy, 0.45, 0.26, color, rot=-10)
            z.poligono([(-1.7 + dx, -0.02 + dy), (-1.35 + dx, 0.06 + dy), (-1.7 + dx, 0.14 + dy)], '#1c120c')
    if p['cola'] > 0:
        z.comentario('cola arqueada sobre el lomo, con aguijón')
        C = p['cola']
        c = bezier((xe, 0), (xe + 0.9 * C, -0.1), (xe + 0.75 * C, -1.15 * C), (xe - 0.15, -0.9 * C), 18)
        z.cinta(c, [0.28 - 0.1 * i / 18 for i in range(19)], col)
        fx, fy = c[-1]
        z.elipse(fx, fy, 0.14, 0.12, oscuro)
        z.poligono([(fx - 0.05, fy - 0.1), (fx - 0.45, fy + 0.3), (fx + 0.08, fy + 0.08)], '#1c120c')
    z.comentario('patas cercanas')
    patas('cerca', oscuro, 0.0)
    return 0.0


# ----------------------------------------------------------------------------- parámetros


def num(defecto, minimo, maximo, doc):
    return dict(tipo='num', defecto=defecto, min=minimo, max=maximo, doc=doc)


def opcion(defecto, opciones, doc):
    return dict(tipo='opcion', defecto=defecto, opciones=opciones, doc=doc)


def booleano(defecto, doc):
    return dict(tipo='bool', defecto=defecto, doc=doc)


def color(defecto, doc):
    return dict(tipo='color', defecto=defecto, doc=doc)


CRESTA = dict(tipo='cresta', defecto=None, doc='null o {forma: puas|losas|banda, alto, hasta: cola|grupa, cabeza: bool, '
                                                 'color, puntas (color de las puntas de las púas)}')
CUERNOS = dict(tipo='cuernos', defecto=[], doc='lista de {largo, direccion: lado|arriba|adelante|nariz|mandibula|abajo, '
                                               'forma: punta|hoja}')

COMUNES = {
    'momento': opcion('dia', tuple(CIELOS), 'cielo y suelo del boceto (la ficha lo trae)'),
    'colorCresta': color('#0c0c0c', 'color de la cresta si la cresta no dice otro'),
}


def cuadrupedo_params(**cambios):
    base = {
        'largo': num(4.0, 1.2, 10, 'largo del torso'),
        'patas': num(1.0, 0.3, 4, 'largo de las patas, de la barriga al suelo'),
        'grosorPatas': num(0.3, 0.08, 1, 'grosor del muslo'),
        'tipoPatas': opcion('carnivoro', ('carnivoro', 'ave', 'columna', 'reptil'), 'forma de las patas'),
        'flexion': num(30, 0, 70, 'grados que se dobla la rodilla'),
        'cuello': num(0.8, 0.1, 5, 'largo del cuello'),
        'anguloCuello': num(25, -30, 90, 'grados sobre la horizontal (90 = vertical)'),
        'grosorCuello': num(0.55, 0.1, 1.2, 'grosor del cuello en la base'),
        'cabeza': num(1.1, 0.3, 3, 'largo de la cabeza'),
        'hocico': num(0.6, 0.2, 1.5, 'largo del hocico, en cabezas'),
        'orejas': num(0.45, 0, 1, 'alto de las orejas, en cabezas (0 = sin orejas)'),
        'colmillos': booleano(False, 'dos colmillos de sable bajo el hocico'),
        'cola': num(2.0, 0, 6, 'largo de la cola'),
        'grosorCola': num(0.4, 0.05, 1.2, 'grosor de la cola en la base'),
        'anguloCola': num(20, -60, 60, 'grados bajo la horizontal (negativo = levantada)'),
        'colaPuas': booleano(False, 'abanico de púas en la punta de la cola'),
        'cresta': CRESTA,
        'cuernos': CUERNOS,
        'color': color('#9a4a24', 'color del cuerpo'),
        'colorCuernos': color('#cbbfa6', 'color de los cuernos'),
        **COMUNES,
    }
    for k, v in cambios.items():
        base[k] = dict(base[k], defecto=v)
    return base


PLANES = {
    'depredador': dict(
        unidad='D, la profundidad del torso (del lomo a la barriga)', dibuja=cuadrupedo, suelo=True,
        parametros=cuadrupedo_params(largo=4.5, patas=1.0, cola=2.2, colmillos=True, hocico=0.65,
                                     cresta={'forma': 'puas', 'alto': 0.5, 'hasta': 'cola', 'puntas': '#b3121a'})),
    'herbivoro': dict(
        unidad='D, la profundidad del torso', dibuja=cuadrupedo, suelo=True,
        parametros=cuadrupedo_params(largo=3.2, patas=1.6, grosorPatas=0.22, tipoPatas='ave', cuello=2.0, anguloCuello=75,
                                     grosorCuello=0.4, cabeza=0.9, hocico=0.7, orejas=0.3, cola=0.5, grosorCola=0.25,
                                     anguloCola=35, colmillos=False, color='#9a4a2a',
                                     cuernos=[{'largo': 0.9, 'direccion': 'lado', 'forma': 'hoja'}])),
    'reptil': dict(
        unidad='D, la profundidad del torso', dibuja=cuadrupedo, suelo=True,
        parametros=cuadrupedo_params(largo=2.8, patas=0.7, grosorPatas=0.28, tipoPatas='reptil', flexion=0, cuello=0.35,
                                     anguloCuello=10, grosorCuello=0.75, cabeza=1.0, hocico=0.9, orejas=0, cola=3.0,
                                     grosorCola=0.8, anguloCola=8, colmillos=False, color='#6f7a4a',
                                     cresta={'forma': 'puas', 'alto': 0.25, 'hasta': 'cola'})),
    'ave': dict(
        unidad='T, el largo del torso (sin cabeza ni cola)', dibuja=ave, suelo=False,
        parametros={
            'hondo': num(0.45, 0.2, 0.9, 'profundidad del torso'),
            'envergadura': num(3.5, 1.5, 7, 'de punta a punta de las alas'),
            'cuerdaAla': num(0.6, 0.2, 1.5, 'ancho del ala en la raíz'),
            'alas': num(38, 10, 70, 'grados que suben las alas sobre la horizontal (la V)'),
            'plumas': num(6, 3, 12, 'plumas primarias dentadas por ala'),
            'cabeza': num(0.6, 0.2, 1.2, 'largo de la cabeza con el pico'),
            'pico': opcion('gancho', ('gancho', 'recto'), 'forma del pico'),
            'cola': num(0.6, 0.1, 2, 'largo de la cola'),
            'patas': num(0.8, 0.2, 2, 'largo de las patas colgando'),
            'inclinacion': num(-15, -45, 45, 'grados del cuerpo (negativo = picado, la cabeza baja)'),
            'cresta': CRESTA,
            'color': color('#4a3a30', 'color del cuerpo'),
            **COMUNES,
        }),
    'alargado': dict(
        unidad='G, el grosor del cuerpo', dibuja=alargado, suelo=True,
        parametros={
            'largo': num(30, 8, 60, 'largo total del cuerpo'),
            'lazos': num(2, 1, 6, 'lazos de la pila'),
            'alzada': num(0.3, 0.1, 0.5, 'parte del largo que se alza en S (0,33 = el tercio delantero)'),
            'cola': num(4, 1, 12, 'largo de la cola que asoma'),
            'cabeza': num(1.8, 0.8, 4, 'largo de la cabeza'),
            'lengua': booleano(True, 'lengua bífida'),
            'cresta': CRESTA,
            'color': color('#7a6a5a', 'color del cuerpo'),
            **COMUNES,
        }),
    'artropodo': dict(
        unidad='C, el largo del cefalotórax', dibuja=artropodo, suelo=True,
        parametros={
            'abdomen': num(1.5, 0.3, 5, 'largo del abdomen'),
            'segmentos': num(5, 1, 12, 'segmentos del abdomen'),
            'patas': num(8, 2, 14, 'patas en total (6 u 8 por lo común)'),
            'largoPatas': num(0.9, 0.3, 2.5, 'largo de cada pata'),
            'grosorPatas': num(0.08, 0.02, 0.3, 'grosor de las patas'),
            'pinzas': booleano(True, 'dos pinzas delante'),
            'antenas': booleano(False, 'dos antenas'),
            'cola': num(1.6, 0, 4, 'largo de la cola arqueada con aguijón (0 = sin cola)'),
            'ojos': num(4, 1, 10, 'ojos en fila sobre el cefalotórax (F9: la cuenta va en el boceto)'),
            'color': color('#6a2a28', 'color del cuerpo'),
            **COMUNES,
        }),
}


def validar(plan: str, dados: dict) -> dict:
    """Los parámetros del plan con sus valores por defecto y los dados, comprobados; ErrorPlantilla con el motivo."""
    if plan not in PLANES:
        raise ErrorPlantilla(f'plan «{plan}» desconocido; los planes son: {", ".join(PLANES)}')
    esquema = PLANES[plan]['parametros']
    extra = set(dados) - set(esquema)
    if extra:
        raise ErrorPlantilla(f'el plan «{plan}» no tiene el parámetro «{sorted(extra)[0]}»; tiene: {", ".join(esquema)}')
    valores = {}
    for k, e in esquema.items():
        v = dados.get(k, e['defecto'])
        if e['tipo'] == 'num':
            if isinstance(v, bool) or not isinstance(v, (int, float)):
                raise ErrorPlantilla(f'«{k}» tiene que ser un número ({e["doc"]}); vino {v!r}')
            if not e['min'] <= v <= e['max']:
                raise ErrorPlantilla(f'«{k}»={v} fuera de rango [{e["min"]}, {e["max"]}] ({e["doc"]}, en la unidad del plan)')
        elif e['tipo'] == 'opcion' and v not in e['opciones']:
            raise ErrorPlantilla(f'«{k}»={v!r} no vale; las opciones son: {", ".join(e["opciones"])}')
        elif e['tipo'] == 'bool' and not isinstance(v, bool):
            raise ErrorPlantilla(f'«{k}» tiene que ser true o false ({e["doc"]}); vino {v!r}')
        elif e['tipo'] == 'color' and not (isinstance(v, str) and len(v) == 7 and v[0] == '#'):
            raise ErrorPlantilla(f'«{k}» tiene que ser un color #rrggbb; vino {v!r}')
        elif e['tipo'] == 'cresta' and v is not None:
            if not isinstance(v, dict) or v.get('forma') not in ('puas', 'losas', 'banda'):
                raise ErrorPlantilla(f'«cresta» tiene que ser null o un objeto con forma puas, losas o banda; vino {v!r}')
            if not isinstance(v.get('alto'), (int, float)) or not 0.05 <= v['alto'] <= 3:
                raise ErrorPlantilla(f'«cresta.alto» tiene que ser un número entre 0,05 y 3 (en la unidad del plan); vino {v.get("alto")!r}')
            if v.get('hasta', 'cola') not in ('cola', 'grupa'):
                raise ErrorPlantilla(f'«cresta.hasta» es cola o grupa; vino {v.get("hasta")!r}')
        elif e['tipo'] == 'cuernos':
            if not isinstance(v, list):
                raise ErrorPlantilla(f'«cuernos» tiene que ser una lista; vino {v!r}')
            for c in v:
                if not isinstance(c, dict) or not isinstance(c.get('largo'), (int, float)) or not 0.05 <= c['largo'] <= 4:
                    raise ErrorPlantilla(f'cada cuerno lleva «largo» entre 0,05 y 4 (en la unidad del plan); vino {c!r}')
                if c.get('direccion') not in ('lado', 'arriba', 'adelante', 'nariz', 'mandibula', 'abajo'):
                    raise ErrorPlantilla(f'cada cuerno lleva «direccion» lado, arriba, adelante, nariz, mandibula o abajo; vino {c!r}')
                if c.get('forma', 'punta') not in ('punta', 'hoja'):
                    raise ErrorPlantilla(f'«forma» del cuerno es punta u hoja; vino {c.get("forma")!r}')
        valores[k] = v
    return valores


# ----------------------------------------------------------------------------- composición


def componer(plan: str, dados: dict, titulo: str = '') -> str:
    p = validar(plan, dados)
    z = Lienzo()
    horizonte = PLANES[plan]['dibuja'](z, p)
    xs = [x for x, _ in z.puntos]
    ys = [y for _, y in z.puntos]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    w, h = max(x1 - x0, 1e-6), max(y1 - y0, 1e-6)
    s = min((ANCHO - 2 * MARGEN) / w, (Y_PIES - Y_MIN) / h)
    tx = (ANCHO - w * s) / 2 - x0 * s
    suelo = PLANES[plan]['suelo']
    ty = Y_PIES - y1 * s if suelo else (Y_MIN + Y_PIES) / 2 - (y0 + y1) / 2 * s
    y_h = max(200, min(430, ty + horizonte * s)) if suelo else 400
    arriba, abajo, tierra = CIELOS[p['momento']]
    sombra_rx = (0.48 if suelo else 0.3) * w * s
    sombra_ry = max(10, min(26, 0.05 * w * s))
    cuerpo = '\n'.join(z.svg)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{ANCHO}" height="{ALTO}" viewBox="0 0 {ANCHO} {ALTO}">
<!-- {titulo or plan}: boceto generado por bocetos/plantilla.py (IMG-24), plan «{plan}». No se edita a mano: se cambian
     los números de la ficha. -->
<defs><linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{arriba}"/><stop offset="1" stop-color="{abajo}"/></linearGradient></defs>
<rect class="fondo" width="{ANCHO}" height="{ALTO}" fill="url(#cielo)"/>
<rect class="fondo" y="{n(y_h)}" width="{ANCHO}" height="{n(ALTO - y_h)}" fill="{tierra}"/>
<ellipse class="sombra" cx="{n(tx + (x0 + x1) / 2 * s)}" cy="{n(Y_PIES - 4)}" rx="{n(sombra_rx)}" ry="{n(sombra_ry)}" fill="#4a1d12" opacity=".5"/>
<g transform="translate({n(tx)} {n(ty)}) scale({n(s)})">
{cuerpo}
</g>
</svg>
'''


def desde_ficha(ruta: str):
    with open(ruta, encoding='utf-8') as f:
        ficha = json.load(f)
    boceto = ficha.get('boceto')
    if not isinstance(boceto, dict) or 'plan' not in boceto:
        raise ErrorPlantilla(f'{ruta}: la ficha no tiene «boceto.plan» (plan corporal y sus números, IMG-24)')
    dados = {k: v for k, v in boceto.items() if k not in ('plan', 'fuerza', 'archivo')}
    if 'momento' not in dados and ficha.get('momento') in CIELOS:
        dados['momento'] = ficha['momento']
    nombre = ficha.get('slug') or os.path.splitext(os.path.basename(ruta))[0]
    return boceto['plan'], dados, nombre, ficha.get('nombre', nombre)


def listar_planes() -> str:
    lineas = []
    for nombre, plan in PLANES.items():
        lineas.append(f'{nombre}: unidad {plan["unidad"]}')
        for k, e in plan['parametros'].items():
            rango = f' [{e["min"]}, {e["max"]}]' if e['tipo'] == 'num' else ''
            lineas.append(f'  {k} = {json.dumps(e["defecto"], ensure_ascii=False)}{rango}  {e["doc"]}')
    return '\n'.join(lineas)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('ficha', nargs='?', help='ficha JSON con «boceto.plan»')
    ap.add_argument('--plan', help='plan corporal con sus valores por defecto')
    ap.add_argument('-p', '--parametro', action='append', default=[], metavar='clave=valor',
                    help='cambia un parámetro (el valor, en JSON: 3.5, true, \'{"forma":"losas","alto":0.4}\')')
    ap.add_argument('-o', '--salida', help='ruta del SVG (- para stdout); por defecto bocetos/<slug|plan>.svg')
    ap.add_argument('--planes', action='store_true', help='lista los planes y sus parámetros')
    a = ap.parse_args(argv)
    if a.planes:
        print(listar_planes())
        return 0
    try:
        if a.ficha:
            plan, dados, nombre, titulo = desde_ficha(a.ficha)
        elif a.plan:
            plan, dados, nombre, titulo = a.plan, {}, a.plan, a.plan
        else:
            ap.error('hace falta una ficha, --plan o --planes')
        for par in a.parametro:
            if '=' not in par:
                raise ErrorPlantilla(f'parámetro «{par}» sin «=»')
            k, v = par.split('=', 1)
            try:
                dados[k] = json.loads(v)
            except json.JSONDecodeError:
                dados[k] = v
        svg = componer(plan, dados, titulo)
    except (ErrorPlantilla, OSError, json.JSONDecodeError) as e:
        print(f'plantilla.py: {e}', file=sys.stderr)
        return 2
    if a.salida == '-':
        sys.stdout.write(svg)
        return 0
    salida = a.salida or os.path.join(CARPETA, nombre + '.svg')
    with open(salida, 'w', encoding='utf-8') as f:
        f.write(svg)
    print(salida)
    return 0


if __name__ == '__main__':
    sys.exit(main())
