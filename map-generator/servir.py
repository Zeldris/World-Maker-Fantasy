#!/usr/bin/env python3
"""MAP-5: sirve el visor local de helek.json (sin red: escucha solo en 127.0.0.1).

    python3 map-generator/servir.py              # http://127.0.0.1:8765/
    python3 map-generator/servir.py --puerto 0   # un puerto libre

Rutas (solo estas; nada más del disco se sirve):
    /               el visor (visor/index.html)
    /helek.json     el mapa (mundo/helek.json)
    /medidas.json   área y envolvente de cada región, provincia y continente, y el canon con lo medido,
                    calculado con medir.py y geometria.py (las mismas cuentas que el test del canon)
"""
import argparse
import functools
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import geometria  # noqa: E402
import medir  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
VISOR = os.path.join(AQUI, 'visor', 'index.html')
HOST = '127.0.0.1'


def _medida(mundo, filtro):
    polis = medir._poligonos(mundo, filtro)
    pts = [q for p in polis for q in p[0]]
    caja = [min(q[0] for q in pts), min(q[1] for q in pts), max(q[0] for q in pts), max(q[1] for q in pts)] \
        if pts else None
    km = mundo['fuente']['kmPorUnidad']
    ancho, alto = geometria.envolvente(polis)
    return {'area': geometria.area(polis) * km * km, 'envolvente': [ancho * km, alto * km], 'caja': caja}


def medidas(mundo, canon):
    """Lo que el visor muestra al pasar el ratón, por id, y el canon con lo medido."""
    def por(clave, lista):
        return {str(e['i']): _medida(mundo, lambda c, i=e['i']: c[clave] == i) for e in lista}
    return {
        'regiones': por('region', mundo['regiones']),
        'provincias': por('provincia', mundo['provincias']),
        'continentes': por('continente', mundo['continentes']),
        'canon': [{**e, 'medido': m, 'dentro': ok} for e, m, ok in medir.comprobar(mundo, canon)],
    }


class Visor(BaseHTTPRequestHandler):
    def __init__(self, *args, mundo_ruta, canon_ruta, **kw):
        self.mundo_ruta = mundo_ruta
        self.canon_ruta = canon_ruta
        super().__init__(*args, **kw)

    def _enviar(self, cuerpo, tipo):
        self.send_response(200)
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
                return self._enviar(f.read(), 'application/json')
        if ruta == '/medidas.json':
            with open(self.canon_ruta, encoding='utf-8') as f:
                canon = json.load(f)
            cuerpo = json.dumps(medidas(medir.cargar(self.mundo_ruta), canon), ensure_ascii=False)
            return self._enviar(cuerpo.encode('utf-8'), 'application/json')
        self.send_error(404, 'El visor solo sirve /, /helek.json y /medidas.json')

    def log_message(self, formato, *args):
        pass


def servidor(puerto=8765, mundo=medir.MUNDO, canon=medir.CANON):
    manejador = functools.partial(Visor, mundo_ruta=mundo, canon_ruta=canon)
    return ThreadingHTTPServer((HOST, puerto), manejador)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--puerto', type=int, default=8765)
    ap.add_argument('--mundo', default=medir.MUNDO)
    ap.add_argument('--canon', default=medir.CANON)
    args = ap.parse_args(argv)
    srv = servidor(args.puerto, args.mundo, args.canon)
    print(f'Visor del mapa en http://{HOST}:{srv.server_address[1]}/  (Ctrl+C para cerrar)', flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
