"""IMG-41 (usuaria, 2026-11-07): núcleo del servidor de la interfaz, sin nada de Tarkor ni del generador.

Lo que comparte con el de `galivelop-image-generator` (GVIG, diseño §3.4): servidor `ThreadingHTTPServer` solo con
stdlib, un router de rutas por patrón, los POST solo con JSON y desde la propia página, los estáticos de una carpeta
con la CSP de GVIG (`gimg/server.py#STATIC_CSP`), los errores como `{error: "texto"}` con su código, y un trabajo a la
vez (un proceso) con la cola de lo que corre y lo último terminado. Lo de cada producto (sus rutas, su catálogo, qué
proceso lanza) va en su servidor y su adaptador: aquí, `servidor.py` y `adaptador_tarkor.py`.
"""
import json, os, re, subprocess, threading, time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

SLUG = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_-]*$')  # un trozo de ruta seguro, con mayúsculas
TIPOS_UI = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
            '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
            '.json': 'application/json; charset=utf-8'}
# La CSP de GVIG: nada en línea ni externo.
STATIC_CSP = ("default-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self'; "
              "frame-ancestors 'none'; base-uri 'none'; form-action 'none'")


class Invalido(ValueError):
    """Una petición que no vale: 400 con el motivo."""


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


# --- rutas ---

class Peticion:
    """Lo que recibe cada ruta: `q` (la query, un valor por clave), `params` (los `{nombre}` del patrón; `*` es el resto
    de la ruta tal cual), `cuerpo` (el JSON de un POST) y `h`, el manejador, para servir archivos."""

    def __init__(self, h, q, params, cuerpo=None):
        self.h, self.q, self.params, self.cuerpo = h, q, params, cuerpo


class Rutas:
    """Tabla de rutas. Patrones: '/api/estado' (exacto), '/img/{tipo}/{slug}/{nombre}' (un trozo por `{}`, vacío
    incluido: lo valida la ruta) y '/ui/*' (el resto, sin decodificar ni partir). Gana la primera que casa.

    Una ruta devuelve el cuerpo JSON (200), `(código, cuerpo)` o None si ya respondió (un archivo)."""

    def __init__(self):
        self.tabla = []

    def get(self, patron):
        return self._sumar('GET', patron)

    def post(self, patron):
        return self._sumar('POST', patron)

    def _sumar(self, metodo, patron):
        def sumar(fn):
            self.tabla.append((metodo, patron, fn))
            return fn
        return sumar

    def buscar(self, metodo, ruta):
        """(función, params) de la primera ruta que casa, o (None, None)."""
        partes = ruta.strip('/').split('/')
        for m, patron, fn in self.tabla:
            if m != metodo:
                continue
            if patron.endswith('/*'):
                prefijo = patron[:-1]
                if ruta.startswith(prefijo):
                    return fn, {'*': ruta[len(prefijo):]}
                continue
            if '{' not in patron:
                if ruta == patron:
                    return fn, {}
                continue
            trozos = patron.strip('/').split('/')
            if len(trozos) != len(partes):
                continue
            params = {}
            for t, p in zip(trozos, partes):
                if t.startswith('{') and t.endswith('}'):
                    params[t[1:-1]] = p
                elif t != p:
                    break
            else:
                return fn, params
        return None, None


class Manejador(BaseHTTPRequestHandler):
    """El manejador del núcleo: cada producto lo hereda y pone sus `rutas` (una `Rutas`)."""
    rutas = Rutas()

    def log_message(self, *_):
        pass

    def responder(self, codigo, cuerpo, tipo='application/json; charset=utf-8', cabeceras=None):
        datos = cuerpo if isinstance(cuerpo, bytes) else json.dumps(cuerpo, ensure_ascii=False).encode('utf-8')
        self.send_response(codigo)
        self.send_header('Content-Type', tipo)
        self.send_header('Content-Length', str(len(datos)))
        cabeceras = cabeceras or {}
        if 'Cache-Control' not in cabeceras:
            self.send_header('Cache-Control', 'no-store')
        for nombre, valor in cabeceras.items():
            self.send_header(nombre, valor)
        self.end_headers()
        self.wfile.write(datos)

    def archivo(self, ruta, tipo):
        if not os.path.isfile(ruta):
            return self.responder(404, {'error': 'no existe'})
        with open(ruta, 'rb') as f:
            self.responder(200, f.read(), tipo)

    def estatico(self, carpeta, ruta):
        """Un archivo de `carpeta` con la CSP de GVIG y `no-cache`. Nunca sale de ella (`..`, rutas absolutas, enlaces)."""
        base = os.path.realpath(carpeta)
        destino = os.path.realpath(os.path.join(base, ruta))
        if not destino.startswith(base + os.sep):
            return self.responder(403, {'error': 'fuera de la carpeta'})
        tipo = TIPOS_UI.get(os.path.splitext(destino)[1].lower())
        if tipo is None or not os.path.isfile(destino):
            return self.responder(404, {'error': 'no existe'})
        with open(destino, 'rb') as f:
            datos = f.read()
        self.responder(200, datos, tipo, {'Content-Security-Policy': STATIC_CSP, 'Cache-Control': 'no-cache'})

    def atender(self, fn, peticion):
        try:
            r = fn(peticion)
        except Invalido as e:
            return self.responder(400, {'error': str(e)})
        except (RuntimeError, json.JSONDecodeError, subprocess.TimeoutExpired) as e:
            return self.responder(502, {'error': str(e)})
        except (OSError, UnicodeDecodeError) as e:
            return self.responder(500, {'error': f'{type(e).__name__}: {e}'})
        if r is None:
            return
        codigo, cuerpo = r if isinstance(r, tuple) else (200, r)
        self.responder(codigo, cuerpo)

    def do_GET(self):
        u = urlparse(self.path)
        fn, params = self.rutas.buscar('GET', u.path)
        if not fn:
            return self.responder(404, {'error': 'no existe'})
        self.atender(fn, Peticion(self, {k: v[0] for k, v in parse_qs(u.query).items()}, params))

    def do_POST(self):
        # Otra web abierta en el navegador podría lanzar trabajos con un POST text/plain (sin preflight): solo JSON y
        # desde esta misma página.
        origen = self.headers.get('Origin')
        if (self.headers.get('Content-Type') or '').split(';')[0].strip() != 'application/json' or \
                (origen and urlparse(origen).netloc != self.headers.get('Host')):
            return self.responder(403, {'error': 'solo desde la propia interfaz'})
        try:
            cuerpo = json.loads(self.rfile.read(int(self.headers.get('Content-Length') or 0)) or b'{}')
        except json.JSONDecodeError:
            return self.responder(400, {'error': 'cuerpo que no es JSON'})
        fn, params = self.rutas.buscar('POST', urlparse(self.path).path)
        if not fn:
            return self.responder(404, {'error': 'no existe'})
        self.atender(fn, Peticion(self, {}, params, cuerpo))


# --- trabajo (uno a la vez) y cola ---

class Trabajo:
    """Un proceso a la vez (la Deck no aguanta dos), con su salida, y la cola de `GET /api/cola`: lo que corre y los
    últimos `maximo` terminados, en memoria (se pierden al cerrar el servidor).

    `datos` son los campos del producto que van en la entrada de la cola (elemento, perfil, `estimado`…).
    `progreso(estado)` da (texto, paso, pasos) de lo que corre; `log_final(estado)`, el final del log si falló;
    `resultado`, la expresión cuyo grupo 1, en una línea de la salida, es el nombre del intento."""

    def __init__(self, maximo=20, progreso=None, log_final=None, resultado=None):
        self.cerrojo = threading.Lock()
        self.estado = {'enMarcha': False}
        self.siguiente = 1
        self.historial = []  # entradas de la cola ya terminadas, la más reciente primero
        self.maximo = maximo
        self.progreso = progreso or (lambda e: (None, None, None))
        self.log_final = log_final or (lambda e: '')
        self.resultado = resultado

    def empezar(self, orden, datos, env=None, que=None, ocupado=None, motivo_ocupado=None, limpiar=None):
        """Lanza `orden` en un hilo. Si ya corre uno (o `ocupado()` dice que sí), `Invalido` con `motivo_ocupado`.
        `limpiar()` se llama siempre al final, también si no llega a lanzarse. `que` nombra la orden en los errores."""
        with self.cerrojo:
            if self.estado['enMarcha'] or (ocupado and ocupado()):
                if limpiar:
                    limpiar()
                raise Invalido(motivo_ocupado or 'ya hay un trabajo en marcha; espera a que acabe')
            self.estado = dict(datos, enMarcha=True, id=self.siguiente, inicio=time.time(), salida=[], nombre=None,
                               rc=None)
            self.siguiente += 1
        threading.Thread(target=self._correr, args=(orden, env, que or os.path.basename(orden[0]), limpiar),
                         daemon=True).start()

    def _correr(self, orden, env, que, limpiar):
        rc = 1
        try:
            p = subprocess.Popen(orden, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            for linea in p.stdout:
                linea = linea.rstrip('\n')
                with self.cerrojo:
                    self.estado['salida'].append(linea)
                    m = self.resultado.match(linea) if self.resultado else None
                    if m:
                        self.estado['nombre'] = m.group(1)
            rc = p.wait()
        except OSError as e:
            with self.cerrojo:
                self.estado['salida'].append(f'ERROR: no se pudo lanzar {que}: {e}')
            rc = 127
        except Exception as e:  # sin esto, `enMarcha` se quedaría en True y no dejaría lanzar más
            with self.cerrojo:
                self.estado['salida'].append(f'ERROR: {e}')
        finally:
            if limpiar:
                limpiar()
            with self.cerrojo:
                self.estado.update(enMarcha=False, rc=rc, fin=time.time())
                self.historial.insert(0, self._entrada(self.estado))
                del self.historial[self.maximo:]

    PROPIOS = ('enMarcha', 'id', 'inicio', 'salida', 'nombre', 'rc', 'fin')

    @classmethod
    def _entrada(cls, e, progreso=None):
        """Una entrada de la cola: el contrato común con la de GVIG (estado, intento, progreso, error) más los datos."""
        rc = e.get('rc')
        return {'id': e['id'], 'estado': 'generando' if e['enMarcha'] else ('hecho' if rc == 0 else 'fallido'),
                **{k: v for k, v in e.items() if k not in cls.PROPIOS},
                'intento': e['nombre'] if rc == 0 else None, 'segundos': int((e.get('fin') or time.time()) - e['inicio']),
                'progreso': progreso, 'error': (e['salida'][-1] if e['salida'] else f'salida {rc}') if rc else None}

    def cola(self):
        """Lo que corre ahora (con su progreso) y lo terminado desde que se abrió el servidor."""
        with self.cerrojo:
            e = dict(self.estado) if self.estado['enMarcha'] else None
            hechos = list(self.historial)
        if not e:
            return hechos
        texto, paso, pasos = self.progreso(e)
        return [self._entrada(e, {'texto': texto, 'paso': paso, 'pasos': pasos})] + hechos

    def ver(self):
        """El estado del último trabajo: su salida (las 8 últimas líneas), segundos y progreso, o el log si falló."""
        with self.cerrojo:
            e = dict(self.estado, salida=list(self.estado.get('salida', [])))
        if e.get('inicio'):
            e['segundos'] = int((e.get('fin') or time.time()) - e['inicio'])
            texto, e['paso'], e['pasos'] = self.progreso(e)
            if e['enMarcha']:
                e['progreso'] = texto
            elif e.get('rc'):
                e['logFinal'] = self.log_final(e)
        e['salida'] = e['salida'][-8:]
        return e


def servir(manejador, puerto, titulo):
    """Escucha solo en 127.0.0.1 hasta Ctrl+C."""
    srv = ThreadingHTTPServer(('127.0.0.1', puerto), manejador)
    print(f'{titulo} en http://127.0.0.1:{puerto}/ (Ctrl+C para pararlo)', flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
