"""MAP-3: el mapa propio cumple las reglas del lore, y cada cambio que las rompe hace fallar la regla concreta."""
import contextlib
import copy
import io
import json
import os
import sys
import tempfile
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))

import comprobar  # noqa: E402


def _lore():
    with open(comprobar.LORE, encoding='utf-8') as f:
        return json.load(f)


def _region(mundo, nombre):
    return next(r['i'] for r in mundo['regiones'] if r['nombre'] == nombre)


class Lore(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mundo = comprobar.cargar()
        cls.lore = _lore()
        cls.base = {r['id']: (ok, d) for r, ok, d in comprobar.comprobar(cls.mundo, cls.lore)}

    def resultado(self, mundo):
        return {r['id']: (ok, d) for r, ok, d in comprobar.comprobar(mundo, self.lore)}

    def nuevos_fallos(self, mundo):
        """Reglas que fallan en `mundo` y no fallaban en el mapa real, con su detalle."""
        return {i: d for i, (ok, d) in self.resultado(mundo).items() if not ok and self.base[i][0]}

    def test_helek_json_cumple_todas_las_reglas(self):
        fallan = {i: d for i, (ok, d) in self.base.items() if not ok}
        self.assertEqual(fallan, {}, 'reglas del lore sin cumplir: lo que las mueva lo decide la usuaria')

    def test_meseta_que_linda_con_llanuras_rompe_meseta_solo_margen(self):
        mundo = copy.deepcopy(self.mundo)
        celdas = mundo['celdas']
        llanuras, margen, meseta = (_region(mundo, n) for n in (
            'Llanuras del Viento Rojo', 'El Margen Silencioso', 'La Meseta del Orden'))
        # Llanuras vecinas del Margen que conservan alguna vecina de Llanuras sin cambiar: las nuevas lindan con ellas.
        candidatas = [c for c in celdas if c['h'] >= 20 and c['region'] == llanuras
                      and any(celdas[j]['region'] == margen for j in c['c'])]
        elegidas = candidatas[:10]
        ids = {c['i'] for c in elegidas}
        self.assertEqual(len(elegidas), 10)
        for c in elegidas:
            self.assertTrue(any(celdas[j]['region'] == llanuras and j not in ids for j in c['c']))
            c['region'] = meseta
        nuevos = self.nuevos_fallos(mundo)
        self.assertIn('meseta-solo-margen', nuevos)
        self.assertIn('Llanuras del Viento Rojo', nuevos['meseta-solo-margen'])

    def test_intercambiar_llanuras_y_cienaga_rompe_llanuras_al_oeste(self):
        mundo = copy.deepcopy(self.mundo)
        for c in mundo['celdas']:
            if c['region'] in (18, 19):
                c['region'] = 37 - c['region']
        nuevos = self.nuevos_fallos(mundo)
        self.assertIn('llanuras-al-oeste', nuevos)
        xa, xb = (float(s) for s in nuevos['llanuras-al-oeste'].replace('x del centro: ', '').split(' y '))
        self.assertGreater(xa, xb)

    def test_margen_sin_costa_occidental_rompe_corredor_costero(self):
        mundo = copy.deepcopy(self.mundo)
        celdas = mundo['celdas']
        margen = _region(mundo, 'El Margen Silencioso')
        propias = [c for c in celdas if c['h'] >= 20 and c['region'] == margen]
        x_centro = sum(c['p'][0] for c in propias) / len(propias)
        # Al hundir las costeras, las de detrás pasan a ser costeras: se repite hasta que no queda costa occidental.
        capas = 0
        while True:
            costeras = [c for c in propias if c['h'] >= 20 and c['p'][0] < x_centro and comprobar._tiene_mar(mundo, c)]
            if not costeras:
                break
            for c in costeras:
                c['h'] = 10
            capas += 1
        self.assertGreater(capas, 0)
        nuevos = self.nuevos_fallos(mundo)
        self.assertEqual(nuevos.get('corredor-costero'), 'sin camino por tierra')

    def test_margen_que_no_cierra_la_cienaga_rompe_margen_toda_la_cienaga(self):
        # El Margen que linda con la mitad oriental de la Ciénaga pasa a la Meseta: la Ciénaga queda abierta al sur.
        mundo = copy.deepcopy(self.mundo)
        celdas = mundo['celdas']
        cienaga, margen, meseta = (_region(mundo, n) for n in (
            'Ciénaga Troncal', 'El Margen Silencioso', 'La Meseta del Orden'))
        for c in celdas:
            if c['region'] == margen and c['p'][0] > 630 and any(celdas[j]['region'] == cienaga for j in c['c']):
                c['region'] = meseta
        nuevos = self.nuevos_fallos(mundo)
        self.assertIn('margen-toda-la-cienaga', nuevos)
        self.assertRegex(nuevos['margen-toda-la-cienaga'], r'^\d+% de \d+ pares \(mínimo 90%\)$')

    def test_lugar_isla_cambiante_rompe_sin_isla_cambiante(self):
        mundo = copy.deepcopy(self.mundo)
        mundo['lugares'].append({'i': 9999, 'nombre': 'Isla Cambiante', 'x': 100, 'y': 100})
        nuevos = self.nuevos_fallos(mundo)
        self.assertEqual(set(nuevos), {'sin-isla-cambiante'})
        self.assertIn('1 lugares', nuevos['sin-isla-cambiante'])

    def test_adelgaza_con_centro_sin_grosor_falla_sin_excepcion(self):
        regla = next(r for r in self.lore['reglas'] if r['tipo'] == 'adelgaza')
        mundo = copy.deepcopy(self.mundo)
        region = comprobar._celdas_de(mundo, regla['region'])
        puntos = [list(c['p']) for c in region]
        # Cada celda de los dos lados se pone sobre un punto de la región: la distancia mínima es 0 en todas.
        for n in regla['entre'] + regla['y']:
            for k, c in enumerate(comprobar._celdas_de(mundo, n)):
                c['p'] = list(puntos[k % len(puntos)])
        ok, detalle = comprobar._adelgaza(mundo, regla)
        self.assertFalse(ok)
        self.assertIn('no tienen grosor', detalle)

    def test_nombre_inexistente_es_un_error_claro(self):
        lore = {'reglas': [{'id': 'x', 'tipo': 'oeste-de', 'a': 'Narnia', 'b': 'Ciénaga Troncal'}]}
        with self.assertRaisesRegex(ValueError, 'Narnia'):
            comprobar.comprobar(self.mundo, lore)

    def test_tipo_desconocido_lanza_value_error(self):
        lore = {'reglas': [{'id': 'rara', 'tipo': 'se-inventa-esto'}]}
        with self.assertRaisesRegex(ValueError, 'se-inventa-esto'):
            comprobar.comprobar(self.mundo, lore)


class Salida(unittest.TestCase):
    def _main(self, *args):
        salida, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(salida), contextlib.redirect_stderr(err):
            codigo = comprobar.main(list(args))
        return codigo, salida.getvalue(), err.getvalue()

    def test_main_sale_con_1_y_dice_la_regla_que_falla(self):
        mundo = comprobar.cargar()
        mundo['lugares'].append({'i': 9999, 'nombre': 'Isla Cambiante', 'x': 100, 'y': 100})
        with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as tmp:
            json.dump(mundo, tmp)
        try:
            codigo, salida, err = self._main('--mundo', tmp.name)
        finally:
            os.unlink(tmp.name)
        self.assertEqual(codigo, 1)
        self.assertIn('MAL sin-isla-cambiante', salida)
        self.assertIn('sin cumplir', err)

    def test_main_sale_con_0_en_el_mapa_real_y_sin_decidir_no_falla(self):
        codigo, salida, _ = self._main()
        self.assertEqual(codigo, 0, salida)
        self.assertIn('?   muro-de-obsidiana', salida)


if __name__ == '__main__':
    unittest.main()
