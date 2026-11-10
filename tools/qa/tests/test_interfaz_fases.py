"""IMG-40: las rutas por fases de la interfaz del generador (image-generator/interfaz/servidor.py): /api/camino y
/api/fase/{generar,avanzar,atras}, con un fase.py falso (lo que lanza el servidor) y, en un caso, el real con un
generar.sh falso."""
import json
import os
import shutil
import socket
import sys
import tempfile
import threading
import unittest

from comun import RAIZ, escribir, leer
import test_interfaz_imagenes as T

SCRIPTS = os.path.join(RAIZ, 'image-generator', 'scripts')
sys.path.insert(0, SCRIPTS)
import camino as C  # noqa: E402

# fase.py falso: deja en fase-args lo que recibió (argumentos y prompt) y espera FASE_ESPERA segundos.
FASE_FALSA = '''#!/usr/bin/env python3
import json, os, sys, time
raiz = os.environ["IMG_RAIZ"]
with open(os.path.join(raiz, "fase-args"), "a") as f:
    f.write(json.dumps({"argv": sys.argv[1:], "prompt": open(sys.argv[5]).read()}) + "\\n")
time.sleep(float(os.environ.get("FASE_ESPERA", "0.3")))
print("imagen: /x/%s-%s.png" % (sys.argv[3], sys.argv[4].lower()))
'''
GENERAR_FALSO = '''#!/bin/bash
mkdir -p "$1/intentos"; echo png > "$1/intentos/$2.png"
'''


class Fases(T.Base):
    pedir, esperar = T.Http.pedir, T.Http.esperar  # sin heredar de Http: sus tests no se repiten

    def setUp(self):
        self.fake = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.fake, True)
        fase = os.path.join(self.fake, 'fase.py')
        escribir(fase, FASE_FALSA)
        os.chmod(fase, 0o755)
        os.environ['IMG_FASE'] = fase
        self.addCleanup(os.environ.pop, 'IMG_FASE', None)
        super().setUp()
        psql = os.path.join(self.raiz, 'psql.sh')
        escribir(psql, T.PSQL)
        os.chmod(psql, 0o755)
        self.s = T.cargar(self.raiz, psql)
        with socket.socket() as so:
            so.bind(('127.0.0.1', 0))
            self.puerto = so.getsockname()[1]
        self.srv = self.s.ThreadingHTTPServer(('127.0.0.1', self.puerto), self.s.Manejador)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.addCleanup(self.srv.server_close)
        self.addCleanup(self.srv.shutdown)

    def args(self):
        ruta = os.path.join(self.raiz, 'fase-args')
        return [json.loads(l) for l in leer(ruta).splitlines()] if os.path.exists(ruta) else []

    def sembrar(self, tipo='fauna', slug='nievon', variante='macho', fase='F0', n=2, ok=True, faseActual=None, segundos=1.0):
        """Apunta n intentos de `fase` (con su imagen en disco) como lo haría fase.py."""
        d = self.dir(tipo, slug)

        def f(c):
            for _ in range(n):
                k = C.siguiente_n(c, variante, fase)
                nombre = C.nombre_intento(variante, fase, k) + '.png'
                C.apuntar_intento(c, variante, fase, f'prompt {k}', k, nombre if ok else None, segundos, 0, None)
                if ok:
                    escribir(os.path.join(d, 'intentos', nombre), 'x')
            if faseActual:
                c['variantes'][variante]['faseActual'] = faseActual
        C.actualizar(d, f)

    def post_fase(self, ruta, **cuerpo):
        base = {'tipo': 'fauna', 'slug': 'nievon', 'variante': 'macho'}
        return self.pedir('/api/fase/' + ruta, {**base, **cuerpo})

    def test_inicio_trae_las_fases_del_camino(self):
        codigo, r = self.pedir('/api/inicio')
        self.assertEqual(codigo, 200)
        self.assertEqual([{k: v for k, v in f.items() if k != 'promptPorDefecto'} for f in r['fases']], C.FASES)

    def test_generar_f0_lanza_fase_py_con_sus_argumentos_y_los_datos_de_la_cola(self):
        self.assertEqual(self.post_fase('generar', fase='F0', prompt='un oso de nieve', semilla=7), (202, {'ok': True}))
        e = self.pedir('/api/estado')[1]
        self.assertEqual((e['enMarcha'], e['tipo'], e['variante'], e['fase'], e['perfil'], e['semilla'], e['estimado']),
                         (True, 'fauna', 'macho', 'F0', 'F0 Boceto', 7, 36))
        c = self.pedir('/api/cola')[1]['cola'][0]
        self.assertEqual((c['estado'], c['pasos'], c['conReferencia'], c['estimado']), ('generando', 4, False, 36))
        self.assertEqual(self.esperar()['rc'], 0)
        (a,) = self.args()
        self.assertEqual(a['argv'][:4], ['fauna', 'nievon', 'macho', 'F0'])
        self.assertEqual(a['argv'][5:], ['7'])
        self.assertEqual(a['prompt'].strip(), 'un oso de nieve')
        self.assertFalse(os.path.exists(a['argv'][4]), 'el prompt temporal se limpia')
        self.assertEqual(self.esperar()['nombre'], 'macho-f0')
        cola = self.pedir('/api/cola')[1]['cola']
        self.assertEqual((cola[0]['estado'], cola[0]['fase'], cola[0]['perfil'], cola[0]['intento']), ('hecho', 'F0', 'F0 Boceto', 'macho-f0'))

    def test_sin_semilla_no_se_pasa_y_la_pone_fase_py(self):
        self.post_fase('generar', fase='F0', prompt='x')
        e = self.pedir('/api/estado')[1]
        self.assertIsNone(e['semilla'])
        self.esperar()
        self.assertEqual(len(self.args()[0]['argv']), 5)

    def test_generar_rechaza_con_su_motivo(self):
        casos = ((dict(fase='F1', prompt='x'), 'Falta una fase aceptada \\(F0\\) para generar F1 Forma'),
                 (dict(fase='F4', prompt='x'), 'Falta una fase aceptada \\(un paso P1…P9, F2, F1 o F0\\)'),
                 (dict(fase='F3', prompt='x'), 'F3 Recorte no está disponible todavía'),
                 (dict(fase='F9', prompt='x'), 'fase desconocida: F9'),
                 (dict(fase='F0', prompt='  '), 'el prompt está vacío'),
                 (dict(fase='F0', prompt='x', semilla='abc'), 'la semilla tiene que ser un número'),
                 (dict(fase='F0', prompt='x', variante='../x'), 'solo letras sin tilde'))
        for cuerpo, motivo in casos:
            with self.subTest(cuerpo=cuerpo):
                codigo, r = self.post_fase('generar', **cuerpo)
                self.assertEqual(codigo, 400)
                self.assertRegex(r['error'], motivo)
        self.assertEqual(self.args(), [])
        self.assertFalse(self.pedir('/api/estado')[1]['enMarcha'])

    def test_generar_con_otra_en_marcha_dice_que_espere(self):
        os.environ['FASE_ESPERA'] = '1.5'
        self.addCleanup(os.environ.pop, 'FASE_ESPERA', None)
        self.assertEqual(self.post_fase('generar', fase='F0', prompt='x')[0], 202)
        codigo, r = self.post_fase('generar', fase='F0', prompt='y')
        self.assertEqual(codigo, 400)
        self.assertIn('ya hay una imagen generándose', r['error'])
        self.esperar()

    def test_avanzar_acepta_borra_la_imagen_no_aceptada_y_lanza_la_siguiente(self):
        self.sembrar(n=2)
        codigo, r = self.post_fase('avanzar', fase='F0', intento=1, siguiente='F1')
        self.assertEqual((codigo, r['lanzado']), (200, True))
        v = r['camino']['variantes']['macho']
        self.assertEqual((v['faseActual'], v['siguientes'], v['fases']['F0']['aceptada']), ('F1', ['F2', 'F4'], 'macho-f0-1.png'))
        self.assertTrue(os.path.exists(os.path.join(self.dir(), 'intentos', 'macho-f0-1.png')))
        self.assertFalse(os.path.exists(os.path.join(self.dir(), 'intentos', 'macho-f0-2.png')))
        self.assertIsNone(v['fases']['F0']['intentos'][1]['imagen'])
        self.assertEqual(self.pedir('/api/estado')[1]['fase'], 'F1')
        self.esperar()
        (a,) = self.args()
        self.assertEqual((a['argv'][:4], len(a['argv'])), (['fauna', 'nievon', 'macho', 'F1'], 5))
        self.assertEqual(a['prompt'].strip(), 'prompt 1')

    def test_avanzar_con_el_trabajo_ocupado_guarda_la_aceptacion_sin_lanzar(self):
        self.sembrar(n=2)
        os.environ['FASE_ESPERA'] = '1.5'
        self.addCleanup(os.environ.pop, 'FASE_ESPERA', None)
        self.assertEqual(self.post_fase('generar', variante='hembra', fase='F0', prompt='x')[0], 202)
        codigo, r = self.post_fase('avanzar', fase='F0', intento=2, siguiente='F4')
        self.assertEqual(codigo, 200)
        self.assertFalse(r['lanzado'])
        self.assertIn('ya hay una imagen generándose', r['motivo'])
        self.assertEqual(r['camino']['variantes']['macho']['fases']['F0']['aceptada'], 'macho-f0-2.png')
        self.assertEqual(self.pedir('/api/camino?tipo=fauna&slug=nievon')[1]['variantes']['macho']['faseActual'], 'F4')
        self.esperar()
        self.assertEqual([a['argv'][2:4] for a in self.args()], [['hembra', 'F0']])

    def test_avanzar_rechaza_con_el_motivo_del_camino(self):
        self.sembrar(n=1)
        self.sembrar(variante='malo', n=1, ok=False)
        casos = ((dict(fase='F0', intento=1, siguiente='F2'), 'Desde F0 no se puede avanzar a F2 en fauna'),
                 (dict(fase='F0', intento=1, siguiente='F3'), 'no se puede avanzar a F3'),
                 (dict(fase='F0', intento=9, siguiente='F1'), 'No existe el intento 9 de F0'),
                 (dict(fase='F1', intento=1, siguiente='F2'), 'no tiene la fase F1'),
                 (dict(fase='F0', intento=1, siguiente='F1', variante='malo'), 'falló y no tiene imagen'),
                 (dict(fase='F0', intento='x', siguiente='F1'), 'el intento tiene que ser un número'))
        for cuerpo, motivo in casos:
            with self.subTest(cuerpo=cuerpo):
                codigo, r = self.post_fase('avanzar', **cuerpo)
                self.assertEqual(codigo, 400)
                self.assertIn(motivo, r['error'])
        self.assertIsNone(self.pedir('/api/camino?tipo=fauna&slug=nievon')[1]['variantes']['macho']['fases']['F0']['aceptada'])

    def test_atras_vuelve_a_la_fase_de_la_que_viene_y_sin_anterior_dice_por_que(self):
        self.sembrar(n=1)
        self.post_fase('avanzar', fase='F0', intento=1, siguiente='F4')
        self.esperar()
        codigo, r = self.post_fase('atras')
        self.assertEqual((codigo, r['camino']['variantes']['macho']['faseActual']), (200, 'F0'))
        codigo, r = self.post_fase('atras')
        self.assertEqual(codigo, 400)
        self.assertIn('No hay fase anterior a F0', r['error'])
        codigo, r = self.post_fase('atras', variante='nadie')
        self.assertEqual((codigo, r['error']), (400, 'La variante nadie no existe'))

    def test_camino_lleva_los_siguientes_calculados_sin_recorte_en_location(self):
        self.sembrar(tipo='fauna', slug='nievon', fase='F4', n=1)
        self.sembrar(tipo='location', slug='valle', fase='F4', n=1)
        self.sembrar(tipo='location', slug='valle', variante='b', fase='F2', n=1)
        fauna = self.pedir('/api/camino?tipo=fauna&slug=nievon')[1]['variantes']['macho']
        self.assertEqual(fauna['siguientes'], ['F3'])
        valle = self.pedir('/api/camino?tipo=location&slug=valle')[1]['variantes']
        self.assertEqual((valle['macho']['siguientes'], valle['b']['siguientes']), ([], ['F4']))
        self.assertNotIn('siguientes', C.leer(self.dir('location', 'valle'))['variantes']['macho'], 'no se guarda')
        self.assertEqual(self.pedir('/api/camino?tipo=fauna&slug=nadie')[1], {'nombre': '', 'variantes': {}, 'marcadas': []})

    def test_el_estimado_es_la_mediana_de_los_intentos_con_imagen_de_la_fase_o_la_base(self):
        self.assertEqual([self.s.estimado_fase(f) for f in ('F0', 'F1', 'F2', 'F4')], [36, 300, 300, 160])
        for slug, seg in (('a', 10), ('b', 20), ('c', 90)):
            self.sembrar(slug=slug, fase='F1', n=1, segundos=seg)
        self.sembrar(slug='d', fase='F1', n=1, ok=False, segundos=999)  # fallido: no cuenta
        self.assertEqual(self.s.estimado_fase('F1'), 20)
        self.assertEqual(self.s.estimado_fase('F0'), 36)

    def test_el_estimado_no_cuenta_los_intentos_con_referencias_con_rol(self):
        self.sembrar(slug='a', fase='F1', n=1, segundos=10)
        d = self.dir('fauna', 'a')
        C.actualizar(d, lambda c: c['variantes']['macho']['fases']['F1']['intentos'].append(
            {'n': 9, 'imagen': 'x.png', 'segundos': 999, 'referencias': [{'rol': 'lugar', 'imagen': 'l.png'}]}))
        self.assertEqual(self.s.estimado_fase('F1'), 10)

    def test_elementos_cuenta_tambien_los_intentos_del_camino(self):
        self.sembrar(n=3)
        el = [e for e in self.pedir('/api/elementos')[1]['elementos'] if e['slug'] == 'nievon']
        self.assertEqual(el[0]['intentos'], 3)

    def llegar_a_la_final(self):
        """macho: F0 (2 intentos, el 1 aceptado) -> F4 (2 intentos, desde F0), con sus imágenes."""
        self.sembrar(n=2)
        self.post_fase('avanzar', fase='F0', intento=1, siguiente='F4')
        self.esperar()
        d = self.dir()

        def f(c):
            for k in (1, 2):
                nombre = C.nombre_intento('macho', 'F4', k) + '.png'
                C.apuntar_intento(c, 'macho', 'F4', f'final {k}', k, nombre, 1.0, 0, ('F0', 'macho-f0-1.png'))
                escribir(os.path.join(d, 'intentos', nombre), 'x')
        C.actualizar(d, f)

    def test_generar_con_referencia_pasa_la_imagen_del_juego_y_alarga_la_estimacion(self):
        ruta = os.path.join(self.raiz, 'referencias', 'images', 'fauna', 'nievon-banner.png')
        escribir(ruta, 'IMG')
        self.assertEqual(self.post_fase('generar', fase='F0', prompt='x', usarReferencia=True)[0], 202)
        c = self.pedir('/api/cola')[1]['cola'][0]
        self.assertEqual((c['conReferencia'], c['estimado']), (True, 68))
        self.esperar()
        self.assertEqual(self.args()[0]['argv'][5:], ['--referencia', ruta])

    def test_con_imagen_del_juego_y_sin_la_casilla_solo_se_mide_con_ella(self):
        ruta = os.path.join(self.raiz, 'referencias', 'images', 'fauna', 'nievon-banner.png')
        escribir(ruta, 'IMG')
        self.assertEqual(self.post_fase('generar', fase='F0', prompt='x')[0], 202)
        self.assertFalse(self.pedir('/api/cola')[1]['cola'][0]['conReferencia'])
        self.esperar()
        self.assertEqual(self.args()[0]['argv'][5:], ['--medir-con', ruta])

    def test_avanzar_lleva_la_casilla_a_la_fase_siguiente(self):
        ruta = os.path.join(self.raiz, 'referencias', 'images', 'fauna', 'nievon-banner.png')
        escribir(ruta, 'IMG')
        self.sembrar(n=1)
        codigo, r = self.post_fase('avanzar', fase='F0', intento=1, siguiente='F4', usarReferencia=True)
        self.assertEqual((codigo, r['lanzado']), (200, True))
        self.esperar()
        self.assertEqual(self.args()[-1]['argv'][5:], ['--referencia', ruta])

    def test_generar_con_referencia_sin_imagen_del_juego_dice_por_que(self):
        codigo, r = self.post_fase('generar', fase='F0', prompt='x', usarReferencia=True)
        self.assertEqual((codigo, r['error']), (400, 'no hay imagen de fauna/nievon en image-generator/referencias/images/'))
        self.assertEqual(self.args(), [])

    def test_renombrar_guarda_el_nombre_y_lo_trae_elementos(self):
        codigo, r = self.pedir('/api/camino/renombrar', {'tipo': 'fauna', 'slug': 'nievon', 'nombre': '  Oso de nieve '})
        self.assertEqual((codigo, r['camino']['nombre']), (200, 'Oso de nieve'))
        self.assertEqual(C.leer(self.dir())['nombre'], 'Oso de nieve')
        el = [e for e in self.pedir('/api/elementos')[1]['elementos'] if e['slug'] == 'nievon'][0]
        self.assertEqual((el['nombre'], el['marcadas']), ('Oso de nieve', 0))
        for nombre, motivo in (('  ', 'El nombre está vacío'), ('x' * 121, 'demasiado largo')):
            codigo, r = self.pedir('/api/camino/renombrar', {'tipo': 'fauna', 'slug': 'nievon', 'nombre': nombre})
            self.assertEqual(codigo, 400)
            self.assertIn(motivo, r['error'])
        self.assertEqual(self.pedir('/api/camino/renombrar', {'tipo': 'fauna', 'slug': '../x', 'nombre': 'a'})[0], 400)

    def test_elementos_sin_camino_json_sigue_igual(self):
        self.sembrar(slug='otro', n=1)
        os.remove(os.path.join(self.dir('fauna', 'otro'), 'camino.json'))
        el = [e for e in self.pedir('/api/elementos')[1]['elementos'] if e['slug'] == 'otro'][0]
        self.assertEqual((el['nombre'], el['marcadas']), ('', 0))

    def test_marcar_y_quitar_la_estrella_y_elementos_las_cuenta(self):
        self.llegar_a_la_final()
        codigo, r = self.post_fase('marcar', intento=2, marcada=True)
        self.assertEqual((codigo, r['camino']['marcadas']), (200, [{'imagen': 'macho-f4-2.png', 'variante': 'macho', 'pautasVersion': None}]))
        self.assertEqual(r['camino']['variantes']['macho']['fases']['F4']['aceptada'], 'macho-f4-2.png')
        self.post_fase('marcar', intento=1, marcada=True)
        el = [e for e in self.pedir('/api/elementos')[1]['elementos'] if e['slug'] == 'nievon'][0]
        self.assertEqual(el['marcadas'], 2)
        codigo, r = self.post_fase('marcar', intento=2, marcada=False)
        self.assertEqual([m['imagen'] for m in r['camino']['marcadas']], ['macho-f4-1.png'])
        casos = ((dict(intento=1), 'marcada tiene que ser true o false'), (dict(intento=9, marcada=True), 'No existe el intento 9 de F4'),
                 (dict(intento='x', marcada=True), 'el intento tiene que ser un número'),
                 (dict(intento=1, marcada=True, variante='nadie'), 'La variante nadie no existe'))
        for cuerpo, motivo in casos:
            with self.subTest(cuerpo=cuerpo):
                codigo, r = self.post_fase('marcar', **cuerpo)
                self.assertEqual(codigo, 400)
                self.assertIn(motivo, r['error'])

    def test_marcar_una_final_de_un_boceto_que_ya_no_es_el_aceptado_dice_por_que(self):
        self.llegar_a_la_final()
        self.post_fase('atras')
        d = self.dir()

        def otro_boceto(c):
            C.apuntar_intento(c, 'macho', 'F0', 'otro', 9, 'macho-f0-3.png', 1.0, 0, None, n=3)
            escribir(os.path.join(d, 'intentos', 'macho-f0-3.png'), 'x')
            C.avanzar(d, c, 'macho', 'F0', 3, 'F4', 'fauna')
        C.actualizar(d, otro_boceto)
        codigo, r = self.post_fase('marcar', intento=1, marcada=True)
        self.assertEqual((codigo, r['error']), (400, 'Esta Final salió de un boceto que ya no es el aceptado: genera otra'))
        self.assertEqual(C.leer(d)['marcadas'], [])

    def test_dependientes_y_borrar_la_fase(self):
        self.llegar_a_la_final()
        self.post_fase('marcar', intento=1, marcada=True)
        codigo, r = self.pedir('/api/fase/dependientes?tipo=fauna&slug=nievon&variante=macho&fase=F0')
        self.assertEqual((codigo, r), (200, {'fases': ['F0', 'F4'], 'marcadas': ['macho-f4-1.png'], 'variantes': []}))
        codigo, r = self.post_fase('borrar', fase='F0')
        self.assertEqual(codigo, 200)
        v = r['camino']['variantes']['macho']
        self.assertEqual((v['faseActual'], v['fases']['F0']['aceptada'], r['camino']['marcadas']), ('F0', None, []))
        self.assertEqual([i['prompt'] for i in v['fases']['F0']['intentos']], ['prompt 1', 'prompt 2'])
        self.assertEqual(os.listdir(os.path.join(self.dir(), 'intentos')), [])
        codigo, r = self.post_fase('borrar', fase='F1')  # esa fase no tiene intentos
        self.assertEqual((codigo, r['error']), (400, 'No hay nada guardado en esta fase'))
        self.assertEqual(self.post_fase('borrar', fase='F9')[0], 400)
        codigo, r = self.pedir('/api/fase/dependientes?tipo=fauna&slug=nievon&variante=nadie&fase=F0')
        self.assertEqual((codigo, r['error']), (400, 'La variante nadie no existe'))

    def test_borrar_con_una_generacion_en_marcha_de_ese_elemento_da_400_y_el_motivo(self):
        self.sembrar(n=1)
        os.environ['FASE_ESPERA'] = '1.5'
        self.addCleanup(os.environ.pop, 'FASE_ESPERA', None)
        self.assertEqual(self.post_fase('generar', variante='hembra', fase='F0', prompt='x')[0], 202)
        codigo, r = self.post_fase('borrar', fase='F0')
        self.assertEqual(codigo, 400)
        self.assertIn('hay una generación en marcha de este elemento', r['error'])
        self.assertTrue(os.path.exists(os.path.join(self.dir(), 'intentos', 'macho-f0-1.png')))
        # de otro elemento no estorba
        self.sembrar(slug='otro', n=1)
        self.assertEqual(self.pedir('/api/fase/borrar', {'tipo': 'fauna', 'slug': 'otro', 'variante': 'macho', 'fase': 'F0'})[0], 200)
        self.esperar()
        self.assertEqual(self.post_fase('borrar', fase='F0')[0], 200)

    def test_con_el_fase_py_real_el_intento_queda_en_camino_json(self):
        self.s.FASE = os.path.join(SCRIPTS, 'fase.py')
        generar = os.path.join(self.fake, 'generar.sh')
        escribir(generar, GENERAR_FALSO)
        os.environ['IMG_GENERAR'] = generar
        self.addCleanup(os.environ.pop, 'IMG_GENERAR', None)
        self.assertEqual(self.post_fase('generar', fase='F0', prompt='un oso', semilla=5)[0], 202)
        self.assertEqual(self.esperar()['nombre'], 'macho-f0-1')
        f0 = self.pedir('/api/camino?tipo=fauna&slug=nievon')[1]['variantes']['macho']['fases']['F0']
        self.assertEqual((f0['intentos'][0]['semilla'], f0['intentos'][0]['imagen']), (5, 'macho-f0-1.png'))
        codigo, r = self.post_fase('avanzar', fase='F0', intento=1, siguiente='F1')
        self.assertEqual((codigo, r['lanzado']), (200, True))
        self.assertEqual(self.esperar()['nombre'], 'macho-f1-1')
        f1 = self.pedir('/api/camino?tipo=fauna&slug=nievon')[1]['variantes']['macho']['fases']['F1']
        self.assertEqual((f1['desde'], f1['entrada'], f1['intentos'][0]['semilla']), ('F0', 'macho-f0-1.png', 5))

    # --- IMG-53: pasos, motores, semillas y referencias ---

    def modelos(self, *rutas):
        for r in rutas:
            escribir(os.path.join(self.raiz, 'modelos', r), 'x')

    def test_inicio_trae_los_pasos_y_los_motores_con_su_disponibilidad(self):
        r = self.pedir('/api/inicio')[1]
        self.assertEqual([f['id'] for f in r['fases']][3:12], [f'P{n}' for n in range(1, 10)])
        self.assertEqual(r['motorPorDefecto'], 'klein4b')
        self.assertEqual([m['id'] for m in r['motores']], ['klein4b', 'klein9b', 'klein9b-consistencia', 'qwen-edit', 'longcat', 'qwen21', 'flux3'])
        k = r['motores'][0]
        self.assertEqual((k['disponible'], k['pasos'], k['segundosEstimados'], k['estimacion']), (False, 4, {'paso': 40, 'final': 160}, False))
        self.assertIn('modelos/diffusion/flux-2-klein-4b-Q8_0.gguf', k['faltan'])
        self.modelos('diffusion/flux-2-klein-4b-Q8_0.gguf', 'text/Qwen3-4B-Q4_K_M.gguf', 'vae/full_encoder_small_decoder.safetensors')
        r = self.pedir('/api/inicio')[1]
        self.assertEqual((r['motores'][0]['disponible'], r['motores'][0]['faltan']), (True, []))
        q = next(m for m in r['motores'] if m['id'] == 'qwen-edit')
        self.assertEqual((q['disponible'], q['pasos'], q['estimacion']), (False, 20, True))
        w = next(m for m in r['motores'] if m['id'] == 'qwen21')  # IMG-56
        self.assertEqual((w['disponible'], w['pasos'], w['segundosEstimados'], w['sinReferencias']), (False, 40, {'paso': 700, 'final': 2540}, True))
        self.assertIn('modelos/diffusion/qwen_image_2.1-Q4_K.gguf', w['faltan'])
        self.assertFalse(next(m for m in r['motores'] if m['id'] == 'klein9b')['sinReferencias'])

    def test_generar_p1_y_avanzar_p2_encadena_los_pasos_por_la_api(self):
        self.assertEqual(self.post_fase('generar', fase='P1', prompt='un fondo', semilla=4)[0], 202)
        e = self.pedir('/api/estado')[1]
        self.assertEqual((e['fase'], e['perfil'], e['motor'], e['semillas'], e['estimado']), ('P1', 'P1 Paso 1', 'klein4b', 1, 40))
        self.assertEqual(self.pedir('/api/cola')[1]['cola'][0]['pasos'], 4)
        self.esperar()
        self.sembrar(fase='P1', n=1)
        codigo, r = self.post_fase('generar', fase='P2', prompt='x')
        self.assertEqual(codigo, 400)
        self.assertIn('Falta una fase aceptada (P1)', r['error'])
        codigo, r = self.post_fase('avanzar', fase='P1', intento=1, siguiente='P2')
        self.assertEqual((codigo, r['lanzado']), (200, True))
        self.assertEqual(r['camino']['variantes']['macho']['siguientes'], ['P3', 'F4'])
        self.esperar()

    def test_la_final_trae_el_prompt_corto_de_estilo_y_avanzar_de_un_paso_a_la_final_lo_usa(self):
        fases = {f['id']: f for f in self.pedir('/api/inicio')[1]['fases']}
        corta = fases['F4']['promptPorDefecto']
        # IMG-54: vale para cualquier tipo (nada del guerrero de r37) y sin el «The same…», que pone fase.py
        self.assertIn('textless', corta)
        for palabra in ('figure', 'weapon', 'tents', 'The same', 'reference'):
            self.assertNotIn(palabra, corta)
        self.assertTrue(all('promptPorDefecto' not in f for i, f in fases.items() if i != 'F4'))
        # de un paso a la Final, el prompt es el corto; de un paso a otro paso, el del paso
        self.sembrar(fase='P1', n=1)
        self.assertEqual(self.post_fase('avanzar', fase='P1', intento=1, siguiente='F4')[1]['lanzado'], True)
        self.esperar()
        (a,) = [x for x in self.args() if x['argv'][3] == 'F4']
        self.assertEqual(a['prompt'].strip(), corta)

    def test_generar_pasa_motor_semillas_y_referencias_a_fase_py(self):
        self.modelos('diffusion/flux-2-klein-9b-Q4_0.gguf', 'text/Qwen3-8B-Q4_K_M.gguf', 'vae/full_encoder_small_decoder.safetensors')
        escribir(os.path.join(self.raiz, 'referencias', 'images', 'fauna', 'estilo.png'), 'x')
        self.sembrar(fase='P1', n=1, faseActual='P1')
        escribir(os.path.join(self.dir(), 'intentos', 'macho-p1-1.png'), 'x')
        refs = [{'rol': 'estilo', 'imagen': 'referencias/images/fauna/estilo.png'}, {'rol': 'sujeto', 'imagen': 'macho-p1-1.png'}]
        r = self.post_fase('generar', fase='P1', prompt='x', motor='klein9b', semillas=2, referencias=refs)
        self.assertEqual(r[0], 202, r)
        e = self.pedir('/api/estado')[1]
        self.assertEqual((e['motor'], e['semillas'], e['conReferencia'], e['estimado']), ('klein9b', 2, True, 160))
        self.esperar()
        (a,) = [x for x in self.args() if x['argv'][3] == 'P1']
        av = a['argv']
        self.assertEqual(av[av.index('--motor') + 1], 'klein9b')
        self.assertEqual(av[av.index('--semillas') + 1], '2')
        rutas = [av[i + 1] for i, x in enumerate(av) if x == '--ref']
        self.assertEqual([x.split(':')[0] for x in rutas], ['estilo', 'sujeto'])
        self.assertTrue(rutas[0].endswith('/referencias/images/fauna/estilo.png'))
        self.assertTrue(rutas[1].endswith('/generated/fauna/nievon/intentos/macho-p1-1.png'))

    def test_referencias_fuera_de_las_carpetas_permitidas_dan_400(self):
        escribir(os.path.join(self.raiz, 'secreto.txt'), 'x')
        escribir(os.path.join(self.raiz, 'referencias', 'images', 'fauna', 'ok.png'), 'x')
        os.symlink(os.path.join(self.raiz, 'secreto.txt'), os.path.join(self.raiz, 'referencias', 'images', 'fauna', 'enlace.png'))
        for imagen, motivo in (('../../secreto.txt', 'fuera de referencias'), ('secreto.txt', 'fuera de referencias'),
                               ('/etc/passwd', 'imagen válida'), ('referencias/images/fauna/enlace.png', 'fuera de referencias'),
                               ('generated/fauna/nievon/prompts/x.txt', 'no existe|fuera'), ('nada.png', 'no existe')):
            codigo, r = self.post_fase('generar', fase='P1', prompt='x', referencias=[{'rol': 'estilo', 'imagen': imagen}])
            self.assertEqual(codigo, 400, imagen)
            self.assertRegex(r['error'], motivo, imagen)
        self.assertEqual(self.post_fase('generar', fase='P1', prompt='x', referencias=[{'rol': 'raro', 'imagen': 'fauna/ok.png'}])[0], 400)
        self.assertEqual(self.args(), [])
        self.assertEqual(self.post_fase('generar', fase='P1', prompt='x', referencias=[{'rol': 'estilo', 'imagen': 'fauna/ok.png'}])[0], 202)
        self.esperar()

    def test_motor_desconocido_sin_archivos_o_en_fase_antigua_y_semillas_fuera_de_rango_dan_400(self):
        for cuerpo, motivo in ((dict(fase='P1', motor='raro'), 'motor desconocido: raro'),
                               (dict(fase='P1', motor='qwen-edit'), 'el motor qwen-edit no está completo: falta modelos/diffusion/qwen-image-edit-2511-Q3_K_S.gguf'),
                               (dict(fase='F0', motor='klein9b'), 'solo vale en los pasos'),
                               (dict(fase='P1', semillas=5), 'semillas'),
                               (dict(fase='P1', semillas=0), 'semillas')):
            codigo, r = self.post_fase('generar', prompt='x', **cuerpo)
            self.assertEqual(codigo, 400, cuerpo)
            self.assertIn(motivo, r['error'])
        self.assertEqual(self.args(), [])

    def test_con_el_fase_py_real_dos_semillas_dejan_dos_intentos_con_su_motor(self):
        self.s.FASE = os.path.join(SCRIPTS, 'fase.py')
        generar = os.path.join(self.fake, 'generar.sh')
        escribir(generar, GENERAR_FALSO)
        os.environ['IMG_GENERAR'] = generar
        self.addCleanup(os.environ.pop, 'IMG_GENERAR', None)
        self.assertEqual(self.post_fase('generar', fase='P1', prompt='un fondo', semilla=5, semillas=2)[0], 202)
        self.esperar()
        p1 = self.pedir('/api/camino?tipo=fauna&slug=nievon')[1]['variantes']['macho']['fases']['P1']
        self.assertEqual([(i['semilla'], i['motor'], i['imagen']) for i in p1['intentos']],
                         [(5, 'klein4b', 'macho-p1-1.png'), (6, 'klein4b', 'macho-p1-2.png')])


if __name__ == '__main__':
    unittest.main()
