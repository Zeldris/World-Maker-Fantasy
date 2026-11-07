#!/usr/bin/env python3
"""IMG-40: una orden por fase del generador. Uso: fase.py <tipo> <slug> <variante> <fase> <archivo-prompt> [semilla] [--referencia <imagen>] [--medir-con <imagen>]
--referencia añade la imagen del juego como -r en cualquier fase; en la Final va detrás del boceto y el prompt dice cuál es cuál.
--medir-con es la imagen del juego contra la que medir el color aunque no se pase al modelo (si no, la de --referencia).
Toma la imagen aceptada de la fase de entrada, traduce la receta de la fase a generar.sh y apunta el intento en
camino.json (también si falla). IMG_RAIZ cambia la raíz image-generator/; IMG_GENERAR sustituye a generar.sh (tests).
Salida: «imagen: <ruta>.png» si salió. Códigos: el de generar.sh; 2 argumentos o fase inválida; 3 falta entrada o prompt."""
import os
import re
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'medir'))
import camino as C  # noqa: E402
import medida as M  # noqa: E402

COSA = {'fauna': 'creature', 'flora': 'plant', 'item': 'object', 'construccion': 'building', 'location': 'place',
        'raza': 'figure', 'npc': 'figure'}
PREFIJO_F4 = ('The same {cosa}, in the same composition, as the reference image, which is a rough study: '
              'keep its shapes and proportions and render it with full detail. ')
PREFIJO_F4_CON_JUEGO = ('The same {cosa}, in the same composition, as the first reference image, which is a rough study: '
                        'keep its shapes and proportions and render it with full detail. '
                        'The second reference image shows this {cosa}: follow its colors and materials. ')
PREFIJO_JUEGO = 'The reference image shows this {cosa}: follow its colors and materials. '
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
LIMPIAR = ('PERFIL', 'BOCETO', 'FUERZA_BOCETO', 'MOMENTO')
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


def main(argv):
    referencia, argv = opcion(argv, '--referencia')
    medir_con, argv = opcion(argv, '--medir-con')
    if len(argv) not in (5, 6):
        aborto('uso: fase.py <tipo> <slug> <variante> <fase> <archivo-prompt> [semilla] [--referencia <imagen>] [--medir-con <imagen>]', 2)
    tipo, slug, variante, fase, archivo = argv[:5]
    for v in (tipo, slug, variante):
        if not VALIDO.match(v):
            aborto(f'«{v}» no es un tipo, slug o variante válido', 2)
    if fase == 'F3':
        aborto('F3 Recorte llega con IMG-37', 2)
    if fase not in RECETAS:
        aborto(f'fase desconocida: {fase} (F0, F1, F2, F4)', 2)
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
    raiz = os.environ.get('IMG_RAIZ') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
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
        if semilla is None:
            semilla = C.semilla_por_defecto(v, fase, prompt, os.path.basename(referencia) if referencia else None)
    except C.CaminoInvalido as e:
        aborto(str(e), 3)
    n = C.siguiente_n(cam, variante, fase)
    nombre = C.nombre_intento(variante, fase, n)
    enviado = prompt
    env = {k: x for k, x in os.environ.items() if k not in LIMPIAR}
    env.update(rec['env'])
    extra = list(rec['extra'])
    if entrada:
        ruta = os.path.join(d, 'intentos', entrada[1])
        if rec['entrada'] == 'BOCETO':
            env['BOCETO'] = ruta
        else:
            extra = ['-r', ruta] + extra
            enviado = (PREFIJO_F4_CON_JUEGO if referencia else PREFIJO_F4).format(cosa=COSA.get(tipo, 'subject')) + prompt
    if referencia:
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
    r = subprocess.run(['bash', generar, d, nombre, pf, str(rec['w']), str(rec['h']), str(semilla), str(rec['pasos']), *extra],
                       env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    os.remove(pf)
    seg = round(time.time() - t0, 1)
    sys.stdout.write(r.stdout)
    png = os.path.join(d, 'intentos', nombre + '.png')
    hay = os.path.exists(png)
    medida = None
    if hay:
        juego = medir_con or referencia
        medida = M.medir(png, os.path.join(d, 'intentos', entrada[1]) if entrada else None,
                         juego if juego and os.path.isfile(juego) else None)
    C.actualizar(d, lambda c: C.apuntar_intento(c, variante, fase, prompt, semilla, nombre + '.png' if hay else None,
                                                seg, r.returncode, entrada, n=n,
                                                error=None if hay else r.stdout[-2000:],
                                                referencia=os.path.basename(referencia) if referencia else None,
                                                medida=medida))
    if hay:
        print('imagen: ' + os.path.abspath(png))
    return r.returncode


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
