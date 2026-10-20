"""QA-150: tools/qa/host.sh y sql.sh, con un flatpak-spawn, un psql y un podman falsos en el PATH."""
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


class Host(unittest.TestCase):
    def entorno(self, sandbox: bool, **extra: str) -> tuple[dict, str]:
        d = carpeta()
        # flatpak-spawn falso: anota los argumentos (uno por línea) y ejecuta la orden (lo que sigue a «--host --directory=…»).
        falso(d, 'flatpak-spawn', f'printf "%s\\n" "$@" > {d}/args\nshift 2\nexec "$@"\n')
        # El PATH solo trae los falsos y las utilidades del sistema; sin psql real.
        sistema = os.path.join(d, 'sistema')
        os.makedirs(sistema)
        for cmd in ('bash', 'base64', 'tr', 'cat', 'pwd', 'echo', 'printf', 'dirname'):
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

    def test_sin_orden_falla(self):
        env, _ = self.entorno(False)
        self.assertEqual(self.correr(env, 'host.sh').returncode, 2)

    def test_sql_con_psql_lee_stdin_y_conserva_comillas(self):
        env, d = self.entorno(False)
        falso(d, 'psql', 'echo "URL=$1"; cat\n')
        consulta = 'select "Save".id from "Save" where x = \'a\''
        r = self.correr(env, 'sql.sh', entrada=consulta)
        self.assertIn('URL=postgresql://tarkor:tarkor@localhost:5432/tarkor_juego', r.stdout)
        self.assertIn(consulta, r.stdout)

    def test_sql_sin_psql_usa_podman_y_url_sobrescrita_en_sandbox(self):
        env, d = self.entorno(True, TARKOR_DB_URL='postgresql://x/y')
        falso(d, 'podman', 'echo "podman $*"; cat\n')
        r = self.correr(env, 'sql.sh', 'select 1')
        self.assertIn('podman exec -i tarkor-postgres psql postgresql://x/y', r.stdout)
        self.assertIn('select 1', r.stdout)


if __name__ == '__main__':
    unittest.main()
