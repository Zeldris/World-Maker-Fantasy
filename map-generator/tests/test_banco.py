"""MAP-16: el agente del banco solo ejecuta consultar.py y editar.py, y siempre sobre su copia."""
import json
import os
import shutil
import sys
import tempfile
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))
sys.path.insert(0, os.path.join(os.path.dirname(AQUI), 'banco'))

import agente_local  # noqa: E402
import medir  # noqa: E402

GEOJSON = os.path.join(os.path.dirname(medir.MUNDO), 'helek.geojson')


def _leer(ruta):
    with open(ruta, 'rb') as f:
        return f.read()


class Ejecutar(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.mundo = os.path.join(self.dir, 'helek.json')
        shutil.copy(medir.MUNDO, self.mundo)
        shutil.copy(GEOJSON, os.path.join(self.dir, 'helek.geojson'))
        self.juego = _leer(medir.MUNDO)

    def tearDown(self):
        shutil.rmtree(self.dir)
        self.assertEqual(_leer(medir.MUNDO), self.juego, 'el mapa del juego no se toca')

    def test_rechaza_lo_que_no_es_del_mapa(self):
        for orden in ('ls -la', 'bash -c "rm -rf /"', 'importar.py --sobrescribir', '../editar.py', 'python3 x.py'):
            salida, codigo = agente_local.ejecutar(orden, None, self.dir)
            self.assertEqual(codigo, 2, orden)
            self.assertIn('solo se permiten', salida)

    def test_rechaza_otro_mundo(self):
        salida, codigo = agente_local.ejecutar('editar.py - --mundo mundo/helek.json --guardar', '{}', self.dir)
        self.assertEqual(codigo, 2)
        self.assertIn('--mundo no se puede usar', salida)

    def test_guarda_en_la_copia(self):
        m = medir.cargar(self.mundo)
        berig = next(k['i'] for k in m['continentes'] if k['nombre'] == 'Berig')
        c = next(c for c in m['celdas'] if c['h'] >= 25 and c['continente'] not in (0, berig))
        lote = json.dumps({'alturas': [[c['i'], c['h'] + 1]]})
        salida, codigo = agente_local.ejecutar('python3 editar.py - --guardar', lote, self.dir)
        self.assertEqual(codigo, 0, salida)
        self.assertEqual(next(x for x in medir.cargar(self.mundo)['celdas'] if x['i'] == c['i'])['h'], c['h'] + 1)


if __name__ == '__main__':
    unittest.main()
