"""QA-74: la bitácora (QA-69), con el `bitacora.py` de Galivelop-workflow (`.claude/gw/scripts/`, piloto del
2026-10-22; sustituye a `tools/qa/bitacora.py`). Los mensajes del flujo están en inglés."""
import os
import subprocess
import unittest

from comun import GW, carpeta, config_gw, escribir, git

BITACORA = os.path.join(GW, 'bitacora.py')


def flujo(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(['python3', BITACORA, *args], capture_output=True, text=True)


def comprobar(texto: str, *args: str) -> subprocess.CompletedProcess:
    ruta = os.path.join(carpeta(), 'traspaso.md')
    escribir(ruta, texto)
    return flujo('check', ruta, *args)


class Bitacora(unittest.TestCase):
    def test_una_fila_corta_por_rama_pasa(self):
        r = comprobar('| **Tarea en curso · `a`** | algo |\n| **Tarea en curso · `b`** | otra |\n')
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_fila_sin_rama_falla(self):
        r = comprobar('| **Tarea en curso** | algo |\n')
        self.assertEqual(r.returncode, 1)
        self.assertIn('there is no row', r.stdout)
        r = comprobar('| **Tarea en curso · `a** | algo |\n')
        self.assertEqual(r.returncode, 1)
        self.assertIn('malformed branch row', r.stdout)

    def test_fila_larga_falla(self):
        r = comprobar('| **Tarea en curso · `a`** | ' + 'x' * 601 + ' |\n')
        self.assertEqual(r.returncode, 1)
        self.assertIn('601 characters', r.stdout)

    def test_dos_filas_de_la_misma_rama_fallan(self):
        r = comprobar('| **Tarea en curso · `a`** | uno |\n| **Tarea en curso · `a`** | dos |\n')
        self.assertEqual(r.returncode, 1)
        self.assertIn('two rows for a', r.stdout)

    def test_sin_ninguna_fila_falla(self):
        self.assertEqual(comprobar('| **Hito** | 0.3 |\n').returncode, 1)

    def test_fecha_anterior_al_commit_falla(self):
        """QA-115: con `--fecha`, «Actualizado» no puede ser de un día anterior."""
        texto = '| **Actualizado** | 2026-10-17 |\n| **Tarea en curso · `a`** | algo |\n'
        r = comprobar(texto, '--date', '2026-10-19')
        self.assertEqual(r.returncode, 1)
        self.assertIn('"Updated" says 2026-10-17 and the commit is from 2026-10-19', r.stdout)
        self.assertEqual(comprobar(texto, '--date', '2026-10-17').returncode, 0)
        self.assertEqual(comprobar(texto).returncode, 0)

    def test_fecha_con_formato_suelto_o_sin_fila(self):
        texto = '|  **Actualizado**  |  `2026-10-17` |\n| **Tarea en curso · `a`** | algo |\n'
        self.assertIn('says 2026-10-17', comprobar(texto, '--date', '2026-10-19').stdout)
        r = comprobar('| **Tarea en curso · `a`** | algo |\n', '--date', '2026-10-19')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('the "Updated" row is missing', r.stdout)

    def test_fecha_mal_escrita_da_uso(self):
        r = comprobar('| **Tarea en curso · `a`** | algo |\n', '--date', 'ayer')
        self.assertEqual(r.returncode, 2)
        self.assertIn('--date must be YYYY-MM-DD', r.stderr)


class Ajenas(unittest.TestCase):
    """QA-145: un commit no cambia la fila de otra rama ni una fila compartida (salvo `--shared`)."""
    BASE = ('## Estado actual\n\n| **Actualizado** | 2026-10-19 |\n| **Hito** | 0.3 |\n| **Tests** | verde |\n'
            '| **Tarea en curso · `a`** | uno |\n| **Tarea en curso · `b`** | dos |\n')

    def commit(self, repo: str, texto: str) -> str:
        escribir(os.path.join(repo, 'docs/registros/traspaso.md'), texto)
        git(repo, 'add', '-A')
        git(repo, 'commit', '-q', '-m', 'x')
        return git(repo, 'rev-parse', 'HEAD')

    def correr(self, texto: str, *extra: str):
        repo = carpeta()
        git(repo, 'init', '-q')
        config_gw(repo)
        self.commit(repo, self.BASE)
        sha = self.commit(repo, texto)
        return flujo('--root', repo, 'own-row', sha, 'a', *extra)

    def test_la_propia_y_las_libres_pasan(self):
        t = self.BASE.replace('| uno |', '| nuevo |').replace('2026-10-19', '2026-10-20').replace('verde', 'rojo')
        self.assertEqual(self.correr(t).returncode, 0)

    def test_la_de_otra_rama_falla(self):
        r = self.correr(self.BASE.replace('| dos |', '| tres |'))
        self.assertEqual(r.returncode, 1)
        self.assertIn('Tarea en curso · b', r.stdout)
        self.assertIn('BITACORA_COMPARTIDA=1', r.stdout)

    def test_compartida_falla_y_se_permite_con_la_opcion(self):
        t = self.BASE.replace('0.3', '0.4')
        self.assertIn('"Hito"', self.correr(t).stdout)
        self.assertEqual(self.correr(t, '--shared').returncode, 0)

    def test_quitar_o_anadir_una_fila_ajena_falla(self):
        self.assertEqual(self.correr(self.BASE.replace('| **Tarea en curso · `b`** | dos |\n', '')).returncode, 1)
        self.assertEqual(self.correr(self.BASE + '| **Tarea en curso · `c`** | tres |\n').returncode, 1)

    def test_una_tabla_de_otra_seccion_no_es_fila_compartida(self):
        t = self.BASE + '\n## Otra\n\n| **Hito** | 0.9 |\n'
        self.assertEqual(self.correr(t).returncode, 0)

    def test_clave_repetida_no_oculta_un_cambio(self):
        base = self.BASE + '| **Hito** | 0.5 |\n'
        repo = carpeta()
        git(repo, 'init', '-q')
        config_gw(repo)
        self.commit(repo, base)
        sha = self.commit(repo, base.replace('| 0.3 |', '| 0.4 |'))
        r = flujo('--root', repo, 'own-row', sha, 'a')
        self.assertEqual(r.returncode, 1)
        self.assertIn('"Hito"', r.stdout)

    def test_uso(self):
        r = flujo('own-row', 'x')
        self.assertEqual(r.returncode, 2)
        self.assertIn('usage', r.stderr)


class Cerradas(unittest.TestCase):
    """QA-85: lo que se tacha en un roadmap sale tachado en «Hecho recientemente»."""

    def setUp(self):
        self.repo = carpeta()
        git(self.repo, 'init', '-q')
        config_gw(self.repo)
        self.base = self.commit('- **QA-1 · Una**\n- ~~**QA-2 · Dos**~~ ✅\n', '## Hecho recientemente\n\n- ~~`QA-2`~~\n')

    def commit(self, roadmap: str, bitacora: str) -> str:
        escribir(os.path.join(self.repo, 'docs/producto/roadmap.md'), roadmap)
        escribir(os.path.join(self.repo, 'docs/registros/traspaso.md'), bitacora)
        git(self.repo, 'add', '-A')
        git(self.repo, 'commit', '-q', '-m', 'c')
        return git(self.repo, 'rev-parse', 'HEAD')

    def correr(self, sha: str) -> subprocess.CompletedProcess:
        return flujo('--root', self.repo, 'closed', self.base, sha)

    def test_tachada_sin_bitacora_falla(self):
        """Con la fecha delante, como en la bitácora de WMF. El flujo da por apuntada una viñeta que empieza por el id
        aunque no esté tachada (`- `QA-1` diagnosticado`): fricción 14 del piloto."""
        sha = self.commit('- ~~**QA-1 · Una**~~ ✅\n- ~~**QA-2 · Dos**~~ ✅\n',
                          '## Hecho recientemente\n\n- **2026-10-14** — `QA-1` diagnosticado\n- ~~`QA-2`~~\n')
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



class EnCurso(unittest.TestCase):
    """QA-182: aviso de una tarea 🚧 que los commits nombran y cuya entrada del roadmap no cambia."""

    def setUp(self):
        self.repo = carpeta()
        git(self.repo, 'init', '-q')
        config_gw(self.repo)
        self.roadmap = ('- **QA-1 · Una** 🚧 en curso:\n  falta X.\n- **QA-2 · Dos**\n'
                        '- ~~**QA-3 · Tres**~~ ✅\n| QA-4 | Cuatro 🚧 |\n')
        self.base = self.commit(self.roadmap, 'base')

    def commit(self, roadmap: str, mensaje: str) -> str:
        escribir(os.path.join(self.repo, 'docs/producto/roadmap.md'), roadmap)
        escribir(os.path.join(self.repo, 'otro.txt'), mensaje)
        git(self.repo, 'add', '-A')
        git(self.repo, 'commit', '-q', '-m', mensaje)
        return git(self.repo, 'rev-parse', 'HEAD')

    def correr(self, sha: str) -> subprocess.CompletedProcess:
        return flujo('--root', self.repo, 'in-progress', self.base, sha)

    def test_avisa_sin_fallar_de_la_en_curso_sin_tocar(self):
        r = self.correr(self.commit(self.roadmap, 'Avanza QA-1, QA-2, QA-3 y QA-4'))
        self.assertEqual(r.returncode, 0)
        self.assertIn('QA-1', r.stdout)
        self.assertIn('QA-4', r.stdout)
        self.assertNotIn('QA-2', r.stdout)
        self.assertNotIn('QA-3', r.stdout)

    def test_la_entrada_tocada_aunque_sea_en_su_continuacion_no_avisa(self):
        r = self.correr(self.commit(self.roadmap.replace('falta X', 'falta Y'), 'Avanza QA-1'))
        self.assertEqual(r.stdout, '')

    def test_sin_nombrarla_no_avisa(self):
        self.assertEqual(self.correr(self.commit(self.roadmap, 'Otra cosa')).stdout, '')


if __name__ == '__main__':
    unittest.main()
