"""QA-113: tools/qa/matriz-pruebas.py (QA-101), con una copia del script y un cobertura.py de prueba."""
import os
import shutil
import subprocess
import unittest

from comun import QA, carpeta, escribir, leer

ROADMAP = '- ~~**REI-1 · Fundar el reino**~~ ✅ 2026-10-01\n- **REI-2 · Por hacer**\n'
COBERTURA = '''import os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'docs', 'producto') + os.sep
defs = {'REI-1': ('r.md', 1), 'REI-2': ('r.md', 2)}
asignado = {'REI-1': {'0.1'}, 'REI-2': {'0.1'}}
'''
CABEZA = '| Tarea | Bloque | Qué | Estado | Prueba |\n|---|---|---|---|---|\n'


class MatrizPruebas(unittest.TestCase):
    def setUp(self):
        self.raiz = carpeta()
        os.makedirs(os.path.join(self.raiz, 'tools/qa'))
        shutil.copy(os.path.join(QA, 'matriz-pruebas.py'), os.path.join(self.raiz, 'tools/qa'))
        escribir(os.path.join(self.raiz, 'tools/roadmap/cobertura.py'), COBERTURA)
        escribir(os.path.join(self.raiz, 'docs/producto/r.md'), ROADMAP)
        os.makedirs(os.path.join(self.raiz, 'docs/registros'))
        self.matriz = os.path.join(self.raiz, 'docs/registros/matriz-pruebas.md')

    def correr(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(['python3', os.path.join(self.raiz, 'tools/qa/matriz-pruebas.py'), *args],
                              capture_output=True, text=True)

    def test_falta_la_fila_de_una_tarea_cerrada_y_generar_la_anade(self):
        r = self.correr('--comprobar')
        self.assertEqual(r.returncode, 1)
        self.assertIn('FALTAN EN LA MATRIZ (tareas cerradas sin fila; `--generar`): REI-1', r.stdout)
        self.correr('--generar')
        self.assertIn('| `REI-1` | Reino | Fundar el reino | sin jugar |  |', leer(self.matriz))
        self.assertNotIn('REI-2', leer(self.matriz))
        self.assertEqual(self.correr('--comprobar').returncode, 0)

    def test_generar_quita_lo_que_sobra_solo_si_no_tiene_nada_escrito(self):
        escribir(self.matriz, CABEZA + '| `REI-1` | Reino | x | sin jugar |  |\n| `REI-8` | Reino | y | sin jugar |  |\n'
                 '| `REI-9` | Reino | z | jugado | P1 |\n')
        r = self.correr('--generar')
        self.assertIn('Se dejan porque tienen estado o prueba escritos (quítalas a mano si de verdad no cuentan): REI-9', r.stdout)
        self.assertNotIn('REI-8', leer(self.matriz))
        self.assertIn('REI-9', leer(self.matriz))
        self.assertEqual(self.correr('--comprobar').returncode, 1)

    def test_estado_desconocido_falla(self):
        escribir(self.matriz, CABEZA + '| `REI-1` | Reino | x | probado |  |\n')
        r = self.correr('--comprobar')
        self.assertEqual(r.returncode, 1)
        self.assertIn('ESTADO DESCONOCIDO: REI-1', r.stdout)

    def test_bloque_lista_lo_sin_jugar_y_sin_valor_da_uso(self):
        escribir(self.matriz, CABEZA + '| `REI-1` | Reino | Fundar | sin jugar |  |\n')
        self.assertEqual(self.correr('--bloque', 'Reino').stdout, 'REI-1 · Fundar (sin jugar)\n')
        self.assertEqual(self.correr('--bloque').returncode, 2)


if __name__ == '__main__':
    unittest.main()
