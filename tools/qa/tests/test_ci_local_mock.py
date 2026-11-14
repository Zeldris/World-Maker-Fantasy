"""QA-288: ci-local.sh para el Ollama simulado que levanta. Uno de 27 h seguía en 11434 y tapaba al Ollama real."""
import os
import subprocess
import tempfile
import textwrap
import unittest

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
CI = os.path.join(RAIZ, 'tools', 'qa', 'ci-local.sh')


class MockSeParaAlSalir(unittest.TestCase):
    def test_trap_mata_el_mock_que_lanza(self):
        # Se ejecutan, tal cual, la línea del trap y la que lanza el mock, con un «node» falso que duerme.
        lineas = open(CI, encoding='utf-8').read().splitlines()
        trap = [l for l in lineas if l.startswith('trap ') and 'EXIT' in l]
        lanza = [l for l in lineas if 'mock-ollama.mjs' in l and 'nohup' in l]
        self.assertEqual(len(lanza), 1, 'ci-local.sh debe lanzar el mock en una sola línea')
        with tempfile.TemporaryDirectory() as d:
            node = os.path.join(d, 'node')
            with open(node, 'w') as f:
                f.write('#!/bin/bash\nexec sleep 60\n')
            os.chmod(node, 0o755)
            pidf = os.path.join(d, 'pid')
            guion = textwrap.dedent(f'''\
                copia={d}/copia; dir={d}; logs={d}; mock_pid=""
                curl() {{ return 1; }}
                {chr(10).join(trap)}
                {lanza[0].replace('sleep 2', 'sleep 0.2')}
                echo "${{mock_pid:-$!}}" > {pidf}
                ''')
            subprocess.run(['bash', '-c', guion], env={**os.environ, 'PATH': f'{d}:{os.environ["PATH"]}'}, timeout=20,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            pid = int(open(pidf).read().strip())
            try:
                os.kill(pid, 0)
                vivo = True
            except ProcessLookupError:
                vivo = False
            if vivo:
                os.kill(pid, 9)
            self.assertFalse(vivo, 'el mock de Ollama sigue vivo al salir de ci-local.sh')


if __name__ == '__main__':
    unittest.main()
