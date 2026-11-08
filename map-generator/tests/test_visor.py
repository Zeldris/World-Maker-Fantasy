"""MAP-5: el visor local se sirve sin red, solo con sus rutas, y con las mismas medidas que el test del canon."""
import json
import os
import re
import sys
import threading
import unittest
import urllib.error
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))

import geometria  # noqa: E402
import medir  # noqa: E402
import servir  # noqa: E402


class Visor(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = servir.servidor(0)
        cls.url = f'http://127.0.0.1:{cls.srv.server_address[1]}'
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.mundo = medir.cargar()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()

    def _get(self, ruta):
        with urllib.request.urlopen(self.url + ruta, timeout=30) as r:
            return r.read()

    def test_escucha_solo_en_local(self):
        self.assertEqual(self.srv.server_address[0], '127.0.0.1')

    def test_sirve_el_visor_y_el_mapa(self):
        self.assertIn(b'Visor de Helek Sirik', self._get('/'))
        self.assertEqual(json.loads(self._get('/helek.json'))['formato'], self.mundo['formato'])

    def test_no_sirve_nada_mas_del_disco(self):
        for ruta in ('/servir.py', '/mundo/helek.json', '/../canon.json', '/visor/index.html', '/%2e%2e/medir.py'):
            with self.subTest(ruta=ruta), self.assertRaises(urllib.error.HTTPError) as e:
                self._get(ruta)
            self.assertEqual(e.exception.code, 404)
            self.assertIn('solo sirve', e.exception.reason)

    def test_el_visor_no_pide_nada_externo(self):
        html = self._get('/').decode('utf-8')
        externos = re.findall(r'''(?:src|href)\s*=\s*["']?(?:https?:)?//|fetch\(\s*["'](?:https?:)?//|@import''', html)
        self.assertEqual(externos, [])
        self.assertEqual(sorted(set(re.findall(r'''fetch\(\s*'([^']+)'\)''', html))), ['helek.json', 'medidas.json'])

    def test_las_medidas_son_las_del_canon(self):
        med = json.loads(self._get('/medidas.json'))
        for e in self.mundo['regiones']:
            polis = medir.poligonos_de(self.mundo, {'region': e['nombre']})
            with self.subTest(region=e['nombre']):
                self.assertAlmostEqual(med['regiones'][str(e['i'])]['area'], geometria.area(polis), places=3)
                self.assertEqual(med['regiones'][str(e['i'])]['envolvente'], list(geometria.envolvente(polis)))
        self.assertEqual(set(med['provincias']), {str(p['i']) for p in self.mundo['provincias']})
        self.assertEqual(set(med['continentes']), {str(c['i']) for c in self.mundo['continentes']})
        with open(medir.CANON, encoding='utf-8') as f:
            canon = json.load(f)
        self.assertEqual([(e['medido'], e['dentro']) for e in med['canon']],
                         [(m, ok) for _, m, ok in medir.comprobar(self.mundo, canon)])

    def test_la_caja_de_berig_encierra_sus_celdas(self):
        x0, y0, x1, y1 = json.loads(self._get('/medidas.json'))['continentes']['3']['caja']
        for c in self.mundo['celdas']:
            if c['continente'] == 3 and c['h'] >= 20:
                self.assertTrue(x0 <= c['p'][0] <= x1 and y0 <= c['p'][1] <= y1, c['i'])


if __name__ == '__main__':
    unittest.main()
