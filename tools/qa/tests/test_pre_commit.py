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
