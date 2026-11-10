#!/usr/bin/env python3
"""MAP-16: banco de encargos del mapa para agentes (el modelo local frente a Claude).

    python3 map-generator/banco/banco.py preparar ENCARGO DIR        # copia el mapa del juego a DIR (y original.json)
    python3 map-generator/banco/banco.py corregir ENCARGO DIR        # nota del resultado de DIR -> DIR/resultado.json
    python3 map-generator/banco/banco.py local ENCARGO DIR [--modelo M]   # preparar + agente_local.py + corregir
    python3 map-generator/banco/banco.py tabla RAIZ                  # resumen de RAIZ/*/resultado.json

El agente trabaja sobre `DIR/helek.json` (nunca el del juego). Al acabar deja su respuesta final en `DIR/registro.json`
(`final`, `segundos`, `turnos`, tokens; `agente_local.py` lo escribe solo; con Claude lo escribe la sesión que lo lanzó).
`corregir` compara `DIR/original.json` con `DIR/helek.json` según el `criterio` de `encargos.json`: lo pedido, que no
cambie nada más, que canon y lore sigan en verde y, en los encargos trampa, que no guarde y diga por qué.
"""
import argparse
import glob
import json
import math
import os
import shutil
import subprocess
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
MAPA = os.path.dirname(AQUI)
sys.path.insert(0, MAPA)

import medir  # noqa: E402

GEOJSON = os.path.join(os.path.dirname(medir.MUNDO), 'helek.geojson')
TIERRA = 20


def encargos():
    with open(os.path.join(AQUI, 'encargos.json'), encoding='utf-8') as f:
        return {e['id']: e for e in json.load(f)['encargos']}


def preparar(encargo, d, mundo=medir.MUNDO):
    if encargo not in encargos():
        raise SystemExit(f'encargo desconocido: {encargo}; hay {sorted(encargos())}')
    os.makedirs(d, exist_ok=True)
    for viejo in ('registro.json', 'resultado.json'):
        if os.path.exists(os.path.join(d, viejo)):
            os.remove(os.path.join(d, viejo))
    shutil.rmtree(os.path.join(d, 'historial'), ignore_errors=True)
    shutil.copy(mundo, os.path.join(d, 'helek.json'))
    shutil.copy(mundo, os.path.join(d, 'original.json'))
    geo = os.path.join(os.path.dirname(mundo), 'helek.geojson')
    if os.path.exists(geo):
        shutil.copy(geo, os.path.join(d, 'helek.geojson'))


def _por_i(lista):
    return {x['i']: x for x in lista}


def _canon_y_lore_ok(ruta):
    r = subprocess.run([sys.executable, os.path.join(MAPA, 'editar.py'), '-', '--json', '--mundo', ruta],
                       input='{}', capture_output=True, text=True)
    try:
        return json.loads(r.stdout).get('ok') is True
    except ValueError:
        return False


def _iguales_salvo(antes, despues, claves):
    """Claves de primer nivel que cambian sin estar permitidas."""
    return sorted(k for k in set(antes) | set(despues) if k not in claves and antes.get(k) != despues.get(k))


def _celdas_cambiadas(antes, despues, campos):
    """Celdas con algún campo fuera de `campos` cambiado (lo que no debía tocarse)."""
    a, b = _por_i(antes['celdas']), _por_i(despues['celdas'])
    malas = []
    for i, c in a.items():
        otra = b.get(i, {})
        if any(c.get(k) != otra.get(k) for k in set(c) | set(otra) if k not in campos):
            malas.append(i)
    return malas


def corregir(encargo_id, d):
    e = encargos()[encargo_id]
    cr = e['criterio']
    antes = medir.cargar(os.path.join(d, 'original.json'))
    despues = medir.cargar(os.path.join(d, 'helek.json'))
    reg = {}
    if os.path.exists(os.path.join(d, 'registro.json')):
        with open(os.path.join(d, 'registro.json'), encoding='utf-8') as f:
            reg = json.load(f)
    fallos = []
    guardado = antes != despues

    if cr.get('guardado') and not guardado:
        fallos.append('no guardó nada')
    if guardado and not _canon_y_lore_ok(os.path.join(d, 'helek.json')):
        fallos.append('lo guardado deja el canon o el lore en rojo')

    if 'regiones' in cr and guardado:
        q = cr['regiones']
        fuera = _iguales_salvo(antes, despues, {'celdas', 'regiones', 'provincias'})
        if fuera:
            fallos.append(f'cambia también {fuera}')
        malas = _celdas_cambiadas(antes, despues, {'region', 'provincia'})
        if malas:
            fallos.append(f'{len(malas)} celdas cambian algo más que región o provincia')
        a, b = _por_i(antes['celdas']), _por_i(despues['celdas'])
        cambian = [i for i in a if a[i]['region'] != b[i]['region']]
        otras = [i for i in cambian if (a[i]['region'], b[i]['region']) != (q['de'], q['a'])]
        if otras:
            fallos.append(f'{len(otras)} celdas cambian entre otras regiones')
        buenas = set(cambian) - set(otras)
        if not q['min'] <= len(buenas) <= q['max']:
            fallos.append(f'pasan {len(buenas)} celdas de {q["de"]} a {q["a"]}; se pedían {q["min"]}-{q["max"]}')
        if q.get('lindan'):
            alcanzadas = {i for i in buenas if any(a[n]['region'] == q['a'] for n in a[i]['c'])}
            pend = buenas - alcanzadas
            while True:
                nuevas = {i for i in pend if any(n in alcanzadas for n in a[i]['c'])}
                if not nuevas:
                    break
                alcanzadas |= nuevas
                pend -= nuevas
            if pend:
                fallos.append(f'{len(pend)} celdas no están pegadas a la frontera')

    if 'aTierra' in cr and guardado:
        q = cr['aTierra']
        fuera = _iguales_salvo(antes, despues, {'celdas', 'continentes', 'regiones', 'provincias'})
        if fuera:
            fallos.append(f'cambia también {fuera}')
        a, b = _por_i(antes['celdas']), _por_i(despues['celdas'])
        cont = next(k['i'] for k in despues['continentes'] if k['nombre'] == q['continente'])
        nuevas = [i for i in a if a[i]['h'] < TIERRA <= b[i]['h']]
        a_mar = [i for i in a if b[i]['h'] < TIERRA <= a[i]['h']]
        otras_h = [i for i in a if a[i]['h'] != b[i]['h'] and i not in nuevas]
        if a_mar:
            fallos.append(f'{len(a_mar)} celdas de tierra pasan a mar')
        if otras_h:
            fallos.append(f'{len(otras_h)} celdas cambian de altura sin pasar a tierra')
        if not q['min'] <= len(nuevas) <= q['max']:
            fallos.append(f'pasan a tierra {len(nuevas)} celdas; se pedían {q["min"]}-{q["max"]}')
        lejos = [i for i in nuevas if b[i]['continente'] != cont or b[i]['p'][0] >= q['xMax']]
        if lejos:
            fallos.append(f'{len(lejos)} celdas nuevas fuera de {q["continente"]} o de su mitad oeste')
        if [k['nombre'] for k in antes['continentes']] != [k['nombre'] for k in despues['continentes']]:
            fallos.append('cambian los continentes (¿una isla nueva?)')

    if 'lugar' in cr and guardado:
        q = cr['lugar']
        fuera = _iguales_salvo(antes, despues, {'lugares'})
        if fuera:
            fallos.append(f'cambia también {fuera}')
        viejos = _por_i(antes['lugares'])
        if any(viejos[i] != l for i, l in _por_i(despues['lugares']).items() if i in viejos) or \
                set(viejos) - set(_por_i(despues['lugares'])):
            fallos.append('cambia o borra lugares que ya había')
        nuevos = [l for l in despues['lugares'] if l['i'] not in viejos]
        con = [l for l in nuevos if l.get('slug') == q['slug']]
        if len(nuevos) != 1 or len(con) != 1:
            fallos.append(f'{len(nuevos)} lugares nuevos, {len(con)} con la ficha {q["slug"]}; se pedía uno')
        else:
            l, ref = con[0], viejos[q['cercaDe']]
            km = math.dist((l['x'], l['y']), (ref['x'], ref['y']))
            if l.get('region') != q['region']:
                fallos.append(f'el lugar cae en la región {l.get("region")}, no en {q["region"]}')
            if km > q['km']:
                fallos.append(f'el lugar está a {km:.0f} km de {ref["nombre"]}; máximo {q["km"]}')

    if 'ruta' in cr and guardado:
        q = cr['ruta']
        fuera = _iguales_salvo(antes, despues, {'rutas'})
        if fuera:
            fallos.append(f'cambia también {fuera}')
        viejas = _por_i(antes['rutas'])
        if any(viejas.get(i) != r for i, r in _por_i(despues['rutas']).items() if i in viejas) or \
                set(viejas) - set(_por_i(despues['rutas'])):
            fallos.append('cambia o borra rutas que ya había')
        nuevas = [r for r in despues['rutas'] if r['i'] not in viejas]
        if len(nuevas) != 1:
            fallos.append(f'{len(nuevas)} rutas nuevas; se pedía una')
        else:
            r = nuevas[0]
            lug = _por_i(antes['lugares'])
            p, u = lug[q['extremos'][0]], lug[q['extremos'][1]]
            ini, fin = r['puntos'][0], r['puntos'][-1]

            def cerca(pt, l):
                return math.dist(pt, (l['x'], l['y'])) <= q['km']
            if r.get('grupo') != q['grupo']:
                fallos.append(f'la ruta es del grupo {r.get("grupo")}, no {q["grupo"]}')
            if not ((cerca(ini, p) and cerca(fin, u)) or (cerca(ini, u) and cerca(fin, p))):
                fallos.append(f'los extremos no están a menos de {q["km"]} km de {p["nombre"]} y {u["nombre"]}')

    if cr.get('sinCambios'):
        if guardado:
            fallos.append('guardó un lote que debía rechazar')
        texto = (reg.get('final') or '').lower()
        if not any(p.lower() in texto for p in cr.get('avisa', [])):
            fallos.append(f'no explica por qué no se puede (esperaba alguna de {cr["avisa"]})')

    res = {'encargo': encargo_id, 'agente': reg.get('modelo', '?'), 'ok': not fallos, 'fallos': fallos,
           'segundos': reg.get('segundos'), 'turnos': len(reg.get('turnos', [])) or reg.get('ordenes'),
           'tokens': (reg.get('tokens_entrada') or 0) + (reg.get('tokens_salida') or 0) or reg.get('tokens'),
           'agotado': reg.get('agotado', False), 'error': reg.get('error')}
    with open(os.path.join(d, 'resultado.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    return res


def tabla(raiz):
    filas = []
    for ruta in sorted(glob.glob(os.path.join(raiz, '*', 'resultado.json'))):
        with open(ruta, encoding='utf-8') as f:
            filas.append(json.load(f))
    print(f'{"agente":<22} {"encargo":<14} {"nota":<4} {"s":>6} {"turnos":>6} {"tokens":>8}  fallos')
    for r in filas:
        print(f'{str(r["agente"]):<22} {r["encargo"]:<14} {"✅" if r["ok"] else "❌":<4} {str(r["segundos"]):>6} '
              f'{str(r["turnos"]):>6} {str(r["tokens"]):>8}  {"; ".join(r["fallos"])[:160]}')
    por = {}
    for r in filas:
        x = por.setdefault(r['agente'], [0, 0, 0.0])
        x[0] += r['ok']
        x[1] += 1
        x[2] += r['segundos'] or 0
    for ag, (ok, n, s) in por.items():
        print(f'{ag}: {ok}/{n} aciertos, {s / max(n, 1):.0f} s de media')
    return filas


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='orden', required=True)
    for nombre in ('preparar', 'corregir', 'local'):
        p = sub.add_parser(nombre)
        p.add_argument('encargo')
        p.add_argument('dir')
        if nombre == 'local':
            p.add_argument('--modelo', default='qwen35-9b-32k')
            p.add_argument('--turnos', type=int, default=20)
    p = sub.add_parser('tabla')
    p.add_argument('raiz')
    a = ap.parse_args(argv)
    if a.orden == 'preparar':
        preparar(a.encargo, a.dir)
    elif a.orden == 'corregir':
        print(json.dumps(corregir(a.encargo, a.dir), ensure_ascii=False))
    elif a.orden == 'local':
        preparar(a.encargo, a.dir)
        subprocess.run([sys.executable, os.path.join(AQUI, 'agente_local.py'), a.encargo, '--copia', a.dir,
                        '--modelo', a.modelo, '--turnos', str(a.turnos)])
        print(json.dumps(corregir(a.encargo, a.dir), ensure_ascii=False))
    else:
        tabla(a.raiz)


if __name__ == '__main__':
    main()
