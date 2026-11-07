"""IMG-40: camino.json y fase.py del generador por fases (image-generator/scripts/camino.py y fase.py), con un
generar.sh falso (sin modelos ni GPU)."""
import json
import os
import subprocess
import sys
import threading
import unittest

from comun import RAIZ, carpeta, escribir, leer

SCRIPTS = os.path.join(RAIZ, 'image-generator', 'scripts')
sys.path.insert(0, SCRIPTS)
import camino as C  # noqa: E402

FASE = os.path.join(SCRIPTS, 'fase.py')
GENERAR_FALSO = '''#!/bin/bash
{ printf '%s\\n' "$@"; echo "PERFIL=${PERFIL-<sin>}"; echo "BOCETO=${BOCETO-<sin>}"; echo "FUERZA_BOCETO=${FUERZA_BOCETO-<sin>}"
  echo "TOPE=${TOPE-<sin>}"; echo "PROMPT=$(cat "$3")"; } > "$ARGS_GENERAR"
[ -n "${FALLA:-}" ] && { echo "boom: sin memoria"; exit 1; }
mkdir -p "$1/intentos"; echo png > "$1/intentos/$2.png"
'''


def intento(c, v, f, prompt='p', semilla=1, ok=True, entrada=None):
    n = C.siguiente_n(c, v, f)
    C.apuntar_intento(c, v, f, prompt, semilla, C.nombre_intento(v, f, n) + '.png' if ok else None, 1.0, '', entrada)
    return n


def con_imagenes(d, c, v, f):
    for i in c['variantes'][v]['fases'][f]['intentos']:
        if i['imagen']:
            escribir(os.path.join(d, 'intentos', i['imagen']), 'x')


class TestCamino(unittest.TestCase):
    def setUp(self):
        self.d = carpeta()

    def aceptar(self, c, v, f, n, sig, tipo='fauna'):
        con_imagenes(self.d, c, v, f)
        C.avanzar(self.d, c, v, f, n, sig, tipo)

    def test_avanzar_borra_no_aceptados_y_conserva_prompt_semilla(self):
        c = C.vacio()
        for s in (3, 4, 5):
            intento(c, 'macho', 'F0', f'prompt{s}', s)
        con_imagenes(self.d, c, 'macho', 'F0')
        escribir(os.path.join(self.d, 'intentos', 'macho-f0-1.json'), '{}')
        C.avanzar(self.d, c, 'macho', 'F0', 2, 'F1', 'fauna')
        f = c['variantes']['macho']['fases']['F0']
        self.assertEqual((f['aceptada'], f['prompt'], f['semilla']), ('macho-f0-2.png', 'prompt4', 4))
        self.assertEqual([i['imagen'] for i in f['intentos']], [None, 'macho-f0-2.png', None])
        self.assertEqual([i['semilla'] for i in f['intentos']], [3, 4, 5])
        self.assertEqual(sorted(os.listdir(os.path.join(self.d, 'intentos'))), ['macho-f0-2.png'])
        self.assertEqual(c['variantes']['macho']['faseActual'], 'F1')

    def test_avanzar_no_permitido(self):
        c = C.vacio()
        intento(c, 'm', 'F0')
        with self.assertRaisesRegex(C.CaminoInvalido, 'no se puede avanzar a F2'):
            self.aceptar(c, 'm', 'F0', 1, 'F2')
        intento(c, 'm', 'F4')
        with self.assertRaisesRegex(C.CaminoInvalido, 'F4 Final no se avanza'):
            self.aceptar(c, 'm', 'F4', 1, 'F3')

    def test_f3_no_disponible_y_no_en_location(self):
        self.assertEqual(C.siguientes('F4', 'fauna'), ['F3'])
        self.assertEqual(C.siguientes('F4', 'location'), [])
        # F3 no se alcanza por avanzar (F4 no avanza), pero la regla de disponibilidad se aplica al grafo
        C.POR_ID['F2']['siguientes'].append('F3')
        try:
            c = C.vacio()
            intento(c, 'm', 'F2')
            with self.assertRaisesRegex(C.CaminoInvalido, 'F3 Recorte no está disponible todavía'):
                self.aceptar(c, 'm', 'F2', 1, 'F3')
            with self.assertRaisesRegex(C.CaminoInvalido, 'no se puede avanzar a F3 en location'):
                self.aceptar(c, 'm', 'F2', 1, 'F3', 'location')
        finally:
            C.POR_ID['F2']['siguientes'].remove('F3')

    def test_intento_fallido_no_se_acepta(self):
        c = C.vacio()
        intento(c, 'm', 'F0', ok=False)
        with self.assertRaisesRegex(C.CaminoInvalido, 'falló y no tiene imagen'):
            C.avanzar(self.d, c, 'm', 'F0', 1, 'F1', 'fauna')

    def test_desfasada_en_cadena(self):
        c = C.vacio()
        intento(c, 'm', 'F0')
        intento(c, 'm', 'F0', semilla=2)
        self.aceptar(c, 'm', 'F0', 1, 'F1')
        f0 = c['variantes']['m']['fases']['F0']
        intento(c, 'm', 'F1', entrada=('F0', f0['aceptada']))
        self.aceptar(c, 'm', 'F1', 1, 'F2')
        intento(c, 'm', 'F2', entrada=('F1', 'm-f1-1.png'))
        self.aceptar(c, 'm', 'F2', 1, 'F4')
        fases = c['variantes']['m']['fases']
        self.assertFalse(any(f['desfasada'] for f in fases.values()))
        # atrás hasta F0 y aceptar otra imagen: F1 (otra entrada) y F2 (cuelga de F1) quedan desfasadas
        C.atras(c, 'm'); C.atras(c, 'm'); C.atras(c, 'm')
        self.assertEqual(c['variantes']['m']['faseActual'], 'F0')
        intento(c, 'm', 'F0', semilla=9)
        self.aceptar(c, 'm', 'F0', 3, 'F1')
        self.assertTrue(fases['F1']['desfasada'] and fases['F2']['desfasada'])
        self.assertFalse(fases['F0']['desfasada'])

    def test_regenerar_fase_desfasada_parte_de_la_nueva_entrada(self):
        c = C.vacio()
        intento(c, 'macho', 'F0'); intento(c, 'macho', 'F0', prompt='otro')
        self.aceptar(c, 'macho', 'F0', 1, 'F1')
        intento(c, 'macho', 'F1', entrada=('F0', 'macho-f0-1.png'))
        self.aceptar(c, 'macho', 'F1', 1, 'F2')
        C.atras(c, 'macho'); C.atras(c, 'macho')
        intento(c, 'macho', 'F0', prompt='tercero')
        self.aceptar(c, 'macho', 'F0', 3, 'F1')
        f1 = c['variantes']['macho']['fases']['F1']
        self.assertTrue(f1['desfasada'])
        # la F0 vieja sigue en disco: la F1 desfasada parte de ella (regla 3: lo guardado se queda)
        self.assertTrue(os.path.exists(os.path.join(self.d, 'intentos', 'macho-f0-1.png')))
        intento(c, 'macho', 'F1', entrada=('F0', 'macho-f0-3.png'))
        self.aceptar(c, 'macho', 'F1', 2, 'F2')
        self.assertEqual((f1['entrada'], f1['desfasada']), ('macho-f0-3.png', False))
        # la F1 vieja (desde macho-f0-1) no la usa nadie: se borra al aceptar la nueva
        self.assertFalse(os.path.exists(os.path.join(self.d, 'intentos', 'macho-f1-1.png')))

    def test_atras(self):
        c = C.vacio()
        intento(c, 'm', 'F0')
        with self.assertRaisesRegex(C.CaminoInvalido, 'No hay fase anterior a F0'):
            C.atras(c, 'm')
        self.aceptar(c, 'm', 'F0', 1, 'F1')
        C.atras(c, 'm')   # F1 sin registro: la anterior con aceptada
        self.assertEqual(c['variantes']['m']['faseActual'], 'F0')
        self.aceptar(c, 'm', 'F0', 1, 'F4')
        intento(c, 'm', 'F4', entrada=('F0', 'm-f0-1.png'))
        C.atras(c, 'm')   # F4 con registro: su `desde`
        self.assertEqual(c['variantes']['m']['faseActual'], 'F0')

    def test_semilla_por_defecto(self):
        c = C.vacio()
        self.assertEqual(C.semilla_por_defecto({}, 'F0', 'a'), 3)
        intento(c, 'm', 'F0', 'a', 7)
        v = c['variantes']['m']
        self.assertEqual(C.semilla_por_defecto(v, 'F0', 'a'), 8)      # mismo prompt: una no usada
        self.assertEqual(C.semilla_por_defecto(v, 'F0', 'b'), 7)      # prompt nuevo: la del último intento
        with self.assertRaisesRegex(C.CaminoInvalido, 'Falta una fase aceptada .F0.'):
            C.semilla_por_defecto(v, 'F1', 'a')
        self.aceptar(c, 'm', 'F0', 1, 'F1')
        self.assertEqual(C.semilla_por_defecto(v, 'F1', 'a'), 7)      # primer intento: la aceptada de la entrada
        intento(c, 'm', 'F0', 'a', 12)
        self.assertEqual(C.semilla_por_defecto(v, 'F0', 'a'), 13)

    def test_migracion_elegidas(self):
        escribir(os.path.join(self.d, 'elegidas.tsv'), 'a\tx/1.png\nb\tx/2.png\nc\tx/1.png\n')
        c = C.leer(self.d)
        self.assertEqual([m['imagen'] for m in c['marcadas']], ['x/1.png', 'x/2.png'])
        self.assertTrue(all(m['migrada'] and m['variante'] is None for m in c['marcadas']))
        self.assertEqual((c['nombre'], c['variantes']), ('', {}))

    def test_actualizar_concurrente(self):
        def hilo():
            for _ in range(10):
                C.actualizar(self.d, lambda c: intento(c, 'm', 'F0'))
        hs = [threading.Thread(target=hilo) for _ in range(4)]
        [h.start() for h in hs]; [h.join() for h in hs]
        ns = [i['n'] for i in C.leer(self.d)['variantes']['m']['fases']['F0']['intentos']]
        self.assertEqual(sorted(ns), list(range(1, 41)))


class TestFasePy(unittest.TestCase):
    def setUp(self):
        self.raiz = carpeta()
        self.gen = os.path.join(self.raiz, 'falso', 'generar.sh')
        escribir(self.gen, GENERAR_FALSO)
        self.args = os.path.join(self.raiz, 'args.txt')
        self.prompt = os.path.join(self.raiz, 'prompt.txt')
        escribir(self.prompt, 'un mono rojo')
        self.d = os.path.join(self.raiz, 'generated', 'fauna', 'aullador')

    def fase(self, fase, tipo='fauna', variante='macho', extra_env=None, semilla=None):
        env = {**os.environ, 'IMG_RAIZ': self.raiz, 'IMG_GENERAR': self.gen, 'ARGS_GENERAR': self.args,
               'PERFIL': 'viejo', 'BOCETO': '/viejo.png', 'MOMENTO': 'noche', **(extra_env or {})}
        cmd = [sys.executable, FASE, tipo, 'aullador', variante, fase, self.prompt] + ([str(semilla)] if semilla else [])
        return subprocess.run(cmd, env=env, capture_output=True, text=True)

    def llamada(self):
        return leer(self.args).split('\n')

    def aceptar(self, fase, n, sig):
        C.actualizar(self.d, lambda c: C.avanzar(self.d, c, 'macho', fase, n, sig, 'fauna'))

    def test_f0(self):
        r = self.fase('F0')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        a = self.llamada()
        self.assertEqual(a[:7], [self.d, 'macho-f0-1', a[2], '480', '192', '3', '4'])
        self.assertIn('PERFIL=<sin>', a); self.assertIn('BOCETO=<sin>', a); self.assertIn('PROMPT=un mono rojo', a)
        self.assertIn(f'imagen: {self.d}/intentos/macho-f0-1.png', r.stdout)
        f = C.leer(self.d)['variantes']['macho']['fases']['F0']
        i = f['intentos'][0]
        self.assertEqual((i['n'], i['prompt'], i['semilla'], i['imagen']), (1, 'un mono rojo', 3, 'macho-f0-1.png'))
        self.assertEqual(C.leer(self.d)['variantes']['macho']['faseActual'], 'F0')

    def test_recetas_f1_f2_f4(self):
        self.assertEqual(self.fase('F0').returncode, 0)
        self.aceptar('F0', 1, 'F1')
        r = self.fase('F1')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        a = self.llamada()
        self.assertEqual(a[1:7], ['macho-f1-1', a[2], '640', '256', '3', '8'])
        self.assertEqual(a[7:9], ['--image-preprocess', 'target=init,filter=lanczos,antialias=true'])
        self.assertIn('PERFIL=fotorreal', a); self.assertIn('FUERZA_BOCETO=0.88', a)
        self.assertIn(f'BOCETO={self.d}/intentos/macho-f0-1.png', a)
        self.aceptar('F1', 1, 'F2')
        self.assertEqual(self.fase('F2').returncode, 0)
        a = self.llamada()
        self.assertEqual(a[3:7], ['960', '384', '3', '16'])
        self.assertIn('FUERZA_BOCETO=0.50', a); self.assertIn(f'BOCETO={self.d}/intentos/macho-f1-1.png', a)
        self.assertIn('target=init,filter=lanczos,antialias=true', a)
        self.aceptar('F2', 1, 'F4')
        self.assertEqual(self.fase('F4', tipo='fauna').returncode, 0)
        a = self.llamada()
        self.assertEqual(a[3:7], ['1280', '512', '3', '4'])
        self.assertEqual(a[7:11], ['-r', f'{self.d}/intentos/macho-f2-1.png', '--ref-image-args', 'vae_input_max_pixels=262144'])
        self.assertIn('PERFIL=<sin>', a); self.assertIn('TOPE=1800', a); self.assertIn('BOCETO=<sin>', a)
        self.assertTrue(any(l.startswith('PROMPT=The same creature, in the same composition, as the reference image, '
                                         'which is a rough study: keep its shapes and proportions and render it '
                                         'with full detail. un mono rojo') for l in a))
        self.assertEqual(C.leer(self.d)['variantes']['macho']['fases']['F4']['intentos'][0]['prompt'], 'un mono rojo')

    def test_f4_cosa_por_tipo_y_desde_f0(self):
        d = os.path.join(self.raiz, 'generated', 'flora', 'aullador')
        self.assertEqual(self.fase('F0', tipo='flora').returncode, 0)
        C.actualizar(d, lambda c: C.avanzar(d, c, 'macho', 'F0', 1, 'F4', 'flora'))
        self.assertEqual(self.fase('F4', tipo='flora').returncode, 0)
        a = self.llamada()
        self.assertIn('-r', a); self.assertIn(f'{d}/intentos/macho-f0-1.png', a)
        self.assertTrue(any(l.startswith('PROMPT=The same plant,') for l in a))

    def test_fallo_se_apunta_sin_imagen(self):
        r = self.fase('F0', extra_env={'FALLA': '1'})
        self.assertEqual(r.returncode, 1)
        self.assertNotIn('imagen:', r.stdout)
        i = C.leer(self.d)['variantes']['macho']['fases']['F0']['intentos'][0]
        self.assertIsNone(i['imagen'])
        self.assertEqual(i['salida'], 1)
        self.assertIn('boom: sin memoria', i['error'])

    def test_semilla_explicita_y_reintento(self):
        self.assertEqual(self.fase('F0', semilla=77).returncode, 0)
        self.assertEqual(self.llamada()[5], '77')
        self.assertEqual(self.fase('F0').returncode, 0)  # mismo prompt: una no usada
        self.assertEqual(self.llamada()[5], '78')
        self.assertEqual(self.llamada()[1], 'macho-f0-2')

    def test_f1_sin_f0_aceptada(self):
        r = self.fase('F1')
        self.assertEqual(r.returncode, 3)
        self.assertIn('ABORTO: Falta una fase aceptada (F0) para generar F1 Forma', r.stdout)
        self.assertFalse(os.path.exists(self.args))

    def test_f3_y_argumentos(self):
        r = self.fase('F3')
        self.assertEqual(r.returncode, 2)
        self.assertIn('F3 Recorte llega con IMG-37', r.stdout)
        r = self.fase('F0', variante='../x')
        self.assertEqual(r.returncode, 2)
        self.assertIn('no es un tipo, slug o variante válido', r.stdout)
        r = self.fase('F9')
        self.assertEqual((r.returncode, 'fase desconocida: F9' in r.stdout), (2, True))

    def test_falta_archivo_de_prompt(self):
        os.remove(self.prompt)
        r = self.fase('F0')
        self.assertEqual(r.returncode, 3)
        self.assertIn('no se puede leer el archivo de prompt', r.stdout)


if __name__ == '__main__':
    unittest.main()
