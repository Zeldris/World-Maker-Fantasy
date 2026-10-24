"""CFG-43: la interfaz del generador de imágenes (image-generator/interfaz/servidor.py), con probar.sh y psql falsos."""
import importlib.util
import json
import os
import shutil
import socket
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request

from comun import RAIZ, escribir, leer

SERVIDOR = os.path.join(RAIZ, 'image-generator', 'interfaz', 'servidor.py')
CABECERA = 'fecha\tnombre\ttipo\tslug\tperfil\tprompt\tsemilla\tpasos\ttamaño\textra\tsalida\tsegundos\n'
# probar.sh falso: escribe lo que haría el de verdad (log, imagen, prompt y fila del registro) y deja en args lo que
# recibió, con el prompt que le llegó por PROMPT_ARCHIVO.
PROBAR = r'''#!/bin/bash
D="$IMG_RAIZ/pruebas/$1"; N="$1-$2-$3-$4-s$5-p$6"
mkdir -p "$D/imagenes" "$D/logs" "$D/prompts"
{ printf '%s\n' "$@"; echo "LIBERAR_OLLAMA=$LIBERAR_OLLAMA"; [ -n "${PROMPT_ARCHIVO:-}" ] && cat "$PROMPT_ARCHIVO"; } > "$IMG_RAIZ/args"
echo '  |=====>     | 2/4 - 1.10s/it' > "$D/logs/$N.log"
sleep 0.5
echo 'texto del prompt' > "$D/prompts/$N.txt"; printf 'PNG' > "$D/imagenes/$N.png"
[ -f "$D/registro.tsv" ] || printf '%s' "$CABECERA" > "$D/registro.tsv"
printf '2026-10-24T10:00\t%s\t%s\t%s\t%s\tpegado\t%s\t%s\t768x768\t\t0\t3\n' "$N" "$2" "$3" "$4" "$5" "$6" >> "$D/registro.tsv"
echo "imagen: $D/imagenes/$N.png (prompt pegado)"
'''


def cargar(raiz, psql='false'):
    os.environ.update(IMG_RAIZ=raiz, IMG_PROBAR=os.path.join(raiz, 'probar.sh'), IMG_PSQL=psql, CABECERA=CABECERA)
    spec = importlib.util.spec_from_file_location('servidor_imagenes', SERVIDOR)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class Base(unittest.TestCase):
    def setUp(self):
        self.raiz = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.raiz, True)
        escribir(os.path.join(self.raiz, 'probar.sh'), PROBAR)
        os.chmod(os.path.join(self.raiz, 'probar.sh'), 0o755)
        self.s = cargar(self.raiz)

    def tanda_con(self, nombre='t1-fauna-nievon-thumbnail-s42-p4', imagen=True):
        d = os.path.join(self.raiz, 'pruebas', 't1')
        escribir(os.path.join(d, 'registro.tsv'), CABECERA +
                 f'2026-10-24T10:00\t{nombre}\tfauna\tnievon\tthumbnail\tbase\t42\t4\t768x768\t\t0\t90\n')
        escribir(os.path.join(d, 'prompts', nombre + '.txt'), 'A snow beast\n')
        if imagen:
            escribir(os.path.join(d, 'imagenes', nombre + '.png'), 'PNG')
        return nombre


class Validacion(Base):
    def test_rechaza_rutas_tildes_y_espacios_en_tanda_tipo_y_slug(self):
        for malo in ('../x', 'a/b', 'nievón', 'a b', '', '-x'):
            with self.assertRaisesRegex(self.s.Invalido, 'solo letras sin tilde'):
                self.s.pruebas(malo)

    def test_lanzar_rechaza_perfil_pasos_referencia_y_prompt_vacio(self):
        base = {'tanda': 't1', 'tipo': 'fauna', 'slug': 'nievon', 'perfil': 'thumbnail', 'prompt': 'x'}
        for cambio, motivo in (({'perfil': 'poster'}, 'perfil desconocido'), ({'pasos': 50}, 'los pasos: de 1 a 20'),
                               ({'referencia': '../../etc.png'}, 'no hay referencia'), ({'prompt': '  '}, 'vacío')):
            with self.subTest(cambio=cambio), self.assertRaisesRegex(self.s.Invalido, motivo):
                self.s.Trabajo().lanzar({**base, **cambio})


class Tanda(Base):
    def test_nota_se_guarda_una_por_imagen_y_se_reemplaza(self):
        n = self.tanda_con()
        self.s.guardar_nota('t1', n, 'demasiado\noscura')
        self.s.guardar_nota('t1', 'otra', 'bien')
        self.s.guardar_nota('t1', n, 'mejor con luz')
        notas = leer(os.path.join(self.raiz, 'pruebas', 't1', 'notas.md'))
        self.assertEqual(notas, f'# Notas de la tanda t1\n\n- otra: bien\n- {n}: mejor con luz\n')
        self.assertEqual(self.s.leer_tanda('t1')[0]['nota'], 'mejor con luz')

    def test_elegir_copia_con_el_nombre_del_juego_y_marca_la_elegida(self):
        n = self.tanda_con()
        self.assertEqual(self.s.elegir('t1', n), 'salida/images/fauna/nievon-thumbnail.png')
        self.assertEqual(leer(os.path.join(self.raiz, 'salida', 'images', 'fauna', 'nievon-thumbnail.png')), 'PNG')
        fila = self.s.leer_tanda('t1')[0]
        self.assertTrue(fila['elegida'])
        self.assertEqual(fila['textoPrompt'], 'A snow beast')

    def test_slug_en_mayusculas_como_en_el_juego(self):
        n = self.tanda_con('t1-clase-CAZADOR-icono-s42-p4')
        self.s.guardar_nota('t1', n, 'bien')
        with open(os.path.join(self.raiz, 'pruebas', 't1', 'registro.tsv'), 'w', encoding='utf-8') as f:
            f.write(CABECERA + f'2026-10-24T10:00\t{n}\tclase\tCAZADOR\ticono\tbase\t42\t4\t512x512\t\t0\t60\n')
        self.assertEqual(self.s.leer_tanda('t1')[0]['nota'], 'bien')
        self.assertEqual(self.s.elegir('t1', n), 'salida/images/clase/CAZADOR-icono.png')

    def test_tandas_la_mas_reciente_primero(self):
        for i, t in enumerate(('zeta', '2026-10-24')):
            os.makedirs(os.path.join(self.raiz, 'pruebas', t))
            os.utime(os.path.join(self.raiz, 'pruebas', t), (1000 + i, 1000 + i))
        self.assertEqual(self.s.tandas(), ['2026-10-24', 'zeta'])

    def test_elegir_sin_imagen_falla_con_motivo(self):
        n = self.tanda_con(imagen=False)
        with self.assertRaisesRegex(self.s.Invalido, 'no hay imagen'):
            self.s.elegir('t1', n)


class Progreso(Base):
    def log(self, texto):
        escribir(os.path.join(self.raiz, 'pruebas', 't1', 'logs', 'a.log'), texto)

    def test_lee_el_paso_del_muestreo_y_no_la_carga_de_pesos(self):
        self.log('|##########| 4/4 - 847.00MB/s\n')
        self.assertEqual(self.s.progreso('t1', time.time()), 'cargando modelos')
        self.log('|##########| 4/4 - 847.00MB/s\n  |====>     | 3/4 - 1.26it/s\n')
        self.assertEqual(self.s.progreso('t1', time.time()), 'muestreo 3/4')
        self.log('|==========| 4/4 - 1.30s/it\n')
        self.assertEqual(self.s.progreso('t1', time.time()), 'decodificando la imagen')
        self.log('|==========| 4/4 - 1.30s/it\ndecode_first_stage completed\n')
        self.assertEqual(self.s.progreso('t1', time.time()), 'guardando la imagen')

    def test_un_log_de_antes_de_empezar_no_cuenta(self):
        self.log('| 2/4 - 1.0it/s\n')
        self.assertEqual(self.s.progreso('t1', time.time() + 10), 'preparando')


class Http(Base):
    def setUp(self):
        super().setUp()
        psql = os.path.join(self.raiz, 'psql.sh')  # psql falso: responde a la consulta de prompt_de
        escribir(psql, '#!/bin/bash\necho \'{"usado":null,"base":"Base prompt"}\'\n')
        os.chmod(psql, 0o755)
        self.s = cargar(self.raiz, psql)
        with socket.socket() as so:
            so.bind(('127.0.0.1', 0))
            self.puerto = so.getsockname()[1]
        self.srv = self.s.ThreadingHTTPServer(('127.0.0.1', self.puerto), self.s.Manejador)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.addCleanup(self.srv.server_close)
        self.addCleanup(self.srv.shutdown)

    def pedir(self, ruta, cuerpo=None):
        datos = None if cuerpo is None else json.dumps(cuerpo).encode()
        r = urllib.request.Request(f'http://127.0.0.1:{self.puerto}{ruta}', data=datos,
                                   headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(r, timeout=10) as resp:
                return resp.status, json.loads(resp.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def test_genera_con_el_prompt_pegado_una_sola_a_la_vez_y_la_tanda_la_muestra(self):
        peticion = {'tanda': 't1', 'tipo': 'fauna', 'slug': 'nievon', 'perfil': 'thumbnail', 'semilla': 7,
                    'pasos': 4, 'prompt': 'A pasted prompt'}
        self.assertEqual(self.pedir('/api/generar', peticion), (202, {'ok': True}))
        codigo, error = self.pedir('/api/generar', peticion)
        self.assertEqual((codigo, error['error']), (400, 'ya hay una imagen generándose; espera a que acabe'))
        for _ in range(100):
            estado = self.pedir('/api/estado')[1]
            if not estado['enMarcha']:
                break
            time.sleep(0.1)
        self.assertEqual((estado['rc'], estado['nombre']), (0, 't1-fauna-nievon-thumbnail-s7-p4'))
        args = leer(os.path.join(self.raiz, 'args')).split('\n')
        self.assertEqual(args[:7], ['t1', 'fauna', 'nievon', 'thumbnail', '7', '4', 'LIBERAR_OLLAMA=1'])
        self.assertEqual(args[7], 'A pasted prompt')
        filas = self.pedir('/api/tanda?tanda=t1')[1]
        self.assertEqual([f['nombre'] for f in filas], ['t1-fauna-nievon-thumbnail-s7-p4'])
        self.assertTrue(filas[0]['imagen'])

    def test_desde_base_no_pasa_prompt_archivo(self):
        self.pedir('/api/generar', {'tanda': 't1', 'tipo': 'fauna', 'slug': 'nievon', 'perfil': 'thumbnail',
                                    'desdeBase': True})
        for _ in range(100):
            if not self.pedir('/api/estado')[1]['enMarcha']:
                break
            time.sleep(0.1)
        self.assertEqual(leer(os.path.join(self.raiz, 'args')).split('\n')[6:], ['LIBERAR_OLLAMA=1', ''])

    def test_prompt_de_la_base_y_errores_de_entrada(self):
        self.assertEqual(self.pedir('/api/prompt?tipo=fauna&slug=nievon&perfil=thumbnail'),
                         (200, {'prompt': 'Base prompt', 'fuente': 'base'}))
        self.assertEqual(self.pedir('/api/prompt?tipo=fauna&slug=nievon&perfil=x')[0], 400)
        self.assertEqual(self.pedir('/api/tanda?tanda=..%2Fx')[0], 400)


if __name__ == '__main__':
    unittest.main()
