#!/usr/bin/env python3
"""Mide el registro por llamada de `opt-ai` (formato: docs/ia/opt-ai-registro.md). Solo biblioteca estándar.

Uso:
  medir.py <registro.jsonl> [--anterior <registro.jsonl>] [--perfil X] [--con-calentar] [--json]

Por perfil, tarea y modelo (gen_ai.request.model; '-' si falta; fila `perfil/tarea/modelo`): n, p50 y p95 de duration_ms, ttft p50, tokens medios de entrada y salida, tok/s de
generación, % de cargas en frío (load_ms > 100) y de recortados, sobre las filas que llevan ese campo ('-' si ninguna),
y % de errores (sobre todas). La tarea `calentar` (calentamiento al arrancar) se excluye salvo con --con-calentar. RAG (operation `retrieval`):
n, p50 de embed_ms y search_ms, score medio del primer resultado. Con --anterior, la diferencia por fila.
Las líneas corruptas se ignoran con un aviso; las tareas sin perfil se avisan.
"""
import argparse, json, math, sys

FRIO_MS = 100
SIN_PERFIL = 'desconocido'
SIN_MODELO = '-'
CALENTAR = 'calentar'


def percentil(valores, p):
    """Percentil p (0-100) por interpolación lineal; None si no hay valores."""
    v = sorted(valores)
    if not v:
        return None
    if len(v) == 1:
        return float(v[0])
    k = (len(v) - 1) * p / 100
    i = int(k)
    return float(v[i]) if i + 1 >= len(v) else v[i] + (v[i + 1] - v[i]) * (k - i)


def media(valores):
    return sum(valores) / len(valores) if valores else None


def leer(ruta, avisos):
    registros = []
    try:
        f = open(ruta, encoding='utf-8', errors='replace')
    except OSError as e:
        sys.exit(f'No se puede leer {ruta}: {e.strerror}')
    with f:
        for n, linea in enumerate(f, 1):
            if not linea.strip():
                continue
            try:
                r = json.loads(linea)
                if not isinstance(r, dict):
                    raise ValueError('no es un objeto')
                registros.append(r)
            except ValueError:
                avisos.append(f'{ruta}: línea {n} corrupta, ignorada')
    return registros


def es_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def nums(rs, campo):
    return [r[campo] for r in rs if es_num(r.get(campo))]


def pct(parte, total):
    return 100 * parte / total if total else None


def fila_llamadas(rs):
    n = len(rs)
    dec = [r for r in rs if es_num(r.get('gen_ai.usage.output_tokens'))
           and es_num(r.get('app.decode_ms')) and r['app.decode_ms'] > 0]
    toks = sum(r['gen_ai.usage.output_tokens'] for r in dec)
    ms = sum(r['app.decode_ms'] for r in dec)
    dur = nums(rs, 'app.duration_ms')
    cargas = nums(rs, 'app.load_ms')
    recortes = [r['app.truncated'] for r in rs if isinstance(r.get('app.truncated'), bool)]
    return {
        'n': n,
        'p50_ms': percentil(dur, 50), 'p95_ms': percentil(dur, 95),
        'ttft_p50_ms': percentil(nums(rs, 'app.ttft_ms'), 50),
        'tok_in': media(nums(rs, 'gen_ai.usage.input_tokens')),
        'tok_out': media(nums(rs, 'gen_ai.usage.output_tokens')),
        'tok_s': toks / (ms / 1000) if ms else None,
        'frio_pct': pct(sum(1 for x in cargas if x > FRIO_MS), len(cargas)),
        'recortado_pct': pct(sum(1 for x in recortes if x), len(recortes)),
        'error_pct': 100 * sum(1 for r in rs if r.get('app.error')) / n,
    }


def fila_rag(rs):
    primeros = []
    for r in rs:
        res = r.get('app.rag.results')
        if isinstance(res, list) and res and isinstance(res[0], dict) and isinstance(res[0].get('score'), (int, float)):
            primeros.append(res[0]['score'])
    return {'n': len(rs), 'embed_p50_ms': percentil(nums(rs, 'app.rag.embed_ms'), 50),
            'search_p50_ms': percentil(nums(rs, 'app.rag.search_ms'), 50), 'score_1': media(primeros)}


def agrupar(registros, perfil=None, con_calentar=False):
    llamadas, rag = {}, {}
    for r in registros:
        p = r.get('app.machine_profile') or SIN_PERFIL
        if perfil and p != perfil:
            continue
        t = r.get('app.task') or 'sin_tarea'
        if t == CALENTAR and not con_calentar:
            continue
        m = r.get('gen_ai.request.model') or SIN_MODELO
        destino = rag if r.get('gen_ai.operation.name') == 'retrieval' else llamadas
        destino.setdefault((p, t, m), []).append(r)
    return ({k: fila_llamadas(v) for k, v in sorted(llamadas.items())},
            {k: fila_rag(v) for k, v in sorted(rag.items())})


def analizar(ruta, perfil=None, avisos=None, con_calentar=False):
    avisos = [] if avisos is None else avisos
    regs = leer(ruta, avisos)
    if not regs:
        avisos.append(f'{ruta}: sin registros válidos')
    llamadas, rag = agrupar(regs, perfil, con_calentar)
    sin_perfil = sorted({t for (p, t, _m) in list(llamadas) + list(rag) if p == SIN_PERFIL})
    if sin_perfil:
        avisos.append('tareas sin perfil (¿falta IA_PERFIL?): ' + ', '.join(sin_perfil))
    return {'llamadas': llamadas, 'rag': rag, 'avisos': avisos}


def diferencia(actual, anterior):
    """Por fila y campo numérico: actual - anterior (None si falta alguno); fila nueva: 'sin anterior'."""
    out = {}
    for clave, fila in actual.items():
        previa = anterior.get(clave)
        if previa:
            out[clave] = {c: (None if v is None or previa.get(c) is None else v - previa[c])
                          for c, v in fila.items()}
        else:
            out[clave] = 'sin anterior'
    return out


def fmt(v, dec=0):
    return '-' if v is None else f'{v:.{dec}f}'


def fmt_dif(v, dec=0):
    return '' if v is None else f' ({v:+.{dec}f})'


COLS_LL = [('n', 0), ('p50_ms', 0), ('p95_ms', 0), ('ttft_p50_ms', 0), ('tok_in', 0), ('tok_out', 0),
           ('tok_s', 1), ('frio_pct', 0), ('recortado_pct', 0), ('error_pct', 0)]
COLS_RAG = [('n', 0), ('embed_p50_ms', 0), ('search_p50_ms', 0), ('score_1', 3)]


def tabla(titulo, filas, cols, difs):
    if not filas:
        return []
    out = [titulo, '  perfil/tarea/modelo  ' + '  '.join(c for c, _ in cols)]
    for (p, t, m), fila in filas.items():
        d = difs.get((p, t, m), {})
        nota = '  (sin anterior)' if d == 'sin anterior' else ''
        d = d if isinstance(d, dict) else {}
        out.append(f'  {p}/{t}/{m}  ' + '  '.join(fmt(fila[c], dec) + fmt_dif(d.get(c), dec) for c, dec in cols) + nota)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('registro')
    ap.add_argument('--anterior')
    ap.add_argument('--perfil')
    ap.add_argument('--con-calentar', action='store_true', help='incluye la tarea calentar (se excluye por defecto)')
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args(argv)
    avisos = []
    act = analizar(a.registro, a.perfil, avisos, a.con_calentar)
    ant = analizar(a.anterior, a.perfil, avisos, a.con_calentar) if a.anterior else None
    dif_ll = diferencia(act['llamadas'], ant['llamadas']) if ant else {}
    dif_rag = diferencia(act['rag'], ant['rag']) if ant else {}
    if a.json:
        claves = lambda d: {f'{p}/{t}/{m}': v for (p, t, m), v in d.items()}
        print(json.dumps({'llamadas': claves(act['llamadas']), 'rag': claves(act['rag']),
                          'diferencia_llamadas': claves(dif_ll), 'diferencia_rag': claves(dif_rag),
                          'avisos': avisos}, ensure_ascii=False, indent=2))
    else:
        out = tabla('LLAMADAS (ms; tok/s de generación; % frío/recortado/error)', act['llamadas'], COLS_LL, dif_ll)
        out += tabla('RAG', act['rag'], COLS_RAG, dif_rag)
        out += ['AVISO: ' + x for x in avisos]
        print('\n'.join(out) if out else 'Sin datos.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
