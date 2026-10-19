"""QA-113: .claude/skills/opt-tokens/medir.py (QA-111), con un registro de sesión de prueba."""
import json
import os
import subprocess
import unittest

from comun import QA, carpeta, escribir

MEDIR = os.path.join(QA, '..', '..', '.claude', 'skills', 'opt-tokens', 'medir.py')


def asistente(id_mensaje: str, contexto: int, *bloques: dict, modelo: str = 'claude-opus-5-5') -> dict:
    uso = {'input_tokens': 0, 'cache_creation_input_tokens': 0, 'cache_read_input_tokens': contexto, 'output_tokens': 10}
    return {'type': 'assistant', 'message': {'id': id_mensaje, 'model': modelo, 'usage': uso, 'content': list(bloques)}}


class Medir(unittest.TestCase):
    def medir(self, lineas: list, subagentes: dict | None = None) -> str:
        d = carpeta()
        ruta = os.path.join(d, 's.jsonl')
        escribir(ruta, '\n'.join(json.dumps(l) for l in lineas) + '\n')
        for nombre, (tipo, sub) in (subagentes or {}).items():
            escribir(os.path.join(d, 's', 'subagents', f'{nombre}.meta.json'), json.dumps({'agentType': tipo}))
            escribir(os.path.join(d, 's', 'subagents', f'{nombre}.jsonl'), '\n'.join(json.dumps(l) for l in sub) + '\n')
        r = subprocess.run(['python3', MEDIR, '--sesion', ruta, '--horas', '0'], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        return r.stdout

    def test_cuenta_una_vez_cada_respuesta_y_saca_los_tramos(self):
        salida = self.medir([
            asistente('m1', 100, {'type': 'text', 'text': 'pienso'}),
            # Otra línea de la misma respuesta (un bloque más) repite su uso: no cuenta dos veces.
            asistente('m1', 100, {'type': 'tool_use', 'id': 't1', 'name': 'Read', 'input': {'file_path': '/a'}}),
            {'type': 'user', 'message': {'content': [{'type': 'tool_result', 'tool_use_id': 't1', 'content': 'x' * 350}]}},
            asistente('m2', 300),
            {'type': 'system', 'subtype': 'compact_boundary'},
            asistente('m3', 50),
            {'type': 'assistant', 'isSidechain': True, 'message': {'id': 's', 'usage': {'cache_read_input_tokens': 9999}}},
        ])
        self.assertIn('Llamadas a la API: 3  ·  compactaciones: 1', salida)
        self.assertIn('Entrada 450 tokens', salida)
        self.assertIn('Tramos entre compactaciones: 2  ·  suelo medio 75  ·  techo medio 175', salida)
        # El resultado de Read (100 tokens) se arrastra a la llamada siguiente del tramo: 1 llamada.
        self.assertRegex(salida, r'Read\s+1 llamadas\s+100 tok\s+100 arrastrados')


    def test_reparte_por_modelo_la_sesion_y_sus_subagentes(self):
        """QA-117: qué modelo hizo qué, con los subagentes de `<sesión>/subagents/`."""
        salida = self.medir([asistente('m1', 100), asistente('m2', 200)], {
            'agent-a': ('general-purpose', [asistente('s1', 40, modelo='claude-sonnet-5-5'), asistente('s1', 40, modelo='claude-sonnet-5-5')]),
            'agent-b': ('Explore', [asistente('s2', 7, modelo='claude-haiku-5-5')]),
        })
        self.assertRegex(salida, r'principal\s+claude-opus-5-5\s+2 llamadas\s+300 entrada\s+20 salida')
        self.assertRegex(salida, r'subagentes\s+claude-sonnet-5-5\s+1 llamadas\s+40 entrada')
        self.assertIn('Subagentes: 1 general-purpose (claude-sonnet-5-5) · 1 Explore (claude-haiku-5-5)', salida)


if __name__ == '__main__':
    unittest.main()
