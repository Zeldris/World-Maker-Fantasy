"""QA-150: tools/qa/host.sh, con un flatpak-spawn falso en el PATH (sql.sh, en test_sql.py)."""
import os
import shutil
import stat
import subprocess
import unittest

from comun import QA, carpeta, escribir, leer

RAIZ = os.path.abspath(os.path.join(QA, '..', '..'))


def falso(d: str, nombre: str, cuerpo: str) -> None:
    ruta = os.path.join(d, 'bin', nombre)
    escribir(ruta, '#!/bin/bash\n' + cuerpo)
    os.chmod(ruta, os.stat(ruta).st_mode | stat.S_IEXEC)


class Entorno:
    """PATH con los falsos y lo justo del sistema; lo comparte test_sql.py."""
    def entorno(self, sandbox: bool, **extra: str) -> tuple[dict, str]:
        d = carpeta()
        # flatpak-spawn falso: anota los argumentos (uno por línea) y ejecuta la orden (lo que sigue a «--host --directory=…»).
        falso(d, 'flatpak-spawn', f'printf "%s\\n" "$@" > {d}/args\nshift 2\nexec "$@"\n')
        # El PATH solo trae los falsos y las utilidades del sistema; sin psql real.
        sistema = os.path.join(d, 'sistema')
        os.makedirs(sistema)
        for cmd in ('bash', 'base64', 'tr', 'cat', 'pwd', 'echo', 'printf', 'dirname', 'grep'):
            ruta = shutil.which(cmd)
            if ruta:
                os.symlink(ruta, os.path.join(sistema, cmd))
        env = {**os.environ, 'PATH': os.path.join(d, 'bin') + os.pathsep + sistema, **extra}
        env.pop('FLATPAK_ID', None)
        env.pop('HOST_SH_SANDBOX', None)
        if sandbox:
            env['HOST_SH_SANDBOX'] = '1'
        return env, d

    def correr(self, env: dict, script: str, *args: str, entrada: str | None = None):
        return subprocess.run(['bash', os.path.join(QA, script), *args], env=env, input=entrada,
                              capture_output=True, text=True, cwd='/')


class Host(Entorno, unittest.TestCase):
    def test_fuera_del_sandbox_ejecuta_en_la_raiz_sin_flatpak(self):
        env, d = self.entorno(False)
        r = self.correr(env, 'host.sh', 'pwd')
        self.assertEqual(r.stdout.strip(), RAIZ)
        self.assertFalse(os.path.exists(d + '/args'))

    def test_en_el_sandbox_usa_flatpak_spawn_con_directorio_y_bash_lic(self):
        env, d = self.entorno(True)
        r = self.correr(env, 'host.sh', 'echo', 'a b', "c'd")
        self.assertEqual(r.returncode, 0, r.stderr)
        args = leer(d + '/args').split('\n')
        self.assertEqual(args[:4], ['--host', f'--directory={RAIZ}', 'bash', '-lic'])
        self.assertEqual(r.stdout, "a b c'd\n")

    def test_solo_sandbox_1_fuerza_el_sandbox(self):
        env, d = self.entorno(False)
        env['HOST_SH_SANDBOX'] = '0'
        r = self.correr(env, 'host.sh', 'pwd')
        self.assertEqual(r.stdout.strip(), RAIZ)
        self.assertFalse(os.path.exists(d + '/args'))

    def test_filtra_solo_el_aviso_de_job_control_y_conserva_el_estado(self):
        env, d = self.entorno(True)
        falso(d, 'flatpak-spawn', 'echo "bash: no job control in this shell" >&2\necho "error real" >&2\nexit 3\n')
        r = self.correr(env, 'host.sh', 'true')
        self.assertEqual(r.returncode, 3)
        self.assertEqual(r.stderr, 'error real\n')

    def test_filtra_el_aviso_en_espanol_y_el_ruido_de_nvm(self):
        # QA-180: lo que saca el ~/.bashrc de la Deck en cada orden; un error de npm parecido no se filtra.
        env, d = self.entorno(True)
        ruido = ['bash: no se puede establecer el grupo de proceso de terminal (-1): Función ioctl no apropiada para el dispositivo',
                 'bash: no hay control de trabajos en este shell',
                 'Your user’s .npmrc file (${HOME}/.npmrc)',
                 'has a `globalconfig` and/or a `prefix` setting, which are incompatible with nvm.',
                 'Run `nvm use --delete-prefix v22.23.1 --silent` to unset it.']
        escribir(d + '/ruido', '\n'.join(ruido + ['npm ERR! prefix setting is invalid']) + '\n')
        falso(d, 'flatpak-spawn', f'cat {d}/ruido >&2\n')
        r = self.correr(env, 'host.sh', 'true')
        self.assertEqual(r.stderr, 'npm ERR! prefix setting is invalid\n')

    def test_sin_orden_falla(self):
        env, _ = self.entorno(False)
        self.assertEqual(self.correr(env, 'host.sh').returncode, 2)


if __name__ == '__main__':
    unittest.main()
