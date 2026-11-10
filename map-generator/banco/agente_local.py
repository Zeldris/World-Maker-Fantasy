#!/usr/bin/env python3
"""MAP-16/MAP-18: un agente mínimo con el modelo local (Ollama) para editar el mapa.

    python3 map-generator/banco/agente_local.py ENCARGO_ID --copia DIR [--modelo qwen35-9b-32k] [--turnos 20]
    python3 map-generator/banco/agente_local.py --texto "pon la ficha … en …" [--copia DIR]   # MAP-18: encargo libre

Trabaja sobre `DIR/helek.json` (una copia; nunca el mapa del juego). Su única herramienta es `orden`, que ejecuta
`consultar.py …` o `editar.py …` con `--mundo DIR/helek.json` forzado (y `--sin-juego`); cualquier otra cosa, y
`--forzar`, se rechaza. El prompt de sistema es la guía `map-generator/AGENTES.md`, igual que la que lee Claude.
Escribe en `DIR/registro.json` los turnos, las órdenes, el tiempo y los tokens; en el banco, la nota la pone
`banco.py corregir`.

Con `--texto` (encargo libre, MAP-18) copia antes el mapa del juego a DIR (por defecto, una carpeta temporal nueva)
y, al acabar, junta en `DIR/lote.json` lo que guardó en la copia (comprobado: aplicado de una vez a otra copia del
original da el mismo mapa) y en `DIR/informe.md` su respuesta y el informe de `editar.py DIR/lote.json` sobre el
mapa del juego (solo comprueba). Guardarlo es cosa de Claude o de la usuaria: `editar.py DIR/lote.json --guardar`.
"""
import argparse
import json
import os
import shlex
import shutil
import subprocess
import sys
import tempfile
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
    for a in args:
        nombre = a.split('=', 1)[0]
        for prohibido in ('--mundo', '--canon', '--lore', '--forzar'):
            # argparse acepta abreviaturas (--can) y --canon=x: se rechaza todo lo que pueda resolverse a un prohibido
            if len(nombre) > 2 and nombre.startswith('--') and prohibido.startswith(nombre):
                if prohibido == '--forzar':
                    return '--forzar no se puede usar: si el canon o el lore fallan, no se guarda (dilo)', 2
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


SIGUE = ('Tu respuesta ha llegado vacía. Si aún no has acabado, llama a la herramienta `orden`; si ya acabaste, '
         'responde con el resumen de lo hecho (o por qué no).')


def chat(modelo, mensajes, contexto, pensar=False):
    # pensar=False: con el razonamiento de Qwen3.5 un turno tardaba ~400 s y acababa con la respuesta vacía
    cuerpo = json.dumps({'model': modelo, 'messages': mensajes, 'tools': [HERRAMIENTA], 'stream': False,
                         'think': pensar, 'options': {'num_ctx': contexto, 'temperature': 0.2}}).encode()
    req = urllib.request.Request(OLLAMA + '/api/chat', data=cuerpo, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=900) as r:
        return json.load(r)


def _guarda(orden):
    """¿Es `editar.py … --guardar`? (editar.py no acepta abreviaturas: --gu da error y no guarda)"""
    try:
        partes = shlex.split(orden)
    except ValueError:
        return False
    if partes and partes[0] in ('python3', 'python'):
        partes = partes[1:]
    if not partes or partes[0].removeprefix('map-generator/') != 'editar.py':
        return False
    return '--guardar' in partes[1:]


def correr(texto, copia, modelo='qwen35-9b-32k', turnos=20, contexto=32768, pensar=False, chat=chat):
    """Bucle del agente sobre la copia. Devuelve el registro (también lo escribe en DIR/registro.json); en
    `registro['guardados']` van los lotes que guardó en la copia, en orden."""
    guia = open(GUIA, encoding='utf-8').read()
    mensajes = [
        {'role': 'system', 'content': guia + '\n\nTrabajas con la herramienta `orden`. Cuando acabes (guardado o '
                                             'decidido no hacerlo), responde sin llamar a la herramienta con un '
                                             'resumen de lo hecho.'},
        {'role': 'user', 'content': texto},
    ]
    registro = {'modelo': modelo, 'turnos': [], 'guardados': [], 'tokens_entrada': 0, 'tokens_salida': 0}
    t0 = time.time()
    final = None
    for _ in range(turnos):
        t = time.time()
        try:
            r = chat(modelo, mensajes, contexto, pensar)
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
            if (m.get('content') or '').strip():
                final = m['content']
                break
            mensajes.append({'role': 'user', 'content': SIGUE})  # vacía: no es el final
            continue
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
            orden = str(arg.get('orden', ''))
            salida, codigo = ejecutar(orden, lote, copia)
            if codigo == 0 and _guarda(orden):
                registro['guardados'].append(lote)
            turno['ordenes'].append({'orden': arg.get('orden'), 'lote': (lote or '')[:2000], 'codigo': codigo,
                                     'salida': salida[:600]})
            mensajes.append({'role': 'tool', 'content': salida, 'tool_name': 'orden'})
        registro['turnos'].append(turno)
        print(f"turno {len(registro['turnos'])}: {[o['orden'] for o in turno['ordenes']]} ({turno['segundos']} s)",
              flush=True)
    registro['segundos'] = round(time.time() - t0, 1)
    registro['final'] = final
    registro['agotado'] = final is None and 'error' not in registro
    with open(os.path.join(copia, 'registro.json'), 'w', encoding='utf-8') as f:
        json.dump(registro, f, ensure_ascii=False, indent=1)
    print(f"fin: {len(registro['turnos'])} turnos, {registro['segundos']} s; {final or registro.get('error') or 'sin acabar'}"[:600])
    return registro


def preparar_copia(copia, mundo):
    """Copia el mapa del juego a `copia` (helek.json, original.json y su GeoJSON). Nunca sobre el propio mapa."""
    if os.path.realpath(copia) == os.path.realpath(os.path.dirname(mundo)):
        raise SystemExit('--copia no puede ser la carpeta del mapa del juego')
    os.makedirs(copia, exist_ok=True)
    for viejo in ('registro.json', 'lote.json', 'informe.md'):
        if os.path.exists(os.path.join(copia, viejo)):
            os.remove(os.path.join(copia, viejo))
    for sub in ('historial', 'comprobacion'):
        shutil.rmtree(os.path.join(copia, sub), ignore_errors=True)
    shutil.copy(mundo, os.path.join(copia, 'helek.json'))
    shutil.copy(mundo, os.path.join(copia, 'original.json'))
    geo = os.path.join(os.path.dirname(mundo), 'helek.geojson')
    if os.path.exists(geo):
        shutil.copy(geo, os.path.join(copia, 'helek.geojson'))


def juntar(lotes):
    """Un lote con todos: las listas se encadenan en orden; lo demás, el último."""
    junto = {}
    for texto in lotes:
        for k, v in json.loads(texto or '{}').items():
            if isinstance(v, list):
                junto.setdefault(k, []).extend(v)
            else:
                junto[k] = v
    return junto


def _editar(args, lote=None):
    r = subprocess.run([sys.executable, os.path.join(MAPA, 'editar.py')] + args, input=lote, capture_output=True,
                       text=True, timeout=300, cwd=RAIZ)
    return r.returncode, (r.stdout + ('\n' + r.stderr if r.stderr else '')).strip()


def entregar(copia, registro, texto, mundo):
    """Deja en la copia `lote.json` (si guardó algo y cuadra) e `informe.md`. Devuelve la ruta del lote o None."""
    lineas = [f'# Encargo al agente local ({registro["modelo"]})', '', f'> {texto}', '',
              f'{len(registro["turnos"])} turnos, {registro["segundos"]} s.', '', '## Su respuesta', '',
              registro.get('final') or f'(sin respuesta final: {registro.get("error") or "agotó los turnos"})', '']
    ruta_lote = None
    if not registro['guardados']:
        lineas += ['## Lote', '', 'No guardó nada en la copia: no hay lote.']
    else:
        junto = json.dumps(juntar(registro['guardados']), ensure_ascii=False)
        prueba = os.path.join(copia, 'comprobacion')
        shutil.rmtree(prueba, ignore_errors=True)
        os.makedirs(prueba)
        shutil.copy(os.path.join(copia, 'original.json'), os.path.join(prueba, 'helek.json'))
        codigo, salida = _editar(['-', '--guardar', '--sin-juego', '--mundo', os.path.join(prueba, 'helek.json')],
                                 junto)
        with open(os.path.join(prueba, 'helek.json'), 'rb') as a, open(os.path.join(copia, 'helek.json'), 'rb') as b:
            cuadra = codigo == 0 and a.read() == b.read()
        if not cuadra:
            lineas += ['## Lote', '', f'Guardó {len(registro["guardados"])} lotes en la copia, pero juntos no dan el '
                       'mismo mapa: **no hay lote fiable**. Los lotes están en `registro.json` (`guardados`).', '',
                       '```', salida[:3000], '```']
        else:
            ruta_lote = os.path.join(copia, 'lote.json')
            with open(ruta_lote, 'w', encoding='utf-8') as f:
                f.write(json.dumps(json.loads(junto), ensure_ascii=False, indent=1) + '\n')
            shutil.rmtree(prueba)
            codigo, salida = _editar([ruta_lote, '--mundo', mundo])
            lineas += ['## Lote', '', f'`{ruta_lote}` ({len(registro["guardados"])} guardado(s) en la copia, juntos).',
                       '', '## Informe sobre el mapa del juego (solo comprueba)', '', '```', salida[:6000], '```', '',
                       'Para guardarlo, tras revisarlo:', '',
                       f'    python3 map-generator/editar.py {ruta_lote} --guardar']
    with open(os.path.join(copia, 'informe.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lineas) + '\n')
    return ruta_lote


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('encargo', nargs='?', help='id de encargos.json (banco)')
    ap.add_argument('--texto', help='MAP-18: encargo libre ("-" = entrada estándar); copia antes el mapa del juego')
    ap.add_argument('--copia', help='carpeta de trabajo (con --texto, por defecto una temporal nueva)')
    ap.add_argument('--modelo', default='qwen35-9b-32k')
    ap.add_argument('--turnos', type=int, default=20)
    ap.add_argument('--contexto', type=int, default=32768)
    ap.add_argument('--pensar', action='store_true', help='deja razonar al modelo (mucho más lento)')
    a = ap.parse_args(argv)
    if (a.encargo is None) == (a.texto is None):
        ap.error('o un ENCARGO_ID del banco o --texto, uno de los dos')
    if a.encargo is not None:
        if not a.copia:
            ap.error('con un encargo del banco, --copia DIR (la prepara banco.py preparar)')
        encargos = {e['id']: e for e in json.load(open(os.path.join(AQUI, 'encargos.json'), encoding='utf-8'))['encargos']}
        registro = correr(encargos[a.encargo]['texto'], a.copia, a.modelo, a.turnos, a.contexto, a.pensar)
        registro['encargo'] = a.encargo
        with open(os.path.join(a.copia, 'registro.json'), 'w', encoding='utf-8') as f:
            json.dump(registro, f, ensure_ascii=False, indent=1)
        return
    texto = sys.stdin.read() if a.texto == '-' else a.texto
    if not texto.strip():
        ap.error('--texto vacío')
    sys.path.insert(0, MAPA)
    import medir
    copia = a.copia or tempfile.mkdtemp(prefix='mapa-agente-')
    preparar_copia(copia, medir.MUNDO)
    print(f'copia: {copia}', flush=True)
    registro = correr(texto, copia, a.modelo, a.turnos, a.contexto, a.pensar)
    lote = entregar(copia, registro, texto, medir.MUNDO)
    print(f'lote: {lote or "ninguno"}\ninforme: {os.path.join(copia, "informe.md")}')


if __name__ == '__main__':
    main()
