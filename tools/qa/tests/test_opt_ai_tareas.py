"""QA-137: las tareas de la IA que nombra `.claude/gw/opt-ai.md` (sección «Tareas») son las que emite el backend."""
import pathlib
import re
import unittest

RAIZ = pathlib.Path(__file__).resolve().parents[3]
PROYECTO = RAIZ / '.claude/gw/opt-ai.md'
FUENTES = RAIZ / 'backend/src'
# `tarea: 'x'` (ollamaGenerate) o `task: 'x'` (registro); el cierre deja fuera los tipos (`'a' | 'b'`).
EMITIDA = re.compile(r"\b(?:tarea|task): '([a-z_]+)'\s*[,})]")


def tareas_del_codigo():
    tareas = set()
    for ruta in FUENTES.rglob('*.ts'):
        if '.test.' in ruta.name:
            continue
        for linea in ruta.read_text(encoding='utf-8').splitlines():
            if not linea.lstrip().startswith('//'):
                tareas.update(EMITIDA.findall(linea))
    return tareas


def tareas_del_doc():
    texto = PROYECTO.read_text(encoding='utf-8')
    tramo = texto[texto.index('## Tareas'):texto.index('## Perfiles')]
    return set(re.findall(r'`([a-z_]+)`', tramo)) - {'app'}


class TareasOptAi(unittest.TestCase):
    def test_doc_y_codigo_coinciden(self):
        codigo, doc = tareas_del_codigo(), tareas_del_doc()
        self.assertEqual(sorted(codigo - doc), [], 'tareas del código que gw/opt-ai.md no nombra')
        self.assertEqual(sorted(doc - codigo), [], 'tareas de gw/opt-ai.md que el código ya no emite')


if __name__ == '__main__':
    unittest.main()
