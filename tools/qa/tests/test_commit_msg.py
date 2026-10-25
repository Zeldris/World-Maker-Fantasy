"""QA-210: .githooks/commit-msg pide, solo con CLAUDECODE=1, una línea «Siguiente: …» (merges y revert pasan)."""
import os
import subprocess
import unittest

from comun import ENV_GIT, QA, carpeta, escribir

RAIZ = os.path.abspath(os.path.join(QA, '..', '..'))
HOOK = os.path.join(RAIZ, '.githooks', 'commit-msg')


def ganchos() -> str:
    """QA-239: solo commit-msg. Con core.hooksPath=.githooks corría también el pre-commit, que saca la raíz de su
    propia ruta y miraba el índice del proyecto real (en un worktree, .git es un archivo y fallaba)."""
    d = carpeta()
    escribir(os.path.join(d, 'commit-msg'), f'#!/bin/bash\nexec bash {HOOK} "$@"\n')
    os.chmod(os.path.join(d, 'commit-msg'), 0o755)
    return d


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
        r = subprocess.run(['git', '-c', f'core.hooksPath={ganchos()}', 'merge', '--no-ff', 'otra', '-m',
                            'Fusiona la rama de un subagente'], cwd=repo, env={**ENV_GIT, 'CLAUDECODE': '1'},
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)


    def test_una_bitacora_con_actualizado_viejo_falla_al_hacer_el_commit(self):
        repo = carpeta()
        subprocess.run(['git', 'init', '-q', '-b', 'main'], cwd=repo, env=ENV_GIT, check=True, capture_output=True)
        log = os.path.join(repo, 'docs', 'registros', 'traspaso.md')
        fila = "| **Tarea en curso · `main`** | algo |\n"

        def commit(fecha):
            escribir(log, f'| **Actualizado** | {fecha} |\n' + fila)
            subprocess.run(['git', 'add', '-A'], cwd=repo, env=ENV_GIT, check=True)
            return subprocess.run(['git', '-c', f'core.hooksPath={ganchos()}', 'commit', '-q', '-m',
                                   'x\n\nSiguiente: y'], cwd=repo, env={**ENV_GIT, 'CLAUDECODE': '1'},
                                  capture_output=True, text=True)
        r = commit('2020-01-01')
        self.assertEqual(r.returncode, 1)
        self.assertIn('set today', r.stdout + r.stderr)
        hoy = subprocess.run(['date', '+%F'], capture_output=True, text=True).stdout.strip()
        r = commit(hoy)
        self.assertEqual(r.returncode, 0, r.stderr)
        # Un commit que no cambia la bitácora no la comprueba, aunque la copia de trabajo esté mal.
        escribir(log, '| **Actualizado** | 2020-01-01 |\n' + fila)
        escribir(os.path.join(repo, 'otro.txt'), 'x')
        subprocess.run(['git', 'add', 'otro.txt'], cwd=repo, env=ENV_GIT, check=True)
        r = subprocess.run(['git', '-c', f'core.hooksPath={ganchos()}', 'commit', '-q', '-m',
                            'x\n\nSiguiente: y'], cwd=repo, env={**ENV_GIT, 'CLAUDECODE': '1'},
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_un_revert_que_trae_la_fecha_vieja_de_la_bitacora_pasa(self):
        repo = carpeta()
        log = os.path.join(repo, 'docs', 'registros', 'traspaso.md')
        hoy = subprocess.run(['date', '+%F'], capture_output=True, text=True).stdout.strip()
        subprocess.run(['git', 'init', '-q', '-b', 'main'], cwd=repo, env=ENV_GIT, check=True, capture_output=True)
        for fecha in ('2020-01-01', hoy):  # sin el gancho: la fecha vieja entra
            escribir(log, f'| **Actualizado** | {fecha} |\n| **Tarea en curso · `main`** | algo |\n')
            subprocess.run(['git', 'add', '-A'], cwd=repo, env=ENV_GIT, check=True)
            subprocess.run(['git', 'commit', '-qm', fecha], cwd=repo, env=ENV_GIT, check=True)
        # `git revert` no lanza commit-msg; sí el `git commit` que cierra un revert con conflicto o --no-commit.
        subprocess.run(['git', 'revert', '--no-commit', 'HEAD'], cwd=repo, env=ENV_GIT, check=True)
        r = subprocess.run(['git', '-c', f'core.hooksPath={ganchos()}', 'commit', '-q', '--no-edit'],
                           cwd=repo, env={**ENV_GIT, 'CLAUDECODE': '1'}, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)


if __name__ == '__main__':
    unittest.main()
