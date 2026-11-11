"""QA-313: `deck/ia-ronda.sh parar` mata el Ollama de la ronda (y sus hijos) por su PID y para el juego."""
import os
import shutil
import subprocess
import time
import unittest

from comun import QA, carpeta, escribir, leer


class IaRonda(unittest.TestCase):
    def repo(self) -> str:
        d = carpeta()
        os.makedirs(os.path.join(d, 'tools', 'qa', 'deck'))
        os.makedirs(os.path.join(d, 'logs'))
        for nombre in ('ia-ronda.sh', '_raiz.sh'):
            shutil.copy(os.path.join(QA, 'deck', nombre), os.path.join(d, 'tools', 'qa', 'deck', nombre))
        return d

    def correr(self, d: str, orden: str):
        env = {**os.environ, 'PARAR_JUEGO': f'touch {d}/juego-parado', 'COMM_RONDA': 'bash'}
        return subprocess.run(['bash', os.path.join(d, 'tools', 'qa', 'deck', 'ia-ronda.sh'), orden],
                              env=env, capture_output=True, text=True, timeout=30)

    def test_parar_mata_el_proceso_y_sus_hijos_y_para_el_juego(self):
        d = self.repo()
        # Como systemd-inhibit con `ollama serve` dentro: un padre que espera a un hijo.
        padre = subprocess.Popen(['bash', '-c', f'sleep 300 & echo $! > {d}/hijo; wait'])
        for _ in range(50):
            if os.path.exists(os.path.join(d, 'hijo')) and leer(os.path.join(d, 'hijo')).strip():
                break
            time.sleep(0.1)
        hijo = int(leer(os.path.join(d, 'hijo')))
        escribir(os.path.join(d, 'logs', 'ia-ronda.pid'), str(padre.pid))
        r = self.correr(d, 'parar')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        padre.wait(timeout=10)
        time.sleep(0.2)
        with self.assertRaises(ProcessLookupError):
            os.kill(hijo, 0)
        self.assertFalse(os.path.exists(os.path.join(d, 'logs', 'ia-ronda.pid')))
        self.assertTrue(os.path.exists(os.path.join(d, 'juego-parado')))

    def test_un_pid_viejo_de_otro_proceso_no_se_mata(self):
        d = self.repo()
        ajeno = subprocess.Popen(['sleep', '300'])  # `sleep`, no el Ollama de la ronda
        try:
            escribir(os.path.join(d, 'logs', 'ia-ronda.pid'), str(ajeno.pid))
            r = self.correr(d, 'parar')
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            self.assertIn('ya no es el Ollama de la ronda', r.stdout)
            self.assertIsNone(ajeno.poll())
        finally:
            ajeno.kill()

    def test_sin_orden_conocida_sale_con_el_uso(self):
        r = self.correr(self.repo(), 'otra')
        self.assertEqual(r.returncode, 2)
        self.assertIn('uso: ia-ronda.sh', r.stdout)


if __name__ == '__main__':
    unittest.main()
