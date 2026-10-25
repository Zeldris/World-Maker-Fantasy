"""IMG-5: image-generator/scripts/prompt_ficha.py monta el prompt desde la ficha (plantilla-prompt.md).

Mundos y fichas mínimos en memoria para las reglas; los datos reales solo en el último grupo.
"""
import contextlib
import copy
import importlib.util
import io
import json
import os
import re
import tempfile
import unittest

from comun import RAIZ, carpeta, escribir

SCRIPT = os.path.join(RAIZ, 'image-generator', 'scripts', 'prompt_ficha.py')
IMG = os.path.join(RAIZ, 'image-generator')
spec = importlib.util.spec_from_file_location('prompt_ficha', SCRIPT)
pf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pf)

with open(os.path.join(IMG, 'estilo', 'mundo.json'), encoding='utf-8') as _f:
    _REAL = json.load(_f)

MUNDO = {
    'preambulo': {'dia': 'PREAMBULO-DIA.', 'noche': 'PREAMBULO-NOCHE.'},
    'estilos': {
        'banner': {'base': 'Cinematic {clase} photograph.', 'porTipo': {'fauna': {'clase': 'wildlife', 'acabado': 'Shot with a 35mm lens.'}}},
        'icono': {'base': 'Oil painting with brushstrokes.', 'porTipo': {}},
        'thumbnail': 'icono',
        'mapa': {'base': 'Painterly realism.', 'porTipo': {}},
    },
    'encuadres': {'banner': 'ENC-BANNER.', 'thumbnail': 'ENC-THUMB.', 'icono': 'ENC-ICONO.', 'mapa': 'ENC-MAPA.'},
    'regiones': {'R': {'paisaje': 'a red steppe', 'luz': 'Low golden sun.'}},
    'fondo': {'entrada': 'In this {lugar}, keep the scenery and place in the foreground', 'cierre': 'It matches the {estilo} style.'},
    'longitud': {'min': 1, 'max': 500},
    'vetadas': _REAL['vetadas'],
    'negaciones': _REAL['negaciones'],
}
FICHA = {
    'tipo': 'fauna', 'slug': 'bicho', 'nombre': 'Bichoraro', 'region': 'R', 'momento': 'dia',
    'prompt': {'sujeto': 'A lean beast.', 'ancla': 'a maned wolf', 'cuerpo': 'Rust red coat.',
               'rasgos': ['Long legs.', 'Black tail.'], 'pose': 'It crouches.', 'entorno': 'Tall dry grass.',
               'luz': 'Soft morning light.'},
    'variantes': {'macho': {'rasgos+': ['A thick ruff.']}, 'hembra': {'sujeto': 'A slender beast.', 'pose': 'She crouches.'}},
    'propuestas': ['ancla'],
}
ZONA = {'tipo': 'location', 'slug': 'llano', 'nombre': 'Gran Llano', 'region': 'R', 'prompt': {'lugar': 'grassland landscape', 'sujeto': 'x'}}


def montar(ficha=None, mundo=None, perfil='banner', **kw):
    return pf.construir(ficha or FICHA, mundo or MUNDO, perfil, **kw)


def con_prompt(**cambios):
    f = copy.deepcopy(FICHA)
    f['prompt'].update(cambios)
    return f


class Bloques(unittest.TestCase):
    def test_orden_sujeto_antes_que_estilo_y_preambulo_al_final(self):
        p = montar()['prompt']
        orden = ['A lean beast.', 'Its silhouette recalls a maned wolf.', 'Rust red coat.', 'Long legs. Black tail.',
                 'It crouches.', 'Tall dry grass.', 'Soft morning light.', 'ENC-BANNER.', 'Cinematic wildlife photograph.',
                 'Shot with a 35mm lens.', 'PREAMBULO-DIA.']
        pos = [p.index(t) for t in orden]
        self.assertEqual(pos, sorted(pos))
        self.assertTrue(p.endswith('PREAMBULO-DIA.'))

    def test_determinista_y_devuelve_propuestas(self):
        a, b = montar(), montar()
        self.assertEqual(a, b)
        self.assertEqual(a['propuestas'], ['ancla'])
        f = copy.deepcopy(FICHA)
        del f['propuestas']
        self.assertEqual(montar(f)['propuestas'], [])

    def test_momento_noche_y_por_defecto_el_de_la_ficha(self):
        self.assertTrue(montar(momento='noche')['prompt'].endswith('PREAMBULO-NOCHE.'))
        self.assertTrue(montar()['prompt'].endswith('PREAMBULO-DIA.'))

    def test_campo_ausente_o_vacio_omite_el_bloque_sin_hueco(self):
        f = con_prompt(cuerpo='', rasgos=[])
        del f['prompt']['pose']
        p = montar(f)['prompt']
        self.assertNotIn('  ', p)
        self.assertNotIn('Rust red', p)
        self.assertNotIn('Long legs', p)

    def test_entorno_ausente_usa_paisaje_de_la_region(self):
        f = copy.deepcopy(FICHA)
        del f['prompt']['entorno']
        self.assertIn('The setting is a red steppe.', montar(f)['prompt'])

    def test_entorno_vacio_no_pone_nada(self):
        p = montar(con_prompt(entorno=''))['prompt']
        self.assertNotIn('red steppe', p)
        self.assertNotIn('Tall dry grass', p)

    def test_luz_ausente_usa_la_de_la_region(self):
        f = copy.deepcopy(FICHA)
        del f['prompt']['luz']
        p = montar(f)['prompt']
        self.assertIn('Low golden sun.', p)
        self.assertNotIn('morning', p)


class Variantes(unittest.TestCase):
    def test_variante_sustituye_claves(self):
        p = montar(variante='hembra')['prompt']
        self.assertIn('A slender beast.', p)
        self.assertNotIn('A lean beast.', p)
        self.assertIn('She crouches.', p)
        self.assertNotIn('It crouches.', p)

    def test_variante_mas_anade_al_final_de_la_lista(self):
        p = montar(variante='macho')['prompt']
        self.assertIn('Long legs. Black tail. A thick ruff.', p)

    def test_variante_inexistente_es_error_con_su_nombre(self):
        with self.assertRaises(pf.ReglaRota) as c:
            montar(variante='cria')
        self.assertIn('cria', str(c.exception))
        self.assertIn('no existe', str(c.exception))

    def test_perfil_desconocido_es_error(self):
        with self.assertRaises(pf.ReglaRota) as c:
            montar(perfil='poster')
        self.assertIn('poster', str(c.exception))


class Estilos(unittest.TestCase):
    def test_banner_fauna_con_35mm(self):
        p = montar()['prompt']
        self.assertIn('Cinematic wildlife photograph.', p)
        self.assertIn('35mm', p)
        self.assertNotIn('Oil painting', p)

    def test_icono_al_oleo(self):
        p = montar(perfil='icono')['prompt']
        self.assertIn('Oil painting', p)
        self.assertNotIn('35mm', p)
        self.assertIn('ENC-ICONO.', p)

    def test_thumbnail_es_alias_de_icono_en_estilo_pero_tiene_su_encuadre(self):
        p = montar(perfil='thumbnail')['prompt']
        self.assertIn('Oil painting', p)
        self.assertIn('ENC-THUMB.', p)


class Reglas(unittest.TestCase):
    def rota(self, ficha=None, **kw):
        with self.assertRaises(pf.ReglaRota) as c:
            montar(ficha, **kw)
        return str(c.exception)

    def test_moon_vetada_con_su_alternativa(self):
        m = self.rota(con_prompt(entorno='A pale moon hangs over the grass.'))
        self.assertIn('moon', m)
        self.assertIn('regla 4', m)
        self.assertIn('stars under a soft, even pearly glow', m)

    def test_moon_dentro_de_una_negacion_falla_por_las_dos_razones(self):
        m = self.rota(con_prompt(entorno='The sky holds no moon.'))
        self.assertIn('«moon»', m)
        self.assertIn('regla 4', m)
        self.assertIn('«no»', m)
        self.assertIn('regla 3', m)

    def test_moonlight_y_moonlit(self):
        self.assertIn('moonlight', self.rota(con_prompt(luz='Cold moonlight on the grass.')))
        self.assertIn('moonlit', self.rota(con_prompt(luz='A moonlit plain.')))

    def test_crystal_dust_across_the_heavens(self):
        m = self.rota(con_prompt(entorno='Crystal dust across the heavens.'))
        self.assertIn('Crystal dust', m)
        self.assertIn('heavens', m)
        self.assertIn('a light warm haze', m)

    def test_scars(self):
        m = self.rota(con_prompt(cuerpo='Its flank is covered in scars.'))
        self.assertIn('«scars»', m)
        self.assertIn('pale healed streaks', m)

    def test_otras_vetadas(self):
        self.assertIn('wounds', self.rota(con_prompt(cuerpo='Open wounds.')))
        self.assertIn('fossilised sand', self.rota(con_prompt(cuerpo='Patches of fossilised sand.')))
        self.assertIn('thin glinting streaks of red mineral', self.rota(con_prompt(cuerpo='Fossilized sand shines.')))

    def test_vetada_no_salta_con_palabras_parecidas(self):
        montar(con_prompt(cuerpo='A scarlet coat and a scarf of fur.'))

    def test_negaciones(self):
        for palabra, texto in [('no', 'No fur is visible.'), ('not', 'It does not run.'), ('without', 'It walks without sound.'),
                               ('never', 'It never sleeps.'), ('none', 'None follow it.'), ('nothing', 'Nothing moves.'),
                               ('nobody', 'Nobody is near.'), ("n't", "It doesn't run.")]:
            with self.subTest(palabra):
                m = self.rota(con_prompt(pose=texto))
                self.assertIn('regla 3', m)
                self.assertIn(palabra, m.lower())

    def test_nombre_propio_de_la_ficha_sin_distinguir_mayusculas(self):
        m = self.rota(con_prompt(pose='The bichoraro crouches.'))
        self.assertIn('regla 5', m)
        self.assertIn('Bichoraro', m)

    def test_comprueba_tambien_lo_que_viene_de_mundo(self):
        mundo = copy.deepcopy(MUNDO)
        mundo['preambulo']['dia'] = 'The sky has no clouds.'
        self.assertIn('regla 3', self.rota(mundo=mundo))


class Longitud(unittest.TestCase):
    def mundo(self, maximo, minimo=1):
        m = copy.deepcopy(MUNDO)
        m['longitud'] = {'min': minimo, 'max': maximo}
        return m

    def test_recorta_b6_primero(self):
        completo = montar()
        sin_luz = len(completo['prompt'].split()) - len('Soft morning light.'.split())
        r = montar(mundo=self.mundo(sin_luz))
        self.assertEqual(r['recortados'], ['B6'])
        self.assertNotIn('Soft morning light.', r['prompt'])
        self.assertIn('Tall dry grass.', r['prompt'])
        self.assertLessEqual(r['palabras'], sin_luz)

    def test_sigue_con_b5_y_b4_nunca_b1_a_b3(self):
        r = montar(mundo=self.mundo(1))
        self.assertEqual(r['recortados'], ['B6', 'B5', 'B4'])
        for t in ('A lean beast.', 'Rust red coat.', 'Long legs.'):
            self.assertIn(t, r['prompt'])
        for t in ('Soft morning', 'Tall dry grass', 'It crouches'):
            self.assertNotIn(t, r['prompt'])
        self.assertTrue(any('regla 7' in a for a in r['avisos']))

    def test_corto_solo_avisa(self):
        r = montar(mundo=self.mundo(500, 400))
        self.assertEqual(r['recortados'], [])
        self.assertTrue(any('menos del mínimo' in a for a in r['avisos']))

    def test_dentro_de_rango_sin_avisos(self):
        r = montar()
        self.assertEqual(r['avisos'], [])
        self.assertEqual(r['palabras'], len(r['prompt'].split()))


class Fondo(unittest.TestCase):
    def test_fondo_banner(self):
        r = montar(fondo=ZONA)
        p = r['prompt']
        self.assertTrue(p.startswith('In this grassland landscape, keep the scenery and place in the foreground a lean beast.'))
        self.assertTrue(p.endswith('It matches the photographic style.'))
        for ausente in ('PREAMBULO', 'ENC-', 'Cinematic', 'Tall dry grass', 'Soft morning'):
            self.assertNotIn(ausente, p)
        self.assertIn('It crouches.', p)

    def test_fondo_icono_es_painterly(self):
        self.assertTrue(montar(perfil='icono', fondo=ZONA)['prompt'].endswith('It matches the painterly style.'))

    def test_fondo_con_variante(self):
        self.assertIn('A thick ruff.', montar(variante='macho', fondo=ZONA)['prompt'])

    def test_fondo_rechaza_el_nombre_de_la_zona(self):
        with self.assertRaises(pf.ReglaRota) as c:
            montar(con_prompt(pose='It crouches on the gran llano.'), fondo=ZONA)
        self.assertIn('Gran Llano', str(c.exception))


class Cli(unittest.TestCase):
    def setUp(self):
        self.d = carpeta()
        self.mundo = os.path.join(self.d, 'mundo.json')
        escribir(self.mundo, json.dumps(MUNDO))

    def ficha(self, f=None, nombre='ficha.json'):
        ruta = os.path.join(self.d, nombre)
        escribir(ruta, json.dumps(f or FICHA))
        return ruta

    def correr(self, *args):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = pf.main(list(args))
        return code, out.getvalue(), err.getvalue()

    def test_imprime_el_prompt(self):
        code, out, _ = self.correr(self.ficha(), 'banner', '--mundo', self.mundo)
        self.assertEqual(code, 0)
        self.assertEqual(out.strip(), montar()['prompt'])

    def test_json(self):
        code, out, _ = self.correr(self.ficha(), 'icono', '--variante', 'macho', '--json', '--mundo', self.mundo)
        self.assertEqual(code, 0)
        d = json.loads(out)
        self.assertEqual(sorted(d), ['avisos', 'palabras', 'prompt', 'propuestas', 'recortados'])
        self.assertEqual(d['prompt'], montar(perfil='icono', variante='macho')['prompt'])

    def test_fondo_y_momento(self):
        code, out, _ = self.correr(self.ficha(), 'banner', '--fondo', self.ficha(ZONA, 'z.json'), '--mundo', self.mundo)
        self.assertEqual(code, 0)
        self.assertIn('In this grassland landscape', out)
        code, out, _ = self.correr(self.ficha(), 'banner', '--momento', 'noche', '--mundo', self.mundo)
        self.assertIn('PREAMBULO-NOCHE.', out)

    def test_regla_rota_sale_con_2_y_el_motivo_en_stderr(self):
        code, out, err = self.correr(self.ficha(con_prompt(entorno='The sky holds no moon.')), 'banner', '--mundo', self.mundo)
        self.assertEqual(code, 2)
        self.assertEqual(out, '')
        self.assertIn('moon', err)
        self.assertIn('regla 4', err)

    def test_variante_inexistente_sale_con_2(self):
        code, _, err = self.correr(self.ficha(), 'banner', '--variante', 'cria', '--mundo', self.mundo)
        self.assertEqual(code, 2)
        self.assertIn('cria', err)

    def test_como_proceso_sale_con_2(self):
        import subprocess
        r = subprocess.run(['python3', SCRIPT, self.ficha(con_prompt(pose='It never runs.')), 'banner', '--mundo', self.mundo],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 2)
        self.assertIn('never', r.stderr)


class DatosReales(unittest.TestCase):
    """Las cuatro fichas piloto montan en banner sin violar reglas (mundo.json real)."""

    @staticmethod
    def ficha(ruta):
        with open(os.path.join(IMG, 'fichas', ruta + '.json'), encoding='utf-8') as f:
            return json.load(f)

    def test_las_cuatro_fichas_montan_en_banner(self):
        casos = [('fauna/aullador-rojo', 'macho'), ('fauna/aullador-rojo', 'hembra'), ('flora/cardo-brujula', None),
                 ('location/pastos-de-la-deriva', None), ('npc/hulki', None)]
        for ruta, variante in casos:
            with self.subTest(ruta=ruta, variante=variante):
                r = pf.construir(self.ficha(ruta), _REAL, 'banner', variante=variante)
                self.assertGreaterEqual(r['palabras'], _REAL['longitud']['min'])
                self.assertLessEqual(r['palabras'], _REAL['longitud']['max'])
                self.assertTrue(r['prompt'].endswith('The image is completely textless.'))
                self.assertFalse(re.search(_REAL['negaciones'], r['prompt'], re.I))

    def test_aullador_macho_sobre_pastos(self):
        r = pf.construir(self.ficha('fauna/aullador-rojo'), _REAL, 'banner', variante='macho',
                         fondo=self.ficha('location/pastos-de-la-deriva'))
        p = r['prompt']
        self.assertTrue(p.startswith('In this grassland landscape, keep the scenery, sky and light exactly as they are'))
        self.assertTrue(p.endswith('It matches the photographic style and the light of the scene.'))
        self.assertIn('pale healed streaks', p)
        self.assertNotIn('A grounded fantasy world', p)


if __name__ == '__main__':
    unittest.main()
