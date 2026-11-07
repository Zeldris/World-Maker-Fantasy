"""IMG-41: la base de diseño de GVIG en la interfaz del generador de imágenes (image-generator/interfaz/ui/).
Reglas estáticas (adaptadas de galivelop-image-generator, tests/test_ui.py: CSP, imports), contraste de los tokens,
los estáticos de servidor.py (`/ui/...` con su tipo y la CSP, sin salir de la carpeta) y una página real en un
navegador sin cabeza (tests/browser.py; se salta si no hay Firefox ni Chrome, ver WMF_TEST_BROWSER)."""
import http.client
import json
import os
import re
import shutil
import socket
import tempfile
import threading
import unittest
from pathlib import Path

import browser
from comun import RAIZ, escribir
from test_interfaz_imagenes import Base

INTERFAZ = Path(RAIZ) / 'image-generator' / 'interfaz'
UI = INTERFAZ / 'ui'
JS = sorted(UI.rglob('*.js'))
CSS = sorted(UI.rglob('*.css'))
HTML = [INTERFAZ / 'index.html'] + sorted(UI.rglob('*.html'))
# 1x1 PNG real: una imagen que no decodifica sería un fallo de carga en el navegador.
PNG = bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a5f645400000000049454e44ae426082')


def leer(ruta):
    return Path(ruta).read_text(encoding='utf-8')


def rel(ruta):
    return str(Path(ruta).relative_to(INTERFAZ))


def sin_comentarios(codigo):
    return re.sub(r'/\*.*?\*/|//[^\n]*', '', codigo, flags=re.S)


class Csp(unittest.TestCase):
    def test_hay_archivos(self):
        self.assertGreaterEqual(len(JS), 8)
        self.assertGreaterEqual(len(CSS), 5)

    def test_html_sin_script_ni_estilo_ni_manejadores_en_linea(self):
        for ruta in HTML:
            texto = leer(ruta)
            for etiqueta in re.findall(r'<script\b[^>]*>', texto, re.I):
                self.assertRegex(etiqueta, r'\bsrc=', rel(ruta) + ': <script> en línea')
            self.assertNotRegex(texto, r'(?i)<script\b[^>]*>\s*\S[^<]*</script>', rel(ruta))
            self.assertNotRegex(texto, r'(?i)<style\b', rel(ruta))
            self.assertNotRegex(texto, r'(?i)<[^>]+\sstyle\s*=', rel(ruta) + ': atributo style')
            self.assertNotRegex(texto, r'(?i)<[^>]+\son[a-z]+\s*=', rel(ruta) + ': atributo on*')

    def test_js_sin_innerhtml_ni_eval(self):
        prohibido = re.compile(r'\.(innerHTML|outerHTML)\b|insertAdjacentHTML|\beval\s*\(|new\s+Function\b|document\.write\b'
                               r'|setAttribute\(\s*[\'"](style|on\w+)[\'"]')
        for ruta in JS:
            self.assertIsNone(prohibido.search(sin_comentarios(leer(ruta))), rel(ruta))

    def test_css_sin_urls_externas(self):
        for ruta in CSS:
            for url in re.findall(r'url\(\s*[\'"]?([^\'")]+)', leer(ruta)):
                if url.startswith('data:'):
                    continue
                self.assertFalse(re.match(r'(?i)([a-z]+:)?//', url), f'{rel(ruta)}: {url}')
                self.assertTrue((Path(ruta).parent / url).resolve().is_file(), f'{rel(ruta)}: {url} no existe')


IMPORT = re.compile(r"import\s*(?:([\w$*{},\s]+?)\s*from\s*)?['\"]([^'\"]+)['\"]")
EXPORT = re.compile(r'export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([\w$]+)')
EXPORT_LISTA = re.compile(r'export\s*\{([^}]*)\}')


def exporta(ruta):
    texto = leer(ruta)
    nombres = set(EXPORT.findall(texto))
    for grupo in EXPORT_LISTA.findall(texto):
        nombres.update(p.split(' as ')[-1].strip() for p in grupo.split(',') if p.strip())
    if re.search(r'export\s+default\b', texto):
        nombres.add('default')
    return nombres


class Imports(unittest.TestCase):
    def resolver(self, ruta, spec):
        if spec.startswith('/ui/'):
            return UI / spec[4:]
        self.assertTrue(spec.startswith('.'), f'{rel(ruta)}: import sin ruta {spec}')
        return (ruta.parent / spec).resolve()

    def test_los_imports_relativos_existen_y_exportan_lo_que_se_importa(self):
        comprobados = 0
        for ruta in JS:
            for nombres, spec in IMPORT.findall(leer(ruta)):
                destino = self.resolver(ruta, spec)
                self.assertTrue(destino.is_file(), f'{rel(ruta)} importa {spec}')
                if not nombres or nombres.strip().startswith('*'):
                    continue
                dentro = re.search(r'\{([^}]*)\}', nombres)
                pedidos = [p.split(' as ')[0].strip() for p in dentro.group(1).split(',') if p.strip()] if dentro else []
                if re.match(r'\s*[\w$]+\s*(,|$)', nombres):
                    pedidos.append('default')
                for nombre in pedidos:
                    self.assertIn(nombre, exporta(destino), f'{rel(ruta)} importa {nombre} de {spec}')
                    comprobados += 1
        self.assertGreater(comprobados, 10)

    def test_los_imports_dinamicos_existen(self):
        for ruta in JS:
            for spec in re.findall(r'import\(\s*[\'"]([^\'"]+)[\'"]\s*\)', leer(ruta)):
                self.assertTrue(self.resolver(ruta, spec).is_file(), f'{rel(ruta)}: {spec}')

    def test_todo_href_y_src_del_html_existe(self):
        vistos = 0
        for ruta in HTML:
            for spec in re.findall(r'''(?:src|href)=["']([^"'#][^"']*)''', leer(ruta)):
                if spec.startswith('/ui/'):
                    self.assertTrue((UI / spec[4:]).is_file(), spec)
                    vistos += 1
                else:
                    self.assertTrue(spec == '/' or spec.startswith('#'), f'{rel(ruta)}: enlace que no es de /ui/: {spec}')
        self.assertGreaterEqual(vistos, 5)

    def test_el_html_enlaza_las_cuatro_css_de_gvig_y_el_modulo(self):
        texto = leer(INTERFAZ / 'index.html')
        for css in ('tokens', 'base', 'layout', 'components'):
            self.assertIn(f'href="/ui/css/{css}.css"', texto)
        self.assertIn('<script type="module" src="/ui/js/app.js">', texto)


def luminancia(color):
    r, g, b = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contraste(a, b):
    x, y = sorted((luminancia(a), luminancia(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)


def tokens(bloque):
    return dict(re.findall(r'--([\w-]+):\s*(#[0-9a-fA-F]{6})\b', bloque))


class Tokens(unittest.TestCase):
    """Los valores de la paleta de Tarkor cumplen WCAG: texto >= 4,5:1 y bordes de control y foco >= 3:1."""

    def setUp(self):
        css = leer(UI / 'css' / 'tokens.css')
        self.oscuro = tokens(re.search(r'^:root \{(.*?)^\}', css, re.S | re.M).group(1))
        self.claro = tokens(re.search(r'^:root\[data-theme="light"\] \{(.*?)^\}', css, re.S | re.M).group(1))

    def test_los_dos_temas_tienen_los_mismos_nombres_que_gvig(self):
        esperados = {'bg', 'surface', 'surface-2', 'border', 'border-strong', 'text', 'text-2', 'accent', 'accent-text',
                     'accent-fill', 'on-accent', 'accent-soft', 'ok', 'warn', 'bad', 'on-status', 'focus'}
        self.assertEqual(esperados - set(self.oscuro), set())
        self.assertEqual(esperados - set(self.claro), set())
        css = leer(UI / 'css' / 'tokens.css')
        for ajuste in ('--tap: 44px', 'data-font-scale="large"', 'data-font-scale="xlarge"', 'prefers-color-scheme: light'):
            self.assertIn(ajuste, css)

    def test_contraste(self):
        for nombre, t in (('oscuro', self.oscuro), ('claro', self.claro)):
            for texto in ('text', 'text-2', 'accent-text', 'ok', 'warn', 'bad'):
                for fondo in ('bg', 'surface', 'surface-2'):
                    if texto == 'accent-text' and fondo == 'surface':
                        continue
                    self.assertGreaterEqual(contraste(t[texto], t[fondo]), 4.5, f'{nombre}: {texto} sobre {fondo}')
            for borde in ('border-strong', 'focus'):
                for fondo in ('bg', 'surface', 'surface-2'):
                    self.assertGreaterEqual(contraste(t[borde], t[fondo]), 3, f'{nombre}: {borde} sobre {fondo}')
            self.assertGreaterEqual(contraste(t['on-accent'], t['accent-fill']), 4.5, f'{nombre}: on-accent')
            for estado in ('ok', 'warn', 'bad'):
                self.assertGreaterEqual(contraste(t['on-status'], t[estado]), 4.5, f'{nombre}: on-status sobre {estado}')
            for texto in ('text', 'text-2'):
                self.assertGreaterEqual(contraste(t[texto], t['accent-soft']), 4.5, f'{nombre}: {texto} sobre accent-soft')


class Estaticos(Base):
    def setUp(self):
        super().setUp()
        with socket.socket() as so:
            so.bind(('127.0.0.1', 0))
            self.puerto = so.getsockname()[1]
        self.srv = self.s.ThreadingHTTPServer(('127.0.0.1', self.puerto), self.s.Manejador)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.addCleanup(self.srv.server_close)
        self.addCleanup(self.srv.shutdown)

    def pedir(self, ruta):
        c = http.client.HTTPConnection('127.0.0.1', self.puerto, timeout=10)
        self.addCleanup(c.close)
        c.request('GET', ruta)  # http.client no normaliza la ruta: `..` llega tal cual
        r = c.getresponse()
        return r.status, r, r.read()

    def test_css_con_su_tipo_la_csp_y_sin_cache(self):
        estado, r, cuerpo = self.pedir('/ui/css/tokens.css')
        self.assertEqual(estado, 200)
        self.assertEqual(r.getheader('Content-Type'), 'text/css; charset=utf-8')
        self.assertIn("script-src 'self'", r.getheader('Content-Security-Policy'))
        self.assertIn("style-src 'self'", r.getheader('Content-Security-Policy'))
        self.assertEqual(r.getheader('Cache-Control'), 'no-cache')
        self.assertEqual(cuerpo, (UI / 'css' / 'tokens.css').read_bytes())

    def test_js_como_text_javascript_y_fuente_woff2(self):
        self.assertEqual(self.pedir('/ui/js/app.js')[1].getheader('Content-Type'), 'text/javascript; charset=utf-8')
        estado, r, cuerpo = self.pedir('/ui/fonts/inter-latin-wght-normal.woff2')
        self.assertEqual((estado, r.getheader('Content-Type')), (200, 'font/woff2'))
        self.assertTrue(cuerpo.startswith(b'wOF2'))
        self.assertEqual(self.pedir('/ui/fonts/LICENSE-Inter.txt')[1].getheader('Content-Type'), 'text/plain; charset=utf-8')

    def test_la_pagina_lleva_tambien_la_csp(self):
        estado, r, cuerpo = self.pedir('/')
        self.assertEqual(estado, 200)
        self.assertEqual(r.getheader('Content-Type'), 'text/html; charset=utf-8')
        self.assertEqual(r.getheader('Content-Security-Policy'), self.s.STATIC_CSP)
        self.assertIn("frame-ancestors 'none'", self.s.STATIC_CSP)
        self.assertIn(b'/ui/js/app.js', cuerpo)

    def test_no_sale_de_ui(self):
        self.assertEqual(self.pedir('/ui/css/base.css')[0], 200)  # control: lo de dentro sí se sirve
        for ruta in ('/ui/../servidor.py', '/ui/%2e%2e/servidor.py', '/ui/..%2fservidor.py', '/ui/%2E%2E%2Fservidor.py',
                     '/ui/css/../../servidor.py', '/ui//etc/passwd', '/ui/%2fetc/passwd', '/ui/..\\servidor.py', '/ui/%00.css',
                     '/ui/css/%2e%2e/%2e%2e/servidor.py', '/ui/'):
            estado, r, cuerpo = self.pedir(ruta)
            self.assertIn(estado, (403, 404), ruta)
            self.assertNotIn(b'def estatico', cuerpo, ruta)

    def test_un_enlace_que_sale_de_ui_no_se_sirve(self):
        fuera = tempfile.mkdtemp()
        dentro = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, fuera, True)
        self.addCleanup(shutil.rmtree, dentro, True)
        escribir(os.path.join(fuera, 'secreto.css'), 'secreto')
        os.symlink(os.path.join(fuera, 'secreto.css'), os.path.join(dentro, 'enlace.css'))
        escribir(os.path.join(dentro, 'bien.css'), 'bien')
        self.s.UI_DIR = dentro
        self.assertEqual(self.pedir('/ui/bien.css')[0], 200)
        estado, _, cuerpo = self.pedir('/ui/enlace.css')
        self.assertEqual(estado, 403)
        self.assertNotIn(b'secreto', cuerpo)

    def test_extension_desconocida_o_sin_archivo_es_404(self):
        self.assertEqual(self.pedir('/ui/css/base.css')[0], 200)  # control: lo de dentro sí se sirve
        self.assertEqual(self.pedir('/ui/LICENSE-GVIG')[0], 404)
        self.assertEqual(self.pedir('/ui/css/no-existe.css')[0], 404)

    def test_la_api_no_cambia(self):
        estado, r, _ = self.pedir('/api/inicio')
        self.assertEqual((estado, r.getheader('Cache-Control')), (200, 'no-store'))
        self.assertIsNone(r.getheader('Content-Security-Policy'))
        # y la página sí lleva la suya: la CSP y `no-cache` son solo de lo estático
        self.assertEqual(self.pedir('/')[1].getheader('Cache-Control'), 'no-cache')


@unittest.skipUnless(browser.find_browser(), 'sin Firefox ni Chrome (WMF_TEST_BROWSER)')
class Navegador(Base):
    def setUp(self):
        super().setUp()
        self.intento()
        with open(os.path.join(self.dir(), 'intentos', 'thumbnail-s42-p4-20261024-100000.png'), 'wb') as f:
            f.write(PNG)
        with socket.socket() as so:
            so.bind(('127.0.0.1', 0))
            self.puerto = so.getsockname()[1]
        pedidas = self.pedidas = []  # lo que la página pide al servidor (con ?mock=1, nada de /api/)

        class Registra(self.s.Manejador):
            def do_GET(self_):
                pedidas.append(self_.path)
                return super().do_GET()

            def do_POST(self_):
                pedidas.append(self_.path)
                return super().do_POST()
        self.srv = self.s.ThreadingHTTPServer(('127.0.0.1', self.puerto), Registra)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.addCleanup(self.srv.server_close)
        self.addCleanup(self.srv.shutdown)
        self.nav = browser.Browser()
        self.addCleanup(self.nav.close)

    def test_la_pagina_carga_sin_errores_y_pinta_la_lista_y_la_ficha(self):
        pagina = self.nav.new_page()
        self.nav.take_problems()
        pagina.goto(f'http://127.0.0.1:{self.puerto}/')
        pagina.wait("document.querySelectorAll('#lista .elemento .nombre').length === 1")
        self.assertIn('nievon', pagina.evaluate("document.querySelector('#lista .elemento .nombre').textContent"))
        # los tokens de GVIG con la paleta de Tarkor y las fuentes propias están aplicados
        self.assertEqual(pagina.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--tap').trim()"), '44px')
        self.assertEqual(pagina.evaluate("document.fonts.check('16px Inter')"), True)
        pagina.evaluate("document.querySelector('#lista .elemento').click()")
        pagina.wait("!document.getElementById('ficha').hidden && document.querySelectorAll('#galeria .tarjeta').length >= 1")
        pagina.wait("document.querySelector('#galeria .tarjeta img') && document.querySelector('#galeria .tarjeta img').complete")
        # el selector de tema y el de talla de letra actúan sobre <html>
        pagina.evaluate("(() => { const s = document.getElementById('theme'); s.value = 'light'; s.dispatchEvent(new Event('change')); })()")
        self.assertEqual(pagina.evaluate('document.documentElement.dataset.theme'), 'light')
        pagina.evaluate("(() => { const s = document.getElementById('font-scale'); s.value = 'large'; s.dispatchEvent(new Event('change')); })()")
        self.assertEqual(pagina.evaluate('document.documentElement.dataset.fontScale'), 'large')
        pagina.pump(0.5)
        self.assertEqual(self.nav.take_problems(), [])
        pagina.ws.close()

    def test_con_mock_la_pagina_funciona_sin_pedir_nada_a_la_api(self):
        pagina = self.nav.new_page()
        self.nav.take_problems()
        pagina.goto(f'http://127.0.0.1:{self.puerto}/?mock=1')
        pagina.wait("document.querySelectorAll('#lista .elemento .nombre').length === 4")
        self.assertIn('Simulador', pagina.evaluate("document.getElementById('avisoLista').textContent"))
        pagina.evaluate("document.querySelector('#lista .elemento').click()")
        pagina.wait("document.querySelectorAll('#galeria .tarjeta img').length >= 2 && "
                    "[...document.querySelectorAll('#galeria .tarjeta img')].every((i) => i.complete && i.naturalWidth > 0)")
        # una generación de un paso acaba bien; con la semilla 13 el simulador falla y se ve el log
        generar = ("(() => { document.getElementById('pasos').value = 1; document.getElementById('semilla').value = %d; "
                   "document.getElementById('generar').click(); })()")
        pagina.evaluate(generar % 5)
        pagina.wait("document.getElementById('resultado').textContent.startsWith('Lista en')", timeout=20)
        pagina.wait("!document.getElementById('generar').disabled")
        pagina.evaluate(generar % 13)
        pagina.wait("document.getElementById('resultado').textContent.startsWith('Falló')", timeout=20)
        self.assertIn('out of memory', pagina.evaluate("document.querySelector('#resultado pre').textContent"))
        self.assertEqual([p for p in self.pedidas if p.startswith('/api/')], [])
        self.assertEqual(self.nav.take_problems(), [])
        pagina.ws.close()

    def test_un_error_de_servidor_py_llega_con_su_texto(self):
        pagina = self.nav.new_page()
        pagina.goto(f'http://127.0.0.1:{self.puerto}/')
        pagina.wait("document.querySelectorAll('#lista .elemento').length >= 1")
        r = pagina.evaluate("import('/ui/js/api.js').then((m) => m.get('/api/nada').then(() => 'sin error', "
                            "(e) => [e instanceof m.ApiError, e.status, e.message].join('|')))")
        self.assertEqual(r, 'true|404|no existe')
        self.nav.take_problems()  # el 404 buscado sale en la consola
        pagina.ws.close()


if __name__ == '__main__':
    unittest.main()
