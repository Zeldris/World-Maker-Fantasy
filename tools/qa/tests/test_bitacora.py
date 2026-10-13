"""QA-74: tools/qa/bitacora.py (QA-69)."""
import os
import subprocess
import unittest

from comun import QA, carpeta, escribir


def comprobar(texto: str) -> subprocess.CompletedProcess:
    ruta = os.path.join(carpeta(), 'traspaso.md')
    escribir(ruta, texto)
    return subprocess.run(['python3', os.path.join(QA, 'bitacora.py'), ruta], capture_output=True, text=True)


class Bitacora(unittest.TestCase):
    def test_una_fila_corta_por_rama_pasa(self):
        r = comprobar('| **Tarea en curso · `a`** | algo |\n| **Tarea en curso · `b`** | otra |\n')
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_fila_sin_rama_falla(self):
        r = comprobar('| **Tarea en curso** | algo |\n')
        self.assertEqual(r.returncode, 1)
        self.assertIn('fila sin rama', r.stdout)

    def test_fila_larga_falla(self):
        r = comprobar('| **Tarea en curso · `a`** | ' + 'x' * 601 + ' |\n')
        self.assertEqual(r.returncode, 1)
        self.assertIn('601 caracteres', r.stdout)

    def test_dos_filas_de_la_misma_rama_fallan(self):
        r = comprobar('| **Tarea en curso · `a`** | uno |\n| **Tarea en curso · `a`** | dos |\n')
        self.assertEqual(r.returncode, 1)
        self.assertIn('dos filas', r.stdout)

    def test_sin_ninguna_fila_falla(self):
        self.assertEqual(comprobar('| **Hito** | 0.3 |\n').returncode, 1)


if __name__ == '__main__':
    unittest.main()
