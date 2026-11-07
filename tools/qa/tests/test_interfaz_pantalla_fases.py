"""IMG-25 (parte 1): la pantalla de fases del elemento (image-generator/interfaz/ui/js/fases.js) en un navegador sin
cabeza, con el simulador (`?mock=1&rapido=1`: 50 ms por paso). Se salta si no hay Firefox ni Chrome (WMF_TEST_BROWSER)."""
import socket
import threading
import unittest

import browser
from test_interfaz_imagenes import Base

FASE = "document.querySelector('button.paso[data-fase=%s]')"
CONTADOR = "(document.querySelector('[data-intento=contador]') || {}).textContent === '%s'"
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

    def test_recorre_generar_regenerar_avanzar_a_la_final_y_atras(self):
        pagina = self.nav.new_page()
        self.nav.take_problems()
        pagina.goto(f'http://127.0.0.1:{self.puerto}/?mock=1&rapido=1')
        pagina.wait("document.querySelectorAll('#lista .elemento .nombre').length === 4")
        pagina.evaluate("document.querySelector('#lista .elemento').click()")
        # un elemento sin camino: pasos, tres paneles, el prompt de la enciclopedia y «Generar»
        pagina.wait("!document.getElementById('fases').hidden && document.getElementById('fasesPrompt').value.startsWith('a red howler')")
        self.assertEqual(pagina.evaluate("document.querySelectorAll('button.paso').length"), 5)
        self.assertEqual(pagina.evaluate(FASE % 'F3' + '.disabled'), True)
        self.assertIn('IMG-37', pagina.evaluate(FASE % 'F3' + '.textContent'))
        self.assertEqual(pagina.evaluate(FASE % 'F0' + ".getAttribute('aria-current')"), 'step')
        self.assertEqual(pagina.evaluate("document.querySelectorAll('#fases .tres .marco').length"), 3)
        self.assertEqual(pagina.evaluate("document.querySelector('[data-accion=regenerar]').textContent.trim().startsWith('Generar')"), True)
        self.assertEqual(pagina.evaluate("document.querySelector('[data-accion=atras]').disabled"), True)
        self.assertEqual(pagina.evaluate("document.querySelector('[data-siguiente=F4]').disabled"), True)
        self.assertIn('Aún no hay intentos', pagina.evaluate("document.querySelector('[data-siguiente=F4]').title"))
        # Generar F0: la barra de progreso y los botones apagados mientras corre; luego el intento 1 a la vista
        pagina.evaluate("document.querySelector('[data-accion=regenerar]').click()")
        pagina.wait("!!document.querySelector('.progreso-fase') && document.querySelector('[data-accion=regenerar]').disabled")
        pagina.wait(CONTADOR % '1/1', timeout=20)
        pagina.wait(IMAGEN)
        self.assertIn('s=3 ·', pagina.evaluate("document.querySelector('.marco.actual .meta').textContent"))
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
        # Avanzar a la Final con el primer intento: la Final se lanza y la F0 queda ✓
        pagina.evaluate("document.querySelector('[data-siguiente=F4]').click()")
        pagina.wait(FASE % 'F4' + ".getAttribute('aria-current') === 'step'")
        self.assertIn('✓', pagina.evaluate(FASE % 'F0' + '.textContent'))
        pagina.wait(CONTADOR % '1/1', timeout=20)
        pagina.wait(IMAGEN)
        self.assertEqual(pagina.evaluate("document.querySelectorAll('[data-siguiente]').length"), 0)
        self.assertEqual(pagina.evaluate("[...document.querySelectorAll('#fases .acciones button')].find((b) => b.textContent.startsWith('Marcar')).disabled"), True)
        self.assertIn('Aceptada en F0 Boceto', pagina.evaluate("document.querySelector('#fases .tres .marco:nth-child(2) h3').textContent"))
        # pulsar la F0 ya hecha enseña lo guardado en modo lectura, y se vuelve a la fase actual
        pagina.evaluate(FASE % 'F0' + '.click()')
        pagina.wait("!!document.querySelector('.lectura')")
        self.assertIn('s=3', pagina.evaluate("document.querySelector('.lectura .meta').textContent"))
        pagina.evaluate("document.querySelector('.lectura button').click()")
        pagina.wait("!document.querySelector('.lectura') && !!document.querySelector('.tres')")
        # Atrás: la F0 vuelve a ser la actual
        pagina.evaluate("document.querySelector('[data-accion=atras]').click()")
        pagina.wait(FASE % 'F0' + ".getAttribute('aria-current') === 'step'")
        self.assertEqual(pagina.evaluate("document.querySelector('[data-accion=atras]').disabled"), True)
        self.assertEqual([p for p in self.pedidas if p.startswith('/api/')], [])
        self.assertEqual(self.nav.take_problems(), [])
        pagina.ws.close()


if __name__ == '__main__':
    unittest.main()
