"""IMG-18/IMG-24: bocetos SVG de forma generados por image-generator/bocetos/plantilla.py: cada plan corporal da XML
válido de 2,5:1 y color plano, las fichas con `boceto.plan` generan, los números mueven la geometría, un valor malo
para con el motivo, y lo generado rasteriza con rsvg-convert (y verde.css deja el fondo en verde croma)."""
import glob
import json
import os
import shutil
import subprocess
import sys
import unittest
import xml.etree.ElementTree as ET

from comun import RAIZ, carpeta

BOCETOS = os.path.join(RAIZ, 'image-generator', 'bocetos')
PLANTILLA = os.path.join(BOCETOS, 'plantilla.py')
FICHAS = os.path.join(RAIZ, 'image-generator', 'fichas')
PLANES = ('depredador', 'herbivoro', 'reptil', 'ave', 'alargado', 'artropodo')
SVG = '{http://www.w3.org/2000/svg}'


def plantilla(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, PLANTILLA, *args], capture_output=True, text=True)


def generar(destino: str, *args: str) -> str:
    r = plantilla(*args, '-o', destino)
    assert r.returncode == 0, r.stderr
    return destino


def fichas_con_plan():
    salida = []
    for ruta in sorted(glob.glob(os.path.join(FICHAS, '*', '*.json'))):
        with open(ruta, encoding='utf-8') as f:
            boceto = json.load(f).get('boceto')
        if isinstance(boceto, dict) and 'plan' in boceto:
            salida.append(ruta)
    return salida


class TestPlantilla(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.d = carpeta()
        cls.svg = {p: generar(os.path.join(cls.d, p + '.svg'), '--plan', p) for p in PLANES}
        for ruta in fichas_con_plan():
            nombre = os.path.splitext(os.path.basename(ruta))[0]
            cls.svg['ficha:' + nombre] = generar(os.path.join(cls.d, nombre + '.svg'), ruta)

    def raiz(self, clave: str) -> ET.Element:
        return ET.parse(self.svg[clave]).getroot()

    def test_los_planes_son_los_del_plan(self):
        """`--planes` lista los seis planes de IMG-24 con su unidad y sus parámetros."""
        r = plantilla('--planes')
        self.assertEqual(r.returncode, 0, r.stderr)
        for p in PLANES:
            self.assertIn(f'{p}: unidad', r.stdout)
        self.assertIn('largo = ', r.stdout)

    def test_xml_valido_y_proporcion(self):
        for clave in self.svg:
            with self.subTest(clave):
                raiz = self.raiz(clave)
                self.assertEqual(raiz.tag, SVG + 'svg')
                ancho, alto = (float(x) for x in raiz.get('viewBox').split()[2:])
                self.assertEqual(ancho / alto, 2.5, 'el boceto tiene que ser 2,5:1 (1280x512)')
                self.assertEqual((raiz.get('width'), raiz.get('height')), ('1280', '512'))

    def test_colores_planos(self):
        """Sin filtros ni desenfoques: el boceto es de color plano (solo degradado de cielo)."""
        for clave in self.svg:
            with self.subTest(clave):
                etiquetas = {e.tag.replace(SVG, '') for e in self.raiz(clave).iter()}
                self.assertFalse(etiquetas & {'filter', 'image', 'text'}, etiquetas)

    def test_fondo_marcado_para_el_verde(self):
        """IMG-19c: el cielo y el suelo llevan class="fondo" y la sombra class="sombra" (verde.css)."""
        for clave in self.svg:
            with self.subTest(clave):
                raiz = self.raiz(clave)
                self.assertEqual(len([e for e in raiz.iter() if e.get('class') == 'fondo']), 2, 'cielo y suelo')
                self.assertEqual(len([e for e in raiz.iter() if e.get('class') == 'sombra']), 1)

    def test_el_sujeto_deja_libres_los_16_px_de_arriba_y_abajo(self):
        """rasterizar.sh recorta 16 px arriba y abajo para el 1024x384: el grupo del sujeto cabe entre 40 y 452."""
        for clave in self.svg:
            with self.subTest(clave):
                t = self.raiz(clave).find(SVG + 'g').get('transform')
                self.assertTrue(t.startswith('translate(') and 'scale(' in t, t)

    def test_cresta_negra_del_depredador(self):
        """La cresta por defecto es negra (#0c0c0c); la de la ficha del aullador, además, con puntas rojas."""
        negros = [e for e in self.raiz('depredador').iter(SVG + 'path') if e.get('fill', '').lower() == '#0c0c0c']
        self.assertGreater(len(negros), 10, 'faltan las púas de la cresta')
        rojos = [e for e in self.raiz('ficha:aullador-rojo').iter(SVG + 'path') if e.get('fill', '').lower() == '#b3121a']
        self.assertTrue(rojos, 'faltan las puntas rojas de la cresta del aullador')

    def test_la_cuenta_va_en_el_boceto(self):
        """F9: los ojos del artrópodo son tantos como pide el parámetro."""
        def ojos(svg):
            return len([e for e in ET.parse(svg).getroot().iter(SVG + 'ellipse')
                        if e.get('fill') == '#1a1410' and e.get('rx') == e.get('ry')])
        cuatro = generar(os.path.join(self.d, 'a4.svg'), '--plan', 'artropodo', '-p', 'ojos=4')
        siete = generar(os.path.join(self.d, 'a7.svg'), '--plan', 'artropodo', '-p', 'ojos=7')
        self.assertEqual(ojos(siete) - ojos(cuatro), 3)

    def test_los_numeros_mueven_la_geometria(self):
        """Un torso el doble de largo da otro SVG; el mismo número, el mismo SVG (determinista)."""
        a = generar(os.path.join(self.d, 'l3.svg'), '--plan', 'depredador', '-p', 'largo=3')
        b = generar(os.path.join(self.d, 'l6.svg'), '--plan', 'depredador', '-p', 'largo=6')
        c = generar(os.path.join(self.d, 'l3b.svg'), '--plan', 'depredador', '-p', 'largo=3')
        with open(a) as fa, open(b) as fb, open(c) as fc:
            ta, tb, tc = fa.read(), fb.read(), fc.read()
        self.assertNotEqual(ta, tb)
        self.assertEqual(ta, tc)
        ancho = {t: float(ET.fromstring(t).find(SVG + 'rect').get('width')) for t in (ta, tb)}
        self.assertEqual(set(ancho.values()), {1280.0})

    def test_valor_malo_para_con_el_motivo(self):
        casos = (
            (('--plan', 'depredador', '-p', 'largo=50'), 'fuera de rango'),
            (('--plan', 'depredador', '-p', 'alas=3'), 'no tiene el parámetro «alas»'),
            (('--plan', 'ave', '-p', 'pico=curvo'), 'las opciones son'),
            (('--plan', 'herbivoro', '-p', 'cuernos=[{"largo":1}]'), 'direccion'),
            (('--plan', 'reptil', '-p', 'cresta={"forma":"rizos","alto":1}'), 'puas, losas o banda'),
            (('--plan', 'centauro',), 'desconocido'),
        )
        for args, motivo in casos:
            with self.subTest(args):
                r = plantilla(*args, '-o', os.path.join(self.d, 'malo.svg'))
                self.assertEqual(r.returncode, 2, r.stdout)
                self.assertIn(motivo, r.stderr)

    def test_ficha_sin_plan_para_con_el_motivo(self):
        ruta = os.path.join(self.d, 'sin-plan.json')
        with open(ruta, 'w') as f:
            json.dump({'slug': 'x', 'boceto': {'archivo': 'bocetos/depredador.svg', 'fuerza': 0.85}}, f)
        r = plantilla(ruta, '-o', os.path.join(self.d, 'x.svg'))
        self.assertEqual(r.returncode, 2)
        self.assertIn('boceto.plan', r.stderr)

    def test_las_fichas_del_banco_llevan_plan(self):
        """IMG-24: la ficha pasa de `boceto.archivo` a `boceto.plan` y sus números; el aullador y el cuernahoja, al menos."""
        nombres = {os.path.basename(r) for r in fichas_con_plan()}
        self.assertLessEqual({'aullador-rojo.json', 'cuernahoja.json'}, nombres)
        for ruta in glob.glob(os.path.join(FICHAS, '*', '*.json')):
            with open(ruta, encoding='utf-8') as f:
                boceto = json.load(f).get('boceto')
            if boceto is not None:
                self.assertNotIn('archivo', boceto, f'{ruta}: boceto.archivo ya no existe, va boceto.plan')
                self.assertIn('fuerza', boceto, ruta)

    @unittest.skipUnless(shutil.which('rsvg-convert') and shutil.which('ffmpeg'), 'sin rsvg-convert o ffmpeg')
    def test_verde_css_deja_el_fondo_en_verde_croma(self):
        for clave in ('depredador', 'ave'):
            with self.subTest(clave):
                png = os.path.join(self.d, f'{clave}-verde.png')
                subprocess.run(['rsvg-convert', '-s', os.path.join(BOCETOS, 'verde.css'), '-w', '640', '-h', '256',
                                self.svg[clave], '-o', png], check=True)
                for x, y in ((2, 2), (2, 250), (630, 250)):  # cielo y las dos esquinas del suelo
                    px = subprocess.run(['ffmpeg', '-v', 'error', '-i', png, '-vf', f'crop=1:1:{x}:{y}', '-f', 'rawvideo',
                                         '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
                    self.assertEqual(px, bytes((0x00, 0xb1, 0x40)), (x, y))

    @unittest.skipUnless(shutil.which('rsvg-convert'), 'sin rsvg-convert')
    def test_rasteriza(self):
        for clave in PLANES:
            for ancho, alto in ((1280, 512), (640, 256)):
                with self.subTest(clave, tam=ancho):
                    png = os.path.join(self.d, f'{clave}-{ancho}.png')
                    r = subprocess.run(['rsvg-convert', '-w', str(ancho), '-h', str(alto), self.svg[clave], '-o', png],
                                       capture_output=True, text=True)
                    self.assertEqual(r.returncode, 0, r.stderr)
                    with open(png, 'rb') as f:
                        cab = f.read(24)
                    self.assertEqual(cab[:8], b'\x89PNG\r\n\x1a\n')
                    self.assertEqual((int.from_bytes(cab[16:20], 'big'), int.from_bytes(cab[20:24], 'big')), (ancho, alto))


if __name__ == '__main__':
    unittest.main()
