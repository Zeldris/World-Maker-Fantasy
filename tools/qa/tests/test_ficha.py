"""QA-245: tools/qa/ficha.sh, con un host.sh falso (el real lanza tsx; la lógica se prueba en backend/src/scripts/ficha.test.ts)."""
import os
import shutil
import subprocess
import unittest

from comun import QA, carpeta, escribir

RAIZ = os.path.abspath(os.path.join(QA, '..', '..'))


class Ficha(unittest.TestCase):
    def montar(self, estado: int = 0) -> str:
        """Copia del repo mínimo: ficha.sh, un host.sh falso que anota la orden, y un docs/ con canon."""
        d = carpeta()
        os.system(f'git init -q {d}')
        os.makedirs(os.path.join(d, 'tools', 'qa'))
        shutil.copy(os.path.join(QA, 'ficha.sh'), os.path.join(d, 'tools', 'qa', 'ficha.sh'))
        escribir(os.path.join(d, 'tools', 'qa', 'host.sh'),
                 '#!/bin/bash\nprintf "%s\\n" "$*" >> "$(dirname "$0")/ordenes"\n'
                 'case "$*" in *--nombre*) echo "Bicho Raro";; *) echo "FICHA $5"; exit ' + str(estado) + ';; esac\n')
        escribir(os.path.join(d, 'docs', 'rpgtarkor', 'a.md'), 'linea con bicho-raro aqui\nnada\nel Bicho Raro vive\n')
        escribir(os.path.join(d, 'docs', 'canon-opencode', 'b.md'), 'otro bicho-raro\n')
        return d

    def correr(self, d: str, *args: str):
        return subprocess.run(['bash', os.path.join(d, 'tools', 'qa', 'ficha.sh'), *args], cwd=d, capture_output=True, text=True)

    def test_lanza_la_ficha_con_el_slug_y_no_busca_canon_sin_la_opcion(self):
        d = self.montar()
        r = self.correr(d, 'bicho-raro')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('FICHA bicho-raro', r.stdout)
        self.assertNotIn('Canon', r.stdout)

    def test_canon_busca_slug_y_nombre_visible_sin_repetir_lineas(self):
        d = self.montar()
        r = self.correr(d, 'bicho-raro', '--canon')
        self.assertIn('# Canon', r.stdout)
        self.assertIn('docs/rpgtarkor/a.md:1:linea con bicho-raro aqui', r.stdout)
        self.assertIn('docs/rpgtarkor/a.md:3:el Bicho Raro vive', r.stdout)
        self.assertEqual(r.stdout.count('a.md:1:'), 1)

    def test_slug_inexistente_devuelve_el_codigo_1_de_la_ficha(self):
        d = self.montar(estado=1)
        self.assertEqual(self.correr(d, 'x').returncode, 1)

    def test_sin_slug_u_opcion_rara_sale_con_2_y_ayuda_con_0(self):
        d = self.montar()
        self.assertEqual(self.correr(d).returncode, 2)
        self.assertEqual(self.correr(d, '--zzz').returncode, 2)
        r = self.correr(d, '--ayuda')
        self.assertEqual(r.returncode, 0)
        self.assertIn('ficha.sh <slug>', r.stdout)


if __name__ == '__main__':
    unittest.main()
