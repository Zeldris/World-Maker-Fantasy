"""MAP-9: cada guardado queda en el historial y se puede deshacer (y rehacer restaurando), siempre sobre una copia."""
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
import historial  # noqa: E402
import medir  # noqa: E402
import servir  # noqa: E402

GEOJSON = os.path.join(os.path.dirname(medir.MUNDO), 'helek.geojson')


def _leer(ruta):
    with open(ruta, 'rb') as f:
        return f.read()


class Copia(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.mundo = os.path.join(self.dir, 'helek.json')
        shutil.copy(medir.MUNDO, self.mundo)
        shutil.copy(GEOJSON, os.path.join(self.dir, 'helek.geojson'))
        self.original = _leer(self.mundo)
        m = medir.cargar(self.mundo)
        berig = next(k['i'] for k in m['continentes'] if k['nombre'] == 'Berig')
        self.celda = next(c for c in m['celdas'] if c['h'] >= 25 and c['continente'] not in (0, berig))

    def tearDown(self):
        shutil.rmtree(self.dir)

    def _consola(self, *args):
        sal, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(sal), contextlib.redirect_stderr(err):
            codigo = editar.main([*args, '--mundo', self.mundo, '--sin-juego'])
        return codigo, sal.getvalue(), err.getvalue()

    def _guardar_altura(self, h):
        ruta = os.path.join(self.dir, 'lote.json')
        with open(ruta, 'w', encoding='utf-8') as f:
            json.dump({'alturas': [[self.celda['i'], h]]}, f)
        codigo, sal, err = self._consola(ruta, '--guardar')
        self.assertEqual(codigo, 0, sal + err)
        return _leer(self.mundo)


class Historial(Copia):
    def test_deshacer_recorre_los_guardados_hacia_atras_byte_a_byte(self):
        v1 = self._guardar_altura(31)
        self._guardar_altura(33)
        self.assertEqual([e['tipo'] for e in historial.entradas(self.mundo)], ['guardar', 'guardar'])
        self.assertIn('1 altura(s)', historial.entradas(self.mundo)[0]['resumen'])
        codigo, sal, _ = self._consola('--deshacer')
        self.assertEqual(codigo, 0)
        self.assertIn('Deshecho el guardado', sal)
        self.assertEqual(_leer(self.mundo), v1)
        self.assertEqual(self._consola('--deshacer')[0], 0)
        self.assertEqual(_leer(self.mundo), self.original)
        self.assertEqual(_leer(os.path.join(self.dir, 'helek.geojson')), _leer(GEOJSON))
        codigo, _, err = self._consola('--deshacer')
        self.assertEqual(codigo, 1)
        self.assertIn('no hay ningún guardado que deshacer', err)
        self.assertEqual(_leer(self.mundo), self.original)

    def test_restaurar_rehace_lo_deshecho(self):
        v1 = self._guardar_altura(31)
        self._consola('--deshacer')
        codigo, sal, _ = self._consola('--restaurar', editar.huella(v1)[:10])
        self.assertEqual(codigo, 0, sal)
        self.assertEqual(_leer(self.mundo), v1)
        self.assertEqual(historial.entradas(self.mundo)[-1]['tipo'], 'restaurar')
        codigo, _, err = self._consola('--restaurar', 'zzz')
        self.assertEqual(codigo, 1)
        self.assertIn('ninguna versión', err)

    def test_un_guardado_sin_cambios_no_se_apunta(self):
        editar.guardar(medir.cargar(self.mundo), self.mundo, ruta_juego=None)
        self.assertEqual(historial.entradas(self.mundo), [])
        codigo, sal, _ = self._consola('--historial')
        self.assertEqual(codigo, 0)
        self.assertIn('Sin historial', sal)

    def test_historial_por_consola(self):
        self._guardar_altura(31)
        codigo, sal, _ = self._consola('--historial')
        self.assertEqual(codigo, 0)
        self.assertIn('guardar', sal)
        self.assertIn('Deshacer volvería a', sal)
        codigo, _, err = self._consola('--historial', '--deshacer')
        self.assertEqual(codigo, 1)
        self.assertIn('solo uno', err)

    def test_las_copias_viejas_se_podan_y_deshacer_lo_dice(self):
        viejo = historial.MAXIMO
        historial.MAXIMO = 2
        try:
            for h in (31, 33, 35):
                self._guardar_altura(h)
        finally:
            historial.MAXIMO = viejo
        copias = [n for n in os.listdir(historial.carpeta(self.mundo)) if n.endswith('.json')]
        self.assertEqual(len(copias), 3)  # las de los dos últimos guardados: 31, 33 y 35
        self.assertIsNone(historial.version(self.mundo, editar.huella(self.original)))
        self._consola('--deshacer')
        self._consola('--deshacer')
        codigo, _, err = self._consola('--deshacer')
        self.assertEqual(codigo, 1)
        self.assertIn('recupérala con git', err)

    def test_una_copia_manipulada_no_se_restaura(self):
        self._guardar_altura(31)
        ruta = os.path.join(historial.carpeta(self.mundo), editar.huella(self.original) + '.json')
        with open(ruta, 'ab') as f:
            f.write(b' ')
        actual = _leer(self.mundo)
        self.assertEqual(self._consola('--deshacer')[0], 1)
        self.assertEqual(_leer(self.mundo), actual)


class Servidor(Copia):
    def setUp(self):
        super().setUp()
        self.juego = os.path.join(self.dir, 'juego.ts')
        self.srv = servir.servidor(0, mundo=self.mundo, juego=self.juego)
        self.url = f'http://127.0.0.1:{self.srv.server_address[1]}'
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def tearDown(self):
        self.srv.shutdown()
        self.srv.server_close()
        super().tearDown()

    def _post(self, ruta, cuerpo):
        req = urllib.request.Request(self.url + ruta, data=json.dumps(cuerpo).encode(),
                                     headers={'Content-Type': 'application/json'}, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def _historial(self):
        with urllib.request.urlopen(self.url + '/historial.json', timeout=30) as r:
            return json.loads(r.read())

    def test_guardar_y_deshacer_desde_el_visor(self):
        self.assertIsNone(self._historial()['deshacer'])
        base = editar.huella(self.original)
        st, inf = self._post('/guardar', {'base': base, 'alturas': [[self.celda['i'], 31]]})
        self.assertEqual(st, 200, inf)
        hist = self._historial()
        self.assertEqual((hist['huella'], hist['deshacer']['antes']), (inf['huella'], base))
        st, res = self._post('/deshacer', {'base': base})
        self.assertEqual(st, 409)
        self.assertIn('ha cambiado', res['error'])
        os.unlink(self.juego)
        st, res = self._post('/deshacer', {'base': inf['huella']})
        self.assertEqual(st, 200, res)
        self.assertEqual((res['huella'], _leer(self.mundo)), (base, self.original))
        self.assertTrue(os.path.exists(self.juego))
        st, res = self._post('/deshacer', {'base': base})
        self.assertEqual(st, 409)
        self.assertIn('no hay ningún guardado', res['error'])


if __name__ == '__main__':
    unittest.main()
