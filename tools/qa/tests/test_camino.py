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


class TestRenombrarBorrarMarcar(unittest.TestCase):
    """IMG-25 (parte 2): renombrar, borrar lo guardado de una fase y marcar ★."""

    def setUp(self):
        self.d = carpeta()

    def existe(self, nombre):
        return os.path.exists(os.path.join(self.d, 'intentos', nombre))

    def camino_completo(self, variante='m'):
        """F0 (2 intentos, acepta el 1) -> F1 (1 intento, aceptado) -> F4 (2 intentos); F4 desde F1."""
        c = C.vacio()
        intento(c, variante, 'F0', 'p0a', 3)
        intento(c, variante, 'F0', 'p0b', 4)
        con_imagenes(self.d, c, variante, 'F0')
        C.avanzar(self.d, c, variante, 'F0', 1, 'F1', 'fauna')
        intento(c, variante, 'F1', 'p1', 3, entrada=('F0', f'{variante}-f0-1.png'))
        con_imagenes(self.d, c, variante, 'F1')
        C.avanzar(self.d, c, variante, 'F1', 1, 'F4', 'fauna')
        intento(c, variante, 'F4', 'p4a', 3, entrada=('F1', f'{variante}-f1-1.png'))
        intento(c, variante, 'F4', 'p4b', 4, entrada=('F1', f'{variante}-f1-1.png'))
        con_imagenes(self.d, c, variante, 'F4')
        return c

    def test_renombrar_recorta_valida_y_no_toca_la_carpeta(self):
        c = C.vacio()
        self.assertEqual(C.renombrar(c, '  Oso de nieve  '), 'Oso de nieve')
        self.assertEqual(c['nombre'], 'Oso de nieve')
        for malo, motivo in (('   ', 'El nombre está vacío'), (None, 'El nombre está vacío'),
                             ('x' * 121, 'demasiado largo: 120')):
            with self.assertRaisesRegex(C.CaminoInvalido, motivo):
                C.renombrar(c, malo)
        self.assertEqual(c['nombre'], 'Oso de nieve', 'un nombre inválido no cambia el anterior')
        C.renombrar(c, 'x' * 120)

    def test_tramo_sigue_la_cadena_de_desde(self):
        c = self.camino_completo()
        v = c['variantes']['m']
        self.assertEqual(C.tramo(v, 'F0'), ['F0', 'F1', 'F4'])
        self.assertEqual(C.tramo(v, 'F1'), ['F1', 'F4'])
        self.assertEqual(C.tramo(v, 'F4'), ['F4'])
        with self.assertRaisesRegex(C.CaminoInvalido, 'Fase desconocida: F9'):
            C.tramo(v, 'F9')

    def test_borrar_f1_deja_f0_y_cuelga_la_final(self):
        c = self.camino_completo()
        C.marcar(c, 'm', 1, True)
        self.assertEqual(C.dependientes(c, 'm', 'F1'), {'fases': ['F1', 'F4'], 'marcadas': ['m-f4-1.png'], 'variantes': []})
        C.borrar_fase(self.d, c, 'm', 'F1')
        v = c['variantes']['m']
        self.assertEqual(v['fases']['F0']['aceptada'], 'm-f0-1.png', 'la fase de fuera del tramo se conserva')
        self.assertTrue(self.existe('m-f0-1.png'))
        for f in ('F1', 'F4'):
            r = v['fases'][f]
            self.assertEqual((r['aceptada'], r['prompt'], r['semilla'], r['desfasada']), (None, None, None, False))
            self.assertTrue(all(i['imagen'] is None for i in r['intentos']))
        self.assertEqual([(i['prompt'], i['semilla']) for i in v['fases']['F4']['intentos']], [('p4a', 3), ('p4b', 4)])
        self.assertFalse(self.existe('m-f1-1.png') or self.existe('m-f4-1.png') or self.existe('m-f4-2.png'))
        self.assertEqual(v['faseActual'], 'F0', 'faseActual estaba en F4, dentro del tramo: pasa a la fase desde de F1')
        self.assertEqual(c['marcadas'], [], 'la ★ se va con la imagen')

    def test_borrar_f0_arrastra_todo_y_vuelve_a_f0(self):
        c = self.camino_completo()
        C.borrar_fase(self.d, c, 'm', 'F0')
        v = c['variantes']['m']
        self.assertEqual(sorted(os.listdir(os.path.join(self.d, 'intentos'))), [])
        self.assertEqual(v['faseActual'], 'F0')
        self.assertTrue(all(r['aceptada'] is None for r in v['fases'].values()))
        self.assertEqual(len(v['fases']['F0']['intentos']), 2, 'los intentos y sus prompts se quedan')
        # el camino sigue funcionando: F1 ya no tiene fase de entrada aceptada
        with self.assertRaisesRegex(C.CaminoInvalido, 'Falta una fase aceptada'):
            C.fase_de_entrada({'fases': v['fases']}, 'F1')

    def test_borrar_la_final_deja_las_anteriores_y_quita_solo_sus_estrellas(self):
        c = self.camino_completo()
        c['marcadas'].append({'imagen': 'viejo.png', 'variante': None, 'pautasVersion': None, 'migrada': True})
        C.marcar(c, 'm', 1, True)
        C.marcar(c, 'm', 2, True)
        C.borrar_fase(self.d, c, 'm', 'F4')
        v = c['variantes']['m']
        self.assertEqual((v['faseActual'], v['fases']['F1']['aceptada']), ('F1', 'm-f1-1.png'))
        self.assertEqual([m['imagen'] for m in c['marcadas']], ['viejo.png'], 'las migradas (variante None) se quedan')

    def test_borrar_lo_ya_borrado_dice_que_no_hay_nada(self):
        c = self.camino_completo()
        C.borrar_fase(self.d, c, 'm', 'F0')
        with self.assertRaisesRegex(C.CaminoInvalido, 'No hay nada guardado en esta fase'):
            C.borrar_fase(self.d, c, 'm', 'F0')
        self.assertEqual(len(c['variantes']['m']['fases']['F0']['intentos']), 2)

    def test_borrar_la_entrada_de_una_fase_sin_lanzar_no_deja_el_elemento_atascado(self):
        c = self.camino_completo()
        v = c['variantes']['m']
        del v['fases']['F1'], v['fases']['F4']
        v['faseActual'] = 'F1'  # aceptada F0, pero F1 no se llegó a lanzar (el generador estaba ocupado)
        C.borrar_fase(self.d, c, 'm', 'F0')
        self.assertEqual(v['faseActual'], 'F0', 'sin entrada aceptada, F1 ni se genera ni tiene fase a la que volver')

    def test_borrar_otra_rama_no_mueve_una_fase_sin_lanzar_que_aun_tiene_entrada(self):
        c = self.camino_completo()
        v = c['variantes']['m']
        v['faseActual'] = 'F2'  # aceptada F1, F2 sin lanzar; la Final que sale de F1 se borra aparte
        C.borrar_fase(self.d, c, 'm', 'F4')
        self.assertEqual(v['faseActual'], 'F2')

    def test_borrar_sin_nada_guardado_dice_por_que(self):
        c = C.vacio()
        with self.assertRaisesRegex(C.CaminoInvalido, 'La variante m no existe'):
            C.borrar_fase(self.d, c, 'm', 'F0')
        intento(c, 'm', 'F0')
        with self.assertRaisesRegex(C.CaminoInvalido, 'No hay nada guardado en esta fase'):
            C.borrar_fase(self.d, c, 'm', 'F1')
        with self.assertRaisesRegex(C.CaminoInvalido, 'Fase desconocida: F9'):
            C.borrar_fase(self.d, c, 'm', 'F9')

    def test_no_se_borra_la_imagen_que_usa_otra_fase_u_otra_variante(self):
        c = self.camino_completo()
        v = c['variantes']['m']
        # una fase de fuera del tramo (F2, que no cuelga de F1 por desde) parte de la F1 aceptada
        v['fases']['F2'] = {'aceptada': None, 'prompt': None, 'semilla': None, 'desde': None, 'entrada': 'm-f1-1.png',
                            'desfasada': False, 'intentos': []}
        # y otra variante parte de la F4 1
        c['variantes']['o'] = {'origen': None, 'faseActual': 'F4', 'fases': {'F4': {
            'aceptada': 'm-f4-1.png', 'prompt': 'x', 'semilla': 1, 'desde': None, 'entrada': None, 'desfasada': False, 'intentos': []}}}
        C.marcar(c, 'm', 1, True)
        self.assertEqual(C.dependientes(c, 'm', 'F1')['marcadas'], [], 'la ★ protegida no se pierde')
        C.borrar_fase(self.d, c, 'm', 'F1')
        self.assertTrue(self.existe('m-f1-1.png'), 'la usa la entrada de F2')
        self.assertTrue(self.existe('m-f4-1.png'), 'la usa otra variante')
        self.assertFalse(self.existe('m-f4-2.png'))
        f1, f4 = v['fases']['F1']['intentos'][0], v['fases']['F4']['intentos']
        self.assertEqual((f1['imagen'], f4[0]['imagen'], f4[1]['imagen']), ('m-f1-1.png', 'm-f4-1.png', None))
        self.assertEqual([m['imagen'] for m in c['marcadas']], ['m-f4-1.png'])

    def test_dependientes_cuenta_las_variantes_que_nacen_del_tramo(self):
        c = self.camino_completo()
        c['variantes']['hija'] = {'origen': {'variante': 'm', 'fase': 'F1'}, 'faseActual': 'F1', 'fases': {}}
        c['variantes']['otra'] = {'origen': {'variante': 'm', 'fase': 'F0'}, 'faseActual': 'F0', 'fases': {}}
        c['variantes']['suelta'] = {'origen': None, 'faseActual': 'F0', 'fases': {}}
        self.assertEqual(C.dependientes(c, 'm', 'F1')['variantes'], ['hija'])
        self.assertEqual(sorted(C.dependientes(c, 'm', 'F0')['variantes']), ['hija', 'otra'])
        self.assertEqual(C.dependientes(c, 'm', 'F4')['variantes'], [])

    def test_intento_desfasado(self):
        c = self.camino_completo()
        v = c['variantes']['m']
        f4 = v['fases']['F4']['intentos']
        self.assertFalse(C.intento_desfasado(v, 'F4', f4[0]))
        self.assertFalse(C.intento_desfasado(v, 'F4', 2), 'también por número')
        self.assertFalse(C.intento_desfasado(v, 'F0', v['fases']['F0']['intentos'][0]), 'sin desde no hay de qué desfasarse')
        intento(c, 'm', 'F1', 'otra', 9, entrada=('F0', 'm-f0-1.png'))
        con_imagenes(self.d, c, 'm', 'F1')
        C.avanzar(self.d, c, 'm', 'F1', 2, 'F4', 'fauna')  # acepta otro boceto de F1
        self.assertTrue(C.intento_desfasado(v, 'F4', f4[0]))

    def test_marcar_dos_quitar_y_sin_duplicar(self):
        c = self.camino_completo()
        C.marcar(c, 'm', 1, True)
        C.marcar(c, 'm', 1, True)
        C.marcar(c, 'm', 2, True)
        self.assertEqual(c['marcadas'], [{'imagen': 'm-f4-1.png', 'variante': 'm', 'pautasVersion': None},
                                         {'imagen': 'm-f4-2.png', 'variante': 'm', 'pautasVersion': None}])
        f4 = c['variantes']['m']['fases']['F4']
        self.assertEqual((f4['aceptada'], f4['prompt'], f4['semilla']), ('m-f4-2.png', 'p4b', 4))
        C.marcar(c, 'm', 1, False)
        self.assertEqual([m['imagen'] for m in c['marcadas']], ['m-f4-2.png'])
        self.assertEqual(f4['aceptada'], 'm-f4-2.png', 'quitar la ★ no cambia la aceptada')
        C.marcar(c, 'm', 1, False)  # quitar la que no está no falla

    def test_marcar_rechaza_con_su_motivo(self):
        c = self.camino_completo()
        intento(c, 'm', 'F4', 'fallo', 5, ok=False, entrada=('F1', 'm-f1-1.png'))
        con_marca = {'imagen': 'a.png', 'variante': None, 'pautasVersion': None, 'migrada': True}
        c['marcadas'].append(con_marca)
        casos = (('m', 3, 'falló o ya no tiene imagen'), ('m', 9, 'No existe el intento 9 de F4 en m'),
                 ('nadie', 1, 'La variante nadie no existe'))
        for variante, n, motivo in casos:
            with self.subTest(n=n):
                with self.assertRaisesRegex(C.CaminoInvalido, motivo):
                    C.marcar(c, variante, n, True)
        c2 = C.vacio()
        intento(c2, 'm', 'F0')
        with self.assertRaisesRegex(C.CaminoInvalido, 'Solo se marca ★ en la Final'):
            C.marcar(c2, 'm', 1, True)
        self.assertEqual(c['marcadas'], [con_marca])

    def test_marcar_una_final_desfasada_se_rechaza_con_el_mensaje(self):
        c = self.camino_completo()
        intento(c, 'm', 'F1', 'otra', 9, entrada=('F0', 'm-f0-1.png'))
        con_imagenes(self.d, c, 'm', 'F1')
        C.avanzar(self.d, c, 'm', 'F1', 2, 'F4', 'fauna')
        with self.assertRaises(C.CaminoInvalido) as cm:
            C.marcar(c, 'm', 1, True)
        self.assertEqual(str(cm.exception), 'Esta Final salió de un boceto que ya no es el aceptado: genera otra')
        self.assertEqual(c['marcadas'], [])
        # quitarla sí se puede, y una Final nueva desde el boceto aceptado se marca
        C.marcar(c, 'm', 1, False)
        intento(c, 'm', 'F4', 'nueva', 7, entrada=('F1', 'm-f1-2.png'))
        con_imagenes(self.d, c, 'm', 'F4')
        C.marcar(c, 'm', 3, True)
        self.assertEqual([m['imagen'] for m in c['marcadas']], ['m-f4-3.png'])


class TestFasePy(unittest.TestCase):
    def setUp(self):
        self.raiz = carpeta()
        self.gen = os.path.join(self.raiz, 'falso', 'generar.sh')
        escribir(self.gen, GENERAR_FALSO)
        self.args = os.path.join(self.raiz, 'args.txt')
        self.prompt = os.path.join(self.raiz, 'prompt.txt')
        escribir(self.prompt, 'un mono rojo')
        self.d = os.path.join(self.raiz, 'generated', 'fauna', 'aullador')

    def fase(self, fase, tipo='fauna', variante='macho', extra_env=None, semilla=None, extra=()):
        env = {**os.environ, 'IMG_RAIZ': self.raiz, 'IMG_GENERAR': self.gen, 'ARGS_GENERAR': self.args,
               'PERFIL': 'viejo', 'BOCETO': '/viejo.png', 'MOMENTO': 'noche', **(extra_env or {})}
        cmd = [sys.executable, FASE, tipo, 'aullador', variante, fase, self.prompt] + ([str(semilla)] if semilla else []) + list(extra)
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

    def juego(self):
        ruta = os.path.join(self.raiz, 'juego', 'aullador-banner.png')
        escribir(ruta, 'png')
        return ruta

    def test_referencia_en_f0_va_como_r_con_limite_y_se_apunta(self):
        ruta = self.juego()
        self.assertEqual(self.fase('F0', extra=['--referencia', ruta]).returncode, 0)
        a = self.llamada()
        self.assertIn(ruta, a)
        self.assertEqual(a[a.index(ruta) - 1], '-r')
        self.assertIn('vae_input_max_pixels=262144', a)
        self.assertIn('TOPE=1800', a)
        self.assertTrue(any(l == 'PROMPT=The reference image shows this creature: follow its colors and materials. un mono rojo' for l in a))
        i = C.leer(self.d)['variantes']['macho']['fases']['F0']['intentos'][0]
        self.assertEqual((i['referencia'], i['prompt']), ('aullador-banner.png', 'un mono rojo'))

    def test_referencia_en_f1_no_baja_el_tope_de_fotorreal(self):
        ruta = self.juego()
        self.assertEqual(self.fase('F0').returncode, 0)
        self.aceptar('F0', 1, 'F1')
        self.assertEqual(self.fase('F1', extra=['--referencia', ruta]).returncode, 0)
        a = self.llamada()
        self.assertIn('TOPE=<sin>', a)
        self.assertIn(f'BOCETO={self.d}/intentos/macho-f0-1.png', a)
        self.assertEqual(a[a.index(ruta) - 1], '-r')

    def test_sin_casilla_no_cambia_nada(self):
        self.assertEqual(self.fase('F0').returncode, 0)
        a = self.llamada()
        self.assertNotIn('-r', a)
        self.assertIn('PROMPT=un mono rojo', a)
        self.assertNotIn('referencia', C.leer(self.d)['variantes']['macho']['fases']['F0']['intentos'][0])

    def test_referencia_en_la_final_va_detras_del_boceto_y_el_prompt_dice_cual_es_cual(self):
        ruta = self.juego()
        self.assertEqual(self.fase('F0').returncode, 0)
        self.aceptar('F0', 1, 'F4')
        self.assertEqual(self.fase('F4', extra=['--referencia', ruta]).returncode, 0)
        a = self.llamada()
        boceto = f'{self.d}/intentos/macho-f0-1.png'
        self.assertEqual([a[k + 1] for k, x in enumerate(a) if x == '-r'], [boceto, ruta])
        self.assertEqual(a.count('--ref-image-args'), 1)
        p = next(l for l in a if l.startswith('PROMPT='))
        self.assertIn('as the first reference image', p)
        self.assertIn('The second reference image shows this creature', p)

    def test_cambiar_la_casilla_mantiene_la_semilla_para_comparar(self):
        ruta = self.juego()
        self.assertEqual(self.fase('F0').returncode, 0)
        self.assertEqual(self.fase('F0', extra=['--referencia', ruta]).returncode, 0)
        self.assertEqual(self.fase('F0', extra=['--referencia', ruta]).returncode, 0)
        ins = C.leer(self.d)['variantes']['macho']['fases']['F0']['intentos']
        self.assertEqual([i['semilla'] for i in ins], [3, 3, 4])

    def test_referencia_que_no_existe_dice_por_que(self):
        r = self.fase('F0', extra=['--referencia', '/no/esta.png'])
        self.assertEqual(r.returncode, 3)
        self.assertIn('no existe la imagen de referencia: /no/esta.png', r.stdout)

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
