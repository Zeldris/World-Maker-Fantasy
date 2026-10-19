"""QA-113: .claude/skills/opt-tokens/medir.py (QA-111), con un registro de sesión de prueba (líneas de `comun`, QA-119)."""
import datetime as dt
import json
import os
import subprocess
import unittest

from comun import QA, carpeta, compactacion, escribir, orden, registro, respuesta, resultado, ruido, texto

MEDIR = os.path.join(QA, '..', '..', '.claude', 'skills', 'opt-tokens', 'medir.py')


class Medir(unittest.TestCase):
    def medir(self, partes: list, subagentes: dict | None = None, horas: str = '0') -> str:
        d = carpeta()
        ruta = registro(os.path.join(d, 's.jsonl'), *partes)
        for nombre, (tipo, sub) in (subagentes or {}).items():
            escribir(os.path.join(d, 's', 'subagents', f'{nombre}.meta.json'), json.dumps({'agentType': tipo}))
            registro(os.path.join(d, 's', 'subagents', f'{nombre}.jsonl'), *sub)
        r = subprocess.run(['python3', MEDIR, '--sesion', ruta, '--horas', horas], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        return r.stdout

    def test_cuenta_una_vez_cada_respuesta_y_saca_los_tramos(self):
        salida = self.medir([
            *ruido(),
            # Dos bloques de la misma respuesta: dos líneas con el mismo uso, que cuenta una vez.
            respuesta('m1', 100, texto('pienso'), orden('t1', '', nombre='Read', file_path='/a')),
            resultado('t1', 'x' * 350),
            respuesta('m2', 300),
            *compactacion(),
            respuesta('m3', 50),
            respuesta('s', 9999, isSidechain=True),
        ])
        self.assertIn('Llamadas a la API: 3  ·  compactaciones: 1', salida)
        self.assertIn('Entrada 450 tokens', salida)
        self.assertIn('Tramos entre compactaciones: 2  ·  suelo medio 75  ·  techo medio 175', salida)
        # El resultado de Read (100 tokens) se arrastra a la llamada siguiente del tramo: 1 llamada.
        self.assertRegex(salida, r'Read\s+1 llamadas\s+100 tok\s+100 arrastrados')

    def test_reparte_por_modelo_la_sesion_y_sus_subagentes(self):
        """QA-117: qué modelo hizo qué, con los subagentes de `<sesión>/subagents/`."""
        salida = self.medir([respuesta('m1', 100), respuesta('m2', 200),
                             # Un subagente escrito en el registro principal no es de la sesión principal.
                             respuesta('s9', 5000, isSidechain=True)], {
            'agent-a': ('general-purpose', [respuesta('s1', 40, texto('a'), texto('b'), modelo='claude-sonnet-5-5')]),
            'agent-b': ('Explore', [respuesta('s2', 7, modelo='claude-haiku-5-5')]),
        })
        self.assertRegex(salida, r'principal\s+claude-opus-5-5\s+2 llamadas\s+300 entrada\s+20 salida')
        self.assertRegex(salida, r'subagentes\s+claude-sonnet-5-5\s+1 llamadas\s+40 entrada')
        self.assertIn('Subagentes: 1 general-purpose (claude-sonnet-5-5) · 1 Explore (claude-haiku-5-5)', salida)

    def test_con_horas_el_primer_tramo_a_medias_no_cuenta_como_suelo(self):
        def hace(horas):
            return (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=horas)).isoformat().replace('+00:00', 'Z')
        corte = compactacion()
        for l in corte:
            l['timestamp'] = hace(1.3)
        salida = self.medir([
            respuesta('m0', 10, timestamp=hace(5)),  # fuera del periodo: el tramo empezó antes
            respuesta('m1', 900, timestamp=hace(1.5)), respuesta('m2', 1000, timestamp=hace(1.4)),
            *corte,
            respuesta('m3', 100, timestamp=hace(1.2)), respuesta('m4', 300, timestamp=hace(1.1)),
        ], horas='2')
        self.assertIn('Tramos entre compactaciones: 1  ·  suelo medio 100  ·  techo medio 300  ·  2 llamadas por tramo'
                      '  (sin el primero, que empezó antes del periodo)', salida)
        # QA-127: el medio de todo el periodo (575) mezcla el tramo a medias; sin él, el del régimen actual (200).
        self.assertIn('Contexto medio por llamada: 575 tokens', salida)
        self.assertIn('Contexto medio sin el primer tramo: 200 tokens', salida)
        self.assertIn('Por tramo, del más antiguo al último (medio/techo, en miles): 0/0', salida)


if __name__ == '__main__':
    unittest.main()
