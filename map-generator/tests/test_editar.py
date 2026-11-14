"""MAP-6, MAP-7: editar regiones, provincias, relieve y costa valida cada cambio, avisa de qué medidas cambian y del canon y el lore, y
guarda helek.json (con su GeoJSON y el archivo del juego) solo desde el propio visor y sobre la versión actual."""
import collections
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
import _sinzonas  # noqa: E402

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


VAELIRA, BERIG = 2, 3


def _lugares(mundo):
    return {lu['celda'] for lu in mundo['lugares']}


def _vecinas_de_mar(mundo, continente):
    """Celdas de mar que lindan con tierra de `continente`, por índice."""
    return sorted({j for c in mundo['celdas'] if c['h'] >= 20 and c['continente'] == continente
                   for j in c['c'] if mundo['celdas'][j]['h'] < 20})


def _mar_junto_a(mundo, continente, con_region=False):
    """Mar que linda con tierra de `continente` y solo con ese continente (con región entre las vecinas si se pide)."""
    for i in _vecinas_de_mar(mundo, continente):
        v = [mundo['celdas'][j] for j in mundo['celdas'][i]['c'] if mundo['celdas'][j]['h'] >= 20]
        if {c['continente'] for c in v} == {continente} and (not con_region or any(c['region'] for c in v)):
            return mundo['celdas'][i]
    raise AssertionError('no hay mar junto al continente')


def _costa_sin_lugar(mundo, continente):
    """Celda de tierra del continente con vecina de mar, sin lugar, cuyo continente no se parte al quitarla."""
    for c in mundo['celdas']:
        if c['h'] >= 20 and c['continente'] == continente and c['i'] not in _lugares(mundo) and any(
                mundo['celdas'][j]['h'] < 20 for j in c['c']) and len(_partes(mundo, c['i'])) == 1:
            return c
    raise AssertionError('no hay celda de costa')


def _partes(mundo, quitada):
    """Componentes de tierra del continente de `quitada` si se quita esa celda, como listas de celdas."""
    k = mundo['celdas'][quitada]['continente']
    resto = {c['i'] for c in mundo['celdas'] if c['h'] >= 20 and c['continente'] == k and c['i'] != quitada}
    partes = []
    while resto:
        pila, parte = [min(resto)], set()
        while pila:
            x = pila.pop()
            if x in parte:
                continue
            parte.add(x)
            pila.extend(j for j in mundo['celdas'][x]['c'] if j in resto and j not in parte)
        resto -= parte
        partes.append(sorted(parte))
    return partes


def _celda_que_parte(mundo, continente):
    """(anillo, partes): un anillo de celdas de tierra (sin lugares) que, bajado a mar, deja una isla de 7 celdas."""
    k = continente
    for c in mundo['celdas']:
        if c['h'] < 20 or c['continente'] != k or c['i'] in _lugares(mundo):
            continue
        dentro, anillo = {c['i']}, set()
        for j in c['c']:
            dentro.add(j)
        for j in list(dentro):
            anillo.update(x for x in mundo['celdas'][j]['c'] if x not in dentro)
        if all(mundo['celdas'][x]['h'] >= 20 for x in dentro) and anillo.isdisjoint(_lugares(mundo)) \
                and all(mundo['celdas'][x]['h'] >= 20 and mundo['celdas'][x]['continente'] == k for x in anillo):
            partes = _partes_sin(mundo, anillo)
            if len(partes) > 1:
                return sorted(anillo), partes
    raise AssertionError('ningún anillo parte el continente')


def _partes_sin(mundo, quitadas):
    """Componentes de tierra del continente de la primera celda quitada, sin las `quitadas`."""
    k = mundo['celdas'][min(quitadas)]['continente']
    resto = {c['i'] for c in mundo['celdas'] if c['h'] >= 20 and c['continente'] == k and c['i'] not in quitadas}
    partes = []
    while resto:
        pila, parte = [min(resto)], set()
        while pila:
            x = pila.pop()
            if x in parte:
                continue
            parte.add(x)
            pila.extend(j for j in mundo['celdas'][x]['c'] if j in resto and j not in parte)
        resto -= parte
        partes.append(sorted(parte))
    return partes


def _camino_de_mar_entre(mundo, a, b):
    """Celdas de mar que, subidas a tierra, unen el continente `a` con el `b` (camino más corto)."""
    origen, destino = set(_vecinas_de_mar(mundo, a)), set(_vecinas_de_mar(mundo, b))
    previa, cola = {i: None for i in origen}, collections.deque(sorted(origen))
    while cola:
        x = cola.popleft()
        if x in destino:
            camino = []
            while x is not None:
                camino.append(x)
                x = previa[x]
            return camino
        for j in mundo['celdas'][x]['c']:
            if mundo['celdas'][j]['h'] < 20 and j not in previa:
                previa[j] = x
                cola.append(j)
    raise AssertionError('los continentes no tienen mar entre ellos')


def _mar_aislado(mundo):
    """Una celda de mar con todas sus vecinas de mar (una isla ahí no toca ninguna costa)."""
    return next(c for c in mundo['celdas'] if c['h'] < 20 and c['c'] and all(mundo['celdas'][j]['h'] < 20 for j in c['c']))


def _sin_h(mundo):
    otro = json.loads(json.dumps(mundo))
    for c in otro['celdas']:
        c['h'] = 0
    return otro


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

    def test_lotes_de_tipos_incorrectos_dan_error_de_edicion_con_motivo(self):
        c = _celda_junto_a_provincia(self.mundo, 2)
        casos = {
            'celdas mal formado': {'celdas': 5},
            'provincias mal formado': {'provincias': 5},
            'tiene que ser texto': {'lugares': [{'i': self.mundo['lugares'][0]['i'], 'slug': [1]}]},
            'cambio de celda mal formado': {'celdas': [[c['i'], True, 0]]},
            'necesita un nombre': {'provincias': [{'i': 9, 'nombre': 5, 'region': 18, 'color': '#112233'}]},
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


class Relieve(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mundo = medir.cargar()
        cls.celdas = cls.mundo['celdas']

    def _error(self, cambios):
        with self.assertRaises(editar.ErrorDeEdicion) as e:
            editar.aplicar(self.mundo, cambios)
        return str(e.exception)

    def test_subir_y_bajar_sin_cruzar_20_solo_cambia_la_altura(self):
        tierra = next(c for c in self.celdas if c['h'] >= 25 and c['continente'] == VAELIRA)
        otra = next(c for c in self.celdas if c['h'] >= 25 and c['continente'] == VAELIRA and c['i'] != tierra['i'])
        nuevo = editar.aplicar(self.mundo, {'alturas': [[tierra['i'], tierra['h'] + 5], [otra['i'], 20]]})
        self.assertEqual((nuevo['celdas'][tierra['i']]['h'], nuevo['celdas'][otra['i']]['h']), (tierra['h'] + 5, 20))
        nuevo['celdas'][tierra['i']]['h'], nuevo['celdas'][otra['i']]['h'] = tierra['h'], otra['h']
        self.assertEqual(nuevo, self.mundo)
        self.assertEqual(self.celdas[tierra['i']]['h'], tierra['h'])  # el mundo de entrada no se toca

    def test_mar_a_tierra_hereda_bioma_region_y_continente(self):
        mar = _mar_junto_a(self.mundo, BERIG, con_region=True)
        vecinas = [self.celdas[j] for j in mar['c'] if self.celdas[j]['h'] >= 20]
        nuevo = editar.aplicar(self.mundo, {'alturas': [[mar['i'], 30]], 'bloqueo': []})
        c = nuevo['celdas'][mar['i']]
        biomas = collections.Counter(v['bioma'] for v in vecinas)
        pares = collections.Counter((v['region'], v['provincia']) for v in vecinas if v['region'])
        self.assertEqual(c['bioma'], min(biomas, key=lambda b: (-biomas[b], b)))
        self.assertEqual((c['region'], c['provincia']), min(pares, key=lambda p: (-pares[p], p)))
        self.assertEqual((c['h'], c['continente']), (30, BERIG))
        antes = {k['i']: k['celdas'] for k in self.mundo['continentes']}
        despues = {k['i']: k['celdas'] for k in nuevo['continentes']}
        self.assertEqual(despues, {**antes, BERIG: antes[BERIG] + 1})
        self.assertEqual(len(nuevo['continentes']), 2)

    def test_dos_celdas_nuevas_juntas_heredan_una_de_otra(self):
        mar = _mar_junto_a(self.mundo, VAELIRA)
        seguida = next(j for j in mar['c'] if self.celdas[j]['h'] < 20 and not any(
            self.celdas[k]['h'] >= 20 for k in self.celdas[j]['c']))
        nuevo = editar.aplicar(self.mundo, {'alturas': [[seguida, 25], [mar['i'], 25]]})
        a, b = nuevo['celdas'][mar['i']], nuevo['celdas'][seguida]
        self.assertEqual((a['continente'], b['continente']), (VAELIRA, VAELIRA))
        self.assertEqual(b['bioma'], a['bioma'])  # la que no tenía vecinas de tierra hereda de la ya convertida

    def test_tierra_a_mar_limpia_la_celda(self):
        c = _costa_sin_lugar(self.mundo, VAELIRA)
        nuevo = editar.aplicar(self.mundo, {'alturas': [[c['i'], 5]]})
        mar = nuevo['celdas'][c['i']]
        self.assertEqual((mar['h'], mar['bioma'], mar['region'], mar['provincia'], mar['continente']), (5, 0, 0, 0, 0))
        antes = next(k['celdas'] for k in self.mundo['continentes'] if k['i'] == VAELIRA)
        self.assertEqual(next(k['celdas'] for k in nuevo['continentes'] if k['i'] == VAELIRA), antes - 1)

    def test_berig_esta_bloqueado_por_defecto_con_su_agua_de_costa(self):
        tierra = _costa_sin_lugar(self.mundo, BERIG)
        agua = _mar_junto_a(self.mundo, BERIG)
        lejos = _mar_aislado(self.mundo)
        for celda, h in ((tierra['i'], tierra['h'] + 1), (agua['i'], 30)):
            with self.subTest(celda=celda):
                msg = self._error({'alturas': [[celda, h]]})
                self.assertIn('Berig', msg)
                self.assertIn('bloqueado', msg)
                self.assertIn('desmarca «Bloquear: Berig»', msg)
        editar.aplicar(self.mundo, {'alturas': [[lejos['i'], 3]]})  # el mar abierto no es de Berig
        nuevo = editar.aplicar(self.mundo, {'alturas': [[tierra['i'], tierra['h'] + 1], [agua['i'], 30]], 'bloqueo': []})
        self.assertEqual((nuevo['celdas'][tierra['i']]['h'], nuevo['celdas'][agua['i']]['h']), (tierra['h'] + 1, 30))

    def test_el_bloqueo_se_elige_por_continente(self):
        berig, vaelira = _costa_sin_lugar(self.mundo, BERIG), _costa_sin_lugar(self.mundo, VAELIRA)
        editar.aplicar(self.mundo, {'alturas': [[berig['i'], berig['h'] + 1]], 'bloqueo': [VAELIRA]})
        with self.assertRaises(editar.ErrorDeEdicion) as e:
            editar.aplicar(self.mundo, {'alturas': [[vaelira['i'], vaelira['h'] + 1]], 'bloqueo': [VAELIRA]})
        self.assertIn('Vaelira', str(e.exception))
        for malo in ([99], 'Berig', [True]):
            with self.subTest(bloqueo=malo):
                self.assertIn('bloqueo mal formado', self._error({'alturas': [], 'bloqueo': malo}))

    def test_el_bloqueo_no_afecta_a_pintar_region_ni_provincia(self):
        c = _celda_junto_a_provincia(self.mundo, 2)  # tierra de Berig
        nuevo = editar.aplicar(self.mundo, {'celdas': [[c['i'], c['region'], 2]]})
        self.assertEqual(nuevo['celdas'][c['i']]['provincia'], 2)

    def test_un_lugar_no_pasa_a_mar(self):
        lu = self.mundo['lugares'][0]
        msg = self._error({'alturas': [[lu['celda'], 3]], 'bloqueo': []})
        self.assertIn(f"la celda {lu['celda']} es de {lu['nombre']}: no pasa a mar", msg)

    def test_no_se_unen_dos_continentes(self):
        camino = _camino_de_mar_entre(self.mundo, VAELIRA, BERIG)
        msg = self._error({'alturas': [[i, 30] for i in camino], 'bloqueo': []})
        self.assertIn('une Vaelira y Berig', msg)

    def test_partir_un_continente_crea_una_isla_nueva(self):
        anillo, partes = _celda_que_parte(self.mundo, VAELIRA)
        nuevo = editar.aplicar(self.mundo, {'alturas': [[i, 5] for i in anillo]})
        mayor = max(partes, key=lambda p: (len(p), -p[0]))
        antes = next(k['celdas'] for k in self.mundo['continentes'] if k['i'] == VAELIRA)
        cont = {k['i']: k for k in nuevo['continentes']}
        islas = [k for k in nuevo['continentes'] if k['i'] > BERIG]
        self.assertEqual(len(islas), len(partes) - 1)
        self.assertEqual({k['nombre'] for k in islas}, {f"Isla nueva {k['i']}" for k in islas})
        self.assertTrue(all(k['areaFmg'] is None for k in islas))
        self.assertEqual({nuevo['celdas'][i]['continente'] for i in mayor}, {VAELIRA})
        for parte in partes:
            if parte is not mayor:
                self.assertEqual(len({nuevo['celdas'][i]['continente'] for i in parte}), 1)
                self.assertNotEqual(nuevo['celdas'][parte[0]]['continente'], VAELIRA)
        self.assertEqual(sum(k['celdas'] for k in cont.values() if k['i'] != BERIG), antes - len(anillo))

    def test_una_isla_nueva_y_no_se_borra_un_continente_entero(self):
        mar = _mar_aislado(self.mundo)
        con_isla = editar.aplicar(self.mundo, {'alturas': [[mar['i'], 40]], 'bloqueo': []})
        isla = con_isla['continentes'][-1]
        self.assertEqual((isla['i'], isla['nombre'], isla['celdas'], isla['areaFmg']), (4, 'Isla nueva 4', 1, None))
        c = con_isla['celdas'][mar['i']]
        self.assertEqual((c['continente'], c['region'], c['provincia']), (4, 0, 0))
        self.assertNotEqual(c['bioma'], 0)  # sin vecinas de tierra: el bioma de tierra más común del mapa
        with self.assertRaises(editar.ErrorDeEdicion) as e:
            editar.aplicar(con_isla, {'alturas': [[mar['i'], 2]]})
        self.assertIn('Isla nueva 4 se quedaría sin celdas', str(e.exception))

    def test_altura_no_valida(self):
        c = _costa_sin_lugar(self.mundo, VAELIRA)['i']
        casos = {
            'se sale de 0 a 100': [[c, 101]], 'se sale de 0 a 100 ': [[c, -1]],
            'mal formado': [[c, 25.5]], 'mal formado.': [[c, '30']], 'mal formado:': [[c, True]],
            'no existe la celda': [[len(self.celdas), 30]], 'mal formado;': [[c]],
        }
        for motivo, alturas in casos.items():
            with self.subTest(alturas=alturas):
                self.assertIn(motivo.rstrip(' .:;'), self._error({'alturas': alturas}))
        self.assertIn('alturas mal formado', self._error({'alturas': 5}))

    def test_subir_a_tierra_y_pintar_region_en_el_mismo_lote(self):
        mar = _mar_junto_a(self.mundo, BERIG, con_region=True)
        region = next(self.celdas[j]['region'] for j in mar['c'] if self.celdas[j]['region'])
        otra = next(r['i'] for r in self.mundo['regiones'] if r['i'] != region)
        self.assertIn('es mar', self._error({'celdas': [[mar['i'], otra, 0]], 'bloqueo': []}))
        nuevo = editar.aplicar(self.mundo, {'alturas': [[mar['i'], 30]], 'celdas': [[mar['i'], otra, 0]], 'bloqueo': []})
        c = nuevo['celdas'][mar['i']]
        self.assertEqual((c['h'], c['region'], c['provincia']), (30, otra, 0))

    def test_sin_alturas_el_resultado_no_cambia(self):
        self.assertEqual(editar.aplicar(self.mundo, {'alturas': [], 'bloqueo': []}), self.mundo)
        self.assertEqual(editar.aplicar(self.mundo, {'alturas': [[0, self.celdas[0]['h']]]}), self.mundo)

    def test_informe_con_continente_y_resumen_de_relieve(self):
        anillo, _ = _celda_que_parte(self.mundo, VAELIRA)
        mar = _mar_aislado(self.mundo)
        nuevo = editar.aplicar(self.mundo, {'alturas': [[i, 5] for i in anillo] + [[mar['i'], 40]], 'bloqueo': []})
        inf = editar.informe(self.mundo, nuevo, CANON, LORE)
        self.assertEqual(inf['relieve'], {'alturas': len(anillo) + 1, 'aTierra': 1, 'aMar': len(anillo)})
        por = {e['nombre']: e for e in inf['cambian'] if e['tipo'] == 'continente'}
        self.assertIn('Vaelira', por)
        self.assertNotIn('Berig', por)
        self.assertTrue(por['Vaelira']['despues']['area'] < por['Vaelira']['antes']['area'])
        nueva = [e for e in por.values() if e['nombre'].startswith('Isla nueva')]
        self.assertEqual(len(nueva), 2)  # la isla del corte y la del mar abierto
        self.assertTrue(all(e['antes'] is None and e['despues']['area'] > 0 for e in nueva))
        sin = editar.informe(self.mundo, editar.aplicar(self.mundo, {}), CANON, LORE)
        self.assertEqual(sin['relieve'], {'alturas': 0, 'aTierra': 0, 'aMar': 0})

    def test_subir_sin_cruzar_20_solo_cambia_h_en_el_informe(self):
        c = next(c for c in self.celdas if c['h'] >= 25 and c['continente'] == VAELIRA)
        nuevo = editar.aplicar(self.mundo, {'alturas': [[c['i'], c['h'] + 3]]})
        inf = editar.informe(self.mundo, nuevo, CANON, LORE)
        self.assertEqual((inf['cambian'], inf['relieve']['alturas']), ([], 1))

    def test_guardar_y_recargar_da_el_mismo_mundo(self):
        anillo, _ = _celda_que_parte(self.mundo, VAELIRA)
        mar = _mar_aislado(self.mundo)
        nuevo = editar.aplicar(self.mundo, {'alturas': [[i, 5] for i in anillo] + [[mar['i'], 40]], 'bloqueo': []})
        with tempfile.TemporaryDirectory() as d:
            ruta, juego = os.path.join(d, 'helek.json'), os.path.join(d, 'juego.ts')
            editar.guardar(nuevo, ruta, ruta_juego=juego)
            self.assertEqual(medir.cargar(ruta), nuevo)
            with open(juego, encoding='utf-8') as f:
                self.assertEqual(f.read(), exportar.generar(nuevo))
            with open(os.path.join(d, 'helek.geojson'), encoding='utf-8') as f:
                geo = json.load(f)
            continentes = {x['properties']['nombre'] for x in geo['features'] if x['properties']['capa'] == 'continente'}
            self.assertEqual(continentes, {k['nombre'] for k in nuevo['continentes']})
            self.assertEqual(editar.aplicar(medir.cargar(ruta), {'alturas': []}), nuevo)

    def test_la_costa_sale_de_las_celdas(self):
        """El contorno de un continente es el de sus celdas de tierra: sin una celda de costa, su polígono cambia."""
        c = _costa_sin_lugar(self.mundo, VAELIRA)
        nuevo = editar.aplicar(self.mundo, {'alturas': [[c['i'], 5]]})
        area = lambda m: geometria.area(medir.poligonos_de(m, {'continente': 'Vaelira'}))  # noqa: E731
        celda_sola = geometria.area(medir._poligonos(self.mundo, lambda x: x['i'] == c['i']))
        self.assertAlmostEqual(area(self.mundo) - area(nuevo), celda_sola, places=3)


class Informe(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mundo = _sinzonas.cargar()

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
            _sinzonas.copiar(destino)
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
            with tempfile.TemporaryDirectory() as limpio, contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(importar.main(['--salida', limpio]), 0)  # lo que da importar sin nada delante
                with open(os.path.join(limpio, 'helek.json'), encoding='utf-8') as f:
                    importado = f.read()
            with open(destino, encoding='utf-8') as f:
                self.assertEqual(f.read(), importado)


class GuardarAtomico(unittest.TestCase):
    def test_si_exportar_falla_no_se_escribe_nada_ni_se_apunta_historial(self):
        mundo = medir.cargar()
        celdas_de_18 = [c['i'] for c in mundo['celdas'] if c['region'] == 18]
        for i in celdas_de_18:
            mundo['celdas'][i]['region'] = 19
        with tempfile.TemporaryDirectory() as d:
            ruta = os.path.join(d, 'helek.json')
            shutil.copy(medir.MUNDO, ruta)
            antes = open(ruta, 'rb').read()
            with self.assertRaises(editar.ErrorDeEdicion) as e:
                editar.guardar(mundo, ruta, ruta_juego=os.path.join(d, 'juego.ts'))
            self.assertIn('se queda sin celdas', str(e.exception))
            self.assertEqual(open(ruta, 'rb').read(), antes)
            self.assertEqual(sorted(os.listdir(d)), ['helek.json'])


class Consola(unittest.TestCase):
    """`editar.py lote.json`: lo mismo que POST /comprobar y /guardar, sin servidor, sobre una copia del mapa."""

    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.mundo = os.path.join(self.dir, 'helek.json')
        shutil.copy(medir.MUNDO, self.mundo)
        self.base = editar.huella(open(self.mundo, 'rb').read())
        m = medir.cargar()
        self.tierra = next(c for c in m['celdas'] if c['h'] >= 25 and c['continente'] == VAELIRA)
        self.mar = _mar_junto_a(m, BERIG)

    def tearDown(self):
        shutil.rmtree(self.dir)

    def _lote(self, lote):
        ruta = os.path.join(self.dir, 'lote.json')
        with open(ruta, 'w', encoding='utf-8') as f:
            json.dump(lote, f)
        return ruta

    def _correr(self, lote, *opciones):
        sal, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(sal), contextlib.redirect_stderr(err):
            codigo = editar.main([self._lote(lote), '--mundo', self.mundo, '--sin-juego', *opciones])
        return codigo, sal.getvalue(), err.getvalue()

    def _intacto(self):
        with open(self.mundo, 'rb') as a, open(medir.MUNDO, 'rb') as b:
            self.assertEqual(a.read(), b.read())

    def test_comprobar_muestra_el_informe_y_no_escribe(self):
        codigo, sal, _ = self._correr({'alturas': [[self.tierra['i'], self.tierra['h'] + 2]]})
        self.assertEqual(codigo, 0)
        self.assertIn('Relieve: 1 celda(s)', sal)
        self.assertIn('Ninguna medida cambia', sal)
        self.assertIn('canon y lore se cumplen', sal)
        self._intacto()

    def test_json_y_base_opcional(self):
        codigo, sal, _ = self._correr({'base': self.base, 'alturas': [[self.tierra['i'], 30]]}, '--json')
        inf = json.loads(sal)
        self.assertEqual((codigo, inf['relieve']['alturas'], inf['guardado'], inf['ok']), (0, 1, False, True))
        codigo, sal, _ = self._correr({'base': 'otra', 'alturas': []}, '--json')
        self.assertEqual(codigo, 1)
        self.assertIn('ha cambiado', json.loads(sal)['error'])

    def test_error_de_edicion_con_su_motivo_y_salida_1(self):
        codigo, sal, err = self._correr({'alturas': [[self.mar['i'], 30]]})
        self.assertEqual((codigo, sal), (1, ''))
        self.assertIn('error: ', err)
        self.assertIn('Berig', err)
        self.assertIn('bloqueado', err)
        codigo, sal, err = self._correr({'alturas': [[self.mar['i'], 30]]}, '--json')
        self.assertEqual(codigo, 1)
        self.assertIn('bloqueado', json.loads(sal)['error'])
        self._intacto()

    def test_guardar_escribe_la_copia_y_regenera_el_geojson(self):
        codigo, sal, _ = self._correr({'alturas': [[self.tierra['i'], 31]]}, '--guardar')
        self.assertEqual(codigo, 0)
        self.assertIn('Guardado', sal)
        self.assertEqual(medir.cargar(self.mundo)['celdas'][self.tierra['i']]['h'], 31)
        with open(os.path.join(self.dir, 'helek.geojson'), encoding='utf-8') as f:
            self.assertTrue(json.load(f)['features'])
        self.assertFalse(os.path.exists(os.path.join(self.dir, 'juego.ts')))

    def test_guardar_una_copia_no_toca_el_archivo_del_juego(self):
        juego = os.path.join(self.dir, 'juego-de-verdad.ts')
        original = exportar.SALIDA
        exportar.SALIDA = juego
        try:
            sal = io.StringIO()
            with contextlib.redirect_stdout(sal):
                codigo = editar.main([self._lote({'alturas': [[self.tierra['i'], 31]]}), '--mundo', self.mundo,
                                      '--guardar'])
        finally:
            exportar.SALIDA = original
        self.assertEqual(codigo, 0)
        self.assertIn('Guardado', sal.getvalue())
        self.assertFalse(os.path.exists(juego), 'con --mundo de una copia no se reescribe el archivo del juego')

    def test_si_falla_el_lore_solo_se_guarda_con_forzar(self):
        lote = {'provincias': [{'i': 1, 'nombre': 'Otro nombre'}]}
        codigo, sal, err = self._correr(lote, '--guardar')
        self.assertEqual(codigo, 1)
        self.assertIn('NO se cumplen', sal)
        self.assertIn('--forzar', err)
        self._intacto()
        codigo, sal, _ = self._correr(lote, '--guardar', '--forzar')
        self.assertEqual(codigo, 1)  # sigue sin cumplirse, pero se guardó
        self.assertIn('Guardado', sal)
        self.assertEqual(medir.cargar(self.mundo)['provincias'][0]['nombre'], 'Otro nombre')


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

    def _post_crudo(self, cuerpo, largo):
        req = urllib.request.Request(self.url + '/comprobar', data=cuerpo, method='POST',
                                     headers={'Content-Type': 'application/json'})
        req.add_unredirected_header('Content-Length', largo)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def test_lotes_mal_tipados_dan_400_con_motivo(self):
        for cuerpo, motivo in (({'celdas': 5}, 'celdas mal formado'), ({'provincias': 5}, 'provincias mal formado'),
                               ({'lugares': [{'i': medir.cargar()['lugares'][0]['i'], 'slug': [1]}]}, 'tiene que ser texto')):
            with self.subTest(cuerpo=cuerpo):
                st, inf = self._post('/comprobar', {'base': self.base, **cuerpo})
                self.assertEqual(st, 400, inf)
                self.assertIn(motivo, inf['error'])

    def test_content_length_no_numerico_da_400(self):
        st, inf = self._post_crudo(b'{}', 'abc')
        self.assertEqual(st, 400)
        self.assertIn('Content-Length', inf['error'])

    def test_un_fallo_inesperado_da_500_con_mensaje(self):
        original = editar.informe
        editar.informe = lambda *a, **k: 1 / 0
        try:
            st, inf = self._post('/comprobar', {'base': self.base})
        finally:
            editar.informe = original
        self.assertEqual(st, 500)
        self.assertIn('ZeroDivisionError', inf['error'])

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

    def test_guardar_relieve_exige_desbloquear_berig_y_regenera_los_archivos(self):
        mundo = medir.cargar(self.mundo)
        mar = _mar_junto_a(mundo, BERIG)
        st, inf = self._post('/comprobar', {'base': self.base, 'alturas': [[mar['i'], 30]]})
        self.assertEqual(st, 400)
        self.assertIn('bloqueado', inf['error'])
        self._sin_tocar()
        lote = {'base': self.base, 'alturas': [[mar['i'], 30]], 'bloqueo': []}
        st, inf = self._post('/comprobar', lote)
        self.assertEqual(st, 200, inf)
        self.assertEqual(inf['relieve'], {'alturas': 1, 'aTierra': 1, 'aMar': 0})
        self._sin_tocar()
        st, inf = self._post('/guardar', {**lote, 'forzar': True})
        self.assertEqual(st, 200, inf)
        guardado = medir.cargar(self.mundo)
        self.assertEqual((guardado['celdas'][mar['i']]['h'], guardado['celdas'][mar['i']]['continente']), (30, BERIG))
        with open(self.juego, encoding='utf-8') as f:
            self.assertEqual(f.read(), exportar.generar(guardado))

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
