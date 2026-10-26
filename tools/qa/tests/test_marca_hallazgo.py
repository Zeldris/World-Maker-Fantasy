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

    def test_espacios_en_el_borde_del_texto_viejo_no_impiden_casar(self):
        self.assertEqual(self.marcar('P1', ' pendiente ', '✅ hecho').returncode, 0)
        self.assertIn('| P1 | Uno | ✅ hecho |', self.leer())

    def test_texto_viejo_de_solo_espacios_falla_sin_tocar_nada(self):
        r = self.marcar('P1', '  ', '✅ ')
        self.assertIn('texto viejo de P1 está vacío', r.stderr)
        self.assertEqual(self.leer(), REGISTRO)

    def test_sin_coincidencia_en_fila_larga_muestra_el_final(self):
        largo = 'viejo ' * 60 + 'Reabierto 2026-10-26: falta X'
        self.assertEqual(self.marcar('P1', 'pendiente', largo).returncode, 0)
        r = self.marcar('P1', 'no está', 'x')
        self.assertIn('…', r.stderr)
        self.assertIn('Reabierto 2026-10-26: falta X', r.stderr)

    def test_sin_coincidencia_muestra_el_estado_actual(self):
        r = self.marcar('P2', 'no está', 'x')
        self.assertIn('0 filas de P2', r.stderr)
        self.assertIn('estado actual: pendiente (texto)', r.stderr)

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

    def test_otras_formas_de_decir_comprobado_parte_y_decision(self):
        escribir(self.ruta, CON_RESUMEN + """| P7 | Siete | ✅ comprobado |
| P8 | Ocho | ✅ hecho. Comprobado en vivo. |
| P9 | Nueve | ✅ comprobado (en parte) |
| P10 | Diez | Pendiente de que la usuaria confirme |
""")
        self.assertEqual(self.correr('--resumen').returncode, 0)
        texto = leer(self.ruta)
        self.assertIn('- **Comprobados jugando** (3): P3, P7, P8.', texto)
        self.assertIn('- **Arreglados en parte** (2): P6, P9.', texto)
        self.assertIn('- **Pendientes de una decisión de la usuaria** (2): P4, P10.', texto)

    def test_reabierto_manda_el_ultimo_estado_y_en_parte_sin_parentesis(self):
        escribir(self.ruta, CON_RESUMEN + """| P7 | Siete | ✅ hecho. Reabierto en la ronda 3 |
| P8 | Ocho | Reabierto en la ronda 3. ✅ arreglado de nuevo |
| P9 | Nueve | ✅ hecho en parte: falta el texto |
""")
        self.assertEqual(self.correr('--resumen').returncode, 0)
        texto = leer(self.ruta)
        self.assertIn('- **Pendientes** (2): P1, P7.', texto)
        self.assertIn('- **Arreglados, sin comprobar jugando** (2): P2, P8.', texto)
        self.assertIn('- **Arreglados en parte** (2): P6, P9.', texto)

    def test_arreglado_sin_check_cuenta_como_arreglado(self):
        escribir(self.ruta, CON_RESUMEN + """| P7 | Siete | arreglado (2026-10-19, decisión de la usuaria): suma a la Comida |
| P8 | Ocho | arreglado (2026-10-19): test en verde. Jugado ✓ (2026-10-19) |
""")
        self.assertEqual(self.correr('--resumen').returncode, 0)
        texto = leer(self.ruta)
        self.assertIn('- **Arreglados, sin comprobar jugando** (2): P2, P7.', texto)
        self.assertIn('- **Comprobados jugando** (2): P3, P8.', texto)
        self.assertIn('- **Pendientes de una decisión de la usuaria** (1): P4.', texto)

    def test_no_jugable_va_aparte_de_los_sin_comprobar(self):
        escribir(self.ruta, CON_RESUMEN + """| P7 | Siete | ✅ 2026-10-09 (no jugable, se cierra sin jugar: solo tests): test en verde |
""")
        self.assertEqual(self.correr('--resumen').returncode, 0)
        texto = leer(self.ruta)
        self.assertIn('- **Arreglados, sin comprobar jugando** (1): P2.', texto)
        self.assertIn('- **Arreglados, no jugables (los cubre un test o la base)** (1): P7.', texto)

    def test_comprobar_avisa_de_un_estado_contradictorio(self):
        escribir(self.ruta, CON_RESUMEN + '| P7 | Siete | No aplica. ✅ hecho |\n| P8 | Ocho | ✅ 2026-10-13 (decisión de la usuaria): así |\n')
        self.assertEqual(self.correr('--resumen').returncode, 0)
        r = self.correr('--resumen', '--comprobar')
        self.assertEqual(r.returncode, 0)
        self.assertIn('P7 se contradice', r.stderr)
        self.assertNotIn('P8', r.stderr)

    def test_comprobar_falla_con_un_pendiente_que_no_lo_dice(self):
        escribir(self.ruta, CON_RESUMEN + '| P7 | Siete | resuelto con un parche |\n'
                 '| P8 | Ocho | **Pendientes**: falta el texto |\n| P9 | Nueve | 🔴 abierto |\n'
                 '| P10 | Diez | ✅ hecho. Reabierto en la ronda 3 |\n| P11 | Once | resuelto del todo |\n')
        self.assertEqual(self.correr('--resumen').returncode, 0)
        r = self.correr('--resumen', '--comprobar')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('no lo dice (QA-185): P7, P11;', r.stderr)

    def test_comprobar_falla_con_reabierto_posterior_o_falta_ver_que_cuenta_como_hecho(self):
        # QA-195: P116 («Reabierto 10-21 … arreglo ✅ 10-13») y P189 («comprobado jugando…; falta ver una hora») del 3.3.
        escribir(self.ruta, CON_RESUMEN + '| P7 | Siete | Reabierto 2026-10-21: no sale (arreglo ✅ 2026-10-13) |\n'
                 '| P8 | Ocho | ✅ comprobado jugando 2026-10-22; falta ver una hora entera |\n'
                 '| P9 | Nueve | ✅ arreglado. Falta verlo jugando |\n'
                 '| P10 | Diez | pendiente. Reabierto |\n'
                 '| P11 | Once | ✅ comprobado en vivo 2026-10-22; queda por ver el resto |\n'
                 '| P12 | Doce | ✅ 2026-10-15 arreglado; pendiente: el menú. Reabierto 2026-10-21; ✅ 2026-10-23 |\n'
                 '| P13 | Trece | Reabierto 2026-10-21: vuelve (en parte ✅ 2026-10-13) |\n')
        self.assertEqual(self.correr('--resumen').returncode, 0)
        r = self.correr('--resumen', '--comprobar')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('(QA-195): P7, P8, P11, P13;', r.stderr)
        self.assertIn('AL FINAL', r.stderr)

    def test_comprobar_pasa_con_historial_en_orden(self):
        escribir(self.ruta, CON_RESUMEN + '| P7 | Siete | ✅ 2026-10-15; reabierto 2026-10-21; ✅ 2026-10-23 |\n'
                 '| P8 | Ocho | ✅ 2026-10-18: arreglado; falta comprobarlo jugando; comprobado jugando 2026-10-22 |\n'
                 '| P9 | Nueve | Reabierto 2026-10-21 ✅ arreglado; ver P5 del 2026-10-01 |\n')
        self.assertEqual(self.correr('--resumen').returncode, 0)
        self.assertEqual(self.correr('--resumen', '--comprobar').returncode, 0)

    def test_todo_reabierto_cuenta_tambien_en_plural_y_tras_un_no(self):
        # Ante la duda, pendiente: con guardia de negación, el «sin» de otra frase escondía el reabierto de P99 (3.3).
        escribir(self.ruta, CON_RESUMEN + '| P7 | Siete | ✅ hecho. Reabiertos los dos casos |\n'
                 '| P8 | Ocho | ✅ comprobado jugando; no se ha reabierto |\n'
                 '| P9 | Nueve | ✅ 2026-10-12 sin repetirlo (`x.ts`); reabierto 2026-10-21: sigue |\n'
                 '| P10 | Diez | ✅ arreglado; comprobado jugando: no funciona — reabierto 2026-10-21 |\n')
        self.assertEqual(self.correr('--resumen').returncode, 0)
        self.assertIn('- **Pendientes** (5): P1, P7, P8, P9, P10.', leer(self.ruta))

    def test_comprobar_salta_con_texto_entre_el_check_y_la_fecha_y_con_plural(self):
        # P116: «arreglo ✅ nota 2026-10-13»: la fecha del ✅ puede venir tras unas palabras, sin dígitos ni «;».
        escribir(self.ruta, CON_RESUMEN + '| P7 | Siete | Reabierto 2026-10-21: no sale (arreglo ✅ verificado en la ronda 2026-10-13) |\n'
                 '| P8 | Ocho | Reabiertos 2026-10-21: vuelve (arreglo ✅ 2026-10-13) |\n')
        self.assertEqual(self.correr('--resumen').returncode, 0)
        r = self.correr('--resumen', '--comprobar')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('(QA-195): P7, P8;', r.stderr)

    def test_comprobar_reabierto_sin_fecha_delante_de_un_check_no_salta(self):
        escribir(self.ruta, CON_RESUMEN + '| P7 | Siete | Reabierto: no sale (arreglo ✅ 2026-10-13) |\n')
        self.assertEqual(self.correr('--resumen').returncode, 0)
        self.assertEqual(self.correr('--resumen', '--comprobar').returncode, 0)

    def test_comprobar_falta_ver_solo_tras_la_ultima_marca(self):
        escribir(self.ruta, CON_RESUMEN + '| P7 | Siete | ✅ falta ver una hora; comprobado en vivo 2026-10-22 |\n'
                 '| P8 | Ocho | ✅ comprobado jugando 2026-10-20; falta ver; ✅ comprobado 2026-10-22 |\n')
        self.assertEqual(self.correr('--resumen').returncode, 0)
        self.assertEqual(self.correr('--resumen', '--comprobar').returncode, 0)
        escribir(self.ruta, CON_RESUMEN + '| P7 | Siete | ✅ comprobado en vivo 2026-10-22; falta ver el resto |\n')
        self.correr('--resumen')
        r = self.correr('--resumen', '--comprobar')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('(QA-195): P7;', r.stderr)

    def test_comprobar_pasa_si_cada_pendiente_lo_dice(self):
        self.assertEqual(self.correr('--resumen').returncode, 0)
        self.assertEqual(self.correr('--resumen', '--comprobar').returncode, 0)

    def test_comprobar_sin_marcas_falla(self):
        escribir(self.ruta, CON_RESUMEN.replace(INICIO, '<!-- resumen -->'))
        r = self.correr('--resumen', '--comprobar')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('faltan las marcas', r.stderr)

    def test_comprobar_falla_si_no_coincide_y_marcar_lo_rehace(self):
        self.assertNotEqual(self.correr('--resumen', '--comprobar').returncode, 0)
        self.assertEqual(self.correr('P1', 'pendiente', '✅ hecho').returncode, 0)
        self.assertEqual(self.correr('--resumen', '--comprobar').returncode, 0)
        self.assertIn('- **Pendientes** (0): ninguno.', leer(self.ruta))


if __name__ == '__main__':
    unittest.main()
