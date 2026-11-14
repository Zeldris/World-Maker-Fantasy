"""MAP-16: el agente del banco solo ejecuta consultar.py y editar.py, y siempre sobre su copia.

Ediciones que siempre pasan el canon y el lore, para los tests que necesitan guardar algo: subir 1 una celda de tierra
(h >= 25) fuera de Berig; dentro de Berig, la misma con `"bloqueo": []`. Fuera de Berig toda celda es de la región 0
(cambiarle la región rompe el lore), y dos alturas a una misma celda no dependen una de otra (gana la última).
"""
import json
import os
import shutil
import sys
import tempfile
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))
sys.path.insert(0, os.path.join(os.path.dirname(AQUI), 'banco'))

import agente_local  # noqa: E402
import medir  # noqa: E402

GEOJSON = os.path.join(os.path.dirname(medir.MUNDO), 'helek.geojson')


def _leer(ruta):
    with open(ruta, 'rb') as f:
        return f.read()


class Ejecutar(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.mundo = os.path.join(self.dir, 'helek.json')
        shutil.copy(medir.MUNDO, self.mundo)
        shutil.copy(GEOJSON, os.path.join(self.dir, 'helek.geojson'))
        self.juego = _leer(medir.MUNDO)

    def tearDown(self):
        shutil.rmtree(self.dir)
        self.assertEqual(_leer(medir.MUNDO), self.juego, 'el mapa del juego no se toca')

    def test_rechaza_lo_que_no_es_del_mapa(self):
        for orden in ('ls -la', 'bash -c "rm -rf /"', 'importar.py --sobrescribir', '../editar.py', 'python3 x.py'):
            salida, codigo = agente_local.ejecutar(orden, None, self.dir)
            self.assertEqual(codigo, 2, orden)
            self.assertIn('solo se permiten', salida)

    def test_rechaza_otro_mundo(self):
        salida, codigo = agente_local.ejecutar('editar.py - --mundo mundo/helek.json --guardar', '{}', self.dir)
        self.assertEqual(codigo, 2)
        self.assertIn('--mundo no se puede usar', salida)

    def test_rechaza_abreviaturas_y_formas_con_igual(self):
        for opcion in ('--canon=x', '--can', '--can=x', '--lo', '--lore=x', '--mun', '--mundo=mundo/helek.json'):
            salida, codigo = agente_local.ejecutar(f'editar.py - {opcion}', '{}', self.dir)
            self.assertEqual(codigo, 2, opcion)
            self.assertIn('no se puede usar', salida)

    def test_guarda_en_la_copia(self):
        m = medir.cargar(self.mundo)
        berig = next(k['i'] for k in m['continentes'] if k['nombre'] == 'Berig')
        c = next(c for c in m['celdas'] if c['h'] >= 25 and c['continente'] not in (0, berig))
        lote = json.dumps({'alturas': [[c['i'], c['h'] + 1]]})
        salida, codigo = agente_local.ejecutar('python3 editar.py - --guardar', lote, self.dir)
        self.assertEqual(codigo, 0, salida)
        self.assertEqual(next(x for x in medir.cargar(self.mundo)['celdas'] if x['i'] == c['i'])['h'], c['h'] + 1)

    def test_rechaza_forzar(self):
        for opcion in ('--forzar', '--for', '--f'):
            salida, codigo = agente_local.ejecutar(f'editar.py - --guardar {opcion}', '{}', self.dir)
            self.assertEqual(codigo, 2, opcion)
            self.assertIn('--forzar no se puede usar', salida)

    def test_rechaza_marcar_una_zona_canon(self):
        lote = json.dumps({'zonas': [{'i': 30, 'tipo': 'peligro', 'nombre': 'X', 'nivel': 1, 'canon': True,
                                      'celdas': [1]}]})
        for orden in ('editar.py - --guardar', 'editar.py -'):
            salida, codigo = agente_local.ejecutar(orden, lote, self.dir)
            self.assertEqual(codigo, 2, orden)
            self.assertIn('una zona no se marca canon', salida)

    def test_para_guardar_el_lote_va_por_la_entrada(self):
        ruta = os.path.join(self.dir, 'x.json')
        with open(ruta, 'w', encoding='utf-8') as f:
            f.write('{}')
        salida, codigo = agente_local.ejecutar(f'editar.py {ruta} --guardar', None, self.dir)
        self.assertEqual(codigo, 2)
        self.assertIn('usa "-" como archivo', salida)


def _llamada(orden, lote=None):
    arg = {'orden': orden}
    if lote is not None:
        arg['lote'] = lote
    return {'message': {'role': 'assistant', 'content': '', 'tool_calls': [{'function': {'arguments': arg}}]}}


def _chat_falso(respuestas):
    """Un modelo que responde lo que se le da, en orden (sin Ollama)."""
    cola = list(respuestas)
    return lambda *a, **k: cola.pop(0)


class EncargoLibre(unittest.TestCase):
    """MAP-18: un encargo en texto libre trabaja sobre una copia nueva y devuelve el lote y el informe."""

    def setUp(self):
        self.dir = os.path.join(tempfile.mkdtemp(), 'copia')
        self.juego = _leer(medir.MUNDO)
        m = medir.cargar(medir.MUNDO)
        berig = next(k['i'] for k in m['continentes'] if k['nombre'] == 'Berig')
        tierra = [c for c in m['celdas'] if c['h'] >= 25 and c['continente'] not in (0, berig)]
        self.c1, self.c2 = tierra[0], tierra[1]

    def tearDown(self):
        shutil.rmtree(os.path.dirname(self.dir))
        self.assertEqual(_leer(medir.MUNDO), self.juego, 'el mapa del juego no se toca')

    def _correr(self, respuestas):
        agente_local.preparar_copia(self.dir, medir.MUNDO)
        reg = agente_local.correr('sube dos celdas', self.dir, chat=_chat_falso(respuestas))
        return reg, agente_local.entregar(self.dir, reg, 'sube dos celdas', medir.MUNDO)

    def test_junta_lo_guardado_en_un_lote_que_cuadra(self):
        l1 = json.dumps({'alturas': [[self.c1['i'], self.c1['h'] + 1]]})
        l2 = json.dumps({'alturas': [[self.c2['i'], self.c2['h'] + 1]]})
        reg, lote = self._correr([
            _llamada('editar.py -', l1),                       # comprobar: no cuenta
            _llamada('editar.py - --guardar', l1),
            _llamada('python3 map-generator/editar.py - --guardar', l2),
            _llamada('editar.py - --guardar --forzar', l2),     # rechazada: no cuenta
            {'message': {'role': 'assistant', 'content': 'Subidas dos celdas.'}},
        ])
        self.assertEqual(reg['final'], 'Subidas dos celdas.')
        self.assertEqual(len(reg['guardados']), 2)
        self.assertEqual(json.load(open(lote, encoding='utf-8')),
                         {'alturas': [[self.c1['i'], self.c1['h'] + 1], [self.c2['i'], self.c2['h'] + 1]]})
        informe = open(os.path.join(self.dir, 'informe.md'), encoding='utf-8').read()
        self.assertIn('Subidas dos celdas.', informe)
        self.assertIn(f'editar.py {lote} --guardar', informe)
        self.assertFalse(os.path.exists(os.path.join(self.dir, 'comprobacion')))

    def test_lotes_que_dependen_uno_de_otro_se_entregan_en_orden(self):
        # el primero desbloquea Berig para subir una de sus celdas; el segundo lo vuelve a bloquear. Juntos, `bloqueo`
        # se encadena y Berig queda bloqueado para las dos alturas: solo se reproducen en orden
        m = medir.cargar(medir.MUNDO)
        berig = next(k['i'] for k in m['continentes'] if k['nombre'] == 'Berig')
        cb = next(c for c in m['celdas'] if c['h'] >= 30 and c['continente'] == berig)
        l1 = json.dumps({'bloqueo': [], 'alturas': [[cb['i'], cb['h'] + 1]]})
        l2 = json.dumps({'bloqueo': [berig], 'alturas': [[self.c1['i'], self.c1['h'] + 1]]})
        reg, lote = self._correr([
            _llamada('editar.py - --guardar', l1),
            _llamada('editar.py - --guardar', l2),
            {'message': {'role': 'assistant', 'content': 'Hecho.'}},
        ])
        informe = open(os.path.join(self.dir, 'informe.md'), encoding='utf-8').read()
        self.assertEqual(len(reg['guardados']), 2, informe)
        self.assertEqual(lote, os.path.join(self.dir, 'lote-1.json'), informe)
        self.assertEqual(json.load(open(lote, encoding='utf-8')), json.loads(l1))
        self.assertEqual(json.load(open(os.path.join(self.dir, 'lote-2.json'), encoding='utf-8')), json.loads(l2))
        self.assertIn('se guardan uno tras otro', informe)
        self.assertFalse(os.path.exists(os.path.join(self.dir, 'lote.json')))

    def test_sin_guardar_no_hay_lote(self):
        reg, lote = self._correr([{'message': {'role': 'assistant', 'content': 'No se puede: el canon no lo admite.'}}])
        self.assertIsNone(lote)
        self.assertFalse(os.path.exists(os.path.join(self.dir, 'lote.json')))
        self.assertIn('no hay lote', open(os.path.join(self.dir, 'informe.md'), encoding='utf-8').read())

    def test_si_no_cuadra_no_da_lote(self):
        l1 = json.dumps({'alturas': [[self.c1['i'], self.c1['h'] + 1]]})
        reg, lote = self._correr([
            _llamada('editar.py - --guardar', l1),
            _llamada('editar.py --deshacer'),                  # la copia vuelve atrás: el lote ya no la describe
            {'message': {'role': 'assistant', 'content': 'Hecho.'}},
        ])
        self.assertIsNone(lote)
        self.assertIn('no hay lote fiable', open(os.path.join(self.dir, 'informe.md'), encoding='utf-8').read())

    def test_no_copia_sobre_el_mapa_del_juego(self):
        with self.assertRaises(SystemExit) as e:
            agente_local.preparar_copia(os.path.dirname(medir.MUNDO), medir.MUNDO)
        self.assertIn('no puede ser la carpeta del mapa', str(e.exception))


if __name__ == '__main__':
    unittest.main()
