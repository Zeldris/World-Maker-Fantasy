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

Otras: `QA-20`, `QA-2b`, `XQA-2`, `QA-5`.
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
                 '# QA\n\n- **QA-1 · Uno**\n- **QA-2 · Dos**\n- **QA-3 · Tres**\n- **QA-20 · Veinte** (no es `QA-2`)\n- **QA-5 · Cinco**\n')
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
        self.assertEqual(lineas[:2], ['roadmap-front.md:4: - **QA-2 · Dos**',
                                      'hito: 0.1 (21-roadmap.md:9), 0.2 (21-roadmap.md:10)'])
        # La línea larga sale recortada; la fila del hito no se repite y `QA-20`, `QA-2b` y `XQA-2` no son QA-2.
        self.assertEqual(lineas[2:], ['21-roadmap.md:3: Mapa: `QA-2` sigue abierta. ' + 'x' * 83 + '…'])

    def test_tarea_sin_hito_sale_con_1(self):
        r = self.fila('QA-5')
        self.assertEqual(r.returncode, 1)
        self.assertEqual(r.stdout.splitlines(), ['roadmap-front.md:7: - **QA-5 · Cinco**', 'hito: SIN HITO',
                                                 '21-roadmap.md:14: Otras: `QA-20`, `QA-2b`, `XQA-2`, `QA-5`.'])

    def test_tarea_que_no_existe(self):
        r = self.fila('QA-9')
        self.assertEqual(r.returncode, 1)
        self.assertEqual(r.stdout.splitlines(), ['QA-9: no está definida en ningún roadmap', 'hito: SIN HITO'])

    def test_sin_id(self):
        r = self.fila()
        self.assertEqual(r.returncode, 1)
        self.assertIn('uso: cobertura.py --fila <ID>', r.stderr)


class MainRemoto(unittest.TestCase):
    """QA-246: `--libre` y el choque de títulos contra `origin/main`, en un repo git temporal."""
    def setUp(self):
        self.dir = carpeta()
        os.makedirs(os.path.join(self.dir, 'tools', 'roadmap'))
        shutil.copy(os.path.join(RAIZ, 'tools', 'roadmap', 'cobertura.py'), os.path.join(self.dir, 'tools', 'roadmap'))
        self.producto = os.path.join(self.dir, 'docs', 'producto')
        for f in ROADMAPS:
            escribir(os.path.join(self.producto, f), '')
        escribir(os.path.join(self.producto, '21-roadmap.md'), MAPA)

    def git(self, *a):
        subprocess.run(['git', '-c', 'user.name=t', '-c', 'user.email=t@t', *a], cwd=self.dir, check=True, capture_output=True)

    def main_con(self, front):
        escribir(os.path.join(self.producto, 'roadmap-front.md'), front)
        self.git('init', '-q'); self.git('add', '-A'); self.git('commit', '-q', '-m', 'main')
        self.git('update-ref', 'refs/remotes/origin/main', 'HEAD')

    def cob(self, *args):
        return subprocess.run(['python3', os.path.join(self.dir, 'tools', 'roadmap', 'cobertura.py'), *args],
                              capture_output=True, text=True)

    def test_libre_con_numero_mas_alto_solo_en_main(self):
        self.main_con('- **QA-1 · Uno**\n- **QA-9 · Nueve**\n')
        escribir(os.path.join(self.producto, 'roadmap-front.md'), '- **QA-1 · Uno**\n- **QA-3 · Tres**\n')
        r = self.cob('--libre', 'QA')
        self.assertEqual((r.returncode, r.stdout.strip()), (0, 'QA-21'), r.stderr)  # QA-20 se menciona en el mapa
        self.assertEqual(self.cob('--libre', 'UX').stdout.strip(), 'UX-1')

    def test_libre_sin_origin_main_avisa(self):
        escribir(os.path.join(self.producto, 'roadmap-front.md'), '- **QA-30 · Treinta**\n')
        self.git('init', '-q')
        r = self.cob('--libre', 'QA')
        self.assertEqual((r.returncode, r.stdout.strip()), (0, 'QA-31'))
        self.assertIn('sin origin/main', r.stderr)

    def ramas(self, base, main, rama):
        """Base común con `base`, origin/main con `main` y la rama (HEAD) con `rama`, en roadmap-front.md."""
        front = os.path.join(self.producto, 'roadmap-front.md')
        self.main_con(base)
        escribir(front, main); self.git('commit', '--allow-empty', '-qam', 'main'); self.git('update-ref', 'refs/remotes/origin/main', 'HEAD')
        self.git('checkout', '-q', 'HEAD~1'); escribir(front, rama); self.git('commit', '-qam', 'rama')

    def test_mismo_id_abierto_en_la_rama_y_en_main(self):
        self.ramas('- **QA-1 · Uno**\n', '- **QA-1 · Uno**\n- **QA-2 · Voces**\n', '- **QA-1 · Uno**\n- **QA-2 · Lore**\n')
        r = self.cob()
        self.assertIn("ABIERTAS TAMBIÉN EN MAIN: ['QA-2']", r.stdout)
        self.assertEqual(r.returncode, 1)

    def test_cambiar_el_titulo_de_una_tarea_de_main_no_choca(self):
        self.ramas('- **QA-1 · Uno**\n', '- **QA-1 · Uno**\n', '- ~~**QA-1 · Uno, con otro título**~~ ✅\n')
        self.assertIn('ABIERTAS TAMBIÉN EN MAIN: []', self.cob().stdout)

    def test_tras_traer_main_no_choca(self):
        self.ramas('- **QA-1 · Uno**\n', '- **QA-1 · Uno**\n- **QA-2 · Voces**\n', '- **QA-1 · Uno**\n- **QA-3 · Lore**\n')
        self.git('merge', '-q', '-m', 'trae main', 'origin/main', '-X', 'theirs')
        escribir(os.path.join(self.producto, 'roadmap-front.md'), '- **QA-1 · Uno**\n- **QA-2 · Voces**\n- **QA-3 · Lore**\n')
        self.assertIn('ABIERTAS TAMBIÉN EN MAIN: []', self.cob().stdout)

if __name__ == '__main__':
    unittest.main()
