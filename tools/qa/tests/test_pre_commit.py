"""QA-144: .githooks/pre-commit rechaza, solo con CLAUDECODE=1, archivos preparados de docs/borradores-opencode/."""
import os
import subprocess
import unittest

from comun import ENV_GIT, QA, carpeta, escribir, git

RAIZ = os.path.abspath(os.path.join(QA, '..', '..'))
HOOK = os.path.join(RAIZ, '.githooks', 'pre-commit')


class PreCommit(unittest.TestCase):
    def setUp(self):
        self.repo = carpeta()
        git(self.repo, 'init', '-q', '-b', 'main')
        escribir(os.path.join(self.repo, 'README.md'), 'x')
        git(self.repo, 'add', '-A')
        git(self.repo, 'commit', '-q', '-m', 'base')

    def preparar(self, *rutas: str) -> None:
        for r in rutas:
            escribir(os.path.join(self.repo, r), 'texto')
            git(self.repo, 'add', r)

    def correr(self, claudecode: bool) -> subprocess.CompletedProcess:
        env = {k: v for k, v in ENV_GIT.items() if k != 'CLAUDECODE'}
        if claudecode:
            env['CLAUDECODE'] = '1'
        return subprocess.run(['bash', HOOK], cwd=self.repo, env=env, capture_output=True, text=True)

    def git_real(self, *args: str) -> subprocess.CompletedProcess:
        """Un git de verdad con CLAUDECODE=1 y el gancho por core.hooksPath."""
        return subprocess.run(['git', '-c', f'core.hooksPath={os.path.dirname(HOOK)}', *args], cwd=self.repo,
                              env={**ENV_GIT, 'CLAUDECODE': '1'}, capture_output=True, text=True)

    def con_borrador_commiteado(self):
        escribir(os.path.join(self.repo, 'docs/borradores-opencode/idea.md'), 'texto')
        git(self.repo, 'add', '-A')
        git(self.repo, 'commit', '-q', '--no-verify', '-m', 'borrador')

    def test_merge_de_una_rama_con_borrador_commiteado_pasa(self):
        git(self.repo, 'checkout', '-q', '-b', 'otra')
        self.con_borrador_commiteado()
        git(self.repo, 'checkout', '-q', 'main')
        escribir(os.path.join(self.repo, 'otro.md'), 'y')
        git(self.repo, 'add', 'otro.md')
        git(self.repo, 'commit', '-q', '-m', 'main avanza')
        r = self.git_real('merge', '--no-ff', '-m', 'merge', 'otra')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('docs/borradores-opencode/idea.md', git(self.repo, 'ls-files'))

    def test_cerrar_un_merge_con_conflicto_a_mano_pasa(self):
        escribir(os.path.join(self.repo, 'c.md'), 'base')
        git(self.repo, 'add', 'c.md')
        git(self.repo, 'commit', '-q', '-m', 'c')
        git(self.repo, 'checkout', '-q', '-b', 'otra')
        escribir(os.path.join(self.repo, 'c.md'), 'otra')
        git(self.repo, 'add', 'c.md')
        self.con_borrador_commiteado()
        git(self.repo, 'checkout', '-q', 'main')
        escribir(os.path.join(self.repo, 'c.md'), 'main')
        git(self.repo, 'commit', '-q', '-am', 'c main')
        self.assertNotEqual(self.git_real('merge', '--no-ff', 'otra').returncode, 0)
        escribir(os.path.join(self.repo, 'c.md'), 'resuelto')
        git(self.repo, 'add', 'c.md')
        r = self.git_real('commit', '--no-edit')
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_conflicto_con_un_borrador_nuevo_sin_commitear_rechaza(self):
        escribir(os.path.join(self.repo, 'c.md'), 'base')
        git(self.repo, 'add', 'c.md')
        git(self.repo, 'commit', '-q', '-m', 'c')
        git(self.repo, 'checkout', '-q', '-b', 'otra')
        escribir(os.path.join(self.repo, 'c.md'), 'otra')
        git(self.repo, 'commit', '-q', '-am', 'c otra')
        git(self.repo, 'checkout', '-q', 'main')
        escribir(os.path.join(self.repo, 'c.md'), 'main')
        git(self.repo, 'commit', '-q', '-am', 'c main')
        self.assertNotEqual(self.git_real('merge', '--no-ff', 'otra').returncode, 0)
        escribir(os.path.join(self.repo, 'c.md'), 'resuelto')
        escribir(os.path.join(self.repo, 'docs/borradores-opencode/nuevo.md'), 'de Álvaro')
        git(self.repo, 'add', 'c.md', 'docs/')
        r = self.git_real('commit', '--no-edit')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('docs/borradores-opencode/nuevo.md', r.stderr)

    def test_renombrar_un_borrador_fuera_de_la_carpeta_rechaza(self):
        self.con_borrador_commiteado()
        git(self.repo, 'mv', 'docs/borradores-opencode/idea.md', 'docs/idea.md')
        r = self.git_real('commit', '-m', 'mueve')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('git restore --staged', r.stderr)

    def test_borrar_un_borrador_rechaza(self):
        self.con_borrador_commiteado()
        git(self.repo, 'rm', '-q', 'docs/borradores-opencode/idea.md')
        self.assertNotEqual(self.git_real('commit', '-m', 'borra').returncode, 0)

    def test_es_ejecutable_y_git_lo_registra_asi(self):
        self.assertTrue(os.access(HOOK, os.X_OK))
        modo = subprocess.run(['git', 'ls-files', '-s', '.githooks/pre-commit'], cwd=RAIZ,
                              capture_output=True, text=True).stdout.split()[0]
        self.assertEqual(modo, '100755')

    def test_con_claudecode_y_un_borrador_preparado_rechaza(self):
        self.preparar('docs/borradores-opencode/idea.md')
        r = self.correr(True)
        self.assertEqual(r.returncode, 1)
        self.assertIn('git restore --staged docs/borradores-opencode/', r.stderr)
        self.assertIn('docs/borradores-opencode/idea.md', r.stderr)

    def test_sin_claudecode_deja_pasar_el_borrador(self):
        self.preparar('docs/borradores-opencode/idea.md')
        self.assertEqual(self.correr(False).returncode, 0)

    def test_con_claudecode_y_otros_archivos_deja_pasar(self):
        self.preparar('docs/otro.md', 'backend/x.ts')
        self.assertEqual(self.correr(True).returncode, 0)

    def test_un_borrador_sin_preparar_no_cuenta(self):
        escribir(os.path.join(self.repo, 'docs/borradores-opencode/idea.md'), 'texto')
        self.preparar('docs/otro.md')
        self.assertEqual(self.correr(True).returncode, 0)


if __name__ == '__main__':
    unittest.main()
