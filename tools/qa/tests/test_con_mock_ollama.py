"""Retro 2026-11-10 (mapas a main): `con-mock-ollama.sh` levanta el Ollama simulado solo si nada contesta en el
11434, lo para al acabar (no se queda con el puerto del Ollama real) y, si no arranca, no corre los tests."""
import os
import shutil
import subprocess
import time
import unittest

from comun import QA, carpeta, escribir

# curl falso: «contesta» si existe el archivo `arriba` en la raíz del repo de prueba.
CURL = '#!/bin/bash\n[ -f "$RAIZ/arriba" ]\n'
# node falso que arranca: marca `arriba`, apunta su pid y espera; al morir, quita la marca.
NODE_ARRANCA = ('#!/bin/bash\necho $$ > "$RAIZ/pid"\ntouch "$RAIZ/arriba"\n'
                'trap \'rm -f "$RAIZ/arriba"; exit 0\' TERM\nwhile :; do sleep 0.1; done\n')
NODE_FALLA = '#!/bin/bash\necho "node: no está" >&2\nexit 1\n'


def preparar(node: str, arriba: bool = False) -> tuple[str, dict]:
    r = carpeta()
    os.makedirs(os.path.join(r, 'tools', 'qa'))
    shutil.copy(os.path.join(QA, 'con-mock-ollama.sh'), os.path.join(r, 'tools', 'qa', 'con-mock-ollama.sh'))
    binarios = os.path.join(r, 'bin')
    for nombre, cuerpo in (('curl', CURL), ('node', node), ('sleep', '#!/bin/bash\n')):
        escribir(os.path.join(binarios, nombre), cuerpo)
        os.chmod(os.path.join(binarios, nombre), 0o755)
    if arriba:
        escribir(os.path.join(r, 'arriba'), '')
    return r, {**os.environ, 'RAIZ': r, 'PATH': binarios + os.pathsep + os.environ['PATH']}


def correr(r: str, env: dict) -> subprocess.CompletedProcess:
    orden = 'test -f "$RAIZ/arriba" && echo "tests con ollama"'
    return subprocess.run(['bash', 'tools/qa/con-mock-ollama.sh', 'bash', '-c', orden], cwd=r, env=env,
                          capture_output=True, text=True, timeout=30)


class ConMockOllama(unittest.TestCase):
    def test_lo_levanta_corre_la_orden_y_lo_para(self):
        r, env = preparar(NODE_ARRANCA)
        p = correr(r, env)
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertIn('tests con ollama', p.stdout)
        pid = int(open(os.path.join(r, 'pid')).read())
        for _ in range(50):
            if not os.path.exists(f'/proc/{pid}'):
                break
            time.sleep(0.1)
        self.assertFalse(os.path.exists(f'/proc/{pid}'), 'el simulado sigue vivo tras la orden')
        self.assertFalse(os.path.exists(os.path.join(r, 'arriba')))

    def test_si_ya_contesta_no_arranca_otro(self):
        r, env = preparar(NODE_FALLA, arriba=True)
        p = correr(r, env)
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertIn('tests con ollama', p.stdout)
        self.assertFalse(os.path.exists(os.path.join(r, 'pid')))

    def test_si_no_arranca_sale_en_rojo_sin_correr_la_orden(self):
        r, env = preparar(NODE_FALLA)
        p = correr(r, env)
        self.assertEqual(p.returncode, 1)
        self.assertIn('no contesta en el 11434', p.stderr)
        self.assertNotIn('tests con ollama', p.stdout)


if __name__ == '__main__':
    unittest.main()
