"""MAP-4: el juego lee las fronteras de helek.json, y el archivo exportado no se queda atrás del mapa."""
import contextlib
import copy
import io
import os
import re
import sys
import unittest
from unittest import mock

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))

import exportar  # noqa: E402
import medir  # noqa: E402

MAPA_TSX = os.path.join(os.path.dirname(os.path.dirname(AQUI)), 'frontend', 'src', 'components', 'panels',
                        'InteractiveMap.tsx')


def _comprobar():
    err = io.StringIO()
    with contextlib.redirect_stderr(err), contextlib.redirect_stdout(io.StringIO()):
        codigo = exportar.main(['--comprobar'])
    return codigo, err.getvalue()


class Exportar(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mundo = medir.cargar()

    def test_el_archivo_del_juego_esta_al_dia(self):
        codigo, err = _comprobar()
        self.assertEqual(codigo, 0, err)

    def test_mover_una_frontera_deja_el_archivo_desfasado(self):
        mundo = copy.deepcopy(self.mundo)
        llanuras = [c for c in mundo['celdas'] if c['region'] == 18]
        for c in llanuras[:20]:
            c['region'] = 19
        with mock.patch.object(exportar.medir, 'cargar', return_value=mundo):
            codigo, err = _comprobar()
        self.assertEqual(codigo, 1)
        self.assertIn('no es lo que sale de helek.json', err)

    def test_las_regiones_del_juego_existen_en_el_mapa(self):
        # InteractiveMap.tsx nombra cada región por su id de helek.json: un id que no está la dejaría sin dibujar.
        with open(MAPA_TSX, encoding='utf-8') as f:
            tsx = f.read()
        bloque = re.search(r'const ETIQUETAS_REGION[^=]*= \{(.*?)\n\}', tsx, re.S).group(1)
        ids = {int(i) for i in re.findall(r'^\s*(\d+): \{ name:', bloque, re.M)}
        self.assertEqual(ids, {r['i'] for r in self.mundo['regiones']})

    def test_cada_contorno_cierra_y_esta_en_el_lienzo(self):
        ancho, alto = self.mundo['fuente']['ancho'], self.mundo['fuente']['alto']
        for r in exportar.regiones(self.mundo):
            self.assertTrue(r['d'].startswith('M') and r['d'].endswith('Z'), r['nombre'])
            b = r['bbox']
            self.assertTrue(0 <= b['x0'] < b['x1'] <= ancho and 0 <= b['y0'] < b['y1'] <= alto, r['nombre'])


if __name__ == '__main__':
    unittest.main()
