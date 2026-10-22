"""QA-198 (retro del 2026-10-22): todo script que invoque Postgres carga `_path.sh`.

`juego.sh` (QA-192) llegó sin `. _path.sh` al PR y `arrancar-juego.sh` (a donde llevaba) tampoco lo cargaba: en la Deck
no encuentra `psql`. Regla: todo `*.sh` de tools/qa/deck, tools/qa y tools/playwright-e2e que invoque directamente
psql, pg_dump o pg_restore carga `_path.sh` antes de la primera invocación. Sin transitividad: cada script cubre lo suyo.
Se exime `_path.sh` (quien añade los envoltorios al PATH); los envoltorios psql, pg_dump y pg_restore no son `.sh`."""
import os
import re
import unittest

from comun import QA, leer

RAIZ = os.path.abspath(os.path.join(QA, '..', '..'))
CARPETAS = [os.path.join(QA, 'deck'), QA, os.path.join(RAIZ, 'tools', 'playwright-e2e')]
POSTGRES = re.compile(r'\b(psql|pg_dump|pg_restore)\b')
CARGA = re.compile(r'^\s*(\.|source)\s+.*_path\.sh')
EXENTOS = {'_path.sh'}


def codigo(ruta: str) -> list[str]:
    """Líneas con código: sin comentarios (enteros o de final de línea) ni echo/printf, que solo mencionan el programa."""
    out = []
    for linea in leer(ruta).splitlines():
        if re.match(r'^\s*(echo|printf)\b', linea):
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
        for ruta in (os.path.join(QA, 'deck', 'juego.sh'), os.path.join(RAIZ, 'tools', 'playwright-e2e', 'arrancar-juego.sh')):
            lineas = codigo(ruta)
            self.assertIn(ruta, scripts())
            self.assertTrue(any(CARGA.search(l) for l in lineas), ruta)


if __name__ == '__main__':
    unittest.main()
