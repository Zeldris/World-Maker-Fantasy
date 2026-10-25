"""Tests of comprobar.py: each case starts from a copy of the example folder, which passes, and breaks one thing."""
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import comprobar  # noqa: E402

EJEMPLO = comprobar.RAIZ / "2026-10-23-mundo-vivo"


class Comprobar(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.carpeta = self.tmp / EJEMPLO.name
        shutil.copytree(EJEMPLO, self.carpeta)

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def cambiar(self, nombre, viejo, nuevo):
        ruta = self.carpeta / nombre
        texto = ruta.read_text(encoding="utf-8")
        self.assertIn(viejo, texto)
        ruta.write_text(texto.replace(viejo, nuevo, 1), encoding="utf-8")

    def fallos(self):
        return "\n".join(comprobar.comprobar(self.carpeta))

    def test_el_ejemplo_pasa(self):
        self.assertEqual(self.fallos(), "")

    def test_bastan_la_ficha_y_un_canal(self):
        for n in ("twitter.md", "linkedin.md", "reddit.md", "web.md"):
            (self.carpeta / n).unlink()
        self.assertEqual(self.fallos(), "")
        (self.carpeta / "discord.md").unlink()
        self.assertIn("ningún canal", self.fallos())

    def test_un_hueco_en_la_ficha_falla(self):
        self.cambiar("ficha.md", "**En una frase (jugador):**", "**En una frase (jugador):** …\n<!--")
        self.assertIn("ficha.md: queda «…» de la plantilla", self.fallos())

    def test_tema_y_fecha_de_la_plantilla_fallan(self):
        self.cambiar("twitter.md", "# ", "# <tema> ")
        self.cambiar("ficha.md", "# ", "# AAAA-MM-DD ")
        f = self.fallos()
        self.assertIn("twitter.md: queda «<tema>»", f)
        self.assertIn("ficha.md: queda «AAAA-MM-DD»", f)

    def test_fecha_que_no_es_texto_no_rompe_el_comprobador(self):
        for fecha in ("20261023", '"20261023"', "null"):
            web = (self.carpeta / "web.md").read_text(encoding="utf-8")
            web = re.sub(r'"fecha":\s*("[^"]*"|\w+)', f'"fecha": {fecha}', web, count=1)
            (self.carpeta / "web.md").write_text(web, encoding="utf-8")
            self.assertIn("no es AAAA-MM-DD", self.fallos(), fecha)

    def test_texto_que_no_es_objeto(self):
        web = (self.carpeta / "web.md").read_text(encoding="utf-8")
        web = re.sub(r'"texto":\s*\{.*?\}', '"texto": "hola"', web, count=1, flags=re.S)
        (self.carpeta / "web.md").write_text(web, encoding="utf-8")
        self.assertIn("«texto» tiene que ser un objeto", self.fallos())

    def test_un_emoji_cuenta_dos_en_x(self):
        self.assertEqual(comprobar.longitud_x("a👉b"), 4)
        self.assertEqual(comprobar.longitud_x("ver https://example.com/" + "x" * 90), 4 + 23)

    def test_un_hilo_de_un_mensaje_falla(self):
        texto = (self.carpeta / "twitter.md").read_text(encoding="utf-8")
        es, resto = texto.split("**2/**", 1)
        en = resto[resto.index("## en"):]
        (self.carpeta / "twitter.md").write_text(es + en, encoding="utf-8")
        self.assertIn("twitter.md (es): 1 mensajes; el hilo es de 2 a 4", self.fallos())

    def test_jerga_interna_si_y_terminos_publicos_no(self):
        self.cambiar("reddit.md", "## en", "## en\n\nComo GPT-4 o COVID-19, nada de QA-215 ni P320.\n")
        f = self.fallos()
        self.assertIn("«QA-215»", f)
        self.assertIn("«P320»", f)
        self.assertNotIn("GPT-4", f)
        self.assertNotIn("COVID-19", f)

    def test_una_captura_jpeg_sin_renderizar_falla(self):
        fuente = self.carpeta / "medios" / "fuente"
        shutil.copy(fuente / "captura-mapa-pozo.jpg", fuente / "otra.JPEG")
        self.assertIn("medios/fuente/otra.JPEG: sin renderizar", self.fallos())

    def test_funciona_desde_otra_carpeta(self):
        r = subprocess.run([sys.executable, str(AQUI / "comprobar.py")], cwd=self.tmp, capture_output=True, text=True)
        self.assertNotIn("Traceback", r.stderr)
        self.assertIn("mundo-vivo: OK", r.stdout)


if __name__ == "__main__":
    os.chdir(comprobar.REPO)
    unittest.main()
