"""MAP-1: el importador reconstruye las celdas de FMG índice a índice y falla con su motivo si no puede."""
import contextlib
import io
import json
import os
import random
import sys
import tempfile
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))

import importar  # noqa: E402
from fmg import archivo as A  # noqa: E402
from fmg.delaunator import Delaunator  # noqa: E402


def _mapa_alterado(cambio):
    """Copia temporal del .map con `cambio(registros)` aplicado; devuelve su ruta."""
    with open(importar.MAPA, encoding='utf-8') as f:
        datos = A.separar(f.read())
    cambio(datos)
    tmp = tempfile.NamedTemporaryFile('w', suffix='.map', delete=False, encoding='utf-8')
    tmp.write('\r\n'.join(datos))
    tmp.close()
    return tmp.name


def _correr(argv):
    err = io.StringIO()
    with contextlib.redirect_stderr(err), contextlib.redirect_stdout(io.StringIO()):
        codigo = importar.main(argv)
    return codigo, err.getvalue()


class Importar(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mundo, _, _, cls.revisar = importar.importar(importar.MAPA)

    def test_celdas_y_capas_del_mapa_de_la_usuaria(self):
        m = self.mundo
        self.assertEqual(len(m['celdas']), 5120)
        self.assertEqual(sorted(c['nombre'] for c in m['continentes']), ['Berig', 'Vaelira'])
        self.assertEqual([r['nombre'] for r in m['regiones']],
                         ['Cristal Helado', 'Llanuras del Viento Rojo', 'Ciénaga Troncal', 'El Margen Silencioso',
                          'La Meseta del Orden'])
        self.assertEqual(len(m['lugares']), 5)
        self.assertTrue(all(r['region'] == 18 for r in m['provincias']))
        # El agua (h < 20) es siempre bioma marino: los arrays del .map están alineados con las celdas.
        self.assertTrue(all((c['h'] < 20) == (c['bioma'] == 0) for c in m['celdas']))

    def test_lo_automatico_va_a_revisar_y_no_al_mapa(self):
        self.assertEqual(len(self.revisar['marcadores']), 40)
        self.assertEqual(self.revisar['burgsBorradosEnAzgaar'], 610)
        nombres = {lu['nombre'] for lu in self.mundo['lugares']}
        self.assertFalse(nombres & {mk['nombre'] for mk in self.revisar['marcadores']})

    def test_salida_estable(self):
        # Dos importaciones dan el mismo texto: el diff de git solo enseña cambios de verdad.
        otra, _, _, _ = importar.importar(importar.MAPA)
        self.assertEqual(importar.volcar(self.mundo), importar.volcar(otra))
        json.loads(importar.volcar(self.mundo))

    def test_otra_version_de_fmg_falla_con_su_motivo(self):
        def cambio(d):
            d[A.PARAMS] = d[A.PARAMS].replace('1.137.6', '1.140.0', 1)
        ruta = _mapa_alterado(cambio)
        try:
            with tempfile.TemporaryDirectory() as salida:
                codigo, err = _correr(['--map', ruta, '--salida', salida])
                self.assertEqual(os.listdir(salida), [])
        finally:
            os.unlink(ruta)
        self.assertEqual(codigo, 1)
        self.assertIn('FMG 1.140.0', err)
        self.assertIn('solo conoce la 1.137.6', err)

    def test_si_las_celdas_no_cuadran_con_fmg_no_escribe_nada(self):
        def cambio(d):
            estados = json.loads(d[A.ESTADOS])
            estados[18]['area'] += 1
            d[A.ESTADOS] = json.dumps(estados)
        ruta = _mapa_alterado(cambio)
        try:
            with tempfile.TemporaryDirectory() as salida:
                codigo, err = _correr(['--map', ruta, '--salida', salida])
                self.assertEqual(os.listdir(salida), [])
        finally:
            os.unlink(ruta)
        self.assertEqual(codigo, 1)
        self.assertIn('Llanuras del Viento Rojo: FMG guardó 19808 km²', err)


class DelaunayVacio(unittest.TestCase):
    def test_ningun_punto_dentro_del_circulo_de_un_triangulo(self):
        rnd = random.Random(7)
        pts = [(rnd.uniform(0, 100), rnd.uniform(0, 100)) for _ in range(150)]
        d = Delaunator(pts)
        self.assertEqual(len(d.triangles) // 3, 2 * len(pts) - 2 - len(d.hull))
        for t in range(len(d.triangles) // 3):
            a, b, c = (pts[d.triangles[3 * t + k]] for k in range(3))
            for k, p in enumerate(pts):
                if k in d.triangles[3 * t:3 * t + 3]:
                    continue
                # p está dentro del círculo si el determinante tiene el signo del giro del triángulo.
                giro = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
                ax, ay, bx, by, cx, cy = a[0] - p[0], a[1] - p[1], b[0] - p[0], b[1] - p[1], c[0] - p[0], c[1] - p[1]
                det = ((ax * ax + ay * ay) * (bx * cy - cx * by) - (bx * bx + by * by) * (ax * cy - cx * ay)
                       + (cx * cx + cy * cy) * (ax * by - bx * ay))
                self.assertLessEqual(det * giro, 1e-6, f'punto {k} dentro del círculo del triángulo {t}')


if __name__ == '__main__':
    unittest.main()
