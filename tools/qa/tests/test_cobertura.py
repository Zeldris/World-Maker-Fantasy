"""QA-242: `tools/roadmap/cobertura.py --fila <ID>`, sobre una copia con roadmaps de prueba."""
import os
import shutil
import subprocess
import unittest

from comun import RAIZ, carpeta, escribir

ROADMAPS = ['roadmap-front.md', 'roadmap-front-ux.md', 'roadmap-front-zona.md', 'roadmap-front-reino.md',
            'roadmap-cronista.md', 'roadmap-imagenes.md', 'roadmap-voces.md']
MAPA = '''# Roadmap

Mapa: `QA-2` sigue abierta. ''' + 'x' * 300 + '''

### Qué entra en cada hito

| Hito | Qué |
|---|---|
| **`0.1` Uno** | `QA-1`…`QA-4` |
| **`0.2` Dos** | `QA-2` |

### Dependencias que mandan el orden
'''


class Fila(unittest.TestCase):
    def setUp(self):
        self.dir = carpeta()
        os.makedirs(os.path.join(self.dir, 'tools', 'roadmap'))
        shutil.copy(os.path.join(RAIZ, 'tools', 'roadmap', 'cobertura.py'), os.path.join(self.dir, 'tools', 'roadmap'))
        producto = os.path.join(self.dir, 'docs', 'producto')
        for f in ROADMAPS:
            escribir(os.path.join(producto, f), '')
        escribir(os.path.join(producto, 'roadmap-front.md'),
                 '# QA\n\n- **QA-1 · Uno**\n- **QA-2 · Dos**\n- **QA-3 · Tres**\n- **QA-20 · Veinte** (no es `QA-2`)\n')
        escribir(os.path.join(producto, '21-roadmap.md'), MAPA)

    def fila(self, *args):
        return subprocess.run(['python3', os.path.join(self.dir, 'tools', 'roadmap', 'cobertura.py'), '--fila', *args],
                              capture_output=True, text=True)

    def test_tarea_de_un_rango(self):
        # QA-3 solo está dentro de `QA-1`…`QA-4`: no sale como mención, pero sí la fila de su hito.
        r = self.fila('QA-3')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(r.stdout.splitlines(), ['roadmap-front.md:5: - **QA-3 · Tres**', 'hito: 0.1 (21-roadmap.md:9)'])

    def test_tarea_en_dos_hitos_con_menciones_recortadas(self):
        lineas = self.fila('QA-2').stdout.splitlines()
        self.assertEqual(lineas[:2], ['roadmap-front.md:4: - **QA-2 · Dos**', 'hito: 0.1, 0.2 (21-roadmap.md:9, 10)'])
        # QA-20 no cuenta como QA-2; la línea larga sale recortada.
        self.assertEqual(lineas[2], '21-roadmap.md:3: Mapa: `QA-2` sigue abierta. ' + 'x' * 83 + '…')
        self.assertEqual(lineas[3], '21-roadmap.md:10: | **`0.2` Dos** | `QA-2` |')
        self.assertEqual(len(lineas), 4)

    def test_tarea_que_no_existe(self):
        r = self.fila('QA-9')
        self.assertEqual(r.returncode, 1)
        self.assertEqual(r.stdout.splitlines(), ['QA-9: no está definida en ningún roadmap', 'hito: SIN HITO'])

    def test_sin_id(self):
        r = self.fila()
        self.assertEqual(r.returncode, 1)
        self.assertIn('uso: cobertura.py --fila <ID>', r.stderr)


if __name__ == '__main__':
    unittest.main()
