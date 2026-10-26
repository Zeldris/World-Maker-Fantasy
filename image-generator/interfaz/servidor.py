#!/usr/bin/env python3
"""CFG-43 (usuaria, 2026-10-24): interfaz local del generador de imágenes, la que abre `image-generator/abrir.sh`.

Todo es por elemento, en `generated/<tipo>/<slug>/` (fuera de git): `intentos/<perfil>-s<semilla>-p<pasos>-<fecha>.png`,
`prompts/` y `logs/` con el mismo nombre, `registro.tsv` (una fila por intento), `notas.md`, `elegidas.tsv` y, por
perfil, la elegida `<slug>-<perfil>.png` con el nombre del juego (para copiarla a `backend/uploads/images/<tipo>/`).
Genera con `scripts/probar.sh <tipo> <slug> <perfil> [semilla] [pasos]` (que llama a `generar.sh`, con sus protecciones
de memoria). El prompt viene de la tabla ImagePrompt (usado, si no el base) o pegado. Si en `referencias/images/` (la
copia de `backend/uploads/images/` que hace `abrir.sh`) hay imagen de ese elemento, se ve y se puede usar de referencia.

API (JSON salvo las imágenes):
  GET  /api/inicio                          perfiles y mundo
  GET  /api/elementos                       {elementos:[{tipo,slug,perfiles:[{perfil,usado}],juego,intentos,elegidas}], aviso}
                                            une la BD y generated/; sin BD devuelve los de generated/ y un aviso
  GET  /api/elemento?tipo&slug              intentos del elemento, el más reciente primero
  GET  /api/prompt?tipo&slug&perfil         prompt usado o base de la BD
  GET  /api/referencia?tipo&slug&perfil     imagen del juego {ruta, perfil} o {ruta: null}
  GET  /api/estado                          generación en curso: progreso, paso, pasos, segundos, estimado, rc, logFinal
  GET  /img/<tipo>/<slug>/<nombre>.png      un intento;  GET /elegida/<tipo>/<slug>/<perfil>.png  la elegida
  GET  /ref/<tipo>/<slug>-<perfil>.<ext>    imagen del juego
  POST /api/generar {tipo,slug,perfil,semilla,pasos,prompt|desdeBase,usarReferencia}
  POST /api/nota {tipo,slug,nombre,texto};  POST /api/elegir {tipo,slug,nombre}

Una sola generación a la vez (la Deck no aguanta dos). Solo escucha en 127.0.0.1.
Variables (para los tests): IMG_RAIZ (image-generator/), IMG_REFERENCIAS (referencias/images/), IMG_PROBAR, IMG_PSQL, IMG_API (backend del juego, ''
= sin catálogo), IMG_PUERTO (7861).
"""
import json, os, re, shlex, shutil, statistics, subprocess, sys, tempfile, threading, time, unicodedata, urllib.request
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.environ.get('IMG_RAIZ', os.path.dirname(AQUI))
PROBAR = os.environ.get('IMG_PROBAR', os.path.join(RAIZ, 'scripts', 'probar.sh'))
PSQL = shlex.split(os.environ.get('IMG_PSQL', 'podman exec -i tarkor-postgres psql -U tarkor -d tarkor -At -c'))
MUNDO = os.environ.get('MUNDO', 'helek-sirik')
API = os.environ.get('IMG_API', 'http://127.0.0.1:3001')
GENERADO = os.path.join(RAIZ, 'generated')
REFERENCIAS = os.environ.get('IMG_REFERENCIAS', os.path.join(RAIZ, 'referencias', 'images'))
PERFILES = ('banner', 'thumbnail', 'mapa', 'icono')
SLUG = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_-]*$')  # el juego respeta las mayúsculas (CAZADOR)
# Los bancos de calidad (docs/producto/plan-imagenes/banco.sh y calidad.sh, IMG-15) dejan sus intentos en generated/banco/:
# no son elementos del juego ni cuentan para el tiempo estimado (prueban otros modelos, pasos y tamaños).
BANCO = 'banco'
EXTENSIONES = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'webp': 'image/webp'}
CABECERA_REGISTRO = ['fecha', 'nombre', 'perfil', 'prompt', 'semilla', 'pasos', 'tamaño', 'extra', 'salida', 'segundos']
ESTIMADO_BASE = {'thumbnail': 105, 'banner': 110, 'mapa': 110, 'icono': 80}  # segundos, sin referencia
FACTOR_REFERENCIA = 1.9


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


def elemento_dir(tipo, slug_):
    return os.path.join(GENERADO, slug(tipo, 'tipo'), slug(slug_, 'slug'))


def destino_elegida(tipo, slug_, perfil):
    """Ruta con el nombre que busca el juego: generated/<tipo>/<slug>/<slug>-<perfil>.png."""
    if perfil not in PERFILES:
        raise Invalido(f'perfil desconocido: {perfil}')
    return os.path.join(elemento_dir(tipo, slug_), f'{slug_}-{perfil}.png')


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
    # Una fila con un tipo o slug que no son rutas válidas (una tilde, un «:») no tumba la lista: se salta.
    return [e for e in consulta_json(sql) or [] if SLUG.match(str(e.get('tipo'))) and SLUG.match(str(e.get('slug')))]


def prompt_de(tipo, slug_, perfil):
    fila = consulta_json(f"select json_build_object('usado',\"promptUsado\",'base',prompt) from \"ImagePrompt\" "
                         f"where {donde(tipo, slug_, perfil)}")
    if not fila:
        return None
    return {'prompt': fila['usado'] or fila['base'], 'fuente': 'usado' if fila['usado'] else 'base'}


# --- elemento: registro.tsv (lo escribe probar.sh), notas.md y elegidas.tsv ---

def leer_notas(d):
    notas = {}
    try:
        for l in open(os.path.join(d, 'notas.md'), encoding='utf-8'):
            m = re.match(r'^- ([A-Za-z0-9_-]+): (.*)$', l.rstrip('\n'))
            if m:
                notas[m.group(1)] = m.group(2)
    except FileNotFoundError:
        pass
    return notas


def guardar_nota(tipo, slug_, nombre, texto):
    d = elemento_dir(tipo, slug_)
    slug(nombre, 'nombre')
    texto = ' '.join(str(texto).split())  # una línea por intento
    ruta = os.path.join(d, 'notas.md')
    try:
        lineas = open(ruta, encoding='utf-8').read().split('\n')
    except FileNotFoundError:
        lineas = [f'# Notas de {tipo}/{slug_}', '']
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


def filas_registro(d):
    try:
        lineas = open(os.path.join(d, 'registro.tsv'), encoding='utf-8').read().splitlines()
    except FileNotFoundError:
        return []
    filas = [dict(zip(CABECERA_REGISTRO, l.split('\t'))) for l in lineas[1:]]
    return [f for f in filas if 'nombre' in f]


def leer_elemento(tipo, slug_):
    d = elemento_dir(tipo, slug_)
    notas, elegidas = leer_notas(d), leer_elegidas(d)
    filas = []
    for f in filas_registro(d):
        rel = os.path.relpath(destino_elegida(tipo, slug_, f['perfil']), RAIZ) if f.get('perfil') in PERFILES else ''
        try:
            prompt = open(os.path.join(d, 'prompts', f['nombre'] + '.txt'), encoding='utf-8').read().strip()
        except FileNotFoundError:
            prompt = ''
        f.update(imagen=os.path.exists(os.path.join(d, 'intentos', f['nombre'] + '.png')), nota=notas.get(f['nombre'], ''),
                 elegida=bool(rel) and elegidas.get(rel) == f['nombre'], destino=rel, textoPrompt=prompt,
                 conReferencia='-r' in f.get('extra', '').split())
        filas.append(f)
    # el más reciente primero (a igual fecha, el último apuntado)
    return sorted(reversed(filas), key=lambda f: f.get('fecha', ''), reverse=True)


def elegir(tipo, slug_, nombre):
    d = elemento_dir(tipo, slug_)
    fila = next((f for f in leer_elemento(tipo, slug_) if f['nombre'] == slug(nombre, 'nombre')), None)
    if not fila or not fila['imagen']:
        raise Invalido(f'no hay imagen {nombre} en {tipo}/{slug_}')
    destino = destino_elegida(tipo, slug_, fila['perfil'])
    shutil.copyfile(os.path.join(d, 'intentos', nombre + '.png'), destino)
    rel = os.path.relpath(destino, RAIZ)
    with open(os.path.join(d, 'elegidas.tsv'), 'a', encoding='utf-8') as e:
        e.write(f'{nombre}\t{rel}\n')
    return rel


# Sección de /world/<mundo>/enciclopedia → (carpeta de imágenes, campo del slug); fauna y flora según `esFauna`.
SECCIONES = {'npcs': ('npc', 'slug'), 'items': ('item', 'slug'), 'faunaFlora': (None, 'sourceSlug'),
             'locations': ('location', 'slug'), 'razas': ('raza', 'slug'), 'personajes': ('personaje', 'slug'),
             'constructionRecipes': ('construccion', 'key'), 'craftingRecipes': ('crafteo', 'key'),
             'factions': ('faction', 'slug'), 'historia': ('historia', 'slug')}
ESQUEMA = os.environ.get('IMG_ESQUEMA', os.path.join(os.path.dirname(RAIZ), 'backend', 'prisma', 'schema.prisma'))


def slugify(nombre):
    """El `slugify` del backend (backend/src/lib/slugify.ts), que da el slug de cada habilidad."""
    s_ = ''.join(c for c in unicodedata.normalize('NFD', nombre) if not unicodedata.combining(c)).lower()
    return re.sub(r'[^a-z0-9]+', '-', s_).strip('-')


def enum_prisma(nombre):
    """Valores del enum `nombre` de schema.prisma: las clases y especializaciones usan el valor como slug."""
    try:
        with open(ESQUEMA, encoding='utf-8') as f:
            m = re.search(rf'^enum {nombre} \{{(.*?)^\}}', f.read(), re.S | re.M)
    except OSError:
        return []
    return re.findall(r'^\s*([A-Z][A-Z0-9_]*)\s*$', m.group(1), re.M) if m else []


def catalogo():
    """[(tipo, slug, nombre)] de toda la enciclopedia, del backend del juego (si no corre, error), con lo anidado
    (variantes por sexo, de raza y de tiempo; el mapa de zona de cada lugar; las habilidades) y las clases y
    especializaciones de schema.prisma."""
    with urllib.request.urlopen(f'{API}/world/{slug(MUNDO, "mundo")}/enciclopedia', timeout=10) as r:
        datos = json.load(r)
    out = []

    def sumar(tipo, s_, nombre):
        if s_ and SLUG.match(s_):
            out.append((tipo, s_, nombre))

    def con_sexos(tipo, e, s_, nombre):
        if not s_:
            return
        sumar(tipo, s_, nombre)
        for v in e.get('variantesSexo') or []:
            if v.get('sexo'):
                sumar(tipo, f"{s_}-{v['sexo']}", f"{nombre} ({v['sexo']})")

    for seccion, (tipo, campo) in SECCIONES.items():
        for e in datos.get(seccion) or []:
            t = tipo or ('fauna' if e.get('esFauna') else 'flora')
            s_, nombre = e.get(campo), e.get('name') or e.get('sourceName') or e.get('title') or ''
            con_sexos(t, e, s_, nombre)
            for v in e.get('variantes') or []:  # variantes regionales de raza
                con_sexos(t, v, v.get('slug'), v.get('name') or '')
            if seccion == 'locations' and s_:
                sumar('zona', s_, f'{nombre} (mapa)')
                for v in e.get('variantesTiempo') or []:
                    if not (v.get('momento') and v.get('estacion')):
                        continue
                    momento = f"{v.get('momento')}-{v.get('estacion')}"
                    sumar('location', f'{s_}-{momento}', f'{nombre} ({momento})')
                    sumar('zona', f'{s_}-{momento}', f'{nombre} (mapa, {momento})')

    def habilidades(o):  # unlocks de clases y de fauna, estén donde estén
        if isinstance(o, dict):
            h = o.get('ability')
            if isinstance(h, dict) and h.get('name'):
                sumar('ability', slugify(h['name']), h['name'])
            for v in o.values():
                habilidades(v)
        elif isinstance(o, list):
            for v in o:
                habilidades(v)
    habilidades(datos)
    for tipo, enum in (('clase', 'Clase'), ('especializacion', 'Especializacion')):
        for valor in enum_prisma(enum):
            sumar(tipo, valor, valor.replace('_', ' ').capitalize())
    return out


def elementos():
    """(lista, aviso): toda la enciclopedia (backend del juego), las entidades con prompt en la BD, lo que hay en
    generated/ y lo que tiene imagen en el juego."""
    avisos, claves = [], {}
    if API:
        try:
            for t, s_, nombre in catalogo():
                claves.setdefault((t, s_), {'tipo': t, 'slug': s_, 'perfiles': []})['nombre'] = nombre
        except (OSError, ValueError) as err:
            avisos.append(f'Sin el catálogo completo (arranca el juego para verlo entero): {err}')
    try:
        for e in entidades() or []:
            el = claves.setdefault((e['tipo'], e['slug']), {'tipo': e['tipo'], 'slug': e['slug'], 'perfiles': []})
            el['perfiles'].append({'perfil': e['perfil'], 'usado': bool(e['usado'])})
    except (RuntimeError, ValueError, subprocess.TimeoutExpired, OSError) as err:
        avisos.append(f'Sin los prompts de la enciclopedia: {err}')
    try:
        for t in os.listdir(GENERADO):
            if not SLUG.match(t) or t == BANCO or not os.path.isdir(os.path.join(GENERADO, t)):
                continue
            for s_ in os.listdir(os.path.join(GENERADO, t)):
                if SLUG.match(s_) and os.path.isdir(os.path.join(GENERADO, t, s_)):
                    claves.setdefault((t, s_), {'tipo': t, 'slug': s_, 'perfiles': []})
    except FileNotFoundError:
        pass
    # Lo que tiene imagen en el juego aunque no tenga prompt en la BD (razas, fauna sin generar…); un listdir por
    # carpeta de tipo, no una búsqueda por elemento: la lista pasa de 2.500.
    juego = {}
    try:
        for t in os.listdir(REFERENCIAS):
            if not SLUG.match(t) or not os.path.isdir(os.path.join(REFERENCIAS, t)):
                continue
            for n in sorted(os.listdir(os.path.join(REFERENCIAS, t))):
                m = re.match(rf"^([A-Za-z0-9][A-Za-z0-9_-]*?)-({'|'.join(PERFILES)})\.(?:{'|'.join(EXTENSIONES)})$", n)
                if m:
                    claves.setdefault((t, m.group(1)), {'tipo': t, 'slug': m.group(1), 'perfiles': []})
                    juego.setdefault((t, m.group(1)), {}).setdefault(m.group(2), f'{t}/{n}')
    except FileNotFoundError:
        pass
    lista = []
    for (t, s_), el in sorted(claves.items()):
        d = os.path.join(GENERADO, t, s_)
        hay = os.path.isdir(d)
        refs = juego.get((t, s_), {})
        primero = el['perfiles'][0]['perfil'] if el['perfiles'] else 'thumbnail'
        el.setdefault('nombre', '')
        el.update(juego=refs.get(primero) or next((refs[p] for p in PERFILES if p in refs), None),
                  intentos=len(filas_registro(d)) if hay else 0,
                  elegidas=[p for p in PERFILES if hay and os.path.isfile(os.path.join(d, f'{s_}-{p}.png'))])
        lista.append(el)
    return lista, ' · '.join(avisos) or None


def estimado(perfil, con_referencia):
    """Segundos que tarda: mediana de los intentos correctos del mismo perfil y con/sin referencia, de todo generated/."""
    tiempos = []
    try:
        for t in os.listdir(GENERADO):
            if t == BANCO:
                continue
            for s_ in os.listdir(os.path.join(GENERADO, t)):
                for f in filas_registro(os.path.join(GENERADO, t, s_)):
                    if f.get('perfil') == perfil and f.get('salida') == '0' and ('-r' in f.get('extra', '').split()) == con_referencia:
                        try:
                            tiempos.append(float(f['segundos']))
                        except (KeyError, ValueError):
                            pass
    except (FileNotFoundError, NotADirectoryError):
        pass
    if tiempos:
        return int(round(statistics.median(tiempos)))
    return int(round(ESTIMADO_BASE.get(perfil, 110) * (FACTOR_REFERENCIA if con_referencia else 1)))


def referencia_de(tipo, slug_, perfil):
    """La imagen del juego de esa entidad en referencias/images/<tipo>/: la de su perfil y, si no, la de otro."""
    d = os.path.join(REFERENCIAS, slug(tipo, 'tipo'))
    for p in (perfil,) + tuple(x for x in PERFILES if x != perfil):
        for ext in EXTENSIONES:
            if os.path.isfile(os.path.join(d, f'{slug(slug_, "slug")}-{p}.{ext}')):
                return {'ruta': f'{tipo}/{slug_}-{p}.{ext}', 'perfil': p}
    return None


# --- generación (una a la vez) ---

def sd_cli_en_marcha():
    """True si corre un sd-cli, aunque no lo lanzara este servidor (uno anterior que se cerró a medias)."""
    try:
        return subprocess.run(['pgrep', '-x', 'sd-cli'], stdout=subprocess.DEVNULL).returncode == 0
    except OSError:
        return False


class Trabajo:
    def __init__(self):
        self.cerrojo = threading.Lock()
        self.estado = {'enMarcha': False}

    def lanzar(self, peticion):
        tipo = slug(peticion.get('tipo'), 'tipo')
        slug_ = slug(peticion.get('slug'), 'slug')
        perfil = peticion.get('perfil')
        if perfil not in PERFILES:
            raise Invalido(f'perfil desconocido: {perfil}')
        semilla = entero(peticion.get('semilla', 42), 'la semilla', 0, 2 ** 31 - 1)
        pasos = entero(peticion.get('pasos', 6), 'los pasos', 1, 20)
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
            if self.estado['enMarcha'] or sd_cli_en_marcha():
                if archivo:
                    os.unlink(archivo)
                raise Invalido('ya hay una imagen generándose (aquí o un sd-cli suelto); espera a que acabe')
            self.estado = {'enMarcha': True, 'tipo': tipo, 'slug': slug_, 'perfil': perfil, 'conReferencia': bool(extra),
                           'inicio': time.time(), 'salida': [], 'nombre': None, 'rc': None,
                           'estimado': estimado(perfil, bool(extra))}
        orden = [PROBAR, tipo, slug_, perfil, str(semilla), str(pasos)] + extra
        threading.Thread(target=self._correr, args=(orden, env, archivo), daemon=True).start()

    def _correr(self, orden, env, archivo):
        rc = 1
        try:
            p = subprocess.Popen(orden, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            for linea in p.stdout:
                linea = linea.rstrip('\n')
                with self.cerrojo:
                    self.estado['salida'].append(linea)
                    m = re.match(r'^imagen: .*/([A-Za-z0-9_-]+)\.png', linea)
                    if m:
                        self.estado['nombre'] = m.group(1)
            rc = p.wait()
        except OSError as e:
            with self.cerrojo:
                self.estado['salida'].append(f'ERROR: no se pudo lanzar probar.sh: {e}')
            rc = 127
        except Exception as e:  # sin esto, `enMarcha` se quedaría en True y no dejaría generar más
            with self.cerrojo:
                self.estado['salida'].append(f'ERROR: {e}')
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
            texto, e['paso'], e['pasos'] = leer_progreso(e['tipo'], e['slug'], e['inicio'])
            if e['enMarcha']:
                e['progreso'] = texto
            elif e.get('rc'):  # falló: el final del log de sd-cli, para ver el motivo
                e['logFinal'] = cola_log(e['tipo'], e['slug'], e['inicio'], 3000)
        e['salida'] = e['salida'][-8:]
        return e


def cola_log(tipo, slug_, desde, bytes_=8192):
    """Final del log más reciente del elemento escrito desde `desde` ('' si no hay)."""
    d = os.path.join(elemento_dir(tipo, slug_), 'logs')
    try:
        logs = [os.path.join(d, n) for n in os.listdir(d) if n.endswith('.log')]
    except FileNotFoundError:
        return ''
    logs = [l for l in logs if os.path.getmtime(l) >= desde - 1]
    if not logs:
        return ''
    with open(max(logs, key=os.path.getmtime), 'rb') as f:
        f.seek(0, 2)
        f.seek(max(0, f.tell() - bytes_))
        return f.read().decode('utf-8', 'replace')


def leer_progreso(tipo, slug_, desde):
    """(texto, paso, pasos) del sd-cli que corre, sacado del log más reciente del elemento (generar.sh lo escribe con -v)."""
    cola = cola_log(tipo, slug_, desde)
    if not cola:
        return 'preparando', None, None
    if 'decode_first_stage completed' in cola:
        return 'guardando la imagen', None, None
    # El muestreo pinta «|====>  | 3/4 - 1.26it/s» (o s/it); la carga de pesos, «|####| 4/4 - 847MB/s».
    pasos = re.findall(r'\|[=> ]*\|\s*(\d+)/(\d+)\s*-\s*[\d.]+\s*(?:it/s|s/it)', cola)
    if pasos and pasos[-1][0] == pasos[-1][1]:
        return 'decodificando la imagen', int(pasos[-1][0]), int(pasos[-1][1])
    if pasos:
        return f'muestreo {pasos[-1][0]}/{pasos[-1][1]}', int(pasos[-1][0]), int(pasos[-1][1])
    return 'cargando modelos', None, None


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
        with open(ruta, 'rb') as f:
            self.responder(200, f.read(), tipo)

    def atender(self, accion):
        try:
            return accion()
        except Invalido as e:
            self.responder(400, {'error': str(e)})
        except (RuntimeError, json.JSONDecodeError, subprocess.TimeoutExpired) as e:
            self.responder(502, {'error': str(e)})
        except (OSError, UnicodeDecodeError) as e:
            self.responder(500, {'error': f'{type(e).__name__}: {e}'})

    def do_GET(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        partes = u.path.strip('/').split('/')
        if u.path == '/':
            return self.archivo(os.path.join(AQUI, 'index.html'), 'text/html; charset=utf-8')
        if u.path == '/api/estado':
            return self.responder(200, TRABAJO.ver())
        if u.path == '/api/inicio':
            return self.responder(200, {'perfiles': PERFILES, 'mundo': MUNDO})
        if u.path == '/api/elementos':
            def lista():
                els, aviso = elementos()
                self.responder(200, {'elementos': els, 'aviso': aviso})
            return self.atender(lista)
        if u.path == '/api/elemento':
            return self.atender(lambda: self.responder(200, leer_elemento(q.get('tipo'), q.get('slug'))))
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
        if len(partes) == 4 and partes[0] == 'img':  # /img/<tipo>/<slug>/<nombre>.png
            def img():
                nombre = partes[3][:-4] if partes[3].endswith('.png') else ''
                self.archivo(os.path.join(elemento_dir(partes[1], partes[2]), 'intentos', slug(nombre, 'nombre') + '.png'),
                             'image/png')
            return self.atender(img)
        if len(partes) == 4 and partes[0] == 'elegida':  # /elegida/<tipo>/<slug>/<perfil>.png
            def elegida():
                perfil = partes[3][:-4] if partes[3].endswith('.png') else ''
                self.archivo(destino_elegida(partes[1], partes[2], perfil), 'image/png')
            return self.atender(elegida)
        self.responder(404, {'error': 'no existe'})

    def do_POST(self):
        # Otra web abierta en el navegador podría lanzar generaciones con un POST text/plain (sin preflight): solo
        # JSON y desde esta misma página.
        origen = self.headers.get('Origin')
        if (self.headers.get('Content-Type') or '').split(';')[0].strip() != 'application/json' or \
                (origen and urlparse(origen).netloc != self.headers.get('Host')):
            return self.responder(403, {'error': 'solo desde la propia interfaz'})
        try:
            peticion = json.loads(self.rfile.read(int(self.headers.get('Content-Length') or 0)) or b'{}')
        except json.JSONDecodeError:
            return self.responder(400, {'error': 'cuerpo que no es JSON'})
        u = urlparse(self.path).path
        if u == '/api/generar':
            return self.atender(lambda: (TRABAJO.lanzar(peticion), self.responder(202, {'ok': True})))
        if u == '/api/nota':
            return self.atender(lambda: (guardar_nota(peticion.get('tipo'), peticion.get('slug'), peticion.get('nombre'),
                                                      peticion.get('texto', '')), self.responder(200, {'ok': True})))
        if u == '/api/elegir':
            return self.atender(lambda: self.responder(200, {'destino': elegir(peticion.get('tipo'), peticion.get('slug'),
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
