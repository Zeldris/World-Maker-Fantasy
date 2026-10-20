import io, json, os, shutil, subprocess, sys, tempfile, unittest
from contextlib import redirect_stdout

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import inventario, contrastar

EJEMPLO = os.path.join(AQUI, 'evals', 'proyecto-ejemplo')


def git(raiz, *args):
    return subprocess.run(['git', '-c', 'user.name=t', '-c', 'user.email=t@t', *args], cwd=raiz,
                          capture_output=True, text=True, check=True).stdout.strip()


class InventarioTest(unittest.TestCase):
    def test_proyecto_ejemplo(self):
        inv = inventario.inventariar(EJEMPLO)
        nombres = lambda s: {(c['nombre'], c['version']) for c in inv[s]}
        self.assertIn(('node', '16'), nombres('runtimes'))
        self.assertIn(('node', '16-alpine'), nombres('runtimes'))
        self.assertIn(('express', '4.17.1'), nombres('dependencias'))
        self.assertIn(('pandas', '==1.3.5'), nombres('dependencias'))
        self.assertIn(('actions/checkout', 'v2'), nombres('infraestructura'))
        self.assertIn(('runner', 'ubuntu-20.04'), nombres('infraestructura'))
        self.assertEqual({c['nombre'] for c in inv['modelos de IA']}, {'gpt-3.5-turbo', 'text-embedding-ada-002'})
        self.assertIn('requirements.txt', inv['manifiestos'])

    def test_fusiona_origenes_y_excluye_claude(self):
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d)
        os.makedirs(os.path.join(d, 'src', 'config'))
        os.makedirs(os.path.join(d, '.claude', 'x'))
        with open(os.path.join(d, '.env.example'), 'w') as f:
            f.write('LLM_MODEL=modelo-a\n')
        with open(os.path.join(d, 'src', 'config', 'env.ts'), 'w') as f:
            f.write("export const m = process.env.LLM_MODEL ?? 'modelo-a';\n")
        with open(os.path.join(d, '.claude', 'x', 'package.json'), 'w') as f:
            f.write('{"dependencies": {"nada": "1"}}')
        with open(os.path.join(d, 'Cargo.toml'), 'w') as f:
            f.write('[package]\nname = "x"\n\n[dependencies]\nserde = "1.0"\ntokio = { version = "1", features = ["full"] }\n')
        with open(os.path.join(d, 'pyproject.toml'), 'w') as f:
            f.write('[project]\nrequires-python = ">=3.9"\ndependencies = ["requests>=2", "rich"]\n')
        inv = inventario.inventariar(d)
        self.assertEqual(inv['modelos de IA'],
                         [{'nombre': 'modelo-a', 'version': '-', 'origen': '.env.example, src/config/env.ts', 'uso': 'LLM_MODEL'}])
        deps = {(c['nombre'], c['version']) for c in inv['dependencias']}
        self.assertEqual(deps, {('serde', '1.0'), ('tokio', '*'), ('requests', '>=2'), ('rich', '*')})
        self.assertIn(('python', '>=3.9'), {(c['nombre'], c['version']) for c in inv['runtimes']})
        self.assertNotIn('.claude/x/package.json', inv['manifiestos'])

    def test_salida_texto(self):
        out = io.StringIO()
        with redirect_stdout(out):
            inventario.main([EJEMPLO])
        self.assertIn('## modelos de IA (2)', out.getvalue())
        self.assertIn('- gpt-3.5-turbo - · .env.example · OPENAI_MODEL', out.getvalue())

    def test_ollama_caido(self):
        self.assertIsNone(inventario.modelos_ollama('http://127.0.0.1:9'))


class ContrastarTest(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.d)
        for nombre in ('package.json', '.nvmrc', '.env.example'):
            shutil.copy(os.path.join(EJEMPLO, nombre), self.d)
        git(self.d, 'init', '-q')
        git(self.d, 'add', '.')
        git(self.d, 'commit', '-qm', 'uno')
        self.commit = git(self.d, 'rev-parse', '--short', 'HEAD')
        self.arq = os.path.join(self.d, 'arquitectura.md')
        with open(self.arq, 'w') as f:
            f.write('# A\n\n## Restricciones\n\n- local\n\n'
                    '## Modelos de IA\n<!-- sello: 2026-01-10 · %s · .env.example -->\n\n'
                    '## Runtimes\n<!-- sello: 2026-01-10 · %s · .nvmrc, package.json -->\n\n'
                    '## Infraestructura\n\nsin sello\n' % (self.commit, self.commit))

    def test_igual_cambiada_sin_sello_sin_cuenta(self):
        with open(os.path.join(self.d, '.nvmrc'), 'w') as f:
            f.write('22\n')
        with open(os.path.join(self.d, 'Dockerfile'), 'w') as f:
            f.write('FROM node:22\n')
        inf = contrastar.contrastar(self.arq, self.d)
        self.assertEqual([s['seccion'] for s in inf['igual']], ['Modelos de IA'])
        self.assertEqual(inf['cambiada'], [{'seccion': 'Runtimes', 'fecha': '2026-01-10', 'archivos': ['.nvmrc']}])
        self.assertEqual([s['seccion'] for s in inf['sin sello']], ['Infraestructura'])
        self.assertEqual(inf['sin cuenta'], ['Dockerfile'])

    def test_archivo_borrado_y_commit_desconocido(self):
        os.unlink(os.path.join(self.d, '.env.example'))
        with open(self.arq, 'a') as f:
            f.write('## Otra\n<!-- sello: 2026-01-10 · deadbeef · x -->\n')
        inf = contrastar.contrastar(self.arq, self.d)
        self.assertEqual(inf['cambiada'][0]['archivos'], ['.env.example'])
        self.assertIn({'seccion': 'Otra', 'motivo': 'commit deadbeef desconocido'}, inf['sin sello'])

    def test_codigo_de_salida(self):
        with open(self.arq, 'w') as f:
            f.write('## Runtimes\n<!-- sello: 2026-01-10 · %s · .nvmrc, package.json, .env.example -->\n' % self.commit)
        with redirect_stdout(io.StringIO()):
            self.assertEqual(contrastar.main([self.arq, '--raiz', self.d]), 0)
        with open(os.path.join(self.d, 'package.json'), 'a') as f:
            f.write('\n')
        with redirect_stdout(io.StringIO()):
            self.assertEqual(contrastar.main([self.arq, '--raiz', self.d]), 1)


if __name__ == '__main__':
    unittest.main()
