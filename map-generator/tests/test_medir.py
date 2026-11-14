"""MAP-2: el mapa propio respeta las medidas del canon, y una frontera movida hace fallar el test."""
import contextlib
import copy
import io
import json
import os
import sys
import tempfile
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))

import geometria  # noqa: E402
import medir  # noqa: E402


def _canon():
    with open(medir.CANON, encoding='utf-8') as f:
        return json.load(f)


class Canon(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mundo = medir.cargar()

    def test_helek_json_respeta_el_canon(self):
        fuera = [(e, m) for e, m, ok in medir.comprobar(self.mundo, _canon()) if not ok]
        self.assertEqual(fuera, [], 'medidas fuera del canon: lo que las mueva lo decide la usuaria')

    def test_mover_una_frontera_hace_fallar(self):
        # Un tercio de las celdas de las Llanuras pasa a la Ciénaga: el área y la envolvente se salen.
        mundo = copy.deepcopy(self.mundo)
        llanuras = [c for c in mundo['celdas'] if c['region'] == 18]
        for c in llanuras[: len(llanuras) // 3]:
            c['region'] = 19
        fuera = {(e['que'], e.get('region')) for e, _, ok in medir.comprobar(mundo, _canon()) if not ok}
        self.assertIn(('area', 'Llanuras del Viento Rojo'), fuera)
        with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as tmp:
            json.dump(mundo, tmp)
        try:
            err = io.StringIO()
            with contextlib.redirect_stderr(err), contextlib.redirect_stdout(io.StringIO()):
                codigo = medir.main(['--mundo', tmp.name])
        finally:
            os.unlink(tmp.name)
        self.assertEqual(codigo, 1)
        self.assertIn('fuera de ±3% del canon', err.getvalue())


class Geometria(unittest.TestCase):
    # Cuatro celdas cuadradas de 10 km en un bloque de 2 × 2; vértices en antihorario (y hacia abajo).
    VERTICES = [[x, y] for y in (0, 10, 20) for x in (0, 10, 20)]
    CELDAS = [[0, 3, 4, 1], [1, 4, 5, 2], [3, 6, 7, 4], [4, 7, 8, 5]]

    def test_area_y_envolvente_de_un_bloque(self):
        polis = geometria.poligonos(self.CELDAS, self.VERTICES, [0, 1, 2, 3])
        self.assertEqual(len(polis), 1)
        self.assertEqual(geometria.area(polis), 400)
        self.assertEqual(geometria.envolvente(polis), (20, 20))

    def test_dos_trozos_separados(self):
        polis = geometria.poligonos(self.CELDAS, self.VERTICES, [0, 3])
        self.assertEqual(geometria.area(polis), 200)


if __name__ == '__main__':
    unittest.main()
