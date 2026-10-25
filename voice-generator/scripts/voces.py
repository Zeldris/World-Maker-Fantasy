#!/usr/bin/env python3
"""Datos de las voces (VOZ-3, VOZ-4): ficha de diseño → frase del --instruct, efectos.json → efectos de SoX, y la
comprobación de todas las fichas. Lo usan disenar.sh, escuchar.sh y fauna.sh; diseño en
docs/arquitectura/reutilizables/02-voces-y-sonidos-locales.md.

Uso:
  voces.py instruct <diseno.json>         la frase del --instruct (las 12 claves, en una línea)
  voces.py texto <diseno.json>            el texto de prueba de la ficha
  voces.py semilla <diseno.json> <n>      apunta en la ficha la semilla de la toma elegida (sin tocar el resto)
  voces.py sox <efectos.json|cadena.json> los efectos de SoX, un argumento por línea; lo que SoX no hace
                                          (formantes, capas) se avisa por stderr y se salta
  voces.py comprobar [carpeta]            todas las fichas y cadenas de voces/ y fauna/ (por defecto, las de
                                          voice-generator/); sale con 1 y la lista si algo falla
"""
import json
import os
import re
import sys

G = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))  # voice-generator/
RAZAS_TS = os.path.join(G, '..', 'backend', 'src', 'services', 'berigLore.ts')

# Las 12 claves de la plantilla, en el orden de la frase, con lo que se les pone detrás.
CLAVES = [('gender', ''), ('age', ''), ('pitch', ' pitch'), ('speed', ' speed'), ('volume', ' volume'),
          ('clarity', ''), ('fluency', ''), ('accent', ' accent'), ('texture', ' texture'), ('emotion', ''),
          ('tone', ' tone'), ('personality', ' personality')]
# Contra la deriva infantil (doc 02, «Evitar la deriva infantil»): edad adulta explícita y sin estas palabras.
EDADES = ('adult', 'middle-aged', 'elderly')
PROHIBIDAS = ('bright', 'cute', 'small', 'light', 'childlike', 'high-pitched', 'child', 'kid', 'teen', 'young')
TONOS_ALTOS = ('high', 'very high')

# tipo → (parámetros con su valor por defecto, None = obligatorio; plantilla de SoX). None en la plantilla: SoX no
# lo hace y se salta con aviso (lo hará Web Audio, VOZ-10).
EFECTOS = {
    'paso_alto': ({'hz': None}, 'highpass {hz}'),
    'paso_bajo': ({'hz': None}, 'lowpass {hz}'),
    'ecualizador': ({'hz': None, 'q': 1.0, 'db': None}, 'equalizer {hz} {q}q {db}'),
    'graves': ({'db': None, 'hz': 100}, 'bass {db} {hz}'),
    'agudos': ({'db': None, 'hz': 3000}, 'treble {db} {hz}'),
    'saturacion': ({'ganancia': None, 'color': 20}, 'overdrive {ganancia} {color}'),
    'coro': ({'retardo_ms': 55, 'decaimiento': 0.4, 'velocidad': 0.25, 'profundidad': 2},
             'chorus 0.7 0.9 {retardo_ms} {decaimiento} {velocidad} {profundidad} -t'),
    'reverberacion': ({'reverberancia': 50, 'amortiguacion': 50, 'sala': 100, 'retardo_ms': 0, 'humedo_db': 0},
                      'reverb {reverberancia} {amortiguacion} {sala} 100 {retardo_ms} {humedo_db}'),
    'tono': ({'semitonos': None}, 'pitch {centesimas}'),
    'volumen': ({'db': None}, 'gain {db}'),
    'eco': ({'retardo_ms': None, 'decaimiento': 0.4}, 'echo 0.8 0.88 {retardo_ms} {decaimiento}'),
    'formantes': ({'semitonos': None}, None),
    'capa': ({'sonido': None}, None),
}


def cargar(ruta):
    with open(ruta, encoding='utf-8') as f:
        return json.load(f)


def instruct(ficha):
    # Las comas de dentro de un valor separarían claves en la frase: se quitan («measured, deliberate pauses»).
    return ', '.join(str(ficha[k]).replace(',', '').strip() + sufijo for k, sufijo in CLAVES)


def sox(cadena, avisar=print):
    args = []
    for i, ef in enumerate(cadena.get('cadena', [])):
        params, plantilla = EFECTOS[ef['tipo']]
        if plantilla is None:
            avisar(f'aviso: «{ef["tipo"]}» (efecto {i + 1}) no lo hace SoX; se salta (pendiente, VOZ-4)')
            continue
        valores = {**params, **{k: v for k, v in ef.items() if k != 'tipo'}}
        if 'semitonos' in valores:
            valores['centesimas'] = round(float(valores['semitonos']) * 100)
        args += plantilla.format(**valores).split()
    return args


def errores_ficha(ficha):
    err = [f'falta «{k}»' for k, _ in CLAVES if not str(ficha.get(k, '')).strip()]
    err += [f'clave desconocida «{k}»' for k in ficha if k not in dict(CLAVES) and k not in ('semilla', 'texto_prueba')]
    if not isinstance(ficha.get('semilla'), int):
        err.append('«semilla» tiene que ser un número entero')
    if not str(ficha.get('texto_prueba', '')).strip():
        err.append('falta «texto_prueba»')
    edad = str(ficha.get('age', '')).lower()
    if edad and not any(e in edad for e in EDADES):
        err.append(f'la edad «{edad}» no es adulta y explícita ({", ".join(EDADES)})')
    if str(ficha.get('pitch', '')).lower() in TONOS_ALTOS:
        err.append('tono agudo en el diseño: se diseña medio o grave y se sube con efectos')
    for k, _ in CLAVES:
        for p in PROHIBIDAS:
            if re.search(rf'\b{re.escape(p)}\b', str(ficha.get(k, '')).lower()):
                err.append(f'«{p}» en «{k}» lleva a la deriva infantil (mejor airy, breathy, soft-spoken, whispering)')
    return err


def errores_cadena(cadena):
    if not isinstance(cadena.get('cadena'), list):
        return ['falta la lista «cadena»']
    err = []
    for i, ef in enumerate(cadena['cadena'], 1):
        tipo = ef.get('tipo')
        if tipo not in EFECTOS:
            err.append(f'efecto {i}: tipo desconocido «{tipo}» ({", ".join(EFECTOS)})')
            continue
        params = EFECTOS[tipo][0]
        err += [f'efecto {i} ({tipo}): falta «{k}»' for k, v in params.items() if v is None and k not in ef]
        err += [f'efecto {i} ({tipo}): parámetro desconocido «{k}»' for k in ef if k != 'tipo' and k not in params]
        err += [f'efecto {i} ({tipo}): «{k}» tiene que ser un número' for k, v in ef.items()
                if k not in ('tipo', 'sonido') and not isinstance(v, (int, float))]
    return err


def razas():
    """Los slugs de BERIG_RAZAS (el NPC habla con la voz de su raza, doc 02 «Asignar la voz»), más el narrador."""
    try:
        with open(RAZAS_TS, encoding='utf-8') as f:
            texto = f.read()
    except OSError:
        return None
    # Solo el array: detrás vienen BERIG_PERSONAJES, con slugs al mismo nivel.
    bloque = texto.split('export const BERIG_RAZAS', 1)[-1].split('\n];', 1)[0]
    # Las razas son los objetos de primer nivel: su slug va con 4 espacios; las variantes, con más.
    return set(re.findall(r"^ {4}slug: '([a-z0-9-]+)'", bloque, re.M)) | {'narrador'}


def comprobar(carpeta=G):
    fallos = []
    conocidas = razas()
    voces = os.path.join(carpeta, 'voces')
    for raza in sorted(os.listdir(voces)) if os.path.isdir(voces) else []:
        d = os.path.join(voces, raza)
        if not os.path.isdir(d):
            continue
        if conocidas is not None and raza not in conocidas:
            fallos.append(f'voces/{raza}: no es un slug de BERIG_RAZAS ni «narrador»')
        ef = os.path.join(d, 'efectos.json')
        if raza != 'narrador' and not os.path.exists(ef):
            fallos.append(f'voces/{raza}: falta efectos.json')
        for raiz, _, archivos in os.walk(d):
            rel = os.path.relpath(raiz, carpeta)
            for a in sorted(archivos):
                ruta = os.path.join(raiz, a)
                try:
                    if a == 'efectos.json':
                        fallos += [f'{rel}/{a}: {e}' for e in errores_cadena(cargar(ruta))]
                    elif a == 'diseno.json':
                        fallos += [f'{rel}/{a}: {e}' for e in errores_ficha(cargar(ruta))]
                        ref = os.path.join(raiz, 'referencia.txt')
                        if not os.path.exists(ref):
                            fallos.append(f'{rel}: falta referencia.txt (el texto que se dirá en la referencia)')
                            continue
                        with open(ref, encoding='utf-8') as f:
                            dice = f.read().strip()
                        if dice != str(cargar(ruta).get('texto_prueba', '')).strip():
                            # Las tomas dicen texto_prueba: la referencia clonada tiene que decir lo mismo.
                            fallos.append(f'{rel}: referencia.txt no dice lo mismo que «texto_prueba»')
                except (ValueError, OSError) as e:
                    fallos.append(f'{rel}/{a}: no se lee ({e})')
    fauna = os.path.join(carpeta, 'fauna')
    for especie in sorted(os.listdir(fauna)) if os.path.isdir(fauna) else []:
        ruta = os.path.join(fauna, especie, 'cadena.json')
        if os.path.isdir(os.path.join(fauna, especie)):
            try:
                fallos += [f'fauna/{especie}/cadena.json: {e}' for e in errores_cadena(cargar(ruta))]
            except (ValueError, OSError) as e:
                fallos.append(f'fauna/{especie}/cadena.json: no se lee ({e})')
    return fallos


def main(argv):
    if len(argv) < 2 or argv[1] not in ('instruct', 'texto', 'semilla', 'sox', 'comprobar'):
        print(__doc__.split('Uso:')[1].rstrip(), file=sys.stderr)
        return 2
    orden = argv[1]
    if orden == 'comprobar':
        fallos = comprobar(argv[2] if len(argv) > 2 else G)
        for f in fallos:
            print(f)
        print('voces: OK' if not fallos else f'voces: {len(fallos)} fallos', file=sys.stderr)
        return 1 if fallos else 0
    if len(argv) < 3:
        print(f'falta el archivo: voces.py {orden} <archivo.json>', file=sys.stderr)
        return 2
    if orden == 'semilla':
        if len(argv) < 4 or not argv[3].isdigit():
            print('uso: voces.py semilla <diseno.json> <n>', file=sys.stderr)
            return 2
        with open(argv[2], encoding='utf-8') as f:
            texto = f.read()
        nuevo, n = re.subn(r'("semilla"\s*:\s*)-?\d+', rf'\g<1>{int(argv[3])}', texto)
        if n != 1:
            print(f'ABORTO: {argv[2]} no tiene una «semilla» que cambiar', file=sys.stderr)
            return 1
        with open(argv[2], 'w', encoding='utf-8') as f:
            f.write(nuevo)
        return 0
    datos = cargar(argv[2])
    errores = errores_cadena(datos) if orden == 'sox' else errores_ficha(datos)
    if errores:
        print(f'ABORTO: {argv[2]}: ' + '; '.join(errores), file=sys.stderr)
        return 1
    if orden == 'instruct':
        print(instruct(datos))
    elif orden == 'texto':
        print(datos['texto_prueba'])
    else:
        print('\n'.join(sox(datos, lambda m: print(m, file=sys.stderr))))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
