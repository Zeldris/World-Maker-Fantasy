#!/usr/bin/env python3
"""MAP-16: un agente mínimo con el modelo local (Ollama) para el banco de encargos del mapa.

    python3 map-generator/banco/agente_local.py ENCARGO_ID --copia DIR [--modelo qwen35-9b-32k] [--turnos 20]

Trabaja sobre `DIR/helek.json` (una copia; nunca el mapa del juego). Su única herramienta es `orden`, que ejecuta
`consultar.py …` o `editar.py …` con `--mundo DIR/helek.json` forzado (y `--sin-juego`); cualquier otra cosa se
rechaza. El prompt de sistema es la guía `map-generator/AGENTES.md`, igual que la que lee Claude. Escribe en
`DIR/registro.json` los turnos, las órdenes, el tiempo y los tokens; la nota la pone `corregir.py`.
"""
import argparse
import json
import os
import shlex
import subprocess
import sys
import time
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
MAPA = os.path.dirname(AQUI)
RAIZ = os.path.dirname(MAPA)
GUIA = os.path.join(MAPA, 'AGENTES.md')
OLLAMA = os.environ.get('OLLAMA_URL', 'http://127.0.0.1:11434')
PERMITIDOS = {'consultar.py', 'editar.py'}
MAX_SALIDA = 6000

HERRAMIENTA = {
    'type': 'function',
    'function': {
        'name': 'orden',
        'description': ('Ejecuta una orden del mapa: "consultar.py <suborden> …" o "editar.py <lote.json|-> …". '
                        'Para editar.py, pasa el lote en el argumento "lote" (JSON) y usa "-" como archivo. '
                        'Ya trabaja sobre la copia: no pongas --mundo.'),
        'parameters': {
            'type': 'object',
            'properties': {
                'orden': {'type': 'string', 'description': 'p. ej. consultar.py frontera Llanuras Meseta'},
                'lote': {'type': 'string', 'description': 'el lote JSON para editar.py - (opcional)'},
            },
            'required': ['orden'],
        },
    },
}


def ejecutar(orden, lote, copia):
    """Ejecuta una orden permitida sobre la copia; devuelve (texto, código)."""
    try:
        partes = shlex.split(orden)
    except ValueError as e:
        return f'orden mal escrita: {e}', 2
    if partes and partes[0] in ('python3', 'python'):
        partes = partes[1:]
    if not partes:
        return 'orden vacía', 2
    script = partes[0].removeprefix('map-generator/')
    if script not in PERMITIDOS:
        return f'solo se permiten {sorted(PERMITIDOS)}; no "{partes[0]}"', 2
    args = [a for a in partes[1:]]
    for prohibido in ('--mundo', '--canon', '--lore'):
        if prohibido in args:
            return f'{prohibido} no se puede usar: ya trabajas sobre la copia', 2
    mundo = os.path.join(copia, 'helek.json')
    cmd = [sys.executable, os.path.join(MAPA, script)] + args + ['--mundo', mundo]
    if script == 'editar.py':
        cmd.append('--sin-juego')
    try:
        r = subprocess.run(cmd, input=lote or None, capture_output=True, text=True, timeout=120, cwd=RAIZ)
    except subprocess.TimeoutExpired:
        return 'la orden tardó más de 120 s', 124
    salida = (r.stdout + ('\n' + r.stderr if r.stderr else '')).strip()
    if len(salida) > MAX_SALIDA:
        salida = salida[:MAX_SALIDA] + f'\n… (recortado: {len(salida)} caracteres; usa --caja o filtra)'
    return f'[salida {r.returncode}]\n{salida}', r.returncode


def chat(modelo, mensajes, contexto):
    cuerpo = json.dumps({'model': modelo, 'messages': mensajes, 'tools': [HERRAMIENTA], 'stream': False,
                         'options': {'num_ctx': contexto, 'temperature': 0.2}}).encode()
    req = urllib.request.Request(OLLAMA + '/api/chat', data=cuerpo, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=900) as r:
        return json.load(r)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('encargo')
    ap.add_argument('--copia', required=True)
    ap.add_argument('--modelo', default='qwen35-9b-32k')
    ap.add_argument('--turnos', type=int, default=20)
    ap.add_argument('--contexto', type=int, default=32768)
    a = ap.parse_args(argv)

    encargos = {e['id']: e for e in json.load(open(os.path.join(AQUI, 'encargos.json'), encoding='utf-8'))['encargos']}
    encargo = encargos[a.encargo]
    guia = open(GUIA, encoding='utf-8').read()
    mensajes = [
        {'role': 'system', 'content': guia + '\n\nTrabajas con la herramienta `orden`. Cuando acabes (guardado o '
                                             'decidido no hacerlo), responde sin llamar a la herramienta con un '
                                             'resumen de lo hecho.'},
        {'role': 'user', 'content': encargo['texto']},
    ]
    registro = {'encargo': a.encargo, 'modelo': a.modelo, 'turnos': [], 'tokens_entrada': 0, 'tokens_salida': 0}
    t0 = time.time()
    final = None
    for _ in range(a.turnos):
        t = time.time()
        try:
            r = chat(a.modelo, mensajes, a.contexto)
        except Exception as e:  # red, Ollama caído: se apunta y se para
            registro['error'] = f'{type(e).__name__}: {e}'
            break
        registro['tokens_entrada'] += r.get('prompt_eval_count', 0)
        registro['tokens_salida'] += r.get('eval_count', 0)
        m = r['message']
        mensajes.append({k: v for k, v in m.items() if k in ('role', 'content', 'tool_calls')})
        llamadas = m.get('tool_calls') or []
        turno = {'segundos': round(time.time() - t, 1), 'texto': (m.get('content') or '')[:800], 'ordenes': []}
        if not llamadas:
            registro['turnos'].append(turno)
            final = m.get('content', '')
            break
        for ll in llamadas:
            arg = ll['function'].get('arguments') or {}
            if isinstance(arg, str):
                try:
                    arg = json.loads(arg)
                except ValueError:
                    arg = {'orden': arg}
            lote = arg.get('lote')
            if lote is not None and not isinstance(lote, str):
                lote = json.dumps(lote, ensure_ascii=False)
            salida, codigo = ejecutar(str(arg.get('orden', '')), lote, a.copia)
            turno['ordenes'].append({'orden': arg.get('orden'), 'lote': (lote or '')[:2000], 'codigo': codigo,
                                     'salida': salida[:600]})
            mensajes.append({'role': 'tool', 'content': salida, 'tool_name': 'orden'})
        registro['turnos'].append(turno)
        print(f"turno {len(registro['turnos'])}: {[o['orden'] for o in turno['ordenes']]} ({turno['segundos']} s)",
              flush=True)
    registro['segundos'] = round(time.time() - t0, 1)
    registro['final'] = final
    registro['agotado'] = final is None and 'error' not in registro
    with open(os.path.join(a.copia, 'registro.json'), 'w', encoding='utf-8') as f:
        json.dump(registro, f, ensure_ascii=False, indent=1)
    print(f"fin: {len(registro['turnos'])} turnos, {registro['segundos']} s; {final or registro.get('error') or 'sin acabar'}"[:600])


if __name__ == '__main__':
    main()
