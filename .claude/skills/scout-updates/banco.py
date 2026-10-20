#!/usr/bin/env python3
"""Banco de calidad por pares para `scout-updates` (banco-calidad.md). Solo biblioteca estándar.

Uso:
  banco.py generar <casos.jsonl> --modelo M --salida <salidas.jsonl> [--url U] [--api ollama|openai]
  banco.py pares <salidas.jsonl> <salidas.jsonl> [...] --salida <pares.jsonl> --clave <clave.json> [--semilla N]
  banco.py juzgar <pares.jsonl> --juez M --rubrica <rubrica.md> --salida <veredictos.jsonl> [--url U] [--api ...]
  banco.py resumen <pares.jsonl> <clave.json> <veredictos.jsonl> [--json]

Casos: una línea por caso, {"id", "system"?, "prompt", "contexto"?, "opciones"?: {"temperature", "num_ctx",
"max_tokens"}}. `contexto` es lo que ve el juez (p. ej. la acción del jugador); sin él, los últimos 1500 caracteres
del prompt.
generar: una línea por caso, {"caso", "modelo", "salida", "ms"} o {"caso", "modelo", "error"}.
pares: por caso y por cada pareja de modelos, dos pares a ciegas (A como X y B como X), barajados; los nombres solo
van en la clave.
juzgar: el juez responde {"ganador": "X"|"Y"|"empate", "motivo"}. Para juzgar con Claude, la sesión escribe
veredictos.jsonl a mano con ese formato y {"par"}, sin abrir la clave.
resumen: por modelo, victorias (empate = 0,5) y tasa; consistencia = % de casos cuyo ganador no cambia al girar el
par (el que cambia cuenta como empate); sesgo de posición = % de veces que gana X.
"""
import argparse, itertools, json, random, sys, time, urllib.request

URL_OLLAMA = 'http://localhost:11434'
CONTEXTO_MAX = 1500


def leer_jsonl(ruta):
    with open(ruta, encoding='utf-8') as f:
        return [json.loads(l) for l in f if l.strip()]


def escribir_jsonl(ruta, filas):
    with open(ruta, 'w', encoding='utf-8') as f:
        for r in filas:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')


def llamar_http(url, api, modelo, system, prompt, opciones, formato_json=False, timeout=600):
    """Texto generado por el motor. api: 'ollama' (/api/generate) u 'openai' (/v1/chat/completions)."""
    opciones = opciones or {}
    if api == 'ollama':
        cuerpo = {'model': modelo, 'prompt': prompt, 'stream': False, 'options': {}}
        if system:
            cuerpo['system'] = system
        for k in ('temperature', 'num_ctx'):
            if k in opciones:
                cuerpo['options'][k] = opciones[k]
        if 'max_tokens' in opciones:
            cuerpo['options']['num_predict'] = opciones['max_tokens']
        if formato_json:
            cuerpo['format'] = 'json'
        destino = url.rstrip('/') + '/api/generate'
    else:
        mensajes = ([{'role': 'system', 'content': system}] if system else []) + [{'role': 'user', 'content': prompt}]
        cuerpo = {'model': modelo, 'messages': mensajes}
        for k in ('temperature', 'max_tokens'):
            if k in opciones:
                cuerpo[k] = opciones[k]
        if formato_json:
            cuerpo['response_format'] = {'type': 'json_object'}
        destino = url.rstrip('/') + '/v1/chat/completions'
    pet = urllib.request.Request(destino, json.dumps(cuerpo).encode(), {'Content-Type': 'application/json'})
    with urllib.request.urlopen(pet, timeout=timeout) as r:
        datos = json.load(r)
    return datos['response'] if api == 'ollama' else datos['choices'][0]['message']['content']


def generar(casos, modelo, llamar):
    filas = []
    for c in casos:
        inicio = time.monotonic()
        try:
            salida = llamar(modelo, c.get('system'), c['prompt'], c.get('opciones'))
            filas.append({'caso': c['id'], 'modelo': modelo, 'salida': salida.strip(),
                          'ms': round((time.monotonic() - inicio) * 1000)})
        except Exception as e:  # un caso fallido no tumba la tanda
            filas.append({'caso': c['id'], 'modelo': modelo, 'error': str(e)})
        print('%s %s %s' % (modelo, c['id'], 'error' if 'error' in filas[-1] else '%d ms' % filas[-1]['ms']),
              file=sys.stderr)
    return filas


def contexto(caso):
    return caso.get('contexto') or caso['prompt'][-CONTEXTO_MAX:]


def pares(tandas, casos, semilla=0):
    """tandas: listas de salidas, una por modelo. Devuelve (pares, clave)."""
    por_modelo = {}
    for tanda in tandas:
        for f in tanda:
            if 'salida' in f:
                por_modelo.setdefault(f['modelo'], {})[f['caso']] = f['salida']
    ctx = {c['id']: contexto(c) for c in casos}
    brutos = []
    for a, b in itertools.combinations(sorted(por_modelo), 2):
        for caso in sorted(set(por_modelo[a]) & set(por_modelo[b]) & set(ctx)):
            for x, y in ((a, b), (b, a)):
                brutos.append((caso, x, y))
    random.Random(semilla).shuffle(brutos)
    lista, clave = [], {}
    for i, (caso, x, y) in enumerate(brutos, 1):
        par = 'p%03d' % i
        lista.append({'par': par, 'caso': caso, 'contexto': ctx[caso], 'X': por_modelo[x][caso], 'Y': por_modelo[y][caso]})
        clave[par] = {'X': x, 'Y': y}
    return lista, clave


PROMPT_JUEZ = """Compara dos respuestas a la misma situación según la rúbrica. Ignora cuál va primero y la longitud
salvo que la rúbrica la pida. Responde solo con JSON: {{"ganador": "X" | "Y" | "empate", "motivo": "<una frase>"}}.

Rúbrica:
{rubrica}

Situación:
{contexto}

Respuesta X:
{x}

Respuesta Y:
{y}
"""


def juzgar(lista, juez, rubrica, llamar):
    veredictos = []
    for p in lista:
        texto = llamar(juez, None, PROMPT_JUEZ.format(rubrica=rubrica, contexto=p['contexto'], x=p['X'], y=p['Y']),
                       {'temperature': 0}, True)
        try:
            v = json.loads(texto)
            ganador = v.get('ganador') if v.get('ganador') in ('X', 'Y', 'empate') else None
        except ValueError:
            v, ganador = {}, None
        veredictos.append({'par': p['par'], 'ganador': ganador or 'empate', 'motivo': v.get('motivo', ''),
                           **({} if ganador else {'aviso': 'respuesta del juez ilegible: %s' % texto[:200]})})
    return veredictos


def resumen(lista, clave, veredictos):
    caso_de = {p['par']: p['caso'] for p in lista}
    por_ronda = {}  # (caso, pareja de modelos) -> [modelo ganador o None por empate]
    gana_x = juzgados = 0
    for v in veredictos:
        par = v['par']
        if par not in clave:
            continue
        juzgados += 1
        g = v['ganador']
        gana_x += g == 'X'
        modelos = tuple(sorted(clave[par].values()))
        por_ronda.setdefault((caso_de[par], modelos), []).append(clave[par][g] if g in ('X', 'Y') else None)
    puntos, jugadas = {}, {}
    consistentes = completas = 0
    for (_, modelos), ganadores in por_ronda.items():
        if len(ganadores) == 2:
            completas += 1
            if ganadores[0] == ganadores[1]:
                consistentes += 1
            else:
                ganadores = [None, None]  # cambia al girarlo: empate
        for g in ganadores:
            for m in modelos:
                jugadas[m] = jugadas.get(m, 0) + 1
                puntos[m] = puntos.get(m, 0) + (1 if g == m else 0.5 if g is None else 0)
    return {
        'modelos': {m: {'puntos': puntos[m], 'jugadas': jugadas[m], 'tasa': round(puntos[m] / jugadas[m], 3)}
                    for m in sorted(jugadas, key=lambda m: -puntos[m] / jugadas[m])},
        'consistencia': round(consistentes / completas, 3) if completas else None,
        'sesgo_x': round(gana_x / juzgados, 3) if juzgados else None,
        'juzgados': juzgados, 'sin_juzgar': len(lista) - juzgados,
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='orden', required=True)
    g = sub.add_parser('generar')
    g.add_argument('casos')
    g.add_argument('--modelo', required=True)
    g.add_argument('--salida', required=True)
    p = sub.add_parser('pares')
    p.add_argument('salidas', nargs='+')
    p.add_argument('--casos', required=True)
    p.add_argument('--salida', required=True)
    p.add_argument('--clave', required=True)
    p.add_argument('--semilla', type=int, default=0)
    j = sub.add_parser('juzgar')
    j.add_argument('pares')
    j.add_argument('--juez', required=True)
    j.add_argument('--rubrica', required=True)
    j.add_argument('--salida', required=True)
    for s in (g, j):
        s.add_argument('--url', default=URL_OLLAMA)
        s.add_argument('--api', choices=('ollama', 'openai'), default='ollama')
    r = sub.add_parser('resumen')
    r.add_argument('pares')
    r.add_argument('clave')
    r.add_argument('veredictos')
    r.add_argument('--json', action='store_true')
    a = ap.parse_args(argv)

    if a.orden in ('generar', 'juzgar'):
        def llamar(modelo, system, prompt, opciones, formato_json=False):
            return llamar_http(a.url, a.api, modelo, system, prompt, opciones, formato_json)
    if a.orden == 'generar':
        escribir_jsonl(a.salida, generar(leer_jsonl(a.casos), a.modelo, llamar))
    elif a.orden == 'pares':
        lista, clave = pares([leer_jsonl(s) for s in a.salidas], leer_jsonl(a.casos), a.semilla)
        escribir_jsonl(a.salida, lista)
        with open(a.clave, 'w', encoding='utf-8') as f:
            json.dump(clave, f, ensure_ascii=False, indent=1)
        print('%d pares' % len(lista))
    elif a.orden == 'juzgar':
        with open(a.rubrica, encoding='utf-8') as f:
            rubrica = f.read()
        escribir_jsonl(a.salida, juzgar(leer_jsonl(a.pares), a.juez, rubrica, llamar))
    else:
        with open(a.clave, encoding='utf-8') as f:
            clave = json.load(f)
        res = resumen(leer_jsonl(a.pares), clave, leer_jsonl(a.veredictos))
        if a.json:
            print(json.dumps(res, ensure_ascii=False, indent=1))
        else:
            for m, d in res['modelos'].items():
                print('%-40s tasa %.3f (%s de %d)' % (m, d['tasa'], d['puntos'], d['jugadas']))
            print('consistencia al girar: %s · gana X: %s · juzgados %d, sin juzgar %d'
                  % (res['consistencia'], res['sesgo_x'], res['juzgados'], res['sin_juzgar']))


if __name__ == '__main__':
    main()
