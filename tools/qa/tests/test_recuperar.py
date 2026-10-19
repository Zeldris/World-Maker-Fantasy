"""QA-116: tools/qa/recuperar.py, con un registro de sesión de prueba."""
import json
import os
import subprocess
import unittest

from comun import QA, carpeta, escribir


def linea(tipo: str, contenido, **extra) -> str:
    return json.dumps({'type': tipo, 'timestamp': '2026-10-19T10:00:00Z', 'message': {'content': contenido}, **extra})


REGISTRO = [
    linea('user', 'el aviso dice Territorio de Clan Serhu'),
    linea('assistant', [{'type': 'tool_use', 'id': 'toolu_a', 'name': 'Bash', 'input': {'command': 'npx vitest run zona'}}]),
    linea('user', [{'type': 'tool_result', 'tool_use_id': 'toolu_a', 'content': 'FAIL zona.test.ts: esperaba 3, llegó 4'}]),
    linea('system', None, subtype='compact_boundary'),
    linea('user', 'Resumen: se habló de Serhu', isCompactSummary=True),
    linea('assistant', [{'type': 'text', 'text': 'otra cosa de Serhu'}], isSidechain=True),
    # Una búsqueda anterior con este script y su resultado no se repiten.
    linea('assistant', [{'type': 'tool_use', 'id': 'toolu_b', 'name': 'Bash', 'input': {'command': 'python3 tools/qa/recuperar.py Serhu'}}]),
    linea('user', [{'type': 'tool_result', 'tool_use_id': 'toolu_b', 'content': 'usuaria: Territorio de Clan Serhu'}]),
    # Nombrar el script no es llamarlo: un diff que lo menciona sí se busca.
    linea('assistant', [{'type': 'text', 'text': 'cambio en recuperar.py: «Morvath» con comillas'}]),
    # Lo que inyecta el sistema en un turno de la usuaria no lo dijo ella.
    linea('user', '<system-reminder>aviso de Morvath</system-reminder>'),
    linea('user', 'skill cargada sobre Morvath', isMeta=True),
]


class Recuperar(unittest.TestCase):
    def correr(self, *args: str) -> subprocess.CompletedProcess:
        ruta = os.path.join(carpeta(), 's.jsonl')
        escribir(ruta, '\n'.join(REGISTRO) + '\n')
        return subprocess.run(['python3', os.path.join(QA, 'recuperar.py'), *args, '--sesion', ruta],
                              capture_output=True, text=True)

    def test_encuentra_lo_de_antes_de_compactar_sin_resumen_ni_subagentes_ni_busquedas_previas(self):
        r = self.correr('serhu')
        self.assertEqual(r.stdout, '[2026-10-19T10:00] usuaria: el aviso dice Territorio de Clan Serhu…\n'
                                   '1 fragmentos con /serhu/\n')

    def test_menciones_del_script_y_avisos_del_sistema(self):
        r = self.correr('«Morvath»|aviso de|cargada', '--ancho', '200')
        self.assertEqual(r.stdout, '[2026-10-19T10:00] claude: cambio en recuperar.py: «Morvath» con comillas…\n'
                                   '[2026-10-19T10:00] sistema: <system-reminder>aviso de Morvath</system-reminder>…\n'
                                   '[2026-10-19T10:00] sistema: skill cargada sobre Morvath…\n'
                                   '3 fragmentos con /«Morvath»|aviso de|cargada/\n')

    def test_expresion_o_numero_malos_dan_un_error_legible(self):
        self.assertIn('no vale', self.correr('(').stderr)
        self.assertIn('necesita un número', self.correr('x', '--max', 'y').stderr)

    def test_resultados_de_ordenes_recortados_y_con_tope(self):
        r = self.correr('esperaba|vitest', '--ancho', '12', '--max', '1')
        self.assertIn('resultado: …t.ts: espera…', r.stdout)
        self.assertIn('2 fragmentos con /esperaba|vitest/ (los 1 últimos)', r.stdout)

    def test_estado_cuenta_las_compactaciones_y_dice_como_recuperar(self):
        r = self.correr('--estado')
        self.assertIn('- Compactaciones en esta sesión: 1', r.stdout)
        self.assertIn('python3 tools/qa/recuperar.py "<regex>"', r.stdout)

    def test_estado_desde_el_gancho_lee_el_registro_de_la_entrada(self):
        ruta = os.path.join(carpeta(), 'g.jsonl')
        escribir(ruta, '\n'.join(REGISTRO) + '\n')
        r = subprocess.run(['python3', os.path.join(QA, 'recuperar.py'), '--estado'],
                           input=json.dumps({'transcript_path': ruta}), capture_output=True, text=True)
        self.assertIn('- Compactaciones en esta sesión: 1', r.stdout)
        self.assertIn(f'--sesion {ruta}', r.stdout)

    def test_sin_patron_da_la_ayuda(self):
        self.assertEqual(self.correr().returncode, 2)


if __name__ == '__main__':
    unittest.main()
