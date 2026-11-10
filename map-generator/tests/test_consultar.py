"""MAP-16: consultar.py responde en texto y en JSON lo que un agente necesita para armar lotes, y no escribe nada."""
import contextlib
import hashlib
import io
import json
import os
import sys
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))

import consultar  # noqa: E402
import medir  # noqa: E402

MUNDO = medir.cargar()


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
