#!/usr/bin/env python3
"""MAP-5, MAP-6: sirve el visor y editor local de helek.json (sin red: escucha solo en 127.0.0.1).

    python3 map-generator/servir.py              # http://127.0.0.1:8765/
    python3 map-generator/servir.py --puerto 0   # un puerto libre

Rutas (solo estas; nada más del disco se sirve):
    /               el visor (visor/index.html)
    /helek.json     el mapa (mundo/helek.json)
    /medidas.json   área y envolvente de cada región, provincia y continente, y el canon con lo medido,
                    calculado con medir.py y geometria.py (las mismas cuentas que el test del canon)
    POST /comprobar un lote de cambios (editar.py): qué medidas cambian, canon y lore; no escribe nada
    POST /guardar   lo mismo y, si el lote parte del helek.json actual (`base`), lo escribe con su GeoJSON y el
                    archivo del juego. Si el canon o el lore fallan, solo con `"forzar": true`.

Los POST solo se aceptan en JSON y desde la propia página (cabecera Origin), para que otra web abierta en el
navegador no pueda escribir el mapa.
"""
import argparse
import functools
import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import editar  # noqa: E402
import medir  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
VISOR = os.path.join(AQUI, 'visor', 'index.html')
HOST = '127.0.0.1'
MAX_CUERPO = 4 * 1024 * 1024
_GUARDANDO = threading.Lock()


medidas = medir.medidas  # el visor y el editor (MAP-6) usan las mismas cuentas


class Visor(BaseHTTPRequestHandler):
    def __init__(self, *args, mundo_ruta, canon_ruta, lore_ruta, juego_ruta, **kw):
        self.mundo_ruta = mundo_ruta
        self.canon_ruta = canon_ruta
        self.lore_ruta = lore_ruta
        self.juego_ruta = juego_ruta
        super().__init__(*args, **kw)

    def _enviar(self, cuerpo, tipo, codigo=200, cabeceras=()):
        self.send_response(codigo)
        for k, v in cabeceras:
            self.send_header(k, v)
        self.send_header('Content-Type', tipo)
        self.send_header('Content-Length', str(len(cuerpo)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_GET(self):  # noqa: N802 (nombre de http.server)
        ruta = self.path.split('?', 1)[0]
        if ruta in ('/', '/index.html'):
            with open(VISOR, 'rb') as f:
                return self._enviar(f.read(), 'text/html; charset=utf-8')
        if ruta == '/helek.json':
            with open(self.mundo_ruta, 'rb') as f:
                datos = f.read()
            return self._enviar(datos, 'application/json', cabeceras=[('X-Huella', editar.huella(datos))])
        if ruta == '/medidas.json':
            with open(self.canon_ruta, encoding='utf-8') as f:
                canon = json.load(f)
            cuerpo = json.dumps(medidas(medir.cargar(self.mundo_ruta), canon), ensure_ascii=False)
            return self._enviar(cuerpo.encode('utf-8'), 'application/json')
        self.send_error(404, 'El visor solo sirve /, /helek.json y /medidas.json')

    def _json(self, datos, codigo=200):
        self._enviar(json.dumps(datos, ensure_ascii=False).encode('utf-8'), 'application/json', codigo)

    def _origen_propio(self):
        origen = self.headers.get('Origin')
        if origen is None:
            return True
        puerto = self.server.server_address[1]
        return origen in (f'http://{HOST}:{puerto}', f'http://localhost:{puerto}')

    def do_POST(self):  # noqa: N802 (nombre de http.server)
        ruta = self.path.split('?', 1)[0]
        if ruta not in ('/comprobar', '/guardar'):
            return self.send_error(404, 'El editor solo acepta POST en /comprobar y /guardar')
        tipo = (self.headers.get('Content-Type') or '').split(';')[0].strip()
        if tipo != 'application/json' or not self._origen_propio():
            return self._json({'error': 'solo se aceptan cambios en JSON desde el propio visor'}, 403)
        largo = int(self.headers.get('Content-Length') or 0)
        if largo <= 0 or largo > MAX_CUERPO:
            return self._json({'error': f'cuerpo vacío o de más de {MAX_CUERPO} bytes'}, 413)
        try:
            cambios = json.loads(self.rfile.read(largo))
            if not isinstance(cambios, dict):
                raise ValueError('se espera un objeto')
        except ValueError as e:
            return self._json({'error': f'JSON no válido: {e}'}, 400)
        with _GUARDANDO:
            with open(self.mundo_ruta, 'rb') as f:
                datos = f.read()
            if cambios.get('base') != editar.huella(datos):
                return self._json({'error': 'helek.json ha cambiado desde que se abrió el visor: recarga la página '
                                            '(se pierden los cambios sin guardar)'}, 409)
            antes = json.loads(datos)
            try:
                despues = editar.aplicar(antes, cambios)
            except editar.ErrorDeEdicion as e:
                return self._json({'error': str(e)}, 400)
            inf = editar.informe(antes, despues, editar.cargar_json(self.canon_ruta), editar.cargar_json(self.lore_ruta))
            inf['guardado'] = False
            if ruta == '/guardar':
                if not inf['ok'] and not cambios.get('forzar'):
                    inf['error'] = 'el canon o el lore no se cumplen: no se guarda sin confirmarlo'
                    return self._json(inf, 422)
                inf['huella'] = editar.guardar(despues, self.mundo_ruta, ruta_juego=self.juego_ruta)
                inf['guardado'] = True
        return self._json(inf)

    def log_message(self, formato, *args):
        pass


def servidor(puerto=8765, mundo=medir.MUNDO, canon=medir.CANON, lore=editar.comprobar.LORE,
             juego=editar.exportar.SALIDA):
    """`juego=None` no escribe el archivo del juego al guardar (para probar con una copia del mapa)."""
    manejador = functools.partial(Visor, mundo_ruta=mundo, canon_ruta=canon, lore_ruta=lore, juego_ruta=juego)
    return ThreadingHTTPServer((HOST, puerto), manejador)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--puerto', type=int, default=8765)
    ap.add_argument('--mundo', default=medir.MUNDO)
    ap.add_argument('--canon', default=medir.CANON)
    ap.add_argument('--lore', default=editar.comprobar.LORE)
    ap.add_argument('--sin-juego', action='store_true', help='al guardar, no reescribe el archivo del juego')
    args = ap.parse_args(argv)
    srv = servidor(args.puerto, args.mundo, args.canon, args.lore, None if args.sin_juego else editar.exportar.SALIDA)
    print(f'Visor y editor del mapa en http://{HOST}:{srv.server_address[1]}/  (Ctrl+C para cerrar)', flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
