#!/usr/bin/env python3
"""QA-368: clases CSS definidas en frontend/src/**/*.css que nada nombra: ni .ts/.tsx/.js/.jsx/.mdx de frontend/src, ni frontend/index.html, ni un `@apply` de otro CSS.

Uso: python3 tools/qa/css-sin-uso.py [carpeta-raiz]   (por defecto, la del repo)
Sale con 1 y la lista si hay alguna sin uso, 0 si no. Solo se leen los selectores: comentarios,
cadenas, valores (0.5rem, url(...)) y los preludios de @-reglas (@keyframes, @media, @layer...) no cuentan.
"""
import os
import re
import sys

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

# prefijo -> motivo: clases que se componen en tiempo de ejecución y no aparecen enteras en el código.
EXCEPCIONES = {
    'tooltip-portal-': 'TooltipAnchor.tsx la compone: `tooltip-portal-${pos.align}` (center, left, right)',
}

CLASE = re.compile(r'\.(-?[A-Za-z_](?:[\w-]|\\.)*)')


def sin_ruido(texto: str) -> str:
    texto = re.sub(r'/\*.*?\*/', ' ', texto, flags=re.S)
    return re.sub(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'', '""', texto)


def clases_definidas(css: str) -> set:
    clases, prelude = set(), []
    for c in sin_ruido(css):
        if c in '{};':
            if c == '{':
                texto = ''.join(prelude).strip()
                if not texto.startswith('@'):
                    clases.update(m.replace('\\', '') for m in CLASE.findall(texto))
            prelude = []
        else:
            prelude.append(c)
    return clases


def archivos(base: str, extensiones: tuple):
    for d, _, fs in os.walk(base):
        if 'node_modules' in d.split(os.sep):
            continue
        for f in fs:
            if f.endswith(extensiones):
                yield os.path.join(d, f)


def sin_uso(raiz: str) -> list:
    src = os.path.join(raiz, 'frontend', 'src')
    definidas = set()
    for ruta in archivos(src, ('.css',)):
        with open(ruta, encoding='utf-8') as f:
            definidas |= clases_definidas(f.read())
    codigo = ''
    for ruta in archivos(src, ('.ts', '.tsx', '.js', '.jsx', '.mdx')):
        with open(ruta, encoding='utf-8') as f:
            codigo += f.read() + '\n'
    index = os.path.join(raiz, 'frontend', 'index.html')
    if os.path.isfile(index):
        with open(index, encoding='utf-8') as f:
            codigo += f.read() + '\n'
    for ruta in archivos(src, ('.css',)):
        with open(ruta, encoding='utf-8') as f:
            for ap in re.findall(r'@apply\b([^;}]*)', sin_ruido(f.read())):
                codigo += ' '.join('.' + t for t in ap.replace('!', ' ').split()) + '\n'  # @apply foo → uso de .foo
    pendientes = []
    for clase in sorted(definidas):
        if any(clase.startswith(p) for p in EXCEPCIONES):
            continue
        if not re.search(r'(?<![\w-])' + re.escape(clase) + r'(?![\w-])', codigo):
            pendientes.append(clase)
    return pendientes


def main(argv) -> int:
    pendientes = sin_uso(os.path.abspath(argv[1]) if len(argv) > 1 else RAIZ)
    if pendientes:
        print('Clases CSS sin uso en ningún .ts/.tsx/.js/.jsx/.mdx, index.html ni @apply (borra su regla o añade su prefijo a EXCEPCIONES con motivo):')
        for c in pendientes:
            print(f'  .{c}')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
