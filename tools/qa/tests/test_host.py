"""QA-150: tools/qa/host.sh, con un flatpak-spawn falso en el PATH (sql.sh, en test_sql.py)."""
import os
import shutil
import stat
import subprocess
import unittest

from comun import QA, carpeta, escribir, git, leer

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
        for cmd in ('bash', 'base64', 'tr', 'cat', 'pwd', 'echo', 'printf', 'dirname', 'grep', 'git', 'ln', 'mktemp', 'mkdir', 'rmdir', 'rm', 'ls', 'readlink'):
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
        # QA-239: desde un worktree fuera de la copia principal (el de ci-local.sh), host.sh corre en uno de logs/.
        principal = os.path.dirname(git(RAIZ, 'rev-parse', '--path-format=absolute', '--git-common-dir').strip())
        if RAIZ != principal and not RAIZ.startswith(principal + '/'):
            self.assertTrue(args[1].startswith(f'--directory={principal}/logs/host-sh-wt.'), args[1])
            args[1] = f'--directory={RAIZ}'
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

    def worktree(self) -> tuple[str, str]:
        """Copia principal con dependencias (sin git) y un worktree enlazado fuera de ella, como el del pre-push."""
        principal = carpeta()
        escribir(principal + '/tools/qa/host.sh', leer(os.path.join(QA, 'host.sh')))
        escribir(principal + '/.gitignore', 'node_modules/\n.env\n')
        escribir(principal + '/backend/package.json', '{}')
        escribir(principal + '/frontend/package.json', '{}')
        git(principal, 'init', '-q')
        git(principal, 'add', '.')
        git(principal, 'commit', '-qm', 'base')
        escribir(principal + '/backend/node_modules/x', '')
        escribir(principal + '/frontend/.env', '')
        wt = os.path.join(carpeta(), 'wt')
        git(principal, 'worktree', 'add', '-q', '--detach', wt)
        return principal, wt

    def correr_en(self, env: dict, raiz: str, *args: str):
        return subprocess.run(['bash', raiz + '/tools/qa/host.sh', *args], env=env, capture_output=True, text=True, cwd='/')

    def test_en_un_worktree_enlaza_las_dependencias_de_la_copia_principal(self):
        principal, wt = self.worktree()
        env, _ = self.entorno(False)
        r = self.correr_en(env, wt, 'ls', 'backend/node_modules')
        self.assertEqual((r.returncode, r.stdout), (0, 'x\n'), r.stderr)
        self.assertEqual(os.readlink(wt + '/frontend/.env'), principal + '/frontend/.env')
        self.assertFalse(os.path.lexists(wt + '/frontend/node_modules'))  # lo que la principal no tiene, no se enlaza

    def test_en_el_sandbox_un_worktree_fuera_de_la_principal_corre_en_uno_visible_y_lo_borra(self):
        principal, wt = self.worktree()
        env, d = self.entorno(True)
        r = self.correr_en(env, wt, 'pwd')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('--directory=' + principal + '/logs/host-sh-wt.', leer(d + '/args'))  # QA-227: fuera de .git/
        self.assertEqual([n for n in os.listdir(principal + '/logs') if n.startswith('host-sh-wt.')], [])
        self.assertNotIn('host-sh-wt', git(principal, 'worktree', 'list'))

    def test_en_el_sandbox_un_worktree_invisible_con_cambios_falla_con_motivo(self):
        _, wt = self.worktree()
        escribir(wt + '/tools/qa/host.sh', leer(wt + '/tools/qa/host.sh') + '# cambio\n')
        env, d = self.entorno(True)
        r = self.correr_en(env, wt, 'pwd')
        self.assertEqual(r.returncode, 1)
        self.assertIn('cambios sin commit', r.stderr)
        self.assertFalse(os.path.exists(d + '/args'))

    def test_sin_orden_falla(self):
        env, _ = self.entorno(False)
        self.assertEqual(self.correr(env, 'host.sh').returncode, 2)


if __name__ == '__main__':
    unittest.main()
