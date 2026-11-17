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
        for nombre in ('ia-ronda.sh', '_raiz.sh', 'vigilante-memoria.sh'):
            shutil.copy(os.path.join(QA, 'deck', nombre), os.path.join(d, 'tools', 'qa', 'deck', nombre))
        return d

    def correr(self, d: str, orden: str, extra=None):
        env = {**os.environ, 'PARAR_JUEGO': f'touch {d}/juego-parado', 'COMM_RONDA': 'bash', **(extra or {})}
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

    # QA-353: Ollama en su scope de systemd, con vuelta atrás si no hay systemd-run.
    def bin_falso(self, d: str, nombres) -> str:
        b = os.path.join(d, 'bin')
        os.makedirs(b)
        for n in nombres:
            escribir(os.path.join(b, n), '#!/bin/bash\nexit 0\n')
            os.chmod(os.path.join(b, n), 0o755)
        return b

    def test_el_lanzador_usa_systemd_run_scope_y_conserva_el_inhibidor(self):
        d = self.repo()
        b = self.bin_falso(d, ['systemd-run'])
        r = self.correr(d, 'lanzador', {'PATH': f'{b}:{os.environ["PATH"]}'})
        self.assertEqual(r.returncode, 0, r.stderr)
        orden = r.stdout.split('\n')
        self.assertEqual(orden[:3], ['systemd-run', '--user', '--scope'])
        self.assertIn('systemd-inhibit', orden)

    def test_sin_systemd_run_se_lanza_como_antes(self):
        d = self.repo()
        # PATH sin systemd-run: solo un directorio con bash, ps y coreutils mínimos enlazados.
        b = os.path.join(d, 'bin')
        os.makedirs(b)
        for n in ('bash', 'dirname', 'cat', 'ps', 'mkdir', 'rm'):
            os.symlink(shutil.which(n), os.path.join(b, n))
        r = self.correr(d, 'lanzador', {'PATH': b})
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertNotIn('systemd-run', r.stdout)
        self.assertIn('systemd-inhibit', r.stdout)

    def test_parar_con_el_vigilante_ya_muerto_no_falla(self):
        d = self.repo()
        muerto = subprocess.Popen(['true'])
        muerto.wait()
        escribir(os.path.join(d, 'logs', 'vigilante-memoria.pid'), str(muerto.pid))
        r = self.correr(d, 'parar')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertFalse(os.path.exists(os.path.join(d, 'logs', 'vigilante-memoria.pid')))
        self.assertTrue(os.path.exists(os.path.join(d, 'juego-parado')))

    def test_si_systemd_run_no_funciona_se_lanza_sin_scope_y_avisa(self):
        d = self.repo()
        b = os.path.join(d, 'bin')
        os.makedirs(b)
        escribir(os.path.join(b, 'systemd-run'), '#!/bin/bash\necho "Failed to connect to bus" >&2\nexit 1\n')
        os.chmod(os.path.join(b, 'systemd-run'), 0o755)
        r = self.correr(d, 'lanzador', {'PATH': f'{b}:{os.environ["PATH"]}'})
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertNotIn('systemd-run', r.stdout)
        self.assertIn('systemd-inhibit', r.stdout)
        self.assertIn('sin scope', r.stderr)

    def con_ollama_en_pie(self, d: str):
        """Un «ollama» (copia de sleep) y un puerto que escucha, sin tocar el :11434 de nadie."""
        import socket
        srv = socket.socket()
        srv.bind(('127.0.0.1', 0))
        srv.listen(5)
        self.addCleanup(srv.close)
        os.makedirs(os.path.join(d, 'bin'))
        falso = os.path.join(d, 'bin', 'ollama')
        shutil.copy(shutil.which('sleep'), falso)
        proc = subprocess.Popen([falso, '300'])
        self.addCleanup(proc.kill)
        return {'PUERTO_OLLAMA': str(srv.getsockname()[1]), 'MEMINFO': os.path.join(d, 'mem')}

    def test_arrancar_con_ollama_ya_en_pie_rearma_el_vigilante_y_estado_lo_dice(self):
        d = self.repo()
        escribir(os.path.join(d, 'mem'), 'MemAvailable: 99999999 kB\n')
        extra = self.con_ollama_en_pie(d)
        r = self.correr(d, 'estado', extra)
        self.assertIn('FALTA el vigilante', r.stdout)
        r = self.correr(d, 'arrancar', extra)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('no se lanza otro', r.stdout)
        pidf = os.path.join(d, 'logs', 'vigilante-memoria.pid')
        self.assertTrue(os.path.exists(pidf), 'el vigilante no se rearmó')
        pid = int(leer(pidf))
        self.addCleanup(lambda: os.path.exists(f'/proc/{pid}') and os.kill(pid, 15))
        self.assertIn('En pie: vigilante de memoria', self.correr(d, 'estado', extra).stdout)
        self.correr(d, 'arrancar', extra)  # repetir no lo duplica
        self.assertEqual(int(leer(pidf)), pid)

    def test_arrancar_guarda_el_registro_de_ollama_anterior(self):
        """QA-502: relanzar sobrescribía logs/ollama.log y se perdía el de la ronda."""
        import socket
        d = self.repo()
        os.makedirs(os.path.join(d, 'tools', 'playwright-e2e'))
        shutil.copy(os.path.join(QA, '..', 'playwright-e2e', 'ia-comprobaciones.sh'), os.path.join(d, 'tools', 'playwright-e2e'))
        escribir(os.path.join(d, 'logs', 'ollama.log'), 'cached n_tokens = 6300\n')
        s = socket.socket()
        s.bind(('127.0.0.1', 0))
        puerto = s.getsockname()[1]
        s.close()
        falso = os.path.join(d, 'ollama-falso')
        escribir(falso, f"""#!/bin/bash
echo "arranque nuevo"
exec python3 -c "import socket,time; s=socket.socket(); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1); s.bind(('127.0.0.1', {puerto})); s.listen(); time.sleep(20)"
""")
        os.chmod(falso, 0o755)
        r = self.correr(d, 'arrancar', {'OLLAMA_BIN': falso, 'PUERTO_OLLAMA': str(puerto), 'SCOPE': '0', 'INHIBIR': '0', 'VIGILANTE': '0'})
        pid = int(leer(os.path.join(d, 'logs', 'ia-ronda.pid')))
        self.addCleanup(lambda: os.path.exists(f'/proc/{pid}') and os.kill(pid, 15))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        guardados = [n for n in os.listdir(os.path.join(d, 'logs')) if n.startswith('ollama-') and n.endswith('.log')]
        self.assertEqual(len(guardados), 1, os.listdir(os.path.join(d, 'logs')))
        self.assertIn('cached n_tokens = 6300', leer(os.path.join(d, 'logs', guardados[0])))
        self.assertNotIn('cached n_tokens', leer(os.path.join(d, 'logs', 'ollama.log')))


class VigilanteMemoria(unittest.TestCase):
    def vigilar(self, meminfo, **extra):
        d = carpeta()
        os.makedirs(os.path.join(d, 'tools', 'qa', 'deck'))
        for nombre in ('_raiz.sh', 'vigilante-memoria.sh'):
            shutil.copy(os.path.join(QA, 'deck', nombre), os.path.join(d, 'tools', 'qa', 'deck', nombre))
        ruta = os.path.join(d, 'meminfo')
        if meminfo is not None:
            escribir(ruta, meminfo)
        env = {**os.environ, 'MEMINFO': ruta, 'UMBRAL_MIB': '100', 'VENTANA_S': '3', 'INTERVALO_S': '1',
               'PARAR_TANDA': f'touch {d}/tanda-parada', **extra}
        r = subprocess.run(['bash', os.path.join(d, 'tools', 'qa', 'deck', 'vigilante-memoria.sh')],
                           env=env, capture_output=True, text=True, timeout=30)
        return d, r

    def test_bajo_el_umbral_menos_que_la_ventana_no_para(self):
        d, r = self.vigilar('MemAvailable:   10240 kB\n', MAX_VUELTAS='2')  # 10 MiB < 100, 2 vueltas < 3 s
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertFalse(os.path.exists(os.path.join(d, 'tanda-parada')))

    def test_sostenido_bajo_el_umbral_para_la_tanda_y_avisa(self):
        d, r = self.vigilar('MemAvailable:   10240 kB\n', MAX_VUELTAS='20')
        self.assertEqual(r.returncode, 3, r.stdout + r.stderr)
        self.assertIn('ALERTA', r.stdout)
        self.assertTrue(os.path.exists(os.path.join(d, 'tanda-parada')))

    def test_por_defecto_para_la_ronda_entera_y_dice_la_memoria_vista(self):
        d = carpeta()
        deck = os.path.join(d, 'tools', 'qa', 'deck')
        os.makedirs(deck)
        for nombre in ('_raiz.sh', 'vigilante-memoria.sh'):
            shutil.copy(os.path.join(QA, 'deck', nombre), os.path.join(deck, nombre))
        escribir(os.path.join(deck, 'ia-ronda.sh'), f'#!/bin/bash\necho "$@ $DESDE_VIGILANTE" > {d}/llamada\n')
        escribir(os.path.join(d, 'meminfo'), 'MemAvailable:   10240 kB\n')
        env = {k: v for k, v in os.environ.items() if k != 'PARAR_TANDA'}
        env.update(MEMINFO=os.path.join(d, 'meminfo'), UMBRAL_MIB='100', VENTANA_S='2', INTERVALO_S='1', MAX_VUELTAS='20')
        r = subprocess.run(['bash', os.path.join(deck, 'vigilante-memoria.sh')], env=env, capture_output=True,
                           text=True, timeout=30)
        self.assertEqual(r.returncode, 3, r.stdout + r.stderr)
        self.assertEqual(leer(os.path.join(d, 'llamada')).strip(), 'parar 1')
        self.assertIn('10 MiB', r.stderr)

    def test_memoria_suficiente_no_para(self):
        d, r = self.vigilar('MemAvailable:   1024000 kB\n', MAX_VUELTAS='5')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertFalse(os.path.exists(os.path.join(d, 'tanda-parada')))

    def test_sin_meminfo_avisa_una_vez_y_no_se_cae(self):
        d, r = self.vigilar(None, MAX_VUELTAS='3')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(r.stdout.count('no se lee MemAvailable'), 1)
        self.assertFalse(os.path.exists(os.path.join(d, 'tanda-parada')))

    def test_valor_ilegible_avisa_y_no_para(self):
        d, r = self.vigilar('MemAvailable:   mucha kB\n', MAX_VUELTAS='5')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('no se lee MemAvailable', r.stdout)
        self.assertFalse(os.path.exists(os.path.join(d, 'tanda-parada')))

    def test_muestrea_el_rss_de_llama_server(self):
        # QA-503: dos procesos de 1.000 MiB → 2000 MiB en la muestra; sin procesos, «-».
        d, r = self.vigilar('MemAvailable:   1024000 kB\n', MAX_VUELTAS='2', MUESTRA_S='1',
                            RSS_ORDEN='printf 1024000\\n1024000\\n')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('muestra: disponible 1000 MiB · llama-server 2000 MiB', r.stdout)
        d, r = self.vigilar('MemAvailable:   1024000 kB\n', MAX_VUELTAS='1', MUESTRA_S='1', RSS_ORDEN='true')
        self.assertIn('llama-server - MiB', r.stdout)


if __name__ == '__main__':
    unittest.main()
