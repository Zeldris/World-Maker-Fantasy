import io, json, os, sys, tempfile, unittest
from contextlib import redirect_stdout

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import medir


def llamada(dur, perfil='deck', tarea='narrar', **extra):
    r = {'gen_ai.operation.name': 'text_completion', 'app.machine_profile': perfil, 'app.task': tarea,
         'app.duration_ms': dur}
    r.update(extra)
    return r


class MedirTest(unittest.TestCase):
    def setUp(self):
        self.tmp = []

    def tearDown(self):
        for f in self.tmp:
            os.unlink(f)

    def reg(self, lineas):
        f = tempfile.NamedTemporaryFile('w', suffix='.jsonl', delete=False, encoding='utf-8')
        f.write('\n'.join(l if isinstance(l, str) else json.dumps(l) for l in lineas) + '\n')
        f.close()
        self.tmp.append(f.name)
        return f.name

    def test_percentiles(self):
        self.assertEqual(medir.percentil([1, 2, 3, 4, 5], 50), 3)
        self.assertAlmostEqual(medir.percentil([10, 20], 95), 19.5)
        self.assertIsNone(medir.percentil([], 50))

    def test_fila_completa(self):
        rs = [llamada(1000, **{'gen_ai.usage.input_tokens': 100, 'gen_ai.usage.output_tokens': 50,
                               'app.decode_ms': 1000, 'app.load_ms': 500, 'app.ttft_ms': 200}),
              llamada(3000, **{'gen_ai.usage.input_tokens': 300, 'gen_ai.usage.output_tokens': 50,
                               'app.decode_ms': 1000, 'app.load_ms': 5, 'app.truncated': True, 'app.error': 'x'})]
        f = medir.fila_llamadas(rs)
        self.assertEqual((f['n'], f['p50_ms'], f['tok_in'], f['tok_out']), (2, 2000, 200, 50))
        self.assertEqual(f['tok_s'], 50)
        self.assertEqual((f['frio_pct'], f['recortado_pct'], f['error_pct']), (50, 50, 50))
        self.assertEqual(f['ttft_p50_ms'], 200)

    def test_campos_ausentes(self):
        f = medir.fila_llamadas([llamada(10)])
        self.assertIsNone(f['tok_s'])
        self.assertIsNone(f['ttft_p50_ms'])
        self.assertIsNone(f['tok_in'])
        self.assertEqual(f['frio_pct'], 0)

    def test_lineas_corruptas(self):
        r = medir.analizar(self.reg([llamada(10), '{no es json', '[1,2]', llamada(30)]))
        self.assertEqual(r['llamadas'][('deck', 'narrar')]['n'], 2)
        self.assertEqual(sum('corrupta' in a for a in r['avisos']), 2)

    def test_sin_perfil_avisa(self):
        r = medir.analizar(self.reg([{'app.task': 'clasificar', 'app.duration_ms': 5}]))
        self.assertIn(('desconocido', 'clasificar'), r['llamadas'])
        self.assertTrue(any('sin perfil' in a and 'clasificar' in a for a in r['avisos']))

    def test_filtro_perfil(self):
        r = medir.analizar(self.reg([llamada(10), llamada(20, perfil='cpu')]), 'cpu')
        self.assertEqual(list(r['llamadas']), [('cpu', 'narrar')])

    def test_rag(self):
        base = {'gen_ai.operation.name': 'retrieval', 'app.machine_profile': 'deck', 'app.task': 'rag'}
        ruta = self.reg([
            dict(base, **{'app.rag.embed_ms': 10, 'app.rag.search_ms': 4,
                          'app.rag.results': [{'id': 'a', 'score': 0.8}, {'id': 'b', 'score': 0.5}]}),
            dict(base, **{'app.rag.embed_ms': 30, 'app.rag.search_ms': 6,
                          'app.rag.results': [{'id': 'c', 'score': 0.6}]})])
        f = medir.analizar(ruta)['rag'][('deck', 'rag')]
        self.assertEqual((f['n'], f['embed_p50_ms'], f['search_p50_ms']), (2, 20, 5))
        self.assertAlmostEqual(f['score_1'], 0.7)

    def test_comparacion(self):
        act, ant = self.reg([llamada(2000)]), self.reg([llamada(1500)])
        buf = io.StringIO()
        with redirect_stdout(buf):
            medir.main([act, '--anterior', ant, '--json'])
        d = json.loads(buf.getvalue())
        self.assertEqual(d['diferencia_llamadas']['deck/narrar']['p50_ms'], 500)

    def test_comparacion_texto(self):
        act, ant = self.reg([llamada(2000)]), self.reg([llamada(1500)])
        buf = io.StringIO()
        with redirect_stdout(buf):
            medir.main([act, '--anterior', ant])
        self.assertIn('(+500)', buf.getvalue())

    def test_no_finitos_fuera(self):
        r = medir.analizar(self.reg(['{"app.machine_profile": "deck", "app.task": "narrar", "app.duration_ms": Infinity}',
                                     llamada(10, **{'gen_ai.usage.output_tokens': 5, 'app.decode_ms': float('nan')})]))
        f = r['llamadas'][('deck', 'narrar')]
        self.assertEqual((f['n'], f['p50_ms'], f['tok_s']), (2, 10, None))

    def test_archivo_inexistente(self):
        with self.assertRaises(SystemExit) as e:
            medir.analizar('/no/existe.jsonl')
        self.assertIn('No se puede leer', str(e.exception.code))

    def test_comparacion_sin_anterior(self):
        act, ant = self.reg([llamada(2000), llamada(10, perfil='cpu')]), self.reg([llamada(1500)])
        buf = io.StringIO()
        with redirect_stdout(buf):
            medir.main([act, '--anterior', ant])
        self.assertIn('cpu/narrar', buf.getvalue())
        self.assertIn('(sin anterior)', buf.getvalue())


if __name__ == '__main__':
    unittest.main()
