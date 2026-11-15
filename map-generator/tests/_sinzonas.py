"""Ayudante de los tests: el mundo de helek.json sin la lista `zonas`, para que no dependan de las zonas que tenga el mapa real."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import importar  # noqa: E402
import medir  # noqa: E402


def cargar():
    m = medir.cargar()
    m.pop('zonas', None)
    return m


def texto():
    return importar.volcar(cargar())


def copiar(destino):
    """Escribe en `destino` helek.json sin zonas, con el mismo formato que usa el código al guardar."""
    with open(destino, 'w', encoding='utf-8') as f:
        f.write(texto())
