"""MAP-14: zonas de tormenta, peligro y clan (lote `zonas` de editar.py), tiempos de ruta (viaje.py), el archivo
helekCapas.ts del juego, `consultar.py zonas|ruta` y /viaje.json del visor. Los tests de fallo comprueban el motivo."""
import contextlib
import copy
import io
import json
import os
import shutil
import sys
import tempfile
import threading
import unittest
import urllib.request
from unittest import mock

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))
sys.path.insert(0, AQUI)  # _sinzonas, también con `python3 -m unittest tests.test_zonas` desde map-generator/

import consultar  # noqa: E402
import editar  # noqa: E402
import exportar  # noqa: E402
import importar  # noqa: E402
import medir  # noqa: E402
import servir  # noqa: E402
import viaje  # noqa: E402
import _sinzonas  # noqa: E402

MUNDO = _sinzonas.cargar()  # el mapa real puede llevar zonas propuestas: estos tests parten de cero
CANON = editar.cargar_json(medir.CANON)
LORE = editar.cargar_json(editar.comprobar.LORE)
LLANURAS = next(r['i'] for r in MUNDO['regiones'] if r['nombre'] == 'Llanuras del Viento Rojo')
CELDAS_LLANURAS = [c['i'] for c in MUNDO['celdas'] if c['h'] >= 20 and c['region'] == LLANURAS]
CELDAS_OTRA = [c['i'] for c in MUNDO['celdas'] if c['h'] >= 20 and c['region'] not in (0, LLANURAS)]
CELDAS_MAR = [c['i'] for c in MUNDO['celdas'] if c['h'] < 20]


def aplicar(lote, mundo=MUNDO):
    return editar.aplicar(mundo, lote, canon=CANON)


def falla(test, lote, motivo, mundo=MUNDO):
    with test.assertRaises(editar.ErrorDeEdicion) as e:
        aplicar(lote, mundo)
    test.assertIn(motivo, str(e.exception))


def tormenta(i=1, nombre='Tormenta del oeste', celdas=None, **extra):
    return {'i': i, 'tipo': 'tormenta', 'nombre': nombre, 'nivel': 2, 'celdas': celdas or CELDAS_LLANURAS[:4], **extra}


class Validacion(unittest.TestCase):
    def test_crea_una_zona_con_valores_por_defecto_y_orden_estable(self):
        nuevo = aplicar({'zonas': [tormenta(celdas=[CELDAS_LLANURAS[3], CELDAS_LLANURAS[1]])]})
        self.assertEqual(nuevo['zonas'], [{'i': 1, 'tipo': 'tormenta', 'nombre': 'Tormenta del oeste', 'nivel': 2,
                                           'canon': False, 'nota': '',
                                           'celdas': sorted([CELDAS_LLANURAS[3], CELDAS_LLANURAS[1]])}])
        claves = list(nuevo)
        self.assertEqual(claves.index('zonas'), claves.index('rios') + 1)
        self.assertEqual(claves.index('zonas') + 1, claves.index('vertices'))
        self.assertNotIn('zonas', MUNDO)  # no se toca el mundo de entrada
        self.assertEqual(importar.volcar(json.loads(importar.volcar(nuevo))), importar.volcar(nuevo))

    def test_sin_zonas_en_el_lote_no_aparece_la_clave(self):
        self.assertNotIn('zonas', aplicar({'zonas': []}))
        self.assertNotIn('zonas', aplicar({}))

    def test_las_de_clan_llevan_clan_y_nivel_cero(self):
        nuevo = aplicar({'zonas': [{'i': 2, 'tipo': 'clan', 'nombre': 'Tierras Serhu', 'clan': ' Serhu ',
                                    'nivel': 3, 'celdas': CELDAS_OTRA[:2]}]})
        z = nuevo['zonas'][0]
        self.assertEqual((z['clan'], z['nivel']), ('Serhu', 0))
        self.assertEqual(list(z), ['i', 'tipo', 'nombre', 'nivel', 'clan', 'canon', 'nota', 'celdas'])

    def test_errores_de_campos(self):
        base = tormenta()
        casos = [
            ({**base, 'tipo': 'niebla'}, 'necesita un tipo'),
            ({k: v for k, v in base.items() if k != 'tipo'}, 'necesita un tipo'),
            ({**base, 'nivel': 4}, 'nivel entero de 0 a 3'),
            ({**base, 'nivel': True}, 'nivel entero de 0 a 3'),
            ({k: v for k, v in base.items() if k != 'nivel'}, 'nivel entero de 0 a 3'),
            ({**base, 'tipo': 'peligro', 'nivel': 0}, 'nivel entero de 1 a 3'),
            ({**base, 'nivel': 7}, exportar.SENTIDO_NIVEL['tormenta']),  # el sentido de los niveles, de un solo sitio
            ({**base, 'nombre': '  '}, 'necesita un nombre'),
            ({**base, 'clan': 'Serhu'}, '"clan" solo va en las zonas de tipo clan'),
            ({'i': 2, 'tipo': 'clan', 'nombre': 'X', 'celdas': CELDAS_OTRA[:1]}, 'necesita el nombre del clan'),
            ({**base, 'canon': 'si'}, 'canon tiene que ser true o false'),
            ({**base, 'nota': 5}, 'la nota tiene que ser texto'),
            ({**base, 'color': 'rojo'}, 'campos que no se editan: color'),
            ({**base, 'i': 0}, 'índice de zona no válido: 0'),
            ({**base, 'celdas': []}, 'se quedaría sin celdas'),
            ({**base, 'celdas': [10 ** 6]}, 'no es una celda'),
            ({**base, 'celdas': 'todas'}, 'tiene que ser una lista de celdas'),
            ({**base, 'celdas': [CELDAS_LLANURAS[0]] * 2}, 'repite celdas'),
        ]
        for fila, motivo in casos:
            with self.subTest(motivo=motivo, fila=fila):
                falla(self, {'zonas': [fila]}, motivo)

    def test_zonas_mal_formado(self):
        falla(self, {'zonas': 5}, 'zonas mal formado')
        falla(self, {'zonas': [5]}, 'zona sin índice entero')

    def test_las_celdas_son_de_tierra(self):
        falla(self, {'zonas': [{'i': 3, 'tipo': 'peligro', 'nombre': 'Mar', 'nivel': 1, 'celdas': CELDAS_MAR[:1]}]},
              f'tiene la celda {CELDAS_MAR[0]} en mar')

    def test_tormenta_solo_en_las_llanuras(self):
        falla(self, {'zonas': [tormenta(celdas=CELDAS_OTRA[:1])]},
              f'tiene la celda {CELDAS_OTRA[0]} fuera de Llanuras del Viento Rojo')
        # peligro y clan sí pueden salir de las Llanuras
        aplicar({'zonas': [{'i': 3, 'tipo': 'peligro', 'nombre': 'Fuera', 'nivel': 1, 'celdas': CELDAS_OTRA[:1]}]})

    def test_solape_en_el_mismo_tipo_se_rechaza_y_entre_tipos_no(self):
        a = tormenta(1, 'Una', CELDAS_LLANURAS[:3])
        falla(self, {'zonas': [a, tormenta(2, 'Otra', CELDAS_LLANURAS[2:5])]},
              f"la celda {CELDAS_LLANURAS[2]} está en la zona 1 (tormenta «Una») y en la zona 2 (tormenta «Otra»)")
        solapa = {'i': 2, 'tipo': 'peligro', 'nombre': 'Una', 'nivel': 2, 'celdas': CELDAS_LLANURAS[2:5]}
        nuevo = aplicar({'zonas': [a, solapa]})  # mismo nombre y celdas, pero otro tipo
        self.assertEqual([z['i'] for z in nuevo['zonas']], [1, 2])

    def test_nombre_repetido_en_el_mismo_tipo(self):
        falla(self, {'zonas': [tormenta(1, 'Igual', CELDAS_LLANURAS[:2]), tormenta(2, 'igual', CELDAS_LLANURAS[2:4])]},
              'nombre de zona repetido en tormenta: igual (zonas 1 y 2)')

    def test_cambiar_campos_conserva_los_demas(self):
        v1 = aplicar({'zonas': [tormenta(nota='fuente X', canon=False)]})
        v2 = aplicar({'zonas': [{'i': 1, 'nivel': 3, 'nombre': 'Nueva'}]}, v1)
        z = v2['zonas'][0]
        self.assertEqual((z['nivel'], z['nombre'], z['nota'], z['celdas']), (3, 'Nueva', 'fuente X', v1['zonas'][0]['celdas']))
        falla(self, {'zonas': [{'i': 1, 'tipo': 'peligro'}]}, 'no cambia de tipo', v1)
        falla(self, {'zonas': [{'i': 1, 'nivel': 9}]}, 'nivel entero de 0 a 3', v1)

    def test_mas_y_menos(self):
        c = CELDAS_LLANURAS
        v1 = aplicar({'zonas': [tormenta(celdas=c[:3])]})
        v2 = aplicar({'zonas': [{'i': 1, 'mas': [c[5], c[4]], 'menos': [c[0]]}]}, v1)
        self.assertEqual(v2['zonas'][0]['celdas'], sorted([c[1], c[2], c[4], c[5]]))
        v3 = aplicar({'zonas': [{'i': 1, 'celdas': [c[7]], 'mas': [c[8]]}]}, v1)  # celdas sustituye y luego mas
        self.assertEqual(v3['zonas'][0]['celdas'], sorted([c[7], c[8]]))
        falla(self, {'zonas': [{'i': 1, 'menos': c[:3]}]}, 'se quedaría sin celdas', v1)
        falla(self, {'zonas': [{'i': 1, 'mas': CELDAS_OTRA[:1]}]}, 'fuera de Llanuras del Viento Rojo', v1)
        falla(self, {'zonas': [{'i': 1, 'mas': [c[0], c[0]]}]}, 'mas repite celdas', v1)

    def test_borrar(self):
        v1 = aplicar({'zonas': [tormenta()]})
        v2 = aplicar({'zonas': [{'i': 1, 'borrar': True}]}, v1)
        self.assertEqual(v2['zonas'], [])
        falla(self, {'zonas': [{'i': 7, 'borrar': True}]}, 'no existe la zona 7', v1)
        falla(self, {'zonas': [{'i': 1, 'borrar': True, 'nombre': 'x'}]}, 'para borrar la zona 1 se manda solo', v1)

    def _costa_de_llanuras(self):
        lugares = {lu['celda'] for lu in MUNDO['lugares']}
        return next(c for c in MUNDO['celdas'] if c['h'] >= 20 and c['region'] == LLANURAS and c['i'] not in lugares
                    and any(MUNDO['celdas'][j]['h'] < 20 for j in c['c']))

    def test_el_relieve_del_lote_no_deja_celdas_de_zona_en_mar(self):
        c = self._costa_de_llanuras()['i']
        otra = next(x for x in CELDAS_LLANURAS if x != c)
        v1 = aplicar({'zonas': [tormenta(celdas=[c, otra])]})
        falla(self, {'alturas': [[c, 5]], 'bloqueo': []}, f'tiene la celda {c} en mar', v1)
        # el mismo lote la quita de la zona: vale
        nuevo = aplicar({'alturas': [[c, 5]], 'bloqueo': [], 'zonas': [{'i': 1, 'menos': [c]}]}, v1)
        self.assertEqual(nuevo['zonas'][0]['celdas'], [otra])

    def test_pasar_una_celda_de_tormenta_a_otra_region_se_rechaza(self):
        c = CELDAS_LLANURAS[0]
        v1 = aplicar({'zonas': [tormenta(celdas=[c])]})
        otra = next(r['i'] for r in MUNDO['regiones'] if r['i'] != LLANURAS)
        falla(self, {'celdas': [[c, otra, 0]]}, f'tiene la celda {c} fuera de Llanuras del Viento Rojo', v1)
        nuevo = aplicar({'celdas': [[c, otra, 0]], 'zonas': [{'i': 1, 'celdas': [CELDAS_LLANURAS[1]]}]}, v1)
        self.assertEqual(nuevo['zonas'][0]['celdas'], [CELDAS_LLANURAS[1]])

    def test_informe_menciona_las_zonas_con_celdas_y_km2(self):
        v1 = aplicar({'zonas': [tormenta()]})
        inf = editar.informe(MUNDO, v1, CANON, LORE)
        area = medir.area_celdas(v1, CELDAS_LLANURAS[:4])
        self.assertGreater(area, 0)
        km2 = f"{area:,.0f}".replace(',', '.')
        texto = f"tormenta «Tormenta del oeste» (4 celdas, {km2} km²)"
        self.assertEqual(inf['trazos']['zonas'], {'nuevos': [texto], 'cambian': [], 'borrados': []})
        self.assertIn(texto, editar.texto_informe(inf))
        self.assertIn('1 zonas', editar.resumen(inf))
        v2 = aplicar({'zonas': [{'i': 1, 'mas': [CELDAS_LLANURAS[4]]}]}, v1)
        self.assertEqual(len(editar.informe(v1, v2, CANON, LORE)['trazos']['zonas']['cambian']), 1)
        v3 = aplicar({'zonas': [{'i': 1, 'borrar': True}]}, v2)
        self.assertEqual(len(editar.informe(v2, v3, CANON, LORE)['trazos']['zonas']['borrados']), 1)
        self.assertNotIn('zonas', editar.informe(MUNDO, MUNDO, CANON, LORE)['trazos'])


def _mundo_de_juguete():
    """Tres celdas con un camino de tres tramos y una ruta marítima, para calcular a mano."""
    biomas = copy.deepcopy(MUNDO['biomas'])
    por = {b['nombre']: b['i'] for b in biomas}
    celda = lambda i, p, h, b: {'i': i, 'p': p, 'h': h, 'bioma': por[b]}  # noqa: E731
    return {
        'fuente': {'kmPorUnidad': 1}, 'biomas': biomas,
        'celdas': [celda(0, [0, 0], 30, 'Hot desert'), celda(1, [10, 0], 30, 'Tropical rainforest'),
                   celda(2, [13, 14], 60, 'Savanna'), celda(3, [50, 50], 5, 'Marine')],
        'rutas': [{'i': 0, 'grupo': 'roads', 'puntos': [[0, 0], [3, 4], [13, 4], [13, 24]]},
                  {'i': 1, 'grupo': 'searoutes', 'puntos': [[50, 50], [50, 80]]}],
    }


class Viaje(unittest.TestCase):
    def test_tiempos_a_mano(self):
        # tramos: 5 km en desierto (1.1) = 5.5; 10 km en selva (1.5) = 15; 20 km en celda de h 60 (sabana 1.1, montaña 1.5) = 30
        camino, mar = viaje.tiempos(_mundo_de_juguete())
        self.assertEqual(camino['km'], 35.0)
        self.assertEqual(camino['kmAPie'], 50.5)
        self.assertAlmostEqual(camino['rodeo'], 50.5 / 35, places=3)
        self.assertEqual(camino['horas'], 10.1)       # 50.5 km a 5 km/h
        self.assertEqual(camino['jornadas'], 1.7)     # 10.1 h / 6 h = 1.68
        self.assertEqual(camino['horasCaravana'], 14.4)     # 50.5 km a 3,5 km/h
        self.assertEqual(camino['jornadasCaravana'], 2.4)   # 14.43 h / 6 h
        # por mar, en bote: 30 km a 6 km/h = 5 h; sin rodeo ni caravana
        self.assertEqual((mar['km'], mar['horas'], mar['jornadas']), (30.0, 5.0, 0.8))
        self.assertEqual((mar['kmAPie'], mar['rodeo'], mar['horasCaravana'], mar['jornadasCaravana']), (None,) * 4)

    def test_la_montana_solo_sube_el_rodeo(self):
        m = _mundo_de_juguete()
        m['celdas'][2]['bioma'] = next(b['i'] for b in m['biomas'] if b['nombre'] == 'Wetland')  # 1.6 > 1.5
        self.assertEqual(viaje.tiempos(m)[0]['kmAPie'], 5.5 + 15 + 32)

    def test_tramo_con_el_medio_en_mar_toma_la_tierra_mas_cercana_al_medio(self):
        # medio (10, 0) en mar; la tierra más cercana a él en el tramo es la celda de humedal (14, 0), no el desierto
        # de los extremos: 20 km × 1.6 = 32
        m = _mundo_de_juguete()
        por = {b['nombre']: b['i'] for b in m['biomas']}
        m['celdas'] = [{'i': 0, 'p': [0, 0], 'h': 30, 'bioma': por['Hot desert']},
                       {'i': 1, 'p': [10, 0], 'h': 5, 'bioma': por['Marine']},
                       {'i': 2, 'p': [14, 0], 'h': 30, 'bioma': por['Wetland']},
                       {'i': 3, 'p': [20, 0], 'h': 30, 'bioma': por['Hot desert']}]
        m['rutas'] = [{'i': 0, 'grupo': 'roads', 'puntos': [[0, 0], [20, 0]]}]
        self.assertEqual(viaje.tiempos(m)[0]['kmAPie'], 32.0)

    def test_solo_calcula_las_rutas_pedidas(self):
        m = _mundo_de_juguete()
        self.assertEqual([f['i'] for f in viaje.tiempos(m, solo={1})], [1])
        self.assertEqual(consultar.ruta(m, 1), viaje.tiempos(m)[1])

    def test_un_bioma_sin_regla_falla_con_su_nombre(self):
        reglas = viaje.cargar()
        del reglas['rodeo']['porBioma']['Taiga']
        with self.assertRaises(viaje.ReglasDeViaje) as e:
            viaje.tiempos(_mundo_de_juguete(), reglas)
        self.assertIn('no da rodeo para el bioma Taiga', str(e.exception))

    def test_las_reglas_dicen_su_fuente_y_lo_derivado(self):
        r = viaje.cargar()
        self.assertEqual(r['fuente'], 'docs/mecanicas/13-escala-del-mundo.md § 1')
        self.assertEqual((r['velocidadKmH']['valor'], r['velocidadKmH']['derivado']), (5, False))
        self.assertEqual((r['jornadaHoras']['valor'], r['jornadaHoras']['derivado']), (6, False))
        self.assertEqual((r['caravanaKmH']['valor'], r['mar']['velocidadKmH'], r['balsaKmH']['valor']), (3.5, 6, 4))
        self.assertTrue(r['rodeo']['derivado'])
        self.assertEqual(r['rodeo']['montana'], {'alturaMinima': 50, 'valor': 1.5})

    def test_el_mapa_real_tiene_tiempos_coherentes(self):
        filas = viaje.tiempos(MUNDO)
        self.assertEqual(len(filas), len(MUNDO['rutas']))
        for f in filas:
            if f['grupo'] == 'searoutes':
                self.assertIsNone(f['kmAPie'])
                self.assertAlmostEqual(f['horas'], f['km'] / 6, delta=0.06)
            else:
                self.assertGreaterEqual(f['kmAPie'], f['km'] - 0.05)
                self.assertAlmostEqual(f['horas'], f['kmAPie'] / 5, delta=0.06)


def _comprobar():
    err = io.StringIO()
    with contextlib.redirect_stderr(err), contextlib.redirect_stdout(io.StringIO()):
        codigo = exportar.main(['--comprobar'])
    return codigo, err.getvalue()


class Capas(unittest.TestCase):
    def test_el_archivo_de_capas_esta_al_dia_con_el_mapa_real(self):
        codigo, err = _comprobar()
        self.assertEqual(codigo, 0, err)

    def test_generar_capas_lleva_zonas_y_rutas(self):
        v1 = aplicar({'zonas': [tormenta(nota='fuente'), {'i': 2, 'tipo': 'clan', 'nombre': 'Serhu', 'clan': 'Serhu',
                                                          'celdas': CELDAS_LLANURAS[:2]}]})
        texto = exportar.generar_capas(v1)
        self.assertTrue(texto.startswith('// Generado por map-generator/exportar.py'))
        for trozo in ('export interface ZonaHelek', 'export interface RutaHelek', 'export const ZONAS_HELEK: ZonaHelek[] = [',
                      'export const RUTAS_HELEK: RutaHelek[] = [', 'export const VIAJE_HELEK = {"velocidadKmH": 5, "jornadaHoras": 6, "caravanaKmH": 3.5, "boteKmH": 6, "balsaKmH": 4}'):
            self.assertIn(trozo, texto)
        zonas = exportar.zonas(v1)
        self.assertEqual([(z['i'], z['tipo'], z['nivel'], z['clan'], z['canon'], z['nota']) for z in zonas],
                         [(1, 'tormenta', 2, None, False, 'fuente'), (2, 'clan', 0, 'Serhu', False, '')])
        for z in zonas:
            self.assertTrue(z['d'].startswith('M') and z['d'].endswith('Z'), z['nombre'])
            self.assertIn(json.dumps(z, ensure_ascii=False), texto)
        rutas = exportar.rutas(MUNDO)
        self.assertEqual(set(rutas[0]), {'i', 'grupo', 'km', 'kmAPie', 'horas', 'jornadas', 'horasCaravana', 'jornadasCaravana'})
        self.assertEqual(len(rutas), len(MUNDO['rutas']))
        self.assertIn('"kmAPie": null', texto)  # las marítimas, en bote sin rodeo

    def test_comprobar_falla_si_las_zonas_dejan_las_capas_desfasadas(self):
        v1 = aplicar({'zonas': [tormenta()]})
        with mock.patch.object(exportar.medir, 'cargar', return_value=v1):
            codigo, err = _comprobar()
        self.assertEqual(codigo, 1)
        self.assertIn('helekCapas.ts no es lo que sale de helek.json', err)
        self.assertNotIn('helekRegiones.ts no es', err)  # las regiones no cambian

    def test_comprobar_falla_si_falta_el_archivo_de_capas(self):
        with mock.patch.object(exportar, 'ruta_capas', return_value='/no/existe/helekCapas.ts'):
            codigo, err = _comprobar()
        self.assertEqual(codigo, 1)
        self.assertIn('helekCapas.ts no es lo que sale de helek.json', err)


class Guardado(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.mundo = os.path.join(self.dir, 'helek.json')
        self.juego = os.path.join(self.dir, 'helekRegiones.ts')
        self.capas = os.path.join(self.dir, 'helekCapas.ts')
        _sinzonas.copiar(self.mundo)
        self.v1 = aplicar({'zonas': [tormenta(), tormenta(2, 'Segunda', CELDAS_LLANURAS[4:6])]})

    def tearDown(self):
        shutil.rmtree(self.dir)

    def _leer(self, ruta):
        with open(ruta, encoding='utf-8') as f:
            return f.read()

    def test_guardar_escribe_una_fila_por_zona_y_regenera_las_capas(self):
        editar.guardar(self.v1, self.mundo, ruta_juego=self.juego)
        texto = self._leer(self.mundo)
        filas = [x for x in texto.splitlines() if x.startswith('    {"i":') and '"tipo":"tormenta"' in x]
        self.assertEqual(len(filas), 2)
        self.assertLess(texto.index('"zonas": ['), texto.index('"vertices": ['))
        self.assertIn('Tormenta del oeste', self._leer(self.capas))
        self.assertEqual(self._leer(self.capas), exportar.generar_capas(medir.cargar(self.mundo)))

    def test_deshacer_y_restaurar_regeneran_las_capas(self):
        editar.guardar(self.v1, self.mundo, ruta_juego=self.juego)
        editar.deshacer(self.mundo, self.juego)
        self.assertNotIn('Tormenta del oeste', self._leer(self.capas))
        self.assertNotIn('"zonas"', self._leer(self.mundo))
        despues = editar.historial.entradas(self.mundo)[0]['despues']
        editar.restaurar(despues, self.mundo, self.juego)
        self.assertIn('Tormenta del oeste', self._leer(self.capas))

    def test_reglas_de_viaje_rotas_dan_error_de_edicion_y_no_escriben_nada(self):
        antes = self._leer(self.mundo)
        with mock.patch.object(viaje, 'cargar', side_effect=viaje.ReglasDeViaje('viaje.json no da rodeo para X')):
            with self.assertRaises(editar.ErrorDeEdicion) as e:
                editar.guardar(self.v1, self.mundo, ruta_juego=self.juego)
        self.assertIn('no se pudieron generar las capas del juego: viaje.json no da rodeo', str(e.exception))
        self.assertEqual(self._leer(self.mundo), antes)
        self.assertFalse(os.path.exists(self.capas))

    def test_sin_juego_no_toca_las_capas(self):
        editar.guardar(self.v1, self.mundo, ruta_juego=None)
        self.assertFalse(os.path.exists(self.capas))

    def test_por_consola_con_mundo_aparte_no_toca_las_capas_del_juego(self):
        lote = os.path.join(self.dir, 'lote.json')
        with open(lote, 'w', encoding='utf-8') as f:
            json.dump({'zonas': [tormenta()]}, f)
        antes = self._leer(exportar.ruta_capas())
        with contextlib.redirect_stdout(io.StringIO()):
            codigo = editar.main([lote, '--mundo', self.mundo, '--guardar'])
        self.assertEqual(codigo, 0)
        self.assertEqual(self._leer(exportar.ruta_capas()), antes)
        self.assertIn('Tormenta del oeste', self._leer(self.mundo))
        self.assertFalse(os.path.exists(self.capas))


class Consultar(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dir = tempfile.mkdtemp()
        cls.mundo = os.path.join(cls.dir, 'helek.json')
        _sinzonas.copiar(cls.mundo)
        v = aplicar({'zonas': [tormenta(), {'i': 2, 'tipo': 'clan', 'nombre': 'Tierras Serhu', 'clan': 'Serhu',
                                            'canon': True, 'nota': 'canon X', 'celdas': CELDAS_LLANURAS[:2]}]})
        editar.guardar(v, cls.mundo, ruta_juego=None)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.dir)

    def _correr(self, *args):
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            codigo = consultar.main([*args, '--mundo', self.mundo])
        return codigo, out.getvalue()

    def test_zonas_en_json_y_por_tipo(self):
        codigo, out = self._correr('zonas', '--json')
        self.assertEqual(codigo, 0)
        zonas = json.loads(out)['zonas']
        self.assertEqual([(z['i'], z['tipo'], z['celdas'], z['canon'], z['clan']) for z in zonas],
                         [(1, 'tormenta', 4, False, None), (2, 'clan', 2, True, 'Serhu')])
        self.assertAlmostEqual(zonas[0]['km2'], round(medir.area_celdas(medir.cargar(self.mundo), CELDAS_LLANURAS[:4]), 1))
        _, out = self._correr('zonas', '--tipo', 'clan', '--json')
        self.assertEqual([z['i'] for z in json.loads(out)['zonas']], [2])
        _, out = self._correr('zonas', '--tipo', 'peligro')
        self.assertIn('Sin zonas de tipo peligro', out)

    def test_zonas_en_texto(self):
        _, out = self._correr('zonas')
        self.assertIn('Tormenta del oeste · nivel 2 · canon no · 4 celdas', out)
        self.assertIn('clan Serhu · canon sí · 2 celdas', out)

    def test_ruta(self):
        codigo, out = self._correr('ruta', '0', '--json')
        self.assertEqual(codigo, 0)
        self.assertEqual(json.loads(out), viaje.tiempos(MUNDO)[0])
        _, texto = self._correr('ruta', '0')
        self.assertIn('km a pie', texto)
        self.assertIn('en caravana', texto)
        mar = next(r['i'] for r in MUNDO['rutas'] if r['grupo'] == 'searoutes')
        _, texto = self._correr('ruta', str(mar))
        self.assertIn('en bote costero', texto)
        self.assertIn('jornadas', texto)

    def test_ruta_que_no_existe(self):
        codigo, _ = self._correr('ruta', '99999')
        self.assertEqual(codigo, 1)
        with self.assertRaises(consultar.ErrorDeConsulta) as e:
            consultar.ruta(MUNDO, 99999)
        self.assertIn('no existe la ruta 99999', str(e.exception))


class VisorViaje(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = servir.servidor(0)
        cls.url = f'http://127.0.0.1:{cls.srv.server_address[1]}'
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()

    def _get(self, ruta):
        with urllib.request.urlopen(self.url + ruta, timeout=30) as r:
            return r.read()

    def test_viaje_json_trae_las_reglas_y_los_tiempos_del_servidor(self):
        datos = json.loads(self._get('/viaje.json'))
        self.assertEqual(datos['reglas'], viaje.cargar())
        self.assertEqual(datos['rutas'], viaje.tiempos(MUNDO))

    def test_el_visor_tiene_las_capas_el_modo_y_la_leyenda(self):
        html = self._get('/').decode('utf-8')
        for trozo in ("id: 'z-tormenta', nombre: 'Tormentas'", "id: 'z-peligro', nombre: 'Peligro'", "id: 'z-clan', nombre: 'Clanes'",
                      'value="zonas">Zonas', 'propuesta sin canon', 'zonas: cambiosZonas()', 'textoViaje', 'fetch(\'viaje.json\')'):
            self.assertIn(trozo, html)
        # el visor no repite la regla de viaje: ni 5 km/h ni la jornada ni los rodeos
        self.assertNotIn('1.3', html.split('textoViaje')[1].split('function datosZonas')[0])


if __name__ == '__main__':
    unittest.main()
