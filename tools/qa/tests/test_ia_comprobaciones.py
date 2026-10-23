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

    def test_gpu_descartada_en_el_log_falla(self):
        log = self.log_falso('viejo\nlevel=INFO msg="dropping integrated GPU"\n' + 'x' * 500 + '\n')
        r = bash(f'ia_comprobar_log_gpu {log}')
        self.assertEqual(r.returncode, 1)
        self.assertIn('CPU', r.stderr)
        self.assertIn('logs/ollama.log', r.stderr)  # el arranque recomendado escribe el log

    def test_log_sin_descarte_pasa_en_silencio(self):
        r = bash(f'ia_comprobar_log_gpu {self.log_falso("inference compute library=vulkan")}')
        self.assertEqual((r.returncode, r.stderr), (0, ''))

    def test_log_inexistente_avisa_sin_parar(self):
        r = bash('ia_comprobar_log_gpu /no/existe.log')
        self.assertEqual(r.returncode, 0)
        self.assertIn('Aviso', r.stderr)
        self.assertIn('/api/ps', r.stderr)
        self.assertIn('logs/ollama.log', r.stderr)

    def test_rag_eval_ok(self):
        self.assertEqual(bash("ia_veredicto_rag_eval 0 'fallan debe_pasar: 0'").returncode, 0)

    def test_rag_eval_casos_fallidos_pide_reindexar(self):
        r = bash("ia_veredicto_rag_eval 1 'recall@5: 0.5   fallan debe_pasar: 2'")
        self.assertEqual(r.returncode, 1)
        self.assertIn('reindexa', r.stderr)

    def test_rag_eval_excepcion_ensena_la_salida(self):
        r = bash("ia_veredicto_rag_eval 1 $'Error: connect ECONNREFUSED 127.0.0.1:11434\n    at fetch'")
        self.assertEqual(r.returncode, 1)
        self.assertNotIn('reindexa', r.stderr)
        self.assertIn('ECONNREFUSED', r.stderr)

    def test_rag_eval_otro_codigo_ensena_la_salida(self):
        r = bash("ia_veredicto_rag_eval 2 'uso: --k'")
        self.assertEqual(r.returncode, 1)
        self.assertIn('uso: --k', r.stderr)

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

    def test_arrancar_juego_levanta_el_ollama_simulado_solo_sin_ia_real(self):
        # Tanda 24a: tras `escenario.sh cargar` no había Ollama simulado y las acciones daban 500 (ECONNREFUSED).
        with open(SCRIPT) as f:
            s = f.read()
        self.assertIn('if [ -z "${IA_PERFIL:-}" ] && ! curl -s --max-time 3 -o /dev/null "$OLLAMA_BASE_URL"', s)
        self.assertIn('tools/ci/mock-ollama.mjs', s)
        self.assertIn('logs/mock-ollama.pid', s)  # --parar lo baja por su PID
        # Sin puerto en OLLAMA_BASE_URL, 11434; si el mock no responde, aviso a stderr con el log y sin PID ni «levantado».
        self.assertIn('puerto=11434', s)
        self.assertIn('mock_ok=1', s)
        self.assertIn('tras 10 s: mira logs/mock-ollama.log" >&2', s)
        self.assertIn('rm -f logs/mock-ollama.pid', s)


if __name__ == '__main__':
    unittest.main()
