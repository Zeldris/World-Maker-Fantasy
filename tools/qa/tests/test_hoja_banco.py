"""IMG-15 (opt-tokens): `hoja.sh` junta las imágenes de una ronda del banco en hojas de contactos, con la leyenda en
texto. Sin ffmpeg (el CI no lo instala) se salta."""
import os
import shutil
import subprocess
import unittest

from comun import RAIZ, carpeta

HOJA = os.path.join(RAIZ, 'docs', 'producto', 'plan-imagenes', 'hoja.sh')


def png(ruta: str, ancho: int, alto: int) -> None:
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', f'color=c=red:s={ancho}x{alto}', '-frames:v', '1', ruta],
                   check=True)


def tamano(ruta: str) -> str:
    return subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', ruta],
                          check=True, capture_output=True, text=True).stdout.strip()


@unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'sin ffmpeg')
class Hoja(unittest.TestCase):
    def correr(self, banco: str, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(['bash', HOJA, *args], env={**os.environ, 'BANCO_DIR': banco, 'ANCHO': '100'},
                              capture_output=True, text=True)

    def test_hojas_de_seis_en_orden_con_leyenda(self):
        banco = carpeta()
        for prueba in ('r9-b', 'r9-a'):
            for semilla in (3, 7, 11, 13):
                png(os.path.join(banco, prueba, 'intentos', f'banner-s{semilla}-p6.png'), 200, 80)
        png(os.path.join(banco, 'r8-x', 'intentos', 'banner-s3-p6.png'), 200, 80)  # otra ronda: no entra
        png(os.path.join(banco, 'r90-x', 'intentos', 'banner-s3-p6.png'), 200, 80)  # r9 no coge r90
        png(os.path.join(banco, 'hojas', 'r9-3.png'), 10, 10)  # de una pasada anterior: se borra
        r = self.correr(banco, 'r9')
        self.assertEqual(r.returncode, 0, r.stderr)
        lineas = r.stdout.splitlines()
        self.assertEqual(lineas[0], f'hoja: {banco}/hojas/r9-1.png')
        self.assertEqual(lineas[1], '  1 r9-a/intentos/banner-s11-p6.png')
        self.assertEqual(lineas[7], f'hoja: {banco}/hojas/r9-2.png')
        self.assertEqual(lineas[8:], ['  1 r9-b/intentos/banner-s3-p6.png', '  2 r9-b/intentos/banner-s7-p6.png'])
        self.assertEqual(tamano(f'{banco}/hojas/r9-1.png'), '200,120')  # 2 columnas × 3 filas de 100x40
        self.assertEqual(tamano(f'{banco}/hojas/r9-2.png'), '200,40')
        self.assertFalse(os.path.exists(f'{banco}/hojas/r9-3.png'))

    def test_una_sola_imagen_y_ronda_vacia(self):
        banco = carpeta()
        png(os.path.join(banco, 'r9-a', 'intentos', 'banner-s3-p6.png'), 200, 80)
        r = self.correr(banco, 'r9')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(tamano(f'{banco}/hojas/r9-1.png'), '100,40')
        r = self.correr(banco, 'r5')
        self.assertEqual(r.returncode, 2)
        self.assertIn('ABORTO: no hay imágenes', r.stdout)


if __name__ == '__main__':
    unittest.main()
