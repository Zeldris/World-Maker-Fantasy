"""QA-113: el `enlaces-md.py` de Galivelop-workflow (antes tools/qa/enlaces-md.py, QA-107; piloto 2026-10-22), sobre un
repo de prueba con su `gw.json`."""
import os
import shutil
import subprocess
import unittest

from comun import RAIZ, carpeta, config_gw, escribir, git

DESTINO = '# Guía\n\n## Cómo se usa\n\n## Cómo se usa\n\n<a id="propia"></a>\n'


class EnlacesMd(unittest.TestCase):
    def comprobar(self, texto: str, *args: str, archivo: str = 'docs/a.md') -> subprocess.CompletedProcess:
        repo = carpeta()
        git(repo, 'init', '-q')
        config_gw(repo)
        escribir(os.path.join(repo, 'docs/guia.md'), DESTINO)
        escribir(os.path.join(repo, archivo), texto)
        git(repo, 'add', '-A')
        # El script saca la raíz de su carpeta (la de WMF ya tiene gw.json): se copian scripts y esquema al repo.
        for ruta in ('.claude/gw/scripts', '.claude/gw/schema'):
            shutil.copytree(os.path.join(RAIZ, ruta), os.path.join(repo, ruta))
        destino = os.path.join(repo, '.claude', 'gw', 'scripts')
        return subprocess.run(['python3', os.path.join(destino, 'enlaces-md.py'), *args], cwd=repo,
                              capture_output=True, text=True)

    def test_enlaces_y_anclas_buenos_pasan(self):
        r = self.comprobar('[a](guia.md) [b](guia.md#cómo-se-usa-1) [c](guia.md#C%C3%B3mo-se-usa) [d](guia.md#propia) '
                           '[e](https://x.y/nada) [f](#título)\n\n# Título\n')
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_archivo_roto_falla(self):
        r = self.comprobar('[a](falta.md)\n')
        self.assertEqual(r.returncode, 1)
        self.assertIn('docs/a.md:1: no such file falta.md', r.stdout)

    def test_ancla_rota_falla_salvo_con_solo_archivos(self):
        self.assertIn('has no heading with the anchor #otra', self.comprobar('[a](guia.md#otra)\n').stdout)
        self.assertEqual(self.comprobar('[a](guia.md#otra)\n', '--files-only').returncode, 0)

    def test_dentro_de_bloques_de_codigo_no_se_mira(self):
        r = self.comprobar('```\n[a](falta.md)\n```\n  ~~~\n[b](falta.md)\n  ~~~\n`[c](falta.md)`\n')
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_descripcion_de_pr_enlaza_desde_su_carpeta(self):
        """QA-184: el flujo no tiene la excepción de WMF para `docs/registros/pr/` (enlaces desde la raíz); las
        descripciones enlazan como cualquier .md (fricción 14 del piloto)."""
        r = self.comprobar('[a](../../../guia.md#cómo-se-usa)\n', archivo='docs/registros/pr/claude/rama.md')
        self.assertEqual(r.returncode, 0, r.stdout)
        r = self.comprobar('[a](docs/guia.md)\n', archivo='docs/registros/pr/claude/rama.md')
        self.assertIn('no such file docs/guia.md', r.stdout)


if __name__ == '__main__':
    unittest.main()
