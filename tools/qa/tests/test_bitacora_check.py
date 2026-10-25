"""QA-237: tools/qa/bitacora-check.sh, en un repo de prueba con los scripts del flujo y la rama ya subida."""
import os
import shutil
import subprocess
import unittest

from comun import ENV_GIT, GW, QA, carpeta, config_gw, escribir, git, leer

FILA = '| **Tarea en curso · `main`** | algo |\n\n'


class BitacoraCheck(unittest.TestCase):
    def setUp(self):
        self.repo = carpeta()
        git(self.repo, 'init', '-q', '-b', 'main')
        config_gw(self.repo)
        shutil.copytree(os.path.dirname(GW), os.path.join(self.repo, '.claude', 'gw'), ignore=shutil.ignore_patterns('__pycache__'))
        escribir(os.path.join(self.repo, 'tools', 'qa', 'bitacora-check.sh'), leer(os.path.join(QA, 'bitacora-check.sh')))
        self.escribir('- **QA-1 · Una**\n', '## Hecho recientemente\n\n- nada\n')
        git(self.repo, 'add', '-A')
        git(self.repo, 'commit', '-q', '-m', 'base')
        git(self.repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD')  # la rama, ya subida

    def escribir(self, roadmap: str, hecho: str) -> None:
        escribir(os.path.join(self.repo, 'docs/producto/roadmap.md'), roadmap)
        escribir(os.path.join(self.repo, 'docs/registros/traspaso.md'), FILA + hecho)

    def correr(self):
        return subprocess.run(['bash', os.path.join(self.repo, 'tools', 'qa', 'bitacora-check.sh')], cwd='/',
                              env=ENV_GIT, capture_output=True, text=True)

    def test_una_tachada_sin_commit_que_falta_en_hecho_recientemente_falla(self):
        self.escribir('- ~~**QA-1 · Una**~~ ✅\n', '## Hecho recientemente\n\n- nada\n')
        r = self.correr()
        self.assertEqual(r.returncode, 1)
        self.assertIn('QA-1 is closed in the plan', r.stdout)

    def test_apuntada_en_hecho_recientemente_pasa(self):
        self.escribir('- ~~**QA-1 · Una**~~ ✅\n', '## Hecho recientemente\n\n- ~~`QA-1`~~ hecho\n')
        r = self.correr()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_un_plan_nuevo_sin_anadir_tambien_cuenta(self):
        escribir(os.path.join(self.repo, 'docs/producto/otro.md'), '- ~~**QA-2 · Dos**~~ ✅\n')
        r = self.correr()
        self.assertEqual(r.returncode, 1)
        self.assertIn('QA-2 is closed in the plan', r.stdout)

    def test_tocar_la_fila_de_otra_rama_falla_salvo_compartida(self):
        ruta = os.path.join(self.repo, 'docs/registros/traspaso.md')
        escribir(ruta, leer(ruta) + '| **Tarea en curso · `otra`** | x |\n')
        git(self.repo, 'commit', '-qam', 'fila de otra')
        git(self.repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD')
        escribir(ruta, leer(ruta).replace('| x |', '| y |'))
        r = self.correr()
        self.assertEqual(r.returncode, 1)
        self.assertIn('not main', r.stdout)
        r = subprocess.run(['bash', os.path.join(self.repo, 'tools', 'qa', 'bitacora-check.sh')], cwd='/',
                           env={**ENV_GIT, 'BITACORA_COMPARTIDA': '1'}, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_una_fila_mal_formada_falla_aunque_la_rama_no_este_subida(self):
        git(self.repo, 'update-ref', '-d', 'refs/remotes/origin/main')
        escribir(os.path.join(self.repo, 'docs/registros/traspaso.md'), '| **Tarea en curso** | algo |\n')
        r = self.correr()
        self.assertEqual(r.returncode, 1)
        self.assertIn('there is no row', r.stdout)


if __name__ == '__main__':
    unittest.main()
