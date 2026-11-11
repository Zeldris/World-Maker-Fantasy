#!/usr/bin/env python3
"""QA-320 (gw-opt-tokens de los lotes F-I, 2026-11-11): estado del plan de la puerta en una orden.

Uso: python3 tools/qa/plan.py [--pendiente] [--plan <ruta>]
     python3 tools/qa/plan.py --tanda <n> [<m>...] [--plan <ruta>]
     python3 tools/qa/plan.py --lote <X> [<Y>...] [--plan <ruta>]

Solo lee `docs/records/plan-comprobacion-puerta.md` (y, para `--tanda`, el archivo de tandas cerradas junto a él),
en vez de abrirlo con `grep`/`sed` para saber qué tanda o lote toca (45 lecturas, 1,65M arrastrados en una rama).

- `--pendiente` (por defecto): la última tanda (del plan o del archivo) y el número de la siguiente, las tandas
  cuyo estado no empieza por «hecha», «✅», «absorbida» o «cerrada», y cada lote con sus 14 P más altos y el final
  de su celda (lo último que se apuntó: el plan no tiene columna de estado de lote).
- `--tanda N`: la fila entera de esa tanda (sistema, escenario, hallazgos y estado).
- `--lote X`: la fila entera de ese lote.

Sale con 1 si el plan no existe o una tanda o un lote pedido no está, y con 2 si los argumentos están mal.
"""
import os
import re
import sys

PLAN = 'docs/records/plan-comprobacion-puerta.md'
ARCHIVO = 'plan-comprobacion-puerta-archivo.md'
P_RE = re.compile(r'\bP\d+\b')
CERRADA = re.compile(r'(hecha|✅|absorbida|cerrada)', re.I)


def celdas(linea: str) -> list[str]:
    """Celdas de una fila de tabla Markdown; `\\|` no parte la celda."""
    linea = linea.strip()
    if linea.endswith('|') and not linea.endswith('\\|'):
        linea = linea[:-1]
    return [c.strip() for c in re.split(r'(?<!\\)\|', linea)[1:]]


def filas(ruta: str) -> tuple[dict[int, list[str]], dict[str, list[str]]]:
    tandas: dict[int, list[str]] = {}
    lotes: dict[str, list[str]] = {}
    if not os.path.exists(ruta):
        return tandas, lotes
    with open(ruta, encoding='utf-8') as f:
        for linea in f:
            if not linea.startswith('|'):
                continue
            c = celdas(linea)
            if len(c) < 3:
                continue
            if re.fullmatch(r'\d+', c[0]):
                tandas[int(c[0])] = c
            elif re.fullmatch(r'[A-Z]', c[0]):
                lotes[c[0]] = c
    return tandas, lotes


def recorta(texto: str, n: int) -> str:
    return texto if len(texto) <= n else texto[:n - 1] + '…'


def final(texto: str, n: int) -> str:
    return texto if len(texto) <= n else '…' + texto[-(n - 1):]


def pendiente(tandas: dict[int, list[str]], lotes: dict[str, list[str]], viejas: dict[int, list[str]]) -> None:
    if tandas or viejas:
        ultima = max([*tandas, *viejas])
        print(f'Última tanda: {ultima}; la siguiente sería la {ultima + 1}.')
    abiertas = [n for n, c in sorted(tandas.items()) if not CERRADA.match(c[-1])]
    print('Tandas sin hacer:' if abiertas else 'Tandas sin hacer: ninguna.')
    for n in abiertas:
        c = tandas[n]
        print(f'  {n} · {recorta(c[1], 60)} · {recorta(c[3] if len(c) > 3 else "", 160)}')
    print('Lotes:')
    for letra, c in sorted(lotes.items()):
        ps = sorted(set(P_RE.findall(c[-1])), key=lambda p: int(p[1:]))
        print(f'  {letra} · {recorta(c[1], 60)} · {"…" if len(ps) > 14 else ""}{", ".join(ps[-14:])}')
        print(f'      lo último: {final(c[-1], 160)}')


def main(argv: list[str]) -> int:
    ruta = PLAN
    if '--plan' in argv:
        i = argv.index('--plan')
        if i + 1 >= len(argv):
            print(__doc__)
            return 2
        ruta = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    if not os.path.exists(ruta):
        print(f'No está el plan: {ruta} (¿se lanzó desde la raíz del repo?).')
        return 1
    tandas, lotes = filas(ruta)
    viejas, _ = filas(os.path.join(os.path.dirname(ruta), ARCHIVO))
    if not argv or argv == ['--pendiente']:
        pendiente(tandas, lotes, viejas)
        return 0
    if argv[0] == '--tanda' and len(argv) > 1 and all(n.isdigit() for n in argv[1:]):
        codigo = 0
        for n in argv[1:]:
            fila = tandas.get(int(n)) or viejas.get(int(n))
            if not fila:
                print(f'Tanda {n}: no está en el plan ni en el archivo.')
                codigo = 1
                continue
            print(f'Tanda {n}\n' + '\n'.join(f'  {c}' for c in fila[1:]))
        return codigo
    if argv[0] == '--lote' and len(argv) > 1 and all(not a.startswith('--') for a in argv[1:]):
        codigo = 0
        for letra in argv[1:]:
            fila = lotes.get(letra.upper())
            if not fila:
                print(f'Lote {letra}: no está en el plan.')
                codigo = 1
                continue
            print(f'Lote {letra.upper()}\n' + '\n'.join(f'  {c}' for c in fila[1:]))
        return codigo
    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
