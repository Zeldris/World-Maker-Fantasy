#!/usr/bin/env python3
"""IMG-27: HERO y MANADA de montar.sh desde el `encuadre` de la ficha, a la medida del lienzo.

Todo va en fracciones del lienzo, así que escala con el ancho. Perspectiva de suelo plano: la manada pisa entre el
horizonte y los pies del sujeto, y cada copia mide, respecto al sujeto, lo mismo que su pie dista del horizonte
respecto al del sujeto. Las copias menguan de una en una (F9: por tamaños, no por número) y la mayor va al lado libre.
  "encuadre": {"horizonte": 0.4,
               "sujeto": {"lado": "izquierda|centro|derecha", "ancho": 0.45, "pie": 0.96},
               "manada": {"numero": 3, "distancia": "cerca|media|lejos", "alternar": false}}
Lo que falta toma el valor por defecto; sin `prompt.manada`, la manada por defecto es de cero.
Uso: encuadre.py <ficha.json>|- <ancho> <alto>  →  HERO=x:pie:ancho y MANADA='x:pie:ancho[:v] …' (para eval)
Sale con 2 y el motivo si un valor está fuera de rango.
"""
import json
import shlex
import sys

from prompt_ficha import ReglaRota

MARGEN = 0.03  # del ancho, entre el sujeto y el borde
DISTANCIAS = {'cerca': 0.6, 'media': 0.35, 'lejos': 0.18}  # fracción del camino del horizonte al pie del sujeto
MENGUA = 0.5  # la copia más lejana mide esta fracción de la más cercana
POR_DEFECTO = {'horizonte': 0.4, 'sujeto': {'lado': 'izquierda', 'ancho': 0.45, 'pie': 0.96},
               'manada': {'numero': 3, 'distancia': 'media', 'alternar': False}}


def _num(valor, nombre, minimo, maximo):
    if isinstance(valor, bool) or not isinstance(valor, (int, float)) or not minimo <= valor <= maximo:
        raise ReglaRota(f'{nombre}={valor!r} fuera de rango (de {minimo} a {maximo})')
    return valor


def _opcion(valor, nombre, opciones):
    if valor not in opciones:
        raise ReglaRota(f'{nombre}={valor!r}; los que hay son: {", ".join(opciones)}')
    return valor


def leer(ficha: dict) -> dict:
    """El encuadre de la ficha completado con los valores por defecto y validado."""
    e = ficha.get('encuadre') or {}
    s = {**POR_DEFECTO['sujeto'], **(e.get('sujeto') or {})}
    m = {**POR_DEFECTO['manada'], **({} if (ficha.get('prompt') or {}).get('manada') else {'numero': 0}),
         **(e.get('manada') or {})}
    hz = _num(e.get('horizonte', POR_DEFECTO['horizonte']), 'horizonte', 0.1, 0.8)
    _opcion(s['lado'], 'sujeto.lado', ('izquierda', 'centro', 'derecha'))
    _num(s['ancho'], 'sujeto.ancho', 0.1, 1.0)
    _num(s['pie'], 'sujeto.pie', round(hz + 0.1, 2), 1.0)
    if isinstance(m['numero'], bool) or not isinstance(m['numero'], int):
        raise ReglaRota(f'manada.numero={m["numero"]!r} tiene que ser un entero')
    _num(m['numero'], 'manada.numero', 0, 8)
    _opcion(m['distancia'], 'manada.distancia', tuple(DISTANCIAS))
    if not isinstance(m['alternar'], bool):
        raise ReglaRota(f'manada.alternar={m["alternar"]!r} tiene que ser true o false')
    return {'horizonte': hz, 'sujeto': s, 'manada': m}


def posiciones(enc: dict, ancho: int, alto: int) -> tuple:
    """(HERO, MANADA) en píxeles del lienzo; la manada, de la copia más lejana a la más cercana (orden de pintado)."""
    hz, s, m = enc['horizonte'], enc['sujeto'], enc['manada']
    hw = round(s['ancho'] * ancho)
    hx = {'izquierda': round(MARGEN * ancho), 'centro': (ancho - hw) // 2,
          'derecha': ancho - hw - round(MARGEN * ancho)}[s['lado']]
    hero = f'{hx}:{round(s["pie"] * alto)}:{hw}'
    n, k = m['numero'], DISTANCIAS[m['distancia']]
    copias = []
    for i in range(n):  # i = 0, la más cercana
        f = k * (1 - MENGUA * i / (n - 1)) if n > 1 else k
        w = max(1, round(f * hw))
        hueco = i if s['lado'] == 'derecha' or s['lado'] == 'centro' else n - 1 - i  # la mayor, al lado libre
        x = min(max(0, round((hueco + 0.5) / n * ancho - w / 2)), ancho - w)
        pie = round((hz + f * (s['pie'] - hz)) * alto)
        copias.append(f'{x}:{pie}:{w}' + (':v' if m['alternar'] and i % 2 else ''))
    return hero, ' '.join(reversed(copias))


def main(argv=None) -> int:
    a = sys.argv[1:] if argv is None else argv
    if len(a) != 3 or not a[1].isdigit() or not a[2].isdigit():
        print(__doc__.split('Uso: ')[1].split('\n')[0], file=sys.stderr)
        return 2
    try:
        if a[0] == '-':
            ficha = {'prompt': {'manada': 'por defecto'}}
        else:
            with open(a[0], encoding='utf-8') as f:
                ficha = json.load(f)
        hero, manada = posiciones(leer(ficha), int(a[1]), int(a[2]))
    except (OSError, ValueError, ReglaRota) as e:
        print(f'encuadre: {e}', file=sys.stderr)
        return 2
    print(f'HERO={shlex.quote(hero)}')
    print(f'MANADA={shlex.quote(manada)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
