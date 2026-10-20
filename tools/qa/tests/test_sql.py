"""QA-150: tools/qa/sql.sh, con un psql y un podman falsos en el PATH (por host.sh)."""
import unittest

from test_host import Entorno, falso


class Sql(Entorno, unittest.TestCase):
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
