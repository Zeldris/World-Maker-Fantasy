#!/usr/bin/env python3
"""MAP-6, MAP-7, MAP-8: editar regiones, provincias, relieve, costa, lugares, rutas y ríos de helek.json (lo usa el visor por servir.py).

Un lote de cambios es un dict:

    {"base": "<sha256 de helek.json sobre el que se editó>",
     "celdas": [[celda, region, provincia], ...],          # 0 = sin región / sin provincia
     "provincias": [{"i": 1, "nombre": "Nuevo nombre"},    # renombrar
                    {"i": 5, "nombre": "Nueva", "region": 18, "color": "#aa5533"}],   # crear (i nuevo)
     "alturas": [[celda, h], ...],                          # MAP-7: h entero de 0 a 100; tierra si h >= 20
     "bloqueo": [3],                                        # MAP-7: continentes cuya tierra y agua de costa no se tocan
     "lugares": [{"i": 900, "slug": "agujas-iman", "x": 540, "y": 190},   # MAP-8: crear (nombre o slug; sin
                 {"i": 612, "slug": "campamento-serhu"},                 #   nombre, el de la ficha), enlazar
                 {"i": 615, "x": 571, "y": 398, "nombre": "Otro"},       #   (slug null lo quita), mover, renombrar
                 {"i": 900, "borrar": true}],
     "rutas": [{"i": 451, "grupo": "trails", "puntos": [[x, y], ...]},   # MAP-8: crear o redibujar (roads, trails,
               {"i": 0, "borrar": true}],                               #   searoutes)
     "rios": [{"i": 1, "nombre": "Río…", "puntos": [[x, y], ...]}]}     # MAP-8: crear, redibujar, renombrar, borrar

`aplicar` lo valida y devuelve el mundo nuevo (sin tocar el de entrada); `informe` dice qué medidas cambian y cómo
quedan el canon (`canon.json`) y el lore (`lore.json`); `guardar` escribe helek.json (orden estable), helek.geojson y
el archivo del juego (`exportar.py`). Nunca se escribe el `.map`. Las celdas de región y provincia son solo de tierra.
Las regiones no se crean ni se renombran: sus nombres los usan el canon, el lore y el juego.

Relieve y costa (MAP-7). `alturas` se aplica antes que las celdas de región y provincia (una celda recién subida a
tierra se puede pintar en el mismo lote). Una celda que pasa de mar a tierra hereda el bioma más común de sus vecinas de
tierra y su región y provincia más comunes; una que pasa a mar se queda sin bioma, región, provincia ni continente (y no
puede ser la de un lugar). Los continentes se recalculan con las componentes conexas de tierra: una isla nueva es un
continente `Isla nueva <i>`, un continente partido deja el trozo menor como continente nuevo, y unir dos continentes o
dejar uno sin celdas se rechaza. Sin `bloqueo`, Berig (su tierra y el agua de su costa) no se toca; `"bloqueo": []`
lo desbloquea. El bloqueo solo afecta a `alturas`.

Lugares, rutas y ríos (MAP-8). Un punto cae en la celda de centro más cercano. Un lugar va en tierra; su `slug` es el de
su ficha de la enciclopedia (`enciclopedia.py`, de `worldCatalog.ts`), uno por lugar, y los nombres no se repiten.
Las capitales no se borran ni salen de su región, y los lugares que nombra canon.json no se renombran ni se borran (el
canon los busca por nombre; su nombre de lore va en la ficha). Lo que el lote dibuja tiene que estar en su sitio: un
camino o una senda por tierra y en un solo continente (entre continentes, ruta marítima), una ruta marítima por agua
salvo sus extremos (puertos) y un río por tierra salvo su último punto (desembocadura). Lo que el lote no redibuja
puede venir de Azgaar con algún punto fuera de sitio; solo se rechaza si el relieve del lote le añade puntos fuera de
sitio, y entonces se redibuja o se borra en el mismo lote.

También se usa desde la consola (agentes, sin servidor ni navegador), con lo mismo que POST /comprobar y /guardar:

    python3 map-generator/editar.py lote.json              # comprueba y muestra el informe (--json: en JSON)
    python3 map-generator/editar.py lote.json --guardar    # escribe; si el canon o el lore fallan, solo con --forzar
    opciones: --mundo RUTA (una copia; entonces no toca el archivo del juego), --sin-juego, --canon RUTA, --lore RUTA; `lote.json` puede ser `-` (entrada estándar)

`base` es opcional por consola; si viene y no es la huella de helek.json, se rechaza como el 409 del servidor. Sale con 1
si el lote no vale o el canon o el lore fallan.
"""
import argparse
import copy
import hashlib
import json
import os
import re
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import comprobar  # noqa: E402
import enciclopedia  # noqa: E402
import exportar  # noqa: E402
import importar  # noqa: E402
import medir  # noqa: E402

TIERRA = comprobar.TIERRA
COLOR = re.compile(r'^#[0-9a-fA-F]{6}$')
BLOQUEO_DEFECTO = 'Berig'  # el continente que, sin `bloqueo` en el lote, no se toca


class ErrorDeEdicion(ValueError):
    """El lote no se puede aplicar; el mensaje dice por qué, para mostrarlo tal cual en el visor."""


def huella(texto_o_bytes):
    datos = texto_o_bytes.encode('utf-8') if isinstance(texto_o_bytes, str) else texto_o_bytes
    return hashlib.sha256(datos).hexdigest()


def _provincias(mundo, cambios):
    provs = {p['i']: p for p in mundo['provincias']}
    regiones = {r['i'] for r in mundo['regiones']}
    for e in cambios.get('provincias', []):
        if not isinstance(e, dict) or not isinstance(e.get('i'), int):
            raise ErrorDeEdicion(f'provincia sin índice entero: {e!r}')
        nombre = (e.get('nombre') or '').strip()
        if not nombre:
            raise ErrorDeEdicion(f"la provincia {e['i']} necesita un nombre")
        if e['i'] in provs:
            if set(e) - {'i', 'nombre'}:
                raise ErrorDeEdicion(f"de una provincia existente ({provs[e['i']]['nombre']}) solo se cambia el nombre")
            provs[e['i']]['nombre'] = nombre
            continue
        if e['i'] <= 0:
            raise ErrorDeEdicion(f"índice de provincia no válido: {e['i']}")
        if e.get('region') not in regiones:
            raise ErrorDeEdicion(f"la provincia nueva «{nombre}» necesita una región que exista (no {e.get('region')!r})")
        if not COLOR.match(str(e.get('color', ''))):
            raise ErrorDeEdicion(f"la provincia nueva «{nombre}» necesita un color #rrggbb")
        provs[e['i']] = {'i': e['i'], 'nombre': nombre, 'region': e['region'], 'color': e['color'].lower(),
                         'centro': None}
    nombres = [p['nombre'] for p in provs.values()]
    repetidos = sorted({n for n in nombres if nombres.count(n) > 1})
    if repetidos:
        raise ErrorDeEdicion(f"nombre de provincia repetido: {', '.join(repetidos)}")
    return [provs[i] for i in sorted(provs)]


def _entero(v):
    return isinstance(v, int) and not isinstance(v, bool)


def _bloqueo(mundo, cambios):
    """Ids de continente bloqueados: los del lote, o Berig si el lote no dice nada."""
    if 'bloqueo' not in cambios:
        return [k['i'] for k in mundo['continentes'] if k['nombre'] == BLOQUEO_DEFECTO]
    ids = cambios['bloqueo']
    existentes = {k['i'] for k in mundo['continentes']}
    if not isinstance(ids, list) or not all(_entero(i) and i in existentes for i in ids):
        raise ErrorDeEdicion(f'bloqueo mal formado: {ids!r} (se espera una lista de ids de continente que existan)')
    return ids


def _zona_bloqueada(mundo, ids):
    """celda -> nombre del continente que la bloquea: su tierra y las celdas de mar vecinas de ella (su agua de costa)."""
    nombres = {k['i']: k['nombre'] for k in mundo['continentes']}
    zona = {}
    for c in mundo['celdas']:
        if c['h'] >= TIERRA and c['continente'] in ids:
            zona.setdefault(c['i'], nombres[c['continente']])
            for j in c['c']:
                if mundo['celdas'][j]['h'] < TIERRA:
                    zona.setdefault(j, nombres[c['continente']])
    return zona


def _mas_comun(valores):
    """El valor que más se repite; en empate, el menor."""
    cuenta = {}
    for v in valores:
        cuenta[v] = cuenta.get(v, 0) + 1
    return min(cuenta, key=lambda v: (-cuenta[v], v))


def _alturas(nuevo, mundo, cambios):
    """Aplica `alturas` sobre `nuevo` (el bloqueo se mira sobre `mundo`, el de entrada) y recalcula los continentes."""
    filas = cambios.get('alturas', [])
    if not isinstance(filas, list):
        raise ErrorDeEdicion(f'alturas mal formado: {filas!r} (se espera [[celda, h], ...])')
    n = len(nuevo['celdas'])
    pedidas = {}
    for fila in filas:
        if not (isinstance(fila, list) and len(fila) == 2 and all(_entero(v) for v in fila)):
            raise ErrorDeEdicion(f'cambio de altura mal formado: {fila!r} (se espera [celda, h] con h entero de 0 a 100)')
        i, h = fila
        if not 0 <= i < n:
            raise ErrorDeEdicion(f'no existe la celda {i}')
        if not 0 <= h <= 100:
            raise ErrorDeEdicion(f'la altura {h} de la celda {i} se sale de 0 a 100')
        if h != mundo['celdas'][i]['h']:
            pedidas[i] = h
    bloqueo = _bloqueo(mundo, cambios)
    if not pedidas:
        return
    zona = _zona_bloqueada(mundo, bloqueo)
    for i in sorted(pedidas):
        if i in zona:
            raise ErrorDeEdicion(f'la celda {i} es de {zona[i]} (su tierra o su agua de costa), que está bloqueado: '
                                 f'desmarca «Bloquear: {zona[i]}» en el visor (o manda "bloqueo" sin él) para editarlo')
    celdas = nuevo['celdas']
    lugares = {lu['celda']: lu for lu in nuevo['lugares']}
    a_tierra = sorted(i for i, h in pedidas.items() if celdas[i]['h'] < TIERRA <= h)
    cruza = bool(a_tierra)
    for i, h in sorted(pedidas.items()):
        c = celdas[i]
        if i in a_tierra:
            continue
        if c['h'] >= TIERRA > h:
            if i in lugares:
                raise ErrorDeEdicion(f"la celda {i} es de {lugares[i]['nombre']}: no pasa a mar")
            c['bioma'] = c['region'] = c['provincia'] = c['continente'] = 0
            cruza = True
        c['h'] = h
    if not cruza:
        return
    comun = _mas_comun(c['bioma'] for c in celdas if c['h'] >= TIERRA)
    for i in a_tierra:
        c = celdas[i]
        vecinas = [celdas[j] for j in c['c'] if celdas[j]['h'] >= TIERRA]
        c['bioma'] = _mas_comun(v['bioma'] for v in vecinas) if vecinas else comun
        pares = [(v['region'], v['provincia']) for v in vecinas if v['region']]
        c['region'], c['provincia'] = _mas_comun(pares) if pares else (0, 0)
        c['h'] = pedidas[i]
    _continentes(nuevo, mundo)


def _componentes(celdas):
    """Componentes conexas de tierra (por vecinas), cada una como lista de índices, por índice menor."""
    visto, salida = set(), []
    for c in celdas:
        if c['h'] < TIERRA or c['i'] in visto:
            continue
        pila, comp = [c['i']], []
        visto.add(c['i'])
        while pila:
            k = pila.pop()
            comp.append(k)
            for j in celdas[k]['c']:
                if celdas[j]['h'] >= TIERRA and j not in visto:
                    visto.add(j)
                    pila.append(j)
        salida.append(sorted(comp))
    return salida


def _continentes(nuevo, mundo):
    """Rehace el continente de cada celda de tierra tras cambiar la costa, y la cuenta de celdas de cada uno."""
    antes = [c['continente'] if c['h'] >= TIERRA else 0 for c in mundo['celdas']]
    nombres = {k['i']: k['nombre'] for k in nuevo['continentes']}
    comps = _componentes(nuevo['celdas'])
    ids_de = []
    for comp in comps:
        ids = sorted({antes[i] for i in comp if antes[i]})
        if len(ids) > 1:
            raise ErrorDeEdicion(f"la costa nueva une {' y '.join(nombres[k] for k in ids)} en una sola tierra: "
                                 'no se unen continentes')
        ids_de.append(ids[0] if ids else 0)
    # Un continente repartido en varias componentes se queda con la que más celdas suyas tiene (en empate, la que
    # contiene su celda de menor índice); las demás, como la tierra sin continente, son continentes nuevos.
    duena = {}
    for k in {i for i in ids_de if i}:
        candidatas = [(-sum(1 for i in comp if antes[i] == k), min(i for i in comp if antes[i] == k), x)
                      for x, comp in enumerate(comps) if ids_de[x] == k]
        duena[k] = min(candidatas)[2]
    siguiente = max(k['i'] for k in nuevo['continentes'])
    for x, comp in enumerate(comps):
        k = ids_de[x]
        if not k or duena[k] != x:
            siguiente += 1
            k = siguiente
            nuevo['continentes'].append({'i': k, 'nombre': f'Isla nueva {k}', 'celdas': 0, 'areaFmg': None})
        for i in comp:
            nuevo['celdas'][i]['continente'] = k
    cuenta = {}
    for c in nuevo['celdas']:
        if c['h'] >= TIERRA:
            cuenta[c['continente']] = cuenta.get(c['continente'], 0) + 1
    for k in nuevo['continentes']:
        if not cuenta.get(k['i']):
            raise ErrorDeEdicion(f"{k['nombre']} se quedaría sin celdas de tierra: no se borra un continente entero")
        k['celdas'] = cuenta[k['i']]


def _localizador(mundo):
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


def _numero(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _punto(mundo, x, y, que):
    ancho, alto = mundo['fuente']['ancho'], mundo['fuente']['alto']
    if not (_numero(x) and _numero(y) and 0 <= x <= ancho and 0 <= y <= alto):
        raise ErrorDeEdicion(f'{que}: el punto {[x, y]!r} no está dentro del mapa (0-{ancho} × 0-{alto})')
    return [round(float(x), 2), round(float(y), 2)]


def _puntos(mundo, valor, que):
    if not (isinstance(valor, list) and len(valor) >= 2 and all(isinstance(p, list) and len(p) == 2 for p in valor)):
        raise ErrorDeEdicion(f'{que}: los puntos tienen que ser una lista de al menos dos [x, y]')
    return [_punto(mundo, x, y, que) for x, y in valor]


def _nombres_del_canon(canon):
    return {n for e in canon.get('medidas', []) for n in e.get('lugares', [])}


def _lugares_lote(nuevo, cambios, canon, catalogo, celda_en):
    """`lugares` del lote: crear (i nuevo), mover (x, y), renombrar, enlazar a la enciclopedia (slug) o borrar."""
    ops = cambios.get('lugares', [])
    if not isinstance(ops, list):
        raise ErrorDeEdicion(f'lugares mal formado: {ops!r} (se espera una lista)')
    if not ops:
        return
    por = {lu['i']: lu for lu in nuevo['lugares']}
    del_canon = _nombres_del_canon(canon())
    for e in ops:
        if not isinstance(e, dict) or not _entero(e.get('i')):
            raise ErrorDeEdicion(f'lugar sin índice entero: {e!r}')
        i, lu = e['i'], por.get(e['i'])
        if e.get('borrar'):
            if set(e) != {'i', 'borrar'} or e['borrar'] is not True:
                raise ErrorDeEdicion(f'para borrar el lugar {i} se manda solo {{"i": {i}, "borrar": true}}')
            if lu is None:
                raise ErrorDeEdicion(f'no existe el lugar {i}')
            if lu.get('capital'):
                raise ErrorDeEdicion(f"{lu['nombre']} es la capital de su región: no se borra")
            if lu['nombre'] in del_canon:
                raise ErrorDeEdicion(f"{lu['nombre']} lo nombra canon.json (lo cambia solo la usuaria): no se borra")
            del por[i]
            continue
        sobra = set(e) - {'i', 'nombre', 'slug', 'x', 'y'}
        if sobra:
            raise ErrorDeEdicion(f"el lugar {i} lleva campos que no se editan: {', '.join(sorted(sobra))}")
        es_nuevo = lu is None
        if es_nuevo:
            if i <= 0:
                raise ErrorDeEdicion(f'índice de lugar no válido: {i}')
            if 'x' not in e or 'y' not in e:
                raise ErrorDeEdicion(f'el lugar nuevo {i} necesita x e y')
            lu = {'i': i, 'nombre': None, 'x': None, 'y': None, 'celda': None, 'region': 0, 'tipo': 'Generic',
                  'capital': False}
        else:
            lu = dict(lu)
        ficha = None
        if 'slug' in e:
            if e['slug'] is None:
                lu.pop('slug', None)
            else:
                fichas = {f['slug']: f for f in catalogo()}
                ficha = fichas.get(e['slug'])
                if ficha is None:
                    raise ErrorDeEdicion(f"no hay ningún lugar con slug «{e['slug']}» en la enciclopedia "
                                         '(python3 map-generator/enciclopedia.py los lista)')
                lu['slug'] = e['slug']
                if es_nuevo:
                    lu['tipo'] = ficha['tipo']
        if 'nombre' in e:
            nombre = e['nombre'].strip() if isinstance(e['nombre'], str) else ''
            if not nombre:
                raise ErrorDeEdicion(f'el lugar {i} necesita un nombre')
            if not es_nuevo and nombre != lu['nombre'] and lu['nombre'] in del_canon:
                raise ErrorDeEdicion(f"{lu['nombre']} lo nombra canon.json (lo cambia solo la usuaria): no se renombra; "
                                     'su nombre de lore va en la ficha de la enciclopedia (slug)')
            lu['nombre'] = nombre
        elif es_nuevo:
            if ficha is None:
                raise ErrorDeEdicion(f'el lugar nuevo {i} necesita un nombre o un slug de la enciclopedia')
            lu['nombre'] = ficha['nombre']
        if 'x' in e or 'y' in e:
            if 'x' not in e or 'y' not in e:
                raise ErrorDeEdicion(f'para mover el lugar {i} se mandan x e y')
            lu['x'], lu['y'] = _punto(nuevo, e['x'], e['y'], f"lugar {lu['nombre']}")
            k = celda_en(lu['x'], lu['y'])
            if nuevo['celdas'][k]['h'] < TIERRA:
                raise ErrorDeEdicion(f"{lu['nombre']} caería en mar (celda {k}): los lugares van en tierra")
            lu['celda'] = k
        por[i] = lu
    lista = [por[i] for i in sorted(por)]
    for campo, que in (('nombre', 'nombre de lugar repetido'), ('slug', 'slug enlazado a dos lugares')):
        valores = [lu[campo] for lu in lista if lu.get(campo)]
        repetidos = sorted({v for v in valores if valores.count(v) > 1})
        if repetidos:
            raise ErrorDeEdicion(f"{que}: {', '.join(repetidos)}")
    nuevo['lugares'] = lista


GRUPOS = ('roads', 'trails', 'searoutes')
NOMBRE_GRUPO = {'roads': 'camino', 'trails': 'senda', 'searoutes': 'ruta marítima'}


def _malos(mundo, trazo, es_rio, celdas_de):
    """Puntos de un trazo que no están donde deben: un camino o un río (salvo su desembocadura) sobre agua, una ruta
    marítima (salvo sus dos extremos) sobre tierra."""
    celdas = list(dict.fromkeys(celdas_de(trazo)))
    if es_rio:
        boca = celdas_de(trazo)[-1]
        return [k for k in celdas if k != boca and mundo['celdas'][k]['h'] < TIERRA]
    if trazo['grupo'] == 'searoutes':
        extremos = {celdas_de(trazo)[0], celdas_de(trazo)[-1]}
        return [k for k in celdas if k not in extremos and mundo['celdas'][k]['h'] >= TIERRA]
    return [k for k in celdas if mundo['celdas'][k]['h'] < TIERRA]


def _describe(trazo, es_rio):
    if es_rio:
        return f"el río {trazo['i']}" + (f" ({trazo['nombre']})" if trazo.get('nombre') else '')
    return f"la ruta {trazo['i']} ({NOMBRE_GRUPO[trazo['grupo']]}" + (
        f", {trazo['continente']})" if trazo.get('continente') else ')')


def _trazos_lote(nuevo, mundo, cambios, celda_en):
    """`rutas` y `rios` del lote (crear, redibujar, renombrar un río o borrar) y, si el relieve cambió la costa, que lo
    que el lote no redibuja no quede con más puntos fuera de sitio que antes."""
    cache = {}

    def celdas_de(trazo):
        return [cache.setdefault(tuple(p), celda_en(*p)) for p in trazo['puntos']]

    nombres = {k['i']: k['nombre'] for k in nuevo['continentes']}
    tocados = {'rutas': set(), 'rios': set()}
    for clave in ('rutas', 'rios'):
        es_rio = clave == 'rios'
        ops = cambios.get(clave, [])
        if not isinstance(ops, list):
            raise ErrorDeEdicion(f'{clave} mal formado: {ops!r} (se espera una lista)')
        if not ops:
            continue
        por = {x['i']: x for x in nuevo[clave]}
        for e in ops:
            if not isinstance(e, dict) or not _entero(e.get('i')) or e['i'] < 0:
                raise ErrorDeEdicion(f'{clave[:-1]} sin índice entero: {e!r}')
            i, x = e['i'], por.get(e['i'])
            tocados[clave].add(i)
            if e.get('borrar'):
                if set(e) != {'i', 'borrar'} or e['borrar'] is not True or x is None:
                    raise ErrorDeEdicion(f'para borrar se manda solo {{"i": {i}, "borrar": true}} de uno que exista')
                del por[i]
                continue
            sobra = set(e) - ({'i', 'nombre', 'puntos'} if es_rio else {'i', 'grupo', 'puntos'})
            if sobra:
                raise ErrorDeEdicion(f"{clave[:-1]} {i}: campos que no se editan: {', '.join(sorted(sobra))}")
            if x is None and 'puntos' not in e:
                raise ErrorDeEdicion(f'{clave[:-1]} nuevo {i}: necesita puntos')
            puntos = _puntos(nuevo, e['puntos'], f'{clave[:-1]} {i}') if 'puntos' in e else x['puntos']
            if es_rio:
                nombre = e.get('nombre', x and x.get('nombre'))
                nombre = nombre.strip() if isinstance(nombre, str) and nombre.strip() else None
                trazo = {'i': i, 'nombre': nombre, 'puntos': puntos}
            else:
                grupo = e.get('grupo', x and x['grupo'])
                if grupo not in GRUPOS:
                    raise ErrorDeEdicion(f"ruta {i}: grupo {grupo!r} no válido ({', '.join(GRUPOS)})")
                trazo = {'i': i, 'grupo': grupo, 'continente': None, 'puntos': puntos}
                if grupo != 'searoutes':
                    conts = sorted({nuevo['celdas'][k]['continente'] for k in celdas_de(trazo)} - {0})
                    if len(conts) > 1:
                        raise ErrorDeEdicion(f"{_describe(trazo, False)} une {' y '.join(nombres[k] for k in conts)}: "
                                             'entre continentes va una ruta marítima')
                    trazo['continente'] = nombres[conts[0]] if conts else None
            malos = _malos(nuevo, trazo, es_rio, celdas_de)
            if malos:
                donde = 'tierra' if not es_rio and trazo['grupo'] == 'searoutes' else 'agua'
                raise ErrorDeEdicion(f'{_describe(trazo, es_rio)} pasa por {donde} (celdas {malos[:5]}): '
                                     + ('un río va por tierra y solo su último punto puede caer en agua' if es_rio else
                                        'una ruta marítima va por agua salvo sus extremos' if donde == 'tierra' else
                                        'un camino o una senda van por tierra'))
            por[i] = trazo
        nuevo[clave] = [por[i] for i in sorted(por)]
    if all((a['h'] < TIERRA) == (b['h'] < TIERRA) for a, b in zip(mundo['celdas'], nuevo['celdas'])):
        return
    for clave in ('rutas', 'rios'):
        for trazo in nuevo[clave]:
            if trazo['i'] in tocados[clave]:
                continue
            antes = _malos(mundo, trazo, clave == 'rios', celdas_de)
            despues = _malos(nuevo, trazo, clave == 'rios', celdas_de)
            if len(despues) > len(antes):
                nuevas = sorted(set(despues) - set(antes))[:5]
                raise ErrorDeEdicion(f'con la costa nueva, {_describe(trazo, clave == "rios")} queda fuera de sitio '
                                     f'(celdas {nuevas}): redibújala o bórrala en el mismo lote')


def aplicar(mundo, cambios, canon=None, catalogo=None):
    """El mundo con `cambios` aplicados (copia). Lanza ErrorDeEdicion si algo no cuadra. `canon` (el dict de
    canon.json) y `catalogo` (la lista de enciclopedia.py) se cargan de su archivo solo si el lote los necesita."""
    cargado = {}

    def canon_():
        return canon if canon is not None else cargado.setdefault('canon', cargar_json(medir.CANON))

    def catalogo_():
        return catalogo if catalogo is not None else cargado.setdefault('catalogo', enciclopedia.lugares())

    nuevo = copy.deepcopy(mundo)
    _alturas(nuevo, mundo, cambios)
    celda_en = _localizador(nuevo)
    _lugares_lote(nuevo, cambios, canon_, catalogo_, celda_en)
    _trazos_lote(nuevo, mundo, cambios, celda_en)
    nuevo['provincias'] = _provincias(nuevo, cambios)
    region_de_prov = {p['i']: p['region'] for p in nuevo['provincias']}
    regiones = {r['i'] for r in nuevo['regiones']} | {0}
    n = len(nuevo['celdas'])
    for fila in cambios.get('celdas', []):
        if not (isinstance(fila, list) and len(fila) == 3 and all(isinstance(v, int) for v in fila)):
            raise ErrorDeEdicion(f'cambio de celda mal formado: {fila!r} (se espera [celda, región, provincia])')
        i, region, provincia = fila
        if not 0 <= i < n:
            raise ErrorDeEdicion(f'no existe la celda {i}')
        c = nuevo['celdas'][i]
        if c['h'] < TIERRA:
            raise ErrorDeEdicion(f'la celda {i} es mar: súbela antes con el modo Relieve (alturas)')
        if region not in regiones:
            raise ErrorDeEdicion(f'no existe la región {region}')
        if provincia and region_de_prov.get(provincia) != region:
            raise ErrorDeEdicion(f'la provincia {provincia} no es de la región {region} (celda {i})')
        c['region'], c['provincia'] = region, provincia
    for lu in nuevo['lugares']:
        c = nuevo['celdas'][lu['celda']]
        if lu.get('region') and c['region'] != lu['region']:
            nombre = next(r['nombre'] for r in nuevo['regiones'] if r['i'] == lu['region'])
            raise ErrorDeEdicion(f"la celda {c['i']} es de {lu['nombre']}, que es de {nombre}: no cambia de región")
    _centros(nuevo)
    return nuevo


def _centros(mundo):
    """El centro de cada provincia es una de sus celdas: se conserva si sigue dentro, si no, la más central."""
    por = {}
    for c in mundo['celdas']:
        if c['h'] >= TIERRA and c['provincia']:
            por.setdefault(c['provincia'], []).append(c)
    for p in mundo['provincias']:
        celdas = por.get(p['i'], [])
        if any(c['i'] == p.get('centro') for c in celdas):
            continue
        if not celdas:
            p['centro'] = None
            continue
        mx = sum(c['p'][0] for c in celdas) / len(celdas)
        my = sum(c['p'][1] for c in celdas) / len(celdas)
        p['centro'] = min(celdas, key=lambda c: ((c['p'][0] - mx) ** 2 + (c['p'][1] - my) ** 2, c['i']))['i']


def _lore(mundo, lore):
    try:
        return [{'id': r['id'], 'ok': ok, 'detalle': d} for r, ok, d in comprobar.comprobar(mundo, lore)]
    except (KeyError, StopIteration, ValueError) as e:
        # Una regla que nombra algo que ya no existe (p. ej. una provincia renombrada) es un fallo, no un cuelgue.
        return [{'id': 'lore', 'ok': False, 'detalle': f'el lore no se puede comprobar: {type(e).__name__} {e}'}]


def _diferencias(antes, despues):
    """Lugares, rutas y ríos nuevos, cambiados y borrados (MAP-8), con el nombre o la descripción de cada uno."""
    salida = {}
    for clave in ('lugares', 'rutas', 'rios'):
        a = {x['i']: x for x in antes[clave]}
        d = {x['i']: x for x in despues[clave]}
        nombre = (lambda x: x['nombre']) if clave == 'lugares' else (lambda x, c=clave: _describe(x, c == 'rios'))
        salida[clave] = {
            'nuevos': [nombre(d[i]) for i in sorted(d.keys() - a.keys())],
            'cambian': [nombre(d[i]) for i in sorted(d.keys() & a.keys()) if d[i] != a[i]],
            'borrados': [nombre(a[i]) for i in sorted(a.keys() - d.keys())],
        }
    return salida


def informe(antes, despues, canon, lore):
    """Qué medidas cambian (área y envolvente de regiones, provincias y continentes), el resumen del relieve
    y el canon y el lore tras el cambio."""
    ma, md = medir.medidas(antes, canon), medir.medidas(despues, canon)
    cambian = []
    for clave, lista in (('regiones', despues['regiones']), ('provincias', despues['provincias'])):
        for e in lista:
            a, d = ma[clave].get(str(e['i'])), md[clave][str(e['i'])]
            if a is None or abs(a['area'] - d['area']) > 1e-6 or a['envolvente'] != d['envolvente']:
                cambian.append({'tipo': 'region' if clave == 'regiones' else 'provincia', 'i': e['i'],
                                'nombre': e['nombre'], 'antes': a and {'area': a['area'], 'envolvente': a['envolvente']},
                                'despues': {'area': d['area'], 'envolvente': d['envolvente']}})
    ka = {k['i'] for k in antes['continentes']}
    for k in despues['continentes']:
        a, d = ma['continentes'].get(str(k['i'])) if k['i'] in ka else None, md['continentes'][str(k['i'])]
        if a is None or abs(a['area'] - d['area']) > 1e-6 or a['envolvente'] != d['envolvente']:
            cambian.append({'tipo': 'continente', 'i': k['i'], 'nombre': k['nombre'],
                            'antes': a and {'area': a['area'], 'envolvente': a['envolvente']},
                            'despues': {'area': d['area'], 'envolvente': d['envolvente']}})
    relieve = {'alturas': 0, 'aTierra': 0, 'aMar': 0}
    for ca, cd in zip(antes['celdas'], despues['celdas']):
        relieve['alturas'] += ca['h'] != cd['h']
        relieve['aTierra'] += ca['h'] < TIERRA <= cd['h']
        relieve['aMar'] += cd['h'] < TIERRA <= ca['h']
    lore_d = _lore(despues, lore)
    return {
        'relieve': relieve,
        'trazos': _diferencias(antes, despues),
        'cambian': cambian,
        'canon': md['canon'],
        'lore': lore_d,
        'ok': all(e['dentro'] for e in md['canon']) and all(r['ok'] for r in lore_d),
        'medidas': md,
    }


def guardar(mundo, ruta_mundo=medir.MUNDO, ruta_geojson=None, ruta_juego=exportar.SALIDA):
    """Escribe helek.json (orden estable, de forma atómica), su GeoJSON y el archivo del juego. Devuelve la huella."""
    texto = importar.volcar(mundo)
    _escribir(ruta_mundo, texto)
    ruta_geojson = ruta_geojson or os.path.join(os.path.dirname(ruta_mundo), 'helek.geojson')
    geo = importar.geojson(mundo, {'v': [c['v'] for c in mundo['celdas']]}, mundo['vertices'])
    _escribir(ruta_geojson, importar.volcar({'type': geo['type'], 'features': geo['features']}))
    if ruta_juego:
        _escribir(ruta_juego, exportar.generar(mundo))
    return huella(texto)


def _escribir(ruta, texto):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(ruta), prefix='.editar-', suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(texto)
        os.replace(tmp, ruta)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def cargar_json(ruta):
    with open(ruta, encoding='utf-8') as f:
        return json.load(f)


def texto_informe(inf):
    """El informe de `informe()` en texto legible, para la consola."""
    km2 = lambda a: f"{a['area']:,.0f} km²".replace(',', '.')  # noqa: E731
    env = lambda a: ' × '.join(f'{v:.0f}' for v in a['envolvente'])  # noqa: E731
    r = inf['relieve']
    lineas = [f"Relieve: {r['alturas']} celda(s) con otra altura, {r['aTierra']} pasan a tierra, {r['aMar']} pasan a mar."]
    for clave, que in (('lugares', 'Lugares'), ('rutas', 'Rutas'), ('rios', 'Ríos')):
        t = inf.get('trazos', {}).get(clave, {})
        partes = [f"{len(t[k])} {k} ({'; '.join(t[k][:5])}{'…' if len(t[k]) > 5 else ''})"
                  for k in ('nuevos', 'cambian', 'borrados') if t.get(k)]
        if partes:
            lineas.append(f"{que}: {', '.join(partes)}.")
    if inf['cambian']:
        lineas.append('Medidas que cambian:')
    for e in inf['cambian']:
        antes = f"{km2(e['antes'])} ({env(e['antes'])} km) → " if e['antes'] else 'nueva · '
        lineas.append(f"  {e['tipo']} {e['nombre']}: {antes}{km2(e['despues'])} ({env(e['despues'])} km)")
    if not inf['cambian']:
        lineas.append('Ninguna medida cambia.')
    fallan = [r for r in inf['lore'] if not r['ok']]
    lineas.append(f"Lore: {len(inf['lore']) - len(fallan)} de {len(inf['lore'])} reglas se cumplen")
    lineas += [f"  MAL {r['id']}: {r['detalle']}" for r in fallan]
    fuera = [e for e in inf['canon'] if not e['dentro']]
    lineas.append(f"Canon: {'todo dentro' if not fuera else f'{len(fuera)} medida(s) fuera'}")
    for e in fuera:
        sujeto = e.get('region') or e.get('continente') or ' ↔ '.join(e['lugares'])
        lineas.append(f"  MAL {e['que']} {sujeto}: medido {e['medido']}")
    lineas.append('Resultado: ' + ('canon y lore se cumplen' if inf['ok'] else 'el canon o el lore NO se cumplen'))
    if inf.get('guardado'):
        lineas.append(f"Guardado (huella {inf['huella']}).")
    return '\n'.join(lineas)


def main(argv=None):
    ap = argparse.ArgumentParser(description='Comprueba (y guarda) un lote de cambios del mapa sin servidor ni navegador.')
    ap.add_argument('lote', help='JSON con el lote de cambios, o - para la entrada estándar')
    ap.add_argument('--guardar', action='store_true', help='escribe helek.json, su GeoJSON y el archivo del juego')
    ap.add_argument('--forzar', action='store_true', help='guarda aunque el canon o el lore fallen')
    ap.add_argument('--json', action='store_true', help='el informe en JSON')
    ap.add_argument('--sin-juego', action='store_true', help='al guardar, no reescribe el archivo del juego (con --mundo de una copia, tampoco)')
    ap.add_argument('--mundo', default=medir.MUNDO)
    ap.add_argument('--canon', default=medir.CANON)
    ap.add_argument('--lore', default=comprobar.LORE)
    args = ap.parse_args(argv)

    def fallo(motivo):
        print(json.dumps({'error': motivo}, ensure_ascii=False) if args.json else f'error: {motivo}',
              file=sys.stdout if args.json else sys.stderr)
        return 1

    try:
        cambios = json.load(sys.stdin) if args.lote == '-' else cargar_json(args.lote)
    except (OSError, ValueError) as e:
        return fallo(f'no se puede leer el lote: {e}')
    if not isinstance(cambios, dict):
        return fallo('el lote tiene que ser un objeto JSON')
    with open(args.mundo, 'rb') as f:
        datos = f.read()
    if 'base' in cambios and cambios['base'] != huella(datos):
        return fallo(f'{args.mundo} ha cambiado desde que se calculó la base del lote: vuelve a prepararlo')
    antes = json.loads(datos)
    canon = cargar_json(args.canon)
    try:
        despues = aplicar(antes, cambios, canon=canon)
    except ErrorDeEdicion as e:
        return fallo(str(e))
    inf = informe(antes, despues, canon, cargar_json(args.lore))
    inf['guardado'] = False
    if args.guardar and (inf['ok'] or args.forzar):
        # Con una copia (--mundo), el archivo del juego no se toca: lo regenera solo el helek.json de verdad.
        copia = os.path.abspath(args.mundo) != os.path.abspath(medir.MUNDO)
        inf['huella'] = guardar(despues, args.mundo, ruta_juego=None if args.sin_juego or copia else exportar.SALIDA)
        inf['guardado'] = True
    if args.json:
        inf.pop('medidas', None)
        print(json.dumps(inf, ensure_ascii=False))
    else:
        print(texto_informe(inf))
        if args.guardar and not inf['guardado']:
            print('No se guarda: el canon o el lore no se cumplen (usa --forzar para guardar igualmente).', file=sys.stderr)
    return 0 if inf['ok'] and (inf['guardado'] or not args.guardar) else 1


if __name__ == '__main__':
    sys.exit(main())
