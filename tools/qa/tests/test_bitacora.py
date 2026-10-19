"""QA-74: tools/qa/bitacora.py (QA-69)."""
import os
import subprocess
import unittest

from comun import QA, carpeta, escribir, git


def comprobar(texto: str, *args: str) -> subprocess.CompletedProcess:
    ruta = os.path.join(carpeta(), 'traspaso.md')
    escribir(ruta, texto)
    return subprocess.run(['python3', os.path.join(QA, 'bitacora.py'), ruta, *args], capture_output=True, text=True)


class Bitacora(unittest.TestCase):
    def test_una_fila_corta_por_rama_pasa(self):
        r = comprobar('| **Tarea en curso · `a`** | algo |\n| **Tarea en curso · `b`** | otra |\n')
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_fila_sin_rama_falla(self):
        r = comprobar('| **Tarea en curso** | algo |\n')
        self.assertEqual(r.returncode, 1)
        self.assertIn('fila sin rama', r.stdout)

    def test_fila_larga_falla(self):
        r = comprobar('| **Tarea en curso · `a`** | ' + 'x' * 601 + ' |\n')
        self.assertEqual(r.returncode, 1)
        self.assertIn('601 caracteres', r.stdout)

    def test_dos_filas_de_la_misma_rama_fallan(self):
        r = comprobar('| **Tarea en curso · `a`** | uno |\n| **Tarea en curso · `a`** | dos |\n')
        self.assertEqual(r.returncode, 1)
        self.assertIn('dos filas', r.stdout)

    def test_sin_ninguna_fila_falla(self):
        self.assertEqual(comprobar('| **Hito** | 0.3 |\n').returncode, 1)

    def test_fecha_anterior_al_commit_falla(self):
        """QA-115: con `--fecha`, «Actualizado» no puede ser de un día anterior."""
        texto = '| **Actualizado** | 2026-10-17 |\n| **Tarea en curso · `a`** | algo |\n'
        r = comprobar(texto, '--fecha', '2026-10-19')
        self.assertEqual(r.returncode, 1)
        self.assertIn('«Actualizado» dice 2026-10-17 y el commit es del 2026-10-19', r.stdout)
        self.assertEqual(comprobar(texto, '--fecha', '2026-10-17').returncode, 0)
        self.assertEqual(comprobar(texto).returncode, 0)

    def test_fecha_mal_escrita_da_uso(self):
        self.assertIn('Uso', comprobar('| **Tarea en curso · `a`** | algo |\n', '--fecha', 'ayer').stderr)


class Cerradas(unittest.TestCase):
    """QA-85: lo que se tacha en un roadmap sale tachado en «Hecho recientemente»."""

    def setUp(self):
        self.repo = carpeta()
        git(self.repo, 'init', '-q')
        self.base = self.commit('- **QA-1 · Una**\n- ~~**QA-2 · Dos**~~ ✅\n', '## Hecho recientemente\n\n- ~~`QA-2`~~\n')

    def commit(self, roadmap: str, bitacora: str) -> str:
        escribir(os.path.join(self.repo, 'docs/producto/roadmap.md'), roadmap)
        escribir(os.path.join(self.repo, 'docs/registros/traspaso.md'), bitacora)
        git(self.repo, 'add', '-A')
        git(self.repo, 'commit', '-q', '-m', 'c')
        return git(self.repo, 'rev-parse', 'HEAD')

    def correr(self, sha: str) -> subprocess.CompletedProcess:
        return subprocess.run(['python3', os.path.join(QA, 'bitacora.py'), '--cerradas', self.base, sha],
                              cwd=self.repo, capture_output=True, text=True)

    def test_tachada_sin_bitacora_falla(self):
        sha = self.commit('- ~~**QA-1 · Una**~~ ✅\n- ~~**QA-2 · Dos**~~ ✅\n',
                          '## Hecho recientemente\n\n- `QA-1` diagnosticado\n- ~~`QA-2`~~\n')
        r = self.correr(sha)
        self.assertEqual(r.returncode, 1)
        self.assertIn('QA-1', r.stdout)

    def test_tachada_en_hecho_recientemente_pasa(self):
        sha = self.commit('- ~~**QA-1 · Una**~~ ✅\n- ~~**QA-2 · Dos**~~ ✅\n',
                          '## Hecho recientemente\n\n- ~~`QA-1`~~ hecho\n- ~~`QA-2`~~\n')
        self.assertEqual(self.correr(sha).returncode, 0)

    def test_un_rango_tachado_cuenta_para_todas(self):
        sha = self.commit('- ~~`QA-1`…`QA-3`~~ ✅\n- ~~**QA-2 · Dos**~~ ✅\n',
                          '## Hecho recientemente\n\n- ~~`QA-1`…`QA-3`~~\n')
        self.assertEqual(self.correr(sha).returncode, 0)

    def test_una_movida_de_hito_no_es_una_cerrada(self):
        sha = self.commit('- ~~**QA-1 · Una**~~ → pasa al `0.4`\n- ~~**QA-2 · Dos**~~ ✅\n', '## Hecho recientemente\n\n- ~~`QA-2`~~\n')
        self.assertEqual(self.correr(sha).returncode, 0)

    def test_lo_que_nombra_el_titulo_no_cuenta(self):
        sha = self.commit('- ~~**QA-1 · Una (ver QA-9)**~~ ✅\n- ~~**QA-2 · Dos**~~ ✅\n',
                          '## Hecho recientemente\n\n- ~~`QA-1`~~\n- ~~`QA-2`~~\n')
        self.assertEqual(self.correr(sha).returncode, 0)

    def test_rango_con_raya(self):
        sha = self.commit('- ~~`QA-1`–`QA-3`~~ ✅\n- ~~**QA-2 · Dos**~~ ✅\n', '## Hecho recientemente\n\n- ~~`QA-1`…`QA-3`~~\n')
        self.assertEqual(self.correr(sha).returncode, 0)
        sha = self.commit('- ~~`QA-1`–`QA-3`~~ ✅\n- ~~**QA-2 · Dos**~~ ✅\n- ~~`QA-4`–`QA-6`~~\n', '## Hecho recientemente\n\n- ~~`QA-1`…`QA-3`~~\n- ~~`QA-4`~~\n')
        r = self.correr(sha)
        self.assertEqual(r.returncode, 1)
        self.assertIn('QA-5', r.stdout)

    def test_lo_cerrado_en_main_no_se_pide_a_la_rama(self):
        sha = self.commit('- ~~**QA-1 · Una**~~ ✅\n- ~~**QA-2 · Dos**~~ ✅\n', '## Hecho recientemente\n\n- ~~`QA-2`~~\n')
        git(self.repo, 'update-ref', 'refs/remotes/origin/main', sha)
        self.assertEqual(self.correr(sha).returncode, 0)

    def test_retocar_una_ya_tachada_no_pide_nada(self):
        sha = self.commit('- **QA-1 · Una**\n- ~~**QA-2 · Dos**~~ ✅ con más texto\n', '## Hecho recientemente\n\n- nada\n')
        self.assertEqual(self.correr(sha).returncode, 0)


if __name__ == '__main__':
    unittest.main()
