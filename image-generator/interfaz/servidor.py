#!/usr/bin/env python3
"""CFG-43 (usuaria, 2026-10-24): interfaz local del generador de imágenes, la que abre `image-generator/abrir.sh`.

Pegas un prompt (o eliges una entidad y trae su prompt usado o el base de la tabla ImagePrompt), generas con
`scripts/probar.sh` (que llama a `generar.sh`, con sus protecciones de memoria, y apunta la tanda), escribes la nota
de cada imagen y, con «Elegir esta», la copias a `salida/images/<tipo>/<slug>-<perfil>.png`, la misma estructura que
`backend/uploads/images/` (`backend/src/lib/imageAssets.ts`). Pasarla al juego es copiarla a mano.
Si en `referencias/images/` (la copia de `backend/uploads/images/` que hace `abrir.sh`) hay imagen de esa entidad, la
página ofrece usarla de referencia con su vista previa.

Una sola generación a la vez (la Deck no aguanta dos). Solo escucha en 127.0.0.1.
Variables (para los tests): IMG_RAIZ (image-generator/), IMG_REFERENCIAS (referencias/images/), IMG_PROBAR, IMG_PSQL, IMG_PUERTO (7861).
"""
import json, os, re, shlex, shutil, subprocess, sys, tempfile, threading, time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.environ.get('IMG_RAIZ', os.path.dirname(AQUI))
PROBAR = os.environ.get('IMG_PROBAR', os.path.join(RAIZ, 'scripts', 'probar.sh'))
PSQL = shlex.split(os.environ.get('IMG_PSQL', 'podman exec -i tarkor-postgres psql -U tarkor -d tarkor -At -c'))
MUNDO = os.environ.get('MUNDO', 'helek-sirik')
REFERENCIAS = os.environ.get('IMG_REFERENCIAS', os.path.join(RAIZ, 'referencias', 'images'))
PERFILES = ('banner', 'thumbnail', 'mapa', 'icono')
SLUG = re.compile(r'^[A-Za-z0-9][A-Za-z0-9-]*$')  # el juego respeta las mayúsculas (CAZADOR)
EXTENSIONES = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'webp': 'image/webp'}
CABECERA_REGISTRO = ['fecha', 'nombre', 'tipo', 'slug', 'perfil', 'prompt', 'semilla', 'pasos', 'tamaño', 'extra',
                     'salida', 'segundos']


class Invalido(ValueError):
    pass


def slug(valor, campo):
    if not isinstance(valor, str) or not SLUG.match(valor):
        raise Invalido(f'«{valor}» no vale como {campo}: solo letras sin tilde, cifras y guiones')
    return valor


def entero(valor, campo, minimo, maximo):
    try:
        n = int(valor)
    except (TypeError, ValueError):
        raise Invalido(f'{campo} tiene que ser un número')
    if not minimo <= n <= maximo:
        raise Invalido(f'{campo}: de {minimo} a {maximo}')
    return n


def pruebas(tanda=None):
    d = os.path.join(RAIZ, 'pruebas')
    return os.path.join(d, slug(tanda, 'tanda')) if tanda is not None else d


def destino_salida(tipo, slug_, perfil):
    """Ruta en salida/ con el nombre que busca el juego: images/<tipo>/<slug>-<perfil>.png."""
    return os.path.join(RAIZ, 'salida', 'images', slug(tipo, 'tipo'), f"{slug(slug_, 'slug')}-{perfil}.png")


# --- base de datos (ImagePrompt) ---

def consulta_json(sql):
    r = subprocess.run(PSQL + [sql], capture_output=True, text=True, timeout=20)
    if r.returncode != 0:
        raise RuntimeError(f'la base no responde ({r.stderr.strip()[:200]}); ¿está arrancado tarkor-postgres?')
    return json.loads(r.stdout.strip() or 'null')


def donde(tipo, slug_, perfil):
    return (f"\"worldId\"=(select id from \"World\" where slug='{slug(MUNDO, 'mundo')}') and "
            f"\"entityType\"='{slug(tipo, 'tipo')}' and \"entitySlug\"='{slug(slug_, 'slug')}' and \"sizeProfile\"='{perfil}'")


def entidades():
    sql = ("select coalesce(json_agg(json_build_object('tipo',\"entityType\",'slug',\"entitySlug\",'perfil',\"sizeProfile\","
           "'usado',\"promptUsado\" is not null) order by \"entityType\",\"entitySlug\",\"sizeProfile\"),'[]') "
           f"from \"ImagePrompt\" where \"worldId\"=(select id from \"World\" where slug='{slug(MUNDO, 'mundo')}')")
    return consulta_json(sql)


def prompt_de(tipo, slug_, perfil):
    fila = consulta_json(f"select json_build_object('usado',\"promptUsado\",'base',prompt) from \"ImagePrompt\" "
                         f"where {donde(tipo, slug_, perfil)}")
    if not fila:
        return None
    return {'prompt': fila['usado'] or fila['base'], 'fuente': 'usado' if fila['usado'] else 'base'}


# --- tanda: registro.tsv (lo escribe probar.sh), notas.md y elegidas.tsv ---

def leer_notas(d):
    notas = {}
    try:
        for l in open(os.path.join(d, 'notas.md'), encoding='utf-8'):
            m = re.match(r'^- ([A-Za-z0-9-]+): (.*)$', l.rstrip('\n'))
            if m:
                notas[m.group(1)] = m.group(2)
    except FileNotFoundError:
        pass
    return notas


def guardar_nota(tanda, nombre, texto):
    d = pruebas(tanda)
    slug(nombre, 'nombre')
    texto = ' '.join(str(texto).split())  # una línea por imagen
    ruta = os.path.join(d, 'notas.md')
    try:
        lineas = open(ruta, encoding='utf-8').read().split('\n')
    except FileNotFoundError:
        lineas = [f'# Notas de la tanda {tanda}', '']
    lineas = [l for l in lineas if not l.startswith(f'- {nombre}: ')]
    while lineas and lineas[-1] == '':
        lineas.pop()
    if lineas and not lineas[-1].startswith('- '):
        lineas.append('')  # una línea en blanco entre la cabecera y la primera nota
    if texto:
        lineas.append(f'- {nombre}: {texto}')
    os.makedirs(d, exist_ok=True)
    open(ruta, 'w', encoding='utf-8').write('\n'.join(lineas) + '\n')


def leer_elegidas(d):
    elegidas = {}
    try:
        for l in open(os.path.join(d, 'elegidas.tsv'), encoding='utf-8'):
            partes = l.rstrip('\n').split('\t')
            if len(partes) == 2:
                elegidas[partes[1]] = partes[0]  # destino → nombre (la última elegida para ese destino)
    except FileNotFoundError:
        pass
    return elegidas


def leer_tanda(tanda):
    d = pruebas(tanda)
    filas = []
    try:
        lineas = open(os.path.join(d, 'registro.tsv'), encoding='utf-8').read().splitlines()
    except FileNotFoundError:
        lineas = []
    notas, elegidas = leer_notas(d), leer_elegidas(d)
    for l in lineas[1:]:
        f = dict(zip(CABECERA_REGISTRO, l.split('\t')))
        if 'nombre' not in f:
            continue
        rel = os.path.relpath(destino_salida(f['tipo'], f['slug'], f['perfil']), RAIZ)
        try:
            prompt = open(os.path.join(d, 'prompts', f['nombre'] + '.txt'), encoding='utf-8').read().strip()
        except FileNotFoundError:
            prompt = ''
        f.update(imagen=os.path.exists(os.path.join(d, 'imagenes', f['nombre'] + '.png')), nota=notas.get(f['nombre'], ''),
                 elegida=elegidas.get(rel) == f['nombre'], destino=rel, textoPrompt=prompt)
        filas.append(f)
    return list(reversed(filas))  # la más reciente primero


def tandas():
    try:
        nombres = [n for n in os.listdir(pruebas()) if SLUG.match(n) and os.path.isdir(pruebas(n))]
        return sorted(nombres, key=lambda n: os.path.getmtime(pruebas(n)), reverse=True)  # la más reciente primero
    except FileNotFoundError:
        return []


def elegir(tanda, nombre):
    d = pruebas(tanda)
    fila = next((f for f in leer_tanda(tanda) if f['nombre'] == slug(nombre, 'nombre')), None)
    if not fila or not fila['imagen']:
        raise Invalido(f'no hay imagen {nombre} en la tanda {tanda}')
    destino = destino_salida(fila['tipo'], fila['slug'], fila['perfil'])
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    shutil.copyfile(os.path.join(d, 'imagenes', nombre + '.png'), destino)
    rel = os.path.relpath(destino, RAIZ)
    with open(os.path.join(d, 'elegidas.tsv'), 'a', encoding='utf-8') as e:
        e.write(f'{nombre}\t{rel}\n')
    return rel


def referencia_de(tipo, slug_, perfil):
    """La imagen del juego de esa entidad en referencias/images/<tipo>/: la de su perfil y, si no, la de otro."""
    d = os.path.join(REFERENCIAS, slug(tipo, 'tipo'))
    for p in (perfil,) + tuple(x for x in PERFILES if x != perfil):
        for ext in EXTENSIONES:
            if os.path.isfile(os.path.join(d, f'{slug(slug_, "slug")}-{p}.{ext}')):
                return {'ruta': f'{tipo}/{slug_}-{p}.{ext}', 'perfil': p}
    return None


# --- generación (una a la vez) ---

class Trabajo:
    def __init__(self):
        self.cerrojo = threading.Lock()
        self.estado = {'enMarcha': False}

    def lanzar(self, peticion):
        tanda = slug(peticion.get('tanda'), 'tanda')
        tipo = slug(peticion.get('tipo'), 'tipo')
        slug_ = slug(peticion.get('slug'), 'slug')
        perfil = peticion.get('perfil')
        if perfil not in PERFILES:
            raise Invalido(f'perfil desconocido: {perfil}')
        semilla = entero(peticion.get('semilla', 42), 'la semilla', 0, 2 ** 31 - 1)
        pasos = entero(peticion.get('pasos', 4), 'los pasos', 1, 20)
        extra = []
        if peticion.get('usarReferencia'):
            ref = referencia_de(tipo, slug_, perfil)
            if not ref:
                raise Invalido(f'no hay imagen de {tipo}/{slug_} en image-generator/referencias/images/')
            extra = ['-r', os.path.join(REFERENCIAS, ref['ruta'])]
        env = dict(os.environ, LIBERAR_OLLAMA='1', MUNDO=MUNDO)
        archivo = None
        if not peticion.get('desdeBase'):
            texto = str(peticion.get('prompt') or '').strip()
            if not texto:
                raise Invalido('el prompt está vacío')
            fd, archivo = tempfile.mkstemp(prefix='prompt-', suffix='.txt')
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                f.write(texto + '\n')
            env['PROMPT_ARCHIVO'] = archivo
        with self.cerrojo:
            if self.estado['enMarcha']:
                if archivo:
                    os.unlink(archivo)
                raise Invalido('ya hay una imagen generándose; espera a que acabe')
            self.estado = {'enMarcha': True, 'tanda': tanda, 'inicio': time.time(), 'salida': [], 'nombre': None,
                           'rc': None}
        orden = [PROBAR, tanda, tipo, slug_, perfil, str(semilla), str(pasos)] + extra
        threading.Thread(target=self._correr, args=(orden, env, archivo), daemon=True).start()

    def _correr(self, orden, env, archivo):
        try:
            p = subprocess.Popen(orden, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            for linea in p.stdout:
                linea = linea.rstrip('\n')
                with self.cerrojo:
                    self.estado['salida'].append(linea)
                    m = re.match(r'^imagen: .*/([A-Za-z0-9-]+)\.png', linea)
                    if m:
                        self.estado['nombre'] = m.group(1)
            rc = p.wait()
        except OSError as e:
            with self.cerrojo:
                self.estado['salida'].append(f'ERROR: no se pudo lanzar probar.sh: {e}')
            rc = 127
        finally:
            if archivo:
                os.unlink(archivo)
        with self.cerrojo:
            self.estado.update(enMarcha=False, rc=rc, fin=time.time())

    def ver(self):
        with self.cerrojo:
            e = dict(self.estado, salida=list(self.estado.get('salida', [])))
        if e.get('inicio'):
            e['segundos'] = int((e.get('fin') or time.time()) - e['inicio'])
        if e['enMarcha']:
            e['progreso'] = progreso(e['tanda'], e['inicio'])
        e['salida'] = e['salida'][-8:]
        return e


def progreso(tanda, desde):
    """Paso N/M del sd-cli que corre, sacado del log más reciente de la tanda (generar.sh lo escribe con -v)."""
    d = os.path.join(pruebas(tanda), 'logs')
    try:
        logs = [os.path.join(d, n) for n in os.listdir(d) if n.endswith('.log')]
    except FileNotFoundError:
        return 'preparando'
    logs = [l for l in logs if os.path.getmtime(l) >= desde - 1]
    if not logs:
        return 'preparando'
    with open(max(logs, key=os.path.getmtime), 'rb') as f:
        f.seek(0, 2)
        f.seek(max(0, f.tell() - 8192))
        cola = f.read().decode('utf-8', 'replace')
    if 'decode_first_stage completed' in cola:
        return 'guardando la imagen'
    # El muestreo pinta «|====>  | 3/4 - 1.26it/s» (o s/it); la carga de pesos, «|####| 4/4 - 847MB/s».
    pasos = re.findall(r'\|[=> ]*\|\s*(\d+)/(\d+)\s*-\s*[\d.]+\s*(?:it/s|s/it)', cola)
    if pasos and pasos[-1][0] == pasos[-1][1]:
        return 'decodificando la imagen'
    if pasos:
        return f'muestreo {pasos[-1][0]}/{pasos[-1][1]}'
    return 'cargando modelos'


TRABAJO = Trabajo()


class Manejador(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def responder(self, codigo, cuerpo, tipo='application/json; charset=utf-8'):
        datos = cuerpo if isinstance(cuerpo, bytes) else json.dumps(cuerpo, ensure_ascii=False).encode('utf-8')
        self.send_response(codigo)
        self.send_header('Content-Type', tipo)
        self.send_header('Content-Length', str(len(datos)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(datos)

    def archivo(self, ruta, tipo):
        if not os.path.isfile(ruta):
            return self.responder(404, {'error': 'no existe'})
        self.responder(200, open(ruta, 'rb').read(), tipo)

    def atender(self, accion):
        try:
            return accion()
        except Invalido as e:
            self.responder(400, {'error': str(e)})
        except (RuntimeError, json.JSONDecodeError, subprocess.TimeoutExpired) as e:
            self.responder(502, {'error': str(e)})

    def do_GET(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        partes = u.path.strip('/').split('/')
        if u.path == '/':
            return self.archivo(os.path.join(AQUI, 'index.html'), 'text/html; charset=utf-8')
        if u.path == '/api/estado':
            return self.responder(200, TRABAJO.ver())
        if u.path == '/api/inicio':
            return self.responder(200, {'tandas': tandas(), 'perfiles': PERFILES,
                                        'mundo': MUNDO})
        if u.path == '/api/entidades':
            return self.atender(lambda: self.responder(200, entidades()))
        if u.path == '/api/prompt':
            def p():
                perfil = q.get('perfil')
                if perfil not in PERFILES:
                    raise Invalido(f'perfil desconocido: {perfil}')
                r = prompt_de(q.get('tipo'), q.get('slug'), perfil)
                self.responder(200 if r else 404, r or {'error': 'esa entidad no tiene prompt para ese perfil'})
            return self.atender(p)
        if u.path == '/api/referencia':
            def r():
                perfil = q.get('perfil')
                if perfil not in PERFILES:
                    raise Invalido(f'perfil desconocido: {perfil}')
                self.responder(200, referencia_de(q.get('tipo'), q.get('slug'), perfil) or {'ruta': None})
            return self.atender(r)
        if len(partes) == 3 and partes[0] == 'ref':  # /ref/<tipo>/<slug>-<perfil>.<ext>
            def ref():
                base, _, ext = partes[2].rpartition('.')
                if ext not in EXTENSIONES:
                    raise Invalido('solo imágenes')
                self.archivo(os.path.join(REFERENCIAS, slug(partes[1], 'tipo'), slug(base, 'nombre') + '.' + ext),
                             EXTENSIONES[ext])
            return self.atender(ref)
        if u.path == '/api/tanda':
            return self.atender(lambda: self.responder(200, leer_tanda(q.get('tanda'))))
        if len(partes) == 3 and partes[0] == 'img':  # /img/<tanda>/<nombre>.png
            def img():
                nombre = partes[2][:-4] if partes[2].endswith('.png') else ''
                self.archivo(os.path.join(pruebas(partes[1]), 'imagenes', slug(nombre, 'nombre') + '.png'), 'image/png')
            return self.atender(img)
        self.responder(404, {'error': 'no existe'})

    def do_POST(self):
        try:
            peticion = json.loads(self.rfile.read(int(self.headers.get('Content-Length') or 0)) or b'{}')
        except json.JSONDecodeError:
            return self.responder(400, {'error': 'cuerpo que no es JSON'})
        u = urlparse(self.path).path
        if u == '/api/generar':
            return self.atender(lambda: (TRABAJO.lanzar(peticion), self.responder(202, {'ok': True})))
        if u == '/api/nota':
            return self.atender(lambda: (guardar_nota(peticion.get('tanda'), peticion.get('nombre'),
                                                      peticion.get('texto', '')), self.responder(200, {'ok': True})))
        if u == '/api/elegir':
            return self.atender(lambda: self.responder(200, {'destino': elegir(peticion.get('tanda'),
                                                                                peticion.get('nombre'))}))
        self.responder(404, {'error': 'no existe'})


def main():
    puerto = int(os.environ.get('IMG_PUERTO', '7861'))
    servidor = ThreadingHTTPServer(('127.0.0.1', puerto), Manejador)
    print(f'Generador de imágenes en http://127.0.0.1:{puerto}/ (Ctrl+C para pararlo)', flush=True)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    sys.exit(main())
