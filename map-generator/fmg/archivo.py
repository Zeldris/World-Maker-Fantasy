"""Lectura del `.map` de Azgaar's Fantasy Map Generator (FMG), solo de la versión que dibujó la usuaria.

El `.map` son 46 registros separados por CRLF (orden en `src/services/io/save.ts` de FMG). El de este repositorio
perdió los CR (git lo normalizó a LF), y el registro 5 es un SVG con saltos de línea propios: por eso, sin CRLF,
el SVG se reconoce por su `<svg` inicial y su `</svg>` final. Este módulo **solo lee**: nunca escribe un `.map`
(roadmap-mapas.md: reescribirlo y volver a cargarlo en Azgaar lo rompía).
"""
import json

VERSION = '1.137.6'

# Índices de los registros (FMG 1.137.6, `prepareMapData`).
PARAMS, SETTINGS, COORDS, BIOMAS, NOTAS, SVG = 0, 1, 2, 3, 4, 5
GRID, GRID_H, GRID_PREC, GRID_F, GRID_T, GRID_TEMP = 6, 7, 8, 9, 10, 11
FEATURES, CULTURAS, ESTADOS, BURGS = 12, 13, 14, 15
C_BIOMA, C_BURG, C_CONF, C_CULTURA, C_FL, C_POP, C_RIO = 16, 17, 18, 19, 20, 21, 22
C_S, C_ESTADO, C_RELIGION, C_PROVINCIA = 24, 25, 26, 27
RELIGIONES, PROVINCIAS, NOMBRES, RIOS = 29, 30, 31, 32
MARCADORES, C_RUTAS, RUTAS, ZONAS, HIELO = 35, 36, 37, 38, 39


class ErrorDeMapa(Exception):
    pass


def separar(texto):
    """Devuelve la lista de registros del `.map`, con o sin CRLF."""
    if '\r\n' in texto:
        return texto.split('\r\n')
    lineas = texto.split('\n')
    if len(lineas) < 6 or not lineas[5].startswith('<svg'):
        raise ErrorDeMapa('el registro 5 no es el SVG: no parece un .map de FMG')
    fin = next((i for i in range(5, len(lineas)) if lineas[i].rstrip().endswith('</svg>')), None)
    if fin is None:
        raise ErrorDeMapa('el SVG del registro 5 no se cierra')
    return lineas[:5] + ['\n'.join(lineas[5:fin + 1])] + lineas[fin + 1:]


def leer(ruta):
    with open(ruta, encoding='utf-8') as f:
        datos = separar(f.read())
    version = datos[PARAMS].split('|')[0]
    if version != VERSION:
        raise ErrorDeMapa(f'el .map es de FMG {version} y el importador solo conoce la {VERSION}: '
                          'los registros cambian de orden entre versiones; revisa save.ts de esa versión')
    if len(datos) < 45:
        raise ErrorDeMapa(f'el .map tiene {len(datos)} registros y FMG {VERSION} guarda 46')
    return datos


def enteros(registro):
    return [int(v) for v in registro.split(',')] if registro else []


def flotantes(registro):
    return [float(v) for v in registro.split(',')] if registro else []


def js(registro, vacio=None):
    return json.loads(registro) if registro else vacio
