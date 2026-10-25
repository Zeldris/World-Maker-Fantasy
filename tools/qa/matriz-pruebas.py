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
  python3 tools/qa/matriz-pruebas.py --comprobar  sale con 1 si falta la fila de alguna tarea cerrada o una «jugado»
                                                  tiene la prueba en «parcial …» (pre-push)
  (QA-217) --comprobar falla también si un plan `docs/registros/plan-comprobacion-*.md` nombra, en su columna
                                                  «Escenario», un `nombre` sin `tools/qa/escenarios/<nombre>.dump`
  python3 tools/qa/matriz-pruebas.py --bloque Reino  las filas sin jugar de ese bloque (para preparar una ronda)
"""
import glob, io, os, re, sys, runpy, contextlib

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
MATRIZ = os.path.join(RAIZ, 'docs', 'registros', 'matriz-pruebas.md')
HITOS = {'0.0', '0.1', '0.2', '0.3'}
REGISTROS = ['checklist-pruebas-juego.md', 'fase-g-0.1-hallazgos.md', 'pruebas-0.3-hallazgos.md', 'pruebas-nube-2026-09-28-hallazgos.md', 'sesion-jugadora-hallazgos.md']
# Bloque de cada prefijo: lo que se juega junto en una ronda (QA-105).
BLOQUES = {
    'REI': 'Reino', 'CR': 'Mundo vivo', 'ZON': 'Mapa de zona', 'CMB': 'Combate', 'DAD': 'Dados y tiradas',
    'NAR': 'Narrador', 'INT': 'Cronista en la interfaz', 'UX': 'Interfaz', 'HUD': 'Interfaz', 'PAN': 'Paneles',
    'MOD': 'Interfaz', 'CFG': 'Configuración', 'BAS': 'Interfaz', 'ATM': 'Ambiente', 'PRE': 'Interfaz', 'SON': 'Ambiente',
    'IMG': 'Configuración', 'VOZ': 'Ambiente',
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
        # Cerrada: el ID tachado (`~~REI-118~~`, `~~**CR-40`) o «✅ <fecha>». Un ✅ suelto no basta: en las tablas
        # de roadmap-front-reino.md la columna «Back» lleva ✅ cuando el backend existe, no cuando está hecha.
        if not ('~~' in l.split(i)[0][-4:] or re.search(r'✅\s*\*?\*?20\d\d-', l)):
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


NOMBRE_ESCENARIO = re.compile(r'^[a-z0-9][a-z0-9_-]*$')


def escenarios_nombrados(texto):
    """QA-217: {nombre: [líneas]} de lo que un plan de comprobación pone en su columna «Escenario».

    Solo cuenta lo que va entre comillas invertidas y parece un nombre de escenario (`t20-mundo`, `x.dump`,
    `tools/qa/escenarios/x.dump`); las órdenes (`escenario.sh avanzar`, `preparar combate:x`) y el texto suelto
    («partida nueva», «—») no. Un plan sin columna «Escenario» no nombra ninguno. Las demás columnas se ignoran:
    ahí «mv-ganado» puede ser una mención de pasada."""
    nombres = {}
    col = None
    for n, l in enumerate(texto.splitlines(), 1):
        if not l.lstrip().startswith('|'):
            col = None
            continue
        celdas = [c.strip() for c in l.strip().strip('|').split('|')]
        if col is None:
            col = next((k for k, c in enumerate(celdas) if c.lower() == 'escenario'), None)
            continue
        if col >= len(celdas) or set(celdas[col]) <= set('-: '):
            continue
        for t in re.findall(r'`([^`]+)`', celdas[col]):
            t = os.path.basename(t.strip())
            t = t[:-5] if t.endswith('.dump') else t
            if NOMBRE_ESCENARIO.match(t):
                nombres.setdefault(t, []).append(n)
    return nombres


def escenarios_inexistentes():
    """QA-217: ['plan.md: nombre (línea N)'] de los escenarios de los planes que no tienen su .dump."""
    malos = []
    for plan in sorted(glob.glob(os.path.join(RAIZ, 'docs', 'registros', 'plan-comprobacion-*.md'))):
        for nombre, lineas in escenarios_nombrados(open(plan, encoding='utf-8').read()).items():
            if not os.path.exists(os.path.join(RAIZ, 'tools', 'qa', 'escenarios', nombre + '.dump')):
                malos.append(f'{os.path.basename(plan)}: {nombre} (línea {lineas[0]})')
    return malos


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
    sobran = sorted((i for i in filas if i not in cerradas), key=orden)
    if '--generar' in args:
        vistos = jugado_en_registros(faltan)
        for i in faltan:
            b, q = cerradas[i]
            filas[i] = [b, q, 'jugado' if i in vistos else 'sin jugar', f'registro: {vistos[i]}' if i in vistos else '']
        # Una fila que deja de contar como cerrada se quita solo si no tiene nada escrito a mano; si ya se jugó o
        # tiene prueba, se deja (y `--comprobar` la sigue señalando) para no perderlo por un tachado mal puesto.
        quitadas = [i for i in sobran if filas[i][2] == 'sin jugar' and not filas[i][3]]
        for i in quitadas:
            del filas[i]
        escribir(filas)
        print(f'matriz: {len(faltan)} filas nuevas, {len(quitadas)} quitadas (ya no cuentan como cerradas)')
        sobran = [i for i in sobran if i not in quitadas]
        if sobran:
            print('Se dejan porque tienen estado o prueba escritos (quítalas a mano si de verdad no cuentan):', ', '.join(sobran))
        faltan = []
    malos = [i for i, f in filas.items() if f[2] not in ESTADOS]
    # QA-213: CR-9 y otras cinco pasaron a «jugado» con la prueba aún en «parcial …, falta …» y el recuento se inflaba.
    # Al pasar a «jugado», la prueba se reescribe con lo jugado; si aún falta algo, la fila sigue «sin jugar».
    parciales = [i for i, f in filas.items() if f[2] == 'jugado' and f[3].lower().startswith('parcial')]
    sin_dump = escenarios_inexistentes()
    if '--bloque' in args:
        k = args.index('--bloque') + 1
        if k >= len(args):
            print('Uso: matriz-pruebas.py --bloque <Bloque> (p. ej. Reino)')
            return 2
        b = args[k]
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
    if sobran:
        print('SOBRAN EN LA MATRIZ (no son tareas cerradas; `--generar`):', ', '.join(sobran))
    if malos:
        print('ESTADO DESCONOCIDO:', ', '.join(malos), '— vale:', ', '.join(ESTADOS))
    if parciales:
        print('JUGADO CON PRUEBA PARCIAL (reescribe la prueba con lo jugado o vuelve a «sin jugar»):', ', '.join(parciales))
    if sin_dump:
        print('ESCENARIO SIN .dump (un plan de comprobación nombra un escenario que no está en tools/qa/escenarios/; '
              'corrige el nombre o guárdalo con `escenario.sh guardar`):', '; '.join(sin_dump))
    return 1 if '--comprobar' in args and (faltan or malos or sobran or parciales or sin_dump) else 0


if __name__ == '__main__':
    sys.exit(main())
