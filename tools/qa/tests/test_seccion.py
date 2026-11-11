"""QA-311: `seccion.sh` devuelve una sola sección `## …` de un Markdown."""
import os
import subprocess
import unittest

from comun import QA, carpeta, escribir

TEXTO = """# Runbook

## Qué se prueba, en este orden

uno
### dentro
dos

## Cómo se juega

tres
"""


class Seccion(unittest.TestCase):
    def correr(self, *args: str):
        d = carpeta()
        escribir(os.path.join(d, 'r.md'), TEXTO)
        return subprocess.run(['bash', os.path.join(QA, 'seccion.sh'), os.path.join(d, 'r.md'), *args],
                              capture_output=True, text=True)

    def test_da_la_seccion_con_sus_subtitulos_y_para_en_la_siguiente(self):
        r = self.correr('Qué se prueba')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('### dentro', r.stdout)
        self.assertIn('dos', r.stdout)
        self.assertNotIn('Cómo se juega', r.stdout)
        self.assertNotIn('# Runbook', r.stdout)

    def test_sin_esa_seccion_falla_y_lista_las_que_hay(self):
        r = self.correr('Nada')
        self.assertEqual(r.returncode, 1)
        self.assertIn('Sin sección «Nada»', r.stderr)
        self.assertIn('## Cómo se juega', r.stderr)


if __name__ == '__main__':
    unittest.main()
