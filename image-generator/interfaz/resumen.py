#!/usr/bin/env python3
"""Lo que enseña la interfaz del generador, en unas líneas de texto (retro de `CFG-43`): elementos por tipo, el aviso
de la lista y el estado del trabajo. Para comprobar la lista o el progreso sin una captura de la página; la captura,
solo para lo visual.

Uso: python3 image-generator/interfaz/resumen.py [--tipo <tipo>] [--url http://127.0.0.1:7861]
"""
import argparse
import json
import os
import sys
import urllib.request
from collections import Counter


def pedir(base, ruta):
    with urllib.request.urlopen(base + ruta, timeout=60) as r:
        return json.load(r)


def resumen(lista, aviso, estado, tipo=None):
    lineas = []
    por_tipo = Counter(e['tipo'] for e in lista)
    lineas.append(f'{len(lista)} elementos: ' + ', '.join(f'{t} {n}' for t, n in sorted(por_tipo.items())))
    lineas.append('con intentos: %d · con elegida: %d · con imagen del juego: %d' % (
        sum(1 for e in lista if e.get('intentos')), sum(1 for e in lista if e.get('elegidas')),
        sum(1 for e in lista if e.get('juego'))))
    if aviso:
        lineas.append(f'aviso: {aviso}')
    if tipo:
        for e in (e for e in lista if e['tipo'] == tipo):
            marcas = [f"{e['intentos']} intentos"] if e.get('intentos') else []
            marcas += ['✓ elegida'] if e.get('elegidas') else []
            marcas += ['juego'] if e.get('juego') else []
            lineas.append(f"  {e['slug']} · {e.get('nombre') or ''}" + (f" ({', '.join(marcas)})" if marcas else ''))
    if estado.get('enMarcha'):
        lineas.append('trabajo: %s/%s %s · paso %s/%s · %s s de ~%s s' % (
            estado.get('tipo'), estado.get('slug'), estado.get('perfil'), estado.get('paso'), estado.get('pasos'),
            estado.get('segundos'), estado.get('estimado')))
    elif estado.get('inicio'):
        fin = 'falló (rc %s)' % estado['rc'] if estado.get('rc') else 'lista'
        lineas.append(f"último trabajo: {estado.get('tipo')}/{estado.get('slug')} {estado.get('perfil')} · {fin} "
                      f"en {estado.get('segundos')} s")
        if estado.get('logFinal'):
            lineas.append('final del log: ' + estado['logFinal'].strip().splitlines()[-1][:200])
    else:
        lineas.append('trabajo: ninguno desde que arrancó la interfaz')
    return '\n'.join(lineas)


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument('--tipo', help='lista además los elementos de ese tipo, con sus marcas')
    p.add_argument('--url', default=f"http://127.0.0.1:{os.environ.get('IMG_PUERTO', '7861')}")
    a = p.parse_args()
    try:
        els, estado = pedir(a.url, '/api/elementos'), pedir(a.url, '/api/estado')
    except OSError as err:
        sys.exit(f'la interfaz no responde en {a.url} ({err}); arráncala con image-generator/abrir.sh')
    print(resumen(els['elementos'], els.get('aviso'), estado, a.tipo))


if __name__ == '__main__':
    main()
