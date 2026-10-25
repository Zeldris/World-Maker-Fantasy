"""QA-245: tools/qa/ficha.sh, con un host.sh falso (el real lanza tsx; la lógica se prueba en backend/src/scripts/ficha.test.ts)."""
import os
import shutil
import subprocess
import unittest

from comun import QA, carpeta, escribir

RAIZ = os.path.abspath(os.path.join(QA, '..', '..'))


class Ficha(unittest.TestCase):
    def montar(self, estado: int = 0) -> str:
        """Copia del repo mínimo: ficha.sh y un host.sh falso que anota la orden (la búsqueda en el canon es de ficha.ts)."""
        d = carpeta()
        os.system(f'git init -q {d}')
        os.makedirs(os.path.join(d, 'tools', 'qa'))
        shutil.copy(os.path.join(QA, 'ficha.sh'), os.path.join(d, 'tools', 'qa', 'ficha.sh'))
        escribir(os.path.join(d, 'tools', 'qa', 'host.sh'),
                 '#!/bin/bash\nprintf "%s\\n" "${*:5}" >> "$(dirname "$0")/ordenes"\necho "FICHA $5"; exit ' + str(estado) + '\n')
        return d

    def correr(self, d: str, *args: str):
        return subprocess.run(['bash', os.path.join(d, 'tools', 'qa', 'ficha.sh'), *args], cwd=d, capture_output=True, text=True)

    def ordenes(self, d: str) -> str:
        with open(os.path.join(d, 'tools', 'qa', 'ordenes'), encoding='utf-8') as f:
            return f.read()

    def test_lanza_la_ficha_con_el_slug_y_sin_canon_sin_la_opcion(self):
        d = self.montar()
        r = self.correr(d, 'bicho-raro')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('FICHA bicho-raro', r.stdout)
        self.assertEqual(self.ordenes(d).strip(), 'bicho-raro')

    def test_canon_pasa_la_opcion_a_ficha_ts_en_la_misma_orden(self):
        d = self.montar()
        self.correr(d, '--canon', 'bicho-raro')
        self.assertEqual(self.ordenes(d).strip(), 'bicho-raro --canon')

    def test_slug_inexistente_devuelve_el_codigo_1_de_la_ficha(self):
        d = self.montar(estado=1)
        r = self.correr(d, 'x')
        self.assertEqual((r.returncode, r.stdout.strip()), (1, 'FICHA x'))

    def test_errores_de_uso_salen_con_2_y_su_motivo(self):
        d = self.montar()
        for args, motivo in [((), 'falta el slug'), (('--zzz',), 'opción desconocida: --zzz'), (('a', 'b'), 'sobra «b»')]:
            r = self.correr(d, *args)
            self.assertEqual(r.returncode, 2, args)
            self.assertIn(motivo, r.stderr)
        self.assertFalse(os.path.exists(os.path.join(d, 'tools', 'qa', 'ordenes')))
        r = self.correr(d, '--ayuda')
        self.assertEqual(r.returncode, 0)
        self.assertIn('ficha.sh <slug>', r.stdout)


if __name__ == '__main__':
    unittest.main()
