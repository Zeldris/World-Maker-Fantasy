import io, json, os, shutil, subprocess, sys, tempfile, unittest
from contextlib import redirect_stdout

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import inventario, contrastar, banco

EJEMPLO = os.path.join(AQUI, 'evals', 'proyecto-ejemplo')
DIFICILES = os.path.join(AQUI, 'evals', 'manifiestos-dificiles')


def salida_dificil():
    """(nombre, versión) por sección del inventario de `manifiestos-dificiles`; su README dice cómo regenerarla."""
    inv = inventario.inventariar(DIFICILES)
    return {s: sorted([c['nombre'], c['version']] for c in v) for s, v in inv.items() if s != 'manifiestos'}


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
            f.write('[project]\nrequires-python = ">=3.9"\ndependencies = ["requests>=2", "uvicorn[standard]>=0.30", "rich"]\n')
        os.makedirs(os.path.join(d, 'modelfiles'))
        with open(os.path.join(d, 'modelfiles', 'q-32k.Modelfile'), 'w') as f:
            f.write('FROM base-b\n')
        with open(os.path.join(d, 'opencode.json'), 'w') as f:
            f.write('{"plugin": ["p-uno", "@org/p-dos@1.2"], "agent": {"lore": {"model": "ollama/q-32k"}}}')
        inv = inventario.inventariar(d)
        otros = {(c['nombre'], c['uso']) for c in inv['modelos de IA']} - {('modelo-a', 'LLM_MODEL')}
        self.assertEqual(otros, {('base-b', 'base del Modelfile'), ('ollama/q-32k', 'agente lore')})
        self.assertIn(('@org/p-dos', '1.2'), {(c['nombre'], c['version']) for c in inv['dependencias']})
        inv['modelos de IA'] = [c for c in inv['modelos de IA'] if c['nombre'] == 'modelo-a']
        inv['dependencias'] = [c for c in inv['dependencias'] if c['origen'] != 'opencode.json']
        self.assertEqual(inv['modelos de IA'],
                         [{'nombre': 'modelo-a', 'version': '-', 'origen': '.env.example, src/config/env.ts', 'uso': 'LLM_MODEL'}])
        deps = {(c['nombre'], c['version']) for c in inv['dependencias']}
        self.assertEqual(deps, {('serde', '1.0'), ('tokio', '1'), ('requests', '>=2'), ('uvicorn[standard]', '>=0.30'), ('rich', '*')})
        self.assertIn(('python', '>=3.9'), {(c['nombre'], c['version']) for c in inv['runtimes']})
        self.assertNotIn('.claude/x/package.json', inv['manifiestos'])

    def test_imagenes_con_puerto_digest_y_etapas(self):
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d)
        with open(os.path.join(d, 'Dockerfile'), 'w') as f:
            f.write('FROM registry:5000/team/app:1.2 AS build\nFROM node@sha256:abc\nFROM build\n')
        imgs = {(c['nombre'], c['version']) for c in inventario.inventariar(d)['runtimes']}
        self.assertEqual(imgs, {('registry:5000/team/app', '1.2'), ('node', 'latest')})

    def test_manifiestos_dificiles(self):
        with open(os.path.join(DIFICILES, 'esperado.json'), encoding='utf-8') as f:
            self.assertEqual(salida_dificil(), json.load(f))

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

    def test_sello_sin_archivos_y_carpeta(self):
        os.makedirs(os.path.join(self.d, '.github', 'workflows'))
        with open(os.path.join(self.d, '.github', 'workflows', 'ci.yml'), 'w') as f:
            f.write('jobs: {}\n')
        with open(self.arq, 'a') as f:
            f.write('## CI\n<!-- sello: 2026-01-10 · %s · .github/workflows -->\n'
                    '## Vacía\n<!-- sello: 2026-01-10 · %s ·  -->\n' % (self.commit, self.commit))
        inf = contrastar.contrastar(self.arq, self.d)
        self.assertNotIn('.github/workflows/ci.yml', inf['sin cuenta'])
        self.assertIn({'seccion': 'Vacía', 'motivo': 'sello sin archivos'}, inf['sin sello'])

    def test_seccion(self):
        texto = '# A\n\n## Modelos de IA\n\nuno\n\n## Runtimes\n\ndos\n'
        self.assertEqual(contrastar.seccion(texto, 'modelos'), '## Modelos de IA\n\nuno\n')
        self.assertIsNone(contrastar.seccion(texto, 'nada'))

    def test_informe_sin_cubrir(self):
        arq = ('## Restricciones\n\n| Componente | x |\n|---|---|\n| memoria | 6 GB |\n\n'
               '## Modelos de IA\n\n| Componente | Versión |\n|---|---|\n| narrador | a |\n| `cronista` | b |\n')
        informe = '# I\n\n## Cobertura\n\n| Componente | Resultado |\n|---|---|\n| Narrador | P-001 |\n'
        self.assertEqual(contrastar.sin_cubrir(arq, informe), ['cronista'])
        self.assertEqual(contrastar.sin_cubrir(arq, informe + '| cronista | sin novedades |\n'), [])
        self.assertEqual(contrastar.sin_cubrir(arq, '| narrador | fuera de Cobertura |\n'), ['narrador', 'cronista'])

    def test_codigo_de_salida(self):
        with open(self.arq, 'w') as f:
            f.write('## Runtimes\n<!-- sello: 2026-01-10 · %s · .nvmrc, package.json, .env.example -->\n' % self.commit)
        with redirect_stdout(io.StringIO()):
            self.assertEqual(contrastar.main([self.arq, '--raiz', self.d]), 0)
        with open(os.path.join(self.d, 'package.json'), 'a') as f:
            f.write('\n')
        with redirect_stdout(io.StringIO()):
            self.assertEqual(contrastar.main([self.arq, '--raiz', self.d]), 1)


class BancoTest(unittest.TestCase):
    CASOS = [{'id': 'c1', 'prompt': 'x' * 2000}, {'id': 'c2', 'prompt': 'p', 'contexto': 'abre la puerta'}]

    def test_generar_con_error(self):
        def llamar(modelo, system, prompt, opciones):
            if prompt == 'p':
                raise OSError('caído')
            return ' hola '
        filas = banco.generar(self.CASOS, 'm', llamar)
        self.assertEqual(filas[0]['salida'], 'hola')
        self.assertEqual(filas[1], {'caso': 'c2', 'modelo': 'm', 'error': 'caído'})

    def tandas(self):
        return [[{'caso': c, 'modelo': m, 'salida': '%s-%s' % (m, c)} for c in ('c1', 'c2')] for m in ('a', 'b')]

    def test_pares_dos_ordenes_a_ciegas(self):
        lista, clave = banco.pares(self.tandas(), self.CASOS, semilla=1)
        self.assertEqual(len(lista), 4)
        for p in lista:
            self.assertEqual(set(p), {'par', 'caso', 'contexto', 'X', 'Y'})
            self.assertEqual(p['X'], '%s-%s' % (clave[p['par']]['X'], p['caso']))
        ordenes = {(p['caso'], clave[p['par']]['X']) for p in lista}
        self.assertEqual(ordenes, {('c1', 'a'), ('c1', 'b'), ('c2', 'a'), ('c2', 'b')})
        self.assertEqual(len(next(p for p in lista if p['caso'] == 'c1')['contexto']), banco.CONTEXTO_MAX)
        self.assertEqual(next(p for p in lista if p['caso'] == 'c2')['contexto'], 'abre la puerta')

    def test_juzgar_y_resumen(self):
        lista, clave = banco.pares(self.tandas(), self.CASOS)

        # el juez prefiere siempre a 'a' en c1; en c2 elige siempre X (sesgo de posición)
        def juez(modelo, system, prompt, opciones, formato_json):
            par = next(p for p in lista if 'Respuesta X:\n%s\n' % p['X'] in prompt and 'Respuesta Y:\n%s\n' % p['Y'] in prompt)
            if par['caso'] == 'c2':
                return '{"ganador": "X", "motivo": "primero"}'
            return json.dumps({'ganador': 'X' if clave[par['par']]['X'] == 'a' else 'Y'})
        veredictos = banco.juzgar(lista, 'juez', 'rúbrica', juez)
        res = banco.resumen(lista, clave, veredictos)
        self.assertEqual(res['modelos']['a'], {'puntos': 3.0, 'jugadas': 4, 'tasa': 0.75})
        self.assertEqual(res['modelos']['b']['tasa'], 0.25)
        self.assertEqual(res['consistencia'], 0.5)
        self.assertEqual(res['sesgo_x'], 0.75)

    def test_juez_ilegible_es_empate(self):
        lista, clave = banco.pares(self.tandas(), self.CASOS)
        v = banco.juzgar(lista[:1], 'juez', 'r', lambda *a: 'no sé')
        self.assertEqual(v[0]['ganador'], 'empate')
        self.assertIn('ilegible', v[0]['aviso'])
        res = banco.resumen(lista, clave, v)
        self.assertEqual(res['sin_juzgar'], 3)
        self.assertEqual(banco.juzgar(lista[:1], 'juez', 'r', lambda *a: '[1]')[0]['ganador'], 'empate')

    def test_juez_caido_no_pierde_lo_juzgado(self):
        lista, clave = banco.pares(self.tandas(), self.CASOS)

        def juez(*a):
            if juez.n == 1:
                raise OSError('timeout')
            juez.n += 1
            return '{"ganador": "X"}'
        juez.n = 0
        v = banco.juzgar(lista[:2], 'juez', 'r', juez)
        self.assertEqual(v[1], {'par': lista[1]['par'], 'error': 'timeout'})
        self.assertEqual(banco.resumen(lista, clave, v)['juzgados'], 1)


if __name__ == '__main__':
    unittest.main()
