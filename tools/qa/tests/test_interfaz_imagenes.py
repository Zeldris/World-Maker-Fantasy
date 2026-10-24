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
CABECERA = 'fecha\tnombre\tperfil\tprompt\tsemilla\tpasos\ttamaño\textra\tsalida\tsegundos\n'
# probar.sh falso: escribe lo que haría el de verdad (log, imagen, prompt y fila del registro) y deja en args lo que
# recibió, con el prompt que le llegó por PROMPT_ARCHIVO.
PROBAR = r'''#!/bin/bash
D="$IMG_RAIZ/generated/$1/$2"; N="$3-s$4-p$5-20261024-100000"
mkdir -p "$D/intentos" "$D/logs" "$D/prompts"
{ printf '%s\n' "$@"; echo "LIBERAR_OLLAMA=$LIBERAR_OLLAMA"; [ -n "${PROMPT_ARCHIVO:-}" ] && cat "$PROMPT_ARCHIVO"; } > "$IMG_RAIZ/args"
echo '  |=====>     | 2/4 - 1.10s/it' > "$D/logs/$N.log"
sleep 0.5
echo 'texto del prompt' > "$D/prompts/$N.txt"; printf 'PNG' > "$D/intentos/$N.png"
[ -f "$D/registro.tsv" ] || printf '%s' "$CABECERA" > "$D/registro.tsv"
printf '2026-10-24T10:00\t%s\t%s\tpegado\t%s\t%s\t768x768\t\t0\t3\n' "$N" "$3" "$4" "$5" >> "$D/registro.tsv"
echo "imagen: $D/intentos/$N.png (prompt pegado)"
'''
# psql falso: la lista de entidades para json_agg y, para lo demás, la consulta de prompt_de.
PSQL = '''#!/bin/bash
case "$*" in
  *json_agg*) echo '[{"tipo":"fauna","slug":"nievon","perfil":"thumbnail","usado":true},{"tipo":"fauna","slug":"nievon","perfil":"banner","usado":false},{"tipo":"flora","slug":"musgo","perfil":"icono","usado":false}]' ;;
  *) echo '{"usado":null,"base":"Base prompt"}' ;;
esac
'''


def cargar(raiz, psql='false', api=''):
    os.environ.update(IMG_RAIZ=raiz, IMG_PROBAR=os.path.join(raiz, 'probar.sh'), IMG_PSQL=psql, CABECERA=CABECERA,
                      IMG_API=api, IMG_ESQUEMA=os.path.join(raiz, 'schema.prisma'))
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

    def dir(self, tipo='fauna', slug='nievon'):
        return os.path.join(self.raiz, 'generated', tipo, slug)

    def intento(self, nombre='thumbnail-s42-p4-20261024-100000', tipo='fauna', slug='nievon', perfil='thumbnail',
                fecha='2026-10-24T10:00:00', segundos=90, salida=0, extra='', imagen=True):
        """Apunta un intento como lo haría probar.sh (fila del registro, prompt e imagen)."""
        d = self.dir(tipo, slug)
        ruta = os.path.join(d, 'registro.tsv')
        previo = leer(ruta) if os.path.exists(ruta) else CABECERA
        escribir(ruta, previo + f'{fecha}\t{nombre}\t{perfil}\tbase\t42\t4\t768x768\t{extra}\t{salida}\t{segundos}\n')
        escribir(os.path.join(d, 'prompts', nombre + '.txt'), 'A snow beast\n')
        if imagen:
            escribir(os.path.join(d, 'intentos', nombre + '.png'), 'PNG')
        return nombre


class Validacion(Base):
    def test_rechaza_rutas_tildes_y_espacios_en_tipo_y_slug(self):
        for malo in ('../x', 'a/b', 'nievón', 'a b', '', '-x'):
            with self.assertRaisesRegex(self.s.Invalido, 'solo letras sin tilde'):
                self.s.elemento_dir(malo, 'nievon')
            with self.assertRaisesRegex(self.s.Invalido, 'solo letras sin tilde'):
                self.s.elemento_dir('fauna', malo)

    def test_lanzar_rechaza_perfil_pasos_referencia_y_prompt_vacio(self):
        base = {'tipo': 'fauna', 'slug': 'nievon', 'perfil': 'thumbnail', 'prompt': 'x'}
        for cambio, motivo in (({'perfil': 'poster'}, 'perfil desconocido'), ({'pasos': 50}, 'los pasos: de 1 a 20'),
                               ({'usarReferencia': True}, 'no hay imagen de fauna/nievon'), ({'prompt': '  '}, 'vacío'),
                               ({'slug': '../x'}, 'solo letras sin tilde')):
            with self.subTest(cambio=cambio), self.assertRaisesRegex(self.s.Invalido, motivo):
                self.s.Trabajo().lanzar({**base, **cambio})


class Elemento(Base):
    def test_nota_se_guarda_una_por_intento_y_se_reemplaza(self):
        n = self.intento()
        self.s.guardar_nota('fauna', 'nievon', n, 'demasiado\noscura')
        self.s.guardar_nota('fauna', 'nievon', 'otra', 'bien')
        self.s.guardar_nota('fauna', 'nievon', n, 'mejor con luz')
        notas = leer(os.path.join(self.dir(), 'notas.md'))
        self.assertEqual(notas, f'# Notas de fauna/nievon\n\n- otra: bien\n- {n}: mejor con luz\n')
        self.assertEqual(self.s.leer_elemento('fauna', 'nievon')[0]['nota'], 'mejor con luz')

    def test_elegir_copia_con_el_nombre_del_juego_y_marca_la_elegida(self):
        n = self.intento()
        self.assertEqual(self.s.elegir('fauna', 'nievon', n), 'generated/fauna/nievon/nievon-thumbnail.png')
        self.assertEqual(leer(os.path.join(self.dir(), 'nievon-thumbnail.png')), 'PNG')
        fila = self.s.leer_elemento('fauna', 'nievon')[0]
        self.assertTrue(fila['elegida'])
        self.assertEqual(fila['textoPrompt'], 'A snow beast')

    def test_slug_en_mayusculas_como_en_el_juego(self):
        n = self.intento('icono-s42-p4-20261024-100000', tipo='clase', slug='CAZADOR', perfil='icono')
        self.s.guardar_nota('clase', 'CAZADOR', n, 'bien')
        self.assertEqual(self.s.leer_elemento('clase', 'CAZADOR')[0]['nota'], 'bien')
        self.assertEqual(self.s.elegir('clase', 'CAZADOR', n), 'generated/clase/CAZADOR/CAZADOR-icono.png')

    def test_elegir_sin_imagen_falla_con_motivo(self):
        n = self.intento(imagen=False)
        with self.assertRaisesRegex(self.s.Invalido, 'no hay imagen'):
            self.s.elegir('fauna', 'nievon', n)

    def test_intentos_el_mas_reciente_primero_y_con_referencia(self):
        self.intento('thumbnail-s1-p4-20261024-090000', fecha='2026-10-24T09:00:00')
        self.intento('thumbnail-s3-p4-20261024-110000', fecha='2026-10-24T11:00:00', extra='-r /x/nievon-banner.png')
        self.intento('thumbnail-s2-p4-20261024-100000', fecha='2026-10-24T10:00:00')
        filas = self.s.leer_elemento('fauna', 'nievon')
        self.assertEqual([f['nombre'] for f in filas], ['thumbnail-s3-p4-20261024-110000',
                         'thumbnail-s2-p4-20261024-100000', 'thumbnail-s1-p4-20261024-090000'])
        self.assertEqual([f['conReferencia'] for f in filas], [True, False, False])

    def test_elemento_sin_nada_esta_vacio(self):
        self.assertEqual(self.s.leer_elemento('fauna', 'nievon'), [])


class Elementos(Base):
    def test_une_la_base_y_generated(self):
        psql = os.path.join(self.raiz, 'psql.sh')
        escribir(psql, PSQL)
        os.chmod(psql, 0o755)
        s = cargar(self.raiz, psql)
        escribir(os.path.join(self.raiz, 'referencias', 'images', 'fauna', 'nievon-banner.png'), 'IMG')
        self.intento()
        self.intento('thumbnail-s9-p4-20261024-120000', fecha='2026-10-24T12:00:00')
        self.intento('icono-s1-p4-20261024-100000', tipo='clase', slug='CAZADOR', perfil='icono')
        s_ = s.elegir('fauna', 'nievon', 'thumbnail-s9-p4-20261024-120000')
        self.assertTrue(s_.endswith('nievon-thumbnail.png'))
        lista, aviso = s.elementos()
        self.assertIsNone(aviso)
        por = {(e['tipo'], e['slug']): e for e in lista}
        self.assertEqual(sorted(por), [('clase', 'CAZADOR'), ('fauna', 'nievon'), ('flora', 'musgo')])
        n = por[('fauna', 'nievon')]
        self.assertEqual(n['perfiles'], [{'perfil': 'thumbnail', 'usado': True}, {'perfil': 'banner', 'usado': False}])
        self.assertEqual((n['intentos'], n['elegidas'], n['juego']), (2, ['thumbnail'], 'fauna/nievon-banner.png'))
        self.assertEqual((por[('flora', 'musgo')]['intentos'], por[('flora', 'musgo')]['juego']), (0, None))
        self.assertEqual(por[('clase', 'CAZADOR')]['perfiles'], [])

    def test_sin_base_devuelve_los_de_generated_y_un_aviso(self):
        self.intento()
        lista, aviso = self.s.elementos()  # IMG_PSQL=false: la base no responde
        self.assertEqual([(e['tipo'], e['slug'], e['intentos']) for e in lista], [('fauna', 'nievon', 1)])
        self.assertIn('la base no responde', aviso)

    def test_suma_lo_que_tiene_imagen_en_el_juego_sin_prompt(self):
        refs = os.path.join(self.raiz, 'referencias', 'images')
        for n in ('raza/humano-banner.png', 'raza/humano-thumbnail.webp', 'fauna/nievon-macho-banner.png',
                  'faction/clan-serhu-banner2.png', 'raza/.gitkeep'):
            escribir(os.path.join(refs, n), 'IMG')
        lista, _ = self.s.elementos()
        self.assertEqual([(e['tipo'], e['slug'], e['perfiles'], e['juego']) for e in lista],
                         [('fauna', 'nievon-macho', [], 'fauna/nievon-macho-banner.png'),
                          ('raza', 'humano', [], 'raza/humano-thumbnail.webp')])

    def test_suma_toda_la_enciclopedia_con_su_nombre(self):
        api = os.path.join(self.raiz, 'api')
        escribir(os.path.join(api, 'world', 'helek-sirik', 'enciclopedia'), json.dumps({
            'items': [{'slug': 'resina-jumba-verde', 'name': 'Resina de jumba'}],
            'faunaFlora': [{'sourceSlug': 'murgol-macho', 'sourceName': 'Múrgol macho', 'esFauna': True},
                           {'sourceSlug': 'arena-iman', 'sourceName': 'Arena imán', 'esFauna': False}],
            'constructionRecipes': [{'key': 'choza', 'name': 'Choza'}],
            'historia': [{'slug': 'sello', 'title': 'El sello'}, {'slug': '../x', 'title': 'mala'}],
            'combate': [{'slug': 'no-es-imagen', 'title': 'fuera'}]}))
        s = cargar(self.raiz, api='file://' + api)
        lista, aviso = s.elementos()
        self.assertIn('la base no responde', aviso)
        self.assertEqual([(e['tipo'], e['slug'], e['nombre']) for e in lista],
                         [('construccion', 'choza', 'Choza'), ('fauna', 'murgol-macho', 'Múrgol macho'),
                          ('flora', 'arena-iman', 'Arena imán'), ('historia', 'sello', 'El sello'),
                          ('item', 'resina-jumba-verde', 'Resina de jumba')])

    def test_suma_lo_anidado_las_habilidades_y_las_clases_del_esquema(self):
        api = os.path.join(self.raiz, 'api')
        escribir(os.path.join(api, 'world', 'helek-sirik', 'enciclopedia'), json.dumps({
            'npcs': [{'slug': 'hulki', 'name': 'Hulki', 'variantesSexo': [{'sexo': 'macho'}]}],
            'razas': [{'slug': 'goirntes', 'name': 'Goirntes',
                       'variantes': [{'slug': 'goirntes-meseta', 'name': 'De la Meseta',
                                      'variantesSexo': [{'sexo': 'hembra'}]}]}],
            'locations': [{'slug': 'yegr-kegi', 'name': 'Yegr Kegi',
                           'variantesTiempo': [{'momento': 'noche', 'estacion': 'otono'}]}],
            'classes': [{'name': 'GUERRERO', 'unlocks': [{'ability': {'name': 'Firmeza Férrea'}}]}]}))
        escribir(os.path.join(self.raiz, 'schema.prisma'),
                 'enum Clase {\n  GUERRERO\n  MAGO\n}\nenum Especializacion {\n  PODER_MAGIA\n}\n')
        lista, _ = cargar(self.raiz, api='file://' + api).elementos()
        self.assertEqual([(e['tipo'], e['slug'], e['nombre']) for e in lista], [
            ('ability', 'firmeza-ferrea', 'Firmeza Férrea'),
            ('clase', 'GUERRERO', 'Guerrero'), ('clase', 'MAGO', 'Mago'),
            ('especializacion', 'PODER_MAGIA', 'Poder magia'),
            ('location', 'yegr-kegi', 'Yegr Kegi'), ('location', 'yegr-kegi-noche-otono', 'Yegr Kegi (noche-otono)'),
            ('npc', 'hulki', 'Hulki'), ('npc', 'hulki-macho', 'Hulki (macho)'),
            ('raza', 'goirntes', 'Goirntes'), ('raza', 'goirntes-meseta', 'De la Meseta'),
            ('raza', 'goirntes-meseta-hembra', 'De la Meseta (hembra)'),
            ('zona', 'yegr-kegi', 'Yegr Kegi (mapa)'), ('zona', 'yegr-kegi-noche-otono', 'Yegr Kegi (mapa, noche-otono)')])

    def test_sin_backend_lo_avisa_y_sigue(self):
        self.intento()
        lista, aviso = cargar(self.raiz, api='http://127.0.0.1:9').elementos()
        self.assertEqual([e['slug'] for e in lista], ['nievon'])
        self.assertIn('arranca el juego para verlo entero', aviso)

    def test_sin_generated_ni_base_la_lista_esta_vacia(self):
        self.assertEqual(self.s.elementos()[0], [])


class Estimado(Base):
    def test_mediana_por_perfil_y_con_o_sin_referencia_en_todo_generated(self):
        for i, seg in enumerate((100, 120, 140)):
            self.intento(f'thumbnail-s{i}-p4-2026102410000{i}', segundos=seg)
        self.intento('thumbnail-s5-p4-20261024-100005', tipo='flora', slug='musgo', segundos=104)
        self.intento('thumbnail-s6-p4-20261024-100006', segundos=500, salida=1)  # fallido: no cuenta
        self.intento('banner-s7-p4-20261024-100007', perfil='banner', segundos=999)  # otro perfil
        self.intento('thumbnail-s8-p4-20261024-100008', segundos=200, extra='-r /x.png')
        self.intento('thumbnail-s9-p4-20261024-100009', segundos=220, extra='-r /y.png')
        self.assertEqual(self.s.estimado('thumbnail', False), 112)  # mediana de 100, 104, 120, 140
        self.assertEqual(self.s.estimado('thumbnail', True), 210)
        self.assertEqual(self.s.estimado('banner', False), 999)

    def test_por_defecto_sin_datos_y_mas_con_referencia(self):
        for perfil, base in (('thumbnail', 105), ('banner', 110), ('mapa', 110), ('icono', 80)):
            with self.subTest(perfil=perfil):
                self.assertEqual(self.s.estimado(perfil, False), base)
                self.assertEqual(self.s.estimado(perfil, True), round(base * 1.9))


class Progreso(Base):
    def log(self, texto):
        escribir(os.path.join(self.dir(), 'logs', 'a.log'), texto)

    def test_lee_el_paso_del_muestreo_y_no_la_carga_de_pesos(self):
        self.log('|##########| 4/4 - 847.00MB/s\n')
        self.assertEqual(self.s.leer_progreso('fauna', 'nievon', time.time()), ('cargando modelos', None, None))
        self.log('|##########| 4/4 - 847.00MB/s\n  |====>     | 3/4 - 1.26it/s\n')
        self.assertEqual(self.s.leer_progreso('fauna', 'nievon', time.time()), ('muestreo 3/4', 3, 4))
        self.log('|==========| 4/4 - 1.30s/it\n')
        self.assertEqual(self.s.progreso('fauna', 'nievon', time.time()), 'decodificando la imagen')
        self.log('|==========| 4/4 - 1.30s/it\ndecode_first_stage completed\n')
        self.assertEqual(self.s.progreso('fauna', 'nievon', time.time()), 'guardando la imagen')

    def test_un_log_de_antes_de_empezar_no_cuenta(self):
        self.log('| 2/4 - 1.0it/s\n')
        self.assertEqual(self.s.progreso('fauna', 'nievon', time.time() + 10), 'preparando')


class Http(Base):
    def setUp(self):
        super().setUp()
        psql = os.path.join(self.raiz, 'psql.sh')
        escribir(psql, PSQL)
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

    def bytes(self, ruta):
        with urllib.request.urlopen(f'http://127.0.0.1:{self.puerto}{ruta}', timeout=10) as r:
            return r.headers['Content-Type'], r.read()

    def esperar(self):
        for _ in range(100):
            estado = self.pedir('/api/estado')[1]
            if not estado['enMarcha']:
                return estado
            time.sleep(0.1)
        self.fail('la generación no acaba')

    def test_genera_con_el_prompt_pegado_una_sola_a_la_vez_y_el_elemento_la_muestra(self):
        peticion = {'tipo': 'fauna', 'slug': 'nievon', 'perfil': 'thumbnail', 'semilla': 7, 'pasos': 4,
                    'prompt': 'A pasted prompt'}
        self.assertEqual(self.pedir('/api/generar', peticion), (202, {'ok': True}))
        en_marcha = self.pedir('/api/estado')[1]
        self.assertEqual((en_marcha['enMarcha'], en_marcha['estimado'], en_marcha['perfil']), (True, 105, 'thumbnail'))
        codigo, error = self.pedir('/api/generar', peticion)
        self.assertEqual((codigo, error['error']), (400, 'ya hay una imagen generándose; espera a que acabe'))
        estado = self.esperar()
        self.assertEqual((estado['rc'], estado['nombre']), (0, 'thumbnail-s7-p4-20261024-100000'))
        self.assertEqual((estado['paso'], estado['pasos']), (2, 4))
        args = leer(os.path.join(self.raiz, 'args')).split('\n')
        self.assertEqual(args[:6], ['fauna', 'nievon', 'thumbnail', '7', '4', 'LIBERAR_OLLAMA=1'])
        self.assertEqual(args[6], 'A pasted prompt')
        filas = self.pedir('/api/elemento?tipo=fauna&slug=nievon')[1]
        self.assertEqual([f['nombre'] for f in filas], ['thumbnail-s7-p4-20261024-100000'])
        self.assertTrue(filas[0]['imagen'])
        self.assertEqual(self.bytes('/img/fauna/nievon/thumbnail-s7-p4-20261024-100000.png'), ('image/png', b'PNG'))

    def test_desde_base_no_pasa_prompt_archivo(self):
        self.pedir('/api/generar', {'tipo': 'fauna', 'slug': 'nievon', 'perfil': 'thumbnail', 'desdeBase': True})
        self.esperar()
        self.assertEqual(leer(os.path.join(self.raiz, 'args')).split('\n')[5:], ['LIBERAR_OLLAMA=1', ''])

    def test_nota_y_elegir_por_http_y_se_sirve_la_elegida(self):
        n = self.intento()
        self.assertEqual(self.pedir('/api/nota', {'tipo': 'fauna', 'slug': 'nievon', 'nombre': n, 'texto': 'bien'})[0], 200)
        codigo, r = self.pedir('/api/elegir', {'tipo': 'fauna', 'slug': 'nievon', 'nombre': n})
        self.assertEqual((codigo, r), (200, {'destino': 'generated/fauna/nievon/nievon-thumbnail.png'}))
        fila = self.pedir('/api/elemento?tipo=fauna&slug=nievon')[1][0]
        self.assertEqual((fila['nota'], fila['elegida']), ('bien', True))
        self.assertEqual(self.bytes('/elegida/fauna/nievon/thumbnail.png'), ('image/png', b'PNG'))
        self.assertEqual(self.pedir('/elegida/fauna/nievon/poster.png')[0], 400)
        self.assertEqual(self.pedir('/img/fauna/..%2Fx/a.png')[0], 400)

    def test_elementos_por_http(self):
        self.intento(tipo='flora', slug='musgo')
        codigo, r = self.pedir('/api/elementos')
        self.assertEqual((codigo, r['aviso']), (200, None))
        self.assertEqual([(e['tipo'], e['slug']) for e in r['elementos']], [('fauna', 'nievon'), ('flora', 'musgo')])

    def test_prompt_de_la_base_y_errores_de_entrada(self):
        self.assertEqual(self.pedir('/api/prompt?tipo=fauna&slug=nievon&perfil=thumbnail'),
                         (200, {'prompt': 'Base prompt', 'fuente': 'base'}))
        self.assertEqual(self.pedir('/api/prompt?tipo=fauna&slug=nievon&perfil=x')[0], 400)
        self.assertEqual(self.pedir('/api/elemento?tipo=fauna&slug=..%2Fx')[0], 400)


class Referencia(Http):
    """La imagen que el juego ya tiene de la entidad (referencias/images/<tipo>/<slug>-<perfil>.<ext>)."""

    def poner(self, archivo, contenido='JPG'):
        escribir(os.path.join(self.raiz, 'referencias', 'images', 'fauna', archivo), contenido)

    def test_la_del_perfil_y_si_no_la_de_otro_perfil(self):
        self.assertEqual(self.pedir('/api/referencia?tipo=fauna&slug=nievon&perfil=thumbnail'), (200, {'ruta': None}))
        self.poner('nievon-banner.jpeg')
        self.assertEqual(self.pedir('/api/referencia?tipo=fauna&slug=nievon&perfil=thumbnail')[1],
                         {'ruta': 'fauna/nievon-banner.jpeg', 'perfil': 'banner'})
        self.poner('nievon-thumbnail.png')
        self.assertEqual(self.pedir('/api/referencia?tipo=fauna&slug=nievon&perfil=thumbnail')[1],
                         {'ruta': 'fauna/nievon-thumbnail.png', 'perfil': 'thumbnail'})
        self.assertEqual(self.pedir('/api/referencia?tipo=..&slug=nievon&perfil=thumbnail')[0], 400)

    def test_sirve_la_vista_previa_y_nada_fuera_de_referencias(self):
        self.poner('nievon-banner.jpeg', 'IMAGEN')
        with urllib.request.urlopen(f'http://127.0.0.1:{self.puerto}/ref/fauna/nievon-banner.jpeg', timeout=10) as r:
            self.assertEqual((r.headers['Content-Type'], r.read()), ('image/jpeg', b'IMAGEN'))
        for malo in ('/ref/fauna/nievon-banner.txt', '/ref/..%2F..%2Fx/a.png', '/ref/fauna/otro-banner.png'):
            with self.subTest(malo=malo):
                self.assertIn(self.pedir(malo)[0], (400, 404))

    def test_generar_con_la_casilla_pasa_la_referencia_a_probar(self):
        self.poner('nievon-thumbnail.png')
        self.pedir('/api/generar', {'tipo': 'fauna', 'slug': 'nievon', 'perfil': 'thumbnail',
                                    'desdeBase': True, 'usarReferencia': True})
        self.assertEqual(self.pedir('/api/estado')[1]['estimado'], 200)  # 105 × 1,9 sin datos
        self.esperar()
        args = leer(os.path.join(self.raiz, 'args'))
        self.assertIn('-r\n' + os.path.join(self.raiz, 'referencias', 'images', 'fauna', 'nievon-thumbnail.png'), args)


if __name__ == '__main__':
    unittest.main()
