#!/usr/bin/env python3
"""IMG-15: escribe los prompts del banco en banco/prompts/<ficha>-<estilo>.txt con prompt_ficha.py y una variante
del estilo de mundo.json. Los estilos son pruebas, no la guía: lo que gane pasa a mundo.json con la usuaria.
Uso: python3 docs/producto/plan-imagenes/banco/prompts.py [estilo…]
Con estilos, escribe solo esos: los prompts de rondas pasadas no cambian aunque cambie mundo.json (r8: «guia», mundo.json con el estilo ganador)."""
import copy, json, pathlib, subprocess, sys, tempfile

R = pathlib.Path(__file__).resolve().parents[4]
G = R / 'image-generator'
OUT = pathlib.Path(__file__).parent / 'prompts'
FICHAS = {'pastos': ('location/pastos-de-la-deriva.json', []),
          'aullador': ('fauna/aullador-rojo.json', ['--variante', 'macho']),
          'aullador_noche': ('fauna/aullador-rojo.json', ['--variante', 'macho', '--momento', 'noche']),
          'hulki': ('npc/hulki.json', []),
          'cardo': ('flora/cardo-brujula.json', [])}


def cine(m):
    """El de calidad.sh: luz dorada dramática y gradación cálida en vez de «muted» y «ordinary daylight»."""
    m['preambulo']['dia'] = m['preambulo']['dia'].replace(
        'By day the sky is an ordinary daylight sky with a light warm haze.',
        'Dramatic golden-hour light with rich atmospheric haze, drifting dust catching the light, deep aerial '
        'perspective and strong contrast.').replace(
        'muted natural colours, a subtle filmic grade and a single accent colour per scene',
        'a rich, warm cinematic colour grade')
    m['estilos']['banner']['base'] = 'Epic cinematic {clase} photograph, award-winning, dramatic lighting, rich warm colour grade.'
    return m


def cine2(m):
    """Más cerca de los banners de ChatGPT: contraluz con el sol bajo, cielo saturado, polvo encendido, foco nítido."""
    m = cine(m)
    m['preambulo']['dia'] = m['preambulo']['dia'].replace(
        'Dramatic golden-hour light with rich atmospheric haze, drifting dust catching the light, deep aerial '
        'perspective and strong contrast.',
        'The low sun sets the sky ablaze in saturated amber, orange and crimson, and thick drifting dust glows in '
        'the backlight, with deep aerial perspective and strong contrast.').replace(
        'a rich, warm cinematic colour grade', 'vivid, saturated warm colours, deep shadows and glowing rim light')
    m['estilos']['banner']['base'] = ('Epic fantasy {clase} photograph, hyper-detailed and razor-sharp, dramatic '
                                      'backlit rim lighting, volumetric dust, vivid saturated warm colours.')
    return m


def corto(m):
    """cine sin la frase general del mundo (madera, hueso, hierro), que no pinta nada en fauna ni paisaje."""
    m = cine(m)
    m['preambulo']['dia'] = m['preambulo']['dia'].replace(
        'A grounded fantasy world with a physical, natural logic, where everything is handmade from wood, hide, bone, '
        'stone and dark iron. ', '')
    return m


def arte(m):
    """cine, pero arte conceptual con texturas fotográficas en vez de fotografía (fuera de D8, para comparar)."""
    m = cine2(m)
    m['estilos']['banner']['base'] = ('Hyper-detailed epic fantasy concept art, a digital matte painting with '
                                      'photorealistic textures, dramatic backlit lighting, vivid saturated warm colours.')
    return m


def fantasia(texto):
    """El ancla deja de ser «un animal real»: criatura de otro mundo que solo recuerda a él."""
    return texto.replace('Its silhouette recalls ', 'It is a fantasy creature of another world, unlike any real '
                         'animal, whose silhouette only loosely recalls ')


def polvo(texto):
    """Las «motas rojas brillantes» salen como gotas o gemas: polvo mate apelmazado."""
    return texto.replace('Tiny glinting flecks of red mineral grit are matted into the fur along the flanks, like sand '
                         'stuck in a wet coat.', 'Dull rust-red mineral dust is caked into the fur along the flanks, '
                         'like dry dirt worked into the coat.')


# estilo: (cambio de mundo.json, cambio del texto final)
ESTILOS = {'actual': (lambda m: m, None), 'guia': (lambda m: m, None), 'cine': (cine, None), 'cine2': (cine2, None), 'corto': (corto, None),
           'arte': (arte, None), 'fantasia': (cine2, fantasia),
           'polvo': (cine2, polvo)}


def main():
    OUT.mkdir(exist_ok=True)
    base = json.load(open(G / 'estilo/mundo.json'))
    with tempfile.TemporaryDirectory() as t:
        for est, (f, post) in ESTILOS.items():
            if sys.argv[1:] and est not in sys.argv[1:]:
                continue
            mp = pathlib.Path(t) / f'{est}.json'
            json.dump(f(copy.deepcopy(base)), open(mp, 'w'))
            for nom, (ficha, args) in FICHAS.items():
                if nom == 'aullador_noche' and est != 'guia':
                    continue  # la noche solo se comprueba con el estilo de mundo.json (r8)
                r = subprocess.run([sys.executable, G / 'scripts/prompt_ficha.py', G / 'fichas' / ficha, 'banner',
                                    '--mundo', mp, *args], capture_output=True, text=True)
                if r.returncode:
                    sys.exit(f'{nom}-{est}: {r.stdout}{r.stderr}')
                txt = post(r.stdout) if post else r.stdout
                if post and txt == r.stdout:
                    continue  # el cambio no aplica a esta ficha (p. ej. sin ancla)
                (OUT / f'{nom}-{est}.txt').write_text(txt)
                print(f'{nom}-{est}: {len(txt.split())} palabras')


if __name__ == '__main__':
    main()
