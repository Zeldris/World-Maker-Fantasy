#!/usr/bin/env python3
"""QA-171 (retro del 2026-10-20): cierra tareas del roadmap en una orden, en los tres sitios que pide CLAUDE.md.

  1. En su roadmap (`docs/producto/roadmap-front*.md`, `roadmap-cronista.md`): tacha la tarea (`- ~~**ID · …**…~~`,
     también si la descripción ocupa varias líneas) y añade ` ✅ <fecha>: <nota>`.
  2. En el mapa de `21-roadmap.md`: tacha `` `ID` ``; un rango `` `A`…`B` `` se tacha cuando se cierran todas las suyas
     en la misma orden (si no, avisa y lo deja).
  3. Con `--bitacora "<resumen>"`, abre «Hecho recientemente» de `docs/registros/traspaso.md` con
     `- **<fecha>** — ~~`ID`~~, … <resumen>` y deja las 10 últimas.

Uso: python3 tools/roadmap/cerrar.py QA-n "nota" [QA-m "nota"…] [--bitacora "(origen): resumen"] [--fecha AAAA-MM-DD]
Enseña lo que cambia (`git diff --stat`). Sale con 1 sin tocar nada si una tarea no existe o ya está tachada.
"""
import argparse, datetime as dt, os, re, subprocess, sys

RAIZ = os.environ.get('CERRAR_RAIZ') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
PRODUCTO = os.path.join(RAIZ, 'docs', 'producto')
ROADMAPS = ['roadmap-front.md', 'roadmap-front-ux.md', 'roadmap-front-zona.md', 'roadmap-front-reino.md', 'roadmap-cronista.md']
MAPA = os.path.join(PRODUCTO, '21-roadmap.md')
BITACORA = os.path.join(RAIZ, 'docs', 'registros', 'traspaso.md')
HECHOS = 10


def leer(ruta):
    with open(ruta, encoding='utf-8') as f:
        return f.read().split('\n')


def escribir(ruta, lineas):
    with open(ruta, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lineas))


def tachar_en_roadmap(archivos, ident, nota, fecha):
    """Tacha la definición de `ident` en el roadmap que la tiene. Devuelve el error o None."""
    abre = re.compile(rf'^(\s*)- (~~)?\*\*{re.escape(ident)}\b')
    for nombre, lineas in archivos.items():
        for i, linea in enumerate(lineas):
            m = abre.match(linea)
            if not m:
                continue
            if m.group(2):
                return f'{ident} ya está tachada en {nombre}:{i + 1}'
            # La descripción sigue en las líneas con más sangría que la viñeta, hasta la siguiente viñeta o un hueco.
            fin = i
            while fin + 1 < len(lineas) and lineas[fin + 1].startswith(m.group(1) + '  ') and lineas[fin + 1].strip():
                fin += 1
            lineas[i] = linea.replace('- **', '- ~~**', 1)
            lineas[fin] = lineas[fin].rstrip() + f'~~ ✅ {fecha}: {nota}'
            return None
    return f'{ident} no está definida en {", ".join(archivos)}'


def tachar_en_mapa(lineas, idents, ya_cerradas=()):
    """Tacha en el mapa cada `ID` suelto y los rangos `A`…`B` que quedan cerrados enteros (con las de esta orden y las
    ya tachadas en su roadmap). Devuelve los avisos."""
    avisos, tachadas = [], set()
    cerradas = set(idents)
    rango = re.compile(r'(?<!~~)`([A-Z]+)-(\d+)`…`(?:[A-Z]+-)?(\d+)`(?!~~)')
    suelto = re.compile(r'(?<!~~)(?<!…)`([A-Z]+-\d+[a-z]?)`(?!~~|…)')

    def por_rango(m):
        ids = {f'{m.group(1)}-{k}' for k in range(int(m.group(2)), int(m.group(3)) + 1)}
        if not ids & cerradas:
            return m.group(0)
        tachadas.update(ids & cerradas)
        if ids <= cerradas | set(ya_cerradas):
            return f'~~{m.group(0)}~~'
        avisos.append(f'{m.group(0)} en 21-roadmap.md: no se cierran todas las del rango, táchalo a mano')
        return m.group(0)

    def por_suelto(m):
        if m.group(1) not in cerradas:
            return m.group(0)
        tachadas.add(m.group(1))
        return f'~~{m.group(0)}~~'

    for i, linea in enumerate(lineas):
        lineas[i] = suelto.sub(por_suelto, rango.sub(por_rango, linea))
    for ident in idents:
        if ident not in tachadas:
            avisos.append(f'{ident} no sale en el mapa de 21-roadmap.md: añádela a su hito (cobertura.py)')
    return avisos


def abrir_hecho(lineas, idents, resumen, fecha):
    i = lineas.index('## Hecho recientemente')
    inicio = i + 1
    while inicio < len(lineas) and not lineas[inicio].startswith('- '):
        inicio += 1
    fin = inicio
    while fin < len(lineas) and lineas[fin].startswith('- '):
        fin += 1
    nueva = f'- **{fecha}** — ' + ', '.join(f'~~`{x}`~~' for x in idents) + f' {resumen}'
    lineas[inicio:fin] = [nueva] + lineas[inicio:fin][:HECHOS - 1]


def main():
    ap = argparse.ArgumentParser(description='Cierra tareas del roadmap (QA-171).')
    ap.add_argument('pares', nargs='+', help='ID "nota" [ID "nota"…]')
    ap.add_argument('--bitacora')
    ap.add_argument('--fecha', default=dt.date.today().isoformat())
    a = ap.parse_args()
    if len(a.pares) % 2:
        sys.exit('cerrar.py: cada tarea con su nota (ID "nota")')
    tareas = list(zip(a.pares[::2], a.pares[1::2]))

    archivos = {n: leer(os.path.join(PRODUCTO, n)) for n in ROADMAPS if os.path.exists(os.path.join(PRODUCTO, n))}
    errores = [e for ident, nota in tareas if (e := tachar_en_roadmap(archivos, ident, nota, a.fecha))]
    if errores:
        sys.exit('\n'.join(errores))
    mapa = leer(MAPA)
    tachadas = {m.group(1) for lineas in archivos.values() for l in lineas
                if (m := re.match(r'^\s*- ~~\*\*([A-Z]+-\d+[a-z]?)\b', l))}
    avisos = tachar_en_mapa(mapa, [ident for ident, _ in tareas], tachadas)
    for n, lineas in archivos.items():
        escribir(os.path.join(PRODUCTO, n), lineas)
    escribir(MAPA, mapa)
    if a.bitacora:
        bitacora = leer(BITACORA)
        abrir_hecho(bitacora, [ident for ident, _ in tareas], a.bitacora, a.fecha)
        escribir(BITACORA, bitacora)
    for aviso in avisos:
        print(f'aviso: {aviso}')
    print(subprocess.run(['git', 'diff', '--stat'], cwd=RAIZ, capture_output=True, text=True).stdout, end='')


if __name__ == '__main__':
    main()
