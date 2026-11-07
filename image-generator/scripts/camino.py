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
# IMG-53: cadena de pasos P1…P9 (edición: cada uno parte de la aceptada del anterior); F0/F1/F2 siguen para caminos antiguos.
PASOS = [f'P{n}' for n in range(1, 10)]
FASES[3:3] = [{'id': p, 'nombre': f'Paso {n}', 'receta': 'paso', 'disponible': True,
               'siguientes': ([PASOS[n]] if n < 9 else []) + ['F4']} for n, p in enumerate(PASOS, 1)]
POR_ID = {f['id']: f for f in FASES}
ENTRADA = {'F0': [], 'F1': ['F0'], 'F2': ['F1'], 'F3': ['F4'],  # por orden de preferencia
           'F4': PASOS[::-1] + ['F2', 'F1', 'F0']}  # la Final parte del paso aceptado más alto
ENTRADA.update({p: ([PASOS[n - 2]] if n > 1 else []) for n, p in enumerate(PASOS, 1)})
FASE_INICIAL = 'P1'  # donde empieza una variante nueva (F0 sigue para las antiguas)
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
    pide = ' o '.join(ENTRADA[fase]) if fase != 'F4' else 'un paso P1…P9, F2, F1 o F0'
    raise CaminoInvalido(f'Falta una fase aceptada ({pide}) para generar {fase} {POR_ID[fase]["nombre"]}')


def referencias_de(intento):
    """IMG-52: las referencias de un intento como lista [{rol, imagen}]: las de `referencias`; o, de un intento antiguo,
    su `referencia` con el rol «juego»; o []."""
    if intento.get('referencias'):
        return list(intento['referencias'])
    if intento.get('referencia'):
        return [{'rol': 'juego', 'imagen': intento['referencia']}]
    return []


def semilla_por_defecto(v, fase, prompt, referencia=None, referencias=None):
    """Solo cambia si se repite lo mismo: con otro prompt, o con otras referencias (roles, imágenes y orden), se compara
    a igual semilla. `referencia` = archivo de --referencia; `referencias` = lista [{rol, imagen}] de --ref."""
    f = (v or {}).get('fases', {}).get(fase)
    intentos = f['intentos'] if f else []
    if not intentos:
        if not ENTRADA[fase]:
            return SEMILLA_F0
        return v['fases'][fase_de_entrada(v, fase)]['semilla']
    ultimo = intentos[-1]
    ahora = referencias_de({'referencias': referencias, 'referencia': referencia})
    if prompt == ultimo['prompt'] and ahora == referencias_de(ultimo):
        return max(i['semilla'] for i in intentos) + 1
    return ultimo['semilla']


def apuntar_intento(camino, variante, fase, prompt, semilla, imagen, segundos, salida, entrada, n=None, error=None, referencia=None, medida=None, referencias=None, motor=None):
    """Apunta un intento (imagen=None si falló). `entrada` = (fase, imagen) de la que parte, o None; `n`, el número que
    dio siguiente_n al nombrar la imagen (si no, el siguiente). Devuelve n."""
    v = camino.setdefault('variantes', {}).setdefault(variante, {'origen': None, 'faseActual': FASE_INICIAL, 'fases': {}})
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
    if referencia:
        intento['referencia'] = referencia  # la imagen del juego que llevó (archivo, sin ruta)
    if referencias:
        intento['referencias'] = referencias  # IMG-52: [{rol, imagen}] de --ref (archivo, sin ruta); sustituye a `referencia`
    if motor:
        intento['motor'] = motor  # IMG-53: id de la tabla de motores.py con que se generó
    if medida is not None:
        intento['medida'] = medida  # la de scripts/medir/medida.py; sigue ahí aunque se borre la imagen
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


def _borrar_archivos(d, imagen):
    """Borra del disco la imagen de un intento (`.png`) y su `.json`."""
    for ext in ('.png', '.json'):
        try:
            os.remove(os.path.join(d, 'intentos', os.path.splitext(imagen)[0] + ext))
        except FileNotFoundError:
            pass


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
            _borrar_archivos(d, i['imagen'])
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


# --- IMG-25 (parte 2): renombrar, borrar lo guardado de una fase y marcar ★ ---

MAX_NOMBRE = 120


def renombrar(camino, nombre):
    """Nombre del elemento (recortado, de 1 a 120 caracteres). La carpeta y el slug no cambian."""
    limpio = str(nombre if nombre is not None else '').strip()
    if not limpio:
        raise CaminoInvalido('El nombre está vacío')
    if len(limpio) > MAX_NOMBRE:
        raise CaminoInvalido(f'El nombre es demasiado largo: {MAX_NOMBRE} caracteres como mucho')
    camino['nombre'] = limpio
    return limpio


def _variante(camino, variante):
    v = camino.get('variantes', {}).get(variante)
    if v is None:
        raise CaminoInvalido(f'La variante {variante} no existe')
    return v


def tramo(v, fase):
    """`fase` y las que cuelgan de ella por `desde`, en cadena (solo las que la variante tiene)."""
    if fase not in POR_ID:
        raise CaminoInvalido(f'Fase desconocida: {fase}')
    fases = v.get('fases', {})
    salida = [fase]
    for f in salida:  # la lista crece mientras se recorre: es la cadena
        salida += [g for g, r in fases.items() if r.get('desde') == f and g not in salida]
    return salida


def _borrables(camino, variante, fases):
    """Imágenes de los intentos de `fases` que se pueden borrar: las que no usa (entrada o aceptada) otra fase de fuera
    del tramo ni otra variante."""
    v = camino['variantes'][variante]
    candidatas = set()
    for f in fases:
        r = v['fases'].get(f)
        if r:
            candidatas.update(i['imagen'] for i in r['intentos'] if i.get('imagen'))
    usadas = set()
    for w, vw in camino['variantes'].items():
        for g, r in vw.get('fases', {}).items():
            if w == variante and g in fases:
                continue
            usadas.update((r.get('entrada'), r.get('aceptada')))
            usadas.update(i.get('entrada') for i in r['intentos'])
    return candidatas - usadas


def dependientes(camino, variante, fase):
    """Lo que arrastra borrar `fase`: {fases: el tramo, marcadas: las ★ de esta variante cuya imagen se borraría,
    variantes: las otras que nacen (origen {variante, fase}) de una fase del tramo}."""
    v = _variante(camino, variante)
    fases = tramo(v, fase)
    borrables = _borrables(camino, variante, fases)
    return {'fases': fases,
            'marcadas': [m['imagen'] for m in camino.get('marcadas', []) if m.get('variante') == variante and m['imagen'] in borrables],
            'variantes': [w for w, vw in camino['variantes'].items() if w != variante
                          and (vw.get('origen') or {}).get('variante') == variante and (vw.get('origen') or {}).get('fase') in fases]}


def _sin_salida(v, fase):
    """La fase aún no tiene intentos y ya no le queda entrada aceptada: ni se generaría ni se podría volver atrás."""
    if fase in v['fases']:
        return False
    try:
        fase_de_entrada(v, fase)
    except CaminoInvalido:
        return True
    return False


def borrar_fase(d, camino, variante, fase):
    """Borra del disco las imágenes de `fase` y de lo que cuelga de ella, y deja esas fases sin aceptada: se conservan
    los prompts y las semillas de cada intento. Lo que otra fase o variante sigue usando no se borra."""
    v = _variante(camino, variante)
    if fase not in POR_ID:
        raise CaminoInvalido(f'Fase desconocida: {fase}')
    if not any(i.get('imagen') for i in v['fases'].get(fase, {}).get('intentos', [])):
        raise CaminoInvalido('No hay nada guardado en esta fase')
    fases = tramo(v, fase)
    desde = v['fases'][fase].get('desde')
    borrables = _borrables(camino, variante, fases)
    for f in fases:
        r = v['fases'][f]
        for i in r['intentos']:
            if i.get('imagen') in borrables:
                _borrar_archivos(d, i['imagen'])
                i['imagen'] = None
        r.update(aceptada=None, prompt=None, semilla=None, desfasada=False)
    camino['marcadas'] = [m for m in camino.get('marcadas', []) if not (m.get('variante') == variante and m['imagen'] in borrables)]
    if v['faseActual'] in fases or _sin_salida(v, v['faseActual']):
        v['faseActual'] = desde or (FASE_INICIAL if fase in PASOS else 'F0')


def intento_desfasado(v, fase, intento):
    """True si el intento (el dict o su número) parte de una fase cuya aceptada ya no es la imagen que usó."""
    if not isinstance(intento, dict):
        intento = next((i for i in v.get('fases', {}).get(fase, {}).get('intentos', []) if i['n'] == intento), None)
        if intento is None:
            return False
    origen = intento.get('desde')
    return bool(origen) and intento.get('entrada') != v.get('fases', {}).get(origen, {}).get('aceptada')


def marcar(camino, variante, n, marcada):
    """Marca (o quita) la ★ del intento n de la Final. Marcar no publica: solo deja la imagen lista para combinar."""
    v = _variante(camino, variante)
    f = v['fases'].get('F4')
    if f is None:
        raise CaminoInvalido('Solo se marca ★ en la Final')
    it = next((i for i in f['intentos'] if i['n'] == n), None)
    if it is None:
        raise CaminoInvalido(f'No existe el intento {n} de F4 en {variante}')
    marcadas = camino.setdefault('marcadas', [])
    if not marcada:
        marcadas[:] = [m for m in marcadas if not (m.get('variante') == variante and m['imagen'] == it['imagen'])]
        return
    if not it['imagen']:
        raise CaminoInvalido(f'El intento {n} de F4 falló o ya no tiene imagen: no se puede marcar')
    if intento_desfasado(v, 'F4', it):
        raise CaminoInvalido('Esta Final salió de un boceto que ya no es el aceptado: genera otra')
    if not any(m.get('variante') == variante and m['imagen'] == it['imagen'] for m in marcadas):
        marcadas.append({'imagen': it['imagen'], 'variante': variante, 'pautasVersion': None})
    f.update(aceptada=it['imagen'], prompt=it['prompt'], semilla=it['semilla'], desfasada=False)
    if 'entrada' in it:
        f.update(desde=it['desde'], entrada=it['entrada'])
