#!/usr/bin/env python3
"""IMG-40: registro `camino.json` de generated/<tipo>/<slug>/: grafo de fases, intentos, avanzar, atrás y semillas.
Lo usan fase.py (una orden por fase) y el servidor del generador; solo stdlib. Escritura atómica con bloqueo."""
import datetime
import fcntl
import json
import os


class CaminoInvalido(Exception):
    """Operación que el camino no permite; el mensaje (en español) dice qué falta."""


FASES = [
    {'id': 'F0', 'nombre': 'Boceto', 'receta': 'f0-boceto', 'siguientes': ['F1', 'F4'], 'disponible': True},
    {'id': 'F1', 'nombre': 'Forma', 'receta': 'f1-forma', 'siguientes': ['F2', 'F4'], 'disponible': True},
    {'id': 'F2', 'nombre': 'Detalle', 'receta': 'f2-detalle', 'siguientes': ['F4'], 'disponible': True},
    {'id': 'F4', 'nombre': 'Final', 'receta': 'f4-final', 'siguientes': ['F3'], 'disponible': True},
    {'id': 'F3', 'nombre': 'Recorte', 'receta': 'recorte', 'siguientes': [], 'disponible': False},  # llega con IMG-37
]
POR_ID = {f['id']: f for f in FASES}
ENTRADA = {'F0': [], 'F1': ['F0'], 'F2': ['F1'], 'F4': ['F2', 'F1', 'F0'], 'F3': ['F4']}  # por orden de preferencia
SEMILLA_F0 = 3


def vacio():
    return {'nombre': '', 'variantes': {}, 'marcadas': []}


def siguientes(fase, tipo):
    """Fases a las que se avanza desde `fase`; el recorte no se aplica a fondos (location)."""
    return [s for s in POR_ID[fase]['siguientes'] if not (s == 'F3' and tipo == 'location')]


def _migrar_elegidas(d):
    destinos = {}
    try:
        with open(os.path.join(d, 'elegidas.tsv'), encoding='utf-8') as f:
            for l in f:
                p = l.rstrip('\n').split('\t')
                if len(p) == 2:
                    destinos[p[1]] = p[1]  # la última fila de cada destino
    except FileNotFoundError:
        pass
    return [{'imagen': r, 'variante': None, 'pautasVersion': None, 'migrada': True} for r in destinos]


def leer(d):
    try:
        with open(os.path.join(d, 'camino.json'), encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        c = vacio()
        c['marcadas'] = _migrar_elegidas(d)
        return c


def actualizar(d, fn):
    """Lee bajo bloqueo, aplica fn(camino) y escribe atómico. Devuelve (lo que devuelva fn, camino)."""
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, 'camino.json.lock'), 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        camino = leer(d)
        res = fn(camino)
        tmp = os.path.join(d, f'camino.json.{os.getpid()}.tmp')
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(camino, f, ensure_ascii=False, indent=1)
        os.replace(tmp, os.path.join(d, 'camino.json'))
    return res, camino


def nombre_intento(variante, fase, n):
    return f'{variante}-{fase.lower()}-{n}'


def _fase(camino, variante, fase):
    return camino.get('variantes', {}).get(variante, {}).get('fases', {}).get(fase)


def siguiente_n(camino, variante, fase):
    f = _fase(camino, variante, fase)
    return max((i['n'] for i in f['intentos']), default=0) + 1 if f else 1


def fase_de_entrada(v, fase):
    """Fase aceptada que alimenta a `fase` (None en F0). v: dict de la variante (o {} si es nueva)."""
    if fase not in ENTRADA:
        raise CaminoInvalido(f'Fase desconocida: {fase}')
    if not ENTRADA[fase]:
        return None
    fases = (v or {}).get('fases', {})
    for c in ENTRADA[fase]:
        if fases.get(c, {}).get('aceptada'):
            return c
    pide = ' o '.join(ENTRADA[fase])
    raise CaminoInvalido(f'Falta una fase aceptada ({pide}) para generar {fase} {POR_ID[fase]["nombre"]}')


def semilla_por_defecto(v, fase, prompt):
    f = (v or {}).get('fases', {}).get(fase)
    intentos = f['intentos'] if f else []
    if not intentos:
        if fase == 'F0':
            return SEMILLA_F0
        return v['fases'][fase_de_entrada(v, fase)]['semilla']
    ultimo = intentos[-1]
    if prompt == ultimo['prompt']:
        return max(i['semilla'] for i in intentos) + 1
    return ultimo['semilla']


def apuntar_intento(camino, variante, fase, prompt, semilla, imagen, segundos, salida, entrada, n=None, error=None):
    """Apunta un intento (imagen=None si falló). `entrada` = (fase, imagen) de la que parte, o None; `n`, el número que
    dio siguiente_n al nombrar la imagen (si no, el siguiente). Devuelve n."""
    v = camino.setdefault('variantes', {}).setdefault(variante, {'origen': None, 'faseActual': 'F0', 'fases': {}})
    desde, img_entrada = entrada if entrada else (None, None)
    f = v['fases'].setdefault(fase, {'aceptada': None, 'prompt': None, 'semilla': None, 'desde': desde,
                                     'entrada': img_entrada, 'desfasada': False, 'intentos': []})
    if not f['aceptada']:  # sin aceptada, la fase parte de lo último con lo que se generó
        f.update(desde=desde, entrada=img_entrada)
    n = n or siguiente_n(camino, variante, fase)
    intento = {'n': n, 'prompt': prompt, 'semilla': semilla, 'imagen': imagen, 'desde': desde, 'entrada': img_entrada,
               'segundos': segundos, 'fecha': datetime.datetime.now().isoformat(timespec='seconds'), 'salida': salida}
    if error:
        intento['error'] = error
    f['intentos'].append(intento)
    v['faseActual'] = fase
    return n


def _en_uso(v):
    """Imágenes de las que parte alguna fase o intento de la variante: no se borran al avanzar."""
    usadas = set()
    for r in v['fases'].values():
        usadas.add(r.get('entrada'))
        usadas.update(i.get('entrada') for i in r['intentos'])
    return usadas


def _desfasar(v, origen, nueva):
    """Marca desfasadas las fases que salieron de `origen` con otra entrada, y las que cuelgan de ellas."""
    cola = [f for f, r in v['fases'].items() if r.get('desde') == origen and r.get('entrada') != nueva]
    vistas = set()
    while cola:
        f = cola.pop()
        if f in vistas:
            continue
        vistas.add(f)
        v['fases'][f]['desfasada'] = True
        cola += [g for g, r in v['fases'].items() if r.get('desde') == f]


def avanzar(d, camino, variante, fase, n, siguiente, tipo):
    """Acepta el intento n de `fase`, borra del disco los demás y pasa a `siguiente`."""
    f = _fase(camino, variante, fase)
    if f is None:
        raise CaminoInvalido(f'La variante {variante} no tiene la fase {fase}')
    ok = [i for i in f['intentos'] if i['n'] == n]
    if not ok:
        raise CaminoInvalido(f'No existe el intento {n} de {fase} en {variante}')
    if not ok[0]['imagen']:
        raise CaminoInvalido(f'El intento {n} de {fase} falló y no tiene imagen: no se puede aceptar')
    if fase == 'F4':
        raise CaminoInvalido('Desde F4 Final no se avanza: la Final se marca (★)')
    if siguiente not in siguientes(fase, tipo):
        raise CaminoInvalido(f'Desde {fase} no se puede avanzar a {siguiente} en {tipo} '
                             f'(permitidas: {", ".join(siguientes(fase, tipo)) or "ninguna"})')
    if not POR_ID[siguiente]['disponible']:
        raise CaminoInvalido(f'{siguiente} {POR_ID[siguiente]["nombre"]} no está disponible todavía (llega con IMG-37)')
    elegido = ok[0]
    v = camino['variantes'][variante]
    usadas = _en_uso(v)
    for i in f['intentos']:
        if i['n'] != n and i['imagen'] and i['imagen'] not in usadas:
            for ext in ('.png', '.json'):
                try:
                    os.remove(os.path.join(d, 'intentos', os.path.splitext(i['imagen'])[0] + ext))
                except FileNotFoundError:
                    pass
            i['imagen'] = None
    f.update(aceptada=elegido['imagen'], prompt=elegido['prompt'], semilla=elegido['semilla'], desfasada=False)
    if 'entrada' in elegido:  # la fase pasa a partir de lo que usó el intento aceptado
        f.update(desde=elegido['desde'], entrada=elegido['entrada'])
    _desfasar(v, fase, elegido['imagen'])
    v['faseActual'] = siguiente


def atras(camino, variante):
    v = camino.get('variantes', {}).get(variante)
    if v is None:
        raise CaminoInvalido(f'La variante {variante} no existe')
    actual = v['faseActual']
    f = v['fases'].get(actual)
    if f is not None:
        previa = f.get('desde')
    else:  # aún sin intentos: la anterior por el grafo que tenga aceptada
        previa = next((c for c in ENTRADA[actual] if v['fases'].get(c, {}).get('aceptada')), None)
    if not previa:
        raise CaminoInvalido(f'No hay fase anterior a {actual} a la que volver')
    v['faseActual'] = previa
