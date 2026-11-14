"""QA-343: `tools/roadmap/resolver-conflicto.py` resuelve tachados y filas añadidas y deja lo demás con sus marcadores."""
import os
import subprocess
import tempfile
import unittest

from comun import RAIZ, git

SCRIPT = os.path.join(RAIZ, 'tools', 'roadmap', 'resolver-conflicto.py')


def conflicto(ours, theirs):
    return '<<<<<<< HEAD\n' + ''.join(f'{x}\n' for x in ours) + '=======\n' + ''.join(f'{x}\n' for x in theirs) + \
        '>>>>>>> origin/main\n'


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
        r, texto = self.correr('antes\n' + conflicto(['- `CR-1` hacer algo', '- `CR-2` otra'],
                                                     ['- ~~`CR-1` hacer algo~~ ✅ 2026-11-01 hecho', '- `CR-2` otra']) + 'después\n')
        self.assertEqual(texto, 'antes\n- ~~`CR-1` hacer algo~~ ✅ 2026-11-01 hecho\n- `CR-2` otra\ndespués\n')
        self.assertIn('1 resueltos, 0 quedan', r.stdout)
        self.assertEqual(r.returncode, 0)

    def test_filas_anadidas_en_ambos_lados_se_unen_con_head_primero(self):
        r, texto = self.correr(conflicto(['| a | 1 |', '| nueva de HEAD | 2 |'], ['| a | 1 |', '| otra del otro lado | 3 |']))
        self.assertEqual(texto, '| a | 1 |\n| nueva de HEAD | 2 |\n| otra del otro lado | 3 |\n')
        self.assertEqual(r.returncode, 0)

    def test_un_lado_prefijo_del_otro(self):
        r, texto = self.correr(conflicto(['- uno'], ['- uno', '- dos']))
        self.assertEqual(texto, '- uno\n- dos\n')
        self.assertEqual(r.returncode, 0)

    def test_conflicto_de_logica_queda_marcado_y_sale_1(self):
        original = conflicto(['El turno dura 30 días.'], ['El turno dura 90 días y se cobra al final.'])
        r, texto = self.correr(original)
        self.assertEqual(texto, original)
        self.assertIn('0 resueltos, 1 quedan', r.stdout)
        self.assertIn('línea 1', r.stdout)
        self.assertEqual(r.returncode, 1)

    def test_misma_fila_cambiada_en_los_dos_lados_no_es_segura(self):
        original = conflicto(['| `CR-50` | cola de combate con 3 turnos de espera |'],
                             ['| `CR-50` | cola de combate con 5 turnos de espera |'])
        r, texto = self.correr(original)
        self.assertEqual(texto, original)
        self.assertEqual(r.returncode, 1)

    def test_el_cierre_en_medio_de_una_fila_no_oculta_lo_que_sigue(self):
        # La fila tiene un ✅ a mitad de celda: lo que va detrás difiere de verdad y no se puede dar por equivalente.
        original = conflicto(['| (~~`CR-50`~~ ✅) y `QA-1`…`QA-9` |'], ['| (~~`CR-50`~~ ✅) y `QA-1`…`QA-7` y más |'])
        r, texto = self.correr(original)
        self.assertEqual(texto, original)
        self.assertEqual(r.returncode, 1)

    def test_diff3_no_se_resuelve(self):
        original = ('<<<<<<< HEAD\n- a\n||||||| base\n- b\n=======\n- a\n- c\n>>>>>>> otra\n')
        r, texto = self.correr(original)
        self.assertEqual(texto, original)
        self.assertEqual(r.returncode, 1)

    def test_archivo_con_un_trozo_seguro_y_otro_no(self):
        seguro = conflicto(['- `X-1` pendiente'], ['- ~~`X-1` pendiente~~ ✅ 2026-11-02'])
        inseguro = conflicto(['Regla: se paga en oro.'], ['Regla: se paga en plata cada semana.'])
        r, texto = self.correr('inicio\n' + seguro + 'medio\n' + inseguro + 'fin\n')
        self.assertEqual(texto, 'inicio\n- ~~`X-1` pendiente~~ ✅ 2026-11-02\nmedio\n' + inseguro + 'fin\n')
        self.assertIn('1 resueltos, 1 quedan', r.stdout)
        self.assertIn('línea 8', r.stdout)
        self.assertEqual(r.returncode, 1)

    def test_conflicto_real_del_merge_05eedd1c(self):
        """El merge 05eedd1c tuvo conflicto en 21-roadmap.md: la misma fila del hito 0.3 cambiada por los dos lados
        (cada uno añadió ids de QA a la celda) y el merge la dejó con las dos mezcladas a mano. El script no debe
        adivinarla: sigue marcada."""
        ruta = 'docs/producto/21-roadmap.md'
        try:
            base = git(RAIZ, 'merge-base', '8f488d2a', '66b22e4e')
            ours, theirs = (subprocess.run(['git', 'show', f'{c}:{ruta}'], cwd=RAIZ, capture_output=True, text=True,
                                           check=True).stdout for c in (base, '66b22e4e'))
            hijo = subprocess.run(['git', 'show', f'8f488d2a:{ruta}'], cwd=RAIZ, capture_output=True, text=True, check=True).stdout
        except subprocess.CalledProcessError:
            self.skipTest('el historial de esos commits no está en esta copia (clon superficial)')
        with tempfile.TemporaryDirectory() as d:
            archivos = {}
            for nombre, contenido in (('base', ours), ('theirs', theirs), ('ours', hijo)):
                archivos[nombre] = os.path.join(d, nombre)
                with open(archivos[nombre], 'w', encoding='utf-8') as f:
                    f.write(contenido)
            m = subprocess.run(['git', 'merge-file', '-p', '-L', 'HEAD', '-L', 'base', '-L', 'origin/main', archivos['ours'],
                                archivos['base'], archivos['theirs']], capture_output=True, text=True)
            self.assertEqual(m.returncode, 1, 'se esperaba un conflicto')
        r, texto = self.correr(m.stdout)
        self.assertIn('0 resueltos, 1 quedan', r.stdout)
        self.assertEqual(texto, m.stdout)
        self.assertEqual(r.returncode, 1)


if __name__ == '__main__':
    unittest.main()
