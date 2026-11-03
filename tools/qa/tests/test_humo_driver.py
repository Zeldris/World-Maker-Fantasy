"""QA-291: `humo-driver.sh` juega el juego y el driver de verdad (lo corre la CI); aquí solo su salida cuando falta
el entorno: en local se omite con un mensaje claro (sale 0) y en la CI (CI=true) es un fallo, no una omisión silenciosa."""
import os
import stat
import subprocess
import unittest

from comun import QA, carpeta, escribir


class HumoDriverSinEntorno(unittest.TestCase):
    def correr(self, **extra):
        d = carpeta()
        psql = os.path.join(d, 'psql')
        escribir(psql, '#!/bin/bash\nexit 1\n')  # un Postgres que no responde
        os.chmod(psql, os.stat(psql).st_mode | stat.S_IEXEC)
        env = {k: v for k, v in os.environ.items() if k != 'CI'}
        env.update({'PATH': d + os.pathsep + os.environ['PATH'], **extra})
        return subprocess.run(['bash', os.path.join(QA, 'humo-driver.sh')], env=env, capture_output=True, text=True, timeout=60)

    def test_sin_postgres_se_omite_en_local(self):
        r = self.correr()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('OMITIDO: sin Postgres', r.stdout)

    def test_sin_postgres_falla_en_la_ci(self):
        r = self.correr(CI='true')
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn('FALLO (CI): sin Postgres', r.stderr)


if __name__ == '__main__':
    unittest.main()
