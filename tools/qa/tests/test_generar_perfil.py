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


SD_REGISTRO = '''#!/usr/bin/env python3
import os, sys
a = sys.argv[1:]
open(os.environ["LLAMADAS_SD"], "a").write("\\t".join(a) + "\\n")
open(a[a.index("-o") + 1], "wb").write(open(os.environ["PNG_BASE"], "rb").read())
'''
MONTAR_FALSO = '''#!/bin/bash
echo "$@|HERO=${HERO-}|MANADA=${MANADA-}" >> "$LLAMADAS_MONTAR"
cp "$1" "$3"
'''
PLANOS = os.path.join(G, 'scripts', 'planos.sh')


class PlanosBase(Base):
    """IMG-23: planos.sh (plancha + sujeto + montaje + armonizaciones) y PLANOS=<dir> de probar.sh, con falsos."""
    def setUp(self):
        super().setUp()
        escribir(self.sd, SD_REGISTRO)
        self.montar = os.path.join(self.d, 'montar-falso.sh')
        escribir(self.montar, MONTAR_FALSO)
        os.chmod(self.montar, 0o755)
        self.llamadas = os.path.join(self.d, 'llamadas-sd.tsv')
        self.llamadas_montar = os.path.join(self.d, 'llamadas-montar.txt')
        self.prompts = os.path.join(self.d, 'prompts')
        for t in ('plancha', 'sujeto', 'armonia'):
            escribir(os.path.join(self.prompts, t + '.txt'), f'prompt {t}\n')
        self.boceto = os.path.join(self.d, 'boceto-verde.png')
        shutil.copy(self.png, self.boceto)
        self.env.update(LLAMADAS_SD=self.llamadas, LLAMADAS_MONTAR=self.llamadas_montar, MONTAR=self.montar)
        self.out = os.path.join(self.d, 'planos-out')

    def planos(self, *, boceto=None, **env):
        return self.correr(['bash', PLANOS, self.prompts, boceto or self.boceto, self.out], **env)

    def llamadas_sd(self):
        return [l.split('\t') for l in leer(self.llamadas).strip().split('\n')]

    @staticmethod
    def val(a, flag):
        return a[a.index(flag) + 1]


class Planos(PlanosBase):
    def test_fases_en_orden_con_sus_argumentos(self):
        r = self.planos(SEED='5', PASOS='4', HERO='1:2:3', MANADA='4:5:6')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        ll = self.llamadas_sd()
        self.assertEqual([self.val(a, '-o').rsplit('/', 1)[1] for a in ll],
                         ['plancha.png', 'sujeto.png', 'armonia-0.5.png', 'armonia-0.7.png'])
        plancha, sujeto, a5, a7 = ll
        for a in ll:  # siempre por generar.sh con el perfil fotorreal
            self.assertTrue(self.val(a, '--diffusion-model').endswith('flux3-image-klein-Q8_0.gguf'))
            self.assertEqual(a[a.index('--backend') + 1], 'diffusion=cpu')
            self.assertEqual((self.val(a, '--seed'), self.val(a, '--steps')), ('5', '4'))
        self.assertEqual((self.val(plancha, '-W'), self.val(plancha, '-H')), ('640', '256'))
        self.assertNotIn('--init-img', plancha)
        self.assertEqual(self.val(plancha, '-p'), 'prompt plancha')
        self.assertEqual((self.val(sujeto, '-W'), self.val(sujeto, '-H')), ('512', '192'))
        self.assertEqual((self.val(sujeto, '--init-img'), self.val(sujeto, '--strength')), (self.boceto, '0.97'))
        self.assertEqual(self.val(sujeto, '--extra-sample-args'), 'strength_as_noise_level=true')
        montaje = os.path.join(self.out, 'intentos', 'montaje.png')
        for a, f in ((a5, '0.5'), (a7, '0.7')):
            self.assertEqual((self.val(a, '-W'), self.val(a, '-H')), ('640', '256'))
            self.assertEqual((self.val(a, '--init-img'), self.val(a, '--strength')), (montaje, f))
            self.assertEqual(self.val(a, '--extra-sample-args'), 'strength_as_noise_level=true')
            self.assertEqual(self.val(a, '-p'), 'prompt armonia')
        m = leer(self.llamadas_montar).strip()
        self.assertEqual(m, f'{self.out}/intentos/plancha.png {self.out}/intentos/sujeto.png {montaje}|HERO=1:2:3|MANADA=4:5:6')
        self.assertFalse(os.path.exists(self.args_gradar))  # sin MOMENTO no se grada

    def test_el_borrador_monta_con_las_posiciones_de_640_y_el_final_con_las_de_montar(self):
        self.planos()
        self.assertTrue(leer(self.llamadas_montar).strip().endswith('|HERO=50:246:520|MANADA=45:150:100 200:145:75:v 500:152:115'))
        os.remove(self.llamadas_montar)
        shutil.rmtree(self.out)
        self.planos(PW='1280', PH='512')
        self.assertTrue(leer(self.llamadas_montar).strip().endswith('|HERO=|MANADA='))

    def test_lo_que_ya_existe_se_salta_y_las_fuerzas_se_cambian(self):
        self.planos(FUERZAS='0.6')
        self.planos(FUERZAS='0.6')
        self.assertEqual(len(self.llamadas_sd()), 3)  # plancha, sujeto y armonia-0.6, una sola vez
        self.assertEqual(self.val(self.llamadas_sd()[2], '--strength'), '0.6')

    def test_el_momento_grada_solo_las_armonizaciones(self):
        r = self.planos(MOMENTO='noche')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(leer(self.args_gradar).split()[1:], [os.path.join(self.out, 'intentos', 'armonia-0.7-noche.png'), 'noche'])
        self.assertTrue(os.path.exists(os.path.join(self.out, 'intentos', 'armonia-0.5-noche.png')))
        self.assertFalse(os.path.exists(os.path.join(self.out, 'intentos', 'plancha-noche.png')))

    def test_el_boceto_del_entorno_no_se_cuela_en_la_plancha(self):
        self.planos(BOCETO=self.boceto)
        self.assertNotIn('--init-img', self.llamadas_sd()[0])

    def test_falta_un_prompt_aborta_con_su_nombre(self):
        os.remove(os.path.join(self.prompts, 'armonia.txt'))
        r = self.planos()
        self.assertEqual(r.returncode, 2)
        self.assertIn('falta el prompt', r.stdout)
        self.assertIn('armonia.txt', r.stdout)
        self.assertFalse(os.path.exists(self.llamadas))

    def test_falta_el_boceto_aborta_sin_generar(self):
        r = self.planos(boceto=os.path.join(self.d, 'no-esta.png'))
        self.assertEqual(r.returncode, 3)
        self.assertIn('el boceto no existe', r.stdout)
        self.assertFalse(os.path.exists(self.llamadas))

    def test_sin_argumentos_da_el_uso(self):
        r = self.correr(['bash', PLANOS])
        self.assertEqual(r.returncode, 2)
        self.assertIn('Uso: planos.sh', r.stdout)


class ProbarPlanos(PlanosBase):
    def setUp(self):
        super().setUp()
        self.fichas = os.path.join(self.d, 'fichas')
        os.makedirs(os.path.join(self.fichas, TIPO))
        shutil.copy(FICHA_REAL, os.path.join(self.fichas, TIPO, 'aullador.json'))
        self.salida = os.path.join(G, 'generated', TIPO)
        self.addCleanup(shutil.rmtree, self.salida, True)
        shutil.rmtree(self.salida, True)

    def probar(self, *extra, **env):
        return self.correr(['bash', PROBAR, TIPO, 'aullador', 'fotorreal', '7', *extra], **{'FICHAS': self.fichas, 'PLANOS': self.prompts, **env})

    def test_plancha_sujeto_y_armonias_en_planos_fecha_con_el_registro(self):
        r = self.probar(BOCETO=self.boceto, MOMENTO='dia')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        ll = self.llamadas_sd()
        self.assertEqual(len(ll), 4)
        self.assertEqual(self.val(ll[1], '--init-img'), self.boceto)
        self.assertEqual(self.val(ll[0], '--seed'), '7')
        self.assertEqual((self.val(ll[0], '-W'), self.val(ll[0], '--steps')), ('640', '8'))
        carpetas = [c for c in os.listdir(os.path.join(self.salida, 'aullador')) if c.startswith('planos-')]
        self.assertEqual(len(carpetas), 1)
        pd = os.path.join(self.salida, 'aullador', carpetas[0])
        self.assertTrue(os.path.exists(os.path.join(pd, 'intentos', 'armonia-0.5-dia.png')))  # graduada
        reg = leer(os.path.join(self.salida, 'aullador', 'registro.tsv')).strip().split('\n')
        self.assertEqual(len(reg[0].split('\t')), len(reg[1].split('\t')))
        self.assertIn(f'planos={pd}', reg[1].split('\t')[7])
        self.assertIn('armonia-0.5.png', r.stdout)

    def test_final_usa_tamano_completo(self):
        self.probar(BOCETO=self.boceto, MOMENTO='dia', FINAL='1')
        ll = self.llamadas_sd()
        self.assertEqual((self.val(ll[0], '-W'), self.val(ll[0], '-H'), self.val(ll[0], '--steps')), ('1280', '512', '16'))
        self.assertEqual((self.val(ll[1], '-W'), self.val(ll[1], '-H')), ('1024', '384'))

    def test_sin_boceto_ni_ficha_aborta(self):
        r = self.correr(['bash', PROBAR, TIPO, 'sin-ficha', 'fotorreal', '7'], FICHAS=self.fichas, PLANOS=self.prompts)
        self.assertEqual(r.returncode, 3)
        self.assertIn('PLANOS necesita BOCETO o la ficha', r.stdout)
        self.assertFalse(os.path.exists(self.llamadas))

    def test_planos_que_no_es_carpeta_aborta(self):
        r = self.probar(PLANOS=os.path.join(self.d, 'nada'), BOCETO=self.boceto)
        self.assertEqual(r.returncode, 3)
        self.assertIn('PLANOS no es una carpeta', r.stdout)


if __name__ == '__main__':
    unittest.main()
