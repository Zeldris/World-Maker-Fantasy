"""QA-349: tools/qa/aviso-lectura.py avisa al leer enteros los registros que tienen su herramienta, y solo entonces."""
import json
import os
import subprocess
import unittest

from comun import QA

SCRIPT = os.path.join(QA, 'aviso-lectura.py')


def correr(evento) -> str:
    entrada = evento if isinstance(evento, str) else json.dumps(evento)
    r = subprocess.run(['python3', SCRIPT], input=entrada, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    return r.stdout


def contexto(salida: str) -> str:
    return json.loads(salida)['hookSpecificOutput']['additionalContext']


class AvisoLectura(unittest.TestCase):
    def test_sed_del_plan_avisa_con_plan_py(self):
        salida = correr({'tool_name': 'Bash', 'tool_input': {'command': 'sed -n 100,123p docs/records/plan-comprobacion-puerta.md'}})
        self.assertIn('python3 tools/qa/plan.py', contexto(salida))

    def test_grep_de_hallazgos_y_bitacora_avisa_de_los_dos(self):
        salida = correr({'tool_name': 'Bash', 'tool_input': {
            'command': 'grep -n P243 docs/records/pruebas-0.3-hallazgos.md; cat docs/records/traspaso.md'}})
        texto = contexto(salida)
        self.assertIn('marca-hallazgo.py', texto)
        self.assertIn('recover.py', texto)

    def test_con_su_herramienta_no_avisa(self):
        orden = 'bash tools/qa/seccion.sh docs/runbooks/rondas-de-pruebas.md "Qué se prueba" | head'
        self.assertEqual(correr({'tool_name': 'Bash', 'tool_input': {'command': orden}}), '')

    def test_git_sin_lector_no_avisa(self):
        orden = 'git add docs/records/traspaso.md && git commit -m x'
        self.assertEqual(correr({'tool_name': 'Bash', 'tool_input': {'command': orden}}), '')

    def test_read_entero_avisa_y_por_trozos_no(self):
        ruta = '/repo/docs/runbooks/rondas-de-pruebas.md'
        self.assertIn('seccion.sh', contexto(correr({'tool_name': 'Read', 'tool_input': {'file_path': ruta}})))
        self.assertEqual(correr({'tool_name': 'Read', 'tool_input': {'file_path': ruta, 'offset': 10, 'limit': 20}}), '')

    def test_entrada_rota_no_escribe_nada(self):
        self.assertEqual(correr('no es json'), '')


if __name__ == '__main__':
    unittest.main()
