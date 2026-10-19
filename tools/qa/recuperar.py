#!/usr/bin/env python3
"""QA-116 (usuaria, 2026-10-19): compactar sin perder lo que haga falta después.

Compactar resume la conversación, pero el registro de la sesión (`~/.claude/projects/<proyecto>/<sesión>.jsonl`)
la guarda entera mientras dure el contenedor. Esto la consulta sin leerla (pesa cientos de MB):

  recuperar.py "<regex>"      los fragmentos de la conversación principal que casan (lo escrito por la usuaria,
                              por Claude, las órdenes y sus resultados), recortados, los más recientes al final.
                              --max N (10), --ancho N (400 caracteres por fragmento), --sesion <ruta.jsonl>.
  recuperar.py --estado       lo que el gancho de SessionStart vuelve a poner en el contexto tras cada compactación:
                              la fila de la rama en la bitácora, git status, los últimos commits, las compactaciones
                              de la sesión (para el presupuesto de la tarea) y cómo recuperar un detalle.

Una sesión nueva no tiene el registro de la anterior: lo que tiene que sobrevivir va a la bitácora (CLAUDE.md).
"""
import glob, json, os, re, subprocess, sys

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))


def ruta_por_defecto():
    proyecto = re.sub(r'[^A-Za-z0-9]', '-', os.environ.get('CLAUDE_PROJECT_DIR', RAIZ))
    candidatos = glob.glob(os.path.expanduser(f'~/.claude/projects/{proyecto}/*.jsonl'))
    return max(candidatos, key=os.path.getmtime) if candidatos else None


def textos(d):
    """(quién, texto) de cada bloque de una línea del registro; los de las llamadas a este mismo script, fuera."""
    m = d.get('message') or {}
    contenido = m.get('content')
    if isinstance(contenido, str):
        yield ('usuaria' if d.get('type') == 'user' else 'claude'), contenido
        return
    for b in contenido or []:
        if not isinstance(b, dict):
            continue
        t = b.get('type')
        if t == 'text':
            yield ('usuaria' if d.get('type') == 'user' else 'claude'), b.get('text', '')
        elif t == 'tool_use':
            yield f'orden {b.get("name", "?")}', json.dumps(b.get('input') or {}, ensure_ascii=False)
        elif t == 'tool_result':
            c = b.get('content')
            if isinstance(c, list):
                c = '\n'.join(x.get('text', '') for x in c if isinstance(x, dict))
            yield 'resultado', c or ''


def buscar(ruta, patron, maximo, ancho):
    rx = re.compile(patron, re.I)
    hallados, propias = [], set()
    for linea in open(ruta, encoding='utf-8'):
        if 'recuperar.py' in linea:
            # Las búsquedas anteriores y sus resultados repetirían lo ya encontrado.
            propias.update(re.findall(r'"(?:id|tool_use_id)"\s*:\s*"(toolu_[^"]+)"', linea))
            continue
        if not rx.search(linea):
            continue
        try:
            d = json.loads(linea)
        except json.JSONDecodeError:
            continue
        if d.get('isSidechain') or d.get('isCompactSummary') or set(re.findall(r'toolu_\w+', linea)) & propias:
            continue
        for quien, texto in textos(d):
            m = rx.search(texto)
            if m:
                ini = max(0, m.start() - ancho // 2)
                trozo = re.sub(r'\s+', ' ', texto[ini:ini + ancho]).strip()
                hallados.append(f'[{(d.get("timestamp") or "")[:16]}] {quien}: {"…" if ini else ""}{trozo}…')
    for h in hallados[-maximo:]:
        print(h)
    print(f'{len(hallados)} fragmentos con /{patron}/' + (f' (los {maximo} últimos)' if len(hallados) > maximo else ''))


def git(*args):
    return subprocess.run(['git', '-C', RAIZ, *args], capture_output=True, text=True).stdout.strip()


def estado(ruta):
    rama = git('rev-parse', '--abbrev-ref', 'HEAD')
    print(f'Estado tras compactar (QA-116), rama {rama}:')
    bitacora = os.path.join(RAIZ, 'docs', 'registros', 'traspaso.md')
    if os.path.exists(bitacora):
        fila = next((l for l in open(bitacora, encoding='utf-8') if l.startswith(f'| **Tarea en curso · `{rama}`**')), None)
        print('- Bitácora: ' + (fila.split('|', 2)[2].rsplit('|', 1)[0].strip() if fila else 'sin fila para esta rama'))
    cambios = git('status', '--short').splitlines()
    print(f'- Sin commit: {len(cambios)} archivos' + (': ' + ', '.join(c[3:] for c in cambios[:8]) if cambios else ''))
    print('- Últimos commits: ' + ' · '.join(git('log', '--format=%h %s', '-3').splitlines()))
    if ruta:
        n = sum(1 for l in open(ruta, encoding='utf-8') if '"compact_boundary"' in l)
        print(f'- Compactaciones en esta sesión: {n} (compáralo con el presupuesto de la tarea en la bitácora)')
    print('- Si falta un detalle de antes (un error, un trozo de código, lo que dijo la usuaria): '
          'python3 tools/qa/recuperar.py "<regex>", nunca leer el registro entero.')


def main():
    args = sys.argv[1:]
    opciones = {'--max': 10, '--ancho': 400, '--sesion': None}
    for k in list(opciones):
        if k in args:
            i = args.index(k)
            if i + 1 >= len(args):
                sys.exit(f'{k} necesita un valor')
            opciones[k] = args[i + 1] if k == '--sesion' else int(args[i + 1])
            del args[i:i + 2]
    ruta = opciones['--sesion'] or ruta_por_defecto()
    if args == ['--estado']:
        estado(ruta)
        return 0
    if len(args) != 1:
        print(__doc__)
        return 2
    if not ruta:
        sys.exit('No encuentro el registro de la sesión (usa --sesion <ruta.jsonl>)')
    buscar(ruta, args[0], opciones['--max'], opciones['--ancho'])
    return 0


if __name__ == '__main__':
    sys.exit(main())
