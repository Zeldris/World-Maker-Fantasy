"""QA-153: `escenario.sh probar`, con psql y pg_restore falsos en el PATH (registran lo que reciben)."""
import os
import shutil
import stat
import subprocess
import unittest

from comun import ENV_GIT, QA, carpeta, escribir, git, leer


class Probar(unittest.TestCase):
    def repo(self) -> str:
        d = carpeta()
        git(d, 'init', '-q', '-b', 'main')
        os.makedirs(os.path.join(d, 'tools', 'qa', 'escenarios'))
        shutil.copy(os.path.join(QA, 'escenario.sh'), os.path.join(d, 'tools', 'qa', 'escenario.sh'))
        os.makedirs(os.path.join(d, 'tools', 'qa', 'deck'))
        shutil.copy(os.path.join(QA, 'deck', '_path.sh'), os.path.join(d, 'tools', 'qa', 'deck', '_path.sh'))
        escribir(os.path.join(d, 'tools', 'qa', 'escenarios', 'uno.dump'), 'x')
        escribir(os.path.join(d, 'tools', 'qa', 'escenarios', 'README.md'), '')
        os.makedirs(os.path.join(d, 'bin'))
        # `probar` aplica las migraciones desde backend/ con npx (falso: solo lo registra).
        os.makedirs(os.path.join(d, 'backend'))
        for nombre in ('psql', 'pg_restore', 'pg_dump', 'npx'):
            ruta = os.path.join(d, 'bin', nombre)
            escribir(ruta, f'#!/bin/bash\necho "{nombre} $*" >> "{d}/llamadas.log"\n')
            os.chmod(ruta, os.stat(ruta).st_mode | stat.S_IEXEC)
        return d

    def probar(self, d: str, *args: str):
        env = {**ENV_GIT, 'PATH': os.path.join(d, 'bin') + os.pathsep + os.environ['PATH']}
        return subprocess.run(['bash', 'tools/qa/escenario.sh', 'probar', *args], cwd=d, env=env, capture_output=True, text=True)

    def test_corre_la_orden_con_la_base_temporal_y_la_borra(self):
        d = self.repo()
        r = self.probar(d, 'uno', 'bash', '-c', 'echo "$DATABASE_URL $DIRECT_URL"')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        url, directa = r.stdout.split()
        self.assertEqual(url, directa)
        self.assertRegex(url, r'/prueba_\d+$')
        base = url.rsplit('/', 1)[1]
        llamadas = leer(os.path.join(d, 'llamadas.log'))
        self.assertIn(f'CREATE DATABASE {base}', llamadas)
        self.assertIn(f'pg_restore --no-owner -d {url} tools/qa/escenarios/uno.dump', llamadas)
        self.assertIn(f'DROP DATABASE IF EXISTS {base}', llamadas)
        self.assertNotIn('tarkor_juego', llamadas)

    def test_si_la_orden_falla_sale_con_su_codigo_y_borra_la_base(self):
        d = self.repo()
        r = self.probar(d, 'uno', 'bash', '-c', 'exit 7')
        self.assertEqual(r.returncode, 7)
        self.assertIn('DROP DATABASE IF EXISTS prueba_', leer(os.path.join(d, 'llamadas.log')))

    def test_sin_orden_o_sin_instantanea_no_toca_postgres(self):
        d = self.repo()
        self.assertEqual(self.probar(d, 'uno').returncode, 2)
        self.assertEqual(self.probar(d, 'nada', 'true').returncode, 1)
        self.assertFalse(os.path.exists(os.path.join(d, 'llamadas.log')))

    def test_dar_reino_es_subcomando_contra_la_base_temporal(self):
        d = self.repo()
        # Sin partida el subcomando falla (no hay backend en el repo de prueba) y la base se borra igual.
        r = self.probar(d, 'uno', 'dar-reino')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('DROP DATABASE IF EXISTS prueba_', leer(os.path.join(d, 'llamadas.log')))


class Guardar(unittest.TestCase):
    """QA-211: `guardar` rechaza una descripción que no es una frase (p. ej. el id de la partida) sin tocar postgres."""
    repo = Probar.repo

    def guardar(self, d: str, *args: str):
        env = {**ENV_GIT, 'PATH': os.path.join(d, 'bin') + os.pathsep + os.environ['PATH']}
        return subprocess.run(['bash', 'tools/qa/escenario.sh', 'guardar', *args], cwd=d, env=env, capture_output=True, text=True)

    def test_rechaza_el_id_de_la_partida_o_una_palabra(self):
        d = self.repo()
        for que in ('cmvex1v0300057d0pdjlbezcj', 'reino', '   ', 'cmvex1v0300057d0pdjlbezcj día 52', 'reino | día 52'):
            r = self.guardar(d, 'dos', que)
            self.assertEqual(r.returncode, 2, r.stdout)
            self.assertIn('no describe', r.stdout)
        self.assertFalse(os.path.exists(os.path.join(d, 'tools', 'qa', 'escenarios', 'dos.dump')))
        self.assertFalse(os.path.exists(os.path.join(d, 'llamadas.log')))


class Cargar(unittest.TestCase):
    """P400: cargar (y avanzar) paran el juego sin matar el driver de Playwright (puerto 9333)."""

    def repo(self) -> str:
        d = Probar.repo(self)
        os.makedirs(os.path.join(d, 'tools', 'playwright-e2e'))
        for nombre in ('arrancar-juego.sh', 'ia-comprobaciones.sh'):
            shutil.copy(os.path.join(QA, '..', 'playwright-e2e', nombre), os.path.join(d, 'tools', 'playwright-e2e', nombre))
        os.makedirs(os.path.join(d, 'logs'))
        ruta = os.path.join(d, 'bin', 'fuser')
        escribir(ruta, f'#!/bin/bash\necho "fuser $*" >> "{d}/llamadas.log"\n')
        os.chmod(ruta, os.stat(ruta).st_mode | stat.S_IEXEC)
        return d

    def parar(self, d: str, modo: str) -> str:
        env = {**ENV_GIT, 'PATH': os.path.join(d, 'bin') + os.pathsep + os.environ['PATH']}
        r = subprocess.run(['bash', 'tools/playwright-e2e/arrancar-juego.sh', modo], cwd=d, env=env, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        return leer(os.path.join(d, 'llamadas.log'))

    def test_parar_juego_deja_vivo_el_driver_y_parar_no(self):
        d = self.repo()
        self.assertIn('fuser -k 3001/tcp 5173/tcp', self.parar(d, '--parar-juego'))
        self.assertNotIn('9333', leer(os.path.join(d, 'llamadas.log')))
        self.assertIn('9333/tcp', self.parar(d, '--parar'))

    def test_escenario_para_el_juego_sin_el_driver(self):
        texto = leer(os.path.join(QA, 'escenario.sh'))
        self.assertNotIn('arrancar-juego.sh --parar ', texto)
        self.assertEqual(texto.count('arrancar-juego.sh --parar-juego'), 2)


if __name__ == '__main__':
    unittest.main()
