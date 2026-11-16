"""QA-370: `tools/roadmap/ver.py` imprime la entrada de una tarea de los roadmaps de WMF (viñetas, no tablas)."""
import os
import subprocess
import unittest

from comun import RAIZ, carpeta, escribir

SCRIPT = os.path.join(RAIZ, 'tools', 'roadmap', 'ver.py')

ROADMAP = """# Roadmap

- **QA-5 · Abierta** (motivo): primera línea
  y su continuación.
- ~~**QA-50 · Cerrada**~~ ✅ 2026-11-16: hecho.

- **QA-500 · Otra**: no es QA-50.
"""


class VerRoadmap(unittest.TestCase):
    def setUp(self):
        self.raiz = carpeta()
        escribir(os.path.join(self.raiz, 'docs', 'producto', 'roadmap-x.md'), ROADMAP)
        escribir(os.path.join(self.raiz, 'docs', 'producto', '21-roadmap.md'), '- **QA-5 · en el mapa no cuenta**\n')

    def correr(self, *args):
        return subprocess.run(['python3', SCRIPT, *args], capture_output=True, text=True,
                              env={**os.environ, 'VER_RAIZ': self.raiz})

    def test_abierta_con_continuacion(self):
        r = self.correr('QA-5')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(r.stdout, 'docs/producto/roadmap-x.md:3: - **QA-5 · Abierta** (motivo): primera línea\n'
                                   '  y su continuación.\n')

    def test_cerrada_sin_confundir_prefijos(self):
        r = self.correr('QA-50')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn(':5: - ~~**QA-50 · Cerrada**', r.stdout)
        self.assertNotIn('QA-500', r.stdout)

    def test_que_no_existe_sale_con_1_y_lo_dice(self):
        r = self.correr('QA-5', 'QA-9')
        self.assertEqual(r.returncode, 1)
        self.assertIn('QA-9: no está definida', r.stderr)
        self.assertIn('QA-5 · Abierta', r.stdout)


if __name__ == '__main__':
    unittest.main()
