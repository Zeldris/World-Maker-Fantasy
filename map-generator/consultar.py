#!/usr/bin/env python3
"""MAP-16: consultar helek.json desde la consola, de SOLO LECTURA, para armar lotes de `editar.py` sin ver el mapa.

    python3 map-generator/consultar.py resumen                        # tamaño, regiones, provincias, continentes e i libres
    python3 map-generator/consultar.py celda 540 190                  # la celda de centro más cercano al punto (también: celda --i 1715)
    python3 map-generator/consultar.py region "Meseta"                # celdas, envolvente en km, capital, provincias, vecinas, mar
    python3 map-generator/consultar.py frontera "Llanuras" "Meseta"   # celdas de A que lindan con B y de B con A, de norte a sur
    python3 map-generator/consultar.py frontera "Llanuras" mar        # B puede ser `mar`
    python3 map-generator/consultar.py costa Vaelira                  # tierra con vecina de mar y mar junto a tierra (candidata a tierra)
    python3 map-generator/consultar.py lugares --cerca 540 190 --radio 50    # (o --region R)
    python3 map-generator/consultar.py fichas --sin-lugar             # slugs de la enciclopedia (o --region R)
    opciones: --json (salida en JSON), --mundo RUTA (una copia), --caja X0 Y0 X1 Y1 (frontera, costa y lugares: solo lo
              que cae dentro, por centro de celda o posición), --canon RUTA (lugares)

Los números son los de `editar.py`: `celda` y `h` (tierra si h >= 20), `region` y `provincia` (0 = ninguna), el mapa es de
800 x 600 con 1 unidad ≈ 1 km y la y crece hacia el SUR. Un punto (x, y) cae en la celda de centro más cercano, como en
los lotes. Los nombres no distinguen mayúsculas ni tildes y valen fragmentos si identifican uno solo; un número es el i.
Si un nombre es ambiguo o no existe, sale con 1 y el error lista los candidatos. En `costa` y `celda` se marca lo de
Berig, que `editar.py` no deja tocar sin `"bloqueo": []`. Nunca escribe nada. Todo sale en orden estable.
"""
import argparse
import json
import math
import os
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import editar  # noqa: E402
import enciclopedia  # noqa: E402
import medir  # noqa: E402

TIERRA = editar.TIERRA


class ErrorDeConsulta(ValueError):
    """La consulta no se puede responder; el mensaje dice por qué."""


def normaliza(s):
    d = unicodedata.normalize('NFD', str(s))
    return ''.join(ch for ch in d if not unicodedata.combining(ch)).casefold().strip()


def _nombres(entradas):
    return ', '.join(f"{e['nombre']} ({e['i']})" for e in entradas)


def resolver(entradas, ref, que):
    """La entrada (dict con `i` y `nombre`) que `ref` identifica: i, nombre exacto o fragmento único."""
    ref = str(ref)
    if ref.strip().lstrip('-').isdigit():
        por_i = [e for e in entradas if e['i'] == int(ref)]
        if por_i:
            return por_i[0]
        raise ErrorDeConsulta(f'no existe {que} con i {ref}; hay: {_nombres(entradas)}')
    n = normaliza(ref)
    exactos = [e for e in entradas if normaliza(e['nombre']) == n]
    cands = exactos or [e for e in entradas if n and n in normaliza(e['nombre'])]
    if len(cands) == 1:
        return cands[0]
    if not cands:
        raise ErrorDeConsulta(f'no existe {que} «{ref}»; hay: {_nombres(entradas)}')
    raise ErrorDeConsulta(f'«{ref}» es ambiguo como {que}; candidatos: {_nombres(cands)}')


def dentro(caja, x, y):
    return caja is None or (caja[0] <= x <= caja[2] and caja[1] <= y <= caja[3])


def _orden_ns(c):
    return (c['p'][1], c['p'][0], c['i'])


def _ctx(mundo):
    return {'celdas': mundo['celdas'],
            'region': {r['i']: r['nombre'] for r in mundo['regiones']},
            'provincia': {p['i']: p['nombre'] for p in mundo['provincias']},
            'continente': {k['i']: k['nombre'] for k in mundo['continentes']},
            'bioma': {b['i']: b['nombre'] for b in mundo['biomas']}}


def _nombre(tabla, i):
    return tabla.get(i, 'ninguna') if i else 'ninguna'


def _ficha_celda(x, c, bloqueo=None):
    f = {'i': c['i'], 'centro': c['p'], 'h': c['h'], 'tipo': 'tierra' if c['h'] >= TIERRA else 'mar'}
    if bloqueo is not None:
        f['berig'] = c['i'] in bloqueo
    return f


# ---------------------------------------------------------------- subórdenes

def resumen(mundo, caja=None):
    x = _ctx(mundo)
    cuenta = {}
    for c in mundo['celdas']:
        if c['h'] >= TIERRA:
            cuenta[c['region']] = cuenta.get(c['region'], 0) + 1
    lugares = {lu['i']: lu for lu in mundo['lugares']}
    f = mundo['fuente']

    def libre(lista):
        return max((e['i'] for e in lista), default=-1) + 1
    return {
        'mapa': {'ancho': f['ancho'], 'alto': f['alto'], 'kmPorUnidad': f['kmPorUnidad'],
                 'orientacion': 'x crece al este, y crece al sur', 'celdas': len(mundo['celdas'])},
        'regiones': [{'i': r['i'], 'nombre': r['nombre'], 'celdas': cuenta.get(r['i'], 0),
                      'capital': lugares.get(r['capital'], {}).get('nombre'),
                      'continente': _continente_de(mundo, r['i'])} for r in mundo['regiones']],
        'provincias': [{'i': p['i'], 'nombre': p['nombre'], 'region': p['region'],
                        'regionNombre': _nombre(x['region'], p['region'])} for p in mundo['provincias']],
        'continentes': [{'i': k['i'], 'nombre': k['nombre'], 'celdas': k['celdas']} for k in mundo['continentes']],
        'lugares': len(mundo['lugares']), 'rutas': len(mundo['rutas']), 'rios': len(mundo['rios']),
        'libres': {'lugar': libre(mundo['lugares']), 'ruta': libre(mundo['rutas']), 'rio': libre(mundo['rios']),
                   'provincia': libre(mundo['provincias'])},
    }


def _continente_de(mundo, region):
    cs = sorted({c['continente'] for c in mundo['celdas'] if c['h'] >= TIERRA and c['region'] == region})
    nombres = {k['i']: k['nombre'] for k in mundo['continentes']}
    return ', '.join(nombres.get(i, str(i)) for i in cs) or None


def celda(mundo, xy=None, i=None):
    celdas = mundo['celdas']
    if i is not None:
        if not 0 <= i < len(celdas):
            raise ErrorDeConsulta(f'no existe la celda {i} (hay {len(celdas)}: 0-{len(celdas) - 1})')
        c = celdas[i]
    else:
        ancho, alto = mundo['fuente']['ancho'], mundo['fuente']['alto']
        if not (0 <= xy[0] <= ancho and 0 <= xy[1] <= alto):
            raise ErrorDeConsulta(f'el punto {list(xy)} no está dentro del mapa (0-{ancho} × 0-{alto})')
        c = celdas[editar._localizador(mundo)(xy[0], xy[1])]
    x = _ctx(mundo)
    zona = editar._zona_bloqueada(mundo, editar._bloqueo(mundo, {}))
    f = _ficha_celda(x, c, zona)
    f.update({'bioma': x['bioma'].get(c['bioma']), 'region': c['region'], 'regionNombre': _nombre(x['region'], c['region']),
              'provincia': c['provincia'], 'provinciaNombre': _nombre(x['provincia'], c['provincia']),
              'continente': c['continente'], 'continenteNombre': _nombre(x['continente'], c['continente']),
              'lugares': [lu['i'] for lu in mundo['lugares'] if lu['celda'] == c['i']],
              'vecinas': [{'i': v['i'], 'h': v['h'], 'region': v['region'],
                           'regionNombre': _nombre(x['region'], v['region'])}
                          for v in (celdas[j] for j in sorted(c['c']))]})
    return f


def region(mundo, ref):
    r = resolver(mundo['regiones'], ref, 'región')
    celdas = mundo['celdas']
    x = _ctx(mundo)
    propias = [c for c in celdas if c['h'] >= TIERRA and c['region'] == r['i']]
    m = medir._medida(mundo, lambda c, i=r['i']: c['region'] == i)
    caja = m['caja']
    vecinas = sorted({celdas[j]['region'] for c in propias for j in c['c']
                      if celdas[j]['h'] >= TIERRA and celdas[j]['region'] not in (0, r['i'])})
    capital = next((lu for lu in mundo['lugares'] if lu['i'] == r['capital']), None)
    return {'i': r['i'], 'nombre': r['nombre'], 'celdas': len(propias),
            'envolvente': {'caja': [round(v, 1) for v in caja] if caja else None,
                           'este_oeste_km': round(m['envolvente'][0], 1), 'norte_sur_km': round(m['envolvente'][1], 1)},
            'capital': {'i': capital['i'], 'nombre': capital['nombre']} if capital else None,
            'continente': _continente_de(mundo, r['i']),
            'provincias': [{'i': p['i'], 'nombre': p['nombre']} for p in mundo['provincias'] if p['region'] == r['i']],
            'vecinas': [{'i': i, 'nombre': _nombre(x['region'], i)} for i in vecinas],
            'tocaMar': any(celdas[j]['h'] < TIERRA for c in propias for j in c['c'])}


def frontera(mundo, a, b, caja=None):
    celdas = mundo['celdas']
    x = _ctx(mundo)

    def lado(ref):
        if normaliza(ref) == 'mar':
            return {'i': None, 'nombre': 'mar'}, lambda c: c['h'] < TIERRA
        r = resolver(mundo['regiones'], ref, 'región o «mar»')
        return r, lambda c, i=r['i']: c['h'] >= TIERRA and c['region'] == i
    ra, en_a = lado(a)
    rb, en_b = lado(b)
    if ra['i'] == rb['i']:
        raise ErrorDeConsulta(f"la frontera de «{ra['nombre']}» consigo misma no tiene sentido")

    def linda(en_x, en_y):
        return sorted((c for c in celdas if en_x(c) and any(en_y(celdas[j]) for j in c['c'])), key=_orden_ns)

    def filas(cs):
        return [{'i': c['i'], 'centro': c['p'], 'h': c['h']} for c in cs if dentro(caja, *c['p'])]
    return {'a': ra['nombre'], 'b': rb['nombre'], 'deA': filas(linda(en_a, en_b)), 'deB': filas(linda(en_b, en_a))}


def costa(mundo, ref, caja=None):
    cands = ([dict(r, tabla='región') for r in mundo['regiones']] +
             [dict(k, tabla='continente') for k in mundo['continentes']])
    if str(ref).strip().isdigit():
        por_i = [e for e in cands if e['i'] == int(ref)]
        if len(por_i) > 1:
            raise ErrorDeConsulta(f'el i {ref} es a la vez región y continente; usa el nombre: {_nombres(por_i)}')
    e = resolver(cands, ref, 'región o continente')
    clave = 'region' if e['tabla'] == 'región' else 'continente'
    celdas = mundo['celdas']
    zona = editar._zona_bloqueada(mundo, editar._bloqueo(mundo, {}))
    tierra = [c for c in celdas if c['h'] >= TIERRA and c[clave] == e['i']
              and any(celdas[j]['h'] < TIERRA for j in c['c'])]
    mar = sorted({j for c in tierra for j in c['c'] if celdas[j]['h'] < TIERRA})

    def filas(cs):
        return [{'i': c['i'], 'centro': c['p'], 'h': c['h'], 'berig': c['i'] in zona}
                for c in sorted(cs, key=_orden_ns) if dentro(caja, *c['p'])]
    return {'ref': e['nombre'], 'tipo': e['tabla'], 'tierra': filas(tierra), 'mar': filas([celdas[j] for j in mar]),
            'bloqueadoPorDefecto': editar.BLOQUEO_DEFECTO}


def lugares(mundo, canon, ref_region=None, cerca=None, radio=50.0, caja=None):
    x = _ctx(mundo)
    r = resolver(mundo['regiones'], ref_region, 'región') if ref_region is not None else None
    protegidos = editar._nombres_del_canon(canon)
    celdas = mundo['celdas']
    salida = []
    for lu in mundo['lugares']:
        if r is not None and lu['region'] != r['i']:
            continue
        if not dentro(caja, lu['x'], lu['y']):
            continue
        d = math.dist((lu['x'], lu['y']), cerca) if cerca else None
        if cerca and d > radio:
            continue
        f = {'i': lu['i'], 'nombre': lu['nombre'], 'slug': lu.get('slug'), 'x': lu['x'], 'y': lu['y'],
             'celda': lu['celda'], 'region': lu['region'], 'regionNombre': _nombre(x['region'], lu['region']),
             'capital': bool(lu.get('capital')), 'protegido': lu['nombre'] in protegidos}
        if cerca:
            f['km'] = round(d * mundo['fuente']['kmPorUnidad'], 1)
        salida.append(f)
    salida.sort(key=(lambda f: (f['km'], f['i'])) if cerca else (lambda f: f['i']))
    return salida


def fichas(mundo, catalogo, ref_region=None, sin_lugar=False):
    r = resolver(mundo['regiones'], ref_region, 'región') if ref_region is not None else None
    por_slug = {}
    for lu in sorted(mundo['lugares'], key=lambda lu: lu['i']):
        if lu.get('slug'):
            por_slug.setdefault(lu['slug'], lu['i'])
    salida = []
    for f in catalogo:
        if r is not None and normaliza(r['nombre']) not in normaliza(f['region']):
            continue
        lugar = por_slug.get(f['slug'])
        if sin_lugar and lugar is not None:
            continue
        salida.append({**f, 'lugar': lugar})
    return sorted(salida, key=lambda f: f['slug'])


# ---------------------------------------------------------------- texto

def _pt(p):
    return f'({p[0]:g}, {p[1]:g})'


def texto_resumen(r):
    m = r['mapa']
    t = [f"Mapa {m['ancho']} x {m['alto']} (1 unidad = {m['kmPorUnidad']:g} km; {m['orientacion']}); {m['celdas']} celdas.",
         'Regiones:']
    t += [f"  {e['i']:>3} {e['nombre']} · {e['celdas']} celdas · capital {e['capital']} · {e['continente']}" for e in r['regiones']]
    t.append('Provincias:')
    t += [f"  {e['i']:>3} {e['nombre']} · región {e['region']} ({e['regionNombre']})" for e in r['provincias']] or ['  (ninguna)']
    t.append('Continentes:')
    t += [f"  {e['i']:>3} {e['nombre']} · {e['celdas']} celdas" for e in r['continentes']]
    l = r['libres']
    t.append(f"Lugares {r['lugares']}, rutas {r['rutas']}, ríos {r['rios']}.")
    t.append(f"i libres siguientes: lugar {l['lugar']}, ruta {l['ruta']}, río {l['rio']}, provincia {l['provincia']}.")
    return '\n'.join(t)


def texto_celda(c):
    t = [f"Celda {c['i']} · centro {_pt(c['centro'])} · h {c['h']} ({c['tipo']})" + (' · BERIG (bloqueada por defecto)' if c['berig'] else ''),
         f"  bioma {c['bioma']} · región {c['region']} {c['regionNombre']} · provincia {c['provincia']} {c['provinciaNombre']}"
         f" · continente {c['continente']} {c['continenteNombre']}"]
    if c['lugares']:
        t.append('  lugares: ' + ', '.join(map(str, c['lugares'])))
    t.append('  vecinas: ' + '; '.join(f"{v['i']} (h {v['h']}, región {v['region']})" for v in c['vecinas']))
    return '\n'.join(t)


def texto_region(r):
    e = r['envolvente']
    caja = f"x {e['caja'][0]:g}-{e['caja'][2]:g}, y {e['caja'][1]:g}-{e['caja'][3]:g}" if e['caja'] else 'sin tierra'
    return '\n'.join([
        f"Región {r['i']} {r['nombre']} · {r['celdas']} celdas · continente {r['continente']}",
        f"  envolvente {caja} ({e['este_oeste_km']:g} km E-O × {e['norte_sur_km']:g} km N-S)",
        f"  capital: {r['capital']['i']} {r['capital']['nombre']}" if r['capital'] else '  sin capital',
        '  provincias: ' + (', '.join(f"{p['i']} {p['nombre']}" for p in r['provincias']) or 'ninguna'),
        '  vecinas: ' + (', '.join(f"{p['i']} {p['nombre']}" for p in r['vecinas']) or 'ninguna'),
        f"  toca el mar: {'sí' if r['tocaMar'] else 'no'}"])


def _lista(titulo, filas, marca=False):
    t = [f'{titulo} ({len(filas)}):']
    for f in filas:
        t.append(f"  {f['i']:>5} {_pt(f['centro'])} h {f['h']}" + (' BERIG' if marca and f.get('berig') else ''))
    return t


def texto_frontera(r):
    return '\n'.join([f"Frontera {r['a']} / {r['b']}"] + _lista(f"Celdas de {r['a']} que lindan con {r['b']}", r['deA'])
                     + _lista(f"Celdas de {r['b']} que lindan con {r['a']}", r['deB']))


def texto_costa(r):
    t = [f"Costa de {r['ref']} ({r['tipo']}); BERIG = bloqueado por defecto en editar.py"]
    return '\n'.join(t + _lista('Tierra con vecina de mar', r['tierra'], True)
                     + _lista('Mar junto a esa tierra (candidatas a tierra)', r['mar'], True))


def texto_lugares(ls):
    t = [f'Lugares ({len(ls)}):']
    for f in ls:
        extra = ('  CAPITAL' if f['capital'] else '') + ('  CANON' if f['protegido'] else '') + (f"  {f['km']:g} km" if 'km' in f else '')
        t.append(f"  {f['i']:>4} {f['nombre']} · slug {f['slug'] or '-'} · {_pt([f['x'], f['y']])} · celda {f['celda']}"
                 f" · región {f['region']} {f['regionNombre']}{extra}")
    return '\n'.join(t)


def texto_fichas(fs):
    t = [f'Fichas ({len(fs)}):']
    for f in fs:
        t.append(f"  {f['slug']} · {f['nombre']} · {f['tipo']} · {f['region']} · "
                 + (f"lugar {f['lugar']}" if f['lugar'] is not None else 'SIN LUGAR'))
    return '\n'.join(t)


# ---------------------------------------------------------------- consola

def main(argv=None):
    comun = argparse.ArgumentParser(add_help=False)
    comun.add_argument('--json', action='store_true', help='salida en JSON')
    comun.add_argument('--mundo', default=medir.MUNDO, help='helek.json (una copia, por ejemplo)')
    caja = argparse.ArgumentParser(add_help=False)
    caja.add_argument('--caja', nargs=4, type=float, metavar=('X0', 'Y0', 'X1', 'Y1'), help='solo lo que cae dentro')
    ap = argparse.ArgumentParser(description='Consulta (solo lectura) las celdas, lugares y fichas del mapa de Helek.')
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('resumen', parents=[comun], help='tamaño, regiones, provincias, continentes e i libres')
    p = sub.add_parser('celda', parents=[comun], help='la celda de centro más cercano a X Y, o --i N')
    p.add_argument('xy', nargs='*', type=float, metavar='X Y')
    p.add_argument('--i', type=int)
    p = sub.add_parser('region', parents=[comun], help='envolvente, capital, provincias y vecinas')
    p.add_argument('region')
    p = sub.add_parser('frontera', parents=[comun, caja], help='celdas que lindan entre dos regiones (o con el mar)')
    p.add_argument('a')
    p.add_argument('b')
    p = sub.add_parser('costa', parents=[comun, caja], help='tierra con vecina de mar y mar junto a tierra')
    p.add_argument('ref', metavar='REGION|CONTINENTE')
    p = sub.add_parser('lugares', parents=[comun, caja], help='lugares del mapa')
    p.add_argument('--region')
    p.add_argument('--cerca', nargs=2, type=float, metavar=('X', 'Y'))
    p.add_argument('--radio', type=float, default=50.0, help='km, con --cerca (50)')
    p.add_argument('--canon', default=medir.CANON)
    p = sub.add_parser('fichas', parents=[comun], help='fichas de la enciclopedia y si tienen lugar')
    p.add_argument('--region')
    p.add_argument('--sin-lugar', action='store_true')
    args = ap.parse_args(argv)

    def fallo(motivo):
        print(json.dumps({'error': motivo}, ensure_ascii=False) if args.json else f'error: {motivo}',
              file=sys.stdout if args.json else sys.stderr)
        return 1
    try:
        mundo = medir.cargar(args.mundo)
    except (OSError, ValueError) as e:
        return fallo(f'no se puede leer {args.mundo}: {e}')
    caj = getattr(args, 'caja', None)
    if caj and (caj[0] > caj[2] or caj[1] > caj[3]):
        return fallo('--caja X0 Y0 X1 Y1 necesita X0 <= X1 y Y0 <= Y1')
    try:
        if args.cmd == 'resumen':
            res, txt = resumen(mundo), texto_resumen
        elif args.cmd == 'celda':
            if (args.i is None) == (len(args.xy) != 2) or (args.i is not None and args.xy):
                raise ErrorDeConsulta('da la posición (celda X Y) o bien --i N')
            res, txt = celda(mundo, args.xy, args.i), texto_celda
        elif args.cmd == 'region':
            res, txt = region(mundo, args.region), texto_region
        elif args.cmd == 'frontera':
            res, txt = frontera(mundo, args.a, args.b, caj), texto_frontera
        elif args.cmd == 'costa':
            res, txt = costa(mundo, args.ref, caj), texto_costa
        elif args.cmd == 'lugares':
            res, txt = lugares(mundo, editar.cargar_json(args.canon), args.region, args.cerca, args.radio, caj), texto_lugares
        else:
            res, txt = fichas(mundo, enciclopedia.lugares(), args.region, args.sin_lugar), texto_fichas
    except (ErrorDeConsulta, ValueError, OSError) as e:
        return fallo(str(e))
    print(json.dumps(res, ensure_ascii=False) if args.json else txt(res))
    return 0


if __name__ == '__main__':
    sys.exit(main())
