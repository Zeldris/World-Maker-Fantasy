"""MAP-6: editar regiones y provincias valida cada cambio, avisa de qué medidas cambian y del canon y el lore, y
guarda helek.json (con su GeoJSON y el archivo del juego) solo desde el propio visor y sobre la versión actual."""
import contextlib
import io
import json
import os
import shutil
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))

import editar  # noqa: E402
import exportar  # noqa: E402
import geometria  # noqa: E402
import importar  # noqa: E402
import medir  # noqa: E402
import servir  # noqa: E402

CANON = editar.cargar_json(medir.CANON)
LORE = editar.cargar_json(editar.comprobar.LORE)


def _celda_junto_a_provincia(mundo, prov):
    """Una celda de tierra de la región de `prov`, sin provincia, que linda con ella."""
    region = next(p['region'] for p in mundo['provincias'] if p['i'] == prov)
    for c in mundo['celdas']:
        if c['h'] >= 20 and c['region'] == region and c['provincia'] == 0 and not any(
                lu['celda'] == c['i'] for lu in mundo['lugares']):
            if any(mundo['celdas'][j]['provincia'] == prov for j in c['c']):
                return c
    raise AssertionError('no hay celda junto a la provincia')


class Aplicar(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mundo = medir.cargar()

    def _error(self, cambios):
        with self.assertRaises(editar.ErrorDeEdicion) as e:
            editar.aplicar(self.mundo, cambios)
        return str(e.exception)

    def test_mueve_celdas_sin_tocar_el_mundo_de_entrada(self):
        c = _celda_junto_a_provincia(self.mundo, 2)
        nuevo = editar.aplicar(self.mundo, {'celdas': [[c['i'], c['region'], 2]]})
        self.assertEqual(nuevo['celdas'][c['i']]['provincia'], 2)
        self.assertEqual(self.mundo['celdas'][c['i']]['provincia'], 0)

    def test_rechaza_lo_que_no_cuadra_con_su_motivo(self):
        mar = next(c for c in self.mundo['celdas'] if c['h'] < 20)
        tierra = _celda_junto_a_provincia(self.mundo, 2)
        capital = self.mundo['lugares'][0]
        otra = next(r['i'] for r in self.mundo['regiones'] if r['i'] != capital['region'])
        casos = {
            'es mar': {'celdas': [[mar['i'], 18, 0]]},
            'no existe la región 99': {'celdas': [[tierra['i'], 99, 0]]},
            'no es de la región 19': {'celdas': [[tierra['i'], 19, 1]]},
            f"es de {capital['nombre']}": {'celdas': [[capital['celda'], otra, 0]]},
            'no existe la celda': {'celdas': [[len(self.mundo['celdas']), 18, 0]]},
            'mal formado': {'celdas': [[tierra['i'], 18]]},
            'nombre de provincia repetido: Cauce Viejo': {'provincias': [{'i': 1, 'nombre': 'Cauce Viejo'}]},
            'solo se cambia el nombre': {'provincias': [{'i': 1, 'nombre': 'X', 'region': 19}]},
            'necesita una región': {'provincias': [{'i': 9, 'nombre': 'X', 'region': 0, 'color': '#112233'}]},
            'necesita un color': {'provincias': [{'i': 9, 'nombre': 'X', 'region': 18, 'color': 'rojo'}]},
            'necesita un nombre': {'provincias': [{'i': 9, 'nombre': '  ', 'region': 18, 'color': '#112233'}]},
        }
        for motivo, cambios in casos.items():
            with self.subTest(motivo=motivo):
                self.assertIn(motivo, self._error(cambios))

    def test_provincia_nueva_con_celdas_y_su_centro(self):
        c = _celda_junto_a_provincia(self.mundo, 2)
        nuevo = editar.aplicar(self.mundo, {
            'celdas': [[c['i'], c['region'], 9]],
            'provincias': [{'i': 9, 'nombre': 'Prueba', 'region': c['region'], 'color': '#AA5533'}]})
        p = next(p for p in nuevo['provincias'] if p['i'] == 9)
        self.assertEqual((p['nombre'], p['color'], p['centro']), ('Prueba', '#aa5533', c['i']))

    def test_el_centro_se_mueve_si_su_celda_sale_de_la_provincia(self):
        p = self.mundo['provincias'][0]
        nuevo = editar.aplicar(self.mundo, {'celdas': [[p['centro'], p['region'], 0]]})
        centro = next(q for q in nuevo['provincias'] if q['i'] == p['i'])['centro']
        self.assertNotEqual(centro, p['centro'])
        self.assertEqual(nuevo['celdas'][centro]['provincia'], p['i'])


class Informe(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mundo = medir.cargar()

    def test_sin_cambios_no_cambia_nada_y_todo_se_cumple(self):
        inf = editar.informe(self.mundo, editar.aplicar(self.mundo, {}), CANON, LORE)
        self.assertEqual(inf['cambian'], [])
        self.assertTrue(inf['ok'])

    def test_mover_una_frontera_dice_que_regiones_cambian_y_cuanto(self):
        llanuras = [c for c in self.mundo['celdas'] if c['region'] == 18 and c['provincia'] == 0][:30]
        nuevo = editar.aplicar(self.mundo, {'celdas': [[c['i'], 19, 0] for c in llanuras]})
        inf = editar.informe(self.mundo, nuevo, CANON, LORE)
        por = {e['nombre']: e for e in inf['cambian']}
        self.assertEqual(set(por), {'Llanuras del Viento Rojo', 'Ciénaga Troncal'})
        ids = {c['i'] for c in llanuras}
        movida = geometria.area(medir._poligonos(self.mundo, lambda c: c['i'] in ids))
        ll, ci = por['Llanuras del Viento Rojo'], por['Ciénaga Troncal']
        self.assertAlmostEqual(ll['antes']['area'] - ll['despues']['area'], movida, places=3)
        self.assertAlmostEqual(ci['despues']['area'] - ci['antes']['area'], movida, places=3)
        self.assertFalse(inf['ok'])  # 30 celdas del norte de las Llanuras a la Ciénaga rompen el lore

    def test_renombrar_una_provincia_del_lore_falla_sin_colgarse(self):
        nuevo = editar.aplicar(self.mundo, {'provincias': [{'i': 1, 'nombre': 'Otro nombre'}]})
        inf = editar.informe(self.mundo, nuevo, CANON, LORE)
        self.assertFalse(inf['ok'])
        self.assertTrue(any(not r['ok'] for r in inf['lore']))


class Guardar(unittest.TestCase):
    def test_guardar_sin_cambios_deja_los_archivos_byte_a_byte(self):
        mundo = medir.cargar()
        with tempfile.TemporaryDirectory() as d:
            huella = editar.guardar(mundo, os.path.join(d, 'helek.json'), ruta_juego=os.path.join(d, 'juego.ts'))
            for nuestro, original in (('helek.json', medir.MUNDO),
                                      ('helek.geojson', os.path.join(os.path.dirname(medir.MUNDO), 'helek.geojson')),
                                      ('juego.ts', exportar.SALIDA)):
                with self.subTest(archivo=nuestro), open(os.path.join(d, nuestro), 'rb') as a, open(original, 'rb') as b:
                    self.assertEqual(a.read(), b.read())
            with open(medir.MUNDO, 'rb') as f:
                self.assertEqual(huella, editar.huella(f.read()))

    def test_importar_no_pisa_un_mapa_editado(self):
        with tempfile.TemporaryDirectory() as d:
            destino = os.path.join(d, 'helek.json')
            shutil.copy(medir.MUNDO, destino)
            with open(destino, 'a', encoding='utf-8') as f:
                f.write(' ')
            err = io.StringIO()
            with contextlib.redirect_stderr(err), contextlib.redirect_stdout(io.StringIO()):
                codigo = importar.main(['--salida', d])
            self.assertEqual(codigo, 1)
            self.assertIn('tiene cambios del editor', err.getvalue())
            with open(destino, encoding='utf-8') as f:
                self.assertTrue(f.read().endswith('\n '))
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(importar.main(['--salida', d, '--sobrescribir']), 0)
            with open(destino, 'rb') as a, open(medir.MUNDO, 'rb') as b:
                self.assertEqual(a.read(), b.read())


class Servidor(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.mundo = os.path.join(self.dir, 'helek.json')
        self.juego = os.path.join(self.dir, 'juego.ts')
        shutil.copy(medir.MUNDO, self.mundo)
        self.srv = servir.servidor(0, mundo=self.mundo, juego=self.juego)
        self.url = f'http://127.0.0.1:{self.srv.server_address[1]}'
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.base = editar.huella(open(self.mundo, 'rb').read())

    def tearDown(self):
        self.srv.shutdown()
        self.srv.server_close()
        shutil.rmtree(self.dir)

    def _post(self, ruta, cuerpo, tipo='application/json', origen=None):
        cab = {'Content-Type': tipo}
        if origen:
            cab['Origin'] = origen
        req = urllib.request.Request(self.url + ruta, data=json.dumps(cuerpo).encode(), headers=cab, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def _sin_tocar(self):
        with open(self.mundo, 'rb') as a, open(medir.MUNDO, 'rb') as b:
            self.assertEqual(a.read(), b.read())
        self.assertFalse(os.path.exists(self.juego))

    def test_la_huella_del_mapa_va_en_su_cabecera(self):
        with urllib.request.urlopen(self.url + '/helek.json', timeout=30) as r:
            self.assertEqual(r.headers['X-Huella'], self.base)

    def test_comprobar_no_escribe(self):
        c = _celda_junto_a_provincia(medir.cargar(self.mundo), 2)
        st, inf = self._post('/comprobar', {'base': self.base, 'celdas': [[c['i'], c['region'], 2]]})
        self.assertEqual(st, 200, inf)
        self.assertEqual([e['nombre'] for e in inf['cambian']], ['Cauce Viejo'])
        self.assertFalse(inf['guardado'])
        self._sin_tocar()

    def test_guardar_escribe_el_mapa_y_el_archivo_del_juego(self):
        mundo = medir.cargar(self.mundo)
        c = _celda_junto_a_provincia(mundo, 2)
        st, inf = self._post('/guardar', {'base': self.base, 'celdas': [[c['i'], c['region'], 2]]})
        self.assertEqual(st, 200, inf)
        self.assertTrue(inf['guardado'])
        guardado = medir.cargar(self.mundo)
        self.assertEqual(guardado['celdas'][c['i']]['provincia'], 2)
        self.assertEqual(inf['huella'], editar.huella(open(self.mundo, 'rb').read()))
        with open(self.juego, encoding='utf-8') as f:
            self.assertEqual(f.read(), exportar.generar(guardado))
        # El lote parte de la versión anterior: otro guardado con la misma base se rechaza.
        st, inf = self._post('/guardar', {'base': self.base, 'celdas': []})
        self.assertEqual(st, 409)
        self.assertIn('ha cambiado', inf['error'])

    def test_si_falla_el_lore_solo_se_guarda_confirmandolo(self):
        lote = {'base': self.base, 'provincias': [{'i': 1, 'nombre': 'Otro nombre'}]}
        st, inf = self._post('/guardar', lote)
        self.assertEqual(st, 422)
        self.assertIn('no se guarda sin confirmarlo', inf['error'])
        self._sin_tocar()
        st, inf = self._post('/guardar', {**lote, 'forzar': True})
        self.assertEqual(st, 200, inf)
        self.assertEqual(medir.cargar(self.mundo)['provincias'][0]['nombre'], 'Otro nombre')

    def test_rechaza_lo_que_no_viene_del_visor(self):
        lote = {'base': self.base, 'provincias': [{'i': 9, 'nombre': 'X', 'region': 18, 'color': '#112233'}]}
        for motivo, kw in (('otro origen', {'origen': 'http://ejemplo.invalid'}), ('no JSON', {'tipo': 'text/plain'})):
            with self.subTest(motivo=motivo):
                st, inf = self._post('/guardar', lote, **kw)
                self.assertEqual(st, 403)
                self.assertIn('desde el propio visor', inf['error'])
        st, inf = self._post('/guardar', {'base': self.base, 'celdas': [[0, 18, 0]]})
        self.assertEqual(st, 400)
        self.assertIn('es mar', inf['error'])
        self._sin_tocar()


if __name__ == '__main__':
    unittest.main()
