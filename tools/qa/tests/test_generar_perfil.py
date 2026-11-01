"""IMG-23: perfil fotorreal de image-generator/scripts/generar.sh y probar.sh, con un sd-cli falso (sin modelos ni GPU).
El falso apunta sus argumentos en un archivo y escribe un PNG válido en la ruta de `-o`."""
import json
import os
import shutil
import struct
import subprocess
import unittest
import zlib

from comun import RAIZ, carpeta, escribir, leer

G = os.path.join(RAIZ, 'image-generator')
GENERAR = os.path.join(G, 'scripts', 'generar.sh')
PROBAR = os.path.join(G, 'scripts', 'probar.sh')
PROMPT_FICHA = os.path.join(G, 'scripts', 'prompt_ficha.py')
FICHA_REAL = os.path.join(G, 'fichas', 'fauna', 'aullador-rojo.json')
TIPO = 'test-perfil'


def png_minimo() -> bytes:
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(b'\x00\xff\x00\x00')) + chunk(b'IEND', b''))


SD_FALSO = '''#!/usr/bin/env python3
import sys
a = sys.argv[1:]
open(__import__("os").environ["ARGS_SD"], "w").write("\\n".join(a))
open(a[a.index("-o") + 1], "wb").write(open(__import__("os").environ["PNG_BASE"], "rb").read())
'''
GRADAR_FALSO = '''#!/bin/bash
echo "$@" > "$ARGS_GRADAR"
cp "$1" "$2"
'''


def ollama_con_modelos() -> bool:
    r = subprocess.run(['curl', '-s', '--max-time', '2', 'localhost:11434/api/ps'], capture_output=True, text=True)
    try:
        return any(m.get('size', 0) > 0 for m in json.loads(r.stdout).get('models', []))
    except ValueError:
        return False


class Base(unittest.TestCase):
    def setUp(self):
        if ollama_con_modelos():
            self.skipTest('Ollama tiene modelos cargados en memoria: generar.sh abortaría')
        self.d = carpeta()
        self.sd = os.path.join(self.d, 'sd-cli')
        escribir(self.sd, SD_FALSO)
        os.chmod(self.sd, 0o755)
        self.gr = os.path.join(self.d, 'gradar-falso.sh')
        escribir(self.gr, GRADAR_FALSO)
        os.chmod(self.gr, 0o755)
        self.png = os.path.join(self.d, 'base.png')
        with open(self.png, 'wb') as f:
            f.write(png_minimo())
        self.args_sd = os.path.join(self.d, 'args-sd.txt')
        self.args_gradar = os.path.join(self.d, 'args-gradar.txt')
        self.prompt = os.path.join(self.d, 'prompt.txt')
        escribir(self.prompt, 'un prompt de prueba\n')
        self.env = {k: v for k, v in os.environ.items() if k not in ('PERFIL', 'MOMENTO', 'BOCETO', 'GRADAR', 'REGION')}
        self.env.update(SDCLI=self.sd, GRADAR_SH=self.gr, ARGS_SD=self.args_sd, ARGS_GRADAR=self.args_gradar,
                        PNG_BASE=self.png, MIN_INICIO_MB='0')

    def correr(self, cmd, **env):
        return subprocess.run(cmd, capture_output=True, text=True, env={**self.env, **env}, cwd=self.d)

    def generar(self, *extra, **env):
        return self.correr(['bash', GENERAR, os.path.join(self.d, 'out'), 'n1', self.prompt, '640', '256', '7', '8', *extra], **env)

    def args(self):
        return leer(self.args_sd).split('\n')

    def valor(self, flag):
        a = self.args()
        return a[a.index(flag) + 1]


class GenerarPerfil(Base):
    def test_sin_perfil_son_los_args_de_siempre(self):
        r = self.generar()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertTrue(self.valor('--diffusion-model').endswith('flux-2-klein-4b-Q8_0.gguf'))
        self.assertNotIn('--backend', self.args())
        self.assertNotIn('--init-img', self.args())
        self.assertFalse(os.path.exists(self.args_gradar))

    def test_fotorreal_pone_la_receta_y_el_backend_antes_de_los_extra(self):
        r = self.generar('--extra-del-llamante', PERFIL='fotorreal')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertTrue(self.valor('--diffusion-model').endswith('flux3-image-klein-Q8_0.gguf'))
        self.assertTrue(self.valor('--llm').endswith('Qwen3VL-4B-Instruct-Q4_K_M.gguf'))
        self.assertTrue(self.valor('--vae').endswith('flux2-vae.safetensors'))
        a = self.args()
        i = a.index('--backend')
        self.assertEqual(a[i:i + 4], ['--backend', 'diffusion=cpu', '-t', '8'])
        self.assertLess(i, a.index('--extra-del-llamante'))
        self.assertNotIn('--scheduler', a)

    def test_las_variables_explicitas_mandan_sobre_el_perfil(self):
        self.generar(PERFIL='fotorreal', MODELO='otro.gguf')
        self.assertTrue(self.valor('--diffusion-model').endswith('/otro.gguf'))

    def test_perfil_desconocido_aborta_con_motivo(self):
        r = self.generar(PERFIL='raro')
        self.assertEqual(r.returncode, 2)
        self.assertIn('PERFIL desconocido: raro', r.stdout)
        self.assertFalse(os.path.exists(self.args_sd))

    def test_boceto_anade_init_img_y_fuerza(self):
        boceto = os.path.join(self.d, 'boceto.png')
        shutil.copy(self.png, boceto)
        r = self.generar(BOCETO=boceto)
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertEqual(self.valor('--init-img'), boceto)
        self.assertEqual(self.valor('--strength'), '0.97')
        self.assertEqual(self.valor('--extra-sample-args'), 'strength_as_noise_level=true')
        self.generar(BOCETO=boceto, FUERZA_BOCETO='0.8')
        self.assertEqual(self.valor('--strength'), '0.8')

    def test_boceto_inexistente_aborta_sin_lanzar_sd_cli(self):
        r = self.generar(BOCETO=os.path.join(self.d, 'no-existe.png'))
        self.assertEqual(r.returncode, 3)
        self.assertIn('el boceto no existe', r.stdout)
        self.assertFalse(os.path.exists(self.args_sd))


class Gradacion(Base):
    def test_con_momento_se_grada_la_imagen(self):
        r = self.generar(PERFIL='fotorreal', MOMENTO='atardecer')
        self.assertEqual(r.returncode, 0, r.stdout)
        png = os.path.join(self.d, 'out', 'intentos', 'n1.png')
        self.assertEqual(leer(self.args_gradar).split(), [png, png[:-4] + '-atardecer.png', 'atardecer'])
        self.assertIn('n1-atardecer.png', r.stdout)
        self.assertTrue(os.path.exists(png[:-4] + '-atardecer.png'))

    def test_la_region_se_pasa_a_gradar(self):
        self.generar(PERFIL='fotorreal', MOMENTO='noche', REGION='llanuras')
        self.assertEqual(leer(self.args_gradar).split()[-2:], ['noche', 'llanuras'])

    def test_gradar_cero_no_grada(self):
        r = self.generar(PERFIL='fotorreal', MOMENTO='dia', GRADAR='0')
        self.assertEqual(r.returncode, 0)
        self.assertFalse(os.path.exists(self.args_gradar))

    def test_sin_momento_no_grada(self):
        self.generar(PERFIL='fotorreal')
        self.assertFalse(os.path.exists(self.args_gradar))

    def test_momento_invalido_aborta_antes_de_generar(self):
        r = self.generar(PERFIL='fotorreal', MOMENTO='madrugada')
        self.assertEqual(r.returncode, 2)
        self.assertIn('MOMENTO desconocido: madrugada', r.stdout)
        self.assertFalse(os.path.exists(self.args_sd))

    def test_si_gradar_falla_se_dice_y_queda_la_imagen(self):
        escribir(self.gr, '#!/bin/bash\nexit 4\n')
        r = self.generar(PERFIL='fotorreal', MOMENTO='dia')
        self.assertEqual(r.returncode, 4)
        self.assertIn('gradar.sh falló', r.stdout)
        self.assertTrue(os.path.exists(os.path.join(self.d, 'out', 'intentos', 'n1.png')))


class ProbarFotorreal(Base):
    def setUp(self):
        super().setUp()
        self.fichas = os.path.join(self.d, 'fichas')
        os.makedirs(os.path.join(self.fichas, TIPO))
        shutil.copy(FICHA_REAL, os.path.join(self.fichas, TIPO, 'aullador.json'))
        self.salida = os.path.join(G, 'generated', TIPO)
        self.addCleanup(shutil.rmtree, self.salida, True)
        shutil.rmtree(self.salida, True)

    def probar(self, slug='aullador', *extra, **env):
        return self.correr(['bash', PROBAR, TIPO, slug, 'fotorreal', '7', *extra], FICHAS=self.fichas, **env)

    def test_borrador_por_defecto_y_prompt_de_la_ficha(self):
        r = self.probar(MOMENTO='dia')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual((self.valor('-W'), self.valor('-H'), self.valor('--steps')), ('640', '256', '8'))
        esperado = subprocess.run(['python3', PROMPT_FICHA, FICHA_REAL, '--perfil', 'fotorreal', '--momento', 'dia'],
                                  capture_output=True, text=True, check=True).stdout.strip()
        self.assertEqual(self.valor('-p'), esperado)
        self.assertIn('ficha', r.stdout)

    def test_el_momento_por_defecto_es_el_de_la_ficha_y_se_grada(self):
        r = self.probar()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(leer(self.args_gradar).split()[-1], 'atardecer')  # aullador-rojo.json: momento atardecer
        reg = leer(os.path.join(self.salida, 'aullador', 'registro.tsv')).strip().split('\n')
        self.assertEqual(len(reg[0].split('\t')), len(reg[1].split('\t')))
        self.assertIn('fotorreal momento=atardecer boceto=-', reg[1].split('\t')[7])

    def test_final_es_1280x512_y_16_pasos(self):
        self.probar(FINAL='1', MOMENTO='dia')
        self.assertEqual((self.valor('-W'), self.valor('-H'), self.valor('--steps')), ('1280', '512', '16'))

    def test_w_h_y_pasos_mandan(self):
        self.correr(['bash', PROBAR, TIPO, 'aullador', 'fotorreal', '7', '12'], FICHAS=self.fichas, W='320', H='128')
        self.assertEqual((self.valor('-W'), self.valor('-H'), self.valor('--steps')), ('320', '128', '12'))

    def test_prompt_archivo_manda_sobre_la_ficha(self):
        r = self.probar('sin-ficha', PROMPT_ARCHIVO=self.prompt)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.valor('-p'), 'un prompt de prueba')
        self.assertIn('pegado', r.stdout)

    def test_sin_ficha_ni_prompt_archivo_aborta(self):
        r = self.probar('sin-ficha')
        self.assertEqual(r.returncode, 3)
        self.assertIn('fotorreal no usa los prompts de la base', r.stdout)
        self.assertFalse(os.path.exists(self.args_sd))

    def test_el_boceto_va_en_la_receta_del_registro(self):
        self.probar(MOMENTO='dia', BOCETO=self.png)
        reg = leer(os.path.join(self.salida, 'aullador', 'registro.tsv')).strip().split('\n')[1].split('\t')
        self.assertIn('boceto=base.png', reg[7])
        self.assertEqual(self.valor('--init-img'), self.png)


if __name__ == '__main__':
    unittest.main()
