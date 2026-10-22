"""QA-210: .githooks/commit-msg pide, solo con CLAUDECODE=1, una línea «Siguiente: …» (merges y revert pasan)."""
import os
import subprocess
import unittest

from comun import ENV_GIT, QA, carpeta, escribir

RAIZ = os.path.abspath(os.path.join(QA, '..', '..'))
HOOK = os.path.join(RAIZ, '.githooks', 'commit-msg')


class CommitMsg(unittest.TestCase):
    def correr(self, mensaje: str, claudecode: bool = True) -> int:
        ruta = os.path.join(carpeta(), 'COMMIT_EDITMSG')
        escribir(ruta, mensaje)
        env = {k: v for k, v in ENV_GIT.items() if k != 'CLAUDECODE'}
        if claudecode:
            env['CLAUDECODE'] = '1'
        # Fuera de un repo: el gancho no ve el MERGE_HEAD del proyecto real.
        return subprocess.run(['bash', HOOK, ruta], cwd=os.path.dirname(ruta), env=env, capture_output=True, text=True).returncode

    def test_sin_siguiente_falla_y_con_siguiente_pasa(self):
        self.assertEqual(self.correr('Tanda 21: algo\n\nCuerpo.\n\nCo-Authored-By: x\n'), 1)
        self.assertEqual(self.correr('Tanda 21: algo\n\nCuerpo.\n\nSiguiente: fase de PR\n\nCo-Authored-By: x\n'), 0)

    def test_siguiente_vacio_o_solo_en_un_comentario_falla(self):
        self.assertEqual(self.correr('x\n\nSiguiente:\n'), 1)
        self.assertEqual(self.correr('x\n# Siguiente: algo\n'), 1)

    def test_merge_revert_y_fuera_de_claude_code_pasan(self):
        self.assertEqual(self.correr("Merge remote-tracking branch 'origin/main'\n"), 0)
        self.assertEqual(self.correr('Revert "x"\n'), 0)
        self.assertEqual(self.correr('x\n', claudecode=False), 0)


    def test_un_merge_con_mensaje_propio_pasa(self):
        repo = carpeta()
        for args in (('init', '-q', '-b', 'main'), ('commit', '-q', '--allow-empty', '-m', 'base'),
                     ('checkout', '-q', '-b', 'otra'), ('commit', '-q', '--allow-empty', '-m', 'b'),
                     ('checkout', '-q', 'main'), ('commit', '-q', '--allow-empty', '-m', 'c')):
            subprocess.run(['git', *args], cwd=repo, env=ENV_GIT, check=True, capture_output=True)
        r = subprocess.run(['git', '-c', f'core.hooksPath={os.path.dirname(HOOK)}', 'merge', '--no-ff', 'otra', '-m',
                            'Fusiona la rama de un subagente'], cwd=repo, env={**ENV_GIT, 'CLAUDECODE': '1'},
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)


if __name__ == '__main__':
    unittest.main()
