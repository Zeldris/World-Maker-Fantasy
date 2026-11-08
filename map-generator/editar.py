#!/usr/bin/env python3
"""MAP-6: editar regiones, provincias y fronteras de helek.json (lo usa el visor por servir.py).

Un lote de cambios es un dict:

    {"base": "<sha256 de helek.json sobre el que se editó>",
     "celdas": [[celda, region, provincia], ...],          # 0 = sin región / sin provincia
     "provincias": [{"i": 1, "nombre": "Nuevo nombre"},    # renombrar
                    {"i": 5, "nombre": "Nueva", "region": 18, "color": "#aa5533"}]}   # crear (i nuevo)

`aplicar` lo valida y devuelve el mundo nuevo (sin tocar el de entrada); `informe` dice qué medidas cambian y cómo
quedan el canon (`canon.json`) y el lore (`lore.json`); `guardar` escribe helek.json (orden estable), helek.geojson y
el archivo del juego (`exportar.py`). Nunca se escribe el `.map`. Solo se editan celdas de tierra: costa y relieve
son de `MAP-7`. Las regiones no se crean ni se renombran: sus nombres los usan el canon, el lore y el juego.
"""
import copy
import hashlib
import json
import os
import re
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import comprobar  # noqa: E402
import exportar  # noqa: E402
import importar  # noqa: E402
import medir  # noqa: E402

TIERRA = comprobar.TIERRA
COLOR = re.compile(r'^#[0-9a-fA-F]{6}$')


class ErrorDeEdicion(ValueError):
    """El lote no se puede aplicar; el mensaje dice por qué, para mostrarlo tal cual en el visor."""


def huella(texto_o_bytes):
    datos = texto_o_bytes.encode('utf-8') if isinstance(texto_o_bytes, str) else texto_o_bytes
    return hashlib.sha256(datos).hexdigest()


def _provincias(mundo, cambios):
    provs = {p['i']: p for p in mundo['provincias']}
    regiones = {r['i'] for r in mundo['regiones']}
    for e in cambios.get('provincias', []):
        if not isinstance(e, dict) or not isinstance(e.get('i'), int):
            raise ErrorDeEdicion(f'provincia sin índice entero: {e!r}')
        nombre = (e.get('nombre') or '').strip()
        if not nombre:
            raise ErrorDeEdicion(f"la provincia {e['i']} necesita un nombre")
        if e['i'] in provs:
            if set(e) - {'i', 'nombre'}:
                raise ErrorDeEdicion(f"de una provincia existente ({provs[e['i']]['nombre']}) solo se cambia el nombre")
            provs[e['i']]['nombre'] = nombre
            continue
        if e['i'] <= 0:
            raise ErrorDeEdicion(f"índice de provincia no válido: {e['i']}")
        if e.get('region') not in regiones:
            raise ErrorDeEdicion(f"la provincia nueva «{nombre}» necesita una región que exista (no {e.get('region')!r})")
        if not COLOR.match(str(e.get('color', ''))):
            raise ErrorDeEdicion(f"la provincia nueva «{nombre}» necesita un color #rrggbb")
        provs[e['i']] = {'i': e['i'], 'nombre': nombre, 'region': e['region'], 'color': e['color'].lower(),
                         'centro': None}
    nombres = [p['nombre'] for p in provs.values()]
    repetidos = sorted({n for n in nombres if nombres.count(n) > 1})
    if repetidos:
        raise ErrorDeEdicion(f"nombre de provincia repetido: {', '.join(repetidos)}")
    return [provs[i] for i in sorted(provs)]


def aplicar(mundo, cambios):
    """El mundo con `cambios` aplicados (copia). Lanza ErrorDeEdicion si algo no cuadra."""
    nuevo = copy.deepcopy(mundo)
    nuevo['provincias'] = _provincias(nuevo, cambios)
    region_de_prov = {p['i']: p['region'] for p in nuevo['provincias']}
    regiones = {r['i'] for r in nuevo['regiones']} | {0}
    n = len(nuevo['celdas'])
    for fila in cambios.get('celdas', []):
        if not (isinstance(fila, list) and len(fila) == 3 and all(isinstance(v, int) for v in fila)):
            raise ErrorDeEdicion(f'cambio de celda mal formado: {fila!r} (se espera [celda, región, provincia])')
        i, region, provincia = fila
        if not 0 <= i < n:
            raise ErrorDeEdicion(f'no existe la celda {i}')
        c = nuevo['celdas'][i]
        if c['h'] < TIERRA:
            raise ErrorDeEdicion(f'la celda {i} es mar: costa y relieve se editan en MAP-7')
        if region not in regiones:
            raise ErrorDeEdicion(f'no existe la región {region}')
        if provincia and region_de_prov.get(provincia) != region:
            raise ErrorDeEdicion(f'la provincia {provincia} no es de la región {region} (celda {i})')
        c['region'], c['provincia'] = region, provincia
    for lu in nuevo['lugares']:
        c = nuevo['celdas'][lu['celda']]
        if lu.get('region') and c['region'] != lu['region']:
            nombre = next(r['nombre'] for r in nuevo['regiones'] if r['i'] == lu['region'])
            raise ErrorDeEdicion(f"la celda {c['i']} es de {lu['nombre']}, que es de {nombre}: no cambia de región")
    _centros(nuevo)
    return nuevo


def _centros(mundo):
    """El centro de cada provincia es una de sus celdas: se conserva si sigue dentro, si no, la más central."""
    por = {}
    for c in mundo['celdas']:
        if c['h'] >= TIERRA and c['provincia']:
            por.setdefault(c['provincia'], []).append(c)
    for p in mundo['provincias']:
        celdas = por.get(p['i'], [])
        if any(c['i'] == p.get('centro') for c in celdas):
            continue
        if not celdas:
            p['centro'] = None
            continue
        mx = sum(c['p'][0] for c in celdas) / len(celdas)
        my = sum(c['p'][1] for c in celdas) / len(celdas)
        p['centro'] = min(celdas, key=lambda c: ((c['p'][0] - mx) ** 2 + (c['p'][1] - my) ** 2, c['i']))['i']


def _lore(mundo, lore):
    try:
        return [{'id': r['id'], 'ok': ok, 'detalle': d} for r, ok, d in comprobar.comprobar(mundo, lore)]
    except (KeyError, StopIteration, ValueError) as e:
        # Una regla que nombra algo que ya no existe (p. ej. una provincia renombrada) es un fallo, no un cuelgue.
        return [{'id': 'lore', 'ok': False, 'detalle': f'el lore no se puede comprobar: {type(e).__name__} {e}'}]


def informe(antes, despues, canon, lore):
    """Qué medidas cambian (área y envolvente de regiones y provincias) y el canon y el lore tras el cambio."""
    ma, md = medir.medidas(antes, canon), medir.medidas(despues, canon)
    cambian = []
    for clave, lista in (('regiones', despues['regiones']), ('provincias', despues['provincias'])):
        for e in lista:
            a, d = ma[clave].get(str(e['i'])), md[clave][str(e['i'])]
            if a is None or abs(a['area'] - d['area']) > 1e-6 or a['envolvente'] != d['envolvente']:
                cambian.append({'tipo': 'region' if clave == 'regiones' else 'provincia', 'i': e['i'],
                                'nombre': e['nombre'], 'antes': a and {'area': a['area'], 'envolvente': a['envolvente']},
                                'despues': {'area': d['area'], 'envolvente': d['envolvente']}})
    lore_d = _lore(despues, lore)
    return {
        'cambian': cambian,
        'canon': md['canon'],
        'lore': lore_d,
        'ok': all(e['dentro'] for e in md['canon']) and all(r['ok'] for r in lore_d),
        'medidas': md,
    }


def guardar(mundo, ruta_mundo=medir.MUNDO, ruta_geojson=None, ruta_juego=exportar.SALIDA):
    """Escribe helek.json (orden estable, de forma atómica), su GeoJSON y el archivo del juego. Devuelve la huella."""
    texto = importar.volcar(mundo)
    _escribir(ruta_mundo, texto)
    ruta_geojson = ruta_geojson or os.path.join(os.path.dirname(ruta_mundo), 'helek.geojson')
    geo = importar.geojson(mundo, {'v': [c['v'] for c in mundo['celdas']]}, mundo['vertices'])
    _escribir(ruta_geojson, importar.volcar({'type': geo['type'], 'features': geo['features']}))
    if ruta_juego:
        _escribir(ruta_juego, exportar.generar(mundo))
    return huella(texto)


def _escribir(ruta, texto):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(ruta), prefix='.editar-', suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(texto)
        os.replace(tmp, ruta)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def cargar_json(ruta):
    with open(ruta, encoding='utf-8') as f:
        return json.load(f)
