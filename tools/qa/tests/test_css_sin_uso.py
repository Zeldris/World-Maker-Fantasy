"""QA-368: tools/qa/css-sin-uso.py lista las clases CSS que ningún .ts/.tsx nombra."""
import importlib.util
import os
import subprocess
import tempfile
import unittest

from comun import QA

SCRIPT = os.path.join(QA, 'css-sin-uso.py')


def proyecto(css: str, tsx: str) -> str:
    raiz = tempfile.mkdtemp()
    src = os.path.join(raiz, 'frontend', 'src')
    os.makedirs(src)
    with open(os.path.join(src, 'index.css'), 'w', encoding='utf-8') as f:
        f.write(css)
    with open(os.path.join(src, 'App.tsx'), 'w', encoding='utf-8') as f:
        f.write(tsx)
    return raiz


def correr(raiz: str):
    return subprocess.run(['python3', SCRIPT, raiz], capture_output=True, text=True)


class CssSinUso(unittest.TestCase):
    def test_clase_sin_uso_sale_con_1_y_se_nombra(self):
        r = correr(proyecto('.huerfana { color: red; }\n.viva { color: blue; }', '<div className="viva" />'))
        self.assertEqual(r.returncode, 1)
        self.assertIn('.huerfana', r.stdout)
        self.assertNotIn('.viva', r.stdout)

    def test_clases_usadas_salen_con_0(self):
        r = correr(proyecto('.a { x: 1 }\n.b-c:hover, .d > .a::before { x: 1 }', "const k = `a b-c d`"))
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_un_nombre_dentro_de_otro_no_cuenta_como_uso(self):
        r = correr(proyecto('.gold { x: 1 }', '<div className="corner-bracket-gold" />'))
        self.assertEqual(r.returncode, 1)
        self.assertIn('.gold', r.stdout)

    def test_comentarios_valores_y_atreglas_no_son_clases(self):
        css = ('/* .comentada { } */\n@keyframes giro { 0.5% { x: 1 } }\n'
               '.viva { margin: 0.5rem; background: url("./a.b.webp"); }\n'
               '@media (min-width: 40rem) { .viva { x: 1 } }\n@layer base { .viva { @apply p-2; } }')
        r = correr(proyecto(css, '<div className="viva" />'))
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_uso_desde_index_html(self):
        raiz = proyecto('.solo-html { x: 1 }', '<div />')
        with open(os.path.join(raiz, 'frontend', 'index.html'), 'w', encoding='utf-8') as f:
            f.write('<body class="solo-html">')
        self.assertEqual(correr(raiz).returncode, 0)

    def test_uso_desde_js_jsx_y_mdx(self):
        for ext in ('js', 'jsx', 'mdx'):
            raiz = proyecto('.solo-x { x: 1 }', '<div />')
            with open(os.path.join(raiz, 'frontend', 'src', f'a.{ext}'), 'w', encoding='utf-8') as f:
                f.write('<p className="solo-x" />')
            r = correr(raiz)
            self.assertEqual(r.returncode, 0, (ext, r.stdout))

    def test_uso_desde_apply_de_otro_css(self):
        raiz = proyecto('.base { x: 1 }\n.otra { @apply base p-2; }', '<div className="otra" />')
        r = correr(raiz)
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_prefijo_de_excepciones_no_sale(self):
        spec = importlib.util.spec_from_file_location('css_sin_uso', SCRIPT)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.EXCEPCIONES['dinamica-'] = 'prueba'
        raiz = proyecto('.dinamica-uno { x: 1 }\n.otra { x: 1 }', '<div />')
        self.assertEqual(mod.sin_uso(raiz), ['otra'])


if __name__ == '__main__':
    unittest.main()
