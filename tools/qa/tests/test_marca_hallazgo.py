"""QA-74: tools/qa/marca-hallazgo.py (QA-42, QA-47, QA-55)."""
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


INICIO = '<!-- resumen: lo genera tools/qa/marca-hallazgo.py desde la tabla; no se edita a mano -->'
CON_RESUMEN = f"""# Ronda

{INICIO}
- viejo
<!-- fin del resumen -->

| P | Hallazgo | Estado |
|---|---|---|
| P1 | Uno | pendiente |
| P2 | Dos | ✅ hecho; «queda pendiente: nada» citado |
| P3 | Tres | ✅ hecho. Comprobado jugando el día 2 |
| P4 | Cuatro | pendiente (decisión de la usuaria) |
| P5 | Cinco | no aplica |
| P6 | Seis | texto ✅; pendiente: la imagen |
"""


class Resumen(unittest.TestCase):
    """QA-84: el resumen de la cabecera sale de la tabla."""

    def setUp(self):
        self.repo = carpeta()
        git(self.repo, 'init', '-q')
        self.ruta = os.path.join(self.repo, 'registro.md')
        escribir(self.ruta, CON_RESUMEN)

    def correr(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(['python3', os.path.join(QA, 'marca-hallazgo.py'), *args, '--registro', self.ruta],
                              cwd=self.repo, capture_output=True, text=True)

    def test_agrupa_por_estado(self):
        self.assertEqual(self.correr('--resumen').returncode, 0)
        texto = leer(self.ruta)
        self.assertNotIn('- viejo', texto)
        self.assertIn('- **Pendientes** (1): P1.', texto)
        self.assertIn('- **Arreglados, sin comprobar jugando** (1): P2.', texto)
        self.assertIn('- **Comprobados jugando** (1): P3.', texto)
        self.assertIn('- **Pendientes de una decisión de la usuaria** (1): P4.', texto)
        self.assertIn('- **Cerrados sin arreglo (no aplica, dato o roadmap)** (1): P5.', texto)
        self.assertIn('- **Arreglados en parte** (1): P6.', texto)

    def test_comprobar_falla_si_no_coincide_y_marcar_lo_rehace(self):
        self.assertNotEqual(self.correr('--resumen', '--comprobar').returncode, 0)
        self.assertEqual(self.correr('P1', 'pendiente', '✅ hecho').returncode, 0)
        self.assertEqual(self.correr('--resumen', '--comprobar').returncode, 0)
        self.assertIn('- **Pendientes** (0): ninguno.', leer(self.ruta))


if __name__ == '__main__':
    unittest.main()
