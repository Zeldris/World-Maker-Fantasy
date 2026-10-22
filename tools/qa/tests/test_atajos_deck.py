"""QA-198 (retro del 2026-10-22): los atajos de tools/qa/deck que llevan a Postgres cargan _path.sh.

`juego.sh` (QA-192) llegó sin `. _path.sh` al PR y no se vio hasta la tanda 14: sin él, en la Deck `arrancar-juego.sh`
no encuentra `psql`. Todo atajo `*.sh` que nombre psql, pg_dump, pg_restore o arrancar-juego.sh, o llame a otro atajo
que lo haga, tiene que cargar `_path.sh` (o ir por `esc.sh`, que ya pone la carpeta en el PATH)."""
import os
import re
import unittest

from comun import QA, leer

DECK = os.path.join(QA, 'deck')
POSTGRES = re.compile(r'\b(psql|pg_dump|pg_restore)\b|arrancar-juego\.sh')
CARGA = re.compile(r'^\s*(\.|source)\s+.*_path\.sh', re.M)
# Sin comentarios: una línea que solo menciona el programa no lo usa.
SIN_COMENTARIOS = re.compile(r'^\s*#.*$', re.M)
EXENTOS = {'_path.sh'}  # es quien añade los envoltorios al PATH


def atajos() -> dict[str, str]:
    return {f: SIN_COMENTARIOS.sub('', leer(os.path.join(DECK, f))) for f in sorted(os.listdir(DECK))
            if f.endswith('.sh') and f not in EXENTOS}


def lleva_a_postgres(nombre: str, codigo: dict[str, str], visitados: frozenset = frozenset()) -> bool:
    texto = codigo[nombre]
    if POSTGRES.search(texto):
        return True
    return any(otro != nombre and otro not in visitados and re.search(rf'\b{re.escape(otro)}\b', texto)
               and lleva_a_postgres(otro, codigo, visitados | {nombre}) for otro in codigo)


class AtajosDeck(unittest.TestCase):
    def test_todo_atajo_que_lleva_a_postgres_carga_path(self):
        codigo = atajos()
        sin_path = [f for f, t in codigo.items()
                    if lleva_a_postgres(f, codigo) and not CARGA.search(t) and not re.search(r'\besc\.sh\b', t)
                    and f != 'esc.sh']
        self.assertEqual(sin_path, [], f'estos atajos de tools/qa/deck usan Postgres y no cargan _path.sh: {sin_path}')

    def test_juego_sh_es_uno_de_los_que_se_vigilan(self):
        codigo = atajos()
        self.assertTrue(lleva_a_postgres('juego.sh', codigo))
        self.assertTrue(CARGA.search(codigo['juego.sh']))


if __name__ == '__main__':
    unittest.main()
