#!/usr/bin/env python3
"""MAP-9: historial de guardados de helek.json, para deshacer un guardado o volver a una versión.

Cada guardado (`editar.guardar`) deja aquí, junto al mapa (`mundo/historial/`, fuera de git):
    <huella>.json    el helek.json de esa versión, tal cual (una copia por versión, aunque se repita)
    registro.jsonl   una línea por guardado: {"fecha", "tipo", "antes", "despues", "resumen"} y, al deshacer, "deshace"

`tipo` es `guardar` (un lote del visor o de la consola), `deshacer` o `restaurar`. Deshacer vuelve a la versión de
antes del último guardado o restauración que llevó al mapa actual y no esté ya deshecho; repetirlo sigue hacia atrás
por la cadena. Restaurar vuelve a cualquier versión que siga en el historial (también sirve para rehacer).

Se guardan las copias de los últimos `MAXIMO` movimientos; las más viejas se borran (git es el historial largo:
helek.json se escribe con orden estable y su diff se lee). Este módulo solo lee y escribe archivos: quien restaura
(`editar.deshacer`, `editar.restaurar`) regenera además el GeoJSON y el archivo del juego.
"""
import datetime
import hashlib
import json
import os

MAXIMO = 30
REGISTRO = 'registro.jsonl'
DESHACIBLES = ('guardar', 'restaurar')


def carpeta(ruta_mundo):
    return os.path.join(os.path.dirname(os.path.abspath(ruta_mundo)), 'historial')


def _huella(datos):
    return hashlib.sha256(datos).hexdigest()


def entradas(ruta_mundo):
    """Las líneas del registro, de la más vieja a la más nueva (lista vacía si aún no hay historial)."""
    ruta = os.path.join(carpeta(ruta_mundo), REGISTRO)
    if not os.path.exists(ruta):
        return []
    with open(ruta, encoding='utf-8') as f:
        return [json.loads(linea) for linea in f if linea.strip()]


def version(ruta_mundo, huella):
    """El texto de una versión guardada, o None si ya no está en el historial."""
    ruta = os.path.join(carpeta(ruta_mundo), f'{huella}.json')
    if not os.path.exists(ruta):
        return None
    with open(ruta, 'rb') as f:
        datos = f.read()
    return datos.decode('utf-8') if _huella(datos) == huella else None


def _copiar(dir_, datos):
    huella = _huella(datos)
    ruta = os.path.join(dir_, f'{huella}.json')
    if not os.path.exists(ruta):
        tmp = ruta + '.tmp'
        with open(tmp, 'wb') as f:
            f.write(datos)
        os.replace(tmp, ruta)
    return huella


def apuntar(ruta_mundo, antes, despues, tipo='guardar', resumen='', deshace=None):
    """Apunta un movimiento: `antes` y `despues` son los bytes de helek.json (antes None si no existía)."""
    dir_ = carpeta(ruta_mundo)
    os.makedirs(dir_, exist_ok=True)
    entrada = {'fecha': datetime.datetime.now().isoformat(timespec='seconds'), 'tipo': tipo,
               'antes': _copiar(dir_, antes) if antes is not None else None, 'despues': _copiar(dir_, despues),
               'resumen': resumen}
    if deshace is not None:
        entrada['deshace'] = deshace
    with open(os.path.join(dir_, REGISTRO), 'a', encoding='utf-8') as f:
        f.write(json.dumps(entrada, ensure_ascii=False) + '\n')
    _podar(ruta_mundo)
    return entrada


def _podar(ruta_mundo):
    """Borra las copias que ya no usa ninguno de los últimos MAXIMO movimientos (el registro se queda entero)."""
    vivas = set()
    for e in entradas(ruta_mundo)[-MAXIMO:]:
        vivas.update(h for h in (e['antes'], e['despues']) if h)
    dir_ = carpeta(ruta_mundo)
    for nombre in os.listdir(dir_):
        if nombre.endswith('.json') and nombre[:-5] not in vivas:
            os.unlink(os.path.join(dir_, nombre))


def por_deshacer(ruta_mundo, huella_actual):
    """(índice, entrada) del movimiento que deshacer devolvería, o None. Lo deshecho no se vuelve a deshacer."""
    lista = entradas(ruta_mundo)
    deshechas = {e['deshace'] for e in lista if e['tipo'] == 'deshacer'}
    for i in range(len(lista) - 1, -1, -1):
        e = lista[i]
        if e['tipo'] in DESHACIBLES and e['despues'] == huella_actual and i not in deshechas and e['antes']:
            return i, e
    return None
