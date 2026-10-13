"""QA-72: tools/qa/marca-hallazgo.py (QA-42, QA-47, QA-55)."""
import os
import subprocess
import unittest

from comun import QA, carpeta, escribir, git, leer

REGISTRO = """# Ronda

| P | Hallazgo | Estado |
|---|---|---|
| P1 | Uno | pendiente |
| P2 | Dos \\| con barra | pendiente (texto) |

Notas.
"""


class MarcaHallazgo(unittest.TestCase):
    def setUp(self):
        self.repo = carpeta()
        git(self.repo, 'init', '-q')
        self.ruta = os.path.join(self.repo, 'registro.md')
        escribir(self.ruta, REGISTRO)

    def marcar(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(['python3', os.path.join(QA, 'marca-hallazgo.py'), *args, '--registro', self.ruta],
                              cwd=self.repo, capture_output=True, text=True)

    def leer(self) -> str:
        return leer(self.ruta)

    def test_cambia_solo_el_estado_de_esa_fila(self):
        self.assertEqual(self.marcar('P2', 'pendiente (texto)', '✅ hecho').returncode, 0)
        self.assertIn('| P2 | Dos \\| con barra | ✅ hecho |', self.leer())
        self.assertIn('| P1 | Uno | pendiente |', self.leer())

    def test_sin_coincidencia_falla_y_no_toca_nada(self):
        r = self.marcar('P1', 'no está', 'x')
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual(self.leer(), REGISTRO)

    def test_nuevo_va_detras_de_la_ultima_fila_con_el_siguiente_numero(self):
        self.assertEqual(self.marcar('--nuevo', 'Tres | con barra', 'pendiente').returncode, 0)
        lineas = self.leer().split('\n')
        i = lineas.index('| P3 | Tres \\| con barra | pendiente |')
        self.assertTrue(lineas[i - 1].startswith('| P2 |'))


if __name__ == '__main__':
    unittest.main()
