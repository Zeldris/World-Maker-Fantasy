"""QA-290: `tools/roadmap/siguiente-id.py` mira la copia y las ramas remotas, no solo la copia."""
import os
import subprocess
import unittest

from comun import RAIZ, carpeta, escribir, git

SCRIPT = os.path.join(RAIZ, 'tools', 'roadmap', 'siguiente-id.py')


class SiguienteId(unittest.TestCase):
    def setUp(self):
        base = carpeta()
        self.origen = os.path.join(base, 'origen.git')
        git(base, 'init', '-q', '--bare', '-b', 'main', self.origen)
        self.copia = os.path.join(base, 'copia')
        git(base, 'clone', '-q', self.origen, self.copia)
        escribir(os.path.join(self.copia, 'docs', 'r.md'), '`QA-3` y `XQA-40`\n')
        git(self.copia, 'add', '.')
        git(self.copia, 'commit', '-qm', 'base')
        git(self.copia, 'push', '-q', 'origin', 'HEAD:main')

    def correr(self, *args):
        return subprocess.run(['python3', SCRIPT, *args], cwd=self.copia, capture_output=True, text=True)

    def test_sin_otras_ramas_sigue_a_la_copia_y_no_cuenta_otras_series(self):
        r = self.correr('QA', '--sin-fetch')
        self.assertEqual(r.stdout.strip(), 'QA-4')
        self.assertEqual(r.stderr, '')

    def test_un_numero_usado_en_otra_rama_remota_cuenta_y_avisa(self):
        otra = os.path.join(os.path.dirname(self.copia), 'otra')
        git(os.path.dirname(otra), 'clone', '-q', self.origen, otra)
        escribir(os.path.join(otra, 'docs', 'r.md'), '`QA-3` y `QA-7`\n')
        git(otra, 'commit', '-qam', 'otra')
        git(otra, 'push', '-q', 'origin', 'HEAD:claude/otra')
        r = self.correr('QA')  # con fetch: trae claude/otra
        self.assertEqual(r.stdout.strip(), 'QA-8')
        self.assertIn('origin/claude/otra', r.stderr)

    def test_serie_mal_escrita_sale_con_uso(self):
        r = self.correr('qa')
        self.assertEqual(r.returncode, 2)
        self.assertIn('Uso:', r.stderr)


if __name__ == '__main__':
    unittest.main()
