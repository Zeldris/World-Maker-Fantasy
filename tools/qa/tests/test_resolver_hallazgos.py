"""QA-135: resolver_hallazgos.py: se queda con el lado no pendiente y no toca el registro si no puede resolver."""
import os
import subprocess
import unittest

from comun import QA, carpeta, escribir, leer

RES = os.path.join(QA, 'resolver_hallazgos.py')
C = '<<<<<<< HEAD\n{}=======\n{}>>>>>>> sub\n'


class Resolver(unittest.TestCase):
    def correr(self, texto: str):
        ruta = os.path.join(carpeta(), 'h.md')
        escribir(ruta, texto)
        r = subprocess.run(['python3', RES, ruta], capture_output=True, text=True)
        return r, leer(ruta)

    def test_elige_por_fila_el_lado_no_pendiente(self):
        r, t = self.correr('x\n' + C.format('| P1 | a | pendiente |\n| P2 | b | ✅ |\n', '| P1 | a | ✅ hecho |\n| P2 | b | pendiente |\n') + 'y\n')
        self.assertEqual(r.returncode, 0)
        self.assertEqual(t, 'x\n| P1 | a | ✅ hecho |\n| P2 | b | ✅ |\ny\n')

    def test_con_error_sale_con_1_y_no_escribe(self):
        original = C.format('| P1 | a | pendiente |\n', '| P9 | a | ✅ |\n')
        r, t = self.correr(original)
        self.assertEqual(r.returncode, 1)
        self.assertEqual(t, original)


if __name__ == '__main__':
    unittest.main()
