"""QA-153: `escenario.sh probar`, con psql y pg_restore falsos en el PATH (registran lo que reciben)."""
import os
import shutil
import stat
import subprocess
import unittest

from comun import ENV_GIT, QA, carpeta, escribir, git, leer


def id_de_arranque() -> str:
    try:
        with open('/proc/sys/kernel/random/boot_id') as f:
            return f.read().strip()
    except OSError:
        return ''


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

    def test_lista_con_patron_da_la_cabecera_y_las_filas_que_casan(self):
        # QA-312: el índice entero arrastraba ~3,7k tokens para buscar una instantánea.
        d = self.repo()
        escribir(os.path.join(d, 'tools', 'qa', 'escenarios', 'README.md'),
                 '# Escenarios\n\n| Escenario | Qué tiene |\n|---|---|\n| `uno` | Gistera |\n| `dos` | Hondonada (P289) |\n')
        def lista(patron):
            r = subprocess.run(['bash', 'tools/qa/escenario.sh', 'lista', patron], cwd=d, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            return r.stdout
        salida = lista('hondonada (p289)')  # literal y sin mayúsculas
        self.assertIn('| Escenario |', salida)
        self.assertIn('`dos`', salida)
        self.assertNotIn('`uno`', salida)
        self.assertEqual(lista('árbol').strip().splitlines(), ['| Escenario | Qué tiene |'])

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
        for nombre in ('arrancar-juego.sh', 'ia-comprobaciones.sh', 'perfil-ia.sh'):
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


    def test_cargar_recarga_la_pagina_del_driver_con_el_juego_ya_listo(self):
        """P407: tras relanzar el juego, la página del driver se recarga (no se queda con lo de antes)."""
        d = self.driver_falso()
        r = self.correr(d, 'cargar', 'uno')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        llamadas = [l for l in leer(os.path.join(d, 'llamadas.log')).splitlines() if l.split(' ')[0] in ('arrancar-juego.sh', 'orden.sh')]
        self.assertEqual(llamadas[-2], 'arrancar-juego.sh ')
        self.assertEqual(llamadas[-1], 'orden.sh ')
        orden = leer(os.path.join(d, 'orden.js'))
        self.assertIn('page.goto', orden)

    def driver_falso(self) -> str:
        d = Probar.repo(self)
        e2e = os.path.join(d, 'tools', 'playwright-e2e')
        os.makedirs(e2e)
        os.makedirs(os.path.join(d, 'logs'))
        # orden.sh falso: registra la llamada y guarda la orden JS que le llega por la entrada estándar.
        escribir(os.path.join(e2e, 'arrancar-juego.sh'), f'echo "arrancar-juego.sh $*" >> "{d}/llamadas.log"\n')
        escribir(os.path.join(e2e, 'orden.sh'), f'echo "orden.sh $*" >> "{d}/llamadas.log"; cat > "{d}/orden.js"\n')
        escribir(os.path.join(e2e, 'driver.token'), 'clave')
        return d

    def correr(self, d: str, *args: str):
        env = {**ENV_GIT, 'PATH': os.path.join(d, 'bin') + os.pathsep + os.environ['PATH']}
        return subprocess.run(['bash', 'tools/qa/escenario.sh', *args], cwd=d, env=env, capture_output=True, text=True)

    def test_cargar_y_avanzar_relanzan_con_el_perfil_y_el_registro_del_ultimo_arranque(self):
        """QA-310: sin IA_PERFIL/IA_REGISTRO el relanzamiento dejaba la tanda sin escribir en logs/ia/."""
        d = self.driver_falso()
        e2e = os.path.join(d, 'tools', 'playwright-e2e')
        escribir(os.path.join(e2e, 'arrancar-juego.sh'), f'echo "arrancar $1 perfil=${{IA_PERFIL:-}} registro=${{IA_REGISTRO:-}}" >> "{d}/llamadas.log"\n')
        escribir(os.path.join(d, 'logs', 'juego-ia.env'), f"# boot={id_de_arranque()}\nexport IA_PERFIL=deck\nexport IA_REGISTRO=/r/logs/ia/hoy.jsonl\n")
        for orden in (('cargar', 'uno'), ('avanzar', 'p1', '3')):
            r = self.correr(d, *orden)
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        lineas = [l for l in leer(os.path.join(d, 'llamadas.log')).splitlines() if l.startswith('arrancar ') and '--parar' not in l]
        self.assertEqual(len(lineas), 2, lineas)
        for l in lineas:
            self.assertIn('perfil=deck registro=/r/logs/ia/hoy.jsonl', l)

    def test_sin_arranque_con_ia_el_relanzamiento_no_inventa_perfil(self):
        d = self.driver_falso()
        e2e = os.path.join(d, 'tools', 'playwright-e2e')
        escribir(os.path.join(e2e, 'arrancar-juego.sh'), f'echo "arrancar $1 perfil=${{IA_PERFIL:-}}" >> "{d}/llamadas.log"\n')
        self.assertEqual(self.correr(d, 'cargar', 'uno').returncode, 0)
        self.assertIn('arrancar  perfil=', leer(os.path.join(d, 'llamadas.log')))

    def test_un_perfil_de_otro_arranque_del_sistema_no_se_recupera(self):
        """Un reinicio sin `--parar` deja logs/juego-ia.env de la sesión anterior: no se aplica a la de ahora."""
        d = self.driver_falso()
        e2e = os.path.join(d, 'tools', 'playwright-e2e')
        escribir(os.path.join(e2e, 'arrancar-juego.sh'), f'echo "arrancar $1 perfil=${{IA_PERFIL:-}}" >> "{d}/llamadas.log"\n')
        escribir(os.path.join(d, 'logs', 'juego-ia.env'), "# boot=otro-arranque-distinto\nexport IA_PERFIL=deck\n")
        self.assertEqual(self.correr(d, 'cargar', 'uno').returncode, 0)
        lineas = [l for l in leer(os.path.join(d, 'llamadas.log')).splitlines() if l.startswith('arrancar ') and '--parar' not in l]
        self.assertEqual(lineas, ['arrancar  perfil='])

    def test_guardar_perfil_ia_escribe_el_arranque_y_el_perfil_y_sin_perfil_lo_olvida(self):
        """Ejecuta `guardar_perfil_ia` (el mismo código que corre arrancar-juego.sh), sin arrancar el juego."""
        d = carpeta()
        script = os.path.join(QA, '..', 'playwright-e2e', 'perfil-ia.sh')
        def guardar(**entorno):
            env = {**os.environ, **entorno}
            for k in ('IA_PERFIL', 'IA_REGISTRO'):
                if k not in entorno:
                    env.pop(k, None)
            r = subprocess.run(['bash', '-c', f'. "{script}"; guardar_perfil_ia'], cwd=d, env=env, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        archivo = os.path.join(d, 'logs', 'juego-ia.env')
        guardar(IA_PERFIL='deck', IA_REGISTRO='/r/con espacio/hoy.jsonl')
        self.assertEqual(leer(archivo).splitlines()[0], f'# boot={id_de_arranque()}')
        leido = subprocess.run(['bash', '-c', f'. "{archivo}"; echo "$IA_PERFIL|$IA_REGISTRO"'], capture_output=True, text=True)
        self.assertEqual(leido.stdout.strip(), 'deck|/r/con espacio/hoy.jsonl')
        guardar()
        self.assertFalse(os.path.exists(archivo))

    def test_la_recarga_reintenta_hasta_ver_la_partida_y_si_no_avisa(self):
        """P407 (tanda 82): el cliente de Vite recargaba con el backend caído; un solo goto lo enmascaraba."""
        d = self.driver_falso()
        self.assertEqual(self.correr(d, 'cargar', 'uno').returncode, 0)
        orden = leer(os.path.join(d, 'orden.js'))
        self.assertIn('No se encuentra esta partida', orden)
        self.assertRegex(orden, r'for \(let i = 1; i <= 5')
        self.assertIn('AVISO: la página del driver no carga la partida', orden)

    def test_preparar_recarga_la_pagina_y_probar_no(self):
        """P407 (tanda 82): `preparar nivel` cambiaba la partida y el HUD seguía con el nivel viejo."""
        d = self.driver_falso()
        r = self.correr(d, 'preparar', 'p1', 'nivel:19')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('orden.sh ', leer(os.path.join(d, 'llamadas.log')).splitlines())
        os.remove(os.path.join(d, 'llamadas.log'))
        r = self.correr(d, 'probar', 'uno', 'preparar', 'p1', 'nivel:19')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertNotIn('orden.sh', leer(os.path.join(d, 'llamadas.log')))


if __name__ == '__main__':
    unittest.main()
