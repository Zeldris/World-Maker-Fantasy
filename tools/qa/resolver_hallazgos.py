#!/usr/bin/env python3
"""QA-135: resuelve los conflictos de merge de docs/registros/pruebas-0.3-hallazgos.md.

Cada conflicto son filas de tabla emparejadas (mismo número de filas y mismo identificador en la columna 1): de cada
par se queda con el lado cuyo estado (penúltima columna) no es «pendiente». Si los dos lados tienen estado (o los dos
pendiente), se queda con el nuestro. Uso: resolver_hallazgos.py <archivo>"""
import re
import sys

PAT = re.compile(r'<<<<<<< [^\n]*\n(.*?)=======\n(.*?)>>>>>>> [^\n]*\n', re.S)


def pendiente(fila: str) -> bool:
    return fila.rstrip().split('|')[-2].strip().lower().startswith('pendiente')


def resolver(m):
    nuestras, suyas = m.group(1).splitlines(), m.group(2).splitlines()
    assert len(nuestras) == len(suyas), 'distinto número de filas'
    salida = []
    for a, b in zip(nuestras, suyas):
        assert a.split('|')[1] == b.split('|')[1], 'filas de distinto hallazgo'
        salida.append(b if pendiente(a) and not pendiente(b) else a)
    return '\n'.join(salida) + '\n'


if __name__ == '__main__':
    ruta = sys.argv[1]
    texto = open(ruta, encoding='utf-8').read()
    open(ruta, 'w', encoding='utf-8').write(PAT.sub(resolver, texto))
