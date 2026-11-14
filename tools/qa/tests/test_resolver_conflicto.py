"""QA-343: `tools/roadmap/resolver-conflicto.py` resuelve tachados y filas añadidas y deja lo demás con sus marcadores."""
import os
import subprocess
import tempfile
import unittest

from comun import RAIZ, git

SCRIPT = os.path.join(RAIZ, 'tools', 'roadmap', 'resolver-conflicto.py')


def conflicto(ours, theirs, base):
    """Conflicto en estilo diff3 (con base), como lo necesita el script."""
    return '<<<<<<< HEAD\n' + ''.join(f'{x}\n' for x in ours) + '||||||| base\n' + ''.join(f'{x}\n' for x in base) + \
        '=======\n' + ''.join(f'{x}\n' for x in theirs) + '>>>>>>> origin/main\n'


class ResolverConflicto(unittest.TestCase):
    def correr(self, texto):
        with tempfile.TemporaryDirectory() as d:
            ruta = os.path.join(d, 'roadmap.md')
            with open(ruta, 'w', encoding='utf-8') as f:
                f.write(texto)
            r = subprocess.run(['python3', SCRIPT, ruta], capture_output=True, text=True)
            with open(ruta, encoding='utf-8') as f:
                return r, f.read()

    def test_tachado_en_un_lado_gana_el_cerrado(self):
        base = ['- `CR-1` hacer algo', '- `CR-2` otra']
        r, texto = self.correr('antes\n' + conflicto(base, ['- ~~`CR-1` hacer algo~~ ✅ 2026-11-01 hecho', '- `CR-2` otra'], base) + 'después\n')
        self.assertEqual(texto, 'antes\n- ~~`CR-1` hacer algo~~ ✅ 2026-11-01 hecho\n- `CR-2` otra\ndespués\n')
        self.assertIn('1 resueltos, 0 quedan', r.stdout)
        self.assertEqual(r.returncode, 0)

    def test_filas_anadidas_en_ambos_lados_se_unen_con_head_primero(self):
        r, texto = self.correr(conflicto(['| a | 1 |', '| nueva de HEAD | 2 |'], ['| a | 1 |', '| otra del otro lado | 3 |'],
                                         ['| a | 1 |']))
        self.assertEqual(texto, '| a | 1 |\n| nueva de HEAD | 2 |\n| otra del otro lado | 3 |\n')
        self.assertEqual(r.returncode, 0)

    def test_un_lado_prefijo_del_otro(self):
        r, texto = self.correr(conflicto(['- uno'], ['- uno', '- dos'], ['- uno']))
        self.assertEqual(texto, '- uno\n- dos\n')
        self.assertEqual(r.returncode, 0)

    def sin_resolver(self, ours, theirs, base):
        original = conflicto(ours, theirs, base)
        r, texto = self.correr(original)
        self.assertEqual(texto, original)
        self.assertEqual(r.returncode, 1)
        return r

    def sin_resolver_en_git(self, ours, theirs, base):
        """Como `sin_resolver`, pero con un merge real en un repo temporal: el script saca la base de las etapas del índice."""
        r, antes, despues = self.merge_en_git(ours, theirs, base)
        self.assertEqual(despues, antes)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)

    def merge_en_git(self, ours, theirs, base, tocar=None):
        """Merge real (la rama traída se llama `otra`); `tocar(texto)` edita el archivo antes del script.
        Devuelve (resultado del script, texto antes del script, texto después)."""
        with tempfile.TemporaryDirectory() as d:
            def g(*a, ok=True):
                return subprocess.run(['git', '-c', 'user.name=t', '-c', 'user.email=t@t', *a], cwd=d, capture_output=True,
                                      text=True, check=ok)
            os.makedirs(os.path.join(d, 'docs', 'producto'))
            ruta = os.path.join(d, 'docs', 'producto', 'r.md')

            def escribir(lineas):
                with open(ruta, 'w', encoding='utf-8') as f:
                    f.write(''.join(f'{x}\n' for x in lineas))
            g('init', '-q', '-b', 'main')
            escribir(base)
            g('add', '-A')
            g('commit', '-qm', 'base')
            g('checkout', '-qb', 'otra')
            escribir(theirs)
            g('commit', '-qam', 'theirs')
            g('checkout', '-q', 'main')
            escribir(ours)
            g('commit', '-qam', 'ours')
            self.assertNotEqual(g('merge', 'otra', ok=False).returncode, 0, 'se esperaba un conflicto')
            with open(ruta, encoding='utf-8') as f:
                antes = f.read()
            if tocar:
                antes = tocar(antes)
                with open(ruta, 'w', encoding='utf-8') as f:
                    f.write(antes)
            r = subprocess.run(['python3', SCRIPT], cwd=d, capture_output=True, text=True)
            with open(ruta, encoding='utf-8') as f:
                return r, antes, f.read()

    def test_merge_real_seguro_se_resuelve_con_la_base_del_indice(self):
        r, _, despues = self.merge_en_git(['- X', '- `CR-1` a'], ['- X', '- `CR-2` b'], ['- X'])
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(despues, '- X\n- `CR-1` a\n- `CR-2` b\n')

    def test_archivo_tocado_a_mano_no_se_rehace_desde_el_indice(self):
        """Rehacer el archivo con las etapas del índice perdería lo ya resuelto a mano."""
        base = ['# T', '', '- X']
        r, antes, despues = self.merge_en_git(['# T', '', '- X', '- `CR-1` a'], ['# T', '', '- X', '- `CR-2` b'], base,
                                              tocar=lambda t: t.replace('# T', '# T editado a mano'))
        self.assertEqual(despues, antes)
        self.assertIn('# T editado a mano', despues)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)

    def test_conflicto_de_logica_queda_marcado_y_sale_1(self):
        r = self.sin_resolver(['El turno dura 30 días.'], ['El turno dura 90 días y se cobra al final.'], ['El turno dura 60 días.'])
        self.assertIn('0 resueltos, 1 quedan', r.stdout)
        self.assertIn('línea 1', r.stdout)

    def test_misma_fila_cambiada_en_los_dos_lados_no_es_segura(self):
        self.sin_resolver(['| `CR-50` | cola de combate con 3 turnos de espera |'],
                          ['| `CR-50` | cola de combate con 5 turnos de espera |'], ['| `CR-50` | cola de combate |'])

    def test_el_cierre_en_medio_de_una_fila_no_oculta_lo_que_sigue(self):
        # La fila tiene un ✅ a mitad de celda: lo que va detrás difiere de verdad y no se puede dar por equivalente.
        self.sin_resolver(['| (~~`CR-50`~~ ✅) y `QA-1`…`QA-9` |'], ['| (~~`CR-50`~~ ✅) y `QA-1`…`QA-7` y más |'],
                          ['| (`CR-50`) y `QA-1` |'])

    def test_sin_base_no_se_resuelve(self):
        original = '<<<<<<< HEAD\n- a\n=======\n- a\n- c\n>>>>>>> otra\n'
        r, texto = self.correr(original)
        self.assertEqual(texto, original)
        self.assertEqual(r.returncode, 1)

    def test_fila_borrada_por_un_lado_no_vuelve(self):
        base = ['- `CR-1` a', '- `CR-2` b']
        self.sin_resolver(['- `CR-1` a'], base + ['- `CR-3` c'], base)
        self.sin_resolver_en_git(['- `CR-1` a'], base + ['- `CR-3` c'], base)

    def test_prosa_o_encabezado_anadido_no_se_resuelve(self):
        self.sin_resolver(['## Fase 1', 'texto de HEAD'], ['## Fase 1'], ['## Fase 1'])
        self.sin_resolver(['- a'], ['- a', '## Nuevo'], ['- a'])

    def test_reordenar_no_duplica(self):
        self.sin_resolver(['- A', '- B'], ['- B', '- A'], ['- A', '- B'])
        self.sin_resolver_en_git(['- A', '- B'], ['- B', '- A'], ['- X'])

    def test_notas_distintas_tras_el_cierre_no_se_pierden(self):
        base = ['- `CR-1` hacer']
        self.sin_resolver(['- ~~`CR-1` hacer~~ ✅ 2026-11-01 nota de HEAD'], ['- ~~`CR-1` hacer~~ ✅ 2026-11-01 otra nota del otro'],
                          base)
        self.sin_resolver_en_git(['- ~~`CR-1` hacer~~ ✅ 2026-11-01 nota de HEAD'],
                                 ['- ~~`CR-1` hacer~~ ✅ 2026-11-01 otra nota del otro'], base)

    def test_misma_fila_muy_cambiada_no_se_duplica_por_id(self):
        self.sin_resolver(['- `CR-9` corta', '- `CR-8` x'], ['- `CR-9` una descripción larguísima y distinta de la anterior', '- `CR-8` x'],
                          ['- `CR-9` corta', '- `CR-8` x'])
        self.sin_resolver_en_git(['- `CR-9` versión larguísima de HEAD que no se parece nada'],
                                 ['- `CR-9` una descripción distinta del otro lado, tampoco parecida'], ['- `CR-9` corta'])
        # con fila CR-9 añadida por los dos lados de forma incompatible, tampoco
        self.sin_resolver(['- `CR-9` corta'], ['- `CR-9` una descripción larguísima y distinta de la anterior'], [])

    def test_la_linea_que_queda_es_la_del_archivo_reescrito(self):
        seguro = conflicto(['- `X-1` pendiente'], ['- ~~`X-1` pendiente~~ ✅ 2026-11-02'], ['- `X-1` pendiente'])
        inseguro = conflicto(['Regla: se paga en oro.'], ['Regla: se paga en plata cada semana.'], ['Regla: se paga.'])
        r, texto = self.correr('inicio\n' + seguro + 'medio\n' + inseguro + 'fin\n')
        self.assertEqual(texto, 'inicio\n- ~~`X-1` pendiente~~ ✅ 2026-11-02\nmedio\n' + inseguro + 'fin\n')
        self.assertIn('1 resueltos, 1 quedan', r.stdout)
        self.assertIn('línea 4', r.stdout)
        self.assertEqual(r.returncode, 1)

    def test_fuera_de_un_repo_sale_con_error(self):
        with tempfile.TemporaryDirectory() as d:
            r = subprocess.run(['python3', SCRIPT], cwd=d, capture_output=True, text=True,
                               env={**os.environ, 'GIT_CEILING_DIRECTORIES': os.path.dirname(d)})
        self.assertEqual(r.returncode, 2)
        self.assertIn('error', r.stderr)

    def test_conflicto_real_del_merge_05eedd1c(self):
        """El merge 05eedd1c tuvo conflicto en 21-roadmap.md: la misma fila del hito 0.3 cambiada por los dos lados
        (cada uno añadió ids de QA a la celda) y el merge la dejó con las dos mezcladas a mano. El script no debe
        adivinarla: sigue marcada."""
        ruta = 'docs/producto/21-roadmap.md'
        try:
            commit_base = git(RAIZ, 'merge-base', '8f488d2a', '66b22e4e')
            contenido_base, contenido_theirs, contenido_ours = (
                subprocess.run(['git', 'show', f'{c}:{ruta}'], cwd=RAIZ, capture_output=True, text=True, check=True).stdout
                for c in (commit_base, '66b22e4e', '8f488d2a'))
        except subprocess.CalledProcessError:
            self.skipTest('el historial de esos commits no está en esta copia (clon superficial)')
        with tempfile.TemporaryDirectory() as d:
            archivos = {}
            for nombre, contenido in (('base', contenido_base), ('theirs', contenido_theirs), ('ours', contenido_ours)):
                archivos[nombre] = os.path.join(d, nombre)
                with open(archivos[nombre], 'w', encoding='utf-8') as f:
                    f.write(contenido)
            m = subprocess.run(['git', 'merge-file', '-p', '--diff3', '-L', 'HEAD', '-L', 'base', '-L', 'origin/main', archivos['ours'],
                                archivos['base'], archivos['theirs']], capture_output=True, text=True)
            self.assertEqual(m.returncode, 1, 'se esperaba un conflicto')
        r, texto = self.correr(m.stdout)
        self.assertIn('0 resueltos, 1 quedan', r.stdout)
        self.assertEqual(texto, m.stdout)
        self.assertEqual(r.returncode, 1)


if __name__ == '__main__':
    unittest.main()
