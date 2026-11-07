#!/usr/bin/env python3
"""IMG-40: una orden por fase del generador. Uso: fase.py <tipo> <slug> <variante> <fase> <archivo-prompt> [semilla] [--referencia <imagen> | --ref <rol>:<imagen> ...] [--medir-con <imagen>] [--motor <id>] [--semillas N]
IMG-53, cadena de pasos: la fase puede ser P1…P9 (480x192, 4 pasos como F0): P1 sin entrada; Pn parte de la aceptada de P(n-1) como
primer -r (con --ref-image-args vae_input_max_pixels=262144) y su prompt (el «Keep… Change only…» de la usuaria) va tal cual; con más
--ref se antepone «Image 1 is the current image…» y las frases de rol numeradas desde 2. La Final F4 parte del Pn aceptado más alto.
--motor <id> (solo en Pn y F4; por defecto klein4b, y el explícito manda) elige la receta de scripts/motores.py (klein4b, klein9b,
klein9b-consistencia, qwen-edit, longcat, flux3): sus pasos y tope sustituyen a los de la fase, y generar.sh recibe MOTOR=<id>
(excepto con klein4b, que es lo que hace generar.sh solo); si falta un archivo del motor, aborto con código 3 antes de apuntar
nada. El motor se guarda en cada intento de camino.json. --semillas N (1-4, por defecto 1) genera N intentos seguidos con
semillas consecutivas (semilla, semilla+1…), cada uno apuntado en camino.json; si uno falla, no se lanzan los siguientes.
--ref <rol>:<imagen> (repetible, IMG-52) añade una imagen con rol (sujeto, lugar, equipo, estilo) como -r, tras la de entrada de F4, y el
prompt enviado dice qué es cada una por su número; máximo 4 en total (en F4 el boceto cuenta una). No se mezcla con --referencia.
Con --ref solo se mide el color contra --medir-con. camino.json guarda `referencias: [{rol, imagen}]` en vez de `referencia`.
--referencia añade la imagen del juego como -r en cualquier fase; en la Final va detrás del boceto y el prompt dice cuál es cuál.
--medir-con es la imagen del juego contra la que medir el color aunque no se pase al modelo (si no, la de --referencia).
Toma la imagen aceptada de la fase de entrada, traduce la receta de la fase a generar.sh y apunta el intento en
camino.json (también si falla). IMG_RAIZ cambia la raíz image-generator/; IMG_GENERAR sustituye a generar.sh (tests).
Salida: «imagen: <ruta>.png» si salió. Códigos: el de generar.sh; 2 argumentos o fase inválida; 3 falta entrada, prompt o imagen."""
import os
import re
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'medir'))
import camino as C  # noqa: E402
import motores as MO  # noqa: E402
import medida as M  # noqa: E402

COSA = {'fauna': 'creature', 'flora': 'plant', 'item': 'object', 'construccion': 'building', 'location': 'place',
        'raza': 'figure', 'npc': 'figure'}
PREFIJO_F4 = ('The same {cosa}, in the same composition, as the reference image, which is a rough study: '
              'keep its shapes and proportions and render it with full detail. ')
PREFIJO_F4_CON_JUEGO = ('The same {cosa}, in the same composition, as the first reference image, which is a rough study: '
                        'keep its shapes and proportions and render it with full detail. '
                        'The second reference image shows this {cosa}: follow its colors and materials. ')
PREFIJO_JUEGO = 'The reference image shows this {cosa}: follow its colors and materials. '
ROLES = ('sujeto', 'lugar', 'equipo', 'estilo')
MAX_REFERENCIAS = 4
FRASE_BOCETO = 'Image {n} is a rough study of this image: keep its composition, shapes and proportions and render it with full detail. '
FRASES_ROL = {
    'sujeto': 'Image {n} is a subject of this image: keep its exact identity, shape and colors. ',
    'lugar': 'Image {n} is the place: use its setting and its light. ',
    'equipo': 'Image {n} is equipment worn or carried in this image: keep its design and materials. ',
    'estilo': 'Image {n} is a style reference: follow only its finish and colors, not its contents. ',
}
LIMITE_REF = ['--ref-image-args', 'vae_input_max_pixels=262144']
LANCZOS = ['--image-preprocess', 'target=init,filter=lanczos,antialias=true']
# Recetas: tamaño, pasos, entorno (BOCETO/ref se rellenan con la imagen de entrada) y extra de sd-cli.
RECETAS = {
    'F0': {'w': 480, 'h': 192, 'pasos': 4, 'env': {}, 'extra': [], 'entrada': None},
    'F1': {'w': 640, 'h': 256, 'pasos': 8, 'env': {'PERFIL': 'fotorreal', 'FUERZA_BOCETO': '0.88'}, 'extra': LANCZOS,
           'entrada': 'BOCETO'},
    'F2': {'w': 960, 'h': 384, 'pasos': 16, 'env': {'PERFIL': 'fotorreal', 'FUERZA_BOCETO': '0.50'}, 'extra': LANCZOS,
           'entrada': 'BOCETO'},
    'F4': {'w': 1280, 'h': 512, 'pasos': 4, 'env': {'TOPE': '1800'},
           'extra': ['--ref-image-args', 'vae_input_max_pixels=262144'], 'entrada': '-r'},
}
# IMG-53: pasos de edición, como F0 con referencia (TOPE 1800); P1 no tiene entrada, los demás la llevan como primer -r.
for _n in range(1, 10):
    RECETAS[f'P{_n}'] = {'w': 480, 'h': 192, 'pasos': 4, 'env': {'TOPE': '1800'}, 'extra': list(LIMITE_REF) if _n > 1 else [],
                         'entrada': '-r' if _n > 1 else None}
FRASE_ACTUAL = 'Image 1 is the current image: keep it exactly as it is except for what is asked. '
MAX_SEMILLAS = 4
LIMPIAR = ('PERFIL', 'BOCETO', 'FUERZA_BOCETO', 'MOMENTO', 'MOTOR')
VALIDO = re.compile(r'^[A-Za-z0-9_-]+$')


def aborto(msg, codigo):
    print('ABORTO: ' + msg)
    sys.exit(codigo)


def opcion(argv, nombre):
    """Saca `nombre <imagen>` de argv: (imagen o None, el resto de argv)."""
    if nombre not in argv:
        return None, argv
    i = argv.index(nombre)
    if i + 1 >= len(argv):
        aborto(f'{nombre} pide la ruta de una imagen', 2)
    return argv[i + 1], argv[:i] + argv[i + 2:]


def opciones(argv, nombre):
    """Saca todas las apariciones de `nombre <valor>`: (lista de valores, el resto de argv)."""
    valores = []
    while nombre in argv:
        v, argv = opcion(argv, nombre)
        valores.append(v)
    return valores, argv


def parsear_refs(valores):
    """`rol:imagen` -> [(rol, ruta)]. Se parte por el primer «:» (la ruta puede llevar más)."""
    refs = []
    for x in valores:
        rol, sep, ruta = x.partition(':')
        if not sep or rol not in ROLES or not ruta:
            aborto(f'--ref «{x}» no es <rol>:<imagen> con un rol válido ({", ".join(ROLES)})', 2)
        refs.append((rol, ruta))
    return refs


def main(argv):
    referencia, argv = opcion(argv, '--referencia')
    valores_ref, argv = opciones(argv, '--ref')
    refs = parsear_refs(valores_ref)
    if refs and referencia:
        aborto('--ref y --referencia no se mezclan: usa solo --ref <rol>:<imagen>', 2)
    medir_con, argv = opcion(argv, '--medir-con')
    motor, argv = opcion(argv, '--motor')
    n_semillas, argv = opcion(argv, '--semillas')
    if motor is not None and motor not in MO.MOTORES:
        aborto(f'motor desconocido: {motor} ({", ".join(MO.MOTORES)})', 2)
    try:
        n_semillas = 1 if n_semillas is None else int(n_semillas)
    except ValueError:
        aborto('--semillas pide un número de 1 a 4', 2)
    if not 1 <= n_semillas <= MAX_SEMILLAS:
        aborto(f'--semillas va de 1 a {MAX_SEMILLAS} (hay {n_semillas})', 2)
    if len(argv) not in (5, 6):
        aborto('uso: fase.py <tipo> <slug> <variante> <fase> <archivo-prompt> [semilla] [--referencia <imagen> | --ref <rol>:<imagen> ...] [--medir-con <imagen>] [--motor <id>] [--semillas N]', 2)
    tipo, slug, variante, fase, archivo = argv[:5]
    for v in (tipo, slug, variante):
        if not VALIDO.match(v):
            aborto(f'«{v}» no es un tipo, slug o variante válido', 2)
    if fase == 'F3':
        aborto('F3 Recorte llega con IMG-37', 2)
    if fase not in RECETAS:
        aborto(f'fase desconocida: {fase} (F0, F1, F2, P1…P9, F4)', 2)
    paso = fase == 'F4' or fase in C.PASOS  # las fases que admiten --motor
    if motor not in (None, MO.POR_DEFECTO) and not paso:
        aborto(f'--motor {motor} solo vale en los pasos (P1…P9) y en la Final F4, no en {fase}', 2)
    motor = motor or MO.POR_DEFECTO
    con_entrada = bool(C.ENTRADA[fase])
    if con_entrada and RECETAS[fase]['entrada'] == '-r' and len(refs) > MAX_REFERENCIAS - 1:
        aborto(f'{fase} admite como mucho {MAX_REFERENCIAS - 1} --ref: {'el boceto' if fase == 'F4' else 'la imagen'} de entrada cuenta como una de las {MAX_REFERENCIAS} (hay {len(refs)})', 2)
    if len(refs) > MAX_REFERENCIAS:
        aborto(f'como mucho {MAX_REFERENCIAS} --ref (hay {len(refs)})', 2)
    semilla = None
    if len(argv) == 6:
        try:
            semilla = int(argv[5])
        except ValueError:
            aborto(f'la semilla «{argv[5]}» no es un número', 2)
    try:
        prompt = open(archivo, encoding='utf-8').read().strip()
    except OSError:
        aborto(f'no se puede leer el archivo de prompt: {archivo}', 3)
    if referencia and not os.path.isfile(referencia):
        aborto(f'no existe la imagen de referencia: {referencia}', 3)
    for _, ruta in refs:
        if not os.path.isfile(ruta):
            aborto(f'no existe la imagen de referencia: {ruta}', 3)
    raiz = os.environ.get('IMG_RAIZ') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if paso and motor != MO.POR_DEFECTO:  # klein4b es lo que hace generar.sh solo; el resto, con sus archivos
        perdidos = MO.faltan(motor, raiz)
        if perdidos:
            aborto(MO.mensaje_faltan(motor, perdidos), 3)
    generar = os.environ.get('IMG_GENERAR') or os.path.join(raiz, 'scripts', 'generar.sh')
    d = os.path.join(raiz, 'generated', tipo, slug)
    cam = C.leer(d)
    v = cam['variantes'].get(variante, {})
    rec = RECETAS[fase]
    entrada = None
    try:
        origen = C.fase_de_entrada(v, fase)
        if origen:
            img = v['fases'][origen]['aceptada']
            entrada = (origen, img)
            if not os.path.exists(os.path.join(d, 'intentos', img)):
                aborto(f'falta la imagen aceptada de {origen}: intentos/{img}', 3)
        lista = [{'rol': rol, 'imagen': os.path.basename(ruta)} for rol, ruta in refs]
        if semilla is None:
            semilla = C.semilla_por_defecto(v, fase, prompt, os.path.basename(referencia) if referencia else None, lista or None)
    except C.CaminoInvalido as e:
        aborto(str(e), 3)
    rc = 0
    for k in range(n_semillas):
        rc = una(tipo, slug, variante, fase, prompt, semilla + k, d, generar, rec, entrada, refs, lista, referencia, medir_con,
                 motor, paso)
        if rc != 0:
            break
    return rc


def una(tipo, slug, variante, fase, prompt, semilla, d, generar, rec, entrada, refs, lista, referencia, medir_con, motor, paso):
    """Un intento: lanza generar.sh y lo apunta en camino.json (también si falla). Devuelve el código de generar.sh."""
    cam = C.leer(d)
    n = C.siguiente_n(cam, variante, fase)
    nombre = C.nombre_intento(variante, fase, n)
    enviado = prompt
    env = {k: x for k, x in os.environ.items() if k not in LIMPIAR}
    env.update(rec['env'])
    pasos = rec['pasos']
    if paso:  # la receta del motor sustituye a los pasos y al tope por defecto
        m = MO.motor(motor)
        pasos = m['pasos']
        env['TOPE'] = str(max(m['tope'], int(rec['env'].get('TOPE', 0))) if motor == MO.POR_DEFECTO else m['tope'])
        if motor != MO.POR_DEFECTO:
            env['MOTOR'] = motor
    extra = list(rec['extra'])
    es_paso = fase in C.PASOS
    if entrada:
        ruta = os.path.join(d, 'intentos', entrada[1])
        if rec['entrada'] == 'BOCETO':
            env['BOCETO'] = ruta
        else:
            extra = ['-r', ruta] + extra
            if not es_paso:
                enviado = (PREFIJO_F4_CON_JUEGO if referencia else PREFIJO_F4).format(cosa=COSA.get(tipo, 'subject')) + prompt
    if refs:
        for _, ruta in refs:
            extra += ['-r', ruta]  # la de entrada va primero
        if '--ref-image-args' not in extra:
            extra += LIMITE_REF
        n0 = 2 if entrada and rec['entrada'] == '-r' else 1
        frases = [(FRASE_ACTUAL if es_paso else FRASE_BOCETO).format(n=1)] if n0 == 2 else []
        frases += [FRASES_ROL[rol].format(n=n0 + k) for k, (rol, _) in enumerate(refs)]
        enviado = ''.join(frases) + prompt
        if fase == 'F0':
            env.setdefault('TOPE', '1800')
    elif referencia:
        extra += ['-r', referencia]  # la de entrada va primero
        if '--ref-image-args' not in extra:
            extra += LIMITE_REF
        if rec['entrada'] != '-r':
            enviado = PREFIJO_JUEGO.format(cosa=COSA.get(tipo, 'subject')) + prompt
        if fase == 'F0':  # el tope por defecto (900 s) se queda corto; F1 y F2 ya tienen el de fotorreal, mucho mayor
            env.setdefault('TOPE', '1800')
    os.makedirs(d, exist_ok=True)
    fd, pf = tempfile.mkstemp(prefix='prompt-', suffix='.txt', dir=d)  # generar.sh lo copia a prompts/<nombre>.txt
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        f.write(enviado + '\n')
    t0 = time.time()
    r = subprocess.run(['bash', generar, d, nombre, pf, str(rec['w']), str(rec['h']), str(semilla), str(pasos), *extra],
                       env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    os.remove(pf)
    seg = round(time.time() - t0, 1)
    sys.stdout.write(r.stdout)
    png = os.path.join(d, 'intentos', nombre + '.png')
    hay = os.path.exists(png)
    medida = None
    if hay:
        juego = medir_con or (None if refs else referencia)
        medida = M.medir(png, os.path.join(d, 'intentos', entrada[1]) if entrada else None,
                         juego if juego and os.path.isfile(juego) else None)
    C.actualizar(d, lambda c: C.apuntar_intento(c, variante, fase, prompt, semilla, nombre + '.png' if hay else None,
                                                seg, r.returncode, entrada, n=n,
                                                error=None if hay else r.stdout[-2000:],
                                                referencia=os.path.basename(referencia) if referencia else None,
                                                medida=medida, referencias=lista or None,
                                                motor=motor if paso else None))
    if hay:
        print('imagen: ' + os.path.abspath(png))
    return r.returncode


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
