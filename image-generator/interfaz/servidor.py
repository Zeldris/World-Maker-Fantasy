#!/usr/bin/env python3
"""CFG-43 (usuaria, 2026-10-24): interfaz local del generador de imágenes, la que abre `image-generator/abrir.sh`.

Todo es por elemento, en `generated/<tipo>/<slug>/` (fuera de git): `intentos/<perfil>-s<semilla>-p<pasos>-<fecha>.png`,
`prompts/` y `logs/` con el mismo nombre, `registro.tsv` (una fila por intento), `notas.md`, `elegidas.tsv` y, por
perfil, la elegida `<slug>-<perfil>.png` con el nombre del juego (para copiarla a `backend/uploads/images/<tipo>/`).
Genera con `scripts/probar.sh <tipo> <slug> <perfil> [semilla] [pasos]` (que llama a `generar.sh`, con sus protecciones
de memoria). El prompt viene de la tabla ImagePrompt (usado, si no el base) o pegado. Si en `referencias/images/` (la
copia de `backend/uploads/images/` que hace `abrir.sh`) hay imagen de ese elemento, se ve y se puede usar de referencia.

Capas (IMG-41): `nucleo.py` es lo común con GVIG (router, POST solo JSON y de la propia página, estáticos con CSP,
errores, un trabajo a la vez y la cola); `adaptador_tarkor.py`, lo del juego (catálogo, ImagePrompt, MUNDO); este
archivo, el generador (generated/, referencias, tiempos, progreso de sd-cli) y sus rutas.

API (JSON salvo las imágenes):
  GET  /api/inicio                          perfiles y mundo
  GET  /api/elementos                       {elementos:[{tipo,slug,nombre,perfiles:[{perfil,usado}],juego,intentos,elegidas,
                                            marcadas}], aviso}; `nombre` es el de camino.json si lo tiene; `marcadas`, las ★
                                            une la BD y generated/; sin BD devuelve los de generated/ y un aviso
  GET  /api/elemento?tipo&slug              intentos del elemento, el más reciente primero
  GET  /api/prompt?tipo&slug&perfil         prompt usado o base de la BD
  GET  /api/referencia?tipo&slug&perfil     imagen del juego {ruta, perfil} o {ruta: null}
  GET  /api/estado                          generación en curso: progreso, paso, pasos, segundos, estimado, rc, logFinal
  GET  /api/cola                            {cola:[{id,estado: generando|hecho|fallido,tipo,slug,perfil,semilla,pasos,
                                            conReferencia,intento,segundos,estimado,progreso:{texto,paso,pasos},error}]}
                                            lo que corre y los últimos terminados de esta sesión del servidor (IMG-41);
                                            `en-cola`, cancelar y mover llegan con IMG-11
  GET  /img/<tipo>/<slug>/<nombre>.png      un intento;  GET /elegida/<tipo>/<slug>/<perfil>.png  la elegida
  GET  /ref/<tipo>/<slug>-<perfil>.<ext>    imagen del juego
  GET  /, /ui/<ruta>                        la página y su CSS/JS/fuentes (solo `interfaz/ui/`), con la CSP de GVIG (IMG-41)
  POST /api/generar {tipo,slug,perfil,semilla,pasos,prompt|desdeBase,usarReferencia}
  Por fases (IMG-40, diseño §3.0; el registro es `generated/<tipo>/<slug>/camino.json`, ver scripts/camino.py):
  GET  /api/inicio                          además `fases`: [{id,nombre,receta,siguientes,disponible}] (camino.FASES)
  GET  /api/camino?tipo&slug                camino.json del elemento; cada variante lleva `siguientes` (calculado, según el
                                            tipo, desde su faseActual)
  POST /api/fase/generar {tipo,slug,variante,fase,prompt,semilla?,usarReferencia?}
                                            usarReferencia: añade la imagen del juego como -r; 400 si el elemento no tiene
                                            lanza `scripts/fase.py` (un trabajo a la vez, el mismo de /api/generar) → 202 {ok};
                                            400 si la fase no existe o no está disponible, falta la fase de entrada aceptada,
                                            el prompt está vacío o ya hay una generación
  POST /api/fase/avanzar {tipo,slug,variante,fase,intento,siguiente,usarReferencia?}
                                            acepta el intento (borra los demás) y lanza el primero de `siguiente` con el prompt
                                            aceptado → {camino, lanzado: true}; si no se pudo lanzar (ocupado…), la aceptación
                                            se queda: {camino, lanzado: false, motivo}; 400 si el camino no lo permite
  POST /api/fase/atras {tipo,slug,variante} → {camino}; 400 si no hay fase anterior
  POST /api/fase/borrar {tipo,slug,variante,fase}
                                            borra del disco las imágenes de esa fase y de las que cuelgan de ella (se quedan
                                            los prompts y las semillas) → {camino}; 400 si no hay nada guardado o hay una
                                            generación en marcha de ese elemento
  GET  /api/fase/dependientes?tipo&slug&variante&fase
                                            lo que arrastra borrarla: {fases, marcadas (★ de esa variante), variantes}
  POST /api/fase/marcar {tipo,slug,variante,intento,marcada}
                                            marca o quita la ★ de un intento de la Final (marcar no publica) → {camino};
                                            400 si no es la Final, no tiene imagen o salió de un boceto que ya no es el aceptado
  POST /api/camino/renombrar {tipo,slug,nombre} → {camino}; 400 si el nombre está vacío o pasa de 120 caracteres
  POST /api/nota {tipo,slug,nombre,texto};  POST /api/elegir {tipo,slug,nombre}

Una sola generación a la vez (la Deck no aguanta dos). Solo escucha en 127.0.0.1.
Variables (para los tests): IMG_RAIZ (image-generator/), IMG_REFERENCIAS (referencias/images/), IMG_PROBAR, IMG_PSQL, IMG_API (backend del juego, ''
= sin catálogo), IMG_ESQUEMA (schema.prisma), IMG_PUERTO (7861).
"""
import json, os, re, shlex, shutil, statistics, subprocess, sys, tempfile
from urllib.parse import unquote
from http.server import ThreadingHTTPServer  # noqa: F401 (los tests montan el servidor con él)

AQUI = os.path.dirname(os.path.abspath(__file__))
if AQUI not in sys.path:
    sys.path.insert(0, AQUI)  # nucleo y el adaptador, también cuando los tests cargan este archivo por ruta

import nucleo  # noqa: E402
SCRIPTS = os.path.join(os.path.dirname(AQUI), 'scripts')  # el módulo sale del repo; los datos, de IMG_RAIZ
if SCRIPTS not in sys.path:
    sys.path.insert(0, SCRIPTS)

from nucleo import Invalido, SLUG, STATIC_CSP, slug, entero  # noqa: E402,F401 (STATIC_CSP: lo miran los tests)
import adaptador_tarkor  # noqa: E402
import camino  # noqa: E402
import fase as fase_py  # noqa: E402

RAIZ = os.environ.get('IMG_RAIZ', os.path.dirname(AQUI))
PROBAR = os.environ.get('IMG_PROBAR', os.path.join(RAIZ, 'scripts', 'probar.sh'))
FASE = os.environ.get('IMG_FASE', os.path.join(SCRIPTS, 'fase.py'))
GENERADO = os.path.join(RAIZ, 'generated')
# IMG-41: la página se compone de /ui/ (CSS, JS y fuentes propios, base de diseño de GVIG); solo se sirve lo de esa carpeta.
UI_DIR = os.path.join(AQUI, 'ui')
REFERENCIAS = os.environ.get('IMG_REFERENCIAS', os.path.join(RAIZ, 'referencias', 'images'))
ADAPTADOR = adaptador_tarkor.Tarkor(
    psql=shlex.split(os.environ.get('IMG_PSQL', 'podman exec -i tarkor-postgres psql -U tarkor -d tarkor -At -c')),
    mundo=os.environ.get('MUNDO', 'helek-sirik'),
    api=os.environ.get('IMG_API', 'http://127.0.0.1:3001'),
    esquema=os.environ.get('IMG_ESQUEMA', os.path.join(os.path.dirname(RAIZ), 'backend', 'prisma', 'schema.prisma')))
SECCIONES = adaptador_tarkor.SECCIONES
PERFILES = ('banner', 'thumbnail', 'mapa', 'icono')
# Los bancos de calidad (docs/producto/plan-imagenes/banco.sh y calidad.sh, IMG-15) dejan sus intentos en generated/banco/:
# no son elementos del juego ni cuentan para el tiempo estimado (prueban otros modelos, pasos y tamaños).
BANCO = 'banco'
EXTENSIONES = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'webp': 'image/webp'}
CABECERA_REGISTRO = ['fecha', 'nombre', 'perfil', 'prompt', 'semilla', 'pasos', 'tamaño', 'extra', 'salida', 'segundos']
ESTIMADO_BASE = {'thumbnail': 105, 'banner': 110, 'mapa': 110, 'icono': 80}  # segundos, sin referencia
FACTOR_REFERENCIA = 1.9


def perfil_valido(perfil):
    if perfil not in PERFILES:
        raise Invalido(f'perfil desconocido: {perfil}')
    return perfil


def elemento_dir(tipo, slug_):
    return os.path.join(GENERADO, slug(tipo, 'tipo'), slug(slug_, 'slug'))


def destino_elegida(tipo, slug_, perfil):
    """Ruta con el nombre que busca el juego: generated/<tipo>/<slug>/<slug>-<perfil>.png."""
    perfil_valido(perfil)
    return os.path.join(elemento_dir(tipo, slug_), f'{slug_}-{perfil}.png')


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


def intentos_camino(d):
    """Intentos apuntados en camino.json (IMG-40)."""
    try:
        with open(os.path.join(d, 'camino.json'), encoding='utf-8') as f:
            c = json.load(f)
    except (OSError, ValueError):
        return 0
    return sum(len(f['intentos']) for v in c.get('variantes', {}).values() for f in v.get('fases', {}).values())


def elementos():
    """(lista, aviso): lo del adaptador (toda la enciclopedia y las entidades con prompt), lo que hay en generated/ y
    lo que tiene imagen en el juego."""
    claves, avisos = ADAPTADOR.elementos()
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
        cam = camino.leer(d) if hay else None
        if cam and cam.get('nombre'):
            el['nombre'] = cam['nombre']
        el['marcadas'] = len(cam['marcadas']) if cam else 0
        el.update(juego=refs.get(primero) or next((refs[p] for p in PERFILES if p in refs), None),
                  intentos=(len(filas_registro(d)) + intentos_camino(d)) if hay else 0,
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


ESTIMADO_FASE = {'F0': 36, 'F1': 300, 'F2': 300, 'F4': 160}  # segundos, si aún no hay intentos de esa fase


def estimado_fase(fase, con_juego=False):
    """Mediana de los segundos de los intentos con imagen de esa fase, con o sin la imagen del juego, de todos los
    camino.json (sin el banco)."""
    tiempos = []
    try:
        for t in os.listdir(GENERADO):
            if t == BANCO or not os.path.isdir(os.path.join(GENERADO, t)):
                continue
            for s_ in os.listdir(os.path.join(GENERADO, t)):
                try:
                    with open(os.path.join(GENERADO, t, s_, 'camino.json'), encoding='utf-8') as f:
                        c = json.load(f)
                except (OSError, ValueError):
                    continue
                for v in c.get('variantes', {}).values():
                    for i in v.get('fases', {}).get(fase, {}).get('intentos', []):
                        if i.get('imagen') and isinstance(i.get('segundos'), (int, float)) and not i.get('referencias') and bool(i.get('referencia')) == con_juego:
                            tiempos.append(i['segundos'])
    except (FileNotFoundError, NotADirectoryError):
        pass
    if tiempos:
        return int(round(statistics.median(tiempos)))
    return int(round(ESTIMADO_FASE.get(fase, 120) * (FACTOR_REFERENCIA if con_juego else 1)))


def referencia_de(tipo, slug_, perfil):
    """La imagen del juego de esa entidad en referencias/images/<tipo>/: la de su perfil y, si no, la de otro."""
    d = os.path.join(REFERENCIAS, slug(tipo, 'tipo'))
    for p in (perfil,) + tuple(x for x in PERFILES if x != perfil):
        for ext in EXTENSIONES:
            if os.path.isfile(os.path.join(d, f'{slug(slug_, "slug")}-{p}.{ext}')):
                return {'ruta': f'{tipo}/{slug_}-{p}.{ext}', 'perfil': p}
    return None


# --- progreso de sd-cli (del log que escribe generar.sh con -v) ---

def sd_cli_en_marcha():
    """True si corre un sd-cli, aunque no lo lanzara este servidor (uno anterior que se cerró a medias)."""
    try:
        return subprocess.run(['pgrep', '-x', 'sd-cli'], stdout=subprocess.DEVNULL).returncode == 0
    except OSError:
        return False


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


# --- generación: el trabajo del núcleo con probar.sh ---

class Trabajo(nucleo.Trabajo):
    """El trabajo del núcleo con lo del generador: valida la petición y lanza `probar.sh`."""

    def __init__(self, maximo=20):
        super().__init__(maximo=maximo, resultado=re.compile(r'^imagen: .*/([A-Za-z0-9_-]+)\.png'),
                         progreso=lambda e: leer_progreso(e['tipo'], e['slug'], e['inicio']),
                         log_final=lambda e: cola_log(e['tipo'], e['slug'], e['inicio'], 3000))

    def lanzar(self, peticion):
        tipo = slug(peticion.get('tipo'), 'tipo')
        slug_ = slug(peticion.get('slug'), 'slug')
        perfil = perfil_valido(peticion.get('perfil'))
        semilla = entero(peticion.get('semilla', 42), 'la semilla', 0, 2 ** 31 - 1)
        pasos = entero(peticion.get('pasos', 6), 'los pasos', 1, 20)
        extra = []
        if peticion.get('usarReferencia'):
            ref = referencia_de(tipo, slug_, perfil)
            if not ref:
                raise Invalido(f'no hay imagen de {tipo}/{slug_} en image-generator/referencias/images/')
            extra = ['-r', os.path.join(REFERENCIAS, ref['ruta'])]
        env = dict(os.environ, **ADAPTADOR.entorno())
        archivo = None
        if not peticion.get('desdeBase'):
            texto = str(peticion.get('prompt') or '').strip()
            if not texto:
                raise Invalido('el prompt está vacío')
            fd, archivo = tempfile.mkstemp(prefix='prompt-', suffix='.txt')
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                f.write(texto + '\n')
            env['PROMPT_ARCHIVO'] = archivo
        datos = {'tipo': tipo, 'slug': slug_, 'perfil': perfil, 'semilla': semilla, 'pasos': pasos,
                 'conReferencia': bool(extra), 'estimado': estimado(perfil, bool(extra))}
        self.empezar([PROBAR, tipo, slug_, perfil, str(semilla), str(pasos)] + extra, datos, env=env, que='probar.sh',
                     ocupado=sd_cli_en_marcha, limpiar=(lambda: os.unlink(archivo)) if archivo else None,
                     motivo_ocupado='ya hay una imagen generándose (aquí o un sd-cli suelto); espera a que acabe')


    def en_marcha_de(self, tipo, slug_):
        """True si lo que corre ahora escribe en el elemento tipo/slug."""
        with self.cerrojo:
            e = self.estado
            return bool(e['enMarcha'] and e.get('tipo') == tipo and e.get('slug') == slug_)

    def lanzar_fase(self, peticion):
        """IMG-40: una fase de un elemento con `scripts/fase.py` (que escribe en camino.json, también si falla)."""
        tipo = slug(peticion.get('tipo'), 'tipo')
        slug_ = slug(peticion.get('slug'), 'slug')
        variante = slug(peticion.get('variante'), 'variante')
        fase = peticion.get('fase')
        if fase not in camino.POR_ID:
            raise Invalido(f'fase desconocida: {fase}')
        if not camino.POR_ID[fase]['disponible']:
            raise Invalido(f'{fase} {camino.POR_ID[fase]["nombre"]} no está disponible todavía (llega con IMG-37)')
        semilla = peticion.get('semilla')
        if semilla is not None:
            semilla = entero(semilla, 'la semilla', 0, 2 ** 31 - 1)
        texto = str(peticion.get('prompt') or '').strip()
        if not texto:
            raise Invalido('el prompt está vacío')
        del_juego = referencia_de(tipo, slug_, 'banner')  # la medida de color la usa aunque no vaya al modelo
        juego = None
        if peticion.get('usarReferencia'):
            juego = del_juego
            if not juego:
                raise Invalido(f'no hay imagen de {tipo}/{slug_} en image-generator/referencias/images/')
        try:
            camino.fase_de_entrada(camino.leer(elemento_dir(tipo, slug_))['variantes'].get(variante, {}), fase)
        except camino.CaminoInvalido as e:
            raise Invalido(str(e))
        fd, archivo = tempfile.mkstemp(prefix='prompt-', suffix='.txt')
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(texto + '\n')
        orden = [sys.executable, FASE, tipo, slug_, variante, fase, archivo] + ([] if semilla is None else [str(semilla)])
        if juego:
            orden += ['--referencia', os.path.join(REFERENCIAS, juego['ruta'])]
        elif del_juego:
            orden += ['--medir-con', os.path.join(REFERENCIAS, del_juego['ruta'])]
        datos = {'tipo': tipo, 'slug': slug_, 'variante': variante, 'fase': fase,
                 'perfil': f'{fase} {camino.POR_ID[fase]["nombre"]}', 'semilla': semilla,
                 'pasos': fase_py.RECETAS[fase]['pasos'], 'conReferencia': fase == 'F4' or bool(juego), 'estimado': estimado_fase(fase, bool(juego))}
        self.empezar(orden, datos, env=dict(os.environ, IMG_RAIZ=RAIZ, **ADAPTADOR.entorno()), que='fase.py', ocupado=sd_cli_en_marcha,
                     limpiar=lambda: os.unlink(archivo),
                     motivo_ocupado='ya hay una imagen generándose (aquí o un sd-cli suelto); espera a que acabe')


TRABAJO = Trabajo()


# --- rutas ---

RUTAS = nucleo.Rutas()


@RUTAS.get('/')
def pagina(p):
    p.h.estatico(AQUI, 'index.html')


@RUTAS.get('/ui/*')
def ui(p):
    rel = unquote(p.params['*'])
    if not rel or rel.startswith('/') or '\\' in rel or '\0' in rel or any(x in ('', '..') for x in rel.split('/')):
        return 403, {'error': 'ruta no permitida'}
    p.h.estatico(UI_DIR, rel)


@RUTAS.get('/api/estado')
def api_estado(p):
    return TRABAJO.ver()


@RUTAS.get('/api/cola')
def api_cola(p):
    return {'cola': TRABAJO.cola()}


@RUTAS.get('/api/inicio')
def api_inicio(p):
    return {'perfiles': PERFILES, 'mundo': ADAPTADOR.mundo, 'fases': [dict(f, siguientes=list(f['siguientes']))
                                                                     for f in camino.FASES]}


@RUTAS.get('/api/elementos')
def api_elementos(p):
    els, aviso = elementos()
    return {'elementos': els, 'aviso': aviso}


@RUTAS.get('/api/elemento')
def api_elemento(p):
    return leer_elemento(p.q.get('tipo'), p.q.get('slug'))


def camino_de(tipo, slug_):
    """camino.json con, por variante, las fases a las que se puede avanzar desde la actual (calculado, no guardado)."""
    c = camino.leer(elemento_dir(tipo, slug_))
    for v in c['variantes'].values():
        v['siguientes'] = camino.siguientes(v['faseActual'], tipo)
    return c


@RUTAS.get('/api/camino')
def api_camino(p):
    return camino_de(p.q.get('tipo'), p.q.get('slug'))


@RUTAS.get('/api/prompt')
def api_prompt(p):
    r = ADAPTADOR.prompt(p.q.get('tipo'), p.q.get('slug'), perfil_valido(p.q.get('perfil')))
    return (200, r) if r else (404, {'error': 'esa entidad no tiene prompt para ese perfil'})


@RUTAS.get('/api/referencia')
def api_referencia(p):
    return referencia_de(p.q.get('tipo'), p.q.get('slug'), perfil_valido(p.q.get('perfil'))) or {'ruta': None}


@RUTAS.get('/ref/{tipo}/{archivo}')
def ref(p):
    base, _, ext = p.params['archivo'].rpartition('.')
    if ext not in EXTENSIONES:
        raise Invalido('solo imágenes')
    p.h.archivo(os.path.join(REFERENCIAS, slug(p.params['tipo'], 'tipo'), slug(base, 'nombre') + '.' + ext),
                EXTENSIONES[ext])


@RUTAS.get('/img/{tipo}/{slug}/{archivo}')
def img(p):
    a = p.params['archivo']
    nombre = a[:-4] if a.endswith('.png') else ''
    p.h.archivo(os.path.join(elemento_dir(p.params['tipo'], p.params['slug']), 'intentos', slug(nombre, 'nombre') + '.png'),
                'image/png')


@RUTAS.get('/elegida/{tipo}/{slug}/{archivo}')
def elegida(p):
    a = p.params['archivo']
    p.h.archivo(destino_elegida(p.params['tipo'], p.params['slug'], a[:-4] if a.endswith('.png') else ''), 'image/png')


@RUTAS.post('/api/generar')
def api_generar(p):
    TRABAJO.lanzar(p.cuerpo)
    return 202, {'ok': True}


@RUTAS.post('/api/fase/generar')
def api_fase_generar(p):
    TRABAJO.lanzar_fase(p.cuerpo)
    return 202, {'ok': True}


@RUTAS.post('/api/fase/avanzar')
def api_fase_avanzar(p):
    c = p.cuerpo
    tipo, slug_ = slug(c.get('tipo'), 'tipo'), slug(c.get('slug'), 'slug')
    variante, fase = slug(c.get('variante'), 'variante'), c.get('fase')
    n, siguiente = entero(c.get('intento'), 'el intento', 1, 10 ** 6), c.get('siguiente')

    def aceptar(cam):
        camino.avanzar(elemento_dir(tipo, slug_), cam, variante, fase, n, siguiente, tipo)
        return cam['variantes'][variante]['fases'][fase]['prompt']
    try:
        prompt, _ = camino.actualizar(elemento_dir(tipo, slug_), aceptar)
    except camino.CaminoInvalido as e:
        raise Invalido(str(e))
    try:
        TRABAJO.lanzar_fase({'tipo': tipo, 'slug': slug_, 'variante': variante, 'fase': siguiente, 'prompt': prompt,
                             'usarReferencia': c.get('usarReferencia')})
        lanzado = {'lanzado': True}
    except Invalido as e:  # ocupado, sin entrada…: la aceptación se queda
        lanzado = {'lanzado': False, 'motivo': str(e)}
    return {'camino': camino_de(tipo, slug_), **lanzado}


@RUTAS.post('/api/fase/atras')
def api_fase_atras(p):
    c = p.cuerpo
    tipo, slug_, variante = slug(c.get('tipo'), 'tipo'), slug(c.get('slug'), 'slug'), slug(c.get('variante'), 'variante')
    try:
        camino.actualizar(elemento_dir(tipo, slug_), lambda cam: camino.atras(cam, variante))
    except camino.CaminoInvalido as e:
        raise Invalido(str(e))
    return {'camino': camino_de(tipo, slug_)}


@RUTAS.post('/api/camino/renombrar')
def api_camino_renombrar(p):
    c = p.cuerpo
    tipo, slug_ = slug(c.get('tipo'), 'tipo'), slug(c.get('slug'), 'slug')
    try:
        camino.actualizar(elemento_dir(tipo, slug_), lambda cam: camino.renombrar(cam, c.get('nombre')))
    except camino.CaminoInvalido as e:
        raise Invalido(str(e))
    return {'camino': camino_de(tipo, slug_)}


@RUTAS.get('/api/fase/dependientes')
def api_fase_dependientes(p):
    tipo, slug_ = slug(p.q.get('tipo'), 'tipo'), slug(p.q.get('slug'), 'slug')
    try:
        return camino.dependientes(camino.leer(elemento_dir(tipo, slug_)), slug(p.q.get('variante'), 'variante'), p.q.get('fase'))
    except camino.CaminoInvalido as e:
        raise Invalido(str(e))


@RUTAS.post('/api/fase/borrar')
def api_fase_borrar(p):
    c = p.cuerpo
    tipo, slug_ = slug(c.get('tipo'), 'tipo'), slug(c.get('slug'), 'slug')
    variante, fase = slug(c.get('variante'), 'variante'), c.get('fase')
    if TRABAJO.en_marcha_de(tipo, slug_):
        raise Invalido('hay una generación en marcha de este elemento: espera a que acabe para borrar')
    d = elemento_dir(tipo, slug_)
    try:
        camino.actualizar(d, lambda cam: camino.borrar_fase(d, cam, variante, fase))
    except camino.CaminoInvalido as e:
        raise Invalido(str(e))
    return {'camino': camino_de(tipo, slug_)}


@RUTAS.post('/api/fase/marcar')
def api_fase_marcar(p):
    c = p.cuerpo
    tipo, slug_ = slug(c.get('tipo'), 'tipo'), slug(c.get('slug'), 'slug')
    variante, n = slug(c.get('variante'), 'variante'), entero(c.get('intento'), 'el intento', 1, 10 ** 6)
    if not isinstance(c.get('marcada'), bool):
        raise Invalido('marcada tiene que ser true o false')
    try:
        camino.actualizar(elemento_dir(tipo, slug_), lambda cam: camino.marcar(cam, variante, n, c['marcada']))
    except camino.CaminoInvalido as e:
        raise Invalido(str(e))
    return {'camino': camino_de(tipo, slug_)}


@RUTAS.post('/api/nota')
def api_nota(p):
    c = p.cuerpo
    guardar_nota(c.get('tipo'), c.get('slug'), c.get('nombre'), c.get('texto', ''))
    return {'ok': True}


@RUTAS.post('/api/elegir')
def api_elegir(p):
    c = p.cuerpo
    return {'destino': elegir(c.get('tipo'), c.get('slug'), c.get('nombre'))}


class Manejador(nucleo.Manejador):
    rutas = RUTAS


def main():
    nucleo.servir(Manejador, int(os.environ.get('IMG_PUERTO', '7861')), 'Generador de imágenes')


if __name__ == '__main__':
    sys.exit(main())
