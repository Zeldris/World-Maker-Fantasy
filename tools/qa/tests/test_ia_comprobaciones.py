"""QA-141: ruta absoluta de IA_REGISTRO y detección de GPU de tools/playwright-e2e/ia-comprobaciones.sh."""
import os
import subprocess
import tempfile
import unittest

from comun import QA

RAIZ = os.path.abspath(os.path.join(QA, '..', '..'))
LIB = os.path.join(RAIZ, 'tools', 'playwright-e2e', 'ia-comprobaciones.sh')
SCRIPT = os.path.join(RAIZ, 'tools', 'playwright-e2e', 'arrancar-juego.sh')


def bash(cmd):
    return subprocess.run(['bash', '-c', f'. "{LIB}"; {cmd}'], capture_output=True, text=True)


class IaComprobaciones(unittest.TestCase):
    def test_ruta_relativa_pasa_a_absoluta(self):
        self.assertEqual(bash('ia_registro_absoluto /repo backend/ia/r.jsonl').stdout.strip(), '/repo/backend/ia/r.jsonl')
        self.assertEqual(bash('ia_registro_absoluto /repo/ ./r.jsonl').stdout.strip(), '/repo/r.jsonl')

    def test_ruta_absoluta_no_cambia(self):
        self.assertEqual(bash('ia_registro_absoluto /repo /tmp/r.jsonl').stdout.strip(), '/tmp/r.jsonl')

    def test_gpu_descartada_en_el_log_falla(self):
        with tempfile.NamedTemporaryFile('w', suffix='.log') as f:
            f.write('level=INFO msg="dropping integrated GPU"\n')
            f.flush()
            r = bash(f'ia_comprobar_gpu {f.name} "NAME ... 100% GPU"')
        self.assertEqual(r.returncode, 1)
        self.assertIn('CPU', r.stderr)

    def test_ps_sin_gpu_falla(self):
        r = bash('ia_comprobar_gpu /no/existe.log "NAME  PROCESSOR\nqwen  100% CPU"')
        self.assertEqual(r.returncode, 1)

    def test_log_limpio_y_gpu_pasa(self):
        with tempfile.NamedTemporaryFile('w', suffix='.log') as f:
            f.write('level=INFO msg="inference compute" library=vulkan\n')
            f.flush()
            r = bash(f'ia_comprobar_gpu {f.name} "qwen 100% GPU"')
        self.assertEqual(r.returncode, 0)

    def test_arrancar_juego_sintaxis_y_ramas_con_guarda(self):
        self.assertEqual(subprocess.run(['bash', '-n', SCRIPT]).returncode, 0)
        s = open(SCRIPT).read()
        self.assertEqual(s.count('if [ -n "${IA_PERFIL:-}" ]'), 2)  # ruta absoluta y comprobaciones, solo con IA_PERFIL


if __name__ == '__main__':
    unittest.main()
