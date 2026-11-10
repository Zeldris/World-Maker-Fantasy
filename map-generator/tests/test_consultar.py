"""MAP-16: consultar.py responde en texto y en JSON lo que un agente necesita para armar lotes, y no escribe nada."""
import contextlib
import hashlib
import io
import json
import math
import os
import sys
import tempfile
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))

import consultar  # noqa: E402
import editar  # noqa: E402
import medir  # noqa: E402

MUNDO = medir.cargar()
math_dist = math.dist


def _huella():
    with open(medir.MUNDO, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def correr(*args):
    """(salida, stdout, stderr) de consultar.main."""
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        codigo = consultar.main(list(args))
    return codigo, out.getvalue(), err.getvalue()


def js(*args):
    codigo, out, err = correr(*args, '--json')
    assert codigo == 0, (args, out, err)
    return json.loads(out)


class TestConsultar(unittest.TestCase):
    def setUp(self):
        self.antes = _huella()

    def tearDown(self):
        self.assertEqual(_huella(), self.antes, 'consultar.py no escribe')

    def test_resumen(self):
        r = js('resumen')
        self.assertEqual((r['mapa']['ancho'], r['mapa']['alto']), (800, 600))
        self.assertEqual([e['nombre'] for e in r['regiones']], [e['nombre'] for e in MUNDO['regiones']])
        self.assertEqual(r['libres']['lugar'], max(lu['i'] for lu in MUNDO['lugares']) + 1)
        self.assertEqual(r['libres']['ruta'], len(MUNDO['rutas']))
        self.assertEqual(r['lugares'], len(MUNDO['lugares']))
        codigo, out, _ = correr('resumen')
        self.assertEqual(codigo, 0)
        self.assertIn('Llanuras del Viento Rojo', out)
        self.assertIn('i libres siguientes', out)

    def test_celda_por_punto_e_indice(self):
        lu = MUNDO['lugares'][1]
        c = js('celda', str(lu['x']), str(lu['y']))
        self.assertEqual(c['i'], lu['celda'])
        self.assertEqual(c['regionNombre'], 'Llanuras del Viento Rojo')
        self.assertEqual(c['tipo'], 'tierra')
        self.assertEqual([v['i'] for v in c['vecinas']], sorted(MUNDO['celdas'][c['i']]['c']))
        self.assertEqual(js('celda', '--i', str(c['i']))['centro'], c['centro'])
        _, out, _ = correr('celda', '--i', str(c['i']))
        self.assertIn(f"Celda {c['i']}", out)
        mar = next(x for x in MUNDO['celdas'] if x['h'] < 20)
        self.assertEqual(js('celda', '--i', str(mar['i']))['tipo'], 'mar')

    def test_nombres_con_espacios_sin_comillas_explican_las_comillas(self):
        for args in (('frontera', 'Ciénaga', 'Troncal', 'Margen'), ('region', 'Ciénaga', 'Troncal')):
            with self.subTest(args=args):
                codigo, out, err = correr(*args)
                self.assertEqual(codigo, 1)
                self.assertIn('sobran palabras', err)
                self.assertIn('entre comillas', err)
        codigo, out, err = correr('region', 'Ciénaga', 'Troncal', '--json')
        self.assertIn('entre comillas', json.loads(out)['error'])

    def test_celda_errores(self):
        for args, motivo in ((('celda', '--i', '99999'), 'no existe la celda'), (('celda', '900', '10'), 'no está dentro'),
                             (('celda',), 'da la posición'), (('celda', '1', '2', '--i', '3'), 'da la posición')):
            with self.subTest(args=args):
                codigo, out, err = correr(*args)
                self.assertEqual(codigo, 1)
                self.assertIn(motivo, err)

    def test_region_y_nombres(self):
        r = js('region', 'llanuras')
        self.assertEqual(r['i'], 18)
        self.assertEqual(r['celdas'], 435)
        self.assertEqual(r['capital']['i'], 612)
        self.assertEqual(len(r['provincias']), 4)
        self.assertAlmostEqual(r['envolvente']['este_oeste_km'], 127, delta=1)
        self.assertTrue(r['tocaMar'])
        self.assertEqual(js('region', '18'), r)
        self.assertEqual(js('region', 'CIENAGA')['nombre'], 'Ciénaga Troncal')  # sin tildes ni mayúsculas
        _, out, _ = correr('region', 'Meseta')
        self.assertIn('Ordinum', out)

    def test_nombres_ambiguos_o_inexistentes(self):
        codigo, _, err = correr('region', 'el')
        self.assertEqual(codigo, 1)
        self.assertIn('ambiguo', err)
        self.assertIn('Margen Silencioso', err)
        self.assertIn('Meseta del Orden', err)
        codigo, _, err = correr('region', 'Atlantis')
        self.assertEqual(codigo, 1)
        self.assertIn('no existe', err)
        codigo, out, _ = correr('region', 'Atlantis', '--json')
        self.assertEqual(codigo, 1)
        self.assertIn('error', json.loads(out))
        self.assertEqual(correr('region', '999')[0], 1)

    def test_frontera(self):
        f = js('frontera', 'Llanuras', 'Margen')
        self.assertEqual((f['a'], f['b']), ('Llanuras del Viento Rojo', 'El Margen Silencioso'))
        self.assertTrue(f['deA'] and f['deB'])
        for c in f['deA']:
            real = MUNDO['celdas'][c['i']]
            self.assertEqual(real['region'], 18)
            self.assertTrue(any(MUNDO['celdas'][j]['region'] == 20 for j in real['c']))
        ys = [c['centro'][1] for c in f['deA']]
        self.assertEqual(ys, sorted(ys))
        _, out, _ = correr('frontera', '18', '20')
        self.assertIn('que lindan con El Margen Silencioso', out)
        self.assertEqual(js('frontera', 'Llanuras', 'Meseta')['deA'], [])  # no lindan

    def test_frontera_con_mar_y_caja(self):
        f = js('frontera', 'Llanuras', 'mar')
        self.assertTrue(f['deA'] and f['deB'])
        self.assertTrue(all(c['h'] < 20 for c in f['deB']))
        c = js('frontera', 'Llanuras', 'Margen', '--caja', '0', '0', '800', '300')
        todas = js('frontera', 'Llanuras', 'Margen')
        self.assertLess(len(c['deA']), len(todas['deA']))
        self.assertTrue(all(x['centro'][1] <= 300 for x in c['deA'] + c['deB']))
        self.assertEqual(correr('frontera', 'Llanuras', 'Llanuras')[0], 1)
        self.assertEqual(correr('frontera', 'Llanuras', 'mar', '--caja', '5', '5', '1', '1')[0], 1)

    def test_costa(self):
        c = js('costa', 'Berig')
        self.assertEqual(c['tipo'], 'continente')
        self.assertTrue(c['tierra'] and c['mar'])
        self.assertTrue(all(x['h'] >= 20 for x in c['tierra']) and all(x['h'] < 20 for x in c['mar']))
        self.assertTrue(all(x['berig'] for x in c['tierra']))
        r = js('costa', 'Cristal')
        self.assertEqual(r['tipo'], 'región')
        self.assertTrue(set(x['i'] for x in r['tierra']) <= set(x['i'] for x in c['tierra']))
        _, out, _ = correr('costa', 'Berig', '--caja', '600', '0', '700', '40')
        self.assertIn('BERIG', out)
        peq = js('costa', 'Berig', '--caja', '600', '0', '700', '40')
        self.assertLess(len(peq['tierra']), len(c['tierra']))

    def test_lugares(self):
        ls = js('lugares')
        self.assertEqual([x['i'] for x in ls], sorted(lu['i'] for lu in MUNDO['lugares']))
        serhu = next(x for x in ls if x['i'] == 612)
        self.assertTrue(serhu['capital'] and serhu['protegido'] and serhu['celda'] == 1715)
        self.assertEqual([x['i'] for x in js('lugares', '--region', 'Meseta')], [615])
        cerca = js('lugares', '--cerca', '540', '190', '--radio', '10')
        self.assertEqual([x['i'] for x in cerca], [612])
        self.assertLess(cerca[0]['km'], 10)
        self.assertEqual(js('lugares', '--cerca', '540', '190', '--radio', '0.1'), [])
        self.assertEqual([x['i'] for x in js('lugares', '--caja', '500', '100', '700', '200')], [612, 613])
        _, out, _ = correr('lugares')
        self.assertIn('CAPITAL  CANON', out)

    # ------------------------------------------------------------ MAP-17

    def test_lugares_por_nombre(self):
        self.assertEqual([x['i'] for x in js('lugares', '--nombre', 'ORDINUM')], [615])
        self.assertEqual([x['i'] for x in js('lugares', '--nombre', 'puesto nabieus')], [614])
        self.assertEqual(js('lugares', '--nombre', 'no-existe-este-lugar'), [])
        todos = js('lugares', '--nombre', 'a')  # por fragmento y combinable con el resto de filtros
        self.assertGreater(len(todos), 3)
        self.assertEqual([x['i'] for x in js('lugares', '--nombre', 'ordin', '--region', 'Meseta')], [615])
        self.assertEqual(js('lugares', '--nombre', 'ordin', '--region', 'Llanuras'), [])
        self.assertEqual(js('lugares', '--nombre', 'ordinum', '--cerca', '540', '190', '--radio', '10'), [])
        _, out, _ = correr('lugares', '--nombre', 'campamento')
        self.assertIn('Campamento', out)

    def _lote_valido(self, grupo, pts):
        """El lote con la ruta pasa `editar.py` (sin guardar) sobre una copia del mapa."""
        with tempfile.TemporaryDirectory() as d:
            copia, lote = os.path.join(d, 'helek.json'), os.path.join(d, 'lote.json')
            with open(copia, 'w', encoding='utf-8') as f:
                json.dump(MUNDO, f)
            with open(lote, 'w', encoding='utf-8') as f:
                json.dump({'rutas': [{'i': len(MUNDO['rutas']), 'grupo': grupo, 'puntos': pts}]}, f)
            out, err = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                codigo = editar.main([lote, '--mundo', copia, '--sin-juego'])
            return codigo, out.getvalue() + err.getvalue()

    def test_camino_recto_ordinum_nabieus(self):
        r = js('camino', '570.94', '397.8', '581.38', '317.03')
        self.assertEqual(r['tipo'], 'recta')
        self.assertEqual(r['puntos'][0], [570.9, 397.8])
        self.assertEqual(r['puntos'][-1], [581.4, 317.0])
        self.assertTrue(all(len(p) == 2 and p == [round(p[0], 1), round(p[1], 1)] for p in r['puntos']))
        self.assertTrue(all(math_dist(a, b) <= 8.0 for a, b in zip(r['puntos'], r['puntos'][1:])))
        self.assertAlmostEqual(r['km'], 81.5, delta=0.5)
        self.assertEqual(r['lote'], {'puntos': r['puntos']})
        codigo, informe = self._lote_valido('roads', r['puntos'])
        self.assertEqual(codigo, 0, informe)
        _, out, _ = correr('camino', '570.94', '397.8', '581.38', '317.03')
        self.assertIn('Recta: 81.5 km, 12 puntos', out)
        self.assertIn('"puntos": [[570.9, 397.8]', out)
        _, corto, _ = correr('camino', '570.94', '397.8', '581.38', '317.03', '--paso', '20')
        self.assertIn('6 puntos', corto)

    def test_camino_con_rodeo_si_la_recta_cruza_mar(self):
        a, b = [107.9, 267.6], [88.4, 390.0]
        recta = consultar._muestreo([a, b], 8.0)
        self.assertTrue(any(MUNDO['celdas'][consultar.editar._localizador(MUNDO)(*p)]['h'] < 20 for p in recta))
        r = js('camino', *map(str, a + b))
        self.assertEqual(r['tipo'], 'rodeo')
        self.assertGreater(r['km'], math_dist(a, b) * MUNDO['fuente']['kmPorUnidad'])
        self.assertEqual((r['puntos'][0], r['puntos'][-1]), (a, b))
        self.assertTrue(all(math_dist(p, q) <= 8.5 for p, q in zip(r['puntos'], r['puntos'][1:])))
        codigo, informe = self._lote_valido('roads', r['puntos'])
        self.assertEqual(codigo, 0, informe)
        _, out, _ = correr('camino', *map(str, a + b))
        self.assertIn('Rodeo por celdas de tierra', out)

    def test_camino_por_mar(self):
        a, b = [475.1, 193.4], [506.8, 85.4]
        r = js('camino', *map(str, a + b), '--mar', '--paso', '10')
        self.assertEqual(r['tipo'], 'rodeo')
        self.assertEqual(r['medio'], 'agua')
        codigo, informe = self._lote_valido('searoutes', r['puntos'])
        self.assertEqual(codigo, 0, informe)
        # por tierra, ese mismo trazado en mar no vale como camino
        self.assertNotEqual(self._lote_valido('roads', r['puntos'])[0], 0)

    def test_camino_sin_camino_explica_el_motivo(self):
        codigo, _, err = correr('camino', '199.3', '473.5', '524.2', '429.2')
        self.assertEqual(codigo, 1)
        self.assertIn('no hay camino por tierra', err)
        self.assertIn('--mar', err)
        codigo, out, _ = correr('camino', '199.3', '473.5', '524.2', '429.2', '--json')
        self.assertEqual(codigo, 1)
        self.assertIn('no hay camino', json.loads(out)['error'])
        codigo, _, err = correr('camino', '100', '100', '700', '500')  # el inicio cae en mar
        self.assertEqual(codigo, 1)
        self.assertIn('cae en mar', err)
        self.assertEqual(correr('camino', '900', '10', '5', '5')[0], 1)
        self.assertEqual(correr('camino', '5', '5', '10', '10', '--paso', '0')[0], 1)

    def test_frontera_marca_lo_que_agranda_la_envolvente(self):
        f = js('frontera', 'Ciénaga', 'Margen')
        self.assertTrue(all('agranda' in c for c in f['deA'] + f['deB']))
        antes = {i: medir._medida(MUNDO, lambda c, i=i: c['region'] == i)['caja'] for i in (19, 20)}
        marcadas = 0
        for lado, destino in (('deA', 20), ('deB', 19)):
            for c in f[lado]:
                copia = json.loads(json.dumps(MUNDO))
                copia['celdas'][c['i']]['region'] = destino
                d = medir._medida(copia, lambda x, i=destino: x['region'] == i)['caja']
                a = antes[destino]
                real = [e for e, crece in (('E-O', d[2] - d[0] > a[2] - a[0] + 1e-6), ('N-S', d[3] - d[1] > a[3] - a[1] + 1e-6)) if crece]
                self.assertEqual(c['agranda'], real, c)
                marcadas += bool(real)
        self.assertTrue(0 < marcadas < len(f['deA'] + f['deB']))
        self.assertEqual(next(c for c in f['deB'] if c['i'] == 3153)['agranda'], ['N-S'])
        self.assertEqual(next(c for c in f['deB'] if c['i'] == 2981)['agranda'], [])
        _, out, _ = correr('frontera', 'Ciénaga', 'Margen')
        self.assertIn('3153 (622.6, 305.4) h 30 agranda N-S', out)
        self.assertTrue(all(c['agranda'] == [] for c in js('frontera', 'Llanuras', 'mar')['deA']))

    def test_fichas(self):
        todas = js('fichas')
        self.assertTrue(todas and all({'slug', 'nombre', 'tipo', 'lugar'} <= set(f) for f in todas))
        self.assertEqual([f['slug'] for f in todas], sorted(f['slug'] for f in todas))
        self.assertTrue(all(f['lugar'] is None for f in todas))  # ningún lugar del mapa lleva slug todavía
        cris = js('fichas', '--region', 'Cristal', '--sin-lugar')
        self.assertTrue(cris and all('Cristal Helado' in f['region'] for f in cris))
        _, out, _ = correr('fichas', '--region', 'Cristal')
        self.assertIn('SIN LUGAR', out)

    def test_fichas_con_lugar(self):
        copia = json.loads(json.dumps(MUNDO))
        ficha = consultar.enciclopedia.lugares()[0]
        copia['lugares'][0]['slug'] = ficha['slug']
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            ruta = os.path.join(d, 'helek.json')
            with open(ruta, 'w', encoding='utf-8') as f:
                json.dump(copia, f)
            con = js('fichas', '--mundo', ruta)
            self.assertEqual(next(f for f in con if f['slug'] == ficha['slug'])['lugar'], copia['lugares'][0]['i'])
            sin = js('fichas', '--sin-lugar', '--mundo', ruta)
            self.assertNotIn(ficha['slug'], [f['slug'] for f in sin])
            self.assertEqual(js('resumen', '--mundo', ruta)['lugares'], len(MUNDO['lugares']))

    def test_mundo_inexistente(self):
        codigo, _, err = correr('resumen', '--mundo', '/no/existe.json')
        self.assertEqual(codigo, 1)
        self.assertIn('no se puede leer', err)


if __name__ == '__main__':
    unittest.main()
