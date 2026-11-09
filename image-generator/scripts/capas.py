#!/usr/bin/env python3
"""IMG-54: plantilla por capas. Monta los prompts de cada fase desde el bloque `capas` de una ficha y, con --generar,
encadena fase.py sin que nadie elija: una semilla por fase y se acepta el único intento.

Fases (receta-calidad.md, «Boceto por capas»): P1 sujeto a lápiz, solo forma; edición a lápiz que nombra solo el
cambio (si la ficha trae `edicion`); entorno a lápiz en el fondo blanco (si la ficha trae `entorno`); tono gris sin
líneas; paso a foto con el color, la paleta y la luz; F4 opcional (--final <motor>).
Sin LLM: misma ficha y variante dan siempre el mismo texto.

Uso: capas.py <ficha.json> [--variante macho] [--salida <dir>] [--generar] [--semilla N] [--motor klein4b]
              [--camino capas] [--final flux3] [--directa] [--bloque capas]
--directa: P1 ya es foto con forma, entorno, color y luz; la edición de la ficha, sobre la foto.
--corta: como --directa, pero P1 es solo el campo `corto` de la ficha (≤120 palabras; ronda 6).
--hibrida: `corto` primero (forma y luz) y detrás los campos de detalle de --directa (ronda 7).
--bloque <clave>: lee los campos de esa clave de la ficha (por defecto `capas`; `capasIA` es lo que escribe el
modelo local, IMG-54 paso 6, sin pisar lo escrito a mano).
Sale con 2 y el motivo si un campo rompe una regla de la plantilla (palabra vetada, color en una capa de lápiz).
"""
import json
import os
import re
import subprocess
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
COSA = {'fauna': 'creature', 'flora': 'plant', 'item': 'object', 'construccion': 'building', 'location': 'place',
        'raza': 'figure', 'npc': 'figure'}

# Quién dibuja: el estilo del boceto pasa a la foto (tinta → dibujo animado; lápiz de ilustrador → foto).
DIBUJANTE = {
    'fauna': 'a wildlife illustrator: accurate animal anatomy and true proportions, observed from life',
    'flora': 'a botanical illustrator: accurate plant structure and true proportions, observed from life',
    'raza': 'a film concept artist: accurate anatomy and true proportions',
    'npc': 'a film concept artist: accurate anatomy and true proportions',
    'item': 'a film prop designer: accurate construction, true proportions and real materials',
    'construccion': 'an architectural illustrator: accurate construction, true scale and real materials',
    'location': 'a landscape illustrator: true scale and depth, observed from life',
}
TONO = ('Repaint this pencil study as a soft monochrome tonal painting in smooth blended grey values, like a '
        'black-and-white photograph slightly out of focus: no lines, no outlines, no hatching, no paper texture. Keep '
        'every shape, pose, proportion and position exactly. The image is completely textless.')
FINAL = ('Render this photograph with full photographic detail and real texture, keeping its composition, its light '
         'and its colours exactly. Style: a real photograph, natural film grain, not a 3D render. '
         'The image is completely textless.')

# Reglas de la plantilla (FOTO, CLAVE, CORTO_MAX, VETADAS, COLOR, CAMPOS_LAPIZ, COLOR_PERMITIDO): estilo/capas.json,
# la misma fuente que el generador de prompts del backend (imagePromptCapas.ts).
with open(os.path.join(AQUI, '..', 'estilo', 'capas.json'), encoding='utf-8') as _f:
    _R = json.load(_f)
FOTO = _R['FOTO']
CLAVE = _R['CLAVE']
CORTO_MAX = _R['CORTO_MAX']
VETADAS = tuple((v['patron'], v['motivo'], v['alternativa']) for v in _R['VETADAS'])
COLOR = _R['COLOR']
CAMPOS_LAPIZ = tuple(_R['CAMPOS_LAPIZ'])
COLOR_PERMITIDO = _R['COLOR_PERMITIDO']


def aborto(msg, code):
    print(msg, file=sys.stderr)
    sys.exit(code)


def texto(v):
    return ' '.join(v) if isinstance(v, list) else (v or '')


def minuscula(t):
    return t[:1].lower() + t[1:]


def capas_de(ficha, variante, bloque='capas'):
    c = dict(ficha.get(bloque) or {})
    if not c:
        aborto(f'la ficha no tiene bloque «{bloque}»', 3)
    for k, v in ((c.get('variantes') or {}).get(variante) or {}).items():
        if k.endswith('+'):
            base = c.get(k[:-1]) or []
            c[k[:-1]] = (base if isinstance(base, list) else [base]) + (v if isinstance(v, list) else [v])
        else:
            c[k] = v
    return c


def comprobar(c, lapiz=True):
    errores = []
    for campo, v in c.items():
        if campo in ('variantes', 'notas'):
            continue
        t = texto(v) if isinstance(v, (str, list)) else ''
        t = re.sub(r'\b[Nn]o [^.]*\.', '', t)  # las negaciones («No spires, no castles.») sí valen
        for patron, motivo, alternativa in VETADAS:
            m = re.search(patron, t, re.I)
            if m:
                errores.append(f'{campo}: «{m.group(0)}» {motivo}; mejor: {alternativa}')
        if campo == 'corto' and len(t.split()) > CORTO_MAX:
            errores.append(f'corto: {len(t.split())} palabras; como mucho {CORTO_MAX} (klein se confunde con más)')
        if lapiz and campo in CAMPOS_LAPIZ:  # solo la plantilla a lápiz: --directa/--corta/--hibrida son foto desde P1
            limpio = re.sub(COLOR_PERMITIDO, '', t, flags=re.I)
            m = re.search(COLOR, limpio, re.I)
            if m:
                errores.append(f'{campo}: «{m.group(0)}» es color en una capa de lápiz; va en «color»')
    return errores


def prompts_directa(ficha, c):
    """--directa (ronda 4): P1 ya es foto con todo; la edición, si la hay, sobre la foto. Ninguna fase desde dibujo
    dio foto en las rondas 1-3 (receta-calidad.md)."""
    tipo = ficha['tipo']
    foto = c.get('foto') or FOTO[tipo]
    # Ronda 5 (prueba a ciegas, 2026-11-09): con la luz al final de 270-480 palabras salía más clara que el banner en
    # los siete. Guías de FLUX.2 klein (fal.ai, deapi.ai): la luz es lo que más pesa y el modelo atiende más a lo
    # primero; orden sujeto → luz → resto, y la luz dicha como un fotógrafo (fuente, dirección, exposición).
    partes = [foto[:1].upper() + foto[1:] + '.', texto(c.get('sujeto')), texto(c.get('luz')),
              texto(c.get('clave', CLAVE))] + [texto(c.get(k)) for k in
              ('tamano', 'forma', 'viste', 'pose', 'entorno', 'color', 'repetir')]
    if c.get('paleta'):
        partes.append(f'A limited, muted palette of {c["paleta"]}.')
    partes.append('The image is completely textless.')
    fases = [('P1', ' '.join(x for x in partes if x))]
    if c.get('edicion'):
        fases.append(('P2', f'Edit this photograph: {texto(c["edicion"])} The pose, the clothes, the background, the '
                            'light and the colours stay as they are. It stays a real photograph.'))
    return fases


def prompts_corta(ficha, c):
    """--corta (ronda 6): P1 = tipo de foto + `corto` (sujeto y encuadre, luz, rasgo dominante, cuerpo por partes de
    animales o cosas reales, color en una frase). Guías de klein: más de ~100-120 palabras lo confunden."""
    if not c.get('corto'):
        aborto('la ficha no tiene «corto» en su bloque «capas»', 3)
    foto = c.get('foto') or FOTO[ficha['tipo']]
    return [('P1', f'{foto[:1].upper() + foto[1:]}. {texto(c["corto"])} The image is completely textless.')]


def prompts_hibrida(ficha, c):
    """--hibrida (ronda 7): la ronda 6 dio la anatomía con `corto` (aullador 6→8) pero perdió identidad (runas,
    color, colmillos rectos), que sí daba --directa: `corto` delante, luego el detalle sin repetir sujeto ni luz."""
    p1 = prompts_corta(ficha, c)[0][1].replace(' The image is completely textless.', '')
    resto = [texto(c.get(k)) for k in ('tamano', 'forma', 'viste', 'entorno', 'color', 'repetir')]
    if c.get('paleta'):
        resto.append(f'A limited, muted palette of {c["paleta"]}.')
    return [('P1', ' '.join([p1] + [t for t in resto if t] + ['The image is completely textless.']))]


def prompts(ficha, c):
    tipo = ficha['tipo']
    cosa = c.get('cosa') or COSA[tipo]
    lapiz = (f'A realistic graphite pencil study on white paper by {DIBUJANTE[tipo]}, careful hatching for form and '
             'texture, no colour. The drawing is completely textless. ')
    p1 = lapiz + ' '.join(texto(c.get(k)) for k in ('sujeto', 'tamano', 'forma', 'viste', 'pose') if c.get(k))
    if c.get('entorno') and tipo != 'location':
        p1 += ' The background is plain white.'  # «el resto del papel» hizo dibujar el objeto en un papel (amuleto)
    fases = [('P1', p1)]
    if c.get('edicion'):  # una edición a lápiz que nombra solo el cambio (Gistera: figura fuerte, luego mujer)
        # «Change only this» apenas cambiaba nada (Gistera, pasada 1): la edición se da como orden que sustituye el rasgo.
        fases.append(('P2', f'Edit this pencil study, in the same realistic graphite style with no colour: '
                            f'{texto(c["edicion"])} The pose, the clothes and the background stay as they are.'))
    if c.get('entorno') and tipo != 'location':
        fases.append((f'P{len(fases) + 1}', f'Fill the plain white background around the {cosa} with its surroundings, in the same realistic '
                            f'graphite style with no colour: {minuscula(texto(c["entorno"]))} The {cosa} stays the same size, '
                            'in the same place, drawn exactly as it is.'))
    # El rayado del lápiz pasaba a la foto como trazo de ilustración, con klein 4B y 9B (pasada 1): antes, un estudio de
    # tono sin líneas.
    fases.append((f'P{len(fases) + 1}', TONO))
    foto = [f'Turn this tonal study into {c.get("foto") or FOTO[tipo]}, keeping every shape, pose and position exactly.',
            texto(c.get('color')), texto(c.get('repetir'))]
    if c.get('paleta'):
        foto.append(f'A limited, muted palette of {c["paleta"]}.')
    foto += [texto(c.get('luz')), 'The image is completely textless.']
    fases.append((f'P{len(fases) + 1}', ' '.join(t for t in foto if t)))
    return fases


def generar(tipo, slug, camino, fase, archivo, semilla, motor, extra=()):
    orden = [sys.executable, os.path.join(AQUI, 'fase.py'), tipo, slug, camino, fase, archivo, str(semilla)]
    if fase != 'P1':
        orden += ['--motor', motor]
    orden += list(extra)
    r = subprocess.run(orden, capture_output=True, text=True)
    m = re.search(r'imagen: (.+-(\d+)\.png)', r.stdout)
    if r.returncode or not m:
        aborto(f'{fase} falló ({r.returncode}):\n{r.stdout[-800:]}{r.stderr[-800:]}', r.returncode or 1)
    print(f'{fase}: {m.group(1)}', flush=True)
    return int(m.group(2))


def aceptar(tipo, slug, camino, fase, n, siguiente):
    sys.path.insert(0, AQUI)
    import camino as C
    d = os.path.join(os.environ.get('IMG_RAIZ') or os.path.join(AQUI, '..'), 'generated', tipo, slug)
    C.actualizar(d, lambda cam: C.avanzar(d, cam, camino, fase, n, siguiente, tipo, conservar=True))


def main(argv):
    def opt(nombre, defecto=None):
        if nombre in argv:
            i = argv.index(nombre)
            v = argv[i + 1]
            del argv[i:i + 2]
            return v
        return defecto
    variante = opt('--variante')
    salida = opt('--salida')
    semilla = int(opt('--semilla', '5'))
    motor = opt('--motor', 'klein4b')
    camino = opt('--camino', 'capas')
    final = opt('--final')
    bloque = opt('--bloque', 'capas')
    gen = '--generar' in argv
    directa = '--directa' in argv
    corta = '--corta' in argv
    hibrida = '--hibrida' in argv
    argv = [a for a in argv if a not in ('--generar', '--directa', '--corta', '--hibrida')]
    if len(argv) != 1:
        aborto(__doc__, 2)
    ficha = json.load(open(argv[0], encoding='utf-8'))
    c = capas_de(ficha, variante, bloque)
    errores = comprobar(c, lapiz=not (directa or corta or hibrida))
    if errores:
        aborto('\n'.join(errores), 2)
    fases = (prompts_hibrida if hibrida else prompts_corta if corta else prompts_directa if directa else prompts)(ficha, c)
    tipo = ficha['tipo']
    slug = ficha['slug'] + (f'-{variante}' if variante else '')
    salida = salida or os.path.join(AQUI, '..', 'generated', tipo, slug, 'capas-prompts')
    os.makedirs(salida, exist_ok=True)
    archivos = []
    for fase, t in fases:
        a = os.path.join(salida, f'{camino}-{fase}.txt')
        open(a, 'w', encoding='utf-8').write(t + '\n')
        archivos.append((fase, a))
        if not gen:
            print(f'== {fase}\n{t}\n')
    if final:
        a = os.path.join(salida, f'{camino}-F4.txt')
        open(a, 'w', encoding='utf-8').write(FINAL + '\n')
        archivos.append(('F4', a))
    if not gen:
        return
    os.environ['CAMINO_CONSERVAR'] = '1'
    for i, (fase, a) in enumerate(archivos):
        m = final if fase == 'F4' else motor
        n = generar(tipo, slug, camino, fase, a, semilla, m)
        if i + 1 < len(archivos):
            aceptar(tipo, slug, camino, fase, n, archivos[i + 1][0])


if __name__ == '__main__':
    main(sys.argv[1:])
