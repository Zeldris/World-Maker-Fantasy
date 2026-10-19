#!/usr/bin/env python3
"""Dónde se van los tokens de una sesión de Claude Code (skill `opt-tokens`).

Lee el registro de la sesión (`~/.claude/projects/<proyecto>/<sesión>.jsonl`) y saca:
  - el uso real de la API (entrada, caché escrita, caché leída, salida) de las llamadas del periodo;
  - por herramienta: cuántas llamadas, los tokens que metieron sus resultados en el contexto y los tokens
    **arrastrados** (cada resultado se vuelve a enviar en cada llamada posterior hasta la siguiente
    compactación: un resultado de 5k tokens con 200 llamadas detrás pesa 1M);
  - los resultados más pesados, las imágenes, los errores, y lo repetido (mismo archivo leído o misma orden).

Uso:
  python3 medir.py                       la sesión más reciente del proyecto actual, últimas 24 h
  python3 medir.py --horas 6             otro periodo (0 = toda la sesión)
  python3 medir.py --sesion <ruta.jsonl> otra sesión
  python3 medir.py --top 20              cuántas filas en cada lista

Los tokens de un resultado se estiman por su tamaño (caracteres / 3,5; una imagen, ~1.600). El uso de la API es
el exacto que trae el registro.
"""
import argparse, collections, datetime as dt, glob, json, os, re, sys

TOKENS_IMAGEN = 1600
CHARS_POR_TOKEN = 3.5


def ruta_por_defecto():
    proyecto = re.sub(r'[^A-Za-z0-9]', '-', os.getcwd())
    candidatos = glob.glob(os.path.expanduser(f'~/.claude/projects/{proyecto}/*.jsonl'))
    if not candidatos:
        sys.exit(f'No hay sesiones en ~/.claude/projects/{proyecto}/ (usa --sesion)')
    return max(candidatos, key=os.path.getmtime)


def tokens_de(contenido):
    """Tokens estimados y número de imágenes de un `tool_result`."""
    if isinstance(contenido, str):
        return len(contenido) / CHARS_POR_TOKEN, 0
    total, imagenes = 0.0, 0
    for b in contenido or []:
        if b.get('type') == 'image':
            imagenes += 1
            total += TOKENS_IMAGEN
        else:
            total += len(b.get('text', '') or '') / CHARS_POR_TOKEN
    return total, imagenes


def resumen_entrada(nombre, entrada):
    for clave in ('command', 'file_path', 'pattern', 'url', 'query', 'skill', 'description'):
        if clave in entrada:
            return f'{clave}={str(entrada[clave])[:110]}'
    return json.dumps(entrada, ensure_ascii=False)[:110]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sesion')
    ap.add_argument('--horas', type=float, default=24)
    ap.add_argument('--top', type=int, default=12)
    a = ap.parse_args()
    ruta = a.sesion or ruta_por_defecto()
    desde = None
    if a.horas > 0:
        desde = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=a.horas)

    usos = collections.Counter()
    llamadas_api = 0
    usos_tool = {}  # id → (nombre, resumen)
    resultados = []  # (indice_llamada, id, tokens, imagenes, es_error)
    cortes = []  # índice de llamada en el que hubo compactación
    for linea in open(ruta, encoding='utf-8'):
        try:
            d = json.loads(linea)
        except json.JSONDecodeError:
            continue
        ts = d.get('timestamp')
        if desde and ts:
            if dt.datetime.fromisoformat(ts.replace('Z', '+00:00')) < desde:
                continue
        if d.get('isSidechain'):
            continue
        if d.get('type') == 'system' and d.get('subtype') == 'compact_boundary':
            cortes.append(llamadas_api)
            continue
        m = d.get('message') or {}
        if d.get('type') == 'assistant':
            u = m.get('usage')
            if u:
                llamadas_api += 1
                for k in ('input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'output_tokens'):
                    usos[k] += u.get(k) or 0
            for b in m.get('content') or []:
                if isinstance(b, dict) and b.get('type') == 'tool_use':
                    entrada = b.get('input') or {}
                    usos_tool[b['id']] = (b.get('name', '?'), resumen_entrada(b.get('name'), entrada), json.dumps(entrada, sort_keys=True))
        elif d.get('type') == 'user':
            for b in m.get('content') or [] if isinstance(m.get('content'), list) else []:
                if isinstance(b, dict) and b.get('type') == 'tool_result':
                    t, img = tokens_de(b.get('content'))
                    resultados.append((llamadas_api, b.get('tool_use_id'), t, img, bool(b.get('is_error'))))

    if llamadas_api == 0:
        sys.exit('No hay llamadas en ese periodo (prueba --horas 0)')

    def arrastre(idx):
        # Llamadas posteriores hasta la siguiente compactación: cada una vuelve a leer el resultado.
        fin = next((c for c in cortes if c > idx), llamadas_api)
        return max(fin - idx, 1)

    por_tool = collections.defaultdict(lambda: [0, 0.0, 0.0, 0, 0])  # llamadas, tokens, arrastrados, imágenes, errores
    filas = []
    repetidas = collections.Counter()
    for idx, tid, t, img, err in resultados:
        nombre, resumen, completa = usos_tool.get(tid, ('?', '', ''))
        arr = t * arrastre(idx)
        p = por_tool[nombre]
        p[0] += 1; p[1] += t; p[2] += arr; p[3] += img; p[4] += err
        filas.append((arr, t, nombre, resumen, img, err))
        if nombre in ('Read', 'Bash', 'Grep', 'Glob', 'WebFetch'):
            repetidas[(nombre, completa, resumen)] += 1

    total_in = usos['input_tokens'] + usos['cache_creation_input_tokens'] + usos['cache_read_input_tokens']
    print(f'Sesión: {os.path.basename(ruta)}  ·  periodo: {"toda" if not desde else f"últimas {a.horas:g} h"}')
    print(f'Llamadas a la API: {llamadas_api}  ·  compactaciones: {len(cortes)}')
    print(f'Entrada {total_in:,.0f} tokens (caché leída {usos["cache_read_input_tokens"]:,.0f} = '
          f'{100 * usos["cache_read_input_tokens"] / max(total_in, 1):.0f} %, escrita {usos["cache_creation_input_tokens"]:,.0f}, '
          f'sin caché {usos["input_tokens"]:,.0f})  ·  salida {usos["output_tokens"]:,.0f}')
    print(f'Contexto medio por llamada: {total_in / llamadas_api:,.0f} tokens  →  cada llamada de más cuesta eso '
          f'(a precio de caché, ~{total_in / llamadas_api / 10:,.0f} tokens de entrada normal)')
    print(f'Salida media por llamada: {usos["output_tokens"] / llamadas_api:,.0f} tokens (incluye el razonamiento)')
    print()
    print('POR HERRAMIENTA (tokens que metió en el contexto · arrastrados en las llamadas siguientes)')
    for nombre, (n, t, arr, img, err) in sorted(por_tool.items(), key=lambda x: -x[1][2])[: a.top]:
        extra = (f' · {img} imágenes' if img else '') + (f' · {err} errores' if err else '')
        print(f'  {nombre:<28} {n:>5} llamadas  {t:>9,.0f} tok  {arr:>13,.0f} arrastrados{extra}')
    print()
    print('RESULTADOS QUE MÁS PESARON (arrastrados)')
    for arr, t, nombre, resumen, img, err in sorted(filas, reverse=True)[: a.top]:
        print(f'  {arr:>12,.0f}  ({t:>7,.0f} tok) {nombre}: {resumen}{" [imagen]" if img else ""}{" [error]" if err else ""}')
    rep = [(n, k) for k, n in repetidas.items() if n > 1]
    if rep:
        print()
        print('REPETIDO (la misma lectura u orden, idéntica, más de una vez)')
        for n, (nombre, _, resumen) in sorted(rep, reverse=True)[: a.top]:
            print(f'  {n:>3}× {nombre}: {resumen}')


if __name__ == '__main__':
    main()
