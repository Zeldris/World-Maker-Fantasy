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


class BaseMatriz(unittest.TestCase):
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


class MatrizPruebas(BaseMatriz):
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

    def test_jugado_con_prueba_parcial_falla(self):
        escribir(self.matriz, CABEZA + '| `REI-1` | Reino | x | jugado | parcial 2026-10-21: falta y |\n')
        r = self.correr('--comprobar')
        self.assertEqual(r.returncode, 1)
        self.assertIn('JUGADO CON PRUEBA PARCIAL (reescribe la prueba con lo jugado o vuelve a «sin jugar»): REI-1', r.stdout)
        escribir(self.matriz, CABEZA + '| `REI-1` | Reino | x | jugado | 2026-10-22, tanda 20; antes, parcial |\n')
        self.assertEqual(self.correr('--comprobar').returncode, 0)

    def test_bloque_lista_lo_sin_jugar_y_sin_valor_da_uso(self):
        escribir(self.matriz, CABEZA + '| `REI-1` | Reino | Fundar | sin jugar |  |\n')
        self.assertEqual(self.correr('--bloque', 'Reino').stdout, 'REI-1 · Fundar (sin jugar)\n')
        self.assertEqual(self.correr('--bloque').returncode, 2)


class EscenariosDelPlan(BaseMatriz):
    """QA-217: un plan de comprobación no puede nombrar un escenario sin su .dump."""

    def setUp(self):
        super().setUp()
        escribir(self.matriz, CABEZA + '| `REI-1` | Reino | x | jugado | 2026-10-22 |\n')
        os.makedirs(os.path.join(self.raiz, 'tools/qa/escenarios'))
        for n in ('existe', 'otro'):
            escribir(os.path.join(self.raiz, f'tools/qa/escenarios/{n}.dump'), 'x')

    def plan(self, filas: str, cabeza: str = '| Tanda | Sistema | Escenario | Estado |\n|---|---|---|---|\n', nombre='a') -> None:
        escribir(os.path.join(self.raiz, f'docs/registros/plan-comprobacion-{nombre}.md'), '# Plan\n\n' + cabeza + filas)

    def falla_con(self, *nombres: str) -> None:
        r = self.correr('--comprobar')
        self.assertEqual(r.returncode, 1, r.stdout)
        self.assertIn('ESCENARIO SIN .dump', r.stdout)
        for n in nombres:
            self.assertIn(f'plan-comprobacion-a.md: {n} (línea', r.stdout)

    def test_escenario_inexistente_falla_con_su_nombre_y_linea(self):
        self.plan('| 1 | Reino | `no-esta` | ok |\n')
        self.falla_con('no-esta')
        self.assertIn('(línea 5)', self.correr('--comprobar').stdout)

    def test_escenario_que_existe_pasa(self):
        self.plan('| 1 | Reino | `existe` | ok |\n')
        self.assertEqual(self.correr('--comprobar').returncode, 0)

    def test_varios_escenarios_en_una_celda_se_miran_todos(self):
        self.plan('| 1 | Reino | `existe`; `otro` y `falta` | ok |\n')
        self.falla_con('falta')
        self.assertNotIn('existe (', self.correr('--comprobar').stdout)
        self.assertNotIn('otro (', self.correr('--comprobar').stdout)

    def test_con_o_sin_extension_dump_y_con_ruta(self):
        self.plan('| 1 | Reino | `existe.dump` | ok |\n| 2 | Reino | `tools/qa/escenarios/otro.dump` | ok |\n')
        self.assertEqual(self.correr('--comprobar').returncode, 0)
        self.plan('| 1 | Reino | `no-esta.dump` | ok |\n')
        self.falla_con('no-esta')

    def test_celdas_sin_escenario_ni_ordenes_no_cuentan(self):
        self.plan('| 1 | Reino | — | ok |\n| 2 | Reino | partida nueva | ok |\n|  3 | Reino |  | ok |\n'
                  '| 4 | Reino | `existe` + `escenario.sh avanzar` | ok |\n'
                  '| 5 | Reino | `preparar subditos:orcos:3:cazador` | ok |\n')
        self.assertEqual(self.correr('--comprobar').returncode, 0)

    def test_enlace_markdown_con_el_nombre_en_comillas(self):
        self.plan('| 1 | Reino | [`no-esta`](../../tools/qa/escenarios/no-esta.dump) | ok |\n')
        self.falla_con('no-esta')

    def test_plan_sin_columna_escenario_no_nombra_ninguno(self):
        self.plan('| 1 | Reino | `no-esta` |\n', cabeza='| Tanda | Sistema | Estado |\n|---|---|---|\n')
        self.assertEqual(self.correr('--comprobar').returncode, 0)

    def test_solo_cuenta_la_columna_escenario_no_el_resto_de_la_fila(self):
        # Un escenario creado en la propia tanda se cita en «Estado» (p. ej. «Partida guardada: `nuevo`»): no se exige.
        self.plan('| 1 | Reino | `existe` | Partida guardada: `nuevo-de-la-tanda` |\n')
        self.assertEqual(self.correr('--comprobar').returncode, 0)

    def test_columna_escenario_en_otra_posicion_y_varios_planes(self):
        self.plan('| 1 | `no-esta` | ok |\n', cabeza='| Tanda | ESCENARIO | Estado |\n|---|---|---|\n', nombre='a')
        self.plan('| 1 | `existe` | ok |\n', cabeza='| Tanda | Escenario | Estado |\n|---|---|---|\n', nombre='b')
        self.falla_con('no-esta')

    def test_dos_tablas_en_un_plan_cada_una_con_su_cabecera(self):
        self.plan('| 1 | Reino | `existe` | ok |\n\n| Otra | Cosa |\n|---|---|\n| `no-escenario` | x |\n')
        self.assertEqual(self.correr('--comprobar').returncode, 0)


if __name__ == '__main__':
    unittest.main()
