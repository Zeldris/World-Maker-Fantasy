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
    def log_falso(self, texto):
        with tempfile.NamedTemporaryFile('w', suffix='.log', delete=False) as f:
            f.write(texto)
        self.addCleanup(os.unlink, f.name)
        return f.name

    def test_ruta_relativa_pasa_a_absoluta(self):
        self.assertEqual(bash('ia_registro_absoluto /repo backend/ia/r.jsonl').stdout.strip(), '/repo/backend/ia/r.jsonl')
        self.assertEqual(bash('ia_registro_absoluto /repo/ ./r.jsonl').stdout.strip(), '/repo/r.jsonl')

    def test_ruta_absoluta_no_cambia(self):
        self.assertEqual(bash('ia_registro_absoluto /repo /tmp/r.jsonl').stdout.strip(), '/tmp/r.jsonl')

    def test_gpu_descartada_en_lo_nuevo_del_log_falla(self):
        log = self.log_falso('viejo\nlevel=INFO msg="dropping integrated GPU"\n')
        r = bash(f'ia_comprobar_log_gpu {log} 0')
        self.assertEqual(r.returncode, 1)
        self.assertIn('CPU', r.stderr)

    def test_gpu_descartada_antes_del_offset_no_cuenta(self):
        viejo = 'level=INFO msg="dropping integrated GPU"\n'
        log = self.log_falso(viejo + 'level=INFO msg="inference compute" library=vulkan\n')
        self.assertEqual(bash(f'ia_comprobar_log_gpu {log} {len(viejo)}').returncode, 0)

    def test_log_inexistente_se_salta(self):
        self.assertEqual(bash('ia_comprobar_log_gpu /no/existe.log 0').returncode, 0)

    def test_tamano_log(self):
        self.assertEqual(bash(f'ia_tamano_log {self.log_falso("12345")}').stdout.strip(), '5')
        self.assertEqual(bash('ia_tamano_log /no/existe.log').stdout.strip(), '0')

    def test_api_ps_con_vram_pasa(self):
        self.assertEqual(bash("""ia_comprobar_gpu_api '{"models":[{"name":"a","size_vram":123}]}'""").returncode, 0)

    def test_api_ps_sin_vram_falla(self):
        self.assertEqual(bash("""ia_comprobar_gpu_api '{"models":[{"name":"a","size_vram":0}]}'""").returncode, 1)

    def test_api_ps_vacio_o_ilegible_avisa_sin_fallar(self):
        for js in ('{"models":[]}', '', 'no json'):
            r = bash(f"ia_comprobar_gpu_api '{js}'")
            self.assertEqual(r.returncode, 2, js)
            self.assertIn('Aviso', r.stderr)

    def test_arrancar_juego_sintaxis_y_ramas_con_guarda(self):
        self.assertEqual(subprocess.run(['bash', '-n', SCRIPT]).returncode, 0)
        with open(SCRIPT) as f:
            s = f.read()
        self.assertEqual(s.count('if [ -n "${IA_PERFIL:-}" ]'), 2)  # ruta/offset y comprobaciones, solo con IA_PERFIL


if __name__ == '__main__':
    unittest.main()
