"""IMG-15: image-generator/scripts/montar.sh con imágenes sintéticas de ffmpeg; se salta si no hay ffmpeg (CI)."""
import os
import shutil
import subprocess
import unittest

from comun import RAIZ, carpeta

MONTAR = os.path.join(RAIZ, 'image-generator', 'scripts', 'montar.sh')


@unittest.skipUnless(shutil.which('ffmpeg'), 'sin ffmpeg')
class Montar(unittest.TestCase):
    def test_sujeto_todo_verde_aborta_con_el_motivo(self):
        d = carpeta()
        pl, su = os.path.join(d, 'plancha.png'), os.path.join(d, 'sujeto.png')
        for ruta, color in ((pl, 'gray'), (su, '0x00ff00')):
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-i', f'color={color}:s=320x128',
                            '-frames:v', '1', ruta], check=True)
        r = subprocess.run(['bash', MONTAR, pl, su, os.path.join(d, 'm.png')], capture_output=True, text=True)
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertIn('ABORTO: no se encontró el sujeto', r.stdout)


if __name__ == '__main__':
    unittest.main()
