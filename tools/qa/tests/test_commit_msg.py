"""QA-210 y QA-239, con el `commit-msg` del flujo v0.6.0: pide un trailer `Siguiente:` en el bloque final (también fuera
de Claude Code; `GW_NO_NEXT=1` lo salta), deja pasar merges y revert en curso, y comprueba la fecha de la bitácora
cuando el commit la cambia.

El gancho saca la raíz de su propia ruta: cada test monta un repo con su copia de `.githooks/commit-msg`, los scripts
del flujo y el `.claude/gw.json` de WMF, y hace commits de verdad en él."""
import os
import shutil
import subprocess
import unittest

from comun import ENV_GIT, RAIZ, carpeta, config_gw, escribir

ENV_HOOK = {k: v for k, v in ENV_GIT.items() if k != 'GW_NO_NEXT'}


def repo_con_flujo() -> str:
    repo = carpeta()
    subprocess.run(['git', 'init', '-q', '-b', 'main'], cwd=repo, env=ENV_GIT, check=True, capture_output=True)
    os.makedirs(os.path.join(repo, '.githooks'))
    shutil.copy(os.path.join(RAIZ, '.githooks', 'commit-msg'), os.path.join(repo, '.githooks', 'commit-msg'))
    for sub in ('scripts', 'schema'):
        shutil.copytree(os.path.join(RAIZ, '.claude', 'gw', sub), os.path.join(repo, '.claude', 'gw', sub),
                        ignore=shutil.ignore_patterns('__pycache__'))
    config_gw(repo)
    subprocess.run(['git', 'add', '-A'], cwd=repo, env=ENV_GIT, check=True)
    subprocess.run(['git', 'commit', '-qm', 'base'], cwd=repo, env=ENV_GIT, check=True)  # sin gancho
    return repo


def commit(repo: str, *args: str, env: dict = None) -> subprocess.CompletedProcess:
    return subprocess.run(['git', '-c', 'core.hooksPath=.githooks', 'commit', '-q', *args], cwd=repo,
                          env=env or ENV_HOOK, capture_output=True, text=True)


class CommitMsg(unittest.TestCase):
    def setUp(self):
        self.repo = repo_con_flujo()

    def mensaje(self, texto: str, **env) -> subprocess.CompletedProcess:
        return commit(self.repo, '--allow-empty', '-m', texto, env={**ENV_HOOK, **env})

    def test_sin_siguiente_falla_y_con_siguiente_en_el_bloque_final_pasa(self):
        r = self.mensaje('Tanda 21: algo\n\nCuerpo.\n\nCo-Authored-By: x <x@x>')
        self.assertEqual(r.returncode, 1)
        self.assertIn('Siguiente:', r.stderr)
        r = self.mensaje('Tanda 21: algo\n\nCuerpo.\n\nSiguiente: fase de PR\nCo-Authored-By: x <x@x>')
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_siguiente_fuera_del_bloque_final_vacio_o_en_un_comentario_falla(self):
        # Git solo lee como trailers el último párrafo (retro de la v0.6.0, R1).
        self.assertEqual(self.mensaje('x\n\nSiguiente: fase de PR\n\nCo-Authored-By: x <x@x>').returncode, 1)
        self.assertEqual(self.mensaje('x\n\nSiguiente:').returncode, 1)
        self.assertEqual(commit(self.repo, '--allow-empty', '--cleanup=strip', '-m', 'x\n# Siguiente: algo').returncode, 1)

    def test_gw_no_next_salta_la_regla(self):
        self.assertEqual(self.mensaje('x', GW_NO_NEXT='1').returncode, 0)

    def test_un_merge_con_mensaje_propio_pasa(self):
        for args in (('checkout', '-q', '-b', 'otra'), ('commit', '-q', '--allow-empty', '-m', 'b'),
                     ('checkout', '-q', 'main'), ('commit', '-q', '--allow-empty', '-m', 'c')):
            subprocess.run(['git', *args], cwd=self.repo, env=ENV_GIT, check=True, capture_output=True)
        r = subprocess.run(['git', '-c', 'core.hooksPath=.githooks', 'merge', '--no-ff', 'otra', '-m',
                            'Fusiona la rama de un subagente'], cwd=self.repo, env=ENV_HOOK, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_una_bitacora_con_actualizado_viejo_falla_al_hacer_el_commit(self):
        log = os.path.join(self.repo, 'docs', 'records', 'traspaso.md')
        fila = "| **Tarea en curso · `main`** | algo |\n"

        def con_fecha(fecha):
            escribir(log, f'| **Actualizado** | {fecha} |\n' + fila)
            subprocess.run(['git', 'add', '-A'], cwd=self.repo, env=ENV_GIT, check=True)
            return commit(self.repo, '-m', 'x\n\nSiguiente: y')
        r = con_fecha('2020-01-01')
        self.assertEqual(r.returncode, 1)
        self.assertIn('set today', r.stdout + r.stderr)
        hoy = subprocess.run(['date', '+%F'], capture_output=True, text=True).stdout.strip()
        r = con_fecha(hoy)
        self.assertEqual(r.returncode, 0, r.stderr)
        # Un commit que no cambia la bitácora no la comprueba, aunque la copia de trabajo esté mal.
        escribir(log, '| **Actualizado** | 2020-01-01 |\n' + fila)
        escribir(os.path.join(self.repo, 'otro.txt'), 'x')
        subprocess.run(['git', 'add', 'otro.txt'], cwd=self.repo, env=ENV_GIT, check=True)
        r = commit(self.repo, '-m', 'x\n\nSiguiente: y')
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_un_revert_que_trae_la_fecha_vieja_de_la_bitacora_pasa(self):
        log = os.path.join(self.repo, 'docs', 'records', 'traspaso.md')
        hoy = subprocess.run(['date', '+%F'], capture_output=True, text=True).stdout.strip()
        for fecha in ('2020-01-01', hoy):  # sin el gancho: la fecha vieja entra
            escribir(log, f'| **Actualizado** | {fecha} |\n| **Tarea en curso · `main`** | algo |\n')
            subprocess.run(['git', 'add', '-A'], cwd=self.repo, env=ENV_GIT, check=True)
            subprocess.run(['git', 'commit', '-qm', fecha], cwd=self.repo, env=ENV_GIT, check=True)
        # `git revert` no lanza commit-msg; sí el `git commit` que cierra un revert con conflicto o --no-commit.
        subprocess.run(['git', 'revert', '--no-commit', 'HEAD'], cwd=self.repo, env=ENV_GIT, check=True)
        r = commit(self.repo, '--no-edit')
        self.assertEqual(r.returncode, 0, r.stderr)


if __name__ == '__main__':
    unittest.main()
