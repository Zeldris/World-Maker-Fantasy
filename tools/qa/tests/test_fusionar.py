"""QA-135: tools/qa/fusionar.sh y resolver_hallazgos.py, con un repo de prueba (sin backend ni frontend: sin tests de paquete)."""
import os
import shutil
import subprocess
import unittest

from comun import ENV_GIT, QA, carpeta, escribir, git, leer

H = 'docs/registros/pruebas-0.3-hallazgos.md'


def tabla(*estados: str) -> str:
    return ''.join(f'| P{i + 1} | texto | {e} |\n' for i, e in enumerate(estados))


class Fusionar(unittest.TestCase):
    def repo(self) -> str:
        d = carpeta()
        git(d, 'init', '-q', '-b', 'main')
        os.makedirs(os.path.join(d, 'tools', 'qa'))
        for f in ('fusionar.sh', 'resolver_hallazgos.py'):
            shutil.copy(os.path.join(QA, f), os.path.join(d, 'tools', 'qa', f))
        escribir(os.path.join(d, H), tabla('pendiente', 'pendiente', '✅ ok'))
        git(d, 'add', '-A')
        git(d, 'commit', '-qm', 'base')
        return d

    def fusionar(self, d: str, *args: str):
        return subprocess.run(['bash', 'tools/qa/fusionar.sh', *args], cwd=d, env=ENV_GIT, capture_output=True, text=True)

    def rama(self, d: str, contenido: str, archivo: str = H) -> None:
        git(d, 'checkout', '-qb', 'sub')
        escribir(os.path.join(d, archivo), contenido)
        git(d, 'commit', '-qam', 'sub')
        git(d, 'checkout', '-q', 'main')

    def test_conflicto_de_hallazgos_se_queda_con_el_no_pendiente(self):
        d = self.repo()
        self.rama(d, tabla('✅ hecho', 'pendiente', '✅ ok'))
        escribir(os.path.join(d, H), tabla('pendiente otra', 'pendiente', '✅ ok'))
        git(d, 'commit', '-qam', 'main')
        r = self.fusionar(d, 'sub', 'Fusiona', '--revisada')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('resuelto', r.stdout)
        self.assertNotIn('Sin --revisada', r.stdout)
        self.assertEqual(leer(os.path.join(d, H)), tabla('✅ hecho', 'pendiente', '✅ ok'))

    def test_si_el_resolver_falla_el_registro_queda_intacto(self):
        d = self.repo()
        self.rama(d, tabla('✅ hecho', 'pendiente', '✅ ok').replace('P1', 'P9'))  # otro hallazgo en la misma fila
        escribir(os.path.join(d, H), tabla('pendiente otra', 'pendiente', '✅ ok'))
        git(d, 'commit', '-qam', 'main')
        r = self.fusionar(d, 'sub', 'Fusiona')
        self.assertEqual(r.returncode, 1)
        self.assertIn('FALLO', r.stdout)
        # Las marcas de conflicto siguen ahí y el archivo no está vacío.
        self.assertIn('<<<<<<<', leer(os.path.join(d, H)))
        self.assertIn('P1', leer(os.path.join(d, H)))

    def test_otro_conflicto_para_y_lo_lista(self):
        d = self.repo()
        escribir(os.path.join(d, 'a.txt'), '1\n')
        git(d, 'add', '-A')
        git(d, 'commit', '-qm', 'a')
        self.rama(d, '2\n', 'a.txt')
        escribir(os.path.join(d, 'a.txt'), '3\n')
        git(d, 'commit', '-qam', 'main')
        r = self.fusionar(d, 'sub', 'Fusiona')
        self.assertEqual(r.returncode, 1)
        self.assertIn('a.txt', r.stdout)

    def test_ya_fusionada_no_hace_nada(self):
        d = self.repo()
        self.rama(d, tabla('✅ hecho', 'pendiente', '✅ ok'))
        self.assertEqual(self.fusionar(d, 'sub', 'Fusiona', '--revisada').returncode, 0)
        r = self.fusionar(d, 'sub', 'Otra vez', '--revisada')
        self.assertEqual(r.returncode, 0)
        self.assertIn('Nada que fusionar', r.stdout)

    def test_sin_revisada_lo_recuerda(self):
        d = self.repo()
        self.rama(d, tabla('✅ hecho', 'pendiente', '✅ ok'))
        r = self.fusionar(d, 'sub', 'Fusiona')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('Sin --revisada: confirma el /code-review', r.stdout)
        self.assertIn('resto: 1 archivos', r.stdout)


if __name__ == '__main__':
    unittest.main()
