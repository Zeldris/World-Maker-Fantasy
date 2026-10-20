"""QA-171: tools/roadmap/cerrar.py tacha la tarea en su roadmap y en el mapa y abre «Hecho recientemente»."""
import os
import subprocess
import unittest

from comun import QA, carpeta, escribir, leer

CERRAR = os.path.join(QA, '..', 'roadmap', 'cerrar.py')

ROADMAP = """# Roadmap

- **QA-1 · Una línea**: hace algo.
- **QA-2 · Varias líneas** (propuesta 1): empieza aquí
  y sigue aquí.
- ~~**QA-3 · Ya cerrada**~~ ✅ 2026-10-01: hecha.
- **QA-4 · Otra**: queda abierta.
"""
MAPA = """| Hito | Tareas |
|---|---|
| `0.3` | `QA-1` · `QA-2`…`QA-3` · ~~`QA-3`~~ · `QA-4` |
"""
BITACORA = """# Bitácora

## Hecho recientemente

""" + ''.join(f'- **2026-10-0{i}** — ~~`X-{i}`~~ hecho {i}.\n' for i in range(9, -1, -1)) + """
## Siguiente
"""


class Cerrar(unittest.TestCase):
    def setUp(self):
        self.raiz = carpeta()
        escribir(os.path.join(self.raiz, 'docs', 'producto', 'roadmap-front.md'), ROADMAP)
        escribir(os.path.join(self.raiz, 'docs', 'producto', '21-roadmap.md'), MAPA)
        escribir(os.path.join(self.raiz, 'docs', 'registros', 'traspaso.md'), BITACORA)

    def cerrar(self, *args):
        return subprocess.run(['python3', CERRAR, *args, '--fecha', '2026-10-20'], capture_output=True, text=True,
                              env={**os.environ, 'CERRAR_RAIZ': self.raiz})

    def doc(self, *ruta):
        return leer(os.path.join(self.raiz, 'docs', *ruta))

    def test_tacha_en_los_tres_sitios(self):
        r = self.cerrar('QA-1', 'nota uno', 'QA-2', 'nota dos', '--bitacora', '(retro): lo que se hizo.')
        self.assertEqual(r.returncode, 0, r.stderr)
        roadmap = self.doc('producto', 'roadmap-front.md')
        self.assertIn('- ~~**QA-1 · Una línea**: hace algo.~~ ✅ 2026-10-20: nota uno', roadmap)
        self.assertIn('- ~~**QA-2 · Varias líneas** (propuesta 1): empieza aquí\n  y sigue aquí.~~ ✅ 2026-10-20: nota dos', roadmap)
        self.assertIn('- **QA-4 · Otra**: queda abierta.', roadmap)
        mapa = self.doc('producto', '21-roadmap.md')
        self.assertIn('~~`QA-1`~~ · ~~`QA-2`…`QA-3`~~ · ~~`QA-3`~~ · `QA-4`', mapa)
        hechos = self.doc('registros', 'traspaso.md').split('## Hecho recientemente\n\n')[1].split('\n\n')[0].split('\n')
        self.assertEqual(hechos[0], '- **2026-10-20** — ~~`QA-1`~~, ~~`QA-2`~~ (retro): lo que se hizo.')
        self.assertEqual(len(hechos), 10)
        self.assertNotIn('X-0', hechos[-1])

    def test_rango_a_medias_avisa_y_no_lo_tacha(self):
        r = self.cerrar('QA-4', 'nota')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('~~`QA-4`~~', self.doc('producto', '21-roadmap.md'))
        escribir(os.path.join(self.raiz, 'docs', 'producto', '21-roadmap.md'), '| `0.3` | `QA-1`…`QA-2` |\n')
        r = self.cerrar('QA-1', 'nota')
        self.assertIn('no se cierran todas las del rango', r.stdout)
        self.assertIn('| `0.3` | `QA-1`…`QA-2` |', self.doc('producto', '21-roadmap.md'))

    def test_ya_tachada_o_inexistente_no_toca_nada(self):
        for ident in ('QA-3', 'QA-99'):
            r = self.cerrar('QA-1', 'nota', ident, 'nota')
            self.assertEqual(r.returncode, 1)
            self.assertIn(ident, r.stderr)
        self.assertEqual(self.doc('producto', 'roadmap-front.md'), ROADMAP)
        self.assertEqual(self.doc('producto', '21-roadmap.md'), MAPA)


if __name__ == '__main__':
    unittest.main()
