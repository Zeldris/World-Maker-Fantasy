#!/usr/bin/env python3
"""IMG-54: plantilla por capas. Monta los prompts de cada fase desde el bloque `capas` de una ficha y, con --generar,
encadena fase.py sin que nadie elija: una semilla por fase y se acepta el único intento.

Fases (receta-calidad.md, «Boceto por capas»): P1 sujeto a lápiz, solo forma; edición a lápiz que nombra solo el
cambio (si la ficha trae `edicion`); entorno a lápiz en el papel vacío
(si la ficha trae `entorno`); P3 paso a foto con el color, la paleta y la luz; F4 opcional (--final <motor>).
Sin LLM: misma ficha y variante dan siempre el mismo texto.

Uso: capas.py <ficha.json> [--variante macho] [--salida <dir>] [--generar] [--semilla N] [--motor klein4b]
              [--camino capas] [--final flux3]
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
# Qué foto: con «Turn this pencil study into…» el render 3D baja; la película y el objetivo concretos ayudan.
FOTO = {
    'fauna': 'a wildlife photograph of a real animal taken with a long lens',
    'flora': 'a close-up nature photograph of a real plant taken with a macro lens',
    'raza': 'a film still shot on Kodak Vision3 film with a 35mm lens, natural grain, a real actor in realistic '
            'prosthetic makeup on location',
    'npc': 'a film still shot on Kodak Vision3 film with a 35mm lens, natural grain, a real actor in realistic '
           'prosthetic makeup on location',
    'item': 'a photograph of a real handmade object, shot on film with a macro lens, natural grain',
    'construccion': 'a film still of a real building on location, shot on 35mm film, natural grain',
    'location': 'a landscape photograph shot on large-format film, natural grain',
}
FINAL = ('Render this photograph with full photographic detail and real texture, keeping its composition, its light '
         'and its colours exactly. Style: a real photograph, natural film grain, not a 3D render. '
         'The image is completely textless.')

# Reglas aprendidas (receta-calidad.md): cada palabra, con lo que hace y qué poner en su lugar.
VETADAS = (
    (r'\b(fat|barrel[- ]chested|belly|paunch|heavy-set|stocky|strongman|bull-like)\b',
     'engorda la figura («no son gordos, son corpulentos»)', 'as wide as two men, all muscle and heavy bone'),
    (r'\b(stomach|abs|abdomen|bare chest|shirtless)\b',
     'nombrar el vientre pinta abdominales de superhéroe', 'armour that covers chest, stomach and arms, no skin below the neck'),
    (r'\b(spires?|pointed roofs?|gothic|castles?)\b',
     'da ciudad gótica o castillos', 'massive square towers with flat battlemented tops; o «No spires…» como negación'),
    (r'\b(storeys|rows of windows|skyscrapers?)\b', 'da rascacielos', 'only a few narrow slit windows, no glass'),
    (r'\b(\d{2}% (deep )?shadow|almost entirely dark)\b', 'oscurece tanto que se pierde el fondo',
     'most of the frame in shadow, only the edges lit'),
    (r'\b(ink|line art|cartoon|cel[- ]shaded|illustration style)\b', 'el estilo del boceto pasa a la foto: sale dibujo',
     'graphite pencil (lo pone la plantilla)'),
    (r'\b(orcs?|orcish|goblin|troll|dwarf|elf|golem)\b', 'el ancla de otra criatura arrastra su aspecto (orejas de elfo, dibujo, piedra)',
     'a huge humanoid / a tusked warrior y los rasgos uno a uno con su parecido real'),
    (r'\b(ivory-yellow|faint violet tint)\b', 'satura el color (amarillo plástico, lila pastel)',
     'dirty off-white, stained brown in its grooves / dull metallic grey'),
    (r'\bred (dust|streaks?)\b', 'sobre algo claro se pinta como sangre', 'dusty'),
    (r'\bstacked stones?\b', 'da ladrillo', 'like a dry-stone wall from irregular rough fieldstones of every size'),
    (r'\b(in a loop|loops? of cord)\b', 'cierra el cordel como pulsera', 'sags in a wide open curve'),
)
COLOR = r'\b(grey|gray|black|white|red|orange|yellow|green|blue|brown|rust|golden|silver|ash|slate|pale|dark|glowing)\b'
CAMPOS_LAPIZ = ('sujeto', 'tamano', 'forma', 'viste', 'pose', 'edicion', 'entorno')  # sin color: el lápiz lo ignora o lo convierte en dibujo
COLOR_PERMITIDO = r'\b(black stone|cut black stone)\b'  # forma de la ciudad goirnte que sí ayudó a lápiz


def aborto(msg, code):
    print(msg, file=sys.stderr)
    sys.exit(code)


def texto(v):
    return ' '.join(v) if isinstance(v, list) else (v or '')


def minuscula(t):
    return t[:1].lower() + t[1:]


def capas_de(ficha, variante):
    c = dict(ficha.get('capas') or {})
    if not c:
        aborto('la ficha no tiene bloque «capas»', 3)
    for k, v in ((c.get('variantes') or {}).get(variante) or {}).items():
        if k.endswith('+'):
            base = c.get(k[:-1]) or []
            c[k[:-1]] = (base if isinstance(base, list) else [base]) + (v if isinstance(v, list) else [v])
        else:
            c[k] = v
    return c


def comprobar(c):
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
        if campo in CAMPOS_LAPIZ:
            limpio = re.sub(COLOR_PERMITIDO, '', t, flags=re.I)
            m = re.search(COLOR, limpio, re.I)
            if m:
                errores.append(f'{campo}: «{m.group(0)}» es color en una capa de lápiz; va en «color»')
    return errores


def prompts(ficha, c):
    tipo = ficha['tipo']
    cosa = c.get('cosa') or COSA[tipo]
    lapiz = (f'A realistic graphite pencil study on white paper by {DIBUJANTE[tipo]}, careful hatching for form and '
             'texture, no colour. The drawing is completely textless. ')
    p1 = lapiz + ' '.join(texto(c.get(k)) for k in ('sujeto', 'tamano', 'forma', 'viste', 'pose') if c.get(k))
    if c.get('entorno') and tipo != 'location':
        p1 += ' The rest of the paper is empty.'
    fases = [('P1', p1)]
    if c.get('edicion'):  # una edición a lápiz que nombra solo el cambio (Gistera: figura fuerte, luego mujer)
        fases.append(('P2', f'Change only this in the pencil study, in the same realistic graphite style with no colour: '
                            f'{texto(c["edicion"])} Keep everything else exactly as it is.'))
    if c.get('entorno') and tipo != 'location':
        fases.append((f'P{len(fases) + 1}', f'Draw only on the empty white paper around the {cosa}, in the same realistic graphite style '
                            f'with no colour: {minuscula(texto(c["entorno"]))} The {cosa} stays the same size, in the same place, '
                            'drawn exactly as it is.'))
    foto = [f'Turn this pencil study into {c.get("foto") or FOTO[tipo]}, keeping every shape, pose and position exactly.',
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
    gen = '--generar' in argv
    argv = [a for a in argv if a != '--generar']
    if len(argv) != 1:
        aborto(__doc__, 2)
    ficha = json.load(open(argv[0], encoding='utf-8'))
    c = capas_de(ficha, variante)
    errores = comprobar(c)
    if errores:
        aborto('\n'.join(errores), 2)
    fases = prompts(ficha, c)
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
