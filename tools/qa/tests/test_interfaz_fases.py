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
        self.assertEqual(r['fases'], C.FASES)

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
                 (dict(fase='F4', prompt='x'), 'Falta una fase aceptada \\(F2 o F1 o F0\\)'),
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

    def test_elementos_cuenta_tambien_los_intentos_del_camino(self):
        self.sembrar(n=3)
        el = [e for e in self.pedir('/api/elementos')[1]['elementos'] if e['slug'] == 'nievon']
        self.assertEqual(el[0]['intentos'], 3)

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


if __name__ == '__main__':
    unittest.main()
