"""VOZ-3, VOZ-4: voice-generator/scripts/voces.py (ficha de diseño → --instruct, efectos → SoX, `comprobar`).

El motor (qwentts.cpp) solo corre en la Deck; lo que se prueba aquí son los datos que le llegan.
"""
import contextlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

from comun import RAIZ, escribir, leer

sys.path.insert(0, os.path.join(RAIZ, 'voice-generator', 'scripts'))
import voces  # noqa: E402

FICHA = {'gender': 'male', 'age': 'adult', 'pitch': 'low', 'speed': 'moderate', 'volume': 'loud', 'clarity': 'clear',
         'fluency': 'steady, few pauses', 'accent': 'neutral', 'texture': 'rough gravelly', 'emotion': 'determined',
         'tone': 'gruff', 'personality': 'direct and blunt', 'semilla': 11, 'texto_prueba': 'Hola.'}


class Instruct(unittest.TestCase):
    def test_las_12_claves_en_orden_con_sufijos_y_sin_comas_internas(self):
        self.assertEqual(voces.instruct(FICHA),
                         'male, adult, low pitch, moderate speed, loud volume, clear, steady few pauses, neutral accent, '
                         'rough gravelly texture, determined, gruff tone, direct and blunt personality')


class Sox(unittest.TestCase):
    def test_tono_en_centesimas_valores_por_defecto_y_capa_saltada(self):
        avisos = []
        args = voces.sox({'cadena': [{'tipo': 'tono', 'semitonos': -2.5}, {'tipo': 'graves', 'db': 5},
                                     {'tipo': 'capa', 'sonido': 'gruñido'}, {'tipo': 'paso_alto', 'hz': 300}]},
                         avisos.append)
        self.assertEqual(args, ['pitch', '-250', 'bass', '5', '100', 'highpass', '300'])
        self.assertEqual(len(avisos), 1)
        self.assertIn('capa', avisos[0])

    def test_sin_efectos_no_da_argumentos(self):
        self.assertEqual(voces.sox({'cadena': []}), [])


class Ficha(unittest.TestCase):
    def test_la_buena_no_tiene_errores(self):
        self.assertEqual(voces.errores_ficha(FICHA), [])

    def test_edad_infantil(self):
        err = voces.errores_ficha({**FICHA, 'age': 'teenager'})
        self.assertTrue(any('no es adulta' in e for e in err), err)

    def test_palabra_prohibida_entera(self):
        err = voces.errores_ficha({**FICHA, 'texture': 'bright and airy'})
        self.assertTrue(any('«bright»' in e for e in err), err)
        # «lightly» no es «light»: solo palabras enteras.
        self.assertEqual(voces.errores_ficha({**FICHA, 'texture': 'lightly rough'}), [])

    def test_tono_agudo(self):
        for tono in ('high', 'fairly high', 'medium-high', 'higher'):
            err = voces.errores_ficha({**FICHA, 'pitch': tono})
            self.assertTrue(any('tono agudo' in e for e in err), (tono, err))

    def test_formas_de_las_palabras_prohibidas(self):
        for clave, valor, palabra in (('texture', 'youthful', 'youth'), ('personality', 'childish', 'child'),
                                      ('tone', 'younger', 'young'), ('emotion', 'teenage angst', 'teen')):
            err = voces.errores_ficha({**FICHA, clave: valor})
            self.assertTrue(any(f'«{palabra}» en «{clave}»' in e for e in err), (valor, err))

    def test_edad_negada(self):
        for edad in ('non-adult', 'not adult', 'pre-adult'):
            err = voces.errores_ficha({**FICHA, 'age': edad})
            self.assertTrue(any('no es adulta' in e for e in err), (edad, err))

    def test_ficha_que_no_es_objeto(self):
        self.assertEqual(voces.errores_ficha([]), ['la ficha tiene que ser un objeto JSON'])

    def test_falta_clave_clave_desconocida_y_semilla_no_entera(self):
        ficha = {k: v for k, v in FICHA.items() if k != 'accent'}
        err = voces.errores_ficha({**ficha, 'acento': 'neutral', 'semilla': '11'})
        self.assertIn('falta «accent»', err)
        self.assertIn('clave desconocida «acento»', err)
        self.assertIn('«semilla» tiene que ser un número entero', err)


class Cadena(unittest.TestCase):
    def test_tipo_y_parametro_desconocidos_falta_obligatorio_y_no_numero(self):
        err = voces.errores_cadena({'cadena': [{'tipo': 'flanger'}, {'tipo': 'graves', 'db': 'mucho', 'q': 1},
                                               {'tipo': 'paso_bajo'}]})
        self.assertTrue(any('tipo desconocido «flanger»' in e for e in err), err)
        self.assertTrue(any('parámetro desconocido «q»' in e for e in err), err)
        self.assertTrue(any('«db» tiene que ser un número' in e for e in err), err)
        self.assertTrue(any('(paso_bajo): falta «hz»' in e for e in err), err)

    def test_sin_lista(self):
        self.assertEqual(voces.errores_cadena({}), ['falta la lista «cadena»'])
        self.assertEqual(voces.errores_cadena([]), ['falta la lista «cadena»'])

    def test_efecto_que_no_es_objeto(self):
        self.assertEqual(voces.errores_cadena({'cadena': ['tono']}), ['efecto 1: tiene que ser un objeto con «tipo»'])


class Ordenes(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix='qa-voces-')
        self.addCleanup(shutil.rmtree, self.dir)

    def test_semilla_cambia_solo_la_semilla(self):
        ruta = os.path.join(self.dir, 'diseno.json')
        escribir(ruta, json.dumps(FICHA, ensure_ascii=False, indent=2))
        self.assertEqual(voces.main(['voces.py', 'semilla', ruta, '33']), 0)
        self.assertEqual(json.loads(leer(ruta)), {**FICHA, 'semilla': 33})

    def test_semilla_sin_campo_aborta(self):
        ruta = os.path.join(self.dir, 'diseno.json')
        escribir(ruta, '{}')
        salida = io.StringIO()
        with contextlib.redirect_stderr(salida):
            self.assertEqual(voces.main(['voces.py', 'semilla', ruta, '33']), 1)
        self.assertIn('no tiene una «semilla» que cambiar', salida.getvalue())

    def voz(self, raza, voz='v1', texto='Hola.', efectos=True):
        d = os.path.join(self.dir, 'voces', raza)
        if efectos:
            escribir(os.path.join(d, 'efectos.json'), '{"cadena": []}')
        escribir(os.path.join(d, voz, 'diseno.json'), json.dumps(FICHA))
        escribir(os.path.join(d, voz, 'referencia.txt'), texto + '\n')

    def test_comprobar_carpeta_buena(self):
        self.voz('orcos')
        self.voz('narrador', 'principal', efectos=False)
        self.assertEqual(voces.comprobar(self.dir), [])

    def test_comprobar_raza_desconocida_sin_efectos_y_referencia_distinta(self):
        self.voz('dragones')
        self.voz('goirntes', efectos=False, texto='Otra cosa.')
        fallos = voces.comprobar(self.dir)
        self.assertIn('voces/dragones: no es un slug de BERIG_RAZAS ni «narrador»', fallos)
        self.assertIn('voces/goirntes: falta efectos.json', fallos)
        self.assertIn('voces/goirntes/v1: referencia.txt no dice lo mismo que «texto_prueba»', fallos)

    def test_comprobar_fauna_mal(self):
        escribir(os.path.join(self.dir, 'fauna', 'x', 'cadena.json'), '{"cadena": [{"tipo": "tono"}]}')
        self.assertEqual(voces.comprobar(self.dir), ['fauna/x/cadena.json: efecto 1 (tono): falta «semitonos»'])

    def test_razas_solo_de_primer_nivel_de_berig_razas(self):
        razas = voces.razas()
        self.assertTrue({'orcos', 'goirntes', 'nabieus', 'faerus', 'narrador'} <= razas, razas)
        # Los slugs de BERIG_PERSONAJES, detrás del array, no son razas.
        self.assertNotIn('riko', razas)

    def test_las_fichas_reales_estan_bien(self):
        self.assertEqual(voces.comprobar(), [])

    def test_comprobar_ficha_que_no_es_objeto(self):
        self.voz('orcos')
        escribir(os.path.join(self.dir, 'voces', 'orcos', 'v1', 'diseno.json'), '[]')
        self.assertEqual(voces.comprobar(self.dir), ['voces/orcos/v1/diseno.json: la ficha tiene que ser un objeto JSON'])


class Lanzar(unittest.TestCase):
    def test_la_orden_recibe_la_entrada_redirigida(self):
        # qwen-tts lee el texto por stdin: `lanzar <log> qwen-tts … < frase.txt` en segundo plano no lo perdía.
        with tempfile.TemporaryDirectory(prefix='qa-lanzar-') as d:
            escribir(os.path.join(d, 'frase.txt'), 'El viento trae ceniza.\n')
            comun = os.path.join(RAIZ, 'voice-generator', 'scripts', 'comun.sh')
            r = subprocess.run(['bash', '-c', f'. "{comun}"; MIN_VIGILA_MB=0; lanzar "$1/log" cat < "$1/frase.txt"', '_', d],
                               capture_output=True, text=True, timeout=30)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertEqual(leer(os.path.join(d, 'log')), 'El viento trae ceniza.\n')


if __name__ == '__main__':
    unittest.main()
