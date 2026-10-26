"""IMG-17: la gradación y la medida de color de image-generator/scripts/ (gradar.sh, medir/emd.py, medir/stats.sh).
Con imágenes sintéticas de ffmpeg (`-f lavfi`), sin banners ni modelo; se saltan si no hay ffmpeg (CI)."""
import os
import re
import shutil
import struct
import subprocess
import unittest

from comun import RAIZ, carpeta

SCRIPTS = os.path.join(RAIZ, 'image-generator', 'scripts')
GRADAR = os.path.join(SCRIPTS, 'gradar.sh')
EMD = os.path.join(SCRIPTS, 'medir', 'emd.py')
STATS = os.path.join(SCRIPTS, 'medir', 'stats.sh')
HAY_FFMPEG = shutil.which('ffmpeg') is not None


def sintetica(ruta: str, filtro: str = '') -> str:
    """PNG de 1280x512 con un degradado de colores (testsrc2), con un filtro opcional encima."""
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=1280x512:d=1',
                    *(['-vf', filtro] if filtro else []), '-frames:v', '1', ruta], check=True)
    return ruta


def tamano(png: str) -> tuple:
    with open(png, 'rb') as f:
        return struct.unpack('>II', f.read(24)[16:24])


def emd(a: str, b: str) -> dict:
    r = subprocess.run(['python3', '-I', EMD, a, b], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    return {k: float(v) for k, v in re.findall(r'(Y|Cb|Cr)=([0-9.]+)', r.stdout)}


def yavg(png: str) -> float:
    r = subprocess.run(['bash', STATS, png], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    return float(re.search(r'YAVG=([0-9.]+)', r.stdout).group(1))


@unittest.skipUnless(HAY_FFMPEG, 'sin ffmpeg')
class Gradar(unittest.TestCase):
    def setUp(self):
        self.d = carpeta()
        self.orig = sintetica(os.path.join(self.d, 'orig.png'))

    def gradar(self, momento: str) -> str:
        salida = os.path.join(self.d, f'{momento}.png')
        r = subprocess.run(['bash', GRADAR, self.orig, salida, momento], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        return salida

    def test_emd_de_una_imagen_consigo_misma_es_cero(self):
        d = emd(self.orig, self.orig)
        self.assertEqual((d['Y'], d['Cb'], d['Cr']), (0.0, 0.0, 0.0))

    def test_emd_con_un_tinte_es_mayor_que_cero(self):
        tintada = sintetica(os.path.join(self.d, 'tinte.png'), 'colorbalance=rs=0.4:bs=-0.4,eq=saturation=1.5')
        d = emd(self.orig, tintada)
        self.assertGreater(d['Cb'], 0)
        self.assertGreater(d['Cr'], 0)

    def test_emd_da_la_mediana_con_varias_referencias(self):
        r = subprocess.run(['python3', '-I', EMD, self.orig, self.orig, self.orig, self.orig],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('MEDIANA Y=0.0 Cb=0.0 Cr=0.0', r.stdout)

    def test_gradar_no_cambia_el_tamano(self):
        for momento in ('dia', 'atardecer', 'noche'):
            self.assertEqual(tamano(self.gradar(momento)), (1280, 512), momento)

    def test_gradar_baja_la_luma_de_atardecer_y_noche(self):
        # La base levanta los negros y baja el medio; atardecer y noche oscurecen más, noche la que más.
        base = yavg(self.orig)
        dia, atardecer, noche = (yavg(self.gradar(m)) for m in ('dia', 'atardecer', 'noche'))
        self.assertLess(atardecer, dia)
        self.assertLess(noche, atardecer)
        self.assertLess(noche, base)

    def test_gradar_atardecer_calienta_el_color(self):
        # El tinte mueve la imagen: su EMD de croma frente al original no es cero.
        d = emd(self.orig, self.gradar('atardecer'))
        self.assertGreater(d['Cb'] + d['Cr'], 0.5)

    def test_gradar_rechaza_un_momento_desconocido(self):
        r = subprocess.run(['bash', GRADAR, self.orig, os.path.join(self.d, 'x.png'), 'mediodia'],
                           capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('momento desconocido', r.stderr + r.stdout)

    def test_hornear_escribe_una_lut_3d(self):
        cube = os.path.join(self.d, 'atardecer.cube')
        r = subprocess.run(['bash', GRADAR, '--hornear', 'atardecer', cube], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        with open(cube) as f:
            lineas = f.read().splitlines()
        self.assertIn('LUT_3D_SIZE 36', lineas)
        self.assertEqual(len(lineas), 2 + 36 ** 3)


if __name__ == '__main__':
    unittest.main()
