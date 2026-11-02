"""Retro del 2026-11-02 (R1): `tools/qa/difusion.py` sobre una copia de una pieza de docs/difusion, con las normas
de Reddit puestas sin pegar a propósito (así no depende de que la usuaria las pegue en la pieza real)."""
import glob
import os
import re
import shutil
import subprocess
import sys
import unittest

from comun import RAIZ, carpeta, escribir, leer

ORDEN = os.path.join(RAIZ, 'tools', 'qa', 'difusion.py')
PIEZA = sorted(glob.glob(os.path.join(RAIZ, 'docs', 'difusion', '[0-9]*', '[0-9][0-9]-*')))[0]


class Difusion(unittest.TestCase):
    def setUp(self):
        self.dir = carpeta()
        self.pieza = os.path.join(self.dir, '2026-10-23', '01-tema')
        shutil.copytree(PIEZA, self.pieza)
        self.ficha = os.path.join(self.pieza, 'ficha.md')
        texto = re.sub(r'^- \*\*Normas leídas:\*\*.*$', '- **Normas leídas:** pendiente', leer(self.ficha), flags=re.M)
        escribir(self.ficha, re.sub(r'^### Normas de .*?(?=^##)', '', texto, flags=re.M | re.S))

    def correr(self, *extra):
        return subprocess.run([sys.executable, ORDEN, '--dir', self.dir, *extra], capture_output=True, text=True)

    def test_las_normas_de_reddit_sin_pegar_solo_avisan(self):
        r = self.correr()
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('normas de Reddit sin pegar', r.stderr)

    def test_una_fecha_de_normas_mal_escrita_para_el_check(self):
        escribir(self.ficha, leer(self.ficha).replace('**Normas leídas:** pendiente', '**Normas leídas:** 2026/11/02'))
        r = self.correr()
        self.assertEqual(r.returncode, 1)
        self.assertIn('2026/11/02', r.stderr)

    def test_un_canal_que_falta_para_el_check_y_dice_cual(self):
        os.remove(os.path.join(self.pieza, 'x.md'))
        r = self.correr()
        self.assertEqual(r.returncode, 1)
        self.assertIn('x.md', r.stderr)

    def test_un_id_de_tarea_de_taskid_en_un_post_para_el_check(self):
        x = os.path.join(self.pieza, 'x.md')
        escribir(x, leer(x).replace('## es\n', '## es\n\nArreglado en REI-12.\n', 1))
        r = self.correr()
        self.assertEqual(r.returncode, 1)
        self.assertIn('REI-12', r.stderr)

    def test_una_carpeta_con_otro_nombre_para_el_check(self):
        os.makedirs(os.path.join(self.dir, '2026-10-23', '1-otra'))
        r = self.correr()
        self.assertEqual(r.returncode, 1)
        self.assertIn('1-otra: no sigue', r.stderr)

    def test_sin_piezas_no_hay_nada_que_comprobar(self):
        shutil.rmtree(os.path.join(self.dir, '2026-10-23'))
        self.assertEqual(self.correr().returncode, 0)


if __name__ == '__main__':
    unittest.main()
