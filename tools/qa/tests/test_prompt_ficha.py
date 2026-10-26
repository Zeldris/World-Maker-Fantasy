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
        'banner': {'palabra': 'photographic', 'base': 'Cinematic {clase} photograph.', 'porTipo': {'fauna': {'clase': 'wildlife', 'acabado': 'Shot with a 35mm lens.'}}},
        'icono': {'palabra': 'painterly', 'base': 'Oil painting with brushstrokes.', 'porTipo': {}},
        'thumbnail': 'icono',
        'mapa': {'palabra': 'painterly', 'base': 'Painterly realism.', 'porTipo': {}},
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


def mundo_foto(maximo=500):
    """MUNDO con el perfil `fotorreal` (sin preámbulo; B7 y B8 de mentira) y su tope y sus recortables por perfil."""
    m = copy.deepcopy(MUNDO)
    m['estilos']['fotorreal'] = {'palabra': 'photographic', 'base': 'Style: matte painting. Mood: epic.',
                                 'porTipo': {'fauna': {'acabado': 'Shot on a 35mm lens. The image is completely textless.'}}}
    m['encuadres']['fotorreal'] = 'ENC-FOTO.'
    m['longitud'] = {'min': 1, 'max': 320, 'fotorreal': {'max': maximo}, 'recortables': {'fotorreal': ['B3b']}}
    return m


FICHA_FOTO = {
    'tipo': 'fauna', 'slug': 'bicho', 'nombre': 'Bichoraro', 'region': 'R', 'momento': 'dia',
    'prompt': {'sujeto': 'SUJETO.', 'proporcion': 'PROPORCION.', 'ancla': 'the head of a red fox on the torso of a weasel',
               'cuerpo': 'CUERPO.', 'rasgos': ['RASGOS.'], 'rasgosSecundarios': 'SECUNDARIOS.',
               'pose': 'POSE with its weight on one leg.', 'manada': 'MANADA of six.', 'entorno': 'ENTORNO.', 'luz': 'The low sun rims the fur.'},
}


def foto(prompt=None, mundo=None, **kw):
    f = copy.deepcopy(FICHA_FOTO)
    f['prompt'].update(prompt or {})
    return pf.construir(f, mundo or mundo_foto(), 'fotorreal', **kw)


class Fotorreal(unittest.TestCase):
    """IMG-16 (plan-fotorreal.md, decisión 1): perfil `fotorreal`, sin preámbulo, con su orden, su tope y sus avisos."""

    def test_orden_de_bloques_y_sin_preambulo(self):
        p = foto()['prompt']
        orden = ['ENC-FOTO.', 'SUJETO.', 'PROPORCION.', 'RASGOS.', 'SECUNDARIOS.', 'Its silhouette recalls the head of a red fox',
                 'CUERPO.', 'POSE with', 'MANADA of six.', 'ENTORNO.', 'The low sun rims', 'Style: matte painting. Mood: epic.',
                 'Shot on a 35mm lens.']
        pos = [p.index(t) for t in orden]
        self.assertEqual(pos, sorted(pos))
        self.assertTrue(p.startswith('ENC-FOTO.'))
        self.assertTrue(p.endswith('The image is completely textless.'))
        self.assertNotIn('PREAMBULO', p)

    def test_los_campos_nuevos_son_opcionales_y_no_dejan_huecos(self):
        f = copy.deepcopy(FICHA_FOTO)
        for k in ('proporcion', 'rasgosSecundarios', 'manada', 'ancla'):
            del f['prompt'][k]
        p = pf.construir(f, mundo_foto(), 'fotorreal')['prompt']
        self.assertNotIn('  ', p)
        self.assertNotIn('silhouette', p)
        self.assertNotIn('PROPORCION', p)

    def test_texto_fijo_de_mundo_json_no_pasa_de_60_palabras(self):
        for tipo in ('fauna', 'flora', 'location', 'npc'):
            with self.subTest(tipo=tipo):
                fijo = _REAL['encuadres']['fotorreal'] + ' ' + pf._estilo(_REAL, 'fotorreal', tipo)
                self.assertLessEqual(len(fijo.split()), 60)
                self.assertTrue(fijo.endswith('The image is completely textless.'))
        self.assertNotIn('B9', pf.ORDEN_FOTORREAL)

    def test_tope_y_recortables_por_perfil_en_mundo_json(self):
        self.assertEqual(_REAL['longitud']['fotorreal']['max'], 520)
        self.assertEqual(_REAL['longitud']['max'], 320)  # el resto de perfiles sigue en 320
        self.assertEqual(_REAL['longitud']['recortables'], {'fotorreal': ['B3b']})

    def test_lo_unico_que_se_recorta_es_b3b_y_solo_si_pasa_del_tope(self):
        entero = foto()
        self.assertEqual(entero['recortados'], [])
        self.assertIn('SECUNDARIOS.', entero['prompt'])
        r = foto(mundo=mundo_foto(entero['palabras'] - 1))
        self.assertEqual(r['recortados'], ['B3b'])
        self.assertNotIn('SECUNDARIOS.', r['prompt'])
        self.assertLessEqual(r['palabras'], entero['palabras'] - 1)

    def test_b5_y_b6_nunca_se_recortan_aunque_pase_del_tope(self):
        r = foto(mundo=mundo_foto(1))
        self.assertEqual(r['recortados'], ['B3b'])
        for t in ('ENTORNO.', 'The low sun rims', 'POSE with', 'MANADA of six.'):
            self.assertIn(t, r['prompt'])
        self.assertTrue(any('regla 7' in a and 'aun sin B3b' in a for a in r['avisos']))

    def test_el_tope_del_perfil_manda_sobre_el_general(self):
        m = mundo_foto(520)
        m['longitud']['max'] = 5
        self.assertEqual(foto(mundo=m)['recortados'], [])
        m['longitud']['fotorreal'] = 'no es un dict'  # sin tope propio vale el general
        self.assertEqual(foto(mundo=m)['recortados'], ['B3b'])

    def test_recortables_por_perfil_se_leen_de_mundo(self):
        m = copy.deepcopy(MUNDO)
        m['longitud'] = {'min': 1, 'max': 1, 'recortables': {'banner': ['B5']}}
        r = montar(mundo=m)
        self.assertEqual(r['recortados'], ['B5'])
        self.assertIn('Soft morning light.', r['prompt'])
        self.assertTrue(any('aun sin B5' in a for a in r['avisos']))

    def test_avisos_vacios_en_la_ficha_correcta(self):
        self.assertEqual(foto()['avisos'], [])

    def test_aviso_ancla_repetida_mas_de_dos_veces(self):
        self.assertEqual(foto({'cuerpo': 'A fox head.'})['avisos'], [])  # fox: el ancla y una vez más, dos en total
        a = foto({'cuerpo': 'A fox head, a fox tail and a fox paw.'})['avisos']
        self.assertTrue(any('P2' in x and '«fox»' in x for x in a), a)
        self.assertFalse(any('«head»' in x for x in a))  # una parte del cuerpo no es el animal

    def test_animales_del_ancla(self):
        self.assertEqual(pf._animales_ancla('a red fox stretched to the length of a weasel'), ['fox', 'weasel'])
        self.assertEqual(pf._animales_ancla('the small head of a deer on the upright neck of a giraffe'), ['deer', 'giraffe'])
        self.assertEqual(pf._animales_ancla(None), [])

    def test_aviso_pose_sin_asimetria(self):
        a = foto({'pose': 'It stands in profile.'})['avisos']
        self.assertTrue(any('P4' in x for x in a), a)
        for ok in ('Its head is turned.', 'One leg lifted.', 'Weight on one leg.', 'In three-quarter view.', 'Caught mid-stride.'):
            with self.subTest(ok):
                self.assertEqual(foto({'pose': ok})['avisos'], [])

    def test_aviso_de_pose_solo_en_fauna(self):
        f = copy.deepcopy(FICHA_FOTO)
        f.update(tipo='flora')
        f['prompt']['pose'] = 'Several plants stand on a slope.'
        self.assertEqual(pf.construir(f, mundo_foto(), 'fotorreal')['avisos'], [])

    def test_aviso_manada_por_anafora(self):
        for frase in ('more of the same follow', 'the rest of the pack follows', 'six others follow'):
            with self.subTest(frase):
                self.assertTrue(any('P3' in x for x in foto({'manada': frase})['avisos']))

    def test_aviso_mas_de_una_fuente_de_luz(self):
        a = foto({'luz': 'The low sun rims the fur and a campfire glows on the ground.'})['avisos']
        self.assertTrue(any('P5' in x for x in a), a)
        self.assertEqual(foto({'luz': 'The sun is low and its sunlight rims the fur.'})['avisos'], [])  # una sola fuente

    def test_los_avisos_no_rompen_el_prompt(self):
        r = foto({'pose': 'It stands.', 'manada': 'more of the same', 'luz': 'The sun and a torch.'})
        self.assertEqual(len([a for a in r['avisos'] if a.startswith('P')]), 3)
        self.assertIn('ENTORNO.', r['prompt'])

    def test_cli_json_lleva_recortados_y_avisos_y_acepta_perfil_con_nombre(self):
        d = carpeta()
        ficha, mundo = os.path.join(d, 'f.json'), os.path.join(d, 'm.json')
        escribir(ficha, json.dumps({**FICHA_FOTO, 'prompt': {**FICHA_FOTO['prompt'], 'pose': 'It stands.'}}))
        escribir(mundo, json.dumps(mundo_foto(1)))
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = pf.main([ficha, '--perfil', 'fotorreal', '--json', '--mundo', mundo])
        self.assertEqual(code, 0)
        j = json.loads(out.getvalue())
        self.assertEqual(j['recortados'], ['B3b'])
        self.assertTrue(any('P4' in a for a in j['avisos']))
        self.assertTrue(any('regla 7' in a for a in j['avisos']))

    def test_banner_no_cambia_ignora_los_campos_nuevos_y_no_avisa(self):
        base = montar(mundo=mundo_foto())
        f = copy.deepcopy(FICHA)
        f['prompt'].update(proporcion='PROPORCION.', manada='MANADA.', rasgosSecundarios='SECUNDARIOS.',
                           pose='It stands.', cuerpo='A maned wolf, a maned wolf, a maned wolf.')
        otra = copy.deepcopy(FICHA)
        otra['prompt'].update(pose='It stands.', cuerpo='A maned wolf, a maned wolf, a maned wolf.')
        r = montar(f, mundo_foto())
        self.assertEqual(r['prompt'], montar(otra, mundo_foto())['prompt'])
        self.assertEqual(r['avisos'], [])
        self.assertTrue(r['prompt'].endswith('PREAMBULO-DIA.'))
        self.assertTrue(r['prompt'].startswith('A lean beast.'))
        self.assertEqual(base['recortados'], [])

    def test_campos_nuevos_validos_en_variantes_y_condiciones(self):
        f = copy.deepcopy(FICHA_FOTO)
        f['variantes'] = {'macho': {'manada+': 'MAS MANADA.', 'proporcion': 'OTRA PROPORCION.'}}
        p = pf.construir(f, mundo_foto(), 'fotorreal', variante='macho')['prompt']
        self.assertIn('OTRA PROPORCION.', p)


class FotorrealDatosReales(unittest.TestCase):
    """Aceptación de IMG-16: las cuatro fichas piloto, en `fotorreal` con mundo.json real."""
    casos = [('fauna/aullador-rojo', 'macho'), ('fauna/aullador-rojo', 'hembra'), ('fauna/cuernahoja', 'macho'),
             ('flora/cardo-brujula', None), ('location/pastos-de-la-deriva', None)]

    def test_sin_recortes_ni_avisos_y_entre_260_y_400_palabras(self):
        for ruta, variante in self.casos:
            with self.subTest(ruta=ruta, variante=variante):
                r = pf.construir(DatosReales.ficha(ruta), _REAL, 'fotorreal', variante=variante)
                self.assertEqual((r['recortados'], r['avisos']), ([], []))
                self.assertTrue(260 <= r['palabras'] <= 400, r['palabras'])
                self.assertTrue(r['prompt'].endswith('The image is completely textless.'))
                self.assertFalse(re.search(_REAL['negaciones'], r['prompt'], re.I))

    def test_de_dia_y_al_atardecer_en_las_cuatro_estaciones(self):
        # la noche no: las fichas de fauna aún no tienen condición `momento:noche` y su luz nombra el sol
        for ruta, variante in self.casos:
            for mom in ('dia', 'atardecer'):
                for est in pf.ESTACIONES:
                    with self.subTest(ruta=ruta, momento=mom, estacion=est):
                        r = pf.construir(DatosReales.ficha(ruta), _REAL, 'fotorreal', variante=variante, momento=mom, estacion=est)
                        self.assertEqual(r['recortados'], [])

    def test_la_manada_y_la_proporcion_entran_en_el_aullador(self):
        p = pf.construir(DatosReales.ficha('fauna/aullador-rojo'), _REAL, 'fotorreal', variante='macho')['prompt']
        self.assertIn('as long as five of its own heads', p)
        self.assertIn('a pack of six hunters, each one a long, low hunter', p)
        self.assertLess(p.index('as long as five'), p.index('Its silhouette recalls'))  # la proporción, antes del ancla


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
        self.assertEqual(sorted(d), ['avisos', 'condicion', 'estacion', 'momento', 'palabras', 'prompt', 'propuestas', 'recortados'])
        self.assertEqual((d['momento'], d['estacion'], d['condicion']), ('dia', None, '-/dia'))
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
        self.assertIn('taller crest of spikes', p)  # la variante macho
        self.assertNotIn('A grounded fantasy world', p)


MUNDO_C = copy.deepcopy(MUNDO)
MUNDO_C['preambulo'] = {'dia': 'PREAMBULO-DIA.', 'atardecer': 'PREAMBULO-ATARDECER.', 'noche': 'PREAMBULO-NOCHE.'}
MUNDO_C['estaciones'] = list(pf.ESTACIONES)
MUNDO_C['regiones'] = {'R': {
    'paisaje': 'a red steppe',
    'luz': {'dia': 'LUZ-DIA.', 'atardecer': 'LUZ-ATARDECER.', 'noche': 'LUZ-NOCHE.'},
    'estaciones': {'primavera': 'SEASON-PRIMAVERA.', 'verano': 'SEASON-VERANO.', 'otono': 'SEASON-OTONO.',
                   'invierno': 'SEASON-INVIERNO.'}}}
MUNDO_C['coherencia'] = _REAL['coherencia']


def ficha_c(condiciones=None, **prompt):
    """Ficha sin luz ni entorno propios (usa los de la región) y con condiciones."""
    f = copy.deepcopy(FICHA)
    del f['prompt']['luz'], f['prompt']['entorno']
    f['prompt'].update(prompt)
    f['condiciones'] = condiciones or {}
    return f


class Condiciones(unittest.TestCase):
    def rota(self, ficha, **kw):
        with self.assertRaises(pf.ReglaRota) as c:
            pf.construir(ficha, MUNDO_C, 'banner', **kw)
        return str(c.exception)

    def test_luz_de_la_region_por_momento(self):
        for mom, luz in (('dia', 'LUZ-DIA.'), ('atardecer', 'LUZ-ATARDECER.'), ('noche', 'LUZ-NOCHE.')):
            with self.subTest(mom):
                p = pf.construir(ficha_c(), MUNDO_C, 'banner', momento=mom)['prompt']
                self.assertIn(luz, p)
                self.assertEqual(sum(x in p for x in ('LUZ-DIA.', 'LUZ-ATARDECER.', 'LUZ-NOCHE.')), 1)
                self.assertTrue(p.endswith(f'PREAMBULO-{mom.upper()}.'))

    def test_luz_de_la_ficha_gana_a_la_de_la_region(self):
        p = pf.construir(ficha_c(luz='Own light.'), MUNDO_C, 'banner', momento='noche')['prompt']
        self.assertIn('Own light.', p)
        self.assertNotIn('LUZ-NOCHE.', p)

    def test_luz_de_region_como_texto_vale_para_todos_los_momentos(self):
        mundo = copy.deepcopy(MUNDO)
        mundo['preambulo']['atardecer'] = 'PREAMBULO-ATARDECER.'
        f = copy.deepcopy(FICHA)
        del f['prompt']['luz']
        p = pf.construir(f, mundo, 'banner', momento='atardecer')['prompt']
        self.assertIn('Low golden sun.', p)
        self.assertTrue(p.endswith('PREAMBULO-ATARDECER.'))

    def test_estacion_anade_su_frase_al_paisaje_de_b5(self):
        p = pf.construir(ficha_c(), MUNDO_C, 'banner', estacion='invierno')['prompt']
        self.assertIn('The setting is a red steppe. SEASON-INVIERNO.', p)
        self.assertNotIn('SEASON-VERANO.', p)

    def test_sin_estacion_el_prompt_es_el_de_siempre(self):
        p = pf.construir(ficha_c(), MUNDO_C, 'banner')['prompt']
        self.assertIn('The setting is a red steppe. LUZ-DIA.', p)
        self.assertNotIn('SEASON', p)

    def test_ficha_con_entorno_propio_no_cambia_con_la_estacion(self):
        f = copy.deepcopy(FICHA)
        self.assertEqual(pf.construir(f, MUNDO_C, 'banner', estacion='verano')['prompt'],
                         pf.construir(f, MUNDO_C, 'banner')['prompt'])

    def test_condicion_sustituye_claves_y_mas_anade(self):
        f = ficha_c({'estacion:verano': {'cuerpo': 'Cracked coat.', 'rasgos+': ['Dusty paws.']}})
        p = pf.construir(f, MUNDO_C, 'banner', estacion='verano')['prompt']
        self.assertIn('Cracked coat.', p)
        self.assertNotIn('Rust red coat.', p)
        self.assertIn('Long legs. Black tail. Dusty paws.', p)
        self.assertIn('Rust red coat.', pf.construir(f, MUNDO_C, 'banner', estacion='invierno')['prompt'])

    def test_precedencia_prompt_variante_estacion_momento_combinada(self):
        f = ficha_c({
            'estacion:invierno': {'pose': 'POSE-ESTACION.', 'cuerpo': 'CUERPO-ESTACION.', 'sujeto': 'SUJETO-ESTACION.',
                                  'rasgos+': ['R-E.']},
            'momento:noche': {'pose': 'POSE-MOMENTO.', 'cuerpo': 'CUERPO-MOMENTO.', 'rasgos+': ['R-M.']},
            'estacion:invierno+momento:noche': {'pose': 'POSE-COMBINADA.'}})
        f['variantes']['hembra']['cuerpo'] = 'CUERPO-VARIANTE.'

        def c(**kw):
            return pf.construir(f, MUNDO_C, 'banner', **kw)['prompt']
        # prompt < variante
        self.assertIn('CUERPO-VARIANTE.', c(variante='hembra'))
        self.assertNotIn('Rust red coat.', c(variante='hembra'))
        # variante < estación
        self.assertIn('SUJETO-ESTACION.', c(variante='hembra', estacion='invierno'))
        self.assertNotIn('A slender beast.', c(variante='hembra', estacion='invierno'))
        self.assertIn('CUERPO-ESTACION.', c(variante='hembra', estacion='invierno'))
        # estación < momento
        p = c(variante='hembra', estacion='invierno', momento='noche')
        self.assertIn('CUERPO-MOMENTO.', p)
        self.assertNotIn('CUERPO-ESTACION.', p)
        # momento < combinada
        self.assertIn('POSE-COMBINADA.', p)
        self.assertNotIn('POSE-MOMENTO.', p)
        # los rasgos+ se acumulan en ese orden
        self.assertIn('Long legs. Black tail. R-E. R-M.', p)
        # sin la combinada manda el momento; con otro momento manda la estación
        self.assertIn('POSE-MOMENTO.', c(estacion='verano', momento='noche'))
        self.assertIn('POSE-ESTACION.', c(estacion='invierno', momento='dia'))

    def test_combinada_solo_con_ambas(self):
        f = ficha_c({'estacion:invierno+momento:noche': {'cuerpo': 'FROST.'}})
        self.assertNotIn('FROST.', pf.construir(f, MUNDO_C, 'banner', estacion='invierno')['prompt'])
        self.assertNotIn('FROST.', pf.construir(f, MUNDO_C, 'banner', momento='noche')['prompt'])
        self.assertIn('FROST.', pf.construir(f, MUNDO_C, 'banner', estacion='invierno', momento='noche')['prompt'])

    def test_condicion_de_momento_cambia_la_luz(self):
        f = ficha_c({'momento:noche': {'luz': 'Stars over the plain.'}})
        p = pf.construir(f, MUNDO_C, 'banner', momento='noche')['prompt']
        self.assertIn('Stars over the plain.', p)
        self.assertNotIn('LUZ-NOCHE.', p)

    def test_momento_de_la_ficha_cuenta_para_las_condiciones(self):
        f = ficha_c({'momento:atardecer': {'cuerpo': 'DUSK-BODY.'}})
        f['momento'] = 'atardecer'
        r = pf.construir(f, MUNDO_C, 'banner')
        self.assertIn('DUSK-BODY.', r['prompt'])
        self.assertEqual(r['condicion'], '-/atardecer')

    def test_valores_desconocidos_son_error_con_los_validos(self):
        m = self.rota(ficha_c(), estacion='monzon')
        self.assertIn('monzon', m)
        for e in ('primavera', 'verano', 'otono', 'invierno'):
            self.assertIn(e, m)
        m = self.rota(ficha_c(), momento='amanecer')
        self.assertIn('amanecer', m)
        for e in ('dia', 'atardecer', 'noche'):
            self.assertIn(e, m)

    def test_clave_de_condicion_invalida_en_la_ficha(self):
        m = self.rota(ficha_c({'momento:amanecer': {'luz': 'X.'}}))
        self.assertIn('momento:amanecer', m)
        self.assertIn('regla 9', m)
        self.assertIn('estacion:', self.rota(ficha_c({'estacion:monzon': {'luz': 'X.'}})))

    def test_json_trae_momento_estacion_y_condicion(self):
        r = pf.construir(ficha_c(), MUNDO_C, 'banner', momento='atardecer', estacion='otono')
        self.assertEqual((r['momento'], r['estacion'], r['condicion']), ('atardecer', 'otono', 'otono/atardecer'))
        self.assertEqual(pf.construir(ficha_c(), MUNDO_C, 'banner', momento='noche')['condicion'], '-/noche')


class Coherencia(unittest.TestCase):
    def rota(self, ficha, **kw):
        with self.assertRaises(pf.ReglaRota) as c:
            pf.construir(ficha, MUNDO_C, 'banner', **kw)
        return str(c.exception)

    def test_noche_con_sol_es_error_con_motivo(self):
        for palabra in ('sun', 'sunlit', 'sunlight', 'daylight', 'midday', 'noon'):
            with self.subTest(palabra):
                m = self.rota(con_prompt(luz=f'The {palabra} falls on the grass.'), momento='noche')
                self.assertIn(f'«{palabra}»', m)
                self.assertIn('regla 9', m)
                self.assertIn('noche', m)
                self.assertIn('cielo de día', m)
                self.assertIn('stars under a soft, even pearly glow', m)

    def test_dia_con_estrellas_es_error_con_motivo(self):
        for palabra in ('star', 'stars', 'starlit', 'night'):
            with self.subTest(palabra):
                m = self.rota(con_prompt(luz=f'A {palabra} over the grass.'), momento='dia')
                self.assertIn(f'«{palabra}»', m)
                self.assertIn('regla 9', m)
                self.assertIn('cielo estrellado en pleno día', m)

    def test_la_condicion_que_arregla_la_luz_evita_el_error(self):
        f = con_prompt(luz='Low sun over the grass.')
        f['condiciones'] = {'momento:noche': {'luz': 'Stars over the grass.'}}
        self.assertIn('Stars over the grass.', pf.construir(f, MUNDO_C, 'banner', momento='noche')['prompt'])
        f['condiciones'] = {}
        self.assertIn('regla 9', self.rota(f, momento='noche'))

    def test_atardecer_no_se_comprueba_y_palabras_parecidas_no_saltan(self):
        pf.construir(con_prompt(luz='A low sun and a star-shaped leaf.'), MUNDO_C, 'banner', momento='atardecer')
        pf.construir(con_prompt(luz='A sunny meadow, a starling and nightfall.'), MUNDO_C, 'banner', momento='dia')
        pf.construir(con_prompt(luz='A sundial stone.'), MUNDO_C, 'banner', momento='noche')

    def test_sin_coherencia_en_el_mundo_no_se_comprueba(self):
        pf.construir(con_prompt(luz='The sun.'), MUNDO, 'banner', momento='noche')

    def test_tambien_en_fondo(self):
        m = self.rota(con_prompt(pose='It stands in the midday heat.'), momento='noche', fondo=ZONA)
        self.assertIn('«midday»', m)
        self.assertIn('regla 9', m)


class FondoConCondicion(unittest.TestCase):
    def test_el_sujeto_recibe_sus_condiciones_y_el_json_dice_la_condicion(self):
        f = ficha_c({'estacion:invierno': {'cuerpo': 'FROSTED-COAT.'}, 'momento:noche': {'pose': 'It prowls in the dark.'}})
        r = pf.construir(f, MUNDO_C, 'banner', estacion='invierno', momento='noche', fondo=ZONA)
        self.assertIn('FROSTED-COAT.', r['prompt'])
        self.assertIn('It prowls in the dark.', r['prompt'])
        self.assertEqual(r['condicion'], 'invierno/noche')
        self.assertEqual((r['momento'], r['estacion']), ('noche', 'invierno'))

    def test_el_prompt_de_fondo_no_cambia_si_el_sujeto_no_tiene_condiciones(self):
        f = ficha_c()
        a = pf.construir(f, MUNDO_C, 'banner', fondo=ZONA)
        b = pf.construir(f, MUNDO_C, 'banner', momento='noche', fondo=ZONA)
        self.assertEqual(a['prompt'], b['prompt'])
        self.assertEqual((a['condicion'], b['condicion']), ('-/dia', '-/noche'))

    def test_cli_estacion_y_atardecer(self):
        d = carpeta()
        mundo, ficha = os.path.join(d, 'm.json'), os.path.join(d, 'f.json')
        escribir(mundo, json.dumps(MUNDO_C))
        escribir(ficha, json.dumps(ficha_c()))
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = pf.main([ficha, 'banner', '--momento', 'atardecer', '--estacion', 'verano', '--json', '--mundo', mundo])
        self.assertEqual(code, 0)
        r = json.loads(out.getvalue())
        self.assertEqual(r['condicion'], 'verano/atardecer')
        self.assertIn('SEASON-VERANO.', r['prompt'])
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(err):
            code = pf.main([ficha, 'banner', '--estacion', 'monzon', '--mundo', mundo])
        self.assertEqual(code, 2)
        self.assertIn('monzon', err.getvalue())


class DatosRealesCondiciones(unittest.TestCase):
    fichas = [('fauna/aullador-rojo', 'macho'), ('fauna/aullador-rojo', 'hembra'), ('flora/cardo-brujula', None),
              ('location/pastos-de-la-deriva', None), ('npc/hulki', None)]

    def test_todas_montan_en_banner_en_los_tres_momentos(self):
        for ruta, variante in self.fichas:
            for mom in ('dia', 'atardecer', 'noche'):
                with self.subTest(ruta=ruta, variante=variante, momento=mom):
                    r = pf.construir(DatosReales.ficha(ruta), _REAL, 'banner', variante=variante, momento=mom)
                    self.assertLessEqual(r['palabras'], _REAL['longitud']['max'])
                    self.assertEqual(r['condicion'], f'-/{mom}')

    def test_pastos_en_las_cuatro_estaciones_y_momentos(self):
        for est in pf.ESTACIONES:
            for mom in ('dia', 'atardecer', 'noche'):
                with self.subTest(estacion=est, momento=mom):
                    r = pf.construir(DatosReales.ficha('location/pastos-de-la-deriva'), _REAL, 'banner', estacion=est,
                                     momento=mom)
                    self.assertLessEqual(r['palabras'], _REAL['longitud']['max'])
                    self.assertEqual(r['condicion'], f'{est}/{mom}')

    def test_cada_ficha_en_cada_estacion(self):
        for ruta, variante in self.fichas:
            for est in pf.ESTACIONES:
                with self.subTest(ruta=ruta, estacion=est):
                    pf.construir(DatosReales.ficha(ruta), _REAL, 'banner', variante=variante, estacion=est)

    def test_la_noche_de_pastos_tiene_estrellas_y_ningun_sol(self):
        p = pf.construir(DatosReales.ficha('location/pastos-de-la-deriva'), _REAL, 'banner', momento='noche')['prompt']
        self.assertIn('Stars', p)
        self.assertFalse(re.search(_REAL['coherencia']['noche']['patron'], p, re.I))
        self.assertNotIn('Low sun', p)

    def test_hierba_de_pastos_siempre_amarillo_pajizo_anaranjado(self):
        for est in pf.ESTACIONES:
            p = pf.construir(DatosReales.ficha('location/pastos-de-la-deriva'), _REAL, 'banner', estacion=est)['prompt']
            self.assertIn('straw-yellow grass tinged with orange', p, est)

    def test_aullador_sobre_pastos_con_condicion(self):
        r = pf.construir(DatosReales.ficha('fauna/aullador-rojo'), _REAL, 'banner', variante='macho', estacion='invierno',
                         momento='noche', fondo=DatosReales.ficha('location/pastos-de-la-deriva'))
        self.assertEqual(r['condicion'], 'invierno/noche')


class ReglasRevision(unittest.TestCase):
    """Hallazgos de la revisión de prompt_ficha.py: cada regla rota dice el motivo, no solo sale con 2."""

    def rota(self, ficha=None, mundo=None, perfil='banner', **kw):
        with self.assertRaises(pf.ReglaRota) as c:
            pf.construir(ficha or ficha_c(), mundo or MUNDO_C, perfil, **kw)
        return str(c.exception)

    # 1. --fondo
    def test_fondo_que_no_es_location_se_rechaza(self):
        zona = dict(ZONA, tipo='fauna')
        m = self.rota(fondo=zona)
        self.assertIn('location', m)
        self.assertIn('fauna', m)
        self.assertNotIn('In this ,', m)

    def test_fondo_sin_lugar_o_con_lugar_vacio_se_rechaza(self):
        for prompt in ({}, {'lugar': ''}, {'lugar': '  '}):
            with self.subTest(prompt=prompt):
                self.assertIn('prompt.lugar', self.rota(fondo=dict(ZONA, prompt=prompt)))

    # 2. claves combinadas
    def test_clave_combinada_solo_en_forma_canonica(self):
        for clave in ('momento:noche+estacion:invierno', 'estacion:verano+estacion:invierno',
                      'momento:dia+momento:noche', 'estacion:verano+momento:dia+momento:noche',
                      'estacion:verano+momento:dia+estacion:invierno', 'estacion:verano+'):
            with self.subTest(clave=clave):
                m = self.rota(ficha_c({clave: {'pose': 'x'}}))
                self.assertIn(f'«{clave}»', m)
                self.assertIn('estacion:<e>+momento:<m>', m)

    def test_clave_combinada_canonica_vale_y_se_aplica(self):
        f = ficha_c({'estacion:invierno+momento:noche': {'pose': 'COMBINADA.'}})
        self.assertIn('COMBINADA.', pf.construir(f, MUNDO_C, 'banner', estacion='invierno', momento='noche')['prompt'])

    # 3. campos de prompt
    def test_clave_de_variante_o_condicion_desconocida(self):
        f = ficha_c({'momento:noche': {'poze': 'x'}})
        m = self.rota(f, momento='noche')
        self.assertIn('«poze»', m)
        self.assertIn('no es un campo de prompt', m)
        f = ficha_c()
        f['variantes'] = {'cria': {'tamano': 'small'}}
        self.assertIn('«tamano»', self.rota(f))  # aunque no se pida esa variante
        f['variantes'] = {'cria': {'pelo+': ['x']}}
        self.assertIn('«pelo+»', self.rota(f))

    def test_campos_conocidos_con_mas_valen(self):
        f = ficha_c({'momento:noche': {'rasgos+': ['MAS.'], 'lugar': 'x'}})
        self.assertIn('MAS.', pf.construir(f, MUNDO_C, 'banner', momento='noche')['prompt'])

    # 4. región
    def test_region_desconocida(self):
        f = ficha_c()
        f['region'] = 'Atlantida'
        m = self.rota(f)
        self.assertIn('región desconocida «Atlantida»', m)
        self.assertIn('R', m)

    # 5. nombres propios con palabra entera
    def test_nombre_propio_solo_como_palabra_entera(self):
        f = con_prompt(pose='It scratches the ashes.')
        f['nombre'] = 'Ash'
        self.assertIn('ashes', montar(f)['prompt'])
        f = con_prompt(pose='It scratches the ash.')
        f['nombre'] = 'Ash'
        self.assertIn('el nombre «Ash»', self.rota(f, mundo=MUNDO))
        f = con_prompt(pose='It follows Ash, closely.')
        f['nombre'] = 'Ash'
        self.assertIn('el nombre «Ash»', self.rota(f, mundo=MUNDO))

    # 6. mapa solo con location
    def test_mapa_solo_con_location(self):
        m = self.rota(ficha_c(), perfil='mapa')
        self.assertIn('«mapa» solo vale con fichas de tipo location', m)
        self.assertIn('fauna', m)
        self.assertIn('Painterly realism.', pf.construir(dict(ZONA, tipo='location'), MUNDO_C, 'mapa')['prompt'])
        for perfil in ('banner', 'icono', 'thumbnail'):
            pf.construir(ficha_c(), MUNDO_C, perfil)  # los demás perfiles no cambian

    # 7. luz vacía
    def test_luz_vacia_quita_b6_y_ausente_usa_la_de_la_region(self):
        self.assertIn('LUZ-NOCHE.', pf.construir(ficha_c(), MUNDO_C, 'banner', momento='noche')['prompt'])
        for f in (ficha_c(luz=''), ficha_c({'momento:noche': {'luz': ''}})):
            r = pf.construir(f, MUNDO_C, 'banner', momento='noche')
            self.assertNotIn('LUZ-', r['prompt'])
            self.assertEqual(r['recortados'], [])

    # 8. estación del motor
    def test_estacion_del_enum_del_motor(self):
        for motor, interna in (('PRIMAVERA', 'primavera'), ('VERANO', 'verano'), ('OTONO', 'otono'),
                               ('INVIERNO', 'invierno')):
            with self.subTest(motor):
                r = pf.construir(ficha_c(), MUNDO_C, 'banner', estacion=motor)
                self.assertEqual(r['estacion'], interna)
                self.assertEqual(r['condicion'], f'{interna}/dia')
                self.assertIn(f'SEASON-{motor}.', r['prompt'])
        self.assertIn('«OTOÑO»', self.rota(estacion='OTOÑO'))

    # 9. palabra de estilo en mundo.json
    def test_palabra_de_estilo_sale_de_mundo_json(self):
        mundo = copy.deepcopy(MUNDO_C)
        mundo['estilos']['banner']['palabra'] = 'RETRATO'
        mundo['estilos']['icono']['palabra'] = 'OLEO'
        self.assertTrue(pf.construir(ficha_c(), mundo, 'banner', fondo=ZONA)['prompt'].endswith('It matches the RETRATO style.'))
        for perfil in ('icono', 'thumbnail'):  # thumbnail es alias de icono
            self.assertTrue(pf.construir(ficha_c(), mundo, perfil, fondo=ZONA)['prompt'].endswith('It matches the OLEO style.'))
        del mundo['estilos']['banner']['palabra']
        self.assertIn('`palabra`', self.rota(mundo=mundo, fondo=ZONA))

    def test_palabras_reales(self):
        self.assertEqual({k: _REAL['estilos'][k].get('palabra') for k in ('banner', 'icono', 'mapa')},
                         {'banner': 'photographic', 'icono': 'painterly', 'mapa': 'painterly'})


if __name__ == '__main__':
    unittest.main()
