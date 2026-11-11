"""QA-320: tools/qa/plan.py (estado del plan de la puerta en una orden)."""
import os
import subprocess
import unittest

from comun import QA, carpeta, escribir

PLAN = """# Plan

| Tanda | Sistema | Escenario | Hallazgos y qué falta | Estado |
|---|---|---|---|---|
| 115 | Repesca | `t1` | P451 | hecha 2026-11-11: P451 ✅ |
| 116 | Lote I \\| huida | `t2` | P452, P443 | pendiente |

| Lote | Sistema | Hallazgos |
|---|---|---|
| D | Reino | ✅ 2026-11-10: P248, P342. |
| E | Compañeros | P270, P319. ✅ 2026-11-10. Reparto. |
| I | Ficha | P452 (leve), P443. Abierto 2026-11-11. |
"""

ARCHIVO = """| 40 | Viejo | `t0` | P90 | hecha 2026-10-20 |
"""


class Plan(unittest.TestCase):
    def setUp(self):
        self.dir = carpeta()
        self.ruta = os.path.join(self.dir, 'plan-comprobacion-puerta.md')
        escribir(self.ruta, PLAN)
        escribir(os.path.join(self.dir, 'plan-comprobacion-puerta-archivo.md'), ARCHIVO)

    def plan(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(['python3', os.path.join(QA, 'plan.py'), *args, '--plan', self.ruta],
                              capture_output=True, text=True)

    def test_pendiente(self):
        r = self.plan('--pendiente')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('la siguiente sería la 117', r.stdout)
        self.assertIn('116 · Lote I \\| huida', r.stdout)
        self.assertNotIn('115 ·', r.stdout)
        self.assertIn('D · Reino · P248, P342', r.stdout)
        self.assertIn('I · Ficha · P443, P452', r.stdout)
        self.assertIn('lo último: P452 (leve), P443. Abierto 2026-11-11.', r.stdout)

    def test_fila_sin_barra_final(self):
        escribir(self.ruta, PLAN.replace('| D | Reino | ✅ 2026-11-10: P248, P342. |', '| D | Reino | ✅ 2026-11-10: P248, P342.'))
        self.assertIn('D · Reino · P248, P342', self.plan().stdout)

    def test_tanda_del_plan_y_del_archivo(self):
        r = self.plan('--tanda', '116', '40')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('P452, P443', r.stdout)
        self.assertIn('hecha 2026-10-20', r.stdout)

    def test_tanda_que_no_esta(self):
        r = self.plan('--tanda', '999')
        self.assertEqual(r.returncode, 1)
        self.assertIn('Tanda 999: no está', r.stdout)

    def test_lote(self):
        r = self.plan('--lote', 'i')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('Abierto 2026-11-11', r.stdout)
        self.assertEqual(self.plan('--lote', 'Z').returncode, 1)


if __name__ == '__main__':
    unittest.main()
