"""IMG-25 (parte 1): la pantalla de fases del elemento (image-generator/interfaz/ui/js/fases.js) en un navegador sin
cabeza, con el simulador (`?mock=1&rapido=1`: 50 ms por paso). Se salta si no hay Firefox ni Chrome (WMF_TEST_BROWSER)."""
import socket
import threading
import unittest

import browser
from test_interfaz_imagenes import Base

FASE = "document.querySelector('button.paso[data-fase=%s]')"
CONTADOR = "(document.querySelector('[data-intento=contador]') || {}).textContent === '%s'"
UNA = "(() => { const s = document.getElementById('fasesSemillas'); s.value = '1'; s.dispatchEvent(new Event('change', { bubbles: true })); })()"
PONER = "(() => { const s = document.querySelector(%r); s.value = %r; s.dispatchEvent(new Event('change', { bubbles: true })); })()"
IMAGEN = "(() => { const i = document.querySelector('.marco.actual img'); return !!i && i.complete && i.naturalWidth > 0; })()"


@unittest.skipUnless(browser.find_browser(), 'sin Firefox ni Chrome (WMF_TEST_BROWSER)')
class PantallaFases(Base):
    def setUp(self):
        super().setUp()
        with socket.socket() as so:
            so.bind(('127.0.0.1', 0))
            self.puerto = so.getsockname()[1]
        pedidas = self.pedidas = []

        class Registra(self.s.Manejador):
            def do_GET(self_):
                pedidas.append(self_.path)
                return super().do_GET()
        self.srv = self.s.ThreadingHTTPServer(('127.0.0.1', self.puerto), Registra)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.addCleanup(self.srv.server_close)
        self.addCleanup(self.srv.shutdown)
        self.nav = browser.Browser()
        self.addCleanup(self.nav.close)

    def test_recorre_generar_regenerar_avanzar_por_pasos_a_la_final_y_atras(self):
        pagina = self.nav.new_page()
        self.nav.take_problems()
        pagina.goto(f'http://127.0.0.1:{self.puerto}/?mock=1&rapido=1')
        pagina.wait("document.querySelectorAll('#lista .elemento .nombre').length === 4")
        pagina.evaluate("document.querySelector('#lista .elemento').click()")
        # un elemento sin camino empieza en P1 (no en F0): P1, la Final y el recorte apagado; el prompt de la enciclopedia
        pagina.wait("!document.getElementById('fases').hidden && document.getElementById('fasesPrompt').value.startsWith('a red howler')")
        self.assertEqual(pagina.evaluate("[...document.querySelectorAll('button.paso')].map((b) => b.dataset.fase)"), ['P1', 'F4', 'F3'])
        self.assertEqual(pagina.evaluate(FASE % 'F3' + '.disabled'), True)
        self.assertIn('IMG-37', pagina.evaluate(FASE % 'F3' + '.textContent'))
        self.assertEqual(pagina.evaluate(FASE % 'P1' + ".getAttribute('aria-current')"), 'step')
        self.assertEqual(pagina.evaluate("document.querySelectorAll('#fases .tres .marco').length"), 3)
        self.assertEqual(pagina.evaluate("document.querySelector('[data-accion=regenerar]').textContent.trim().startsWith('Generar')"), True)
        self.assertEqual(pagina.evaluate("document.querySelector('[data-accion=atras]').disabled"), True)
        self.assertEqual(pagina.evaluate("[...document.querySelectorAll('[data-siguiente]')].map((b) => b.dataset.siguiente)"), ['P2', 'F4'])
        self.assertIn('Aún no hay intentos', pagina.evaluate("document.querySelector('[data-siguiente=F4]').title"))
        self.assertEqual(pagina.evaluate("document.querySelector('[data-siguiente=P2]').textContent.trim().startsWith('Añadir P2 Paso 2')"), True)
        # el motor por defecto y 2 semillas; con una, para seguir los intentos de uno en uno
        self.assertEqual(pagina.evaluate("document.getElementById('fasesMotor').value"), 'klein4b')
        self.assertEqual(pagina.evaluate("document.getElementById('fasesSemillas').value"), '2')
        pagina.evaluate(UNA)
        # Generar P1: la barra de progreso y los botones apagados mientras corre; luego el intento 1 a la vista
        pagina.evaluate("document.querySelector('[data-accion=regenerar]').click()")
        pagina.wait("!!document.querySelector('.progreso-fase') && document.querySelector('[data-accion=regenerar]').disabled")
        pagina.wait(CONTADOR % '1/1', timeout=20)
        pagina.wait(IMAGEN)
        self.assertIn('s=3 · motor klein4b ·', pagina.evaluate("document.querySelector('.marco.actual .meta').textContent"))
        # la medida junto al intento: P1 no parte de nada, así que solo color (s=3: Cb 6 ✓, Cr 7 ✓, Y 13 ✓)
        self.assertEqual(pagina.evaluate("document.querySelector('[data-medida]').textContent"), 'EMD Cb 6,0 ✓ · Cr 7,0 ✓ · Y 13,0 ✓')
        self.assertEqual(pagina.evaluate("document.querySelector('[data-accion=regenerar]').textContent.trim().startsWith('Regenerar')"), True)
        # Regenerar con el prompt sin cambios: otra semilla, y el intento nuevo a la vista
        pagina.evaluate("document.querySelector('[data-accion=regenerar]').click()")
        pagina.wait(CONTADOR % '2/2', timeout=20)
        self.assertIn('s=4 ·', pagina.evaluate("document.querySelector('.marco.actual .meta').textContent"))
        # R regenera también con la tecla (sin foco en un campo): tres intentos
        pagina.evaluate('document.activeElement.blur()')
        pagina.key('r')
        pagina.wait(CONTADOR % '3/3', timeout=20)
        # ◀ lleva al intento anterior (y ← también)
        pagina.evaluate("document.querySelector('button[aria-label=\"Intento anterior\"]').click()")
        pagina.wait(CONTADOR % '2/3')
        pagina.key('ArrowLeft')
        pagina.wait(CONTADOR % '1/3')
        self.assertIn('s=3 ·', pagina.evaluate("document.querySelector('.marco.actual .meta').textContent"))
        # Añadir el paso 2 con el primer intento: P2 se lanza y P1 queda ✓; la barra muestra P1 y P2
        pagina.evaluate("document.querySelector('[data-siguiente=P2]').click()")
        pagina.wait(FASE % 'P2' + ".getAttribute('aria-current') === 'step'")
        self.assertIn('✓', pagina.evaluate(FASE % 'P1' + '.textContent'))
        pagina.wait(CONTADOR % '1/1', timeout=20)
        pagina.wait(IMAGEN)
        self.assertEqual(pagina.evaluate("[...document.querySelectorAll('button.paso')].map((b) => b.dataset.fase)"), ['P1', 'P2', 'F4', 'F3'])
        self.assertEqual(pagina.evaluate("[...document.querySelectorAll('[data-siguiente]')].map((b) => b.dataset.siguiente)"), ['P3', 'F4'])
        self.assertIn('Aceptada en P1 Paso 1', pagina.evaluate("document.querySelector('#fases .tres .marco:nth-child(2) h3').textContent"))
        # la Final trae el prompt corto de estilo (no el «cambia solo esto» del paso) y elige motor, pero sin semillas
        pagina.evaluate("document.querySelector('[data-siguiente=F4]').click()")
        pagina.wait(FASE % 'F4' + ".getAttribute('aria-current') === 'step'")
        pagina.wait(CONTADOR % '1/1', timeout=20)
        pagina.wait(IMAGEN)
        self.assertTrue(pagina.evaluate("document.getElementById('fasesPrompt').value.startsWith('The same figure, in the same composition')"))
        self.assertEqual(pagina.evaluate("document.querySelector('.marco.actual .meta').textContent.includes('motor klein4b')"), True)
        self.assertEqual(pagina.evaluate("!!document.getElementById('fasesMotor') && !document.getElementById('fasesSemillas')"), True)
        self.assertEqual(pagina.evaluate("document.querySelectorAll('[data-siguiente]').length"), 0)
        self.assertEqual(pagina.evaluate("document.querySelector('[data-accion=marcar]').disabled"), False)
        self.assertIn('Aceptada en P2 Paso 2', pagina.evaluate("document.querySelector('#fases .tres .marco:nth-child(2) h3').textContent"))
        # pulsar P1 ya hecho enseña lo guardado en modo lectura, y se vuelve a la fase actual
        pagina.evaluate(FASE % 'P1' + '.click()')
        pagina.wait("!!document.querySelector('.lectura')")
        self.assertIn('s=3', pagina.evaluate("document.querySelector('.lectura .meta').textContent"))
        pagina.evaluate("document.querySelector('.lectura button').click()")
        pagina.wait("!document.querySelector('.lectura') && !!document.querySelector('.tres')")
        # Atrás: P2 vuelve a ser el actual
        pagina.evaluate("document.querySelector('[data-accion=atras]').click()")
        pagina.wait(FASE % 'P2' + ".getAttribute('aria-current') === 'step'")
        self.assertEqual(pagina.evaluate("document.querySelector('[data-accion=atras]').disabled"), False)
        self.assertEqual([p for p in self.pedidas if p.startswith('/api/')], [])
        self.assertEqual(self.nav.take_problems(), [])
        pagina.ws.close()

    def test_motor_semillas_y_referencias_con_rol_van_en_la_peticion(self):
        pagina = self.nav.new_page()
        self.nav.take_problems()
        pagina.goto(f'http://127.0.0.1:{self.puerto}/?mock=1&rapido=1')
        pagina.wait("document.querySelectorAll('#lista .elemento .nombre').length === 4")
        pagina.evaluate("window.__m = import('/ui/mock/api-mock.js').then((m) => { window.__t = m.transport; })")
        abrir = "[...document.querySelectorAll('#lista .elemento')].find((e) => e.textContent.includes('%s')).click()"
        pagina.evaluate(abrir % 'Aullador')
        pagina.wait("!!document.getElementById('fasesMotor')")
        # los motores del servidor: el que no está completo sale apagado con lo que le falta; las estimaciones, con «~»
        motores = pagina.evaluate("[...document.querySelectorAll('#fasesMotor option')].map((o) => [o.value, o.textContent, o.disabled, o.title])")
        por_id = {m[0]: m for m in motores}
        self.assertEqual([m[0] for m in motores], ['klein4b', 'klein9b', 'klein9b-consistencia', 'qwen-edit', 'longcat', 'flux3'])
        self.assertEqual(por_id['klein4b'][1:3], ['FLUX.2 klein 4B · 40 s', False])
        self.assertIn('~80 s', por_id['klein9b'][1])
        self.assertEqual(por_id['qwen-edit'][2], True)
        self.assertIn('qwen-image-edit-2511-Q3_K_S.gguf', por_id['qwen-edit'][3])
        self.assertIn('no disponible', por_id['qwen-edit'][1])
        self.assertIn('falta modelos/diffusion/longcat', pagina.evaluate("document.getElementById('fasesMotorAyuda').textContent"))
        # klein9b, 2 semillas por defecto, y una referencia «estilo» con la imagen del juego
        pagina.evaluate(PONER % ('#fasesMotor', 'klein9b'))
        self.assertIn('~160 s en total', pagina.evaluate("document.getElementById('fasesMotorAyuda').textContent"))
        pagina.evaluate("document.querySelector('[data-accion=anadir-ref]').click()")
        pagina.wait("!!document.querySelector('[data-ref=\"0\"]')")
        self.assertEqual(pagina.evaluate("document.querySelector('[data-campo=ref-imagen]').value"), 'fauna/aullador-rojo-banner.png')
        pagina.evaluate(PONER % ('[data-campo=ref-rol]', 'estilo'))
        pagina.evaluate("document.querySelector('[data-accion=regenerar]').click()")
        pagina.wait(CONTADOR % '2/2', timeout=20)
        meta = pagina.evaluate("document.querySelector('.marco.actual .meta').textContent")
        self.assertIn('s=4 · motor klein9b', meta)
        self.assertIn('con 1 referencia', meta)
        camino = pagina.evaluate("window.__t('GET', '/api/camino?tipo=fauna&slug=aullador-rojo').then((r) => r.json.variantes.base.fases.P1.intentos)")
        self.assertEqual([(i['semilla'], i['motor'], i['referencias']) for i in camino],
                         [(3, 'klein9b', [{'rol': 'estilo', 'imagen': 'fauna/aullador-rojo-banner.png'}]),
                          (4, 'klein9b', [{'rol': 'estilo', 'imagen': 'fauna/aullador-rojo-banner.png'}])])
        # el motor se recuerda en el elemento: otro elemento y vuelta
        pagina.evaluate(abrir % 'Llanos')
        pagina.wait("document.getElementById('fasesPrompt').value === 'ash plains at dusk' && document.getElementById('fasesMotor').value === 'klein4b'")
        pagina.evaluate(abrir % 'Aullador')
        pagina.wait("!!document.getElementById('fasesMotor') && document.getElementById('fasesMotor').value === 'klein9b'")
        # Añadir el paso 2 lleva el motor, las 2 semillas y la referencia; y «fijar como ancla» añade el aceptado como «sujeto»
        pagina.evaluate("document.querySelector('[data-siguiente=P2]').click()")
        pagina.wait(FASE % 'P2' + ".getAttribute('aria-current') === 'step'")
        pagina.wait(CONTADOR % '2/2', timeout=20)
        meta = pagina.evaluate("document.querySelector('.marco.actual .meta').textContent")
        self.assertIn('motor klein9b', meta)
        self.assertIn('con 1 referencia', meta)
        self.assertEqual(pagina.evaluate("document.querySelectorAll('[data-ref]').length"), 1)
        pagina.evaluate("document.querySelector('#fases .tres .marco:nth-child(2) [data-accion=fijar-ancla]').click()")
        pagina.wait("document.querySelectorAll('[data-ref]').length === 2")
        self.assertEqual(pagina.evaluate("document.querySelector('[data-ref=\"1\"] [data-campo=ref-rol]').value"), 'sujeto')
        self.assertEqual(pagina.evaluate("document.querySelector('[data-ref=\"1\"] [data-campo=ref-imagen]').value"), 'base-p1-2.png')
        self.assertEqual(pagina.evaluate("document.querySelector('[data-accion=fijar-ancla]').disabled"), True)
        # con imagen de entrada caben 3: a la tercera se apaga «Añadir»
        pagina.evaluate("document.querySelector('[data-accion=anadir-ref]').click()")
        pagina.wait("document.querySelectorAll('[data-ref]').length === 3")
        self.assertEqual(pagina.evaluate("document.querySelector('[data-accion=anadir-ref]').disabled"), True)
        self.assertIn('Como mucho 3', pagina.evaluate("document.querySelector('[data-accion=anadir-ref]').title"))
        pagina.evaluate("document.querySelector('[data-ref=\"2\"] button').click()")
        pagina.wait("document.querySelectorAll('[data-ref]').length === 2")
        pagina.evaluate("document.querySelector('[data-accion=regenerar]').click()")
        pagina.wait(CONTADOR % '4/4', timeout=20)
        camino = pagina.evaluate("window.__t('GET', '/api/camino?tipo=fauna&slug=aullador-rojo').then((r) => r.json.variantes.base.fases.P2.intentos)")
        self.assertEqual([len(i['referencias']) for i in camino], [1, 1, 2, 2])
        self.assertEqual(camino[3]['referencias'][1], {'rol': 'sujeto', 'imagen': 'base-p1-2.png'})
        # lo que la API rechaza (400) sale con su mensaje en un aviso: aquí, otra generación en marcha
        pagina.evaluate("window.__t('POST', '/api/fase/generar', { tipo: 'zona', slug: 'llanos-de-ceniza', variante: 'base', fase: 'P1', prompt: 'x' })")
        pagina.evaluate("document.querySelector('[data-accion=regenerar]').click()")
        pagina.wait("document.getElementById('toasts').textContent.includes('ya hay una imagen generándose')")
        self.assertEqual(pagina.evaluate("document.querySelector('#fases .notice-bad').textContent.includes('ya hay una imagen generándose')"), True)
        pagina.wait("!document.querySelector('.progreso-fase')", timeout=30)
        self.assertEqual(self.nav.take_problems(), [])
        pagina.ws.close()

    def test_una_variante_antigua_sigue_por_f0_f1_f2_sin_selector_de_motor(self):
        pagina = self.nav.new_page()
        self.nav.take_problems()
        pagina.goto(f'http://127.0.0.1:{self.puerto}/?mock=1&rapido=1')
        pagina.wait("document.querySelectorAll('#lista .elemento .nombre').length === 4")
        pagina.evaluate("window.__m = import('/ui/mock/api-mock.js').then((m) => { window.__t = m.transport; })")
        pagina.evaluate("window.__t('POST', '/api/fase/generar', { tipo: 'fauna', slug: 'aullador-rojo', variante: 'antigua', fase: 'F0', prompt: 'un aullador' })")
        pagina.wait("window.__t('GET', '/api/estado').then((r) => { window.__fin = !r.json.enMarcha; }) && window.__fin === true", timeout=30)
        pagina.evaluate("document.querySelector('#lista .elemento').click()")
        pagina.wait("!!document.querySelector('button.paso[data-fase=F0]')")
        self.assertEqual(pagina.evaluate("[...document.querySelectorAll('button.paso')].map((b) => b.dataset.fase)"), ['F0', 'F1', 'F2', 'F4', 'F3'])
        pagina.wait(CONTADOR % '1/1')
        # F0 no tiene selector de motor, ni semillas, ni referencias con rol (la API solo admite klein4b ahí)
        self.assertEqual(pagina.evaluate("!document.getElementById('fasesMotor') && !document.getElementById('fasesSemillas') && !document.querySelector('[data-campo=referencias]')"), True)
        self.assertEqual(pagina.evaluate("[...document.querySelectorAll('[data-siguiente]')].map((b) => b.dataset.siguiente)"), ['F1', 'F4'])
        self.assertEqual(pagina.evaluate("document.querySelector('[data-siguiente=F1]').textContent.trim().startsWith('Avanzar por Forma')"), True)
        pagina.evaluate("document.querySelector('[data-siguiente=F1]').click()")
        pagina.wait(FASE % 'F1' + ".getAttribute('aria-current') === 'step'")
        pagina.wait(CONTADOR % '1/1', timeout=30)
        self.assertEqual(pagina.evaluate("!document.getElementById('fasesMotor')"), True)
        self.assertNotIn('motor', pagina.evaluate("document.querySelector('.marco.actual .meta').textContent"))
        self.assertEqual(self.nav.take_problems(), [])
        pagina.ws.close()

    def test_el_prompt_propuesto_pierde_el_inicio_y_dice_de_donde_sale(self):
        pagina = self.nav.new_page()
        self.nav.take_problems()
        pagina.goto(f'http://127.0.0.1:{self.puerto}/?mock=1&rapido=1')
        pagina.wait("document.querySelectorAll('#lista .elemento .nombre').length === 4")
        abrir = "[...document.querySelectorAll('#lista .elemento')].find((e) => e.textContent.includes('%s')).click()"
        fuente = "document.getElementById('fasesPromptFuente').textContent"
        # el usado de la enciclopedia, sin «Use the reference image…»
        pagina.evaluate(abrir % 'Llanos')
        pagina.wait("document.getElementById('fasesPrompt').value !== ''")
        self.assertEqual(pagina.evaluate("document.getElementById('fasesPrompt').value"), 'ash plains at dusk')
        self.assertEqual(pagina.evaluate(fuente), 'Propuesto: el prompt con el que se hizo la imagen del juego.')
        # al editarlo deja de ser el propuesto, y al volver al mismo texto lo es otra vez
        editar = ("(() => { const p = document.getElementById('fasesPrompt'); p.value = '%s'; "
                  "p.dispatchEvent(new Event('input', { bubbles: true })); })()")
        pagina.evaluate(editar % 'otro')
        self.assertEqual(pagina.evaluate(fuente), '')
        pagina.evaluate(editar % 'ash plains at dusk')
        self.assertIn('imagen del juego', pagina.evaluate(fuente))
        # el base lo dice como base
        pagina.evaluate(abrir % 'Aullador')
        pagina.wait("document.getElementById('fasesPrompt').value.startsWith('a red howler')")
        self.assertEqual(pagina.evaluate(fuente), 'Propuesto: el prompt base de la enciclopedia.')
        # sin prompt, no se inventa una fuente
        pagina.evaluate(abrir % 'Cardo')
        pagina.wait("document.getElementById('fasesPrompt').value === ''")
        self.assertEqual(pagina.evaluate(fuente), '')
        self.assertEqual(self.nav.take_problems(), [])

    def test_casilla_de_referencia(self):
        pagina = self.nav.new_page()
        self.nav.take_problems()
        pagina.goto(f'http://127.0.0.1:{self.puerto}/?mock=1&rapido=1')
        pagina.wait("document.querySelectorAll('#lista .elemento .nombre').length === 4")
        abrir = "[...document.querySelectorAll('#lista .elemento')].find((e) => e.textContent.includes('%s')).click()"
        casilla = "document.getElementById('fasesUsarRef')"
        meta = "document.querySelector('.marco.actual .meta').textContent"
        # sin imagen del juego no hay nada que elegir
        pagina.evaluate(abrir % 'Cardo')
        pagina.wait("!document.getElementById('fases').hidden && !!document.querySelector('[data-accion=regenerar]')")
        self.assertEqual(pagina.evaluate(f'!{casilla} || !{casilla}.isConnected'), True)
        # con ella, sale desmarcada y el primer intento no la lleva
        pagina.evaluate(abrir % 'Aullador')
        pagina.wait(f"!!{casilla} && {casilla}.isConnected")
        pagina.evaluate(UNA)
        self.assertEqual(pagina.evaluate(f'{casilla}.checked'), False)
        pagina.evaluate("document.querySelector('[data-accion=regenerar]').click()")
        pagina.wait(CONTADOR % '1/1', timeout=20)
        self.assertNotIn('con referencia', pagina.evaluate(meta))
        self.assertIn('s=3 ·', pagina.evaluate(meta))
        # marcada: el intento la lleva, con la misma semilla para poder comparar, y lo cuenta «Cómo se hizo»
        pagina.evaluate(f'{casilla}.click()')
        pagina.evaluate("document.querySelector('[data-accion=regenerar]').click()")
        pagina.wait(CONTADOR % '2/2', timeout=20)
        self.assertIn('con referencia', pagina.evaluate(meta))
        self.assertIn('s=3 ·', pagina.evaluate(meta))
        self.assertEqual(pagina.evaluate(f'{casilla}.checked'), True)
        self.assertIn('con la imagen del juego (aullador-rojo-banner.png)', pagina.evaluate("document.querySelector('.como-se-hizo').textContent"))
        # Avanzar sale con lo que se ve marcado, y la casilla sigue marcada en la fase siguiente
        pagina.evaluate("document.querySelector('[data-siguiente=F4]').click()")
        pagina.wait(CONTADOR % '1/1', timeout=20)
        self.assertEqual(pagina.evaluate(FASE % 'F4' + ".getAttribute('aria-current')"), 'step')
        self.assertIn('con referencia', pagina.evaluate(meta))
        self.assertEqual(pagina.evaluate(f'{casilla}.checked'), True)
        self.assertEqual(self.nav.take_problems(), [])
        pagina.ws.close()

    def test_renombrar_marcar_estrella_borrar_y_como_se_hizo(self):
        pagina = self.nav.new_page()
        self.nav.take_problems()
        pagina.goto(f'http://127.0.0.1:{self.puerto}/?mock=1&rapido=1')
        pagina.wait("document.querySelectorAll('#lista .elemento .nombre').length === 4")
        pagina.evaluate("document.querySelector('#lista .elemento').click()")
        pagina.wait("!document.getElementById('fases').hidden && document.getElementById('fasesPrompt').value.startsWith('a red howler')")
        # renombrar: Esc cancela (sin cambiar nada); Intro guarda y la lista usa el nombre nuevo
        pagina.wait("!!document.querySelector('[data-accion=renombrar]')")
        nombre = "document.querySelector('[data-nombre=actual]').textContent"
        self.assertEqual(pagina.evaluate(nombre), 'aullador-rojo')
        pagina.evaluate("document.querySelector('[data-accion=renombrar]').click()")
        pagina.wait("document.activeElement === document.getElementById('fasesNombre')")
        pagina.evaluate("document.getElementById('fasesNombre').value = 'descartado'")
        pagina.key('Escape')
        pagina.wait("!document.getElementById('fasesNombre') && !!document.querySelector('[data-nombre=actual]')")
        self.assertEqual(pagina.evaluate(nombre), 'aullador-rojo')
        pagina.evaluate("document.querySelector('[data-accion=renombrar]').click()")
        pagina.wait("document.activeElement === document.getElementById('fasesNombre')")
        pagina.evaluate("document.getElementById('fasesNombre').value = 'Aullador carmesí'")
        pagina.key('Enter')
        pagina.wait(nombre + " === 'Aullador carmesí'")
        pagina.wait("document.querySelector('#lista .elemento .nombre').textContent.startsWith('Aullador carmesí')")
        # P1, Avanzar a la Final: «Cómo se hizo» lleva un paso en P1 y dos en la Final
        pagina.evaluate(UNA)
        pagina.evaluate("document.querySelector('[data-accion=regenerar]').click()")
        pagina.wait(CONTADOR % '1/1', timeout=20)
        pagina.wait(IMAGEN)
        COMO = "document.querySelectorAll('.marco.actual details.como-se-hizo li').length"
        self.assertEqual(pagina.evaluate(COMO), 1)
        pagina.evaluate("document.querySelector('[data-siguiente=F4]').click()")
        pagina.wait(FASE % 'F4' + ".getAttribute('aria-current') === 'step'")
        pagina.wait(CONTADOR % '1/1', timeout=20)
        pagina.wait(IMAGEN)
        self.assertEqual(pagina.evaluate(COMO), 2)
        pasos = pagina.evaluate("[...document.querySelectorAll('.marco.actual details.como-se-hizo li strong')].map((e) => e.textContent)")
        self.assertEqual(pasos, ['P1 Paso 1', 'F4 Final'])
        pagina.evaluate("document.querySelector('.como-se-hizo').open = true")
        pagina.wait("[...document.querySelectorAll('.como-se-hizo img')].every((i) => i.complete && i.naturalWidth > 0)")
        # marcar ★ con M: distintivo, botón «Quitar ★», un aviso, y la marca en la lista
        pagina.evaluate('document.activeElement.blur()')
        pagina.key('m')
        pagina.wait("document.querySelector('[data-accion=marcar]').textContent.trim().startsWith('Quitar')")
        self.assertEqual(pagina.evaluate("document.querySelector('.marco.actual .estrella').textContent"), '★')
        self.assertIn('Marcar no es publicar', pagina.evaluate("document.getElementById('toasts').textContent"))
        pagina.wait("document.querySelector('#lista .elemento .marcas .estrella').textContent === '★ 1'")
        # Atrás, otro paso aceptado: la Final vieja (con ★) se puede quitar, pero no volver a marcar
        pagina.evaluate("document.querySelector('[data-accion=atras]').click()")
        pagina.wait(FASE % 'P1' + ".getAttribute('aria-current') === 'step'")
        pagina.evaluate("document.querySelector('[data-accion=regenerar]').click()")
        pagina.wait(CONTADOR % '2/2', timeout=20)
        pagina.wait(IMAGEN)
        pagina.evaluate("document.querySelector('[data-siguiente=F4]').click()")
        pagina.wait(FASE % 'F4' + ".getAttribute('aria-current') === 'step'")
        pagina.wait(CONTADOR % '2/2', timeout=20)
        pagina.wait(IMAGEN)
        pagina.evaluate('document.activeElement.blur()')
        pagina.key('ArrowLeft')
        pagina.wait(CONTADOR % '1/2')
        self.assertEqual(pagina.evaluate("!!document.querySelector('.marco.actual .estrella')"), True)
        pagina.key('m')  # quitar la ★ de la vieja
        pagina.wait("document.querySelector('[data-accion=marcar]').textContent.trim().startsWith('Marcar')")
        self.assertEqual(pagina.evaluate("document.querySelector('[data-accion=marcar]').disabled"), True)
        self.assertIn('ya no es el aceptado', pagina.evaluate("document.querySelector('[data-accion=marcar]').title"))
        pagina.key('m')  # desfasada: no hace nada
        self.assertEqual(pagina.evaluate("!!document.querySelector('.marco.actual .estrella')"), False)
        pagina.key('ArrowRight')
        pagina.wait(CONTADOR % '2/2')
        self.assertEqual(pagina.evaluate("document.querySelector('[data-accion=marcar]').disabled"), False)
        pagina.key('m')
        pagina.wait("document.querySelector('[data-accion=marcar]').textContent.trim().startsWith('Quitar')")
        pagina.wait("document.querySelector('#lista .elemento .marcas .estrella').textContent === '★ 1'")
        # borrar la Final: el aviso nombra la ★ que arrastra; cancelar no borra; aceptar sí, y vuelve a P1
        pagina.evaluate("document.querySelector('[data-accion=borrar]').click()")
        pagina.wait("!!document.querySelector('dialog.confirm[open]')")
        self.assertEqual(pagina.evaluate("document.getElementById('confirm-title').textContent"), 'Borrar F4 Final y lo que sigue en base')
        mensaje = pagina.evaluate("document.getElementById('confirm-message').textContent")
        self.assertIn('★', mensaje)
        self.assertIn('base-f4-2.png', mensaje)
        self.assertIn('Quedan prompts y semillas', mensaje)
        pagina.evaluate("[...document.querySelectorAll('dialog.confirm button')].find((b) => b.textContent === 'Cancelar').click()")
        pagina.wait("!document.querySelector('dialog.confirm')")
        self.assertEqual(pagina.evaluate(FASE % 'F4' + ".getAttribute('aria-current')"), 'step')
        pagina.evaluate("document.querySelector('[data-accion=borrar]').click()")
        pagina.wait("!!document.querySelector('dialog.confirm[open]')")
        pagina.evaluate("document.querySelector('dialog.confirm .btn-danger').click()")
        pagina.wait(FASE % 'P1' + ".getAttribute('aria-current') === 'step'")
        pagina.wait("!document.querySelector('#lista .elemento .marcas .estrella')")
        # P1 sigue aceptado y se puede leer; la Final ya no tiene imagen aceptada
        pagina.evaluate(FASE % 'F4' + '.click()')
        pagina.wait("!!document.querySelector('.lectura')")
        self.assertIn('no tiene imagen aceptada', pagina.evaluate("document.querySelector('.lectura').textContent"))
        # ya borrada: quedan sus prompts, pero no hay nada que borrar, y el botón dice por qué
        self.assertEqual(pagina.evaluate("document.querySelector('.lectura [data-accion=borrar]').disabled"), True)
        self.assertEqual(pagina.evaluate("document.querySelector('.lectura [data-accion=borrar]').title"), 'No hay nada guardado en esta fase')
        self.assertEqual([p for p in self.pedidas if p.startswith('/api/')], [])
        self.assertEqual(self.nav.take_problems(), [])
        pagina.ws.close()


if __name__ == '__main__':
    unittest.main()
