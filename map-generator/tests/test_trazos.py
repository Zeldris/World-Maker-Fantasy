"""MAP-8: lugares (enlazados a su ficha de la enciclopedia), rutas y ríos en el lote de editar.py, la lista de la
enciclopedia y que el relieve no deje fuera de sitio lo que el lote no redibuja."""
import contextlib
import io
import json
import os
import shutil
import sys
import tempfile
import threading
import unittest
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))

import editar  # noqa: E402
import enciclopedia  # noqa: E402
import importar  # noqa: E402
import medir  # noqa: E402
import servir  # noqa: E402

TIERRA = editar.TIERRA
CANON = editar.cargar_json(medir.CANON)
LORE = editar.cargar_json(editar.comprobar.LORE)
CATALOGO = [{'slug': 'agujas-iman', 'nombre': 'Las Agujas Imán', 'region': 'Las Llanuras del Viento Rojo', 'tipo': 'hito'},
            {'slug': 'campamento-serhu', 'nombre': 'Colmillo Ceniza - Karot Veku', 'region': 'x', 'tipo': 'asentamiento'}]


def _lugar(mundo, nombre):
    return next(lu for lu in mundo['lugares'] if lu['nombre'] == nombre)


def _tierra_de(mundo, continente_nombre):
    """Una celda de tierra del continente, sin lugar y lejos de la costa (todas sus vecinas son tierra)."""
    k = next(c['i'] for c in mundo['continentes'] if c['nombre'] == continente_nombre)
    con_lugar = {lu['celda'] for lu in mundo['lugares']}
    return next(c for c in mundo['celdas'] if c['h'] >= TIERRA and c['continente'] == k and c['i'] not in con_lugar
                and all(mundo['celdas'][j]['h'] >= TIERRA for j in c['c']))


def _mar(mundo):
    return next(c for c in mundo['celdas'] if c['h'] < TIERRA and all(mundo['celdas'][j]['h'] < TIERRA for j in c['c']))


class Localizador(unittest.TestCase):
    def test_la_celda_de_un_punto_es_la_de_centro_mas_cercano(self):
        mundo = medir.cargar()
        en = editar._localizador(mundo)
        for c in mundo['celdas'][::97]:
            self.assertEqual(en(*c['p']), c['i'])
        for x, y in ((0, 0), (800, 600), (123.4, 456.7), (799.9, 0.1)):
            esperada = min(mundo['celdas'], key=lambda c: ((c['p'][0] - x) ** 2 + (c['p'][1] - y) ** 2, c['i']))['i']
            self.assertEqual(en(x, y), esperada)


class Lugares(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mundo = medir.cargar()

    def _aplicar(self, cambios):
        return editar.aplicar(self.mundo, cambios, canon=CANON, catalogo=CATALOGO)

    def _error(self, cambios):
        with self.assertRaises(editar.ErrorDeEdicion) as e:
            self._aplicar(cambios)
        return str(e.exception)

    def test_crea_un_lugar_con_el_nombre_de_su_ficha(self):
        c = _tierra_de(self.mundo, 'Berig')
        nuevo = self._aplicar({'lugares': [{'i': 900, 'slug': 'agujas-iman', 'x': c['p'][0], 'y': c['p'][1]}]})
        lu = _lugar(nuevo, 'Las Agujas Imán')
        self.assertEqual((lu['i'], lu['slug'], lu['celda'], lu['tipo'], lu['capital']), (900, 'agujas-iman', c['i'], 'hito', False))
        self.assertEqual(len(self.mundo['lugares']) + 1, len(nuevo['lugares']))
        self.assertFalse(any(x['i'] == 900 for x in self.mundo['lugares']))

    def test_enlaza_mueve_y_renombra(self):
        c = _tierra_de(self.mundo, 'Vaelira')
        lu = next(x for x in self.mundo['lugares'] if x['nombre'] == 'Ordinum')
        nuevo = self._aplicar({'lugares': [{'i': lu['i'], 'slug': 'campamento-serhu'}]})
        self.assertEqual(_lugar(nuevo, 'Ordinum')['slug'], 'campamento-serhu')
        sin = editar.aplicar(nuevo, {'lugares': [{'i': lu['i'], 'slug': None}]}, canon=CANON, catalogo=CATALOGO)
        self.assertNotIn('slug', _lugar(sin, 'Ordinum'))
        nuevo = self._aplicar({'lugares': [{'i': 900, 'nombre': 'Prueba', 'x': c['p'][0], 'y': c['p'][1]}]})
        movido = editar.aplicar(nuevo, {'lugares': [{'i': 900, 'nombre': 'Otra', 'x': c['p'][0] + 0.004, 'y': c['p'][1]}]},
                                canon=CANON, catalogo=CATALOGO)
        self.assertEqual(_lugar(movido, 'Otra')['x'], round(c['p'][0] + 0.004, 2))

    def test_rechaza_con_su_motivo(self):
        mar = _mar(self.mundo)
        c = _tierra_de(self.mundo, 'Berig')
        capital = next(lu for lu in self.mundo['lugares'] if lu['capital'] and lu['nombre'] not in editar._nombres_del_canon(CANON))
        del_canon = CANON['medidas'][-1]['lugares'][0]
        no_capital_del_canon = _lugar(self.mundo, del_canon)
        casos = [
            ({'i': 900, 'nombre': 'X', 'x': mar['p'][0], 'y': mar['p'][1]}, 'caería en mar'),
            ({'i': 900, 'slug': 'no-existe', 'x': c['p'][0], 'y': c['p'][1]}, 'no hay ningún lugar con slug'),
            ({'i': 900, 'x': c['p'][0], 'y': c['p'][1]}, 'necesita un nombre o un slug'),
            ({'i': 900, 'nombre': 'X'}, 'necesita x e y'),
            ({'i': 900, 'nombre': 'X', 'x': -1, 'y': 5}, 'no está dentro del mapa'),
            ({'i': capital['i'], 'borrar': True}, 'es la capital'),
            ({'i': no_capital_del_canon['i'], 'nombre': 'Otro'}, 'lo nombra canon.json'),
            ({'i': capital['i'], 'tipo': 'x'}, 'campos que no se editan'),
            ({'i': 900, 'nombre': capital['nombre'], 'x': c['p'][0], 'y': c['p'][1]}, 'nombre de lugar repetido'),
        ]
        for op, motivo in casos:
            with self.subTest(op=op):
                self.assertIn(motivo, self._error({'lugares': [op]}))
        dos = [{'i': 900, 'slug': 'agujas-iman', 'x': c['p'][0], 'y': c['p'][1]},
               {'i': 901, 'slug': 'agujas-iman', 'nombre': 'Otra', 'x': c['p'][0], 'y': c['p'][1]}]
        self.assertIn('slug enlazado a dos lugares', self._error({'lugares': dos}))

    def test_una_capital_no_sale_de_su_region(self):
        cap = next(lu for lu in self.mundo['lugares'] if lu['capital'])
        otra = next(c for c in self.mundo['celdas'] if c['h'] >= TIERRA and c['region'] and c['region'] != cap['region'])
        self.assertIn('no cambia de región', self._error({'lugares': [{'i': cap['i'], 'x': otra['p'][0], 'y': otra['p'][1]}]}))

    def test_borra_un_lugar_que_no_es_capital_ni_del_canon(self):
        c = _tierra_de(self.mundo, 'Berig')
        con = self._aplicar({'lugares': [{'i': 900, 'nombre': 'Prueba', 'x': c['p'][0], 'y': c['p'][1]}]})
        sin = editar.aplicar(con, {'lugares': [{'i': 900, 'borrar': True}]}, canon=CANON, catalogo=CATALOGO)
        self.assertEqual(sin['lugares'], self.mundo['lugares'])


class Trazos(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mundo = medir.cargar()
        cls.en = staticmethod(editar._localizador(cls.mundo))

    def _error(self, cambios, mundo=None):
        with self.assertRaises(editar.ErrorDeEdicion) as e:
            editar.aplicar(mundo or self.mundo, cambios, canon=CANON, catalogo=CATALOGO)
        return str(e.exception)

    def _camino(self, continente):
        """Dos centros de celdas de interior vecinas del continente."""
        c = _tierra_de(self.mundo, continente)
        v = next(self.mundo['celdas'][j] for j in c['c'] if self.mundo['celdas'][j]['h'] >= TIERRA)
        return [list(c['p']), list(v['p'])]

    def test_crea_una_senda_con_su_continente_y_un_rio(self):
        puntos = self._camino('Vaelira')
        n = max(r['i'] for r in self.mundo['rutas']) + 1
        mar = _mar(self.mundo)
        nuevo = editar.aplicar(self.mundo, {'rutas': [{'i': n, 'grupo': 'trails', 'puntos': puntos}],
                                            'rios': [{'i': 1, 'nombre': ' Río Prueba ', 'puntos': puntos + [list(mar['p'])]}]})
        self.assertEqual(nuevo['rutas'][-1], {'i': n, 'grupo': 'trails', 'continente': 'Vaelira', 'puntos': puntos})
        self.assertEqual(nuevo['rios'], [{'i': 1, 'nombre': 'Río Prueba', 'puntos': puntos + [list(mar['p'])]}])
        renombrado = editar.aplicar(nuevo, {'rios': [{'i': 1, 'nombre': 'Otro'}]})
        self.assertEqual(renombrado['rios'][0]['puntos'], nuevo['rios'][0]['puntos'])
        self.assertEqual(editar.aplicar(nuevo, {'rios': [{'i': 1, 'borrar': True}]})['rios'], [])

    def test_rechaza_trazos_fuera_de_sitio(self):
        tierra = self._camino('Vaelira')
        mar = _mar(self.mundo)
        mar2 = next(self.mundo['celdas'][j] for j in mar['c'])
        berig = self._camino('Berig')
        casos = [
            ({'rutas': [{'i': 999, 'grupo': 'trails', 'puntos': [tierra[0], list(mar['p'])]}]}, 'un camino o una senda van por tierra'),
            ({'rutas': [{'i': 999, 'grupo': 'searoutes', 'puntos': [list(mar['p'])] + tierra + [list(mar2['p'])]}]}, 'va por agua salvo sus extremos'),
            ({'rutas': [{'i': 999, 'grupo': 'roads', 'puntos': [tierra[0], berig[0]]}]}, 'entre continentes va una ruta marítima'),
            ({'rutas': [{'i': 999, 'grupo': 'autopista', 'puntos': tierra}]}, 'grupo'),
            ({'rutas': [{'i': 999, 'grupo': 'trails', 'puntos': [tierra[0]]}]}, 'al menos dos'),
            ({'rutas': [{'i': 999, 'grupo': 'trails'}]}, 'necesita puntos'),
            ({'rutas': [{'i': 99999, 'borrar': True}]}, 'de uno que exista'),
            ({'rios': [{'i': 1, 'puntos': [list(mar['p']), tierra[0]]}]}, 'solo su último punto'),
            ({'rios': [{'i': 1, 'puntos': tierra, 'grupo': 'trails'}]}, 'campos que no se editan'),
        ]
        for lote, motivo in casos:
            with self.subTest(lote=lote):
                self.assertIn(motivo, self._error(lote))
        # Una ruta marítima puede salir y llegar a tierra (puertos).
        editar.aplicar(self.mundo, {'rutas': [{'i': 999, 'grupo': 'searoutes', 'puntos': [tierra[0], list(mar['p']), tierra[0]]}]})

    def test_el_relieve_no_deja_una_ruta_sobre_el_mar_salvo_que_se_redibuje(self):
        # Una senda de Vaelira (Berig está bloqueado) con todos sus puntos en tierra: se hunde una de sus celdas.
        ruta, k = None, None
        for r in self.mundo['rutas']:
            if r['continente'] == 'Vaelira' and r['grupo'] == 'trails':
                ks = [self.en(*p) for p in r['puntos']]
                if all(self.mundo['celdas'][x]['h'] >= TIERRA for x in ks):
                    ruta, k = r, ks[len(ks) // 2]
                    break
        self.assertIn(f"la ruta {ruta['i']}", self._error({'alturas': [[k, 5]]}))
        self.assertIn('redibújala o bórrala', self._error({'alturas': [[k, 5]]}))
        nuevo = editar.aplicar(self.mundo, {'alturas': [[k, 5]], 'rutas': [{'i': ruta['i'], 'borrar': True}]})
        self.assertFalse(any(r['i'] == ruta['i'] for r in nuevo['rutas']))

    def test_lo_que_ya_estaba_fuera_de_sitio_no_bloquea_otras_ediciones(self):
        # Azgaar dejó sendas con algún punto en agua: un lote que no las toca no se rechaza por ellas.
        malas = [r for r in self.mundo['rutas'] if r['grupo'] != 'searoutes'
                 and any(self.mundo['celdas'][self.en(*p)]['h'] < TIERRA for p in r['puntos'])]
        self.assertTrue(malas)
        c = next(c for c in self.mundo['celdas'] if c['h'] >= TIERRA + 5 and c['continente'] != 3
                 and all(self.mundo['celdas'][j]['h'] >= TIERRA for j in c['c']))
        editar.aplicar(self.mundo, {'alturas': [[c['i'], c['h'] + 1]]})


class InformeYGuardado(unittest.TestCase):
    def test_el_informe_dice_que_lugares_rutas_y_rios_cambian(self):
        mundo = medir.cargar()
        c = _tierra_de(mundo, 'Berig')
        nuevo = editar.aplicar(mundo, {'lugares': [{'i': 900, 'nombre': 'Prueba', 'x': c['p'][0], 'y': c['p'][1]}],
                                       'rutas': [{'i': 0, 'borrar': True}]}, canon=CANON, catalogo=CATALOGO)
        inf = editar.informe(mundo, nuevo, CANON, LORE)
        self.assertEqual(inf['trazos']['lugares'], {'nuevos': ['Prueba'], 'cambian': [], 'borrados': []})
        self.assertEqual(inf['trazos']['rutas']['borrados'], ['la ruta 0 (camino, Vaelira)'])
        texto = editar.texto_informe(inf)
        self.assertIn('Lugares: 1 nuevos (Prueba).', texto)
        self.assertIn('Rutas: 1 borrados (la ruta 0 (camino, Vaelira)).', texto)

    def test_por_consola_guarda_un_rio_en_helek_y_en_el_geojson(self):
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d)
        ruta = os.path.join(d, 'helek.json')
        shutil.copy(medir.MUNDO, ruta)
        mundo = medir.cargar(ruta)
        c = _tierra_de(mundo, 'Vaelira')
        v = next(mundo['celdas'][j] for j in c['c'])
        lote = os.path.join(d, 'lote.json')
        with open(lote, 'w') as f:
            json.dump({'rios': [{'i': 1, 'nombre': 'Río Prueba', 'puntos': [c['p'], v['p']]}]}, f)
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(editar.main([lote, '--mundo', ruta, '--guardar']), 0)
        self.assertEqual(medir.cargar(ruta)['rios'][0]['nombre'], 'Río Prueba')
        with open(os.path.join(d, 'helek.geojson')) as f:
            rios = [x for x in json.load(f)['features'] if x['properties']['capa'] == 'rio']
        self.assertEqual([x['properties']['nombre'] for x in rios], ['Río Prueba'])
        with open(ruta) as f:
            self.assertEqual(f.read(), importar.volcar(medir.cargar(ruta)))


class Enciclopedia(unittest.TestCase):
    def test_lee_todos_los_lugares_del_catalogo(self):
        lista = enciclopedia.lugares()
        with open(enciclopedia.CATALOGO, encoding='utf-8') as f:
            texto = f.read()
        bloque = texto[texto.index(enciclopedia.INICIO):]
        bloque = bloque[:bloque.index('\n];')]
        self.assertEqual(len(lista), bloque.count('\n  {\n'))
        slugs = [e['slug'] for e in lista]
        self.assertEqual(len(slugs), len(set(slugs)))
        serhu = next(e for e in lista if e['slug'] == 'campamento-serhu')
        self.assertEqual(serhu, {'slug': 'campamento-serhu', 'nombre': 'Colmillo Ceniza - Karot Veku',
                                 'region': 'Las Llanuras del Viento Rojo', 'tipo': 'asentamiento'})

    def test_un_lugar_que_no_se_reconoce_falla_con_su_motivo(self):
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d)
        ruta = os.path.join(d, 'cat.ts')
        with open(ruta, 'w') as f:
            f.write(enciclopedia.INICIO + "\n  {\n    slug: 'a',\n    name: 'A',\n    kind: 'hito',\n  },\n];\n")
        with self.assertRaises(ValueError) as e:
            enciclopedia.lugares(ruta)
        self.assertIn('cat.ts:6: lugar sin slug', str(e.exception))

    def test_el_servidor_la_sirve(self):
        srv = servir.servidor(0, juego=None)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        self.addCleanup(srv.server_close)
        self.addCleanup(srv.shutdown)
        with urllib.request.urlopen(f'http://127.0.0.1:{srv.server_address[1]}/enciclopedia.json', timeout=30) as r:
            self.assertEqual(json.loads(r.read()), enciclopedia.lugares())


if __name__ == '__main__':
    unittest.main()
