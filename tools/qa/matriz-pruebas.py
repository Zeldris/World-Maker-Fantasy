#!/usr/bin/env python3
"""QA-101 (2026-10-19): matriz de cobertura de las pruebas jugando.

Cada tarea cerrada (✅) de los hitos que se están probando (`0.0`…`0.3`, «Qué entra en cada hito» de
21-roadmap.md; las `QA` no, son del entorno) tiene su fila en docs/registros/matriz-pruebas.md con su
bloque y su estado:
  - jugado:      se ha visto funcionar jugando (fecha y hallazgo o recorrido en «Prueba»).
  - solo tests:  tiene tests, pero nadie lo ha jugado.
  - sin jugar:   ni lo uno ni lo otro conocido.
  - no se juega: no tiene nada que jugar (rendimiento, herramientas, textos internos); di por qué.

Uso:
  python3 tools/qa/matriz-pruebas.py              resumen: «SIN JUGAR: N de M (x %)» y por bloque
  python3 tools/qa/matriz-pruebas.py --generar    añade las filas que falten (estado inicial: «jugado» si
                                                  la tarea sale en un registro de pruebas en una línea con ✅
                                                  o «Comprobado jugando»; si no, «sin jugar»)
  python3 tools/qa/matriz-pruebas.py --comprobar  sale con 1 si falta la fila de alguna tarea cerrada (pre-push)
  python3 tools/qa/matriz-pruebas.py --bloque Reino  las filas sin jugar de ese bloque (para preparar una ronda)
"""
import io, os, re, sys, runpy, contextlib

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
MATRIZ = os.path.join(RAIZ, 'docs', 'registros', 'matriz-pruebas.md')
HITOS = {'0.0', '0.1', '0.2', '0.3'}
REGISTROS = ['checklist-pruebas-juego.md', 'fase-g-0.1-hallazgos.md', 'pruebas-0.3-hallazgos.md', 'pruebas-nube-2026-09-28-hallazgos.md', 'sesion-jugadora-hallazgos.md']
# Bloque de cada prefijo: lo que se juega junto en una ronda (QA-105).
BLOQUES = {
    'REI': 'Reino', 'CR': 'Mundo vivo', 'ZON': 'Mapa de zona', 'CMB': 'Combate', 'DAD': 'Dados y tiradas',
    'NAR': 'Narrador', 'INT': 'Cronista en la interfaz', 'UX': 'Interfaz', 'HUD': 'Interfaz', 'PAN': 'Paneles',
    'MOD': 'Interfaz', 'CFG': 'Configuración', 'BAS': 'Interfaz', 'ATM': 'Ambiente', 'PRE': 'Interfaz', 'SON': 'Ambiente',
}
ESTADOS = ('jugado', 'solo tests', 'sin jugar', 'no se juega')
CABECERA = """# Matriz de cobertura de las pruebas jugando (`QA-101`)

Una fila por tarea cerrada de los hitos `0.0`…`0.3` (las `QA` no). La genera y la comprueba
`tools/qa/matriz-pruebas.py`; el estado y la prueba se editan a mano al jugar. Estados: **jugado** (con fecha y
hallazgo o recorrido en «Prueba»), **solo tests**, **sin jugar**, **no se juega** (con el porqué). Una ronda
coge un bloque y lo deja en «jugado» (`QA-105`, [runbook](../runbooks/rondas-de-pruebas.md)).

| Tarea | Bloque | Qué | Estado | Prueba |
|---|---|---|---|---|
"""


def tareas_cerradas():
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        g = runpy.run_path(os.path.join(RAIZ, 'tools', 'roadmap', 'cobertura.py'), run_name='matriz')
    defs, asignado, D = g['defs'], g['asignado'], g['D']
    lineas = {}
    out = {}
    for i, hitos in asignado.items():
        if i not in defs or i.startswith('QA-') or not (hitos & HITOS):
            continue
        f, n = defs[i]
        if f not in lineas:
            lineas[f] = open(D + f, encoding='utf-8').readlines()
        l = lineas[f][n - 1]
        if not ('~~' in l.split(i)[0][-4:] or '✅' in l):
            continue
        m = re.search(re.escape(i) + r'[a-z]?\s*·\s*([^*|~]+)', l)
        titulo = (m.group(1) if m else l.split(i, 1)[1]).splitlines()[0]
        titulo = re.sub(r'\*\*|~~|✅|\|', ' ', titulo)
        titulo = re.sub(r'\s+', ' ', titulo).strip(' ·.(') [:90]
        out[i] = (BLOQUES.get(i.split('-')[0], 'Otros'), titulo)
    return out


def leer_matriz():
    filas = {}
    if not os.path.exists(MATRIZ):
        return filas
    for l in open(MATRIZ, encoding='utf-8'):
        m = re.match(r'^\|\s*`?([A-Z]+-\d+[a-z]?)`?\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|', l)
        if m:
            filas[m.group(1)] = [c.strip() for c in m.groups()[1:]]
    return filas


def jugado_en_registros(ids):
    vistos = {}
    for f in REGISTROS:
        ruta = os.path.join(RAIZ, 'docs', 'registros', f)
        if not os.path.exists(ruta):
            continue
        for l in open(ruta, encoding='utf-8'):
            if '✅' not in l and 'omprobado jugando' not in l:
                continue
            for i in ids:
                if i not in vistos and re.search(r'(?<![\w-])' + re.escape(i) + r'(?![\w])', l):
                    vistos[i] = f
    return vistos


def orden(i):
    p, n = i.split('-')
    return (p, int(re.sub(r'\D', '', n)), n)


def escribir(filas):
    with open(MATRIZ, 'w', encoding='utf-8') as out:
        out.write(CABECERA)
        for i in sorted(filas, key=lambda x: (filas[x][0], orden(x))):
            b, q, e, p = filas[i]
            out.write(f'| `{i}` | {b} | {q} | {e} | {p} |\n')


def main():
    args = sys.argv[1:]
    cerradas = tareas_cerradas()
    filas = leer_matriz()
    faltan = sorted((i for i in cerradas if i not in filas), key=orden)
    if '--generar' in args:
        vistos = jugado_en_registros(faltan)
        for i in faltan:
            b, q = cerradas[i]
            filas[i] = [b, q, 'jugado' if i in vistos else 'sin jugar', f'registro: {vistos[i]}' if i in vistos else '']
        escribir(filas)
        print(f'matriz: {len(faltan)} filas nuevas')
        faltan = []
    malos = [i for i, f in filas.items() if f[2] not in ESTADOS]
    if '--bloque' in args:
        b = args[args.index('--bloque') + 1]
        for i in sorted(filas, key=orden):
            if filas[i][0] == b and filas[i][2] != 'jugado' and filas[i][2] != 'no se juega':
                print(f'{i} · {filas[i][1]} ({filas[i][2]})')
        return 0
    total = len(filas)
    jugados = sum(1 for f in filas.values() if f[2] in ('jugado', 'no se juega'))
    print(f'SIN JUGAR: {total - jugados} de {total} ({100 * (total - jugados) // max(total, 1)} %)')
    por = {}
    for f in filas.values():
        a = por.setdefault(f[0], [0, 0])
        a[1] += 1
        a[0] += f[2] in ('jugado', 'no se juega')
    for b in sorted(por, key=lambda x: por[x][0] / por[x][1]):
        print(f'  {b}: {por[b][0]}/{por[b][1]} jugado')
    if faltan:
        print('FALTAN EN LA MATRIZ (tareas cerradas sin fila; `--generar`):', ', '.join(faltan))
    if malos:
        print('ESTADO DESCONOCIDO:', ', '.join(malos), '— vale:', ', '.join(ESTADOS))
    return 1 if '--comprobar' in args and (faltan or malos) else 0


if __name__ == '__main__':
    sys.exit(main())
