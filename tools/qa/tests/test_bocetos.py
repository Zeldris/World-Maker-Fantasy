"""IMG-18: bocetos SVG de forma (image-generator/bocetos/): XML válido, 2,5:1 y que rasterizan con rsvg-convert."""
import os
import shutil
import subprocess
import unittest
import xml.etree.ElementTree as ET

from comun import RAIZ, carpeta

BOCETOS = os.path.join(RAIZ, 'image-generator', 'bocetos')
NOMBRES = ('depredador', 'herbivoro')
SVG = '{http://www.w3.org/2000/svg}'


def leer_svg(nombre: str) -> ET.Element:
    return ET.parse(os.path.join(BOCETOS, nombre + '.svg')).getroot()


class TestBocetos(unittest.TestCase):
    def test_xml_valido_y_proporcion(self):
        for n in NOMBRES:
            with self.subTest(n):
                raiz = leer_svg(n)
                self.assertEqual(raiz.tag, SVG + 'svg')
                ancho, alto = (float(x) for x in raiz.get('viewBox').split()[2:])
                self.assertEqual(ancho / alto, 2.5, 'el boceto tiene que ser 2,5:1 (1280x512)')
                self.assertEqual((raiz.get('width'), raiz.get('height')), ('1280', '512'))

    def test_colores_planos(self):
        """Sin filtros ni desenfoques: el boceto es de color plano (solo degradado de cielo)."""
        for n in NOMBRES:
            with self.subTest(n):
                etiquetas = {e.tag.replace(SVG, '') for e in leer_svg(n).iter()}
                self.assertFalse(etiquetas & {'filter', 'image', 'text'}, etiquetas)

    def test_cresta_negra_del_depredador(self):
        """La cresta existe y es negra (#0c0c0c); que sea continua nuca-cola se juzga a ojo en la rejilla."""
        negros = [e for e in leer_svg('depredador').iter(SVG + 'path') if e.get('fill', '').lower() == '#0c0c0c']
        self.assertTrue(negros, 'falta la cresta en negro')

    @unittest.skipUnless(shutil.which('rsvg-convert'), 'sin rsvg-convert')
    def test_rasteriza(self):
        d = carpeta()
        for n in NOMBRES:
            for ancho, alto in ((1280, 512), (640, 256)):
                with self.subTest(n, tam=ancho):
                    png = os.path.join(d, f'{n}-{ancho}.png')
                    r = subprocess.run(['rsvg-convert', '-w', str(ancho), '-h', str(alto),
                                        os.path.join(BOCETOS, n + '.svg'), '-o', png], capture_output=True, text=True)
                    self.assertEqual(r.returncode, 0, r.stderr)
                    with open(png, 'rb') as f:
                        cab = f.read(24)
                    self.assertEqual(cab[:8], b'\x89PNG\r\n\x1a\n')
                    self.assertEqual((int.from_bytes(cab[16:20], 'big'), int.from_bytes(cab[20:24], 'big')), (ancho, alto))


if __name__ == '__main__':
    unittest.main()
