"""QA-198 (retro del 2026-10-22): todo script que invoque Postgres carga `_path.sh`.

`juego.sh` (QA-192) llegó sin `. _path.sh` al PR y `arrancar-juego.sh` (a donde llevaba) tampoco lo cargaba: en la Deck
no encuentra `psql`. Regla: todo `*.sh` de tools/qa/deck, tools/qa y tools/playwright-e2e que invoque directamente
psql, pg_dump o pg_restore carga `_path.sh` antes de la primera invocación. Sin transitividad: cada script cubre lo suyo.
Se exime `_path.sh` (quien añade los envoltorios al PATH); los envoltorios psql, pg_dump y pg_restore no son `.sh`."""
import os
import re
import tempfile
import unittest

from comun import QA, leer

RAIZ = os.path.abspath(os.path.join(QA, '..', '..'))
CARPETAS = [os.path.join(QA, 'deck'), QA, os.path.join(RAIZ, 'tools', 'playwright-e2e')]
POSTGRES = re.compile(r'\b(psql|pg_dump|pg_restore)\b')
# `. …/_path.sh`, o `. "$N"` con la ruta como argumento posicional dentro de un `bash -c` (sql.sh).
CARGA = re.compile(r'^\s*(\.|source)\s+(\S*_path\.sh|"\$\d")')
EXENTOS = {'_path.sh'}
TUBERIA = re.compile(r'\|\s*(psql|pg_dump|pg_restore)\b')


def codigo(ruta: str) -> list[str]:
    """Líneas con código: sin comentarios (enteros o de final de línea) ni echo/printf que solo mencionan el programa; los
    que llevan una tubería a psql, pg_dump o pg_restore (`printf … | psql`) sí son uso."""
    out = []
    for linea in leer(ruta).splitlines():
        if re.match(r'^\s*(echo|printf)\b', linea) and not TUBERIA.search(linea):
            continue
        out.append(re.sub(r'(^|\s)#.*$', '', linea))
    return out


def scripts() -> list[str]:
    return [os.path.join(c, f) for c in CARPETAS for f in sorted(os.listdir(c)) if f.endswith('.sh') and f not in EXENTOS]


def primera_invocacion(lineas: list[str]) -> int | None:
    return next((i for i, l in enumerate(lineas) if POSTGRES.search(l) and not CARGA.search(l)), None)


class AtajosDeck(unittest.TestCase):
    def test_todo_script_que_invoca_postgres_carga_path_antes(self):
        mal = []
        for ruta in scripts():
            lineas = codigo(ruta)
            uso = primera_invocacion(lineas)
            if uso is None:
                continue
            carga = next((i for i, l in enumerate(lineas) if CARGA.search(l)), None)
            if carga is None or carga > uso:
                mal.append(os.path.relpath(ruta, RAIZ))
        self.assertEqual(mal, [], f'estos scripts invocan psql, pg_dump o pg_restore sin cargar antes _path.sh: {mal}')

    def test_juego_y_arrancar_juego_se_vigilan(self):
        # juego.sh no invoca psql: delega en arrancar-juego.sh, que carga _path.sh (juego.sh también, de respaldo).
        juego = os.path.join(QA, 'deck', 'juego.sh')
        arrancar = os.path.join(RAIZ, 'tools', 'playwright-e2e', 'arrancar-juego.sh')
        self.assertIn(juego, scripts())
        self.assertIn(arrancar, scripts())
        self.assertIsNone(primera_invocacion(codigo(juego)))
        self.assertTrue(any(CARGA.search(l) for l in codigo(arrancar)), arrancar)

    def test_echo_con_tuberia_a_psql_cuenta_como_uso(self):
        ruta = os.path.join(QA, 'sql.sh')
        self.assertIsNotNone(primera_invocacion(codigo(ruta)))

    def test_echo_que_solo_menciona_psql_no_cuenta(self):
        with tempfile.TemporaryDirectory() as d:
            ruta = os.path.join(d, 'x.sh')
            with open(ruta, 'w', encoding='utf-8') as f:
                f.write('echo "usa psql"\nprintf "select 1" | psql -d x\n')
            self.assertEqual(codigo(ruta), ['printf "select 1" | psql -d x'])


if __name__ == '__main__':
    unittest.main()
